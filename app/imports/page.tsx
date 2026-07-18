"use client";

import { useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, CardHeader, Badge, Th, Td } from "@/components/ui";
import { gbp, importBatches, num } from "@/lib/data";

const batchBadge: Record<string, string> = {
  complete: "sent",
  "needs review": "pending",
  processing: "sending",
  blocked: "suppressed",
};

// Mock parsed file for the wizard demo
const detectedColumns = [
  { column: "email_address", sample: "laura.chen@gmail.com", mapped: "Email", auto: true },
  { column: "fname", sample: "Laura", mapped: "First name", auto: true },
  { column: "surname", sample: "Chen", mapped: "Last name", auto: true },
  { column: "mobile", sample: "+44 7700 900123", mapped: "Phone", auto: true },
  { column: "city", sample: "London", mapped: "City", auto: true },
  { column: "interest", sample: "weight management", mapped: "Product interest", auto: true },
  { column: "signup_source", sample: "July webinar reg page", mapped: "Source", auto: true },
  { column: "gdpr_optin", sample: "TRUE", mapped: "Consent status", auto: true },
  { column: "coach_notes", sample: "asked about GLP-1 support", mapped: "Custom field", auto: false },
];

const platformFields = ["Email", "First name", "Last name", "Phone", "Country", "City", "Postcode", "Product interest", "Keyword interest", "Source", "Campaign", "Consent status", "Order value", "Last order date", "Tags", "Notes", "Custom field", "Do not import"];

const qualityCards = [
  { label: "Rows uploaded", value: 1240, tone: "" },
  { label: "Valid contacts", value: 1088, tone: "text-emerald-700" },
  { label: "Duplicates found", value: 96, tone: "text-amber-700" },
  { label: "Invalid emails", value: 31, tone: "text-amber-700" },
  { label: "Missing consent", value: 44, tone: "text-red-700" },
  { label: "Suppressed matches", value: 12, tone: "text-red-700" },
  { label: "Missing phone", value: 214, tone: "" },
  { label: "Needs review", value: 87, tone: "text-amber-700" },
];

const steps = ["Upload", "Map fields", "Quality review", "Source & consent", "Import"];

export default function ImportsPage() {
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(0);
  const [mappings, setMappings] = useState(detectedColumns.map((c) => c.mapped));
  const [dupeAction, setDupeAction] = useState("Merge (keep newest values)");
  const [createSegment, setCreateSegment] = useState(true);

  const sourcePerformance = importBatches
    .filter((b) => b.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue);

  return (
    <Shell
      title="Data Upload Centre"
      subtitle="Import, map, clean and tag audience data · every record keeps its source"
      actions={
        wizard ? (
          <GhostButton>Save & exit</GhostButton>
        ) : (
          <>
            <GhostButton>Download templates</GhostButton>
            <button onClick={() => { setWizard(true); setStep(0); }} className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6]">
              New import
            </button>
          </>
        )
      }
    >
      {!wizard ? (
        <>
          <div className="mb-4 grid grid-cols-4 gap-4">
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Imported this month</p>
              <p className="tabular mt-1.5 text-2xl font-semibold">17,640</p>
              <p className="mt-1 text-xs text-ink-3">across 6 batches · 4 sources</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Ready to use</p>
              <p className="tabular mt-1.5 text-2xl font-semibold text-emerald-700">16,228</p>
              <p className="mt-1 text-xs text-ink-3">92% of imported rows</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Blocked</p>
              <p className="tabular mt-1.5 text-2xl font-semibold text-red-700">5,145</p>
              <p className="mt-1 text-xs text-ink-3">mostly one no-consent list</p>
            </Card>
            <Card className="px-5 py-4">
              <p className="text-xs font-medium text-ink-3">Best source (revenue)</p>
              <p className="mt-1.5 truncate text-lg font-semibold">Klaviyo legacy list</p>
              <p className="mt-1 text-xs text-emerald-700">{gbp(64110)} attributed</p>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card className="col-span-2">
              <CardHeader title="Import batches" subtitle="Every upload is quality-checked and source-tagged before contacts go live" />
              <table className="w-full">
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
                  {importBatches.map((b) => (
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
              </table>
            </Card>

            <div className="space-y-4 self-start">
              <Card>
                <CardHeader title="Source performance" subtitle="Attributed revenue by import source" />
                <div className="space-y-3 px-5 py-4">
                  {sourcePerformance.map((b) => (
                    <div key={b.id}>
                      <div className="mb-1 flex justify-between text-xs">
                        <span className="font-medium text-ink-2">{b.name}</span>
                        <span className="tabular font-semibold">{gbp(b.revenue)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#f0efec]">
                        <div className="h-2 rounded-full bg-[#1baf7a]" style={{ width: `${(b.revenue / sourcePerformance[0].revenue) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                  <p className="border-t border-line pt-3 text-xs text-ink-3">
                    Revenue joins orders back to the batch each contact arrived in. Poor sources become obvious fast.
                  </p>
                </div>
              </Card>
              <Card>
                <CardHeader title="Accepted sources" />
                <div className="flex flex-wrap gap-1.5 px-5 py-4">
                  {["CSV", "XLSX", "Mailchimp", "Klaviyo", "Omnisend", "WooCommerce", "Meta lead forms", "Google lead forms", "CRM export", "Webinar lists", "Quiz funnels", "Suppression lists"].map((s) => (
                    <span key={s} className="rounded-full bg-[#f0efec] px-2.5 py-1 text-[11px] font-medium text-ink-2">{s}</span>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </>
      ) : (
        <div>
          {/* Stepper */}
          <div className="mb-5 flex items-center gap-2">
            {steps.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <button
                  onClick={() => i < step && setStep(i)}
                  className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
                    i === step ? "bg-brand text-white" : i < step ? "bg-emerald-50 text-emerald-700" : "bg-[#f0efec] text-ink-3"
                  }`}
                >
                  <span>{i < step ? "✓" : i + 1}</span> {s}
                </button>
                {i < steps.length - 1 && <span className="text-ink-3">→</span>}
              </div>
            ))}
          </div>

          {step === 0 && (
            <Card className="mx-auto max-w-2xl">
              <div className="flex flex-col items-center border-2 border-dashed border-line px-8 py-16 text-center" style={{ borderRadius: 12 }}>
                <p className="text-3xl">⇪</p>
                <p className="mt-3 text-sm font-semibold">Drop a CSV or XLSX here</p>
                <p className="mt-1 text-xs text-ink-3">Up to 250,000 rows · we detect columns automatically</p>
                <button onClick={() => setStep(1)} className="mt-5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
                  Use demo file: webinar-attendees-july.csv
                </button>
              </div>
              <div className="border-t border-line px-6 py-4">
                <p className="text-xs font-semibold text-ink-3">WHAT THIS UPLOAD IS</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {["Leads", "Customers", "Webinar attendees", "Quiz leads", "Abandoned checkouts", "Suppression list"].map((t, i) => (
                    <button key={t} className={`rounded-full px-3 py-1.5 text-xs font-semibold ${i === 2 ? "bg-brand text-white" : "bg-[#f0efec] text-ink-2 hover:bg-[#e7e6e1]"}`}>{t}</button>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card>
              <CardHeader
                title="Map fields"
                subtitle="webinar-attendees-july.csv · 1,240 rows · 9 columns detected, 8 auto-mapped"
                action={<button onClick={() => setStep(2)} className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">Continue → Quality review</button>}
              />
              <table className="w-full">
                <thead className="border-b border-line">
                  <tr>
                    <Th>File column</Th>
                    <Th>Sample value</Th>
                    <Th>Maps to</Th>
                    <Th className="text-right">Detection</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {detectedColumns.map((c, i) => (
                    <tr key={c.column}>
                      <Td><code className="text-xs font-semibold">{c.column}</code></Td>
                      <Td className="text-xs text-ink-2">{c.sample}</Td>
                      <Td>
                        <select
                          value={mappings[i]}
                          onChange={(e) => setMappings(mappings.map((m, j) => (j === i ? e.target.value : m)))}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] font-medium outline-none focus:border-brand"
                        >
                          {platformFields.map((f) => <option key={f}>{f}</option>)}
                        </select>
                        {mappings[i] === "Custom field" && (
                          <span className="ml-2 text-xs text-ink-3">→ saved as <code className="font-semibold">coach_notes</code></span>
                        )}
                      </Td>
                      <Td className="text-right">
                        {c.auto ? (
                          <span className="text-xs font-medium text-emerald-700">Auto-detected</span>
                        ) : (
                          <span className="text-xs font-medium text-amber-700">Needs choice</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}

          {step === 2 && (
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <div className="grid grid-cols-4 gap-3">
                  {qualityCards.map((q) => (
                    <Card key={q.label} className="px-4 py-3">
                      <p className="text-[11px] font-medium text-ink-3">{q.label}</p>
                      <p className={`tabular mt-1 text-xl font-semibold ${q.tone}`}>{num(q.value)}</p>
                    </Card>
                  ))}
                </div>
                <Card className="mt-4">
                  <CardHeader title="Needs review · 87 rows" subtitle="Duplicates, invalid formats and consent gaps" />
                  <table className="w-full">
                    <tbody className="divide-y divide-line text-sm">
                      {[
                        ["laura.chen@gmail.com", "Duplicate of existing contact (Meta lead, Jun) · newer phone number", "Merge"],
                        ["mike.t@tempmail.io", "Disposable email domain", "Block"],
                        ["sarah@wilson", "Invalid email format", "Fix or skip"],
                        ["j.legrand@orange.fr", "Country outside sending regions", "Review"],
                        ["tom.b@gmail.com", "Matches suppression list (unsubscribed Mar 2026)", "Keep suppressed"],
                      ].map(([email, issue, action]) => (
                        <tr key={email as string}>
                          <td className="px-4 py-2.5"><code className="text-xs font-semibold">{email}</code></td>
                          <td className="px-4 py-2.5 text-xs text-ink-2">{issue}</td>
                          <td className="px-4 py-2.5 text-right"><span className="rounded-full bg-[#f0efec] px-2.5 py-1 text-[11px] font-semibold text-ink-2">{action}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="border-t border-line px-4 py-3 text-xs text-ink-3">Rejected rows can be exported as CSV for manual cleanup.</p>
                </Card>
              </div>
              <Card className="self-start">
                <CardHeader title="Duplicate handling" />
                <div className="space-y-2 px-4 py-4">
                  {["Merge (keep newest values)", "Merge (keep existing values)", "Skip duplicates", "Overwrite existing"].map((o) => (
                    <label key={o} className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px] font-medium ${dupeAction === o ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
                      <input type="radio" checked={dupeAction === o} onChange={() => setDupeAction(o)} className="accent-[#6d28d9]" />
                      {o}
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
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4">
              <Card>
                <CardHeader title="Source ledger entry" subtitle="Recorded on every contact in this batch, permanently" />
                <div className="space-y-3 px-5 py-4 text-[13px]">
                  {[
                    ["Source name", "Webinar attendees · July"],
                    ["Source type", "Event/webinar registration"],
                    ["Uploaded by", "Hannah Morris"],
                    ["Lawful basis", "Consent (registration checkbox)"],
                    ["Consent evidence", "Registration form snapshot + timestamp"],
                    ["Data confidence", "89 / 100"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <span className="text-xs font-medium text-ink-3">{k}</span>
                      <span className="text-right font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </Card>
              <Card>
                <CardHeader title="Channels & tagging" />
                <div className="space-y-3 px-5 py-4 text-[13px]">
                  <div>
                    <p className="text-xs font-medium text-ink-3">Channels permitted by this source</p>
                    <div className="mt-1.5 flex gap-1.5">
                      {[["Email", true], ["SMS", false], ["WhatsApp", false], ["Phone", true], ["Ad export", false]].map(([c, on]) => (
                        <span key={c as string} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${on ? "bg-emerald-50 text-emerald-700" : "bg-[#f0efec] text-ink-3 line-through"}`}>{c}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-ink-3">Tags applied</p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {["webinar-july", "weight-management", "warm-lead"].map((t) => (
                        <span key={t} className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-semibold text-brand">{t}</span>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                    <span className="font-medium">Create audience from this import</span>
                    <input type="checkbox" checked={createSegment} onChange={(e) => setCreateSegment(e.target.checked)} className="h-4 w-4 accent-[#6d28d9]" />
                  </label>
                  <button onClick={() => setStep(4)} className="w-full rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
                    Run import
                  </button>
                </div>
              </Card>
            </div>
          )}

          {step === 4 && (
            <Card className="mx-auto max-w-xl">
              <div className="px-8 py-10 text-center">
                <p className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-xl text-emerald-700">✓</p>
                <h2 className="mt-4 text-lg font-semibold">Import complete</h2>
                <p className="mt-1 text-sm text-ink-2">1,088 contacts imported · 74 merged · 12 blocked (suppression) · 44 held for consent review</p>
                <div className="mx-auto mt-5 grid max-w-sm grid-cols-2 gap-2 text-left">
                  {createSegment && (
                    <span className="col-span-2 rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand">
                      Audience created: "Webinar · July attendees" (1,088)
                    </span>
                  )}
                  <span className="rounded-lg bg-[#f0efec] px-3 py-2 text-xs font-medium text-ink-2">Suggested: Welcome series</span>
                  <span className="rounded-lg bg-[#f0efec] px-3 py-2 text-xs font-medium text-ink-2">Suggested: Consultation push</span>
                </div>
                <button onClick={() => setWizard(false)} className="mt-6 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
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
