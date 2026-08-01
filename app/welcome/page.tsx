// The trial introduction screen, shown once immediately after account
// creation. Calm rather than urgent: it tells the customer exactly what will
// happen on day three and day seven before they have to think about money.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { formatBillingMoment } from "@/lib/server/subscription-states";

export const dynamic = "force-dynamic";

const TRIAL_FEATURES = [
  { icon: "◉", label: "Connect your website", detail: "Install and verify SendLoom tracking." },
  { icon: "⇪", label: "Import contacts", detail: "Up to 2,000 during your trial." },
  { icon: "✉", label: "Build campaigns", detail: "Send up to 500 real emails." },
  { icon: "⌁", label: "Create automations", detail: "Three live automations." },
  { icon: "▤", label: "Forms and pop-ups", detail: "Capture on your storefront." },
  { icon: "∿", label: "Revenue attribution", detail: "See what your email earns." },
  { icon: "◫", label: "Advanced segmentation", detail: "On, with your own data." },
  { icon: "✧", label: "AI campaign help", detail: "50 credits included." },
];

export default async function WelcomePage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId } });

  // An in-house or comped account should never see a trial screen.
  if (!sub || sub.complimentary) redirect("/");

  const stageOne = sub.trialStageOneEndsAt;
  const ends = sub.trialEndsAt;

  return (
    <div className="min-h-screen bg-[#14121f] px-4 py-10 text-white">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-center justify-center gap-2.5">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
          <p className="text-base font-semibold">Sendloom</p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-7 sm:p-10">
          <p className="text-xs font-bold uppercase tracking-widest text-[#a78bfa]">Your trial is live</p>
          <h1 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">
            Try SendLoom free for three days
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70">
            Explore the platform, build campaigns, connect your website and see how SendLoom can help
            generate more revenue. No payment details are required to begin.
          </p>

          {/* The seven-day timeline, with the customer's own dates. */}
          <div className="mt-8 rounded-xl border border-white/10 bg-[#14121f] p-5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-white/40">
              <span>Today</span><span>Day 3</span><span>Day 7</span>
            </div>
            <div className="relative mt-2 h-1.5 rounded-full bg-white/10">
              <div className="absolute inset-y-0 left-0 w-[6%] rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9]" />
              <span className="absolute -top-1 left-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-[#14121f] bg-[#8b5cf6]" />
              <span className="absolute -top-1 left-[42.8%] h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-[#14121f] bg-white/30" />
              <span className="absolute -top-1 left-full h-3.5 w-3.5 -translate-x-1/2 rounded-full border-2 border-[#14121f] bg-white/30" />
            </div>

            <dl className="mt-5 grid gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-semibold text-white/90">Today</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-white/55">
                  Start immediately. No payment details required.
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-white/90">Day 3</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-white/55">
                  Choose your plan and verify your payment method for £0.
                  {stageOne && <span className="mt-1 block text-white/75">{formatBillingMoment(stageOne)}</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-white/90">Day 7</dt>
                <dd className="mt-1 text-[11px] leading-relaxed text-white/55">
                  Your selected monthly subscription begins unless cancelled beforehand.
                  {ends && <span className="mt-1 block text-white/75">{formatBillingMoment(ends)}</span>}
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-7">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40">What you can do right now</p>
            <ul className="mt-3 grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {TRIAL_FEATURES.map((f) => (
                <li key={f.label} className="flex gap-3">
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10 text-[12px] text-[#a78bfa]">{f.icon}</span>
                  <div>
                    <p className="text-[13px] font-medium text-white/90">{f.label}</p>
                    <p className="text-[11px] text-white/50">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/"
              className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-6 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
            >
              Start my free trial
            </Link>
            <Link href="/plans" className="text-center text-sm font-medium text-white/70 underline-offset-4 hover:text-white hover:underline">
              View subscription options
            </Link>
          </div>

          <p className="mt-6 border-t border-white/10 pt-5 text-[11px] leading-relaxed text-white/40">
            Card details are handled entirely by our payment provider and never reach SendLoom&apos;s servers.
            {ends && ` Cancel before ${formatBillingMoment(ends)} and you will not be charged.`}
          </p>
        </div>
      </div>
    </div>
  );
}
