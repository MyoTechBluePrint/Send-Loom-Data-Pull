import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { activeProvider } from "@/lib/server/sending";
import { renderForRecipient, resolveFeeds } from "@/lib/server/email-render";
import { blocksFor, designedContentFor } from "@/lib/server/automations";
import { audit } from "@/lib/server/audit";

// A controlled test send: one email, to the signed-in user only, through
// whatever transport is live, and the reply says plainly which transport
// that was. It can never reach a customer because the recipient is always
// the person pressing the button. Content comes from blocksFor, the same
// decision the real send makes: a designed step tests its designed email.

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
  const automation = await db.automation.findFirst({ where: { id, workspaceId }, select: { id: true, name: true } });
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const designed = await designedContentFor(automation.id, parsed.data.nodeId);
  // Same resolution as delivery: feeds become concrete products, the brand
  // travels, so the test email in the inbox is the email customers get.
  const blocks = await resolveFeeds(
    blocksFor(
      { label: "Test", config: JSON.stringify({ html: parsed.data.html?.trim() || "<p>Test.</p>", previewText: parsed.data.previewText }) },
      designed.content,
    ),
    workspaceId,
    null,
  );
  const { html } = await renderForRecipient({
    workspaceId,
    campaignId: "test",
    sendId: `test-${Date.now()}`,
    contact: { id: "test", email: user.email, firstName: user.email.split("@")[0], lastName: null },
    blocks,
    brandId: designed.brandId,
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
