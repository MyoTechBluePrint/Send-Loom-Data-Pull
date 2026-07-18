import Link from "next/link";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, CardHeader, Stat, Badge, RevenueChart, HBarChart, Th, Td } from "@/components/ui";
import { campaigns, gbp, num, revenueSeries, topAutomationsByRevenue } from "@/lib/data";
import { db } from "@/lib/server/db";
import { demoWorkspaceId, getAuditView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

const kindIcon: Record<string, string> = { paste: "⌘V", whatsapp: "◎", email: "✉", note: "✎", file: "⇪", form: "▤", api: "↯" };

export default async function Dashboard() {
  const wsId = await demoWorkspaceId();
  const ninetyDays = new Date(Date.now() - 90 * 24 * 3600 * 1000);

  const [contacts, hotLeads, openTasks, pendingRecords, intakeFeed, winbackCount, pendingConsent, audit] = await Promise.all([
    db.contact.count({ where: { workspaceId: wsId } }),
    db.leadScore.count({ where: { score: { gte: 70 }, contact: { workspaceId: wsId, ordersCount: 0 } } }),
    db.salesTask.count({ where: { workspaceId: wsId, status: "open" } }),
    db.extractedRecord.count({ where: { status: "pending", intake: { workspaceId: wsId } } }),
    db.intakeItem.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 4, include: { records: true } }),
    db.contact.count({ where: { workspaceId: wsId, ordersCount: { gt: 0 }, lastOrderAt: { lt: ninetyDays } } }),
    db.consentRecord.groupBy({ by: ["contactId"], where: { channel: "email", status: "pending", contact: { workspaceId: wsId } } }),
    getAuditView(),
  ]);

  const importTotals = await db.importBatch.aggregate({
    where: { workspaceId: wsId },
    _sum: { totalRows: true, readyRows: true },
  });

  const actions = [
    {
      title: pendingRecords > 0 ? `Review ${pendingRecords} extracted record${pendingRecords === 1 ? "" : "s"} in the Universal Inbox` : "Paste or forward new leads into the Universal Inbox",
      detail: pendingRecords > 0 ? "Approvals create contacts with sources, tags and tasks in one click." : "Messy WhatsApp messages and notes become structured contacts on approval.",
      basis: "Based on: intake queue (live)", confidence: "High", href: "/inbox", cta: pendingRecords > 0 ? "Review queue" : "Open inbox",
    },
    {
      title: `Follow up ${hotLeads} hot lead${hotLeads === 1 ? "" : "s"} without a purchase`,
      detail: `${openTasks} sales tasks are open. Highest scores first; the consultation flow converts at 22.4%.`,
      basis: "Based on: lead scores + open tasks (live)", confidence: "High", href: "/tasks", cta: "Open tasks",
    },
    {
      title: "Build a 'menopause support' collection page",
      detail: "512 on-site searches in 30 days returned zero results. Estimated £4k+/month of missed demand.",
      basis: "Based on: site-search log (seeded demo)", confidence: "Medium", href: "/demand", cta: "See the gap",
    },
    {
      title: `Win back ${winbackCount} customer${winbackCount === 1 ? "" : "s"} inactive 90+ days`,
      detail: "The win-back automation is paused. Resume it or launch a one-off reactivation campaign.",
      basis: "Based on: order recency (live)", confidence: "Medium", href: "/automations", cta: "Open automations",
    },
  ];

  return (
    <Shell
      title="Dashboard"
      subtitle="Turn messy data, customer behaviour and market demand into revenue"
      actions={
        <>
          <GhostButton>Last 30 days ▾</GhostButton>
          <Link href="/campaigns/new"><PrimaryButton>Create campaign</PrimaryButton></Link>
        </>
      }
    >
      {/* Growth snapshot */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Stat label="Attributed revenue" value={gbp(48219)} delta="↑ 14.2%" />
        <Stat label="Contacts in database" value={num(contacts)} delta="live" hint="from imports, inbox, store" />
        <Link href="/subscribers">
          <Card className="h-full px-5 py-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-3">Hot leads (no purchase yet)</p>
            <p className="tabular mt-1.5 text-2xl font-semibold text-orange-600">{hotLeads}</p>
            <p className="mt-1 text-xs text-ink-3">score 70+ · {openTasks} sales tasks open</p>
          </Card>
        </Link>
        <Link href="/inbox">
          <Card className="h-full px-5 py-4 transition-shadow hover:shadow-md">
            <p className="text-xs font-medium text-ink-3">Awaiting review</p>
            <p className="tabular mt-1.5 text-2xl font-semibold">{pendingRecords + pendingConsent.length}</p>
            <p className="mt-1 text-xs text-ink-3">{pendingRecords} inbox records · {pendingConsent.length} consent-pending contacts</p>
          </Card>
        </Link>
      </div>

      {/* Start here (first visit) */}
      <Card className="mt-4 border-brand bg-brand-soft/30">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">Start here</p>
          {[
            ["Review intake", "/inbox"],
            ["Try Paste Anything", "/inbox"],
            ["Open hot leads", "/subscribers"],
            ["Create a test audience", "/segments"],
            ["Check Demand Radar", "/demand"],
            ["Complete a sales task", "/tasks"],
            ["Leave feedback", "/feedback"],
          ].map(([label, href]) => (
            <Link key={label} href={href} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink-2 shadow-sm hover:text-brand">
              {label} →
            </Link>
          ))}
        </div>
      </Card>

      {/* Next best actions */}
      <Card className="mt-4">
        <CardHeader title="Next best actions" subtitle="Every suggestion states its basis and links to the work · live counts where marked" />
        <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 xl:grid-cols-4">
          {actions.map((s) => (
            <div key={s.title} className="flex flex-col rounded-lg border border-line px-4 py-3.5">
              <p className="text-[13px] font-semibold leading-snug">{s.title}</p>
              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-ink-2">{s.detail}</p>
              <p className="mt-2 text-[10px] font-medium text-ink-3">{s.basis} · confidence: {s.confidence}</p>
              <Link href={s.href} className="mt-2.5 rounded-lg bg-brand-soft px-3 py-1.5 text-center text-xs font-bold text-brand hover:bg-[#ece2fa]">
                {s.cta} →
              </Link>
            </div>
          ))}
        </div>
      </Card>

      {/* Intake feed + revenue */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Attributed revenue by week" subtitle="Campaigns vs automations · seeded demo series" />
          <div className="px-5 py-4">
            <RevenueChart weeks={revenueSeries.weeks} a={revenueSeries.campaigns} b={revenueSeries.automations} labels={["Campaigns", "Automations"]} />
            <div className="mt-2 flex gap-5 text-xs text-ink-2">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s1)" }} /> Campaigns · {gbp(82841)}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: "var(--s2)" }} /> Automations · {gbp(113620)}</span>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader
            title="Data intake feed"
            subtitle="Latest arrivals, live"
            action={<Link href="/inbox" className="text-xs font-semibold text-brand hover:underline">Open inbox →</Link>}
          />
          <ul className="divide-y divide-line">
            {intakeFeed.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-[#f0efec] text-[10px] font-bold text-ink-2">{kindIcon[i.kind] ?? "⇪"}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{i.title}</p>
                    <p className="text-[11px] text-ink-3">{i.records.length} record{i.records.length === 1 ? "" : "s"} · confidence {i.confidence}%</p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${
                  i.status === "approved" ? "bg-emerald-50 text-emerald-700" : i.status === "rejected" ? "bg-zinc-100 text-zinc-500" : "bg-amber-50 text-amber-700"
                }`}>{i.status}</span>
              </li>
            ))}
            {intakeFeed.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-3">No intake yet · paste something in the Universal Inbox.</li>}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
            Imports so far: {num(importTotals._sum.totalRows ?? 0)} rows · {num(importTotals._sum.readyRows ?? 0)} ready ·{" "}
            <Link href="/imports" className="font-semibold text-brand hover:underline">Data Uploads →</Link>
          </p>
        </Card>
      </div>

      {/* Demand + revenue intelligence + activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader title="Demand radar" subtitle="Seeded demo signals" action={<Link href="/demand" className="text-xs font-semibold text-brand hover:underline">Open →</Link>} />
          <ul className="space-y-2.5 px-5 py-4 text-[13px]">
            <li className="flex justify-between gap-3"><span>Fastest riser</span><span className="font-semibold text-emerald-700">GLP-1 support ↑96%</span></li>
            <li className="flex justify-between gap-3"><span>Top opportunity</span><span className="font-semibold">NAD+ / longevity (86)</span></li>
            <li className="flex justify-between gap-3"><span>Missed demand</span><span className="font-semibold text-amber-700">"menopause support"</span></li>
            <li className="flex justify-between gap-3"><span>Regional spike</span><span className="font-semibold">London & SE · 34%</span></li>
          </ul>
        </Card>
        <Card>
          <CardHeader title="Top automations" subtitle="By attributed revenue · seeded demo" />
          <div className="px-5 py-4">
            <HBarChart items={topAutomationsByRevenue.slice(0, 4)} format={gbp} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Activity" subtitle="Live audit log" />
          <ul className="divide-y divide-line">
            {audit.slice(0, 5).map((n, i) => (
              <li key={i} className="px-5 py-2.5">
                <p className="text-[13px] leading-snug">{n.what}</p>
                <p className="mt-0.5 text-[11px] text-ink-3">{n.time} · {n.who}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Recent campaigns (demo) */}
      <Card className="mt-4">
        <CardHeader
          title="Recent campaigns"
          subtitle="Performance figures are seeded demo data until sending ships"
          action={<Link href="/campaigns" className="text-xs font-semibold text-brand hover:underline">View all →</Link>}
        />
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[620px]">
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
            {campaigns.slice(0, 3).map((c) => (
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
        </table></div>
      </Card>
    </Shell>
  );
}
