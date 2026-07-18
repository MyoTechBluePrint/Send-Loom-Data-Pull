// PUBLIC tracker ingestion. Browsers authenticate with the store's publicId
// (never the secret API key) plus an origin allowlist. Only browser-safe
// event types are accepted here; server truth (orders, syncs) stays on the
// key-authenticated /api/v1 routes.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { enqueue } from "@/lib/server/queue";
import type { IncomingEvent } from "@/lib/server/events";

const BROWSER_TYPES = [
  "page_viewed", "product_viewed", "category_viewed", "search",
  "cart_add", "cart_remove", "cart_updated",
  "checkout_started", "checkout_email_entered", "checkout_phone_entered",
  "checkout_address_started", "checkout_completed",
  "newsletter_signup", "popup_viewed", "popup_closed", "popup_submitted",
  "form_submitted", "discount_code_used",
] as const;

const EventSchema = z.object({
  type: z.enum(BROWSER_TYPES),
  email: z.string().email().optional(),
  anonymousId: z.string().max(64).optional(),
  sessionId: z.string().max(64).optional(),
  eventId: z.string().max(64).optional(), // idempotency key from the tracker
  ts: z.number().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const Body = z.object({
  store: z.string().min(6).max(64), // publicId
  events: z.array(EventSchema).min(1).max(25),
});

function corsHeaders(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "invalid payload" }, { status: 400, headers });
  }

  const store = await db.store.findUnique({ where: { publicId: parsed.data.store } });
  if (!store) {
    return Response.json({ ok: false, error: "unknown store" }, { status: 403, headers });
  }

  // Origin allowlist: enforced only when the store has domains configured.
  if (store.domains && origin) {
    const host = origin.replace(/^https?:\/\//, "").replace(/^www\./, "");
    const allowed = store.domains.split(",").map((d) => d.trim().replace(/^www\./, "")).filter(Boolean);
    if (allowed.length > 0 && !allowed.some((d) => host === d || host.endsWith(`.${d}`))) {
      return Response.json({ ok: false, error: "origin not allowed for this store" }, { status: 403, headers });
    }
  }

  // Idempotency: skip events whose tracker eventId we've already stored.
  let accepted = 0, duplicates = 0;
  for (const e of parsed.data.events) {
    if (e.eventId) {
      const dupe = await db.event.findFirst({
        where: { storeId: store.id, type: e.type, payload: { contains: `"eventId":"${e.eventId}"` } },
        select: { id: true },
      });
      if (dupe) { duplicates++; continue; }
    }
    const payload: IncomingEvent = {
      workspaceId: store.workspaceId,
      storeId: store.id,
      type: e.type,
      email: e.email,
      anonymousId: e.anonymousId,
      payload: { ...(e.payload ?? {}), ...(e.eventId ? { eventId: e.eventId } : {}), ...(e.sessionId ? { sessionId: e.sessionId } : {}), source: "tracker" },
      occurredAt: e.ts ? new Date(e.ts) : undefined,
    };
    await enqueue({ name: "event.ingest", payload });
    accepted++;
  }

  return Response.json({ ok: true, accepted, duplicates }, { headers });
}
