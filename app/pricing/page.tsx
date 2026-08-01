// Public pricing. Same cards, no account required, so the page can be linked
// from anywhere without a sign-in wall.

import Link from "next/link";
import { PlanCards } from "@/components/billing/plan-cards";

export const dynamic = "force-dynamic";

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/pricing" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5 ring-1 ring-line" />
            <span className="text-sm font-semibold">Sendloom</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-xs font-medium text-ink-3 hover:text-brand">Sign in</Link>
            <Link
              href="/signup"
              className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-xs font-semibold text-white transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
            >
              Start free trial
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-semibold tracking-tight">Simple pricing that follows your list</h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Start free for three days. No payment details required. Choose your plan by day three to
            continue your full seven-day free trial, and cancel before it ends without being charged.
          </p>
        </div>

        <div className="mt-10">
          <PlanCards signedIn={false} />
        </div>

        <section className="mx-auto mt-14 max-w-2xl">
          <h2 className="text-center text-lg font-semibold">Questions people actually ask</h2>
          <dl className="mt-6 space-y-4">
            {[
              {
                q: "Do I need a card to start?",
                a: "No. The first three days need nothing but an email address. On day three you choose a plan and verify a payment method, and £0 is taken at that point.",
              },
              {
                q: "When am I first charged?",
                a: "At the end of day seven, for the plan you chose. We tell you the exact date and amount when you verify your payment method, and again 48 and 24 hours before it happens.",
              },
              {
                q: "What if I cancel?",
                a: "You keep access until the end of the trial or the paid period you have already got, and you are not charged. Your campaigns, contacts, automations and analytics are kept so nothing has to be rebuilt if you come back.",
              },
              {
                q: "What happens if I go over a limit?",
                a: "We prompt you to move up a plan. Sending is not cut off without warning, and nothing you have built is deleted.",
              },
            ].map((f) => (
              <div key={f.q} className="rounded-xl border border-line bg-surface p-4">
                <dt className="text-sm font-semibold">{f.q}</dt>
                <dd className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
