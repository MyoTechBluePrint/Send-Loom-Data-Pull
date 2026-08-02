# Subscriptions, trials and billing

## What is real, and what is not

**Real now, with no configuration:** the whole subscription lifecycle. Trials
start, states advance on a clock, entitlements are enforced server side,
notifications compose and send through the platform's existing email provider,
invoices are written, admin controls work, and every change is audited.

**Not real until Stripe is connected:** taking money. With no
`STRIPE_SECRET_KEY` the system runs in **simulated** mode. The checkout screen
says so in a banner, the invoices it produces are stamped `SIMULATED`, and the
billing page carries a warning. No card is collected and no money moves. This
exists so the seven-day journey can be walked and reviewed before credentials
arrive, not to imply the payment leg works.

Switching to real payments is two environment variables. No code change.

## Existing in-house accounts

Every workspace that existed before billing shipped was given a
**complimentary** subscription by `scripts/seed-plans.ts`. Those accounts:

- resolve to unlimited entitlements
- are skipped entirely by the lifecycle engine
- see no trial strip, no countdown, no prompts and no upgrade buttons
- cannot be blocked by any limit check

There are two independent protections, not one. A workspace with **no**
subscription row also resolves to unlimited access, so an account that somehow
missed the seed still cannot be locked out. `npm run test:billing` asserts all
of this against the live database on every run.

## Environment

```
# Leave both empty for simulated mode.
STRIPE_SECRET_KEY=""
STRIPE_WEBHOOK_SECRET=""
STRIPE_PUBLISHABLE_KEY=""

# Absolute origin, used in billing emails and Stripe redirect URLs.
APP_ORIGIN="https://sendloom.onrender.com"

# Shared secret for the lifecycle tick.
BILLING_CRON_KEY=""

# Set to "closed" to stop self-serve signups without a deploy.
SENDLOOM_SIGNUPS=""

# Production-only escape hatch. Simulated billing refuses to run in production
# unless this is exactly "yes". Leave empty.
SENDLOOM_ALLOW_SIMULATED_BILLING=""
```

## Going live with Stripe

1. Set `STRIPE_SECRET_KEY` and `STRIPE_PUBLISHABLE_KEY`.
2. Add a webhook endpoint in Stripe pointing at `POST /api/billing/webhook`,
   subscribed to `checkout.session.completed`, `invoice.paid`,
   `invoice.payment_failed`, `customer.subscription.updated` and
   `customer.subscription.deleted`.
3. Put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Redeploy. The billing page's simulation warning disappears on its own.

Prices are created from the plan catalogue at checkout time, so there is
nothing to configure in the Stripe dashboard first. Apple Pay, SCA, retries,
tax and invoice PDFs all come from Stripe Checkout.

## The lifecycle tick

State changes are driven by a job, not by page loads. Call it on a schedule
(every 15 minutes is ample for a seven-day trial):

```bash
curl -X POST "$APP_ORIGIN/api/billing/lifecycle" -H "x-billing-cron-key: $BILLING_CRON_KEY"
```

An owner can also run it from **Admin → Subscriptions → Run lifecycle now**.
Every transition and notification is guarded to happen once, so calling it
repeatedly is safe.

## The customer journey

1. `/signup` — one short form: name, work email, password, business name,
   optional website, terms acceptance (persisted as `User.termsAcceptedAt`).
2. `/onboarding/trial` — trial confirmed, the two dates that matter, one
   button in. (`/welcome` redirects here.)
3. `/onboarding/business` — the commercial questions, all skippable. Answers
   are stored on the subscription and drive the plan recommendation.
4. `/plans` (alias `/billing/plans`) — plan selection with the recommendation
   and exact dates. `/billing/checkout` also lands here.
5. Checkout — Stripe Checkout in Stripe mode; the labelled simulation without.
6. `/settings/billing` — plan, dates, amounts, usage, invoices, cancellation.

Accounts carry an explicit `accountType`: `external` (self-serve signups, the
only type billed), `grandfathered` (existed before billing), `internal`
(deliberately comped). Never inferred from an email domain.

## Where things live

| Concern | File |
| --- | --- |
| What may this account do? | `lib/server/entitlements.ts` |
| What does each state mean? | `lib/server/subscription-states.ts` |
| Trial start, plan recommendation | `lib/server/trial.ts` |
| Enforcement at the point of spend | `lib/server/billing/guard.ts` |
| Provider seam, checkout, idempotency | `lib/server/billing/provider.ts` |
| Stripe REST and webhook signatures | `lib/server/billing/stripe.ts` |
| State machine, charges, recovery | `lib/server/billing/lifecycle.ts` |
| Notification templates | `lib/server/billing/notifications.ts` |
| Plan catalogue and grandfathering | `scripts/seed-plans.ts` |
| Lifecycle test, 43 checks | `scripts/test-billing.ts` |

Nothing outside `entitlements.ts` and `guard.ts` should ever ask what plan an
account is on. Ask whether it is entitled to something.

## Editing plans

Prices, limits and entitlements are data, not code. **Admin → Subscriptions →
Plans, prices and limits** edits them live, no deploy. `-1` means unlimited.
Adding a new limit needs no migration: the entitlements column is JSON.

## Running the tests

```bash
npm run test:billing
```

Walks a synthetic account from signup to paying customer by moving the clock,
then asserts cancellation, payment failure, recovery, gradual restriction,
idempotency, duplicate-charge protection, server-side limit enforcement, and
finally that the real in-house workspaces are byte-for-byte unchanged. It
cleans up after itself.
