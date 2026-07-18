import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";

const Body = z.object({ status: z.enum(["open", "done"]) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const task = await db.salesTask.update({
    where: { id },
    data: {
      status: parsed.data.status,
      completedAt: parsed.data.status === "done" ? new Date() : null,
    },
  });
  if (parsed.data.status === "done") {
    const user = await currentUser();
    await audit(task.workspaceId, user?.email ?? "unknown", "task.completed", `'${task.type}' for ${task.contactLabel ?? "?"}`);
  }
  return Response.json({ ok: true, id: task.id, status: task.status });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const task = await db.salesTask.delete({ where: { id } });
  const user = await currentUser();
  await audit(task.workspaceId, user?.email ?? "unknown", "task.deleted", `'${task.type}' for ${task.contactLabel ?? "?"}`);
  return Response.json({ ok: true });
}
