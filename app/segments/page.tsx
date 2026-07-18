"use client";

import { useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { gbp, num, segments, type Condition } from "@/lib/data";

const fieldOptions = [
  "Total spend", "Order count", "Last order", "Purchased product", "Purchased category",
  "Email engagement", "Coupon usage", "Consent", "Country", "Cart abandoned", "Viewed product",
];
const operatorOptions = ["is", "is not", "is greater than", "is less than", "is at least", "is exactly", "is more than", "opened in last", "used on"];

export default function SegmentsPage() {
  const [building, setBuilding] = useState(false);
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "Last order", operator: "is more than", value: "60 days ago" },
    { field: "Total spend", operator: "is greater than", value: "£200" },
  ]);

  const estimate = Math.max(120, Math.round(2300 - conditions.length * 640 + (match === "any" ? 1800 : 0)));

  return (
    <Shell
      title="Segments"
      subtitle="Dynamic audiences that update in real time as store events arrive"
      actions={<PrimaryButton>New segment</PrimaryButton>}
    >
      {!building ? (
        <>
          <div className="mb-4">
            <button onClick={() => setBuilding(true)} className="rounded-lg border border-dashed border-brand bg-brand-soft px-4 py-2.5 text-[13px] font-semibold text-brand hover:bg-[#ece2fa]">
              + Build a segment
            </button>
          </div>
          <Card>
            <table className="w-full">
              <thead className="border-b border-line">
                <tr>
                  <Th>Segment</Th>
                  <Th>Conditions</Th>
                  <Th className="text-right">Contacts</Th>
                  <Th className="text-right">Attributed revenue</Th>
                  <Th className="text-right">Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {segments.map((s) => (
                  <tr key={s.id} className="hover:bg-[#fafaf8]">
                    <Td>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-ink-3">{s.description}</p>
                    </Td>
                    <Td>
                      <div className="space-y-1">
                        {s.conditions.map((c, i) => (
                          <p key={i} className="text-xs text-ink-2">
                            {i > 0 && <span className="mr-1 font-semibold text-brand">{s.match === "all" ? "AND" : "OR"}</span>}
                            {c.field} <span className="text-ink-3">{c.operator}</span> <span className="font-medium">{c.value}</span>
                          </p>
                        ))}
                      </div>
                    </Td>
                    <Td className="tabular text-right font-semibold">{num(s.count)}</Td>
                    <Td className="tabular text-right">{s.revenue > 0 ? gbp(s.revenue) : "–"}</Td>
                    <Td className="text-right text-xs text-emerald-700">● Live</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2">
            <CardHeader title="New segment" subtitle="Contacts matching these rules enter and leave automatically" />
            <div className="px-5 py-5">
              <div className="flex items-center gap-2 text-sm">
                <span>Include contacts matching</span>
                <div className="flex rounded-lg border border-line p-0.5">
                  {(["all", "any"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMatch(m)}
                      className={`rounded-md px-3 py-1 text-xs font-semibold ${match === m ? "bg-brand text-white" : "text-ink-2"}`}
                    >
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <span>of the following:</span>
              </div>

              <div className="mt-4 space-y-2.5">
                {conditions.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {i > 0 && <span className="w-10 text-center text-[11px] font-bold text-brand">{match === "all" ? "AND" : "OR"}</span>}
                    {i === 0 && <span className="w-10 text-center text-[11px] font-semibold text-ink-3">WHERE</span>}
                    <select
                      value={c.field}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))}
                      className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] font-medium outline-none focus:border-brand"
                    >
                      {fieldOptions.map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <select
                      value={c.operator}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))}
                      className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink-2 outline-none focus:border-brand"
                    >
                      {operatorOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    <input
                      value={c.value}
                      onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))}
                      className="flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-brand"
                    />
                    <button
                      onClick={() => setConditions(conditions.filter((_, j) => j !== i))}
                      className="rounded-lg px-2 py-1.5 text-ink-3 hover:bg-[#f0efec] hover:text-[#d03b3b]"
                      aria-label="Remove condition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setConditions([...conditions, { field: "Purchased category", operator: "is", value: "Home Fragrance" }])}
                className="mt-4 text-[13px] font-semibold text-brand hover:underline"
              >
                + Add condition
              </button>

              <div className="mt-6 flex gap-2 border-t border-line pt-4">
                <PrimaryButton>Save segment</PrimaryButton>
                <button onClick={() => setBuilding(false)} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">
                  Cancel
                </button>
              </div>
            </div>
          </Card>
          <Card className="self-start">
            <CardHeader title="Live estimate" />
            <div className="px-5 py-5">
              <p className="tabular text-3xl font-semibold tracking-tight">{num(estimate)}</p>
              <p className="mt-1 text-xs text-ink-3">contacts currently match ({((estimate / 18432) * 100).toFixed(1)}% of audience)</p>
              <div className="mt-4 h-2 w-full rounded-full bg-[#f0efec]">
                <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.min(100, (estimate / 18432) * 100 * 4)}%` }} />
              </div>
              <p className="mt-5 text-xs leading-relaxed text-ink-2">
                Estimates re-run against synced WooCommerce data as you edit. Segments are usable in campaigns, automations and popup targeting.
              </p>
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}
