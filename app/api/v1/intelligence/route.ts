// POST /api/v1/intelligence — the shared API of the Communications OS.
// Business platforms post structured events; Sendloom updates the Customer
// Intelligence Profile (contact, consent, tags, attributes, timeline,
// score) and enrols lifecycle journeys. Durably idempotent by requestId:
// a retried event can never enrol or message twice. Same ApiKey auth as
// the rest of v1.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { requireApiKey, ok } from "@/lib/server/platform";
import { ingestIntelligenceEvent, knownIntelligenceEvent, type IntelligenceEvent } from "@/lib/server/intelligence";

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req, null);
  if (auth instanceof Response) return auth;

  let b: Partial<IntelligenceEvent> & { requestId?: string };
  try { b = (await req.json()) as typeof b; } catch {
    return Response.json({ ok: false, error: "Invalid JSON.", requestId: auth.requestId }, { status: 400 });
  }
  if (!b.requestId || !b.eventType || !b.platform || !b.person?.email) {
    return Response.json({ ok: false, error: "requestId, eventType, platform and person.email are required.", requestId: auth.requestId }, { status: 400 });
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.person.email) || !knownIntelligenceEvent(b.eventType)) {
    return Response.json({ ok: false, error: "Invalid person.email or eventType (expected platform.event_name).", requestId: auth.requestId }, { status: 400 });
  }

  const dupe = await db.integrationRequest.findUnique({ where: { id: b.requestId } });
  if (dupe) return ok({ accepted: true, duplicate: true, status: "already_processed" }, auth.requestId);
  await db.integrationRequest.create({ data: { id: b.requestId, integrationId: auth.integrationId, kind: "intel.event", summary: `${b.eventType} · ${b.person.email}` } });

  const result = await ingestIntelligenceEvent(auth.workspaceId, {
    eventType: b.eventType, platform: b.platform.slice(0, 40), person: b.person,
    consent: b.consent, tags: b.tags, attributes: b.attributes, data: b.data, occurredAt: b.occurredAt,
  });
  return ok({ accepted: true, duplicate: false, contactId: result.contactId, enrolledJourneys: result.enrolled }, auth.requestId);
}
