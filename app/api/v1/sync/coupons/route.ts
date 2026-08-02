// Coupon jobs for the WooCommerce plugin (>= 4.5).
//
// GET: the store's pending generated codes with their full restriction set,
//      ready to create as Woo coupons.
// POST: confirmations (created / failed) and redemptions observed at
//       checkout. All idempotent: re-confirming a pushed code or re-reporting
//       a redemption changes nothing.
//
// Same signed-channel authentication as every other plugin endpoint.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { authenticateStore, readSignedBody, unauthorized } from "@/lib/server/apiAuth";
import { recordRedemption } from "@/lib/server/promotions";

export async function GET(req: NextRequest) {
  const store = await authenticateStore(req);
  if (!store) return unauthorized();

  const pending = await db.couponCode.findMany({
    where: { pushState: "pending", promotion: { storeId: store.id } },
    include: { promotion: true },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  return Response.json({
    ok: true,
    coupons: pending.map((c) => ({
      id: c.id,
      code: c.code,
      email: c.promotion.emailRestricted ? c.email : null,
      kind: c.promotion.kind, // percent | fixed | free_shipping
      amount: c.promotion.amount,
      expiresAt: c.expiresAt?.toISOString() ?? null,
      usageLimit: c.promotion.usageLimit,
      usageLimitPerCustomer: c.promotion.perCustomer,
      minSpend: c.promotion.minSpend,
      maxSpend: c.promotion.maxSpend,
      individualUse: c.promotion.individualUse,
      includeProductIds: c.promotion.includeProductIds,
      excludeProductIds: c.promotion.excludeProductIds,
      includeCategories: c.promotion.includeCategories,
      excludeCategories: c.promotion.excludeCategories,
    })),
  });
}

const Body = z.object({
  confirmed: z.array(z.object({
    id: z.string(),
    ok: z.boolean(),
    externalId: z.string().optional(),
    error: z.string().max(300).optional(),
  })).max(100).default([]),
  redemptions: z.array(z.object({
    code: z.string().max(80),
    orderRef: z.string().max(80),
    email: z.string().email().optional(),
  })).max(100).default([]),
});

export async function POST(req: NextRequest) {
  const auth = await readSignedBody(req);
  if (auth instanceof Response) return auth;
  const { store, body } = auth;

  const parsed = Body.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  let pushed = 0, failed = 0, redeemed = 0;

  for (const c of parsed.data.confirmed) {
    const row = await db.couponCode.findFirst({
      where: { id: c.id, promotion: { storeId: store.id } },
    });
    if (!row || row.pushState === "pushed") continue; // idempotent
    await db.couponCode.update({
      where: { id: row.id },
      data: c.ok
        ? { pushState: "pushed", externalId: c.externalId ?? null, pushedAt: new Date() }
        : { pushState: "failed" },
    });
    if (c.ok) pushed++; else failed++;
  }

  for (const r of parsed.data.redemptions) {
    const row = await recordRedemption(r.code, r.orderRef, r.email ?? null);
    if (row?.redeemedAt) redeemed++;
  }

  return Response.json({ ok: true, pushed, failed, redeemed });
}
