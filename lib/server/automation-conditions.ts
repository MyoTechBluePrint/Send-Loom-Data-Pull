// The condition vocabulary for sequence workflows: a registry of evaluators,
// not a stack of ifs, so "opened the email", "used the code" and "order value
// over X" can each arrive later as one entry here without the engine changing.
//
// Every evaluator answers the same question at the same moment: does this
// contact, right now, still belong in this run? Conditions are checked at
// execution time, when the walker reaches the node, and re-checked just
// before a follow-up email leaves, because live data is the only data a
// decision about a real person may use.

import { db } from "./db";

/** One check as the editor saves it: a type plus that type's own params. */
export type ConditionCheck = { type: string; [k: string]: unknown };

/** What a condition node carries in its config JSON. */
export interface ConditionNodeConfig {
  /** "all" (default) needs every check to pass; "any" needs one. */
  match?: "all" | "any";
  conditions?: ConditionCheck[];
}

/** What one evaluator hands back. The reason is the debugging vocabulary
 *  that becomes the run's stoppedReason when the check fails. */
export type ConditionOutcome = { pass: boolean; reason?: string };

/** The facts every evaluator receives about the run it is judging. */
export interface ConditionContext {
  workspaceId: string;
  contactId: string;
  run: { id: string; automationId: string; startedAt: Date };
}

type ConditionEvaluator = (
  ctx: ConditionContext,
  check: ConditionCheck,
) => Promise<ConditionOutcome>;

/** The ordered menu the editor shows. Adding a condition type means one
 *  entry here and one evaluator below; the engine never changes. */
export const CONDITION_TYPES: { type: string; label: string; description: string }[] = [
  {
    type: "not_purchased_since_entry",
    label: "Has not purchased since entering",
    description:
      "Passes while the contact has placed no order and completed no purchase since this run began. A purchase fails the check and ends the sequence.",
  },
  {
    type: "not_entered_other_workflow",
    label: "Has not entered another workflow",
    description:
      "Passes while the contact has started no other workflow since this run began, so two sequences never talk over the same inbox.",
  },
  {
    type: "discount_not_used",
    label: "Discount code has not been used",
    description:
      "Passes while the discount code issued in this workflow has not been redeemed on an order. Once the code is spent, reminding anybody to use it fails the check.",
  },
  {
    type: "discount_still_active",
    label: "Discount code is still active",
    description:
      "Passes while the code issued in this workflow has not expired. A reminder about a dead code is worse than silence, so expiry fails the check.",
  },
];

/**
 * The codes this run is about: issued to this contact either since the run
 * began, or by one of this workflow's own emails (the idempotent per-contact
 * code means a re-entered contact keeps a code whose createdAt predates the
 * new run, and it is still this workflow's code). Promotion-scoped to the
 * workspace, because a contactId alone is not proof of tenancy here.
 */
async function couponsForRun(ctx: ConditionContext) {
  const shadows = await db.campaign.findMany({
    where: { audienceType: "automation", audienceRef: ctx.run.automationId },
    select: { id: true },
  });
  return db.couponCode.findMany({
    where: {
      contactId: ctx.contactId,
      promotion: { workspaceId: ctx.workspaceId },
      OR: [
        { createdAt: { gte: ctx.run.startedAt } },
        ...(shadows.length
          ? [{ source: { in: shadows.map((s) => `campaign:${s.id}`) } }]
          : []),
      ],
    },
    select: { id: true, redeemedAt: true, expiresAt: true },
  });
}

const REGISTRY: Record<string, ConditionEvaluator> = {
  // A purchase can surface two ways: an Order row synced from the store, or
  // a purchase_completed event from the tracker. Either one counts; the
  // condition must not depend on which pipe was faster.
  not_purchased_since_entry: async (ctx) => {
    const order = await db.order.findFirst({
      where: {
        contactId: ctx.contactId,
        placedAt: { gt: ctx.run.startedAt },
        store: { workspaceId: ctx.workspaceId },
      },
      select: { id: true },
    });
    if (order) return { pass: false, reason: "purchased" };
    const purchase = await db.event.findFirst({
      where: {
        workspaceId: ctx.workspaceId,
        contactId: ctx.contactId,
        type: "purchase_completed",
        occurredAt: { gt: ctx.run.startedAt },
        // Customer truth only: test and internal streams never count as a
        // real person buying something.
        stream: { in: ["storefront", "server"] },
      },
      select: { id: true },
    });
    if (purchase) return { pass: false, reason: "purchased" };
    return { pass: true };
  },

  // Contacts are workspace-scoped rows, so matching on contactId alone
  // already keeps this inside the workspace.
  not_entered_other_workflow: async (ctx) => {
    const other = await db.automationRun.findFirst({
      where: {
        contactId: ctx.contactId,
        automationId: { not: ctx.run.automationId },
        startedAt: { gt: ctx.run.startedAt },
      },
      select: { id: true },
    });
    if (other) return { pass: false, reason: "entered_other_workflow" };
    return { pass: true };
  },

  // No code issued passes both discount checks: a workflow whose first email
  // carries no coupon block has nothing to have used or expired, and the
  // conditions must not strand it.
  discount_not_used: async (ctx) => {
    const coupons = await couponsForRun(ctx);
    if (coupons.some((c) => c.redeemedAt !== null)) {
      return { pass: false, reason: "discount_used" };
    }
    return { pass: true };
  },

  discount_still_active: async (ctx) => {
    const coupons = await couponsForRun(ctx);
    // Only codes that carry an expiry can expire; a code with none is
    // active by definition. Every issued code being past its expiry is
    // what makes the reminder pointless.
    const dated = coupons.filter((c) => c.expiresAt !== null);
    if (dated.length && dated.every((c) => (c.expiresAt as Date).getTime() <= Date.now())) {
      return { pass: false, reason: "discount_expired" };
    }
    return { pass: true };
  },
};

/** The engine's one question about a whole condition node. */
export interface ConditionsVerdict {
  pass: boolean;
  /** The failing evaluator's reason, for stoppedReason. Unset on pass. */
  reason?: string;
  /** One line per check, for the run diary: which passed, which failed, why. */
  detail: string;
  /** Types this server does not recognise. Each passed permissively; the
   *  caller notes them in the diary so the mystery is visible, not silent. */
  unknownTypes: string[];
}

/**
 * Evaluate a condition node's config against live data.
 *
 * An empty conditions list passes: a node somebody added but never filled in
 * must not stop real contacts. An unknown type also passes: an old server
 * running a workflow saved by a newer editor must never strand its runs on
 * vocabulary it has not learnt yet.
 */
export async function evaluateConditionNode(
  ctx: ConditionContext,
  config: ConditionNodeConfig,
): Promise<ConditionsVerdict> {
  const checks = Array.isArray(config.conditions) ? config.conditions : [];
  const match = config.match === "any" ? "any" : "all";
  const lines: string[] = [];
  const unknownTypes: string[] = [];
  const failures: { type: string; reason: string }[] = [];
  let passes = 0;

  for (const check of checks) {
    const type = typeof check?.type === "string" && check.type ? check.type : "(missing type)";
    const evaluate = REGISTRY[type];
    if (!evaluate) {
      unknownTypes.push(type);
      passes += 1;
      lines.push(`${type}: unknown type, passed`);
      continue;
    }
    const outcome = await evaluate(ctx, check);
    if (outcome.pass) {
      passes += 1;
      lines.push(`${type}: pass`);
    } else {
      const reason = outcome.reason ?? "condition_failed";
      failures.push({ type, reason });
      lines.push(`${type}: fail (${reason})`);
    }
  }

  const pass =
    checks.length === 0 || (match === "any" ? passes > 0 : failures.length === 0);
  return {
    pass,
    reason: pass ? undefined : failures[0]?.reason ?? "condition_failed",
    detail: checks.length ? `match ${match}: ${lines.join("; ")}` : "no conditions, passed",
    unknownTypes,
  };
}
