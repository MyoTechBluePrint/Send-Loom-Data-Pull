"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Card, CardHeader } from "@/components/ui";

export function AdminResetClient() {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const [mode, setMode] = useState<"clean_launch" | "demo">("clean_launch");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function reset() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/reset-demo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm, mode }),
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
      <CardHeader title="Reset workspace" subtitle="Owner only · staging only · do not use in production" />
      <div className="px-5 py-4">
        <div className="flex gap-2 pb-3">
          {([["clean_launch", "Clean launch workspace"], ["demo", "Vitalis demo data"]] as const).map(([m, label]) => (
            <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[13px] font-medium ${mode === m ? "border-brand bg-brand-soft text-brand" : "border-line"}`}>
              <input type="radio" checked={mode === m} onChange={() => setMode(m)} className="accent-[#6d28d9]" />
              {label}
            </label>
          ))}
        </div>
        <p className="text-[13px] leading-relaxed text-ink-2">
          {mode === "clean_launch"
            ? "Wipes everything and seeds the fresh ads-team workspace: MyoTech + Novatec pending, campaign/automation/popup templates only, no contacts, no Savvy Mango data, no demo revenue."
            : "Wipes everything and re-seeds the full Vitalis wellness demo story (contacts, imports, inbox, demo analytics)."}
          {" "}Logins are re-provisioned automatically; nobody is locked out. Take a backup first: Admin → Export backup.
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
