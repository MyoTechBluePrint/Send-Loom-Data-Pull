import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { can, currentUser } from "@/lib/server/permissions";

const Body = z.object({
  status: z.enum(["new", "reviewed", "actioned", "rejected"]).optional(),
  internalNote: z.string().max(2000).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !can(user.role, "triage_feedback")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const fb = await db.feedback.update({ where: { id }, data: parsed.data });
  await audit(fb.workspaceId, user.email, "feedback.triaged", `${fb.area} → ${fb.status}${parsed.data.internalNote ? " · note added" : ""}`);
  return Response.json({ ok: true });
}
