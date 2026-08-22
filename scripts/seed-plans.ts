// Seeds the plan catalogue and, critically, PROTECTS EVERY EXISTING WORKSPACE.
//
// Run: npx tsx scripts/seed-plans.ts
// Idempotent: safe to run on every deploy.
//
// The protection rule: any workspace that existed before billing shipped is
// given a complimentary subscription with unlimited entitlements. Everyone on
// SendLoom today is in-house, working on Steve's own projects, and must never
// meet a paywall or a trial countdown. New signups get the trial instead.

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "../lib/server/db";
import { UNLIMITED } from "../lib/server/entitlements";

const PLANS = [
  {
    key: "launch",
    name: "SendLoom Launch",
    blurb: "For new businesses and smaller contact lists.",
    monthlyPence: 2900,
    annualPence: 29000, // 10 months, stated plainly rather than as a fake discount
    sortOrder: 1,
    entitlements: {
      connected_domains: 1,
      monthly_contacts: 2500,
      monthly_email_sends: 20000,
      team_members: 1,
      active_automations: 3,
      ai_credits: 100,
      data_retention_days: 365,
      revenue_attribution: false,
      advanced_segmentation: false,
      premium_integrations: false,
      priority_support: false,
    },
  },
  {
    key: "growth",
    name: "SendLoom Growth",
    blurb: "For growing businesses that need stronger automation and revenue tracking.",
    monthlyPence: 7900,
    annualPence: 79000,
    recommended: true,
    sortOrder: 2,
    entitlements: {
      connected_domains: 3,
      monthly_contacts: 10000,
      monthly_email_sends: 100000,
      team_members: 5,
      active_automations: 15,
      ai_credits: 1000,
      data_retention_days: 730,
      revenue_attribution: true,
      advanced_segmentation: true,
      premium_integrations: false,
      priority_support: true,
    },
  },
  {
    key: "scale",
    name: "SendLoom Scale",
    blurb: "For larger stores, agencies and high-volume senders.",
    monthlyPence: 19900,
    annualPence: 199000,
    sortOrder: 3,
    entitlements: {
      connected_domains: 10,
      monthly_contacts: 50000,
      monthly_email_sends: 500000,
      team_members: 15,
      active_automations: 100,
      ai_credits: 5000,
      data_retention_days: 1095,
      revenue_attribution: true,
      advanced_segmentation: true,
      premium_integrations: true,
      priority_support: true,
    },
  },
  {
    key: "enterprise",
    name: "SendLoom Enterprise",
    blurb: "Custom volumes, dedicated infrastructure and contractual service levels.",
    monthlyPence: null,
    annualPence: null,
    contactSales: true,
    sortOrder: 4,
    entitlements: {
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
    },
  },
  {
    key: "internal",
    name: "Complimentary",
    blurb: "In-house access. Never billed.",
    monthlyPence: null,
    annualPence: null,
    visible: false, // never offered for sale
    sortOrder: 99,
    entitlements: {
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
    },
  },
];

async function main() {
  console.log("Seeding plan catalogue...");
  for (const p of PLANS) {
    const { entitlements, ...rest } = p;
    const data = { ...rest, entitlements: JSON.stringify(entitlements) };
    await db.plan.upsert({ where: { key: p.key }, create: data, update: data });
    console.log(`  ${p.key.padEnd(11)} ${p.monthlyPence ? "£" + (p.monthlyPence / 100).toFixed(2) + "/mo" : "contact sales"}`);
  }

  // ── Protect everyone already using SendLoom ───────────────────────────────
  const internal = await db.plan.findUnique({ where: { key: "internal" } });
  const workspaces = await db.workspace.findMany({ select: { id: true, name: true } });
  let granted = 0, already = 0, backfilled = 0;

  for (const w of workspaces) {
    const existing = await db.subscription.findUnique({ where: { workspaceId: w.id } });
    if (existing) {
      // Backfill: a complimentary account created before accountType existed
      // is, by definition, grandfathered. Stated explicitly rather than left
      // to be inferred later from a default.
      if (existing.complimentary && existing.accountType === "external") {
        await db.subscription.update({
          where: { id: existing.id },
          data: { accountType: "grandfathered" },
        });
        backfilled++;
      }
      already++;
      continue;
    }
    const sub = await db.subscription.create({
      data: {
        workspaceId: w.id,
        planId: internal!.id,
        status: "complimentary",
        complimentary: true,
        accountType: "grandfathered",
        notes: "Grandfathered: workspace existed before billing shipped. In-house account, never billed.",
      },
    });
    await db.subscriptionEvent.create({
      data: {
        subscriptionId: sub.id,
        type: "grandfathered",
        toStatus: "complimentary",
        actorLabel: "system",
        detail: `Existing workspace "${w.name}" granted complimentary access on billing rollout.`,
      },
    });
    granted++;
  }

  // ── Data correction: Novatec's real storefront is novate.bio ─────────────
  // The placeholder domain (novateclabs.co.uk) was invented before the real
  // one existed and reached seeded store rows. Idempotent: only rows still
  // carrying the placeholder are touched; MyoTech is never matched.
  const wrongNovatec = await db.store.findMany({ where: { url: { contains: "novateclabs" } } });
  for (const st of wrongNovatec) {
    await db.store.update({
      where: { id: st.id },
      data: { url: "novate.bio", domains: "novate.bio" },
    });
    console.log(`  Corrected store "${st.name}" domain -> novate.bio`);
  }

  console.log(`\nExisting workspaces protected: ${granted} granted complimentary, ${already} already had a subscription, ${backfilled} marked grandfathered.`);
  console.log("New signups will start a 7-day trial; nobody currently using SendLoom is affected.");
  // Arm the welcome flow if it has never been configured. Idempotent, and
  // silent once a human has taken over the workflow.
  const { ensureWelcomeFlow } = await import("../lib/server/automations");
  await ensureWelcomeFlow();

  await db.$disconnect();
}

main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
