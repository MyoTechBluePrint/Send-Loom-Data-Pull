import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

// Duplicate any campaign as a new draft.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const src = await db.campaign.findUnique({ where: { id } });
  if (!src) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  const copy = await db.campaign.create({
    data: {
      workspaceId: src.workspaceId, name: `${src.name} (copy)`, subject: src.subject,
      previewText: src.previewText, status: "draft", audienceType: src.audienceType,
      audienceRef: src.audienceRef, content: src.content,
    },
  });
  await audit(src.workspaceId, verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown", "campaign.duplicated", `'${src.name}' → draft`);
  return Response.json({ ok: true, id: copy.id });
}

// Drafts only: sent campaigns keep their history.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return Response.json({ ok: false, error: "Only drafts can be deleted; sent campaigns keep their history." }, { status: 422 });
  }
  await db.campaign.delete({ where: { id } });
  await audit(campaign.workspaceId, verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown", "campaign.draft_deleted", `'${campaign.name}'`);
  return Response.json({ ok: true });
}
