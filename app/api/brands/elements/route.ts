// Global elements: reusable blocks shared across templates.
//
// Publishing an edit bumps the version and keeps the old one, so a bad change
// rolls back. Sent campaigns are never affected either way: sending snapshots
// rendered HTML onto the campaign.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";

export async function GET() {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const elements = await db.globalElement.findMany({
    where: { workspaceId: user.workspaceId },
    include: { brand: { select: { name: true } }, versions: { orderBy: { version: "desc" }, take: 5 } },
    orderBy: { name: "asc" },
  });

  // "Where is this used?" — templates whose content references the element id.
  const templates = await db.emailTemplate.findMany({
    where: { workspaceId: user.workspaceId, archived: false },
    select: { id: true, name: true, content: true },
  });

  return Response.json({
    ok: true,
    elements: elements.map((el) => ({
      id: el.id,
      name: el.name,
      brandName: el.brand?.name ?? null,
      brandId: el.brandId,
      content: el.content,
      version: el.version,
      archived: el.archived,
      updatedBy: el.updatedBy,
      updatedAt: el.updatedAt.toISOString(),
      usedBy: templates.filter((t) => t.content.includes(el.id)).map((t) => ({ id: t.id, name: t.name })),
      versions: el.versions.map((v) => ({ version: v.version, savedBy: v.savedBy, createdAt: v.createdAt.toISOString() })),
    })),
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().min(1).max(80), content: z.string(), brandId: z.string().nullable().optional() }),
  z.object({ action: z.literal("publish"), id: z.string(), content: z.string() }),
  z.object({ action: z.literal("rollback"), id: z.string(), version: z.number().int().min(1) }),
  z.object({ action: z.literal("archive"), id: z.string(), archived: z.boolean() }),
  z.object({ action: z.literal("duplicate"), id: z.string() }),
]);

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unrecognised action." }, { status: 400 });
  const a = parsed.data;

  const validBlock = (json: string) => {
    try {
      const v = JSON.parse(json) as { type?: string };
      return typeof v === "object" && v !== null && typeof v.type === "string";
    } catch {
      return false;
    }
  };

  switch (a.action) {
    case "create": {
      if (!validBlock(a.content)) return Response.json({ ok: false, error: "Element content must be one valid block." }, { status: 400 });
      const existing = await db.globalElement.findUnique({ where: { workspaceId_name: { workspaceId: user.workspaceId, name: a.name } } });
      if (existing) return Response.json({ ok: false, error: "An element with this name already exists." }, { status: 409 });
      const el = await db.globalElement.create({
        data: { workspaceId: user.workspaceId, name: a.name, content: a.content, brandId: a.brandId ?? null, updatedBy: user.email },
      });
      await db.globalElementVersion.create({ data: { elementId: el.id, version: 1, content: a.content, savedBy: user.email } });
      await audit(user.workspaceId, user.email, "element.created", `'${a.name}'`);
      return Response.json({ ok: true, id: el.id });
    }
    case "publish": {
      if (!validBlock(a.content)) return Response.json({ ok: false, error: "Element content must be one valid block." }, { status: 400 });
      const el = await db.globalElement.findFirst({ where: { id: a.id, workspaceId: user.workspaceId } });
      if (!el) return Response.json({ ok: false, error: "Element not found." }, { status: 404 });
      const next = el.version + 1;
      await db.$transaction([
        db.globalElement.update({ where: { id: el.id }, data: { content: a.content, version: next, updatedBy: user.email } }),
        db.globalElementVersion.create({ data: { elementId: el.id, version: next, content: a.content, savedBy: user.email } }),
      ]);
      await audit(user.workspaceId, user.email, "element.published", `'${el.name}' v${next} · linked templates render the update; sent campaigns unaffected`);
      return Response.json({ ok: true, version: next });
    }
    case "rollback": {
      const el = await db.globalElement.findFirst({ where: { id: a.id, workspaceId: user.workspaceId } });
      if (!el) return Response.json({ ok: false, error: "Element not found." }, { status: 404 });
      const target = await db.globalElementVersion.findUnique({ where: { elementId_version: { elementId: el.id, version: a.version } } });
      if (!target) return Response.json({ ok: false, error: "That version does not exist." }, { status: 404 });
      const next = el.version + 1;
      await db.$transaction([
        db.globalElement.update({ where: { id: el.id }, data: { content: target.content, version: next, updatedBy: user.email } }),
        db.globalElementVersion.create({ data: { elementId: el.id, version: next, content: target.content, savedBy: `${user.email} (rollback to v${a.version})` } }),
      ]);
      await audit(user.workspaceId, user.email, "element.rolled_back", `'${el.name}' back to v${a.version} (as v${next})`);
      return Response.json({ ok: true, version: next });
    }
    case "archive": {
      const el = await db.globalElement.findFirst({ where: { id: a.id, workspaceId: user.workspaceId } });
      if (!el) return Response.json({ ok: false, error: "Element not found." }, { status: 404 });
      await db.globalElement.update({ where: { id: el.id }, data: { archived: a.archived } });
      await audit(user.workspaceId, user.email, a.archived ? "element.archived" : "element.restored", `'${el.name}'`);
      return Response.json({ ok: true });
    }
    case "duplicate": {
      // A detached copy: same content, new identity, no further updates from
      // the original. This is the "detach" path.
      const el = await db.globalElement.findFirst({ where: { id: a.id, workspaceId: user.workspaceId } });
      if (!el) return Response.json({ ok: false, error: "Element not found." }, { status: 404 });
      const copy = await db.globalElement.create({
        data: { workspaceId: user.workspaceId, name: `${el.name} (copy)`, content: el.content, brandId: el.brandId, updatedBy: user.email },
      });
      await db.globalElementVersion.create({ data: { elementId: copy.id, version: 1, content: el.content, savedBy: user.email } });
      return Response.json({ ok: true, id: copy.id });
    }
  }
}
