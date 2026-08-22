import { NextRequest } from "next/server";
import { sendCampaign } from "@/lib/server/sending";
import { currentUser } from "@/lib/server/permissions";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  // The send is attributed to whoever is actually signed in, so the audit
  // trail names a real actor rather than a hard-coded address.
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  const result = await sendCampaign(id, user.email);
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
