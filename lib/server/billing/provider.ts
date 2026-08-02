// The billing provider seam.
//
// Two modes, and the difference is always visible to the operator rather than
// hidden behind a green tick:
//
//   Stripe mode  (STRIPE_SECRET_KEY set) - real Checkout, real Apple Pay, real
//                 SCA, real subscriptions, real invoices, webhook-confirmed.
//   Simulated    (no key) - the same state machine driven by an in-app screen
//                 that says plainly that no payment provider is connected. It
//                 exists so the seven-day journey can be walked and tested end
//                 to end before Stripe credentials arrive. It never claims a
//                 payment was taken.
//
// Subscription access is only ever changed by applyCheckoutCompleted() and the
// webhook handler, never by a front-end success message.

import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { trackFunnel } from "./analytics-events";
import { stripeConfigured, stripeRequest } from "./stripe";
import type { Plan, Subscription } from "@prisma/client";

export type BillingCycle = "monthly" | "annual";

export type CheckoutHandoff = {
  url: string;
  /** True when no payment provider is connected and this is the local stand-in. */
  simulated: boolean;
};

export function providerMode(): "stripe" | "simulated" {
  return stripeConfigured() ? "stripe" : "simulated";
}

export function priceFor(plan: Plan, cycle: BillingCycle): number | null {
  return cycle === "annual" ? plan.annualPence : plan.monthlyPence;
}

/** Amount taken at the end of the trial, in pence. */
export function firstChargeFor(plan: Plan, cycle: BillingCycle): number {
  return priceFor(plan, cycle) ?? 0;
}

async function ensureStripeCustomer(sub: Subscription, email: string, workspaceName: string): Promise<string> {
  if (sub.stripeCustomerId) return sub.stripeCustomerId;
  const customer = await stripeRequest<{ id: string }>("/customers", {
    email,
    name: workspaceName,
    metadata: { workspaceId: sub.workspaceId, sendloomSubscriptionId: sub.id },
  });
  await db.subscription.update({ where: { id: sub.id }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

/**
 * Start checkout for a plan. In Stripe mode this creates a Checkout Session in
 * subscription mode with the trial end already fixed, which is what makes the
 * "£0 today, first payment on <date>" promise true at the provider rather than
 * only in our copy. Apple Pay appears automatically on supported devices.
 */
export async function startCheckout(args: {
  workspaceId: string;
  planKey: string;
  cycle: BillingCycle;
  email: string;
  workspaceName: string;
  origin: string;
}): Promise<CheckoutHandoff> {
  const plan = await db.plan.findUnique({ where: { key: args.planKey } });
  if (!plan) throw new Error("Unknown plan.");
  if (plan.contactSales) throw new Error("This plan is arranged with our team, not through checkout.");

  const sub = await db.subscription.findUnique({ where: { workspaceId: args.workspaceId } });
  if (!sub) throw new Error("This workspace has no subscription record.");

  const amount = priceFor(plan, args.cycle);
  if (amount === null) throw new Error("This plan has no price for that billing cycle.");

  // The trial end is whatever the customer was already told, never recomputed
  // from "now": a customer who reaches checkout on day 3 still gets day 7.
  const trialEnd = sub.trialEndsAt ?? new Date(Date.now() + 7 * 86_400_000);

  // Record the intent before leaving for the provider, so a customer who
  // abandons checkout still shows the plan they were looking at.
  await db.subscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: "checkout.started",
      actorLabel: args.email,
      detail: JSON.stringify({ planKey: plan.key, cycle: args.cycle, amount }),
    },
  });
  await trackFunnel("plan_selected", { workspaceId: args.workspaceId, payload: { planKey: plan.key, cycle: args.cycle } });
  await trackFunnel("payment_method_setup_started", { workspaceId: args.workspaceId, once: true });

  if (providerMode() === "simulated") {
    const q = new URLSearchParams({ plan: plan.key, cycle: args.cycle });
    return { url: `/checkout/simulate?${q.toString()}`, simulated: true };
  }

  const customerId = await ensureStripeCustomer(sub, args.email, args.workspaceName);

  const session = await stripeRequest<{ id: string; url: string }>(
    "/checkout/sessions",
    {
      mode: "subscription",
      customer: customerId,
      client_reference_id: args.workspaceId,
      success_url: `${args.origin}/checkout/return?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${args.origin}/plans?cancelled=1`,
      // Always collect a payment method, even though nothing is due today.
      // That is what makes the £0 authorisation happen.
      payment_method_collection: "always",
      allow_promotion_codes: true,
      automatic_tax: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: plan.currency.toLowerCase(),
            product_data: { name: plan.name, metadata: { planKey: plan.key } },
            unit_amount: amount,
            recurring: { interval: args.cycle === "annual" ? "year" : "month" },
          },
        },
      ],
      subscription_data: {
        trial_end: Math.floor(trialEnd.getTime() / 1000),
        metadata: { workspaceId: args.workspaceId, planKey: plan.key, cycle: args.cycle },
      },
      metadata: { workspaceId: args.workspaceId, planKey: plan.key, cycle: args.cycle },
    },
    // One key per workspace+plan+cycle+trial-end: a double-clicked button or a
    // refreshed payment screen returns the same session instead of a second
    // subscription.
    { idempotencyKey: `co_${args.workspaceId}_${plan.key}_${args.cycle}_${Math.floor(trialEnd.getTime() / 1000)}` }
  );

  return { url: session.url, simulated: false };
}

/**
 * Payment method verified and the scheduled subscription is in place.
 * Called by the Stripe webhook, and by the simulated checkout screen. Both go
 * through here so there is exactly one code path that grants access.
 */
export async function applyCheckoutCompleted(args: {
  workspaceId: string;
  planKey: string;
  cycle: BillingCycle;
  stripeSubscriptionId?: string;
  stripeCustomerId?: string;
  paymentMethodBrand?: string;
  paymentMethodLast4?: string;
  actorLabel: string;
  externalId?: string;
}) {
  const [sub, plan] = await Promise.all([
    db.subscription.findUnique({ where: { workspaceId: args.workspaceId } }),
    db.plan.findUnique({ where: { key: args.planKey } }),
  ]);
  if (!sub || !plan) return null;

  const from = sub.status;
  const charge = firstChargeFor(plan, args.cycle);

  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      planId: plan.id,
      billingCycle: args.cycle,
      status: "trialing_pm_verified",
      paymentMethodVerifiedAt: sub.paymentMethodVerifiedAt ?? new Date(),
      paymentMethodBrand: args.paymentMethodBrand ?? sub.paymentMethodBrand,
      paymentMethodLast4: args.paymentMethodLast4 ?? sub.paymentMethodLast4,
      stripeSubscriptionId: args.stripeSubscriptionId ?? sub.stripeSubscriptionId,
      stripeCustomerId: args.stripeCustomerId ?? sub.stripeCustomerId,
      firstChargePence: charge,
      firstBillingAt: sub.firstBillingAt ?? sub.trialEndsAt,
      // Choosing a plan clears any earlier cancellation intent.
      cancelScheduledAt: null,
      cancelledAt: null,
    },
  });

  await recordEvent(sub.id, {
    type: "pm.verified",
    fromStatus: from,
    toStatus: "trialing_pm_verified",
    actorLabel: args.actorLabel,
    externalId: args.externalId,
    detail: JSON.stringify({ planKey: plan.key, cycle: args.cycle, firstChargePence: charge }),
  });

  await trackFunnel("payment_method_verified", { workspaceId: args.workspaceId, once: true });
  await audit(
    args.workspaceId,
    args.actorLabel,
    "billing.payment_method_verified",
    `${plan.name} (${args.cycle}) selected · £0 taken today · first charge ${(charge / 100).toFixed(2)} on ${updated.firstBillingAt?.toISOString() ?? "trial end"}`
  );

  return updated;
}

/**
 * Append a subscription event, treating a repeated provider event id as a
 * no-op. This is what makes webhook delivery idempotent: Stripe retries the
 * same event id, and the unique constraint absorbs it.
 */
export async function recordEvent(
  subscriptionId: string,
  e: {
    type: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    actorLabel?: string;
    detail?: string | null;
    externalId?: string | null;
  }
): Promise<boolean> {
  if (e.externalId) {
    const seen = await db.subscriptionEvent.findUnique({ where: { externalId: e.externalId } });
    if (seen) return false;
  }
  try {
    await db.subscriptionEvent.create({
      data: {
        subscriptionId,
        type: e.type,
        fromStatus: e.fromStatus ?? null,
        toStatus: e.toStatus ?? null,
        actorLabel: e.actorLabel ?? "system",
        detail: e.detail ?? null,
        externalId: e.externalId ?? null,
      },
    });
    return true;
  } catch {
    // Unique violation on externalId: another delivery of the same event won
    // the race. Absorbing it is the correct behaviour.
    return false;
  }
}

/** Cancel the scheduled subscription at the provider, where one exists. */
export async function cancelAtProvider(sub: Subscription, immediately: boolean) {
  if (providerMode() !== "stripe" || !sub.stripeSubscriptionId) return;
  if (immediately) {
    await stripeRequest(`/subscriptions/${sub.stripeSubscriptionId}`, undefined, { method: "DELETE" });
  } else {
    await stripeRequest(`/subscriptions/${sub.stripeSubscriptionId}`, { cancel_at_period_end: true });
  }
}
