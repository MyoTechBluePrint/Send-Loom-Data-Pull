import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/permissions";
import { renderForRecipient } from "@/lib/server/email-render";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { newBlockId, type EmailBlock } from "@/lib/server/email-blocks";

// What the email will look like, rendered by the same pipeline that sends
// it, with a placeholder recipient. Preview and delivery can never drift
// apart because they are the same function.

export const dynamic = "force-dynamic";

const Body = z.object({
  subject: z.string().max(200).optional(),
  previewText: z.string().max(200).optional(),
  html: z.string().max(20000).optional(),
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

  const preheader = parsed.data.previewText?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${parsed.data.previewText.trim()}</div>`
    : "";
  const blocks: EmailBlock[] = [
    ...(preheader ? [{ id: newBlockId(), type: "text" as const, html: preheader }] : []),
    { id: newBlockId(), type: "logo" as const },
    { id: newBlockId(), type: "text" as const, html: parsed.data.html?.trim() || "<p>Thanks for signing up. We'll be in touch.</p>" },
    { id: newBlockId(), type: "footer" as const },
  ];

  const { html } = await renderForRecipient({
    workspaceId,
    campaignId: "preview",
    sendId: "preview",
    contact: { id: "preview", email: user.email, firstName: "Preview", lastName: null },
    blocks,
  });
  return Response.json({ ok: true, html, subject: parsed.data.subject ?? "" });
}
