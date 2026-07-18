"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";
import type { SalesTask } from "@/lib/data";

const prioChip: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-zinc-100 text-zinc-600",
};

export function TasksClient({ tasks }: { tasks: SalesTask[] }) {
  const router = useRouter();
  const [completing, setCompleting] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ type: "Call lead", contactLabel: "", note: "", priority: "medium", assigneeLabel: "Will", dueInDays: 1 });
  const [busy, setBusy] = useState(false);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      if ((await res.json()).ok) {
        setCreating(false);
        setForm({ type: "Call lead", contactLabel: "", note: "", priority: "medium", assigneeLabel: "Will", dueInDays: 1 });
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  const [sheetFlash, setSheetFlash] = useState<string | null>(null);

  async function copyTaskSheet(mode: "call_sheet" | "whatsapp") {
    const res = await fetch("/api/packs", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: `Open tasks ${new Date().toLocaleDateString("en-GB")}`, from: "tasks" }),
    });
    const json = await res.json();
    if (!json.ok) { setSheetFlash(json.error ?? "No linked contacts on open tasks yet"); return; }
    const r = await fetch(`/api/packs/${json.id}/render`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const j = await r.json();
    if (j.ok) {
      await navigator.clipboard.writeText(j.text);
      setSheetFlash(`Copied ${mode === "call_sheet" ? "call sheet" : "WhatsApp list"} · ${j.count} contacts · saved as pack`);
      setTimeout(() => setSheetFlash(null), 3500);
    } else {
      setSheetFlash(j.error);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    router.refresh();
  }

  const open = tasks.filter((t) => t.status !== "done");

  async function complete(id: string) {
    setCompleting(id);
    try {
      await fetch(`/api/tasks/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      router.refresh();
    } finally {
      setCompleting(null);
    }
  }

  return (
    <Shell
      title="Sales Tasks"
      subtitle="Live from the database · created manually or by automation nodes"
      actions={
        <>
          <button onClick={() => copyTaskSheet("call_sheet")} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Copy call sheet</button>
          <button onClick={() => copyTaskSheet("whatsapp")} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Copy WhatsApp list</button>
          <button onClick={() => setCreating(true)} className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6]">
            New task
          </button>
        </>
      }
    >
      {sheetFlash && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{sheetFlash}</div>
      )}
      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setCreating(false)}>
          <form onSubmit={createTask} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">New sales task</h2>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-ink-3">Task</span>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand">
                {["Call lead", "WhatsApp follow-up", "Review prospect", "Check consent", "Send manual quote", "Send consultation link"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-ink-3">Who *</span>
              <input required value={form.contactLabel} onChange={(e) => setForm({ ...form, contactLabel: e.target.value })} placeholder="Contact name" className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-ink-3">Note</span>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
            </label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Priority</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-brand">
                  <option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Assignee</span>
                <select value={form.assigneeLabel} onChange={(e) => setForm({ ...form, assigneeLabel: e.target.value })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-brand">
                  {["Will", "Steve", "Hannah", "Clinic team", "Unassigned"].map((o) => <option key={o}>{o}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Due</span>
                <select value={form.dueInDays} onChange={(e) => setForm({ ...form, dueInDays: Number(e.target.value) })} className="mt-1 w-full rounded-lg border border-line bg-surface px-2 py-2 text-sm outline-none focus:border-brand">
                  <option value={0}>Today</option><option value={1}>Tomorrow</option><option value={7}>Next week</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setCreating(false)} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">{busy ? "Saving…" : "Create task"}</button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={`Open tasks · ${open.length}`} subtitle="Overdue first, then by priority" />
          <ul className="divide-y divide-line">
            {[...open]
              .sort((a, b) => (b.status === "overdue" ? 1 : 0) - (a.status === "overdue" ? 1 : 0) || (a.priority === "high" ? -1 : 1))
              .map((t) => (
                <li key={t.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[#fafaf8]">
                  <button
                    onClick={() => complete(t.id)}
                    disabled={completing === t.id}
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-40"
                    aria-label="Mark done"
                  >
                    ✓
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold">{t.type}</p>
                      <span className="text-sm text-ink-2">·</span>
                      {t.contactId ? (
                        <Link href={`/subscribers/${t.contactId}`} className="text-sm font-medium text-brand hover:underline">{t.contact}</Link>
                      ) : (
                        <span className="text-sm font-medium">{t.contact}</span>
                      )}
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${prioChip[t.priority]}`}>{t.priority}</span>
                      {t.status === "overdue" && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold uppercase text-red-700">Overdue</span>}
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">{t.note}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {t.source && (
                        <span className="rounded-full bg-[#f0efec] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                          via {t.source === "intake" ? "Universal Inbox" : t.source === "automation" ? "automation" : t.source === "score_threshold" ? "lead score" : t.source}
                        </span>
                      )}
                      {t.contactId && (
                        <Link href={`/subscribers/${t.contactId}`} className="text-[11px] font-semibold text-brand hover:underline">Open profile</Link>
                      )}
                      <Link href="/campaigns/new" className="text-[11px] font-semibold text-brand hover:underline">Draft email</Link>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold">{t.due}</p>
                    <p className="mt-0.5 text-[11px] text-ink-3">{t.assignee}</p>
                    <button onClick={() => remove(t.id)} className="mt-1 text-[10px] font-semibold text-ink-3 hover:text-[#d03b3b]" title="Delete demo task">
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            {open.length === 0 && <li className="px-5 py-10 text-center text-sm text-ink-3">All clear.</li>}
          </ul>
        </Card>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="Task sources" />
            <div className="space-y-2.5 px-5 py-4 text-[13px]">
              {[
                ["Automation nodes", "Consultation follow-up creates 'Call lead' at score 70+"],
                ["Lead score triggers", "Score crosses 70 without purchase"],
                ["Manual", "Created from contact profiles"],
              ].map(([k, d]) => (
                <div key={k} className="rounded-lg border border-line px-3.5 py-2.5">
                  <p className="font-semibold">{k}</p>
                  <p className="mt-0.5 text-xs text-ink-3">{d}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="Completed" subtitle="This session" />
            <p className="px-5 py-4 text-sm text-ink-2">
              {tasks.filter((t) => t.status === "done").length} tasks marked done. Completion writes straight to the database.
            </p>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
