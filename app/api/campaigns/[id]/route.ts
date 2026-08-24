import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { currentUser } from "@/lib/server/permissions";

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

const Patch = z.object({
  audienceType: z.literal("segment").nullable(),
  audienceRef: z.string().min(1).max(140).nullable(),
});

// Retarget a draft: every contact (both fields null) or one workspace
// segment. Advisory until send time, when resolveAudience re-checks consent,
// suppression and Do Not Contact against whatever is stored here.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const campaign = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!campaign) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  if (campaign.status !== "draft") {
    return Response.json({ ok: false, error: "Only drafts can be retargeted; a sent campaign's audience is part of its history." }, { status: 409 });
  }

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  let audienceType: string | null = null;
  let audienceRef: string | null = null;
  let label = "All contacts";
  if (parsed.data.audienceType === "segment") {
    if (!parsed.data.audienceRef) {
      return Response.json({ ok: false, error: "A segment audience needs a segment." }, { status: 400 });
    }
    // The same id-or-name lookup resolveAudience uses, so a ref accepted here
    // is one the send will find. Stored as the id, which survives renames.
    const segment = await db.segment.findFirst({
      where: { workspaceId: user.workspaceId, OR: [{ id: parsed.data.audienceRef }, { name: parsed.data.audienceRef }] },
    });
    if (!segment) return Response.json({ ok: false, error: "Segment not found." }, { status: 404 });
    audienceType = "segment";
    audienceRef = segment.id;
    label = segment.name;
  } else if (parsed.data.audienceRef !== null) {
    return Response.json({ ok: false, error: "An audienceRef without audienceType 'segment' has no meaning." }, { status: 400 });
  }

  await db.campaign.update({ where: { id: campaign.id }, data: { audienceType, audienceRef } });
  await audit(user.workspaceId, user.email, "campaign.audience_changed", `'${campaign.name}' → ${label}`);
  return Response.json({ ok: true, audienceType, audienceRef, audienceName: label });
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
