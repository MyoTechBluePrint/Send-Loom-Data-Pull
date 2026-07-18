"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Badge, Stat } from "@/components/ui";
import { gbp, subscribers, timelineFor } from "@/lib/data";

const eventStyle: Record<string, { icon: string; bg: string }> = {
  signup: { icon: "✚", bg: "bg-violet-100 text-violet-700" },
  view: { icon: "👁", bg: "bg-zinc-100 text-zinc-600" },
  cart: { icon: "🛒", bg: "bg-amber-100 text-amber-700" },
  checkout: { icon: "⇥", bg: "bg-blue-100 text-blue-700" },
  purchase: { icon: "£", bg: "bg-emerald-100 text-emerald-700" },
  email_open: { icon: "✉", bg: "bg-blue-100 text-blue-700" },
  email_click: { icon: "↗", bg: "bg-blue-100 text-blue-700" },
  email_sent: { icon: "➤", bg: "bg-zinc-100 text-zinc-600" },
  automation: { icon: "⌁", bg: "bg-violet-100 text-violet-700" },
};

export default function SubscriberProfile() {
  const { id } = useParams<{ id: string }>();
  const sub = subscribers.find((s) => s.id === id) ?? subscribers[0];
  const events = timelineFor(sub.id);

  return (
    <Shell
      title={sub.name}
      subtitle={sub.email}
      actions={
        <>
          <GhostButton>Suppress</GhostButton>
          <GhostButton>Export data (GDPR)</GhostButton>
          <PrimaryButton>Send email</PrimaryButton>
        </>
      }
    >
      <Link href="/subscribers" className="text-xs font-semibold text-brand hover:underline">← All subscribers</Link>

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Lifetime value" value={sub.revenue > 0 ? gbp(sub.revenue) : "£0"} />
        <Stat label="Orders" value={String(sub.orders)} />
        <Stat label="Average order value" value={sub.aov > 0 ? gbp(sub.aov) : "–"} />
        <Stat label="Last order" value={sub.lastOrder} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader title="Timeline" subtitle="Every touchpoint, store and email, in one stream" />
          <ol className="px-5 py-4">
            {events.map((e, i) => {
              const st = eventStyle[e.type];
              return (
                <li key={i} className="relative flex gap-4 pb-6 last:pb-2">
                  {i < events.length - 1 && <span className="absolute left-[15px] top-8 h-full w-px bg-line" />}
                  <span className={`z-[1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${st.bg}`}>
                    {st.icon}
                  </span>
                  <div className="min-w-0 pt-0.5">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <p className="text-sm font-semibold">{e.title}</p>
                      {e.value && <span className="tabular text-sm font-semibold text-emerald-700">{e.value}</span>}
                      <span className="text-[11px] text-ink-3">{e.time}</span>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ink-2">{e.detail}</p>
                  </div>
                </li>
              );
            })}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Profile" />
            <dl className="space-y-3 px-5 py-4 text-sm">
              {[
                ["Consent", <Badge key="c" value={sub.consent} />],
                ["Phone", sub.phone ?? "–"],
                ["Location", sub.location],
                ["Source", sub.source],
                ["Signed up", sub.signup],
                ["Engagement", <span key="e" className="capitalize">{sub.engagement}</span>],
              ].map(([k, v], i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                  <dt className="text-xs font-medium text-ink-3">{k as string}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
          <Card>
            <CardHeader title="Lists & tags" />
            <div className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Lists</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {sub.lists.length ? sub.lists.map((l) => (
                  <span key={l} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">{l}</span>
                )) : <span className="text-xs text-ink-3">None</span>}
              </div>
              <p className="mt-4 text-xs font-medium text-ink-3">Tags</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {sub.tags.length ? sub.tags.map((t) => (
                  <span key={t} className="rounded-full bg-[#f0efec] px-2.5 py-1 text-xs font-medium text-ink-2">{t}</span>
                )) : <span className="text-xs text-ink-3">None</span>}
              </div>
            </div>
          </Card>
          <Card>
            <CardHeader title="Consent record" subtitle="GDPR audit trail" />
            <div className="px-5 py-4 text-[13px] text-ink-2">
              <p>Marketing consent granted via <span className="font-medium text-foreground">{sub.source}</span> on {sub.signup}.</p>
              <p className="mt-2 text-xs text-ink-3">IP, timestamp and form snapshot stored. Double opt-in {sub.consent === "pending" ? "awaiting confirmation" : "confirmed"}.</p>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
