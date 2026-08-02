// Trial introduction, shown once after account creation. Deliberately small:
// trial is live, nothing is due today, here are the two dates that matter,
// get in. The pricing comparison lives on /billing/plans, not here.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { formatBillingMoment } from "@/lib/server/subscription-states";

export const dynamic = "force-dynamic";

export default async function TrialIntroPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId } });
  // An in-house or comped account should never see a trial screen.
  if (!sub || sub.complimentary) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#14121f] px-4 py-10 text-white">
      <div className="w-full max-w-lg">
        <div className="flex items-center justify-center gap-2.5">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-xl bg-white object-contain p-0.5" />
          <p className="text-base font-semibold">Sendloom</p>
        </div>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-8">
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-b from-[#8b5cf6] to-[#6d28d9] text-sm">✓</span>
            <h1 className="text-xl font-semibold">Your free trial is live</h1>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            No payment details are needed today. You have full access for three days, and seven days
            in total once you have chosen a plan.
          </p>

          <ol className="mt-6 space-y-4">
            {[
              { k: "Today", t: "Start using SendLoom immediately. No payment details required." },
              {
                k: "Day 3",
                t: `Choose your plan and verify your payment method for £0${sub.trialStageOneEndsAt ? ` by ${formatBillingMoment(sub.trialStageOneEndsAt)}` : ""}.`,
              },
              {
                k: "Day 7",
                t: `Your subscription begins${sub.trialEndsAt ? ` on ${formatBillingMoment(sub.trialEndsAt)}` : ""} unless cancelled beforehand.`,
              },
            ].map((s, i) => (
              <li key={s.k} className="flex gap-3">
                <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold ${i === 0 ? "bg-gradient-to-b from-[#8b5cf6] to-[#6d28d9]" : "border border-white/25 text-white/60"}`}>
                  {i + 1}
                </span>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-white/45">{s.k}</p>
                  <p className="mt-0.5 text-sm text-white/85">{s.t}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-8 flex flex-col gap-2.5">
            <Link
              href="/onboarding/business"
              className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-6 py-3 text-center text-sm font-semibold text-white transition hover:from-[#6d28d9] hover:to-[#4c1d95]"
            >
              Start using SendLoom
            </Link>
            <Link href="/billing/plans" className="text-center text-xs font-medium text-white/60 hover:text-white">
              View subscription options
            </Link>
          </div>
        </div>

        <p className="mt-5 text-center text-[11px] leading-relaxed text-white/40">
          Card details are handled by our payment provider and never reach SendLoom&apos;s servers.
        </p>
      </div>
    </div>
  );
}
