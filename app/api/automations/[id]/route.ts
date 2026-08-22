import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";
import { TRIGGER_EVENTS } from "@/lib/server/automations";

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

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const { automation } = await owned(id);
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  return Response.json({
    ok: true,
    automation: {
      id: automation.id,
      name: automation.name,
      trigger: automation.trigger,
      triggerEvent: automation.triggerEvent,
      allowReentry: automation.allowReentry,
      status: automation.status,
      nodes: automation.nodes
        .filter((n) => !n.branch)
        .map((n) => ({
          id: n.id,
          kind: n.kind,
          label: n.label,
          detail: n.detail,
          config: (() => {
            try { return JSON.parse(n.config ?? "{}"); } catch { return {}; }
          })(),
        })),
    },
    triggerEvents: TRIGGER_EVENTS,
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

  await audit(workspaceId, user.email, "automation.workflow_edited", `'${automation.name}' · ${parsed.data.nodes.length} steps`);
  return Response.json({ ok: true });
}
