// The consent system, end to end, against the real dev database.
// Run: npx tsx scripts/test-consent.ts
//
// Walks the whole story: a form submission granting per-channel consent, the
// mirror agreeing with the ledger, campaign gating counting it, bulk review
// updating hundreds at once, unsubscribe standing against a later grant, Do
// Not Contact beating everything, and the import path honouring explicit
// refusals. Throwaway records, stamped so reruns never collide.

import { db } from "../lib/server/db";
import {
  recordConsent,
  setDoNotContact,
  eligibleForChannel,
  breakdownFor,
} from "../lib/server/consent";
import { resolveAudience, audienceBreakdown } from "../lib/server/sending";
import { createBatchFromCsv, reviewBatch, confirmBatch } from "../lib/server/imports";
import { eventIngestionService } from "../lib/server/events";

let passed = 0;
let failed = 0;
function check(name: string, condition: boolean, detail?: string) {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
}

const STAMP = `c${Math.abs(Date.now() % 1_000_000)}`;

async function main() {
  const ws = await db.workspace.findFirstOrThrow();

  // ------------------------------------------------ 1 · the one door
  console.log("\n1 · recordConsent appends, mirrors, narrates");
  const alice = await db.contact.create({
    data: { workspaceId: ws.id, email: `alice.${STAMP}@example.com`, phone: "+447700900001", firstName: "Alice" },
  });
  await recordConsent({
    contactId: alice.id, workspaceId: ws.id,
    changes: [
      { channel: "email", status: "granted" },
      { channel: "sms", status: "granted" },
      { channel: "whatsapp", status: "declined" },
    ],
    source: "Website form: test", actor: "test", evidence: "test wording v1",
  });
  let a = await db.contact.findUniqueOrThrow({ where: { id: alice.id } });
  check("mirror: email granted", a.emailConsent === "granted");
  check("mirror: sms granted", a.smsConsent === "granted");
  check("mirror: whatsapp declined", a.whatsappConsent === "declined");
  const ledger = await db.consentRecord.findMany({ where: { contactId: alice.id } });
  check("ledger holds three rows", ledger.length === 3);
  const tl = await db.timelineItem.findMany({ where: { contactId: alice.id, type: "consent" } });
  check("timeline narrates the change", tl.length === 1 && tl[0].title.includes("Email"));

  // ------------------------------------------------ 2 · opt-out stands
  console.log("\n2 · an opt-out beats a later machine grant");
  await recordConsent({
    contactId: alice.id, workspaceId: ws.id,
    changes: [{ channel: "email", status: "withdrawn" }],
    source: "Unsubscribe link", actor: "customer", allowReactivate: true,
  });
  const blocked = await recordConsent({
    contactId: alice.id, workspaceId: ws.id,
    changes: [{ channel: "email", status: "granted" }],
    source: "Website form: test again", actor: "tracker",
  });
  a = await db.contact.findUniqueOrThrow({ where: { id: alice.id } });
  check("machine grant held", blocked.held.includes("email"));
  check("mirror still withdrawn", a.emailConsent === "withdrawn");
  const human = await recordConsent({
    contactId: alice.id, workspaceId: ws.id,
    changes: [{ channel: "email", status: "granted" }],
    source: "Profile change by test@sendloom", actor: "test@sendloom",
    allowReactivate: true,
  });
  a = await db.contact.findUniqueOrThrow({ where: { id: alice.id } });
  check("deliberate human change reactivates", human.applied.length === 1 && a.emailConsent === "granted");

  // ------------------------------------------------ 3 · channel gating
  console.log("\n3 · eligibility is per channel");
  check("email eligible", eligibleForChannel(a, "email").eligible);
  check("sms eligible", eligibleForChannel(a, "sms").eligible);
  check("whatsapp blocked (declined)", eligibleForChannel(a, "whatsapp").reason === "opted_out");
  const noPhone = { ...a, phone: null };
  check("sms needs a number", eligibleForChannel(noPhone, "sms").reason === "no_route");

  // ------------------------------------------------ 4 · DNC beats all
  console.log("\n4 · Do Not Contact blocks every channel");
  await setDoNotContact({ contactId: alice.id, workspaceId: ws.id, value: true, actor: "test", source: "test" });
  a = await db.contact.findUniqueOrThrow({ where: { id: alice.id } });
  check("email blocked by DNC", eligibleForChannel(a, "email").reason === "do_not_contact");
  check("channel states untouched", a.emailConsent === "granted" && a.smsConsent === "granted");
  await setDoNotContact({ contactId: alice.id, workspaceId: ws.id, value: false, actor: "test", source: "test" });
  a = await db.contact.findUniqueOrThrow({ where: { id: alice.id } });
  check("removing DNC reveals prior state", eligibleForChannel(a, "email").eligible);

  // ------------------------------------------------ 5 · popup ingestion
  console.log("\n5 · a form submission writes per-channel consent on its own");
  const popEmail = `popup.${STAMP}@example.com`;
  await eventIngestionService.process({
    workspaceId: ws.id, type: "popup_submitted", email: popEmail,
    payload: { popup: "test-popup", consent: true, consentSms: true, consentWhatsapp: false, source: "tracker" },
  });
  const pop = await db.contact.findUnique({ where: { workspaceId_email: { workspaceId: ws.id, email: popEmail } } });
  check("contact created", !!pop);
  check("email granted automatically", pop?.emailConsent === "granted");
  check("sms granted automatically", pop?.smsConsent === "granted");
  check("whatsapp declined automatically", pop?.whatsappConsent === "declined");
  check("source recorded", (pop?.consentSource ?? "").includes("test-popup"));

  // ------------------------------------------------ 6 · campaign maths
  console.log("\n6 · audience arithmetic matches the gate");
  const contacts = await db.contact.findMany({
    where: { workspaceId: ws.id },
    select: { email: true, phone: true, emailConsent: true, smsConsent: true, whatsappConsent: true, doNotContact: true },
  });
  const supp = new Set((await db.suppressionRecord.findMany({ where: { workspaceId: ws.id } })).map((s) => s.email.toLowerCase()));
  const bd = breakdownFor(contacts, "email", supp);
  check("breakdown sums to total", bd.eligible + bd.noConsent + bd.optedOut + bd.suppressed + bd.noRoute + bd.doNotContact === bd.total);
  const resolved = await resolveAudience(ws.id, null, null, "email");
  check("resolveAudience agrees with breakdown", resolved.eligible.length === bd.eligible,
    `${resolved.eligible.length} vs ${bd.eligible}`);
  const bdApi = await audienceBreakdown(ws.id, null, null, "email");
  check("audienceBreakdown agrees too", bdApi.eligible === bd.eligible);
  const bdSms = await audienceBreakdown(ws.id, null, null, "sms");
  check("sms audience is its own arithmetic", bdSms.total === bd.total && bdSms.eligible <= bd.total);

  // ------------------------------------------------ 7 · import refusals
  console.log("\n7 · imports honour explicit refusals per channel");
  const csv = [
    "email,first_name,phone,email_consent,sms_consent,whatsapp_consent",
    `imp.yes.${STAMP}@example.com,Yes,+447700900100,yes,yes,no`,
    `imp.no.${STAMP}@example.com,No,+447700900101,no,,`,
  ].join("\n");
  const batch = await createBatchFromCsv({
    workspaceId: ws.id, name: `Consent test ${STAMP}`, csv,
    sourceType: "import", source: "test", uploadedBy: "test",
  });
  await reviewBatch(batch.batchId, batch.mapping);
  await confirmBatch({
    batchId: batch.batchId, duplicateStrategy: "skip", tags: [],
    lawfulBasis: "Consent (import)", createSegment: false, actor: "test",
  });
  const yes = await db.contact.findUnique({ where: { workspaceId_email: { workspaceId: ws.id, email: `imp.yes.${STAMP}@example.com` } } });
  const no = await db.contact.findUnique({ where: { workspaceId_email: { workspaceId: ws.id, email: `imp.no.${STAMP}@example.com` } } });
  check("import grants email+sms", yes?.emailConsent === "granted" && yes?.smsConsent === "granted");
  check("import records whatsapp refusal", yes?.whatsappConsent === "declined");
  check("explicit email no is a decline, not a blank", no?.emailConsent === "declined");

  // ------------------------------------------------ done
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
