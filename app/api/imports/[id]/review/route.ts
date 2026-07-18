import { NextRequest } from "next/server";
import { z } from "zod";
import { reviewBatch, PLATFORM_FIELDS, type PlatformField } from "@/lib/server/imports";

const Body = z.object({
  mapping: z.record(z.string(), z.enum(PLATFORM_FIELDS)),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const result = await reviewBatch(id, parsed.data.mapping as Record<string, PlatformField>);
  return Response.json({ ok: true, ...result });
}
