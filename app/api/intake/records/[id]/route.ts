import { NextRequest } from "next/server";
import { z } from "zod";
import { approveRecord, rejectRecord } from "@/lib/server/extract";
import { currentUser } from "@/lib/server/permissions";

const Body = z.object({
  action: z.enum(["approve", "reject"]),
  edited: z.object({
    name: z.string().optional(),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    interests: z.array(z.string()).optional(),
  }).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // Approvals and rejections land in the ledger under the signed-in user's
  // name, not a hard-coded address.
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const actor = user.email;
  if (parsed.data.action === "reject") {
    await rejectRecord(id, actor);
    return Response.json({ ok: true, rejected: true });
  }

  const edited = parsed.data.edited
    ? { ...parsed.data.edited, email: parsed.data.edited.email || undefined }
    : undefined;
  const result = await approveRecord(id, actor, edited);
  return Response.json({ ok: true, ...result });
}
