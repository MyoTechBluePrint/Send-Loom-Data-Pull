// The public marketing homepage. Deliberately self-contained: everything is
// on this one page so it can be art-directed freely without touching the app
// shell. Signed-in users never land here; the proxy sends them to "/".

import Link from "next/link";

export const metadata = {
  title: "SendLoom · Email marketing that pays for itself",
  description: "Campaigns, automations, popups and revenue attribution for WooCommerce stores. Start free for three days, no card required.",
};

const FEATURES = [
  { icon: "✉", title: "Campaigns that earn", body: "A block editor that renders exactly what lands in the inbox, with products, coupons and polls built in. No guesswork previews." },
  { icon: "⌁", title: "Automations", body: "Welcome journeys, recovery flows and follow-ups that react to what customers actually do on your store." },
  { icon: "▤", title: "Popups & multi-step forms", body: "Image-led popups and branching questions that tag, segment and reward, without a line of code." },
  { icon: "∿", title: "Revenue attribution", body: "Every send, click and coupon traced to orders. You see what your email earns, not just what it sends." },
  { icon: "◆", title: "Multi-brand", body: "Run every brand from one workspace: separate identities, senders, products and coupons that never bleed." },
  { icon: "◉", title: "Honest tracking", body: "Storefront-only tracking that rejects admin noise, respects consent and never invents a customer." },
];

const STEPS = [
  { k: "Today", t: "Create your account and start immediately. No payment details required." },
  { k: "Day 3", t: "Choose your plan and verify your payment method for £0." },
  { k: "Day 7", t: "Your subscription begins, unless you cancelled. Every date shown up front." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#faf9f7] text-[#2c2b28]">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-black/5 bg-[#faf9f7]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5">
          <Link href="/home" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-9 w-9 rounded-xl bg-white object-contain p-0.5 ring-1 ring-black/5" />
            <span className="text-[15px] font-semibold tracking-tight">SendLoom</span>
          </Link>
          <nav className="flex items-center gap-5">
            <Link href="/pricing" className="text-[13px] font-medium text-[#52514e] hover:text-[#14121f] max-sm:hidden">Pricing</Link>
            <Link href="/login" className="text-[13px] font-medium text-[#52514e] hover:text-[#14121f]">Sign in</Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
            >
              Start free trial
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-[480px] max-w-4xl rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(closest-side, #8b5cf6, transparent)" }}
        />
        <div className="relative mx-auto max-w-3xl px-5 pb-16 pt-20 text-center sm:pt-28">
          <p className="mx-auto inline-block rounded-full border border-[#6d28d9]/20 bg-[#f3eefc] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#6d28d9]">
            Growth Intelligence OS
          </p>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Email marketing that
            <span className="bg-gradient-to-r from-[#7c3aed] to-[#5b21b6] bg-clip-text text-transparent"> pays for itself</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[15px] leading-relaxed text-[#52514e]">
            Campaigns, automations, popups and revenue attribution, purpose-built for WooCommerce stores.
            See exactly what every email earns.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/signup"
              className="rounded-xl bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-7 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#6d28d9]/25 transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
            >
              Start free for three days
            </Link>
            <Link href="/pricing" className="px-4 py-3 text-[14px] font-medium text-[#52514e] underline-offset-4 hover:text-[#14121f] hover:underline">
              View pricing →
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-[#898781]">No payment details required to begin. Cancel before day seven and you pay nothing.</p>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 py-14">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl border border-black/5 bg-white p-6 shadow-[0_1px_2px_rgba(11,11,11,0.04)] transition hover:shadow-md">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-b from-[#f3eefc] to-[#ede6fb] text-lg text-[#6d28d9]">{f.icon}</span>
              <h3 className="mt-4 text-[15px] font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-[#52514e]">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Trial timeline */}
      <section className="border-y border-black/5 bg-[#14121f] py-16 text-white">
        <div className="mx-auto max-w-4xl px-5">
          <h2 className="text-center text-2xl font-semibold tracking-tight">Seven days, no surprises</h2>
          <p className="mx-auto mt-2 max-w-md text-center text-[13px] text-white/60">
            Exact dates and amounts at every step. No vague wording, ever.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.k} className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-b from-[#8b5cf6] to-[#6d28d9] text-[12px] font-bold">{i + 1}</span>
                <p className="mt-3 text-[11px] font-bold uppercase tracking-widest text-white/45">{s.k}</p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/85">{s.t}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Ready when your store is</h2>
        <p className="mx-auto mt-3 max-w-lg text-[14px] leading-relaxed text-[#52514e]">
          Connect your website, import your contacts and send your first campaign inside your free trial.
          Everything you build is yours to keep.
        </p>
        <Link
          href="/signup"
          className="mt-7 inline-block rounded-xl bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-8 py-3.5 text-[15px] font-semibold text-white shadow-lg shadow-[#6d28d9]/25 transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
        >
          Start my free trial
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-8 sm:flex-row">
          <p className="text-[12px] text-[#898781]">© {new Date().getFullYear()} SendLoom. All rights reserved.</p>
          <nav className="flex gap-5 text-[12px] text-[#898781]">
            <Link href="/pricing" className="hover:text-[#14121f]">Pricing</Link>
            <Link href="/login" className="hover:text-[#14121f]">Sign in</Link>
            <Link href="/signup" className="hover:text-[#14121f]">Start free trial</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
