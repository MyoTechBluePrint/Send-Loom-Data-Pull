import Link from "next/link";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, Badge, Th, Td } from "@/components/ui";
import { campaigns, gbp, num } from "@/lib/data";

export default function CampaignsPage() {
  return (
    <Shell
      title="Campaigns"
      subtitle="One-off sends to your audience, segments or lists"
      actions={
        <>
          <GhostButton>Templates</GhostButton>
          <Link href="/campaigns/new"><PrimaryButton>Create campaign</PrimaryButton></Link>
        </>
      }
    >
      <Card>
        <table className="w-full">
          <thead className="border-b border-line">
            <tr>
              <Th>Campaign</Th>
              <Th>Status</Th>
              <Th>Audience</Th>
              <Th className="text-right">Recipients</Th>
              <Th className="text-right">Opens</Th>
              <Th className="text-right">Clicks</Th>
              <Th className="text-right">Revenue</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-[#fafaf8]">
                <Td>
                  <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link>
                  <p className="text-xs text-ink-3">“{c.subject}” · {c.sentAt}</p>
                  {c.abTest && <p className="mt-0.5 text-[11px] font-medium text-brand">A/B: {c.abTest}</p>}
                </Td>
                <Td><Badge value={c.status} /></Td>
                <Td className="text-xs text-ink-2">{c.audience}</Td>
                <Td className="tabular text-right">{num(c.recipients)}</Td>
                <Td className="tabular text-right">{c.status === "sent" ? `${c.openRate}%` : "–"}</Td>
                <Td className="tabular text-right">{c.status === "sent" ? `${c.clickRate}%` : "–"}</Td>
                <Td className="tabular text-right font-semibold">{c.status === "sent" ? gbp(c.revenue) : "–"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Shell>
  );
}
