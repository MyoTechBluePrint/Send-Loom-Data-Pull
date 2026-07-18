// STAGING ONLY: wipes the workspace and re-seeds the clean demo story.
// Owner-gated twice: permission check + explicit typed confirmation.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { can, currentUser } from "@/lib/server/permissions";

const Body = z.object({ confirm: z.literal("RESET"), mode: z.enum(["demo", "clean_launch"]).default("clean_launch") });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || !can(user.role, "reset_demo_data")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: "Type RESET to confirm." }, { status: 400 });
  }

  const actor = user.email;

  // Children before parents. deleteMany({}) is acceptable because staging has
  // exactly one workspace; multi-tenant reset would scope by workspaceId.
  const tables = [
    db.exportLog, db.contactPack,
    db.campaignSend, db.automationRun, db.automationNode, db.automation,
    db.campaign, db.timelineItem, db.event, db.leadScore, db.contactTag,
    db.consentRecord, db.contactSource, db.importRow, db.importBatch, db.importProject,
    db.enrichmentRecord, db.extractedRecord, db.intakeItem, db.salesTask,
    db.order, db.cart, db.product, db.providerSync, db.dataProvider,
    db.keyword, db.keywordCluster, db.demandSignal, db.suppressionRecord,
    db.feedback, db.complianceCheck, db.auditLog, db.form, db.emailTemplate,
    db.segmentRule, db.segment, db.tag, db.contact, db.store, db.user,
    db.workspace,
  ] as { deleteMany: (a: object) => Promise<unknown> }[];

  for (const t of tables) {
    await t.deleteMany({});
  }

  if (parsed.data.mode === "demo") {
    const { main } = await import("@/prisma/seed");
    await main();
  } else {
    const { main } = await import("@/prisma/seed-clean");
    await main();
  }

  const ws = await db.workspace.findFirst();
  if (ws) await audit(ws.id, actor, parsed.data.mode === "demo" ? "admin.demo_reset" : "admin.clean_launch_reset", parsed.data.mode === "demo" ? "Workspace wiped and re-seeded with the Vitalis demo" : "Workspace wiped and re-seeded as the CLEAN LAUNCH workspace (no contacts, no Savvy data, no demo revenue)");

  return Response.json({ ok: true, mode: parsed.data.mode });
}
