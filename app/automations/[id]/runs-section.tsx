"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";

// The debugging table: one row per contact who entered the workflow, with the
// run's diary behind an expander. Every string arrives pre-formatted from the
// server component; this file only filters, expands and stops.

export interface RunEventView {
  id: string;
  /** When the event happened, already formatted. */
  when: string;
  /** The timeline line, e.g. "Waiting until 26 Aug 14:00". */
  text: string;
  /** Secondary muted context, e.g. the step label and provider. */
  detail?: string;
}

export interface RunView {
  id: string;
  contact: string;
  status: "Running" | "Completed" | "Stopped";
  /** Label of the step the run last executed or is parked on. */
  step: string;
  /** For waiting runs: when the next step is due, already formatted. */
  nextDue?: string;
  /** Plain-English reason, only for stopped runs. */
  stoppedReason?: string;
  started: string;
  ended?: string;
  /** Diary lines, oldest first (newest last, as read). */
  events: RunEventView[];
}

const TABS = ["All", "Running", "Completed", "Stopped"] as const;
type Tab = (typeof TABS)[number];

const statusChip: Record<RunView["status"], string> = {
  Running: "bg-blue-50 text-blue-700 border-blue-200",
  Completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  Stopped: "bg-zinc-100 text-zinc-600 border-zinc-200",
};

export function RunsSection({
  automationId,
  runs,
  totalRuns,
}: {
  automationId: string;
  runs: RunView[];
  totalRuns: number;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("All");
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const countFor = (t: Tab) => (t === "All" ? runs.length : runs.filter((r) => r.status === t).length);
  const visible = tab === "All" ? runs : runs.filter((r) => r.status === tab);

  const stop = async (run: RunView) => {
    if (
      !window.confirm(
        `Stop this run for ${run.contact}? They will receive no further emails from this workflow.`,
      )
    )
      return;
    setBusy(run.id);
    try {
      const res = await fetch(`/api/automations/${automationId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "stop", runId: run.id }),
      });
      if ((await res.json()).ok) router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">Runs</h2>
          <p className="mt-0.5 text-xs text-ink-3">
            One row per contact. Expand a row for its full history.
            {totalRuns > runs.length ? ` Showing the latest ${runs.length} of ${totalRuns} runs.` : ""}
          </p>
        </div>
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                tab === t ? "bg-[#f0efec] text-ink" : "text-ink-3 hover:text-ink-2"
              }`}
            >
              {t} <span className="tabular font-normal">{countFor(t)}</span>
            </button>
          ))}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="px-5 py-6 text-sm text-ink-3">
          {runs.length === 0
            ? "Nobody has entered this workflow yet. Runs appear here the moment the trigger fires."
            : `No ${tab.toLowerCase()} runs in the latest ${runs.length}.`}
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((run) => {
            const expanded = Boolean(open[run.id]);
            return (
              <li key={run.id}>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3">
                  <button
                    onClick={() => setOpen((o) => ({ ...o, [run.id]: !o[run.id] }))}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={expanded}
                  >
                    <span className="w-3 shrink-0 text-[10px] text-ink-3">{expanded ? "▼" : "▶"}</span>
                    <span className="min-w-0 truncate text-[13px] font-semibold">{run.contact}</span>
                    <span
                      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusChip[run.status]}`}
                    >
                      {run.status}
                    </span>
                    <span className="min-w-0 truncate text-xs text-ink-3">
                      {run.status === "Stopped" && run.stoppedReason
                        ? run.stoppedReason
                        : run.nextDue
                          ? `${run.step} · next due ${run.nextDue}`
                          : run.step}
                    </span>
                  </button>
                  <span className="tabular shrink-0 text-xs text-ink-3">
                    {run.started}
                    {run.ended ? ` → ${run.ended}` : ""}
                  </span>
                  {run.status === "Running" && (
                    <button
                      disabled={busy === run.id}
                      onClick={() => stop(run)}
                      className="shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      {busy === run.id ? "…" : "Stop run"}
                    </button>
                  )}
                </div>
                {expanded && (
                  <div className="border-t border-line bg-[#fafaf8] px-5 py-3.5 pl-12">
                    {run.events.length === 0 ? (
                      <p className="text-xs text-ink-3">
                        No history recorded. This run started before run history existed.
                      </p>
                    ) : (
                      <ol className="space-y-1.5">
                        {run.events.map((e) => (
                          <li key={e.id} className="flex flex-wrap items-baseline gap-x-3 text-xs">
                            <span className="tabular w-28 shrink-0 text-ink-3">{e.when}</span>
                            <span className="font-medium">{e.text}</span>
                            {e.detail && <span className="text-ink-3">{e.detail}</span>}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
