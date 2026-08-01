// Plan selection for a signed-in account. This is the day-three gate, the
// upgrade destination and the change-plan screen, all the same page.

import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/server/permissions";
import { db } from "@/lib/server/db";
import { PlanCards } from "@/components/billing/plan-cards";
import { formatBillingMoment } from "@/lib/server/subscription-states";

export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const user = await currentUser();
  if (!user) redirect("/pricing");

  const sub = await db.subscription.findUnique({ where: { workspaceId: user.workspaceId } });
  // Nothing to sell to an in-house account.
  if (sub?.complimentary) redirect("/settings/billing");

  const gate = sub?.status === "trial_action_required";
  const ends = sub?.trialEndsAt;

  return (
    <div className="min-h-screen bg-[#faf9f7]">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-lg bg-white object-contain p-0.5 ring-1 ring-line" />
            <span className="text-sm font-semibold">Sendloom</span>
          </Link>
          <Link href="/settings/billing" className="text-xs font-medium text-ink-3 hover:text-brand">Manage billing</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-10">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {gate ? "Continue your free trial" : "Choose your SendLoom plan"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Choose your SendLoom plan and securely verify your payment method.{" "}
            <strong className="font-semibold">You will not be charged today.</strong>{" "}
            Your first monthly payment will be taken automatically when your seven-day free trial ends
            {ends ? ` on ${formatBillingMoment(ends)}` : ""}.
          </p>
          {gate && (
            <p className="mx-auto mt-4 max-w-lg rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-900">
              Your first three days are complete. Choose a plan to carry on through the rest of your free
              trial. Everything you have built is saved and waiting.
            </p>
          )}
        </div>

        <div className="mt-9">
          <PlanCards signedIn />
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-[11px] leading-relaxed text-ink-3">
          Card details are handled entirely by our payment provider and never reach SendLoom&apos;s servers.
          You can change plan or cancel at any time from your billing settings.
        </p>
      </main>
    </div>
  );
}
