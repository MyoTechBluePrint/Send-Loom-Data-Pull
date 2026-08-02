// Server-side entitlement enforcement.
//
// The rule the brief cares about most: trial limits cannot be bypassed from the
// front end. So the check lives here, next to the action that costs money, and
// every UI affordance is only ever a mirror of it.
//
// Exempt accounts short-circuit to allowed before any counting happens, which
// is what makes this safe to call from the shared code paths the in-house
// workspaces use every day.

import { db } from "@/lib/server/db";
import {
  checkAllowance, recordUsage, resolveEntitlements,
  type EntitlementKey,
} from "@/lib/server/entitlements";
import { canSend, STATE_META, type SubscriptionStatus } from "@/lib/server/subscription-states";

export type GuardResult =
  | { allowed: true; limit: number | null; used: number; remaining: number | null }
  | { allowed: false; error: string; reason: "state" | "limit"; limit: number | null; used: number; upgradeTo: string | null };

/**
 * May this workspace perform `amount` more of a metered action?
 * Returns a customer-ready message when it may not.
 */
export async function guard(
  workspaceId: string,
  key: EntitlementKey,
  amount = 1
): Promise<GuardResult> {
  const resolved = await resolveEntitlements(workspaceId);

  // In-house, comped and enterprise accounts are never metered.
  if (resolved.unmetered) return { allowed: true, limit: null, used: 0, remaining: null };

  // A lapsed account keeps its data and loses the ability to spend money.
  if (!canSend(resolved.status) && isSpendingAction(key)) {
    const meta = STATE_META[resolved.status as SubscriptionStatus];
    return {
      allowed: false,
      reason: "state",
      error: meta?.customer ?? "This account cannot send at the moment.",
      limit: null,
      used: 0,
      upgradeTo: null,
    };
  }

  const allowance = await checkAllowance(workspaceId, key, amount);
  if (allowance.allowed) {
    return { allowed: true, limit: allowance.limit, used: allowance.used, remaining: allowance.remaining };
  }

  const upgradeTo = await nextPlanCovering(key, allowance.used + amount);
  return {
    allowed: false,
    reason: "limit",
    error: allowance.reason ?? "This action exceeds your plan's allowance.",
    limit: allowance.limit,
    used: allowance.used,
    upgradeTo,
  };
}

/** Actions that cost real money and so stop when billing is unresolved. */
function isSpendingAction(key: EntitlementKey): boolean {
  return key === "monthly_email_sends" || key === "ai_credits";
}

/** The cheapest visible plan whose allowance covers `needed`. */
async function nextPlanCovering(key: EntitlementKey, needed: number): Promise<string | null> {
  const plans = await db.plan.findMany({ where: { visible: true }, orderBy: { sortOrder: "asc" } });
  for (const p of plans) {
    try {
      const ent = JSON.parse(p.entitlements) as Record<string, number | boolean>;
      const v = ent[key];
      if (v === -1) return p.name;
      if (typeof v === "number" && v >= needed) return p.name;
      if (v === true) return p.name;
    } catch {
      continue;
    }
  }
  return null;
}

/** Guard, then record the usage. Use when the action definitely happened. */
export async function consume(workspaceId: string, key: EntitlementKey, amount = 1): Promise<GuardResult> {
  const result = await guard(workspaceId, key, amount);
  if (result.allowed) await recordUsage(workspaceId, key, amount);
  return result;
}

/** Boolean capability gate, for features rather than volumes. */
export async function guardFeature(workspaceId: string, key: EntitlementKey): Promise<GuardResult> {
  const resolved = await resolveEntitlements(workspaceId);
  if (resolved.unmetered) return { allowed: true, limit: null, used: 0, remaining: null };

  const v = resolved.entitlements[key];
  const on = typeof v === "boolean" ? v : v !== undefined && (v === -1 || v > 0);
  if (on) return { allowed: true, limit: null, used: 0, remaining: null };

  const upgradeTo = await nextPlanCovering(key, 1);
  return {
    allowed: false,
    reason: "limit",
    error: `${key.replace(/_/g, " ")} is not included on your current plan.`,
    limit: null,
    used: 0,
    upgradeTo,
  };
}
