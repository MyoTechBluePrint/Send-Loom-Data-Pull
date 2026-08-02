"use client";

// Public signup. One short form: the commercial questions live in onboarding,
// after the account exists, where they are skippable. Nothing about billing
// appears here at all.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignupPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!acceptTerms) {
      setError("Please accept the terms and privacy policy.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, email, password, companyName,
          websiteUrl: websiteUrl || undefined,
          acceptTerms,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not create your account.");
        return;
      }
      router.push(json.next ?? "/onboarding/trial");
      router.refresh();
    } catch {
      setError("Could not reach SendLoom. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Value proposition. */}
      <div className="flex flex-col justify-center bg-[#14121f] px-8 py-12 text-white lg:px-14">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
            <div>
              <p className="text-base font-semibold leading-tight">Sendloom</p>
              <p className="text-[11px] text-white/50">Growth Intelligence OS</p>
            </div>
          </div>

          <h1 className="mt-10 text-3xl font-semibold leading-tight">
            Try SendLoom free for three days
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            Explore the platform, build campaigns, connect your website and see how SendLoom can
            help generate more revenue. No payment details are required to begin.
          </p>

          <ul className="mt-8 space-y-3">
            {[
              "Start immediately, no card required",
              "Connect your store and see revenue attribution with your own data",
              "Choose a plan by day three to continue your full seven-day trial",
              "Cancel before the trial ends and you will not be charged",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-white/80">
                <span className="mt-0.5 text-[#a78bfa]">✓</span> {t}
              </li>
            ))}
          </ul>

          <p className="mt-10 text-[11px] leading-relaxed text-white/40">
            Card details are handled by our payment provider and never touch SendLoom&apos;s servers.
          </p>
        </div>
      </div>

      {/* The form. */}
      <div className="flex items-center justify-center bg-surface px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm" noValidate>
          <h2 className="text-lg font-semibold">Create your account</h2>
          <p className="mt-1 text-xs text-ink-3">No payment details needed to start.</p>

          {error && (
            <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <div className="mt-5 grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-medium text-ink-3">First name</span>
              <input
                value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoComplete="given-name"
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-3">Last name</span>
              <input
                value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name"
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Work email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Password</span>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              minLength={8} autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
            <span className="mt-1 block text-[11px] text-ink-3">At least 8 characters.</span>
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Business or brand name</span>
            <input
              value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoComplete="organization"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Website <span className="font-normal">(optional)</span></span>
            <input
              value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="yourstore.com"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-ink-2">
            <input
              type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[#6d28d9]"
            />
            <span>
              I accept the <a href="/terms" className="font-medium text-brand hover:underline">terms of service</a> and{" "}
              <a href="/privacy" className="font-medium text-brand hover:underline">privacy policy</a>.
            </span>
          </label>

          <button
            type="submit" disabled={busy}
            className="mt-5 w-full rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-[#6d28d9] hover:to-[#4c1d95] disabled:opacity-50"
          >
            {busy ? "Creating your account…" : "Start my free trial"}
          </button>

          <p className="mt-4 text-center text-xs text-ink-3">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
