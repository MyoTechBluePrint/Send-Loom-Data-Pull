"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui";

export function AdminResetClient() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset-demo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const json = await res.json();
      setResult(json.ok ? "Reset complete. Clean demo data is live; everyone's login still works." : json.error ?? "Failed");
      if (json.ok) {
        setConfirm("");
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-4 border-red-200">
      <CardHeader title="Reset demo data" subtitle="Owner only · staging only · do not use in production" />
      <div className="px-5 py-4">
        <p className="text-[13px] leading-relaxed text-ink-2">
          Wipes demo contacts, tasks, audiences, campaigns, inbox items, feedback test data and activity, then re-seeds the
          clean Vitalis demo story. Use it when test data gets messy. Logins are re-provisioned automatically; nobody is locked out.
        </p>
        {result && (
          <p className={`mt-3 rounded-lg border px-3 py-2 text-sm ${result.startsWith("Reset complete") ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-700"}`}>
            {result}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder='Type RESET to enable'
            className="rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-red-400"
          />
          <button
            disabled={confirm !== "RESET" || busy}
            onClick={reset}
            className="rounded-lg bg-red-600 px-4 py-2 text-[13px] font-bold text-white hover:bg-red-700 disabled:opacity-40"
          >
            {busy ? "Resetting… (takes ~20s)" : "Reset demo data"}
          </button>
        </div>
      </div>
    </Card>
  );
}
