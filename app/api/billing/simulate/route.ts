// Completes the SIMULATED checkout, used only when no payment provider is
// connected. It exists so the whole seven-day journey can be walked and tested
// before Stripe credentials arrive.
//
// Two guards, because a simulated payment path is exactly the kind of thing
// that must never survive into production by accident:
//   - refuses outright when a real provider IS configured
//   - refuses in production unless the operator has explicitly opted in
import { NextRequest } from "next/server";
import { z } from "zod";
import { currentUser, can } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { applyCheckoutCompleted, providerMode, type BillingCycle } from "@/lib/server/billing/provider";
import { contextFor, notifyOnce } from "@/lib/server/billing/notifications";

const Body = z.object({
  planKey: z.string().min(1),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

export function simulationAllowed(): boolean {
  if (providerMode() === "stripe") return false;
  if (process.env.NODE_ENV === "production") return process.env.SENDLOOM_ALLOW_SIMULATED_BILLING === "yes";
  return true;
}

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!can(user.role, "change_billing")) {
    return Response.json({ ok: false, error: "Only an owner can change billing for this account." }, { status: 403 });
  }
  if (!simulationAllowed()) {
    return Response.json(
      { ok: false, error: "Simulated billing is disabled. Configure STRIPE_SECRET_KEY to take real payments." },
      { status: 400 }
    );
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Choose a plan." }, { status: 400 });

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId } });
  if (sub?.complimentary) {
    return Response.json({ ok: false, error: "This account has complimentary access and is not billed." }, { status: 400 });
  }

  const updated = await applyCheckoutCompleted({
    workspaceId: user.workspaceId,
    planKey: parsed.data.planKey,
    cycle: parsed.data.cycle as BillingCycle,
    paymentMethodBrand: "simulated",
    paymentMethodLast4: "0000",
    actorLabel: user.email,
    // Stable id: revisiting or refreshing the screen cannot verify twice.
    externalId: `sim_${user.workspaceId}_${parsed.data.planKey}_${parsed.data.cycle}`,
  });

  if (!updated) return Response.json({ ok: false, error: "No subscription found for this account." }, { status: 400 });

  const bundle = await contextFor(user.workspaceId, req.nextUrl.origin);
  if (bundle) await notifyOnce(bundle.subscriptionId, "billing.pm_verified", bundle.ctx, bundle.email);

  return Response.json({ ok: true, status: updated.status });
}
