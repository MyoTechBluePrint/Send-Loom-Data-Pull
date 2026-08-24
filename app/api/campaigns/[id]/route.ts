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

  if (body && typeof body === "object" && "archived" in body) {
    const parsed = Archive.safeParse(body);
    if (!parsed.success) return Response.json({ ok: false, error: "archived must be true or false." }, { status: 400 });
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

// Drafts only: sent campaigns keep their history.
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

  if (campaign.status === "draft") {
    await db.campaign.delete({ where: { id } });
    await audit(campaign.workspaceId, user.email, "campaign.draft_deleted", `'${campaign.name}'`);
    return Response.json({ ok: true });
  }

  // Permanent deletion of a sent campaign, at the owner's explicit request.
  // It takes the send history with it: stats stop existing, and the
  // unsubscribe links baked into already-delivered copies of this email die
  // (suppression and consent live in their own tables, so anyone who already
  // unsubscribed stays unsubscribed). That is a call for people who can
  // send, not for every login, and the client sends ?permanent=1 only from
  // the confirm dialog that spells the consequences out.
  if (req.nextUrl.searchParams.get("permanent") !== "1") {
    return Response.json({ ok: false, error: "Deleting a sent campaign permanently erases its send history. Confirm the permanent delete, or archive it instead." }, { status: 422 });
  }
  if (!can(user.role, "enable_live_sending")) {
    return Response.json({ ok: false, error: "Deleting sent campaigns requires an owner-level account." }, { status: 403 });
  }
  const sends = await db.campaignSend.count({ where: { campaignId: id } });
  await db.$transaction([
    db.campaignSend.deleteMany({ where: { campaignId: id } }),
    db.campaign.delete({ where: { id } }),
  ]);
  await audit(
    campaign.workspaceId, user.email, "campaign.permanently_deleted",
    `'${campaign.name}' · ${sends} send records erased with it`
  );
  return Response.json({ ok: true, erasedSends: sends });
}
