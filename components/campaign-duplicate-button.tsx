"use client";

import { useState } from "react";

/** Duplicate this campaign as a fresh draft and jump to it. */
export function CampaignDuplicateButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const res = await fetch(`/api/campaigns/${campaignId}`, { method: "POST" });
          const json = await res.json();
          if (json.ok) window.location.href = `/campaigns/${json.id}`;
          else window.alert(typeof json.error === "string" ? json.error : "Could not duplicate the campaign.");
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
    >
      {busy ? "Duplicating…" : "Duplicate"}
    </button>
  );
}
