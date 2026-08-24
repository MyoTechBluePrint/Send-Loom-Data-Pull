import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";
import { TRIGGER_EVENTS, ensureShadowCampaigns, adoptShadowContent } from "@/lib/server/automations";
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
  kind: z.enum(["trigger", "email", "delay", "exit"]),
  label: z.string().min(1).max(140),
  detail: z.string().max(300).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const Put = z.object({ nodes: z.array(NodeInput).min(1).max(30) });

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { workspaceId, automation } = await owned(id);
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  const parsed = Put.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

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
      const config = JSON.stringify({ ...storedConfig, ...(n.config ?? {}) });
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
