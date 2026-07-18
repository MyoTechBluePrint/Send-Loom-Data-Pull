"use client";

import Link from "next/link";
import { useState } from "react";
import { Shell, GhostButton, PrimaryButton } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";
import { salesTasks } from "@/lib/data";

const prioChip: Record<string, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-zinc-100 text-zinc-600",
};

export default function TasksPage() {
  const [done, setDone] = useState<string[]>([]);

  const open = salesTasks.filter((t) => !done.includes(t.id));
  const completed = salesTasks.filter((t) => done.includes(t.id));

  return (
    <Shell
      title="Sales Tasks"
      subtitle="Human follow-up where email alone isn't enough · created manually or by automation nodes"
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
            {[...open].sort((a, b) => (a.status === "overdue" ? -1 : 0) - (b.status === "overdue" ? -1 : 0) || (a.priority === "high" ? -1 : 1)).map((t) => (
              <li key={t.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[#fafaf8]">
                <button
                  onClick={() => setDone([...done, t.id])}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-line text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-500"
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
          {completed.length > 0 && (
            <div className="border-t border-line px-5 py-3">
              <p className="text-xs font-semibold text-ink-3">Completed just now: {completed.map((t) => t.type + " · " + t.contact).join(", ")}</p>
            </div>
          )}
        </Card>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="Task sources" />
            <div className="space-y-2.5 px-5 py-4 text-[13px]">
              {[
                ["Automation nodes", "3 tasks this week", "Consultation follow-up creates 'Call lead' at score 70+"],
                ["Lead score triggers", "2 tasks this week", "Score crosses 70 without purchase"],
                ["Manual", "1 task this week", "Created from contact profiles"],
              ].map(([k, v, d]) => (
                <div key={k} className="rounded-lg border border-line px-3.5 py-2.5">
                  <div className="flex justify-between">
                    <span className="font-semibold">{k}</span>
                    <span className="text-xs text-ink-2">{v}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-ink-3">{d}</p>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader title="This week" />
            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              {[["Tasks completed", "14"], ["Consultations booked", "6"], ["Revenue from tasked leads", "£3,240"], ["Avg. response time", "3.1h"]].map(([k, v]) => (
                <div key={k}>
                  <p className="text-[11px] font-medium text-ink-3">{k}</p>
                  <p className="tabular mt-0.5 text-lg font-semibold">{v}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
