import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";

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
  return Response.json({ ok: true, id: task.id, status: task.status });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  await db.salesTask.delete({ where: { id } });
  return Response.json({ ok: true });
}
