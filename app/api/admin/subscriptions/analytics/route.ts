// Commercial analytics: the trial funnel and what it is worth.
//
// Every number is derived from the event log and the subscription table, so
// nothing here can drift from what actually happened to an account.
import { db } from "@/lib/server/db";
import { can, currentUser } from "@/lib/server/permissions";
import { formatMoney } from "@/lib/server/subscription-states";

const rate = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export async function GET() {
  const user = await currentUser();
  if (!user || !can(user.role, "view_admin")) {
    return Response.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const [subs, events, invoices, plans] = await Promise.all([
    db.subscription.findMany({ include: { plan: true, workspace: { select: { id: true, name: true } } } }),
    db.subscriptionEvent.findMany({ select: { type: true, subscriptionId: true, detail: true, createdAt: true } }),
    db.invoice.findMany(),
    db.plan.findMany(),
  ]);

  // Commercial accounts only: complimentary and enterprise are not part of the
  // funnel and would flatter every rate if counted.
  const commercial = subs.filter((s) => !s.complimentary && s.status !== "enterprise");

  const byType = (t: string) => new Set(events.filter((e) => e.type === t).map((e) => e.subscriptionId));
  const trialStarted = byType("trial.started");
  const planViewed = byType("checkout.started");
  const pmVerified = byType("pm.verified");
  const charged = byType("charge.succeeded");
  const failed = byType("charge.failed");
  const cancelled = new Set(events.filter((e) => e.type.startsWith("cancellation.scheduled")).map((e) => e.subscriptionId));

  // Workspace milestones, so the funnel spans product use and not just billing.
  const workspaceIds = commercial.map((s) => s.workspaceId);
  const [withSite, withCampaign, withSend] = await Promise.all([
    db.store.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: workspaceIds } } }),
    db.campaign.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: workspaceIds } } }),
    db.campaign.groupBy({ by: ["workspaceId"], where: { workspaceId: { in: workspaceIds }, status: "sent" } }),
  ]);

  const accountsCreated = commercial.length;
  const funnel = [
    { stage: "Account created", count: accountsCreated },
    { stage: "Trial started", count: commercial.filter((s) => trialStarted.has(s.id)).length },
    { stage: "Website connected", count: withSite.length },
    { stage: "First campaign created", count: withCampaign.length },
    { stage: "First send", count: withSend.length },
    { stage: "Plan viewed", count: commercial.filter((s) => planViewed.has(s.id)).length },
    { stage: "Plan selected", count: commercial.filter((s) => s.planId !== null).length },
    { stage: "Payment method verified", count: commercial.filter((s) => pmVerified.has(s.id)).length },
    { stage: "First payment successful", count: commercial.filter((s) => charged.has(s.id)).length },
    { stage: "Active subscriber", count: commercial.filter((s) => s.status === "active").length },
  ].map((row) => ({ ...row, percentOfStart: rate(row.count, accountsCreated) }));

  // Recurring revenue from accounts that are actually paying.
  const active = commercial.filter((s) => s.status === "active" || s.status === "scheduled_cancel");
  const mrrPence = active.reduce((sum, s) => {
    const p = s.plan;
    if (!p) return sum;
    const monthly = s.billingCycle === "annual" ? (p.annualPence !== null ? Math.round(p.annualPence / 12) : 0) : p.monthlyPence ?? 0;
    return sum + monthly;
  }, 0);

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const collectedPence = paidInvoices.reduce((s, i) => s + i.amountPence, 0);

  const byPlan = plans
    .filter((p) => p.visible)
    .map((p) => {
      const on = commercial.filter((s) => s.planId === p.id);
      return {
        key: p.key,
        name: p.name,
        selected: on.length,
        converted: on.filter((s) => charged.has(s.id)).length,
        mrrPence: on
          .filter((s) => s.status === "active")
          .reduce((sum, s) => sum + (s.billingCycle === "annual" ? Math.round((p.annualPence ?? 0) / 12) : p.monthlyPence ?? 0), 0),
      };
    });

  const cancellationReasons = commercial
    .filter((s) => s.cancelReason)
    .map((s) => ({ workspace: s.workspace.name, reason: s.cancelReason as string, status: s.status }));

  const trialsStarted = commercial.filter((s) => trialStarted.has(s.id)).length;
  const verifiedCount = commercial.filter((s) => pmVerified.has(s.id)).length;
  const chargedCount = commercial.filter((s) => charged.has(s.id)).length;
  const failedCount = commercial.filter((s) => failed.has(s.id)).length;
  const recoveredCount = commercial.filter((s) => failed.has(s.id) && s.status === "active").length;

  return Response.json({
    ok: true,
    headline: {
      commercialAccounts: accountsCreated,
      exemptAccounts: subs.length - accountsCreated,
      trialsStarted,
      dayThreeVerificationRate: rate(verifiedCount, trialsStarted),
      daySevenConversionRate: rate(chargedCount, verifiedCount),
      overallConversionRate: rate(chargedCount, trialsStarted),
      mrrPence,
      mrrLabel: formatMoney(mrrPence),
      arrLabel: formatMoney(mrrPence * 12),
      arpaLabel: active.length ? formatMoney(Math.round(mrrPence / active.length)) : formatMoney(0),
      collectedLabel: formatMoney(collectedPence),
      paymentFailures: failedCount,
      paymentRecoveryRate: rate(recoveredCount, failedCount),
      trialCancellations: commercial.filter((s) => cancelled.has(s.id)).length,
    },
    funnel,
    byPlan,
    cancellationReasons,
  });
}
