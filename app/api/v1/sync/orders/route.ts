import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { authenticateStore, unauthorized } from "@/lib/server/apiAuth";
import { eventIngestionService } from "@/lib/server/events";

const OrderSchema = z.object({
  externalId: z.string(),
  number: z.string(),
  status: z.string(),
  email: z.string().email().optional(),
  total: z.number(),
  tax: z.number().optional(),
  shipping: z.number().optional(),
  discount: z.number().optional(),
  refunded: z.number().optional(),
  coupon: z.string().optional(),
  paymentMethod: z.string().optional(),
  placedAt: z.string().optional(),
  items: z.array(z.object({
    externalProductId: z.string(), title: z.string(), qty: z.number(),
    price: z.number().optional(), categories: z.array(z.string()).optional(),
  })).optional(),
});

const Body = z.object({ orders: z.array(OrderSchema).max(500) });

export async function POST(req: NextRequest) {
  const store = await authenticateStore(req);
  if (!store) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  let upserted = 0;
  for (const o of parsed.data.orders) {
    const contact = o.email
      ? await db.contact.findUnique({ where: { workspaceId_email: { workspaceId: store.workspaceId, email: o.email.toLowerCase() } } })
      : null;

    const existing = await db.order.findUnique({ where: { storeId_externalId: { storeId: store.id, externalId: o.externalId } } });
    const data = {
      number: o.number, status: o.status, total: o.total,
      tax: o.tax ?? 0, shipping: o.shipping ?? 0, discount: o.discount ?? 0, refunded: o.refunded ?? 0,
      coupon: o.coupon, paymentMethod: o.paymentMethod,
      items: o.items ? JSON.stringify(o.items) : null,
      placedAt: o.placedAt ? new Date(o.placedAt) : new Date(),
      contactId: contact?.id ?? null,
    };
    if (existing) {
      await db.order.update({ where: { id: existing.id }, data });
    } else {
      await db.order.create({ data: { storeId: store.id, externalId: o.externalId, ...data } });
      // New completed order for an identified contact runs through ingestion
      // (rollups + timeline + rescore), same as a live purchase event.
      if (contact && (o.status === "completed" || o.status === "processing")) {
        await eventIngestionService.process({
          workspaceId: store.workspaceId, storeId: store.id, type: "purchase_completed",
          email: contact.email, payload: { orderNumber: o.number, total: o.total },
          occurredAt: data.placedAt,
        });
      }
    }
    upserted++;
  }

  await db.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  return Response.json({ ok: true, upserted });
}
