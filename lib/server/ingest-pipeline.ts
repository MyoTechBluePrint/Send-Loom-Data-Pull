// Event validation pipeline. Every event is UNTRUSTED until it passes:
//   schema (zod at the route) → store resolution (route) → payload scrub →
//   domain + route authorisation → registry source check → test/internal
//   classification → timestamp validation → stream decision.
// Only accepted events are persisted; only storefront/server streams may
// drive analytics, carts, scoring and consent.
import { classifyTrackingSource, isAdminPath, normalizeHost } from "./tracking-domains";
import { sourceAllowed, type SourceContext } from "./event-registry";

export type PipelineStore = {
  id: string;
  domains: string | null;
  backendDomains: string | null;
  trackingMode: string;
};

export type PipelineInput = {
  type: string;
  payload?: Record<string, unknown>;
  origin?: string | null; // browser Origin header when the event came via /api/t
  occurredAt?: Date;
  store?: PipelineStore | null;
};

export type PipelineVerdict =
  | { action: "accept"; stream: "storefront" | "server" | "test" | "internal"; sourceContext: SourceContext; reason: string; payload?: Record<string, unknown> }
  | { action: "reject" | "quarantine"; stream: "rejected"; sourceContext: SourceContext; reason: string };

// ---- Payload scrubbing: PII/credentials must never persist ----
const BLOCKED_KEYS = /pass(word)?|card|cvv|cvc|secret|token|nonce|authorization|cookie|api[_-]?key/i;
const BLOCKED_QUERY_PARAMS = /^(token|key|secret|password|auth|nonce|code|session)$/i;

export function scrubPayload(payload?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!payload) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (BLOCKED_KEYS.test(k)) continue;
    out[k] = typeof v === "string" && (k === "url" || k === "referrer") ? scrubUrl(v) : v;
  }
  return out;
}

function scrubUrl(u: string): string {
  const [path, qs] = u.split("?");
  if (!qs) return u;
  const kept = qs
    .split("&")
    .filter((pair) => !BLOCKED_QUERY_PARAMS.test(pair.split("=")[0] ?? ""));
  return kept.length ? `${path}?${kept.join("&")}` : path;
}

const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;      // clocks drift a little
const STALE_TOLERANCE_MS = 30 * 24 * 60 * 60 * 1000; // older than 30d is suspect

function str(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

export function classifyEvent(e: PipelineInput): PipelineVerdict {
  const payload = scrubPayload(e.payload);

  // Source context: explicit markers set by each entry route.
  const rawSource = str(e.payload?.source);
  const sourceContext: SourceContext =
    rawSource === "qa-panel" ? "qa-panel"
    : rawSource === "tracker" ? "tracker"
    : rawSource === "plugin" ? "plugin"
    : "system";

  // Domain + route authorisation for anything that reports where it happened.
  if (e.store && (e.origin || payload?.hostname || payload?.url)) {
    const verdict = classifyTrackingSource({
      origin: e.origin ?? null,
      payloadHostname: str(payload?.hostname),
      payloadUrl: str(payload?.url),
      allowed: e.store.domains,
      backend: e.store.backendDomains,
    });
    if (!verdict.ok) {
      return { action: "reject", stream: "rejected", sourceContext, reason: verdict.reason };
    }
  } else if (isAdminPath(str(payload?.url))) {
    return { action: "reject", stream: "rejected", sourceContext, reason: "Rejected: WordPress admin pages are not customer journeys." };
  }

  // Registry: may this source produce this event type at all?
  if (!sourceAllowed(e.type, sourceContext)) {
    return {
      action: "quarantine", stream: "rejected", sourceContext,
      reason: `Quarantined: ${e.type} is not a valid event from source '${sourceContext}'.`,
    };
  }

  // Timestamp sanity.
  if (e.occurredAt) {
    const drift = e.occurredAt.getTime() - Date.now();
    if (drift > FUTURE_TOLERANCE_MS) {
      return { action: "quarantine", stream: "rejected", sourceContext, reason: "Quarantined: event timestamp is in the future." };
    }
    if (drift < -STALE_TOLERANCE_MS) {
      return { action: "quarantine", stream: "rejected", sourceContext, reason: "Quarantined: event timestamp is older than the accepted window." };
    }
  }

  // Test / internal classification: never customer analytics.
  const isTest =
    sourceContext === "qa-panel" ||
    str(payload?.url) === "/sendloom-test" ||
    str(payload?.pageType) === "test" ||
    e.store?.trackingMode === "test";
  if (isTest) {
    return { action: "accept", stream: "test", sourceContext, reason: "Test event: visible in QA, excluded from customer analytics.", payload };
  }
  if (str(payload?.context) === "internal") {
    return { action: "accept", stream: "internal", sourceContext, reason: "Internal traffic (logged-in store staff): excluded from customer analytics.", payload };
  }

  // Stream: browser behaviour vs server commerce truth.
  const stream = sourceContext === "tracker" ? "storefront" : sourceContext === "plugin" ? "server" : "storefront";
  const host = normalizeHost(e.origin) || normalizeHost(str(payload?.hostname));
  return {
    action: "accept", stream, sourceContext,
    reason: stream === "server"
      ? "Accepted: server-side commerce event from the authenticated plugin."
      : `Accepted: storefront event${host ? ` from ${host}` : ""}.`,
    payload,
  };
}

// Streams that are allowed to drive customer analytics, carts and scoring.
export const ANALYTICS_STREAMS = ["storefront", "server"] as const;
