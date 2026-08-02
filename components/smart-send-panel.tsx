"use client";

// Smart-send controls on the campaign page: configure, start, and watch a
// gradual send with pause/resume/cancel. Numbers come from send records, so
// sent + queued + failed + suppressed + cancelled always equals the total.

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui";

type Progress = {
  state: string | null; sent: number; queued: number; failed: number;
  suppressed: number; cancelled: number; total: number;
  nextBatchAt: string | null; estimatedCompletionAt: string | null; pauseReason: string | null;
};

const DURATIONS = [
  { v: 15, l: "15 minutes" }, { v: 30, l: "30 minutes" }, { v: 60, l: "1 hour" },
  { v: 120, l: "2 hours" }, { v: 240, l: "4 hours" }, { v: 480, l: "8 hours" },
  { v: 720, l: "12 hours" }, { v: 1440, l: "24 hours" },
];

export function SmartSendPanel({ campaignId, sent }: { campaignId: string; sent: boolean }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [mode, setMode] = useState<"immediate" | "gradual">("gradual");
  const [duration, setDuration] = useState(60);
  const [batchSize, setBatchSize] = useState(100);
  const [useWindow, setUseWindow] = useState(false);
  const [windowStart, setWindowStart] = useState(9);
  const [windowEnd, setWindowEnd] = useState(20);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/campaigns/${campaignId}/smart-send`)
      .then((r) => r.json()).then((j) => j.ok && setProgress(j.progress)).catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}/smart-send`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json();
      if (!j.ok) setNotice(j.error ?? "Failed.");
      load();
    } finally {
      setBusy(false);
    }
  }

  const running = progress?.state === "running" || progress?.state === "paused";
  const finished = progress?.state === "complete" || progress?.state === "cancelled";
  const pct = progress && progress.total > 0 ? Math.round(((progress.sent + progress.failed + progress.suppressed + progress.cancelled) / progress.total) * 100) : 0;

  if (sent && !running && !finished) return null; // legacy sent campaign, nothing to control

  return (
    <Card className="mt-3">
      <CardHeader
        title="Sending"
        subtitle={
          finished ? `Finished · ${progress?.sent ?? 0} delivered`
          : running ? `${progress?.state === "paused" ? "Paused" : "Sending"} · ${pct}% processed`
          : "Immediate, or spread gradually through backend batches"
        }
      />
      <div className="px-5 py-4">
        {notice && <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{notice}</p>}

        {!running && !finished && (
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="text-[11px] font-medium text-ink-3">Mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as never)} className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-[13px]">
                <option value="gradual">Gradual (recommended)</option>
                <option value="immediate">Immediate</option>
              </select>
            </label>
            {mode === "gradual" && (
              <>
                <label>
                  <span className="text-[11px] font-medium text-ink-3">Spread over</span>
                  <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-[13px]">
                    {DURATIONS.map((d) => <option key={d.v} value={d.v}>{d.l}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-[11px] font-medium text-ink-3">Batch size</span>
                  <select value={batchSize} onChange={(e) => setBatchSize(Number(e.target.value))} className="mt-1 block rounded-lg border border-line bg-surface px-3 py-2 text-[13px]">
                    {[100, 500, 1000].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <label className="flex items-center gap-1.5 pb-2.5 text-[12px] text-ink-2">
                  <input type="checkbox" checked={useWindow} onChange={(e) => setUseWindow(e.target.checked)} className="h-3.5 w-3.5 accent-[#6d28d9]" />
                  Only send between
                </label>
                {useWindow && (
                  <>
                    <select value={windowStart} onChange={(e) => setWindowStart(Number(e.target.value))} className="mb-0.5 rounded-lg border border-line bg-surface px-2 py-2 text-[13px]">
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                    </select>
                    <select value={windowEnd} onChange={(e) => setWindowEnd(Number(e.target.value))} className="mb-0.5 rounded-lg border border-line bg-surface px-2 py-2 text-[13px]">
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>)}
                    </select>
                  </>
                )}
              </>
            )}
            <button
              onClick={() => act({ action: "start", mode, durationMins: duration, batchSize, windowStart: useWindow ? windowStart : null, windowEnd: useWindow ? windowEnd : null })}
              disabled={busy}
              className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-5 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Starting…" : mode === "gradual" ? "Start gradual send" : "Send now"}
            </button>
          </div>
        )}

        {progress && (running || finished) && (
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-[#f0efec]">
              <div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9] transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-2">
              <span><strong>{progress.sent}</strong> sent</span>
              <span><strong>{progress.queued}</strong> queued</span>
              <span><strong>{progress.failed}</strong> failed</span>
              <span><strong>{progress.suppressed}</strong> suppressed</span>
              {progress.cancelled > 0 && <span><strong>{progress.cancelled}</strong> cancelled</span>}
              {progress.estimatedCompletionAt && progress.state === "running" && (
                <span className="text-ink-3">Est. completion {new Date(progress.estimatedCompletionAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </div>
            {progress.pauseReason && (
              <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">{progress.pauseReason}</p>
            )}
            {running && (
              <div className="mt-3 flex gap-2">
                {progress.state === "running" ? (
                  <button onClick={() => act({ action: "pause" })} disabled={busy} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold hover:border-brand hover:text-brand">Pause</button>
                ) : (
                  <button onClick={() => act({ action: "resume" })} disabled={busy} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold hover:border-brand hover:text-brand">Resume</button>
                )}
                <button
                  onClick={() => window.confirm("Cancel the remaining sends? Already-delivered emails are unaffected.") && act({ action: "cancel" })}
                  disabled={busy}
                  className="rounded-lg border border-red-300 px-3.5 py-2 text-[13px] font-semibold text-red-700 hover:bg-red-50"
                >
                  Cancel remaining
                </button>
              </div>
            )}
            <p className="mt-3 text-[11px] leading-relaxed text-ink-3">
              Every batch re-checks unsubscribes, suppression and consent before sending, and pauses itself if
              bounce or complaint rates cross the safety thresholds. Batches run server-side on the platform tick.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
