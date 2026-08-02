"use client";

// The onboarding questions: one screen, every question skippable, and each
// answer feeds the plan recommendation directly. Nothing is asked that the
// recommendation does not use.

import { useRouter } from "next/navigation";
import { useState } from "react";

const BUSINESS_TYPES = [
  { value: "ecommerce", label: "Ecommerce" },
  { value: "professional_services", label: "Professional services" },
  { value: "hospitality", label: "Hospitality" },
  { value: "property", label: "Property" },
  { value: "financial_services", label: "Financial services" },
  { value: "agency", label: "Agency" },
  { value: "creator_media", label: "Creator or media" },
  { value: "other", label: "Other" },
] as const;

const GOALS = [
  { value: "generate_sales", label: "Generate more sales" },
  { value: "recover_carts", label: "Recover abandoned baskets" },
  { value: "build_journeys", label: "Build automated customer journeys" },
  { value: "grow_list", label: "Grow a contact list" },
  { value: "improve_retention", label: "Improve customer retention" },
  { value: "send_newsletters", label: "Send newsletters and campaigns" },
  { value: "manage_clients", label: "Manage messaging for clients" },
] as const;

const CONTACT_BANDS = [
  { value: 500, label: "Under 1,000" },
  { value: 5000, label: "1,000 to 10,000" },
  { value: 25000, label: "10,000 to 50,000" },
  { value: 75000, label: "50,000+" },
] as const;

const SEND_BANDS = [
  { value: 5000, label: "Under 10,000" },
  { value: 50000, label: "10,000 to 100,000" },
  { value: 250000, label: "100,000 to 500,000" },
  { value: 750000, label: "500,000+" },
] as const;

export default function BusinessOnboardingPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const [businessType, setBusinessType] = useState("");
  const [expectedContacts, setExpectedContacts] = useState<number | "">("");
  const [expectedSends, setExpectedSends] = useState<number | "">("");
  const [expectedSites, setExpectedSites] = useState<number | "">("");
  const [primaryGoal, setPrimaryGoal] = useState("");

  async function finish(skip: boolean) {
    setBusy(true);
    try {
      if (!skip) {
        await fetch("/api/billing/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessType: businessType || undefined,
            expectedContacts: expectedContacts === "" ? undefined : expectedContacts,
            expectedSends: expectedSends === "" ? undefined : expectedSends,
            expectedSites: expectedSites === "" ? undefined : expectedSites,
            primaryGoal: primaryGoal || undefined,
          }),
        }).catch(() => {});
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const select = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#faf9f7] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-line bg-surface p-7 shadow-sm">
          <h1 className="text-lg font-semibold">About your business</h1>
          <p className="mt-1 text-xs leading-relaxed text-ink-3">
            These answers shape the plan we recommend on day three. Every question is optional.
          </p>

          <label className="mt-5 block">
            <span className="text-xs font-medium text-ink-3">What type of business do you operate?</span>
            <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={select}>
              <option value="">Select</option>
              {BUSINESS_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Approximately how many contacts do you have?</span>
            <select value={expectedContacts} onChange={(e) => setExpectedContacts(e.target.value === "" ? "" : Number(e.target.value))} className={select}>
              <option value="">Select</option>
              {CONTACT_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">How many emails do you expect to send each month?</span>
            <select value={expectedSends} onChange={(e) => setExpectedSends(e.target.value === "" ? "" : Number(e.target.value))} className={select}>
              <option value="">Select</option>
              {SEND_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">How many websites or brands will you connect?</span>
            <select value={expectedSites} onChange={(e) => setExpectedSites(e.target.value === "" ? "" : Number(e.target.value))} className={select}>
              <option value="">Select</option>
              {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n === 10 ? "10 or more" : n}</option>)}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">What is your main goal with SendLoom?</span>
            <select value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value)} className={select}>
              <option value="">Select</option>
              {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
          </label>

          <button
            onClick={() => finish(false)} disabled={busy}
            className="mt-6 w-full rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-[#6d28d9] hover:to-[#4c1d95] disabled:opacity-50"
          >
            {busy ? "Saving…" : "Continue to SendLoom"}
          </button>
          <button
            onClick={() => finish(true)} disabled={busy}
            className="mt-2 w-full rounded-lg px-4 py-2 text-xs font-medium text-ink-3 hover:text-ink-2 disabled:opacity-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
