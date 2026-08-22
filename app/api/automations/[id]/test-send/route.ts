import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { activeProvider } from "@/lib/server/sending";
import { renderForRecipient } from "@/lib/server/email-render";
import { newBlockId, type EmailBlock } from "@/lib/server/email-blocks";
import { audit } from "@/lib/server/audit";

// A controlled test send: one email, to the signed-in user only, through
// whatever transport is live, and the reply says plainly which transport
// that was. It can never reach a customer because the recipient is always
// the person pressing the button.

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
  const automation = await db.automation.findFirst({ where: { id, workspaceId }, select: { name: true } });
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const preheader = parsed.data.previewText?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${parsed.data.previewText.trim()}</div>`
    : "";
  const blocks: EmailBlock[] = [
    ...(preheader ? [{ id: newBlockId(), type: "text" as const, html: preheader }] : []),
    { id: newBlockId(), type: "logo" as const },
    { id: newBlockId(), type: "text" as const, html: parsed.data.html?.trim() || "<p>Test.</p>" },
    { id: newBlockId(), type: "footer" as const },
  ];
  const { html } = await renderForRecipient({
    workspaceId,
    campaignId: "test",
    sendId: `test-${Date.now()}`,
    contact: { id: "test", email: user.email, firstName: user.email.split("@")[0], lastName: null },
    blocks,
  });

  const provider = activeProvider();
  const result = await provider.send({
    to: user.email,
    subject: `[Test] ${parsed.data.subject || automation.name}`,
    html,
    campaignSendId: `test-${Date.now()}`,
  });
  await audit(workspaceId, user.email, "automation.test_send", `'${automation.name}' → ${user.email} via ${provider.name} (${result.status})`);

  return Response.json({
    ok: result.status !== "failed",
    transport: provider.name,
    real: provider.name !== "dev-log",
    status: result.status,
    to: user.email,
    providerMessageId: result.status === "sent" ? result.providerId : null,
    detail: result.detail ?? null,
  });
}
