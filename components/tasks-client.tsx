"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
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
          <GhostButton>Filter: All assignees ▾</GhostButton>
          <PrimaryButton>New task</PrimaryButton>
        </>
      }
    >
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
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-xs font-semibold">{t.due}</p>
                    <p className="mt-0.5 text-[11px] text-ink-3">{t.assignee}</p>
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
