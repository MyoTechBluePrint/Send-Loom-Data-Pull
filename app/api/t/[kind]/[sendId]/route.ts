// Open/click tracking. GET /api/t/open/<sendId> returns a 1x1 pixel;
// GET /api/t/click/<sendId>?to=<url> records then redirects. Both feed the
// event pipeline so opens/clicks update timelines and lead scores.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { eventIngestionService } from "@/lib/server/events";

const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");

export async function GET(req: NextRequest, ctx: { params: Promise<{ kind: string; sendId: string }> }) {
  const { kind, sendId } = await ctx.params;
  if (kind !== "open" && kind !== "click") {
    return Response.json({ ok: false }, { status: 404 });
  }

  const send = await db.campaignSend.findUnique({
    where: { id: sendId },
    include: { contact: true, campaign: true },
  });

  if (send) {
    const field = kind === "open" ? "openedAt" : "clickedAt";
    if (!send[field]) {
      await db.campaignSend.update({ where: { id: sendId }, data: { [field]: new Date() } });
    }
    if (send.contact.email) {
      await eventIngestionService.process({
        workspaceId: send.campaign.workspaceId,
        type: kind === "open" ? "email_open" : "email_click",
        email: send.contact.email,
        payload: { campaign: send.campaign.name, url: req.nextUrl.searchParams.get("to") ?? undefined },
      });
    }
  }

  if (kind === "click") {
    const to = req.nextUrl.searchParams.get("to");
    const safe = to && /^https?:\/\//.test(to) ? to : "https://vitaliswellness.co.uk";
    return Response.redirect(safe, 302);
  }
  return new Response(PIXEL, { headers: { "Content-Type": "image/gif", "Cache-Control": "no-store" } });
}
