"use client";

// Audience builder backed by the real segment engine: estimates and saves hit
// /api/segments against actual contacts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { gbp, num, type Condition, type Segment } from "@/lib/data";

const fieldOptions = [
  "Total spend", "Order count", "Last order", "Country", "Tag", "Source",
  "Import batch", "Lead score", "Keyword searched", "Consent", "Engagement",
];
const operatorOptions = ["is", "is not", "is greater than", "is less than", "is at least", "is exactly", "is more than", "contains"];

type Estimate = { count: number; revenue: number; preview: { id: string; name: string; email: string; score: number }[] };

// Suggested plays per audience, matched on name. Rendered on the cards so
// every audience leads somewhere.
function playFor(name: string): { campaign: string; channel: string } {
  const n = name.toLowerCase();
  if (n.includes("vip")) return { campaign: "VIP early access · Sleep Series", channel: "Email" };
  if (n.includes("weight")) return { campaign: "Consultation push · metabolic", channel: "Email" };
  if (n.includes("consultation")) return { campaign: "Booking reminder + sales call", channel: "Email + phone" };
  if (n.includes("quiz")) return { campaign: "Metabolic education flow", channel: "Email" };
  if (n.includes("hot")) return { campaign: "Sales-task sprint + nurture", channel: "Phone first" };
  if (n.includes("risk") || n.includes("inactive")) return { campaign: "Win-back · 15% incentive", channel: "Email" };
  return { campaign: "One-off campaign", channel: "Email" };
}

export function SegmentsClient({ segments }: { segments: Segment[] }) {
  const router = useRouter();
  const [building, setBuilding] = useState(false);
  const [name, setName] = useState("High-value lapsed buyers");
  const [match, setMatch] = useState<"all" | "any">("all");
  const [conditions, setConditions] = useState<(Condition & { exclude?: boolean })[]>([
    { field: "Total spend", operator: "is greater than", value: "200" },
    { field: "Last order", operator: "is more than", value: "60" },
  ]);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!building) return;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch("/api/segments/estimate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ match, rules: conditions }),
        });
        const json = await res.json();
        if (json.ok) setEstimate(json);
      } finally {
        setBusy(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [building, match, conditions]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/segments", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, match, rules: conditions, description: "Saved from Audience builder" }),
      });
      const json = await res.json();
      if (json.ok) {
        setSaved(true);
        setBuilding(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell
      title="Audiences"
      subtitle="Dynamic audiences evaluated against the live contact database"
      actions={<PrimaryButton>New segment</PrimaryButton>}
    >
      {saved && !building && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Audience saved and computed against the contact database.
        </div>
      )}
      {!building ? (
        <>
          <div className="mb-4">
            <button onClick={() => { setBuilding(true); setSaved(false); }} className="rounded-lg border border-dashed border-brand bg-brand-soft px-4 py-2.5 text-[13px] font-semibold text-brand hover:bg-[#ece2fa]">
              + Build an audience
            </button>
          </div>
          <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {segments.map((s) => {
              const play = playFor(s.name);
              return (
                <Card key={s.id} className="flex flex-col px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{s.name}</h3>
                      <p className="mt-0.5 text-xs text-ink-3">{s.description}</p>
                    </div>
                    <span className="tabular shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">{num(s.count)}</span>
                  </div>
                  <div className="mt-3 grid flex-1 grid-cols-2 gap-3 border-t border-line pt-3 text-xs">
                    <div>
                      <p className="font-medium text-ink-3">Revenue so far</p>
                      <p className="tabular mt-0.5 text-sm font-semibold">{s.revenue > 0 ? gbp(s.revenue) : "–"}</p>
                    </div>
                    <div>
                      <p className="font-medium text-ink-3">Best channel</p>
                      <p className="mt-0.5 text-sm font-semibold">{play.channel}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="font-medium text-ink-3">Suggested play</p>
                      <p className="mt-0.5 text-[13px] font-semibold">{play.campaign}</p>
                    </div>
                  </div>
                  <Link href="/campaigns/new" className="mt-3 rounded-lg bg-brand-soft px-3 py-1.5 text-center text-xs font-bold text-brand hover:bg-[#ece2fa]">
                    Create campaign →
                  </Link>
                </Card>
              );
            })}
          </div>

          <Card>
            <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[760px]">
              <thead className="border-b border-line">
                <tr>
                  <Th>Audience</Th>
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
                            {c.field} <span className="text-ink-3">{c.operator}</span> <span className="font-medium">{c.value.length > 24 ? c.value.slice(0, 24) + "…" : c.value}</span>
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
            </table></div>
          </Card>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Card className="xl:col-span-2">
            <CardHeader title="New audience" subtitle="Rules are evaluated against real contacts as you edit" />
            <div className="px-5 py-5">
              <label className="block max-w-sm">
                <span className="text-xs font-medium text-ink-3">Audience name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-brand" />
              </label>

              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
                <span>Include contacts matching</span>
                <div className="flex rounded-lg border border-line p-0.5">
                  {(["all", "any"] as const).map((m) => (
                    <button key={m} onClick={() => setMatch(m)} className={`rounded-md px-3 py-1 text-xs font-semibold ${match === m ? "bg-brand text-white" : "text-ink-2"}`}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                </div>
                <span>of the following:</span>
              </div>

              <div className="mt-4 space-y-2.5">
                {conditions.map((c, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <span className="w-14 text-center text-[11px] font-bold text-brand">
                      {c.exclude ? "NOT" : i === 0 ? "WHERE" : match === "all" ? "AND" : "OR"}
                    </span>
                    <select value={c.field} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, field: e.target.value } : x)))} className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] font-medium outline-none focus:border-brand">
                      {fieldOptions.map((f) => <option key={f}>{f}</option>)}
                    </select>
                    <select value={c.operator} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))} className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink-2 outline-none focus:border-brand">
                      {operatorOptions.map((o) => <option key={o}>{o}</option>)}
                    </select>
                    <input value={c.value} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className="min-w-32 flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-brand" />
                    <button
                      onClick={() => setConditions(conditions.map((x, j) => (j === i ? { ...x, exclude: !x.exclude } : x)))}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-bold ${c.exclude ? "border-red-200 bg-red-50 text-red-700" : "border-line text-ink-3 hover:bg-[#f0efec]"}`}
                      title="Toggle exclusion"
                    >
                      NOT
                    </button>
                    <button onClick={() => setConditions(conditions.filter((_, j) => j !== i))} className="rounded-lg px-2 py-1.5 text-ink-3 hover:bg-[#f0efec] hover:text-[#d03b3b]" aria-label="Remove condition">
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button onClick={() => setConditions([...conditions, { field: "Lead score", operator: "is at least", value: "60" }])} className="mt-4 text-[13px] font-semibold text-brand hover:underline">
                + Add condition
              </button>

              <div className="mt-6 flex gap-2 border-t border-line pt-4">
                <button disabled={busy || !name} onClick={save} className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6] disabled:opacity-50">
                  {busy ? "Working…" : "Save audience"}
                </button>
                <button onClick={() => setBuilding(false)} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">
                  Cancel
                </button>
              </div>
            </div>
          </Card>
          <Card className="self-start">
            <CardHeader title="Live estimate" subtitle="Evaluated against the contact database" />
            <div className="px-5 py-5">
              <p className="tabular text-3xl font-semibold tracking-tight">{estimate ? num(estimate.count) : "…"}</p>
              <p className="mt-1 text-xs text-ink-3">
                contacts match{estimate && estimate.revenue > 0 ? ` · ${gbp(estimate.revenue)} lifetime value` : ""}
              </p>
              {estimate && estimate.preview.length > 0 && (
                <ul className="mt-4 divide-y divide-line border-t border-line">
                  {estimate.preview.map((p) => (
                    <li key={p.id} className="flex items-center justify-between py-2 text-[13px]">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="truncate text-xs text-ink-3">{p.email}</p>
                      </div>
                      <span className="tabular shrink-0 text-xs font-bold text-ink-2">{p.score}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 text-xs leading-relaxed text-ink-2">
                Suppressed contacts are excluded from sends regardless of rules. NOT toggles a condition into an exclusion.
              </p>
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}
