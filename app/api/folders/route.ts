// Data Dropzone library folders. Anyone who can work with data (operator,
// ads, marketing, full access, owner) can create folders and file imports;
// deleting is only allowed when a folder is empty. Every change is audited.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { can, currentUser } from "@/lib/server/permissions";

async function requireDataUser() {
  const user = await currentUser();
  if (!user || !can(user.role, "manage_demo_data")) return null;
  return user;
}

export async function GET() {
  const user = await requireDataUser();
  if (!user) return Response.json({ ok: false }, { status: 403 });
  const workspaceId = await demoWorkspaceId();
  const folders = await db.dataFolder.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    include: { _count: { select: { batches: true } } },
  });
  return Response.json({
    ok: true,
    folders: folders.map((f) => ({ id: f.id, name: f.name, description: f.description, createdBy: f.createdBy, count: f._count.batches })),
  });
}

const CreateBody = z.object({ name: z.string().min(1).max(60), description: z.string().max(200).optional() });

export async function POST(req: NextRequest) {
  const user = await requireDataUser();
  if (!user) return Response.json({ ok: false, error: "No access." }, { status: 403 });
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Folder name required (max 60 chars)." }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const name = parsed.data.name.trim();
  const existing = await db.dataFolder.findUnique({ where: { workspaceId_name: { workspaceId, name } } });
  if (existing) return Response.json({ ok: false, error: "A folder with that name already exists." }, { status: 409 });

  const folder = await db.dataFolder.create({
    data: { workspaceId, name, description: parsed.data.description?.trim() || null, createdBy: user.email },
  });
  await audit(workspaceId, user.email, "folder.created", `Data library folder "${name}" created`);
  return Response.json({ ok: true, folder: { id: folder.id, name: folder.name, count: 0 } });
}

const AssignBody = z.object({ batchId: z.string().min(1), folderId: z.string().min(1).nullable() });

export async function PATCH(req: NextRequest) {
  const user = await requireDataUser();
  if (!user) return Response.json({ ok: false, error: "No access." }, { status: 403 });
  const parsed = AssignBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "batchId and folderId (or null) required." }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const batch = await db.importBatch.findFirst({ where: { id: parsed.data.batchId, workspaceId } });
  if (!batch) return Response.json({ ok: false, error: "Import not found." }, { status: 404 });
  let folderName: string | null = null;
  if (parsed.data.folderId) {
    const folder = await db.dataFolder.findFirst({ where: { id: parsed.data.folderId, workspaceId } });
    if (!folder) return Response.json({ ok: false, error: "Folder not found." }, { status: 404 });
    folderName = folder.name;
  }
  await db.importBatch.update({ where: { id: batch.id }, data: { folderId: parsed.data.folderId } });
  await audit(workspaceId, user.email, "folder.filed", `"${batch.name}" ${folderName ? `filed into "${folderName}"` : "moved out of its folder"}`);
  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const user = await requireDataUser();
  if (!user) return Response.json({ ok: false, error: "No access." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ ok: false, error: "id required" }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const folder = await db.dataFolder.findFirst({ where: { id, workspaceId }, include: { _count: { select: { batches: true } } } });
  if (!folder) return Response.json({ ok: false, error: "Folder not found." }, { status: 404 });
  if (folder._count.batches > 0) {
    return Response.json({ ok: false, error: "Folder still has imports in it. Move them out first." }, { status: 400 });
  }
  await db.dataFolder.delete({ where: { id } });
  await audit(workspaceId, user.email, "folder.deleted", `Empty data library folder "${folder.name}" deleted`);
  return Response.json({ ok: true });
}
