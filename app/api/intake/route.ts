import { NextRequest } from "next/server";
import { z } from "zod";
import { createIntakeFromText } from "@/lib/server/extract";
import { demoWorkspaceId } from "@/lib/server/views";

const Body = z.object({
  kind: z.enum(["paste", "whatsapp", "email", "note"]),
  text: z.string().min(3).max(20_000),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const { item, records } = await createIntakeFromText({
    workspaceId, kind: parsed.data.kind, text: parsed.data.text,
    actor: "steve@vitaliswellness.co.uk",
  });

  return Response.json({
    ok: true,
    itemId: item.id,
    records: records.map((r) => ({
      id: r.id, confidence: r.confidence, duplicateOf: r.duplicateOf,
      fields: JSON.parse(r.fields),
    })),
  });
}
