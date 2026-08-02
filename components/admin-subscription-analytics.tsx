"use client";

// Commercial analytics. Complimentary and enterprise accounts are excluded
// from every rate, because counting the in-house workspaces as conversions
// would make the funnel read beautifully and mean nothing.

import { useEffect, useState } from "react";
import { Card, CardHeader, Stat } from "@/components/ui";

type Analytics = {
  ok: boolean;
  headline: {
    commercialAccounts: number; exemptAccounts: number; trialsStarted: number;
    dayThreeVerificationRate: number; daySevenConversionRate: number; overallConversionRate: number;
    mrrLabel: string; arrLabel: string; arpaLabel: string; collectedLabel: string;
    paymentFailures: number; paymentRecoveryRate: number; trialCancellations: number;
  };
  funnel: { stage: string; count: number; percentOfStart: number }[];
  byPlan: { key: string; name: string; selected: number; converted: number; mrrPence: number }[];
  cancellationReasons: { workspace: string; reason: string; status: string }[];
};

export function SubscriptionAnalytics() {
  const [a, setA] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/admin/subscriptions/analytics")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j?.ok && setA(j))
      .catch(() => {});
  }, []);

  if (!a) return <div className="h-32 animate-pulse rounded-xl border border-line bg-black/[0.02]" />;
  const h = a.headline;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={h.mrrLabel} hint={`${h.arrLabel} annualised`} />
        <Stat label="Average revenue per account" value={h.arpaLabel} hint={`${h.collectedLabel} collected to date`} />
        <Stat label="Trial to paid" value={`${h.overallConversionRate}%`} hint={`${h.trialsStarted} trials started`} />
        <Stat label="Payment recovery" value={`${h.paymentRecoveryRate}%`} hint={`${h.paymentFailures} failures`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Conversion funnel"
            subtitle={`${h.commercialAccounts} commercial accounts · ${h.exemptAccounts} complimentary or enterprise, excluded from every rate`}
          />
          <div className="space-y-2 px-5 py-4">
            {a.funnel.map((f) => (
              <div key={f.stage}>
                <div className="flex items-baseline justify-between text-[12px]">
                  <span className="text-ink-2">{f.stage}</span>
                  <span className="font-medium">{f.count.toLocaleString()} <span className="text-ink-3">({f.percentOfStart}%)</span></span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-[#f0efec]">
                  <div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9]" style={{ width: `${Math.max(1, f.percentOfStart)}%` }} />
                </div>
              </div>
            ))}
            {h.commercialAccounts === 0 && (
              <p className="pt-2 text-[12px] text-ink-3">
                No commercial accounts yet. Every workspace on this instance is complimentary, so there is
                nothing to convert. The funnel fills as real signups arrive.
              </p>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Key rates" subtitle="Where trials are actually lost" />
          <dl className="space-y-2.5 px-5 py-4 text-[13px]">
            <Line label="Day 3 payment verification" value={`${h.dayThreeVerificationRate}%`} />
            <Line label="Day 7 paid conversion" value={`${h.daySevenConversionRate}%`} />
            <Line label="Trial cancellations" value={String(h.trialCancellations)} />
            <Line label="Payment failures" value={String(h.paymentFailures)} />
          </dl>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Conversion by plan" subtitle="Which plan people choose, and who pays" />
          <div className="px-5 py-4">
            {a.byPlan.length === 0 ? (
              <p className="text-[13px] text-ink-3">No plans selected yet.</p>
            ) : (
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line text-[11px] uppercase tracking-wide text-ink-3">
                  <tr><th className="py-1.5 font-semibold">Plan</th><th className="py-1.5 font-semibold">Selected</th><th className="py-1.5 font-semibold">Converted</th><th className="py-1.5 font-semibold">MRR</th></tr>
                </thead>
                <tbody>
                  {a.byPlan.map((p) => (
                    <tr key={p.key} className="border-b border-line/60 last:border-0">
                      <td className="py-2">{p.name}</td>
                      <td className="py-2">{p.selected}</td>
                      <td className="py-2">{p.converted}</td>
                      <td className="py-2 font-medium">£{(p.mrrPence / 100).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Why people cancel" subtitle="Verbatim, from the cancellation flow" />
          <div className="px-5 py-4">
            {a.cancellationReasons.length === 0 ? (
              <p className="text-[13px] text-ink-3">No cancellations recorded.</p>
            ) : (
              <ul className="space-y-2">
                {a.cancellationReasons.map((c, i) => (
                  <li key={i} className="rounded-lg border border-line bg-[#faf9f7] px-3 py-2">
                    <p className="text-[13px] text-ink-2">{c.reason}</p>
                    <p className="mt-0.5 text-[11px] text-ink-3">{c.workspace} · {c.status}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
