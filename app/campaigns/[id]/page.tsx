"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Shell, GhostButton } from "@/components/shell";
import { Card, CardHeader, Stat, Badge, HBarChart } from "@/components/ui";
import { campaigns, gbp, num } from "@/lib/data";

export default function CampaignReport() {
  const { id } = useParams<{ id: string }>();
  const c = campaigns.find((x) => x.id === id) ?? campaigns[0];
  const delivered = Math.round(c.recipients * 0.984);
  const opens = Math.round(delivered * (c.openRate / 100));
  const clicks = Math.round(delivered * (c.clickRate / 100));
  const orders = Math.max(1, Math.round(clicks * 0.11));

  const funnel = [
    { label: "Delivered", value: delivered },
    { label: "Opened", value: opens },
    { label: "Clicked", value: clicks },
    { label: "Purchased", value: orders },
  ];

  const links = [
    { label: "/products/nad-cellular-complex", value: Math.round(clicks * 0.46) },
    { label: "Hero product block", value: Math.round(clicks * 0.27) },
    { label: "Recommended products", value: Math.round(clicks * 0.17) },
    { label: "Footer / other", value: Math.round(clicks * 0.1) },
  ];

  return (
    <Shell
      title={c.name}
      subtitle={`“${c.subject}” · ${c.audience} · ${c.sentAt}`}
      actions={
        <>
          <GhostButton>Duplicate</GhostButton>
          <GhostButton>Export report</GhostButton>
        </>
      }
    >
      <div className="flex items-center gap-3">
        <Link href="/campaigns" className="text-xs font-semibold text-brand hover:underline">← All campaigns</Link>
        <Badge value={c.status} />
        {c.abTest && <span className="text-xs font-medium text-brand">A/B: {c.abTest}</span>}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Attributed revenue" value={gbp(c.revenue)} delta={`${orders} orders`} hint="within 5-day window" />
        <Stat label="Open rate" value={`${c.openRate}%`} delta="↑ 3.1pts" hint="vs account average" />
        <Stat label="Click rate" value={`${c.clickRate}%`} delta="↑ 0.9pts" hint="vs account average" />
        <Stat label="Unsubscribes" value="0.21%" delta="34 contacts" deltaGood={false} hint="· 2 complaints" />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Conversion funnel" subtitle={`${num(c.recipients)} recipients · 98.4% delivered`} />
          <div className="px-5 py-4">
            <HBarChart items={funnel} format={num} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              CTOR {c.openRate > 0 ? ((c.clickRate / c.openRate) * 100).toFixed(1) : "0"}% · conversion {((orders / delivered) * 100).toFixed(2)}% · AOV {gbp(c.revenue / orders)}
            </p>
          </div>
        </Card>
        <Card>
          <CardHeader title="Clicks by link" subtitle="Where recipients clicked inside the email" />
          <div className="px-5 py-4">
            <HBarChart items={links} format={num} />
            <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
              Top devices: mobile 68% · desktop 27% · tablet 5%. Top clients: Apple Mail, Gmail, Outlook.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Attributed orders" subtitle="Orders placed within 5 days of a click on this campaign" />
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              {["Order", "Customer", "Items", "Placed", "Total"].map((h) => (
                <th key={h} className={`px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-3 ${h === "Total" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-sm">
            {[
              ["#42901", "Emma Richardson", "NAD+ Cellular Complex ×2, Deep Sleep Magnesium", "16 Jul, 10:12", 214.0],
              ["#42897", "Grace Adeyemi", "Longevity Stack bundle", "16 Jul, 09:48", 149.0],
              ["#42894", "Sofia Marchetti", "Deep Sleep Magnesium ×2", "16 Jul, 09:31", 96.5],
              ["#42890", "Marcus Delaney", "Recovery Complex, Marine Collagen", "16 Jul, 09:20", 185.0],
            ].map((r, i) => (
              <tr key={i} className="hover:bg-[#fafaf8]">
                <td className="px-4 py-3 font-medium text-brand">{r[0]}</td>
                <td className="px-4 py-3">{r[1]}</td>
                <td className="px-4 py-3 text-ink-2">{r[2]}</td>
                <td className="px-4 py-3 text-xs text-ink-2">{r[3]}</td>
                <td className="tabular px-4 py-3 text-right font-semibold">{gbp(r[4] as number)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
