"use client";

// Audience builder backed by the real segment engine: estimates and saves hit
// /api/segments against actual contacts.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { gbp, num, type Condition, type Segment } from "@/lib/data";

const fieldOptions = [
  "Total spend", "Order count", "Last order", "Country", "Tag", "Source",
  "Import batch", "Lead score", "Keyword searched", "Consent", "Engagement",
];
const operatorOptions = ["is", "is not", "is greater than", "is less than", "is at least", "is exactly", "is more than", "contains"];

// Sources a contact can arrive from. Names here line up with the alias map in
// lib/server/segments.ts so picking one matches how sources are recorded.
const sourceOptions = [
  "WhatsApp", "Email Sign Up", "Purchase", "Abandoned Checkout",
  "Facebook Lead", "Instagram", "TikTok", "CSV Import", "API / Integration", "Zapier", "Manual",
];

// Full country list from the browser's own region names — no hardcoded list
// to drift out of date.
function allCountries(): string[] {
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    // Special region codes that are not countries.
    const NOT_COUNTRIES = new Set(["EU", "EZ", "UN", "XA", "XB", "ZZ", "QO"]);
    const names = new Set<string>();
    for (const a of letters) for (const b of letters) {
      const code = a + b;
      if (NOT_COUNTRIES.has(code)) continue;
      try {
        const name = dn.of(code);
        if (name && name !== code && !/^[A-Z0-9]{2,3}$/.test(name)) names.add(name);
      } catch { /* not a region */ }
    }
    return [...names].sort((x, y) => x.localeCompare(y));
  } catch {
    return ["United Kingdom", "Spain", "United States", "Germany", "France", "Ireland", "Netherlands", "Italy", "Portugal", "United Arab Emirates"];
  }
}

// Searchable dropdown. multi=false picks one value; multi=true stores a comma
// list and offers Select all (of the filtered set) / Clear.
function SearchSelect(props: {
  value: string; onChange: (v: string) => void; options: string[];
  placeholder: string; multi?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const selected = props.multi ? props.value.split(",").map((x) => x.trim()).filter(Boolean) : [];
  const filtered = props.options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase()));
  const label = props.multi
    ? selected.length === 0 ? props.placeholder
      : selected.length <= 2 ? selected.join(", ")
      : `${selected.length} selected`
    : props.value || props.placeholder;

  function toggle(o: string) {
    if (!props.multi) { props.onChange(o); setOpen(false); setQ(""); return; }
    const next = selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o];
    props.onChange(next.join(", "));
  }

  return (
    <div ref={ref} className="relative min-w-40 flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-2.5 py-2 text-left text-[13px] outline-none focus:border-brand ${(props.multi ? selected.length === 0 : !props.value) ? "text-ink-3" : ""}`}
      >
        <span className="truncate">{label}</span>
        <span className="text-[10px] text-ink-3">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-line bg-white shadow-xl">
          <div className="border-b border-line p-2">
            <input
              autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…"
              className="w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand"
            />
          </div>
          {props.multi && (
            <div className="flex gap-3 border-b border-line px-3 py-1.5 text-[11px] font-semibold">
              <button type="button" onClick={() => props.onChange([...new Set([...selected, ...filtered])].join(", "))} className="text-brand hover:underline">
                Select all{q ? " matching" : ""}
              </button>
              <button type="button" onClick={() => props.onChange("")} className="text-ink-3 hover:underline">Clear all</button>
            </div>
          )}
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && <li className="px-3 py-2 text-[12px] text-ink-3">No matches.</li>}
            {filtered.map((o) => (
              <li key={o}>
                <button
                  type="button" onClick={() => toggle(o)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] hover:bg-brand-soft ${(props.multi ? selected.includes(o) : props.value === o) ? "font-semibold text-brand" : ""}`}
                >
                  {props.multi && (
                    <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] ${selected.includes(o) ? "border-brand bg-brand text-white" : "border-line"}`}>
                      {selected.includes(o) ? "✓" : ""}
                    </span>
                  )}
                  <span className="truncate">{o}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

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
  const countries = useMemo(allCountries, []);

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

  const [packFlash, setPackFlash] = useState<string | null>(null);

  async function packFromAudience(id: string, name: string, copyEmails: boolean) {
    const res = await fetch("/api/packs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `${name} pack`, from: "segment", segmentId: id }),
    });
    const json = await res.json();
    if (!json.ok) { setPackFlash(json.error ?? "Failed"); return; }
    if (copyEmails) {
      const r = await fetch(`/api/packs/${json.id}/render`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "emails" }),
      });
      const j = await r.json();
      if (j.ok) {
        await navigator.clipboard.writeText(j.text);
        setPackFlash(`Copied ${j.count} emails · pack saved`);
        setTimeout(() => setPackFlash(null), 3000);
        router.refresh();
        return;
      }
    }
    window.location.href = `/packs/${json.id}`;
  }

  async function renameAudience(id: string, current: string) {
    const name = window.prompt("Rename audience", current);
    if (!name || name === current) return;
    await fetch(`/api/segments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    router.refresh();
  }

  async function deleteAudience(id: string, name: string) {
    if (!window.confirm(`Delete audience '${name}'? Contacts are not affected.`)) return;
    await fetch(`/api/segments/${id}`, { method: "DELETE" });
    router.refresh();
  }

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
      actions={<PrimaryButton onClick={() => setBuilding(true)}>New segment</PrimaryButton>}
    >
      {packFlash && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{packFlash}</div>
      )}
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
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Link href="/campaigns/new" className="flex-1 rounded-lg bg-brand-soft px-3 py-1.5 text-center text-xs font-bold text-brand hover:bg-[#ece2fa]">
                      Campaign →
                    </Link>
                    <button onClick={() => packFromAudience(s.id, s.name, false)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]" title="Create Contact Pack">Pack</button>
                    <button onClick={() => packFromAudience(s.id, s.name, true)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]" title="Copy emails (creates a pack + logs the export)">Copy ✉</button>
                    <button onClick={() => renameAudience(s.id, s.name)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]" title="Rename">Rename</button>
                    <button onClick={() => deleteAudience(s.id, s.name)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-3 hover:bg-red-50 hover:text-red-700" title="Delete">✕</button>
                  </div>
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
                    <select
                      value={c.field}
                      onChange={(e) => {
                        const nf = e.target.value;
                        // Picker-backed fields start clean so stale free text
                        // from the previous field can't linger in the rule.
                        setConditions(conditions.map((x, j) => (j === i
                          ? { ...x, field: nf, ...(nf === "Source" || nf === "Country" ? { value: "", operator: "is" } : {}) }
                          : x)));
                      }}
                      className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] font-medium outline-none focus:border-brand"
                    >
                      {fieldOptions.map((f) => <option key={f}>{f}</option>)}
                    </select>
                    {c.field === "Source" || c.field === "Country" ? (
                      <span className="rounded-lg border border-line bg-[#f7f6f4] px-2.5 py-2 text-[13px] text-ink-3">is one of</span>
                    ) : (
                      <select value={c.operator} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, operator: e.target.value } : x)))} className="rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] text-ink-2 outline-none focus:border-brand">
                        {operatorOptions.map((o) => <option key={o}>{o}</option>)}
                      </select>
                    )}
                    {c.field === "Source" ? (
                      <SearchSelect
                        value={c.value} multi
                        onChange={(v) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: v } : x)))}
                        options={sourceOptions} placeholder="Choose sources…"
                      />
                    ) : c.field === "Country" ? (
                      <SearchSelect
                        value={c.value} multi
                        onChange={(v) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: v } : x)))}
                        options={countries} placeholder="Choose countries…"
                      />
                    ) : (
                      <input value={c.value} onChange={(e) => setConditions(conditions.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} className="min-w-32 flex-1 rounded-lg border border-line bg-surface px-2.5 py-2 text-[13px] outline-none focus:border-brand" />
                    )}
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
