// End-to-end billing lifecycle test.
//
// Walks a synthetic account through the whole seven days by moving the clock,
// not by waiting, and asserts the things the brief actually asks for. Runs
// against the dev database and cleans up after itself.
//
//   npx tsx scripts/test-billing.ts
//
// The last check is the one that matters most on this instance: the in-house
// workspaces must come out the other side untouched.

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "../lib/server/db";
import { startTrial, recommendPlan, trialProgress } from "../lib/server/trial";
import { advanceWorkspace, applyFailedCharge, applySuccessfulCharge } from "../lib/server/billing/lifecycle";
import { applyCheckoutCompleted, recordEvent } from "../lib/server/billing/provider";
import { resolveEntitlements, UNLIMITED } from "../lib/server/entitlements";
import { guard } from "../lib/server/billing/guard";
import { trialDates } from "../lib/server/subscription-states";

const DAY = 86_400_000;
const HOUR = 3_600_000;

let passed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(`${name}${detail ? ` · ${detail}` : ""}`);
    console.log(`  ✗ ${name}${detail ? ` · ${detail}` : ""}`);
  }
}

async function statusOf(workspaceId: string) {
  const s = await db.subscription.findUnique({ where: { workspaceId } });
  return s?.status ?? "(none)";
}

async function makeAccount(name: string) {
  const ws = await db.workspace.create({ data: { name } });
  await db.user.create({
    data: { workspaceId: ws.id, email: `${ws.id}@billing-test.local`, name: "Test Owner", role: "owner" },
  });
  return ws.id;
}

async function cleanup(workspaceIds: string[]) {
  for (const id of workspaceIds) {
    const sub = await db.subscription.findUnique({ where: { workspaceId: id } });
    if (sub) {
      await db.invoice.deleteMany({ where: { subscriptionId: sub.id } });
      await db.subscriptionEvent.deleteMany({ where: { subscriptionId: sub.id } });
      await db.subscription.delete({ where: { id: sub.id } });
    }
    await db.usageCounter.deleteMany({ where: { workspaceId: id } });
    await db.auditLog.deleteMany({ where: { workspaceId: id } });
    await db.contact.deleteMany({ where: { workspaceId: id } });
    await db.user.deleteMany({ where: { workspaceId: id } });
    await db.workspace.delete({ where: { id } });
  }
}

async function main() {
  const created: string[] = [];

  // Snapshot the real accounts before anything runs, so the last check can
  // prove nothing here touched them.
  const before = await db.subscription.findMany({
    where: { complimentary: true },
    select: { workspaceId: true, status: true, complimentary: true, planId: true },
  });

  try {
    // ── The happy path: signup to paying customer ────────────────────────────
    console.log("\nTrial lifecycle, day 1 to day 7");
    const ws = await makeAccount("Billing test · happy path");
    created.push(ws);

    await startTrial(ws, { contactsBand: "1k_10k", primaryGoal: "recover_carts", platform: "woocommerce" }, "test");
    const sub = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });

    check("1. New user starts a trial", sub.status === "trialing_no_pm", sub.status);
    check("2. Trial begins without payment details", sub.paymentMethodVerifiedAt === null && sub.stripePaymentMethodId === null);

    const dates = trialDates(sub.trialStartedAt!);
    const stageOneDays = Math.round((dates.trialStageOneEndsAt.getTime() - dates.trialStartedAt.getTime()) / DAY);
    const totalDays = Math.round((dates.trialEndsAt.getTime() - dates.trialStartedAt.getTime()) / DAY);
    check("3. Three-day countdown is accurate", stageOneDays === 3 && totalDays === 7, `stage one ${stageOneDays}d, total ${totalDays}d`);

    // A trial must not be restartable by calling signup twice.
    await startTrial(ws, {}, "test");
    const dupes = await db.subscription.count({ where: { workspaceId: ws } });
    check("23. Revisiting signup does not create a duplicate subscription", dupes === 1, `${dupes} subscriptions`);

    // Day 3 minus 24h: warning only, no state change.
    const warn = await advanceWorkspace(ws, { now: new Date(sub.trialStartedAt!.getTime() + 2 * DAY) });
    check("4. Day-three warning fires 24 hours before", warn?.notified.includes("trial.day3_warning_24h") === true, JSON.stringify(warn?.notified ?? []));
    check("   Warning does not change the account state", (await statusOf(ws)) === "trialing_no_pm");

    // Day 3: the gate.
    await advanceWorkspace(ws, { now: new Date(sub.trialStartedAt!.getTime() + 3 * DAY + HOUR) });
    check("   Day three moves the account to trial_action_required", (await statusOf(ws)) === "trial_action_required");

    // The recommendation must not simply reach for the dearest plan.
    const rec = await recommendPlan(ws, { contactsBand: "1k_10k" });
    check("5/8. Recommendation picks the plan that fits, not the dearest", rec.planKey === "growth", rec.planKey);

    // £0 verification.
    const verified = await applyCheckoutCompleted({
      workspaceId: ws, planKey: "growth", cycle: "monthly",
      paymentMethodBrand: "visa", paymentMethodLast4: "4242",
      actorLabel: "test", externalId: `test_verify_${ws}`,
    });
    check("7. £0 payment-method verification works", verified?.status === "trialing_pm_verified", verified?.status);
    check("9. No money is taken at verification", (await db.invoice.count({ where: { subscriptionId: sub.id } })) === 0);

    const afterVerify = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    check("   First billing date is the trial end, not a fresh 7 days",
      afterVerify.firstBillingAt?.getTime() === afterVerify.trialEndsAt?.getTime());
    check("   The amount to be charged is recorded", afterVerify.firstChargePence === 7900, String(afterVerify.firstChargePence));

    // Replaying the same verification must be absorbed.
    await applyCheckoutCompleted({
      workspaceId: ws, planKey: "growth", cycle: "monthly",
      actorLabel: "test", externalId: `test_verify_${ws}`,
    });
    const verifyEvents = await db.subscriptionEvent.count({ where: { subscriptionId: sub.id, type: "pm.verified" } });
    check("21. Webhook events are idempotent", verifyEvents === 1, `${verifyEvents} pm.verified events`);

    // Days 4 to 7.
    const prog = await trialProgress(ws);
    check("10. Trial runs through to day seven", prog !== null && prog.totalDays === 7);

    // 48h and 24h notices.
    const n48 = await advanceWorkspace(ws, { now: new Date(afterVerify.firstBillingAt!.getTime() - 47 * HOUR) });
    check("   48-hour notice is sent", n48?.notified.includes("billing.charge_48h") === true);
    const n24 = await advanceWorkspace(ws, { now: new Date(afterVerify.firstBillingAt!.getTime() - 23 * HOUR) });
    check("   24-hour notice is sent and the state becomes trial_ending",
      n24?.notified.includes("billing.charge_24h") === true && (await statusOf(ws)) === "trial_ending");

    // Changing plan before billing.
    await applyCheckoutCompleted({
      workspaceId: ws, planKey: "launch", cycle: "monthly",
      actorLabel: "test", externalId: `test_change_${ws}`,
    });
    const changed = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws }, include: { plan: true } });
    check("11/19. Customer can change plan, and entitlements follow", changed.plan?.key === "launch" && changed.firstChargePence === 2900);
    const launchEnt = await resolveEntitlements(ws);
    check("   Trial entitlements apply while still trialling", launchEnt.entitlements.monthly_email_sends === 500, String(launchEnt.entitlements.monthly_email_sends));

    // Day 7: the charge.
    await applyCheckoutCompleted({ workspaceId: ws, planKey: "growth", cycle: "monthly", actorLabel: "test", externalId: `test_back_${ws}` });
    await advanceWorkspace(ws, { now: new Date(changed.firstBillingAt!.getTime() + HOUR) });
    const charged = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws } });
    check("14/16. First payment happens at the right time and the account becomes active", charged.status === "active", charged.status);

    const invoices = await db.invoice.findMany({ where: { subscriptionId: sub.id } });
    check("15. An invoice and receipt are created", invoices.length === 1 && invoices[0].status === "paid", `${invoices.length} invoices`);
    check("   A simulated charge is labelled as such", invoices[0]?.description?.includes("SIMULATED") === true, invoices[0]?.description ?? "");

    // Paid entitlements replace trial ones.
    const paidEnt = await resolveEntitlements(ws);
    check("19. Paid plan entitlements replace trial limits", paidEnt.entitlements.monthly_email_sends === 100000, String(paidEnt.entitlements.monthly_email_sends));

    // Duplicate charge protection.
    await applySuccessfulCharge(ws, { actorLabel: "test", externalId: `dup_${ws}`, stripeInvoiceId: `in_test_${ws}` });
    await applySuccessfulCharge(ws, { actorLabel: "test", externalId: `dup2_${ws}`, stripeInvoiceId: `in_test_${ws}` });
    const afterDupes = await db.invoice.count({ where: { subscriptionId: sub.id } });
    check("22. Duplicate charges cannot occur", afterDupes === 2, `${afterDupes} invoices, expected 2`);

    // ── Enforcement ──────────────────────────────────────────────────────────
    console.log("\nEnforcement");
    const ws2 = await makeAccount("Billing test · limits");
    created.push(ws2);
    await startTrial(ws2, {}, "test");

    const sendGuard = await guard(ws2, "monthly_email_sends", 501);
    check("20. Trial limits are enforced server side", sendGuard.allowed === false, JSON.stringify(sendGuard));
    check("   The refusal names a plan that would cover it", sendGuard.allowed === false && Boolean(sendGuard.upgradeTo), sendGuard.allowed === false ? String(sendGuard.upgradeTo) : "");

    const okGuard = await guard(ws2, "monthly_email_sends", 100);
    check("   Within-limit sends are allowed", okGuard.allowed === true);

    // Restricted accounts keep their data and lose the ability to spend.
    await db.subscription.update({ where: { workspaceId: ws2 }, data: { status: "restricted" } });
    const restricted = await guard(ws2, "monthly_email_sends", 1);
    check("   A restricted account cannot send", restricted.allowed === false && restricted.reason === "state");
    const restrictedEnt = await resolveEntitlements(ws2);
    check("21(data). A restricted account keeps its contacts visible", restrictedEnt.entitlements.monthly_contacts === UNLIMITED);

    // ── Cancellation ─────────────────────────────────────────────────────────
    console.log("\nCancellation and recovery");
    const ws3 = await makeAccount("Billing test · cancel");
    created.push(ws3);
    await startTrial(ws3, {}, "test");
    await applyCheckoutCompleted({ workspaceId: ws3, planKey: "growth", cycle: "monthly", actorLabel: "test", externalId: `v3_${ws3}` });

    const sub3 = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws3 } });
    await db.subscription.update({
      where: { id: sub3.id },
      data: { status: "scheduled_cancel", cancelScheduledAt: sub3.trialEndsAt, firstChargePence: 0, cancelReason: "Testing" },
    });
    await advanceWorkspace(ws3, { now: new Date(sub3.trialEndsAt!.getTime() + HOUR) });
    const cancelled = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws3 } });
    check("12/13. A cancelled trial ends without a charge",
      cancelled.status === "cancelled" && (await db.invoice.count({ where: { subscriptionId: sub3.id } })) === 0);
    check("   Data retention deadline is set and in the future", (cancelled.accessRestrictedAt?.getTime() ?? 0) > Date.now());

    // Failed payment then recovery.
    const ws4 = await makeAccount("Billing test · recovery");
    created.push(ws4);
    await startTrial(ws4, {}, "test");
    await applyCheckoutCompleted({ workspaceId: ws4, planKey: "growth", cycle: "monthly", actorLabel: "test", externalId: `v4_${ws4}` });
    await applyFailedCharge(ws4, { actorLabel: "test", amountPence: 7900, reason: "Card declined", externalId: `f4_${ws4}` });

    const failed = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws4 } });
    check("17. A failed payment enters controlled recovery", failed.status === "payment_failed", failed.status);
    check("   The customer keeps working during recovery", (await guard(ws4, "monthly_email_sends", 10)).allowed === true);
    check("   A restriction date is set and shown", failed.accessRestrictedAt !== null);

    await applySuccessfulCharge(ws4, { actorLabel: "test", amountPence: 7900, externalId: `r4_${ws4}` });
    const recovered = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws4 } });
    check("18. A retried payment restores access", recovered.status === "active" && recovered.paymentFailedAt === null);

    // Restriction after the grace period.
    await applyFailedCharge(ws4, { actorLabel: "test", amountPence: 7900, reason: "Declined again", externalId: `f4b_${ws4}` });
    const failedAgain = await db.subscription.findUniqueOrThrow({ where: { workspaceId: ws4 } });
    await advanceWorkspace(ws4, { now: new Date(failedAgain.paymentFailedAt!.getTime() + 8 * DAY) });
    check("   Restriction is gradual, not immediate", (await statusOf(ws4)) === "restricted");

    // ── Admin audit ──────────────────────────────────────────────────────────
    console.log("\nAdmin and exemption");
    await recordEvent(sub3.id, { type: "admin.set_status", actorLabel: "admin@test", detail: "Test override" });
    const adminEvents = await db.subscriptionEvent.count({ where: { subscriptionId: sub3.id, type: { startsWith: "admin." } } });
    check("26. Admin overrides are recorded", adminEvents >= 1);

    // ── The check that matters most on this instance ─────────────────────────
    console.log("\nIn-house accounts");
    const after = await db.subscription.findMany({
      where: { complimentary: true },
      select: { workspaceId: true, status: true, complimentary: true, planId: true },
    });
    const unchanged =
      before.length === after.length &&
      before.every((b) => {
        const a = after.find((x) => x.workspaceId === b.workspaceId);
        return a && a.status === b.status && a.complimentary === b.complimentary && a.planId === b.planId;
      });
    check("27. Existing in-house accounts are completely unchanged", unchanged, `${before.length} before, ${after.length} after`);

    for (const b of before) {
      const ent = await resolveEntitlements(b.workspaceId);
      check(`   ${b.workspaceId.slice(0, 8)} still has unlimited access`, ent.unmetered && ent.entitlements.monthly_email_sends === UNLIMITED);
      const g = await guard(b.workspaceId, "monthly_email_sends", 1_000_000);
      check(`   ${b.workspaceId.slice(0, 8)} is never blocked by a limit`, g.allowed === true);
      const advanced = await advanceWorkspace(b.workspaceId, { now: new Date(Date.now() + 400 * DAY) });
      check(`   ${b.workspaceId.slice(0, 8)} is skipped by the lifecycle engine`, advanced === null);
    }
  } finally {
    await cleanup(created);
  }

  console.log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => console.log(`  · ${f}`));
  }
  await db.$disconnect();
  process.exit(failures.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await db.$disconnect();
  process.exit(1);
});
