import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/permissions";
import { renderForRecipient, resolveFeeds } from "@/lib/server/email-render";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { blocksFor, designedContentFor } from "@/lib/server/automations";

// What the email will look like, rendered by the same pipeline that sends
// it, with a placeholder recipient. Preview and delivery can never drift
// apart because they are the same function: blocksFor decides here exactly
// as it does at send time, so a step with a designed shadow campaign
// previews the designed email, not the simple text.

export const dynamic = "force-dynamic";

const Body = z.object({
  subject: z.string().max(200).optional(),
  previewText: z.string().max(200).optional(),
  html: z.string().max(20000).optional(),
  nodeId: z.string().max(60).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const workspaceId = await demoWorkspaceId();
  const automation = await db.automation.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const designed = await designedContentFor(automation.id, parsed.data.nodeId);
  // Feeds resolve exactly as at delivery, so a preview with a dynamic
  // product block shows the same catalogue the send would.
  const blocks = await resolveFeeds(
    blocksFor(
      { label: "Preview", config: JSON.stringify({ html: parsed.data.html, previewText: parsed.data.previewText }) },
      designed.content,
    ),
    workspaceId,
    null,
  );

  const { html } = await renderForRecipient({
    workspaceId,
    campaignId: "preview",
    sendId: "preview",
    contact: { id: "preview", email: user.email, firstName: "Preview", lastName: null },
    blocks,
    brandId: designed.brandId,
  });
  return Response.json({ ok: true, html, subject: parsed.data.subject ?? "", designed: Boolean(designed.content) });
}
