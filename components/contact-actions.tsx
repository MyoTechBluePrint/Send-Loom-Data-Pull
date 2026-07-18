"use client";

// Profile quick actions: add note + archive. Real writes, labelled as staging
// demo changes.
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ContactActions({ contactId, archived }: { contactId: string; archived: boolean }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function patch(body: object, tag: string) {
    setBusy(tag);
    try {
      await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setNote("");
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,11,11,0.04)]">
      <div className="border-b border-line px-5 py-4">
        <h2 className="text-sm font-semibold">Actions</h2>
        <p className="mt-0.5 text-xs text-ink-3">Demo changes · write to the staging database</p>
      </div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add a note to the timeline…"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand"
          />
          <button
            disabled={!note.trim() || busy !== null}
            onClick={() => patch({ note: note.trim() }, "note")}
            className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
          >
            {busy === "note" ? "Saving…" : "Add note"}
          </button>
        </div>
        {archived ? (
          <p className="rounded-lg bg-[#f0efec] px-3 py-2 text-xs text-ink-2">Archived: excluded from all sending. History and ledger retained.</p>
        ) : (
          <button
            disabled={busy !== null}
            onClick={() => patch({ archive: true }, "archive")}
            className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
          >
            {busy === "archive" ? "Archiving…" : "Archive contact (suppresses, never hard-deletes)"}
          </button>
        )}
      </div>
    </div>
  );
}
