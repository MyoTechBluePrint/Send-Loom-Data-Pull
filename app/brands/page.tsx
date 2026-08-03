"use client";

// Brand kits: identity, colours, fonts, sender, menus, footer, store — and
// the reusable global elements that belong to each brand.

import { useCallback, useEffect, useState } from "react";
import { Shell, PrimaryButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";

type Brand = {
  id: string; name: string; websiteUrl: string | null; storeId: string | null; storeName: string | null;
  logoUrl: string | null; darkLogoUrl: string | null; iconUrl: string | null;
  primaryColor: string; secondaryColor: string; accentColor: string; backgroundColor: string; textColor: string;
  headingFont: string; bodyFont: string; buttonRadius: number;
  socialLinks: string | null; menuLinks: string | null; legalLinks: string | null;
  contactDetails: string | null; mailingAddress: string | null;
  senderName: string | null; senderEmail: string | null; replyToEmail: string | null;
  currency: string; locale: string; footerText: string | null; unsubscribeText: string;
  templates: number; elements: number;
};
type ElementRow = {
  id: string; name: string; brandName: string | null; content: string; version: number;
  archived: boolean; usedBy: { id: string; name: string }[]; versions: { version: number; savedBy: string | null }[];
};

const parseLinks = (s: string | null) => {
  try { return s ? (JSON.parse(s) as { label: string; url: string }[]) : []; } catch { return []; }
};
const linksText = (s: string | null) => parseLinks(s).map((l) => `${l.label} | ${l.url}`).join("\n");
const textLinks = (t: string) =>
  t.split("\n").map((line) => {
    const [label, url] = line.split("|").map((x) => x.trim());
    return label && url ? { label, url } : null;
  }).filter(Boolean);

export default function BrandsPage() {
  const [brands, setBrands] = useState<Brand[] | null>(null);
  const [stores, setStores] = useState<{ id: string; name: string }[]>([]);
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [editing, setEditing] = useState<Partial<Brand> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Shown beside the Save button — the top-of-page notice is off-screen when
  // the long edit form is scrolled, which made failed saves look like a dead button.
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/brands").then((r) => r.json()).then((j) => { if (j.ok) { setBrands(j.brands); setStores(j.stores); } }).catch(() => setBrands([]));
    fetch("/api/brands/elements").then((r) => r.json()).then((j) => j.ok && setElements(j.elements)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function save() {
    if (!editing?.name) { setSaveError("Give the brand a name."); return; }
    const body: Record<string, unknown> = { ...editing };
    body.socialLinks = textLinks(String((editing as Record<string, unknown>).socialLinksText ?? linksText(editing.socialLinks ?? null)));
    body.menuLinks = textLinks(String((editing as Record<string, unknown>).menuLinksText ?? linksText(editing.menuLinks ?? null)));
    body.legalLinks = textLinks(String((editing as Record<string, unknown>).legalLinksText ?? linksText(editing.legalLinks ?? null)));
    delete (body as Record<string, unknown>).socialLinksText;
    delete (body as Record<string, unknown>).menuLinksText;
    delete (body as Record<string, unknown>).legalLinksText;
    delete (body as Record<string, unknown>).storeName;
    delete (body as Record<string, unknown>).templates;
    delete (body as Record<string, unknown>).elements;

    setSaving(true);
    setSaveError(null);
    try {
      const r = await fetch("/api/brands", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json();
      if (j.ok) {
        setNotice("Brand saved. Templates and campaigns using it pick the change up on next render.");
        setEditing(null);
        load();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setSaveError(j.error ?? "Could not save.");
      }
    } catch {
      setSaveError("Could not reach the server. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function elementAct(body: Record<string, unknown>, msg: string) {
    const r = await fetch("/api/brands/elements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json();
    setNotice(j.ok ? msg : j.error ?? "Failed.");
    load();
  }

  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
  const small = "text-[11px] font-medium text-ink-3";
  const e = editing as Record<string, unknown> | null;

  return (
    <Shell
      title="Brands"
      subtitle="Each brand carries its own identity, sender, store and reusable elements"
      actions={<span onClick={() => setEditing({ name: "", primaryColor: "#6d28d9", currency: "GBP" })}><PrimaryButton>New brand</PrimaryButton></span>}
    >
      {notice && <p className="mb-4 rounded-lg border border-line bg-[#f7f6f4] px-4 py-2.5 text-[13px] text-ink-2">{notice}</p>}

      {editing && (
        <Card className="mb-4">
          <CardHeader title={editing.id ? `Edit ${editing.name}` : "New brand"} subtitle="Everything here is a default a campaign can override" />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
            <label><span className={small}>Name</span><input className={input} value={editing.name ?? ""} onChange={(ev) => setEditing({ ...editing, name: ev.target.value })} /></label>
            <label><span className={small}>Website</span><input className={input} value={editing.websiteUrl ?? ""} onChange={(ev) => setEditing({ ...editing, websiteUrl: ev.target.value || null })} /></label>
            <label><span className={small}>Connected store (products & coupons)</span>
              <select className={input} value={editing.storeId ?? ""} onChange={(ev) => setEditing({ ...editing, storeId: ev.target.value || null })}>
                <option value="">None</option>
                {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
            <label><span className={small}>Logo URL</span><input className={input} value={editing.logoUrl ?? ""} onChange={(ev) => setEditing({ ...editing, logoUrl: ev.target.value || null })} /></label>
            <label><span className={small}>Dark logo URL</span><input className={input} value={editing.darkLogoUrl ?? ""} onChange={(ev) => setEditing({ ...editing, darkLogoUrl: ev.target.value || null })} /></label>
            <label><span className={small}>Icon URL</span><input className={input} value={editing.iconUrl ?? ""} onChange={(ev) => setEditing({ ...editing, iconUrl: ev.target.value || null })} /></label>
            {(["primaryColor", "secondaryColor", "accentColor", "backgroundColor", "textColor"] as const).map((k) => (
              <label key={k}><span className={small}>{k.replace("Color", " colour")}</span>
                <span className="mt-1 flex items-center gap-2">
                  <input type="color" value={(editing[k] as string) ?? "#6d28d9"} onChange={(ev) => setEditing({ ...editing, [k]: ev.target.value })} className="h-8 w-10 cursor-pointer rounded border border-line" />
                  <input className="w-24 rounded-lg border border-line px-2 py-1 text-[12px] font-mono" value={(editing[k] as string) ?? ""} onChange={(ev) => setEditing({ ...editing, [k]: ev.target.value })} />
                </span>
              </label>
            ))}
            <label><span className={small}>Heading font stack</span><input className={input} value={editing.headingFont ?? "Helvetica, Arial, sans-serif"} onChange={(ev) => setEditing({ ...editing, headingFont: ev.target.value })} /></label>
            <label><span className={small}>Body font stack</span><input className={input} value={editing.bodyFont ?? "Helvetica, Arial, sans-serif"} onChange={(ev) => setEditing({ ...editing, bodyFont: ev.target.value })} /></label>
            <label><span className={small}>Button radius (px)</span><input type="number" className={input} value={editing.buttonRadius ?? 8} onChange={(ev) => setEditing({ ...editing, buttonRadius: Number(ev.target.value) })} /></label>
            <label><span className={small}>Sender name</span><input className={input} value={editing.senderName ?? ""} onChange={(ev) => setEditing({ ...editing, senderName: ev.target.value || null })} /></label>
            <label><span className={small}>Sender email</span><input className={input} value={editing.senderEmail ?? ""} onChange={(ev) => setEditing({ ...editing, senderEmail: ev.target.value || null })} /></label>
            <label><span className={small}>Reply-to email</span><input className={input} value={editing.replyToEmail ?? ""} onChange={(ev) => setEditing({ ...editing, replyToEmail: ev.target.value || null })} /></label>
            <label><span className={small}>Currency</span><input className={input} value={editing.currency ?? "GBP"} onChange={(ev) => setEditing({ ...editing, currency: ev.target.value.toUpperCase() })} /></label>
            <label><span className={small}>Locale</span><input className={input} value={editing.locale ?? "en-GB"} onChange={(ev) => setEditing({ ...editing, locale: ev.target.value })} /></label>
            <label><span className={small}>Mailing address</span><input className={input} value={editing.mailingAddress ?? ""} onChange={(ev) => setEditing({ ...editing, mailingAddress: ev.target.value || null })} /></label>
            <label className="sm:col-span-2"><span className={small}>Menu links (Label | https://url, one per line)</span>
              <textarea rows={3} className={input} defaultValue={linksText(editing.menuLinks ?? null)} onChange={(ev) => setEditing({ ...(editing as object), menuLinksText: ev.target.value } as never)} /></label>
            <label><span className={small}>Social links (Label | url)</span>
              <textarea rows={3} className={input} defaultValue={linksText(editing.socialLinks ?? null)} onChange={(ev) => setEditing({ ...(editing as object), socialLinksText: ev.target.value } as never)} /></label>
            <label><span className={small}>Legal links (Label | url)</span>
              <textarea rows={3} className={input} defaultValue={linksText(editing.legalLinks ?? null)} onChange={(ev) => setEditing({ ...(editing as object), legalLinksText: ev.target.value } as never)} /></label>
            <label className="sm:col-span-2"><span className={small}>Default footer text</span>
              <textarea rows={2} className={input} value={editing.footerText ?? ""} onChange={(ev) => setEditing({ ...editing, footerText: ev.target.value || null })} /></label>
            <label><span className={small}>Unsubscribe wording</span>
              <textarea rows={2} className={input} value={editing.unsubscribeText ?? "You are receiving this because you subscribed. Unsubscribe at any time."} onChange={(ev) => setEditing({ ...editing, unsubscribeText: ev.target.value })} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
            <button onClick={save} disabled={saving} className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
              {saving ? "Saving…" : "Save brand"}
            </button>
            <button onClick={() => { setEditing(null); setSaveError(null); }} className="rounded-lg px-4 py-2 text-[13px] font-medium text-ink-3">Cancel</button>
            {saveError && <span className="rounded-lg bg-[#fdf2f2] px-3 py-1.5 text-[12px] font-medium text-[#b91c1c]">{saveError}</span>}
          </div>
        </Card>
      )}
      {e ? null : null}

      <Card>
        <CardHeader title="Brand kits" subtitle={brands ? `${brands.length} in this workspace` : "Loading…"} />
        {!brands ? (
          <div className="h-32 animate-pulse" />
        ) : brands.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-3">
            No brands yet. Create one for each website you run (for example MyoTech and Novatec) so campaigns,
            templates and coupons pull the right identity, sender and store automatically.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line"><tr><Th>Brand</Th><Th>Colours</Th><Th>Sender</Th><Th>Store</Th><Th>Templates</Th><Th>Elements</Th><Th className="text-right">Edit</Th></tr></thead>
              <tbody>
                {brands.map((b) => (
                  <tr key={b.id} className="border-b border-line/70 last:border-0">
                    <Td>
                      <span className="flex items-center gap-2">
                        {b.logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={b.logoUrl} alt="" className="h-6 w-6 rounded object-contain" />
                        ) : (
                          <span className="grid h-6 w-6 place-items-center rounded text-[10px] font-bold text-white" style={{ background: b.primaryColor }}>{b.name[0]}</span>
                        )}
                        <span>
                          <span className="block font-medium">{b.name}</span>
                          {b.websiteUrl && <span className="text-[11px] text-ink-3">{b.websiteUrl}</span>}
                        </span>
                      </span>
                    </Td>
                    <Td>
                      <span className="flex gap-1">
                        {[b.primaryColor, b.secondaryColor, b.accentColor].map((c, i) => (
                          <span key={i} className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />
                        ))}
                      </span>
                    </Td>
                    <Td className="text-[12px]">{b.senderName ? `${b.senderName} <${b.senderEmail ?? "?"}>` : "—"}</Td>
                    <Td>{b.storeName ?? "—"}</Td>
                    <Td>{b.templates}</Td>
                    <Td>{b.elements}</Td>
                    <Td className="text-right"><button onClick={() => setEditing(b)} className="text-[12px] font-medium text-brand hover:underline">Edit</button></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Global elements"
          subtitle="Reusable blocks: linked templates render the current version; sent campaigns keep their snapshot"
          action={
            <button
              onClick={() => {
                const name = window.prompt("Element name (e.g. Promo strip)");
                if (name) elementAct({ action: "create", name, content: JSON.stringify({ id: "el", type: "text", html: "<p>Edit me</p>" }) }, `Created "${name}".`);
              }}
              className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand"
            >
              New element
            </button>
          }
        />
        {elements.length === 0 ? (
          <p className="px-5 py-8 text-center text-[13px] text-ink-3">
            No elements yet. Create one, then insert it in the email editor with the &quot;Saved element&quot; block.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {elements.map((el) => (
              <div key={el.id} className="px-5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="text-[13px] font-medium">{el.name}</span>
                    <span className="ml-2 text-[11px] text-ink-3">v{el.version}{el.brandName ? ` · ${el.brandName}` : ""} · id <code className="font-mono">{el.id}</code></span>
                  </span>
                  <span className="flex gap-2 text-[12px] font-medium">
                    <button
                      onClick={() => {
                        const content = window.prompt("Block JSON (one block)", el.content);
                        if (content) elementAct({ action: "publish", id: el.id, content }, "Published to all linked templates.");
                      }}
                      className="text-brand hover:underline"
                    >
                      Edit & publish
                    </button>
                    {el.versions.length > 1 && (
                      <button
                        onClick={() => {
                          const v = window.prompt(`Roll back to version (available: ${el.versions.map((x) => x.version).join(", ")})`);
                          if (v) elementAct({ action: "rollback", id: el.id, version: Number(v) }, "Rolled back.");
                        }}
                        className="text-ink-3 hover:underline"
                      >
                        Roll back
                      </button>
                    )}
                    <button onClick={() => elementAct({ action: "duplicate", id: el.id }, "Detached copy created.")} className="text-ink-3 hover:underline">Detach copy</button>
                    <button onClick={() => elementAct({ action: "archive", id: el.id, archived: !el.archived }, el.archived ? "Restored." : "Archived.")} className="text-ink-3 hover:underline">
                      {el.archived ? "Restore" : "Archive"}
                    </button>
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-ink-3">
                  Used by {el.usedBy.length === 0 ? "no templates yet" : el.usedBy.map((t) => t.name).join(", ")}
                </p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </Shell>
  );
}
