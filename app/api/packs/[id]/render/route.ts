import { NextRequest } from "next/server";
import { z } from "zod";
import { renderPack, logExport, type CopyMode } from "@/lib/server/packs";
import { currentUser } from "@/lib/server/permissions";

const MODES = ["emails", "bcc", "name_email", "phones", "whatsapp", "call_sheet", "outreach_rows", "csv", "mailchimp_csv", "klaviyo_csv", "crm_csv"] as const;

const Body = z.object({
  mode: z.enum(MODES),
  batchIndex: z.number().int().min(0).optional(),
  batchSize: z.number().int().min(5).max(1000).optional(),
  download: z.boolean().optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const batch = parsed.data.batchIndex !== undefined && parsed.data.batchSize
    ? { index: parsed.data.batchIndex, size: parsed.data.batchSize }
    : undefined;

  const result = await renderPack(id, parsed.data.mode as CopyMode, batch);
  if (result.error) return Response.json({ ok: false, error: result.error }, { status: 422 });

  await logExport({
    workspaceId: result.pack.workspaceId,
    packId: result.pack.id,
    user: user.email,
    dataType: "pack",
    source: result.pack.source,
    format: parsed.data.mode,
    contacts: result.count,
    excludedSuppressed: result.pack.excludedSuppressed,
    excludedUnsubscribed: result.pack.excludedUnsubscribed,
    duplicatesRemoved: result.pack.duplicatesRemoved,
    batch: batch ? `${batch.index + 1} (size ${batch.size})` : undefined,
    notes: parsed.data.download ? "download" : "clipboard",
  });

  if (parsed.data.download) {
    const ext = parsed.data.mode.includes("csv") ? "csv" : "txt";
    return new Response(result.text, {
      headers: {
        "Content-Type": ext === "csv" ? "text/csv" : "text/plain",
        "Content-Disposition": `attachment; filename="${result.pack.name.replace(/[^a-z0-9-]/gi, "_")}${batch ? `_batch${batch.index + 1}` : ""}.${ext}"`,
      },
    });
  }
  return Response.json({ ok: true, text: result.text, count: result.count });
}
