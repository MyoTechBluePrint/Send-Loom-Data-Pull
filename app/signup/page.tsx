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
      {/* Value proposition: the landing page's midnight world continues here
          so the funnel feels like one product, not two designs. */}
      <div className="relative flex flex-col justify-center overflow-hidden bg-gradient-to-br from-[#102C58] via-[#081226] to-[#03050B] px-8 py-12 text-white lg:px-14">
        <div aria-hidden className="pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-[#14356B]/50 blur-3xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-32 right-0 h-80 w-80 rounded-full bg-[#14356B]/30 blur-3xl" />
        <div className="relative mx-auto w-full max-w-md">
          <Link href="/home" className="flex w-fit items-center gap-2.5" aria-label="Back to the SendLoom homepage">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
            <div>
              <p className="text-base font-semibold leading-tight">sendloom</p>
              <p className="text-[11px] text-white/50">All-in-one marketing automation platform</p>
            </div>
          </Link>

          <h1 className="mt-10 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Try SendLoom free for{" "}
            <span className="bg-gradient-to-b from-[#9cc0ff] to-[#3478f6] bg-clip-text text-transparent">three days</span>
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
                <span className="mt-0.5 grid h-4.5 w-4.5 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.06] text-[10px] text-[#8fb4fa]">✓</span> {t}
              </li>
            ))}
          </ul>

          <p className="mt-10 text-[11px] leading-relaxed text-white/40">
            Card details are handled by our payment provider and never touch SendLoom&apos;s servers.
          </p>

        </div>

        {/* Loomi peeks over the bottom edge, same trick as the landing card */}
        <img
          src="/mascot/peek-top.png"
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          width={174}
          height={229}
          className="pointer-events-none absolute -bottom-14 left-[12%] w-28 -rotate-6 drop-shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
        />
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
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-ink-3">Last name</span>
              <input
                value={lastName} onChange={(e) => setLastName(e.target.value)} required autoComplete="family-name"
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/20"
              />
            </label>
          </div>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Work email</span>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/20"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Password</span>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
              minLength={8} autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/20"
            />
            <span className="mt-1 block text-[11px] text-ink-3">At least 8 characters.</span>
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Business or brand name</span>
            <input
              value={companyName} onChange={(e) => setCompanyName(e.target.value)} required autoComplete="organization"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/20"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-xs font-medium text-ink-3">Website <span className="font-normal">(optional)</span></span>
            <input
              value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="yourstore.com"
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none transition focus:border-[#3478f6] focus:ring-2 focus:ring-[#3478f6]/20"
            />
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-ink-2">
            <input
              type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5 accent-[#3478f6]"
            />
            <span>
              I accept the <a href="/terms" className="font-medium text-[#2f6ae0] hover:underline">terms of service</a> and{" "}
              <a href="/privacy" className="font-medium text-[#2f6ae0] hover:underline">privacy policy</a>.
            </span>
          </label>

          <button
            type="submit" disabled={busy}
            className="mt-5 w-full rounded-xl bg-gradient-to-b from-[#5b93f8] to-[#3478f6] px-4 py-3 text-sm font-semibold text-white shadow-md shadow-[#3478f6]/30 transition hover:from-[#4d87f4] hover:to-[#2a6ae8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3478f6] active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "Creating your account…" : "Start my free trial"}
          </button>

          <p className="mt-4 text-center text-xs text-ink-3">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#2f6ae0] hover:underline">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
