// The iOS-style conversion landing page. One purpose: start the free trial.
// Almost no navigation, one subscription choice, Apple-calm motion.
//
// HONESTY MARKERS: the stats, testimonials and company logos below are
// PLACEHOLDER marketing content supplied by the design comp. Replace with
// real numbers and real customers before this page carries paid traffic.

import Link from "next/link";
import { Reveal } from "@/components/reveal";

export const metadata = {
  title: "SendLoom · Marketing that feels effortless",
  description: "Email, automation, forms and commerce in one beautiful platform. Start your 3-day free trial. No card required.",
};

const ink = "#1d1d1f";
const blue = "#3478f6";

/* Crisp inline SVGs: no emoji, no font-dependent glyphs. */
const AppleLogo = ({ className = "h-[18px] w-[18px]" }: { className?: string }) => (
  <svg viewBox="0 0 814 1000" className={className} fill="currentColor" aria-hidden>
    <path d="M788 341c-6 4-107 61-107 187 0 146 128 198 132 199-1 3-20 71-67 140-42 61-86 122-153 122s-84-39-161-39c-75 0-102 40-163 40s-104-56-153-125C60 782 14 664 14 552c0-180 117-275 232-275 61 0 112 40 150 40 36 0 93-42 162-42 26 0 120 2 182 92zM554 172c31-37 53-88 53-139 0-7-1-14-2-20-50 2-110 34-146 76-28 32-55 83-55 135 0 8 1 16 2 18 3 1 8 2 13 2 45 0 102-30 135-72z" />
  </svg>
);
const GoogleG = ({ className = "h-[18px] w-[18px]" }: { className?: string }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden>
    <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z" />
    <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.7 6c4.5-4.2 6.9-10.3 6.9-17.7z" />
    <path fill="#FBBC05" d="M10.5 28.6c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.9-6.2C.9 16.5 0 20.1 0 24s.9 7.5 2.6 10.8l7.9-6.2z" />
    <path fill="#34A853" d="M24 48c6.3 0 11.6-2.1 15.6-5.7l-7.7-6c-2.1 1.4-4.8 2.3-7.9 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.5 42.6 14.6 48 24 48z" />
  </svg>
);
const Icon = ({ d, className = "h-4 w-4", stroke = "currentColor" }: { d: string; className?: string; stroke?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);
const PATHS = {
  mail: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm0 1 8 6 8-6",
  bolt: "M13 3 5 13h6l-1 8 8-10h-6l1-8z",
  form: "M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm3 5h8M8 12h8M8 15h5",
  target: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm0 3.5a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1z",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H4",
  cart: "M4 5h2l2 11h10l2-8H7M10 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm7 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z",
  sparkle: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zm7 11 .9 2.4L22 17l-2.1.6L19 20l-.9-2.4L16 17l2.1-.6L19 14z",
  lock: "M7 11V8a5 5 0 0 1 10 0v3m-11 0h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1zm6 4v2",
  shield: "M12 3l8 3v6c0 4.4-3.4 8.2-8 9-4.6-.8-8-4.6-8-9V6l8-3zm-3 9 2 2 4-4",
  card: "M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7zm0 3h18M6 14h4",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c2.5 2.6 4 5.6 4 9s-1.5 6.4-4 9c-2.5-2.6-4-5.6-4-9s1.5-6.4 4-9z",
  check: "M5 12.5 10 17l9-10",
  play: "M8 5.5v13l11-6.5-11-6.5z",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9 2.9-6z",
};

const FEATURES = [
  { icon: "mail", t: "Email Campaigns", d: "Beautiful emails that get results." },
  { icon: "bolt", t: "Automation", d: "Powerful workflows made simple." },
  { icon: "form", t: "Forms & Popups", d: "Grow your audience everywhere." },
  { icon: "target", t: "Segmentation", d: "Smarter targeting. Better outcomes." },
  { icon: "chart", t: "Analytics", d: "Understand what really matters." },
  { icon: "cart", t: "Commerce", d: "Sell more with built-in ecommerce tools." },
  { icon: "sparkle", t: "AI Assistant", d: "Create, write and optimise with AI." },
] as const;

const STATS = [
  { n: "250M+", l: "Emails delivered" },
  { n: "35K+", l: "Campaigns launched" },
  { n: "20K+", l: "Happy businesses" },
  { n: "99.9%", l: "Uptime guarantee" },
];

const QUOTES = [
  { q: "SendLoom has completely changed how we run our email and marketing. Powerful, beautiful and so easy to use.", n: "Sophie Mitchell", r: "Founder, Glow Skincare", c: "#e9d5ff" },
  { q: "The automation and segmentation features are next level. Our results have never been better.", n: "James Carter", r: "CMO, Drift & Co.", c: "#bfdbfe" },
  { q: "Finally, a platform that brings everything together. We love SendLoom.", n: "Olivia Bennett", r: "Marketing Director, Studio B", c: "#bbf7d0" },
];

const LOGOS = ["GLOW", "DRIFT & CO.", "ICONIC", "STUDIO B", "NORTHBOUND", "SÖLACE"];

function PayButtons({ compact = false, onDark = false }: { compact?: boolean; onDark?: boolean }) {
  // The trial needs no card, so every payment affordance routes into signup;
  // real Apple Pay arrives at checkout via Stripe on day three.
  // On dark surfaces Apple Pay flips to Apple's white variant, so it never
  // sits black-on-black.
  return (
    <div className={compact ? "w-full max-w-xs" : "w-full"}>
      <Link
        href="/signup"
        className={`flex h-12 w-full items-center justify-center gap-1.5 rounded-xl text-[16px] font-semibold shadow-md transition active:scale-[0.98] ${
          onDark
            ? "bg-gradient-to-b from-white to-[#e8e8ec] text-black shadow-black/40"
            : "bg-gradient-to-b from-[#2c2c2e] to-black text-white shadow-black/25"
        }`}
      >
        <AppleLogo /> Pay
      </Link>
      <Link href="/signup" className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[15px] font-semibold transition hover:border-black/25 active:scale-[0.98]" style={{ color: ink }}>
        <GoogleG /> Pay
      </Link>
      {!compact && (
        <>
          <p className="my-3 text-center text-[11px] uppercase tracking-widest text-black/30">or</p>
          <Link href="/signup" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[14px] font-semibold transition hover:border-black/25" style={{ color: ink }}>
            <Icon d={PATHS.card} className="h-[17px] w-[17px]" stroke={blue} /> Enter Card Details
          </Link>
        </>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white antialiased" style={{ color: ink }}>
      {/* Near-invisible nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="flex items-center gap-2">
          <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg object-contain" />
          <span className="text-[16px] font-bold tracking-tight">sendloom</span>
        </span>
        <Link href="/login" className="text-[13px] font-medium text-black/60 hover:text-black">Sign in</Link>
      </header>

      {/* Hero + subscription card */}
      <section className="relative mx-auto grid max-w-6xl items-start gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
        {/* Ambient atmosphere: two soft washes, Apple-quiet */}
        <div aria-hidden className="pointer-events-none absolute -top-32 right-0 h-[560px] w-[560px] rounded-full opacity-[0.14] blur-3xl" style={{ background: "radial-gradient(closest-side, #3478f6, transparent 70%)" }} />
        <div aria-hidden className="pointer-events-none absolute -left-40 top-64 h-[420px] w-[420px] rounded-full opacity-[0.08] blur-3xl" style={{ background: "radial-gradient(closest-side, #a78bfa, transparent 70%)" }} />
        <div className="pt-6">
          <Reveal>
            <h1 className="text-6xl font-bold leading-[1.02] tracking-[-0.02em] sm:text-7xl">
              Marketing that<br />feels{" "}
              <span className="bg-gradient-to-b from-[#5b93f8] to-[#2c63d9] bg-clip-text text-transparent">effortless.</span>
            </h1>
          </Reveal>
          <Reveal delay={100}>
            <p className="mt-6 max-w-md text-[16px] leading-relaxed text-black/60">
              SendLoom brings email, automation, forms, and commerce together in one beautiful platform.
              Everything you need. Nothing you don&apos;t.
            </p>
          </Reveal>
          <Reveal delay={180}>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/signup"
                className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-[#5b93f8] to-[#2c63d9] px-6 text-[15px] font-semibold text-white shadow-lg shadow-[#3478f6]/30 transition hover:from-[#4a86f7] hover:to-[#2458c8] active:scale-[0.98]"
              >
                Start Free Trial <span aria-hidden>→</span>
              </Link>
              <button className="flex items-center gap-2 text-[14px] font-semibold text-black/70 hover:text-black">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-black/10 bg-white shadow-sm">
                  <Icon d={PATHS.play} className="ml-0.5 h-3.5 w-3.5" stroke={blue} />
                </span>
                Watch 30 Second Demo
              </button>
            </div>
          </Reveal>
          <Reveal delay={260}>
            <div className="mt-8 flex items-center gap-3">
              <span className="flex -space-x-2">
                {["#fde68a", "#fca5a5", "#a7f3d0", "#bfdbfe"].map((c, i) => (
                  <span key={i} className="h-8 w-8 rounded-full border-2 border-white" style={{ background: c }} />
                ))}
              </span>
              <span>
                <span className="flex gap-0.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#f5a623" aria-hidden><path d={PATHS.star} /></svg>
                  ))}
                </span>
                <span className="text-[12px] text-black/50">Trusted by thousands of businesses</span>
              </span>
            </div>
          </Reveal>

          {/* Devices live in the hero: the product is the proof */}
          <Reveal delay={340}>
            <div className="relative mt-10">
              <div aria-hidden className="pointer-events-none absolute inset-x-10 bottom-0 h-20 rounded-full bg-[#3478f6]/15 blur-3xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/devices.png"
                alt="SendLoom dashboard on a MacBook and iPhone"
                width={1024}
                height={560}
                className="relative w-full max-w-none drop-shadow-[0_28px_48px_rgba(29,29,31,0.2)] lg:w-[115%]"
              />
            </div>
          </Reveal>
        </div>

        {/* The centrepiece: one subscription, Apple One treatment */}
        <Reveal delay={150}>
          <div className="relative rounded-[28px] border border-black/[0.06] bg-white/95 p-7 shadow-[0_2px_6px_rgba(29,29,31,0.05),0_28px_80px_-16px_rgba(52,120,246,0.35)] ring-1 ring-white backdrop-blur">
            <div aria-hidden className="pointer-events-none absolute inset-x-8 -bottom-6 h-12 rounded-full bg-[#3478f6]/20 blur-2xl" />
            <p className="mx-auto w-fit rounded-full bg-[#eaf1fe] px-3 py-1 text-[11px] font-bold uppercase tracking-widest" style={{ color: blue }}>
              3 Day Free Trial
            </p>
            <h2 className="mt-3 text-center text-2xl font-bold tracking-tight">Start your free trial</h2>
            <p className="mt-1 text-center text-[13px] text-black/50">No commitment. Cancel anytime.</p>

            <ul className="mt-5 space-y-2.5">
              {["Full access to all features", "3 days completely free", "No card required for trial"].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-[14px]">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e8f7ee]">
                    <Icon d={PATHS.check} className="h-3 w-3" stroke="#1f9d55" />
                  </span>
                  {f}
                </li>
              ))}
            </ul>

            <div className="my-5 border-t border-black/[0.06] pt-5 text-center">
              <p className="text-[14px] text-black/60">
                Then just <span className="text-[22px] font-bold" style={{ color: ink }}>£29</span> / month
              </p>
              <p className="mt-0.5 text-[12px] text-black/45">One simple plan. Everything included.</p>
            </div>

            <PayButtons />

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-black/45">
              <Icon d={PATHS.lock} className="h-3 w-3" stroke={blue} /> Secure payments powered by Stripe
            </p>
            <p className="mt-0.5 text-center text-[11px] text-black/35">Your data is always protected.</p>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 60}>
              <div className="h-full rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white to-[#fafbff] p-4 text-center shadow-[0_1px_2px_rgba(29,29,31,0.04),0_12px_28px_-12px_rgba(29,29,31,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(29,29,31,0.05),0_20px_44px_-12px_rgba(52,120,246,0.25)]">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-b from-[#5b93f8] to-[#3478f6] text-white shadow-md shadow-[#3478f6]/30">
                  <Icon d={PATHS[f.icon]} className="h-[18px] w-[18px]" />
                </span>
                <p className="mt-2.5 text-[12px] font-bold leading-tight">{f.t}</p>
                <p className="mt-1 text-[10px] leading-snug text-black/45">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Stats — PLACEHOLDER numbers, replace before paid traffic */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1a1a1d] to-[#0a0a0c] py-14" data-placeholder="marketing-stats">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 px-6 sm:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.l} delay={i * 80}>
              <div className="text-center">
                <p className="bg-gradient-to-b from-white to-white/60 bg-clip-text text-3xl font-bold tracking-tight text-transparent">{s.n}</p>
                <p className="mt-1 text-[12px] text-white/40">{s.l}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Testimonials — PLACEHOLDER quotes, replace with real customers */}
      <section className="mx-auto max-w-6xl px-6 py-16" data-placeholder="testimonials">
        <Reveal>
          <h2 className="text-center text-[15px] font-semibold text-black/60">Loved by marketers and business owners</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {QUOTES.map((t, i) => (
            <Reveal key={t.n} delay={i * 100}>
              <figure className="h-full rounded-2xl border border-black/[0.06] bg-white p-6 shadow-[0_1px_3px_rgba(29,29,31,0.05)]">
                <span className="grid h-10 w-10 place-items-center rounded-full text-[13px] font-bold text-black/60" style={{ background: t.c }}>
                  {t.n.split(" ").map((w) => w[0]).join("")}
                </span>
                <blockquote className="mt-4 text-[14px] leading-relaxed text-black/75">&ldquo;{t.q}&rdquo;</blockquote>
                <figcaption className="mt-4">
                  <p className="text-[13px] font-bold">{t.n}</p>
                  <p className="text-[12px] text-black/45">{t.r}</p>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
        <Reveal delay={150}>
          <p className="mt-12 text-center text-[12px] font-medium uppercase tracking-widest text-black/35">Trusted by thousands of amazing companies</p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50" data-placeholder="logos">
            {LOGOS.map((l) => (
              <span key={l} className="text-[15px] font-bold tracking-widest text-black/60" style={{ fontFamily: l === "GLOW" ? "Georgia, serif" : undefined }}>{l}</span>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Trust */}
      <section className="mx-auto max-w-4xl px-6 pb-16">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([["lock", "Secure payments"], ["apple", "Apple Pay ready"], ["shield", "GDPR compliant"], ["globe", "Fast global delivery"]] as const).map(([i, l]) => (
            <div key={l} className="rounded-2xl border border-black/[0.06] bg-white p-4 text-center shadow-[0_1px_2px_rgba(29,29,31,0.04)]">
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-full bg-[#eaf1fe]">
                {i === "apple"
                  ? <AppleLogo className="h-4 w-4" />
                  : <Icon d={PATHS[i]} className="h-4 w-4" stroke={blue} />}
              </span>
              <p className="mt-2 text-[12px] font-semibold text-black/60">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-16">
        <Reveal>
          <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 overflow-hidden rounded-[32px] bg-gradient-to-br from-[#5b93f8] via-[#3478f6] to-[#1d4ed8] px-8 py-14 text-white shadow-[0_32px_80px_-20px_rgba(52,120,246,0.55)] sm:flex-row sm:justify-between sm:px-14">
            {/* Quiet dot grid: texture, not decoration */}
            <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.14) 1px, transparent 1px)", backgroundSize: "22px 22px" }} />
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(closest-side, #ffffff, transparent 70%)" }} />
            <div aria-hidden className="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(closest-side, #1e3a8a, transparent 70%)" }} />
            <div className="flex items-center gap-5">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-b from-white to-[#dbe7fd] text-3xl font-black shadow-lg shadow-[#1d4ed8]/40" style={{ color: blue }}>S</span>
              <div>
                <h2 className="text-3xl font-bold leading-tight tracking-tight">Ready to send<br />better marketing?</h2>
                <p className="mt-2 text-[13px] text-white/70">Start your 3 day free trial. No commitment.</p>
              </div>
            </div>
            <div className="relative">
              <PayButtons compact onDark />
              <Link href="/signup" className="mt-3 block text-center text-[12px] font-medium text-white/50 underline-offset-4 hover:text-white hover:underline">
                Enter Card Details
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Minimal footer */}
      <footer className="border-t border-black/[0.05]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-[11px] text-black/40 sm:flex-row">
          <p>© {new Date().getFullYear()} SendLoom. All rights reserved.</p>
          <nav className="flex gap-6">
            <Link href="/home" className="hover:text-black/70">Privacy Policy</Link>
            <Link href="/home" className="hover:text-black/70">Terms of Service</Link>
            <Link href="/home" className="hover:text-black/70">Contact</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
