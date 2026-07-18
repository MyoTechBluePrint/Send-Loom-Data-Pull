import { NextRequest } from "next/server";
import { sendCampaign } from "@/lib/server/sending";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const result = await sendCampaign(id, "steve@vitaliswellness.co.uk");
  return Response.json(result, { status: result.ok ? 200 : 422 });
}
