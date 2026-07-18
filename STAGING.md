# Sendloom Staging · Operations Guide

How staging access works and how to run it safely. **Never put real
passwords in Git, README, reports, chat logs or screenshots.**

## How login works

- Accounts live in the database; passwords are scrypt hashes only.
- Users are provisioned at every boot from the `SEED_USERS` environment
  variable in Render (format `email:password,email:password`). Re-running is
  safe: it refreshes hashes and roles, never duplicates.
- Steve's real address is auto-aliased to the owner entry's password.
- Sessions are signed cookies: 7 days, or 30 with "Keep me signed in".
- Login is rate limited (10 attempts / 15 min per IP+email). Failed attempts
  are audited with email, timestamp, reason, IP and user agent. Passwords are
  never logged anywhere.

## Rotating passwords

> Staging passwords should be rotated after sharing or after appearing in
> logs.

1. Render dashboard → sendloom → Environment → edit `SEED_USERS`.
2. Change the password part of each affected `email:password` pair.
3. Save. Render restarts and the new hashes apply at boot.
4. Tell the affected person their new password through a separate channel.

## Adding a worker

Append `,new.person@company.com:TheirPassword` to `SEED_USERS` and save.
Role assignment: `steve@*` → owner, `talk@willwoolley.co.uk` → operator,
everyone else → viewer (adjust in `prisma/seed-users.ts` when the team grows).

## Disabling a worker

Remove their pair from `SEED_USERS` and save; on restart their password hash
is no longer refreshed but the old one remains valid, so ALSO rotate it out:
easiest is to set their pair to a new random password nobody is given, save,
then remove the pair on the next edit. (A proper disable flag ships with real
user management.)

## Roles (staging)

- **Owner** (Steve): everything, including feedback triage, demo reset,
  audit visibility.
- **Worker Admin / Operator** (Will): test everything, create demo data,
  submit feedback, view admin monitoring. Cannot triage feedback, reset demo
  data, change billing, enable live sending or touch secrets.
- **Viewer**: browse and submit feedback.

Enforced in `lib/server/permissions.ts` at the sensitive seams (triage,
reset, live sending). Full per-route RBAC is a production task.

## Clean launch workspace (current mode)

The visible staging workspace is the CLEAN LAUNCH state: MyoTech + Novatec
stores pending connection, template campaigns/automations/popups only, no
contacts, no demo revenue, no Savvy Mango data. Savvy Mango import is PARKED
at the ads team's request (/savvy is an archived preview). The Vitalis demo
still exists for development: Admin → Reset workspace → "Vitalis demo data",
or SENDLOOM_DATA_MODE=demo for local seeds. Back up before any reset:
Admin → Export backup (owner-only JSON dump).

## What is demo-only

Campaign/automation performance charts, keyword volumes/CPC, prospect list,
revenue-by-form. Everything labelled "Demo" or "seeded" in the UI. Contacts,
imports, inbox, tasks, audiences, feedback and the audit log are real
database records.

## What is NOT production-ready

Single shared workspace, SQLite on a disk (Postgres switch documented in
README), no password reset flow, no per-route RBAC, no HMAC on inbound
intake relay retries, in-memory rate limiting.

## Demo data reset (owner only)

Admin → "Reset demo data". Wipes the workspace's records and re-seeds the
clean Vitalis demo story. Staging only; the button is not rendered for
non-owners and the API refuses them. CLI equivalent:
`npm run db:reset` (local) — on Render use the Admin button.

## Reviewing feedback and activity

- Admin → Team feedback: filter by priority/area/author, set status
  (new/reviewed/actioned/rejected), add internal notes, convert to a task.
- Admin → Audit log: every login, logout, failed login, contact change,
  import, intake approval, send and reset, filterable by user.

## Required Render env vars

See [.env.example](.env.example): `DATABASE_URL` (blueprint), `SESSION_SECRET`
(generated), `INTAKE_WEBHOOK_SECRET` (generated), `SEED_USERS` (dashboard,
secret), `EMAIL_SENDING_ENABLED=false`, `PLUGIN_API_ENABLED`.
