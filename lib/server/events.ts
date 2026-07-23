// Event ingestion. Single entry point for everything that happens: plugin
// webhooks, site search, imports, email engagement. Queue-ready: the API layer
// calls eventIngestionService.process(); later this body moves behind a queue
// worker without the callers changing.
import { db } from "./db";
import { audit } from "./audit";
import { recomputeLeadScore } from "./scoring";
import { registerHandler } from "./queue";
import { dispatchPlatformEvent } from "./platform";
import { touchCart, sweepAbandoned } from "./carts";
import { sweepDueJourneys } from "./intelligence";
import { classifyEvent } from "./ingest-pipeline";
import { eventDef } from "./event-registry";

export type IncomingEvent = {
  workspaceId: string;
  storeId?: string;
  type: string;
  email?: string; // identifies (or creates) the contact where consented
  anonymousId?: string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
  origin?: string | null; // browser Origin header (transient, not persisted)
};

const TIMELINE_TITLES: Record<string, string> = {
  product_viewed: "Viewed product",
  category_viewed: "Viewed category",
  search: "Searched on site",
  cart_add: "Added to cart",
  cart_remove: "Removed from cart",
  checkout_started: "Started checkout",
  purchase_completed: "Placed order",
  account_created: "Account created",
  newsletter_signup: "Newsletter signup",
  email_open: "Opened email",
  email_click: "Clicked email",
  form_submitted: "Form submitted",
  quiz_completed: "Quiz completed",
  guide_downloaded: "Guide downloaded",
  consultation_requested: "Consultation requested",
  imported: "Imported",
  consent_recorded: "Consent recorded",
  page_viewed: "Viewed page",
  checkout_email_entered: "Entered checkout email",
  checkout_phone_entered: "Entered checkout phone",
  checkout_address_started: "Started checkout address",
  cart_updated: "Updated cart",
  popup_viewed: "Saw popup",
  popup_closed: "Closed popup",
  popup_submitted: "Submitted popup",
  recovery_link_clicked: "Clicked recovery link",
  discount_code_used: "Used discount code",
  enrichment_completed: "Enrichment completed",
  suppression_applied: "Suppressed",
  task_created: "Sales task created",
  score_changed: "Lead score changed",
};

// Event types that must never auto-create a contact (no consent implied).
const NO_AUTOCREATE = new Set(["product_viewed", "category_viewed", "search", "cart_add", "cart_remove", "cart_updated", "page_viewed", "popup_viewed", "popup_closed"]);

export const eventIngestionService = {
  async process(e: IncomingEvent) {
    const occurredAt = e.occurredAt ?? new Date();

    // 0. Validation pipeline: every event is untrusted until classified.
    const store = e.storeId
      ? await db.store.findUnique({ where: { id: e.storeId }, select: { id: true, domains: true, backendDomains: true, trackingMode: true } })
      : null;
    const verdict = classifyEvent({ type: e.type, payload: e.payload, origin: e.origin, occurredAt: e.occurredAt, store });
    if (verdict.action !== "accept") {
      if (store) {
        await db.trackingReject.create({
          data: {
            storeId: store.id,
            host: String(e.payload?.hostname ?? e.origin ?? "unknown").replace(/^https?:\/\//, ""),
            url: typeof e.payload?.url === "string" ? e.payload.url : null,
            eventType: e.type,
            reason: verdict.reason,
            kind: verdict.action === "quarantine" ? "quarantined" : "rejected",
          },
        });
      } else {
        await rejectEvent(e.workspaceId, verdict.reason, { type: e.type });
      }
      return { eventId: null, contactId: null, verdict: verdict.action, reason: verdict.reason };
    }
    const scrubbed = verdict.payload;
    const def = eventDef(e.type);
    // Only these streams may touch contacts, carts, scoring and analytics.
    const isCustomerStream = verdict.stream === "storefront" || verdict.stream === "server";

    // 1. Identify contact (never auto-create from anonymous browse events;
    //    never from test/internal streams at all).
    let contactId: string | null = null;
    if (e.email && isCustomerStream) {
      const email = e.email.trim().toLowerCase();
      const existing = await db.contact.findUnique({
        where: { workspaceId_email: { workspaceId: e.workspaceId, email } },
      });
      if (existing) {
        contactId = existing.id;
      } else if (!NO_AUTOCREATE.has(e.type)) {
        const created = await db.contact.create({
          data: { workspaceId: e.workspaceId, email, lastActivityAt: occurredAt },
        });
        contactId = created.id;
        await db.contactSource.create({
          data: { contactId, source: `Event: ${e.type}`, sourceType: "api", detail: e.storeId ? `store ${e.storeId}` : undefined },
        });
        await dispatchPlatformEvent(e.workspaceId, "contact.created", { contactId, email, source: e.type }).catch(() => {});
      }
    }

    // 2. Store the event with full provenance (scrubbed payload only).
    const event = await db.event.create({
      data: {
        workspaceId: e.workspaceId, storeId: e.storeId ?? null, contactId,
        type: e.type, anonymousId: e.anonymousId ?? null,
        payload: scrubbed ? JSON.stringify(scrubbed) : null, occurredAt,
        stream: verdict.stream, sourceContext: verdict.sourceContext, acceptReason: verdict.reason,
      },
    });

    // 3. Domain side-effects: customer streams only. Test and internal events
    //    are visible in QA but never create demand signals, carts, revenue,
    //    consent or scores.
    if (e.type === "search" && isCustomerStream) {
      await recordSearchSignal(e, contactId != null);
    }
    if (e.type === "purchase_completed" && contactId && e.payload && isCustomerStream) {
      await applyOrderRollup(contactId, e.payload);
    }
    // Cart/checkout lifecycle (keyed by cart token from the tracker).
    if (e.storeId && isCustomerStream && def.affectsCarts) {
      await touchCart(e.storeId, e.type, (scrubbed ?? {}) as Parameters<typeof touchCart>[2], contactId);
      await sweepAbandoned();
    }
    // Due journey steps ride the same traffic pulse (throttled internally);
    // a cron on /api/v1/journeys/run stays the deterministic trigger.
    await sweepDueJourneys().catch(() => undefined);
    // Form counters: the tracker reports which form drove the event.
    if ((e.type === "popup_viewed" || e.type === "popup_submitted") && isCustomerStream) {
      const formId = typeof e.payload?.popup === "string" ? e.payload.popup : undefined;
      if (formId) {
        await db.form.updateMany({
          where: { id: formId, workspaceId: e.workspaceId },
          data: e.type === "popup_viewed" ? { views: { increment: 1 } } : { signups: { increment: 1 } },
        });
      }
    }
    // A popup that collected a name fills empty name fields, never overwrites.
    if (e.type === "popup_submitted" && isCustomerStream && contactId && typeof e.payload?.name === "string") {
      const parts = e.payload.name.trim().slice(0, 120).split(/\s+/);
      if (parts[0]) {
        const c = await db.contact.findUnique({ where: { id: contactId }, select: { firstName: true, lastName: true } });
        if (c && !c.firstName && !c.lastName) {
          await db.contact.update({
            where: { id: contactId },
            data: { firstName: parts[0], lastName: parts.slice(1).join(" ") || null },
          });
        }
      }
    }
    // Platform webhook fan-out for storefront form activity.
    if (isCustomerStream && (e.type === "popup_viewed" || e.type === "popup_closed" || e.type === "popup_submitted")) {
      const hook = e.type === "popup_submitted" ? "form.submitted" : e.type === "popup_viewed" ? "popup.viewed" : "popup.closed";
      await dispatchPlatformEvent(e.workspaceId, hook, {
        formId: typeof e.payload?.popup === "string" ? e.payload.popup : null,
        contactId, email: e.email ?? null,
      }).catch(() => {});
    }
    // Popup submissions with an explicit consent tick grant email consent —
    // the one intake route that does, because the form showed a consent box.
    if (e.type === "popup_submitted" && isCustomerStream && contactId && e.payload?.consent === true) {
      await db.consentRecord.create({
        data: {
          contactId, channel: "email", status: "granted",
          lawfulBasis: "Consent (popup checkbox)",
          evidence: String(e.payload?.popup ?? "popup"), actor: "tracker",
        },
      });
      await dispatchPlatformEvent(e.workspaceId, "consent.updated", {
        contactId, channel: "email", status: "granted", source: "popup",
      }).catch(() => {});
    }
    if (e.storeId) {
      await db.store.update({ where: { id: e.storeId }, data: { lastEventAt: occurredAt } }).catch(() => {});
    }

    // 4. Timeline item for identified contacts.
    if (contactId && isCustomerStream) {
      const title = TIMELINE_TITLES[e.type] ?? e.type;
      const detail = summarisePayload(e.type, e.payload);
      await db.timelineItem.create({
        data: { contactId, type: e.type, title, detail, eventId: event.id, occurredAt },
      });
      await db.contact.update({ where: { id: contactId }, data: { lastActivityAt: occurredAt } });

      // 5. Rescore.
      if (def.affectsScoring) await recomputeLeadScore(contactId);
    }

    return { eventId: event.id, contactId, verdict: "accept" as const, stream: verdict.stream };
  },
};

function summarisePayload(type: string, payload?: Record<string, unknown>): string | undefined {
  if (!payload) return undefined;
  if (type === "search") return `"${payload.term}" · ${payload.resultCount ?? "?"} results`;
  if (type === "product_viewed" || type === "cart_add") return String(payload.productTitle ?? payload.productId ?? "");
  if (type === "purchase_completed") return `Order ${payload.orderNumber ?? ""} · £${payload.total ?? "?"}`;
  if (type === "checkout_started") return `${payload.itemCount ?? "?"} items · £${payload.total ?? "?"}`;
  const s = JSON.stringify(payload);
  return s.length > 180 ? s.slice(0, 177) + "…" : s;
}

async function recordSearchSignal(e: IncomingEvent, identified: boolean) {
  const term = String(e.payload?.term ?? "").toLowerCase().trim();
  if (!term) return;
  const existing = await db.demandSignal.findFirst({
    where: { workspaceId: e.workspaceId, kind: "site_search_term", term },
  });
  if (existing) {
    await db.demandSignal.update({ where: { id: existing.id }, data: { metric: existing.metric + 1 } });
  } else {
    await db.demandSignal.create({
      data: {
        workspaceId: e.workspaceId, source: "site_search", kind: "site_search_term", term,
        metric: 1, note: Number(e.payload?.resultCount) === 0 ? "No results · missed demand" : null,
      },
    });
  }
  if (!identified) return; // anonymous searches stay aggregate-only
}

async function applyOrderRollup(contactId: string, payload: Record<string, unknown>) {
  const total = Number(payload.total ?? 0);
  const contact = await db.contact.findUniqueOrThrow({ where: { id: contactId } });
  await db.contact.update({
    where: { id: contactId },
    data: {
      ordersCount: contact.ordersCount + 1,
      revenue: contact.revenue + total,
      lastOrderAt: new Date(),
    },
  });
}

export async function rejectEvent(workspaceId: string, reason: string, raw: unknown) {
  await audit(workspaceId, "system", "event.rejected", `${reason} · ${JSON.stringify(raw).slice(0, 300)}`);
}

// Queue registration: callers enqueue "event.ingest" jobs; the queue decides
// execution. Registered at module load so any importer wires the handler.
registerHandler<IncomingEvent>("event.ingest", async (payload) => {
  await eventIngestionService.process(payload);
});
