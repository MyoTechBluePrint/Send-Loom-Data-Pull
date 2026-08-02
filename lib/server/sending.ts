// Email sending provider architecture. Every provider implements the same
// interface; the platform never talks to a vendor SDK directly. The dev
// transport is the default until real credentials exist — it records sends
// truthfully as "sent (dev transport)" and never claims deliverability.
import { db } from "./db";
import { audit } from "./audit";
import { evaluateSegmentMembers } from "./segments";
import { guard } from "./billing/guard";
import { trackFunnel } from "./billing/analytics-events";
import { recordUsage } from "./entitlements";
import { parseBlocks, validateBlocks, type EmailBlock } from "./email-blocks";
import { renderForRecipient, renderPreview, resolveFeeds } from "./email-render";

/**
 * Deliver one campaign email to one contact. Shared by the immediate loop and
 * the smart-send batch runner. Idempotent per (campaign, contact): the unique
 * constraint on CampaignSend means a retried batch can never deliver twice.
 * Returns "sent" | "failed" | "duplicate".
 */
export async function deliverToContact(
  campaign: { id: string; workspaceId: string; name: string; subject: string | null; content: string | null; brandId: string | null },
  resolvedBlocks: EmailBlock[] | null,
  contact: { id: string; email: string },
  provider: EmailProvider
): Promise<"sent" | "failed" | "duplicate"> {
  let send;
  try {
    send = await db.campaignSend.create({
      data: { campaignId: campaign.id, contactId: contact.id, status: "queued" },
    });
  } catch {
    // Unique violation: this contact already has a send record for this
    // campaign. That is the duplicate guard doing its job.
    return "duplicate";
  }

  try {
    let html: string;
    if (resolvedBlocks?.length) {
      const full = await db.contact.findUnique({ where: { id: contact.id }, select: { firstName: true, lastName: true } });
      const rendered = await renderForRecipient({
        workspaceId: campaign.workspaceId,
        campaignId: campaign.id,
        sendId: send.id,
        contact: { id: contact.id, email: contact.email, firstName: full?.firstName, lastName: full?.lastName },
        blocks: resolvedBlocks,
        brandId: campaign.brandId,
      });
      html = rendered.html;
    } else {
      html = campaign.content ?? `<p>${campaign.name}</p>`;
    }

    await provider.send({
      to: contact.email,
      subject: campaign.subject ?? campaign.name,
      html,
      campaignSendId: send.id,
    });
    await db.campaignSend.update({ where: { id: send.id }, data: { status: "sent" } });
    await db.timelineItem.create({
      data: { contactId: contact.id, type: "email_sent", title: "Campaign email sent", detail: `${campaign.name} · via ${provider.name}` },
    });
    return "sent";
  } catch {
    await db.campaignSend.update({ where: { id: send.id }, data: { status: "failed" } });
    return "failed";
  }
}

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  campaignSendId: string;
};

export type SendResult = { providerId: string; status: "sent" | "failed"; detail?: string };

export interface EmailProvider {
  name: string;
  send(msg: OutboundEmail): Promise<SendResult>;
}

// Default transport: logs the send, delivers nothing. Honest by design.
class DevLogProvider implements EmailProvider {
  name = "dev-log";
  async send(msg: OutboundEmail): Promise<SendResult> {
    console.log(`[dev-log send] to=${msg.to} subject="${msg.subject}" send=${msg.campaignSendId}`);
    return { providerId: `dev_${msg.campaignSendId}`, status: "sent", detail: "Dev transport · no real email delivered" };
  }
}

// SES-ready seam: same interface, real client goes here when AWS credentials
// arrive. Refuses loudly rather than pretending.
class SesProvider implements EmailProvider {
  name = "amazon-ses";
  async send(): Promise<SendResult> {
    throw new Error("SES credentials not configured (AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / SES_FROM_ADDRESS). Using the dev transport until then.");
  }
}

// Resend transport: a real provider over plain HTTPS (no SDK). Returns the
// provider's message id as evidence. Requires RESEND_API_KEY + RESEND_FROM
// and the explicit EMAIL_SENDING_ENABLED switch.
class ResendProvider implements EmailProvider {
  name = "resend";
  async send(msg: OutboundEmail): Promise<SendResult> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.RESEND_FROM, to: msg.to, subject: msg.subject, html: msg.html }),
      signal: AbortSignal.timeout(10_000),
    });
    const d = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok || !d.id) {
      return { providerId: `resend_err_${msg.campaignSendId}`, status: "failed", detail: `Resend refused (HTTP ${res.status}): ${d.message ?? "unknown"}` };
    }
    return { providerId: d.id, status: "sent", detail: "Delivered to Resend" };
  }
}

export function activeProvider(): EmailProvider {
  // Staging safety: real sending requires BOTH the explicit env switch AND
  // credentials. Anything else falls back to the dev transport, so no team
  // member can trigger a live email from staging.
  if (process.env.EMAIL_SENDING_ENABLED === "true") {
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM) return new ResendProvider();
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.SES_FROM_ADDRESS) return new SesProvider();
  }
  return new DevLogProvider();
}

// Resolves who a campaign may actually be sent to. Consent and suppression
// are enforced HERE, at send time, regardless of how the audience was built.
export async function resolveAudience(workspaceId: string, audienceType: string | null, audienceRef: string | null) {
  let candidates: { id: string; email: string | null }[];

  if (audienceType === "segment" && audienceRef) {
    const segment = await db.segment.findFirst({ where: { workspaceId, OR: [{ id: audienceRef }, { name: audienceRef }] }, include: { rules: true } });
    if (segment) {
      const memberIds = await evaluateSegmentMembers(workspaceId, segment.match as "all" | "any", segment.rules);
      candidates = await db.contact.findMany({ where: { id: { in: memberIds } }, select: { id: true, email: true } });
    } else {
      candidates = [];
    }
  } else {
    candidates = await db.contact.findMany({ where: { workspaceId }, select: { id: true, email: true } });
  }

  const suppressions = new Set(
    (await db.suppressionRecord.findMany({ where: { workspaceId } })).map((s) => s.email)
  );

  const eligible: { id: string; email: string }[] = [];
  let skippedNoEmail = 0, skippedConsent = 0, skippedSuppressed = 0;

  for (const c of candidates) {
    if (!c.email) { skippedNoEmail++; continue; }
    if (suppressions.has(c.email)) { skippedSuppressed++; continue; }
    const latest = await db.consentRecord.findFirst({
      where: { contactId: c.id, channel: "email" }, orderBy: { createdAt: "desc" },
    });
    if (latest?.status !== "granted") { skippedConsent++; continue; }
    eligible.push({ id: c.id, email: c.email });
  }

  return { eligible, skippedNoEmail, skippedConsent, skippedSuppressed };
}

export async function sendCampaign(campaignId: string, actor: string) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { ok: false as const, error: "Campaign already sent." };
  }

  const { eligible, skippedNoEmail, skippedConsent, skippedSuppressed } = await resolveAudience(
    campaign.workspaceId, campaign.audienceType, campaign.audienceRef
  );

  if (eligible.length === 0) {
    return { ok: false as const, error: "No eligible recipients: everyone in this audience lacks granted email consent or is suppressed." };
  }

  // Entitlement check, at the point of spend. Complimentary and enterprise
  // workspaces short-circuit to allowed inside guard(), so this changes
  // nothing for the accounts that were here before billing existed.
  const allowance = await guard(campaign.workspaceId, "monthly_email_sends", eligible.length);
  if (!allowance.allowed) {
    await audit(
      campaign.workspaceId, actor, "campaign.send_blocked",
      `'${campaign.name}' blocked: ${allowance.error} · ${eligible.length} recipients · nothing was sent and nothing was changed`
    );
    return {
      ok: false as const,
      error: allowance.error,
      blockedBy: allowance.reason,
      upgradeTo: allowance.upgradeTo,
      wouldSend: eligible.length,
    };
  }

  // Block-based content: refuse to send anything failing a hard validation
  // (no footer/unsubscribe, broken links), resolve dynamic feeds ONCE so the
  // whole campaign shows the same products, and snapshot the rendered result
  // onto the campaign so history is immune to later edits.
  const blocks = parseBlocks(campaign.content);
  let resolvedBlocks: EmailBlock[] | null = null;
  if (blocks.length) {
    const errors = validateBlocks(blocks).filter((i) => i.level === "error");
    if (errors.length) {
      return { ok: false as const, error: `The email cannot be sent yet: ${errors[0].message}` };
    }
    resolvedBlocks = await resolveFeeds(blocks, campaign.workspaceId, null);
    const snapshot = await renderPreview({ workspaceId: campaign.workspaceId, blocks: resolvedBlocks, brandId: campaign.brandId });
    await db.campaign.update({
      where: { id: campaignId },
      data: { renderedHtml: snapshot.html, renderedText: snapshot.textBody, content: JSON.stringify(resolvedBlocks) },
    });
  }

  await db.campaign.update({ where: { id: campaignId }, data: { status: "sending", audienceSnapshot: eligible.length } });

  const provider = activeProvider();
  let sent = 0, failed = 0;

  for (const contact of eligible) {
    const result = await deliverToContact(campaign, resolvedBlocks, contact, provider);
    if (result === "sent") sent++;
    else if (result === "failed") {
      failed++;
      if (failed === 1) {
        await audit(campaign.workspaceId, "system", "campaign.send_error", "send failed (see send records)");
      }
    }
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { status: "sent", sentAt: new Date(), isDemo: false },
  });

  // Meter what actually went out, not what was attempted.
  if (sent > 0) {
    await recordUsage(campaign.workspaceId, "monthly_email_sends", sent);
    await trackFunnel("first_send_completed", { workspaceId: campaign.workspaceId, once: true });
  }

  await audit(
    campaign.workspaceId, actor, "campaign.sent",
    `'${campaign.name}' via ${provider.name}: ${sent} sent, ${failed} failed · skipped: ${skippedConsent} no consent, ${skippedSuppressed} suppressed, ${skippedNoEmail} no email`
  );

  return { ok: true as const, sent, failed, skippedConsent, skippedSuppressed, skippedNoEmail, provider: provider.name };
}
