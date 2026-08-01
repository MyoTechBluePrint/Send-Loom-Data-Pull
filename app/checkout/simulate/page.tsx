"use client";

// The stand-in for a payment provider, used only when none is connected.
//
// It deliberately looks and reads like the real thing so the trial journey can
// be reviewed properly, but it never pretends money moved: the banner says
// exactly what it is, and the invoice it produces is stamped SIMULATED.

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type Plan = {
  key: string; name: string; currency: string;
  monthlyPence: number | null; annualPence: number | null; annualMonthlyEquivalent: number | null;
};

const money = (p: number, c = "GBP") => new Intl.NumberFormat("en-GB", { style: "currency", currency: c }).format(p / 100);

function SimulateInner() {
  const router = useRouter();
  const params = useSearchParams();
  const planKey = params.get("plan") ?? "";
  const cycle = (params.get("cycle") === "annual" ? "annual" : "monthly") as "monthly" | "annual";

  const [plan, setPlan] = useState<Plan | null>(null);
  const [firstBilling, setFirstBilling] = useState<string | null>(null);
  const [applePay, setApplePay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Real capability detection: the same check a live Apple Pay integration
    // makes. It reports what the device supports, nothing more.
    try {
      const w = window as unknown as { ApplePaySession?: { canMakePayments?: () => boolean } };
      setApplePay(Boolean(w.ApplePaySession?.canMakePayments?.()));
    } catch {
      setApplePay(false);
    }

    fetch("/api/billing/plans")
      .then((r) => r.json())
      .then((j) => setPlan((j.plans ?? []).find((p: Plan) => p.key === planKey) ?? null))
      .catch(() => setPlan(null));

    fetch("/api/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setFirstBilling(j.firstBillingLabel ?? null))
      .catch(() => {});
  }, [planKey]);

  const amount = plan ? (cycle === "annual" ? plan.annualPence : plan.monthlyPence) : null;
  const perMonth = plan ? (cycle === "annual" ? plan.annualMonthlyEquivalent : plan.monthlyPence) : null;

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, cycle }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not verify.");
        return;
      }
      router.push("/checkout/return?simulated=1");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-4 py-10">
      <div className="w-full max-w-md">
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-900">
          <strong>Simulation.</strong> No payment provider is connected to this environment, so this screen
          stands in for Stripe Checkout. No card is collected, no authorisation happens and no money moves.
          Set <code className="font-mono">STRIPE_SECRET_KEY</code> to switch this to real Apple Pay and card payments.
        </p>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-lg font-semibold">Continue your free trial</h1>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-2">
            Choose your SendLoom plan and securely verify your payment method.{" "}
            <strong>You will not be charged today.</strong> Your first monthly payment will be taken
            automatically when your seven-day free trial ends.
          </p>

          <div className="mt-5 rounded-xl border border-line bg-[#faf9f7] p-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-ink-3">Plan</span>
              <span className="text-sm font-semibold">{plan?.name ?? planKey}</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-xs text-ink-3">Billing</span>
              <span className="text-sm font-medium capitalize">{cycle}</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between border-t border-line pt-2">
              <span className="text-xs font-semibold text-ink-2">Due today</span>
              <span className="text-sm font-bold">£0.00</span>
            </div>
          </div>

          <button
            onClick={verify}
            disabled={busy || !plan}
            className="mt-5 w-full rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:from-[#6d28d9] hover:to-[#4c1d95] disabled:opacity-50"
          >
            {busy ? "Verifying…" : applePay ? "Continue with Apple Pay (simulated)" : "Verify payment and continue (simulated)"}
          </button>

          {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}

          <ul className="mt-4 space-y-1 text-[11px] leading-relaxed text-ink-3">
            <li><strong className="text-ink-2">£0 due today.</strong></li>
            <li>First payment: {firstBilling ?? "when your seven-day free trial ends"}.</li>
            <li>Monthly subscription: {perMonth !== null ? `${money(perMonth, plan?.currency)} per month` : "shown before you confirm"}
              {cycle === "annual" && amount !== null ? ` (${money(amount, plan?.currency)} billed annually)` : ""}.</li>
            <li>Cancel any time before the trial ends to avoid being charged.</li>
          </ul>

          <p className="mt-4 text-center text-[11px] text-ink-3">
            <Link href="/plans" className="hover:text-brand hover:underline">Choose a different plan</Link>
          </p>
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-3">
          Apple Pay availability on this device: <strong>{applePay ? "detected" : "not available"}</strong>.
        </p>
      </div>
    </div>
  );
}

export default function SimulateCheckoutPage() {
  return (
    <Suspense>
      <SimulateInner />
    </Suspense>
  );
}
