import Link from "next/link";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, CardHeader, Stat, Badge, RevenueChart, HBarChart, Th, Td } from "@/components/ui";
import { aiSuggestions, automations, campaigns, dataQuality, gbp, notifications, num, revenueSeries, store, topAutomationsByRevenue } from "@/lib/data";

export default function Dashboard() {
  const totalAutoRevenue = automations.reduce((s, a) => s + a.revenue, 0);
  return (
    <Shell
      title="Dashboard"
      subtitle={`${store.name} · last 30 days`}
      actions={
        <>
          <GhostButton>Last 30 days ▾</GhostButton>
          <PrimaryButton>Create campaign</PrimaryButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Attributed revenue" value={gbp(48219)} delta="↑ 14.2%" />
        <Stat label="Emails delivered" value={num(96417)} delta="↑ 8.1%" />
        <Stat label="Recovered carts" value="523" delta="↑ 22.7%" />
        <Stat label="New subscribers" value={num(2189)} delta="↑ 5.9%" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Link href="/subscribers">
          <Card className="h-full px-5 py-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-3">Hot leads ready for follow-up</p>
            <p className="tabular mt-1.5 text-2xl font-semibold text-orange-600">37</p>
            <p className="mt-1 text-xs text-ink-3">score 70+ without a purchase · 6 sales tasks open</p>
          </Card>
        </Link>
        <Link href="/imports">
          <Card className="h-full px-5 py-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-3">Imported this month</p>
            <p className="tabular mt-1.5 text-2xl font-semibold">{num(17640)}</p>
            <p className="mt-1 text-xs text-ink-3">92% passed quality review · 1 batch blocked</p>
          </Card>
        </Link>
        <Link href="/demand">
          <Card className="h-full px-5 py-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-3">Fastest-rising keyword</p>
            <p className="mt-1.5 truncate text-lg font-semibold">GLP-1 support supplement</p>
            <p className="mt-1 text-xs text-[#006300]">↑ 96% in 90 days · needs sector review</p>
          </Card>
        </Link>
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-3">Data quality</p>
          <p className="tabular mt-1.5 text-2xl font-semibold">{dataQuality.score} / 100</p>
          <p className="mt-1 text-xs text-ink-3">{num(dataQuality.ready)} ready · {num(dataQuality.needsReview)} need review</p>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Growth assistant" subtitle="Suggestions grounded in your own data · every suggestion states its basis" />
        <div className="grid grid-cols-2 gap-4 px-5 py-4 xl:grid-cols-4">
          {aiSuggestions.map((s) => (
            <div key={s.title} className="flex flex-col rounded-lg border border-line px-4 py-3.5">
              <p className="text-[13px] font-semibold leading-snug">{s.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-2">{s.detail}</p>
              <p className="mt-2 border-t border-line pt-2 text-[10px] font-medium text-ink-3">{s.basis}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader title="Attributed revenue by week" subtitle="Orders placed within 5 days of an email click" />
          <div className="px-5 py-4">
            <RevenueChart weeks={revenueSeries.weeks} a={revenueSeries.campaigns} b={revenueSeries.automations} labels={["Campaigns", "Automations"]} />
            <div className="mt-2 flex gap-5 text-xs text-ink-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s1)" }} /> Campaigns · {gbp(82841)}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s2)" }} /> Automations · {gbp(113620)}</span>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Top automations" subtitle="By attributed revenue, all time" />
          <div className="px-5 py-4">
            <HBarChart items={topAutomationsByRevenue.slice(0, 5)} format={gbp} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              {automations.filter((a) => a.status === "live").length} live automations · {gbp(totalAutoRevenue)} total attributed
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <Card className="col-span-2">
          <CardHeader
            title="Recent campaigns"
            action={<Link href="/campaigns" className="text-xs font-semibold text-brand hover:underline">View all →</Link>}
          />
          <table className="w-full">
            <thead className="border-b border-line">
              <tr>
                <Th>Campaign</Th>
                <Th>Status</Th>
                <Th className="text-right">Open rate</Th>
                <Th className="text-right">Click rate</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {campaigns.slice(0, 4).map((c) => (
                <tr key={c.id} className="hover:bg-[#fafaf8]">
                  <Td>
                    <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link>
                    <p className="text-xs text-ink-3">{c.audience} · {num(c.recipients)} recipients</p>
                  </Td>
                  <Td><Badge value={c.status} /></Td>
                  <Td className="tabular text-right">{c.status === "sent" ? `${c.openRate}%` : "–"}</Td>
                  <Td className="tabular text-right">{c.status === "sent" ? `${c.clickRate}%` : "–"}</Td>
                  <Td className="tabular text-right font-semibold">{c.status === "sent" ? gbp(c.revenue) : "–"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
        <Card>
          <CardHeader title="Activity" subtitle="Platform notifications" />
          <ul className="divide-y divide-line">
            {notifications.map((n, i) => (
              <li key={i} className="flex gap-3 px-5 py-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                  style={{ background: n.level === "good" ? "var(--good)" : n.level === "warn" ? "#eda100" : "#c3c2b7" }}
                />
                <div>
                  <p className="text-[13px] leading-snug">{n.text}</p>
                  <p className="mt-0.5 text-[11px] text-ink-3">{n.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-4">
        {[
          { label: "Store sync", value: `${num(store.syncedOrders)} orders · ${num(store.syncedProducts)} products`, sub: `Last event 2 min ago · webhooks healthy` },
          { label: "Deliverability", value: "96 / 100 reputation", sub: "SPF, DKIM and DMARC all passing" },
          { label: "List health", value: "94.1% deliverable", sub: "612 suppressed · 3 complaints this month" },
          { label: "Plan usage", value: "96k of 150k sends", sub: "Professional plan · renews 1 Aug" },
        ].map((s) => (
          <Card key={s.label} className="px-5 py-4">
            <p className="text-xs font-medium text-ink-3">{s.label}</p>
            <p className="mt-1 text-sm font-semibold">{s.value}</p>
            <p className="mt-0.5 text-xs text-ink-3">{s.sub}</p>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
