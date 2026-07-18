import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({
  area: z.string().min(1).max(80),
  workedWell: z.string().max(4000).optional(),
  confusing: z.string().max(4000).optional(),
  missing: z.string().max(4000).optional(),
  improve: z.string().max(4000).optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z.string().max(4000).optional(),
});

export async function POST(req: NextRequest) {
  const author = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const fb = await db.feedback.create({ data: { workspaceId, author, ...parsed.data } });
  await audit(workspaceId, author, "feedback.submitted", `${parsed.data.area} · ${parsed.data.priority} priority`);
  return Response.json({ ok: true, id: fb.id });
}
