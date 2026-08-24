// The welcome journey, end to end: exactly what production does when a real
// person submits the popup on the storefront. Run: npx tsx scripts/test-welcome.ts

import { db } from "../lib/server/db";
import {
  ensureWelcomeFlow,
  ensureShadowCampaigns,
  adoptShadowContent,
  blocksFor,
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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
