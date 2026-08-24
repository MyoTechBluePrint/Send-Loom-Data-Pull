import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, GhostButton } from "@/components/shell";
import { Card, CardHeader, Stat, Badge, HBarChart, Th, Td } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { db } from "@/lib/server/db";
import { audienceBreakdown } from "@/lib/server/sending";
import type { Channel } from "@/lib/server/consent";
import { CampaignEmailPanel } from "@/components/campaign-email-panel";
import { CampaignAudiencePanel } from "@/components/campaign-audience-panel";
import { SmartSendPanel } from "@/components/smart-send-panel";

export const dynamic = "force-dynamic";

export default async function CampaignReport({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await db.campaign.findUnique({
    where: { id },
    include: { sends: { include: { contact: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!c) notFound();

  // The picker's option list, and the name shown for the stored ref. The ref
  // can be a segment id or a legacy name; display resolves either, exactly
  // as resolveAudience does at send time.
  const segments = await db.segment.findMany({
    where: { workspaceId: c.workspaceId },
    select: { id: true, name: true, count: true },
    orderBy: { name: "asc" },
  });
  const audienceName =
    c.audienceType === "segment" && c.audienceRef
      ? segments.find((s) => s.id === c.audienceRef || s.name === c.audienceRef)?.name ?? c.audienceRef
      : c.audienceRef ?? "All contacts";

  // The audience arithmetic, from the same gate the send itself uses, so
  // what this page promises is exactly what a send would do. Unsent
  // campaigns show it as the answer to "who will this actually reach?";
  // sent ones keep their send records as the story.
  const breakdown =
    c.status === "sent" || c.isDemo
      ? null
      : await audienceBreakdown(c.workspaceId, c.audienceType, c.audienceRef, (c.channel ?? "email") as Channel);

  // Confirmed revenue, not modelled: an order counts only when this
  // campaign's recipient clicked and then ordered within seven days. Real
  // rows or nothing; demo campaigns keep their seeded figures, labelled.
  const clicked7d = c.sends.filter((s) => s.clickedAt);
  let attributedRevenue = 0;
  let attributedOrders = 0;
  if (!c.isDemo && clicked7d.length) {
    const orders = await db.order.findMany({
      where: { contactId: { in: clicked7d.map((s) => s.contactId) } },
      select: { contactId: true, total: true, placedAt: true },
    });
    for (const send of clicked7d) {
      for (const order of orders) {
        if (order.contactId !== send.contactId || !send.clickedAt) continue;
        const gap = order.placedAt.getTime() - send.clickedAt.getTime();
        if (gap >= 0 && gap <= 7 * 24 * 3600 * 1000) {
          attributedRevenue += order.total;
          attributedOrders += 1;
        }
      }
    }
  }

  const delivered = c.isDemo
    ? Math.round(c.audienceSnapshot * 0.984)
    : c.sends.filter((s) => ["sent", "delivered"].includes(s.status)).length;
  // Dev-transport rows, counted apart: a line in a log is not a delivery and
  // must never inflate the numbers a marketer reads.
  const simulated = c.isDemo ? 0 : c.sends.filter((s) => s.status === "simulated").length;
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
      subtitle={`${c.subject ? `“${c.subject}” · ` : ""}${audienceName}${c.sentAt ? ` · ${c.sentAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}` : ""}`}
      actions={<GhostButton>Duplicate</GhostButton>}
    >
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/campaigns" className="text-xs font-semibold text-brand hover:underline">← All campaigns</Link>
        <Badge value={c.status} />
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase ${c.isDemo ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"}`}>
          {c.isDemo ? "Seeded demo data" : "Real sends"}
        </span>
      </div>

      {/* The email design attached to this campaign, and every way to work
          with it. Hidden for legacy demo rows, which have no real content. */}
      <div className="mt-3">
        <CampaignEmailPanel campaignId={c.id} />
      </div>

      <SmartSendPanel campaignId={c.id} sent={c.status === "sent"} />

      {c.status === "draft" && (
        <CampaignAudiencePanel campaignId={c.id} audienceType={c.audienceType} audienceRef={c.audienceRef} segments={segments} />
      )}

      {breakdown && (
        <Card className="mt-3">
          <CardHeader
            title="Who this will reach"
            subtitle={`${c.channel === "sms" ? "SMS" : c.channel === "whatsapp" ? "WhatsApp" : "Email"} eligibility · enforced automatically at send time`}
          />
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-5 py-4 text-[13px]">
            <span><b className="tabular text-emerald-700">{num(breakdown.eligible)}</b> eligible</span>
            {breakdown.noConsent > 0 && <span><b className="tabular">{num(breakdown.noConsent)}</b> no recorded consent</span>}
            {breakdown.optedOut > 0 && <span><b className="tabular">{num(breakdown.optedOut)}</b> unsubscribed or declined</span>}
            {breakdown.suppressed > 0 && <span><b className="tabular">{num(breakdown.suppressed)}</b> suppressed</span>}
            {breakdown.noRoute > 0 && <span><b className="tabular">{num(breakdown.noRoute)}</b> missing contact details</span>}
            {breakdown.doNotContact > 0 && <span><b className="tabular text-red-600">{num(breakdown.doNotContact)}</b> do not contact</span>}
            <span className="text-ink-3">of {num(breakdown.total)} in the audience</span>
          </div>
        </Card>
      )}

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Recipients" value={num(c.audienceSnapshot)} />
        <Stat label="Delivered" value={num(delivered)} hint={simulated > 0 ? `${num(simulated)} simulated (no live provider)` : undefined} />
        <Stat label="Open rate" value={delivered ? `${((opened / delivered) * 100).toFixed(1)}%` : "–"} />
        <Stat label="Click rate" value={delivered ? `${((clicked / delivered) * 100).toFixed(1)}%` : "–"} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Funnel" subtitle={c.isDemo ? "Seeded demo figures" : "Live from send records · opens and clicks feed lead scores"} />
          <div className="px-5 py-4">
            <HBarChart items={funnel} format={num} />
            {c.isDemo && c.revenue > 0 && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">Attributed revenue: <span className="tabular font-semibold text-foreground">{gbp(c.revenue)}</span> <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500">seeded demo</span></p>
            )}
            {!c.isDemo && (
              <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">
                Confirmed revenue: <span className="tabular font-semibold text-foreground">{gbp(attributedRevenue)}</span>
                {attributedOrders > 0 && <span> · {attributedOrders} order{attributedOrders === 1 ? "" : "s"}</span>}
                <span className="ml-1.5 text-[11px]">click-attributed · 7-day window · real store orders only</span>
              </p>
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
