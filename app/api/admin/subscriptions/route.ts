// Admin view of every account's subscription, and the controls to change one.
//
// Every mutation writes both a SubscriptionEvent (billing history) and an
// AuditLog entry (who did it), because "an admin changed this by hand" is
// exactly the fact you need months later and never have.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { can, currentUser } from "@/lib/server/permissions";
import { recordEvent } from "@/lib/server/billing/provider";
import { SUBSCRIPTION_STATES, STATE_META, formatMoney, type SubscriptionStatus } from "@/lib/server/subscription-states";

export async function GET() {
  const user = await currentUser();
  if (!user || !can(user.role, "view_admin")) {
    return Response.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }

  const subs = await db.subscription.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      plan: true,
      workspace: { select: { id: true, name: true, createdAt: true } },
      invoices: { orderBy: { issuedAt: "desc" }, take: 3 },
      _count: { select: { events: true } },
    },
  });

  const rows = await Promise.all(
    subs.map(async (s) => {
      const [contacts, users, stores] = await Promise.all([
        db.contact.count({ where: { workspaceId: s.workspaceId } }),
        db.user.count({ where: { workspaceId: s.workspaceId, disabled: false } }),
        db.store.count({ where: { workspaceId: s.workspaceId } }),
      ]);
      const meta = STATE_META[s.status as SubscriptionStatus];
      return {
        workspaceId: s.workspaceId,
        workspaceName: s.workspace.name,
        createdAt: s.workspace.createdAt.toISOString(),
        status: s.status,
        statusLabel: meta?.label ?? s.status,
        tone: meta?.tone ?? "neutral",
        exempt: meta?.exempt ?? false,
        complimentary: s.complimentary,
        planKey: s.plan?.key ?? null,
        planName: s.plan?.name ?? null,
        billingCycle: s.billingCycle,
        trialStartedAt: s.trialStartedAt?.toISOString() ?? null,
        trialStageOneEndsAt: s.trialStageOneEndsAt?.toISOString() ?? null,
        trialEndsAt: s.trialEndsAt?.toISOString() ?? null,
        firstBillingAt: s.firstBillingAt?.toISOString() ?? null,
        amountLabel: s.firstChargePence !== null ? formatMoney(s.firstChargePence) : s.plan?.monthlyPence ? formatMoney(s.plan.monthlyPence) : null,
        paymentMethodVerified: Boolean(s.paymentMethodVerifiedAt),
        creditPence: s.creditPence,
        cancelReason: s.cancelReason,
        cancelScheduledAt: s.cancelScheduledAt?.toISOString() ?? null,
        paymentFailedAt: s.paymentFailedAt?.toISOString() ?? null,
        paymentRetryCount: s.paymentRetryCount,
        notes: s.notes,
        usage: { contacts, users, stores },
        invoices: s.invoices.map((i) => ({ number: i.number, amountLabel: formatMoney(i.amountPence, i.currency), status: i.status })),
        eventCount: s._count.events,
      };
    })
  );

  return Response.json({ ok: true, subscriptions: rows, states: SUBSCRIPTION_STATES });
}

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("set_plan"), workspaceId: z.string(), planKey: z.string(), cycle: z.enum(["monthly", "annual"]).default("monthly") }),
  z.object({ action: z.literal("set_status"), workspaceId: z.string(), status: z.enum(SUBSCRIPTION_STATES) }),
  z.object({ action: z.literal("extend_trial"), workspaceId: z.string(), days: z.number().int().min(1).max(90) }),
  z.object({ action: z.literal("end_trial"), workspaceId: z.string() }),
  z.object({ action: z.literal("grant_complimentary"), workspaceId: z.string(), note: z.string().max(300).optional() }),
  z.object({ action: z.literal("revoke_complimentary"), workspaceId: z.string() }),
  z.object({ action: z.literal("apply_credit"), workspaceId: z.string(), pence: z.number().int().min(0).max(1_000_000) }),
  z.object({ action: z.literal("set_overrides"), workspaceId: z.string(), overrides: z.string() }),
  z.object({ action: z.literal("pause"), workspaceId: z.string() }),
  z.object({ action: z.literal("cancel"), workspaceId: z.string(), reason: z.string().max(300).optional() }),
]);

export async function PATCH(req: NextRequest) {
  const user = await currentUser();
  // Billing overrides are owner-level, not merely admin-level: they move money.
  if (!user || !can(user.role, "change_billing")) {
    return Response.json({ ok: false, error: "Owner access required to change billing." }, { status: 403 });
  }

  const parsed = Action.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Unrecognised action." }, { status: 400 });
  const a = parsed.data;

  const sub = await db.subscription.findUnique({ where: { workspaceId: a.workspaceId }, include: { plan: true } });
  if (!sub) return Response.json({ ok: false, error: "No subscription for that workspace." }, { status: 404 });

  const from = sub.status;
  let detail = "";
  let toStatus: string | null = null;

  switch (a.action) {
    case "set_plan": {
      const plan = await db.plan.findUnique({ where: { key: a.planKey } });
      if (!plan) return Response.json({ ok: false, error: "Unknown plan." }, { status: 400 });
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          planId: plan.id,
          billingCycle: a.cycle,
          firstChargePence: a.cycle === "annual" ? plan.annualPence : plan.monthlyPence,
        },
      });
      detail = `Moved to ${plan.name} (${a.cycle}) by an administrator.`;
      break;
    }
    case "set_status": {
      await db.subscription.update({ where: { id: sub.id }, data: { status: a.status } });
      toStatus = a.status;
      detail = `Status set to ${a.status} by an administrator.`;
      break;
    }
    case "extend_trial": {
      const base = sub.trialEndsAt ?? new Date();
      const ends = new Date(base.getTime() + a.days * 86_400_000);
      const stageOne = sub.trialStageOneEndsAt
        ? new Date(sub.trialStageOneEndsAt.getTime() + a.days * 86_400_000)
        : null;
      await db.subscription.update({
        where: { id: sub.id },
        data: { trialEndsAt: ends, firstBillingAt: ends, trialStageOneEndsAt: stageOne },
      });
      detail = `Trial extended by ${a.days} day${a.days === 1 ? "" : "s"} to ${ends.toISOString()}.`;
      break;
    }
    case "end_trial": {
      const now = new Date();
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: "trial_action_required", trialStageOneEndsAt: now, trialEndsAt: now },
      });
      toStatus = "trial_action_required";
      detail = "Trial ended early by an administrator. No data was removed.";
      break;
    }
    case "grant_complimentary": {
      const internal = await db.plan.findUnique({ where: { key: "internal" } });
      await db.subscription.update({
        where: { id: sub.id },
        data: {
          complimentary: true, status: "complimentary",
          planId: internal?.id ?? sub.planId,
          firstChargePence: 0,
          notes: a.note ?? sub.notes,
        },
      });
      toStatus = "complimentary";
      detail = `Complimentary access granted${a.note ? `: ${a.note}` : ""}. This account will never be billed or metered.`;
      break;
    }
    case "revoke_complimentary": {
      await db.subscription.update({
        where: { id: sub.id },
        data: { complimentary: false, status: "trial_action_required" },
      });
      toStatus = "trial_action_required";
      detail = "Complimentary access revoked. The account must choose a plan.";
      break;
    }
    case "apply_credit": {
      await db.subscription.update({ where: { id: sub.id }, data: { creditPence: a.pence } });
      detail = `Account credit set to ${formatMoney(a.pence)}.`;
      break;
    }
    case "set_overrides": {
      try {
        JSON.parse(a.overrides);
      } catch {
        return Response.json({ ok: false, error: "Overrides must be valid JSON." }, { status: 400 });
      }
      await db.subscription.update({ where: { id: sub.id }, data: { entitlementOverrides: a.overrides } });
      detail = `Entitlement overrides set to ${a.overrides}.`;
      break;
    }
    case "pause": {
      await db.subscription.update({ where: { id: sub.id }, data: { status: "paused" } });
      toStatus = "paused";
      detail = "Subscription paused by an administrator. All data retained.";
      break;
    }
    case "cancel": {
      await db.subscription.update({
        where: { id: sub.id },
        data: { status: "cancelled", cancelledAt: new Date(), cancelReason: a.reason ?? "Cancelled by administrator", firstChargePence: 0 },
      });
      toStatus = "cancelled";
      detail = `Cancelled by an administrator${a.reason ? `: ${a.reason}` : ""}. No further charges. All data retained.`;
      break;
    }
  }

  await recordEvent(sub.id, {
    type: `admin.${a.action}`,
    fromStatus: from,
    toStatus,
    actorLabel: user.email,
    detail,
  });
  await audit(a.workspaceId, user.email, `billing.admin.${a.action}`, detail);

  return Response.json({ ok: true, detail });
}
