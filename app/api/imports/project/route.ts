import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";

const Body = z.object({ name: z.string().min(1).max(120) });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const project = await db.importProject.create({
    data: { workspaceId, name: parsed.data.name, uploadedBy: user.email },
  });
  return Response.json({ ok: true, id: project.id });
}
