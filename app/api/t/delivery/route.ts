// Delivery events from the email provider (Resend webhooks): bounces and
// complaints. This is what arms the smart-send safety rails — without it,
// bounce and complaint rates can never rise above zero.
//
// Verified with Resend's svix signature scheme: HMAC-SHA256 over
// "<id>.<timestamp>.<raw body>" with the base64 secret after "whsec_",
// compared against the space-separated v1 signatures. No secret configured =
// endpoint disabled, honestly, rather than accepting unsigned reports.
//
// Effects are idempotent and conservative:
//   bounced    -> send marked bounced + hard suppression (address is dead)
//   complained -> send marked complained + suppression + withdrawn consent
import { createHmac, timingSafeEqual } from "node:crypto";
import { recordConsent } from "@/lib/server/consent";
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

function verifySvix(raw: string, req: NextRequest, secret: string): boolean {
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const sigs = req.headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - parseInt(ts, 10)) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${raw}`).digest("base64");
  return sigs.split(" ").some((entry) => {
    const [, sig] = entry.split(",");
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "Delivery webhooks are not configured (RESEND_WEBHOOK_SECRET)." }, { status: 501 });
  }

  const raw = await req.text();
  if (!verifySvix(raw, req, secret)) {
    return Response.json({ ok: false, error: "Invalid signature" }, { status: 401 });
  }

  let event: { type?: string; data?: { to?: string[] | string; email?: string } };
  try { event = JSON.parse(raw) as typeof event; } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  // Delivery confirmation closes the honesty loop: "delivered" is only ever
  // written here, on the provider's own word, matched by the message id it
  // gave us at acceptance.
  const messageId = (event.data as { email_id?: string } | undefined)?.email_id;

  if (event.type === "email.delivered") {
    if (messageId) {
      // Idempotent by construction: only a row still in "sent" moves, so a
      // replayed webhook changes nothing the second time.
      const updated = await db.campaignSend.updateMany({
        where: { providerMessageId: messageId, status: "sent" },
        data: { status: "delivered" },
      });
      return Response.json({ ok: true, delivered: updated.count });
    }
    return Response.json({ ok: true, ignored: "no email_id" });
  }

  // Engagement and failure events, matched on the provider's own id and
  // written only when the field is still empty, so replays stay harmless.
  if (event.type === "email.opened" && messageId) {
    const updated = await db.campaignSend.updateMany({
      where: { providerMessageId: messageId, openedAt: null },
      data: { openedAt: new Date() },
    });
    return Response.json({ ok: true, opened: updated.count });
  }
  if (event.type === "email.clicked" && messageId) {
    await db.campaignSend.updateMany({
      where: { providerMessageId: messageId, openedAt: null },
      data: { openedAt: new Date() },
    });
    const updated = await db.campaignSend.updateMany({
      where: { providerMessageId: messageId, clickedAt: null },
      data: { clickedAt: new Date() },
    });
    return Response.json({ ok: true, clicked: updated.count });
  }
  if (event.type === "email.failed" && messageId) {
    const updated = await db.campaignSend.updateMany({
      where: { providerMessageId: messageId, status: { in: ["sent", "queued"] } },
      data: { status: "failed" },
    });
    return Response.json({ ok: true, failed: updated.count });
  }
  if (event.type === "email.delivery_delayed") {
    // Delays resolve themselves into delivered or bounced; noted, not acted on.
    return Response.json({ ok: true, noted: "delayed" });
  }

  const kind = event.type === "email.bounced" ? "bounced" : event.type === "email.complained" ? "complained" : null;
  if (!kind) return Response.json({ ok: true, ignored: event.type });

  const to = Array.isArray(event.data?.to) ? event.data?.to[0] : event.data?.to ?? event.data?.email;
  const email = to?.toLowerCase().trim();
  if (!email) return Response.json({ ok: true, ignored: "no recipient" });

  const contacts = await db.contact.findMany({ where: { email }, select: { id: true, workspaceId: true } });
  for (const c of contacts) {
    // Most recent sent record becomes the bounce/complaint carrier, which is
    // what the per-campaign safety rates read.
    const messageId = (event.data as { email_id?: string } | undefined)?.email_id;
    const send =
      (messageId
        ? await db.campaignSend.findFirst({ where: { providerMessageId: messageId } })
        : null) ??
      (await db.campaignSend.findFirst({
        where: { contactId: c.id, status: { in: ["sent", "delivered"] } },
        orderBy: { createdAt: "desc" },
      }));
    if (send) await db.campaignSend.update({ where: { id: send.id }, data: { status: kind } });

    const suppressed = await db.suppressionRecord.findFirst({ where: { workspaceId: c.workspaceId, email } });
    if (!suppressed) {
      await db.suppressionRecord.create({
        data: { workspaceId: c.workspaceId, email, reason: kind, detail: `Provider reported ${kind}` },
      });
    }
    if (kind === "complained") {
      await recordConsent({
        contactId: c.id,
        workspaceId: c.workspaceId,
        changes: [{ channel: "email", status: "withdrawn" }],
        source: "Spam complaint",
        actor: "provider",
        evidence: "Provider complaint webhook",
        allowReactivate: true,
      });
    }
    await audit(c.workspaceId, "provider", `delivery.${kind}`, `${email} · suppressed, safety rates updated`);
  }

  return Response.json({ ok: true, updated: contacts.length });
}
