"use client";

import { useState } from "react";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

const AREAS = ["Dashboard", "Universal Inbox", "Data Uploads", "Contacts", "Audience Builder", "Campaigns", "Demand Radar", "Prospect Discovery", "Sales Tasks", "Analytics", "Admin", "Navigation / overall"];

const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export default function FeedbackPage() {
  const [form, setForm] = useState({ area: AREAS[0], workedWell: "", confusing: "", missing: "", improve: "", priority: "medium", notes: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const json = await res.json();
      if (json.ok) {
        setSent(true);
        setForm({ area: AREAS[0], workedWell: "", confusing: "", missing: "", improve: "", priority: "medium", notes: "" });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Feedback" subtitle="Saved to the staging database and read before every sprint · brutal honesty welcome">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Tell us what you found" />
          <form onSubmit={submit} className="space-y-4 px-5 py-4">
            {sent && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
                Saved. Thank you, send as many of these as you like.
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Area of the platform</span>
                <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className={field}>
                  {AREAS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Priority</span>
                <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className={field}>
                  <option value="low">Low · polish</option>
                  <option value="medium">Medium · friction</option>
                  <option value="high">High · blocks me</option>
                </select>
              </label>
            </div>
            {([
              ["workedWell", "What worked well?"],
              ["confusing", "What confused you?"],
              ["missing", "What felt missing?"],
              ["improve", "What should be improved first?"],
              ["notes", "Anything else"],
            ] as const).map(([key, label]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-ink-3">{label}</span>
                <textarea
                  rows={2}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className={field}
                />
              </label>
            ))}
            <button type="submit" disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">
              {busy ? "Saving…" : "Submit feedback"}
            </button>
          </form>
        </Card>
        <Card className="self-start">
          <CardHeader title="Prefer to message it?" subtitle="Copy this template into WhatsApp or email" />
          <pre className="whitespace-pre-wrap px-5 py-4 text-xs leading-relaxed text-ink-2">{`Area:
What worked:
What confused me:
What's missing:
Fix first:
Priority (low/med/high):`}</pre>
        </Card>
      </div>
    </Shell>
  );
}
