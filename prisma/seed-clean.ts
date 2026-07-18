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
    data: { workspaceId: ws.id, email: "ads@frenziapp.com", name: "Ads team (placeholder)", role: "operator" },
  });

  // The two real stores. Pending until the plugin connects.
  const { randomBytes } = await import("node:crypto");
  for (const d of [
    { name: "MyoTech", url: "myotechlabs.co.uk" },
    { name: "Novatec", url: "novateclabs.co.uk" },
  ]) {
    await db.store.create({
      data: {
        workspaceId: ws.id, name: d.name, url: d.url,
        apiKey: `slm_live_${d.name.toLowerCase()}_${randomBytes(8).toString("hex")}`,
        environment: "staging", status: "pending", domains: d.url,
      },
    });
  }

  // Campaign TEMPLATES — drafts only, zero stats, clearly labelled.
  const campaignTemplates = [
    ["Welcome popup subscriber", "Welcome — here's your code"],
    ["Abandoned cart recovery", "You left something behind"],
    ["Abandoned checkout recovery", "Your order is one click away"],
    ["Product education sequence", "What it actually does"],
    ["First purchase thank-you", "Thank you — what happens next"],
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
    ["Discount signup (template)", "popup", "Time on page · 8s"],
    ["Consultation request (template)", "popup", "Product pages"],
    ["Exit intent offer (template)", "exit_intent", "Exit intent · cart page"],
    ["Cart rescue (template)", "popup", "Cart page · 30s"],
    ["Product education (template)", "slide_in", "Category pages"],
    ["Newsletter / waitlist (template)", "embedded", "Site footer"],
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

if (process.argv[1]?.includes("seed-clean.ts")) {
  main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => db.$disconnect());
}
