"use client";

// Universal Inbox: paste anything → deterministic extraction → review →
// approve into real contacts/sources/tasks. No LLM; the extraction is
// rule-based and says so.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

export type RecordView = {
  id: string;
  status: string;
  confidence: number;
  duplicateOf: string | null;
  contactId: string | null;
  fields: { name?: string; email?: string; phone?: string; interests: string[]; taskNote?: string; taskDue?: string; notes?: string };
};

export type IntakeItemView = {
  id: string;
  kind: string;
  title: string;
  raw: string;
  status: string;
  confidence: number;
  when: string;
  records: RecordView[];
};

const kindIcon: Record<string, string> = { paste: "⌘V", whatsapp: "◎", email: "✉", note: "✎", file: "⇪", form: "▤", api: "↯" };
const statusChip: Record<string, string> = {
  review: "bg-amber-50 text-amber-700",
  partial: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-zinc-100 text-zinc-500",
  received: "bg-blue-50 text-blue-700",
};

const SAMPLE = `Maria +34 600 123 456 asked about NAD+ and weight loss consultation. Call tomorrow.

James Whitlow james.whitlow@gmail.com wants the sleep stack, mentioned magnesium. Interested in a subscription.`;

function confColor(c: number) {
  return c >= 75 ? "text-emerald-700" : c >= 55 ? "text-amber-700" : "text-red-700";
}

export function InboxClient({ items }: { items: IntakeItemView[] }) {
  const router = useRouter();
  const [kind, setKind] = useState<"paste" | "whatsapp" | "email" | "note">("paste");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  async function extract() {
    setBusy(true);
    try {
      const res = await fetch("/api/intake", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, text }),
      });
      const json = await res.json();
      if (json.ok) {
        setText("");
        setFlash(`Extracted ${json.records.length} record${json.records.length === 1 ? "" : "s"} · ready to review below`);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  async function act(recordId: string, action: "approve" | "reject") {
    setActing(recordId);
    try {
      const res = await fetch(`/api/intake/records/${recordId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.ok && action === "approve") {
        setFlash(json.merged ? "Merged into existing contact · source ledger updated" : `Contact created${json.taskId ? " + sales task" : ""} · consent held as pending`);
      }
      router.refresh();
    } finally {
      setActing(null);
    }
  }

  const pending = items.filter((i) => i.status === "review" || i.status === "partial");
  const processed = items.filter((i) => i.status !== "review" && i.status !== "partial");

  return (
    <Shell
      title="Universal Inbox"
      subtitle="Whatever data you have, Sendloom organises it · paste, forward or upload, then approve"
      actions={<Link href="/imports" className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">File uploads →</Link>}
    >
      {flash && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>{flash}</span>
          <button onClick={() => setFlash(null)} className="text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Paste Anything */}
        <Card className="xl:col-span-2">
          <CardHeader
            title="Paste anything"
            subtitle="Names, numbers, WhatsApp messages, enquiry emails, call notes · rule-based extraction, no data invented"
          />
          <div className="px-5 py-4">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {([["paste", "Pasted text"], ["whatsapp", "WhatsApp forward"], ["email", "Email forward"], ["note", "Manual note"]] as const).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold ${kind === k ? "bg-brand text-white" : "bg-[#f0efec] text-ink-2 hover:bg-[#e7e6e1]"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              placeholder={'e.g. "Maria +34 600 123 456 asked about NAD+ and weight loss consultation. Call tomorrow."'}
              className="w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-3 focus:border-brand"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                disabled={busy || text.trim().length < 3}
                onClick={extract}
                className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
              >
                {busy ? "Extracting…" : "Extract data"}
              </button>
              <button onClick={() => setText(SAMPLE)} className="text-[13px] font-semibold text-brand hover:underline">
                Try the sample (2 messy leads)
              </button>
              <span className="text-xs text-ink-3">Separate multiple leads with a blank line.</span>
            </div>
          </div>
        </Card>

        {/* Capture routes */}
        <Card className="self-start">
          <CardHeader title="Ways in" subtitle="Every route lands here for review" />
          <ul className="divide-y divide-line text-[13px]">
            {[
              ["⌘V", "Paste anything", "Live", "text-emerald-700"],
              ["⇪", "File upload (CSV)", "Live · Data Uploads", "text-emerald-700"],
              ["▤", "Forms & quizzes", "Live", "text-emerald-700"],
              ["↯", "API / webhook", "Live · /api/v1/events", "text-emerald-700"],
              ["◎", "WhatsApp relay webhook", "Endpoint live · number pending", "text-emerald-700"],
              ["✉", "Email-in relay webhook", "Endpoint live · address pending", "text-emerald-700"],
            ].map(([icon, label, state, tone]) => (
              <li key={label as string} className="flex items-center justify-between px-5 py-2.5">
                <span className="flex items-center gap-2.5 font-medium"><span className="w-6 text-center text-ink-3">{icon}</span>{label}</span>
                <span className={`text-xs font-semibold ${tone}`}>{state}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Review queue */}
      <h2 className="mb-3 mt-6 text-sm font-semibold">Needs review · {pending.length}</h2>
      {pending.length === 0 && (
        <Card className="px-5 py-8 text-center text-sm text-ink-3">Nothing waiting. Paste something above to see extraction live.</Card>
      )}
      <div className="space-y-4">
        {pending.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-9 items-center justify-center rounded-md bg-[#f0efec] text-[11px] font-bold text-ink-2">{kindIcon[item.kind] ?? "⇪"}</span>
                <div>
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="text-[11px] text-ink-3">{item.when} · {item.records.length} record{item.records.length === 1 ? "" : "s"} · avg confidence <span className={confColor(item.confidence)}>{item.confidence}%</span></p>
                </div>
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusChip[item.status]}`}>{item.status}</span>
            </div>
            <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-2">
              <div className="rounded-lg bg-[#fafaf8] px-4 py-3">
                <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Original</p>
                <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{item.raw}</p>
              </div>
              <div className="space-y-3">
                {item.records.map((r) => (
                  <div key={r.id} className={`rounded-lg border px-4 py-3 ${r.status === "pending" ? "border-line" : "border-line opacity-60"}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      {r.fields.name && <span className="rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">{r.fields.name}</span>}
                      {r.fields.email && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{r.fields.email}</span>}
                      {r.fields.phone && <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">{r.fields.phone}</span>}
                      {r.fields.interests.map((i) => (
                        <span key={i} className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{i}</span>
                      ))}
                      {r.fields.taskNote && <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Task: {r.fields.taskNote}{r.fields.taskDue ? ` · ${r.fields.taskDue}` : ""}</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-bold ${confColor(r.confidence)}`}>{r.confidence}% confidence</span>
                      {r.duplicateOf && <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-700">Possible duplicate · approving merges</span>}
                      {!r.fields.email && <span className="text-ink-3">No email → consent stays pending, no marketing</span>}
                    </div>
                    {r.status === "pending" ? (
                      <div className="mt-3 flex gap-2">
                        <button
                          disabled={acting === r.id}
                          onClick={() => act(r.id, "approve")}
                          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
                        >
                          {acting === r.id ? "Working…" : r.duplicateOf ? "Approve & merge" : "Approve → create contact"}
                        </button>
                        <button
                          disabled={acting === r.id}
                          onClick={() => act(r.id, "reject")}
                          className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs font-semibold capitalize text-ink-3">
                        {r.status}{r.contactId && (
                          <> · <Link href={`/subscribers/${r.contactId}`} className="text-brand hover:underline">open contact →</Link></>
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Processed feed */}
      {processed.length > 0 && (
        <>
          <h2 className="mb-3 mt-6 text-sm font-semibold">Processed</h2>
          <Card>
            <ul className="divide-y divide-line">
              {processed.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-8 shrink-0 items-center justify-center rounded bg-[#f0efec] text-[10px] font-bold text-ink-2">{kindIcon[item.kind] ?? "⇪"}</span>
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-medium">{item.title}</p>
                      <p className="text-[11px] text-ink-3">{item.when} · {item.records.filter((r) => r.contactId).length} contact(s) created/merged</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.records.filter((r) => r.contactId).slice(0, 1).map((r) => (
                      <Link key={r.id} href={`/subscribers/${r.contactId}`} className="text-xs font-semibold text-brand hover:underline">open contact →</Link>
                    ))}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize ${statusChip[item.status]}`}>{item.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </Shell>
  );
}
