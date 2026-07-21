// GET /api/v1/segments — read the audience segments (segments:read).
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireApiKey, ok } from "@/lib/server/platform";

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req, "segments:read");
  if (auth instanceof Response) return auth;

  const segments = await db.segment.findMany({
    where: { workspaceId: auth.workspaceId },
    orderBy: { count: "desc" },
    select: { id: true, name: true, description: true, count: true, computedAt: true },
  });
  return ok({ segments }, auth.requestId);
}
