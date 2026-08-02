// One template: read, edit, rename, archive/restore, duplicate, preview.
// Every mutation is workspace-guarded and audited.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";
import { parseBlocks, validateBlocks } from "@/lib/server/email-blocks";
import { renderPreview } from "@/lib/server/email-render";

async function ownedTemplate(id: string, workspaceId: string) {
  return db.emailTemplate.findFirst({ where: { id, workspaceId } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const t = await ownedTemplate(id, user.workspaceId);
  if (!t) return Response.json({ ok: false, error: "Template not found." }, { status: 404 });

  const usedBy = await db.campaign.findMany({
    where: { templateId: t.id },
    select: { id: true, name: true, status: true },
    take: 20,
  });

  return Response.json({
    ok: true,
    template: {
      id: t.id, name: t.name, description: t.description, category: t.category,
      brandId: t.brandId, archived: t.archived, content: t.content,
      updatedAt: t.updatedAt.toISOString(), updatedBy: t.updatedBy,
    },
    usedBy,
    issues: validateBlocks(parseBlocks(t.content)),
  });
}

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(300).nullable().optional(),
  category: z.string().max(40).optional(),
  brandId: z.string().nullable().optional(),
  content: z.string().optional(),
  archived: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const t = await ownedTemplate(id, user.workspaceId);
  if (!t) return Response.json({ ok: false, error: "Template not found." }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Nothing valid to change." }, { status: 400 });

  if (parsed.data.content) {
    // Content must parse; a template that cannot render is worse than a
    // rejected save.
    const blocks = parseBlocks(parsed.data.content);
    if (!blocks.length) return Response.json({ ok: false, error: "Template content is not valid." }, { status: 400 });
  }

  const updated = await db.emailTemplate.update({
    where: { id: t.id },
    data: { ...parsed.data, updatedBy: user.email },
  });

  const what =
    parsed.data.archived === true ? "archived"
    : parsed.data.archived === false ? "restored"
    : parsed.data.content ? "content edited"
    : parsed.data.name && parsed.data.name !== t.name ? `renamed to '${parsed.data.name}'`
    : "updated";
  await audit(user.workspaceId, user.email, "template.updated", `'${updated.name}': ${what}`);

  return Response.json({
    ok: true,
    issues: validateBlocks(parseBlocks(updated.content)),
  });
}

const Action = z.object({
  action: z.enum(["duplicate", "preview"]),
  content: z.string().optional(), // preview unsaved content
  brandId: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const t = await ownedTemplate(id, user.workspaceId);
  if (!t) return Response.json({ ok: false, error: "Template not found." }, { status: 404 });

  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });

  if (parsed.data.action === "duplicate") {
    const copy = await db.emailTemplate.create({
      data: {
        workspaceId: user.workspaceId,
        name: `${t.name} (copy)`,
        description: t.description,
        category: t.category,
        brandId: t.brandId,
        content: t.content,
        updatedBy: user.email,
      },
    });
    await audit(user.workspaceId, user.email, "template.duplicated", `'${t.name}' → '${copy.name}'`);
    return Response.json({ ok: true, id: copy.id });
  }

  // preview
  const blocks = parseBlocks(parsed.data.content ?? t.content);
  const rendered = await renderPreview({
    workspaceId: user.workspaceId,
    blocks,
    brandId: parsed.data.brandId ?? t.brandId,
  });
  return Response.json({ ok: true, ...rendered, issues: validateBlocks(blocks) });
}
