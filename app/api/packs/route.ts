import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { buildPack } from "@/lib/server/packs";
import { evaluateSegmentMembers } from "@/lib/server/segments";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";

// Create a pack from explicit contact ids, a saved audience, an import
// batch, or a search query — one endpoint for every entry point.
const Body = z.object({
  name: z.string().min(1).max(120),
  from: z.enum(["contacts", "segment", "batch", "search", "tasks"]),
  contactIds: z.array(z.string()).max(10_000).optional(),
  segmentId: z.string().optional(),
  batchId: z.string().optional(),
  query: z.string().max(100).optional(),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const { from } = parsed.data;
  let contactIds: string[] = [];
  let source = "";

  if (from === "contacts" && parsed.data.contactIds?.length) {
    contactIds = parsed.data.contactIds;
    source = "Contacts selection";
  } else if (from === "segment" && parsed.data.segmentId) {
    const segment = await db.segment.findUnique({ where: { id: parsed.data.segmentId }, include: { rules: true } });
    if (!segment) return Response.json({ ok: false, error: "Audience not found" }, { status: 404 });
    contactIds = await evaluateSegmentMembers(workspaceId, segment.match as "all" | "any", segment.rules);
    source = `Audience: ${segment.name}`;
  } else if (from === "batch" && parsed.data.batchId) {
    const rows = await db.importRow.findMany({
      where: { batchId: parsed.data.batchId, contactId: { not: null } },
      select: { contactId: true },
    });
    const batch = await db.importBatch.findUnique({ where: { id: parsed.data.batchId } });
    contactIds = rows.map((r) => r.contactId!) as string[];
    source = `Import: ${batch?.name ?? parsed.data.batchId}`;
  } else if (from === "search" && parsed.data.query) {
    const q = parsed.data.query;
    const contacts = await db.contact.findMany({
      where: {
        workspaceId,
        OR: [
          { firstName: { contains: q } }, { lastName: { contains: q } },
          { email: { contains: q } }, { phone: { contains: q } },
          { tags: { some: { tag: { name: { contains: q } } } } },
        ],
      },
      select: { id: true }, take: 5_000,
    });
    contactIds = contacts.map((c) => c.id);
    source = `Search: ${q}`;
  } else if (from === "tasks") {
    const tasks = await db.salesTask.findMany({
      where: { workspaceId, status: "open", contactId: { not: null } },
      select: { contactId: true },
    });
    contactIds = [...new Set(tasks.map((t) => t.contactId!))];
    source = "Open sales tasks";
  }

  if (contactIds.length === 0) {
    return Response.json({ ok: false, error: "No contacts matched that selection." }, { status: 422 });
  }

  const pack = await buildPack({
    workspaceId, name: parsed.data.name, source, contactIds, createdBy: user.email,
  });
  return Response.json({ ok: true, id: pack.id, eligible: pack.eligible });
}
