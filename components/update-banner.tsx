"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * The "things changed" notice, shown once per release until dismissed.
 *
 * Keyed by release date in localStorage, so each release announces itself
 * exactly once per browser and never nags. Deliberately a quiet card, not a
 * modal: the marketing team should notice it, not be interrupted by it.
 */
const RELEASE_KEY = "sendloom-update-2026-08-22";

export function UpdateBanner() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(window.localStorage.getItem(RELEASE_KEY) !== "dismissed");
    } catch {
      setOpen(true);
    }
  }, []);

  if (!open) return null;

  return (
    <div className="mb-4 rounded-xl border border-brand bg-brand-soft px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[13px] font-bold text-brand">Sendloom update · new improvements are live</p>
        <p className="text-[12.5px] text-ink-2">
          Welcome automation now sends by itself · workflow editing · per-channel consent tools · store health monitoring · imports fixed
        </p>
        <div className="ml-auto flex items-center gap-3">
          <Link href="/whats-new" className="text-[12.5px] font-bold text-brand hover:underline">
            View what changed
          </Link>
          <button
            onClick={() => {
              try { window.localStorage.setItem(RELEASE_KEY, "dismissed"); } catch {}
              setOpen(false);
            }}
            className="text-[12.5px] font-semibold text-ink-3 hover:text-ink-2"
            aria-label="Dismiss"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
