import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({ name: z.string().min(1).max(120) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  const seg = await db.segment.update({ where: { id }, data: { name: parsed.data.name } });
  await audit(seg.workspaceId, verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown", "segment.renamed", `→ '${parsed.data.name}'`);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const seg = await db.segment.findUnique({ where: { id } });
  if (!seg) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  await db.segmentRule.deleteMany({ where: { segmentId: id } });
  await db.segment.delete({ where: { id } });
  await audit(seg.workspaceId, verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown", "segment.deleted", `'${seg.name}'`);
  return Response.json({ ok: true });
}
