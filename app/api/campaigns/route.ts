import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({
  name: z.string().min(1).max(140),
  subject: z.string().max(200).optional(),
  audienceRef: z.string().max(140).optional(),
});

export async function POST(req: NextRequest) {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const campaign = await db.campaign.create({
    data: {
      workspaceId, name: parsed.data.name, subject: parsed.data.subject,
      status: "draft", audienceType: parsed.data.audienceRef ? "segment" : null,
      audienceRef: parsed.data.audienceRef ?? null,
    },
  });
  await audit(workspaceId, actor, "campaign.draft_created", `'${parsed.data.name}'`);
  return Response.json({ ok: true, id: campaign.id });
}
