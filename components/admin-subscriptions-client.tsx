"use client";

// Admin subscription management: every account, what state it is in, and the
// controls to change it. Complimentary accounts are shown first-class rather
// than hidden, because "who is not being billed, and why" is the question an
// operator actually asks.

import { Fragment, useCallback, useEffect, useState } from "react";
import { Card, CardHeader, Th, Td } from "@/components/ui";

type Row = {
  workspaceId: string; workspaceName: string; status: string; statusLabel: string;
  tone: string; exempt: boolean; complimentary: boolean;
  planKey: string | null; planName: string | null; billingCycle: string;
  trialEndsAt: string | null; firstBillingAt: string | null; amountLabel: string | null;
  paymentMethodVerified: boolean; creditPence: number; cancelReason: string | null;
  paymentRetryCount: number; notes: string | null;
  usage: { contacts: number; users: number; stores: number };
  invoices: { number: string; amountLabel: string; status: string }[];
  eventCount: number;
};
type Plan = { key: string; name: string; monthlyPence: number | null; annualPence: number | null; entitlements: string; visible: boolean; sortOrder: number; blurb: string | null; currency: string; recommended: boolean; contactSales: boolean };

const TONE: Record<string, string> = {
  good: "bg-emerald-50 text-emerald-700",
  info: "bg-sky-50 text-sky-700",
  warn: "bg-amber-50 text-amber-800",
  danger: "bg-red-50 text-red-700",
  neutral: "bg-[#f0efec] text-ink-3",
};

const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export function AdminSubscriptionsClient({ canChange }: { canChange: boolean }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/admin/subscriptions").then((r) => r.json()).then((j) => {
      if (j.ok) { setRows(j.subscriptions); setStates(j.states); }
    }).catch(() => setRows([]));
    fetch("/api/admin/plans").then((r) => r.json()).then((j) => j.ok && setPlans(j.plans)).catch(() => {});
  }, []);

  useEffect(load, [load]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/subscriptions", {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await res.json();
      setNotice(j.ok ? j.detail : j.error ?? "Action failed.");
      if (j.ok) load();
    } finally {
      setBusy(false);
    }
  }

  async function runLifecycle() {
    setBusy(true);
    try {
      const res = await fetch("/api/billing/lifecycle", { method: "POST" });
      const j = await res.json();
      setNotice(j.ok ? `Lifecycle run: ${j.changed} account${j.changed === 1 ? "" : "s"} advanced.` : j.error ?? "Could not run.");
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!rows) return <div className="h-40 animate-pulse rounded-xl border border-line bg-black/[0.02]" />;

  const commercial = rows.filter((r) => !r.exempt);
  const exempt = rows.filter((r) => r.exempt);

  return (
    <div className="space-y-4">
      {notice && <p className="rounded-lg border border-line bg-[#f7f6f4] px-4 py-3 text-[13px] text-ink-2">{notice}</p>}

      <Card>
        <CardHeader
          title="Subscriptions"
          subtitle={`${commercial.length} commercial · ${exempt.length} complimentary or enterprise (never billed)`}
          action={
            canChange ? (
              <button
                onClick={runLifecycle} disabled={busy}
                className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand disabled:opacity-50"
              >
                Run lifecycle now
              </button>
            ) : undefined
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Workspace</Th><Th>State</Th><Th>Plan</Th><Th>Next payment</Th>
                <Th>Amount</Th><Th>Card</Th><Th>Usage</Th><Th className="text-right">Manage</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.workspaceId}>
                  <tr className="border-b border-line/70">
                    <Td>
                      <span className="font-medium">{r.workspaceName}</span>
                      {r.complimentary && <span className="ml-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">IN-HOUSE</span>}
                    </Td>
                    <Td><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${TONE[r.tone] ?? TONE.neutral}`}>{r.statusLabel}</span></Td>
                    <Td>{r.planName ?? "—"}</Td>
                    <Td>{r.exempt ? "Never" : date(r.firstBillingAt)}</Td>
                    <Td>{r.exempt ? "—" : r.amountLabel ?? "—"}</Td>
                    <Td>{r.exempt ? "—" : r.paymentMethodVerified ? "Verified" : "Not added"}</Td>
                    <Td className="text-[12px] text-ink-3">{r.usage.contacts.toLocaleString()} contacts · {r.usage.users} users · {r.usage.stores} sites</Td>
                    <Td className="text-right">
                      <button onClick={() => setOpen(open === r.workspaceId ? null : r.workspaceId)} className="font-medium text-brand hover:underline">
                        {open === r.workspaceId ? "Close" : "Manage"}
                      </button>
                    </Td>
                  </tr>
                  {open === r.workspaceId && (
                    <tr className="border-b border-line bg-[#faf9f7]">
                      <td colSpan={8} className="px-5 py-4">
                        {!canChange ? (
                          <p className="text-[13px] text-ink-3">Changing billing requires an owner account. You can view, but not act.</p>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[12px] text-ink-3">
                              Trial ends {date(r.trialEndsAt)} · {r.eventCount} billing events · retries {r.paymentRetryCount}
                              {r.cancelReason ? ` · cancellation reason: ${r.cancelReason}` : ""}
                              {r.notes ? ` · ${r.notes}` : ""}
                            </p>

                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                defaultValue=""
                                onChange={(e) => e.target.value && act({ action: "set_plan", workspaceId: r.workspaceId, planKey: e.target.value, cycle: r.billingCycle })}
                                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px]"
                              >
                                <option value="">Move to plan…</option>
                                {plans.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
                              </select>

                              <select
                                defaultValue=""
                                onChange={(e) => e.target.value && act({ action: "set_status", workspaceId: r.workspaceId, status: e.target.value })}
                                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px]"
                              >
                                <option value="">Set state…</option>
                                {states.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>

                              <button onClick={() => act({ action: "extend_trial", workspaceId: r.workspaceId, days: 7 })} disabled={busy} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium hover:border-brand hover:text-brand">
                                Extend trial 7 days
                              </button>
                              <button onClick={() => act({ action: "end_trial", workspaceId: r.workspaceId })} disabled={busy} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium hover:border-brand hover:text-brand">
                                End trial now
                              </button>

                              {r.complimentary ? (
                                <button onClick={() => act({ action: "revoke_complimentary", workspaceId: r.workspaceId })} disabled={busy} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-900">
                                  Revoke complimentary
                                </button>
                              ) : (
                                <button onClick={() => act({ action: "grant_complimentary", workspaceId: r.workspaceId, note: "Granted from admin" })} disabled={busy} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-[12px] font-medium text-emerald-800">
                                  Grant complimentary
                                </button>
                              )}

                              <button onClick={() => act({ action: "pause", workspaceId: r.workspaceId })} disabled={busy} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] font-medium">Pause</button>
                              <button onClick={() => act({ action: "cancel", workspaceId: r.workspaceId, reason: "Cancelled from admin" })} disabled={busy} className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[12px] font-medium text-red-700">Cancel</button>

                              <CreditInput onApply={(pence) => act({ action: "apply_credit", workspaceId: r.workspaceId, pence })} current={r.creditPence} busy={busy} />
                            </div>

                            {r.invoices.length > 0 && (
                              <p className="text-[12px] text-ink-3">
                                Recent invoices: {r.invoices.map((i) => `${i.number} ${i.amountLabel} (${i.status})`).join(" · ")}
                              </p>
                            )}
                            <p className="text-[11px] text-ink-3">Every action here is written to the billing event log and the audit log against your account.</p>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <PlanEditor plans={plans} canChange={canChange} onSaved={load} />
    </div>
  );
}

function CreditInput({ current, onApply, busy }: { current: number; onApply: (pence: number) => void; busy: boolean }) {
  const [v, setV] = useState((current / 100).toFixed(2));
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-1">
      <span className="text-[11px] text-ink-3">Credit £</span>
      <input value={v} onChange={(e) => setV(e.target.value)} className="w-16 bg-transparent text-[12px] outline-none" />
      <button
        onClick={() => onApply(Math.round(parseFloat(v || "0") * 100))}
        disabled={busy}
        className="text-[11px] font-semibold text-brand hover:underline"
      >
        Apply
      </button>
    </span>
  );
}

function PlanEditor({ plans, canChange, onSaved }: { plans: Plan[]; canChange: boolean; onSaved: () => void }) {
  const [editing, setEditing] = useState<Plan | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(p: Plan) {
    const res = await fetch("/api/admin/plans", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: p.key, name: p.name, blurb: p.blurb, currency: p.currency,
        monthlyPence: p.monthlyPence, annualPence: p.annualPence,
        entitlements: p.entitlements, recommended: p.recommended,
        contactSales: p.contactSales, visible: p.visible, sortOrder: p.sortOrder,
      }),
    });
    const j = await res.json();
    setMsg(j.ok ? `Saved ${j.plan.name}.` : j.error ?? "Could not save.");
    if (j.ok) { setEditing(null); onSaved(); }
  }

  return (
    <Card>
      <CardHeader title="Plans, prices and limits" subtitle="Stored as data. Changing them here takes effect immediately, with no deploy." />
      {msg && <p className="mx-5 mt-4 rounded-lg border border-line bg-[#f7f6f4] px-3 py-2 text-[12px] text-ink-2">{msg}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="border-b border-line">
            <tr><Th>Plan</Th><Th>Monthly</Th><Th>Annual</Th><Th>Visible</Th><Th>Limits</Th><Th className="text-right">Edit</Th></tr>
          </thead>
          <tbody>
            {plans.map((p) => (
              <tr key={p.key} className="border-b border-line/70">
                <Td><span className="font-medium">{p.name}</span> <span className="text-[11px] text-ink-3">{p.key}</span></Td>
                <Td>{p.monthlyPence !== null ? `£${(p.monthlyPence / 100).toFixed(2)}` : "Contact sales"}</Td>
                <Td>{p.annualPence !== null ? `£${(p.annualPence / 100).toFixed(2)}` : "—"}</Td>
                <Td>{p.visible ? "Yes" : "Hidden"}</Td>
                <Td className="max-w-md truncate font-mono text-[11px] text-ink-3">{p.entitlements}</Td>
                <Td className="text-right">
                  {canChange && (
                    <button onClick={() => setEditing(editing?.key === p.key ? null : p)} className="font-medium text-brand hover:underline">
                      {editing?.key === p.key ? "Close" : "Edit"}
                    </button>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="space-y-3 border-t border-line bg-[#faf9f7] px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Field label="Monthly price in pence" value={String(editing.monthlyPence ?? "")} onChange={(v) => setEditing({ ...editing, monthlyPence: v === "" ? null : Number(v) })} />
            <Field label="Annual price in pence" value={String(editing.annualPence ?? "")} onChange={(v) => setEditing({ ...editing, annualPence: v === "" ? null : Number(v) })} />
          </div>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Entitlements (JSON · -1 means unlimited)</span>
            <textarea
              value={editing.entitlements} rows={5}
              onChange={(e) => setEditing({ ...editing, entitlements: e.target.value })}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 font-mono text-[12px] outline-none focus:border-brand"
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <Check label="Visible for sale" checked={editing.visible} onChange={(v) => setEditing({ ...editing, visible: v })} />
            <Check label="Most popular" checked={editing.recommended} onChange={(v) => setEditing({ ...editing, recommended: v })} />
            <Check label="Contact sales only" checked={editing.contactSales} onChange={(v) => setEditing({ ...editing, contactSales: v })} />
            <button onClick={() => save(editing)} className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white">Save plan</button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand" />
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ink-2">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-3.5 w-3.5 accent-[#6d28d9]" />
      {label}
    </label>
  );
}
