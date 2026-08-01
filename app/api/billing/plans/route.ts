// The plan catalogue. Public: the pricing page is reachable without an
// account, and nothing here is sensitive.
import { db } from "@/lib/server/db";
import { UNLIMITED, type EntitlementMap } from "@/lib/server/entitlements";

export type PublicPlan = {
  key: string;
  name: string;
  blurb: string | null;
  monthlyPence: number | null;
  annualPence: number | null;
  /** Annual price expressed per month, so the comparison is like for like. */
  annualMonthlyEquivalent: number | null;
  /** Real saving against 12 monthly payments. Null when there is none. */
  annualSavingPence: number | null;
  currency: string;
  recommended: boolean;
  contactSales: boolean;
  entitlements: EntitlementMap;
};

export function toPublicPlan(p: {
  key: string; name: string; blurb: string | null;
  monthlyPence: number | null; annualPence: number | null; currency: string;
  recommended: boolean; contactSales: boolean; entitlements: string;
}): PublicPlan {
  let ent: EntitlementMap = {};
  try { ent = JSON.parse(p.entitlements) as EntitlementMap; } catch { ent = {}; }

  const annualMonthlyEquivalent = p.annualPence !== null ? Math.round(p.annualPence / 12) : null;
  // Stated plainly, computed from the real numbers. No invented discount.
  const annualSavingPence =
    p.annualPence !== null && p.monthlyPence !== null && p.monthlyPence * 12 > p.annualPence
      ? p.monthlyPence * 12 - p.annualPence
      : null;

  return {
    key: p.key, name: p.name, blurb: p.blurb,
    monthlyPence: p.monthlyPence, annualPence: p.annualPence,
    annualMonthlyEquivalent, annualSavingPence,
    currency: p.currency, recommended: p.recommended, contactSales: p.contactSales,
    entitlements: ent,
  };
}

export const UNLIMITED_SENTINEL = UNLIMITED;

export async function GET() {
  const plans = await db.plan.findMany({ where: { visible: true }, orderBy: { sortOrder: "asc" } });
  return Response.json({ ok: true, plans: plans.map(toPublicPlan) });
}
