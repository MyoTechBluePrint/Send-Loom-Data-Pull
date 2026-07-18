// Logs ad-hoc clipboard extractions that happen outside a saved pack (e.g.
// selected rows copied straight from the Contacts table).
import { NextRequest } from "next/server";
import { z } from "zod";
import { logExport } from "@/lib/server/packs";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";

const Body = z.object({
  dataType: z.string().max(30),
  source: z.string().max(140),
  format: z.string().max(30),
  contacts: z.number().int().min(0),
  notes: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const workspaceId = await demoWorkspaceId();
  await logExport({ workspaceId, user: user.email, ...parsed.data });
  return Response.json({ ok: true });
}
