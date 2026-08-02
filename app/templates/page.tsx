"use client";

// The template library: every reusable email design in the workspace, with
// create, duplicate, rename, archive, restore, search, filters and usage.
// Workspace-scoped by the API; nothing here can see another workspace.

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";

type Row = {
  id: string; name: string; description: string | null; category: string;
  brandName: string | null; archived: boolean; blockCount: number;
  usedByCampaigns: number; updatedAt: string; updatedBy: string | null;
};

/** A live-rendered thumbnail: the template's real HTML, scaled down. */
function Thumb({ id }: { id: string }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/templates/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "preview" }) })
      .then((r) => r.json()).then((j) => j.ok && setHtml(j.html)).catch(() => {});
  }, [id]);
  return (
    <div className="pointer-events-none h-40 overflow-hidden rounded-t-2xl border-b border-line bg-[#efeee9]">
      {html ? (
        <iframe title="preview" srcDoc={html} sandbox="" scrolling="no"
          className="h-[640px] w-[400%] origin-top-left scale-25 border-0" />
      ) : (
        <div className="h-full animate-pulse bg-black/[0.03]" />
      )}
    </div>
  );
}

export default function TemplatesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("newsletter");
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (category) params.set("category", category);
    if (showArchived) params.set("archived", "1");
    fetch(`/api/templates?${params}`)
      .then((r) => r.json())
      .then((j) => { if (j.ok) { setRows(j.templates); setCategories(j.categories); } })
      .catch(() => setRows([]));
  }, [q, category, showArchived]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function create() {
    if (!newName) return;
    const r = await fetch("/api/templates", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, category: newCategory }),
    });
    const j = await r.json();
    if (j.ok) { setCreating(false); setNewName(""); load(); setNotice(`Created "${newName}". Attach it to a campaign to edit its content.`); }
    else setNotice(j.error ?? "Could not create.");
  }

  async function patch(id: string, body: Record<string, unknown>, msg: string) {
    const r = await fetch(`/api/templates/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const j = await r.json();
    setNotice(j.ok ? msg : j.error ?? "Failed.");
    load();
  }

  async function duplicate(id: string) {
    const r = await fetch(`/api/templates/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "duplicate" }),
    });
    const j = await r.json();
    setNotice(j.ok ? "Duplicated." : j.error ?? "Failed.");
    load();
  }

  return (
    <Shell
      title="Templates"
      subtitle="Reusable email designs for this workspace"
      actions={<span onClick={() => setCreating((v) => !v)}><PrimaryButton>New template</PrimaryButton></span>}
    >
      {notice && <p className="mb-4 rounded-lg border border-line bg-[#f7f6f4] px-4 py-2.5 text-[13px] text-ink-2">{notice}</p>}

      {creating && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-end gap-3 px-5 py-4">
            <label className="min-w-[220px] flex-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Name</span>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-brand" />
            </label>
            <label>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Category</span>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="mt-1 rounded-lg border border-line px-3 py-2 text-sm capitalize outline-none focus:border-brand">
                {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
              </select>
            </label>
            <button onClick={create} className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-sm font-semibold text-white">Create</button>
          </div>
        </Card>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates…"
          className="w-56 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] outline-none focus:border-brand"
        />
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] capitalize outline-none">
          <option value="">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
        </select>
        <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-ink-2">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="h-3.5 w-3.5 accent-[#6d28d9]" />
          Archived
        </label>
      </div>

      <Card>
        <CardHeader title={showArchived ? "Archived templates" : "Templates"} subtitle={rows ? `${rows.length} in this workspace` : "Loading…"} />
        {!rows ? (
          <div className="h-40 animate-pulse" />
        ) : rows.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <p className="text-sm font-medium">{showArchived ? "Nothing archived." : "No templates yet."}</p>
            {!showArchived && (
              <>
                <p className="mt-1 text-[13px] text-ink-3">
                  Add the starter set, or build an email on a campaign and use &quot;Save as template&quot;.
                </p>
                <button
                  onClick={async () => {
                    const r = await fetch("/api/templates/starters", { method: "POST" });
                    const j = await r.json();
                    setNotice(j.ok ? `Added ${j.created} starter templates.` : "Could not add starters.");
                    load();
                  }}
                  className="mt-4 rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white"
                >
                  Add starter templates
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((t) => (
              <div key={t.id} className="group overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(11,11,11,0.04)] transition hover:shadow-md">
                <Thumb id={t.id} />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-semibold">{t.name}</p>
                      <p className="mt-0.5 text-[11px] capitalize text-ink-3">
                        {t.category.replace(/_/g, " ")}{t.brandName ? ` · ${t.brandName}` : ""} · {t.blockCount} blocks
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#f0efec] px-2 py-0.5 text-[10px] font-semibold text-ink-3">
                      {t.usedByCampaigns} use{t.usedByCampaigns === 1 ? "" : "s"}
                    </span>
                  </div>
                  {t.description && <p className="mt-1.5 line-clamp-2 text-[12px] leading-relaxed text-ink-2">{t.description}</p>}
                  <div className="mt-3 flex flex-wrap gap-2 text-[12px] font-medium">
                    <button onClick={() => duplicate(t.id)} className="text-brand hover:underline">Duplicate</button>
                    <button
                      onClick={() => { const name = window.prompt("Rename template", t.name); if (name && name !== t.name) patch(t.id, { name }, "Renamed."); }}
                      className="text-brand hover:underline"
                    >
                      Rename
                    </button>
                    {t.archived
                      ? <button onClick={() => patch(t.id, { archived: false }, "Restored.")} className="text-emerald-700 hover:underline">Restore</button>
                      : <button onClick={() => patch(t.id, { archived: true }, "Archived. Campaigns already using it are unaffected.")} className="text-ink-3 hover:underline">Archive</button>}
                  </div>
                  <p className="mt-2 text-[10px] text-ink-3">
                    Updated {new Date(t.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    {t.updatedBy ? ` by ${t.updatedBy.split("@")[0]}` : ""}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="mt-4 text-[11px] leading-relaxed text-ink-3">
        Templates are edited in context: open a campaign, apply the template and use{" "}
        <Link href="/campaigns" className="text-brand hover:underline">Edit email</Link>, then &quot;Save as template&quot; to publish
        the changes back to the library. Archiving hides a template from selection without touching campaigns that used it.
      </p>
    </Shell>
  );
}
