import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { evaluateSegment } from "@/lib/server/segments";
import { demoWorkspaceId } from "@/lib/server/views";
import { audit } from "@/lib/server/audit";

const Body = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  match: z.enum(["all", "any"]),
  rules: z.array(z.object({
    field: z.string(), operator: z.string(), value: z.string(),
    exclude: z.boolean().optional(),
  })).min(1).max(20),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const { count, revenue } = await evaluateSegment(workspaceId, parsed.data.match, parsed.data.rules);

  const segment = await db.segment.create({
    data: {
      workspaceId, name: parsed.data.name, description: parsed.data.description,
      match: parsed.data.match, count, revenue, computedAt: new Date(),
      rules: { create: parsed.data.rules.map((r) => ({ field: r.field, operator: r.operator, value: r.value, exclude: r.exclude ?? false })) },
    },
  });
  await audit(workspaceId, "steve@vitaliswellness.co.uk", "segment.created", `'${parsed.data.name}' (${count} contacts)`);

  return Response.json({ ok: true, id: segment.id, count, revenue });
}
