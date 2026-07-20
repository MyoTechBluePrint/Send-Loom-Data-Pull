"use client";

// Owner team management: add logins, change roles, reset passwords, disable.
import { useState } from "react";
import { useRouter } from "next/navigation";

const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";
const ROLES: [string, string][] = [
  ["full_access", "Full Access"], ["admin", "Admin"], ["operator", "Worker Admin · Operator"],
  ["ads_operator", "Ads Operator"], ["marketing", "Marketing Manager"], ["editor", "Content Editor"], ["viewer", "Viewer"], ["owner", "Owner"],
];

type Member = { email: string; name: string; role: string; roleLabel: string; disabled: boolean; hasPassword: boolean; isYou: boolean };

export function TeamClient({ members }: { members: Member[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", name: "", password: "", role: "viewer" });
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPw, setResetPw] = useState("");

  async function call(method: "POST" | "PATCH", body: object) {
    setBusy(true); setMsg(null);
    const r = await fetch("/api/admin/users", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({ ok: false, error: "Request failed" }));
    setBusy(false);
    if (!j.ok) { setMsg(j.error ?? "Failed"); return false; }
    router.refresh();
    return true;
  }

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="xl:col-span-2 rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">Team members</h2></div>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.email} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{m.name}{m.isYou && <span className="ml-1.5 text-[11px] font-normal text-ink-3">(you)</span>}</p>
                <p className="text-xs text-ink-3">{m.email}{!m.hasPassword && " · no password set"}</p>
              </div>
              <select
                value={m.role}
                disabled={busy || m.isYou}
                onChange={(e) => call("PATCH", { email: m.email, role: e.target.value })}
                className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] font-medium outline-none focus:border-brand disabled:opacity-50"
              >
                {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button
                disabled={busy}
                onClick={() => { setResetFor(resetFor === m.email ? null : m.email); setResetPw(""); }}
                className="rounded-lg border border-line px-2.5 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-[#f0efec]"
              >
                Reset password
              </button>
              <button
                disabled={busy || m.isYou}
                onClick={() => call("PATCH", { email: m.email, disabled: !m.disabled })}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-semibold ${m.disabled ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "border border-line text-red-700 hover:bg-red-50"} disabled:opacity-40`}
              >
                {m.disabled ? "Re-enable" : "Disable"}
              </button>
              {m.disabled && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-500">DISABLED</span>}
              {resetFor === m.email && (
                <div className="flex w-full items-center gap-2 pt-1">
                  <input type="password" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="New password (min 8)" className="w-64 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm outline-none focus:border-brand" />
                  <button
                    disabled={busy || resetPw.length < 8}
                    onClick={async () => { if (await call("POST", { email: m.email, password: resetPw, name: m.name, role: m.role })) setResetFor(null); }}
                    className="rounded-lg bg-brand px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
                  >
                    Set password
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="self-start rounded-2xl border border-line bg-surface">
        <div className="border-b border-line px-5 py-4"><h2 className="text-sm font-semibold">Add a login</h2></div>
        <div className="space-y-3 px-5 py-4">
          {msg && <p className="rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{msg}</p>}
          <label className="block"><span className="text-xs font-medium text-ink-3">Email *</span>
            <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} placeholder="person@company.com" /></label>
          <label className="block"><span className="text-xs font-medium text-ink-3">Name</span>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={field} placeholder="Optional" /></label>
          <label className="block"><span className="text-xs font-medium text-ink-3">Password * (min 8, share it privately)</span>
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} /></label>
          <label className="block"><span className="text-xs font-medium text-ink-3">Role *</span>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className={field}>
              {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select></label>
          <button
            disabled={busy || !form.email || form.password.length < 8}
            onClick={async () => {
              if (await call("POST", { email: form.email, password: form.password, role: form.role, ...(form.name ? { name: form.name } : {}) })) {
                setForm({ email: "", name: "", password: "", role: "viewer" });
              }
            }}
            className="w-full rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
          >
            Add login
          </button>
          <p className="text-xs leading-relaxed text-ink-3">
            Accounts made here work immediately and survive deploys. A workspace reset re-seeds logins from SEED_USERS
            in Render, so mirror important accounts there too.
          </p>
        </div>
      </div>
    </div>
  );
}
