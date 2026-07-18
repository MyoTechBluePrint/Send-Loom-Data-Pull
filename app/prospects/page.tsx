"use client";

import { useMemo, useState } from "react";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { importBatches, num, prospects } from "@/lib/data";

const statusChip: Record<string, string> = {
  cold: "bg-zinc-100 text-zinc-600",
  warm: "bg-amber-50 text-amber-700",
  hot: "bg-orange-100 text-orange-700",
  ready: "bg-emerald-50 text-emerald-700",
};

const consentChip: Record<string, string> = {
  granted: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  missing: "bg-red-50 text-red-700",
};

const interests = ["All", "Weight management", "Longevity", "Sleep", "Recovery", "Metabolic health", "NAD+ / longevity"];

export default function ProspectsPage() {
  const [interest, setInterest] = useState("All");
  const [minScore, setMinScore] = useState(0);
  const [consentedOnly, setConsentedOnly] = useState(false);

  const rows = useMemo(
    () =>
      prospects.filter(
        (p) =>
          (interest === "All" || p.interest === interest) &&
          p.score >= minScore &&
          (!consentedOnly || p.consent === "granted")
      ),
    [interest, minScore, consentedOnly]
  );

  return (
    <Shell
      title="Prospect Discovery"
      subtitle="Not-yet-customers from every permitted source, filtered by intent, consent and contactability"
      actions={
        <>
          <GhostButton>Import prospects</GhostButton>
          <PrimaryButton>Create audience from filter</PrimaryButton>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={interest} onChange={(e) => setInterest(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium outline-none focus:border-brand">
          {interests.map((i) => <option key={i}>{i}</option>)}
        </select>
        <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
          <span className="text-xs font-medium text-ink-3">Min score</span>
          <input type="range" min={0} max={80} value={minScore} onChange={(e) => setMinScore(Number(e.target.value))} className="accent-[#6d28d9]" />
          <span className="tabular w-6 text-right text-xs font-bold">{minScore}</span>
        </div>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium">
          <input type="checkbox" checked={consentedOnly} onChange={(e) => setConsentedOnly(e.target.checked)} className="h-4 w-4 accent-[#6d28d9]" />
          Contactable only (consent granted)
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[900px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Prospect</Th>
                <Th>Source</Th>
                <Th>Interest</Th>
                <Th className="text-right">Score</Th>
                <Th>Status</Th>
                <Th>Consent</Th>
                <Th>Channels</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-[#fafaf8]">
                  <Td>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-ink-3">{p.email} · {p.location} · confidence {p.confidence}%</p>
                  </Td>
                  <Td className="text-xs text-ink-2">{p.source}</Td>
                  <Td className="text-xs text-ink-2">{p.interest}</Td>
                  <Td className="tabular text-right font-bold">{p.score}</Td>
                  <Td><span className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${statusChip[p.status]}`}>{p.status}</span></Td>
                  <Td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${consentChip[p.consent]}`}>{p.consent}</span></Td>
                  <Td className="text-xs text-ink-2">{p.channels}</Td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-ink-3">No prospects match this filter.</td></tr>
              )}
            </tbody>
          </table></div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-ink-3">
            <span>{rows.length} prospects shown · {num(5102)} total never-purchased contacts</span>
            <span>Actions: create audience · start automation · create sales tasks · export (where permitted)</span>
          </div>
        </Card>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="Prospect sources" subtitle="Where not-yet-customers come from" />
            <ul className="divide-y divide-line">
              {importBatches.filter((b) => b.status !== "blocked").slice(0, 5).map((b) => (
                <li key={b.id} className="flex items-center justify-between px-5 py-2.5 text-[13px]">
                  <span className="truncate pr-3 font-medium">{b.name}</span>
                  <span className="tabular shrink-0 text-xs text-ink-2">{num(b.ready)} ready</span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
              Blocked sources never appear here. The "purchased list" upload (5,000 rows, no consent trail) is quarantined.
            </p>
          </Card>
          <Card>
            <CardHeader title="Provider-ready" subtitle="Enrichment & discovery slots" />
            <div className="space-y-2 px-5 py-4 text-[13px]">
              {["Email verification (Hunter-style)", "B2B enrichment (Dropcontact-style, EU)", "Company data (Apollo-style)", "Licensed datasets (partner)"].map((p, i) => (
                <div key={p} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                  <span className="text-xs font-medium">{p}</span>
                  <span className={`text-[11px] font-semibold ${i < 2 ? "text-emerald-700" : "text-ink-3"}`}>{i < 2 ? "Connected" : "Available"}</span>
                </div>
              ))}
              <p className="pt-1 text-xs text-ink-3">Every enrichment is logged per record with provider, fields, confidence and cost.</p>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
