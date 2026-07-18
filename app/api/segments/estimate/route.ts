import { NextRequest } from "next/server";
import { z } from "zod";
import { evaluateSegment } from "@/lib/server/segments";
import { demoWorkspaceId } from "@/lib/server/views";

const Body = z.object({
  match: z.enum(["all", "any"]),
  rules: z.array(z.object({
    field: z.string(), operator: z.string(), value: z.string(),
    exclude: z.boolean().optional(),
  })).max(20),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const result = await evaluateSegment(workspaceId, parsed.data.match, parsed.data.rules);
  return Response.json({ ok: true, ...result });
}
