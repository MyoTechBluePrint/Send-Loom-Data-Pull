// The iOS-style conversion landing page. One purpose: start the free trial.
// Almost no navigation, one subscription choice, Apple-calm motion.
//
// HONESTY MARKERS: the stats, testimonials and company logos below are
// PLACEHOLDER marketing content supplied by the design comp. Replace with
// real numbers and real customers before this page carries paid traffic.

import Link from "next/link";
import { Loomi } from "@/components/loomi";
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
  sms: "M4 4h16a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1zm4 6.5h.01M12 10.5h.01M16 10.5h.01",
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

function PayButtons({ compact = false, onDark = false, large = false }: { compact?: boolean; onDark?: boolean; large?: boolean }) {
  const h = large ? "h-14 text-[18px]" : "h-12 text-[16px]";
  const h2 = large ? "h-14 text-[17px]" : "h-12 text-[15px]";
  const mark = large ? "h-[22px] w-[22px]" : "h-[18px] w-[18px]";
  // The trial needs no card, so every payment affordance routes into signup;
  // real Apple Pay arrives at checkout via Stripe on day three.
  // On dark surfaces Apple Pay flips to Apple's white variant, so it never
  // sits black-on-black.
  return (
    <div className={compact ? (large ? "w-full max-w-sm" : "w-full max-w-xs") : "w-full"}>
      <Link
        href="/signup"
        data-loomi-cheer
        className={`flex ${h} w-full items-center justify-center gap-1.5 rounded-xl font-semibold shadow-md transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3478f6] active:scale-[0.98] ${
          onDark
            ? "bg-gradient-to-b from-white to-[#e8e8ec] text-black shadow-black/40"
            : "bg-gradient-to-b from-[#2c2c2e] to-black text-white shadow-black/25"
        }`}
      >
        <AppleLogo className={mark} /> Pay
      </Link>
      <Link href="/signup" data-loomi-cheer className={`mt-2.5 flex ${h2} w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white font-semibold transition hover:border-black/25 active:scale-[0.98]`} style={{ color: ink }}>
        <GoogleG className={mark} /> Pay
      </Link>
      {!compact && (
        <>
          <p className="my-3 text-center text-[11px] uppercase tracking-widest text-black/30">or</p>
          <Link href="/signup" data-loomi-cheer className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border border-black/10 bg-white text-[14px] font-semibold transition hover:border-black/25" style={{ color: ink }}>
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
      {/* ── Midnight hero: dark Apple-store-at-night atmosphere ─────────── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#102C58] via-[#081226] to-[#03050B] text-white">
        <style>{`
          @keyframes sl-shimmer { 0%, 82% { background-position: 0 0, -220% 0; } 100% { background-position: 0 0, 220% 0; } }
          @keyframes sl-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
          @keyframes sl-ambient { 0%, 100% { transform: translate(0, 0); } 50% { transform: translate(30px, -18px); } }
          @keyframes sl-strike { 0%, 78% { opacity: 0.10; } 84% { opacity: 0.4; } 88% { opacity: 0.16; } 92% { opacity: 0.32; } 100% { opacity: 0.10; } }
          @keyframes sl-beam { 0%, 100% { transform: rotate(24deg) translateY(-2%); opacity: 0.14; } 50% { transform: rotate(24deg) translateY(2%); opacity: 0.24; } }
          html { scroll-behavior: smooth; }
          @media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } .sl-shimmer-layer, .sl-float, .sl-ambient, .sl-motion { animation: none !important; } }
        `}</style>

        {/* Lacquer atmosphere: layered glows, gloss streak, vignette */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="sl-ambient absolute -left-40 -top-64 h-[720px] w-[900px] rounded-full opacity-60 blur-3xl" style={{ background: "radial-gradient(closest-side, #14356B, transparent 72%)", animationName: "sl-ambient", animationDuration: "18s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }} />
          <div className="absolute -bottom-80 left-1/4 h-[640px] w-[820px] rounded-full opacity-45 blur-3xl" style={{ background: "radial-gradient(closest-side, #08152E, transparent 70%)" }} />
          <div className="absolute -top-24 right-[6%] h-[560px] w-[560px] rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(255,247,236,0.5), transparent 70%)" }} />
          <div className="absolute inset-0 opacity-[0.05]" style={{ background: "linear-gradient(115deg, transparent 42%, #9db8e8 49%, transparent 55%)" }} />
          {/* Diagonal light beam on the left: soft white-blue shaft */}
          <div
            className="sl-motion absolute -left-24 -top-40 h-[130%] w-[280px] blur-2xl"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.5), rgba(157,196,255,0.35) 45%, transparent 85%)",
              transformOrigin: "top left",
              animationName: "sl-beam", animationDuration: "14s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite",
            }}
          />
          {/* The strike itself: a jagged bolt that flashes softly */}
          <svg viewBox="0 0 400 900" aria-hidden className="sl-motion absolute -top-10 left-[2%] h-[115%] w-[360px]" fill="none" style={{ animationName: "sl-strike", animationDuration: "11s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }}>
            <path d="M150 -20 L196 210 L154 236 L232 470 L196 492 L292 760" stroke="#dbe9ff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 14px rgba(157,196,255,0.9)) drop-shadow(0 0 40px rgba(91,147,248,0.5))" }} />
            <path d="M150 -20 L196 210 L154 236 L232 470 L196 492 L292 760" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
            <path d="M196 210 L246 196 M232 470 L278 452" stroke="#9dc4ff" strokeWidth="2" strokeLinecap="round" opacity="0.6" />
          </svg>
          <div className="absolute inset-0" style={{ boxShadow: "inset 0 0 180px 60px rgba(2,3,8,0.85)" }} />
        </div>

        {/* Nav */}
        <header className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <span className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl object-cover" />
            <span className="text-[20px] font-bold tracking-tight">sendloom</span>
          </span>
          <Link
            href="/login"
            className="flex items-center gap-2 rounded-full bg-gradient-to-b from-white to-[#dfe6f2] px-5 py-2.5 text-[14px] font-bold text-[#0A1830] shadow-[0_2px_10px_rgba(255,255,255,0.15),0_8px_24px_-8px_rgba(0,0,0,0.6)] transition hover:from-[#f2f6ff] hover:to-[#cfd9ea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fb4fa] active:scale-[0.98]"
          >
            Sign in <span aria-hidden>→</span>
          </Link>
        </header>

        <section className="relative mx-auto grid max-w-6xl items-start gap-12 px-6 pb-16 pt-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16">
          <div>
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-3.5 py-1.5 text-[12px] font-medium text-[#8fb4fa]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5b93f8]" />
                All-in-one marketing automation platform
              </p>
            </Reveal>

            <Reveal delay={90}>
              <h1 className="relative mt-6 text-6xl font-bold leading-[1.03] tracking-[-0.02em] sm:text-7xl">
                {/* Polished enamel: pale gradient body with a slow shimmer pass */}
                <span
                  className="sl-shimmer-layer bg-clip-text text-transparent"
                  style={{
                    backgroundImage:
                      "linear-gradient(100deg, transparent 44%, rgba(255,255,255,0.5) 50%, transparent 56%), linear-gradient(180deg, #ffffff 20%, #c7d2e4 60%, #8e9cb8 100%)",
                    backgroundSize: "240% 100%, 100% 100%",
                    backgroundPosition: "-220% 0, 0 0",
                    animationName: "sl-shimmer",
                    animationDuration: "10s",
                    animationTimingFunction: "linear",
                    animationIterationCount: "infinite",
                    WebkitBackgroundClip: "text",
                  }}
                >
                  Marketing that
                  <br />
                  feels{" "}
                </span>
                <span
                  className="bg-gradient-to-b from-[#7cb0ff] to-[#2f6ae0] bg-clip-text text-transparent"
                  style={{ filter: "drop-shadow(0 0 22px rgba(63,118,236,0.45))" }}
                >
                  effortless.
                </span>
              </h1>
            </Reveal>

            <Reveal delay={170}>
              <p className="mt-6 max-w-md text-[16px] leading-relaxed text-white/60">
                SendLoom brings email, automation, forms, and commerce together in one beautiful platform.
                Everything you need. Nothing you don&apos;t.
              </p>
            </Reveal>

            <Reveal delay={240}>
              <div className="mt-8 flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  data-loomi-cheer
                  className="flex h-12 items-center gap-2 rounded-xl bg-gradient-to-b from-[#5b93f8] to-[#2c63d9] px-6 text-[15px] font-semibold text-white shadow-lg shadow-[#2c63d9]/40 transition hover:from-[#4a86f7] hover:to-[#2458c8] hover:shadow-xl hover:shadow-[#2c63d9]/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8fb4fa] active:scale-[0.98]"
                >
                  Start your free trial <span aria-hidden>→</span>
                </Link>
                <a href="#features" className="flex items-center gap-2.5 rounded-full text-[14px] font-semibold text-white/80 transition hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8fb4fa]">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-white/[0.05] transition group-hover:bg-white/[0.1]">
                    <Icon d={PATHS.play} className="ml-0.5 h-3.5 w-3.5" stroke="#ffffff" />
                  </span>
                  See SendLoom in action
                </a>
              </div>
            </Reveal>

            <Reveal delay={310}>
              <div className="mt-8 flex items-center gap-4">
                <span className="flex items-center -space-x-2">
                  {["#fde68a", "#fca5a5", "#a7f3d0", "#bfdbfe", "#e9d5ff", "#fbcfe8"].map((c, i) => (
                    <span key={i} className="h-8 w-8 rounded-full border-2 border-[#0a1120]" style={{ background: c }} />
                  ))}
                  <span className="grid h-8 w-8 place-items-center rounded-full border-2 border-[#0a1120] bg-white/10 text-[10px] font-bold text-white/80">+2k</span>
                </span>
                <span>
                  <span className="flex gap-0.5">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <svg key={i} viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="#f5a623" aria-hidden><path d={PATHS.star} /></svg>
                    ))}
                  </span>
                  <span className="text-[12px] text-white/50">Trusted by thousands of businesses</span>
                </span>
              </div>
            </Reveal>

            {/* Devices: white UI glowing against the dark, understated */}
            <Reveal delay={400}>
              <div className="relative mt-10">
                <div aria-hidden className="pointer-events-none absolute inset-x-8 bottom-0 h-24 rounded-full bg-[#3f76ec]/25 blur-3xl" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/devices.png"
                  alt="SendLoom dashboard on a MacBook and iPhone"
                  width={1024}
                  height={560}
                  className="relative w-full max-w-none drop-shadow-[0_36px_60px_rgba(0,0,0,0.55)] lg:w-[118%]"
                />
              </div>
            </Reveal>
          </div>

          {/* The centrepiece: bright card in a warm showroom bloom.
              The float lives on the wrapper so Loomi rides with the card and
              his grip on its edge never drifts. */}
          <Reveal delay={150}>
            <div
              className="sl-float relative lg:mt-4"
              style={{ animationName: "sl-float", animationDuration: "9s", animationTimingFunction: "ease-in-out", animationIterationCount: "infinite" }}
            >
              <div aria-hidden className="pointer-events-none absolute -inset-14 rounded-[48px] opacity-90 blur-3xl" style={{ background: "radial-gradient(closest-side, rgba(255,249,240,0.32), rgba(200,219,255,0.12) 60%, transparent 75%)" }} />
              <Loomi />
              <div
                className="relative z-[2] rounded-[28px] bg-white p-7 text-[#1d1d1f] shadow-[0_2px_8px_rgba(0,0,0,0.35),0_48px_120px_-24px_rgba(0,0,0,0.7)]"
              >
                <p className="mx-auto w-fit rounded-full bg-[#eaf1fe] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#2f6ae0]">
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
                    Then just <span className="text-[22px] font-bold text-[#1d1d1f]">£29</span> / month
                  </p>
                  <p className="mt-0.5 text-[12px] text-black/45">One simple plan. Everything included.</p>
                </div>

                <PayButtons />

                <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-black/45">
                  <Icon d={PATHS.lock} className="h-3 w-3" stroke="#2f6ae0" /> Secure payments powered by Stripe
                </p>
                <p className="mt-0.5 text-center text-[11px] text-black/35">Your data is always protected.</p>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Trust strip closing the hero */}
        <div className="relative border-t border-white/[0.08]">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-5 px-6 py-7 sm:grid-cols-3 lg:grid-cols-5">
            {([
              ["card", "No card required", "for your trial"],
              ["lock", "Cancel anytime", "No hidden fees"],
              ["shield", "GDPR compliant", "Your data is protected"],
              ["bolt", "99.9% uptime", "Built for reliability"],
              ["sms", "24/7 support", "We're here to help"],
            ] as const).map(([icon, t, d2]) => (
              <div key={t} className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/[0.12] bg-white/[0.04]">
                  <Icon d={PATHS[icon]} className="h-4 w-4" stroke="#8fb4fa" />
                </span>
                <span>
                  <span className="block text-[13px] font-semibold text-white/85">{t}</span>
                  <span className="text-[11px] text-white/45">{d2}</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 pb-16 pt-6 scroll-mt-6">
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

      {/* Final CTA: full-bleed band — lifestyle photo under a translucent black wash */}
      <section className="relative overflow-hidden bg-[#0a0a0c]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/lifestyle.jpg" alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-[center_30%]" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-black/55 via-black/30 to-black/60" />
        <Reveal>
          <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-8 py-24 text-white sm:flex-row sm:justify-between sm:px-14 lg:py-32">
            <div className="flex items-center gap-5">
              <span className="block h-28 w-28 shrink-0 overflow-hidden rounded-[22px] shadow-xl shadow-[#1d4ed8]/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="SendLoom" className="h-full w-full object-cover" />
              </span>
              <div>
                <h2 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">Ready to send<br />better marketing?</h2>
                <p className="mt-3 text-[16px] text-white/70">Start your 3 day free trial. No commitment.</p>
              </div>
            </div>
            <div className="relative">
              <PayButtons compact onDark large />
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
