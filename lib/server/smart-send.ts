// Smart sending: gradual campaign delivery through backend batch jobs.
//
// The model, deliberately simple and restartable:
//   - Starting a gradual campaign snapshots the eligible audience into
//     CampaignSend rows (status "queued") and computes the batch cadence from
//     the chosen duration. The unique (campaignId, contactId) constraint means
//     this is idempotent: restarting can never enqueue anyone twice.
//   - runDueBatches() — called by the same cron seam as billing — delivers one
//     batch per due campaign per tick. Before EVERY batch it re-checks
//     suppression and consent for each recipient, honours the send window,
//     and applies the safety rails (bounce/complaint thresholds, workspace
//     sending rights).
//   - Pause, resume and cancel are one status field. Cancel marks the unsent
//     rows "cancelled" so the numbers always add up.

import { db } from "@/lib/server/db";
import { eligibleForChannel, type Channel } from "./consent";
import { recordSendOutcome } from "./sending";
import { audit } from "./audit";
import { guard } from "./billing/guard";
import { canSend } from "./subscription-states";
import { resolveEntitlements } from "./entitlements";
import { recordUsage } from "./entitlements";
import {
  activeProvider, resolveAudience, deliverToContact,
} from "./sending";
import { parseBlocks, validateBlocks } from "./email-blocks";
import { renderPreview, resolveFeeds } from "./email-render";
import { trackFunnel } from "./billing/analytics-events";

export const DURATIONS_MIN = [15, 30, 60, 120, 240, 480, 720, 1440] as const;

/** Safety rails: pause a run rather than keep sending into trouble. */
export const SAFETY = {
  maxBounceRate: 0.05,      // 5% of a campaign's attempted sends
  maxComplaintRate: 0.002,  // 0.2%
  minSampleForRates: 50,    // do not judge rates on tiny samples
};

// Row claiming. Two runners can overlap (a second server instance during a
// deploy, the admin run button beside the in-process ticker), and both may
// read the same queued batch. Before a row goes to the provider it is flipped
// queued -> "sending" with a conditional update; only the runner whose update
// counted owns the row, everyone else skips it. recordSendOutcome, or the
// failure handling below, moves the row out of "sending" again.
//
// While a row is claimed, the claim time rides in providerMessageId as
// "claim_<epoch ms>". The schema is frozen (no new columns), and that column
// is free until the outcome overwrites it with the provider's real reference.
// Real provider ids ("re_…", "dev_…") can never look like a stamp, so the
// delivery webhook's providerMessageId lookups are unaffected.
export const CLAIM_STAMP_PREFIX = "claim_";
/** A claim older than this is a corpse from a dead process, not a send in
 *  flight: no provider call outlives its 10s timeout, let alone this. The
 *  retry sweep fails such rows so their campaigns can finish honestly. */
export const STRANDED_SENDING_MS = 15 * 60_000;

export const claimStamp = (at: Date) => `${CLAIM_STAMP_PREFIX}${at.getTime()}`;

/** Epoch ms a "sending" row was claimed, or null when the stamp is unreadable. */
export function claimedAtFromStamp(stamp: string | null): number | null {
  if (!stamp?.startsWith(CLAIM_STAMP_PREFIX)) return null;
  const at = Number(stamp.slice(CLAIM_STAMP_PREFIX.length));
  return Number.isFinite(at) ? at : null;
}

export type SmartSendProgress = {
  state: string | null;
  sent: number;
  queued: number;
  failed: number;
  suppressed: number;
  cancelled: number;
  total: number;
  nextBatchAt: string | null;
  estimatedCompletionAt: string | null;
  pauseReason: string | null;
};

/**
 * Start a campaign send. mode=immediate delegates to the existing loop;
 * mode=gradual enqueues and lets the tick deliver.
 */
export async function startSmartSend(campaignId: string, actor: string, opts: {
  mode: "immediate" | "gradual";
  durationMins?: number;
  batchSize?: number;
  windowStart?: number | null; // hour 0-23
  windowEnd?: number | null;
}): Promise<{ ok: true; queued: number } | { ok: false; error: string }> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status === "sent" || campaign.status === "sending") {
    return { ok: false, error: "Campaign already sent or sending." };
  }

  // Content gate: same rule as immediate sending.
  const blocks = parseBlocks(campaign.content);
  if (blocks.length) {
    const errors = validateBlocks(blocks).filter((i) => i.level === "error");
    if (errors.length) return { ok: false, error: `The email cannot be sent yet: ${errors[0].message}` };
  } else if (!campaign.content?.trim()) {
    // No blocks and no legacy HTML either. Every validation above is
    // skipped for empty content, so without this line "send" on a blank
    // template row would deliver the placeholder body — no unsubscribe
    // link, no message — to the whole eligible list.
    return { ok: false, error: "This campaign has no email content yet. Open the email editor and build it before sending." };
  }

  const { eligible } = await resolveAudience(campaign.workspaceId, campaign.audienceType, campaign.audienceRef);
  if (!eligible.length) return { ok: false, error: "No eligible recipients (consent and suppression rules applied)." };

  const allowance = await guard(campaign.workspaceId, "monthly_email_sends", eligible.length);
  if (!allowance.allowed) return { ok: false, error: allowance.error };

  // Freeze the content: resolve feeds once, snapshot the render.
  let resolved = blocks;
  if (blocks.length) {
    resolved = await resolveFeeds(blocks, campaign.workspaceId, null);
    const snapshot = await renderPreview({ workspaceId: campaign.workspaceId, blocks: resolved, brandId: campaign.brandId });
    await db.campaign.update({
      where: { id: campaignId },
      data: { renderedHtml: snapshot.html, renderedText: snapshot.textBody, content: JSON.stringify(resolved) },
    });
  }

  // Enqueue everyone, idempotently.
  let queued = 0;
  for (const c of eligible) {
    try {
      await db.campaignSend.create({ data: { campaignId, contactId: c.id, status: "queued" } });
      queued++;
    } catch {
      /* already queued from an earlier attempt: fine */
    }
  }

  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 100, 1000));
  const durationMins = opts.mode === "gradual" ? Math.max(15, Math.min(opts.durationMins ?? 60, 7 * 1440)) : 0;

  await db.campaign.update({
    where: { id: campaignId },
    data: {
      status: "sending",
      audienceSnapshot: eligible.length,
      sendMode: opts.mode,
      sendDurationMins: durationMins || null,
      sendBatchSize: batchSize,
      sendWindowStart: opts.windowStart ?? null,
      sendWindowEnd: opts.windowEnd ?? null,
      sendState: "running",
      nextBatchAt: new Date(),
    },
  });

  await audit(
    campaign.workspaceId, actor, "campaign.smart_send_started",
    `'${campaign.name}' · ${opts.mode}${durationMins ? ` over ${durationMins}m` : ""} · ${eligible.length} recipients · batches of ${batchSize}`
  );

  if (opts.mode === "immediate") {
    // Deliver now through the batch runner until drained.
    let guardRail = 0;
    while (guardRail++ < 1000) {
      const done = await runCampaignBatch(campaignId);
      if (done !== "continue") break;
    }
  }

  return { ok: true, queued };
}

export async function pauseSmartSend(campaignId: string, actor: string, reason = "Paused by operator") {
  await db.campaign.update({ where: { id: campaignId }, data: { sendState: "paused", sendPausedAt: new Date(), sendPauseReason: reason } });
  const c = await db.campaign.findUnique({ where: { id: campaignId }, select: { workspaceId: true, name: true } });
  if (c) await audit(c.workspaceId, actor, "campaign.send_paused", `'${c.name}': ${reason}`);
}

export async function resumeSmartSend(campaignId: string, actor: string) {
  await db.campaign.update({ where: { id: campaignId }, data: { sendState: "running", sendPauseReason: null, nextBatchAt: new Date() } });
  const c = await db.campaign.findUnique({ where: { id: campaignId }, select: { workspaceId: true, name: true } });
  if (c) await audit(c.workspaceId, actor, "campaign.send_resumed", `'${c.name}'`);
}

export async function cancelSmartSend(campaignId: string, actor: string) {
  const cancelled = await db.campaignSend.updateMany({
    where: { campaignId, status: "queued" },
    data: { status: "cancelled" },
  });
  await db.campaign.update({ where: { id: campaignId }, data: { sendState: "cancelled", status: "sent", sentAt: new Date() } });
  const c = await db.campaign.findUnique({ where: { id: campaignId }, select: { workspaceId: true, name: true } });
  if (c) await audit(c.workspaceId, actor, "campaign.send_cancelled", `'${c.name}': ${cancelled.count} unsent recipients cancelled · already-sent emails are unaffected`);
  return cancelled.count;
}

export async function smartSendProgress(campaignId: string): Promise<SmartSendProgress> {
  const [campaign, groups] = await Promise.all([
    db.campaign.findUnique({ where: { id: campaignId } }),
    db.campaignSend.groupBy({ by: ["status"], where: { campaignId }, _count: { _all: true } }),
  ]);
  const count = (s: string) => groups.find((g) => g.status === s)?._count._all ?? 0;
  // "sent" here means the transport took it: real provider acceptance and
  // dev-transport simulation both advance the gradual pipeline, and the UI
  // labels simulated rows separately wherever numbers are shown.
  const sent = count("sent") + count("delivered") + count("simulated");
  const queued = count("queued");
  const total = groups.reduce((n, g) => n + g._count._all, 0);

  let eta: string | null = null;
  if (campaign?.sendState === "running" && queued > 0 && campaign.sendDurationMins && campaign.sendBatchSize) {
    const batchesLeft = Math.ceil(queued / campaign.sendBatchSize);
    const totalBatches = Math.max(1, Math.ceil((campaign.audienceSnapshot || total) / campaign.sendBatchSize));
    const intervalMs = (campaign.sendDurationMins * 60_000) / totalBatches;
    eta = new Date(Date.now() + batchesLeft * intervalMs).toISOString();
  }

  return {
    state: campaign?.sendState ?? null,
    sent, queued,
    failed: count("failed"),
    suppressed: count("suppressed"),
    cancelled: count("cancelled"),
    total,
    nextBatchAt: campaign?.nextBatchAt?.toISOString() ?? null,
    estimatedCompletionAt: eta,
    pauseReason: campaign?.sendPauseReason ?? null,
  };
}

function inWindow(now: Date, start: number | null, end: number | null): boolean {
  if (start === null || end === null) return true;
  // Hours are interpreted in the workspace's operating timezone, not the
  // server's: Render runs UTC, and a "9am to 8pm" window meant London time.
  const tz = process.env.SENDLOOM_TIMEZONE || "Europe/London";
  const h = parseInt(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: tz }).format(now),
    10
  );
  // Window may wrap midnight (e.g. 20 -> 8).
  return start <= end ? h >= start && h < end : h >= start || h < end;
}

/**
 * Deliver one due batch for one campaign.
 * Returns "continue" (more to do), "done", or "skipped".
 */
export async function runCampaignBatch(campaignId: string, now = new Date()): Promise<"continue" | "done" | "skipped"> {
  const campaign = await db.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.sendState !== "running") return "skipped";
  if (campaign.nextBatchAt && campaign.nextBatchAt.getTime() > now.getTime()) return "skipped";

  // Send window: outside it, schedule the next look at the window's opening.
  if (!inWindow(now, campaign.sendWindowStart, campaign.sendWindowEnd)) {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(campaign.sendWindowStart ?? 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    await db.campaign.update({ where: { id: campaign.id }, data: { nextBatchAt: next } });
    return "skipped";
  }

  // Workspace-level rails: billing state and sending rights, re-checked per
  // batch, not once at start.
  const resolvedEnt = await resolveEntitlements(campaign.workspaceId);
  if (!resolvedEnt.unmetered && !canSend(resolvedEnt.status)) {
    await pauseSmartSend(campaign.id, "system", "Workspace sending is paused by billing state.");
    return "skipped";
  }

  // Bounce/complaint rails from this campaign's own delivery record.
  const [attempted, bounced, complained] = await Promise.all([
    db.campaignSend.count({ where: { campaignId, status: { in: ["sent", "bounced", "complained", "failed"] } } }),
    db.campaignSend.count({ where: { campaignId, status: "bounced" } }),
    db.campaignSend.count({ where: { campaignId, status: "complained" } }),
  ]);
  if (attempted >= SAFETY.minSampleForRates) {
    if (bounced / attempted > SAFETY.maxBounceRate) {
      await pauseSmartSend(campaign.id, "system", `Bounce rate ${(100 * bounced / attempted).toFixed(1)}% exceeded ${SAFETY.maxBounceRate * 100}%.`);
      return "skipped";
    }
    if (complained / attempted > SAFETY.maxComplaintRate) {
      await pauseSmartSend(campaign.id, "system", `Complaint rate exceeded ${SAFETY.maxComplaintRate * 100}%.`);
      return "skipped";
    }
  }

  const batch = await db.campaignSend.findMany({
    where: { campaignId, status: "queued" },
    include: { contact: { select: { id: true, email: true } } },
    take: campaign.sendBatchSize,
    orderBy: { createdAt: "asc" },
  });

  if (batch.length === 0) {
    // Rows still parked in "sending" belong to another runner mid-flight (or
    // to a dead one, until the stranded sweep fails them). Completing now
    // would stamp sentAt while emails may still be leaving; wait instead.
    const inFlight = await db.campaignSend.count({ where: { campaignId, status: "sending" } });
    if (inFlight > 0) return "skipped";
    await db.campaign.update({
      where: { id: campaign.id },
      data: { status: "sent", sentAt: campaign.sentAt ?? new Date(), sendState: "complete", nextBatchAt: null, isDemo: false },
    });
    await audit(campaign.workspaceId, "system", "campaign.smart_send_complete", `'${campaign.name}' finished.`);
    return "done";
  }

  // Pre-batch recheck: suppression and consent may have changed since
  // enqueueing. Anyone no longer eligible is marked suppressed, not sent.
  const suppressions = new Set(
    (await db.suppressionRecord.findMany({ where: { workspaceId: campaign.workspaceId } })).map((s) => s.email.toLowerCase())
  );

  const provider = activeProvider();
  const blocks = parseBlocks(campaign.content);
  let sent = 0;

  for (const row of batch) {
    // Claim the row before doing anything with it. An overlapping runner has
    // read the same batch; whoever loses this conditional update walks away,
    // which is what makes a double-send impossible however many ticks land.
    const claim = await db.campaignSend.updateMany({
      where: { id: row.id, status: "queued" },
      data: { status: "sending", providerMessageId: claimStamp(now) },
    });
    if (claim.count === 0) continue;

    const email = row.contact.email;
    // Same gate as everywhere else: the mirror columns plus Do Not Contact,
    // via the shared helper, so a mid-send unsubscribe or DNC flip is caught
    // here exactly as it would have been at enqueue.
    const gate = await db.contact.findUnique({
      where: { id: row.contactId },
      select: { email: true, phone: true, emailConsent: true, smsConsent: true, whatsappConsent: true, doNotContact: true },
    });
    const check = gate
      ? eligibleForChannel(gate, (campaign.channel ?? "email") as Channel, suppressions)
      : { eligible: false as const };
    if (!email || !check.eligible) {
      // The claim stamp goes with the claim: this row is not in flight.
      await db.campaignSend.update({ where: { id: row.id }, data: { status: "suppressed", providerMessageId: null } });
      continue;
    }

    // deliverToContact would create a duplicate row; the row exists, so we
    // inline its delivery here against the existing row.
    try {
      const { renderForRecipient } = await import("./email-render");
      let html: string;
      if (blocks.length) {
        const full = await db.contact.findUnique({ where: { id: row.contactId }, select: { firstName: true, lastName: true } });
        const rendered = await renderForRecipient({
          workspaceId: campaign.workspaceId,
          campaignId: campaign.id,
          sendId: row.id,
          contact: { id: row.contactId, email, firstName: full?.firstName, lastName: full?.lastName },
          blocks,
          brandId: campaign.brandId,
        });
        html = rendered.html;
      } else {
        html = campaign.content ?? `<p>${campaign.name}</p>`;
      }
      const brand = campaign.brandId
        ? await db.brand.findUnique({ where: { id: campaign.brandId }, select: { senderName: true, senderEmail: true, replyToEmail: true } })
        : null;
      const result = await provider.send({
        to: email,
        subject: campaign.subject ?? campaign.name,
        html,
        campaignSendId: row.id,
        from: brand?.senderEmail ? `${brand.senderName ?? "SendLoom"} <${brand.senderEmail}>` : undefined,
        replyTo: brand?.replyToEmail ?? undefined,
      });
      const status = await recordSendOutcome(row.id, result);
      if (status !== "failed") sent++;
    } catch {
      await db.campaignSend.update({ where: { id: row.id }, data: { status: "failed", providerMessageId: null } });
    }
  }

  if (sent > 0) {
    await recordUsage(campaign.workspaceId, "monthly_email_sends", sent);
    await trackFunnel("first_send_completed", { workspaceId: campaign.workspaceId, once: true });
  }

  // Schedule the next batch from the duration.
  const totalBatches = Math.max(1, Math.ceil((campaign.audienceSnapshot || 1) / campaign.sendBatchSize));
  const intervalMs = campaign.sendMode === "gradual" && campaign.sendDurationMins
    ? Math.max(30_000, (campaign.sendDurationMins * 60_000) / totalBatches)
    : 0;
  await db.campaign.update({
    where: { id: campaign.id },
    data: { nextBatchAt: new Date(now.getTime() + intervalMs) },
  });

  return "continue";
}

/** Deliver every due batch across the workspace. Called by the cron seam. */
export async function runDueBatches(now = new Date()): Promise<{ campaignId: string; result: string }[]> {
  const due = await db.campaign.findMany({
    where: { sendState: "running", nextBatchAt: { lte: now } },
    select: { id: true },
    take: 20,
  });
  const results: { campaignId: string; result: string }[] = [];
  for (const c of due) {
    const r = await runCampaignBatch(c.id, now);
    results.push({ campaignId: c.id, result: r });
  }
  return results;
}
