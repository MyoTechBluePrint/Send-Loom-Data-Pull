# Sendloom · Parked 20 Jul 2026

One-page resume sheet. Everything below was live and verified on the night
this was written. To pick the project back up: read this file, then
STAGING.md for operations and ARCHITECTURE.md for internals.

## What this is

WooCommerce growth platform (tracking, abandoned carts, popups, imports,
audiences, campaigns) for MyoTech and Novatec, sellable beyond them.
Live at **https://sendloom.onrender.com** (Render, auto-deploys from main).
Repo: github.com/MyoTechBluePrint/Send-Loom-Data-Pull.

## Live state when parked

- Clean launch workspace: 0 contacts, template campaigns/automations/popups
  only, Savvy Mango import PARKED.
- **MyoTech: tracking live end to end.** Headless setup: customers browse
  myotech.store (tracker embedded via Google Tag Manager using the standalone
  snippet /t/<publicId>.js); WordPress+WooCommerce run at api.myotech.store
  with plugin v4.2.0 installed (server truth: orders/sync). Backend domain
  events are rejected by design and visible with reasons in Tracking QA.
- Novatec: store seeded, pending. REAL storefront domain still unconfirmed
  (novateclabs.co.uk is a placeholder Claude invented).
- Users: Steve (owner), Will Woolley (Full Access), Piotr hello@piotr.cx
  (Full Access), ads@frenziapp.com placeholder (Ads Operator), plus anything
  added later via /team.
- Plugin ZIP v4.4.0 in plugin-builds/ and served in-app (Store Tracking).
  The MyoTech WP still runs 4.2.0; updating it to 4.4.0 is outstanding
  (adds storefront-only guard, hostname reporting, internal-staff exclusion,
  self-test button).

## How to bring it back up

- Local dev: `npm run dev` (port 3009). After schema changes: `npx prisma
  migrate dev` then RESTART the dev server (stale client = 500s).
- QA: `npx tsc --noEmit`, `npm run build`, `npm run test:flows` (72 checks),
  `npm run plugin:zip` (secret-scan gated).
- Deploy: push to main; Render builds ~6 min; boot runs migrate deploy +
  seed-if-empty (mode-aware top-ups) + SEED_USERS provisioning.
- Verify deploys: fetch authenticated content, not status codes. Wizard-type
  UI lives in /_next chunks, not SSR HTML: grep the page's chunk files.
  Log in ONCE and reuse the cookie: login is rate limited 10/15min per
  IP+email. The standalone tracker caches 5 min in browsers.

## Open items (as parked)

1. Novatec: confirm real storefront domain, set via Store Tracking → Edit
   domains, install plugin + snippet, run the 5-part test plan.
2. Update MyoTech's plugin to v4.4.0 (upload ZIP over it in wp-admin).
3. myotech.co appeared in a rejected event: confirm whether it's a real
   customer domain (allowlist it via Edit domains) or noise (leave).
4. Mirror hello@piotr.cx (and any /team-created accounts) into SEED_USERS in
   Render so they survive a workspace reset.
5. Standing before real scale: rotate shared password, make repo private,
   move to Postgres (one-line datasource switch, plan in README), enable a
   real sending provider (SES seam ready, EMAIL_SENDING_ENABLED gate).
6. Backlog headlines: campaign sending live-mode, per-store environments,
   XLSX imports, event drawer in Tracking QA, punycode domains.

## Where things are

- Tracking integrity: lib/server/ingest-pipeline.ts (+ event-registry.ts,
  tracking-domains.ts). Every event is untrusted until classified into a
  stream (storefront/server/test/internal/rejected/quarantined); analytics
  read storefront+server only.
- Plugin source: wordpress-plugin/sendloom-woocommerce (v4.4.0), built ZIP in
  plugin-builds/.
- Standalone tracker snippet route: app/t/[publicId]/route.ts (public,
  forwarded-host aware, boot-once guard).
- Self-service: /team (logins/roles/passwords/disable) and Store Tracking →
  Edit domains (guardrailed) — config changes need no deploys.
- Data library: folders + import tagging with auto-suggestions (Dropzone).
- Ops guide: STAGING.md. Install guide: docs/myotech-novatec-install.md.
  Compatibility: docs/COMPATIBILITY.md. Coverage vs client briefs:
  COVERAGE.md.
- Backups: backups/ (gitignored). backups/parked-2026-07-20/ holds the live
  dump from parking night.

## Credentials map (no secrets in this file)

Logins provision from SEED_USERS env in Render (+ /team page). Store API
keys and tracking snippets: Store Tracking page (owner). The MyoTech key and
ZIP were also placed in Steve's ~/Downloads on 19-20 Jul.
