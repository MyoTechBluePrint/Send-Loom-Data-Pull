// The automation engine: what turns a workflow drawing into emails arriving.
//
// The pieces were all here already and this file only connects them. Nodes
// are the drawing; a run is one contact walking it. An email node borrows the
// whole campaign machine by keeping a shadow campaign per node: sends become
// CampaignSend rows under it, which buys the unsubscribe link, the delivery
// webhook, per-node stats and, through the (campaignId, contactId) unique
// constraint, the guarantee that no contact can ever receive the same
// automation email twice, whatever the scheduler does.
//
// Consent is the same gate as everywhere else. A welcome email is marketing:
// no granted email consent, no send, however the contact got enrolled.

import { db } from "./db";
import { audit } from "./audit";
import { activeProvider, recordSendOutcome } from "./sending";
import { eligibleForChannel } from "./consent";
import { renderForRecipient, resolveFeeds } from "./email-render";
import { newBlockId, parseBlocks, type EmailBlock } from "./email-blocks";
import { claimStamp, claimedAtFromStamp, STRANDED_SENDING_MS } from "./smart-send";

export const TRIGGER_EVENTS = [
  { value: "popup_submitted", label: "Popup or form signup" },
  { value: "form_submitted", label: "Multi-step form completed" },
  { value: "checkout_started", label: "Checkout started" },
  { value: "purchase_completed", label: "Purchase completed" },
  { value: "imported", label: "Contact imported" },
  { value: "cart_abandoned", label: "Cart abandoned (from the store sweep)" },
  { value: "customer_inactive", label: "Customer gone quiet (winback)" },
] as const;

export interface EmailNodeConfig {
  subject?: string;
  previewText?: string;
  /** Simple HTML for the body text block. */
  html?: string;
  /** Step switch: a disabled step is skipped by the engine, content kept. */
  disabled?: boolean;
  /** The shadow campaign backing this node's sends. */
  campaignId?: string;
}

export interface DelayNodeConfig {
  hours?: number;
}

const parseConfig = <T,>(raw: string | null): T => {
  try {
    return JSON.parse(raw ?? "{}") as T;
  } catch {
    return {} as T;
  }
};

/**
 * Enrol a contact into every live automation listening for this event.
 *
 * One run per contact per automation, ever: re-triggering does not restart
 * a welcome series. Advances immediately so a zero-delay first email goes
 * out while the signup is still warm.
 */
export async function enrolOnEvent(
  workspaceId: string,
  eventType: string,
  contactId: string,
) {
  const automations = await db.automation.findMany({
    where: { workspaceId, status: "live", triggerEvent: eventType },
    select: { id: true, allowReentry: true },
  });
  for (const a of automations) {
    // Without re-entry, one run per contact ever. With it, only one run at a
    // time: a contact mid-walk is never enrolled twice in parallel.
    const existing = await db.automationRun.findFirst({
      where: {
        automationId: a.id,
        contactId,
        ...(a.allowReentry ? { status: "running" } : {}),
      },
      select: { id: true },
    });
    if (existing) continue;
    const run = await db.automationRun.create({
      data: { automationId: a.id, contactId, status: "running" },
    });
    await db.automation.update({
      where: { id: a.id },
      data: { entered: { increment: 1 } },
    });
    await advanceRun(run.id);
  }
}

/**
 * Retry failed automation sends, three strikes total.
 *
 * A provider hiccup should not permanently silence a welcome email. Failed
 * rows under three attempts are put back through delivery on the next cron
 * beat; at three they stay failed and the workflow page carries the ACTION
 * REQUIRED card instead of the system quietly looping forever.
 */
export async function retryFailedSends(): Promise<number> {
  // First, recover rows a dead process left claimed. The batch runner flips
  // queued -> "sending" before handing a row to the provider; if the process
  // dies there, nothing else ever moves the row on, and its campaign can
  // never finish. A claim past the stranded threshold (or one whose stamp is
  // unreadable, which proves nothing about freshness) becomes an honest
  // failure with the attempt counted. The conditional update means a runner
  // that is somehow still alive keeps its row.
  const strandedBefore = Date.now() - STRANDED_SENDING_MS;
  const claimed = await db.campaignSend.findMany({
    where: { status: "sending" },
    select: { id: true, providerMessageId: true },
    take: 200,
  });
  for (const row of claimed) {
    const at = claimedAtFromStamp(row.providerMessageId);
    if (at !== null && at > strandedBefore) continue; // genuinely in flight
    await db.campaignSend.updateMany({
      where: { id: row.id, status: "sending" },
      data: { status: "failed", attempts: { increment: 1 }, providerMessageId: null },
    });
  }

  // Automation rows stranded in "queued" are the other corpse: created, or
  // reset by an earlier sweep, and the process died before delivery ran.
  // Campaign gradual queues wait in "queued" legitimately, so this is scoped
  // to automation shadow campaigns, where queued always means "delivery
  // imminent". Age comes from the reset's claim stamp, or from createdAt for
  // rows that died between creation and first delivery.
  const strandedQueued = await db.campaignSend.findMany({
    where: { status: "queued", campaign: { audienceType: "automation" } },
    select: { id: true, providerMessageId: true, createdAt: true },
    take: 200,
  });
  for (const row of strandedQueued) {
    const at =
      claimedAtFromStamp(row.providerMessageId) ??
      (row.providerMessageId == null ? row.createdAt.getTime() : null);
    if (at !== null && at > strandedBefore) continue; // genuinely imminent
    await db.campaignSend.updateMany({
      where: { id: row.id, status: "queued" },
      data: { status: "failed", attempts: { increment: 1 }, providerMessageId: null },
    });
  }

  const failed = await db.campaignSend.findMany({
    where: {
      status: "failed",
      attempts: { lt: 3 },
      campaign: { audienceType: "automation" },
    },
    include: {
      campaign: { select: { audienceRef: true } },
      contact: true,
    },
    take: 50,
  });
  let retried = 0;
  for (const send of failed) {
    if (!send.campaign.audienceRef) continue;
    const automation = await db.automation.findUnique({
      where: { id: send.campaign.audienceRef },
      include: { nodes: true },
    });
    if (!automation) continue;
    const node = automation.nodes.find((n) => {
      const config = parseConfig<EmailNodeConfig>(n.config);
      return config.campaignId === send.campaignId;
    });
    if (!node) continue;
    // Reset to queued and walk the delivery again against the same row, so
    // the attempts counter and the never-twice constraint both hold. The
    // reset is conditional because it is also the claim: two overlapping
    // ticks read the same failed rows, and only the one whose update counted
    // may redeliver, or the contact would get the email twice.
    const reset = await db.campaignSend.updateMany({
      where: { id: send.id, status: "failed" },
      data: { status: "queued", providerMessageId: claimStamp(new Date()) },
    });
    if (reset.count === 0) continue;
    await redeliverExisting(automation, node, send.contact, send.id);
    retried += 1;
  }
  return retried;
}

/** The cron half: push every due run forward. Called beside runDueBatches. */
export async function advanceDueRuns(): Promise<number> {
  const due = await db.automationRun.findMany({
    where: {
      status: "running",
      OR: [{ nextDueAt: null }, { nextDueAt: { lte: new Date() } }],
    },
    select: { id: true },
    take: 200,
  });
  for (const r of due) await advanceRun(r.id);
  return due.length;
}

/**
 * Walk one run forward until it parks on a delay or finishes.
 *
 * Unknown node kinds pass through rather than wedge the run: a condition or
 * task node someone sketches in the editor must never strand real contacts.
 */
export async function advanceRun(runId: string) {
  const run = await db.automationRun.findUnique({
    where: { id: runId },
    include: {
      automation: { include: { nodes: { orderBy: { position: "asc" } } } },
      contact: true,
    },
  });
  if (!run || run.status !== "running") return;

  const nodes = run.automation.nodes.filter((n) => !n.branch);
  let index = run.currentNode
    ? nodes.findIndex((n) => n.id === run.currentNode) + 1
    : 0;

  while (index < nodes.length) {
    const node = nodes[index];

    // A disabled step is skipped, never deleted: pausing one email in a
    // series should not lose its wording or its send history.
    const nodeConfig = parseConfig<{ disabled?: boolean }>(node.config);
    if (nodeConfig.disabled) {
      index += 1;
      continue;
    }

    if (node.kind === "trigger") {
      index += 1;
      continue;
    }

    if (node.kind === "delay") {
      const config = parseConfig<DelayNodeConfig>(node.config);
      const hours = Math.max(0, Number(config.hours ?? 24));
      await db.automationRun.update({
        where: { id: run.id },
        data: {
          currentNode: node.id,
          nextDueAt: new Date(Date.now() + hours * 3600 * 1000),
        },
      });
      return;
    }

    if (node.kind === "email") {
      await deliverEmailNode(run.automation, node, run.contact);
      await db.automationRun.update({
        where: { id: run.id },
        data: { currentNode: node.id, nextDueAt: null },
      });
      index += 1;
      continue;
    }

    if (node.kind === "exit") break;

    index += 1; // condition/task/tag/webhook: pass through for now
  }

  await db.automationRun.update({
    where: { id: run.id },
    data: { status: "completed", endedAt: new Date(), nextDueAt: null },
  });
  await db.automation.update({
    where: { id: run.automation.id },
    data: { completed: { increment: 1 } },
  });
}

/** The shadow campaign that gives an email node its send machinery. */
export async function shadowCampaign(
  automation: { id: string; workspaceId: string; name: string },
  node: { id: string; label: string; config: string | null },
) {
  const config = parseConfig<EmailNodeConfig>(node.config);
  if (config.campaignId) {
    // Scoped to the automation's workspace: node configs arrive from the
    // editor as free-form JSON, so a campaignId in one is an untrusted
    // reference until the workspace check says otherwise.
    const existing = await db.campaign.findFirst({
      where: { id: config.campaignId, workspaceId: automation.workspaceId },
    });
    if (existing) return existing;
  }
  const campaign = await db.campaign.create({
    data: {
      workspaceId: automation.workspaceId,
      name: `${automation.name} · ${node.label}`,
      subject: config.subject ?? node.label,
      status: "automation",
      channel: "email",
      audienceType: "automation",
      audienceRef: automation.id,
    },
  });
  await db.automationNode.update({
    where: { id: node.id },
    data: { config: JSON.stringify({ ...config, campaignId: campaign.id }) },
  });
  return campaign;
}

/**
 * What an email node sends. A step whose shadow campaign holds designed
 * blocks (the full email editor's work) sends those; otherwise the simple
 * subject/text fields are dressed in the logo+text+footer composition. The
 * step's preview text applies either way, and a footer is guaranteed either
 * way: a designed email must never leave without its unsubscribe link.
 */
export function blocksFor(
  node: { label: string; config: string | null },
  designedContent?: string | null,
): EmailBlock[] {
  const config = parseConfig<EmailNodeConfig>(node.config);
  // The preheader is the line inboxes show after the subject. Hidden in the
  // body itself, which is the only place email clients read it from.
  const preheader = config.previewText?.trim()
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${config.previewText.trim()}</div>`
    : "";
  const preheaderBlocks: EmailBlock[] = preheader
    ? [{ id: newBlockId(), type: "text" as const, html: preheader }]
    : [];

  const designed = parseBlocks(designedContent ?? null);
  if (designed.length) {
    const withFooter = designed.some((b) => b.type === "footer")
      ? designed
      : [...designed, { id: newBlockId(), type: "footer" as const }];
    return [...preheaderBlocks, ...withFooter];
  }

  const html = config.html?.trim() || "<p>Thanks for signing up. We'll be in touch.</p>";
  return [
    ...preheaderBlocks,
    { id: newBlockId(), type: "logo" as const },
    { id: newBlockId(), type: "text" as const, html },
    { id: newBlockId(), type: "footer" as const },
  ];
}

/**
 * The shadow campaign's designed content for one node, if any. Used by the
 * preview and test-send routes so what they show is what would send.
 */
export async function designedContentFor(
  automationId: string,
  nodeId: string | undefined,
): Promise<{ content: string | null; brandId: string | null }> {
  const none = { content: null, brandId: null };
  if (!nodeId) return none;
  const node = await db.automationNode.findFirst({
    where: { id: nodeId, automationId },
    select: { config: true, automation: { select: { workspaceId: true } } },
  });
  if (!node) return none;
  const config = parseConfig<EmailNodeConfig>(node.config);
  if (typeof config.campaignId !== "string" || !config.campaignId) return none;
  // Same untrusted-reference rule as shadowCampaign: a campaignId written
  // into a node config only counts if it lives in this workspace. The brand
  // travels with the content, or previews render in the wrong identity.
  const shadow = await db.campaign.findFirst({
    where: { id: config.campaignId, workspaceId: node.automation.workspaceId },
    select: { content: true, brandId: true },
  });
  return shadow ? { content: shadow.content, brandId: shadow.brandId } : none;
}

/**
 * Shadow campaigns exist from the moment a workflow is saved, not lazily at
 * first send: the full email editor needs a campaign to design against long
 * before any contact walks the flow. Called from the workflow save path;
 * idempotent per node, and the send path still calls shadowCampaign itself
 * so workflows saved before this existed keep working.
 */
export async function ensureShadowCampaigns(automationId: string): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  const automation = await db.automation.findUnique({
    where: { id: automationId },
    include: { nodes: { orderBy: { position: "asc" } } },
  });
  if (!automation) return ids;
  for (const node of automation.nodes) {
    if (node.kind !== "email") continue;
    const campaign = await shadowCampaign(automation, node);
    ids.set(node.id, campaign.id);
  }
  return ids;
}

/**
 * Copy a designed email from a campaign or template onto an email node's
 * shadow campaign. The copy is a snapshot with fresh block ids: editing the
 * source later never changes what this step sends. It overwrites any design
 * the step already had, which is why the UI confirms before calling; a
 * source without designed blocks is refused rather than blanking the step.
 */
export async function adoptShadowContent(opts: {
  workspaceId: string;
  automationId: string;
  nodeId: string;
  source: { kind: "campaign" | "template"; id: string };
}): Promise<{ ok: true; campaignId: string; sourceName: string } | { ok: false; error: string }> {
  const automation = await db.automation.findFirst({
    where: { id: opts.automationId, workspaceId: opts.workspaceId },
    select: { id: true, workspaceId: true, name: true },
  });
  if (!automation) return { ok: false, error: "Workflow not found." };
  const node = await db.automationNode.findFirst({
    where: { id: opts.nodeId, automationId: automation.id },
  });
  if (!node || node.kind !== "email") return { ok: false, error: "That email step no longer exists. Save the workflow and try again." };

  const source =
    opts.source.kind === "campaign"
      ? await db.campaign.findFirst({
          where: { id: opts.source.id, workspaceId: opts.workspaceId },
          select: { name: true, content: true },
        })
      : await db.emailTemplate.findFirst({
          where: { id: opts.source.id, workspaceId: opts.workspaceId },
          select: { name: true, content: true },
        });
  if (!source) return { ok: false, error: "That email could not be found." };
  const blocks = parseBlocks(source.content);
  if (!blocks.length) return { ok: false, error: "That email has no designed content to copy." };

  const campaign = await shadowCampaign(automation, node);
  const copied = blocks.map((b) => ({ ...b, id: newBlockId() }));
  await db.campaign.update({
    where: { id: campaign.id },
    data: { content: JSON.stringify(copied), contentDirty: false },
  });
  return { ok: true, campaignId: campaign.id, sourceName: source.name };
}

async function deliverEmailNode(
  automation: { id: string; workspaceId: string; name: string },
  node: { id: string; label: string; config: string | null },
  contact: {
    id: string; email: string | null; phone: string | null;
    firstName: string | null; lastName: string | null;
    emailConsent: string; smsConsent: string; whatsappConsent: string;
    doNotContact: boolean;
  },
) {
  const suppressed = new Set(
    (
      await db.suppressionRecord.findMany({
        where: { workspaceId: automation.workspaceId },
        select: { email: true },
      })
    ).map((s) => s.email.toLowerCase()),
  );
  const gate = eligibleForChannel(contact, "email", suppressed);
  if (!gate.eligible || !contact.email) return;

  const campaign = await shadowCampaign(automation, node);

  // The double-send guard: one row per contact per node, enforced by the
  // schema, so a crashed scheduler re-walking a run cannot email twice.
  let send;
  try {
    send = await db.campaignSend.create({
      data: { campaignId: campaign.id, contactId: contact.id, status: "queued" },
    });
  } catch {
    return; // already sent by an earlier walk
  }

  await redeliverExisting(automation, node, contact, send.id);
}

/** Render and deliver one email node against an existing send row. */
async function redeliverExisting(
  automation: { id: string; workspaceId: string; name: string },
  node: { id: string; label: string; config: string | null },
  contact: {
    id: string; email: string | null;
    firstName: string | null; lastName: string | null;
  },
  sendId: string,
) {
  if (!contact.email) return;

  // The gate runs HERE, not only at first delivery. This function is also
  // the retry path, and a contact can unsubscribe, complain or be flagged
  // Do Not Contact in the hours between a failed attempt and the next cron
  // beat. Consent is checked at the moment an email actually leaves, every
  // time one actually leaves — the same fresh read the first attempt gets.
  const fresh = await db.contact.findUnique({
    where: { id: contact.id },
    select: {
      email: true, phone: true,
      emailConsent: true, smsConsent: true, whatsappConsent: true, doNotContact: true,
    },
  });
  if (!fresh) return;
  const suppressed = new Set(
    (
      await db.suppressionRecord.findMany({
        where: { workspaceId: automation.workspaceId },
        select: { email: true },
      })
    ).map((s) => s.email.toLowerCase()),
  );
  if (!eligibleForChannel(fresh, "email", suppressed).eligible) {
    // Truthfully parked, never retried: the row leaves the "failed" pool so
    // retryFailedSends stops picking it up.
    await db.campaignSend.update({ where: { id: sendId }, data: { status: "suppressed" } });
    return;
  }

  const config = parseConfig<EmailNodeConfig>(node.config);
  const campaign = await shadowCampaign(automation, node);
  try {
    // The shadow campaign's designed blocks win over the simple text: the
    // full editor's work is what actually sends. Feeds resolve here, at
    // delivery, because renderForRecipient expects concrete products, and an
    // automation email SHOULD show the catalogue as it stands each time it
    // fires rather than as it stood when the workflow was drawn.
    const blocks = await resolveFeeds(
      blocksFor(node, campaign.content),
      automation.workspaceId,
      null,
    );
    const { html, textBody, unsubscribeUrl } = await renderForRecipient({
      workspaceId: automation.workspaceId,
      campaignId: campaign.id,
      sendId,
      contact: {
        id: contact.id,
        email: contact.email,
        firstName: contact.firstName,
        lastName: contact.lastName,
      },
      blocks,
      // The brand the designer chose in the full editor travels with the
      // send; without it the email renders in default purple, not MyoTech.
      brandId: campaign.brandId,
    });
    const provider = activeProvider();
    const result = await provider.send({
      to: contact.email,
      subject: config.subject?.trim() || node.label,
      html,
      text: textBody,
      unsubscribeUrl,
      campaignSendId: sendId,
    });
    const status = await recordSendOutcome(sendId, result);
    await db.timelineItem.create({
      data: {
        contactId: contact.id,
        type: "email_sent",
        title:
          status === "sent"
            ? `Automation email sent · ${automation.name}`
            : status === "simulated"
              ? `Automation email simulated (no live provider) · ${automation.name}`
              : `Automation email failed · ${automation.name}`,
        detail: config.subject?.trim() || node.label,
      },
    });
    await audit(
      automation.workspaceId,
      "system:automation",
      "automation.email_sent",
      `'${automation.name}' → ${contact.email}`,
    );
  } catch (error) {
    console.error("[sendloom] automation send failed", error);
    await db.campaignSend.update({
      where: { id: sendId },
      data: { status: "failed", attempts: { increment: 1 } },
    });
    await audit(
      automation.workspaceId,
      "system:automation",
      "automation.email_failed",
      `'${automation.name}' → ${contact.email}: ${error instanceof Error ? error.message.slice(0, 200) : "unknown error"}`,
    );
  }
}


/**
 * Make the Welcome flow real on boot, idempotently.
 *
 * The seeded recipe was a drawing with no trigger. This gives it one, plus
 * sensible default wording, and sets it live, which is exactly what the
 * owner asked the platform to do: a popup signup on the storefront must
 * start the welcome series with nobody pressing anything. It runs on every
 * boot but touches nothing once the flow has a trigger, so the moment a
 * human edits the workflow their version is the version.
 */
export async function ensureWelcomeFlow() {
  const flows = await db.automation.findMany({
    where: { name: { contains: "Welcome" }, triggerEvent: null },
    include: { nodes: { orderBy: { position: "asc" } } },
  });
  for (const flow of flows) {
    await db.automation.update({
      where: { id: flow.id },
      data: {
        name: flow.name.replace(" (recipe)", ""),
        trigger: "Popup or form signup",
        triggerEvent: "popup_submitted",
        status: "live",
        isDemo: false,
      },
    });
    // Give bare email nodes a real default so the first send is presentable
    // before anybody has opened the editor.
    for (const node of flow.nodes) {
      if (node.kind !== "email") continue;
      const config = parseConfig<EmailNodeConfig>(node.config);
      if (config.subject || config.html) continue;
      await db.automationNode.update({
        where: { id: node.id },
        data: {
          config: JSON.stringify({
            ...config,
            subject: "Welcome — you're on the list",
            html: "<p>Thanks for signing up. You're on the list for our latest offers and discount codes — the next one lands in your inbox soon.</p>",
          }),
        },
      });
    }
    await audit(flow.workspaceId, "system", "automation.set_live", `'${flow.name}' armed on boot: popup signups now enrol`);
  }
}


/**
 * A purchase ends any recovery chase.
 *
 * Somebody who just bought must never receive "you left something in your
 * cart" an hour later. Called from the event pipeline on purchase, it exits
 * every running cart-and-checkout run for that contact.
 */
export async function stopRecoveryRunsOnPurchase(contactId: string) {
  const runs = await db.automationRun.findMany({
    where: {
      contactId,
      status: "running",
      automation: { triggerEvent: { in: ["cart_abandoned", "checkout_started"] } },
    },
    select: { id: true },
  });
  if (!runs.length) return;
  await db.automationRun.updateMany({
    where: { id: { in: runs.map((r) => r.id) } },
    data: { status: "exited", endedAt: new Date(), nextDueAt: null },
  });
}

/**
 * Winback enrolment: the trigger that is a silence rather than an event.
 *
 * A live workflow triggered by "customer gone quiet" defines the silence on
 * its trigger node: config.inactiveDays (default 90). The sweep runs beside
 * the other due work and enrols anybody past the threshold who has not been
 * through this workflow, which the usual one-run rule then remembers.
 */
export async function sweepWinback(): Promise<number> {
  const automations = await db.automation.findMany({
    where: { status: "live", triggerEvent: "customer_inactive" },
    include: { nodes: { where: { kind: "trigger" }, take: 1 } },
  });
  let enrolled = 0;
  for (const a of automations) {
    const config = parseConfig<{ inactiveDays?: number }>(a.nodes[0]?.config ?? null);
    const days = Math.max(7, Number(config.inactiveDays ?? 90));
    const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
    const quiet = await db.contact.findMany({
      where: {
        workspaceId: a.workspaceId,
        emailConsent: "granted",
        doNotContact: false,
        OR: [
          { lastOrderAt: { lt: cutoff } },
          { lastOrderAt: null, lastActivityAt: { lt: cutoff } },
        ],
      },
      select: { id: true },
      take: 200,
    });
    for (const c of quiet) {
      const existing = await db.automationRun.findFirst({
        where: { automationId: a.id, contactId: c.id },
        select: { id: true },
      });
      if (existing) continue;
      const run = await db.automationRun.create({
        data: { automationId: a.id, contactId: c.id, status: "running" },
      });
      await db.automation.update({ where: { id: a.id }, data: { entered: { increment: 1 } } });
      await advanceRun(run.id);
      enrolled += 1;
    }
  }
  return enrolled;
}
