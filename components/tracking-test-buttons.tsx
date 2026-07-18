"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TESTS: [string, string][] = [
  ["page_viewed", "Page view"],
  ["product_viewed", "Product view"],
  ["cart_add", "Add to cart"],
  ["checkout_started", "Checkout"],
  ["checkout_email_entered", "Checkout email"],
  ["popup_submitted", "Popup submit"],
  ["purchase_completed", "Purchase"],
  ["sweep", "Run abandon sweep"],
];

export function TrackingTestButtons() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function fire(type: string) {
    setBusy(type);
    try {
      await fetch("/api/tracking/test", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1.5">
      {TESTS.map(([type, label]) => (
        <button
          key={type}
          disabled={busy !== null}
          onClick={() => fire(type)}
          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
        >
          {busy === type ? "…" : label}
        </button>
      ))}
    </div>
  );
}
