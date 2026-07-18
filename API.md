# Sendloom API Reference

Two API surfaces:

- **`/api/v1/*`** — the store-facing API used by the WooCommerce plugin.
  Authenticated per request with the store API key in the `x-sendloom-key`
  header. All bodies validated with Zod; invalid events are rejected AND
  written to the audit log (`event.rejected`).
- **`/api/*` (internal)** — used by the Sendloom UI (imports, segments,
  tasks). Workspace-scoped; session auth to be added with real login.

Demo store key (seeded): `slm_live_demo_vitalis_4f2a`.

## Store API (v1)

### GET /api/v1/health
Health check. Works unauthenticated; includes store details when the key is
valid. `{ ok, service, version, authenticated, store }`

### POST /api/v1/connect
Marks the store connected, records plugin/Woo versions, audits.
Body: `{ storeUrl, pluginVersion?, wooVersion? }`

### POST /api/v1/events
Single event or `{ events: [...] }` batch (max 100). Types:
`product_viewed, category_viewed, search, cart_add, cart_remove,
checkout_started, checkout_completed, purchase_completed, account_created,
newsletter_signup, form_submitted, quiz_completed, guide_downloaded,
consultation_requested, consultation_booked`.

Fields: `{ type, email?, anonymousId?, occurredAt?, payload? }`

Pipeline per event: identify contact (browse events NEVER auto-create
contacts) → store event → domain side-effects (search → demand signal,
purchase → revenue rollups) → timeline item → lead score recompute.

### POST /api/v1/sync/customers
`{ customers: [...] }` (max 500). Upserts contacts; new contacts get a
source-ledger row and a consent row that is `granted` only when
`marketingConsent: true` was explicitly sent, otherwise `pending`.

### POST /api/v1/sync/orders
`{ orders: [...] }` (max 500). Upserts orders; new completed orders for known
contacts run through event ingestion (rollups + timeline + rescore).

### POST /api/v1/sync/products
`{ products: [...] }` (max 500). Straight upsert by external id.

## Internal API

### POST /api/imports
`{ name, source, sourceType, csv }` → creates an ImportBatch + raw ImportRows,
auto-detects column mapping. Returns `{ batchId, columns, mapping, preview, totalRows }`.

### POST /api/imports/:id/review
`{ mapping }` → runs the quality engine (invalid/disposable emails, in-file
and cross-database duplicates, suppression matches, consent gaps). Returns
`{ counts, issues }`.

### POST /api/imports/:id/confirm
`{ duplicateStrategy, tags, lawfulBasis, createSegment }` → writes contacts,
appends source + consent ledger rows, applies tags, optionally creates an
audience from the batch, audits. Returns `{ imported, merged, skipped, blocked, segmentId }`.

Safe rules enforced: opted-out contacts are never reactivated; suppressed
emails are never imported as marketable; consent is never overwritten by an
import, only appended when the file grants it.

### POST /api/segments/estimate
`{ match, rules }` → evaluates against the live contact set. Rules support
`exclude: true`. Returns `{ count, revenue, preview }`.

### POST /api/segments
Same body + `name`, saves the segment with computed counts.

### PATCH /api/tasks/:id
`{ status: "open" | "done" }`.

## Not built yet

Rate limiting (structure ready: per-store key auth makes keying trivial),
HMAC request signing (API key only for now), OAuth for partner apps,
campaign send endpoints.
