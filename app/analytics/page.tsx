import { Shell, GhostButton } from "@/components/shell";
import { Card, CardHeader, Stat, RevenueChart, HBarChart, Th, Td } from "@/components/ui";
import { automations, campaigns, gbp, num, revenueSeries } from "@/lib/data";

export default function AnalyticsPage() {
  const bySegment = [
    { label: "VIP customers", value: 386420 },
    { label: "Weight-management intent", value: 48120 },
    { label: "Quiz: Metabolic type", value: 22040 },
    { label: "Everyone else", value: 152840 },
  ];
  const bySource = [
    { label: "WooCommerce checkout opt-in", value: 122400 },
    { label: "Klaviyo legacy list", value: 64110 },
    { label: "Meta lead forms", value: 18420 },
    { label: "Quiz funnel", value: 14360 },
    { label: "FitLab partner referrals", value: 8240 },
    { label: "Webinar lists", value: 2210 },
  ];
  const byKeyword = [
    { label: "nad+ (site search)", value: 9120 },
    { label: "collagen (site search)", value: 6240 },
    { label: "sleep (site search)", value: 3980 },
    { label: "recovery (site search)", value: 2210 },
  ];
  const topEmails = [...campaigns]
    .filter((c) => c.status === "sent")
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  return (
    <Shell
      title="Analytics"
      subtitle="Revenue attribution across campaigns, automations and segments"
      actions={
        <>
          <GhostButton>Last 90 days ▾</GhostButton>
          <GhostButton>Export</GhostButton>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Email-attributed revenue" value={gbp(196461)} delta="↑ 18.4%" hint="vs previous 90 days" />
        <Stat label="Share of store revenue" value="23.7%" delta="↑ 2.1pts" hint="vs previous 90 days" />
        <Stat label="Customer lifetime value" value={gbp(214)} delta="↑ 6.0%" hint="subscribers vs non" />
        <Stat label="Repeat purchase rate" value="31.8%" delta="↑ 3.4pts" hint="email audience" />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Attributed revenue by week" subtitle="5-day click attribution window · campaigns vs automations" />
          <div className="px-5 py-4">
            <RevenueChart weeks={revenueSeries.weeks} a={revenueSeries.campaigns} b={revenueSeries.automations} labels={["Campaigns", "Automations"]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue by segment" subtitle="Attributed, last 90 days" />
          <div className="px-5 py-4">
            <HBarChart items={bySegment} format={gbp} />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Revenue by data source" subtitle="Orders joined back to the source each contact arrived from · the commercial heart of the source ledger" />
          <div className="px-5 py-4">
            <HBarChart items={bySource} format={gbp} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              Cost-aware view: Meta leads cost £2.10 each and return £4.84 · FitLab referrals are revenue-share · the blocked purchased list produced £0.
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue by keyword interest" subtitle="First-party search terms that led to purchases" />
          <div className="px-5 py-4">
            <HBarChart items={byKeyword} format={gbp} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              Site-search revenue attribution uses same-session and 5-day windows. Restricted-class terms report in aggregate only.
            </p>
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top performing emails" subtitle="By attributed revenue" />
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[520px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Email</Th>
                <Th className="text-right">Opens</Th>
                <Th className="text-right">Clicks</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {topEmails.map((c) => (
                <tr key={c.id}>
                  <Td>
                    <p className="font-medium">{c.name}</p>
                    <p className="text-xs text-ink-3">{c.sentAt}</p>
                  </Td>
                  <Td className="tabular text-right">{c.openRate}%</Td>
                  <Td className="tabular text-right">{c.clickRate}%</Td>
                  <Td className="tabular text-right font-semibold">{gbp(c.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
        <Card>
          <CardHeader title="Automation performance" subtitle="All time" />
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[520px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Flow</Th>
                <Th className="text-right">Entered</Th>
                <Th className="text-right">Conv.</Th>
                <Th className="text-right">Revenue</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {automations.map((a) => (
                <tr key={a.id}>
                  <Td className="font-medium">{a.name}</Td>
                  <Td className="tabular text-right">{num(a.entered)}</Td>
                  <Td className="tabular text-right">{a.conversion}%</Td>
                  <Td className="tabular text-right font-semibold">{gbp(a.revenue)}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { title: "Devices", rows: [["Mobile", "64%"], ["Desktop", "30%"], ["Tablet", "6%"]] },
          { title: "Email clients", rows: [["Apple Mail", "41%"], ["Gmail", "36%"], ["Outlook", "14%"], ["Other", "9%"]] },
          { title: "Countries", rows: [["United Kingdom", "88%"], ["Ireland", "6%"], ["United States", "3%"], ["Other", "3%"]] },
        ].map((b) => (
          <Card key={b.title}>
            <CardHeader title={b.title} />
            <div className="space-y-2.5 px-5 py-4">
              {b.rows.map(([k, v]) => (
                <div key={k}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="font-medium text-ink-2">{k}</span>
                    <span className="tabular font-semibold">{v}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-[#f0efec]">
                    <div className="h-1.5 rounded-full bg-[#2a78d6]" style={{ width: v }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </Shell>
  );
}
