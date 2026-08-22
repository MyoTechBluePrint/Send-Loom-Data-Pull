"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell, GhostButton } from "@/components/shell";
import { Card, Badge, Th, Td } from "@/components/ui";
import { gbp, num, type Subscriber } from "@/lib/data";

const filters = ["All", "Subscribed", "Pending", "Unsubscribed", "Suppressed"] as const;

// The channel lens, combinable with the pills above and the search box: a
// person can stand in "Location contains Marbella" AND "WhatsApp consented"
// at once, which is exactly the audience they then select and act on.
const channelFilters = [
  "Any", "Email ✓", "SMS ✓", "WhatsApp ✓", "All channels ✓",
  "No consent", "Unknown", "Do Not Contact",
] as const;
type ChannelFilter = (typeof channelFilters)[number];

const consented = (v: string) => v === "granted";
const unknownish = (v: string) => v === "unknown" || v === "pending";

function matchesChannelFilter(s: Subscriber, f: ChannelFilter): boolean {
  const cs = s.channelStates;
  switch (f) {
    case "Any": return true;
    case "Email ✓": return consented(cs.email) && !s.doNotContact;
    case "SMS ✓": return consented(cs.sms) && !s.doNotContact;
    case "WhatsApp ✓": return consented(cs.whatsapp) && !s.doNotContact;
    case "All channels ✓": return consented(cs.email) && consented(cs.sms) && consented(cs.whatsapp) && !s.doNotContact;
    case "No consent": return !consented(cs.email) && !consented(cs.sms) && !consented(cs.whatsapp);
    case "Unknown": return unknownish(cs.email) && unknownish(cs.sms) && unknownish(cs.whatsapp);
    case "Do Not Contact": return s.doNotContact;
  }
}

/** One little letter per channel, its state carried by colour and tooltip. */
function ChannelChips({ s }: { s: Subscriber }) {
  const chip = (label: string, channel: string, state: string) => {
    const cls = s.doNotContact
      ? "bg-zinc-200 text-zinc-400 line-through"
      : state === "granted"
        ? "bg-emerald-50 text-emerald-700"
        : state === "withdrawn" || state === "suppressed"
          ? "bg-red-50 text-red-600"
          : state === "declined"
            ? "bg-amber-50 text-amber-700"
            : "bg-zinc-100 text-zinc-400";
    const word = s.doNotContact
      ? "blocked · Do Not Contact"
      : state === "granted"
        ? "consented"
        : state === "withdrawn"
          ? "unsubscribed"
          : state === "suppressed"
            ? "suppressed"
            : state === "declined"
              ? "not consented"
              : "unknown";
    return (
      <span
        key={channel}
        title={`${channel}: ${word}`}
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[10px] font-bold ${cls}`}
      >
        {label}
      </span>
    );
  };
  return (
    <span className="inline-flex items-center gap-1">
      {chip("E", "Email", s.channelStates.email)}
      {chip("S", "SMS", s.channelStates.sms)}
      {chip("W", "WhatsApp", s.channelStates.whatsapp)}
      {s.doNotContact && (
        <span title="Do Not Contact: all marketing blocked" className="inline-flex h-5 items-center rounded bg-red-600 px-1.5 text-[10px] font-bold text-white">
          DNC
        </span>
      )}
    </span>
  );
}

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
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("Any");
  const [consentModal, setConsentModal] = useState(false);
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
        return matchesQ && matchesF && matchesChannelFilter(s, channelFilter);
      }),
    [contacts, q, filter, channelFilter]
  );

  // The consent overview, from the rows already in hand: click a number and
  // the list underneath becomes those people.
  const overview = useMemo(() => {
    const count = (f: ChannelFilter) => contacts.filter((s) => matchesChannelFilter(s, f)).length;
    return [
      ["Email ✓", count("Email ✓")],
      ["SMS ✓", count("SMS ✓")],
      ["WhatsApp ✓", count("WhatsApp ✓")],
      ["All channels ✓", count("All channels ✓")],
      ["Unknown", count("Unknown")],
      ["Do Not Contact", count("Do Not Contact")],
    ] as [ChannelFilter, number][];
  }, [contacts]);

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
            <h2 className="text-base font-semibold">Add contact</h2>
            <p className="mt-0.5 text-xs text-ink-3">Recorded with a source entry and pending consent</p>
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

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {overview.map(([label, n]) => (
          <button
            key={label}
            onClick={() => setChannelFilter(channelFilter === label ? "Any" : label)}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
              channelFilter === label
                ? "border-brand bg-brand-soft text-brand"
                : "border-line bg-surface text-ink-2 hover:bg-[#f0efec]"
            }`}
          >
            <span className="tabular font-bold">{n.toLocaleString("en-GB")}</span> {label}
          </button>
        ))}
        {channelFilter !== "Any" && (
          <button onClick={() => setChannelFilter("Any")} className="text-xs font-semibold text-ink-3 hover:text-brand">
            Clear channel filter
          </button>
        )}
      </div>

      {flash && (
        <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{flash}</div>
      )}
      {selected.length > 0 && (
        <div className="sticky top-20 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-brand bg-white px-4 py-2.5 shadow-lg">
          <span className="text-[13px] font-bold text-brand">{selected.length} selected</span>
          <button disabled={bulkBusy} onClick={createPackFromSelection} className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-white hover:bg-[#5b21b6] disabled:opacity-50">Create Contact Pack</button>
          <button disabled={bulkBusy} onClick={copySelectedEmails} className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand hover:bg-[#ece2fa] disabled:opacity-50">Copy emails</button>
          <button disabled={bulkBusy} onClick={() => setConsentModal(true)} className="rounded-lg bg-brand-soft px-3 py-1.5 text-xs font-bold text-brand hover:bg-[#ece2fa] disabled:opacity-50">Update consent</button>
          <button disabled={bulkBusy} onClick={() => bulk("add_tag")} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50">Add tag</button>
          <button disabled={bulkBusy} onClick={() => bulk("create_task")} className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50">Create tasks</button>
          <button disabled={bulkBusy} onClick={() => bulk("suppress")} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">Suppress</button>
          <button onClick={() => setSelected([])} className="ml-auto text-xs font-semibold text-ink-3 hover:text-foreground">Clear</button>
        </div>
      )}
      {consentModal && (
        <ConsentModal
          count={selected.length}
          busy={bulkBusy}
          onClose={() => setConsentModal(false)}
          onApply={async (channels, status, dnc) => {
            setBulkBusy(true);
            try {
              if (dnc !== null) {
                const res = await fetch("/api/contacts/bulk", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ contactIds: selected, action: "set_dnc", value: dnc }),
                });
                const json = await res.json();
                if (json.ok) setFlash(`Do Not Contact ${dnc ? "enabled" : "removed"} on ${json.affected} contacts`);
              } else {
                const res = await fetch("/api/contacts/bulk", {
                  method: "POST", headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ contactIds: selected, action: "set_consent", channels, status }),
                });
                const json = await res.json();
                if (json.ok) {
                  setFlash(`Consent updated on ${json.affected} contacts${json.held ? ` · ${json.held} kept their opt-out` : ""}`);
                }
              }
              setConsentModal(false);
              setSelected([]);
              router.refresh();
            } finally {
              setBulkBusy(false);
            }
          }}
        />
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
                <Td><ChannelChips s={s} /></Td>
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
          <span>Bulk actions: update consent · tag · tasks · pack · suppress</span>
        </div>
      </Card>
    </Shell>
  );
}


/**
 * Update Marketing Consent, for however many are selected.
 *
 * Three clicks: channels, state, apply. "Unknown" is for the bulk review of
 * historical contacts and is stored as pending, never as consent. The Do Not
 * Contact switch is its own row because it is a different kind of decision:
 * it blocks everything, whatever the channels say.
 */
function ConsentModal({
  count,
  busy,
  onClose,
  onApply,
}: {
  count: number;
  busy: boolean;
  onClose: () => void;
  onApply: (
    channels: ("email" | "sms" | "whatsapp")[],
    status: "granted" | "declined" | "unknown",
    dnc: boolean | null,
  ) => void;
}) {
  const [channels, setChannels] = useState<("email" | "sms" | "whatsapp")[]>(["email", "sms", "whatsapp"]);
  const [status, setStatus] = useState<"granted" | "declined" | "unknown">("granted");

  const toggle = (c: "email" | "sms" | "whatsapp") =>
    setChannels((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <h2 className="text-base font-semibold">Update marketing consent</h2>
        <p className="mt-0.5 text-xs text-ink-3">
          {count.toLocaleString("en-GB")} selected · every change is recorded in the consent history
        </p>

        <p className="mt-4 text-xs font-semibold text-ink-2">Channels</p>
        <div className="mt-1.5 flex gap-1.5">
          {([["email", "Email"], ["sms", "SMS"], ["whatsapp", "WhatsApp"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                channels.includes(key)
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-ink-2 hover:bg-[#f0efec]"
              }`}
            >
              {channels.includes(key) ? "✓ " : ""}{label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-xs font-semibold text-ink-2">Set to</p>
        <div className="mt-1.5 flex gap-1.5">
          {([["granted", "Consented"], ["declined", "Not consented"], ["unknown", "Unknown"]] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setStatus(key)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                status === key
                  ? "border-brand bg-brand-soft text-brand"
                  : "border-line text-ink-2 hover:bg-[#f0efec]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {status === "granted" && (
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            Contacts who unsubscribed keep their opt-out unless changed individually on their profile.
          </p>
        )}

        <div className="mt-4 border-t border-line pt-3">
          <p className="text-xs font-semibold text-ink-2">Do Not Contact</p>
          <div className="mt-1.5 flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => onApply([], "granted", true)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
            >
              Block all marketing
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => onApply([], "granted", false)}
              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
            >
              Remove block
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || channels.length === 0}
            onClick={() => onApply(channels, status, null)}
            className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
          >
            {busy ? "Applying…" : "Apply"}
          </button>
        </div>
      </div>
    </div>
  );
}
