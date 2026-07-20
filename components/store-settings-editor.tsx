"use client";

// Owner inline editor for a store's storefront URL and domain lists. The API
// refuses backend-looking values unless the explicit override box is ticked.
import { useState } from "react";
import { useRouter } from "next/navigation";

const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

export function StoreSettingsEditor({ store }: { store: { id: string; name: string; url: string; domains: string | null; backendDomains: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ url: store.url, domains: store.domains ?? "", backendDomains: store.backendDomains ?? "" });
  const [override, setOverride] = useState(false);
  const [needsOverride, setNeedsOverride] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true); setMsg(null);
    const r = await fetch(`/api/admin/stores/${store.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: form.url, domains: form.domains, backendDomains: form.backendDomains, override }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: "Request failed" }));
    setBusy(false);
    if (!j.ok) {
      setMsg(j.error ?? "Failed");
      if (j.needsOverride) setNeedsOverride(true);
      return;
    }
    setOpen(false); setOverride(false); setNeedsOverride(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-line px-2 py-1 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]">
        Edit domains
      </button>
    );
  }

  return (
    <div className="mt-2 w-full max-w-md rounded-xl border border-line bg-[#fafaf8] p-3">
      {msg && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] leading-relaxed text-red-700">{msg}</p>}
      <label className="block"><span className="text-[11px] font-medium text-ink-3">Storefront domain (where customers browse)</span>
        <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className={field} /></label>
      <label className="mt-2 block"><span className="text-[11px] font-medium text-ink-3">Allowed tracking domains (comma separated)</span>
        <input value={form.domains} onChange={(e) => setForm({ ...form, domains: e.target.value })} className={field} /></label>
      <label className="mt-2 block"><span className="text-[11px] font-medium text-ink-3">Backend domains (never tracked, rejected with a reason)</span>
        <input value={form.backendDomains} onChange={(e) => setForm({ ...form, backendDomains: e.target.value })} className={field} /></label>
      {needsOverride && (
        <label className="mt-2 flex items-start gap-2 text-[12px] leading-relaxed text-amber-800">
          <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5" />
          I understand this looks like a backend/API address and I want it tracked anyway (recorded in the audit log).
        </label>
      )}
      <div className="mt-3 flex gap-2">
        <button disabled={busy} onClick={save} className="rounded-lg bg-brand px-3.5 py-1.5 text-[12px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">
          {busy ? "Saving…" : "Save"}
        </button>
        <button disabled={busy} onClick={() => { setOpen(false); setMsg(null); setNeedsOverride(false); setOverride(false); }} className="rounded-lg border border-line px-3.5 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-[#f0efec]">
          Cancel
        </button>
      </div>
    </div>
  );
}
