"use client";

// The persistent trial and billing status strip, shown on every page of the
// app for accounts that are actually on a trial or a paid plan.
//
// It renders NOTHING for complimentary and enterprise accounts. That is the
// mechanism that keeps SendLoom looking exactly as it did for the in-house
// workspaces: they never see a countdown, a prompt or an upgrade button.
//
// One conversion prompt at a time, tied to something the account has really
// done. No pop-ups, no fake urgency.

import Link from "next/link";
import { useEffect, useState } from "react";

type Usage = { key: string; label: string; used: number; limit: number | null; percent: number };
type Status = {
  ok: boolean;
  exempt?: boolean;
  status: string;
  label?: string;
  message?: string;
  tone?: "neutral" | "info" | "warn" | "danger" | "good";
  needsAction?: boolean;
  planName?: string | null;
  planKey?: string | null;
  trial?: { dayOf: number; totalDays: number; daysLeft: number; hoursLeft: number } | null;
  paymentMethod?: { verified: boolean };
  firstBillingLabel?: string | null;
  amountLabel?: string | null;
  accessRestrictedLabel?: string | null;
  usage?: Usage[];
  recommendation?: { planKey: string; reason: string } | null;
  attributedRevenueLabel?: string | null;
};

const TONE: Record<string, string> = {
  good: "border-emerald-200 bg-emerald-50",
  info: "border-sky-200 bg-sky-50",
  warn: "border-amber-300 bg-amber-50",
  danger: "border-red-200 bg-red-50",
  neutral: "border-line bg-[#f7f6f4]",
};

/** One prompt, chosen by what has actually happened. Null when there is nothing worth saying. */
function prompt(s: Status): string | null {
  if (s.status === "trial_action_required") {
    return "Your first three days are complete. Choose a plan to continue through the rest of your free trial. Everything you have built is saved.";
  }
  if (s.status === "payment_failed" || s.status === "payment_recovery" || s.status === "past_due") {
    return s.accessRestrictedLabel
      ? `Update your payment method to keep sending. If it is unresolved on ${s.accessRestrictedLabel}, sending pauses. Nothing is deleted.`
      : "Update your payment method to keep sending.";
  }
  if (s.attributedRevenueLabel && s.planName) {
    return `SendLoom has attributed ${s.attributedRevenueLabel} in revenue during your trial. Keep your campaigns and automations running by continuing with ${s.planName.replace("SendLoom ", "")}.`;
  }
  const strained = (s.usage ?? []).find((u) => u.limit !== null && u.percent >= 70);
  if (strained) {
    return `You have used ${strained.used.toLocaleString()} of your ${strained.limit?.toLocaleString()} ${strained.label} allowance. ${
      s.recommendation?.reason ?? "A larger plan gives you room to keep going."
    }`;
  }
  if (s.status === "trialing_no_pm" && s.trial && s.trial.daysLeft <= 5 && !s.paymentMethod?.verified) {
    return s.recommendation?.reason ?? null;
  }
  return null;
}

export function TrialStatus() {
  const [s, setStatus] = useState<Status | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.ok && setStatus(j))
      .catch(() => {});
  }, []);

  // Nothing to show: not loaded, exempt, or a settled paid account.
  if (!s || s.exempt) return null;
  if (s.status === "active" && !s.needsAction) return null;

  const trialing = s.status.startsWith("trial");
  const message = prompt(s);

  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 ${TONE[s.tone ?? "neutral"]}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-ink-2">
            {trialing && s.trial ? (
              s.trial.daysLeft > 0
                ? `${s.trial.daysLeft} day${s.trial.daysLeft === 1 ? "" : "s"} remaining in your free trial`
                : `${s.trial.hoursLeft} hour${s.trial.hoursLeft === 1 ? "" : "s"} remaining in your free trial`
            ) : (
              s.label
            )}
          </p>
          <p className="mt-0.5 text-[12px] text-ink-3">
            {[
              s.planName ? `${s.planName.replace("SendLoom ", "")} plan selected` : "No plan selected yet",
              s.paymentMethod?.verified ? "£0 due today" : "No payment details required yet",
              s.firstBillingLabel ? `First payment on ${s.firstBillingLabel}` : null,
              s.amountLabel && s.paymentMethod?.verified ? `${s.amountLabel} per month` : null,
            ].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Link
            href="/plans"
            className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
          >
            {s.planKey ? "Change plan" : "Choose your plan"}
          </Link>
          <Link
            href="/settings/billing"
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink-2 transition hover:border-brand hover:text-brand"
          >
            Manage billing
          </Link>
        </div>
      </div>

      {/* Trial allowances, so "what am I using" never needs a trip to settings. */}
      {trialing && s.usage && s.usage.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-black/5 pt-2.5">
          {s.usage.filter((u) => u.limit !== null).slice(0, 4).map((u) => (
            <span key={u.key} className="text-[11px] text-ink-3">
              <span className="capitalize">{u.label}</span>{" "}
              <strong className={`font-semibold ${u.percent >= 90 ? "text-red-700" : u.percent >= 70 ? "text-amber-700" : "text-ink-2"}`}>
                {u.used.toLocaleString()}/{u.limit?.toLocaleString()}
              </strong>
            </span>
          ))}
        </div>
      )}

      {message && !dismissed && (
        <div className="mt-3 flex items-start gap-3 rounded-lg border border-black/5 bg-surface/70 px-3 py-2">
          <p className="flex-1 text-[12px] leading-relaxed text-ink-2">{message}</p>
          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="shrink-0 text-[11px] font-medium text-ink-3 hover:text-ink-2"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
