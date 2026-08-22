import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/permissions";
import { audienceBreakdown } from "@/lib/server/sending";
import type { Channel } from "@/lib/server/consent";

// The audience arithmetic, before anybody presses send: how many can this
// campaign actually reach on its channel, and where the rest went. The same
// helper the send itself uses, so the preview can never disagree with the
// send.

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  const campaign = await db.campaign.findUnique({ where: { id } });
  if (!campaign) return Response.json({ ok: false }, { status: 404 });

  const breakdown = await audienceBreakdown(
    campaign.workspaceId,
    campaign.audienceType,
    campaign.audienceRef,
    (campaign.channel ?? "email") as Channel,
  );
  return Response.json({ ok: true, channel: campaign.channel ?? "email", ...breakdown });
}
