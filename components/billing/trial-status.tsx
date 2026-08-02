"use client";

// The persistent trial/billing strip, shown only to external accounts that
// have something happening: a trial in progress, action needed, or billing in
// trouble. One line of fact, ONE action. Competing buttons are how a banner
// becomes noise.
//
// It renders NOTHING for complimentary, grandfathered and enterprise accounts,
// and nothing for a settled paid account. That is the mechanism that keeps
// SendLoom looking exactly as it did for the in-house workspaces.

import Link from "next/link";
import { useEffect, useState } from "react";

type Status = {
  ok: boolean;
  exempt?: boolean;
  status: string;
  label?: string;
  tone?: "neutral" | "info" | "warn" | "danger" | "good";
  needsAction?: boolean;
  planName?: string | null;
  planKey?: string | null;
  trial?: { dayOf: number; totalDays: number; daysLeft: number; hoursLeft: number } | null;
  paymentMethod?: { verified: boolean };
  firstBillingLabel?: string | null;
  amountLabel?: string | null;
  accessRestrictedLabel?: string | null;
};

const TONE: Record<string, string> = {
  good: "border-emerald-200 bg-emerald-50",
  info: "border-sky-200 bg-sky-50",
  warn: "border-amber-300 bg-amber-50",
  danger: "border-red-200 bg-red-50",
  neutral: "border-line bg-[#f7f6f4]",
};

/** The single message + single action for the account's current stage. */
function lineFor(s: Status): { text: string; sub: string | null; action: string; href: string } | null {
  const t = s.trial;

  switch (s.status) {
    case "trialing_no_pm": {
      if (!t) return null;
      // daysLeft counts to day 7; the plan-selection gate is day 3.
      const days = Math.max(0, t.daysLeft - 4);
      return {
        text: days > 0
          ? `${days} day${days === 1 ? "" : "s"} remaining before you need to choose a plan`
          : "Choose a plan today to keep your trial running",
        sub: "No payment details required yet · £0 due when you choose",
        action: "View Plans",
        href: "/billing/plans",
      };
    }
    case "trial_action_required":
      return {
        text: "Choose a plan to continue your trial",
        sub: "Everything you have built is saved · £0 due today",
        action: "Choose Plan",
        href: "/billing/plans",
      };
    case "trialing_pm_verified":
    case "trial_ending":
      return {
        text: `${s.planName?.replace("SendLoom ", "") ?? "Your"} trial${s.firstBillingLabel ? ` · First payment on ${s.firstBillingLabel}` : ""}`,
        sub: s.amountLabel ? `${s.amountLabel} per month · cancel before then and you will not be charged` : null,
        action: "Manage Plan",
        href: "/settings/billing",
      };
    case "payment_failed":
    case "payment_recovery":
    case "past_due":
      return {
        text: "Your last payment needs attention",
        sub: s.accessRestrictedLabel
          ? `Sending pauses on ${s.accessRestrictedLabel} if unresolved · nothing is deleted`
          : "Nothing is deleted while this is resolved",
        action: "Update Payment",
        href: "/settings/billing",
      };
    case "restricted":
    case "expired":
    case "cancelled":
      return {
        text: "Sending is paused on this account",
        sub: "Your campaigns, contacts and automations are intact",
        action: "Reactivate",
        href: "/billing/plans",
      };
    case "scheduled_cancel":
      return {
        text: "Your subscription is scheduled to end",
        sub: "You keep full access until then and will not be charged",
        action: "Manage Plan",
        href: "/settings/billing",
      };
    default:
      return null;
  }
}

export function TrialStatus() {
  const [s, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.ok && setStatus(j))
      .catch(() => {});
  }, []);

  if (!s || s.exempt) return null;
  const line = lineFor(s);
  if (!line) return null;

  return (
    <div className={`mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-xl border px-4 py-3 ${TONE[s.tone ?? "neutral"]}`}>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-ink-2">{line.text}</p>
        {line.sub && <p className="mt-0.5 text-[12px] text-ink-3">{line.sub}</p>}
      </div>
      <Link
        href={line.href}
        className="shrink-0 rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-3.5 py-1.5 text-[12px] font-semibold text-white transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
      >
        {line.action}
      </Link>
    </div>
  );
}
