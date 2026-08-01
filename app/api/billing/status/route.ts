// Everything the UI needs to describe an account's billing position in one
// call: state, exact dates, exact amounts, usage against limits, and the plan
// we would recommend based on what they are actually doing.
import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/permissions";
import { resolveEntitlements, currentPeriod, UNLIMITED, type EntitlementKey } from "@/lib/server/entitlements";
import { STATE_META, formatBillingMoment, formatMoney, type SubscriptionStatus } from "@/lib/server/subscription-states";
import { recommendPlan, trialProgress } from "@/lib/server/trial";
import { providerMode } from "@/lib/server/billing/provider";

const METERED: EntitlementKey[] = [
  "monthly_contacts", "monthly_email_sends", "connected_domains",
  "team_members", "active_automations", "ai_credits",
];

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const workspaceId = user.workspaceId;
  const [resolved, sub, progress] = await Promise.all([
    resolveEntitlements(workspaceId),
    db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } }),
    trialProgress(workspaceId),
  ]);

  // Complimentary and enterprise accounts get a deliberately flat answer: no
  // countdown, no prompts, nothing to act on. This is what keeps the in-house
  // workspaces looking exactly as they did before billing existed.
  if (resolved.unmetered) {
    return Response.json({
      ok: true,
      exempt: true,
      status: resolved.status,
      planName: resolved.planName,
      message: STATE_META[resolved.status as SubscriptionStatus]?.customer ?? "This account has complimentary access.",
    });
  }

  const meta = STATE_META[resolved.status as SubscriptionStatus];
  const { start, end } = currentPeriod();
  const counters = await db.usageCounter.findMany({
    where: { workspaceId, periodStart: start, periodEnd: end },
  });

  // Live counts beat stored counters for things the product already knows.
  const [contacts, domains, automations, team] = await Promise.all([
    db.contact.count({ where: { workspaceId } }),
    db.store.count({ where: { workspaceId } }),
    db.automation.count({ where: { workspaceId, status: "live" } }),
    db.user.count({ where: { workspaceId, disabled: false } }),
  ]);
  const live: Partial<Record<EntitlementKey, number>> = {
    monthly_contacts: contacts,
    connected_domains: domains,
    active_automations: automations,
    team_members: team,
  };

  const usage = METERED.map((key) => {
    const limitValue = resolved.entitlements[key];
    const limit = typeof limitValue === "number" && limitValue !== UNLIMITED ? limitValue : null;
    const used = live[key] ?? counters.find((c) => c.key === key)?.used ?? 0;
    return {
      key,
      label: key.replace(/_/g, " ").replace(/^monthly /, ""),
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      percent: limit === null || limit === 0 ? 0 : Math.min(100, Math.round((used / limit) * 100)),
    };
  });

  const recommendation = await recommendPlan(workspaceId);

  // Revenue SendLoom can point at during the trial. This is what makes a
  // conversion prompt an observation rather than a nag.
  const [campaignRevenue, automationRevenue] = await Promise.all([
    db.campaign.aggregate({ where: { workspaceId }, _sum: { revenue: true } }),
    db.automation.aggregate({ where: { workspaceId }, _sum: { revenue: true } }),
  ]);
  const attributedRevenue = (campaignRevenue._sum.revenue ?? 0) + (automationRevenue._sum.revenue ?? 0);

  const amount = sub?.firstChargePence ?? sub?.plan?.monthlyPence ?? null;
  const billAt = sub?.firstBillingAt ?? sub?.trialEndsAt ?? null;

  return Response.json({
    ok: true,
    exempt: false,
    status: resolved.status,
    label: meta?.label ?? resolved.status,
    message: meta?.customer ?? "",
    tone: meta?.tone ?? "neutral",
    canSend: meta?.canSend ?? true,
    needsAction: meta?.needsAction ?? false,
    planKey: resolved.planKey,
    planName: resolved.planName,
    billingCycle: sub?.billingCycle ?? "monthly",
    trial: progress,
    paymentMethod: sub?.paymentMethodVerifiedAt
      ? { verified: true, brand: sub.paymentMethodBrand, last4: sub.paymentMethodLast4 }
      : { verified: false, brand: null, last4: null },
    firstBillingAt: billAt?.toISOString() ?? null,
    firstBillingLabel: billAt ? formatBillingMoment(billAt) : null,
    amountPence: amount,
    amountLabel: amount !== null ? formatMoney(amount) : null,
    creditPence: sub?.creditPence ?? 0,
    cancelScheduledAt: sub?.cancelScheduledAt?.toISOString() ?? null,
    accessRestrictedAt: sub?.accessRestrictedAt?.toISOString() ?? null,
    accessRestrictedLabel: sub?.accessRestrictedAt ? formatBillingMoment(sub.accessRestrictedAt) : null,
    usage,
    recommendation,
    attributedRevenue,
    attributedRevenueLabel: attributedRevenue > 0 ? formatMoney(Math.round(attributedRevenue * 100)) : null,
    providerMode: providerMode(),
  });
}
