"use client";

// Audience picker on the campaign page: a draft targets every contact or one
// saved segment. The choice is advisory until send time, when resolveAudience
// re-runs consent, suppression and Do Not Contact checks against it, and the
// confirm step on the campaigns list stays the last safety net.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader } from "@/components/ui";
import { num } from "@/lib/data";

type SegmentOption = { id: string; name: string; count: number };

export function CampaignAudiencePanel({ campaignId, audienceType, audienceRef, segments }: {
  campaignId: string;
  audienceType: string | null;
  audienceRef: string | null;
  segments: SegmentOption[];
}) {
  // Stored refs can be a segment id or a legacy name; either maps to the id
  // the select works in. A ref matching nothing is shown as its own option
  // rather than silently displayed as "All contacts", because the send would
  // resolve it to an empty audience, not to everyone.
  const stored = audienceType === "segment" && audienceRef
    ? segments.find((s) => s.id === audienceRef || s.name === audienceRef)?.id ?? audienceRef
    : "";
  const missing = stored !== "" && !segments.some((s) => s.id === stored);

  const [value, setValue] = useState(stored);
  const [busy, setBusy] = useState(false);
  const [eligible, setEligible] = useState<{ eligible: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function save(next: string) {
    const prev = value;
    setValue(next);
    setBusy(true);
    setError(null);
    setEligible(null);
    try {
      const r = await fetch(`/api/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next ? { audienceType: "segment", audienceRef: next } : { audienceType: null, audienceRef: null }),
      });
      const j = await r.json();
      if (!j.ok) {
        setValue(prev);
        setError(typeof j.error === "string" ? j.error : "Could not change the audience. Nothing was saved.");
        return;
      }
      // Fresh arithmetic for the new audience, from the same endpoint the
      // send confirm uses, then a refresh so the server-rendered breakdown
      // card below agrees with it.
      const e = await fetch(`/api/campaigns/${campaignId}/eligibility`).then((res) => res.json()).catch(() => null);
      if (e?.ok) setEligible({ eligible: e.eligible, total: e.total });
      router.refresh();
    } catch {
      setValue(prev);
      setError("Could not change the audience. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mt-3">
      <CardHeader title="Audience" subtitle="Who this draft targets · consent and suppression still enforced at send time" />
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={value}
            disabled={busy}
            onChange={(e) => save(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] disabled:opacity-50"
          >
            <option value="">All contacts</option>
            {segments.map((s) => (
              <option key={s.id} value={s.id}>{s.name} ({num(s.count)})</option>
            ))}
            {missing && <option value={stored}>{stored} (segment no longer exists)</option>}
          </select>
          {busy && <span className="text-xs text-ink-3">Saving…</span>}
          {!busy && eligible && (
            <span className="text-xs text-ink-2">
              Saved · reaches <b className="tabular text-emerald-700">{num(eligible.eligible)}</b> eligible of {num(eligible.total)} in the audience
            </span>
          )}
        </div>
        {error && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">{error}</p>}
      </div>
    </Card>
  );
}
