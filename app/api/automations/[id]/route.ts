import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { can, currentUser } from "@/lib/server/permissions";
import { TRIGGER_EVENTS, ensureShadowCampaigns, adoptShadowContent } from "@/lib/server/automations";
import { CONDITION_TYPES } from "@/lib/server/automation-conditions";
import { parseBlocks } from "@/lib/server/email-blocks";

// One automation, for the editor: read it, rename it, retrigger it, set it
// live, and replace its steps. Node ids are preserved where the editor sends
// them back, which is what keeps an email node married to its shadow campaign
// (and therefore its already-sent history) across edits.

export const dynamic = "force-dynamic";

async function owned(id: string) {
  const workspaceId = await demoWorkspaceId();
  const automation = await db.automation.findFirst({
    where: { id, workspaceId },
    include: { nodes: { orderBy: { position: "asc" } } },
  });
  return { workspaceId, automation };
}

// The editor's view of the steps: parsed config plus whether the step's
// shadow campaign holds designed blocks, which is then what sends.
async function nodesPayload(
  nodes: { id: string; kind: string; label: string; detail: string | null; branch: string | null; config: string | null }[],
) {
  const visible = nodes.filter((n) => !n.branch);
  const configs = visible.map((n) => {
    try { return JSON.parse(n.config ?? "{}") as Record<string, unknown>; } catch { return {}; }
  });
  const campaignIds = configs
    .map((c) => c.campaignId)
    .filter((v): v is string => typeof v === "string" && v.length > 0);
  const shadows = campaignIds.length
    ? await db.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, content: true } })
    : [];
  const designedById = new Map(shadows.map((c) => [c.id, parseBlocks(c.content).length > 0]));
  return visible.map((n, i) => ({
    id: n.id,
    kind: n.kind,
    label: n.label,
    detail: n.detail,
    config: configs[i],
    designed:
      typeof configs[i].campaignId === "string"
        ? designedById.get(configs[i].campaignId as string) ?? false
        : false,
  }));
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { workspaceId, automation } = await owned(id);
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  // Emails an email step can start from: everything in the workspace with
  // real designed blocks, minus this workflow's own shadow campaigns.
  const [campaigns, templates] = await Promise.all([
    db.campaign.findMany({
      where: {
        workspaceId,
        archivedAt: null,
        content: { not: null },
        // No automation's shadow campaigns are offered, not just this one's:
        // adopting another workflow's machinery invites a live link nobody
        // intends. Real campaigns and templates only.
        NOT: { audienceType: "automation" },
      },
      select: { id: true, name: true, content: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.emailTemplate.findMany({
      where: { workspaceId, archived: false },
      select: { id: true, name: true, content: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
  ]);

  return Response.json({
    ok: true,
    automation: {
      id: automation.id,
      name: automation.name,
      trigger: automation.trigger,
      triggerEvent: automation.triggerEvent,
      allowReentry: automation.allowReentry,
      status: automation.status,
      nodes: await nodesPayload(automation.nodes),
    },
    triggerEvents: TRIGGER_EVENTS,
    // The condition vocabulary lives server-side (its evaluators touch the
    // database), so the editor is handed the menu rather than importing it.
    conditionTypes: CONDITION_TYPES,
    sources: {
      campaigns: campaigns
        .filter((c) => parseBlocks(c.content).length > 0)
        .map((c) => ({ id: c.id, name: c.name })),
      templates: templates
        .filter((t) => parseBlocks(t.content).length > 0)
        .map((t) => ({ id: t.id, name: t.name })),
    },
  });
}

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  triggerEvent: z.string().max(60).nullable().optional(),
  allowReentry: z.boolean().optional(),
  status: z.enum(["live", "paused", "draft"]).optional(),
  // Restore only: deletion happens via DELETE, never via PATCH.
  deleted: z.literal(false).optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { workspaceId, automation } = await owned(id);
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const d = parsed.data;

  if (d.deleted === false) {
    if (!can(user.role, "view_deleted")) {
      return Response.json({ ok: false, error: "Restoring deleted workflows requires an admin-level account." }, { status: 403 });
    }
    if (automation.deletedAt) {
      const { restoreAutomation } = await import("@/lib/server/deletion");
      await restoreAutomation({ id: automation.id, workspaceId, name: automation.name }, user.email);
    }
    return Response.json({ ok: true, status: "paused", restored: Boolean(automation.deletedAt) });
  }

  // A deleted workflow is read-only history until an admin restores it.
  if (automation.deletedAt) {
    return Response.json({ ok: false, error: "This workflow is deleted. Restore it before editing." }, { status: 409 });
  }

  if (d.status === "live" && !(d.triggerEvent ?? automation.triggerEvent)) {
    return Response.json(
      { ok: false, error: "Choose what starts this workflow before setting it live." },
      { status: 400 },
    );
  }

  const trigger = d.triggerEvent !== undefined
    ? TRIGGER_EVENTS.find((t) => t.value === d.triggerEvent)?.label ?? automation.trigger
    : undefined;

  const updated = await db.automation.update({
    where: { id: automation.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.triggerEvent !== undefined ? { triggerEvent: d.triggerEvent, trigger } : {}),
      ...(d.allowReentry !== undefined ? { allowReentry: d.allowReentry } : {}),
      ...(d.status !== undefined ? { status: d.status, isDemo: false } : {}),
    },
  });
  if (d.status) {
    await audit(workspaceId, user.email, `automation.${d.status === "live" ? "set_live" : d.status}`, `'${updated.name}'`);
  }
  return Response.json({ ok: true, status: updated.status });
}

const NodeInput = z.object({
  id: z.string().optional(),
  kind: z.enum(["trigger", "email", "delay", "condition", "exit"]),
  label: z.string().min(1).max(140),
  detail: z.string().max(300).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const Put = z.object({ nodes: z.array(NodeInput).min(1).max(30) });

// Waits are stored in minutes when the new field is present; hours stays
// untouched so pre-minutes workflows round-trip byte for byte. One minute to
// sixty days, the same clamp the engine applies at execution time.
const MAX_WAIT_MINUTES = 60 * 24 * 60;

// Loose on purpose: both configs may carry keys this route does not police
// (disabled, machine-held ids). The shape check is about the keys it does.
const DelayConfigInput = z.looseObject({
  hours: z.number().finite().min(0).optional(),
  minutes: z.number().finite().optional(),
});

const ConditionConfigInput = z.looseObject({
  match: z.enum(["all", "any"]).optional(),
  conditions: z
    .array(z.looseObject({ type: z.string().min(1).max(80) }))
    .max(20)
    .optional(),
});

/**
 * The checks a save must pass beyond raw shape. Returns a plain sentence for
 * the editor to show, or null when the steps are sound.
 */
function stepProblem(nodes: z.infer<typeof NodeInput>[]): string | null {
  const emails = nodes.filter((n) => n.kind === "email").length;
  if (emails > 10) return "A workflow can have at most 10 email steps.";

  const known = new Set(CONDITION_TYPES.map((c) => c.type));
  for (const n of nodes) {
    if (n.kind === "delay") {
      const parsed = DelayConfigInput.safeParse(n.config ?? {});
      if (!parsed.success) return `The wait step "${n.label}" needs its duration as a number.`;
    }
    if (n.kind === "condition") {
      const parsed = ConditionConfigInput.safeParse(n.config ?? {});
      if (!parsed.success) return `The check step "${n.label}" has conditions in a shape this server does not understand.`;
      for (const check of parsed.data.conditions ?? []) {
        if (!known.has(check.type)) {
          return `The check step "${n.label}" uses an unknown condition "${check.type}". Refresh the editor and try again.`;
        }
      }
    }
  }
  return null;
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { workspaceId, automation } = await owned(id);
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  if (automation.deletedAt) {
    return Response.json({ ok: false, error: "This workflow is deleted. Restore it before editing." }, { status: 409 });
  }

  const parsed = Put.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const problem = stepProblem(parsed.data.nodes);
  if (problem) return Response.json({ ok: false, error: problem }, { status: 422 });

  const keepIds = parsed.data.nodes.map((n) => n.id).filter(Boolean) as string[];
  const existing = new Map(automation.nodes.map((n) => [n.id, n]));

  await db.$transaction(async (tx) => {
    await tx.automationNode.deleteMany({
      where: { automationId: automation.id, id: { notIn: keepIds.length ? keepIds : ["none"] } },
    });
    for (const [position, n] of parsed.data.nodes.entries()) {
      // Merge the incoming config over what is stored, so machine-held keys
      // like an email node's shadow campaignId survive a UI round trip.
      const stored = n.id ? existing.get(n.id) : undefined;
      const storedConfig = (() => {
        try { return JSON.parse(stored?.config ?? "{}"); } catch { return {}; }
      })();
      const merged: Record<string, unknown> = { ...storedConfig, ...(n.config ?? {}) };
      // Persist the wait already clamped, so what is stored is what will run.
      // Hours-only delays are left alone: their round trip stays exact.
      if (n.kind === "delay" && merged.minutes != null && Number.isFinite(Number(merged.minutes))) {
        merged.minutes = Math.min(MAX_WAIT_MINUTES, Math.max(1, Math.round(Number(merged.minutes))));
      }
      const config = JSON.stringify(merged);
      if (stored) {
        await tx.automationNode.update({
          where: { id: stored.id },
          data: { kind: n.kind, label: n.label, detail: n.detail ?? null, position, config },
        });
      } else {
        await tx.automationNode.create({
          data: {
            automationId: automation.id,
            kind: n.kind, label: n.label, detail: n.detail ?? null,
            position, config,
          },
        });
      }
    }
  });

  // Every email step gets its shadow campaign the moment the workflow is
  // saved, so the full email editor has something to design against before
  // any contact walks the flow. Idempotent: existing campaigns are kept.
  await ensureShadowCampaigns(automation.id);

  await audit(workspaceId, user.email, "automation.workflow_edited", `'${automation.name}' · ${parsed.data.nodes.length} steps`);

  // Hand the saved steps back with their ids and shadow campaign ids: the
  // editor needs them to open the designer, and a re-save that still carried
  // no ids would recreate every step and orphan its send history.
  const saved = await db.automationNode.findMany({
    where: { automationId: automation.id },
    orderBy: { position: "asc" },
  });
  return Response.json({ ok: true, nodes: await nodesPayload(saved) });
}

// Delete a workflow. A recipe that never ran has no history to protect and
// hard-deletes cleanly (nodes and empty shadow campaigns with it). Anything
// that ever enrolled a contact or sent an email soft-deletes: paused, stamped,
// its running contacts stopped, its shadow campaigns hidden alongside it, and
// every run, diary and send row kept so historical analytics never change.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  if (!can(user.role, "delete_records")) {
    return Response.json({ ok: false, error: "Your role cannot delete workflows." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const { workspaceId, automation } = await owned(id);
  if (!automation) return Response.json({ ok: false }, { status: 404 });
  if (automation.deletedAt) {
    return Response.json({ ok: false, error: "Already deleted. Its performance history remains in analytics." }, { status: 409 });
  }

  const [runs, sends] = await Promise.all([
    db.automationRun.count({ where: { automationId: automation.id } }),
    db.campaignSend.count({ where: { campaign: { audienceType: "automation", audienceRef: automation.id } } }),
  ]);

  if (runs === 0 && sends === 0) {
    await db.$transaction(async (tx) => {
      await tx.automationNode.deleteMany({ where: { automationId: automation.id } });
      await tx.campaign.deleteMany({ where: { audienceType: "automation", audienceRef: automation.id } });
      await tx.automation.delete({ where: { id: automation.id } });
    });
    await audit(workspaceId, user.email, "automation.draft_deleted", `'${automation.name}' · never ran, no history to keep`);
    return Response.json({ ok: true, hardDeleted: true });
  }

  const { softDeleteAutomation } = await import("@/lib/server/deletion");
  await softDeleteAutomation({ id: automation.id, workspaceId, name: automation.name, createdAt: automation.createdAt }, user.email);
  return Response.json({ ok: true, softDeleted: true, retainedRuns: runs, retainedSends: sends });
}

const Post = z.object({
  action: z.literal("adopt_content"),
  nodeId: z.string().min(1),
  source: z.object({ kind: z.enum(["campaign", "template"]), id: z.string().min(1) }),
});

// Copy an existing campaign's or template's designed blocks onto an email
// step's shadow campaign. Overwrites the step's current design; the UI
// confirms with the user before calling.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { workspaceId, automation } = await owned(id);
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  const parsed = Post.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });

  const result = await adoptShadowContent({
    workspaceId,
    automationId: automation.id,
    nodeId: parsed.data.nodeId,
    source: parsed.data.source,
  });
  if (!result.ok) return Response.json(result, { status: 400 });

  const node = automation.nodes.find((n) => n.id === parsed.data.nodeId);
  await audit(
    workspaceId,
    user.email,
    "automation.email_design_adopted",
    `'${automation.name}' · step '${node?.label ?? parsed.data.nodeId}' ← ${parsed.data.source.kind} '${result.sourceName}'`,
  );
  return Response.json({ ok: true, campaignId: result.campaignId, designed: true });
}
