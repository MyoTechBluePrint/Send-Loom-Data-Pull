"use client";

// The popup builder: everything editable on the left, the popup exactly as
// the storefront renders it on the right (same markup rules as tracker.js),
// including the after-signup state. Saving a draft never touches a site;
// Set live does, within the tracker's 5-minute config cache.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";

export type FormDraft = {
  id?: string;
  name: string;
  status?: string;
  headline: string;
  body: string;
  buttonLabel: string;
  consentLabel: string;
  successMessage: string;
  offerCode: string;
  accent: string;
  collectName: boolean;
  triggerKind: "time_on_page" | "exit_intent" | "scroll";
  triggerSeconds: number;
};

const DEFAULTS: FormDraft = {
  name: "",
  headline: "Get 10% off your first order",
  body: "Join for early access and honest product education. Unsubscribe anytime.",
  buttonLabel: "Claim my code",
  consentLabel: "Email me offers and updates (you can opt out anytime)",
  successMessage: "Done — check your inbox soon.",
  offerCode: "",
  accent: "#6d28d9",
  collectName: false,
  triggerKind: "time_on_page",
  triggerSeconds: 8,
};

const inputCls =
  "w-full rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand";
const labelCls = "mb-1 block text-[11px] font-bold uppercase tracking-wide text-ink-3";

export function FormEditor({ initial }: { initial?: Partial<FormDraft> & { id: string; status: string } }) {
  const router = useRouter();
  const [f, setF] = useState<FormDraft>({ ...DEFAULTS, ...initial });
  const [previewDone, setPreviewDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const set = <K extends keyof FormDraft>(k: K, v: FormDraft[K]) => setF((p) => ({ ...p, [k]: v }));

  const payload = useMemo(
    () => ({
      name: f.name || f.headline || "Untitled form",
      type: f.triggerKind === "exit_intent" ? ("exit_intent" as const) : ("popup" as const),
      headline: f.headline || undefined,
      body: f.body || undefined,
      buttonLabel: f.buttonLabel || undefined,
      consentLabel: f.consentLabel || undefined,
      successMessage: f.successMessage || undefined,
      offerCode: f.offerCode || undefined,
      accent: /^#[0-9a-fA-F]{6}$/.test(f.accent) ? f.accent : undefined,
      collectName: f.collectName,
      triggerKind: f.triggerKind,
      triggerSeconds: f.triggerSeconds,
    }),
    [f]
  );

  async function save(extra?: { status: "draft" | "live" | "paused" }) {
    setBusy(true);
    setNote(null);
    try {
      if (initial?.id) {
        const res = await fetch(`/api/forms/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, ...(extra ?? {}) }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error("save failed");
        setNote(extra?.status === "live" ? "Live. Storefronts pick it up within 5 minutes." : "Saved.");
        router.refresh();
      } else {
        const res = await fetch("/api/forms", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!data.ok) throw new Error("create failed");
        router.push(`/forms/${data.id}`);
      }
    } catch {
      setNote("Something went wrong saving. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const status = initial?.status ?? "draft";

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {/* ---- Left: the controls ---- */}
      <Card>
        <CardHeader title={initial?.id ? "Edit form" : "Build your form"} />
        <div className="space-y-4 px-5 py-4">
          <div>
            <label className={labelCls}>Internal name</label>
            <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Summer signup popup" />
          </div>
          <div>
            <label className={labelCls}>Headline</label>
            <input className={inputCls} value={f.headline} onChange={(e) => set("headline", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Supporting line</label>
            <textarea className={`${inputCls} resize-none`} rows={2} value={f.body} onChange={(e) => set("body", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Button text</label>
              <input className={inputCls} value={f.buttonLabel} onChange={(e) => set("buttonLabel", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Button colour</label>
              <div className="flex items-center gap-2">
                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(f.accent) ? f.accent : "#6d28d9"} onChange={(e) => set("accent", e.target.value)} className="h-9 w-10 cursor-pointer rounded border border-line" aria-label="Accent colour" />
                <input className={inputCls} value={f.accent} onChange={(e) => set("accent", e.target.value)} />
              </div>
            </div>
          </div>
          <div>
            <label className={labelCls}>Consent line (shown with a tick box)</label>
            <input className={inputCls} value={f.consentLabel} onChange={(e) => set("consentLabel", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Success message</label>
              <input className={inputCls} value={f.successMessage} onChange={(e) => set("successMessage", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Offer code (optional)</label>
              <input className={inputCls} value={f.offerCode} onChange={(e) => set("offerCode", e.target.value.toUpperCase())} placeholder="WELCOME10" />
            </div>
          </div>
          <label className="flex items-center gap-2.5 text-[13px]">
            <input type="checkbox" checked={f.collectName} onChange={(e) => set("collectName", e.target.checked)} className="accent-[#6d28d9]" />
            Also ask for their first name
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>When it appears</label>
              <select className={inputCls} value={f.triggerKind} onChange={(e) => set("triggerKind", e.target.value as FormDraft["triggerKind"])}>
                <option value="time_on_page">After time on page</option>
                <option value="exit_intent">When leaving (exit intent)</option>
                <option value="scroll">At 50% scroll</option>
              </select>
            </div>
            {f.triggerKind === "time_on_page" && (
              <div>
                <label className={labelCls}>Seconds on page</label>
                <input type="number" min={1} max={120} className={inputCls} value={f.triggerSeconds} onChange={(e) => set("triggerSeconds", Math.max(1, Math.min(120, Number(e.target.value) || 8)))} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button onClick={() => save()} disabled={busy} className="rounded-lg bg-[#6d28d9] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#5b21b6] disabled:opacity-50">
              {initial?.id ? "Save changes" : "Create form"}
            </button>
            {initial?.id && status !== "live" && (
              <button onClick={() => save({ status: "live" })} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50">
                Set live
              </button>
            )}
            {initial?.id && status === "live" && (
              <button onClick={() => save({ status: "paused" })} disabled={busy} className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-zinc-50 disabled:opacity-50">
                Pause
              </button>
            )}
            {note && <span className="text-[12px] font-semibold text-ink-2">{note}</span>}
          </div>
        </div>
      </Card>

      {/* ---- Right: the popup, as the storefront shows it ---- */}
      <Card className="self-start">
        <CardHeader
          title="Live preview"
          action={
            <button onClick={() => setPreviewDone(!previewDone)} className="text-[12px] font-bold text-brand hover:underline">
              {previewDone ? "Show form" : "Show after signup"}
            </button>
          }
        />
        <div className="flex items-center justify-center rounded-b-xl bg-[#efece6] px-4 py-8">
          <div className="relative w-full max-w-[380px] rounded-[14px] bg-white px-6 py-7 text-center shadow-[0_24px_64px_rgba(0,0,0,0.25)]">
            <span className="absolute right-3 top-2 text-[22px] leading-none text-zinc-400">×</span>
            {!previewDone ? (
              <>
                <h3 className="mb-2 text-[20px] font-bold leading-tight text-zinc-900">{f.headline || "Your headline"}</h3>
                <p className="mb-4 text-[14px] text-zinc-600">{f.body || "Your supporting line"}</p>
                {f.collectName && <div className="mb-2.5 rounded-lg border border-zinc-200 px-3 py-2.5 text-left text-[14px] text-zinc-400">First name</div>}
                <div className="mb-2.5 rounded-lg border border-zinc-200 px-3 py-2.5 text-left text-[14px] text-zinc-400">you@email.com</div>
                <label className="mb-3 flex items-start gap-2 text-left text-[11px] text-zinc-500">
                  <input type="checkbox" checked readOnly className="mt-0.5 accent-[#6d28d9]" style={{ accentColor: f.accent }} />
                  {f.consentLabel || "Consent line"}
                </label>
                <div className="rounded-lg px-4 py-2.5 text-[14px] font-semibold text-white" style={{ background: /^#[0-9a-fA-F]{6}$/.test(f.accent) ? f.accent : "#6d28d9" }}>
                  {f.buttonLabel || "Sign up"}
                </div>
              </>
            ) : (
              <>
                <h3 className="mb-2 text-[20px] font-bold leading-tight text-zinc-900">{f.successMessage || "Done — check your inbox soon."}</h3>
                {f.offerCode && (
                  <div className="mx-auto mt-3 rounded-lg border border-dashed px-4 py-2.5 text-[16px] font-bold tracking-wider" style={{ borderColor: f.accent, color: f.accent }}>
                    {f.offerCode}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        <p className="border-t border-line px-5 py-3 text-[12px] leading-relaxed text-ink-3">
          Exactly what visitors see: consent is ticked by default but visible, and every signup lands as a consented
          contact with the tick recorded in the ledger.
        </p>
      </Card>
    </div>
  );
}
