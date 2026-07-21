# Sendloom Integration Platform

The infrastructure layer that lets external systems talk to Sendloom.
MarketVox, MVSocial and WooCommerce are the first catalog entries; adding
Shopify, Stripe, HubSpot, Zapier or any custom app is a catalog entry plus
keys, never a core rebuild.

## Architecture

- **Catalog** (`lib/server/platform.ts` → `CATALOG`): each connector is
  data: slug, kind, default permissions, expected lifecycle-event
  vocabulary. `ensureCatalog()` materialises rows per workspace.
- **API keys**: `sk_{env}_{keyId}_{random}` secrets, stored only as scrypt
  hashes (shown once at creation), public `pk_` identifiers, granular
  permissions, expiry, IP allowlists, rotation (old key dies instantly,
  audited, `api_key.rotated` webhook), disable/enable. Every check runs in
  `requireApiKey()` — one auth path for the whole surface.
- **Versioned API** (`/api/v1/…`): ping, contacts (upsert + attribution +
  consent), track (namespaced lifecycle events, batch ≤ 50), segments,
  webhooks CRUD. All responses carry `requestId`; send `x-request-id` to
  correlate. v2 lands beside v1, never on top of it.
- **Webhook engine**: endpoints subscribe to events (or `*`); deliveries
  signed `x-sendloom-signature: t=<ts>,v1=HMAC_SHA256(secret, "<t>.<body>")`
  (verify with a ±5 min replay window); retries at 1m/5m/30m/2h then dead;
  20 consecutive failures auto-disables the endpoint (audited); full
  delivery log with response codes. `retryDueWebhooks()` runs the sweep —
  called opportunistically today, cron/worker-owned at scale.
- **Event engine**: connector events are namespaced
  (`marketvox.deposit.first`, `mvsocial.trader.followed`, `custom.*`),
  become Sendloom events + contact-timeline entries, update integration
  health, and fan out to webhooks. Core activity (contact.created,
  form.submitted, popup.viewed/closed, consent.updated) fans out too.
- **Tenant isolation**: every row and every query is workspace-scoped; a
  key can only ever see its own workspace (covered by automated tests).

## The spec is the docs

`lib/server/platform-spec.ts` drives BOTH `/api/v1/openapi.json` and the
in-app reference at `/integrations/docs`, so they cannot drift.

## Portal

- `/integrations` — platform home: vitals, connector health, last events.
- `/integrations/<slug>` — keys (create/rotate/disable, secret shown
  once), webhook endpoints (create/test/enable/disable/delete), delivery
  log, live event feed, connector vocabulary, Try-it console against the
  real API.
- `/integrations/docs` — generated reference, auth, signatures, errors,
  rate limits, SDK starters.

## Adding the next platform (e.g. Shopify)

1. Add a `CATALOG` entry (slug, kind, blurb, default permissions, event
   vocabulary).
2. That's it. Keys, webhooks, docs, portal pages and the v1 surface exist
   the moment the entry does. Build connector-specific sync jobs only if
   the platform needs polling rather than pushing.

## Deliberate limits (today)

- Rate limiting and the retry sweep are in-process — right for a
  single-instance deployment; move to Redis/queue workers with scale
  (the queue seam already exists).
- OAuth flows, per-IB sub-tenancy, landing pages, email sequences and the
  marketplace UI are designed-for but not built; nothing in the schema
  blocks them.
- Analytics reads for integrations expose segments only; a richer
  `analytics:read` surface is specced but not yet routed.
