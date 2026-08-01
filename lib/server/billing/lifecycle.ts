// The trial and billing lifecycle engine.
//
// One function advances one account. It is pure state-machine work driven by
// wall-clock time, so it can be run from a cron, from an admin button, or from
// a test with an injected clock, and always produces the same result.
//
// Two rules that hold everywhere in this file:
//   1. Exempt accounts (complimentary, enterprise) are skipped entirely. The
//      in-house workspaces can never be advanced into a paywall state.
//   2. Nothing is ever deleted. Lapsing an account changes what it may DO,
//      never what it HAS.

import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { isExempt } from "@/lib/server/subscription-states";
import { providerMode, recordEvent } from "./provider";
import { contextFor, notifyOnce, type NotificationKey } from "./notifications";

const HOUR = 3_600_000;
const DAY = 86_400_000;

/** Days of grace after a failed payment before sending is paused. */
export const RECOVERY_GRACE_DAYS = 7;
/** Days customer data is retained after an account lapses. */
export const DATA_RETENTION_DAYS = 90;

export type LifecycleAction = {
  workspaceId: string;
  from: string;
  to: string | null;
  did: string;
  notified: NotificationKey[];
};

/**
 * Advance a single workspace. Returns null when there was nothing to do, which
 * is the common case and keeps the cron output readable.
 */
export async function advanceWorkspace(
  workspaceId: string,
  opts: { now?: Date; origin?: string } = {}
): Promise<LifecycleAction | null> {
  const now = opts.now ?? new Date();
  const origin = opts.origin ?? process.env.APP_ORIGIN ?? "http://localhost:3009";

  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
  if (!sub) return null;
  if (sub.complimentary || isExempt(sub.status)) return null;

  const ctxBundle = await contextFor(workspaceId, origin);
  const notified: NotificationKey[] = [];
  const notify = async (key: NotificationKey) => {
    if (!ctxBundle) return;
    const r = await notifyOnce(ctxBundle.subscriptionId, key, ctxBundle.ctx, ctxBundle.email);
    if (r.sent) notified.push(key);
  };

  const t = now.getTime();
  const stageOne = sub.trialStageOneEndsAt?.getTime() ?? null;
  const trialEnd = sub.trialEndsAt?.getTime() ?? null;
  const billAt = sub.firstBillingAt?.getTime() ?? trialEnd;

  const done = (to: string | null, did: string): LifecycleAction => ({ workspaceId, from: sub.status, to, did, notified });

  switch (sub.status) {
    // ── Days 1 to 3: no payment method required ──────────────────────────────
    case "trialing_no_pm": {
      if (stageOne !== null && t >= stageOne) {
        await transition(sub.id, workspaceId, sub.status, "trial_action_required", "Day 3 reached: plan selection required to continue the trial.");
        await notify("trial.day3_reached");
        return done("trial_action_required", "day 3 reached");
      }
      if (stageOne !== null && t >= stageOne - 24 * HOUR) {
        await notify("trial.day3_warning_24h");
        if (notified.length) return done(null, "24h warning before day 3");
      }
      return null;
    }

    // ── Day 3 passed with no plan chosen ─────────────────────────────────────
    case "trial_action_required": {
      if (trialEnd !== null && t >= trialEnd) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "expired", accessRestrictedAt: new Date(t + DATA_RETENTION_DAYS * DAY) },
        });
        await transition(sub.id, workspaceId, sub.status, "expired", `Trial ended without a subscription. Data retained for ${DATA_RETENTION_DAYS} days.`);
        return done("expired", "trial expired unconverted");
      }
      return null;
    }

    // ── Days 4 to 7: plan chosen, card verified ──────────────────────────────
    case "trialing_pm_verified": {
      if (billAt === null) return null;
      if (t >= billAt) return await beginFirstCharge(sub.id, workspaceId, sub.status, notify, notified, workspaceId);
      if (t >= billAt - 24 * HOUR) {
        await transition(sub.id, workspaceId, sub.status, "trial_ending", "Final 24 hours before the first payment.");
        await notify("billing.charge_24h");
        return done("trial_ending", "24h before first charge");
      }
      if (t >= billAt - 48 * HOUR) {
        await notify("billing.charge_48h");
        if (notified.length) return done(null, "48h before first charge");
      }
      return null;
    }

    case "trial_ending": {
      if (billAt !== null && t >= billAt) {
        return await beginFirstCharge(sub.id, workspaceId, sub.status, notify, notified, workspaceId);
      }
      return null;
    }

    // ── Cancellation scheduled: let it run out, then stop ─────────────────────
    case "scheduled_cancel": {
      const ends = sub.cancelScheduledAt?.getTime() ?? billAt;
      if (ends !== null && t >= ends) {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "cancelled", cancelledAt: new Date(t), accessRestrictedAt: new Date(t + DATA_RETENTION_DAYS * DAY) },
        });
        await transition(sub.id, workspaceId, sub.status, "cancelled", "Scheduled cancellation took effect. No payment was taken.");
        return done("cancelled", "cancellation took effect");
      }
      return null;
    }

    // ── Payment recovery: gradual restriction, never deletion ────────────────
    case "payment_failed":
    case "payment_recovery":
    case "past_due": {
      const failedAt = sub.paymentFailedAt?.getTime();
      if (failedAt === undefined) return null;
      const restrictAt = failedAt + RECOVERY_GRACE_DAYS * DAY;
      if (t >= restrictAt) {
        await db.subscription.update({ where: { id: sub.id }, data: { status: "restricted" } });
        await transition(sub.id, workspaceId, sub.status, "restricted", `Payment unresolved after ${RECOVERY_GRACE_DAYS} days. Sending paused; all data retained.`);
        return done("restricted", "restricted after grace period");
      }
      return null;
    }

    default:
      return null;
  }
}

/**
 * Start the first charge.
 *
 * In Stripe mode we do NOT charge here: Stripe owns the schedule via the
 * subscription's trial_end, and the webhook tells us what happened. Marking
 * payment_processing and waiting is what stops a double charge.
 *
 * In simulated mode there is no provider, so the charge is simulated and the
 * resulting invoice is labelled as such. It never claims money was taken.
 */
async function beginFirstCharge(
  subId: string,
  workspaceId: string,
  from: string,
  notify: (k: NotificationKey) => Promise<void>,
  notified: NotificationKey[],
  wsId: string
): Promise<LifecycleAction> {
  if (providerMode() === "stripe") {
    await db.subscription.update({ where: { id: subId }, data: { status: "payment_processing" } });
    await transition(subId, workspaceId, from, "payment_processing", "Trial ended. Awaiting the payment provider's confirmation before granting paid access.");
    return { workspaceId: wsId, from, to: "payment_processing", did: "awaiting provider confirmation", notified };
  }

  const applied = await applySuccessfulCharge(workspaceId, {
    actorLabel: "system",
    simulated: true,
  });
  if (applied) await notify("billing.charge_succeeded");
  return { workspaceId: wsId, from, to: "active", did: "simulated first charge", notified };
}

/**
 * Grant paid access and write the invoice. Called by the Stripe webhook on
 * invoice.paid, and by the simulated charge. Single path, so paid access is
 * always backed by a recorded payment event.
 */
export async function applySuccessfulCharge(
  workspaceId: string,
  args: {
    actorLabel: string;
    amountPence?: number;
    stripeInvoiceId?: string;
    hostedUrl?: string;
    pdfUrl?: string;
    externalId?: string;
    periodStart?: Date;
    periodEnd?: Date;
    simulated?: boolean;
  }
) {
  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
  if (!sub) return null;

  // Idempotency: a replayed provider event must not produce a second invoice.
  if (args.stripeInvoiceId) {
    const seen = await db.invoice.findUnique({ where: { stripeInvoiceId: args.stripeInvoiceId } });
    if (seen) return sub;
  }
  if (args.externalId) {
    const seen = await db.subscriptionEvent.findUnique({ where: { externalId: args.externalId } });
    if (seen) return sub;
  }

  const gross = args.amountPence ?? sub.firstChargePence ?? sub.plan?.monthlyPence ?? 0;
  const credit = Math.min(sub.creditPence, gross);
  const net = gross - credit;

  const from = sub.status;
  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: "active",
      creditPence: sub.creditPence - credit,
      paymentFailedAt: null,
      paymentRetryCount: 0,
      accessRestrictedAt: null,
    },
  });

  const count = await db.invoice.count();
  await db.invoice.create({
    data: {
      subscriptionId: sub.id,
      number: `SL-${String(count + 1).padStart(5, "0")}`,
      amountPence: net,
      currency: sub.plan?.currency ?? "GBP",
      status: "paid",
      description: [
        sub.plan?.name ?? "SendLoom subscription",
        sub.billingCycle === "annual" ? "annual" : "monthly",
        credit > 0 ? `less £${(credit / 100).toFixed(2)} account credit` : null,
        args.simulated ? "SIMULATED · no payment provider connected, no money moved" : null,
      ].filter(Boolean).join(" · "),
      periodStart: args.periodStart ?? null,
      periodEnd: args.periodEnd ?? null,
      paidAt: new Date(),
      stripeInvoiceId: args.stripeInvoiceId ?? null,
      hostedUrl: args.hostedUrl ?? null,
      pdfUrl: args.pdfUrl ?? null,
    },
  });

  await recordEvent(sub.id, {
    type: "charge.succeeded",
    fromStatus: from,
    toStatus: "active",
    actorLabel: args.actorLabel,
    externalId: args.externalId,
    detail: JSON.stringify({ grossPence: gross, creditPence: credit, chargedPence: net, simulated: Boolean(args.simulated) }),
  });

  await audit(
    workspaceId,
    args.actorLabel,
    "billing.charge_succeeded",
    `${sub.plan?.name ?? "Subscription"} · £${(net / 100).toFixed(2)} taken${args.simulated ? " (SIMULATED, no provider connected)" : ""} · account now active`
  );

  return updated;
}

/** Record a failed charge and enter controlled recovery. */
export async function applyFailedCharge(
  workspaceId: string,
  args: { actorLabel: string; amountPence?: number; reason?: string; externalId?: string; stripeInvoiceId?: string }
) {
  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
  if (!sub) return null;
  if (args.externalId) {
    const seen = await db.subscriptionEvent.findUnique({ where: { externalId: args.externalId } });
    if (seen) return sub;
  }

  const from = sub.status;
  const failedAt = sub.paymentFailedAt ?? new Date();
  const restrictedAt = new Date(failedAt.getTime() + RECOVERY_GRACE_DAYS * DAY);

  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: sub.paymentRetryCount > 0 ? "payment_recovery" : "payment_failed",
      paymentFailedAt: failedAt,
      paymentRetryCount: { increment: 1 },
      accessRestrictedAt: restrictedAt,
    },
  });

  if (args.stripeInvoiceId) {
    const existing = await db.invoice.findUnique({ where: { stripeInvoiceId: args.stripeInvoiceId } });
    if (!existing) {
      const count = await db.invoice.count();
      await db.invoice.create({
        data: {
          subscriptionId: sub.id,
          number: `SL-${String(count + 1).padStart(5, "0")}`,
          amountPence: args.amountPence ?? sub.firstChargePence ?? 0,
          currency: sub.plan?.currency ?? "GBP",
          status: "failed",
          description: `${sub.plan?.name ?? "SendLoom subscription"} · payment failed${args.reason ? ` · ${args.reason}` : ""}`,
          stripeInvoiceId: args.stripeInvoiceId,
        },
      });
    }
  }

  await recordEvent(sub.id, {
    type: "charge.failed",
    fromStatus: from,
    toStatus: updated.status,
    actorLabel: args.actorLabel,
    externalId: args.externalId,
    detail: args.reason ?? "Payment declined",
  });

  await audit(
    workspaceId,
    args.actorLabel,
    "billing.charge_failed",
    `Payment failed${args.reason ? `: ${args.reason}` : ""} · retry ${updated.paymentRetryCount} · sending pauses ${restrictedAt.toISOString()} if unresolved · no data removed`
  );

  const bundle = await contextFor(workspaceId, process.env.APP_ORIGIN ?? "http://localhost:3009");
  if (bundle) await notifyOnce(bundle.subscriptionId, "billing.charge_failed", bundle.ctx, bundle.email);

  return updated;
}

async function transition(subId: string, workspaceId: string, from: string, to: string, why: string) {
  await db.subscription.update({ where: { id: subId }, data: { status: to } }).catch(() => {});
  await recordEvent(subId, { type: "status.changed", fromStatus: from, toStatus: to, actorLabel: "system", detail: why });
  await audit(workspaceId, "system", `billing.status.${to}`, why);
}

/** Advance every non-exempt account. Safe to run repeatedly. */
export async function advanceAll(opts: { now?: Date; origin?: string } = {}) {
  const subs = await db.subscription.findMany({
    where: { complimentary: false, status: { notIn: ["complimentary", "enterprise", "cancelled", "expired", "restricted"] } },
    select: { workspaceId: true },
  });
  const actions: LifecycleAction[] = [];
  for (const s of subs) {
    const a = await advanceWorkspace(s.workspaceId, opts);
    if (a) actions.push(a);
  }
  return actions;
}
