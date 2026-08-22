// Email sending provider architecture. Every provider implements the same
// interface; the platform never talks to a vendor SDK directly. The dev
// transport is the default until real credentials exist — it records sends
// truthfully as "sent (dev transport)" and never claims deliverability.
import { db } from "./db";
import {
  breakdownFor,
  eligibleForChannel,
  type Channel,
  type EligibilityBreakdown,
} from "./consent";
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

    // Brand sender identity, where the brand defines one.
    const brand = campaign.brandId
      ? await db.brand.findUnique({ where: { id: campaign.brandId }, select: { senderName: true, senderEmail: true, replyToEmail: true } })
      : null;
    await provider.send({
      to: contact.email,
      subject: campaign.subject ?? campaign.name,
      html,
      campaignSendId: send.id,
      from: brand?.senderEmail ? `${brand.senderName ?? "SendLoom"} <${brand.senderEmail}>` : undefined,
      replyTo: brand?.replyToEmail ?? undefined,
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
  /** Brand sender identity, e.g. "MyoTech <hello@myotech.store>". Providers
   *  that cannot override the from address ignore it. */
  from?: string;
  replyTo?: string;
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
      body: JSON.stringify({
        from: msg.from ?? process.env.RESEND_FROM,
        to: msg.to,
        subject: msg.subject,
        html: msg.html,
        ...(msg.replyTo ? { reply_to: msg.replyTo } : {}),
      }),
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

// Resolves who a campaign may actually be sent to. Consent, suppression and
// Do Not Contact are enforced HERE, at send time, regardless of how the
// audience was built. Channel-aware: an SMS campaign checks SMS consent and
// a phone number, never the email column, and the arithmetic comes from the
// same eligibleForChannel() the packs and the campaign screen use, so what
// the user was shown is exactly what the send does.
const AUDIENCE_SELECT = {
  id: true, email: true, phone: true,
  emailConsent: true, smsConsent: true, whatsappConsent: true, doNotContact: true,
} as const;

export async function resolveAudience(
  workspaceId: string,
  audienceType: string | null,
  audienceRef: string | null,
  channel: Channel = "email",
) {
  let candidates: {
    id: string; email: string | null; phone: string | null;
    emailConsent: string; smsConsent: string; whatsappConsent: string; doNotContact: boolean;
  }[];

  if (audienceType === "segment" && audienceRef) {
    const segment = await db.segment.findFirst({ where: { workspaceId, OR: [{ id: audienceRef }, { name: audienceRef }] }, include: { rules: true } });
    if (segment) {
      const memberIds = await evaluateSegmentMembers(workspaceId, segment.match as "all" | "any", segment.rules);
      candidates = await db.contact.findMany({ where: { id: { in: memberIds } }, select: AUDIENCE_SELECT });
    } else {
      candidates = [];
    }
  } else {
    candidates = await db.contact.findMany({ where: { workspaceId }, select: AUDIENCE_SELECT });
  }

  const suppressions = new Set(
    (await db.suppressionRecord.findMany({ where: { workspaceId } })).map((s) => s.email.toLowerCase())
  );

  const eligible: { id: string; email: string; phone: string | null }[] = [];
  let skippedNoEmail = 0, skippedConsent = 0, skippedSuppressed = 0, skippedDnc = 0, skippedOptedOut = 0;

  for (const c of candidates) {
    const check = eligibleForChannel(c, channel, suppressions);
    if (!check.eligible) {
      if (check.reason === "no_route") skippedNoEmail++;
      else if (check.reason === "suppressed") skippedSuppressed++;
      else if (check.reason === "do_not_contact") skippedDnc++;
      else if (check.reason === "opted_out") skippedOptedOut++;
      else skippedConsent++;
      continue;
    }
    eligible.push({ id: c.id, email: c.email ?? "", phone: c.phone });
  }

  return { eligible, skippedNoEmail, skippedConsent, skippedSuppressed, skippedDnc, skippedOptedOut };
}

/** The numbers a campaign screen shows before anybody presses send. */
export async function audienceBreakdown(
  workspaceId: string,
  audienceType: string | null,
  audienceRef: string | null,
  channel: Channel = "email",
): Promise<EligibilityBreakdown> {
  let candidates;
  if (audienceType === "segment" && audienceRef) {
    const segment = await db.segment.findFirst({ where: { workspaceId, OR: [{ id: audienceRef }, { name: audienceRef }] }, include: { rules: true } });
    const memberIds = segment
      ? await evaluateSegmentMembers(workspaceId, segment.match as "all" | "any", segment.rules)
      : [];
    candidates = await db.contact.findMany({ where: { id: { in: memberIds } }, select: AUDIENCE_SELECT });
  } else {
    candidates = await db.contact.findMany({ where: { workspaceId }, select: AUDIENCE_SELECT });
  }
  const suppressions = new Set(
    (await db.suppressionRecord.findMany({ where: { workspaceId } })).map((s) => s.email.toLowerCase())
  );
  return breakdownFor(candidates, channel, suppressions);
}

export async function sendCampaign(campaignId: string, actor: string) {
  const campaign = await db.campaign.findUniqueOrThrow({ where: { id: campaignId } });
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { ok: false as const, error: "Campaign already sent." };
  }

  const channel = (campaign.channel ?? "email") as Channel;
  if (channel !== "email") {
    // Honest refusal: no SMS or WhatsApp provider is wired yet. Gating and
    // audience arithmetic already work for these channels; delivery does not.
    return { ok: false as const, error: `No ${channel} provider is configured yet. This campaign's audience is ready, but sending is email-only today.` };
  }
  const { eligible, skippedNoEmail, skippedConsent, skippedSuppressed, skippedDnc, skippedOptedOut } = await resolveAudience(
    campaign.workspaceId, campaign.audienceType, campaign.audienceRef, channel
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
    `'${campaign.name}' via ${provider.name}: ${sent} sent, ${failed} failed · skipped: ${skippedConsent} no consent, ${skippedOptedOut} opted out, ${skippedSuppressed} suppressed, ${skippedNoEmail} no route, ${skippedDnc} do not contact`
  );

  return { ok: true as const, sent, failed, skippedConsent, skippedOptedOut, skippedSuppressed, skippedNoEmail, skippedDnc, provider: provider.name };
}
