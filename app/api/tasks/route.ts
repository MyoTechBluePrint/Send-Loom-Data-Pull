import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({
  type: z.string().min(1).max(80),
  contactLabel: z.string().min(1).max(120),
  note: z.string().max(1000).optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  assigneeLabel: z.string().max(60).default("Unassigned"),
  dueInDays: z.number().int().min(0).max(30).default(1),
});

export async function POST(req: NextRequest) {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const dueAt = new Date(Date.now() + parsed.data.dueInDays * 24 * 3600 * 1000);
  const task = await db.salesTask.create({
    data: {
      workspaceId, type: parsed.data.type, contactLabel: parsed.data.contactLabel,
      note: parsed.data.note, priority: parsed.data.priority,
      assigneeLabel: parsed.data.assigneeLabel, source: "manual", dueAt,
    },
  });
  await audit(workspaceId, actor, "task.created", `'${parsed.data.type}' for ${parsed.data.contactLabel}`);
  return Response.json({ ok: true, id: task.id });
}
