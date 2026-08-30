"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pause, resume, duplicate, delete and restore, from the workflow's own page.
 *
 * A draft cannot be set live from here on purpose: going live belongs in
 * the editor, where the trigger is checked and the steps are in view.
 * Deletion is the soft kind: the workflow leaves the working list and stops
 * enrolling, while its runs and sent emails stay in historical analytics.
 */
export function AutomationStatusButton({
  automationId,
  status,
  deleted = false,
  canDelete = false,
  canRestore = false,
}: {
  automationId: string;
  status: string;
  deleted?: boolean;
  canDelete?: boolean;
  canRestore?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (deleted) {
    if (!canRestore) return null;
    return (
      <button
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch(`/api/automations/${automationId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deleted: false }),
            });
            if ((await res.json()).ok) router.refresh();
          } finally {
            setBusy(false);
          }
        }}
        className="rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[13px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
      >
        {busy ? "…" : "Restore workflow"}
      </button>
    );
  }

  const deleteButton = canDelete ? (
    <button
      disabled={busy}
      onClick={async () => {
        if (!window.confirm(
          "Delete this workflow?\n\nIt stops enrolling contacts and leaves the working list. Everything it already did — runs, sent emails, opens, clicks, revenue — stays in historical analytics permanently. Admins can view and restore deleted workflows."
        )) return;
        setBusy(true);
        try {
          const res = await fetch(`/api/automations/${automationId}`, { method: "DELETE" });
          const json = await res.json();
          if (json.ok) window.location.href = "/automations";
          else window.alert(json.error ?? "The workflow could not be deleted.");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-3 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
      title="Delete · removes it from the working list; performance history stays in analytics"
    >
      Delete
    </button>
  ) : null;

  const duplicate = (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/automations/${automationId}/duplicate`, { method: "POST" });
          const json = await res.json();
          if (json.ok) window.location.href = `/automations/${json.id}/edit`;
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
    >
      Duplicate
    </button>
  );

  if (status === "draft") return (
    <>
      {duplicate}
      {deleteButton}
    </>
  );

  const next = status === "live" ? "paused" : "live";
  return (
    <>
    {duplicate}
    {deleteButton}
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/automations/${automationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next }),
          });
          if ((await res.json()).ok) router.refresh();
        } finally {
          setBusy(false);
        }
      }}
      className={`rounded-lg border px-3.5 py-2 text-[13px] font-semibold disabled:opacity-50 ${
        status === "live"
          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
          : "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
      }`}
    >
      {busy ? "…" : status === "live" ? "Pause" : "Resume"}
    </button>
    </>
  );
}
