// Tag management. Tags are identified by their id everywhere; the name is a
// label that can change without breaking anything that references the tag.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";

export async function GET(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const showArchived = req.nextUrl.searchParams.get("archived") === "1";
  const tags = await db.tag.findMany({
    where: { workspaceId: user.workspaceId, archived: showArchived },
    include: { _count: { select: { contacts: true } } },
    orderBy: { name: "asc" },
  });

  // Segment rules referencing each tag by name = the dependency view.
  const rules = await db.segmentRule.findMany({
    where: { field: "Tag", segment: { workspaceId: user.workspaceId } },
    include: { segment: { select: { name: true } } },
  });

  return Response.json({
    ok: true,
    tags: tags.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      color: t.color,
      archived: t.archived,
      contacts: t._count.contacts,
      usedBySegments: rules.filter((r) => t.name.toLowerCase().includes(r.value.toLowerCase()) || r.value.toLowerCase().includes(t.name.toLowerCase())).map((r) => r.segment.name),
    })),
  });
}

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), name: z.string().min(1).max(60), description: z.string().max(200).optional(), color: z.string().max(20).optional() }),
  z.object({ action: z.literal("update"), id: z.string(), name: z.string().min(1).max(60).optional(), description: z.string().max(200).nullable().optional(), color: z.string().max(20).nullable().optional() }),
  z.object({ action: z.literal("archive"), id: z.string(), archived: z.boolean() }),
  z.object({ action: z.literal("merge"), fromId: z.string(), intoId: z.string() }),
  z.object({ action: z.literal("delete"), id: z.string() }),
]);

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unrecognised action." }, { status: 400 });
  const a = parsed.data;
  const owned = async (id: string) => db.tag.findFirst({ where: { id, workspaceId: user.workspaceId } });

  switch (a.action) {
    case "create": {
      const existing = await db.tag.findUnique({ where: { workspaceId_name: { workspaceId: user.workspaceId, name: a.name } } });
      if (existing) return Response.json({ ok: false, error: "A tag with this name already exists." }, { status: 409 });
      const tag = await db.tag.create({
        data: { workspaceId: user.workspaceId, name: a.name, description: a.description ?? null, color: a.color ?? null },
      });
      await audit(user.workspaceId, user.email, "tag.created", `'${a.name}'`);
      return Response.json({ ok: true, id: tag.id });
    }
    case "update": {
      const tag = await owned(a.id);
      if (!tag) return Response.json({ ok: false, error: "Tag not found." }, { status: 404 });
      await db.tag.update({ where: { id: tag.id }, data: { name: a.name, description: a.description, color: a.color } });
      if (a.name && a.name !== tag.name) await audit(user.workspaceId, user.email, "tag.renamed", `'${tag.name}' → '${a.name}'`);
      return Response.json({ ok: true });
    }
    case "archive": {
      const tag = await owned(a.id);
      if (!tag) return Response.json({ ok: false, error: "Tag not found." }, { status: 404 });
      await db.tag.update({ where: { id: tag.id }, data: { archived: a.archived } });
      await audit(user.workspaceId, user.email, a.archived ? "tag.archived" : "tag.restored", `'${tag.name}'`);
      return Response.json({ ok: true });
    }
    case "merge": {
      const [from, into] = await Promise.all([owned(a.fromId), owned(a.intoId)]);
      if (!from || !into || from.id === into.id) return Response.json({ ok: false, error: "Pick two different tags." }, { status: 400 });
      const links = await db.contactTag.findMany({ where: { tagId: from.id } });
      for (const link of links) {
        await db.contactTag.upsert({
          where: { contactId_tagId: { contactId: link.contactId, tagId: into.id } },
          create: { contactId: link.contactId, tagId: into.id },
          update: {},
        });
      }
      await db.contactTag.deleteMany({ where: { tagId: from.id } });
      await db.tag.update({ where: { id: from.id }, data: { archived: true, description: `Merged into "${into.name}"` } });
      await audit(user.workspaceId, user.email, "tag.merged", `'${from.name}' (${links.length} contacts) merged into '${into.name}'`);
      return Response.json({ ok: true, moved: links.length });
    }
    case "delete": {
      const tag = await owned(a.id);
      if (!tag) return Response.json({ ok: false, error: "Tag not found." }, { status: 404 });
      const inUse = await db.contactTag.count({ where: { tagId: tag.id } });
      if (inUse > 0) {
        // Unsafe deletion is refused, not confirmed away: archive or merge.
        return Response.json({ ok: false, error: `This tag is on ${inUse} contact${inUse === 1 ? "" : "s"}. Merge or archive it instead of deleting.` }, { status: 409 });
      }
      await db.tag.delete({ where: { id: tag.id } });
      await audit(user.workspaceId, user.email, "tag.deleted", `'${tag.name}' (was unused)`);
      return Response.json({ ok: true });
    }
  }
}
