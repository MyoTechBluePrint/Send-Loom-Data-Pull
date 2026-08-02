"use client";

// The template section on a campaign page: which email design is attached,
// whether it has unsaved edits, and every route into working with it.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui";

type Info = {
  campaign: {
    id: string; subject: string | null; status: string; sent: boolean;
    content: string | null; contentDirty: boolean;
    templateId: string | null; templateName: string | null;
  };
  issues: { level: string; message: string }[];
};
type TemplateRow = { id: string; name: string; category: string; archived: boolean; usedByCampaigns: number };

export function CampaignEmailPanel({ campaignId }: { campaignId: string }) {
  const [info, setInfo] = useState<Info | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const [showSaveAs, setShowSaveAs] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/campaigns/${campaignId}/email`).then((r) => r.json()).then((j) => j.ok && setInfo(j)).catch(() => {});
  }, [campaignId]);
  useEffect(load, [load]);

  async function act(body: Record<string, unknown>, confirmMessage?: string) {
    setNotice(null);
    let res = await fetch(`/api/campaigns/${campaignId}/email`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    let j = await res.json();
    if (j.needsConfirm && confirmMessage && window.confirm(`${j.error}\n\n${confirmMessage}`)) {
      res = await fetch(`/api/campaigns/${campaignId}/email`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, confirmReplace: true }),
      });
      j = await res.json();
    }
    setNotice(j.ok ? "Done." : j.error ?? null);
    if (j.ok) { setChoosing(false); setShowSaveAs(false); load(); }
  }

  if (!info) return <Card className="h-28 animate-pulse"><span /></Card>;
  const c = info.campaign;
  const hasContent = Boolean(c.content && c.content !== "null" && c.content !== "[]");
  const errors = info.issues.filter((i) => i.level === "error");

  return (
    <Card>
      <CardHeader
        title="Email design"
        subtitle={
          !hasContent
            ? "No email attached yet — choose a template or start from blank"
            : c.templateName
              ? `Template: ${c.templateName}${c.contentDirty ? " · edited since applied" : ""}`
              : "Custom design built for this campaign"
        }
        action={
          hasContent ? (
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${errors.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>
              {errors.length ? `${errors.length} to fix` : "Ready"}
            </span>
          ) : undefined
        }
      />
      <div className="px-5 py-4">
        {notice && <p className="mb-3 rounded-lg border border-line bg-[#f7f6f4] px-3 py-2 text-[12px] text-ink-2">{notice}</p>}
        {errors.length > 0 && hasContent && (
          <ul className="mb-3 space-y-0.5">
            {errors.map((e, i) => <li key={i} className="text-[12px] text-amber-800">● {e.message}</li>)}
          </ul>
        )}

        <div className="flex flex-wrap gap-2">
          {hasContent ? (
            <>
              <Link href={`/campaigns/${c.id}/email`} className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white">
                {c.sent ? "View email" : "Edit email"}
              </Link>
              <Link href={`/campaigns/${c.id}/email`} className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
                Preview & test
              </Link>
              {!c.sent && (
                <>
                  <button onClick={() => { setChoosing((v) => !v); if (!templates) fetch("/api/templates").then((r) => r.json()).then((j) => j.ok && setTemplates(j.templates)); }}
                    className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
                    Choose template
                  </button>
                  <button onClick={() => setShowSaveAs((v) => !v)}
                    className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
                    Save as template
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <button onClick={() => { setChoosing((v) => !v); if (!templates) fetch("/api/templates").then((r) => r.json()).then((j) => j.ok && setTemplates(j.templates)); }}
                className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white">
                Choose template
              </button>
              <button onClick={() => act({ action: "start_blank" })}
                className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">
                Start from blank
              </button>
            </>
          )}
        </div>

        {choosing && (
          <div className="mt-3 rounded-xl border border-line bg-[#faf9f7] p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Apply a saved template</p>
            {!templates ? (
              <p className="mt-2 text-[12px] text-ink-3">Loading…</p>
            ) : templates.length === 0 ? (
              <p className="mt-2 text-[12px] text-ink-3">
                No templates yet. <Link href="/templates" className="font-medium text-brand hover:underline">Create one in the library</Link> or start from blank.
              </p>
            ) : (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
                {templates.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium">{t.name}</span>
                      <span className="text-[11px] capitalize text-ink-3">{t.category.replace(/_/g, " ")} · used by {t.usedByCampaigns}</span>
                    </span>
                    <button
                      onClick={() => act({ action: "apply_template", templateId: t.id }, "Replace the current email with this template?")}
                      className="shrink-0 text-[12px] font-semibold text-brand hover:underline"
                    >
                      Apply
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {showSaveAs && (
          <div className="mt-3 flex gap-2 rounded-xl border border-line bg-[#faf9f7] p-3">
            <input
              value={saveAsName} onChange={(e) => setSaveAsName(e.target.value)} placeholder="Template name"
              className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-[13px] outline-none focus:border-brand"
            />
            <button
              onClick={() => saveAsName && act({ action: "save_as_template", name: saveAsName })}
              className="shrink-0 rounded-lg bg-[#14121f] px-4 py-2 text-[13px] font-semibold text-white"
            >
              Save
            </button>
          </div>
        )}
      </div>
    </Card>
  );
}
