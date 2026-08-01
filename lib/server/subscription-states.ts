// Subscription states, and the single source of truth for what each one means
// to the customer, the product and the admin.
//
// Held here rather than as scattered string literals so that adding a state
// forces you to answer the questions the spec demands of every state: what can
// they do, what do we tell them, is it billing's problem or support's.

export const SUBSCRIPTION_STATES = [
  "trialing_no_pm",        // days 1-3, no payment method required yet
  "trial_action_required", // day 3 reached, must choose a plan to continue
  "trialing_pm_verified",  // days 4-7, plan chosen and card verified
  "trial_ending",          // final 24h before the first charge
  "active",                // paying
  "scheduled_cancel",      // paying, but will not renew
  "cancelled",
  "payment_processing",
  "payment_failed",
  "payment_recovery",
  "past_due",
  "restricted",
  "paused",
  "expired",
  "enterprise",            // contracted, billed outside the product
  "complimentary",         // in-house and comped accounts, never billed
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATES)[number];

type StateMeta = {
  /** Shown in the dashboard trial/billing component. */
  label: string;
  /** Plain-English explanation for the customer. */
  customer: string;
  /** Does the product still allow sending and premium actions? */
  canSend: boolean;
  /** Should the UI push the user toward choosing or fixing billing? */
  needsAction: boolean;
  /** Is this account exempt from billing entirely? */
  exempt: boolean;
  /** Admin-facing tone for the subscriptions list. */
  tone: "neutral" | "info" | "warn" | "danger" | "good";
};

export const STATE_META: Record<SubscriptionStatus, StateMeta> = {
  trialing_no_pm: {
    label: "Free trial",
    customer: "You are on your free trial. No payment details required yet.",
    canSend: true, needsAction: false, exempt: false, tone: "info",
  },
  trial_action_required: {
    label: "Choose your plan",
    customer: "Choose a plan and verify your payment method to continue your free trial.",
    canSend: false, needsAction: true, exempt: false, tone: "warn",
  },
  trialing_pm_verified: {
    label: "Free trial",
    customer: "Your plan is selected and your payment method is verified. You will not be charged until your trial ends.",
    canSend: true, needsAction: false, exempt: false, tone: "good",
  },
  trial_ending: {
    label: "Trial ending",
    customer: "Your free trial ends within 24 hours and your first payment will be taken.",
    canSend: true, needsAction: false, exempt: false, tone: "info",
  },
  active: {
    label: "Active",
    customer: "Your subscription is active.",
    canSend: true, needsAction: false, exempt: false, tone: "good",
  },
  scheduled_cancel: {
    label: "Cancelling",
    customer: "Your subscription is scheduled to end. You keep full access until then.",
    canSend: true, needsAction: false, exempt: false, tone: "warn",
  },
  cancelled: {
    label: "Cancelled",
    customer: "Your subscription has ended. Your work is kept and can be restored if you subscribe again.",
    canSend: false, needsAction: true, exempt: false, tone: "neutral",
  },
  payment_processing: {
    label: "Processing",
    customer: "We are confirming your payment.",
    canSend: true, needsAction: false, exempt: false, tone: "info",
  },
  payment_failed: {
    label: "Payment failed",
    customer: "Your last payment did not go through. Update your payment method to avoid interruption.",
    canSend: true, needsAction: true, exempt: false, tone: "danger",
  },
  payment_recovery: {
    label: "Retrying payment",
    customer: "We are retrying your payment. Your account is still active.",
    canSend: true, needsAction: true, exempt: false, tone: "warn",
  },
  past_due: {
    label: "Past due",
    customer: "Your account is past due. Please update your payment method.",
    canSend: true, needsAction: true, exempt: false, tone: "danger",
  },
  restricted: {
    label: "Restricted",
    customer: "Sending is paused while billing is resolved. Your data and setup are intact.",
    canSend: false, needsAction: true, exempt: false, tone: "danger",
  },
  paused: {
    label: "Paused",
    customer: "Your subscription is paused.",
    canSend: false, needsAction: true, exempt: false, tone: "neutral",
  },
  expired: {
    label: "Expired",
    customer: "Your trial ended without a subscription. Your work is kept and can be restored.",
    canSend: false, needsAction: true, exempt: false, tone: "neutral",
  },
  enterprise: {
    label: "Enterprise",
    customer: "Your account is managed under an enterprise agreement.",
    canSend: true, needsAction: false, exempt: true, tone: "good",
  },
  complimentary: {
    label: "Complimentary",
    customer: "This account has complimentary access.",
    canSend: true, needsAction: false, exempt: true, tone: "good",
  },
};

export function isExempt(status: string): boolean {
  return STATE_META[status as SubscriptionStatus]?.exempt ?? true; // unknown = safe
}

export function canSend(status: string): boolean {
  return STATE_META[status as SubscriptionStatus]?.canSend ?? true; // unknown = safe
}

export function needsBillingAction(status: string): boolean {
  return STATE_META[status as SubscriptionStatus]?.needsAction ?? false;
}

// Trial shape, per the spec: 3 days without a card, 7 days in total.
export const TRIAL_STAGE_ONE_DAYS = 3;
export const TRIAL_TOTAL_DAYS = 7;

export function trialDates(from = new Date()) {
  const stageOne = new Date(from);
  stageOne.setUTCDate(stageOne.getUTCDate() + TRIAL_STAGE_ONE_DAYS);
  const ends = new Date(from);
  ends.setUTCDate(ends.getUTCDate() + TRIAL_TOTAL_DAYS);
  return { trialStartedAt: from, trialStageOneEndsAt: stageOne, trialEndsAt: ends, firstBillingAt: ends };
}

/** Exact, customer-facing date and time. The spec forbids vague wording. */
export function formatBillingMoment(d: Date, currency = "GBP"): string {
  void currency;
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "Europe/London", timeZoneName: "short",
  }).format(d);
}

export function formatMoney(pence: number, currency = "GBP"): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(pence / 100);
}
