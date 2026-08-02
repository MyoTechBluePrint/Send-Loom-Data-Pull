"use client";

// Poll management and results: create a question, map each answer to a tag or
// contact property, drop the poll into an email with its ID, and watch the
// answer distribution land here.

import { useCallback, useEffect, useState } from "react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

type Option = { key: string; label: string; tag?: string; propertyKey?: string; answers: number; percent: number };
type Poll = { id: string; question: string; createdAt: string; totalAnswers: number; options: Option[] };

export default function PollsPage() {
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState("");
  const [rows, setRows] = useState([{ label: "", tag: "" }, { label: "", tag: "" }]);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/polls").then((r) => r.json()).then((j) => j.ok && setPolls(j.polls)).catch(() => setPolls([]));
  }, []);
  useEffect(load, [load]);

  async function create() {
    const options = rows.filter((r) => r.label.trim()).map((r) => ({ label: r.label.trim(), tag: r.tag.trim() || undefined }));
    const r = await fetch("/api/polls", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, options }),
    });
    const j = await r.json();
    setNotice(j.ok ? `Created. Add a Poll block in the email editor and pick "${question}".` : j.error ?? "Could not create.");
    if (j.ok) { setCreating(false); setQuestion(""); setRows([{ label: "", tag: "" }, { label: "", tag: "" }]); load(); }
  }

  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";

  return (
    <Shell
      title="Polls"
      subtitle="One-click questions inside emails · answers tag contacts and feed audiences"
      actions={<span onClick={() => setCreating((v) => !v)}><PrimaryButton>New poll</PrimaryButton></span>}
    >
      {notice && <p className="mb-4 rounded-lg border border-line bg-[#f7f6f4] px-4 py-2.5 text-[13px] text-ink-2">{notice}</p>}

      {creating && (
        <Card className="mb-4">
          <CardHeader title="New poll" subtitle="Each answer can apply a tag so audiences update the moment someone clicks" />
          <div className="px-5 py-4">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Question</span>
              <input className={input} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="What are you most interested in?" />
            </label>
            <div className="mt-3 space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[180px] flex-1">
                    <span className="text-[11px] font-medium text-ink-3">Answer {i + 1}</span>
                    <input className={input} value={r.label} onChange={(e) => setRows(rows.map((x, n) => (n === i ? { ...x, label: e.target.value } : x)))} />
                  </label>
                  <label className="min-w-[160px]">
                    <span className="text-[11px] font-medium text-ink-3">Tag to apply (optional)</span>
                    <input className={input} value={r.tag} onChange={(e) => setRows(rows.map((x, n) => (n === i ? { ...x, tag: e.target.value } : x)))} placeholder="interest:recovery" />
                  </label>
                  {rows.length > 2 && (
                    <button onClick={() => setRows(rows.filter((_, n) => n !== i))} className="pb-2 text-[12px] text-red-600 hover:underline">Remove</button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              {rows.length < 8 && (
                <button onClick={() => setRows([...rows, { label: "", tag: "" }])} className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
                  + Add answer
                </button>
              )}
              <button onClick={create} disabled={!question.trim() || rows.filter((r) => r.label.trim()).length < 2}
                className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40">
                Create poll
              </button>
            </div>
          </div>
        </Card>
      )}

      {!polls ? (
        <div className="h-40 animate-pulse rounded-xl border border-line bg-black/[0.02]" />
      ) : polls.length === 0 ? (
        <Card>
          <p className="px-5 py-10 text-center text-[13px] text-ink-3">
            No polls yet. Create one, then insert it in any campaign email with the Poll block — every answer
            is a signed one-click link that tags the contact instantly.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {polls.map((p) => (
            <Card key={p.id}>
              <CardHeader
                title={p.question}
                subtitle={`${p.totalAnswers} answer${p.totalAnswers === 1 ? "" : "s"} · id `}
                action={<code className="rounded bg-[#f0efec] px-2 py-1 font-mono text-[11px]">{p.id}</code>}
              />
              <div className="space-y-2.5 px-5 py-4">
                {p.options.map((o) => (
                  <div key={o.key}>
                    <div className="flex items-baseline justify-between text-[13px]">
                      <span className="font-medium">{o.label}</span>
                      <span className="text-ink-3">
                        {o.answers} · {o.percent}%{o.tag ? ` · tags "${o.tag}"` : ""}
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-[#f0efec]">
                      <div className="h-full rounded-full bg-gradient-to-r from-[#8b5cf6] to-[#6d28d9]" style={{ width: `${Math.max(2, o.percent)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </Shell>
  );
}
