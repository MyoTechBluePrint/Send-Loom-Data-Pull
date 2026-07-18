// Event ingestion. Single entry point for everything that happens: plugin
// webhooks, site search, imports, email engagement. Queue-ready: the API layer
// calls eventIngestionService.process(); later this body moves behind a queue
// worker without the callers changing.
import { db } from "./db";
import { audit } from "./audit";
import { recomputeLeadScore } from "./scoring";
import { registerHandler } from "./queue";
import { touchCart, sweepAbandoned } from "./carts";

export type IncomingEvent = {
  workspaceId: string;
  storeId?: string;
  type: string;
  email?: string; // identifies (or creates) the contact where consented
  anonymousId?: string;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
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

    // 1. Identify contact (never auto-create from anonymous browse events).
    let contactId: string | null = null;
    if (e.email) {
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
      }
    }

    // 2. Store the raw event (aggregate-only when anonymous).
    const event = await db.event.create({
      data: {
        workspaceId: e.workspaceId, storeId: e.storeId ?? null, contactId,
        type: e.type, anonymousId: e.anonymousId ?? null,
        payload: e.payload ? JSON.stringify(e.payload) : null, occurredAt,
      },
    });

    // 3. Domain side-effects.
    if (e.type === "search") {
      await recordSearchSignal(e, contactId != null);
    }
    if (e.type === "purchase_completed" && contactId && e.payload) {
      await applyOrderRollup(contactId, e.payload);
    }
    // Cart/checkout lifecycle (keyed by cart token from the tracker).
    if (e.storeId && ["cart_add", "cart_remove", "cart_updated", "checkout_started", "checkout_email_entered", "checkout_phone_entered", "checkout_address_started", "checkout_completed", "purchase_completed"].includes(e.type)) {
      await touchCart(e.storeId, e.type, (e.payload ?? {}) as Parameters<typeof touchCart>[2], contactId);
      await sweepAbandoned();
    }
    // Popup submissions with an explicit consent tick grant email consent —
    // the one intake route that does, because the form showed a consent box.
    if (e.type === "popup_submitted" && contactId && e.payload?.consent === true) {
      await db.consentRecord.create({
        data: {
          contactId, channel: "email", status: "granted",
          lawfulBasis: "Consent (popup checkbox)",
          evidence: String(e.payload?.popup ?? "popup"), actor: "tracker",
        },
      });
    }
    if (e.storeId) {
      await db.store.update({ where: { id: e.storeId }, data: { lastEventAt: occurredAt } }).catch(() => {});
    }

    // 4. Timeline item for identified contacts.
    if (contactId) {
      const title = TIMELINE_TITLES[e.type] ?? e.type;
      const detail = summarisePayload(e.type, e.payload);
      await db.timelineItem.create({
        data: { contactId, type: e.type, title, detail, eventId: event.id, occurredAt },
      });
      await db.contact.update({ where: { id: contactId }, data: { lastActivityAt: occurredAt } });

      // 5. Rescore.
      await recomputeLeadScore(contactId);
    }

    return { eventId: event.id, contactId };
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
