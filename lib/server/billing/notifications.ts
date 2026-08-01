// Lifecycle notifications.
//
// Every message states the exact amount, the exact date and the exact way out.
// The spec forbids vague wording like "charged later", so the templates take
// real values and refuse to render a money or date placeholder that is not set.
//
// Delivery goes through the platform's existing provider, which means that
// without EMAIL_SENDING_ENABLED and credentials these are logged by the dev
// transport rather than delivered. That is recorded truthfully in the event
// log: "queued (dev transport)", never "sent".

import { db } from "@/lib/server/db";
import { activeProvider } from "@/lib/server/sending";
import { formatBillingMoment, formatMoney } from "@/lib/server/subscription-states";
import { recordEvent } from "./provider";

export type NotificationKey =
  | "trial.activated"
  | "trial.day3_warning_24h"
  | "trial.day3_reached"
  | "billing.pm_verified"
  | "billing.charge_48h"
  | "billing.charge_24h"
  | "billing.charge_succeeded"
  | "billing.charge_failed"
  | "billing.cancelled";

type Ctx = {
  workspaceName: string;
  planName: string | null;
  amountPence: number | null;
  firstBillingAt: Date | null;
  trialEndsAt: Date | null;
  stageOneEndsAt: Date | null;
  manageUrl: string;
  plansUrl: string;
  restrictedAt?: Date | null;
  retryAt?: Date | null;
};

const money = (p: number | null) => (p === null ? null : formatMoney(p));
const when = (d: Date | null | undefined) => (d ? formatBillingMoment(d) : null);

/** Subject and body for each moment. Returns null when required facts are absent. */
export function template(key: NotificationKey, c: Ctx): { subject: string; html: string } | null {
  const p = (s: string) => `<p style="margin:0 0 12px;font:14px/1.6 -apple-system,Segoe UI,sans-serif;color:#2c2b28">${s}</p>`;
  const wrap = (title: string, body: string) =>
    `<div style="max-width:520px;margin:0 auto;padding:24px">
      <h1 style="margin:0 0 16px;font:600 18px -apple-system,Segoe UI,sans-serif;color:#14121f">${title}</h1>
      ${body}
      <p style="margin:20px 0 0;font:12px/1.6 -apple-system,Segoe UI,sans-serif;color:#898781">
        SendLoom · <a href="${c.manageUrl}" style="color:#6d28d9">Manage billing</a>
      </p>
    </div>`;

  switch (key) {
    case "trial.activated": {
      const stage1 = when(c.stageOneEndsAt);
      const end = when(c.trialEndsAt);
      if (!stage1 || !end) return null;
      return {
        subject: "Your SendLoom free trial has started",
        html: wrap("Your free trial has started", [
          p(`Your seven-day free trial of SendLoom is live. You can connect your website, import contacts, build campaigns and automations, and see revenue attribution straight away.`),
          p(`<strong>No payment details are required for the first three days.</strong>`),
          p(`Choose your plan by <strong>${stage1}</strong> to continue your full seven-day free trial. Your trial ends on <strong>${end}</strong>.`),
          p(`<a href="${c.plansUrl}" style="color:#6d28d9">View subscription options</a>`),
        ].join("")),
      };
    }
    case "trial.day3_warning_24h": {
      const stage1 = when(c.stageOneEndsAt);
      const end = when(c.trialEndsAt);
      if (!stage1 || !end) return null;
      return {
        subject: "Choose your SendLoom plan tomorrow to keep your trial running",
        html: wrap("Your no-payment stage ends tomorrow", [
          p(`The first three days of your trial end on <strong>${stage1}</strong>.`),
          p(`To continue through to the end of your seven-day free trial, choose a plan and verify your payment method. <strong>£0 is taken at verification.</strong>`),
          p(`Your first real payment is not due until <strong>${end}</strong>, and you can cancel before then without being charged.`),
          p(`<a href="${c.plansUrl}" style="color:#6d28d9">Choose your plan</a>`),
        ].join("")),
      };
    }
    case "trial.day3_reached": {
      const end = when(c.trialEndsAt);
      if (!end) return null;
      return {
        subject: "Continue your SendLoom free trial",
        html: wrap("Continue your free trial", [
          p(`Choose your SendLoom plan and securely verify your payment method. <strong>You will not be charged today.</strong>`),
          p(`Your first monthly payment will be taken automatically when your seven-day free trial ends on <strong>${end}</strong>.`),
          p(`Everything you have built so far is saved and waiting.`),
          p(`<a href="${c.plansUrl}" style="color:#6d28d9">Choose your plan</a>`),
        ].join("")),
      };
    }
    case "billing.pm_verified": {
      const amt = money(c.amountPence);
      const bill = when(c.firstBillingAt);
      if (!amt || !bill || !c.planName) return null;
      return {
        subject: `${c.planName} selected · £0 taken today`,
        html: wrap("Your payment method is verified", [
          p(`<strong>£0.00 was taken today.</strong> Your card was verified only.`),
          p(`Plan: <strong>${c.planName}</strong><br>Monthly amount: <strong>${amt}</strong><br>First payment: <strong>${bill}</strong>`),
          p(`You keep full access for the rest of your free trial. Cancel before ${bill} and you will not be charged.`),
        ].join("")),
      };
    }
    case "billing.charge_48h":
    case "billing.charge_24h": {
      const amt = money(c.amountPence);
      const bill = when(c.firstBillingAt);
      if (!amt || !bill || !c.planName) return null;
      const hrs = key === "billing.charge_48h" ? "48 hours" : "24 hours";
      return {
        subject: `Your SendLoom subscription starts in ${hrs}`,
        html: wrap(`Your first payment is in ${hrs}`, [
          p(`Plan: <strong>${c.planName}</strong><br>Amount: <strong>${amt}</strong><br>Date: <strong>${bill}</strong>`),
          p(`Nothing needs doing if you are happy to continue.`),
          p(`You can <a href="${c.plansUrl}" style="color:#6d28d9">change your plan</a> or <a href="${c.manageUrl}" style="color:#6d28d9">cancel</a> before ${bill} and you will not be charged.`),
        ].join("")),
      };
    }
    case "billing.charge_succeeded": {
      const amt = money(c.amountPence);
      if (!amt || !c.planName) return null;
      return {
        subject: `Payment received · ${c.planName}`,
        html: wrap("Thank you, your subscription is active", [
          p(`We have taken <strong>${amt}</strong> for <strong>${c.planName}</strong>.`),
          p(`Your invoice and receipt are in your billing area. Everything you built during your trial is exactly as you left it.`),
          p(`<a href="${c.manageUrl}" style="color:#6d28d9">View invoices and manage billing</a>`),
        ].join("")),
      };
    }
    case "billing.charge_failed": {
      const amt = money(c.amountPence);
      const restricted = when(c.restrictedAt);
      if (!amt) return null;
      return {
        subject: "Your SendLoom payment did not go through",
        html: wrap("We could not take your payment", [
          p(`The payment of <strong>${amt}</strong> for ${c.planName ?? "your subscription"} was declined by your bank or card issuer.`),
          p(`<strong>Your account is still working and nothing has been deleted.</strong> We will retry automatically.`),
          restricted
            ? p(`If payment is still outstanding on <strong>${restricted}</strong>, sending and premium features will pause. Your campaigns, contacts, automations and analytics stay intact.`)
            : "",
          p(`<a href="${c.manageUrl}" style="color:#6d28d9">Update your payment method</a>`),
        ].join("")),
      };
    }
    case "billing.cancelled": {
      const end = when(c.trialEndsAt ?? c.firstBillingAt);
      return {
        subject: "Your SendLoom subscription is cancelled",
        html: wrap("Your subscription is cancelled", [
          p(`You will not be charged.`),
          end ? p(`Your access continues until <strong>${end}</strong>.`) : "",
          p(`Your campaigns, templates, contacts, automations and website configuration are kept, so if you come back you will not be rebuilding anything.`),
          p(`<a href="${c.manageUrl}" style="color:#6d28d9">Resubscribe or export your data</a>`),
        ].join("")),
      };
    }
  }
}

/**
 * Send a lifecycle notification once and only once per subscription.
 * Idempotency comes from the event log rather than a flag column, so the send
 * history and the audit trail are the same record.
 */
export async function notifyOnce(subscriptionId: string, key: NotificationKey, ctx: Ctx, toEmail: string | null) {
  const already = await db.subscriptionEvent.findFirst({
    where: { subscriptionId, type: `notify.${key}` },
  });
  if (already) return { sent: false, reason: "already sent" as const };

  const msg = template(key, ctx);
  if (!msg) return { sent: false, reason: "missing required facts" as const };
  if (!toEmail) return { sent: false, reason: "no recipient" as const };

  const provider = activeProvider();
  let detail: string;
  try {
    const result = await provider.send({
      to: toEmail,
      subject: msg.subject,
      html: msg.html,
      campaignSendId: `billing_${key}_${subscriptionId}`,
    });
    detail = `${provider.name}: ${result.status}${result.detail ? ` · ${result.detail}` : ""}`;
  } catch (e) {
    detail = `${provider.name}: failed · ${e instanceof Error ? e.message : "unknown error"}`;
  }

  await recordEvent(subscriptionId, {
    type: `notify.${key}`,
    actorLabel: "system",
    detail: `${msg.subject} → ${toEmail} · ${detail}`,
  });

  return { sent: true, detail };
}

/** Build the notification context from a subscription. */
export async function contextFor(workspaceId: string, origin: string): Promise<{ ctx: Ctx; email: string | null; subscriptionId: string } | null> {
  const sub = await db.subscription.findUnique({
    where: { workspaceId },
    include: { plan: true, workspace: { select: { name: true } } },
  });
  if (!sub) return null;

  const owner = await db.user.findFirst({
    where: { workspaceId, disabled: false },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    select: { email: true },
  });

  return {
    subscriptionId: sub.id,
    email: owner?.email ?? null,
    ctx: {
      workspaceName: sub.workspace.name,
      planName: sub.plan?.name ?? null,
      amountPence: sub.firstChargePence ?? sub.plan?.monthlyPence ?? null,
      firstBillingAt: sub.firstBillingAt,
      trialEndsAt: sub.trialEndsAt,
      stageOneEndsAt: sub.trialStageOneEndsAt,
      restrictedAt: sub.accessRestrictedAt,
      manageUrl: `${origin}/settings/billing`,
      plansUrl: `${origin}/plans`,
    },
  };
}
