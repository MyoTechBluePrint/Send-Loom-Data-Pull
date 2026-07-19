"use client";

// Owner switch between live and test tracking per store.
import { useState } from "react";
import { useRouter } from "next/navigation";

export function TrackingModeToggle({ storeId, mode }: { storeId: string; mode: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = mode === "test" ? "live" : "test";

  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/admin/stores/${storeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ trackingMode: next }),
        });
        setBusy(false);
        router.refresh();
      }}
      className={`rounded-full px-2 py-0.5 text-[11px] font-bold transition ${mode === "test" ? "bg-sky-100 text-sky-700 hover:bg-sky-200" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}
      title={mode === "test" ? "Test mode: events visible in QA, excluded from analytics. Click for LIVE." : "Live mode: events count as real. Click for TEST mode during installs."}
    >
      {busy ? "…" : mode === "test" ? "TEST MODE" : "LIVE"}
    </button>
  );
}
