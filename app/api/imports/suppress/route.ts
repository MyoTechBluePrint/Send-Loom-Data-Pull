// Direct suppression-list import: adds SuppressionRecords only. Never creates
// marketable contacts, matching the safe destination for this file class.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const Body = z.object({ text: z.string().min(3).max(2_000_000), source: z.string().max(140) });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const emails = [...new Set((parsed.data.text.match(EMAIL_RE) ?? []).map((e) => e.toLowerCase()))];
  let added = 0;
  for (const email of emails) {
    await db.suppressionRecord.upsert({
      where: { workspaceId_email: { workspaceId, email } },
      create: { workspaceId, email, reason: "manual", detail: `Suppression list: ${parsed.data.source}` },
      update: {},
    });
    added++;
  }
  await audit(workspaceId, user.email, "suppression.imported", `${added} emails from '${parsed.data.source}'`);
  return Response.json({ ok: true, added });
}
