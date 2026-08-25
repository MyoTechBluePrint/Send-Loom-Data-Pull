import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";
import { stopRun } from "@/lib/server/automations";

// Stop one contact's walk through a workflow, from the Runs table on the
// workflow page. Workspace-scoped: the run must belong to an automation the
// caller's workspace owns, or the id is treated as unknown.

export const dynamic = "force-dynamic";

const Post = z.object({
  action: z.literal("stop"),
  runId: z.string().min(1),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const workspaceId = await demoWorkspaceId();
  const automation = await db.automation.findFirst({
    where: { id, workspaceId },
    select: { id: true, name: true },
  });
  if (!automation) return Response.json({ ok: false }, { status: 404 });

  const parsed = Post.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });

  const run = await db.automationRun.findFirst({
    where: { id: parsed.data.runId, automationId: automation.id },
    select: { id: true, contact: { select: { email: true } } },
  });
  if (!run) return Response.json({ ok: false, error: "Run not found." }, { status: 404 });

  // stopRun's conditional update makes the click safe against races: a run
  // that completed or was stopped between page load and press keeps its
  // first ending, and this reports stopped: false rather than lying.
  const stopped = await stopRun(run.id, "stopped_manually", `stopped by ${user.email}`);
  if (stopped) {
    await audit(
      workspaceId,
      user.email,
      "automation.run_stopped",
      `'${automation.name}' · ${run.contact.email ?? "contact without email"}`,
    );
  }
  return Response.json({ ok: true, stopped });
}
