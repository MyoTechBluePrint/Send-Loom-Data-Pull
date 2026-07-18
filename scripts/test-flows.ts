// End-to-end flow tests against the real services and database.
// Run: npm run test:flows  (uses the current DATABASE_URL; safe to run on the
// seeded dev database — it creates its own throwaway records).
import { db } from "../lib/server/db";
import { createBatchFromCsv, reviewBatch, confirmBatch, detectMapping } from "../lib/server/imports";
import { eventIngestionService } from "../lib/server/events";
import { recomputeLeadScore } from "../lib/server/scoring";
import { evaluateSegment } from "../lib/server/segments";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

const STAMP = `t${Math.abs(Date.now() % 1_000_000)}`;

async function main() {
  const ws = await db.workspace.findFirstOrThrow();

  console.log("Field mapping detection");
  const mapping = detectMapping(["email_address", "fname", "surname", "mobile", "gdpr_optin", "weird_column"]);
  check("detects email/first/last/phone/consent", mapping["email_address"] === "email" && mapping["fname"] === "firstName" && mapping["surname"] === "lastName" && mapping["mobile"] === "phone" && mapping["gdpr_optin"] === "consent");
  check("unknown columns become custom fields", mapping["weird_column"] === "custom");

  console.log("Import pipeline");
  const csv = [
    "email,first_name,gdpr_optin",
    `alice.${STAMP}@example.com,Alice,TRUE`,
    `alice.${STAMP}@example.com,Alice,TRUE`, // in-file duplicate
    `bob.${STAMP}@tempmail.io,Bob,TRUE`, // disposable
    "not-an-email,Nope,TRUE", // invalid
    `carol.${STAMP}@example.com,Carol,`, // no consent
  ].join("\n");

  const batch = await createBatchFromCsv({
    workspaceId: ws.id, name: `Test batch ${STAMP}`, source: "test", sourceType: "import",
    uploadedBy: "test-script", csv,
  });
  check("batch created with 5 rows", batch.totalRows === 5);

  const review = await reviewBatch(batch.batchId, batch.mapping);
  check("1 ready row", review.counts.ready === 1, JSON.stringify(review.counts));
  check("1 in-file duplicate", review.counts.duplicate === 1);
  check("1 blocked (disposable)", review.counts.blocked === 1);
  check("1 invalid email", review.counts.invalid === 1);
  check("1 held for consent review", review.counts.needsReview === 1);

  const confirm = await confirmBatch({
    batchId: batch.batchId, duplicateStrategy: "merge_newest",
    tags: [`test-${STAMP}`], lawfulBasis: "Test", createSegment: true, actor: "test-script",
  });
  check("2 contacts imported (alice + carol)", confirm.imported === 2, JSON.stringify(confirm));
  check("1 merged (in-file duplicate)", confirm.merged === 1);
  check("segment created from batch", confirm.segmentId !== null);

  const alice = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: ws.id, email: `alice.${STAMP}@example.com` } },
    include: { sources: true, consents: true },
  });
  check("source ledger row written", (alice?.sources.length ?? 0) >= 1);
  check("consent ledger row written (granted)", alice?.consents.some((c) => c.channel === "email" && c.status === "granted") ?? false);

  const carol = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: ws.id, email: `carol.${STAMP}@example.com` } },
    include: { consents: true },
  });
  check("no-consent row held as pending, not granted", carol?.consents.every((c) => c.channel !== "email" || c.status === "pending") ?? false);

  console.log("Suppression safety");
  await db.suppressionRecord.create({ data: { workspaceId: ws.id, email: `dave.${STAMP}@example.com`, reason: "unsubscribed" } });
  const batch2 = await createBatchFromCsv({
    workspaceId: ws.id, name: `Test suppression ${STAMP}`, source: "test", sourceType: "import",
    uploadedBy: "test-script", csv: `email,gdpr_optin\ndave.${STAMP}@example.com,TRUE`,
  });
  const review2 = await reviewBatch(batch2.batchId, batch2.mapping);
  check("suppressed contact blocked on re-upload", review2.counts.blocked === 1);

  console.log("Event ingestion + scoring");
  const before = await db.event.count({ where: { workspaceId: ws.id } });
  await eventIngestionService.process({
    workspaceId: ws.id, type: "product_viewed", email: `alice.${STAMP}@example.com`,
    payload: { productTitle: "NAD+ Cellular Complex" },
  });
  await eventIngestionService.process({
    workspaceId: ws.id, type: "checkout_started", email: `alice.${STAMP}@example.com`,
    payload: { total: 68, itemCount: 1 },
  });
  const after = await db.event.count({ where: { workspaceId: ws.id } });
  check("events stored", after === before + 2);

  const tl = await db.timelineItem.count({ where: { contactId: alice!.id } });
  check("timeline items created", tl >= 2);

  const score = await recomputeLeadScore(alice!.id);
  check("score reflects view + checkout (50)", score.score === 50, `got ${score.score}`);
  check("reasons are transparent", score.reasons.length >= 2);
  check("status is hot at 50", score.status === "hot", score.status);

  console.log("Anonymous events stay aggregate");
  const contactsBefore = await db.contact.count({ where: { workspaceId: ws.id } });
  await eventIngestionService.process({
    workspaceId: ws.id, type: "search", anonymousId: "anon-test-1",
    payload: { term: `test term ${STAMP}`, resultCount: 0 },
  });
  const contactsAfter = await db.contact.count({ where: { workspaceId: ws.id } });
  check("anonymous search creates no contact", contactsAfter === contactsBefore);
  const signal = await db.demandSignal.findFirst({ where: { workspaceId: ws.id, term: `test term ${STAMP}` } });
  check("anonymous search recorded as demand signal", signal !== null && signal.note?.includes("missed") === true);

  console.log("Segment engine");
  const seg = await evaluateSegment(ws.id, "all", [
    { field: "Tag", operator: "is", value: `test-${STAMP}` },
  ]);
  check("segment finds tagged imports", seg.count === 2, `got ${seg.count}`); // alice + carol (duplicate merges into alice)
  const segExcl = await evaluateSegment(ws.id, "all", [
    { field: "Tag", operator: "is", value: `test-${STAMP}` },
    { field: "Lead score", operator: "is at least", value: "50", exclude: true },
  ]);
  check("exclusion rules subtract", segExcl.count < seg.count, `${segExcl.count} vs ${seg.count}`);

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
