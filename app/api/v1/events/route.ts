import { NextRequest } from "next/server";
import { z } from "zod";
import { readSignedBody } from "@/lib/server/apiAuth";
import { rejectEvent, type IncomingEvent } from "@/lib/server/events";
import { enqueue } from "@/lib/server/queue";

const EVENT_TYPES = [
  "product_viewed", "category_viewed", "search", "cart_add", "cart_remove",
  "checkout_started", "checkout_completed", "purchase_completed",
  "account_created", "newsletter_signup", "form_submitted", "quiz_completed",
  "guide_downloaded", "consultation_requested", "consultation_booked",
] as const;

const EventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  email: z.string().email().optional(),
  anonymousId: z.string().max(64).optional(),
  occurredAt: z.string().datetime().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

const Body = z.union([EventSchema, z.object({ events: z.array(EventSchema).max(100) })]);

export async function POST(req: NextRequest) {
  const auth = await readSignedBody(req);
  if (auth instanceof Response) return auth;
  const { store, body } = auth;

  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    await rejectEvent(store.workspaceId, "event.validation_failed", body);
    return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const events = "events" in parsed.data ? parsed.data.events : [parsed.data];
  for (const e of events) {
    const payload: IncomingEvent = {
      workspaceId: store.workspaceId,
      storeId: store.id,
      type: e.type,
      email: e.email,
      anonymousId: e.anonymousId,
      payload: e.payload,
      occurredAt: e.occurredAt ? new Date(e.occurredAt) : undefined,
    };
    await enqueue({ name: "event.ingest", payload });
  }

  return Response.json({ ok: true, accepted: events.length });
}
