"use client";

import { useState } from "react";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { gbp, num, type Keyword, type Opportunity, type SiteSearch } from "@/lib/data";

const tabs = ["Keyword intent", "Demand radar", "Site search", "Opportunities"] as const;

const reviewChip: Record<string, string> = {
  approved: "bg-emerald-50 text-emerald-700",
  "needs review": "bg-amber-50 text-amber-700",
  restricted: "bg-red-50 text-red-700",
  "internal only": "bg-zinc-200 text-zinc-700",
};

const intentChip: Record<string, string> = {
  buyer: "bg-emerald-50 text-emerald-700",
  research: "bg-blue-50 text-blue-700",
  question: "bg-amber-50 text-amber-700",
};

export function DemandClient({ keywords, opportunities, siteSearches, sectorMode }: { keywords: Keyword[]; opportunities: Opportunity[]; siteSearches: SiteSearch[]; sectorMode: string }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Keyword intent");
  const [watch, setWatch] = useState("");

  const rising = [...keywords].sort((a, b) => b.trend - a.trend).slice(0, 5);
  const clusters = Array.from(new Set(keywords.map((k) => k.cluster)));

  return (
    <Shell
      title="Demand Radar"
      subtitle={`Market and first-party intent · providers: Search Console, DataForSEO, site search · sector mode: ${sectorMode}`}
      actions={
        <>
          <GhostButton>Manage providers</GhostButton>
          <PrimaryButton>Add keywords</PrimaryButton>
        </>
      }
    >
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              tab === t ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-[#f0efec]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Keyword intent" && (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              value={watch}
              onChange={(e) => setWatch(e.target.value)}
              placeholder="Add a keyword to monitor, e.g. 'NAD+ supplement'…"
              className="w-full max-w-96 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-brand"
            />
            <span className="text-xs text-ink-3">{keywords.length} monitored · volumes and CPC from keyword provider · refreshed daily</span>
          </div>
          <Card>
            <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[860px]">
              <thead className="border-b border-line">
                <tr>
                  <Th>Keyword</Th>
                  <Th>Cluster</Th>
                  <Th className="text-right">Monthly volume</Th>
                  <Th className="text-right">Trend (90d)</Th>
                  <Th className="text-right">CPC</Th>
                  <Th className="text-right">SEO difficulty</Th>
                  <Th>Intent</Th>
                  <Th className="text-right">Sector review</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keywords.map((k) => (
                  <tr key={k.term} className="hover:bg-[#fafaf8]">
                    <Td className="font-medium">{k.term}</Td>
                    <Td className="text-xs text-ink-2">{k.cluster}</Td>
                    <Td className="tabular text-right">{num(k.volume)}</Td>
                    <Td className={`tabular text-right font-semibold ${k.trend >= 40 ? "text-emerald-700" : k.trend >= 0 ? "text-ink-2" : "text-red-700"}`}>
                      {k.trend >= 0 ? "↑" : "↓"} {Math.abs(k.trend)}%
                    </Td>
                    <Td className="tabular text-right">{k.cpc}</Td>
                    <Td className="tabular text-right">{k.seo}</Td>
                    <Td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${intentChip[k.intent]}`}>{k.intent}</span></Td>
                    <Td className="text-right"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${reviewChip[k.review]}`}>{k.review}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            <p className="border-t border-line px-4 py-3 text-xs text-ink-3">
              Sector mode gates usage: <span className="font-semibold">restricted</span> keywords cannot be used in campaigns or ad exports; <span className="font-semibold">internal only</span> keywords power segmentation and analytics but never public content; <span className="font-semibold">needs review</span> requires approval before campaign use.
            </p>
          </Card>
        </>
      )}

      {tab === "Demand radar" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="Rising demand" subtitle="Fastest-growing monitored keywords, 90 days" />
            <div className="space-y-3 px-5 py-4">
              {rising.map((k) => (
                <div key={k.term}>
                  <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-ink-2">{k.term} <span className="text-ink-3">· {k.cluster}</span></span>
                    <span className="tabular shrink-0 whitespace-nowrap font-semibold text-emerald-700">↑ {k.trend}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#f0efec]">
                    <div className="h-2 rounded-full bg-[#1baf7a]" style={{ width: `${k.trend}%` }} />
                  </div>
                </div>
              ))}
              <p className="border-t border-line pt-3 text-xs text-ink-3">Falling: "detox tea" ↓ 22% · "juice cleanse" ↓ 18% (not monitored, market-wide signal)</p>
            </div>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader title="Topic clusters" />
              <ul className="divide-y divide-line">
                {clusters.map((c) => {
                  const ks = keywords.filter((k) => k.cluster === c);
                  const avg = Math.round(ks.reduce((s, k) => s + k.trend, 0) / ks.length);
                  return (
                    <li key={c} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                      <span className="font-medium">{c}</span>
                      <span className={`tabular text-xs font-semibold ${avg >= 30 ? "text-emerald-700" : "text-ink-2"}`}>↑ {avg}% avg</span>
                    </li>
                  );
                })}
              </ul>
            </Card>
            <Card>
              <CardHeader title="Buyer questions" subtitle="From question-intent queries" />
              <ul className="space-y-2 px-5 py-4 text-[13px] text-ink-2">
                <li>"Does NAD+ actually work for energy?"</li>
                <li>"How long does collagen take to show results?"</li>
                <li>"What supplements support GLP-1 medication?" <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">restricted</span></li>
                <li>"Best magnesium for deep sleep?"</li>
              </ul>
            </Card>
            <Card>
              <CardHeader title="Regional demand" />
              <div className="space-y-2.5 px-5 py-4">
                {[["London & SE", "34%"], ["North West", "18%"], ["Scotland", "12%"], ["Midlands", "11%"], ["Other UK & IE", "25%"]].map(([r, v]) => (
                  <div key={r}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="font-medium text-ink-2">{r}</span>
                      <span className="tabular font-semibold">{v}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[#f0efec]">
                      <div className="h-1.5 rounded-full bg-[#2a78d6]" style={{ width: v }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === "Site search" && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="On-site search terms" subtitle="What visitors search on vitaliswellness.co.uk · consented visitors attach to their timeline, anonymous stays aggregate" />
            <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[860px]">
              <thead className="border-b border-line">
                <tr>
                  <Th>Term</Th>
                  <Th className="text-right">Searches (30d)</Th>
                  <Th className="text-right">Trend</Th>
                  <Th className="text-right">Conversion</Th>
                  <Th className="text-right">Revenue</Th>
                  <Th>Flag</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {siteSearches.map((s) => (
                  <tr key={s.term} className="hover:bg-[#fafaf8]">
                    <Td><code className="text-[13px] font-semibold">{s.term}</code></Td>
                    <Td className="tabular text-right">{num(s.searches)}</Td>
                    <Td className={`tabular text-right font-semibold ${s.trend >= 40 ? "text-emerald-700" : "text-ink-2"}`}>↑ {s.trend}%</Td>
                    <Td className="tabular text-right">{s.conversion > 0 ? `${s.conversion}%` : "–"}</Td>
                    <Td className="tabular text-right font-semibold">{s.revenue > 0 ? gbp(s.revenue) : "–"}</Td>
                    <Td>
                      {s.note ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.note.includes("missed") || s.note.includes("Missed") || s.note.includes("No") ? "bg-amber-50 text-amber-700" : "bg-zinc-200 text-zinc-700"}`}>{s.note}</span>
                      ) : (
                        <span className="text-xs text-ink-3">–</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </Card>
          <Card className="self-start">
            <CardHeader title="Missed demand" subtitle="Searches with no matching product or page" />
            <div className="space-y-3 px-5 py-4">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">"menopause support" · 512 searches</p>
                <p className="mt-1 text-xs text-amber-800">Zero results shown. At category-average conversion this is roughly {gbp(4100)}/month of missed demand.</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                <p className="text-sm font-semibold text-amber-900">"creatine gummies" · 388 searches</p>
                <p className="mt-1 text-xs text-amber-800">No results. Rising 91% quarter on quarter.</p>
              </div>
              <p className="text-xs text-ink-3">Both flagged in Opportunities with suggested actions.</p>
            </div>
          </Card>
        </div>
      )}

      {tab === "Opportunities" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {opportunities.map((o) => (
            <Card key={o.cluster} className="px-5 py-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold">{o.cluster}</h2>
                  <p className="mt-0.5 text-xs text-ink-3">{o.demand}</p>
                </div>
                <div className="text-right">
                  <p className={`tabular text-2xl font-semibold ${o.score >= 70 ? "text-emerald-700" : "text-ink-2"}`}>{o.score}</p>
                  <p className="text-[10px] font-medium uppercase tracking-wide text-ink-3">Opportunity</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700">Have</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-ink-2">
                    {o.have.map((h) => <li key={h}>✓ {h}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700">Missing</p>
                  <ul className="mt-1.5 space-y-1 text-xs text-ink-2">
                    {o.missing.map((m) => <li key={m}>○ {m}</li>)}
                  </ul>
                </div>
              </div>
              <div className="mt-3 flex gap-2 border-t border-line pt-3">
                <button className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-semibold text-brand hover:bg-[#ece2fa]">Create campaign</button>
                <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">Brief content</button>
                <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">Build audience</button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}
