// Top-up seed for the data-movement sprint: simulated Savvy Mango vault,
// demo contact packs, sample export history, and the free-API provider slots.
// Idempotent: marker is the simulated Savvy project.
import { db } from "../lib/server/db";

export async function seedGrowth(workspaceId: string) {
  const existing = await db.importProject.findFirst({
    where: { workspaceId, simulated: true, name: { contains: "Savvy Mango" } },
  });
  if (existing) {
    console.log("Growth demo already seeded. Skipping.");
    return;
  }
  console.log("Seeding growth demo (Savvy vault, packs, export history, providers)…");

  // Simulated Savvy Mango import project. Aggregates only — no real rows.
  const project = await db.importProject.create({
    data: {
      workspaceId, name: "Savvy Mango export · SIMULATED", uploadedBy: "steve@vitaliswellness.co.uk",
      simulated: true,
      notes: "Aggregate simulation for the vault dashboard. No real Savvy Mango records exist in this database. Real import requires the lawful-basis review in STAGING.md.",
    },
  });
  await db.importBatch.create({
    data: {
      workspaceId, projectId: project.id, classification: "savvy_mango",
      name: "savvy-contacts-export.csv (simulated)", source: "Savvy Mango · sister company",
      sourceType: "savvy_mango", format: "csv", uploadedBy: "steve@vitaliswellness.co.uk",
      status: "needs_review",
      totalRows: 100_000, readyRows: 73_412, duplicateRows: 11_860,
      blockedRows: 4_900, missingConsentRows: 8_321, invalidRows: 1_507,
    },
  });

  // Demo packs: one simulated (Savvy), two real from existing contacts.
  await db.contactPack.create({
    data: {
      workspaceId, name: "Savvy Mango · high-score prospects (SIMULATED)",
      source: "Savvy Mango vault", contactIds: "[]",
      total: 100_000, eligible: 18_400, withEmail: 12_150, withPhone: 15_900,
      excludedSuppressed: 4_900, excludedUnsubscribed: 2_140, excludedNoRoute: 8_321,
      duplicatesRemoved: 11_860, simulated: true,
      suggestedUse: "Phone-first outreach after enrichment · requires real import + lawful-basis review",
      createdBy: "steve@vitaliswellness.co.uk",
    },
  });

  const realContacts = await db.contact.findMany({
    where: { workspaceId }, select: { id: true },
    orderBy: { lastActivityAt: "desc" }, take: 10,
  });
  if (realContacts.length > 0) {
    const { buildPack } = await import("../lib/server/packs");
    await buildPack({
      workspaceId, name: "Hot leads for Will", source: "Audience: Hot leads (score 70+)",
      contactIds: realContacts.map((c) => c.id), createdBy: "steve@vitaliswellness.co.uk",
      suggestedUse: "Will's daily call sheet",
    });
  }

  // Sample export history so the log isn't empty on first view.
  const sampleExports = [
    { format: "call_sheet", contacts: 6, source: "Open sales tasks", user: "talk@willwoolley.co.uk" },
    { format: "emails", contacts: 9, source: "Audience: VIP customers", user: "steve@vitaliswellness.co.uk" },
    { format: "csv", contacts: 12, source: "Import: Webinar attendees · July", user: "steve@vitaliswellness.co.uk" },
  ];
  for (const e of sampleExports) {
    await db.exportLog.create({
      data: { workspaceId, user: e.user, dataType: "pack", source: e.source, format: e.format, contacts: e.contacts, notes: "seeded example" },
    });
  }

  // Free/low-cost provider slots for the Provider Centre.
  const providerDefs: [string, string, string][] = [
    ["Companies House", "company_data", "Free UK company/officer/PSC lookup · public register data, not a contact finder"],
    ["GOV.UK Content API", "company_data", "Free regulation and policy-change monitoring"],
    ["Postcodes.io", "location", "Free UK postcode enrichment · region grouping and validation"],
    ["Google Analytics Data API", "search_data", "Traffic, conversions and attribution · free"],
    ["Hunter (free plan)", "enrichment", "Small-scale email finding/verification · 25 searches/mo free"],
    ["YouTube Data API", "search_data", "Content demand and competitor topic research · free quota"],
    ["Reddit API", "search_data", "Public discussion trends, questions and objections · respect platform terms"],
    ["People Data Labs (test)", "enrichment", "Workflow testing only · not for production contact data at free tier"],
  ];
  for (const [name, type, note] of providerDefs) {
    const exists = await db.dataProvider.findFirst({ where: { workspaceId, name } });
    if (!exists) {
      await db.dataProvider.create({ data: { workspaceId, name, type, status: "not_connected", note } });
    }
  }

  console.log("Growth demo seeded.");
}
