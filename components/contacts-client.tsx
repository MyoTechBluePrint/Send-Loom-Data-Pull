"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, GhostButton } from "@/components/shell";
import { Card, Badge, Th, Td } from "@/components/ui";
import { gbp, num, type Subscriber } from "@/lib/data";

const filters = ["All", "Subscribed", "Pending", "Unsubscribed", "Suppressed"] as const;

export function ContactsClient({ contacts }: { contacts: Subscriber[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", tag: "" });
  const [busy, setBusy] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function addContact(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setAddError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.ok) { setAddError(json.error ?? "Failed"); return; }
      setAdding(false);
      setForm({ name: "", email: "", phone: "", tag: "" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function bulk(action: "add_tag" | "create_task" | "suppress") {
    let tag: string | undefined, taskType: string | undefined;
    if (action === "add_tag") { tag = window.prompt("Tag to add") ?? undefined; if (!tag) return; }
    if (action === "create_task") { taskType = window.prompt("Task type", "Call lead") ?? undefined; if (!taskType) return; }
    if (action === "suppress" && !window.confirm(`Suppress ${selected.length} contacts? They are excluded from all sending (reversible via consent, never hard-deleted).`)) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactIds: selected, action, tag, taskType }),
      });
      const json = await res.json();
      if (json.ok) { setFlash(`Done: ${json.affected} contacts affected`); setSelected([]); router.refresh(); }
    } finally {
      setBulkBusy(false);
    }
  }

  async function createPackFromSelection() {
    const name = window.prompt("Pack name", "Selected contacts");
    if (!name) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/packs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, from: "contacts", contactIds: selected }),
      });
      const json = await res.json();
      if (json.ok) window.location.href = `/packs/${json.id}`;
    } finally {
      setBulkBusy(false);
    }
  }

  async function copySelectedEmails() {
    const emails = contacts.filter((c) => selected.includes(c.id) && c.email.includes("@")).map((c) => c.email);
    await navigator.clipboard.writeText(emails.join(", "));
    fetch("/api/exports/log", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dataType: "contacts", source: "Contacts selection", format: "emails", contacts: emails.length, notes: "quick copy (suppression-filtered at table level only)" }),
    });
    setFlash(`Copied ${emails.length} emails`);
    setTimeout(() => setFlash(null), 2500);
  }

  const rows = useMemo(
    () =>
      contacts.filter((s) => {
        const matchesQ =
          !q ||
          s.name.toLowerCase().includes(q.toLowerCase()) ||
          s.email.toLowerCase().includes(q.toLowerCase()) ||
          s.tags.some((t) => t.toLowerCase().includes(q.toLowerCase()));
        const matchesF = filter === "All" || s.consent === filter.toLowerCase();
        return matchesQ && matchesF;
      }),
    [contacts, q, filter]
  );

  return (
    <Shell
      title="Contacts"
      subtitle={`${num(contacts.length)} contacts in the database · every record source-tagged`}
      actions={
        <>
          <Link href="/imports"><GhostButton>Import CSV</GhostButton></Link>
          <button onClick={() => setAdding(true)} className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6]">
            Add contact
          </button>
        </>
      }
    >
      {adding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setAdding(false)}>
          <form onSubmit={addContact} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h2 className="text-base font-semibold">Add demo contact</h2>
            <p className="mt-0.5 text-xs text-ink-3">Staging only · gets a source ledger entry and pending consent</p>
            {addError && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{addError}</p>}
            {([["name", "Full name *"], ["email", "Email"], ["phone", "Phone"], ["tag", "Interest tag"]] as const).map(([key, label]) => (
              <label key={key} className="mt-3 block">
                <span className="text-xs font-medium text-ink-3">{label}</span>
                <input
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  required={key === "name"}
                  className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
            ))}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAdding(false)} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Cancel</button>
              <button type="submit" disabled={busy} className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">
                {busy ? "Saving…" : "Create contact"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name, email or tag…"
          className="w-full max-w-80 rounded-lg border border-line bg-surface px-3.5 py-2 text-sm outline-none placeholder:text-ink-3 focus:border-brand"
        />
        <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                filter === f ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-[#f0efec]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {flash && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{flash}</div>
      )}
      {selected.length > 0 && (
        <div className="sticky top-20 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-white px-4 py-2.5 shadow-lg">
          <span className="text-[13px] font-bold text-brand">{selected.length} selected</span>
          <button disabled={bulkBusy} onClick={createPackFromSelection} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5b21b6] disabled:opacity-50">Create Contact Pack</button>
          <button disabled={bulkBusy} onClick={copySelectedEmails} className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand hover:bg-[#ece2fa] disabled:opacity-50">Copy emails</button>
          <button disabled={bulkBusy} onClick={() => bulk("add_tag")} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50">Add tag</button>
          <button disabled={bulkBusy} onClick={() => bulk("create_task")} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50">Create tasks</button>
          <button disabled={bulkBusy} onClick={() => bulk("suppress")} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">Suppress</button>
          <button onClick={() => setSelected([])} className="ml-auto text-xs font-semibold text-ink-3 hover:text-foreground">Clear</button>
        </div>
      )}
      <Card>
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[900px]">
          <thead className="border-b border-line">
            <tr>
              <Th className="w-8">
                <input
                  type="checkbox"
                  checked={rows.length > 0 && rows.every((r) => selected.includes(r.id))}
                  onChange={(e) => setSelected(e.target.checked ? rows.map((r) => r.id) : [])}
                  className="h-3.5 w-3.5 accent-[#6d28d9]"
                />
              </Th>
              <Th>Contact</Th>
              <Th>Consent</Th>
              <Th className="text-right">Score</Th>
              <Th>Tags</Th>
              <Th>Source</Th>
              <Th className="text-right">Orders</Th>
              <Th className="text-right">Lifetime value</Th>
              <Th className="text-right">Last activity</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-[#fafaf8]">
                <Td>
                  <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleSelect(s.id)} className="h-3.5 w-3.5 accent-[#6d28d9]" />
                </Td>
                <Td>
                  <Link href={`/subscribers/${s.id}`} className="font-medium hover:text-brand">{s.name}</Link>
                  <p className="text-xs text-ink-3">{s.email}</p>
                </Td>
                <Td><Badge value={s.consent} /></Td>
                <Td className="text-right">
                  <span className={`tabular inline-block min-w-8 rounded-full px-2 py-0.5 text-center text-[11px] font-bold ${
                    s.score >= 70 ? "bg-emerald-50 text-emerald-700" : s.score >= 40 ? "bg-amber-50 text-amber-700" : "bg-zinc-100 text-zinc-500"
                  }`}>{s.score}</span>
                </Td>
                <Td>
                  <div className="flex flex-wrap gap-1">
                    {s.tags.length === 0 && <span className="text-xs text-ink-3">–</span>}
                    {s.tags.slice(0, 3).map((t) => (
                      <span key={t} className="rounded-full bg-[#f0efec] px-2 py-0.5 text-[11px] font-medium text-ink-2">{t}</span>
                    ))}
                    {s.tags.length > 3 && <span className="text-[11px] text-ink-3">+{s.tags.length - 3}</span>}
                  </div>
                </Td>
                <Td className="max-w-52 truncate text-xs text-ink-2">{s.source}</Td>
                <Td className="tabular text-right">{s.orders}</Td>
                <Td className="tabular text-right font-semibold">{s.revenue > 0 ? gbp(s.revenue) : "–"}</Td>
                <Td className="text-right text-xs text-ink-2">{s.lastActivity}</Td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-ink-3">No contacts match.</td>
              </tr>
            )}
          </tbody>
        </table></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-ink-3">
          <span>Showing {rows.length} of {num(contacts.length)} contacts</span>
          <span>Bulk actions: tag · add to list · suppress · delete (GDPR erasure)</span>
        </div>
      </Card>
    </Shell>
  );
}
