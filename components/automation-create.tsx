"use client";

// The "New automation" flow the button always implied: name it, pick the
// trigger, land on the automation's page as a draft.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PrimaryButton } from "@/components/shell";

const TRIGGERS = [
  { v: "cart_abandoned", l: "Cart abandoned" },
  { v: "checkout_started", l: "Checkout started" },
  { v: "purchase_completed", l: "Purchase completed" },
  { v: "popup_submitted", l: "Popup or form submitted" },
  { v: "tag_added", l: "Tag added to a contact" },
  { v: "contact_created", l: "New contact created" },
  { v: "coupon_redeemed", l: "Coupon redeemed" },
];

export function AutomationCreate() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState(TRIGGERS[0].v);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/automations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, trigger }),
      });
      const j = await r.json();
      if (!j.ok) { setError(j.error ?? "Could not create."); return; }
      router.push(`/automations/${j.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PrimaryButton onClick={() => setOpen(true)}>New automation</PrimaryButton>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">New automation</h2>
            <p className="mt-1 text-xs text-ink-3">Starts as a draft. Nothing runs until you set it live.</p>
            {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <label className="mt-4 block">
              <span className="text-xs font-medium text-ink-3">Name</span>
              <input
                value={name} onChange={(e) => setName(e.target.value)} autoFocus
                placeholder="Abandoned cart recovery"
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-ink-3">Trigger</span>
              <select
                value={trigger} onChange={(e) => setTrigger(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
              >
                {TRIGGERS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </label>
            <div className="mt-5 flex gap-2">
              <button
                onClick={create} disabled={busy || !name.trim()}
                className="rounded-lg bg-[#6d28d9] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create automation"}
              </button>
              <button onClick={() => setOpen(false)} className="rounded-lg px-4 py-2 text-[13px] font-medium text-ink-3">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
