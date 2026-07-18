import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Badge, Stat } from "@/components/ui";
import { gbp } from "@/lib/data";
import { getContactView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

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
  search: { icon: "⌕", bg: "bg-amber-100 text-amber-700" },
  import: { icon: "⇪", bg: "bg-zinc-100 text-zinc-600" },
  enrich: { icon: "✦", bg: "bg-violet-100 text-violet-700" },
  task: { icon: "☑", bg: "bg-emerald-100 text-emerald-700" },
  score: { icon: "∆", bg: "bg-violet-100 text-violet-700" },
};

const statusChip: Record<string, string> = {
  cold: "bg-zinc-100 text-zinc-600",
  warm: "bg-amber-50 text-amber-700",
  hot: "bg-orange-100 text-orange-700",
  ready: "bg-emerald-50 text-emerald-700",
  customer: "bg-blue-50 text-blue-700",
  VIP: "bg-violet-100 text-violet-700",
  suppressed: "bg-red-50 text-red-700",
};

function whyMatters(sub: { status: string; consent: string; source: string; tags: string[]; revenue: number; orders: number; score: number; channels: { email: boolean } }): string {
  const bits: string[] = [];
  if (sub.status === "VIP") bits.push(`Top-tier customer: ${sub.orders} orders, ${"£" + Math.round(sub.revenue).toLocaleString("en-GB")} lifetime`);
  else if (sub.orders > 1) bits.push(`Repeat buyer (${sub.orders} orders)`);
  else if (sub.orders === 1) bits.push("Bought once, prime for a second purchase");
  else if (sub.score >= 60) bits.push(`High-intent lead (score ${sub.score}) with no purchase yet`);
  if (sub.tags.length) bits.push(`interests: ${sub.tags.slice(0, 3).join(", ")}`);
  bits.push(`came in via ${sub.source.toLowerCase()}`);
  if (!sub.channels.email) bits.push("no email permission, best next step is a manual call");
  else if (sub.consent === "pending") bits.push("email consent still pending, hold marketing");
  return bits.join(" · ").replace(/^./, (c) => c.toUpperCase()) + ".";
}

function nextAction(status: string, consent: string): string {
  if (status === "suppressed") return "Do not contact. Suppression is enforced at send time across all channels.";
  if (status === "VIP") return "Invite to VIP early access for the Sleep Series launch (scheduled 21 Jul).";
  if (status === "ready") return "High score without a purchase: create a sales task or send the consultation booking link.";
  if (status === "hot") return "Riding recent engagement: include in the next product campaign for their interest cluster.";
  if (consent === "pending") return "Awaiting double opt-in. No marketing until confirmed; a single reminder is permitted.";
  return "Keep in nurture flows; re-score after next engagement.";
}

export default async function ContactProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getContactView(id);
  if (!view) notFound();
  const { contact: sub, events, enrichments, openTasks } = view;

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
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/subscribers" className="text-xs font-semibold text-brand hover:underline">← All contacts</Link>
        <Badge value={sub.consent} />
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${statusChip[sub.status]}`}>{sub.status.toUpperCase()}</span>
        {openTasks.length > 0 && (
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700">
            {openTasks.length} open task{openTasks.length > 1 ? "s" : ""}: {openTasks[0].type}
          </span>
        )}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-3">Lead score</p>
          <div className="mt-1.5 flex items-baseline gap-2">
            <p className="tabular text-2xl font-semibold tracking-tight">{sub.score}</p>
            <span className="text-xs text-ink-3">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-[#f0efec]">
            <div className="h-1.5 rounded-full" style={{ width: `${sub.score}%`, background: sub.score >= 70 ? "var(--s2)" : sub.score >= 40 ? "var(--s3)" : "#c3c2b7" }} />
          </div>
        </Card>
        <Stat label="Lifetime value" value={sub.revenue > 0 ? gbp(sub.revenue) : "£0"} />
        <Stat label="Orders" value={String(sub.orders)} />
        <Stat label="Data confidence" value={`${sub.confidence} / 100`} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-brand bg-brand-soft/40 px-5 py-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-brand">Why this contact matters</p>
          <p className="mt-1 text-sm">{whyMatters(sub)}</p>
        </Card>
        <Card className="px-5 py-3.5">
          <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Suggested next action</p>
          <p className="mt-1 text-sm">{nextAction(sub.status, sub.consent)}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Timeline" subtitle="Live from the events table · imports, consent, behaviour, scores and tasks" />
          <ol className="px-5 py-4">
            {events.map((e, i) => {
              const st = eventStyle[e.type] ?? eventStyle.view;
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
                    {e.detail && <p className="mt-0.5 text-[13px] text-ink-2">{e.detail}</p>}
                  </div>
                </li>
              );
            })}
            {events.length === 0 && <li className="py-6 text-center text-sm text-ink-3">No events yet. Activity appears here as it happens.</li>}
          </ol>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="Why this score" subtitle="Computed by the scoring engine from stored events" />
            <ul className="divide-y divide-line">
              {sub.scoreReasons.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-5 py-2.5 text-[13px]">
                  <span>{r.reason}</span>
                  <span className={`tabular shrink-0 font-bold ${r.points >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {r.points >= 0 ? "+" : ""}{r.points}
                  </span>
                </li>
              ))}
              {sub.scoreReasons.length === 0 && <li className="px-5 py-4 text-sm text-ink-3">No scoring signals yet.</li>}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Source ledger" subtitle="Provenance and permissions" />
            <dl className="space-y-2.5 px-5 py-4 text-[13px]">
              {[
                ["Original source", sub.source],
                ["Lawful basis", sub.lawfulBasis],
                ["Signed up", sub.signup],
                ["Location", sub.location || "–"],
                ["Phone", sub.phone ?? "–"],
              ].map(([k, v]) => (
                <div key={k as string} className="flex justify-between gap-4">
                  <dt className="shrink-0 text-xs font-medium text-ink-3">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
              <div className="border-t border-line pt-2.5">
                <dt className="text-xs font-medium text-ink-3">Channels permitted</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {(
                    [["Email", sub.channels.email], ["SMS", sub.channels.sms], ["WhatsApp", sub.channels.whatsapp], ["Phone", sub.channels.phone], ["Ad export", sub.channels.adExport]] as [string, boolean][]
                  ).map(([c, on]) => (
                    <span key={c} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-[#f0efec] text-ink-3 line-through"}`}>{c}</span>
                  ))}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <CardHeader title="Tags & enrichment" />
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-1.5">
                {sub.tags.map((t) => (
                  <span key={t} className="rounded-full bg-[#f0efec] px-2.5 py-1 text-xs font-medium text-ink-2">{t}</span>
                ))}
                {sub.tags.length === 0 && <span className="text-xs text-ink-3">None</span>}
              </div>
              {enrichments.length > 0 ? (
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  {enrichments.map((e, i) => (
                    <div key={i} className="rounded-lg bg-[#fafaf8] px-3 py-2.5">
                      <p className="text-xs font-semibold">✦ {e.provider}</p>
                      <p className="mt-0.5 text-[11px] text-ink-2">{e.fields} · confidence {e.confidence}% · {e.when} · {e.cost}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 border-t border-line pt-3 text-xs text-ink-3">No enrichment run for this contact.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
