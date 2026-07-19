// CLEAN LAUNCH seed: the fresh workspace for the ads team. MyoTech and
// Novatec are the story; there are NO contacts, no fake history, no revenue,
// no Savvy Mango data. Templates only, clearly labelled.
import { db } from "../lib/server/db";

export async function main() {
  console.log("Seeding CLEAN LAUNCH workspace…");

  const ws = await db.workspace.create({
    data: { name: "Sendloom Launch Workspace", sector: "health-wellness" },
  });

  // Login users come from SEED_USERS (owner, Will, real-email alias).
  const { seedUsers } = await import("./seed-users");
  await seedUsers(ws.id);
  // Ads team placeholder: visible in Team, no password until added to SEED_USERS.
  await db.user.create({
    data: { workspaceId: ws.id, email: "ads@frenziapp.com", name: "Ads team (placeholder)", role: "ads_operator" },
  });

  // The two real stores. Pending until the plugin connects.
  const { randomBytes } = await import("node:crypto");
  for (const d of [
    { name: "MyoTech", url: "myotech.store", backend: "api.myotech.store" },
    { name: "Novatec", url: "novateclabs.co.uk", backend: null },
  ]) {
    await db.store.create({
      data: {
        workspaceId: ws.id, name: d.name, url: d.url,
        apiKey: `slm_live_${d.name.toLowerCase()}_${randomBytes(8).toString("hex")}`,
        environment: "staging", status: "pending", domains: d.url,
        backendDomains: d.backend,
      },
    });
  }

  // Campaign TEMPLATES — drafts only, zero stats, clearly labelled.
  const campaignTemplates = [
    ["Welcome popup subscriber", "Welcome, here's your code"],
    ["Abandoned cart recovery", "You left something behind"],
    ["Abandoned checkout recovery", "Your order is one click away"],
    ["Product education sequence", "What it actually does"],
    ["First purchase thank-you", "Thank you, and what happens next"],
    ["Win-back sequence", "It's been a while"],
    ["Consultation request follow-up", "About your consultation"],
    ["Discount code reminder", "Your code expires soon"],
  ];
  for (const [name, subject] of campaignTemplates) {
    await db.campaign.create({
      data: {
        workspaceId: ws.id, name: `${name} (template)`, subject,
        status: "draft", isDemo: true, // isDemo doubles as the template flag
      },
    });
  }

  // Automation RECIPES — draft, zero stats, minimal node skeletons.
  const recipes: [string, string][] = [
    ["Abandoned cart", "Cart abandoned for 1 hour"],
    ["Abandoned checkout", "Checkout abandoned for 30 minutes"],
    ["Welcome flow", "Popup or form signup"],
    ["Browse abandonment", "Viewed product, left site"],
    ["Popup subscriber", "Popup submitted"],
    ["First purchase", "First order completed"],
    ["Repeat purchase", "Second order completed"],
    ["Win-back", "No purchase for 90 days"],
  ];
  for (const [name, trigger] of recipes) {
    await db.automation.create({
      data: {
        workspaceId: ws.id, name: `${name} (recipe)`, trigger,
        status: "draft", isDemo: true,
        nodes: {
          create: [
            { kind: "trigger", label: "Trigger", detail: trigger, position: 0 },
            { kind: "email", label: "Email", detail: "Configure content once tracking is connected", position: 1 },
            { kind: "exit", label: "Exit", detail: "", position: 2 },
          ],
        },
      },
    });
  }

  // Popup/form TEMPLATES — draft until the ads team activates one.
  const popupTemplates: [string, string, string][] = [
    ["MyoTech · Discount signup (template)", "popup", "Time on page · 8s · all pages"],
    ["MyoTech · Consultation request (template)", "popup", "Product pages"],
    ["MyoTech · Exit intent offer (template)", "exit_intent", "Exit intent · cart page"],
    ["MyoTech · Cart rescue (template)", "popup", "Cart page · 30s"],
    ["Novatec · Product interest capture (template)", "popup", "Product pages"],
    ["Novatec · Launch waitlist (template)", "embedded", "Landing pages"],
    ["Novatec · Discount signup (template)", "popup", "Time on page · 8s"],
    ["Novatec · Exit intent (template)", "exit_intent", "Exit intent · all pages"],
  ];
  for (const [name, type, trigger] of popupTemplates) {
    await db.form.create({
      data: { workspaceId: ws.id, name, type, trigger, status: "draft", isDemo: true },
    });
  }

  // Providers, reframed around launch priorities.
  const providers: [string, string, string, string][] = [
    ["WooCommerce Connect", "commerce", "not_connected", "PRIORITY 1 · install the plugin on MyoTech, then Novatec"],
    ["Sendloom tracker", "commerce", "not_connected", "PRIORITY 2 · loads automatically once the plugin connects"],
    ["Popups & forms", "commerce", "not_connected", "PRIORITY 3 · activate a template after tracking works"],
    ["Google Analytics Data API", "search_data", "not_connected", "PRIORITY 4 · attribution beyond email clicks"],
    ["Google Search Console", "search_data", "not_connected", "PRIORITY 5 · first-party search demand"],
    ["Meta Lead Ads", "ad_platform", "not_connected", "Later · lead forms once ads run"],
    ["Google Ads lead forms", "ad_platform", "not_connected", "Later"],
    ["Amazon SES (managed)", "email_sending", "not_connected", "Later · required before live sends"],
    ["Companies House", "company_data", "not_connected", "Available later · not active in this launch workspace"],
    ["Apollo enrichment", "enrichment", "not_connected", "Available later · not active in this launch workspace"],
  ];
  for (const [name, type, status, note] of providers) {
    await db.dataProvider.create({ data: { workspaceId: ws.id, name, type, status, note } });
  }

  await db.auditLog.create({
    data: {
      workspaceId: ws.id, actorLabel: "system", action: "workspace.clean_launch",
      detail: "Clean launch workspace seeded: no contacts, no Savvy Mango data, no demo revenue. MyoTech + Novatec pending connection.",
    },
  });

  console.log("Clean launch workspace ready.");
}

// Boot top-up for CLEAN workspaces only: keeps the ads role current and adds
// store-flavoured popup templates introduced after the last reset. Idempotent.
export async function launchTopUp(workspaceId: string) {
  // Historic-data audit (19 Jul): events ingested before provenance existed
  // were stamped stream=storefront by the migration default. Anything that is
  // recognisably a QA/plugin test event is reclassified so it can never
  // satisfy customer-behaviour milestones.
  await db.event.updateMany({
    where: { workspaceId, stream: "storefront", OR: [{ payload: { contains: "qa-panel" } }, { payload: { contains: "/sendloom-test" } }] },
    data: { stream: "test", sourceContext: "qa-panel", acceptReason: "Reclassified: pre-provenance QA test event." },
  });
  await db.user.updateMany({
    where: { workspaceId, email: "ads@frenziapp.com" },
    data: { role: "ads_operator" },
  });
  // Domain correction (19 Jul): the real MyoTech site is myotech.store, not
  // the invented myotechlabs.co.uk. Fix any store still carrying the old value.
  await db.store.updateMany({
    where: { workspaceId, name: "MyoTech", url: "myotechlabs.co.uk" },
    data: { url: "myotech.store", domains: "myotech.store" },
  });
  // Storefront/backend separation (19 Jul): api.myotech.store is the backend,
  // never a tracking domain. Record it and strip it from the allowlist.
  const myo = await db.store.findFirst({ where: { workspaceId, name: "MyoTech" } });
  if (myo) {
    const cleaned = (myo.domains ?? "").split(",").map((d) => d.trim()).filter((d) => d && !d.startsWith("api.") && !d.startsWith("admin."));
    await db.store.update({
      where: { id: myo.id },
      data: {
        domains: cleaned.join(",") || "myotech.store",
        backendDomains: myo.backendDomains?.includes("api.myotech.store") ? myo.backendDomains : [myo.backendDomains, "api.myotech.store"].filter(Boolean).join(","),
      },
    });
  }
  const wanted: [string, string, string][] = [
    ["MyoTech · Discount signup (template)", "popup", "Time on page · 8s · all pages"],
    ["MyoTech · Consultation request (template)", "popup", "Product pages"],
    ["MyoTech · Exit intent offer (template)", "exit_intent", "Exit intent · cart page"],
    ["MyoTech · Cart rescue (template)", "popup", "Cart page · 30s"],
    ["Novatec · Product interest capture (template)", "popup", "Product pages"],
    ["Novatec · Launch waitlist (template)", "embedded", "Landing pages"],
    ["Novatec · Discount signup (template)", "popup", "Time on page · 8s"],
    ["Novatec · Exit intent (template)", "exit_intent", "Exit intent · all pages"],
  ];
  for (const [name, type, trigger] of wanted) {
    const exists = await db.form.findFirst({ where: { workspaceId, name } });
    if (!exists) {
      await db.form.create({ data: { workspaceId, name, type, trigger, status: "draft", isDemo: true } });
    }
  }
}

if (process.argv[1]?.includes("seed-clean.ts")) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => db.$disconnect());
}
