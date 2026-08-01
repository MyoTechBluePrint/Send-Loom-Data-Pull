// Trial lifecycle: starting a trial, and recommending the plan that actually
// fits what the account is doing.
//
// The recommendation is the reason the signup questions are worth asking. We
// only ask what feeds it, so the customer gets something back immediately
// instead of filling in a form for our benefit.

import { db } from "@/lib/server/db";
import { trialDates } from "@/lib/server/subscription-states";

export type SignupProfile = {
  /** Their store or website. Also the thing we connect tracking to later. */
  websiteUrl?: string;
  /** Roughly how many contacts they hold today. Drives plan sizing. */
  contactsBand?: "under_1k" | "1k_10k" | "10k_50k" | "50k_plus" | "unsure";
  /** What they want first. Drives which onboarding path we open on. */
  primaryGoal?: "recover_carts" | "grow_list" | "send_campaigns" | "understand_revenue" | "other";
  /** Platform, so we can offer the right connector. */
  platform?: "woocommerce" | "shopify" | "other" | "none";
  companyName?: string;
};

/**
 * Start a workspace on the 7-day trial. Days 1-3 need no payment method.
 * Idempotent: calling twice will not restart or extend a trial.
 */
export async function startTrial(workspaceId: string, profile: SignupProfile = {}, actorLabel = "system") {
  const existing = await db.subscription.findUnique({ where: { workspaceId } });
  if (existing) return existing;

  const dates = trialDates(new Date());
  const sub = await db.subscription.create({
    data: {
      workspaceId,
      status: "trialing_no_pm",
      trialStartedAt: dates.trialStartedAt,
      trialStageOneEndsAt: dates.trialStageOneEndsAt,
      trialEndsAt: dates.trialEndsAt,
      firstBillingAt: dates.firstBillingAt,
      notes: profile.companyName ? `Signup: ${profile.companyName}` : null,
      entitlementOverrides: "{}",
    },
  });

  await db.subscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: "trial.started",
      toStatus: "trialing_no_pm",
      actorLabel,
      detail: JSON.stringify({
        stageOneEnds: dates.trialStageOneEndsAt.toISOString(),
        trialEnds: dates.trialEndsAt.toISOString(),
        profile,
      }),
    },
  });

  return sub;
}

export type Recommendation = {
  planKey: "launch" | "growth" | "scale";
  /** Plain-language reason, built from what they told us or what they did. */
  reason: string;
  /** The signals the recommendation was based on, for transparency. */
  signals: string[];
};

const BAND_CONTACTS: Record<string, number> = {
  under_1k: 500,
  "1k_10k": 6000,
  "10k_50k": 30000,
  "50k_plus": 80000,
  unsure: 1000,
};

/**
 * Recommend a plan from real usage first, falling back to what they told us at
 * signup. Deliberately picks the SMALLEST plan that fits: the spec is explicit
 * that this must not push everyone to the most expensive option, and a customer
 * who is upsold into a plan they do not need churns.
 */
export async function recommendPlan(workspaceId: string, profile: SignupProfile = {}): Promise<Recommendation> {
  const [contacts, stores, automations, users] = await Promise.all([
    db.contact.count({ where: { workspaceId } }),
    db.store.count({ where: { workspaceId } }),
    db.automation.count({ where: { workspaceId } }),
    db.user.count({ where: { workspaceId } }),
  ]);

  // Real usage beats a self-reported band once there is any.
  const statedContacts = profile.contactsBand ? BAND_CONTACTS[profile.contactsBand] ?? 0 : 0;
  const effectiveContacts = Math.max(contacts, statedContacts);

  const signals: string[] = [];
  if (contacts > 0) signals.push(`${contacts.toLocaleString()} contacts imported`);
  else if (statedContacts) signals.push(`around ${statedContacts.toLocaleString()} contacts expected`);
  if (stores > 0) signals.push(`${stores} connected ${stores === 1 ? "website" : "websites"}`);
  if (automations > 0) signals.push(`${automations} ${automations === 1 ? "automation" : "automations"}`);
  if (users > 1) signals.push(`${users} team members`);

  // Smallest plan that clears every dimension.
  let planKey: Recommendation["planKey"] = "launch";
  if (effectiveContacts > 25000 || stores > 3 || users > 5 || automations > 25) planKey = "scale";
  else if (effectiveContacts > 2500 || stores > 1 || users > 1 || automations > 3) planKey = "growth";

  // Wanting revenue attribution is a genuine Growth reason, not an upsell:
  // Launch does not include it.
  if (planKey === "launch" && profile.primaryGoal === "understand_revenue") {
    planKey = "growth";
    signals.push("revenue attribution requested");
  }

  const names = { launch: "SendLoom Launch", growth: "SendLoom Growth", scale: "SendLoom Scale" };
  const reason = signals.length
    ? `You have ${signals.join(", ")}. ${names[planKey]} covers that without you having to cut anything back.`
    : `${names[planKey]} is the right starting point for a new list. You can move up at any time, and we will tell you when your usage says you should.`;

  return { planKey, reason, signals };
}

/** Where a trial is up to, for the dashboard status component. */
export async function trialProgress(workspaceId: string) {
  const sub = await db.subscription.findUnique({ where: { workspaceId }, include: { plan: true } });
  if (!sub?.trialStartedAt || !sub.trialEndsAt) return null;

  const now = Date.now();
  const started = sub.trialStartedAt.getTime();
  const ends = sub.trialEndsAt.getTime();
  const msLeft = Math.max(0, ends - now);
  const dayOf = Math.min(7, Math.floor((now - started) / 86_400_000) + 1);

  return {
    dayOf,
    totalDays: 7,
    daysLeft: Math.ceil(msLeft / 86_400_000),
    hoursLeft: Math.ceil(msLeft / 3_600_000),
    msLeft,
    stageOneEndsAt: sub.trialStageOneEndsAt,
    trialEndsAt: sub.trialEndsAt,
    firstBillingAt: sub.firstBillingAt,
    status: sub.status,
    planName: sub.plan?.name ?? null,
    planKey: sub.plan?.key ?? null,
    firstChargePence: sub.firstChargePence ?? sub.plan?.monthlyPence ?? null,
    paymentMethodVerified: Boolean(sub.paymentMethodVerifiedAt),
    paymentMethodBrand: sub.paymentMethodBrand,
    paymentMethodLast4: sub.paymentMethodLast4,
  };
}
