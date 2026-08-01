// Thin Stripe REST client.
//
// Deliberately not the Stripe SDK: SendLoom has a small dependency surface and
// the four calls billing needs (customers, checkout sessions, subscriptions,
// invoices) are plain form-encoded POSTs. Webhook signatures are verified with
// node crypto against Stripe's documented scheme, so nothing about security is
// being taken on trust from a front end.

import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://api.stripe.com/v1";

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function stripePublishableKey(): string | null {
  return process.env.STRIPE_PUBLISHABLE_KEY ?? null;
}

/** Stripe takes nested params as bracketed form fields: a[b][c]=v. */
export function formEncode(obj: Record<string, unknown>, prefix = ""): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) {
      v.forEach((item, i) => {
        if (item && typeof item === "object") out.push(...formEncode(item as Record<string, unknown>, `${key}[${i}]`));
        else out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(item))}`);
      });
    } else if (typeof v === "object") {
      out.push(...formEncode(v as Record<string, unknown>, key));
    } else {
      out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return out;
}

export class StripeError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "StripeError";
  }
}

export async function stripeRequest<T = Record<string, unknown>>(
  path: string,
  body?: Record<string, unknown>,
  opts: { method?: "GET" | "POST" | "DELETE"; idempotencyKey?: string } = {}
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("STRIPE_SECRET_KEY is not configured.", 500);

  const method = opts.method ?? (body ? "POST" : "GET");
  const encoded = body ? formEncode(body).join("&") : "";
  const url = method === "GET" && encoded ? `${API}${path}?${encoded}` : `${API}${path}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  // Stripe dedupes retries by this key, which is what stops a double-clicked
  // checkout button creating two subscriptions.
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  const res = await fetch(url, {
    method,
    headers,
    body: method === "GET" ? undefined : encoded,
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = json.error as { message?: string; code?: string } | undefined;
    throw new StripeError(err?.message ?? `Stripe request failed (${res.status})`, res.status, err?.code);
  }
  return json as T;
}

/**
 * Verify a Stripe webhook signature.
 * Scheme: header is `t=<unix>,v1=<hex hmac>`, signed over `<t>.<raw body>`.
 * Returns false rather than throwing, so a bad signature is a 400 and never a
 * 500 that Stripe would keep retrying.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string | undefined,
  toleranceSeconds = 300
): boolean {
  if (!signatureHeader || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;

  // Reject replays of an old, captured request.
  const age = Math.abs(Math.floor(Date.now() / 1000) - parseInt(t, 10));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
