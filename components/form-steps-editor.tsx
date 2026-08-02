"use client";

// The multi-step builder: steps, fields, answer→tag maps, skip logic and
// branching, saved atomically to /api/forms/[id]/steps. Fully configurable
// per workspace — nothing here is hard-coded to any one brand's questions.

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui";

type Field = {
  key: string;
  kind: "email" | "text" | "choice" | "multi_choice" | "dropdown" | "yes_no" | "rating" | "nps" | "number_scale";
  label: string;
  options?: string[];
  required?: boolean;
  tagMap?: Record<string, string>;
  propertyKey?: string;
};
type Step = { title?: string; fields: Field[]; rules: string };

const FIELD_KINDS = [
  { v: "email", l: "Email address" }, { v: "text", l: "Text answer" },
  { v: "choice", l: "Single choice" }, { v: "multi_choice", l: "Multiple choice" },
  { v: "dropdown", l: "Dropdown" }, { v: "yes_no", l: "Yes / No" },
  { v: "rating", l: "Star rating" }, { v: "nps", l: "NPS 0-10" },
  { v: "number_scale", l: "Number scale" },
] as const;

export function FormStepsEditor({ formId }: { formId: string }) {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    fetch(`/api/forms/${formId}/steps`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) return setSteps([]);
        setSteps(
          (j.steps as { title: string | null; fields: string; rules: string }[]).map((s) => ({
            title: s.title ?? undefined,
            fields: JSON.parse(s.fields) as Field[],
            rules: s.rules,
          }))
        );
      })
      .catch(() => setSteps([]));
  }, [formId]);

  const set = useCallback((next: Step[]) => { setSteps(next); setDirty(true); }, []);

  if (!steps) return <Card className="h-24 animate-pulse"><span /></Card>;

  const patchStep = (i: number, patch: Partial<Step>) => set(steps.map((s, n) => (n === i ? { ...s, ...patch } : s)));
  const patchField = (si: number, fi: number, patch: Partial<Field>) =>
    patchStep(si, { fields: steps[si].fields.map((f, n) => (n === fi ? { ...f, ...patch } : f)) });

  async function save() {
    setSaving(true);
    try {
      const r = await fetch(`/api/forms/${formId}/steps`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps }),
      });
      const j = await r.json();
      setNotice(j.ok ? `Saved ${j.count} step${j.count === 1 ? "" : "s"}. Live within the tracker's 5-minute cache.` : j.error ?? "Could not save.");
      if (j.ok) setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
  const small = "text-[11px] font-medium text-ink-3";

  return (
    <Card>
      <CardHeader
        title="Multi-step journey"
        subtitle={steps.length === 0 ? "No steps: the form is a simple email capture" : `${steps.length} step${steps.length === 1 ? "" : "s"} · answers can tag, set properties, branch and skip`}
        action={
          <button onClick={save} disabled={saving || !dirty}
            className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-3.5 py-2 text-[13px] font-semibold text-white disabled:opacity-40">
            {saving ? "Saving…" : dirty ? "Save steps" : "Saved"}
          </button>
        }
      />
      <div className="space-y-3 px-5 py-4">
        {notice && <p className="rounded-lg border border-line bg-[#f7f6f4] px-3 py-2 text-[12px] text-ink-2">{notice}</p>}

        {steps.map((s, si) => (
          <div key={si} className="rounded-xl border border-line bg-[#faf9f7] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Step {si + 1}</span>
              <span className="flex gap-1 text-[12px]">
                <button onClick={() => si > 0 && set([...steps.slice(0, si - 1), steps[si], steps[si - 1], ...steps.slice(si + 1)])} className="rounded border border-line px-1.5 hover:border-brand">↑</button>
                <button onClick={() => si < steps.length - 1 && set([...steps.slice(0, si), steps[si + 1], steps[si], ...steps.slice(si + 2)])} className="rounded border border-line px-1.5 hover:border-brand">↓</button>
                <button onClick={() => set([...steps.slice(0, si + 1), JSON.parse(JSON.stringify(steps[si])) as Step, ...steps.slice(si + 1)])} className="rounded border border-line px-1.5 hover:border-brand" title="Duplicate">⧉</button>
                <button onClick={() => set(steps.filter((_, n) => n !== si))} className="rounded border border-red-200 px-1.5 text-red-600" title="Delete">✕</button>
              </span>
            </div>

            <label className="mt-2 block">
              <span className={small}>Step title (optional)</span>
              <input className={input} value={s.title ?? ""} onChange={(e) => patchStep(si, { title: e.target.value || undefined })} />
            </label>

            {s.fields.map((f, fi) => (
              <div key={fi} className="mt-2 rounded-lg border border-line bg-surface p-2.5">
                <div className="flex flex-wrap items-end gap-2">
                  <label className="min-w-[160px] flex-1">
                    <span className={small}>Question</span>
                    <input className={input} value={f.label} onChange={(e) => patchField(si, fi, { label: e.target.value })} />
                  </label>
                  <label>
                    <span className={small}>Type</span>
                    <select className={input} value={f.kind} onChange={(e) => patchField(si, fi, { kind: e.target.value as Field["kind"] })}>
                      {FIELD_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={small}>Key</span>
                    <input className={`${input} w-28`} value={f.key} onChange={(e) => patchField(si, fi, { key: e.target.value.replace(/\W/g, "_").toLowerCase() })} />
                  </label>
                  <label className="flex items-center gap-1.5 pb-2 text-[12px] text-ink-2">
                    <input type="checkbox" checked={f.required ?? false} onChange={(e) => patchField(si, fi, { required: e.target.checked })} className="h-3.5 w-3.5 accent-[#6d28d9]" />
                    Required
                  </label>
                  <button onClick={() => patchStep(si, { fields: s.fields.filter((_, n) => n !== fi) })} className="pb-2 text-[12px] text-red-600 hover:underline">Remove</button>
                </div>

                {["choice", "multi_choice", "dropdown"].includes(f.kind) && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    <label>
                      <span className={small}>Options (one per line)</span>
                      <textarea rows={3} className={input} value={(f.options ?? []).join("\n")}
                        onChange={(e) => patchField(si, fi, { options: e.target.value.split("\n").filter(Boolean) })} />
                    </label>
                    <label>
                      <span className={small}>Answer → tag (one per line: Answer = tag-name)</span>
                      <textarea rows={3} className={input}
                        value={Object.entries(f.tagMap ?? {}).map(([k, v]) => `${k} = ${v}`).join("\n")}
                        onChange={(e) => {
                          const map: Record<string, string> = {};
                          e.target.value.split("\n").forEach((line) => {
                            const [k, v] = line.split("=").map((x) => x.trim());
                            if (k && v) map[k] = v;
                          });
                          patchField(si, fi, { tagMap: map });
                        }} />
                    </label>
                  </div>
                )}
                <label className="mt-2 block">
                  <span className={small}>Store answer as contact property (optional key, feeds audiences)</span>
                  <input className={`${input} sm:w-64`} value={f.propertyKey ?? ""} onChange={(e) => patchField(si, fi, { propertyKey: e.target.value || undefined })} placeholder="e.g. primary_interest" />
                </label>
              </div>
            ))}

            <button
              onClick={() => patchStep(si, { fields: [...s.fields, { key: `q${s.fields.length + 1}`, kind: "choice", label: "New question", options: ["Option A", "Option B"] }] })}
              className="mt-2 rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:border-brand hover:text-brand"
            >
              + Add question
            </button>

            <details className="mt-2">
              <summary className="cursor-pointer text-[12px] font-semibold text-ink-3 hover:text-brand">Branching & skip logic (advanced)</summary>
              <p className="mt-1 text-[11px] text-ink-3">
                Shared rule format, evaluated when this step completes. Example:{" "}
                <code className="font-mono">[{"{"}&quot;if&quot;:{"{"}&quot;field&quot;:&quot;interest&quot;,&quot;op&quot;:&quot;equals&quot;,&quot;value&quot;:&quot;Recovery&quot;{"}"},&quot;then&quot;:[{"{"}&quot;action&quot;:&quot;go_to_step&quot;,&quot;step&quot;:2{"}"}]{"}"}]</code>
              </p>
              <textarea rows={3} className={`${input} font-mono text-[11px]`} value={s.rules}
                onChange={(e) => patchStep(si, { rules: e.target.value })} />
            </details>
          </div>
        ))}

        <button
          onClick={() => set([...steps, { fields: steps.length === 0 ? [{ key: "email", kind: "email", label: "Your email", required: true }] : [], rules: "[]" }])}
          className="w-full rounded-lg border-2 border-dashed border-line px-3 py-2.5 text-[13px] font-semibold text-ink-3 hover:border-brand hover:text-brand"
        >
          + Add step
        </button>

        <p className="text-[11px] leading-relaxed text-ink-3">
          Progress and back buttons are rendered by the storefront tracker automatically for forms with more
          than one step. Answers never grant marketing consent by themselves; only the consent checkbox does.
        </p>
      </div>
    </Card>
  );
}
