// Entitlements: the single place that decides what a workspace may do.
//
// Nothing else in the product should ask "what plan is this?". It should ask
// "is this workspace entitled to X?", so plan limits can move without hunting
// down scattered checks.
//
// SAFETY RULE, and the reason the default is generous: a workspace with NO
// subscription row is treated as complimentary, not as expired. Everyone using
// SendLoom today is in-house and predates billing, so the paywall must never
// be able to lock them out through an oversight. Access is only ever reduced
// by an explicit subscription record saying so.

import { db } from "@/lib/server/db";

/** Named entitlements. -1 means unlimited. */
export type EntitlementKey =
  | "connected_domains"
  | "monthly_contacts"
  | "monthly_email_sends"
  | "team_members"
  | "active_automations"
  | "ai_credits"
  | "revenue_attribution"
  | "advanced_segmentation"
  | "premium_integrations"
  | "data_retention_days"
  | "priority_support";

export type EntitlementMap = Partial<Record<EntitlementKey, number | boolean>>;

export const UNLIMITED = -1;

/** Everything on, no ceilings. Used for in-house, enterprise and complimentary. */
export const UNLIMITED_ENTITLEMENTS: EntitlementMap = {
  connected_domains: UNLIMITED,
  monthly_contacts: UNLIMITED,
  monthly_email_sends: UNLIMITED,
  team_members: UNLIMITED,
  active_automations: UNLIMITED,
  ai_credits: UNLIMITED,
  data_retention_days: UNLIMITED,
  revenue_attribution: true,
  advanced_segmentation: true,
  premium_integrations: true,
  priority_support: true,
};

/**
 * What the trial can reach. Deliberately generous on capability and modest on
 * volume: the spec wants the trial to prove real value, not to unlock an
 * unlimited sending account for seven days. Premium capabilities are ON so the
 * user sees them working with their own data; the cost-bearing meters are
 * capped.
 */
export const TRIAL_ENTITLEMENTS: EntitlementMap = {
  connected_domains: 2,
  monthly_contacts: 2000,
  monthly_email_sends: 500,
  team_members: 3,
  active_automations: 3,
  ai_credits: 50,
  data_retention_days: 30,
  revenue_attribution: true,
  advanced_segmentation: true,
  premium_integrations: true,
  priority_support: false,
};

/** Access when a subscription has lapsed: read and export, no sending. */
export const RESTRICTED_ENTITLEMENTS: EntitlementMap = {
  connected_domains: 0,
  monthly_contacts: UNLIMITED, // their data stays visible; nothing is deleted
  monthly_email_sends: 0,
  team_members: 1,
  active_automations: 0,
  ai_credits: 0,
  data_retention_days: 90,
  revenue_attribution: false,
  advanced_segmentation: false,
  premium_integrations: false,
  priority_support: false,
};

function parse(json: string | null | undefined): EntitlementMap {
  if (!json) return {};
  try {
    const v = JSON.parse(json);
    return v && typeof v === "object" ? (v as EntitlementMap) : {};
  } catch {
    return {};
  }
}

export type Resolved = {
  entitlements: EntitlementMap;
  status: string;
  planKey: string | null;
  planName: string | null;
  complimentary: boolean;
  /** True when billing has no say over this account (in-house, enterprise). */
  unmetered: boolean;
};

/**
 * Resolve the effective entitlements for a workspace.
 * Order: plan defaults -> trial/restricted shaping by status -> per-account
 * overrides. Overrides win, which is how support grants an exception without
 * inventing a plan.
 */
export async function resolveEntitlements(workspaceId: string): Promise<Resolved> {
  const sub = await db.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true },
  });

  // No record: pre-billing workspace. Full access, explicitly.
  if (!sub) {
    return {
      entitlements: { ...UNLIMITED_ENTITLEMENTS },
      status: "complimentary",
      planKey: null,
      planName: "Complimentary",
      complimentary: true,
      unmetered: true,
    };
  }

  if (sub.complimentary || sub.status === "complimentary" || sub.status === "enterprise") {
    return {
      entitlements: { ...UNLIMITED_ENTITLEMENTS, ...parse(sub.entitlementOverrides) },
      status: sub.status,
      planKey: sub.plan?.key ?? null,
      planName: sub.plan?.name ?? "Complimentary",
      complimentary: true,
      unmetered: true,
    };
  }

  let base: EntitlementMap;
  switch (sub.status) {
    case "trialing_no_pm":
    case "trial_action_required":
    case "trialing_pm_verified":
    case "trial_ending":
      base = { ...TRIAL_ENTITLEMENTS };
      break;
    case "restricted":
    case "expired":
    case "cancelled":
    case "paused":
      base = { ...RESTRICTED_ENTITLEMENTS };
      break;
    // Past due and recovery keep working: the spec is explicit that access is
    // reduced gradually, not the moment a card bounces.
    case "payment_failed":
    case "payment_recovery":
    case "past_due":
    case "payment_processing":
    case "active":
    case "scheduled_cancel":
    default:
      base = parse(sub.plan?.entitlements) as EntitlementMap;
      break;
  }

  return {
    entitlements: { ...base, ...parse(sub.entitlementOverrides) },
    status: sub.status,
    planKey: sub.plan?.key ?? null,
    planName: sub.plan?.name ?? null,
    complimentary: false,
    unmetered: false,
  };
}

/** Boolean capability check. */
export async function hasEntitlement(workspaceId: string, key: EntitlementKey): Promise<boolean> {
  const { entitlements } = await resolveEntitlements(workspaceId);
  const v = entitlements[key];
  if (v === undefined) return false;
  if (typeof v === "boolean") return v;
  return v === UNLIMITED || v > 0;
}

/** Numeric limit, or null when the entitlement is unlimited/not metered. */
export async function limitFor(workspaceId: string, key: EntitlementKey): Promise<number | null> {
  const { entitlements } = await resolveEntitlements(workspaceId);
  const v = entitlements[key];
  if (typeof v !== "number") return null;
  return v === UNLIMITED ? null : v;
}

export type Allowance = {
  allowed: boolean;
  limit: number | null; // null = unlimited
  used: number;
  remaining: number | null;
  /** Set when blocked, ready to show in an upgrade prompt. */
  reason?: string;
};

/**
 * Check a metered entitlement against recorded usage for the current period.
 * `additional` lets a caller ask "may I send 200 more?" before doing the work.
 */
export async function checkAllowance(
  workspaceId: string,
  key: EntitlementKey,
  additional = 0
): Promise<Allowance> {
  const limit = await limitFor(workspaceId, key);
  if (limit === null) return { allowed: true, limit: null, used: 0, remaining: null };

  const { start, end } = currentPeriod();
  const row = await db.usageCounter.findFirst({
    where: { workspaceId, key, periodStart: start, periodEnd: end },
  });
  const used = row?.used ?? 0;
  const allowed = used + additional <= limit;
  return {
    allowed,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    reason: allowed ? undefined : `This plan includes ${limit.toLocaleString()} ${key.replace(/_/g, " ")} per month. You have used ${used.toLocaleString()}.`,
  };
}

/** Record usage against a metered entitlement. Safe to call concurrently. */
export async function recordUsage(workspaceId: string, key: EntitlementKey, amount = 1) {
  const { start, end } = currentPeriod();
  await db.usageCounter.upsert({
    where: { workspaceId_key_periodStart: { workspaceId, key, periodStart: start } },
    create: { workspaceId, key, periodStart: start, periodEnd: end, used: amount },
    update: { used: { increment: amount } },
  });
}

/** Calendar-month period. Simple, predictable, and matches how limits read. */
export function currentPeriod(now = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}
