// Stripe webhook. The only thing in the system that may grant paid access.
//
// Three properties matter here and are all enforced:
//   Authenticity - the signature is verified before the body is trusted.
//   Idempotency  - every state change is keyed on the Stripe event id, so a
//                  redelivery is absorbed rather than repeated.
//   Ordering     - we act on what the event says, not on what we expected, so
//                  out-of-order delivery cannot leave an account in a state the
//                  provider disagrees with.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { verifyWebhookSignature } from "@/lib/server/billing/stripe";
import { applyCheckoutCompleted, recordEvent, type BillingCycle } from "@/lib/server/billing/provider";
import { applyFailedCharge, applySuccessfulCharge } from "@/lib/server/billing/lifecycle";
import { contextFor, notifyOnce } from "@/lib/server/billing/notifications";

type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

function str(o: Record<string, unknown>, k: string): string | undefined {
  const v = o[k];
  return typeof v === "string" ? v : undefined;
}

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!verifyWebhookSignature(raw, sig, process.env.STRIPE_WEBHOOK_SECRET)) {
    // 400, not 500: Stripe stops retrying a request it can never sign correctly.
    return Response.json({ ok: false, error: "Invalid signature" }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(raw) as StripeEvent;
  } catch {
    return Response.json({ ok: false, error: "Malformed payload" }, { status: 400 });
  }

  const obj = event.data?.object ?? {};
  const origin = process.env.APP_ORIGIN ?? req.nextUrl.origin;

  // Resolve the workspace from whatever this event carries.
  const metadata = (obj.metadata as Record<string, string> | undefined) ?? {};
  let workspaceId: string | undefined = metadata.workspaceId ?? str(obj, "client_reference_id");
  if (!workspaceId) {
    const customerId = str(obj, "customer");
    const subId = str(obj, "subscription");
    const found = customerId
      ? await db.subscription.findFirst({ where: { stripeCustomerId: customerId } })
      : subId
        ? await db.subscription.findFirst({ where: { stripeSubscriptionId: subId } })
        : null;
    workspaceId = found?.workspaceId ?? undefined;
  }
  if (!workspaceId) {
    // Acknowledge: an event for an account we do not know about is not an
    // error Stripe should keep retrying.
    return Response.json({ ok: true, ignored: `no workspace for ${event.type}` });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      await applyCheckoutCompleted({
        workspaceId,
        planKey: metadata.planKey ?? "growth",
        cycle: (metadata.cycle as BillingCycle) ?? "monthly",
        stripeSubscriptionId: str(obj, "subscription"),
        stripeCustomerId: str(obj, "customer"),
        actorLabel: "stripe:webhook",
        externalId: event.id,
      });
      const bundle = await contextFor(workspaceId, origin);
      if (bundle) await notifyOnce(bundle.subscriptionId, "billing.pm_verified", bundle.ctx, bundle.email);
      break;
    }

    case "invoice.paid":
    case "invoice.payment_succeeded": {
      const amount = typeof obj.amount_paid === "number" ? obj.amount_paid : undefined;
      const lines = obj.lines as { data?: { period?: { start?: number; end?: number } }[] } | undefined;
      const period = lines?.data?.[0]?.period;
      await applySuccessfulCharge(workspaceId, {
        actorLabel: "stripe:webhook",
        amountPence: amount,
        stripeInvoiceId: str(obj, "id"),
        hostedUrl: str(obj, "hosted_invoice_url"),
        pdfUrl: str(obj, "invoice_pdf"),
        externalId: event.id,
        periodStart: period?.start ? new Date(period.start * 1000) : undefined,
        periodEnd: period?.end ? new Date(period.end * 1000) : undefined,
      });
      const bundle = await contextFor(workspaceId, origin);
      if (bundle) await notifyOnce(bundle.subscriptionId, "billing.charge_succeeded", bundle.ctx, bundle.email);
      break;
    }

    case "invoice.payment_failed": {
      const amount = typeof obj.amount_due === "number" ? obj.amount_due : undefined;
      await applyFailedCharge(workspaceId, {
        actorLabel: "stripe:webhook",
        amountPence: amount,
        reason: "The payment was declined by the card issuer.",
        stripeInvoiceId: str(obj, "id"),
        externalId: event.id,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = await db.subscription.findUnique({ where: { workspaceId } });
      if (sub && sub.status !== "cancelled") {
        await db.subscription.update({
          where: { id: sub.id },
          data: { status: "cancelled", cancelledAt: new Date() },
        });
        await recordEvent(sub.id, {
          type: "subscription.cancelled",
          fromStatus: sub.status, toStatus: "cancelled",
          actorLabel: "stripe:webhook", externalId: event.id,
          detail: "Cancelled at the payment provider. All customer data retained.",
        });
      }
      break;
    }

    case "customer.subscription.updated": {
      const sub = await db.subscription.findUnique({ where: { workspaceId } });
      if (sub) {
        const cancelAtPeriodEnd = obj.cancel_at_period_end === true;
        const cancelAt = typeof obj.cancel_at === "number" ? new Date(obj.cancel_at * 1000) : null;
        if (cancelAtPeriodEnd && sub.status !== "scheduled_cancel") {
          await db.subscription.update({
            where: { id: sub.id },
            data: { status: "scheduled_cancel", cancelScheduledAt: cancelAt ?? sub.trialEndsAt },
          });
          await recordEvent(sub.id, {
            type: "subscription.scheduled_cancel",
            fromStatus: sub.status, toStatus: "scheduled_cancel",
            actorLabel: "stripe:webhook", externalId: event.id,
            detail: `Will not renew${cancelAt ? ` after ${cancelAt.toISOString()}` : ""}.`,
          });
        }
      }
      break;
    }

    default: {
      // Logged, not acted on. Useful when diagnosing "why did nothing happen?".
      const sub = await db.subscription.findUnique({ where: { workspaceId } });
      if (sub) {
        await recordEvent(sub.id, {
          type: `stripe.${event.type}`,
          actorLabel: "stripe:webhook",
          externalId: event.id,
          detail: "Received and acknowledged. No state change required.",
        });
      }
    }
  }

  return Response.json({ ok: true });
}
