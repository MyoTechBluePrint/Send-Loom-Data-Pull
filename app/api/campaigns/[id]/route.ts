import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { can } from "@/lib/server/permissions";

// The same session cookie currentUser() reads, taken from the request itself
// so the handler works anywhere a NextRequest exists, including the flow tests.
async function userFromRequest(req: NextRequest) {
  const email = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!email) return null;
  const user = await db.user.findUnique({ where: { email } });
  return user && !user.disabled ? user : null;
}

// Duplicate any campaign as a new draft.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  // Workspace-scoped like PATCH: another workspace's campaign is "not found".
  const src = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!src) return Response.json({ ok: false, error: "Not found" }, { status: 404 });
  // Copy suffixes must not stack into "(copy) (copy) (copy)": the base is the
  // source name stripped of any copy suffixes it already carries, and the new
  // suffix takes the smallest number not already used in the workspace.
  const base = src.name.replace(/(?: \(copy(?: \d+)?\))+$/, "") || src.name;
  const existing = await db.campaign.findMany({ where: { workspaceId: src.workspaceId }, select: { name: true } });
  const taken = new Set(existing.map((c) => c.name));
  let name = `${base} (copy)`;
  for (let n = 2; taken.has(name); n++) name = `${base} (copy ${n})`;
  const copy = await db.campaign.create({
    data: {
      workspaceId: src.workspaceId, name, subject: src.subject,
      previewText: src.previewText, status: "draft", audienceType: src.audienceType,
      audienceRef: src.audienceRef, content: src.content,
    },
  });
  await audit(src.workspaceId, verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown", "campaign.duplicated", `'${src.name}' → '${name}'`);
  return Response.json({ ok: true, id: copy.id, name });
}

const Rename = z.object({ name: z.string().trim().min(1).max(140) });
const Archive = z.object({ archived: z.boolean() });
const Restore = z.object({ deleted: z.literal(false) });
const Audience = z.object({
  audienceType: z.literal("segment").nullable(),
  audienceRef: z.string().min(1).max(140).nullable(),
});

// Three shapes share the PATCH verb, all scoped to the caller's workspace:
// {name} renames any campaign whatever its status; {archived} shelves a sent
// campaign or restores it; {audienceType, audienceRef} retargets a draft.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const campaign = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!campaign) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  const body: unknown = await req.json().catch(() => null);

  if (body && typeof body === "object" && "name" in body) {
    const parsed = Rename.safeParse(body);
    if (!parsed.success) return Response.json({ ok: false, error: "A campaign name is 1 to 140 characters." }, { status: 400 });
    if (parsed.data.name !== campaign.name) {
      if (campaign.status === "automation") {
        return Response.json({ ok: false, error: "This email is named by its workflow. Rename the workflow step instead." }, { status: 409 });
      }
      await db.campaign.update({ where: { id: campaign.id }, data: { name: parsed.data.name } });
      await audit(user.workspaceId, user.email, "campaign.renamed", `'${campaign.name}' → '${parsed.data.name}'`);
    }
    return Response.json({ ok: true, name: parsed.data.name });
  }

  // {deleted: false} restores a soft-deleted campaign to whichever list it
  // lived on. Oversight-level only: the same people who can see the deleted
  // list. The DeletionRecord stays in the ledger, marked restored.
  if (body && typeof body === "object" && "deleted" in body) {
    const parsed = Restore.safeParse(body);
    if (!parsed.success) return Response.json({ ok: false, error: "Only {deleted: false} is accepted: deletion happens via DELETE." }, { status: 400 });
    if (!can(user.role, "view_deleted")) {
      return Response.json({ ok: false, error: "Restoring deleted campaigns requires an admin-level account." }, { status: 403 });
    }
    if (!campaign.deletedAt) return Response.json({ ok: true, restored: false });
    const { restoreCampaign } = await import("@/lib/server/deletion");
    await restoreCampaign(campaign, user.email);
    return Response.json({ ok: true, restored: true });
  }

  if (body && typeof body === "object" && "archived" in body) {
    const parsed = Archive.safeParse(body);
    if (!parsed.success) return Response.json({ ok: false, error: "archived must be true or false." }, { status: 400 });
    if (campaign.deletedAt) {
      return Response.json({ ok: false, error: "This campaign is deleted. Restore it before archiving or unarchiving." }, { status: 409 });
    }
    if (campaign.status === "automation") {
      return Response.json({ ok: false, error: "This email belongs to an automation; manage it from the automation." }, { status: 409 });
    }
    if (parsed.data.archived) {
      // Only sent campaigns archive: drafts are simply deleted, and a
      // scheduled or sending campaign must stay visible while it is in play.
      if (campaign.status !== "sent") {
        return Response.json({ ok: false, error: "Only sent campaigns can be archived. Delete a draft instead." }, { status: 409 });
      }
      if (!campaign.archivedAt) {
        await db.campaign.update({ where: { id: campaign.id }, data: { archivedAt: new Date() } });
        await audit(user.workspaceId, user.email, "campaign.archived", `'${campaign.name}'`);
      }
    } else if (campaign.archivedAt) {
      await db.campaign.update({ where: { id: campaign.id }, data: { archivedAt: null } });
      await audit(user.workspaceId, user.email, "campaign.restored", `'${campaign.name}'`);
    }
    return Response.json({ ok: true, archived: parsed.data.archived });
  }

  // Retarget a draft: every contact (both fields null) or one workspace
  // segment. Advisory until send time, when resolveAudience re-checks consent,
  // suppression and Do Not Contact against whatever is stored here.
  if (campaign.status !== "draft") {
    return Response.json({ ok: false, error: "Only drafts can be retargeted; a sent campaign's audience is part of its history." }, { status: 409 });
  }

  const parsed = Audience.safeParse(body);
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

// Deletion never rewrites history. A draft that never sent anything is the
// one case with no history to protect, so it hard-deletes; everything else
// soft-deletes: the row leaves the working interface, its send records and
// revenue stay counted in every historical metric, and a DeletionRecord
// says who removed it and what its numbers were at that moment. The old
// ?permanent=1 erase path is gone on purpose — nobody improves their
// reported performance by deleting the unsuccessful tests.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await userFromRequest(req);
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const campaign = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!campaign) return Response.json({ ok: false, error: "Not found" }, { status: 404 });

  // An automation's shadow campaign is workflow machinery: deleting it would
  // orphan the step's design and its never-twice guarantee. The workflow
  // owns its emails; delete the workflow to delete them.
  if (campaign.status === "automation" || campaign.audienceType === "automation") {
    return Response.json({ ok: false, error: "This email belongs to an automation. Delete the workflow to remove it." }, { status: 422 });
  }

  if (campaign.deletedAt) {
    return Response.json({ ok: false, error: "Already deleted. Its performance history remains in analytics." }, { status: 409 });
  }

  // A campaign mid-flight must stay visible while it is in play.
  if (campaign.status === "scheduled" || campaign.status === "sending") {
    return Response.json({ ok: false, error: "This campaign is scheduled or sending. Cancel the send before deleting it." }, { status: 409 });
  }

  const sends = await db.campaignSend.count({ where: { campaignId: id } });
  if (campaign.status === "draft" && sends === 0) {
    await db.campaign.delete({ where: { id } });
    await audit(campaign.workspaceId, user.email, "campaign.draft_deleted", `'${campaign.name}' · never sent, no history to keep`);
    return Response.json({ ok: true, hardDeleted: true });
  }

  if (!can(user.role, "delete_records")) {
    return Response.json({ ok: false, error: "Your role cannot delete campaigns." }, { status: 403 });
  }
  const { softDeleteCampaign } = await import("@/lib/server/deletion");
  await softDeleteCampaign(campaign, user.email);
  return Response.json({ ok: true, softDeleted: true, retainedSends: sends });
}
