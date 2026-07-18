import { NextRequest } from "next/server";
import { z } from "zod";
import { approveRecord, rejectRecord } from "@/lib/server/extract";

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
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const actor = "steve@vitaliswellness.co.uk";
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
