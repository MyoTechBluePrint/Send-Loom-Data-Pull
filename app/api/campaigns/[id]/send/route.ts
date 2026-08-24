import { NextRequest } from "next/server";
import { sendCampaign } from "@/lib/server/sending";
import { can, currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // The send is attributed to whoever is actually signed in, so the audit
  // trail names a real actor rather than a hard-coded address.
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  // The same capability the smart-send path demands. This route is the
  // MORE dangerous of the two — the whole audience in one request — and it
  // was the only send path without the check, which steered exactly the
  // people the guard exists for towards exactly the wrong button.
  if (!can(user.role, "enable_live_sending")) {
    return Response.json({ ok: false, error: "Live sending requires an owner-level account." }, { status: 403 });
  }

  const { id } = await ctx.params;
  // Scoped to the caller's workspace, as smart-send always was. A campaign
  // id from another workspace is "not found", not somebody else's send.
  const owned = await db.campaign.findFirst({ where: { id, workspaceId: user.workspaceId }, select: { id: true } });
  if (!owned) return Response.json({ ok: false, error: "Campaign not found." }, { status: 404 });

  const result = await sendCampaign(id, user.email);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
