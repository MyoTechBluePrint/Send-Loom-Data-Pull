"use client";

// The billing area. One page that answers, without the customer having to ask:
// what am I on, what happens next, when, how much, and how do I stop it.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

type Usage = { key: string; label: string; used: number; limit: number | null; remaining: number | null; percent: number };
type Status = {
  ok: boolean;
  exempt?: boolean;
  status: string;
  label?: string;
  message?: string;
  tone?: string;
  planName?: string | null;
  planKey?: string | null;
  billingCycle?: string;
  trial?: { dayOf: number; totalDays: number; daysLeft: number; stageOneEndsAt: string | null } | null;
  paymentMethod?: { verified: boolean; brand: string | null; last4: string | null };
  firstBillingLabel?: string | null;
  amountLabel?: string | null;
  creditPence?: number;
  cancelScheduledAt?: string | null;
  accessRestrictedLabel?: string | null;
  usage?: Usage[];
  recommendation?: { planKey: string; reason: string } | null;
  providerMode?: "stripe" | "simulated";
};
type Invoice = {
  id: string; number: string; amountLabel: string; status: string;
  description: string | null; issuedLabel: string; hostedUrl: string | null; pdfUrl: string | null;
};

const TONE: Record<string, string> = {
  good: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
  warn: "border-amber-300 bg-amber-50 text-amber-900",
  danger: "border-red-200 bg-red-50 text-red-800",
  neutral: "border-line bg-[#f7f6f4] text-ink-2",
};

export default function BillingSettingsPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [cancelling, setCancelling] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/billing/status").then((r) => (r.ok ? r.json() : null)).then((j) => j && setStatus(j)).catch(() => {});
    fetch("/api/billing/invoices").then((r) => (r.ok ? r.json() : null)).then((j) => j && setInvoices(j.invoices ?? [])).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const j = await res.json();
      if (j.ok) {
        setNotice(`Cancelled. You keep full access until ${j.accessUntilLabel}, and you will not be charged. Your data is kept for ${j.retentionDays} days after that.`);
        setShowCancel(false);
        load();
      } else {
        setNotice(j.error ?? "Could not cancel.");
      }
    } finally {
      setCancelling(false);
    }
  }

  async function undoCancel() {
    const res = await fetch("/api/billing/cancel", { method: "DELETE" });
    const j = await res.json();
    setNotice(j.ok ? "Your subscription is reinstated." : j.error ?? "Could not reinstate.");
    load();
  }

  if (!status) {
    return (
      <Shell title="Billing" subtitle="Plan, payments and invoices">
        <div className="h-40 animate-pulse rounded-xl border border-line bg-black/[0.02]" />
      </Shell>
    );
  }

  // In-house and enterprise accounts get a plain statement and no controls.
  if (status.exempt) {
    return (
      <Shell title="Billing" subtitle="Plan, payments and invoices">
        <Card className="px-6 py-6">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">{status.planName ?? "Complimentary"}</p>
          <h2 className="mt-2 text-lg font-semibold">This account is not billed</h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-ink-2">
            {status.message} There is no trial, no countdown and no payment method on file. Nothing about
            subscriptions applies to this workspace, and no limits are enforced against it.
          </p>
        </Card>
      </Shell>
    );
  }

  const trialing = status.status.startsWith("trial");
  const cancelScheduled = status.status === "scheduled_cancel";

  return (
    <Shell
      title="Billing"
      subtitle="Plan, payments and invoices"
      actions={<Link href="/plans"><PrimaryButton>Change plan</PrimaryButton></Link>}
    >
      {notice && (
        <p className="mb-4 rounded-lg border border-line bg-[#f7f6f4] px-4 py-3 text-[13px] text-ink-2">{notice}</p>
      )}

      {/* State banner: what is true right now, in the customer's words. */}
      <div className={`mb-4 rounded-xl border px-5 py-4 ${TONE[status.tone ?? "neutral"]}`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide">{status.label}</span>
          {trialing && status.trial && (
            <span className="text-[13px] font-semibold">
              Day {status.trial.dayOf} of {status.trial.totalDays} · {status.trial.daysLeft} day{status.trial.daysLeft === 1 ? "" : "s"} remaining
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed">{status.message}</p>
        {status.accessRestrictedLabel && (
          <p className="mt-1.5 text-[12px] font-medium">
            If this is not resolved, sending pauses on {status.accessRestrictedLabel}. Your campaigns, contacts,
            automations and analytics are kept either way.
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Plan and next payment */}
        <Card className="lg:col-span-2">
          <CardHeader title="Your subscription" subtitle="Exactly what happens next, and when" />
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 py-4 sm:grid-cols-2">
            <Row label="Plan" value={status.planName ?? "Not chosen yet"} />
            <Row label="Billing cycle" value={status.billingCycle === "annual" ? "Annual" : "Monthly"} />
            <Row label="Next payment date" value={status.firstBillingLabel ?? "No payment scheduled"} />
            <Row label="Next payment amount" value={cancelScheduled ? "£0.00 · cancelled" : status.amountLabel ?? "Not set"} />
            <Row
              label="Payment method"
              value={
                status.paymentMethod?.verified
                  ? `${status.paymentMethod.brand ?? "Card"} ending ${status.paymentMethod.last4 ?? "****"}`
                  : "Not added yet"
              }
            />
            <Row label="Account credit" value={status.creditPence ? `£${(status.creditPence / 100).toFixed(2)}` : "None"} />
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-line px-5 py-4">
            <Link href="/plans"><GhostButton>{status.planKey ? "Change plan" : "Choose a plan"}</GhostButton></Link>
            {status.paymentMethod?.verified && <Link href="/plans"><GhostButton>Update payment method</GhostButton></Link>}
            {cancelScheduled ? (
              <button onClick={undoCancel} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
                Keep my subscription
              </button>
            ) : (
              <button
                onClick={() => setShowCancel((v) => !v)}
                className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-red-300 hover:text-red-700"
              >
                Cancel subscription
              </button>
            )}
          </div>

          {showCancel && (
            <div className="border-t border-line bg-[#faf9f7] px-5 py-4">
              <h4 className="text-sm font-semibold">Cancel your subscription</h4>
              <ul className="mt-2 space-y-1 text-[12px] leading-relaxed text-ink-2">
                <li>You keep full access until {status.firstBillingLabel ?? "the end of your current period"}.</li>
                <li>You will not be charged.</li>
                <li>Your campaigns, templates, contacts, automations, website configuration and analytics are all kept.</li>
                <li>Sending and premium automations pause when access ends. Nothing is deleted.</li>
                <li>Your data is retained for 90 days, so you can pick up exactly where you left off if you come back.</li>
              </ul>
              {status.recommendation && status.recommendation.planKey !== status.planKey && (
                <p className="mt-3 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] text-ink-2">
                  If cost is the issue, {status.recommendation.reason}{" "}
                  <Link href="/plans" className="font-medium text-brand hover:underline">Compare plans</Link>
                </p>
              )}
              <label className="mt-3 block">
                <span className="text-[12px] font-medium text-ink-3">Why are you cancelling? Optional, and it genuinely helps.</span>
                <textarea
                  value={reason} onChange={(e) => setReason(e.target.value)} rows={2}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand"
                />
              </label>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={cancel} disabled={cancelling}
                  className="rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  {cancelling ? "Cancelling…" : "Confirm cancellation"}
                </button>
                <button onClick={() => setShowCancel(false)} className="rounded-lg px-4 py-2 text-[13px] font-medium text-ink-3 hover:text-ink-2">
                  Keep my subscription
                </button>
              </div>
            </div>
          )}
        </Card>

        {/* Usage against the plan */}
        <Card>
          <CardHeader title="Usage this month" subtitle="Against your current allowances" />
          <div className="space-y-3 px-5 py-4">
            {(status.usage ?? []).map((u) => (
              <div key={u.key}>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="capitalize text-ink-2">{u.label}</span>
                  <span className="font-medium">
                    {u.used.toLocaleString()}
                    {u.limit === null ? " · unlimited" : ` / ${u.limit.toLocaleString()}`}
                  </span>
                </div>
                {u.limit !== null && (
                  <div className="mt-1 h-1.5 rounded-full bg-[#f0efec]">
                    <div
                      className={`h-full rounded-full ${u.percent >= 90 ? "bg-red-500" : u.percent >= 70 ? "bg-amber-500" : "bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9]"}`}
                      style={{ width: `${u.percent}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
            <p className="border-t border-line pt-3 text-[11px] leading-relaxed text-ink-3">
              Going over an allowance prompts an upgrade. Sending is never cut off without warning and
              nothing you have built is removed.
            </p>
          </div>
        </Card>
      </div>

      {/* Invoices */}
      <Card className="mt-4">
        <CardHeader title="Invoices and receipts" subtitle="Every charge, with the provider's copy" />
        {invoices.length === 0 ? (
          <p className="px-5 py-6 text-[13px] text-ink-3">
            No invoices yet. Your first one appears after your trial converts.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-3">
                <tr>
                  <th className="px-5 py-2 font-semibold">Invoice</th>
                  <th className="px-5 py-2 font-semibold">Date</th>
                  <th className="px-5 py-2 font-semibold">Description</th>
                  <th className="px-5 py-2 font-semibold">Amount</th>
                  <th className="px-5 py-2 font-semibold">Status</th>
                  <th className="px-5 py-2 font-semibold">Copy</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => (
                  <tr key={i.id} className="border-b border-line/70 last:border-0">
                    <td className="px-5 py-2.5 font-mono text-[12px]">{i.number}</td>
                    <td className="px-5 py-2.5 text-ink-2">{i.issuedLabel}</td>
                    <td className="px-5 py-2.5 text-ink-2">{i.description}</td>
                    <td className="px-5 py-2.5 font-medium">{i.amountLabel}</td>
                    <td className="px-5 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        i.status === "paid" ? "bg-emerald-50 text-emerald-700" : i.status === "failed" ? "bg-red-50 text-red-700" : "bg-[#f0efec] text-ink-3"
                      }`}>{i.status}</span>
                    </td>
                    <td className="px-5 py-2.5">
                      {i.pdfUrl || i.hostedUrl ? (
                        <a href={(i.pdfUrl ?? i.hostedUrl) as string} target="_blank" rel="noreferrer" className="font-medium text-brand hover:underline">
                          Download
                        </a>
                      ) : (
                        <span className="text-ink-3">Not available</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {status.providerMode === "simulated" && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
          <strong>No payment provider is connected to this environment.</strong> Subscription states, invoices and
          notifications all run, but no card is ever collected and no money moves. Set <code className="font-mono">STRIPE_SECRET_KEY</code> and{" "}
          <code className="font-mono">STRIPE_WEBHOOK_SECRET</code> to take real payments.
        </p>
      )}
    </Shell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-[13px] font-medium text-ink-2">{value}</dd>
    </div>
  );
}
