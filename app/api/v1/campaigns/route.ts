// GET /api/v1/campaigns — the campaign boundary for consuming platforms
// (NITO Partner Hub first). SendLoom OWNS the campaign engine; consumers get
// a read-only summary and never duplicate it. Honest fields only: demo
// campaigns are flagged, real send counts come from the send ledger, and
// engagement rates are whatever is genuinely recorded.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireApiKey, ok } from "@/lib/server/platform";

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req, null);
  if (auth instanceof Response) return auth;

  const campaigns = await db.campaign.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: [{ sentAt: "desc" }, { createdAt: "desc" }],
    take: 25,
    include: { _count: { select: { sends: true } } },
  });

  return ok({
    campaigns: campaigns.map((c) => ({
      id: c.id, name: c.name, status: c.status,
      audienceSize: c.audienceSnapshot, sends: c._count.sends,
      openRate: c.openRate, clickRate: c.clickRate,
      sentAt: c.sentAt?.toISOString() ?? null,
      demo: c.isDemo, // seeded performance data, never presented as real
    })),
  }, auth.requestId);
}
