// One-click unsubscribe from an email footer. Signed, so a forwarded email
// or a scraped log line cannot unsubscribe someone else by guessing ids.
//
// Effect: a withdrawn consent record plus a suppression row — the same two
// facts resolveAudience() already enforces before every send.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifyEmailAction } from "@/lib/server/email-render";

export async function GET(req: NextRequest, ctx: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await ctx.params;
  const sig = req.nextUrl.searchParams.get("sig") ?? "";
  if (!verifyEmailAction(`unsub.${sendId}`, sig)) {
    return new Response("This unsubscribe link is not valid.", { status: 400 });
  }

  const send = await db.campaignSend.findUnique({
    where: { id: sendId },
    include: { contact: true, campaign: true },
  });
  if (!send?.contact.email) return new Response("Link expired.", { status: 404 });

  const email = send.contact.email;
  const workspaceId = send.campaign.workspaceId;

  const already = await db.suppressionRecord.findFirst({ where: { workspaceId, email } });
  if (!already) {
    await db.suppressionRecord.create({
      data: { workspaceId, email, reason: "unsubscribed", detail: `Unsubscribed from campaign "${send.campaign.name}"` },
    });
    await db.consentRecord.create({
      data: {
        contactId: send.contactId,
        channel: "email",
        status: "withdrawn",
        lawfulBasis: "Unsubscribe link",
        evidence: `Campaign send ${sendId}`,
        actor: "customer",
      },
    });
    await audit(workspaceId, email, "consent.unsubscribed", `Via campaign "${send.campaign.name}"`);
  }

  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,sans-serif;background:#faf9f7;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:400px;padding:40px;text-align:center;">
<h1 style="font-size:20px;color:#14121f;">You are unsubscribed</h1>
<p style="font-size:14px;color:#52514e;line-height:1.6;">${email} will not receive marketing emails from us again. If this was a mistake, reply to any previous email and we will restore your subscription.</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
