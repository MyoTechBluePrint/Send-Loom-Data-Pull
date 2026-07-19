// Owner-only full JSON dump of the workspace's major tables. Used to back up
// the live staging database before destructive resets. Never cached.
import { db } from "@/lib/server/db";
import { can, currentUser } from "@/lib/server/permissions";

const TABLES = [
  "workspace", "user", "store", "contact", "contactSource", "consentRecord",
  "importBatch", "importProject", "segment", "segmentRule", "tag", "contactTag",
  "salesTask", "campaign", "campaignSend", "automation", "automationNode",
  "form", "leadScore", "keyword", "keywordCluster", "demandSignal",
  "dataProvider", "suppressionRecord", "feedback", "auditLog", "contactPack",
  "exportLog", "intakeItem", "extractedRecord", "cart", "event", "timelineItem",
  "product", "order", "trackingReject",
] as const;

export async function GET() {
  const user = await currentUser();
  if (!user || !can(user.role, "reset_demo_data")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const dump: Record<string, unknown> = { exportedAt: new Date().toISOString(), exportedBy: user.email };
  for (const t of TABLES) {
    // Users are dumped without password hashes.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db as any)[t].findMany();
    dump[t] = t === "user" ? rows.map((r: { passwordHash?: string }) => ({ ...r, passwordHash: r.passwordHash ? "[redacted]" : null })) : rows;
  }
  return new Response(JSON.stringify(dump), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="sendloom-backup-${new Date().toISOString().slice(0, 10)}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
