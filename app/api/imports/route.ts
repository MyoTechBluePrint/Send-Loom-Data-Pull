import { NextRequest } from "next/server";
import { z } from "zod";
import { createBatchFromCsv } from "@/lib/server/imports";
import { demoWorkspaceId } from "@/lib/server/views";

const Body = z.object({
  name: z.string().min(1),
  source: z.string().min(1),
  sourceType: z.string().default("import"),
  csv: z.string().min(1).max(5_000_000),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  try {
    const result = await createBatchFromCsv({
      workspaceId,
      name: parsed.data.name,
      source: parsed.data.source,
      sourceType: parsed.data.sourceType,
      uploadedBy: "steve@vitaliswellness.co.uk",
      csv: parsed.data.csv,
    });
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Import failed" }, { status: 422 });
  }
}
