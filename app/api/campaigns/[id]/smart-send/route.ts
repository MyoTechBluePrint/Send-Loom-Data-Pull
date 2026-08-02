// Smart-send controls for one campaign: start (immediate or gradual), pause,
// resume, cancel, and live progress.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { currentUser, can } from "@/lib/server/permissions";
import {
  startSmartSend, pauseSmartSend, resumeSmartSend, cancelSmartSend, smartSendProgress,
} from "@/lib/server/smart-send";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const owned = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId }, select: { id: true } });
  if (!owned) return Response.json({ ok: false, error: "Campaign not found." }, { status: 404 });
  return Response.json({ ok: true, progress: await smartSendProgress(id) });
}

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    mode: z.enum(["immediate", "gradual"]).default("gradual"),
    durationMins: z.number().int().min(15).max(7 * 1440).optional(),
    batchSize: z.number().int().min(10).max(1000).optional(),
    windowStart: z.number().int().min(0).max(23).nullable().optional(),
    windowEnd: z.number().int().min(0).max(23).nullable().optional(),
  }),
  z.object({ action: z.literal("pause") }),
  z.object({ action: z.literal("resume") }),
  z.object({ action: z.literal("cancel") }),
]);

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  // Live sending is a protected capability, same as elsewhere in the product.
  if (!can(user.role, "enable_live_sending")) {
    return Response.json({ ok: false, error: "Live sending requires an owner-level account." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const owned = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId }, select: { id: true } });
  if (!owned) return Response.json({ ok: false, error: "Campaign not found." }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unknown action." }, { status: 400 });
  const a = parsed.data;

  switch (a.action) {
    case "start": {
      const result = await startSmartSend(id, user.email, a);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }
    case "pause":
      await pauseSmartSend(id, user.email);
      return Response.json({ ok: true });
    case "resume":
      await resumeSmartSend(id, user.email);
      return Response.json({ ok: true });
    case "cancel": {
      const cancelled = await cancelSmartSend(id, user.email);
      return Response.json({ ok: true, cancelled });
    }
  }
}
