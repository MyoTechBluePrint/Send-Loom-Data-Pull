// Soft deletion with protected history.
//
// The contract, in one sentence: deleting something in Sendloom removes it
// from the working interface and never from the numbers. A marketer who runs
// two tests and deletes the bad one must not be able to make the account
// report only the good one — total spend, sends, opens, clicks and revenue
// keep counting every campaign and workflow that ever ran. Deletion here
// stamps deletedAt, writes an append-only DeletionRecord (what, who, when,
// KPIs at that moment), and leaves every send row and revenue figure on the
// books. There is deliberately no API that erases performance history; a
// genuine GDPR purge is a data-privacy operation on contacts, not a campaign
// lifecycle action, and lives outside this module.
import { db } from "./db";
import { audit } from "./audit";
import { stopRun } from "./automations";

export type CampaignMetrics = {
  kind: "campaign";
  recipients: number;
  sends: number;
  delivered: number;
  opened: number;
  clicked: number;
  failed: number;
  suppressed: number;
  openRatePct: number;
  clickRatePct: number;
  revenue: number;
};

export type AutomationMetrics = {
  kind: "automation";
  entered: number;
  completed: number;
  runs: number;
  emailsSent: number;
  opened: number;
  clicked: number;
  conversionPct: number;
  revenue: number;
};

const pct = (part: number, whole: number) => (whole ? Math.round((part / whole) * 1000) / 10 : 0);

/** The campaign's KPIs right now, from its surviving send rows. */
export async function campaignMetrics(campaignId: string): Promise<CampaignMetrics | null> {
  const c = await db.campaign.findUnique({
    where: { id: campaignId },
    include: { sends: { select: { status: true, openedAt: true, clickedAt: true } } },
  });
  if (!c) return null;
  const delivered = c.sends.filter((s) => ["sent", "delivered", "bounced", "complained"].includes(s.status)).length;
  const opened = c.sends.filter((s) => s.openedAt).length;
  const clicked = c.sends.filter((s) => s.clickedAt).length;
  return {
    kind: "campaign",
    recipients: c.audienceSnapshot,
    sends: c.sends.length,
    delivered,
    opened,
    clicked,
    failed: c.sends.filter((s) => s.status === "failed").length,
    suppressed: c.sends.filter((s) => s.status === "suppressed").length,
    openRatePct: pct(opened, delivered),
    clickRatePct: pct(clicked, delivered),
    revenue: c.revenue,
  };
}

/** The workflow's KPIs right now, including its shadow campaigns' sends. */
export async function automationMetrics(automationId: string): Promise<AutomationMetrics | null> {
  const a = await db.automation.findUnique({ where: { id: automationId } });
  if (!a) return null;
  const [runs, sends] = await Promise.all([
    db.automationRun.count({ where: { automationId } }),
    db.campaignSend.findMany({
      where: { campaign: { audienceType: "automation", audienceRef: automationId } },
      select: { status: true, openedAt: true, clickedAt: true },
    }),
  ]);
  return {
    kind: "automation",
    entered: a.entered,
    completed: a.completed,
    runs,
    emailsSent: sends.filter((s) => ["sent", "delivered", "bounced", "complained"].includes(s.status)).length,
    opened: sends.filter((s) => s.openedAt).length,
    clicked: sends.filter((s) => s.clickedAt).length,
    conversionPct: a.conversion,
    revenue: a.revenue,
  };
}

/**
 * Soft-delete a sent campaign: it leaves every list, its history stays.
 * The DeletionRecord rides the same transaction as the stamp, so there is
 * never a deleted campaign without its ledger row.
 */
export async function softDeleteCampaign(
  campaign: { id: string; workspaceId: string; name: string; createdAt: Date },
  actor: string,
) {
  const metrics = await campaignMetrics(campaign.id);
  await db.$transaction([
    db.campaign.update({ where: { id: campaign.id }, data: { deletedAt: new Date(), deletedBy: actor } }),
    db.deletionRecord.create({
      data: {
        workspaceId: campaign.workspaceId,
        entityType: "campaign",
        entityId: campaign.id,
        name: campaign.name,
        entityCreatedAt: campaign.createdAt,
        deletedBy: actor,
        metricsSnapshot: JSON.stringify(metrics ?? {}),
      },
    }),
  ]);
  await audit(
    campaign.workspaceId,
    actor,
    "campaign.deleted",
    `'${campaign.name}' removed from the working view · ${metrics?.sends ?? 0} send records and ${
      metrics ? `£${metrics.revenue.toFixed(2)}` : "£0.00"
    } stay in historical analytics`,
  );
}

/**
 * Soft-delete a workflow. Beyond the stamp: it is paused so no trigger can
 * enrol another contact, its running contacts are stopped with a diary line
 * saying why, and its shadow campaigns leave the campaigns list with it.
 * Every run, diary and send row survives for the historical numbers.
 */
export async function softDeleteAutomation(
  automation: { id: string; workspaceId: string; name: string; createdAt: Date },
  actor: string,
) {
  const metrics = await automationMetrics(automation.id);
  const running = await db.automationRun.findMany({
    where: { automationId: automation.id, status: "running" },
    select: { id: true },
  });
  for (const run of running) {
    await stopRun(run.id, "stopped_manually", `workflow deleted by ${actor}`);
  }
  await db.$transaction([
    db.automation.update({
      where: { id: automation.id },
      data: { status: "paused", deletedAt: new Date(), deletedBy: actor },
    }),
    db.campaign.updateMany({
      where: { audienceType: "automation", audienceRef: automation.id, deletedAt: null },
      data: { deletedAt: new Date(), deletedBy: actor },
    }),
    db.deletionRecord.create({
      data: {
        workspaceId: automation.workspaceId,
        entityType: "automation",
        entityId: automation.id,
        name: automation.name,
        entityCreatedAt: automation.createdAt,
        deletedBy: actor,
        metricsSnapshot: JSON.stringify(metrics ?? {}),
      },
    }),
  ]);
  await audit(
    automation.workspaceId,
    actor,
    "automation.deleted",
    `'${automation.name}' removed from the working view · ${running.length} running contact${running.length === 1 ? "" : "s"} stopped · ${
      metrics?.emailsSent ?? 0
    } sent emails stay in historical analytics`,
  );
}

/** Bring a deleted campaign back to the archived shelf. The ledger row stays. */
export async function restoreCampaign(
  campaign: { id: string; workspaceId: string; name: string; status: string },
  actor: string,
) {
  await db.$transaction([
    db.campaign.update({ where: { id: campaign.id }, data: { deletedAt: null, deletedBy: null } }),
    db.deletionRecord.updateMany({
      where: { entityType: "campaign", entityId: campaign.id, restoredAt: null },
      data: { restoredAt: new Date(), restoredBy: actor },
    }),
  ]);
  await audit(campaign.workspaceId, actor, "campaign.restored_from_deleted", `'${campaign.name}'`);
}

/**
 * Bring a deleted workflow back — paused, never live: going live again is a
 * human decision made in the editor with the steps in view.
 */
export async function restoreAutomation(
  automation: { id: string; workspaceId: string; name: string },
  actor: string,
) {
  await db.$transaction([
    db.automation.update({ where: { id: automation.id }, data: { deletedAt: null, deletedBy: null, status: "paused" } }),
    db.campaign.updateMany({
      where: { audienceType: "automation", audienceRef: automation.id },
      data: { deletedAt: null, deletedBy: null },
    }),
    db.deletionRecord.updateMany({
      where: { entityType: "automation", entityId: automation.id, restoredAt: null },
      data: { restoredAt: new Date(), restoredBy: actor },
    }),
  ]);
  await audit(automation.workspaceId, actor, "automation.restored_from_deleted", `'${automation.name}' · restored paused`);
}
