// Email poll answers arrive as signed GET clicks — the only interaction that
// works in every email client. The signature covers send+poll+option, so an
// answer cannot be forged or replayed onto another contact, and answers are
// unique per contact per poll (a changed mind updates, never duplicates).
//
// A poll answer applies the option's configured tag/property through the
// shared condition actions. It never creates marketing consent.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { verifyEmailAction } from "@/lib/server/email-render";
import { applyActions } from "@/lib/server/conditions";

export async function GET(req: NextRequest, ctx: { params: Promise<{ sendId: string }> }) {
  const { sendId } = await ctx.params;
  const pollId = req.nextUrl.searchParams.get("poll") ?? "";
  const optionKey = req.nextUrl.searchParams.get("option") ?? "";
  const sig = req.nextUrl.searchParams.get("sig") ?? "";

  if (!verifyEmailAction(`${sendId}.${pollId}.${optionKey}`, sig)) {
    return new Response("This link is not valid.", { status: 400 });
  }

  const [send, poll] = await Promise.all([
    db.campaignSend.findUnique({ where: { id: sendId }, include: { contact: true, campaign: true } }),
    db.poll.findUnique({ where: { id: pollId } }),
  ]);
  if (!send || !poll || poll.workspaceId !== send.campaign.workspaceId) {
    return new Response("Link expired.", { status: 404 });
  }

  type Option = { key: string; label: string; tag?: string; propertyKey?: string; propertyValue?: string };
  let options: Option[] = [];
  try { options = JSON.parse(poll.options) as Option[]; } catch { options = []; }
  const option = options.find((o) => o.key === optionKey);
  if (!option) return new Response("Unknown answer.", { status: 400 });

  await db.pollAnswer.upsert({
    where: { pollId_contactId: { pollId, contactId: send.contactId } },
    create: { pollId, contactId: send.contactId, sendId, optionKey },
    update: { optionKey, sendId },
  });

  await applyActions(send.campaign.workspaceId, send.contactId, [
    ...(option.tag ? [{ action: "add_tag" as const, tag: option.tag }] : []),
    ...(option.propertyKey ? [{ action: "set_property" as const, key: option.propertyKey, value: option.propertyValue ?? option.key }] : []),
  ], `poll:${pollId}`);

  return new Response(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Thank you</title></head>
<body style="margin:0;font-family:-apple-system,Segoe UI,sans-serif;background:#faf9f7;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="max-width:420px;padding:40px;text-align:center;">
<div style="width:44px;height:44px;margin:0 auto 16px;border-radius:50%;background:#6d28d9;color:#fff;font-size:20px;line-height:44px;">✓</div>
<h1 style="font-size:20px;color:#14121f;">Thanks, answer recorded</h1>
<p style="font-size:14px;color:#52514e;line-height:1.6;">${poll.question}</p>
<p style="font-size:15px;font-weight:600;color:#14121f;">${option.label}</p>
<p style="font-size:12px;color:#898781;">Changed your mind? Click a different answer in the email.</p>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
