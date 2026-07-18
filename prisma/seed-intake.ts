// Seeds the Universal Inbox demo story. Safe to run repeatedly: skips if any
// intake exists. Used by the main seed AND as a top-up for already-seeded
// deployed databases (Render) that predate the inbox feature.
import { createIntakeFromText, approveRecord } from "../lib/server/extract";
import { db } from "../lib/server/db";

export async function seedIntake(workspaceId: string) {
  // Idempotency: the Maria WhatsApp forward is the story's marker.
  const existing = await db.intakeItem.findFirst({
    where: { workspaceId, raw: { contains: "Maria +34 600 123 456" } },
  });
  if (existing) {
    console.log("Inbox story already seeded. Skipping.");
    return;
  }
  console.log("Seeding Universal Inbox story…");

  // 1. Pending WhatsApp forward, two messy leads (the demo's showpiece).
  await createIntakeFromText({
    workspaceId, kind: "whatsapp", actor: "hannah@vitaliswellness.co.uk",
    text: "Maria +34 600 123 456 asked about NAD+ and weight loss consultation. Call tomorrow.\n\nBen said his colleague Priya Nair priya.nair@yahoo.co.uk wants the collagen restock date.",
  });

  // 2. Email forward, approved end-to-end so the story shows a completed loop.
  const enquiry = await createIntakeFromText({
    workspaceId, kind: "email", actor: "steve@vitaliswellness.co.uk",
    text: "Laura Fenwick laura.fenwick@gmail.com enquired via the clinic page about a longevity consultation and NAD+. Book her a call this week.",
  });
  for (const record of enquiry.records) {
    await approveRecord(record.id, "steve@vitaliswellness.co.uk");
  }

  // 3. Pending front-desk note, phone only.
  await createIntakeFromText({
    workspaceId, kind: "note", actor: "hannah@vitaliswellness.co.uk",
    text: "Walk-in: Dominic 07911 552 001, wants magnesium and sleep advice, no email given.",
  });

  console.log("Inbox story seeded.");
}
