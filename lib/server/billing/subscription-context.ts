// The public entitlement and subscription API.
//
// This is the surface the rest of SendLoom should use. It does not implement a
// second entitlement system: it is a named, stable facade over the engine in
// lib/server/entitlements.ts and the enforcement in guard.ts, so callers never
// have to know which of those to reach for.
//
// One rule holds throughout: an account's effective state is DERIVED here, in
// one place, from persisted facts. Nothing else in the product should try to
// work out "is this a trial, and how far through is it" for itself, and no page
// view should mutate a subscription as a side effect.

import { db } from "@/lib/server/db";
import {
  resolveEntitlements, usedFor, UNLIMITED,
  type EntitlementKey, type EntitlementMap,
} from "@/lib/server/entitlements";
import { guard, guardFeature, type GuardResult } from "./guard";
import {
  STATE_META, canSend, needsBillingAction,
  type SubscriptionStatus,
} from "@/lib/server/subscription-states";

export type AccountType = "external" | "grandfathered" | "internal";

/** Everything about an account's commercial position, derived in one place. */
export type SubscriptionContext = {
  workspaceId: string;
  /** True when billing has no say over this account at all. */
  complimentary: boolean;
  accountType: AccountType;
  status: SubscriptionStatus | string;
  statusLabel: string;
  customerMessage: string;
  tone: string;
  canSend: boolean;
  needsAction: boolean;

  planKey: string | null;
  planName: string | null;
  billingCycle: "monthly" | "annual";

  /** Null for accounts that are not on a trial. */
  trial: {
    stage: "no_payment_method" | "action_required" | "payment_method_verified" | "final_day" | "ended";
    dayOf: number;
    totalDays: number;
    daysLeft: number;
    hoursLeft: number;
    stageOneEndsAt: Date | null;
    endsAt: Date | null;
  } | null;

  paymentMethod: { verified: boolean; brand: string | null; last4: string | null };
  firstBillingAt: Date | null;
  amountPence: number | null;
  cancelScheduledAt: Date | null;
  accessRestrictedAt: Date | null;

  entitlements: EntitlementMap;
};

const TRIAL_TOTAL_DAYS = 7;

/**
 * Derive an account's effective lifecycle state.
 *
 * Read-only by design. The persisted status is advanced by the lifecycle job,
 * never by this function, so loading a page can never move a customer's trial
 * along or trigger a charge.
 */
export async function getWorkspaceSubscriptionContext(workspaceId: string, now = new Date()): Promise<SubscriptionContext> {
  const [resolved, sub] = await Promise.all([
    resolveEntitlements(workspaceId),
    db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } }),
  ]);

  const meta = STATE_META[resolved.status as SubscriptionStatus];
  const complimentary = resolved.unmetered;

  // A workspace with no subscription row predates billing entirely. Treated as
  // grandfathered, not as expired: the safe direction is always more access.
  const accountType = (sub?.accountType as AccountType) ?? "grandfathered";

  let trial: SubscriptionContext["trial"] = null;
  if (!complimentary && sub?.trialStartedAt && sub.trialEndsAt) {
    const started = sub.trialStartedAt.getTime();
    const ends = sub.trialEndsAt.getTime();
    const t = now.getTime();
    const msLeft = Math.max(0, ends - t);

    const stage: NonNullable<SubscriptionContext["trial"]>["stage"] =
      sub.status === "trial_action_required" ? "action_required"
      : sub.status === "trial_ending" ? "final_day"
      : sub.status === "trialing_pm_verified" ? "payment_method_verified"
      : sub.status === "trialing_no_pm" ? "no_payment_method"
      : "ended";

    trial = {
      stage,
      dayOf: Math.min(TRIAL_TOTAL_DAYS, Math.floor((t - started) / 86_400_000) + 1),
      totalDays: TRIAL_TOTAL_DAYS,
      daysLeft: Math.ceil(msLeft / 86_400_000),
      hoursLeft: Math.ceil(msLeft / 3_600_000),
      stageOneEndsAt: sub.trialStageOneEndsAt,
      endsAt: sub.trialEndsAt,
    };
  }

  return {
    workspaceId,
    complimentary,
    accountType,
    status: resolved.status,
    statusLabel: meta?.label ?? resolved.status,
    customerMessage: meta?.customer ?? "",
    tone: meta?.tone ?? "neutral",
    canSend: canSend(resolved.status),
    needsAction: !complimentary && needsBillingAction(resolved.status),
    planKey: resolved.planKey,
    planName: resolved.planName,
    billingCycle: (sub?.billingCycle as "monthly" | "annual") ?? "monthly",
    trial,
    paymentMethod: {
      verified: Boolean(sub?.paymentMethodVerifiedAt),
      brand: sub?.paymentMethodBrand ?? null,
      last4: sub?.paymentMethodLast4 ?? null,
    },
    firstBillingAt: sub?.firstBillingAt ?? sub?.trialEndsAt ?? null,
    amountPence: sub?.firstChargePence ?? sub?.plan?.monthlyPence ?? null,
    cancelScheduledAt: sub?.cancelScheduledAt ?? null,
    accessRestrictedAt: sub?.accessRestrictedAt ?? null,
    entitlements: resolved.entitlements,
  };
}

/** The effective entitlement map for a workspace. */
export async function getWorkspaceEntitlements(workspaceId: string): Promise<EntitlementMap> {
  const { entitlements } = await resolveEntitlements(workspaceId);
  return entitlements;
}

/** Is this account exempt from billing entirely? */
export async function isComplimentaryWorkspace(workspaceId: string): Promise<boolean> {
  const { unmetered } = await resolveEntitlements(workspaceId);
  return unmetered;
}

/** Capability check for a named feature. */
export async function canUseFeature(workspaceId: string, key: EntitlementKey): Promise<boolean> {
  return (await guardFeature(workspaceId, key)).allowed;
}

/** The numeric ceiling for a metered entitlement. Null means unlimited. */
export async function getUsageLimit(workspaceId: string, key: EntitlementKey): Promise<number | null> {
  const { entitlements } = await resolveEntitlements(workspaceId);
  const v = entitlements[key];
  if (typeof v !== "number") return null;
  return v === UNLIMITED ? null : v;
}

/** How much of an allowance is left. Null means unlimited. */
export async function getRemainingUsage(workspaceId: string, key: EntitlementKey): Promise<number | null> {
  const limit = await getUsageLimit(workspaceId, key);
  if (limit === null) return null;
  const used = await usedFor(workspaceId, key);
  return Math.max(0, limit - used);
}

export class EntitlementError extends Error {
  constructor(
    message: string,
    readonly key: EntitlementKey,
    readonly reason: "state" | "limit",
    readonly upgradeTo: string | null
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

/**
 * Throwing guard, for call sites where continuing would be a bug.
 * Prefer `guard()` where a refusal is an expected, reportable outcome.
 */
export async function assertEntitlement(workspaceId: string, key: EntitlementKey, amount = 1): Promise<void> {
  const result = await guard(workspaceId, key, amount);
  if (!result.allowed) {
    throw new EntitlementError(result.error, key, result.reason, result.upgradeTo);
  }
}

export type { GuardResult, EntitlementKey, EntitlementMap };
export { guard, guardFeature };
