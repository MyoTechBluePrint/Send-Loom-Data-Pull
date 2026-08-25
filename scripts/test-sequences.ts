// The five sequence acceptance scenarios, run against the real engine and the
// real database. Run: npx tsx scripts/test-sequences.ts
//
// Waits are simulated honestly: a parked run's nextDueAt is moved into the
// past with a direct db update and advanceDueRuns() is called, which is
// exactly what the cron beat after the wait would do. Nothing here sleeps,
// and nothing here fakes the walk: every send row, diary line and stop
// reason is produced by the same code paths production runs.
//
// Every record is stamped and throwaway; cleanup at the end removes them so
// the suite can run back to back without seeing its own leftovers.

import { db } from "../lib/server/db";
import { enrolOnEvent, advanceDueRuns, ensureShadowCampaigns } from "../lib/server/automations";
import { issueCoupon, recordRedemption } from "../lib/server/promotions";
import { renderForRecipient } from "../lib/server/email-render";

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` (${detail})` : ""}`); }
};

// The guard both real sequence recipes use: no purchase since entry, and no
// other workflow entered, both required.
const GUARD = {
  match: "all",
  conditions: [
    { type: "not_purchased_since_entry" },
    { type: "not_entered_other_workflow" },
  ],
};

const STAMP = `sq${Date.now().toString(36)}${Math.floor(Math.random() * 10_000)}`;
const automationIds: string[] = [];
const contactIds: string[] = [];
let storeId: string | null = null;
let createdWorkspaceId: string | null = null;

type BuiltNode = { id: string; kind: string; label: string };

/** trigger -> email1, then (delay -> condition -> email) repeated: the exact
 *  shape the spec's scenarios describe, parameterised by email count. */
async function buildSequence(ws: string, name: string, trig: string, emails: number) {
  const auto = await db.automation.create({
    data: { workspaceId: ws, name, trigger: "Test sequence", triggerEvent: trig, status: "live" },
  });
  automationIds.push(auto.id);
  let position = 0;
  const nodes: BuiltNode[] = [];
  const add = async (kind: string, label: string, config?: object) => {
    const n = await db.automationNode.create({
      data: {
        automationId: auto.id, kind, label, position: position++,
        config: config ? JSON.stringify(config) : null,
      },
    });
    nodes.push({ id: n.id, kind, label });
  };
  await add("trigger", "Trigger");
  await add("email", "Email 1", { subject: `${name} 1`, html: "<p>One</p>" });
  for (let i = 2; i <= emails; i++) {
    await add("delay", `Wait ${i - 1}`, { minutes: 30 });
    await add("condition", `Check ${i - 1}`, GUARD);
    await add("email", `Email ${i}`, { subject: `${name} ${i}`, html: `<p>${i}</p>` });
  }
  // What the save API does on every PUT before a workflow can go live: each
  // email step gets its shadow campaign up front. The never-twice guard is
  // unique(campaignId, contactId), which can only guard once the campaign
  // exists; a workflow whose campaigns are minted lazily at first delivery
  // is not a state the save path ever ships.
  await ensureShadowCampaigns(auto.id);
  return { auto, nodes };
}

/** A fresh consented contact walked in through the real enrolment path. */
async function enrol(ws: string, trig: string, automationId: string, email: string) {
  const contact = await db.contact.create({
    data: { workspaceId: ws, email, emailConsent: "granted" },
  });
  contactIds.push(contact.id);
  await enrolOnEvent(ws, trig, contact.id);
  const run = await db.automationRun.findFirstOrThrow({
    where: { automationId, contactId: contact.id },
  });
  return { contact, run };
}

/**
 * The honest wait simulation. Forces the run due and runs the same sweep the
 * ticker runs; the small retry loop exists because advanceDueRuns pages 200
 * due runs at a time and a busy dev database could push this run off a page.
 */
async function tickAfterWait(runId: string) {
  for (let i = 0; i < 5; i++) {
    const before = await db.automationRun.findUniqueOrThrow({ where: { id: runId } });
    if (before.status !== "running") return before;
    await db.automationRun.update({
      where: { id: runId },
      data: { nextDueAt: new Date(Date.now() - 1000) },
    });
    await advanceDueRuns();
    const after = await db.automationRun.findUniqueOrThrow({ where: { id: runId } });
    const stillDue =
      after.status === "running" &&
      after.nextDueAt !== null &&
      after.nextDueAt.getTime() <= Date.now();
    if (!stillDue) return after;
  }
  return db.automationRun.findUniqueOrThrow({ where: { id: runId } });
}

const sendsFor = (automationId: string, contactId: string) =>
  db.campaignSend.findMany({
    where: { contactId, campaign: { audienceType: "automation", audienceRef: automationId } },
    orderBy: { createdAt: "asc" },
  });

const diary = (runId: string) =>
  db.automationRunEvent.findMany({ where: { runId }, orderBy: [{ at: "asc" }, { id: "asc" }] });

/** The shadow campaign a node's sends live under, once one exists. */
async function nodeCampaignId(nodeId: string): Promise<string | null> {
  const node = await db.automationNode.findUniqueOrThrow({ where: { id: nodeId } });
  try {
    const config = JSON.parse(node.config ?? "{}") as { campaignId?: string };
    return typeof config.campaignId === "string" ? config.campaignId : null;
  } catch {
    return null;
  }
}

// Dev transport writes "simulated"; a live provider writes "sent". Both mean
// the delivery path ran to the end; the suite accepts either, like the
// welcome suite does.
const delivered = (status?: string) => status === "sent" || status === "simulated";

async function cleanup() {
  try {
    const runs = await db.automationRun.findMany({
      where: { automationId: { in: automationIds } },
      select: { id: true },
    });
    const runIds = runs.map((r) => r.id);
    await db.automationRunEvent.deleteMany({ where: { runId: { in: runIds } } });
    await db.automationRun.deleteMany({ where: { id: { in: runIds } } });
    await db.campaignSend.deleteMany({
      where: { campaign: { audienceType: "automation", audienceRef: { in: automationIds } } },
    });
    await db.campaign.deleteMany({
      where: { audienceType: "automation", audienceRef: { in: automationIds } },
    });
    await db.automationNode.deleteMany({ where: { automationId: { in: automationIds } } });
    await db.automation.deleteMany({ where: { id: { in: automationIds } } });
    if (storeId) {
      await db.order.deleteMany({ where: { storeId } });
      await db.store.delete({ where: { id: storeId } });
    }
    await db.timelineItem.deleteMany({ where: { contactId: { in: contactIds } } });
    await db.contact.deleteMany({ where: { id: { in: contactIds } } });
    if (createdWorkspaceId) await db.workspace.delete({ where: { id: createdWorkspaceId } });
  } catch (error) {
    // Leftovers are stamped and inert; a cleanup hiccup must not turn a
    // passing suite into a failing one.
    console.error("  (cleanup incomplete)", error);
  }
}

async function main() {
  const existingWs = await db.workspace.findFirst({ select: { id: true } });
  const ws = existingWs?.id ?? (await db.workspace.create({ data: { name: `Seq suite ${STAMP}` } })).id;
  if (!existingWs) createdWorkspaceId = ws;

  console.log("\nA · no purchase: the condition holds and the follow-up sends");
  const seqA = await buildSequence(ws, `Seq A ${STAMP}`, `seqa_${STAMP}`, 2);
  const a = await enrol(ws, `seqa_${STAMP}`, seqA.auto.id, `seq.a.${STAMP}@example.com`);
  const aParked = await db.automationRun.findUniqueOrThrow({ where: { id: a.run.id } });
  const aFirst = await sendsFor(seqA.auto.id, a.contact.id);
  check("email 1 send row exists after enrolment", aFirst.length === 1, String(aFirst.length));
  check("email 1 handed to the transport", delivered(aFirst[0]?.status), aFirst[0]?.status);
  check("run parks on the wait", aParked.status === "running" && aParked.nextDueAt !== null, aParked.status);
  check(
    "wait parks roughly 30 minutes out",
    (aParked.nextDueAt?.getTime() ?? 0) - Date.now() > 29 * 60_000 &&
      (aParked.nextDueAt?.getTime() ?? 0) - Date.now() < 31 * 60_000,
  );
  const aParkedEvents = await diary(a.run.id);
  check("diary shows the waiting event", aParkedEvents.some((e) => e.kind === "waiting"));
  check(
    "waiting detail carries the due moment",
    aParkedEvents.some((e) => e.kind === "waiting" && (e.detail ?? "").startsWith("until ")),
  );

  const aAfter = await tickAfterWait(a.run.id);
  check("forced-due tick completes the run", aAfter.status === "completed", aAfter.status);
  const aSends = await sendsFor(seqA.auto.id, a.contact.id);
  check("email 2 send row exists after the condition passes", aSends.length === 2, String(aSends.length));
  check("email 2 handed to the transport", delivered(aSends[1]?.status), aSends[1]?.status);
  const aEvents = await diary(a.run.id);
  check(
    "diary reads started, email_sent, waiting, conditions_passed, email_sent, completed",
    aEvents.map((e) => e.kind).join(",") ===
      "started,email_sent,waiting,conditions_passed,email_sent,completed",
    aEvents.map((e) => e.kind).join(","),
  );
  check(
    "conditions_passed names both checks",
    aEvents.some(
      (e) =>
        e.kind === "conditions_passed" &&
        (e.detail ?? "").includes("not_purchased_since_entry") &&
        (e.detail ?? "").includes("not_entered_other_workflow"),
    ),
  );

  console.log("\nB · a purchase during the wait stops the sequence");
  const store = await db.store.create({
    data: {
      workspaceId: ws, name: `Seq store ${STAMP}`,
      url: `https://seq-${STAMP}.example.com`, apiKey: `seqkey_${STAMP}`,
    },
  });
  storeId = store.id;
  const b = await enrol(ws, `seqa_${STAMP}`, seqA.auto.id, `seq.b.${STAMP}@example.com`);
  // placedAt a second ahead so it is unambiguously after run.startedAt even
  // on a same-millisecond clock.
  await db.order.create({
    data: {
      storeId: store.id, contactId: b.contact.id, externalId: `seq-o-${STAMP}`,
      number: `#${STAMP}`, status: "completed", total: 49, placedAt: new Date(Date.now() + 1000),
    },
  });
  const bAfter = await tickAfterWait(b.run.id);
  check("run exits instead of completing", bAfter.status === "exited", bAfter.status);
  check("stoppedReason says purchased", bAfter.stoppedReason === "purchased", bAfter.stoppedReason ?? "null");
  const bEvents = await diary(b.run.id);
  check(
    "diary shows conditions_failed naming the purchase",
    bEvents.some(
      (e) =>
        e.kind === "conditions_failed" &&
        (e.detail ?? "").includes("not_purchased_since_entry") &&
        (e.detail ?? "").includes("purchased"),
    ),
  );
  check("diary shows the stop", bEvents.some((e) => e.kind === "stopped"));
  check("email 2 never sent to the buyer", (await sendsFor(seqA.auto.id, b.contact.id)).length === 1);

  console.log("\nC · entering another workflow stops the sequence");
  const c = await enrol(ws, `seqa_${STAMP}`, seqA.auto.id, `seq.c.${STAMP}@example.com`);
  // The second workflow is entered through the real trigger path, so the
  // run row the condition sees is exactly what production would write.
  const otherFlow = await db.automation.create({
    data: { workspaceId: ws, name: `Seq C other ${STAMP}`, trigger: "Test sequence", triggerEvent: `seqc2_${STAMP}`, status: "live" },
  });
  automationIds.push(otherFlow.id);
  await enrolOnEvent(ws, `seqc2_${STAMP}`, c.contact.id);
  const cAfter = await tickAfterWait(c.run.id);
  check("run exits instead of completing", cAfter.status === "exited", cAfter.status);
  check(
    "stoppedReason says entered_other_workflow",
    cAfter.stoppedReason === "entered_other_workflow",
    cAfter.stoppedReason ?? "null",
  );
  const cEvents = await diary(c.run.id);
  check(
    "diary shows conditions_failed naming the other workflow",
    cEvents.some(
      (e) => e.kind === "conditions_failed" && (e.detail ?? "").includes("not_entered_other_workflow"),
    ),
  );
  check("email 2 never sent to the wanderer", (await sendsFor(seqA.auto.id, c.contact.id)).length === 1);

  console.log("\nD · a ten-email sequence walks to completion, one send per step");
  const seqD = await buildSequence(ws, `Seq D ${STAMP}`, `seqd_${STAMP}`, 10);
  const d = await enrol(ws, `seqd_${STAMP}`, seqD.auto.id, `seq.d.${STAMP}@example.com`);
  let dState = await db.automationRun.findUniqueOrThrow({ where: { id: d.run.id } });
  let spins = 0;
  while (dState.status === "running" && spins++ < 15) {
    dState = await tickAfterWait(d.run.id);
  }
  check("run completes within the expected number of ticks", dState.status === "completed", `${dState.status} after ${spins} ticks`);
  const dSends = await sendsFor(seqD.auto.id, d.contact.id);
  check("exactly 10 send rows", dSends.length === 10, String(dSends.length));
  check(
    "one send per shadow campaign, zero duplicates",
    new Set(dSends.map((s) => s.campaignId)).size === 10,
  );
  check("every send handed to the transport", dSends.every((s) => delivered(s.status)));
  const dEvents = await diary(d.run.id);
  const dKinds = dEvents.map((e) => e.kind);
  check("diary shows 10 email_sent lines", dKinds.filter((k) => k === "email_sent").length === 10);
  check("diary shows 9 waits", dKinds.filter((k) => k === "waiting").length === 9);
  check("diary shows 9 condition passes", dKinds.filter((k) => k === "conditions_passed").length === 9);
  check("diary ends with completed", dKinds[dKinds.length - 1] === "completed");

  console.log("\nE · restart and duplicate safety: the schema guard holds");
  const seqE = await buildSequence(ws, `Seq E ${STAMP}`, `seqe_${STAMP}`, 2);
  const e = await enrol(ws, `seqe_${STAMP}`, seqE.auto.id, `seq.e.${STAMP}@example.com`);
  // A restart is not simulated by re-importing anything, because there is
  // nothing in memory to lose: the run IS its row. The next tick after a
  // restart is just advanceDueRuns against DB state, so that is what runs,
  // twice at once, as two overlapping schedulers would.
  await db.automationRun.update({
    where: { id: e.run.id },
    data: { nextDueAt: new Date(Date.now() - 1000) },
  });
  await Promise.all([advanceDueRuns(), advanceDueRuns()]);
  const eAfter = await db.automationRun.findUniqueOrThrow({ where: { id: e.run.id } });
  check("run completed under concurrent ticks", eAfter.status === "completed", eAfter.status);
  const eSends = await sendsFor(seqE.auto.id, e.contact.id);
  check("email 2 exists exactly once after concurrent ticks", eSends.length === 2, String(eSends.length));
  const eEvents = await diary(e.run.id);
  check(
    "exactly one completed diary line",
    eEvents.filter((ev) => ev.kind === "completed").length === 1,
  );
  check(
    "exactly two email_sent diary lines",
    eEvents.filter((ev) => ev.kind === "email_sent").length === 2,
  );

  // The rewind attempt: a corrupted or replayed scheduler winds currentNode
  // back before email 2 and marks the run due again. The walk repeats, the
  // condition passes again, and the unique(campaignId, contactId) constraint
  // is the only thing standing between the contact and a duplicate email.
  const eDelay = seqE.nodes.find((n) => n.kind === "delay")!;
  await db.automationRun.update({
    where: { id: e.run.id },
    data: {
      status: "running", currentNode: eDelay.id,
      nextDueAt: new Date(Date.now() - 1000), endedAt: null, stoppedReason: null,
    },
  });
  await advanceDueRuns();
  const eRewound = await db.automationRun.findUniqueOrThrow({ where: { id: e.run.id } });
  check("rewound run walks to completion again", eRewound.status === "completed", eRewound.status);
  const eEmail2Campaign = await nodeCampaignId(seqE.nodes.filter((n) => n.kind === "email")[1].id);
  const eEmail2Sends = await db.campaignSend.count({
    where: { campaignId: eEmail2Campaign ?? "none", contactId: e.contact.id },
  });
  check("unique guard still holds after the rewind: one email 2 row", eEmail2Sends === 1, String(eEmail2Sends));
  check(
    "no extra send rows appeared at all",
    (await sendsFor(seqE.auto.id, e.contact.id)).length === 2,
  );
  // The 11th-email-step refusal lives in the workflow save API's validator,
  // which is not exported and sits behind an authenticated request; it is
  // covered by the UI agent's test, not reachable from here.
  console.log("  · 11th email step refusal: left to the UI agent's API test (validator not reachable from a script)");


  console.log("\nDiscount reminder · spec scenarios A, C, D plus merge fields");
  // The reminder guard from the spec: still no purchase, code unspent, code
  // alive. Scenario B (purchase) and E (restart) are the generic scenarios
  // above; these three are the discount-specific ones.
  const DGUARD = {
    match: "all",
    conditions: [
      { type: "not_purchased_since_entry" },
      { type: "discount_not_used" },
      { type: "discount_still_active" },
    ],
  };
  const promo = await db.promotion.create({
    data: { workspaceId: ws, name: `Seq promo ${STAMP}`, mode: "unique", prefix: "SQT", kind: "percent", amount: 10, expiryDays: 3 },
  });
  const discountSeq = async (tag: string) => {
    const seq = await buildSequence(ws, `Seq ${tag} ${STAMP}`, `seq${tag}_${STAMP}`, 2);
    await db.automationNode.updateMany({
      where: { automationId: seq.auto.id, kind: "condition" },
      data: { config: JSON.stringify(DGUARD) },
    });
    const who = await enrol(ws, `seq${tag}_${STAMP}`, seq.auto.id, `seq.${tag}.${STAMP}@example.com`);
    const shadow = await db.campaign.findFirstOrThrow({
      where: { audienceType: "automation", audienceRef: seq.auto.id },
      orderBy: { createdAt: "asc" },
    });
    const issued = await issueCoupon({
      promotionId: promo.id, workspaceId: ws, contactId: who.contact.id,
      email: who.contact.email, source: `campaign:${shadow.id}`,
    });
    return { seq, who, shadow, issued };
  };

  // dA: nothing happens, the reminder goes out.
  const dA = await discountSeq("dA");
  check("code issued with a real expiry", dA.issued !== null && dA.issued.expiresAt !== null);
  const dAIdem = await issueCoupon({
    promotionId: promo.id, workspaceId: ws, contactId: dA.who.contact.id,
    email: dA.who.contact.email, source: `campaign:${dA.shadow.id}`,
  });
  check("issue is idempotent: the follow-up shows the SAME code", dAIdem?.code === dA.issued?.code);
  const dAAfter = await tickAfterWait(dA.who.run.id);
  check("dA: run completed, reminder sent", dAAfter.status === "completed", dAAfter.status ?? "");
  check("dA: two emails total", (await sendsFor(dA.seq.auto.id, dA.who.contact.id)).length === 2);

  // dC: the code gets used, the reminder must not go.
  const dC = await discountSeq("dC");
  await recordRedemption(dC.issued!.code, `order-${STAMP}`, dC.who.contact.email);
  const dCAfter = await tickAfterWait(dC.who.run.id);
  check("dC: stopped when the code was used", dCAfter.status === "exited" && dCAfter.stoppedReason === "discount_used", `${dCAfter.status}/${dCAfter.stoppedReason}`);
  check("dC: only the first email exists", (await sendsFor(dC.seq.auto.id, dC.who.contact.id)).length === 1);

  // dD: the code expires early, the reminder must not go.
  const dD = await discountSeq("dD");
  await db.couponCode.update({
    where: { id: dD.issued!.couponCodeId },
    data: { expiresAt: new Date(Date.now() - 60_000) },
  });
  const dDAfter = await tickAfterWait(dD.who.run.id);
  check("dD: stopped when the code expired", dDAfter.status === "exited" && dDAfter.stoppedReason === "discount_expired", `${dDAfter.status}/${dDAfter.stoppedReason}`);
  check("dD: only the first email exists", (await sendsFor(dD.seq.auto.id, dD.who.contact.id)).length === 1);

  // Merge fields fill from the issued code even with no coupon block in the
  // email, which is how a plain-text reminder references the original code.
  const merged = await renderForRecipient({
    workspaceId: ws,
    campaignId: dA.shadow.id,
    sendId: `seqmerge-${STAMP}`,
    contact: { id: dA.who.contact.id, email: dA.who.contact.email ?? "" },
    blocks: [
      { id: "m1", type: "text", html: "<p>Code {{discount_code}} ({{discount_value}}) expires {{discount_expiry}}.</p>" },
      { id: "m2", type: "footer" },
    ],
  });
  check("merge: the real code fills in", merged.html.includes(dA.issued!.code));
  check("merge: the value fills in", merged.html.includes("10% off"));
  check("merge: no unresolved fields remain", !merged.html.includes("{{"));

  // Local cleanup: codes reference contacts, so they go before cleanup()
  // deletes the contacts.
  await db.couponCode.deleteMany({ where: { promotionId: promo.id } });
  await db.promotion.delete({ where: { id: promo.id } });

  await cleanup();
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().then(() => process.exit(0)).catch(async (e) => { console.error(e); await cleanup(); process.exit(1); });
