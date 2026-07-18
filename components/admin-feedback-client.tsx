"use client";

// Owner feedback triage: filter, status, notes, convert to task.
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui";

export type FeedbackView = {
  id: string;
  status: string;
  area: string;
  priority: string;
  author: string;
  when: string;
  internalNote: string | null;
  workedWell: string | null;
  confusing: string | null;
  missing: string | null;
  improve: string | null;
  notes: string | null;
};

const statusChip: Record<string, string> = {
  new: "bg-blue-50 text-blue-700",
  reviewed: "bg-amber-50 text-amber-700",
  actioned: "bg-emerald-50 text-emerald-700",
  rejected: "bg-zinc-100 text-zinc-500",
};

const prioChip: Record<string, string> = {
  high: "bg-red-50 text-red-700", medium: "bg-amber-50 text-amber-700", low: "bg-zinc-100 text-zinc-600",
};

const sel = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 outline-none focus:border-brand";

export function AdminFeedbackClient({ items, canTriage }: { items: FeedbackView[]; canTriage: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [area, setArea] = useState("all");
  const [author, setAuthor] = useState("all");
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const areas = useMemo(() => [...new Set(items.map((i) => i.area))], [items]);
  const authors = useMemo(() => [...new Set(items.map((i) => i.author))], [items]);

  const filtered = items.filter((i) =>
    (status === "all" || i.status === status) &&
    (priority === "all" || i.priority === priority) &&
    (area === "all" || i.area === area) &&
    (author === "all" || i.author === author)
  );

  async function patch(id: string, body: object) {
    setBusy(id);
    try {
      await fetch(`/api/feedback/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function toTask(id: string) {
    setBusy(id);
    try {
      await fetch(`/api/feedback/${id}/task`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="mt-4">
      <CardHeader
        title={`Team feedback · ${filtered.length}`}
        subtitle={canTriage ? "Triage: set status, add notes, convert to tasks" : "Read-only · triage is owner-only"}
      />
      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={sel}>
          <option value="all">Status: all</option>
          {["new", "reviewed", "actioned", "rejected"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className={sel}>
          <option value="all">Priority: all</option>
          {["high", "medium", "low"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={area} onChange={(e) => setArea(e.target.value)} className={sel}>
          <option value="all">Area: all</option>
          {areas.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={author} onChange={(e) => setAuthor(e.target.value)} className={sel}>
          <option value="all">Author: all</option>
          {authors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {filtered.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-ink-3">No feedback matches these filters. New submissions land here automatically.</p>
      ) : (
        <ul className="divide-y divide-line">
          {filtered.map((f) => (
            <li key={f.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusChip[f.status]}`}>{f.status}</span>
                <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-[11px] font-bold text-brand">{f.area}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${prioChip[f.priority]}`}>{f.priority}</span>
                <span className="text-[11px] text-ink-3">{f.author} · {f.when}</span>
              </div>
              <div className="mt-1.5 space-y-1 text-[13px] text-ink-2">
                {f.workedWell && <p><span className="font-semibold text-emerald-700">Worked:</span> {f.workedWell}</p>}
                {f.confusing && <p><span className="font-semibold text-amber-700">Confusing:</span> {f.confusing}</p>}
                {f.missing && <p><span className="font-semibold">Missing:</span> {f.missing}</p>}
                {f.improve && <p><span className="font-semibold text-brand">Improve:</span> {f.improve}</p>}
                {f.notes && <p><span className="font-semibold">Notes:</span> {f.notes}</p>}
                {f.internalNote && <p className="rounded-lg bg-[#fafaf8] px-2.5 py-1.5 text-xs"><span className="font-bold text-ink-3">Internal:</span> {f.internalNote}</p>}
              </div>
              {canTriage && (
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {["reviewed", "actioned", "rejected"].filter((s) => s !== f.status).map((s) => (
                    <button key={s} disabled={busy === f.id} onClick={() => patch(f.id, { status: s })} className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold capitalize text-ink-2 hover:bg-[#f0efec] disabled:opacity-50">
                      Mark {s}
                    </button>
                  ))}
                  <button disabled={busy === f.id} onClick={() => toTask(f.id)} className="rounded-lg bg-brand-soft px-2.5 py-1 text-[11px] font-bold text-brand hover:bg-[#ece2fa] disabled:opacity-50">
                    Convert to task
                  </button>
                  {noteFor === f.id ? (
                    <span className="flex min-w-64 flex-1 gap-1.5">
                      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note…" className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-1 text-xs outline-none focus:border-brand" />
                      <button
                        disabled={!note.trim() || busy === f.id}
                        onClick={async () => { await patch(f.id, { internalNote: note.trim() }); setNote(""); setNoteFor(null); }}
                        className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                    </span>
                  ) : (
                    <button onClick={() => { setNoteFor(f.id); setNote(f.internalNote ?? ""); }} className="rounded-lg border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]">
                      {f.internalNote ? "Edit note" : "Add note"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
