"use client";

// Promotions: shared and unique-per-customer coupons, with generation and
// redemption numbers that come from real rows, never estimates.

import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader, Th, Td } from "@/components/ui";

type Row = {
  id: string; name: string; mode: string; sharedCode: string | null; prefix: string;
  label: string; kind: string; amount: number; currency: string;
  expiryDays: number | null; minSpend: number | null; usageLimit: number | null;
  archived: boolean; storeId: string | null;
  issued: number; redeemed: number; pendingPush: number; pushed: number;
  revenueLabel: string | null;
};

export function PromotionsClient({ stores }: { stores: { id: string; name: string }[] }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    name: "", mode: "unique", sharedCode: "", prefix: "LOOM", kind: "percent",
    amount: 10, expiryDays: 14, minSpend: "", storeId: "",
  });

  const load = useCallback(() => {
    fetch("/api/promotions").then((r) => r.json()).then((j) => j.ok && setRows(j.promotions)).catch(() => setRows([]));
  }, []);
  useEffect(load, [load]);

  async function save() {
    const r = await fetch("/api/promotions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        mode: draft.mode,
        sharedCode: draft.mode === "shared" ? draft.sharedCode || null : null,
        prefix: draft.prefix.toUpperCase(),
        kind: draft.kind,
        amount: Number(draft.amount),
        expiryDays: draft.expiryDays ? Number(draft.expiryDays) : null,
        minSpend: draft.minSpend ? Number(draft.minSpend) : null,
        storeId: draft.storeId || null,
      }),
    });
    const j = await r.json();
    setNotice(j.ok ? `Created. Use promotion id ${j.id} in a coupon block or on a form.` : j.error ?? "Could not save.");
    if (j.ok) { setCreating(false); load(); }
  }

  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
  const small = "text-[11px] font-medium text-ink-3";

  return (
    <Card>
      <CardHeader
        title="Promotions"
        subtitle="Shared or unique-per-customer codes · generated at send or form completion, never in previews"
        action={
          <button onClick={() => setCreating((v) => !v)} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
            New promotion
          </button>
        }
      />
      {notice && <p className="mx-5 mt-3 rounded-lg border border-line bg-[#f7f6f4] px-3 py-2 text-[12px] text-ink-2">{notice}</p>}

      {creating && (
        <div className="grid gap-3 border-b border-line px-5 py-4 sm:grid-cols-3">
          <label><span className={small}>Name</span><input className={input} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
          <label><span className={small}>Mode</span>
            <select className={input} value={draft.mode} onChange={(e) => setDraft({ ...draft, mode: e.target.value })}>
              <option value="unique">Unique code per customer</option>
              <option value="shared">One shared code</option>
            </select>
          </label>
          {draft.mode === "shared" ? (
            <label><span className={small}>Shared code</span><input className={input} value={draft.sharedCode} onChange={(e) => setDraft({ ...draft, sharedCode: e.target.value.toUpperCase() })} placeholder="WELCOME10" /></label>
          ) : (
            <label><span className={small}>Code prefix</span><input className={input} value={draft.prefix} onChange={(e) => setDraft({ ...draft, prefix: e.target.value.toUpperCase() })} placeholder="MYO" /></label>
          )}
          <label><span className={small}>Discount</span>
            <select className={input} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value })}>
              <option value="percent">Percentage</option>
              <option value="fixed">Fixed amount</option>
              <option value="free_shipping">Free shipping</option>
            </select>
          </label>
          {draft.kind !== "free_shipping" && (
            <label><span className={small}>{draft.kind === "percent" ? "Percent off" : "Amount off (GBP)"}</span>
              <input type="number" className={input} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>
          )}
          <label><span className={small}>Valid for (days)</span><input type="number" className={input} value={draft.expiryDays} onChange={(e) => setDraft({ ...draft, expiryDays: Number(e.target.value) })} /></label>
          <label><span className={small}>Minimum spend (optional)</span><input className={input} value={draft.minSpend} onChange={(e) => setDraft({ ...draft, minSpend: e.target.value })} /></label>
          <label><span className={small}>Store</span>
            <select className={input} value={draft.storeId} onChange={(e) => setDraft({ ...draft, storeId: e.target.value })}>
              <option value="">No store push (email display only)</option>
              {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <div className="flex items-end">
            <button onClick={save} className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white">Create promotion</button>
          </div>
        </div>
      )}

      {!rows ? (
        <div className="h-24 animate-pulse" />
      ) : rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-[13px] text-ink-3">
          No promotions yet. Create one, then reference it from an email coupon block or a form&apos;s completion.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line">
              <tr><Th>Promotion</Th><Th>Code</Th><Th>Discount</Th><Th>Issued</Th><Th>At store</Th><Th>Redeemed</Th><Th>Revenue</Th><Th>ID for blocks</Th></tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="border-b border-line/70 last:border-0">
                  <Td><span className="font-medium">{p.name}</span></Td>
                  <Td className="font-mono text-[12px]">{p.mode === "shared" ? p.sharedCode : `${p.prefix}-XXX-XXXXX`}</Td>
                  <Td>{p.label}{p.expiryDays ? ` · ${p.expiryDays}d` : ""}</Td>
                  <Td>{p.issued}</Td>
                  <Td>
                    {p.mode === "shared" ? "n/a" : p.pendingPush > 0
                      ? <span className="text-amber-700">{p.pushed} pushed · {p.pendingPush} pending</span>
                      : String(p.pushed)}
                  </Td>
                  <Td>{p.redeemed}</Td>
                  <Td>{p.revenueLabel ?? "—"}</Td>
                  <Td><code className="rounded bg-[#f0efec] px-1.5 py-0.5 font-mono text-[11px]">{p.id}</code></Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="px-5 py-3 text-[11px] leading-relaxed text-ink-3">
        Unique codes exist in SendLoom the moment they are issued and appear in emails immediately.
        &quot;At store&quot; shows the push to WooCommerce, which needs plugin 4.5+ on the store; codes pending
        push are honest about it rather than pretending the store knows them.
      </p>
    </Card>
  );
}
