// Storefront vs backend domain separation for tracker ingestion.
// Customer behaviour is only real when it happens on the public storefront
// (myotech.store), never on API/admin hosts (api.myotech.store, wp-admin).
// Pure functions so the rules are unit-testable in test-flows.

export type DomainVerdict = { ok: true } | { ok: false; reason: string };

const BACKEND_PREFIXES = ["api.", "admin.", "backend.", "staging.", "dev."];
const ADMIN_PATH_MARKERS = ["/wp-admin", "wp-login.php"];

export function normalizeHost(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split(":")[0]
    .trim()
    .toLowerCase();
}

export function splitDomains(list: string | null | undefined): string[] {
  return (list ?? "")
    .split(",")
    .map((d) => normalizeHost(d))
    .filter(Boolean);
}

export function looksBackend(host: string): boolean {
  return BACKEND_PREFIXES.some((p) => host.startsWith(p));
}

export function isAdminPath(url: string | null | undefined): boolean {
  if (!url) return false;
  return ADMIN_PATH_MARKERS.some((m) => url.includes(m));
}

export const BACKEND_REJECT_REASON = "Rejected: backend/API domain is not an allowed storefront tracking domain.";
export const ADMIN_PATH_REJECT_REASON = "Rejected: WordPress admin pages are not customer journeys.";
export const NOT_ALLOWED_REJECT_REASON = "Rejected: origin is not on this store's storefront allowlist.";

/**
 * Decide whether a tracking submission counts as storefront traffic.
 * `origin` is the browser Origin header; `payloadHostname`/`payloadUrl` are
 * what the tracker reported about the page. Backend hosts and admin paths are
 * rejected even when the base domain is allowlisted; subdomains are NOT
 * implicitly trusted (api.myotech.store must never ride on myotech.store).
 */
export function classifyTrackingSource(opts: {
  origin: string | null;
  payloadHostname?: string | null;
  payloadUrl?: string | null;
  allowed: string | null | undefined;   // Store.domains
  backend: string | null | undefined;   // Store.backendDomains
}): DomainVerdict {
  const allowed = splitDomains(opts.allowed);
  const backend = splitDomains(opts.backend);
  const host = normalizeHost(opts.origin) || normalizeHost(opts.payloadHostname);

  if (isAdminPath(opts.payloadUrl)) {
    return { ok: false, reason: ADMIN_PATH_REJECT_REASON };
  }
  // No host at all (server-side tools, some privacy proxies): only enforceable
  // signal is the admin-path check above; allow so key-authed QA still works.
  if (!host) return { ok: true };

  if (backend.includes(host)) return { ok: false, reason: BACKEND_REJECT_REASON };
  if (looksBackend(host)) return { ok: false, reason: BACKEND_REJECT_REASON };
  if (allowed.length > 0 && !allowed.includes(host)) {
    return { ok: false, reason: NOT_ALLOWED_REJECT_REASON };
  }
  return { ok: true };
}
