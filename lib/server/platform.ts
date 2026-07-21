// The Integration Platform engine: API keys, permissions, rate limits and
// the webhook dispatcher. Connectors (MarketVox, MVSocial, WooCommerce,
// custom apps) are catalog entries and permission sets on top of this
// engine — never special cases inside Sendloom core.
import { createHmac, randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "./db";
import { audit } from "./audit";
import { hashPassword, verifyPassword, checkRateLimit } from "./auth";

// ---- Permissions ----------------------------------------------------------

export const PERMISSIONS = [
  "contacts:read", "contacts:write", "contacts:delete",
  "events:write",
  "segments:read",
  "forms:read", "forms:write",
  "analytics:read",
  "webhooks:manage",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

// ---- Connector catalog ----------------------------------------------------
// Adding a platform = adding an entry here. No core code changes.

export type CatalogEntry = {
  slug: string; name: string; kind: string; blurb: string;
  defaultPermissions: Permission[];
  // Namespaced lifecycle events this connector is expected to push.
  eventVocabulary: string[];
};

export const CATALOG: CatalogEntry[] = [
  {
    slug: "marketvox",
    name: "MarketVox",
    kind: "trading",
    blurb: "Trading platform. Pushes lead, verification, funding and attribution lifecycle events; reads segments for IB campaigns.",
    defaultPermissions: ["contacts:read", "contacts:write", "events:write", "segments:read", "webhooks:manage"],
    eventVocabulary: [
      "marketvox.lead.created", "marketvox.lead.updated", "marketvox.account.opened",
      "marketvox.account.verified", "marketvox.account.funded", "marketvox.deposit.first",
      "marketvox.trader.linked", "marketvox.ib.linked", "marketvox.attribution.set",
    ],
  },
  {
    slug: "mvsocial",
    name: "MV Socials",
    kind: "social",
    blurb: "Social copy-trading platform. Marketing events only: community, follows, invites and copy relationships.",
    defaultPermissions: ["contacts:read", "contacts:write", "events:write", "webhooks:manage"],
    eventVocabulary: [
      "mvsocial.lead.created", "mvsocial.community.joined", "mvsocial.trader.followed",
      "mvsocial.strategy.followed", "mvsocial.invite.accepted", "mvsocial.referral.used",
      "mvsocial.copy.created", "mvsocial.copy.removed",
    ],
  },
  {
    slug: "woocommerce",
    name: "WooCommerce",
    kind: "commerce",
    blurb: "Store tracking, orders and carts. Connected through the Sendloom plugin and storefront tracker.",
    defaultPermissions: ["contacts:read", "events:write"],
    eventVocabulary: [],
  },
  {
    slug: "custom-api",
    name: "Custom API",
    kind: "custom",
    blurb: "Any system of yours. Full v1 API surface, scoped by the permissions you grant the key.",
    defaultPermissions: ["contacts:read", "contacts:write", "events:write", "segments:read", "webhooks:manage"],
    eventVocabulary: [],
  },
];

export async function ensureCatalog(workspaceId: string) {
  for (const c of CATALOG) {
    await db.integration.upsert({
      where: { workspaceId_slug: { workspaceId, slug: c.slug } },
      create: {
        workspaceId, slug: c.slug, name: c.name, kind: c.kind,
        status: c.slug === "woocommerce" ? "connected" : "not_connected",
        connectedAt: c.slug === "woocommerce" ? new Date() : null,
      },
      update: {},
    });
  }
}

export function catalogFor(slug: string): CatalogEntry | undefined {
  return CATALOG.find((c) => c.slug === slug);
}

// ---- API keys -------------------------------------------------------------
// Secret format sk_{env}_{keyId}_{random}: the id travels inside the secret,
// so lookup is direct and the stored hash never needs scanning.

export function generateKeyPair(env: string, keyId: string) {
  const publicKey = `pk_${env}_${randomBytes(12).toString("hex")}`;
  const secretKey = `sk_${env}_${keyId}_${randomBytes(24).toString("hex")}`;
  return { publicKey, secretKey };
}

// Create a key. The secret is returned ONCE and stored only as a hash.
// Key ids never contain underscores: the secret format embeds the id as the
// third underscore-separated part.
export async function createApiKey(opts: {
  workspaceId: string; integrationId: string; name: string;
  permissions: Permission[]; environment?: string; expiresAt?: Date | null; ipAllowlist?: string | null;
  rotatedFromId?: string | null;
}) {
  const env = opts.environment ?? "live";
  const keyId = `k${randomBytes(10).toString("hex")}`;
  const { publicKey, secretKey } = generateKeyPair(env, keyId);
  await db.apiKey.create({
    data: {
      id: keyId,
      workspaceId: opts.workspaceId,
      integrationId: opts.integrationId,
      name: opts.name,
      publicKey,
      secretHash: hashPassword(secretKey),
      secretHint: secretKey.slice(-4),
      permissions: JSON.stringify(opts.permissions),
      environment: env,
      expiresAt: opts.expiresAt ?? null,
      ipAllowlist: opts.ipAllowlist ?? null,
      rotatedFromId: opts.rotatedFromId ?? null,
    },
  });
  return { keyId, publicKey, secretKey };
}

// Rotate: the old key stops working immediately; a new one inherits the
// integration, name and permissions. Audited and webhook-announced.
export async function rotateApiKey(keyId: string, actor: string) {
  const old = await db.apiKey.findUnique({ where: { id: keyId } });
  if (!old) return null;
  await db.apiKey.update({ where: { id: keyId }, data: { status: "rotated" } });
  const next = await createApiKey({
    workspaceId: old.workspaceId,
    integrationId: old.integrationId,
    name: old.name,
    permissions: JSON.parse(old.permissions) as Permission[],
    environment: old.environment,
    expiresAt: old.expiresAt,
    ipAllowlist: old.ipAllowlist,
    rotatedFromId: old.id,
  });
  await audit(old.workspaceId, actor, "platform.key_rotated", `${old.name} (${old.secretHint} → ${next.secretKey.slice(-4)})`);
  await dispatchPlatformEvent(old.workspaceId, "api_key.rotated", { keyId: old.id, replacedBy: next.keyId });
  return next;
}

export type ApiAuthContext = {
  keyId: string;
  workspaceId: string;
  integrationId: string;
  integrationSlug: string;
  permissions: Permission[];
  requestId: string;
};

function deny(status: number, error: string, requestId: string): Response {
  return Response.json({ ok: false, error, requestId }, { status, headers: { "x-request-id": requestId } });
}

// Authenticate a v1 request and enforce one permission. Returns a Response
// (already correct to send) on failure.
export async function requireApiKey(req: NextRequest, permission: Permission | null): Promise<ApiAuthContext | Response> {
  const requestId = req.headers.get("x-request-id")?.slice(0, 64) || `req_${randomBytes(10).toString("hex")}`;
  const header = req.headers.get("authorization") ?? "";
  const secret = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const parts = secret.split("_"); // sk, env, keyId, random
  if (parts.length !== 4 || parts[0] !== "sk") return deny(401, "Missing or malformed API key.", requestId);
  const keyId = parts[2];

  const key = await db.apiKey.findUnique({ where: { id: keyId }, include: { integration: true } });
  if (!key || !verifyPassword(secret, key.secretHash)) return deny(401, "Invalid API key.", requestId);
  if (key.status !== "active") return deny(401, `API key is ${key.status}.`, requestId);
  if (key.expiresAt && key.expiresAt < new Date()) return deny(401, "API key has expired.", requestId);
  if (key.integration.status === "disabled") return deny(403, "Integration is disabled.", requestId);

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const allow = (key.ipAllowlist ?? "").split(",").map((v: string) => v.trim()).filter(Boolean);
  if (allow.length && !allow.includes(ip)) return deny(403, "IP address not allowed for this key.", requestId);

  if (!checkRateLimit(`apikey:${key.id}`, 120, 60_000)) return deny(429, "Rate limit exceeded (120 requests/minute).", requestId);

  const permissions = JSON.parse(key.permissions) as Permission[];
  if (permission && !permissions.includes(permission)) return deny(403, `API key lacks the '${permission}' permission.`, requestId);

  await db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return {
    keyId: key.id,
    workspaceId: key.workspaceId,
    integrationId: key.integrationId,
    integrationSlug: key.integration.slug,
    permissions,
    requestId,
  };
}

export function ok(data: Record<string, unknown>, requestId: string, status = 200): Response {
  return Response.json({ ok: true, ...data, requestId }, { status, headers: { "x-request-id": requestId } });
}

// ---- Webhook engine -------------------------------------------------------

export const WEBHOOK_EVENTS = [
  "contact.created", "contact.updated", "form.submitted", "consent.updated",
  "popup.viewed", "popup.closed", "integration.event", "webhook.test",
] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number] | string;

const RETRY_SCHEDULE_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 3600_000]; // then dead
const AUTO_DISABLE_AFTER_FAILS = 20;

export function signWebhook(secret: string, timestamp: number, body: string): string {
  const sig = createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
  return `t=${timestamp},v1=${sig}`;
}

async function attemptDelivery(deliveryId: string): Promise<void> {
  const d = await db.webhookDelivery.findUnique({ where: { id: deliveryId }, include: { endpoint: true } });
  if (!d || d.status === "success" || d.status === "dead") return;
  if (d.endpoint.status !== "active") {
    await db.webhookDelivery.update({ where: { id: d.id }, data: { status: "dead", responseNote: "endpoint disabled" } });
    return;
  }
  const ts = Date.now();
  let code: number | null = null;
  let note = "";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(d.endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sendloom-event": d.eventType,
        "x-sendloom-delivery": d.id,
        "x-sendloom-signature": signWebhook(d.endpoint.secret, ts, d.payload),
      },
      body: d.payload,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    code = res.status;
    note = res.ok ? "delivered" : `HTTP ${res.status}`;
    if (res.ok) {
      await db.webhookDelivery.update({
        where: { id: d.id },
        data: { status: "success", attempts: d.attempts + 1, responseCode: code, responseNote: note, deliveredAt: new Date(), nextRetryAt: null },
      });
      await db.webhookEndpoint.update({ where: { id: d.endpointId }, data: { failCount: 0, lastSuccessAt: new Date() } });
      return;
    }
  } catch (err) {
    note = err instanceof Error && err.name === "AbortError" ? "timeout after 5s" : "connection failed";
  }

  const attempts = d.attempts + 1;
  const dead = attempts > RETRY_SCHEDULE_MS.length;
  await db.webhookDelivery.update({
    where: { id: d.id },
    data: {
      status: dead ? "dead" : "failed",
      attempts,
      responseCode: code,
      responseNote: note,
      nextRetryAt: dead ? null : new Date(Date.now() + RETRY_SCHEDULE_MS[attempts - 1]),
    },
  });
  const ep = await db.webhookEndpoint.update({
    where: { id: d.endpointId },
    data: { failCount: { increment: 1 }, lastFailureAt: new Date() },
  });
  if (ep.failCount >= AUTO_DISABLE_AFTER_FAILS && ep.status === "active") {
    await db.webhookEndpoint.update({ where: { id: ep.id }, data: { status: "disabled" } });
    await audit(d.workspaceId, "platform", "webhook.auto_disabled", `${ep.url} after ${ep.failCount} consecutive failures`);
  }
}

// Fan an event out to every subscribed endpoint. Delivery is attempted
// immediately; failures land on the retry schedule.
export async function dispatchPlatformEvent(workspaceId: string, eventType: string, data: Record<string, unknown>): Promise<number> {
  const endpoints = await db.webhookEndpoint.findMany({ where: { workspaceId, status: "active" } });
  const matching = endpoints.filter((e: { events: string }) => {
    try {
      const subs = JSON.parse(e.events) as string[];
      return subs.includes("*") || subs.includes(eventType);
    } catch { return false; }
  });
  if (!matching.length) return 0;
  const body = JSON.stringify({ event: eventType, createdAt: new Date().toISOString(), data });
  for (const e of matching) {
    const delivery = await db.webhookDelivery.create({
      data: { workspaceId, endpointId: e.id, eventType, payload: body },
    });
    await attemptDelivery(delivery.id).catch(() => {});
  }
  return matching.length;
}

// Retry sweep: called opportunistically from platform routes and the test
// suite. A real worker/cron owns this in a scaled deployment.
export async function retryDueWebhooks(): Promise<number> {
  const due = await db.webhookDelivery.findMany({
    where: { status: "failed", nextRetryAt: { lte: new Date() } },
    take: 20,
  });
  for (const d of due) await attemptDelivery(d.id).catch(() => {});
  return due.length;
}

// ---- Integration lifecycle events ----------------------------------------
// Namespaced connector events (marketvox.*, mvsocial.*, custom.*) become
// Sendloom events, land on the contact timeline when a contact matches, and
// fan out to webhooks. This is the one write-path for every connector.
export async function ingestIntegrationEvent(opts: {
  workspaceId: string;
  integrationId: string;
  integrationSlug: string;
  name: string;
  email?: string;
  data?: Record<string, unknown>;
  occurredAt?: Date;
}): Promise<{ eventId: string; contactId: string | null }> {
  const occurredAt = opts.occurredAt ?? new Date();
  let contactId: string | null = null;
  if (opts.email) {
    const email = opts.email.trim().toLowerCase();
    const existing = await db.contact.findUnique({ where: { workspaceId_email: { workspaceId: opts.workspaceId, email } } });
    if (existing) {
      contactId = existing.id;
    } else {
      const created = await db.contact.create({ data: { workspaceId: opts.workspaceId, email, lastActivityAt: occurredAt } });
      contactId = created.id;
      await db.contactSource.create({
        data: { contactId, source: `Integration: ${opts.integrationSlug}`, sourceType: "api", detail: opts.name },
      });
      await dispatchPlatformEvent(opts.workspaceId, "contact.created", { contactId, email, source: opts.integrationSlug });
    }
  }
  const event = await db.event.create({
    data: {
      workspaceId: opts.workspaceId,
      contactId,
      type: "integration_event",
      payload: JSON.stringify({ name: opts.name, integration: opts.integrationSlug, ...(opts.data ?? {}) }),
      occurredAt,
      stream: "server",
      sourceContext: `integration:${opts.integrationSlug}`,
      acceptReason: "integration api key",
    },
  });
  if (contactId) {
    await db.timelineItem.create({
      data: { contactId, type: "integration_event", title: opts.name, detail: `via ${opts.integrationSlug}`, eventId: event.id, occurredAt },
    });
    await db.contact.update({ where: { id: contactId }, data: { lastActivityAt: occurredAt } });
  }
  await db.integration.update({ where: { id: opts.integrationId }, data: { lastEventAt: occurredAt, status: "connected", connectedAt: new Date() } }).catch(() => {});
  await dispatchPlatformEvent(opts.workspaceId, "integration.event", { name: opts.name, integration: opts.integrationSlug, contactId, email: opts.email });
  return { eventId: event.id, contactId };
}
