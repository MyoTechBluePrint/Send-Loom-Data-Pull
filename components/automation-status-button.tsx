"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pause and resume, from the workflow's own page.
 *
 * A draft cannot be set live from here on purpose: going live belongs in
 * the editor, where the trigger is checked and the steps are in view.
 */
export function AutomationStatusButton({ automationId, status }: { automationId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  if (status === "draft") return null;

  const next = status === "live" ? "paused" : "live";
  return (
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
  );
}
