"use client";

// Small clipboard button used for store keys and install details.
import { useState } from "react";

export function CopyButton({ label, text, small = false }: { label: string; text: string; small?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 2000);
      }}
      className={`rounded-lg border border-line font-semibold text-ink-2 transition hover:bg-[#f0efec] ${small ? "px-2 py-1 text-[11px]" : "px-3 py-1.5 text-[12px]"}`}
    >
      {done ? "Copied ✓" : label}
    </button>
  );
}
