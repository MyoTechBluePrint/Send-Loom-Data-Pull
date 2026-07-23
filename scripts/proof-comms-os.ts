// Communications OS proof: a structured platform event becomes a Customer
// Intelligence Profile (contact + consent + tags + attributes + timeline +
// score) and a running lifecycle journey with honest per-channel outcomes.
// Time-travel drives the delayed steps. Run: npx tsx scripts/proof-comms-os.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { db } from "../lib/server/db";
import { ingestIntelligenceEvent, processDueJourneySteps } from "../lib/server/intelligence";

let passed = 0, failed = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

async function main() {
  const ws = await db.workspace.findFirst();
  if (!ws) { console.error("No workspace in dev db"); process.exit(1); }
  const stamp = Date.now() % 1_000_000;
  const email = `comms-proof-${stamp}@test.example`;

  console.log("1 · A wealth application becomes a profile and a journey");
  const r1 = await ingestIntelligenceEvent(ws.id, {
    eventType: "wealth.application_submitted", platform: "nito",
    person: { email, name: "Comms Proof", country: "Spain" },
    consent: { channel: "email", basis: "Private Wealth application consent" },
    tags: [`nito:proof-${stamp}`, "nito:income-100-250"],
    attributes: { lifecycle: "eligible_for_consultation", incomeBand: "100-250", refCode: "PW-PROOF" },
    data: { refCode: "PW-PROOF", checklist: ["Latest filed accounts", "Recent payslips"] },
  });
  const contact = await db.contact.findFirst({ where: { workspaceId: ws.id, email }, include: { consents: true, tags: { include: { tag: true } }, timeline: { orderBy: { occurredAt: "asc" } } } });
  check("contact created with identity", Boolean(contact) && contact!.firstName === "Comms" && contact!.country === "Spain");
  check("consent recorded before any channel is used", contact!.consents.some((c) => c.channel === "email" && c.status === "granted" && c.lawfulBasis === "Private Wealth application consent"));
  check("qualification answers became tags", contact!.tags.some((t) => t.tag.name === "nito:income-100-250"));
  const intel = (JSON.parse(contact!.customFields ?? "{}") as { intel?: { nito?: Record<string, unknown> } }).intel?.nito;
  check("intelligence profile carries per-platform attributes", intel?.incomeBand === "100-250" && intel?.lifecycle === "eligible_for_consultation");
  check("enrolled in the intake journey", r1.enrolled.includes("private-wealth-intake"));
  check("timeline records the application", contact!.timeline.some((t) => t.type === "wealth.application_submitted"));
  const step0 = contact!.timeline.find((t) => t.type === "journey_email");
  check("step 0 personalised email executed immediately with honest outcome", Boolean(step0) && /dev-log \(no real delivery\)|sent via/.test(step0!.detail ?? ""));

  console.log("2 · Delayed steps fire on schedule with honest channel outcomes");
  const en = await db.journeyEnrolment.findFirst({ where: { contactId: contact!.id, journey: { key: "private-wealth-intake" } } });
  check("next step scheduled ~48h out", Boolean(en?.nextDueAt) && Math.abs(en!.nextDueAt!.getTime() - (Date.now() + 48 * 3600_000)) < 5 * 60_000);
  await processDueJourneySteps(ws.id, new Date(Date.now() + 49 * 3600_000));
  const afterSms = await db.timelineItem.findFirst({ where: { contactId: contact!.id, type: "journey_sms" } });
  check("48h SMS step honestly simulated (no provider configured)", Boolean(afterSms) && (afterSms!.detail ?? "").includes("simulated (sms provider not configured)"));
  await processDueJourneySteps(ws.id, new Date(Date.now() + 121 * 3600_000));
  const done = await db.journeyEnrolment.findFirst({ where: { contactId: contact!.id, journey: { key: "private-wealth-intake" } } });
  check("journey completes after the final step", done?.status === "completed");

  console.log("3 · Meeting steps schedule from the SLOT, not the enrolment");
  const slot = new Date(Date.now() + 3 * 24 * 3600_000);
  await ingestIntelligenceEvent(ws.id, {
    eventType: "wealth.consultation_booked", platform: "nito",
    person: { email, name: "Comms Proof" },
    data: { refCode: "PW-PROOF", slot: slot.toISOString(), checklist: ["Your goals in your own words"] },
  });
  const meet = await db.journeyEnrolment.findFirst({ where: { contactId: contact!.id, journey: { key: "private-wealth-meeting" } } });
  check("confirmation sent, next reminder due 24h before the slot", meet?.stepIndex === 1 && Boolean(meet?.nextDueAt) && Math.abs(meet!.nextDueAt!.getTime() - (slot.getTime() - 24 * 3600_000)) < 5 * 60_000);
  await processDueJourneySteps(ws.id, new Date(slot.getTime() - 23 * 3600_000));
  const reminders = await db.timelineItem.count({ where: { contactId: contact!.id, title: { contains: "24h reminder" } } });
  check("slot-relative reminder executed at slot minus 24h", reminders === 1);

  console.log("4 · The brokerage pathway enrols its own journeys");
  const r4 = await ingestIntelligenceEvent(ws.id, {
    eventType: "brokerage.application_submitted", platform: "nito",
    person: { email, name: "Comms Proof" },
    consent: { channel: "email", basis: "Brokerage application consent" },
    tags: ["nito:readiness-full_service"],
    attributes: { lifecycle: "suitable", readinessOutcome: "full_service" },
    data: { refCode: "BB-PROOF" },
  });
  check("brokerage intake journey enrolled on the same profile", r4.enrolled.includes("brokerage-intake") && r4.contactId === contact!.id);
  const kinds = await db.timelineItem.count({ where: { contactId: contact!.id } });
  check("one CRM timeline holds every event and message", kinds >= 8);

  // Cleanup: proof residue only. Score recomputation can attach tasks and
  // score logs, so clear every referencing table before the contact.
  await db.journeyEnrolment.deleteMany({ where: { contactId: contact!.id } });
  await db.timelineItem.deleteMany({ where: { contactId: contact!.id } });
  await db.consentRecord.deleteMany({ where: { contactId: contact!.id } });
  await db.contactTag.deleteMany({ where: { contactId: contact!.id } });
  await db.contactSource.deleteMany({ where: { contactId: contact!.id } });
  for (const model of ["event", "salesTask", "campaignSend", "automationRun", "cart", "order", "importRow", "leadScoreLog", "scoreSnapshot"] as const) {
    const table = (db as unknown as Record<string, { deleteMany?: (a: { where: { contactId: string } }) => Promise<unknown> }>)[model];
    if (table?.deleteMany) await table.deleteMany({ where: { contactId: contact!.id } }).catch(() => undefined);
  }
  await db.contact.delete({ where: { id: contact!.id } }).catch(() => {
    console.log("  (contact retained: residual references; proof data only)");
  });

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
