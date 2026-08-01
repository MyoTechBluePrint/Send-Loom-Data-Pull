"use client";

// The subscription selection screen. Used during onboarding, at the day-three
// gate, from settings, and from any upgrade prompt, so it has to work with and
// without a signed-in account.
//
// Rules it follows, from the brief: real prices only, no crossed-out fake
// discounts, the exact first payment date and amount always visible next to
// the button, and the recommendation is the smallest plan that fits.

import { useEffect, useState } from "react";

type Plan = {
  key: string;
  name: string;
  blurb: string | null;
  monthlyPence: number | null;
  annualPence: number | null;
  annualMonthlyEquivalent: number | null;
  annualSavingPence: number | null;
  currency: string;
  recommended: boolean;
  contactSales: boolean;
  entitlements: Record<string, number | boolean>;
};

type Status = {
  ok: boolean;
  exempt?: boolean;
  status?: string;
  planKey?: string | null;
  billingCycle?: string;
  firstBillingLabel?: string | null;
  trial?: { trialEndsAt?: string | null } | null;
  recommendation?: { planKey: string; reason: string; signals: string[] } | null;
  providerMode?: "stripe" | "simulated";
};

const money = (pence: number, currency = "GBP") =>
  new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: pence % 100 === 0 ? 0 : 2 }).format(pence / 100);

const num = (v: number | boolean | undefined) => {
  if (v === undefined) return "Not included";
  if (typeof v === "boolean") return v ? "Included" : "Not included";
  if (v === -1) return "Unlimited";
  return v.toLocaleString();
};

/** The rows shown on every card, in the order the brief lists them. */
const ROWS: { key: string; label: string }[] = [
  { key: "monthly_contacts", label: "Contacts" },
  { key: "monthly_email_sends", label: "Emails per month" },
  { key: "connected_domains", label: "Connected websites" },
  { key: "team_members", label: "Team members" },
  { key: "active_automations", label: "Active automations" },
  { key: "ai_credits", label: "AI credits" },
  { key: "revenue_attribution", label: "Revenue attribution" },
  { key: "advanced_segmentation", label: "Advanced segmentation" },
  { key: "premium_integrations", label: "Premium integrations" },
  { key: "priority_support", label: "Priority support" },
];

export function PlanCards({ signedIn, compact = false }: { signedIn: boolean; compact?: boolean }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [cycle, setCycle] = useState<"monthly" | "annual">("monthly");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/billing/plans").then((r) => r.json()).then((j) => setPlans(j.plans ?? [])).catch(() => setPlans([]));
    if (signedIn) {
      fetch("/api/billing/status")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (!j) return;
          setStatus(j);
          if (j.billingCycle === "annual") setCycle("annual");
        })
        .catch(() => {});
    }
  }, [signedIn]);

  async function choose(planKey: string) {
    setError(null);
    setBusyKey(planKey);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, cycle }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not start checkout.");
        return;
      }
      window.location.href = json.url;
    } catch {
      setError("Could not reach SendLoom. Try again.");
    } finally {
      setBusyKey(null);
    }
  }

  if (plans === null) {
    return (
      <div className="grid gap-4 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[420px] animate-pulse rounded-2xl border border-line bg-black/[0.02]" />
        ))}
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl border border-line bg-surface p-8 text-center">
        <p className="text-sm font-medium">No plans are published yet.</p>
        <p className="mt-1 text-xs text-ink-3">An administrator can add plans in Admin, Subscriptions.</p>
      </div>
    );
  }

  const recommendedKey = status?.recommendation?.planKey ?? null;
  const trialEnds = status?.trial?.trialEndsAt ?? null;
  const sellable = plans.filter((p) => !p.contactSales);
  const enterprise = plans.find((p) => p.contactSales);

  return (
    <div>
      {/* Billing cycle. Annual states the real saving or says nothing. */}
      <div className="flex flex-wrap items-center justify-center gap-3">
        <div className="inline-flex rounded-full border border-line bg-surface p-1">
          {(["monthly", "annual"] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCycle(c)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition ${
                cycle === c ? "bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] text-white shadow-sm" : "text-ink-2 hover:text-ink-2"
              }`}
            >
              {c === "annual" ? "Annual" : "Monthly"}
            </button>
          ))}
        </div>
        {cycle === "annual" && (
          <p className="text-[11px] text-ink-3">Billed once a year. Renews annually at the same price unless cancelled.</p>
        )}
      </div>

      {status?.recommendation && (
        <div className="mx-auto mt-6 max-w-2xl rounded-xl border border-brand/25 bg-brand-soft px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-brand">Recommended for your business</p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{status.recommendation.reason}</p>
        </div>
      )}

      {error && (
        <p className="mx-auto mt-4 max-w-lg rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-700">{error}</p>
      )}

      <div className={`mt-6 grid gap-4 ${compact ? "lg:grid-cols-3" : "lg:grid-cols-3"}`}>
        {sellable.map((p) => {
          const price = cycle === "annual" ? p.annualMonthlyEquivalent : p.monthlyPence;
          const isRecommended = recommendedKey === p.key;
          const isCurrent = status?.planKey === p.key;
          const highlight = isRecommended || (!recommendedKey && p.recommended);

          return (
            <div
              key={p.key}
              className={`relative flex flex-col rounded-2xl border bg-surface p-5 transition ${
                highlight ? "border-brand shadow-lg shadow-brand/10 ring-1 ring-brand/20" : "border-line"
              }`}
            >
              {(isRecommended || p.recommended) && (
                <span className="absolute -top-2.5 left-5 rounded-full bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  {isRecommended ? "Recommended for you" : "Most popular"}
                </span>
              )}

              <h3 className="mt-1 text-base font-semibold">{p.name}</h3>
              <p className="mt-1 min-h-[32px] text-xs leading-relaxed text-ink-3">{p.blurb}</p>

              <div className="mt-4">
                {price === null ? (
                  <p className="text-2xl font-semibold">Contact sales</p>
                ) : (
                  <>
                    <p className="text-3xl font-semibold tracking-tight">
                      {money(price, p.currency)}
                      <span className="ml-1 text-sm font-normal text-ink-3">/month</span>
                    </p>
                    {cycle === "annual" && p.annualPence !== null && (
                      <p className="mt-1 text-[11px] text-ink-3">
                        {money(p.annualPence, p.currency)} billed once a year
                        {p.annualSavingPence
                          ? ` · saves ${money(p.annualSavingPence, p.currency)} against paying monthly`
                          : ""}
                      </p>
                    )}
                    {cycle === "monthly" && p.annualPence !== null && p.annualMonthlyEquivalent !== null && (
                      <p className="mt-1 text-[11px] text-ink-3">
                        {money(p.annualMonthlyEquivalent, p.currency)}/month if paid annually
                      </p>
                    )}
                  </>
                )}
              </div>

              <ul className="mt-5 flex-1 space-y-1.5 border-t border-line pt-4">
                {ROWS.map((r) => {
                  const v = p.entitlements[r.key];
                  const on = typeof v === "boolean" ? v : v !== undefined && v !== 0;
                  return (
                    <li key={r.key} className="flex items-baseline justify-between gap-3 text-[12px]">
                      <span className={on ? "text-ink-2" : "text-ink-3/70"}>{r.label}</span>
                      <span className={`shrink-0 font-medium ${on ? "text-ink-2" : "text-ink-3/60"}`}>{num(v)}</span>
                    </li>
                  );
                })}
                <li className="flex items-baseline justify-between gap-3 border-t border-line pt-2 text-[12px]">
                  <span className="text-ink-3">If you go over</span>
                  <span className="shrink-0 text-right font-medium text-ink-2">We prompt you to upgrade. Nothing is cut off without warning.</span>
                </li>
              </ul>

              {signedIn ? (
                <button
                  onClick={() => choose(p.key)}
                  disabled={busyKey !== null || isCurrent}
                  className={`mt-5 w-full rounded-lg px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60 ${
                    highlight
                      ? "bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] text-white hover:from-[#6d28d9] hover:to-[#4c1d95]"
                      : "border border-line bg-surface text-ink-2 hover:border-brand hover:text-brand"
                  }`}
                >
                  {isCurrent ? "Your current plan" : busyKey === p.key ? "Opening checkout…" : `Choose ${p.name.replace("SendLoom ", "")}`}
                </button>
              ) : (
                <a
                  href="/signup"
                  className={`mt-5 block w-full rounded-lg px-4 py-2.5 text-center text-sm font-semibold transition ${
                    highlight
                      ? "bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] text-white hover:from-[#6d28d9] hover:to-[#4c1d95]"
                      : "border border-line bg-surface text-ink-2 hover:border-brand hover:text-brand"
                  }`}
                >
                  Start free trial
                </a>
              )}

              {/* The commitment, stated next to the button rather than buried. */}
              <div className="mt-3 space-y-0.5 text-center text-[11px] leading-relaxed text-ink-3">
                <p><strong className="text-ink-2">£0 due today.</strong></p>
                {status?.firstBillingLabel ? (
                  <p>First payment {status.firstBillingLabel}.</p>
                ) : (
                  <p>First payment when your seven-day free trial ends.</p>
                )}
                {price !== null && <p>Then {money(price, p.currency)} per month.</p>}
                <p>
                  {trialEnds
                    ? `Cancel before ${new Date(trialEnds).toLocaleString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })} and you will not be charged.`
                    : "Cancel any time before the trial ends to avoid being charged."}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {enterprise && (
        <div className="mt-4 flex flex-col items-start justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-semibold">{enterprise.name}</h3>
            <p className="mt-1 max-w-xl text-xs leading-relaxed text-ink-3">
              {enterprise.blurb} Custom volumes, multiple business entities, dedicated infrastructure,
              contractual service levels, advanced compliance, bespoke data retention, migration support
              and a named account manager.
            </p>
          </div>
          <a
            href="mailto:hello@sendloom.com?subject=SendLoom%20Enterprise"
            className="shrink-0 rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-ink-2 transition hover:border-brand hover:text-brand"
          >
            Contact sales
          </a>
        </div>
      )}

      {status?.providerMode === "simulated" && signedIn && (
        <p className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-center text-[11px] text-amber-900">
          No payment provider is connected to this environment. Choosing a plan runs a clearly labelled
          simulation so the trial journey can be tested. No card is taken and no money moves.
        </p>
      )}
    </div>
  );
}
