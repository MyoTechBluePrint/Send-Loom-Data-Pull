import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { can, currentUser } from "@/lib/server/permissions";

// Convert a feedback item into a sales task and mark it actioned.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !can(user.role, "triage_feedback")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const fb = await db.feedback.findUnique({ where: { id } });
  if (!fb) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const summary = fb.improve || fb.confusing || fb.missing || fb.notes || fb.workedWell || "Review feedback";
  const task = await db.salesTask.create({
    data: {
      workspaceId: fb.workspaceId,
      type: `Fix: ${fb.area}`,
      contactLabel: `Feedback from ${fb.author}`,
      note: summary.slice(0, 900),
      priority: fb.priority as "high" | "medium" | "low",
      source: "system",
      assigneeLabel: "Steve",
      dueAt: new Date(Date.now() + 3 * 24 * 3600 * 1000),
    },
  });
  await db.feedback.update({ where: { id }, data: { status: "actioned" } });
  await audit(fb.workspaceId, user.email, "feedback.converted", `${fb.area} → task ${task.id}`);
  return Response.json({ ok: true, taskId: task.id });
}
