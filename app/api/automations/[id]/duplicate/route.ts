import { NextRequest } from "next/server";
import { currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { audit } from "@/lib/server/audit";

// Duplicate a workflow as a draft: same steps, no trigger armed, no send
// history. The copy's email nodes deliberately drop their shadow campaign
// ids so the copy earns its own history instead of inheriting the
// original's never-twice guards.

export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const workspaceId = await demoWorkspaceId();
  const source = await db.automation.findFirst({
    where: { id, workspaceId },
    include: { nodes: { orderBy: { position: "asc" } } },
  });
  if (!source) return Response.json({ ok: false }, { status: 404 });

  const copy = await db.automation.create({
    data: {
      workspaceId,
      name: `${source.name} (copy)`,
      trigger: source.trigger,
      triggerEvent: source.triggerEvent,
      allowReentry: source.allowReentry,
      status: "draft",
      isDemo: false,
    },
  });
  for (const node of source.nodes) {
    const config = (() => {
      try { return JSON.parse(node.config ?? "{}") as Record<string, unknown>; } catch { return {}; }
    })();
    delete config.campaignId;
    await db.automationNode.create({
      data: {
        automationId: copy.id,
        kind: node.kind,
        label: node.label,
        detail: node.detail,
        position: node.position,
        branch: node.branch,
        config: JSON.stringify(config),
      },
    });
  }
  await audit(workspaceId, user.email, "automation.duplicated", `'${source.name}' → '${copy.name}'`);
  return Response.json({ ok: true, id: copy.id });
}
