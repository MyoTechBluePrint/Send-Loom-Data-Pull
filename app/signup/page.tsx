"use client";

// Signup. Two short steps, because the second one earns its keep: everything
// asked there feeds the plan recommendation the customer sees on day three.
// Nothing is collected that we would not use, and step two is skippable.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CONTACT_BANDS = [
  { value: "under_1k", label: "Under 1,000" },
  { value: "1k_10k", label: "1,000 to 10,000" },
  { value: "10k_50k", label: "10,000 to 50,000" },
  { value: "50k_plus", label: "50,000+" },
  { value: "unsure", label: "Not sure yet" },
] as const;

const GOALS = [
  { value: "recover_carts", label: "Recover abandoned carts" },
  { value: "grow_list", label: "Grow my list" },
  { value: "send_campaigns", label: "Send better campaigns" },
  { value: "understand_revenue", label: "See what my email actually earns" },
  { value: "other", label: "Something else" },
] as const;

const PLATFORMS = [
  { value: "woocommerce", label: "WooCommerce" },
  { value: "shopify", label: "Shopify" },
  { value: "other", label: "Another platform" },
  { value: "none", label: "No store yet" },
] as const;

export default function SignupPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [platform, setPlatform] = useState<string>("");
  const [contactsBand, setContactsBand] = useState<string>("");
  const [primaryGoal, setPrimaryGoal] = useState<string>("");

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Use at least 8 characters for your password.");
      return;
    }
    setStep(2);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name, email, password,
          companyName: companyName || undefined,
          websiteUrl: websiteUrl || undefined,
          platform: platform || undefined,
          contactsBand: contactsBand || undefined,
          primaryGoal: primaryGoal || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Could not create your account.");
        setStep(1);
        return;
      }
      router.push(json.next ?? "/welcome");
      router.refresh();
    } catch {
      setError("Could not reach SendLoom. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Value proposition and the honest version of what happens next. */}
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
            Explore the platform, build campaigns, connect your website and see how SendLoom
            can help generate more revenue. No payment details are required to begin.
          </p>

          <ol className="mt-9 space-y-5">
            {[
              { k: "Today", t: "Start immediately. No payment details required.", tone: "now" },
              { k: "Day 3", t: "Choose your plan and verify your payment method for £0.", tone: "mid" },
              { k: "Day 7", t: "Your selected monthly subscription begins unless cancelled beforehand.", tone: "end" },
            ].map((s, i) => (
              <li key={s.k} className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <span
                    className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                      s.tone === "now"
                        ? "bg-gradient-to-b from-[#8b5cf6] to-[#6d28d9] text-white"
                        : "border border-white/25 text-white/60"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {i < 2 && <span className="mt-1 w-px flex-1 bg-white/15" />}
                </div>
                <div className="pb-1">
                  <p className="text-xs font-bold uppercase tracking-widest text-white/45">{s.k}</p>
                  <p className="mt-1 text-sm text-white/85">{s.t}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-10 rounded-xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs font-semibold text-white/90">During your trial you can</p>
            <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px] text-white/60">
              {[
                "Connect your website", "Install tracking", "Import contacts",
                "Build campaigns", "Create automations", "Forms and pop-ups",
                "Revenue attribution", "AI campaign help",
              ].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <span className="text-[#a78bfa]">✓</span> {f}
                </li>
              ))}
            </ul>
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-white/40">
            Card details are handled by our payment provider and never touch SendLoom&apos;s servers.
            Cancel at any point before your trial ends and you will not be charged.
          </p>
        </div>
      </div>

      {/* The form. */}
      <div className="flex items-center justify-center bg-surface px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-5 flex items-center gap-2">
            {[1, 2].map((n) => (
              <span
                key={n}
                className={`h-1 flex-1 rounded-full ${n <= step ? "bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9]" : "bg-line"}`}
              />
            ))}
            <span className="ml-1 text-[11px] font-medium text-ink-3">Step {step} of 2</span>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          {step === 1 ? (
            <form onSubmit={next}>
              <h2 className="text-lg font-semibold">Create your account</h2>
              <p className="mt-1 text-xs text-ink-3">No payment details needed to start.</p>

              <label className="mt-5 block">
                <span className="text-xs font-medium text-ink-3">Your name</span>
                <input
                  value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name"
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
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

              <button
                type="submit"
                className="mt-5 w-full rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
              >
                Continue
              </button>

              <p className="mt-4 text-center text-xs text-ink-3">
                Already have an account?{" "}
                <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
              </p>
            </form>
          ) : (
            <div>
              <h2 className="text-lg font-semibold">About your business</h2>
              <p className="mt-1 text-xs text-ink-3">
                This is how we recommend the right plan for you on day three. Skip it if you would rather get straight in.
              </p>

              <label className="mt-5 block">
                <span className="text-xs font-medium text-ink-3">Business name</span>
                <input
                  value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoComplete="organization"
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-ink-3">Website</span>
                <input
                  value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="yourstore.com"
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-ink-3">Store platform</span>
                <select
                  value={platform} onChange={(e) => setPlatform(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="">Select</option>
                  {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-ink-3">Roughly how many contacts do you have?</span>
                <select
                  value={contactsBand} onChange={(e) => setContactsBand(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="">Select</option>
                  {CONTACT_BANDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </label>
              <label className="mt-3 block">
                <span className="text-xs font-medium text-ink-3">What do you want to do first?</span>
                <select
                  value={primaryGoal} onChange={(e) => setPrimaryGoal(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                >
                  <option value="">Select</option>
                  {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
                </select>
              </label>

              <button
                onClick={submit} disabled={busy}
                className="mt-5 w-full rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-[#6d28d9] hover:to-[#4c1d95] disabled:opacity-50"
              >
                {busy ? "Creating your account…" : "Start my free trial"}
              </button>
              <button
                onClick={submit} disabled={busy}
                className="mt-2 w-full rounded-lg px-4 py-2 text-xs font-medium text-ink-3 hover:text-ink-2 disabled:opacity-50"
              >
                Skip and start my trial
              </button>
              <button
                onClick={() => setStep(1)} disabled={busy}
                className="mt-1 w-full text-center text-[11px] text-ink-3 hover:underline"
              >
                Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
