import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { authenticateStore, unauthorized } from "@/lib/server/apiAuth";

const Customer = z.object({
  externalId: z.string(),
  email: z.string().email(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  postcode: z.string().optional(),
  createdAt: z.string().optional(),
  totalOrders: z.number().optional(),
  totalRevenue: z.number().optional(),
  lastOrderAt: z.string().optional(),
  marketingConsent: z.boolean().optional(),
});

const Body = z.object({ customers: z.array(Customer).max(500) });

export async function POST(req: NextRequest) {
  const store = await authenticateStore(req);
  if (!store) return unauthorized();

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  let created = 0, updated = 0;
  for (const c of parsed.data.customers) {
    const email = c.email.toLowerCase();
    const existing = await db.contact.findUnique({
      where: { workspaceId_email: { workspaceId: store.workspaceId, email } },
    });
    const commerce = {
      externalCustomerId: c.externalId,
      phone: c.phone, city: c.city, country: c.country, postcode: c.postcode,
      ordersCount: c.totalOrders ?? existing?.ordersCount ?? 0,
      revenue: c.totalRevenue ?? existing?.revenue ?? 0,
      lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt) : undefined,
    };
    if (existing) {
      await db.contact.update({
        where: { id: existing.id },
        data: { ...commerce, firstName: existing.firstName ?? c.firstName, lastName: existing.lastName ?? c.lastName },
      });
      updated++;
    } else {
      const contact = await db.contact.create({
        data: {
          workspaceId: store.workspaceId, email,
          firstName: c.firstName, lastName: c.lastName, ...commerce,
        },
      });
      await db.contactSource.create({
        data: { contactId: contact.id, source: "WooCommerce sync", sourceType: "checkout", detail: `customer ${c.externalId}` },
      });
      // Consent only when the store explicitly says the customer opted in.
      await db.consentRecord.create({
        data: {
          contactId: contact.id, channel: "email",
          status: c.marketingConsent ? "granted" : "pending",
          lawfulBasis: c.marketingConsent ? "Consent (checkout opt-in)" : "Awaiting confirmation",
          evidence: "WooCommerce customer sync", actor: `plugin:${store.id}`,
        },
      });
      created++;
    }
  }

  await db.store.update({ where: { id: store.id }, data: { lastSyncAt: new Date() } });
  return Response.json({ ok: true, created, updated });
}
