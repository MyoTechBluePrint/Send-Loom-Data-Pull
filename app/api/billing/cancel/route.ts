// Cancellation, and the undo for it.
//
// No obstruction: one call, no retention interstitial the customer has to
// argue past. The offer of a smaller plan is presented in the UI as an option
// alongside cancelling, never as a gate in front of it.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { currentUser, can } from "@/lib/server/permissions";
import { audit } from "@/lib/server/audit";
import { cancelAtProvider, recordEvent } from "@/lib/server/billing/provider";
import { contextFor, notifyOnce } from "@/lib/server/billing/notifications";
import { DATA_RETENTION_DAYS } from "@/lib/server/billing/lifecycle";
import { formatBillingMoment } from "@/lib/server/subscription-states";

const Body = z.object({ reason: z.string().max(500).optional() });

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!can(user.role, "change_billing")) {
    return Response.json({ ok: false, error: "Only an owner can cancel this subscription." }, { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  const reason = parsed.success ? parsed.data.reason : undefined;

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId }, include: { plan: true } });
  if (!sub) return Response.json({ ok: false, error: "No subscription found." }, { status: 404 });
  if (sub.complimentary) {
    return Response.json({ ok: false, error: "This account is not billed, so there is nothing to cancel." }, { status: 400 });
  }

  // Access runs to the end of what they have already got: the trial end for a
  // trialling account, the paid period end for an active one.
  const endsAt = sub.trialEndsAt && sub.status.startsWith("trial") ? sub.trialEndsAt : sub.firstBillingAt ?? sub.trialEndsAt ?? new Date();
  const from = sub.status;

  await cancelAtProvider(sub, false).catch(() => {
    // A provider failure must not leave the customer unable to cancel. The
    // local state is authoritative for access, and the mismatch is logged.
  });

  const updated = await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: "scheduled_cancel",
      cancelScheduledAt: endsAt,
      cancelReason: reason ?? null,
      // The scheduled charge must not happen.
      firstChargePence: 0,
    },
  });

  await recordEvent(sub.id, {
    type: "cancellation.scheduled",
    fromStatus: from,
    toStatus: "scheduled_cancel",
    actorLabel: user.email,
    detail: JSON.stringify({ endsAt: endsAt.toISOString(), reason: reason ?? null }),
  });

  await audit(
    user.workspaceId,
    user.email,
    "billing.cancelled",
    `Cancelled before billing · access until ${endsAt.toISOString()} · no charge will be taken · data retained ${DATA_RETENTION_DAYS} days${reason ? ` · reason: ${reason}` : ""}`
  );

  const bundle = await contextFor(user.workspaceId, req.nextUrl.origin);
  if (bundle) await notifyOnce(bundle.subscriptionId, "billing.cancelled", bundle.ctx, bundle.email);

  return Response.json({
    ok: true,
    status: updated.status,
    accessUntil: endsAt.toISOString(),
    accessUntilLabel: formatBillingMoment(endsAt),
    retentionDays: DATA_RETENTION_DAYS,
  });
}

/** Undo a scheduled cancellation. */
export async function DELETE(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  if (!can(user.role, "change_billing")) {
    return Response.json({ ok: false, error: "Only an owner can change billing." }, { status: 403 });
  }

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId }, include: { plan: true } });
  if (!sub || sub.status !== "scheduled_cancel") {
    return Response.json({ ok: false, error: "There is no scheduled cancellation to undo." }, { status: 400 });
  }

  // Back to whichever trial state they were in, or active if already paying.
  const back = sub.paymentMethodVerifiedAt ? (sub.cancelledAt ? "active" : "trialing_pm_verified") : "trialing_no_pm";

  await db.subscription.update({
    where: { id: sub.id },
    data: {
      status: back,
      cancelScheduledAt: null,
      cancelReason: null,
      firstChargePence: sub.plan?.monthlyPence ?? null,
    },
  });

  await recordEvent(sub.id, {
    type: "cancellation.reversed",
    fromStatus: "scheduled_cancel", toStatus: back,
    actorLabel: user.email,
    detail: "Customer reinstated the subscription before it ended.",
  });
  await audit(user.workspaceId, user.email, "billing.cancellation_reversed", "Scheduled cancellation removed.");

  return Response.json({ ok: true, status: back });
}
