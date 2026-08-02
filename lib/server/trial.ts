// Trial lifecycle: starting a trial, capturing the commercial profile, and
// recommending the plan that actually fits.
//
// The onboarding questions exist only to feed the recommendation, so the
// answers are persisted on the subscription itself and read back every time a
// recommendation is made. Nothing is asked that is not used here.

import { db } from "@/lib/server/db";
import { trialDates } from "@/lib/server/subscription-states";
import { trackFunnel } from "@/lib/server/billing/analytics-events";

export type BusinessType =
  | "ecommerce" | "professional_services" | "hospitality" | "property"
  | "financial_services" | "agency" | "creator_media" | "other";

export type PrimaryGoal =
  | "generate_sales" | "recover_carts" | "build_journeys" | "grow_list"
  | "improve_retention" | "send_newsletters" | "manage_clients";

export type SignupProfile = {
  businessType?: BusinessType;
  /** Approximate current contact count, as a number. */
  expectedContacts?: number;
  /** Expected monthly email volume. */
  expectedSends?: number;
  /** Websites or brands they intend to connect. */
  expectedSites?: number;
  primaryGoal?: PrimaryGoal;
  websiteUrl?: string;
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
      accountType: "external",
      trialStartedAt: dates.trialStartedAt,
      trialStageOneEndsAt: dates.trialStageOneEndsAt,
      trialEndsAt: dates.trialEndsAt,
      firstBillingAt: dates.firstBillingAt,
      businessType: profile.businessType ?? null,
      expectedContacts: profile.expectedContacts ?? null,
      expectedSends: profile.expectedSends ?? null,
      expectedSites: profile.expectedSites ?? null,
      primaryGoal: profile.primaryGoal ?? null,
      websiteUrl: profile.websiteUrl ?? null,
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
      }),
    },
  });
  await trackFunnel("trial_started", { workspaceId, once: true });

  return sub;
}

/**
 * Save or update the onboarding answers after the account exists.
 * Skippable questions arrive as undefined and do not erase earlier answers.
 */
export async function saveOnboardingProfile(workspaceId: string, profile: SignupProfile, actorLabel: string) {
  const sub = await db.subscription.findUnique({ where: { workspaceId } });
  if (!sub) return null;

  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      businessType: profile.businessType ?? sub.businessType,
      expectedContacts: profile.expectedContacts ?? sub.expectedContacts,
      expectedSends: profile.expectedSends ?? sub.expectedSends,
      expectedSites: profile.expectedSites ?? sub.expectedSites,
      primaryGoal: profile.primaryGoal ?? sub.primaryGoal,
      websiteUrl: profile.websiteUrl ?? sub.websiteUrl,
      onboardedAt: sub.onboardedAt ?? new Date(),
    },
  });

  await db.subscriptionEvent.create({
    data: {
      subscriptionId: sub.id,
      type: "onboarding.completed",
      actorLabel,
      detail: JSON.stringify(profile),
    },
  });
  await trackFunnel("onboarding_completed", { workspaceId, once: true });

  return updated;
}

export type Recommendation = {
  planKey: "launch" | "growth" | "scale";
  /** Plain-language reason, built from what they told us or what they did. */
  reason: string;
  /** The signals the recommendation was based on, for transparency. */
  signals: string[];
};

/**
 * Recommend a plan. Deterministic and explainable, per the brief: real usage
 * beats the stated expectation once there is any, and the answer is the
 * SMALLEST plan that clears every dimension, never the dearest.
 *
 * Plan ceilings are read from the database so an admin price/limit change
 * moves the recommendation without touching code.
 */
export async function recommendPlan(workspaceId: string): Promise<Recommendation> {
  const [sub, contacts, stores, automations, users, plans] = await Promise.all([
    db.subscription.findUnique({ where: { workspaceId } }),
    db.contact.count({ where: { workspaceId } }),
    db.store.count({ where: { workspaceId } }),
    db.automation.count({ where: { workspaceId, status: "live" } }),
    db.user.count({ where: { workspaceId, disabled: false } }),
    db.plan.findMany({ where: { visible: true, contactSales: false }, orderBy: { sortOrder: "asc" } }),
  ]);

  const effective = {
    contacts: Math.max(contacts, sub?.expectedContacts ?? 0),
    sends: sub?.expectedSends ?? 0,
    sites: Math.max(stores, sub?.expectedSites ?? 0),
    users,
    automations,
  };

  const signals: string[] = [];
  if (contacts > 0) signals.push(`${contacts.toLocaleString()} contacts imported`);
  else if (effective.contacts) signals.push(`around ${effective.contacts.toLocaleString()} contacts expected`);
  if (effective.sends) signals.push(`about ${effective.sends.toLocaleString()} emails a month`);
  if (effective.sites > 0) signals.push(`${effective.sites} ${effective.sites === 1 ? "website" : "websites"}`);
  if (automations > 0) signals.push(`${automations} live ${automations === 1 ? "automation" : "automations"}`);
  if (users > 1) signals.push(`${users} team members`);

  // Smallest visible plan whose limits cover every dimension.
  const fits = (entJson: string): boolean => {
    let ent: Record<string, number | boolean>;
    try { ent = JSON.parse(entJson); } catch { return false; }
    const covers = (key: string, need: number) => {
      const v = ent[key];
      if (typeof v !== "number") return true;
      return v === -1 || v >= need;
    };
    return (
      covers("monthly_contacts", effective.contacts) &&
      covers("monthly_email_sends", effective.sends) &&
      covers("connected_domains", effective.sites) &&
      covers("team_members", effective.users) &&
      covers("active_automations", effective.automations)
    );
  };

  let chosen = plans.find((p) => fits(p.entitlements)) ?? plans[plans.length - 1];

  // Revenue attribution is a genuine plan boundary, not an upsell: it is off
  // on Launch, and several goals depend on it.
  const wantsAttribution = sub?.primaryGoal === "generate_sales" || sub?.primaryGoal === "improve_retention" || sub?.primaryGoal === "recover_carts";
  if (chosen && wantsAttribution) {
    try {
      const ent = JSON.parse(chosen.entitlements) as Record<string, number | boolean>;
      if (ent.revenue_attribution !== true) {
        const next = plans.find((p) => {
          try { return (JSON.parse(p.entitlements) as Record<string, unknown>).revenue_attribution === true; } catch { return false; }
        });
        if (next) {
          chosen = next;
          signals.push("revenue tracking needed for your goal");
        }
      }
    } catch { /* keep the size-based choice */ }
  }

  const planKey = (chosen?.key ?? "launch") as Recommendation["planKey"];
  const name = chosen?.name ?? "SendLoom Launch";
  const reason = signals.length
    ? `${name} is recommended because you have ${signals.join(", ")}. It covers that without you having to cut anything back.`
    : `${name} is the right starting point for a new list. You can move up at any time, and we will tell you when your usage says you should.`;

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
