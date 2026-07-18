import { NextRequest } from "next/server";
import { z } from "zod";
import Papa from "papaparse";
import { classifyFile } from "@/lib/server/classify";

const Body = z.object({
  fileName: z.string().max(200),
  sample: z.string().max(100_000), // first chunk of the file is enough
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const { fileName, sample } = parsed.data;
  const head = Papa.parse<Record<string, string>>(sample.trim(), { header: true, preview: 5 });
  const headers = head.meta.fields ?? [];
  const rows = sample.trim().split("\n").length - 1;
  const emails = (sample.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []).length;
  const phones = (sample.match(/\+?\d[\d\s\-().]{7,}\d/g) ?? []).length;

  return Response.json({
    ok: true,
    classification: classifyFile(fileName, headers, sample.slice(0, 4000)),
    stats: { headers, rowsSampled: Math.max(0, rows), emails, phones },
  });
}
