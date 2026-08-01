// Start checkout for a plan.
//
// Returns a URL to hand off to. In Stripe mode that is a Checkout Session
// (Apple Pay, cards, SCA, £0 today because the trial end is already set). With
// no provider connected it is the local simulated screen, which says so.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/permissions";
import { can } from "@/lib/server/permissions";
import { startCheckout } from "@/lib/server/billing/provider";

const Body = z.object({
  planKey: z.string().min(1),
  cycle: z.enum(["monthly", "annual"]).default("monthly"),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!can(user.role, "change_billing")) {
    return Response.json({ ok: false, error: "Only an owner can change billing for this account." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Choose a plan and billing cycle." }, { status: 400 });

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId } });
  if (sub?.complimentary) {
    // In-house accounts have nothing to buy. Refusing here rather than
    // silently creating a subscription protects them from a stray click.
    return Response.json({ ok: false, error: "This account has complimentary access and is not billed." }, { status: 400 });
  }

  const workspace = await db.workspace.findUnique({ where: { id: user.workspaceId }, select: { name: true } });

  try {
    const handoff = await startCheckout({
      workspaceId: user.workspaceId,
      planKey: parsed.data.planKey,
      cycle: parsed.data.cycle,
      email: user.email,
      workspaceName: workspace?.name ?? user.name,
      origin: req.nextUrl.origin,
    });
    return Response.json({ ok: true, ...handoff });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : "Could not start checkout." }, { status: 400 });
  }
}
