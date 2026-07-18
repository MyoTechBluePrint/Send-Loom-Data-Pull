"use client";

// Data Upload Centre. The wizard drives the real import pipeline:
// POST /api/imports → review → confirm. Nothing here is simulated.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell, GhostButton } from "@/components/shell";
import { Card, CardHeader, Badge, Th, Td } from "@/components/ui";
import { gbp, num, type ImportBatch } from "@/lib/data";

const batchBadge: Record<string, string> = {
  complete: "sent", "needs review": "pending", processing: "sending", blocked: "suppressed",
};

const FIELD_LABELS: Record<string, string> = {
  email: "Email", firstName: "First name", lastName: "Last name", phone: "Phone",
  country: "Country", city: "City", postcode: "Postcode", productInterest: "Product interest",
  keywordInterest: "Keyword interest", source: "Source", campaign: "Campaign",
  consent: "Consent status", orderValue: "Order value", lastOrderDate: "Last order date",
  tags: "Tags", notes: "Notes", custom: "Custom field", ignore: "Do not import",
};

// Deliberately dirty demo file: in-file duplicate, disposable domain, invalid
// email, and two rows matching seeded suppression/unsubscribe records.
const DEMO_CSV = `email_address,fname,surname,mobile,city,interest,signup_source,gdpr_optin,coach_notes
laura.chen@gmail.com,Laura,Chen,+44 7700 900123,London,weight management,July webinar reg page,TRUE,asked about GLP-1 support
ben.whitfield@outlook.com,Ben,Whitfield,+44 7700 900124,Manchester,longevity,July webinar reg page,TRUE,
amara.diallo@gmail.com,Amara,Diallo,,Bristol,sleep,July webinar reg page,TRUE,
laura.chen@gmail.com,Laura,Chen,,London,weight management,July webinar reg page,TRUE,duplicate row
mike.t@tempmail.io,Mike,T,,Leeds,recovery,July webinar reg page,TRUE,
sarah@wilson,Sarah,Wilson,,Cardiff,longevity,July webinar reg page,TRUE,
tom.bergstrom@gmail.com,Tom,Bergström,,Bristol,recovery,July webinar reg page,TRUE,previously unsubscribed
olly.kaminski@gmail.com,Oliver,Kaminski,,Newcastle,sleep,July webinar reg page,TRUE,hard bounced before
nat.brooks@yahoo.co.uk,Natalie,Brooks,+44 7700 900125,Leeds,metabolic health,July webinar reg page,,no optin value
david.okon@gmail.com,David,Okon,,Glasgow,longevity,July webinar reg page,TRUE,
priya.nair@yahoo.co.uk,Priya,Nair,,Birmingham,collagen,July webinar reg page,TRUE,existing customer
kieran.oshea@gmail.com,Kieran,O'Shea,+353 87 123 4567,Dublin,recovery,July webinar reg page,TRUE,`;

const steps = ["Upload", "Map fields", "Quality review", "Source & consent", "Import"];

type ReviewCounts = { ready: number; duplicate: number; invalid: number; blocked: number; missingConsent: number; needsReview: number };
type Issue = { rowNumber: number; email: string; issue: string; status: string };

export function ImportsClient({ batches }: { batches: ImportBatch[] }) {
  const router = useRouter();
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batchId, setBatchId] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [counts, setCounts] = useState<ReviewCounts | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [dupeAction, setDupeAction] = useState<"merge_newest" | "merge_existing" | "skip" | "overwrite">("merge_newest");
  const [createSegment, setCreateSegment] = useState(true);
  const [result, setResult] = useState<{ imported: number; merged: number; skipped: number; blocked: number; segmentId: string | null } | null>(null);

  async function call(url: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!json.ok) throw new Error(typeof json.error === "string" ? json.error : "Request failed");
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      throw e;
    } finally {
      setBusy(false);
    }
  }

  async function startDemoUpload() {
    const json = await call("/api/imports", {
      name: "Webinar attendees · July (demo file)",
      source: "Zoom webinar · consent at registration",
      sourceType: "webinar",
      csv: DEMO_CSV,
    });
    setBatchId(json.batchId);
    setColumns(json.columns);
    setMapping(json.mapping);
    setPreview(json.preview);
    setTotalRows(json.totalRows);
    setStep(1);
  }

  async function runReview() {
    const json = await call(`/api/imports/${batchId}/review`, { mapping });
    setCounts(json.counts);
    setIssues(json.issues);
    setStep(2);
  }

  async function runConfirm() {
    const json = await call(`/api/imports/${batchId}/confirm`, {
      duplicateStrategy: dupeAction,
      tags: ["webinar-july", "warm-lead"],
      lawfulBasis: "Consent (webinar registration checkbox)",
      createSegment,
    });
    setResult(json);
    setStep(4);
    router.refresh();
  }

  const sourcePerformance = batches.filter((b) => b.revenue > 0).sort((a, b) => b.revenue - a.revenue);

  return (
    <Shell
      title="Data Upload Centre"
      subtitle="Import, map, clean and tag audience data · every record keeps its source"
      actions={
        wizard ? (
          <button onClick={() => { setWizard(false); router.refresh(); }} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">
            Exit wizard
          </button>
        ) : (
          <>
            <GhostButton>Download templates</GhostButton>
            <button onClick={() => { setWizard(true); setStep(0); setResult(null); }} className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6]">
              New import
            </button>
          </>
        )
      }
    >
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {!wizard ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Import batches</p>
              <p className="tabular mt-1.5 text-2xl font-semibold">{batches.length}</p>
              <p className="mt-1 text-xs text-ink-3">{num(batches.reduce((s, b) => s + b.total, 0))} rows total</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Ready to use</p>
              <p className="tabular mt-1.5 text-2xl font-semibold text-emerald-700">{num(batches.reduce((s, b) => s + b.ready, 0))}</p>
              <p className="mt-1 text-xs text-ink-3">passed quality review</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Blocked</p>
              <p className="tabular mt-1.5 text-2xl font-semibold text-red-700">{num(batches.reduce((s, b) => s + b.blocked, 0))}</p>
              <p className="mt-1 text-xs text-ink-3">suppression + consent gates</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Best source (revenue)</p>
              <p className="mt-1.5 text-base font-semibold leading-snug">{sourcePerformance[0]?.name ?? "–"}</p>
              <p className="mt-1 text-xs text-emerald-700">{sourcePerformance[0] ? gbp(sourcePerformance[0].revenue) + " attributed" : ""}</p>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader title="Import batches" subtitle="Live from the database · every upload quality-checked and source-tagged" />
              <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[640px]">
                <thead className="border-b border-line">
                  <tr>
                    <Th>Batch</Th>
                    <Th className="text-right">Rows</Th>
                    <Th className="text-right">Ready</Th>
                    <Th className="text-right">Dupes</Th>
                    <Th className="text-right">Blocked</Th>
                    <Th className="text-right">Status</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {batches.map((b) => (
                    <tr key={b.id} className="hover:bg-[#fafaf8]">
                      <Td>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-xs text-ink-3">{b.source} · {b.format} · {b.date} · by {b.uploadedBy}</p>
                      </Td>
                      <Td className="tabular text-right">{num(b.total)}</Td>
                      <Td className="tabular text-right text-emerald-700">{num(b.ready)}</Td>
                      <Td className="tabular text-right">{num(b.duplicates)}</Td>
                      <Td className="tabular text-right">{b.blocked ? num(b.blocked) : "–"}</Td>
                      <Td className="text-right"><Badge value={batchBadge[b.status]} label={b.status} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Card>

            <div className="space-y-4 self-start">
              <Card>
                <CardHeader title="Source performance" subtitle="Attributed revenue by import source" />
                <div className="space-y-3 px-5 py-4">
                  {sourcePerformance.map((b) => (
                    <div key={b.id}>
                      <div className="mb-1 flex justify-between gap-3 text-xs">
                        <span className="min-w-0 flex-1 truncate font-medium text-ink-2">{b.name}</span>
                        <span className="tabular shrink-0 whitespace-nowrap font-semibold">{gbp(b.revenue)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f0efec]">
                        <div className="h-2 rounded-full bg-[#1baf7a]" style={{ width: `${(b.revenue / sourcePerformance[0].revenue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-line pt-3 text-xs text-ink-3">
                    Revenue joins orders back to the batch each contact arrived in.
                  </p>
                </div>
              </Card>
              <Card>
                <CardHeader title="Accepted sources" />
                <div className="flex flex-wrap gap-1.5 px-5 py-4">
                  {["CSV", "XLSX (planned)", "Mailchimp", "Klaviyo", "Omnisend", "WooCommerce", "Meta lead forms", "CRM export", "Webinar lists", "Quiz funnels", "Suppression lists"].map((s) => (
                    <span key={s} className="rounded-full bg-[#f0efec] px-2.5 py-1 text-[11px] font-medium text-ink-2">{s}</span>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  i === step ? "bg-brand text-white" : i < step ? "bg-emerald-50 text-emerald-700" : "bg-[#f0efec] text-ink-3"
                }`}>
                  <span>{i < step ? "✓" : i + 1}</span> {s}
                </span>
                {i < steps.length - 1 && <span className="text-ink-3">→</span>}
              </div>
            ))}
            {busy && <span className="ml-2 text-xs font-medium text-brand">Working…</span>}
          </div>

          {step === 0 && (
            <Card className="mx-auto max-w-2xl">
              <div className="flex flex-col items-center border-2 border-dashed border-line px-8 py-16 text-center" style={{ borderRadius: 12 }}>
                <p className="text-3xl">⇪</p>
                <p className="mt-3 text-sm font-semibold">Drop a CSV here</p>
                <p className="mt-1 text-xs text-ink-3">Columns detected automatically · XLSX/JSON planned</p>
                <button disabled={busy} onClick={startDemoUpload} className="mt-5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">
                  Use demo file: webinar-attendees-july.csv (12 rows)
                </button>
                <p className="mt-2 text-[11px] text-ink-3">The demo file is deliberately dirty: duplicates, a disposable domain, an invalid email and two suppressed contacts.</p>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader
                title="Map fields"
                subtitle={`${totalRows} rows · ${columns.length} columns detected`}
                action={<button disabled={busy} onClick={runReview} className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">Run quality review →</button>}
              />
              <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[640px]">
                <thead className="border-b border-line">
                  <tr>
                    <Th>File column</Th>
                    <Th>Sample value</Th>
                    <Th>Maps to</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {columns.map((col) => (
                    <tr key={col}>
                      <Td><code className="text-xs font-semibold">{col}</code></Td>
                      <Td className="text-xs text-ink-2">{preview[0]?.[col] || <span className="text-ink-3">–</span>}</Td>
                      <Td>
                        <select
                          value={mapping[col]}
                          onChange={(e) => setMapping({ ...mapping, [col]: e.target.value })}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium outline-none focus:border-brand"
                        >
                          {Object.entries(FIELD_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                          ))}
                        </select>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </Card>
          )}

          {step === 2 && counts && (
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="xl:col-span-2">
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                  {[
                    ["Rows uploaded", totalRows, ""],
                    ["Ready", counts.ready, "text-emerald-700"],
                    ["Duplicates", counts.duplicate, "text-amber-700"],
                    ["Invalid", counts.invalid, "text-amber-700"],
                    ["Blocked", counts.blocked, "text-red-700"],
                    ["Missing consent", counts.missingConsent, "text-red-700"],
                    ["Needs review", counts.needsReview, "text-amber-700"],
                  ].map(([label, value, tone]) => (
                    <Card key={label as string} className="px-4 py-3">
                      <p className="text-[11px] font-medium text-ink-3">{label}</p>
                      <p className={`tabular mt-1 text-xl font-semibold ${tone}`}>{num(value as number)}</p>
                    </Card>
                  ))}
                </div>
                <Card className="mt-4">
                  <CardHeader title={`Flagged rows · ${issues.length}`} subtitle="Live results from the quality engine" />
                  <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[560px]">
                    <tbody className="divide-y divide-line text-sm">
                      {issues.map((i) => (
                        <tr key={i.rowNumber}>
                          <td className="w-14 px-4 py-2.5 text-xs text-ink-3">#{i.rowNumber}</td>
                          <td className="px-4 py-2.5"><code className="text-xs font-semibold">{i.email}</code></td>
                          <td className="px-4 py-2.5 text-xs text-ink-2">{i.issue}</td>
                          <td className="px-4 py-2.5 text-right"><span className="rounded-full bg-[#f0efec] px-2.5 py-1 text-[11px] font-semibold capitalize text-ink-2">{i.status.replace("_", " ")}</span></td>
                        </tr>
                      ))}
                      {issues.length === 0 && <tr><td className="px-4 py-8 text-center text-sm text-ink-3">No issues found.</td></tr>}
                    </tbody>
                  </table></div>
                </Card>
              </div>
              <Card className="self-start">
                <CardHeader title="Duplicate handling" />
                <div className="space-y-2 px-4 py-4">
                  {([
                    ["merge_newest", "Merge (keep newest values)"],
                    ["merge_existing", "Merge (keep existing values)"],
                    ["skip", "Skip duplicates"],
                    ["overwrite", "Overwrite existing"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] font-medium ${dupeAction === value ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
                      <input type="radio" checked={dupeAction === value} onChange={() => setDupeAction(value)} className="accent-[#6d28d9]" />
                      {label}
                    </label>
                  ))}
                  <button onClick={() => setStep(3)} className="mt-2 w-full rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
                    Continue → Source & consent
                  </button>
                </div>
              </Card>
            </div>
          )}

          {step === 3 && (
            <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader title="Source ledger entry" subtitle="Appended to every contact in this batch, permanently" />
                <div className="space-y-3 px-5 py-4 text-[13px]">
                  {[
                    ["Source name", "Webinar attendees · July (demo file)"],
                    ["Source type", "Event/webinar registration"],
                    ["Uploaded by", "steve@vitaliswellness.co.uk"],
                    ["Lawful basis", "Consent (webinar registration checkbox)"],
                    ["Consent rule", "Opted-out contacts are never reactivated"],
                    ["Rows without consent", "Held as 'pending' · no marketing until confirmed"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <span className="shrink-0 text-xs font-medium text-ink-3">{k}</span>
                      <span className="text-right font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Tags & audience" />
                <div className="space-y-3 px-5 py-4 text-[13px]">
                  <div>
                    <p className="text-xs font-medium text-ink-3">Tags applied</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {["webinar-july", "warm-lead"].map((t) => (
                        <span key={t} className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">{t}</span>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                    <span className="font-medium">Create audience from this import</span>
                    <input type="checkbox" checked={createSegment} onChange={(e) => setCreateSegment(e.target.checked)} className="h-4 w-4 accent-[#6d28d9]" />
                  </label>
                  <button disabled={busy} onClick={runConfirm} className="w-full rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">
                    {busy ? "Importing…" : "Run import"}
                  </button>
                </div>
              </Card>
            </div>
          )}

          {step === 4 && result && (
            <Card className="mx-auto max-w-xl">
              <div className="px-8 py-10 text-center">
                <p className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">✓</p>
                <h2 className="mt-4 text-lg font-semibold">Import complete</h2>
                <p className="mt-1 text-sm text-ink-2">
                  {result.imported} contacts created · {result.merged} merged · {result.skipped} skipped · {result.blocked} blocked
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Link href="/subscribers" className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">View contacts</Link>
                  <button
                    onClick={async () => {
                      const res = await fetch("/api/packs", {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ name: "Latest import pack", from: "batch", batchId }),
                      });
                      const json = await res.json();
                      if (json.ok) window.location.href = `/packs/${json.id}`;
                    }}
                    className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand hover:bg-[#ece2fa]"
                  >
                    Create Contact Pack
                  </button>
                </div>
                {result.segmentId && (
                  <p className="mx-auto mt-4 max-w-sm rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
                    Audience created from this batch · usable in campaigns now
                  </p>
                )}
                <p className="mt-3 text-xs text-ink-3">These are real database records. Open Contacts to see them, sources and consent included.</p>
                <button onClick={() => { setWizard(false); router.refresh(); }} className="mt-6 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
                  Back to Data Upload Centre
                </button>
              </div>
            </Card>
          )}
        </div>
      )}
    </Shell>
  );
}
