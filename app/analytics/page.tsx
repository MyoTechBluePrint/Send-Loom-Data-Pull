import { Shell, GhostButton } from "@/components/shell";
import { Donut } from "@/components/ui";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { Card, CardHeader, Stat, RevenueChart, HBarChart, Th, Td } from "@/components/ui";
import { automations, campaigns, gbp, num, revenueSeries } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const wsId = await demoWorkspaceId();
  const scores = await db.leadScore.findMany({ where: { contact: { workspaceId: wsId } }, select: { score: true } });
  const consents = await db.contact.findMany({
    where: { workspaceId: wsId },
    select: { phone: true, consents: { where: { channel: "email" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const contactability = {
    granted: consents.filter((c) => c.consents[0]?.status === "granted").length,
    pending: consents.filter((c) => !c.consents[0] || c.consents[0].status === "pending").length,
    unsub: consents.filter((c) => c.consents[0]?.status === "withdrawn").length,
    suppressed: consents.filter((c) => c.consents[0]?.status === "suppressed").length,
  };
  const sourceRows = await db.contactSource.findMany({
    where: { contact: { workspaceId: wsId } },
    include: { contact: { select: { email: true, phone: true, revenue: true, ordersCount: true } } },
  });
  const bySrc = new Map<string, { n: number; email: number; phone: number; revenue: number; buyers: number }>();
  for (const s of sourceRows) {
    const b = bySrc.get(s.sourceType) ?? { n: 0, email: 0, phone: 0, revenue: 0, buyers: 0 };
    b.n++; if (s.contact.email) b.email++; if (s.contact.phone) b.phone++;
    b.revenue += s.contact.revenue; if (s.contact.ordersCount > 0) b.buyers++;
    bySrc.set(s.sourceType, b);
  }
  const sourceScores = [...bySrc.entries()].map(([type, b]) => {
    const score = Math.min(100, Math.round(
      (b.email / b.n) * 35 + (b.phone / b.n) * 20 + (b.buyers / b.n) * 30 + Math.min(15, b.revenue / 200)
    ));
    return { type, ...b, score };
  }).sort((a, b) => b.score - a.score);
  const buckets = [
    { label: "0-24 · cold/suppressed", value: scores.filter((s) => s.score <= 24).length },
    { label: "25-44 · warm", value: scores.filter((s) => s.score >= 25 && s.score <= 44).length },
    { label: "45-59 · hot", value: scores.filter((s) => s.score >= 45 && s.score <= 59).length },
    { label: "60-79 · ready/customer", value: scores.filter((s) => s.score >= 60 && s.score <= 79).length },
    { label: "80-100 · best", value: scores.filter((s) => s.score >= 80).length },
  ];
  const byForm = [
    { label: "Longevity Type quiz", value: 14360 },
    { label: "Welcome offer popup", value: 9840 },
    { label: "Metabolic Reset guide", value: 6120 },
    { label: "Exit intent · 10% off", value: 3480 },
    { label: "Footer form", value: 1210 },
  ];
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

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Contactability" subtitle="Live from consent records · latest email-channel state per contact" />
          <div className="px-5 py-4">
            <Donut
              centreLabel="contacts"
              items={[
                { label: "Email allowed", value: contactability.granted, color: "var(--s2)" },
                { label: "Needs permission", value: contactability.pending, color: "var(--s3)" },
                { label: "Unsubscribed", value: contactability.unsub, color: "#c3c2b7" },
                { label: "Suppressed", value: contactability.suppressed, color: "var(--s6, #e34948)" },
              ]}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title="Source scores" subtitle="Live · coverage, buyers and revenue per source type" />
          <div className="space-y-2.5 px-5 py-4">
            {sourceScores.slice(0, 6).map((s) => (
              <div key={s.type} className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium capitalize">{s.type.replace(/_/g, " ")}</p>
                  <p className="text-[11px] text-ink-3">{s.n} contacts · {Math.round((s.email / s.n) * 100)}% email · {Math.round((s.phone / s.n) * 100)}% phone · {s.buyers} buyers</p>
                </div>
                <span className={`tabular shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${s.score >= 70 ? "bg-emerald-50 text-emerald-700" : s.score >= 45 ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-600"}`}>
                  {s.score}/100
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Lead score distribution" subtitle={`Live from the scoring engine · ${scores.length} scored contacts`} />
          <div className="px-5 py-4">
            <HBarChart items={buckets} format={num} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              Recomputed on every event. The 60+ bands are the audience your next campaign should start with.
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Revenue by form / lead magnet" subtitle="Attributed to the capture point each contact came from · seeded demo" />
          <div className="px-5 py-4">
            <HBarChart items={byForm} format={gbp} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              Quiz-sourced contacts out-earn every other capture route in the demo data.
            </p>
          </div>
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
