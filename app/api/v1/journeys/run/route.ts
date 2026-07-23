// POST /api/v1/journeys/run — execute due journey steps for the caller's
// workspace. Cron-ready: point a scheduler here every few minutes in
// production; in development it can be triggered manually. Reports exactly
// how many steps ran; each executed step is already recorded on the
// contact's timeline with its honest channel outcome.
import { NextRequest } from "next/server";
import { requireApiKey, ok } from "@/lib/server/platform";
import { processDueJourneySteps } from "@/lib/server/intelligence";

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req, null);
  if (auth instanceof Response) return auth;
  const result = await processDueJourneySteps(auth.workspaceId);
  return ok({ executed: result.executed }, auth.requestId);
}
