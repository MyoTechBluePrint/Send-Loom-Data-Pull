"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, Badge, Th, Td } from "@/components/ui";
import { gbp, num, type Campaign } from "@/lib/data";
import type { CampaignList, PerformanceScope } from "@/lib/server/views";

type SendSummary = { sent: number; failed: number; skippedConsent: number; skippedSuppressed: number; skippedNoEmail: number; provider: string };

// Rows from getCampaignsView: the base Campaign shape plus the automation an
// automation shadow campaign belongs to, so its row links there, and the
// deletion stamp when the row comes from the deleted or all lenses.
type CampaignRow = Campaign & { automationId?: string | null; deletedAt?: string; deletedBy?: string };

type Summary = { all: PerformanceScope; visible: PerformanceScope; archivedCount: number; deletedCount: number };

export function CampaignsClient({
  campaigns,
  list = "working",
  canSeeDeleted = false,
  perf,
}: {
  campaigns: CampaignRow[];
  list?: CampaignList;
  canSeeDeleted?: boolean;
  perf?: Summary;
}) {
  const archived = list === "archived";
  const deletedView = list === "deleted";
  const router = useRouter();
  const [sending, setSending] = useState<string | null>(null);
  const [summary, setSummary] = useState<SendSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Two-step send: "checking" holds the row whose eligibility is being fetched,
  // "confirming" holds the audience numbers awaiting an explicit Confirm.
  const [checking, setChecking] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<{ id: string; eligible: number; total: number } | null>(null);
  // Inline rename: the row being edited, and saved names layered over the
  // server props so the list reads correctly before the refresh lands.
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const [renamed, setRenamed] = useState<Record<string, string>>({});
  const [shelving, setShelving] = useState<string | null>(null);

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

  async function removeSent(id: string, name: string) {
    // The truth in the dialog: deletion tidies the working view and never
    // touches the numbers. Nobody deletes their way to a better report.
    if (!window.confirm(
      `Delete '${name}'?\n\nIt disappears from the working lists, but its sends, opens, clicks and revenue stay in historical analytics permanently — deleting a campaign never improves reported performance. Admins can view and restore deleted campaigns.`
    )) return;
    const res = await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!body.ok) window.alert(body.error ?? "The campaign could not be deleted.");
    router.refresh();
  }

  async function restoreDeleted(id: string) {
    const res = await fetch(`/api/campaigns/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ deleted: false }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!body.ok) setError(body.error ?? "The campaign could not be restored.");
    router.refresh();
  }

  async function saveRename(currentName: string) {
    if (!renaming) return;
    const value = renaming.value.trim();
    if (!value || value === currentName) {
      setRenaming(null);
      return;
    }
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${renaming.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: value }),
      });
      const json = await res.json();
      if (json.ok) {
        setRenamed((m) => ({ ...m, [renaming.id]: value }));
        router.refresh();
      } else {
        setError(typeof json.error === "string" ? json.error : "Could not rename the campaign.");
      }
    } catch {
      setError("Could not rename the campaign.");
    } finally {
      setRenaming(null);
    }
  }

  async function setShelved(id: string, toArchived: boolean) {
    setShelving(id);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ archived: toArchived }),
      });
      const json = await res.json();
      if (!json.ok) setError(typeof json.error === "string" ? json.error : "Could not update the campaign.");
      router.refresh();
    } catch {
      setError("Could not update the campaign.");
    } finally {
      setShelving(null);
    }
  }

  async function askToSend(id: string) {
    // Confirm step before anything fires: fetch the audience arithmetic so the
    // row can say exactly how many contacts a send would reach, and nothing is
    // delivered until the user presses Confirm.
    setChecking(id);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${id}/eligibility`);
      const json = await res.json();
      if (json.ok) setConfirming({ id, eligible: json.eligible, total: json.total });
      else setError(typeof json.error === "string" ? json.error : "Could not check the audience. Nothing was sent.");
    } catch {
      setError("Could not check the audience. Nothing was sent.");
    } finally {
      setChecking(null);
    }
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
      setConfirming(null);
    }
  }

  const filterLink = (active: boolean) =>
    `rounded-full px-3 py-1 text-xs font-semibold ${active ? "bg-[#ede9fe] text-brand" : "text-ink-3 hover:bg-[#f0efec] hover:text-ink-2"}`;

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

      {perf && perf.all.sends > 0 && (
        <Card className="mb-4 px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[13px] font-semibold">All-time performance · every campaign that ever sent</p>
            <p className="text-[11px] text-ink-3">
              includes {perf.archivedCount} archived and {perf.deletedCount} deleted · deletion never removes results from these totals
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {([
              ["Campaigns", num(perf.all.campaigns)],
              ["Sends", num(perf.all.sends)],
              ["Delivered", num(perf.all.delivered)],
              ["Opens", `${num(perf.all.opened)}${perf.all.delivered ? ` · ${Math.round((perf.all.opened / perf.all.delivered) * 1000) / 10}%` : ""}`],
              ["Clicks", `${num(perf.all.clicked)}${perf.all.delivered ? ` · ${Math.round((perf.all.clicked / perf.all.delivered) * 1000) / 10}%` : ""}`],
              ["Attributed revenue", gbp(perf.all.revenue)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k}>
                <p className="text-[11px] font-medium text-ink-3">{k}</p>
                <p className="tabular mt-0.5 text-sm font-semibold">{v}</p>
              </div>
            ))}
          </div>
          {(perf.deletedCount > 0 || perf.archivedCount > 0) && (
            <p className="mt-3 border-t border-line pt-2.5 text-[11px] text-ink-3">
              Working list alone: {num(perf.visible.sends)} sends · {num(perf.visible.opened)} opens · {gbp(perf.visible.revenue)} revenue.
              Judge overall performance by the all-time row above — it is the complete, unedited history.
            </p>
          )}
        </Card>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <Link href="/campaigns" className={filterLink(list === "working")}>Working list</Link>
        <Link href="/campaigns?filter=archived" className={filterLink(archived)}>Archived</Link>
        {canSeeDeleted && (
          <>
            <Link href="/campaigns?filter=deleted" className={filterLink(deletedView)}>Deleted</Link>
            <Link href="/campaigns?filter=all" className={filterLink(list === "all")}>All</Link>
          </>
        )}
      </div>

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
            {campaigns.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-sm text-ink-3">
                  {deletedView
                    ? "No deleted campaigns. Deleting a campaign moves it here — its performance history always stays in analytics."
                    : archived
                      ? "No archived campaigns. Archiving a sent campaign moves it here without losing its history."
                      : "No campaigns yet."}
                </td>
              </tr>
            )}
            {campaigns.map((c) => {
              const name = renamed[c.id] ?? c.name;
              return (
              <tr key={c.id} className="hover:bg-[#fafaf8]">
                <Td>
                  {renaming?.id === c.id ? (
                    <input
                      autoFocus
                      value={renaming.value}
                      maxLength={140}
                      onChange={(e) => setRenaming({ id: c.id, value: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveRename(name);
                        if (e.key === "Escape") setRenaming(null);
                      }}
                      onBlur={() => void saveRename(name)}
                      className="w-full max-w-[320px] rounded-md border border-line bg-surface px-2 py-1 text-sm font-medium outline-none focus:border-brand"
                    />
                  ) : (
                    <span className="group inline-flex items-center gap-1.5">
                      {c.automationId ? (
                        <Link href={`/automations/${c.automationId}`} className="font-medium hover:text-brand">{name}</Link>
                      ) : (
                        <Link href={`/campaigns/${c.id}`} className="font-medium hover:text-brand">{name}</Link>
                      )}
                      <button
                        onClick={() => setRenaming({ id: c.id, value: name })}
                        className="text-[13px] text-ink-3 opacity-0 hover:text-ink-1 focus:opacity-100 group-hover:opacity-100"
                        title="Rename"
                        aria-label={`Rename ${name}`}
                      >
                        ✎
                      </button>
                    </span>
                  )}
                  <p className="text-xs text-ink-3">{c.subject ? `“${c.subject}” · ` : ""}{c.sentAt}</p>
                </Td>
                <Td><Badge value={c.status} /></Td>
                <Td className="text-xs text-ink-2">{c.audience}</Td>
                <Td className="tabular text-right">{c.recipients ? num(c.recipients) : "–"}</Td>
                <Td className="tabular text-right">{c.status === "sent" ? `${c.openRate}%` : "–"}</Td>
                <Td className="tabular text-right">{c.status === "sent" ? `${c.clickRate}%` : "–"}</Td>
                <Td className="tabular text-right font-semibold">{c.status === "sent" && c.revenue > 0 ? gbp(c.revenue) : "–"}</Td>
                <Td className="text-right">
                  {c.automationId ? (
                    <Link href={`/automations/${c.automationId}`} className="text-xs font-semibold text-ink-2 hover:text-brand" title="This email is part of an automation">
                      View automation
                    </Link>
                  ) : c.status === "draft" ? (
                    <span className="inline-flex items-center gap-1.5">
                      {c.isDemo && <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-600" title="Template · no live sends yet">Template</span>}
                      {confirming?.id === c.id ? (
                        <>
                          <span className="text-xs font-medium text-ink-2">Send to {num(confirming.eligible)} eligible contact{confirming.eligible === 1 ? "" : "s"}?</span>
                          <button
                            disabled={sending === c.id}
                            onClick={() => send(c.id)}
                            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
                          >
                            {sending === c.id ? "Sending…" : "Confirm"}
                          </button>
                          <button
                            disabled={sending === c.id}
                            onClick={() => setConfirming(null)}
                            className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={checking === c.id || sending === c.id}
                          onClick={() => askToSend(c.id)}
                          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50"
                        >
                          {checking === c.id ? "…" : "Send"}
                        </button>
                      )}
                      <button onClick={() => duplicate(c.id)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]" title="Duplicate">⧉</button>
                      <button onClick={() => removeDraft(c.id, name)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-3 hover:bg-red-50 hover:text-red-700" title="Delete draft">✕</button>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${c.isDemo ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"}`}>
                        {c.isDemo ? "Demo" : "Real"}
                      </span>
                      {c.deletedAt ? (
                        <>
                          <span className="text-[11px] text-ink-3" title={c.deletedBy ? `Deleted by ${c.deletedBy}` : undefined}>
                            Deleted {c.deletedAt}
                          </span>
                          {canSeeDeleted && (
                            <button
                              onClick={() => restoreDeleted(c.id)}
                              className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec]"
                              title="Restore · returns it to its list; the deletion stays in the audit ledger"
                            >
                              Restore
                            </button>
                          )}
                        </>
                      ) : archived ? (
                        <>
                          <button
                            disabled={shelving === c.id}
                            onClick={() => setShelved(c.id, false)}
                            className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50"
                          >
                            {shelving === c.id ? "…" : "Restore"}
                          </button>
                          <button
                            onClick={() => removeSent(c.id, name)}
                            className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-3 hover:bg-red-50 hover:text-red-700"
                            title="Delete · removes it from the lists; performance history stays in analytics"
                          >
                            Delete
                          </button>
                        </>
                      ) : c.status === "sent" ? (
                        <>
                          <button
                            disabled={shelving === c.id}
                            onClick={() => setShelved(c.id, true)}
                            className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-ink-3 hover:bg-[#f0efec] hover:text-ink-2 disabled:opacity-50"
                            title="Archive · keeps every record, hides it from this list"
                          >
                            {shelving === c.id ? "…" : "Archive"}
                          </button>
                          <button
                            onClick={() => removeSent(c.id, name)}
                            className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-semibold text-ink-3 hover:bg-red-50 hover:text-red-700"
                            title="Delete · removes it from the lists; performance history stays in analytics"
                          >
                            ✕
                          </button>
                        </>
                      ) : null}
                    </span>
                  )}
                </Td>
              </tr>
              );
            })}
          </tbody>
        </table></div>
        <p className="border-t border-line px-4 py-3 text-xs text-ink-3">
          <b>Sending is live.</b> "Send" delivers real email to every eligible
          contact through the workspace's provider, after consent, suppression
          and content checks. The confirm step shows exactly who will receive
          it; rows sent before the provider was armed were simulated and never
          reached an inbox, which is why their opens read 0%. Deleting a
          campaign only removes it from the working lists — its results stay
          in historical analytics permanently.
        </p>
      </Card>
    </Shell>
  );
}
