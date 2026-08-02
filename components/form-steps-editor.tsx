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

type SimpleRule = { if: { field: string; op: string; value: string }; then: { action: string; step?: number; tag?: string; key?: string; value?: string; message?: string }[] };

/** No-code branching: structured rows over the shared rule format. */
function RuleRows({ rules, fields, stepCount, onChange }: {
  rules: string; fields: Field[]; stepCount: number; onChange: (json: string) => void;
}) {
  let parsed: SimpleRule[] = [];
  try { parsed = JSON.parse(rules) as SimpleRule[]; } catch { parsed = []; }
  if (!Array.isArray(parsed)) parsed = [];

  const save = (next: SimpleRule[]) => onChange(JSON.stringify(next));
  const input = "rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-brand";

  const patchRule = (i: number, r: SimpleRule) => save(parsed.map((x, n) => (n === i ? r : x)));
  const action = (r: SimpleRule) => r.then[0] ?? { action: "add_tag" };
  const setAction = (i: number, a: SimpleRule["then"][0]) => patchRule(i, { ...parsed[i], then: [a] });

  return (
    <div className="mt-2 rounded-lg border border-line bg-surface p-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Branching & actions when this step completes</p>
      {parsed.map((r, i) => {
        const a = action(r);
        return (
          <div key={i} className="mt-2 flex flex-wrap items-center gap-1.5 text-[12px]">
            <span className="font-semibold text-ink-3">If</span>
            <select className={input} value={r.if.field} onChange={(e) => patchRule(i, { ...r, if: { ...r.if, field: e.target.value } })}>
              {fields.map((f) => <option key={f.key} value={f.key}>{f.label || f.key}</option>)}
            </select>
            <select className={input} value={r.if.op} onChange={(e) => patchRule(i, { ...r, if: { ...r.if, op: e.target.value } })}>
              <option value="equals">is</option>
              <option value="not_equals">is not</option>
              <option value="contains">contains</option>
              <option value="gt">is more than</option>
              <option value="lt">is less than</option>
            </select>
            <input className={`${input} w-32`} value={r.if.value} onChange={(e) => patchRule(i, { ...r, if: { ...r.if, value: e.target.value } })} placeholder="answer" />
            <span className="font-semibold text-ink-3">then</span>
            <select className={input} value={a.action} onChange={(e) => setAction(i, { action: e.target.value })}>
              <option value="add_tag">add tag</option>
              <option value="remove_tag">remove tag</option>
              <option value="set_property">set property</option>
              <option value="go_to_step">go to step</option>
              <option value="skip_step">skip step</option>
              <option value="show_success">show message</option>
              <option value="generate_coupon">issue coupon</option>
            </select>
            {(a.action === "add_tag" || a.action === "remove_tag") && (
              <input className={`${input} w-36`} value={a.tag ?? ""} onChange={(e) => setAction(i, { ...a, tag: e.target.value })} placeholder="tag name" />
            )}
            {a.action === "set_property" && (<>
              <input className={`${input} w-28`} value={a.key ?? ""} onChange={(e) => setAction(i, { ...a, key: e.target.value })} placeholder="property" />
              <input className={`${input} w-28`} value={a.value ?? ""} onChange={(e) => setAction(i, { ...a, value: e.target.value })} placeholder="value" />
            </>)}
            {(a.action === "go_to_step" || a.action === "skip_step") && (
              <select className={input} value={String(a.step ?? 0)} onChange={(e) => setAction(i, { ...a, step: Number(e.target.value) })}>
                {Array.from({ length: stepCount }, (_, n) => <option key={n} value={n}>Step {n + 1}</option>)}
              </select>
            )}
            {a.action === "show_success" && (
              <input className={`${input} w-44`} value={a.message ?? ""} onChange={(e) => setAction(i, { ...a, message: e.target.value })} placeholder="message" />
            )}
            {a.action === "generate_coupon" && (
              <input className={`${input} w-44`} value={(a as { promotionId?: string }).promotionId ?? ""} onChange={(e) => setAction(i, { ...a, promotionId: e.target.value } as never)} placeholder="promotion id" />
            )}
            <button onClick={() => save(parsed.filter((_, n) => n !== i))} className="text-red-600 hover:underline">Remove</button>
          </div>
        );
      })}
      <button
        onClick={() => save([...parsed, { if: { field: fields[0]?.key ?? "email", op: "equals", value: "" }, then: [{ action: "add_tag", tag: "" }] }])}
        className="mt-2 rounded-lg border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-2 hover:border-brand hover:text-brand"
      >
        + Add rule
      </button>
    </div>
  );
}

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

            <RuleRows
              rules={s.rules}
              fields={s.fields}
              stepCount={steps.length}
              onChange={(rules) => patchStep(si, { rules })}
            />
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
