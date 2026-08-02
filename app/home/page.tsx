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

const FEATURES = [
  { icon: "✉", t: "Email Campaigns", d: "Beautiful emails that get results." },
  { icon: "⚡", t: "Automation", d: "Powerful workflows made simple." },
  { icon: "▤", t: "Forms & Popups", d: "Grow your audience everywhere." },
  { icon: "◎", t: "Segmentation", d: "Smarter targeting. Better outcomes." },
  { icon: "▥", t: "Analytics", d: "Understand what really matters." },
  { icon: "▦", t: "Commerce", d: "Sell more with built-in ecommerce tools." },
  { icon: "✦", t: "AI Assistant", d: "Create, write and optimise with AI." },
];

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

function PayButtons({ compact = false }: { compact?: boolean }) {
  // The trial needs no card, so every payment affordance routes into signup;
  // real Apple Pay arrives at checkout via Stripe on day three.
  return (
    <div className={compact ? "w-full max-w-xs" : "w-full"}>
      <Link href="/signup" className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-black text-[15px] font-semibold text-white transition active:scale-[0.98]">
         Pay
      </Link>
      <Link href="/signup" className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[14px] font-semibold transition hover:border-black/25 active:scale-[0.98]" style={{ color: ink }}>
        <span className="font-bold" style={{ color: "#4285F4" }}>G</span> Pay · Google Pay
      </Link>
      {!compact && (
        <>
          <p className="my-3 text-center text-[11px] uppercase tracking-widest text-black/30">or</p>
          <Link href="/signup" className="flex h-12 w-full items-center justify-center rounded-xl border border-black/10 bg-white text-[14px] font-semibold transition hover:border-black/25" style={{ color: ink }}>
            ▭ Enter Card Details
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
            <h1 className="text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl">
              Marketing that<br />feels{" "}
              <span className="bg-gradient-to-r from-[#3478f6] to-[#7c8cf8] bg-clip-text text-transparent">effortless.</span>
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
                className="flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold text-white shadow-lg shadow-[#3478f6]/25 transition hover:brightness-105 active:scale-[0.98]"
                style={{ background: blue }}
              >
                Start Free Trial <span aria-hidden>→</span>
              </Link>
              <button className="flex items-center gap-2 text-[14px] font-semibold text-black/70 hover:text-black">
                <span className="grid h-9 w-9 place-items-center rounded-full border border-black/10 shadow-sm">▶</span>
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
                <span className="block text-[13px] tracking-tight text-[#f5a623]">★★★★★</span>
                <span className="text-[12px] text-black/50">Trusted by thousands of businesses</span>
              </span>
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
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-[#e8f7ee] text-[11px] text-[#1f9d55]">✓</span>
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
              🔒 Secure payments powered by Stripe
            </p>
            <p className="mt-0.5 text-center text-[11px] text-black/35">Your data is always protected.</p>
          </div>
        </Reveal>
      </section>

      {/* Device showcase: CSS devices, no screenshots */}
      <section className="overflow-hidden bg-gradient-to-b from-white via-[#eef3fe] to-white pb-24 pt-4">
        <Reveal>
          <div className="relative mx-auto max-w-4xl px-6">
            {/* MacBook */}
            <div className="mx-auto w-full max-w-2xl">
              <div className="rounded-t-2xl border border-black/10 bg-[#0e0e10] p-2.5 shadow-2xl">
                <div className="overflow-hidden rounded-lg bg-white">
                  <div className="flex">
                    <div className="w-1/5 space-y-2 border-r border-black/5 bg-[#fafafa] p-3">
                      <p className="text-[9px] font-bold">sendloom</p>
                      {["Overview", "Campaigns", "Automations", "Contacts", "Forms", "Products", "Analytics"].map((n, i) => (
                        <p key={n} className={`rounded px-1.5 py-0.5 text-[7px] ${i === 0 ? "bg-[#eaf1fe] font-semibold" : "text-black/40"}`} style={i === 0 ? { color: blue } : {}}>{n}</p>
                      ))}
                    </div>
                    <div className="flex-1 p-3">
                      <p className="text-[9px] font-bold">Good morning, Alex 👋</p>
                      <div className="mt-2 grid grid-cols-3 gap-1.5">
                        {[["Revenue", "£48,285", "+24%"], ["Total Emails", "152,540", "+18%"], ["Open Rate", "42.6%", "+5%"]].map(([l, v, d]) => (
                          <div key={l} className="rounded-lg border border-black/5 p-1.5">
                            <p className="text-[6px] text-black/40">{l}</p>
                            <p className="text-[9px] font-bold">{v}</p>
                            <p className="text-[6px] text-[#1f9d55]">{d}</p>
                          </div>
                        ))}
                      </div>
                      <div className="mt-1.5 rounded-lg border border-black/5 p-1.5">
                        <p className="text-[6px] text-black/40">Revenue Over Time</p>
                        <svg viewBox="0 0 200 40" className="mt-1 w-full">
                          <path d="M0,35 C30,32 45,20 70,22 S120,10 150,12 190,4 200,6" fill="none" stroke={blue} strokeWidth="1.5" />
                          <path d="M0,35 C30,32 45,20 70,22 S120,10 150,12 190,4 200,6 L200,40 L0,40 Z" fill={blue} opacity="0.08" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="mx-auto h-2.5 w-[110%] -translate-x-[4.5%] rounded-b-xl bg-gradient-to-b from-[#d7d7db] to-[#b9b9bf]" />
            </div>
            {/* iPhone */}
            <div className="absolute -bottom-4 right-8 hidden w-40 sm:block">
              <div className="rounded-[26px] border border-black/10 bg-[#0e0e10] p-1.5 shadow-2xl">
                <div className="overflow-hidden rounded-[20px] bg-white p-2">
                  <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-black/80" />
                  <p className="text-[7px] font-bold">Revenue</p>
                  <p className="text-[11px] font-bold">£48,285 <span className="text-[6px] font-semibold text-[#1f9d55]">+24%</span></p>
                  <svg viewBox="0 0 100 30" className="mt-1 w-full">
                    <path d="M0,26 C20,24 30,14 50,16 S80,6 100,8" fill="none" stroke={blue} strokeWidth="1.5" />
                  </svg>
                  <div className="mt-1.5 rounded-md border border-black/5 p-1">
                    <p className="text-[6px] text-black/40">Top Campaign</p>
                    <p className="text-[7px] font-semibold">Summer Collection</p>
                    <p className="text-[6px] text-[#1f9d55]">52.3% open</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-16">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {FEATURES.map((f, i) => (
            <Reveal key={f.t} delay={i * 60}>
              <div className="h-full rounded-2xl border border-black/[0.06] bg-gradient-to-b from-white to-[#fafbff] p-4 text-center shadow-[0_1px_2px_rgba(29,29,31,0.04),0_12px_28px_-12px_rgba(29,29,31,0.12)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_2px_4px_rgba(29,29,31,0.05),0_20px_44px_-12px_rgba(52,120,246,0.25)]">
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-b from-[#5b93f8] to-[#3478f6] text-[16px] text-white shadow-md shadow-[#3478f6]/30">{f.icon}</span>
                <p className="mt-2.5 text-[12px] font-bold leading-tight">{f.t}</p>
                <p className="mt-1 text-[10px] leading-snug text-black/45">{f.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Stats — PLACEHOLDER numbers, replace before paid traffic */}
      <section className="bg-[#0e0e10] py-14" data-placeholder="marketing-stats">
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
          {[["🔒", "Secure payments"], ["", "Apple Pay ready"], ["🛡", "GDPR compliant"], ["⚡", "Fast global delivery"]].map(([i, l]) => (
            <div key={l} className="rounded-2xl border border-black/[0.06] bg-white p-4 text-center">
              <p className="text-[16px]">{i}</p>
              <p className="mt-1 text-[12px] font-semibold text-black/60">{l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 pb-16">
        <Reveal>
          <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 overflow-hidden rounded-[32px] bg-[#0e0e10] px-8 py-14 text-white shadow-[0_32px_80px_-20px_rgba(14,14,16,0.5)] sm:flex-row sm:justify-between sm:px-14">
            <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(closest-side, #3478f6, transparent 70%)" }} />
            <div className="flex items-center gap-5">
              <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-3xl font-black text-white shadow-lg shadow-[#3478f6]/30" style={{ background: blue }}>S</span>
              <div>
                <h2 className="text-3xl font-bold leading-tight tracking-tight">Ready to send<br />better marketing?</h2>
                <p className="mt-2 text-[13px] text-white/50">Start your 3 day free trial. No commitment.</p>
              </div>
            </div>
            <PayButtons compact />
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
