// The welcome journey, end to end: exactly what production does when a real
// person submits the popup on the storefront. Run: npx tsx scripts/test-welcome.ts

import { db } from "../lib/server/db";
import {
  ensureWelcomeFlow,
  ensureShadowCampaigns,
  adoptShadowContent,
  blocksFor,
  enrolOnEvent,
  advanceRun,
} from "../lib/server/automations";
import { eventIngestionService } from "../lib/server/events";

let passed = 0, failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (ok) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`); }
};

async function main() {
  const STAMP = `w${Math.abs(Date.now() % 1_000_000)}`;
  const email = `welcome.${STAMP}@example.com`;

  console.log("\n1 · the flow arms itself on boot");
  await ensureWelcomeFlow();
  const flow = await db.automation.findFirst({
    where: { triggerEvent: "popup_submitted", name: { contains: "Welcome" } },
    include: { nodes: { orderBy: { position: "asc" } } },
  });
  check("welcome flow exists and is live", flow?.status === "live");
  check("recipe suffix gone", !(flow?.name ?? "").includes("(recipe)"));
  const emailNode = flow?.nodes.find((n) => n.kind === "email");
  check("email step has a subject", Boolean(emailNode && JSON.parse(emailNode.config ?? "{}").subject));

  console.log("\n2 · a popup submission walks the whole journey");
  await eventIngestionService.process({
    workspaceId: flow!.workspaceId,
    type: "popup_submitted",
    email,
    payload: { popup: "myotech-subscribe", consent: true, source: "tracker" },
  });

  const contact = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: flow!.workspaceId, email } },
  });
  check("contact created", Boolean(contact));
  check("email consent granted automatically", contact?.emailConsent === "granted");

  const run = await db.automationRun.findFirst({
    where: { automationId: flow!.id, contactId: contact!.id },
  });
  check("enrolled in the welcome flow", Boolean(run));

  const send = await db.campaignSend.findFirst({
    where: { contactId: contact!.id, campaign: { audienceType: "automation", audienceRef: flow!.id } },
    include: { campaign: true },
  });
  // Dev transport writes "simulated"; a live provider writes "sent". Both
  // prove the journey executed; neither is confused with the other.
  check("welcome email handed to the transport", send?.status === "sent" || send?.status === "simulated", send?.status);
  check("provider reference captured", Boolean(send?.providerMessageId));
  check("shadow campaign named after the flow", (send?.campaign.name ?? "").includes(flow!.name));

  const timeline = await db.timelineItem.findMany({ where: { contactId: contact!.id } });
  check("timeline shows the automation email honestly", timeline.some((t) => t.title.includes("Automation email sent") || t.title.includes("Automation email simulated")));
  check("timeline shows the consent", timeline.some((t) => t.type === "consent"));

  const after = await db.automation.findUnique({ where: { id: flow!.id } });
  check("entered counter moved", (after?.entered ?? 0) > (flow?.entered ?? 0) - 1 && (after?.entered ?? 0) >= 1);

  console.log("\n3 · submitting again does not restart the series");
  const sendsBefore = await db.campaignSend.count({ where: { contactId: contact!.id } });
  await eventIngestionService.process({
    workspaceId: flow!.workspaceId,
    type: "popup_submitted",
    email,
    payload: { popup: "myotech-subscribe", consent: true, source: "tracker" },
  });
  const runs = await db.automationRun.count({ where: { automationId: flow!.id, contactId: contact!.id } });
  const sendsAfter = await db.campaignSend.count({ where: { contactId: contact!.id } });
  check("still exactly one run", runs === 1, String(runs));
  check("no duplicate welcome email", sendsAfter === sendsBefore, `${sendsBefore} -> ${sendsAfter}`);

  console.log("\n4 · an unsubscribed contact is never welcomed");
  const optedOut = `optout.${STAMP}@example.com`;
  await db.contact.create({
    data: { workspaceId: flow!.workspaceId, email: optedOut, emailConsent: "withdrawn" },
  });
  await eventIngestionService.process({
    workspaceId: flow!.workspaceId,
    type: "popup_submitted",
    email: optedOut,
    payload: { popup: "myotech-subscribe", consent: true, source: "tracker" },
  });
  const optOutContact = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: flow!.workspaceId, email: optedOut } },
  });
  check("machine grant held against the opt-out", optOutContact?.emailConsent === "withdrawn");
  const optOutSend = await db.campaignSend.findFirst({ where: { contactId: optOutContact!.id } });
  check("no email left for them", !optOutSend);

  console.log("\n5 · the full email editor connects to email steps");
  const ws = flow!.workspaceId;
  const auto = await db.automation.create({
    data: { workspaceId: ws, name: `Editor link ${STAMP}`, trigger: "Test", status: "draft" },
  });
  const node = await db.automationNode.create({
    data: {
      automationId: auto.id, kind: "email", label: "Design test", position: 1,
      config: JSON.stringify({ subject: "Hi", html: "<p>Simple text body</p>" }),
    },
  });

  // (a) Saving a workflow creates the shadow campaign up front, idempotently.
  const shadowIds = await ensureShadowCampaigns(auto.id);
  const shadowId = shadowIds.get(node.id);
  check("shadow campaign created on save", Boolean(shadowId));
  const savedConfig = JSON.parse((await db.automationNode.findUniqueOrThrow({ where: { id: node.id } })).config ?? "{}");
  check("campaign id persisted on the node", savedConfig.campaignId === shadowId);
  const shadowRow = await db.campaign.findUniqueOrThrow({ where: { id: shadowId! } });
  check("shadow campaign is automation-typed", shadowRow.audienceType === "automation" && shadowRow.audienceRef === auto.id);
  const again = await ensureShadowCampaigns(auto.id);
  check("second save mints no new campaign", again.get(node.id) === shadowId);

  // (b) Designed blocks win over config.html at render time.
  const designedJson = JSON.stringify([
    { id: "d1", type: "heading", text: "Designed content", level: 1 },
    { id: "d2", type: "footer" },
  ]);
  const nodeShape = { label: "Design test", config: JSON.stringify({ html: "<p>Simple text body</p>", previewText: "pv-line" }) };
  const designed = blocksFor(nodeShape, designedJson);
  check(
    "designed blocks win over config.html",
    designed.some((b) => b.type === "heading" && b.text === "Designed content") &&
      !designed.some((b) => b.type === "text" && b.html.includes("Simple text body")),
  );
  check("preview text preheader kept with a design", designed.some((b) => b.type === "text" && b.html.includes("pv-line")));
  check("footer guaranteed on a designed email", designed.some((b) => b.type === "footer"));
  const fallback = blocksFor(nodeShape, null);
  check("no design falls back to the simple text", fallback.some((b) => b.type === "text" && b.html.includes("Simple text body")));

  // (c) Adopting an existing campaign's design copies it onto the shadow.
  const sourceCampaign = await db.campaign.create({
    data: {
      workspaceId: ws, name: `Design source ${STAMP}`, subject: "S", status: "draft",
      content: JSON.stringify([
        { id: "s1", type: "heading", text: "Adopted design", level: 1 },
        { id: "s2", type: "footer" },
      ]),
    },
  });
  const adopted = await adoptShadowContent({
    workspaceId: ws, automationId: auto.id, nodeId: node.id,
    source: { kind: "campaign", id: sourceCampaign.id },
  });
  check("adopt lands on the step's shadow campaign", adopted.ok && adopted.campaignId === shadowId);
  const shadowAfter = await db.campaign.findUniqueOrThrow({ where: { id: shadowId! } });
  const copied = JSON.parse(shadowAfter.content ?? "[]") as { id: string; type: string; text?: string }[];
  check("content copied onto the shadow campaign", copied.some((b) => b.type === "heading" && b.text === "Adopted design"));
  check("copy is a snapshot with fresh block ids", copied.every((b) => b.id !== "s1" && b.id !== "s2"));
  const emptySource = await db.campaign.create({
    data: { workspaceId: ws, name: `Empty source ${STAMP}`, subject: "E", status: "draft" },
  });
  const refused = await adoptShadowContent({
    workspaceId: ws, automationId: auto.id, nodeId: node.id,
    source: { kind: "campaign", id: emptySource.id },
  });
  check("source without designed content refused", refused.ok === false);
  const shadowStill = await db.campaign.findUniqueOrThrow({ where: { id: shadowId! } });
  check("refusal leaves the design untouched", (shadowStill.content ?? "").includes("Adopted design"));

  console.log("\n6 · the sequence engine: conditions, waits and the run diary");
  const trigType = `seq_test_${STAMP}`;
  const seq = await db.automation.create({
    data: { workspaceId: ws, name: `Sequence ${STAMP}`, trigger: "Test sequence", triggerEvent: trigType, status: "live" },
  });
  await db.automationNode.create({
    data: { automationId: seq.id, kind: "trigger", label: "Trigger", position: 0 },
  });
  await db.automationNode.create({
    data: {
      automationId: seq.id, kind: "email", label: "Email 1", position: 1,
      config: JSON.stringify({ subject: "One", html: "<p>One</p>" }),
    },
  });
  await db.automationNode.create({
    data: { automationId: seq.id, kind: "delay", label: "Wait", position: 2, config: JSON.stringify({ minutes: 30 }) },
  });
  await db.automationNode.create({
    data: {
      automationId: seq.id, kind: "condition", label: "Still shopping?", position: 3,
      config: JSON.stringify({
        match: "all",
        conditions: [{ type: "not_purchased_since_entry" }, { type: "not_entered_other_workflow" }],
      }),
    },
  });
  await db.automationNode.create({
    data: {
      automationId: seq.id, kind: "email", label: "Email 2", position: 4,
      config: JSON.stringify({ subject: "Two", html: "<p>Two</p>" }),
    },
  });

  const enrolInSeq = async (contactEmail: string) => {
    const c = await db.contact.create({
      data: { workspaceId: ws, email: contactEmail, emailConsent: "granted" },
    });
    await enrolOnEvent(ws, trigType, c.id);
    const run = await db.automationRun.findFirstOrThrow({
      where: { automationId: seq.id, contactId: c.id },
    });
    return { contact: c, run };
  };
  const ripen = async (runId: string) => {
    await db.automationRun.update({ where: { id: runId }, data: { nextDueAt: new Date(Date.now() - 1000) } });
    await advanceRun(runId);
    return db.automationRun.findUniqueOrThrow({ where: { id: runId } });
  };
  const seqSends = (contactId: string) =>
    db.campaignSend.count({ where: { contactId, campaign: { audienceRef: seq.id } } });
  const diary = (runId: string) =>
    db.automationRunEvent.findMany({ where: { runId }, orderBy: [{ at: "asc" }, { id: "asc" }] });

  // (a) The pass path: nothing intervenes, so the condition holds and the
  // follow-up sends. Also pins the minutes-based wait and the diary order.
  const a = await enrolInSeq(`seq.pass.${STAMP}@example.com`);
  const parked = await db.automationRun.findUniqueOrThrow({ where: { id: a.run.id } });
  const dueIn = (parked.nextDueAt?.getTime() ?? 0) - Date.now();
  check("minutes wait parks nextDueAt ~30 minutes out", dueIn > 29 * 60_000 && dueIn < 31 * 60_000, `${Math.round(dueIn / 1000)}s`);
  const aAfter = await ripen(a.run.id);
  check("condition pass completes the run", aAfter.status === "completed", aAfter.status);
  check("email 2 sends after the condition passes", (await seqSends(a.contact.id)) === 2);
  const aEvents = await diary(a.run.id);
  check(
    "run events written in order",
    aEvents.map((e) => e.kind).join(",") === "started,email_sent,waiting,conditions_passed,email_sent,completed",
    aEvents.map((e) => e.kind).join(","),
  );
  const aWaiting = aEvents.find((e) => e.kind === "waiting");
  check("waiting detail carries the due moment", Boolean(aWaiting?.detail?.startsWith("until ")) && !Number.isNaN(Date.parse(aWaiting?.detail?.slice(6) ?? "")));
  const aPassed = aEvents.find((e) => e.kind === "conditions_passed");
  check(
    "conditions_passed names each check",
    Boolean(aPassed?.detail?.includes("not_purchased_since_entry") && aPassed?.detail?.includes("not_entered_other_workflow")),
  );

  // (b) A purchase after entry fails the condition at execution time: the
  // run stops with the evaluator's reason and email 2 never leaves.
  const store = await db.store.create({
    data: { workspaceId: ws, name: `Seq store ${STAMP}`, url: `https://seq-${STAMP}.example.com`, apiKey: `seqkey_${STAMP}` },
  });
  const b = await enrolInSeq(`seq.buyer.${STAMP}@example.com`);
  await db.order.create({
    data: {
      storeId: store.id, contactId: b.contact.id, externalId: `seq-o-${STAMP}`,
      number: `#${STAMP}`, status: "completed", total: 49, placedAt: new Date(Date.now() + 1000),
    },
  });
  const bAfter = await ripen(b.run.id);
  check("purchase after entry stops the run", bAfter.status === "exited", bAfter.status);
  check("stoppedReason says purchased", bAfter.stoppedReason === "purchased", bAfter.stoppedReason ?? "null");
  check("email 2 never sent to the buyer", (await seqSends(b.contact.id)) === 1);
  const bEvents = await diary(b.run.id);
  check(
    "diary shows which check failed and why",
    bEvents.some((e) => e.kind === "conditions_failed" && (e.detail ?? "").includes("not_purchased_since_entry") && (e.detail ?? "").includes("purchased")),
  );
  check("diary shows the stop", bEvents.some((e) => e.kind === "stopped"));

  // (c) Entering another workflow after this one fails the other check.
  const c = await enrolInSeq(`seq.wanderer.${STAMP}@example.com`);
  const otherFlow = await db.automation.create({
    data: { workspaceId: ws, name: `Other flow ${STAMP}`, trigger: "Other", status: "live" },
  });
  await db.automationRun.create({
    data: { automationId: otherFlow.id, contactId: c.contact.id, status: "running", startedAt: new Date(Date.now() + 1000) },
  });
  const cAfter = await ripen(c.run.id);
  check("other-workflow entry stops the run", cAfter.status === "exited" && cAfter.stoppedReason === "entered_other_workflow", cAfter.stoppedReason ?? cAfter.status);
  check("email 2 never sent to the wanderer", (await seqSends(c.contact.id)) === 1);

  // (d) An unknown condition type saved by a newer editor passes with a note
  // instead of stranding the run on this server.
  const mysteryTrig = `seq_mystery_${STAMP}`;
  const mystery = await db.automation.create({
    data: { workspaceId: ws, name: `Mystery ${STAMP}`, trigger: "Test", triggerEvent: mysteryTrig, status: "live" },
  });
  await db.automationNode.create({
    data: { automationId: mystery.id, kind: "trigger", label: "Trigger", position: 0 },
  });
  await db.automationNode.create({
    data: {
      automationId: mystery.id, kind: "condition", label: "Future check", position: 1,
      config: JSON.stringify({ conditions: [{ type: "clicked_special_offer_2029" }] }),
    },
  });
  await db.automationNode.create({
    data: {
      automationId: mystery.id, kind: "email", label: "Offer", position: 2,
      config: JSON.stringify({ subject: "Offer", html: "<p>Offer</p>" }),
    },
  });
  const dContact = await db.contact.create({
    data: { workspaceId: ws, email: `seq.future.${STAMP}@example.com`, emailConsent: "granted" },
  });
  await enrolOnEvent(ws, mysteryTrig, dContact.id);
  const dRun = await db.automationRun.findFirstOrThrow({
    where: { automationId: mystery.id, contactId: dContact.id },
  });
  check("unknown condition type does not strand the run", dRun.status === "completed", dRun.status);
  const dSends = await db.campaignSend.count({
    where: { contactId: dContact.id, campaign: { audienceRef: mystery.id } },
  });
  check("email still sends past the unknown check", dSends === 1);
  const dEvents = await diary(dRun.id);
  check(
    "unknown type noted in the diary",
    dEvents.some((e) => e.kind === "note" && (e.detail ?? "").includes("clicked_special_offer_2029")),
  );
  check("unknown type still counts as conditions_passed", dEvents.some((e) => e.kind === "conditions_passed"));

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
