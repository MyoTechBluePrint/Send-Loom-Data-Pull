import { NextRequest } from "next/server";
import { z } from "zod";
import { confirmBatch } from "@/lib/server/imports";

const Body = z.object({
  duplicateStrategy: z.enum(["merge_newest", "merge_existing", "skip", "overwrite"]).default("merge_newest"),
  tags: z.array(z.string()).default([]),
  lawfulBasis: z.string().default("Consent (import evidence)"),
  createSegment: z.boolean().default(true),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const result = await confirmBatch({
    batchId: id,
    actor: "steve@vitaliswellness.co.uk",
    ...parsed.data,
  });
  return Response.json({ ok: true, ...result });
}
