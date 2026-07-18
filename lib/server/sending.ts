// Email sending provider architecture. Every provider implements the same
// interface; the platform never talks to a vendor SDK directly. The dev
// transport is the default until real credentials exist — it records sends
// truthfully as "sent (dev transport)" and never claims deliverability.
import { db } from "./db";
import { audit } from "./audit";
import { evaluateSegmentMembers } from "./segments";

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

export function activeProvider(): EmailProvider {
  // Staging safety: real sending requires BOTH the explicit env switch AND
  // credentials. Anything else falls back to the dev transport, so no team
  // member can trigger a live email from staging.
  if (
    process.env.EMAIL_SENDING_ENABLED === "true" &&
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.SES_FROM_ADDRESS
  ) {
    return new SesProvider();
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

  await db.campaign.update({ where: { id: campaignId }, data: { status: "sending", audienceSnapshot: eligible.length } });

  const provider = activeProvider();
  let sent = 0, failed = 0;

  for (const contact of eligible) {
    const send = await db.campaignSend.create({
      data: { campaignId, contactId: contact.id, status: "queued" },
    });
    try {
      await provider.send({
        to: contact.email,
        subject: campaign.subject ?? campaign.name,
        html: campaign.content ?? `<p>${campaign.name}</p>`,
        campaignSendId: send.id,
      });
      await db.campaignSend.update({ where: { id: send.id }, data: { status: "sent" } });
      await db.timelineItem.create({
        data: { contactId: contact.id, type: "email_sent", title: "Campaign email sent", detail: `${campaign.name} · via ${provider.name}` },
      });
      sent++;
    } catch (e) {
      await db.campaignSend.update({ where: { id: send.id }, data: { status: "failed" } });
      failed++;
      if (failed === 1) {
        await audit(campaign.workspaceId, "system", "campaign.send_error", e instanceof Error ? e.message : "send failed");
      }
    }
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { status: "sent", sentAt: new Date(), isDemo: false },
  });

  await audit(
    campaign.workspaceId, actor, "campaign.sent",
    `'${campaign.name}' via ${provider.name}: ${sent} sent, ${failed} failed · skipped: ${skippedConsent} no consent, ${skippedSuppressed} suppressed, ${skippedNoEmail} no email`
  );

  return { ok: true as const, sent, failed, skippedConsent, skippedSuppressed, skippedNoEmail, provider: provider.name };
}
