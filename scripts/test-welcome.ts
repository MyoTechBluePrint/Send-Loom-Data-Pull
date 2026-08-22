// The welcome journey, end to end: exactly what production does when a real
// person submits the popup on the storefront. Run: npx tsx scripts/test-welcome.ts

import { db } from "../lib/server/db";
import { ensureWelcomeFlow } from "../lib/server/automations";
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
  check("welcome email sent", send?.status === "sent", send?.status);
  check("shadow campaign named after the flow", (send?.campaign.name ?? "").includes(flow!.name));

  const timeline = await db.timelineItem.findMany({ where: { contactId: contact!.id } });
  check("timeline shows the automation email", timeline.some((t) => t.title.includes("Automation email sent")));
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

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
