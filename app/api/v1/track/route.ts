// POST /api/v1/track — the lifecycle event write-path for every connector.
// Events are namespaced (marketvox.lead.created, mvsocial.trader.followed,
// custom.*) and become Sendloom events, contact timeline entries and
// webhook fan-out. Batch up to 50.
import { NextRequest } from "next/server";
import { z } from "zod";
import { requireApiKey, ok, ingestIntegrationEvent } from "@/lib/server/platform";

const EventSchema = z.object({
  event: z.string().min(3).max(120).regex(/^[a-z0-9_.-]+$/i, "namespaced like marketvox.lead.created"),
  email: z.string().email().optional(),
  occurredAt: z.string().datetime().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});
const Body = z.union([EventSchema, z.object({ events: z.array(EventSchema).min(1).max(50) })]);

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req, "events:write");
  if (auth instanceof Response) return auth;

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten(), requestId: auth.requestId }, { status: 400 });
  }
  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];

  const results = [];
  for (const e of events) {
    const r = await ingestIntegrationEvent({
      workspaceId: auth.workspaceId,
      integrationId: auth.integrationId,
      integrationSlug: auth.integrationSlug,
      name: e.event,
      email: e.email,
      data: e.data,
      occurredAt: e.occurredAt ? new Date(e.occurredAt) : undefined,
    });
    results.push({ event: e.event, eventId: r.eventId, contactId: r.contactId });
  }
  return ok({ accepted: results.length, results }, auth.requestId, 202);
}
