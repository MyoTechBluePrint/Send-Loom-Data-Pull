"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, Badge, Th, Td } from "@/components/ui";
import { gbp, num, type Campaign } from "@/lib/data";

type SendSummary = { sent: number; failed: number; skippedConsent: number; skippedSuppressed: number; skippedNoEmail: number; provider: string };

export function CampaignsClient({ campaigns }: { campaigns: Campaign[] }) {
  const router = useRouter();
  const [sending, setSending] = useState<string | null>(null);
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function quickDraft() {
    const name = window.prompt("New draft campaign name", "Untitled campaign");
    if (!name) return;
    await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    router.refresh();
  }

  async function duplicate(id: string) {
    await fetch(`/api/campaigns/${id}`, { method: "POST" });
    router.refresh();
  }

  async function removeDraft(id: string, name: string) {
    if (!window.confirm(`Delete draft '${name}'?`)) return;
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.refresh();
  }

  async function send(id: string) {
    setSending(id);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/send`, { method: "POST" });
      const json = await res.json();
      if (json.ok) setSummary(json);
      else setError(json.error ?? "Send failed");
      router.refresh();
    } finally {
      setSending(null);
    }
  }

  return (
    <Shell
      title="Campaigns"
      subtitle="One-off sends · consent and suppression enforced at send time, whatever the audience"
      actions={
        <>
          <button onClick={quickDraft} className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Quick draft</button>
          <Link href="/campaigns/new"><PrimaryButton>Create campaign</PrimaryButton></Link>
        </>
      }
    >
      {summary && (
        <div className="mb-4 flex items-start justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span>
            Sent to {summary.sent} contact{summary.sent === 1 ? "" : "s"} via <b>{summary.provider}</b>
            {summary.provider === "dev-log" ? " (dev transport, no real email delivered)" : ""} ·
            skipped {summary.skippedConsent} without consent, {summary.skippedSuppressed} suppressed, {summary.skippedNoEmail} without email
          </span>
          <button onClick={() => setSummary(null)} className="ml-3 text-emerald-700 hover:text-emerald-900">✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <Card>
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[900px]">
          <thead className="border-b border-line">
            <tr>
              <Th>Campaign</Th>
              <Th>Status</Th>
              <Th>Audience</Th>
              <Th className="text-right">Recipients</Th>
              <Th className="text-right">Opens</Th>
              <Th className="text-right">Clicks</Th>
              <Th className="text-right">Revenue</Th>
              <Th className="text-right">Data</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-[#fafaf8]">
                <Td>
                  <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-brand">{c.name}</Link>
                  <p className="text-xs text-ink-3">{c.subject ? `“${c.subject}” · ` : ""}{c.sentAt}</p>
                </Td>
                <Td><Badge value={c.status} /></Td>
                <Td className="text-xs text-ink-2">{c.audience}</Td>
                <Td className="tabular text-right">{c.recipients ? num(c.recipients) : "–"}</Td>
                <Td className="tabular text-right">{c.status === "sent" ? `${c.openRate}%` : "–"}</Td>
                <Td className="tabular text-right">{c.status === "sent" ? `${c.clickRate}%` : "–"}</Td>
                <Td className="tabular text-right font-semibold">{c.status === "sent" && c.revenue > 0 ? gbp(c.revenue) : "–"}</Td>
                <Td className="text-right">
                  {c.status === "draft" ? (
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        disabled={sending === c.id}
                        onClick={() => send(c.id)}
                        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
                      >
                        {sending === c.id ? "Sending…" : "Send now"}
                      </button>
                      <button onClick={() => duplicate(c.id)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]" title="Duplicate">⧉</button>
                      <button onClick={() => removeDraft(c.id, c.name)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-3 hover:bg-red-50 hover:text-red-700" title="Delete draft">✕</button>
                    </span>
                  ) : (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.isDemo ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"}`}>
                      {c.isDemo ? "Demo" : "Real"}
                    </span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="border-t border-line px-4 py-3 text-xs text-ink-3">
          "Send now" uses the active provider. Without SES credentials that's the <b>dev transport</b>: sends are recorded and tracked (opens/clicks feed lead scores) but no real email leaves the platform.
        </p>
      </Card>
    </Shell>
  );
}
