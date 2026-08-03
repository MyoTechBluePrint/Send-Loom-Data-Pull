"use client";

// Central tag management: create, rename, describe, colour, merge, archive,
// usage and dependencies. Deletion is only offered for unused tags; anything
// in use gets merge/archive instead.

import { useCallback, useEffect, useRef, useState } from "react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";

type Row = {
  id: string; name: string; description: string | null; color: string | null;
  archived: boolean; contacts: number; usedBySegments: string[];
};

const COLORS = ["#6d28d9", "#0e7490", "#b45309", "#15803d", "#be123c", "#52514e"];

export default function TagsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [newName, setNewName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [mergeFrom, setMergeFrom] = useState<Row | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    fetch(`/api/tags?archived=${showArchived ? "1" : "0"}`)
      .then((r) => r.json()).then((j) => j.ok && setRows(j.tags)).catch(() => setRows([]));
  }, [showArchived]);
  useEffect(load, [load]);

  async function act(body: Record<string, unknown>, msg?: string) {
    try {
      const r = await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      setNotice(j.ok ? msg ?? "Done." : j.error ?? "Failed.");
      if (j.ok) { setMergeFrom(null); load(); }
      return j.ok as boolean;
    } catch {
      setNotice("Could not reach the server. Try again.");
      return false;
    }
  }

  // Always responds: empty name focuses the input and says why instead of
  // silently doing nothing (that silence was reported as a dead button).
  async function create() {
    const name = newName.trim();
    if (!name) {
      setNotice("Type a tag name first, then hit Create.");
      nameRef.current?.focus();
      return;
    }
    if (await act({ action: "create", name }, `Created "${name}".`)) setNewName("");
  }

  return (
    <Shell
      title="Tags"
      subtitle="Labels applied by forms, surveys, polls and imports · audiences build on them"
      actions={
        <span onClick={create}>
          <PrimaryButton>Create tag</PrimaryButton>
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          ref={nameRef}
          value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="New tag name, e.g. interest:recovery"
          onKeyDown={(e) => { if (e.key === "Enter") create(); }}
          className="w-72 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand"
        />
        <button onClick={create} className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-3.5 py-2 text-[13px] font-semibold text-white">
          Create
        </button>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-2">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-3.5 w-3.5 accent-[#6d28d9]" />
          Show archived
        </label>
      </div>

      {notice && <p className="mb-4 rounded-lg border border-line bg-[#f7f6f4] px-4 py-2.5 text-[13px] text-ink-2">{notice}</p>}

      {mergeFrom && rows && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center gap-3 px-5 py-4">
            <p className="text-[13px]">Merge <strong>{mergeFrom.name}</strong> ({mergeFrom.contacts} contacts) into:</p>
            <select
              defaultValue=""
              onChange={(e) => e.target.value && act({ action: "merge", fromId: mergeFrom.id, intoId: e.target.value }, "Merged.")}
              className="rounded-lg border border-line px-3 py-1.5 text-[13px]"
            >
              <option value="">Choose target…</option>
              {rows.filter((r) => r.id !== mergeFrom.id && !r.archived).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <button onClick={() => setMergeFrom(null)} className="text-[12px] text-ink-3 hover:underline">Cancel</button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title={showArchived ? "Archived tags" : "Tags"} subtitle={rows ? `${rows.length} tags` : "Loading…"} />
        {!rows ? (
          <div className="h-40 animate-pulse" />
        ) : rows.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-3">
            {showArchived ? "Nothing archived." : "No tags yet. Create one above, or let a form apply one automatically."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line">
                <tr><Th>Tag</Th><Th>Description</Th><Th>Contacts</Th><Th>Used by audiences</Th><Th className="text-right">Actions</Th></tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-line/70 last:border-0">
                    <Td>
                      <span className="inline-flex items-center gap-2">
                        <button
                          title="Change colour"
                          onClick={() => {
                            const i = COLORS.indexOf(t.color ?? "");
                            act({ action: "update", id: t.id, color: COLORS[(i + 1) % COLORS.length] });
                          }}
                          className="h-3 w-3 rounded-full border border-black/10"
                          style={{ background: t.color ?? "#e7e6e1" }}
                        />
                        <span className="font-medium">{t.name}</span>
                      </span>
                    </Td>
                    <Td className="max-w-[280px]">
                      <button
                        onClick={() => {
                          const d = window.prompt("Description", t.description ?? "");
                          if (d !== null) act({ action: "update", id: t.id, description: d || null });
                        }}
                        className="block w-full truncate text-left text-ink-2 hover:text-brand"
                      >
                        {t.description ?? <span className="text-ink-3">Add description…</span>}
                      </button>
                    </Td>
                    <Td>{t.contacts.toLocaleString()}</Td>
                    <Td className="max-w-[220px] truncate text-[12px] text-ink-3">{t.usedBySegments.join(", ") || "—"}</Td>
                    <Td className="text-right">
                      <span className="inline-flex gap-2 text-[12px] font-medium">
                        <button onClick={() => { const name = window.prompt("Rename tag", t.name); if (name && name !== t.name) act({ action: "update", id: t.id, name }, "Renamed. Everything referencing the tag by id is unaffected."); }} className="text-brand hover:underline">Rename</button>
                        {!t.archived && <button onClick={() => setMergeFrom(t)} className="text-brand hover:underline">Merge</button>}
                        {t.archived
                          ? <button onClick={() => act({ action: "archive", id: t.id, archived: false }, "Restored.")} className="text-emerald-700 hover:underline">Restore</button>
                          : <button onClick={() => act({ action: "archive", id: t.id, archived: true }, "Archived.")} className="text-ink-3 hover:underline">Archive</button>}
                        {t.contacts === 0 && <button onClick={() => act({ action: "delete", id: t.id }, "Deleted.")} className="text-red-600 hover:underline">Delete</button>}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
