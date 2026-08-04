# SendLoom developer handover

One-page orientation for the incoming dev team. Deeper docs are linked at the bottom.

## Stack

- Next.js 16 (App Router, React Server Components) plus Tailwind v4. Note: this Next version has breaking changes vs older docs, see AGENTS.md and node_modules/next/dist/docs after install.
- Prisma ORM on SQLite in dev (prisma/dev.db, gitignored). Production runs on a Render disk. Postgres is the intended production upgrade before real scale.
- Auth: scrypt password hashes plus HMAC session cookie, edge gate in proxy.ts (Next 16 uses proxy.ts, not middleware.ts). Roles in lib/server/permissions.ts.
- WooCommerce plugin (PHP) in wordpress-plugin/sendloom-woocommerce, built to a zip via `npm run plugin:zip`.

## Run it locally

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev   # port 3009
```

Marketing landing page is at /home, product signup at /signup, app behind /login.

## Environment

Copy .env.example and fill in. Nothing secret is committed. Key variables:

- SEED_USERS: "email:password" pairs provisioned at boot (production logins live in Render env).
- STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET: billing goes live only when these are set. Until then the Stripe seam is SIMULATED on purpose: no real money moves anywhere.
- RESEND_WEBHOOK_SECRET plus a Resend webhook pointed at /api/t/delivery for delivery/bounce events.
- BILLING_CRON_KEY and a scheduled POST to /api/billing/lifecycle (drives trial lifecycle and smart-send batches).
- EMAIL_SENDING_ENABLED plus provider creds arm real email sending; default is a dev logger.
- SENDLOOM_TIMEZONE: send-window timezone, defaults to Europe/London.

## Tests

```bash
npx tsx scripts/test-flows.ts      # platform flows (one known pre-existing failure: "retry recovers to success")
npx tsx scripts/test-billing.ts    # subscriptions and entitlements
npx tsx scripts/test-campaigns.ts  # campaigns, blocks, promotions
```

`npx next build` must pass before deploy.

## Deploy

Render blueprint (render.yaml). Pushing to main on the GitHub repo auto-deploys to sendloom.onrender.com. Boot runs seed-plans and idempotent seed top-ups; a workspace reset regenerates store API keys, so reconnect plugins after any reset.

## Honest status notes

- Billing is simulated until Stripe keys are set in Render. In-house workspaces are grandfathered complimentary and must never be charged.
- The landing page stats, testimonials and company logos are placeholder comp content, marked with data-placeholder attributes. Replace before paid traffic.
- Shopify commerce adapter is an intentional coming_soon stub. WooCommerce is the operational adapter and needs plugin v4.5 installed for coupon push.
- The Loomi mascot on /home is a static art placement (components/loomi.tsx); sprite sources live in public/mascot.

## Deeper docs in this repo

- ARCHITECTURE.md: entity and provider layer plan
- BILLING.md: subscription and trial runbook
- STAGING.md: ops guide, logins, rotation drill
- INTEGRATION_PLATFORM.md and docs/COMMS-OS.md: public API, webhooks, journeys
- docs/COMPATIBILITY.md and docs/myotech-novatec-install.md: WooCommerce plugin
- COVERAGE.md: client brief coverage map
