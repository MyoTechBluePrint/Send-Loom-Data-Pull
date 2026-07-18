"use client";

// Pack detail: pre-export summary, 11 copy/export modes with Copied states,
// and smart batch splitting for large groups.
import Link from "next/link";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";
import { num } from "@/lib/data";

export type PackView = {
  id: string; name: string; source: string;
  total: number; eligible: number; withEmail: number; withPhone: number;
  excludedSuppressed: number; excludedUnsubscribed: number; excludedNoRoute: number;
  duplicatesRemoved: number; suggestedUse: string | null; simulated: boolean; created: string;
};

const COPY_MODES: { mode: string; label: string; hint: string; needs: "email" | "phone" | "any" }[] = [
  { mode: "emails", label: "Copy emails (Gmail)", hint: "comma-separated", needs: "email" },
  { mode: "bcc", label: "Copy BCC block (Outlook)", hint: "semicolon-separated", needs: "email" },
  { mode: "name_email", label: "Copy names + emails", hint: "Name <email> per line", needs: "email" },
  { mode: "phones", label: "Copy phone numbers", hint: "one per line, cleaned", needs: "phone" },
  { mode: "whatsapp", label: "Copy WhatsApp follow-up list", hint: "name — phone — interest", needs: "phone" },
  { mode: "call_sheet", label: "Copy call sheet", hint: "name | phone | interest | notes | next action", needs: "phone" },
  { mode: "outreach_rows", label: "Copy full outreach rows", hint: "tab-separated, pastes into Sheets/Excel", needs: "any" },
];

const EXPORT_MODES: { mode: string; label: string }[] = [
  { mode: "csv", label: "CSV (generic)" },
  { mode: "crm_csv", label: "CRM CSV" },
  { mode: "mailchimp_csv", label: "Mailchimp CSV" },
  { mode: "klaviyo_csv", label: "Klaviyo CSV" },
];

const BATCH_SIZES = [25, 50, 100, 250];
const GMAIL_BCC_WARN = 100;

export function PackDetailClient({ pack }: { pack: PackView }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchSize, setBatchSize] = useState<number | null>(pack.eligible > 100 ? 50 : null);
  const [customSize, setCustomSize] = useState("");
  const [usedBatches, setUsedBatches] = useState<number[]>([]);

  const effectiveSize = batchSize ?? pack.eligible;
  const batchCount = batchSize ? Math.ceil(pack.eligible / batchSize) : 1;
  const excluded = pack.excludedSuppressed + pack.excludedUnsubscribed + pack.excludedNoRoute;

  async function doCopy(mode: string, batchIndex?: number) {
    const key = `${mode}:${batchIndex ?? "all"}`;
    setError(null);
    try {
      const res = await fetch(`/api/packs/${pack.id}/render`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          ...(batchIndex !== undefined && batchSize ? { batchIndex, batchSize } : {}),
        }),
      });
      const json = await res.json();
      if (!json.ok) { setError(json.error); return; }
      await navigator.clipboard.writeText(json.text);
      setCopied(`${key} (${json.count})`);
      setTimeout(() => setCopied(null), 2500);
    } catch {
      setError("Clipboard blocked by the browser. Use a download instead.");
    }
  }

  async function doDownload(mode: string, batchIndex?: number) {
    setError(null);
    const res = await fetch(`/api/packs/${pack.id}/render`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode, download: true,
        ...(batchIndex !== undefined && batchSize ? { batchIndex, batchSize } : {}),
      }),
    });
    if (!res.ok) { setError((await res.json()).error ?? "Export failed"); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ?? "export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const disabledReason = (needs: "email" | "phone" | "any") =>
    pack.simulated ? "Simulated pack: no real records" :
    needs === "email" && pack.withEmail === 0 ? "No emails in this pack" :
    needs === "phone" && pack.withPhone === 0 ? "No phone numbers in this pack" : null;

  return (
    <Shell
      title={pack.name}
      subtitle={`${pack.source} · created by ${pack.created}`}
      actions={<Link href="/packs" className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">← All packs</Link>}
    >
      {error && <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
      {copied && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg">
          ✓ Copied {copied.split("(")[1]?.replace(")", "")} contacts
        </div>
      )}

      {/* Pre-export summary */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-3">Ready to use</p>
          <p className="tabular mt-1.5 text-2xl font-semibold text-emerald-700">{num(pack.eligible)}</p>
          <p className="mt-1 text-xs text-ink-3">of {num(pack.total)} selected</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-3">Email · Phone coverage</p>
          <p className="tabular mt-1.5 text-2xl font-semibold">{num(pack.withEmail)} · {num(pack.withPhone)}</p>
          <p className="mt-1 text-xs text-ink-3">{pack.eligible ? Math.round((pack.withEmail / pack.eligible) * 100) : 0}% email · {pack.eligible ? Math.round((pack.withPhone / pack.eligible) * 100) : 0}% phone</p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-3">Excluded automatically</p>
          <p className="tabular mt-1.5 text-2xl font-semibold text-ink-2">{num(excluded)}</p>
          <p className="mt-1 text-xs text-ink-3">
            {pack.excludedSuppressed} suppressed · {pack.excludedUnsubscribed} unsubscribed · {pack.excludedNoRoute} no route · {pack.duplicatesRemoved} dupes
          </p>
        </Card>
        <Card className="px-5 py-4">
          <p className="text-xs font-medium text-ink-3">Suggested use</p>
          <p className="mt-1.5 text-[13px] font-semibold leading-snug">{pack.suggestedUse ?? "–"}</p>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Copy modes */}
        <Card className="xl:col-span-2">
          <CardHeader title="Copy to clipboard" subtitle="Suppressed and unsubscribed contacts are excluded at copy time · every copy is logged" />
          <div className="grid grid-cols-1 gap-2.5 px-5 py-4 sm:grid-cols-2">
            {COPY_MODES.map((m) => {
              const reason = disabledReason(m.needs);
              return (
                <div key={m.mode} className={`rounded-lg border px-3.5 py-3 ${reason ? "border-line opacity-60" : "border-line"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-semibold">{m.label}</p>
                    {reason ? (
                      <span className="text-[10px] font-semibold text-ink-3">{reason}</span>
                    ) : (
                      <button
                        onClick={() => doCopy(m.mode)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-bold ${copied?.startsWith(`${m.mode}:all`) ? "bg-emerald-600 text-white" : "bg-brand text-white hover:bg-[#5b21b6]"}`}
                      >
                        {copied?.startsWith(`${m.mode}:all`) ? "Copied ✓" : "Copy"}
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">{m.hint}</p>
                  {m.mode === "emails" && pack.withEmail > GMAIL_BCC_WARN && (
                    <p className="mt-1 text-[11px] font-semibold text-amber-700">⚠ {num(pack.withEmail)} emails: Gmail caps ~100 recipients per send. Use batches below.</p>
                  )}
                </div>
              );
            })}
          </div>
          <div className="border-t border-line px-5 py-4">
            <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-ink-3">Download</p>
            <div className="flex flex-wrap gap-2">
              {EXPORT_MODES.map((m) => (
                <button
                  key={m.mode}
                  disabled={pack.simulated}
                  onClick={() => doDownload(m.mode)}
                  className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
                  title={pack.simulated ? "Simulated pack: no real records" : undefined}
                >
                  ⬇ {m.label}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {/* Batch splitting */}
        <Card className="self-start">
          <CardHeader title="Batch splitting" subtitle="For manual outreach in safe chunks" />
          <div className="px-5 py-4">
            <div className="flex flex-wrap gap-1.5">
              {BATCH_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBatchSize(s)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${batchSize === s ? "bg-brand text-white" : "bg-[#f0efec] text-ink-2 hover:bg-[#e7e6e1]"}`}
                >
                  {s}
                </button>
              ))}
              <span className="flex items-center gap-1">
                <input
                  value={customSize}
                  onChange={(e) => setCustomSize(e.target.value.replace(/\D/g, ""))}
                  placeholder="Custom"
                  className="w-16 rounded-full border border-line px-2.5 py-1.5 text-xs outline-none focus:border-brand"
                />
                <button
                  disabled={!customSize || Number(customSize) < 5}
                  onClick={() => setBatchSize(Number(customSize))}
                  className="rounded-full bg-[#f0efec] px-2.5 py-1.5 text-xs font-semibold text-ink-2 disabled:opacity-40"
                >
                  Set
                </button>
              </span>
              {batchSize && (
                <button onClick={() => setBatchSize(null)} className="rounded-full px-2 py-1.5 text-xs text-ink-3 hover:text-red-700">✕ off</button>
              )}
            </div>

            {batchSize ? (
              <ul className="mt-4 max-h-96 space-y-2 overflow-y-auto scroll-thin">
                {Array.from({ length: batchCount }, (_, i) => {
                  const from = i * effectiveSize + 1;
                  const to = Math.min((i + 1) * effectiveSize, pack.eligible);
                  const used = usedBatches.includes(i);
                  return (
                    <li key={i} className={`rounded-lg border px-3 py-2.5 ${used ? "border-emerald-200 bg-emerald-50/50" : "border-line"}`}>
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold">Batch {i + 1} of {batchCount} <span className="font-normal text-ink-3">· {from}–{to}</span></p>
                        <label className="flex items-center gap-1 text-[10px] font-semibold text-ink-3">
                          <input
                            type="checkbox"
                            checked={used}
                            onChange={() => setUsedBatches(used ? usedBatches.filter((b) => b !== i) : [...usedBatches, i])}
                            className="h-3 w-3 accent-[#6d28d9]"
                          />
                          used
                        </label>
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {[["emails", "Emails"], ["bcc", "BCC"], ["phones", "Phones"]].map(([mode, label]) => (
                          <button
                            key={mode}
                            disabled={pack.simulated}
                            onClick={() => doCopy(mode, i)}
                            className={`rounded px-2 py-1 text-[10px] font-bold ${copied?.startsWith(`${mode}:${i}`) ? "bg-emerald-600 text-white" : "bg-brand-soft text-brand hover:bg-[#ece2fa]"} disabled:opacity-50`}
                          >
                            {copied?.startsWith(`${mode}:${i}`) ? "✓" : label}
                          </button>
                        ))}
                        <button
                          disabled={pack.simulated}
                          onClick={() => doDownload("csv", i)}
                          className="rounded bg-[#f0efec] px-2 py-1 text-[10px] font-bold text-ink-2 hover:bg-[#e7e6e1] disabled:opacity-50"
                        >
                          CSV
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-ink-3">
                Splitting off: copies include the whole pack. Turn it on for chunked Gmail/Outlook sends or shared call lists. "Used" ticks save on this browser.
              </p>
            )}
          </div>
        </Card>
      </div>
    </Shell>
  );
}
