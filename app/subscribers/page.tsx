"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, Badge, Th, Td } from "@/components/ui";
import { gbp, num, subscribers } from "@/lib/data";

const filters = ["All", "Subscribed", "Pending", "Unsubscribed", "Suppressed"] as const;

export default function SubscribersPage() {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const rows = useMemo(
    () =>
      subscribers.filter((s) => {
        const matchesQ =
          !q ||
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.email.toLowerCase().includes(q.toLowerCase()) ||
          s.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()));
        const matchesF = filter === "All" || s.consent === filter.toLowerCase();
        return matchesQ && matchesF;
      }),
    [q, filter]
  );

  return (
    <Shell
      title="Contacts"
      subtitle={`${num(24817)} contacts · 94.1% deliverable · every record source-tagged`}
      actions={
        <>
          <GhostButton>Import CSV</GhostButton>
          <GhostButton>Export</GhostButton>
          <PrimaryButton>Add subscriber</PrimaryButton>
        </>
      }
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email or tag…"
          className="w-full max-w-80 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-brand"
        />
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-[#f0efec]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <Card>
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[900px]">
          <thead className="border-b border-line">
            <tr>
              <Th>Contact</Th>
              <Th>Consent</Th>
              <Th className="text-right">Score</Th>
              <Th>Tags</Th>
              <Th>Source</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Lifetime value</Th>
              <Th className="text-right">Last activity</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-[#fafaf8]">
                <Td>
                  <Link href={`/subscribers/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link>
                  <p className="text-xs text-ink-3">{s.email}</p>
                </Td>
                <Td><Badge value={s.consent} /></Td>
                <Td className="text-right">
                  <span className={`tabular inline-block min-w-8 rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${
                    s.score >= 70 ? "bg-emerald-50 text-emerald-700" : s.score >= 40 ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"
                  }`}>{s.score}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {s.tags.length === 0 && <span className="text-xs text-ink-3">–</span>}
                    {s.tags.map((t) => (
                      <span key={t} className="rounded-full bg-[#f0efec] px-2 py-0.5 text-[11px] font-medium text-ink-2">{t}</span>
                    ))}
                  </div>
                </Td>
                <Td className="text-xs text-ink-2">{s.source}</Td>
                <Td className="tabular text-right">{s.orders}</Td>
                <Td className="tabular text-right font-semibold">{s.revenue > 0 ? gbp(s.revenue) : "–"}</Td>
                <Td className="text-right text-xs text-ink-2">{s.lastActivity}</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-ink-3">No contacts match.</td>
              </tr>
            )}
          </tbody>
        </table></div>
        <div className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-ink-3">
          <span>Showing {rows.length} of {num(24817)} contacts</span>
          <span>Bulk actions: tag · add to list · suppress · delete (GDPR erasure)</span>
        </div>
      </Card>
    </Shell>
  );
}
