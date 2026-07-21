# Development access & QA

How authorised tooling (Claude, browser automation, E2E tests) inspects
every protected Sendloom page without anyone's real password.

## The pieces

1. **Dev accounts** — reserved `@sendloom.local` users, one per role:
   `developer@` (owner), `dev.admin@` (full access), `dev.marketing@`
   (ads operator), `dev.viewer@` (viewer). They exist only where
   `SENDLOOM_DEV_PASSWORD` is configured and are refreshed automatically
   when one signs in (the login route heals a fresh database), plus at
   seed/boot top-up.
2. **Test-session utility** — `POST /api/auth/test-session` with header
   `x-sendloom-test-secret: $SENDLOOM_TEST_AUTH_SECRET` mints a 6-hour
   session cookie for a `@sendloom.local` account. Rate-limited, audited,
   never echoes secrets, 404 on wrong/missing secret.
3. **Production kill-switch** — both paths run through
   `devAccessAllowed()`: `false` whenever `NODE_ENV === "production"`
   unless `SENDLOOM_ALLOW_TEST_AUTH=preview-approved` is deliberately set
   for a protected preview environment. Covered by automated tests.

## Environment safety matrix

| Environment    | Real login | Dev accounts | Test-session | Role switching |
| -------------- | ---------- | ------------ | ------------ | -------------- |
| Local dev      | yes        | yes          | yes          | yes (4 seeded roles) |
| Automated test | not needed | yes          | yes          | yes            |
| Preview        | yes        | only with `SENDLOOM_ALLOW_TEST_AUTH` | same | same |
| Production     | yes        | **no**       | **404**      | no             |

## Setup (once per machine)

`.env.development` (gitignored, loaded only by `next dev`):

```
SENDLOOM_DEV_PASSWORD=<choose one>
SENDLOOM_TEST_AUTH_SECRET=<choose one>
```

Rotate either any time: change the value, sign in again (accounts
re-hash on login). Never put these in `.env`, Render or the repo.

## Using it

- **Browser/manual**: sign in at `/login` as `developer@sendloom.local`
  with the dev password.
- **Automation**: `curl -X POST http://localhost:3009/api/auth/test-session
  -H "x-sendloom-test-secret: $SENDLOOM_TEST_AUTH_SECRET"` → reuse the
  `Set-Cookie` for authenticated requests/screenshots. Playwright-style
  saved-state flows do exactly this in a global setup.
- **QA suite**: `npm run test:flows` (94 checks) covers imports, scoring,
  segments, carts, campaigns, tracking AND the platform: key auth,
  permissions, rotation, rate limits, tenant isolation, webhook
  delivery/signature/retry, and the production guards above.

## Rules

- Real user passwords never appear in the repo, env files, logs or chat.
- Dev accounts never receive real customer data responsibilities; the
  local database is demo data.
- If a protected page can't be reached by tooling, fix access via these
  mechanisms — never by weakening production auth.
