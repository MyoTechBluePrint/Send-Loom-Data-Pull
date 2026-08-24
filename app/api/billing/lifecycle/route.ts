// The lifecycle tick. Advances trials, fires the timed notifications and
// starts the first charge.
//
// Authenticated by a shared secret, not a session, so it can be called by a
// scheduler. Safe to call as often as you like: every transition and every
// notification is guarded to happen once. The tick itself lives in
// lib/server/lifecycle.ts, where the in-process ticker registered at boot
// runs the same work every minute; this route remains the manual override.
//
//   curl -X POST https://…/api/billing/lifecycle -H "x-billing-cron-key: …"
import { NextRequest } from "next/server";
import { runLifecycleTick } from "@/lib/server/lifecycle";
import { currentUser, can } from "@/lib/server/permissions";

export async function POST(req: NextRequest) {
  const key = process.env.BILLING_CRON_KEY;
  const presented = req.headers.get("x-billing-cron-key");

  let actor = "cron";
  if (!key || presented !== key) {
    // Fall back to an owner session, so the run button in admin works without
    // the operator needing the cron secret to hand.
    const user = await currentUser();
    if (!user || !can(user.role, "change_billing")) {
      return Response.json({ ok: false, error: "Not authorised." }, { status: 401 });
    }
    actor = user.email;
  }

  const summary = await runLifecycleTick({ origin: process.env.APP_ORIGIN ?? req.nextUrl.origin });
  return Response.json({ ok: true, ranBy: actor, ...summary });
}
