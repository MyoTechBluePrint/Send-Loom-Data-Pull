import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, GhostButton } from "@/components/shell";
import { Card, CardHeader, Stat, Badge, HBarChart, Th, Td } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export default async function CampaignReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.campaign.findUnique({
    where: { id },
    include: { sends: { include: { contact: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!c) notFound();

  const delivered = c.isDemo ? Math.round(c.audienceSnapshot * 0.984) : c.sends.filter((s) => s.status === "sent").length;
  const opened = c.isDemo ? Math.round(delivered * (c.openRate / 100)) : c.sends.filter((s) => s.openedAt).length;
  const clicked = c.isDemo ? Math.round(delivered * (c.clickRate / 100)) : c.sends.filter((s) => s.clickedAt).length;

  const funnel = [
    { label: "Delivered", value: delivered },
    { label: "Opened", value: opened },
    { label: "Clicked", value: clicked },
  ];

  return (
    <Shell
      title={c.name}
      subtitle={`${c.subject ? `“${c.subject}” · ` : ""}${c.audienceRef ?? "All contacts"}${c.sentAt ? ` · ${c.sentAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}`}
      actions={<GhostButton>Duplicate</GhostButton>}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/campaigns" className="text-xs font-semibold text-brand hover:underline">← All campaigns</Link>
        <Badge value={c.status} />
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${c.isDemo ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"}`}>
          {c.isDemo ? "Seeded demo data" : "Real sends"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Recipients" value={num(c.audienceSnapshot)} />
        <Stat label="Delivered" value={num(delivered)} />
        <Stat label="Open rate" value={delivered ? `${((opened / delivered) * 100).toFixed(1)}%` : "–"} />
        <Stat label="Click rate" value={delivered ? `${((clicked / delivered) * 100).toFixed(1)}%` : "–"} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Funnel" subtitle={c.isDemo ? "Seeded demo figures" : "Live from send records · opens and clicks feed lead scores"} />
          <div className="px-5 py-4">
            <HBarChart items={funnel} format={num} />
            {c.revenue > 0 && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">Attributed revenue: <span className="tabular font-semibold text-foreground">{gbp(c.revenue)}</span></p>
            )}
          </div>
        </Card>
        <Card>
          <CardHeader title={c.isDemo ? "About this campaign" : "Recipients"} subtitle={c.isDemo ? undefined : `${c.sends.length} send records`} />
          {c.isDemo ? (
            <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-2">
              This campaign's performance figures are seeded demo data from before real sending shipped. New campaigns sent from the platform show live per-recipient delivery, open and click records here instead.
            </p>
          ) : (
            <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[520px]">
              <thead className="border-b border-line">
                <tr>
                  <Th>Contact</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Opened</Th>
                  <Th className="text-right">Clicked</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {c.sends.slice(0, 20).map((s) => (
                  <tr key={s.id}>
                    <Td>
                      <Link href={`/subscribers/${s.contactId}`} className="text-[13px] font-medium hover:text-brand">
                        {[s.contact.firstName, s.contact.lastName].filter(Boolean).join(" ") || s.contact.email || s.contact.phone}
                      </Link>
                    </Td>
                    <Td><Badge value={s.status === "sent" ? "sent" : s.status === "failed" ? "suppressed" : "pending"} label={s.status} /></Td>
                    <Td className="tabular text-right text-xs">{s.openedAt ? "✓" : "–"}</Td>
                    <Td className="tabular text-right text-xs">{s.clickedAt ? "✓" : "–"}</Td>
                  </tr>
                ))}
                {c.sends.length === 0 && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-ink-3">Not sent yet.</td></tr>
                )}
              </tbody>
            </table></div>
          )}
        </Card>
      </div>
    </Shell>
  );
}
