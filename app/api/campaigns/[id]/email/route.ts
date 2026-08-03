// The campaign's email: read it, save edits, apply a template, save back as a
// reusable template, preview, send a test.
//
// Applying a template COPIES its blocks onto the campaign (contentDirty
// false); editing afterwards marks the campaign dirty so the UI can say
// "edited since the template was applied" and warn before replacement.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";
import { blankTemplate, parseBlocks, validateBlocks } from "@/lib/server/email-blocks";
import { renderPreview, resolveFeeds } from "@/lib/server/email-render";
import { activeProvider } from "@/lib/server/sending";

async function ownedCampaign(id: string, workspaceId: string) {
  return db.campaign.findFirst({ where: { id, workspaceId } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const c = await ownedCampaign(id, user.workspaceId);
  if (!c) return Response.json({ ok: false, error: "Campaign not found." }, { status: 404 });

  const template = c.templateId
    ? await db.emailTemplate.findUnique({ where: { id: c.templateId }, select: { id: true, name: true } })
    : null;
  const brands = await db.brand.findMany({
    where: { workspaceId: user.workspaceId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const blocks = parseBlocks(c.content);

  return Response.json({
    ok: true,
    campaign: {
      id: c.id, name: c.name, subject: c.subject, status: c.status,
      content: c.content, contentDirty: c.contentDirty,
      templateId: c.templateId, templateName: template?.name ?? null,
      brandId: c.brandId, sent: c.status === "sent" || c.status === "sending",
    },
    brands,
    issues: validateBlocks(blocks),
  });
}

const Put = z.object({
  content: z.string(),
  subject: z.string().max(200).optional(),
  brandId: z.string().nullable().optional(),
});

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const c = await ownedCampaign(id, user.workspaceId);
  if (!c) return Response.json({ ok: false, error: "Campaign not found." }, { status: 404 });
  if (c.status === "sent" || c.status === "sending") {
    // Sent content is a historical record; it does not get edited.
    return Response.json({ ok: false, error: "This campaign has been sent. Duplicate it to make changes." }, { status: 409 });
  }

  const parsed = Put.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Nothing to save." }, { status: 400 });

  const blocks = parseBlocks(parsed.data.content);
  if (!blocks.length) return Response.json({ ok: false, error: "The email is empty." }, { status: 400 });

  await db.campaign.update({
    where: { id: c.id },
    data: {
      content: JSON.stringify(blocks),
      contentDirty: true,
      ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject } : {}),
      ...(parsed.data.brandId !== undefined ? { brandId: parsed.data.brandId } : {}),
    },
  });

  return Response.json({ ok: true, issues: validateBlocks(blocks) });
}

const Act = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply_template"), templateId: z.string(), confirmReplace: z.boolean().default(false) }),
  z.object({ action: z.literal("start_blank"), confirmReplace: z.boolean().default(false) }),
  z.object({ action: z.literal("save_as_template"), name: z.string().min(1).max(120), category: z.string().max(40).default("newsletter") }),
  z.object({ action: z.literal("preview"), content: z.string().optional(), brandId: z.string().nullable().optional() }),
  z.object({ action: z.literal("send_test"), to: z.string().email(), content: z.string().optional(), brandId: z.string().nullable().optional() }),
  z.object({ action: z.literal("duplicate") }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const c = await ownedCampaign(id, user.workspaceId);
  if (!c) return Response.json({ ok: false, error: "Campaign not found." }, { status: 404 });

  const parsed = Act.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  const a = parsed.data;

  switch (a.action) {
    case "apply_template": {
      const t = await db.emailTemplate.findFirst({ where: { id: a.templateId, workspaceId: user.workspaceId } });
      if (!t) return Response.json({ ok: false, error: "Template not found." }, { status: 404 });
      // Accidental-replacement guard: existing edited content requires an
      // explicit confirmation from the UI.
      if (c.content && c.contentDirty && !a.confirmReplace) {
        return Response.json({ ok: false, needsConfirm: true, error: "This campaign's email has unsaved edits. Applying a template replaces them." }, { status: 409 });
      }
      await db.campaign.update({
        where: { id: c.id },
        data: { content: t.content, templateId: t.id, brandId: t.brandId ?? c.brandId, contentDirty: false },
      });
      await audit(user.workspaceId, user.email, "campaign.template_applied", `'${t.name}' → campaign '${c.name}'`);
      return Response.json({ ok: true });
    }
    case "start_blank": {
      if (c.content && c.contentDirty && !a.confirmReplace) {
        return Response.json({ ok: false, needsConfirm: true, error: "This campaign's email has edits. Starting from blank replaces them." }, { status: 409 });
      }
      await db.campaign.update({
        where: { id: c.id },
        data: { content: JSON.stringify(blankTemplate()), templateId: null, contentDirty: false },
      });
      return Response.json({ ok: true });
    }
    case "save_as_template": {
      const blocks = parseBlocks(c.content);
      if (!blocks.length) return Response.json({ ok: false, error: "There is no email content to save yet." }, { status: 400 });
      const t = await db.emailTemplate.create({
        data: {
          workspaceId: user.workspaceId,
          name: a.name,
          category: a.category,
          brandId: c.brandId,
          content: c.content!,
          updatedBy: user.email,
          description: `Saved from campaign "${c.name}"`,
        },
      });
      await db.campaign.update({ where: { id: c.id }, data: { templateId: t.id, contentDirty: false } });
      await audit(user.workspaceId, user.email, "template.saved_from_campaign", `'${a.name}' from campaign '${c.name}'`);
      return Response.json({ ok: true, id: t.id });
    }
    case "preview": {
      const blocks = parseBlocks(a.content ?? c.content);
      if (!blocks.length) return Response.json({ ok: false, error: "Nothing to preview yet." }, { status: 400 });
      // The editor's brand selector overrides the stored brand so switching
      // brands restyles the preview live, before anything is saved.
      const brandId = a.brandId === undefined ? c.brandId : a.brandId;
      const rendered = await renderPreview({ workspaceId: user.workspaceId, blocks, brandId });
      return Response.json({ ok: true, ...rendered, issues: validateBlocks(blocks) });
    }
    case "send_test": {
      const blocks = parseBlocks(a.content ?? c.content);
      if (!blocks.length) return Response.json({ ok: false, error: "Nothing to test yet." }, { status: 400 });
      const issues = validateBlocks(blocks).filter((i) => i.level === "error");
      if (issues.length) {
        return Response.json({ ok: false, error: `Fix before testing: ${issues[0].message}` }, { status: 400 });
      }
      // Tests render with preview context (sample personalisation, no coupon
      // minting) so a test can never issue a customer's real code.
      const resolved = await resolveFeeds(blocks, user.workspaceId, null);
      const rendered = await renderPreview({ workspaceId: user.workspaceId, blocks: resolved, brandId: a.brandId === undefined ? c.brandId : a.brandId });
      const provider = activeProvider();
      const result = await provider.send({
        to: a.to,
        subject: `[TEST] ${c.subject ?? c.name}`,
        html: rendered.html,
        campaignSendId: `test_${c.id}`,
      });
      await audit(user.workspaceId, user.email, "campaign.test_sent", `'${c.name}' test → ${a.to} via ${provider.name}: ${result.status}`);
      return Response.json({
        ok: result.status === "sent",
        provider: provider.name,
        detail: result.detail,
        error: result.status === "sent" ? undefined : result.detail,
      });
    }
    case "duplicate": {
      // The way forward for a sent (locked) campaign: a fresh draft carrying
      // the same content, brand and audience, ready to edit.
      const copy = await db.campaign.create({
        data: {
          workspaceId: user.workspaceId,
          name: `${c.name} (copy)`,
          subject: c.subject, previewText: c.previewText,
          status: "draft",
          audienceType: c.audienceType, audienceRef: c.audienceRef,
          content: c.content, templateId: c.templateId, brandId: c.brandId,
          contentDirty: c.contentDirty,
          sendMode: c.sendMode, sendDurationMins: c.sendDurationMins, sendBatchSize: c.sendBatchSize,
          sendWindowStart: c.sendWindowStart, sendWindowEnd: c.sendWindowEnd,
        },
      });
      await audit(user.workspaceId, user.email, "campaign.duplicated", `'${c.name}' → '${copy.name}'`);
      return Response.json({ ok: true, id: copy.id });
    }
  }
}
