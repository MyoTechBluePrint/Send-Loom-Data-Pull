// The platform-neutral promotion engine.
//
// The product (editor, forms, automations) only ever talks to this. Store
// adapters (lib/server/commerce/*) push generated codes to WooCommerce or
// Shopify afterwards; a code exists here first and is usable in an email even
// if the push is still pending.
//
// Idempotency is structural: CouponCode is unique on (promotionId, contactId),
// so asking twice — a retried batch, a refreshed page, a re-rendered email —
// returns the same code. Previews never call this at all.

import { randomBytes } from "node:crypto";
import { db } from "@/lib/server/db";

const money = (n: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(n);

/** Human-safe code alphabet: no 0/O/1/I lookalikes. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function randomCode(len: number): string {
  const bytes = randomBytes(len);
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

export function promotionLabel(p: { kind: string; amount: number; currency: string }): string {
  return p.kind === "percent" ? `${p.amount}% off`
    : p.kind === "fixed" ? `${money(p.amount, p.currency)} off`
    : "Free shipping";
}

export function promotionTerms(p: {
  minSpend: number | null; expiryDays: number | null; individualUse: boolean; currency: string;
}): string {
  return [
    p.minSpend ? `Minimum spend ${money(p.minSpend, p.currency)}` : null,
    p.expiryDays ? `Valid for ${p.expiryDays} days` : null,
    p.individualUse ? "Cannot be combined with other offers" : null,
    "One use per customer",
  ].filter(Boolean).join(" · ");
}

export type IssuedCoupon = { code: string; label: string; terms: string; couponCodeId: string; expiresAt: Date | null };

/**
 * Issue a coupon for a contact. Shared promotions return the shared code;
 * unique promotions mint one code per contact, exactly once.
 */
export async function issueCoupon(args: {
  promotionId: string;
  workspaceId: string;
  contactId: string;
  email?: string | null;
  source: string; // campaign:<id> | form:<id> | manual
}): Promise<IssuedCoupon | null> {
  const promo = await db.promotion.findFirst({
    where: { id: args.promotionId, workspaceId: args.workspaceId, archived: false },
  });
  if (!promo) return null;

  const label = promotionLabel(promo);
  const terms = promotionTerms(promo);

  if (promo.mode === "shared") {
    if (!promo.sharedCode) return null;
    // Shared codes still get a row per contact for redemption tracking, but
    // the code itself is the same for everyone.
    const row = await db.couponCode.upsert({
      where: { promotionId_contactId: { promotionId: promo.id, contactId: args.contactId } },
      create: {
        promotionId: promo.id,
        contactId: args.contactId,
        email: args.email ?? null,
        // Shared rows need distinct `code` values for the unique constraint;
        // store the shared code with a per-contact suffix marker only in the
        // tracking row, never shown to the customer.
        code: `${promo.sharedCode}#${args.contactId}`,
        source: args.source,
        pushState: "not_required",
        expiresAt: promo.expiryDays ? new Date(Date.now() + promo.expiryDays * 86_400_000) : null,
      },
      update: {},
    });
    return { code: promo.sharedCode, label, terms, couponCodeId: row.id, expiresAt: row.expiresAt };
  }

  // Unique mode. The upsert-on-unique makes repeat calls return the original.
  const existing = await db.couponCode.findUnique({
    where: { promotionId_contactId: { promotionId: promo.id, contactId: args.contactId } },
  });
  if (existing) return { code: existing.code, label, terms, couponCodeId: existing.id, expiresAt: existing.expiresAt };

  // Retry on the astronomically-unlikely global code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `${promo.prefix}-${randomCode(3)}-${randomCode(5)}`;
    try {
      const row = await db.couponCode.create({
        data: {
          promotionId: promo.id,
          contactId: args.contactId,
          email: args.email ?? null,
          code,
          source: args.source,
          pushState: "pending", // a store adapter picks this up
          expiresAt: promo.expiryDays ? new Date(Date.now() + promo.expiryDays * 86_400_000) : null,
        },
      });
      return { code, label, terms, couponCodeId: row.id, expiresAt: row.expiresAt };
    } catch (e) {
      // Unique violation: either the global code collided (retry with a new
      // code) or a concurrent call won the per-contact race (return theirs).
      const raced = await db.couponCode.findUnique({
        where: { promotionId_contactId: { promotionId: promo.id, contactId: args.contactId } },
      });
      if (raced) return { code: raced.code, label, terms, couponCodeId: raced.id, expiresAt: raced.expiresAt };
    }
  }
  return null;
}

/**
 * Record a redemption reported by a store adapter. Idempotent.
 * Unique codes match exactly. Shared codes are attributed by the buyer's
 * email where the adapter supplies it; without an email the redemption is
 * still counted against the promotion via the earliest unredeemed row.
 */
export async function recordRedemption(code: string, orderRef: string, buyerEmail?: string | null) {
  const exact = await db.couponCode.findUnique({ where: { code } });
  if (exact) {
    if (exact.redeemedAt) return exact;
    return db.couponCode.update({ where: { id: exact.id }, data: { redeemedAt: new Date(), orderRef } });
  }
  const row = await db.couponCode.findFirst({
    where: {
      code: { startsWith: `${code}#` },
      ...(buyerEmail ? { email: buyerEmail.toLowerCase() } : { redeemedAt: null }),
    },
    orderBy: { createdAt: "asc" },
  });
  if (!row || row.redeemedAt) return row;
  return db.couponCode.update({ where: { id: row.id }, data: { redeemedAt: new Date(), orderRef } });
}
