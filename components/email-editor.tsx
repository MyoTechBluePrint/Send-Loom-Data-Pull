"use client";

// The block-based email editor. Blocks are data (lib/server/email-blocks.ts);
// this component only edits the data and asks the server to render previews,
// so what you see is exactly the renderer's output, not a lookalike.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Block = Record<string, unknown> & { id: string; type: string };
type Issue = { level: "error" | "warning"; message: string; blockId?: string };
type PickOption = { id: string; label: string };
export type EditorResources = { products: PickOption[]; promotions: PickOption[]; elements: PickOption[]; polls: PickOption[] };
type BrandKit = {
  id: string; name: string; logoUrl: string | null; darkLogoUrl: string | null; iconUrl: string | null;
  primaryColor: string | null; secondaryColor: string | null; accentColor: string | null;
  headingFont: string | null; bodyFont: string | null;
};
type Asset = { name: string; url: string; bytes: number };

const BLOCK_MENU: { type: string; label: string; make: () => Partial<Block> }[] = [
  { type: "heading", label: "Heading", make: () => ({ text: "Heading", level: 1 }) },
  { type: "text", label: "Text", make: () => ({ html: "<p>Write something…</p>" }) },
  { type: "image", label: "Image", make: () => ({ url: "", alt: "" }) },
  { type: "button", label: "Button", make: () => ({ label: "Shop now", href: "https://" }) },
  { type: "divider", label: "Divider", make: () => ({}) },
  { type: "spacer", label: "Spacer", make: () => ({ height: 24 }) },
  { type: "columns", label: "Two columns", make: () => ({ left: "<p>Left</p>", right: "<p>Right</p>" }) },
  { type: "logo", label: "Logo", make: () => ({}) },
  { type: "menu", label: "Menu", make: () => ({ links: [] }) },
  { type: "social", label: "Social links", make: () => ({ links: [] }) },
  { type: "product", label: "Product", make: () => ({ productId: "" }) },
  { type: "product_grid", label: "Product grid", make: () => ({ productIds: [], columns: 2 }) },
  { type: "product_feed", label: "Dynamic products", make: () => ({ rule: "newest", limit: 4 }) },
  { type: "coupon", label: "Coupon", make: () => ({ promotionId: "" }) },
  { type: "poll", label: "Poll", make: () => ({ pollId: "" }) },
  { type: "global", label: "Saved element", make: () => ({ elementId: "" }) },
  { type: "footer", label: "Footer + unsubscribe", make: () => ({}) },
];

// What a column half may hold. Columns never nest; footers, dynamic feeds and
// saved elements stay top-level where the send path resolves them.
const COLUMN_TYPES = ["heading", "text", "image", "button", "divider", "spacer", "product", "product_grid", "coupon"];
const COLUMN_MENU = BLOCK_MENU.filter((m) => COLUMN_TYPES.includes(m.type));

let seq = 0;
const newId = () => `b${Date.now().toString(36)}${(seq++).toString(36)}`;

export function EmailEditor(props: {
  initialBlocks: Block[];
  subject: string;
  brandId: string | null;
  brands: { id: string; name: string }[];
  previewUrl: string; // POST {action:"preview", content}
  onSave: (content: string, subject: string, brandId: string | null) => Promise<{ ok: boolean; error?: string; issues?: Issue[] }>;
  onSendTest: (to: string, content: string) => Promise<{ ok: boolean; error?: string; detail?: string }>;
  readOnly?: boolean;
}) {
  const [blocks, setBlocks] = useState<Block[]>(props.initialBlocks);
  const [subject, setSubject] = useState(props.subject);
  const [brandId, setBrandId] = useState<string | null>(props.brandId);
  const [selected, setSelected] = useState<string | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [previewHtml, setPreviewHtml] = useState("");
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [resources, setResources] = useState<EditorResources>({ products: [], promotions: [], elements: [], polls: [] });
  const [brandKits, setBrandKits] = useState<BrandKit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const dragFrom = useRef<string | null>(null);

  const loadAssets = useCallback(() => {
    fetch("/api/assets").then((r) => r.json()).then((j) => j.ok && setAssets(j.assets)).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/editor/resources").then((r) => r.json()).then((j) => j.ok && setResources(j)).catch(() => {});
    fetch("/api/brands").then((r) => r.json()).then((j) => j.ok && setBrandKits(j.brands)).catch(() => {});
    loadAssets();
  }, [loadAssets]);

  // Undo/redo: a bounded history of block states.
  const history = useRef<Block[][]>([props.initialBlocks]);
  const cursor = useRef(0);

  const apply = useCallback((next: Block[]) => {
    history.current = history.current.slice(0, cursor.current + 1).concat([next]).slice(-50);
    cursor.current = history.current.length - 1;
    setBlocks(next);
    setDirty(true);
  }, []);

  const undo = useCallback(() => {
    if (cursor.current > 0) {
      cursor.current--;
      setBlocks(history.current[cursor.current]);
      setDirty(true);
    }
  }, []);
  const redo = useCallback(() => {
    if (cursor.current < history.current.length - 1) {
      cursor.current++;
      setBlocks(history.current[cursor.current]);
      setDirty(true);
    }
  }, []);

  // Server-rendered preview, debounced. brandId rides along so switching
  // brand restyles the preview immediately, not only after a save.
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(props.previewUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", content: JSON.stringify(blocks), brandId }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) {
            setPreviewHtml(j.html);
            setIssues(j.issues ?? []);
          }
        })
        .catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [blocks, brandId, props.previewUrl]);

  // The style block is email-level settings, never part of the drag order:
  // every list operation works on the visible blocks and the style block is
  // re-attached at the end of the array.
  const styleBlock = useMemo(() => blocks.find((b) => b.type === "style") ?? null, [blocks]);
  const visibleBlocks = useMemo(() => blocks.filter((b) => b.type !== "style"), [blocks]);
  const applyVisible = useCallback(
    (next: Block[]) => apply(styleBlock ? [...next, styleBlock] : next),
    [apply, styleBlock]
  );
  const setEmailStyle = (patch: { backgroundColor?: string; cardColor?: string }) => {
    const merged = { ...(styleBlock ?? { id: newId(), type: "style" }), ...patch } as Block;
    const keep = Boolean(merged.backgroundColor || merged.cardColor);
    apply(keep ? [...visibleBlocks, merged] : visibleBlocks);
  };

  const move = (id: string, dir: -1 | 1) => {
    const i = visibleBlocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= visibleBlocks.length) return;
    const next = [...visibleBlocks];
    [next[i], next[j]] = [next[j], next[i]];
    applyVisible(next);
  };
  const duplicate = (id: string) => {
    const i = visibleBlocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...visibleBlocks[i], id: newId() };
    applyVisible([...visibleBlocks.slice(0, i + 1), copy, ...visibleBlocks.slice(i + 1)]);
  };
  const remove = (id: string) => applyVisible(visibleBlocks.filter((b) => b.id !== id));
  const add = (item: (typeof BLOCK_MENU)[number]) => {
    const block = { id: newId(), type: item.type, ...item.make() } as Block;
    // Footer stays last.
    const fi = visibleBlocks.findIndex((b) => b.type === "footer");
    const next = fi >= 0 && item.type !== "footer"
      ? [...visibleBlocks.slice(0, fi), block, ...visibleBlocks.slice(fi)]
      : [...visibleBlocks, block];
    applyVisible(next);
    setSelected(block.id);
  };
  const update = (id: string, patch: Record<string, unknown>) => {
    apply(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  };

  // Insert an image block from the assets panel — clicked (before the footer)
  // or dropped at a specific position in the block list.
  const insertImage = (url: string, alt: string, at?: number) => {
    const block = { id: newId(), type: "image", url, alt } as Block;
    let next: Block[];
    if (at === undefined) {
      const fi = visibleBlocks.findIndex((b) => b.type === "footer");
      next = fi >= 0 ? [...visibleBlocks.slice(0, fi), block, ...visibleBlocks.slice(fi)] : [...visibleBlocks, block];
    } else {
      next = [...visibleBlocks.slice(0, at), block, ...visibleBlocks.slice(at)];
    }
    applyVisible(next);
    setSelected(block.id);
  };

  const save = useCallback(async (silent = false) => {
    setSaving(true);
    if (!silent) setNotice(null);
    try {
      const r = await props.onSave(JSON.stringify(blocks), subject, brandId);
      if (!silent) setNotice(r.ok ? "Saved." : r.error ?? "Could not save.");
      if (r.ok) setDirty(false);
      if (r.issues) setIssues(r.issues);
    } finally {
      setSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, subject, brandId]);

  // Autosave: two seconds after the last edit, silently. The Save button
  // stays for reassurance and for forcing an immediate write.
  useEffect(() => {
    if (!dirty || props.readOnly) return;
    const t = setTimeout(() => save(true), 2000);
    return () => clearTimeout(t);
  }, [dirty, blocks, subject, brandId, save, props.readOnly]);

  async function sendTest() {
    if (!testTo) { setNotice("Enter an address for the test."); return; }
    setNotice("Sending test…");
    const r = await props.onSendTest(testTo, JSON.stringify(blocks));
    setNotice(r.ok ? `Test sent to ${testTo}${r.detail ? ` (${r.detail})` : ""}` : r.error ?? "Test failed.");
  }

  const selectedBlock = useMemo(() => blocks.find((b) => b.id === selected) ?? null, [blocks, selected]);
  const errors = issues.filter((i) => i.level === "error");

  return (
    <div className="grid gap-4 xl:grid-cols-[320px_1fr_300px]">
      {/* Block list */}
      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-surface p-3">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Subject line</span>
            <input
              value={subject} onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
              disabled={props.readOnly}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
          <label className="mt-2 block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Brand</span>
            <select
              value={brandId ?? ""} onChange={(e) => { setBrandId(e.target.value || null); setDirty(true); }}
              disabled={props.readOnly}
              className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
            >
              <option value="">Default styling</option>
              {props.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
          {/* Email-level colours live in the content as a style block but are
              edited here, never in the block list. */}
          <div className="mt-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Email style</span>
            <div className="mt-1 space-y-1.5">
              {([
                { key: "backgroundColor" as const, label: "Background", fallback: "#faf9f7" },
                { key: "cardColor" as const, label: "Card", fallback: "#ffffff" },
              ]).map(({ key, label: lab, fallback }) => {
                const value = typeof styleBlock?.[key] === "string" ? (styleBlock[key] as string) : undefined;
                return (
                  <div key={key} className="flex items-center gap-2">
                    <input
                      type="color" value={value ?? fallback} disabled={props.readOnly}
                      onChange={(e) => setEmailStyle({ [key]: e.target.value })}
                      className="h-7 w-9 shrink-0 cursor-pointer rounded border border-line bg-surface p-0.5"
                      title={`${lab} colour`}
                    />
                    <span className="flex-1 text-[12px]">{lab}</span>
                    {value ? (
                      <button
                        type="button" disabled={props.readOnly}
                        onClick={() => setEmailStyle({ [key]: undefined })}
                        className="rounded border border-line px-2 py-0.5 text-[10px] font-semibold text-ink-2 hover:border-brand hover:text-brand"
                      >
                        Reset
                      </button>
                    ) : (
                      <span className="text-[10px] text-ink-3">Brand default</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-line bg-surface">
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Blocks</span>
            <div className="flex gap-1">
              <button onClick={undo} title="Undo" className="rounded border border-line px-2 py-0.5 text-xs hover:border-brand">↶</button>
              <button onClick={redo} title="Redo" className="rounded border border-line px-2 py-0.5 text-xs hover:border-brand">↷</button>
            </div>
          </div>
          <ul className="max-h-[380px] overflow-y-auto p-2">
            {visibleBlocks.map((b) => (
              <li
                key={b.id}
                draggable={!props.readOnly}
                onDragStart={() => { dragFrom.current = b.id; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = dragFrom.current;
                  dragFrom.current = null;
                  if (!from || from === b.id) return;
                  const j = visibleBlocks.findIndex((x) => x.id === b.id);
                  if (j < 0) return;
                  // Dragged from the assets panel: insert an image block here.
                  if (from.startsWith("asset:")) {
                    try {
                      const { url, alt } = JSON.parse(from.slice(6)) as { url: string; alt: string };
                      insertImage(url, alt, j);
                    } catch { /* malformed payload, ignore */ }
                    return;
                  }
                  const i = visibleBlocks.findIndex((x) => x.id === from);
                  if (i < 0) return;
                  const next = [...visibleBlocks];
                  const [moved] = next.splice(i, 1);
                  next.splice(j, 0, moved);
                  applyVisible(next);
                }}
                className={`group mb-1 flex cursor-grab items-center gap-1 rounded-lg border px-2 py-1.5 text-[12px] active:cursor-grabbing ${
                  selected === b.id ? "border-brand bg-brand-soft" : "border-line bg-surface"
                } ${issues.some((i) => i.blockId === b.id && i.level === "error") ? "!border-red-400" : ""}`}
              >
                <span className="select-none text-ink-3/60" aria-hidden>⋮⋮</span>
                <button onClick={() => setSelected(b.id)} className="flex-1 text-left font-medium capitalize">
                  {String(b.type).replace(/_/g, " ")}
                </button>
                {!props.readOnly && (
                  <span className="hidden gap-0.5 group-hover:flex">
                    <button onClick={() => move(b.id, -1)} title="Up" className="rounded px-1 hover:bg-black/5">↑</button>
                    <button onClick={() => move(b.id, 1)} title="Down" className="rounded px-1 hover:bg-black/5">↓</button>
                    <button onClick={() => duplicate(b.id)} title="Duplicate" className="rounded px-1 hover:bg-black/5">⧉</button>
                    <button onClick={() => remove(b.id)} title="Delete" className="rounded px-1 text-red-600 hover:bg-red-50">✕</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          {!props.readOnly && (
            <div className="border-t border-line p-2">
              <details>
                <summary className="cursor-pointer rounded-lg px-2 py-1.5 text-center text-[12px] font-semibold text-brand hover:bg-brand-soft">+ Add block</summary>
                <div className="mt-1 grid grid-cols-2 gap-1">
                  {BLOCK_MENU.map((m) => (
                    <button key={m.type} onClick={() => add(m)} className="rounded-lg border border-line px-2 py-1.5 text-[11px] font-medium hover:border-brand hover:text-brand">
                      {m.label}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>

        {/* Validation */}
        {issues.length > 0 && (
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Checks</p>
            <ul className="mt-1.5 space-y-1">
              {issues.map((i, n) => (
                <li key={n} className={`text-[12px] ${i.level === "error" ? "text-red-700" : "text-amber-700"}`}>
                  {i.level === "error" ? "●" : "○"} {i.message}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-xl border border-line bg-[#efeee9] p-3">
        <div className="mb-2 flex items-center justify-between">
          <div className="inline-flex rounded-full border border-line bg-surface p-0.5">
            {(["desktop", "mobile"] as const).map((d) => (
              <button
                key={d} onClick={() => setDevice(d)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${device === d ? "bg-[#14121f] text-white" : "text-ink-3"}`}
              >
                {d}
              </button>
            ))}
          </div>
          <span className="text-[11px] text-ink-3">Server-rendered preview · exactly what recipients get</span>
        </div>
        <div className="mx-auto overflow-hidden rounded-lg bg-white shadow-sm transition-all" style={{ maxWidth: device === "mobile" ? 375 : 680 }}>
          <iframe title="Email preview" srcDoc={previewHtml} className="h-[560px] w-full border-0" sandbox="" />
        </div>
      </div>

      {/* Property panel + actions */}
      <div className="space-y-3">
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">
            {selectedBlock ? `Edit ${String(selectedBlock.type).replace(/_/g, " ")}` : "Select a block to edit"}
          </p>
          {selectedBlock && !props.readOnly && (
            <BlockProps block={selectedBlock} onChange={(patch) => update(selectedBlock.id, patch)} resources={resources} />
          )}
        </div>

        {!props.readOnly && (
          <div className="rounded-xl border border-line bg-surface p-3">
            <button
              onClick={() => save(false)} disabled={saving}
              className="w-full rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "Saving…" : dirty ? "Save changes" : "Saved"}
            </button>
            <div className="mt-2 flex gap-1.5">
              <input
                value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="you@example.com" type="email"
                className="min-w-0 flex-1 rounded-lg border border-line px-2.5 py-1.5 text-[12px] outline-none focus:border-brand"
              />
              <button
                onClick={sendTest}
                disabled={errors.length > 0}
                title={errors.length ? "Fix the errors first" : "Send a test email"}
                className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold hover:border-brand hover:text-brand disabled:opacity-40"
              >
                Send test
              </button>
            </div>
            {notice && <p className="mt-2 text-[12px] text-ink-2">{notice}</p>}
            {dirty && <p className="mt-1 text-[11px] font-medium text-amber-700">Unsaved changes</p>}
          </div>
        )}

        {!props.readOnly && (
          <BrandAssetsPanel
            brand={brandKits.find((b) => b.id === brandId) ?? null}
            assets={assets}
            onInsert={(url, alt) => { insertImage(url, alt); setNotice("Image block added."); }}
            onDragPayload={(payload) => { dragFrom.current = payload; }}
            onUploaded={() => { loadAssets(); setNotice("Uploaded. Click or drag it into the email."); }}
            onError={(m) => setNotice(m)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * The brand's visual kit + uploaded images, ready to click or drag straight
 * into the email. Dragging sets the shared dragFrom ref with an "asset:"
 * payload the block list knows how to drop.
 */
function BrandAssetsPanel(props: {
  brand: BrandKit | null;
  assets: Asset[];
  onInsert: (url: string, alt: string) => void;
  onDragPayload: (payload: string) => void;
  onUploaded: () => void;
  onError: (message: string) => void;
}) {
  const b = props.brand;
  const kitImages = b
    ? ([
        { label: "Logo", url: b.logoUrl, dark: false },
        { label: "Dark logo", url: b.darkLogoUrl, dark: true },
        { label: "Icon", url: b.iconUrl, dark: false },
      ].filter((k) => k.url) as { label: string; url: string; dark: boolean }[])
    : [];
  const colours = b
    ? ([
        { label: "Primary", hex: b.primaryColor },
        { label: "Secondary", hex: b.secondaryColor },
        { label: "Accent", hex: b.accentColor },
      ].filter((c) => c.hex) as { label: string; hex: string }[])
    : [];

  const payload = (url: string, alt: string) => "asset:" + JSON.stringify({ url, alt });

  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Brand assets</p>
        <a href="/brands" className="text-[11px] font-semibold text-brand hover:underline">Manage →</a>
      </div>

      {b ? (
        <>
          <p className="mt-1 text-[12px] font-medium">{b.name}</p>
          {kitImages.length > 0 && (
            <div className="mt-2 grid grid-cols-3 gap-1.5">
              {kitImages.map((k) => (
                <button
                  key={k.label}
                  type="button"
                  title={`${k.label} · click to insert, or drag into the block list`}
                  draggable
                  onDragStart={() => props.onDragPayload(payload(k.url, `${b.name} ${k.label.toLowerCase()}`))}
                  onClick={() => props.onInsert(k.url, `${b.name} ${k.label.toLowerCase()}`)}
                  className={`flex h-14 cursor-grab flex-col items-center justify-center gap-1 rounded-lg border border-line p-1 hover:border-brand active:cursor-grabbing ${k.dark ? "bg-[#14121f]" : "bg-white"}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={k.url} alt={k.label} className="max-h-7 max-w-full object-contain" />
                  <span className={`text-[9px] font-medium ${k.dark ? "text-white/70" : "text-ink-3"}`}>{k.label}</span>
                </button>
              ))}
            </div>
          )}
          {colours.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {colours.map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={`${c.label} ${c.hex} · click to copy`}
                  onClick={() => { navigator.clipboard?.writeText(c.hex).catch(() => {}); props.onError(`Copied ${c.hex}.`); }}
                  className="flex items-center gap-1.5 rounded-full border border-line px-2 py-1 text-[10px] font-semibold text-ink-2 hover:border-brand"
                >
                  <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: c.hex }} />
                  {c.hex}
                </button>
              ))}
            </div>
          )}
          {(b.headingFont || b.bodyFont) && (
            <p className="mt-1.5 truncate text-[10px] text-ink-3" title={`Headings: ${b.headingFont ?? "default"} · Body: ${b.bodyFont ?? "default"}`}>
              Fonts: {(b.headingFont ?? "default").split(",")[0]} / {(b.bodyFont ?? "default").split(",")[0]}
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-[12px] text-ink-3">Pick a brand above to see its logo and colours here.</p>
      )}

      <div className="mt-3 border-t border-line pt-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">Uploads</span>
          <label className="cursor-pointer rounded-lg bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand hover:bg-[#ece2fa]">
            + Upload
            <input
              type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (!f) return;
                const fd = new FormData();
                fd.append("file", f);
                try {
                  const j = await fetch("/api/assets", { method: "POST", body: fd }).then((r) => r.json());
                  if (j.ok) props.onUploaded();
                  else props.onError(j.error ?? "Upload failed.");
                } catch {
                  props.onError("Upload failed.");
                }
              }}
            />
          </label>
        </div>
        {props.assets.length === 0 ? (
          <p className="mt-1.5 text-[11px] text-ink-3">No uploads yet. Images land here for every campaign.</p>
        ) : (
          <div className="mt-1.5 grid max-h-40 grid-cols-3 gap-1.5 overflow-y-auto">
            {props.assets.map((a) => (
              <button
                key={a.name}
                type="button"
                title={`${a.name} · click to insert, or drag into the block list`}
                draggable
                onDragStart={() => props.onDragPayload(payload(a.url, a.name.replace(/\.[^.]*$/, "")))}
                onClick={() => props.onInsert(a.url, a.name.replace(/\.[^.]*$/, ""))}
                className="h-14 cursor-grab overflow-hidden rounded-lg border border-line bg-white p-0.5 hover:border-brand active:cursor-grabbing"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Wrap the current textarea selection in a tag: the honest minimum of rich text. */
function wrapSelection(el: HTMLTextAreaElement, before: string, after: string): string {
  const { selectionStart: s, selectionEnd: e, value } = el;
  return value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e);
}

function Picker({ label: l, value, options, onChange, emptyHint }: {
  label: string; value: string; options: PickOption[]; onChange: (id: string) => void; emptyHint: string;
}) {
  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
  return (
    <label className="mt-2 block">
      <span className="text-[11px] font-medium text-ink-3">{l}</span>
      {options.length === 0 ? (
        <p className="mt-1 rounded-lg border border-dashed border-line px-2.5 py-2 text-[11px] text-ink-3">{emptyHint}</p>
      ) : (
        <select className={input} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choose…</option>
          {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      )}
    </label>
  );
}

/**
 * One column half: either a legacy HTML string or a list of real blocks with
 * the same per-block controls as the top level. Deleting every nested block
 * returns the side to plain HTML.
 */
function ColumnSide(props: {
  title: string;
  legacyHtml: string;
  nested: Block[];
  resources: EditorResources;
  onLegacyChange: (html: string) => void;
  onNestedChange: (list: Block[]) => void;
}) {
  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
  const { nested } = props;
  const setNested = props.onNestedChange;
  const moveNested = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= nested.length) return;
    const next = [...nested];
    [next[i], next[j]] = [next[j], next[i]];
    setNested(next);
  };
  return (
    <div className="mt-2 rounded-lg border border-line p-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-3">{props.title}</p>
      {nested.length === 0 ? (<>
        <textarea rows={3} className={input} value={props.legacyHtml} onChange={(e) => props.onLegacyChange(e.target.value)} />
        <button
          type="button"
          onClick={() => setNested([{ id: newId(), type: "text", html: props.legacyHtml || "<p>Write something…</p>" } as Block])}
          className="mt-1.5 w-full rounded-lg border border-dashed border-line px-2 py-1 text-[11px] font-semibold text-brand hover:border-brand"
        >
          Use blocks in this column
        </button>
      </>) : (<>
        {nested.map((nb, i) => (
          <details key={nb.id} className="mt-1 rounded-lg border border-line bg-surface">
            <summary className="flex cursor-pointer items-center gap-1 px-2 py-1 text-[11px] font-medium">
              <span className="flex-1 capitalize">{String(nb.type).replace(/_/g, " ")}</span>
              <button type="button" title="Up" onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveNested(i, -1); }} className="rounded px-1 hover:bg-black/5">↑</button>
              <button type="button" title="Down" onClick={(e) => { e.preventDefault(); e.stopPropagation(); moveNested(i, 1); }} className="rounded px-1 hover:bg-black/5">↓</button>
              <button type="button" title="Delete" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setNested(nested.filter((_, n) => n !== i)); }} className="rounded px-1 text-red-600 hover:bg-red-50">✕</button>
            </summary>
            <div className="border-t border-line px-2 pb-2">
              <BlockProps
                block={nb}
                onChange={(patch) => setNested(nested.map((x, n) => (n === i ? { ...x, ...patch } : x)))}
                resources={props.resources}
              />
            </div>
          </details>
        ))}
        <select
          className={input}
          value=""
          onChange={(e) => {
            const item = COLUMN_MENU.find((m) => m.type === e.target.value);
            if (item) setNested([...nested, { id: newId(), type: item.type, ...item.make() } as Block]);
          }}
        >
          <option value="">+ Add block here…</option>
          {COLUMN_MENU.map((m) => <option key={m.type} value={m.type}>{m.label}</option>)}
        </select>
        <p className="mt-1 text-[10px] text-ink-3">Delete every block to go back to simple HTML.</p>
      </>)}
    </div>
  );
}

/** Property inputs per block type. Small on purpose: fields, not a canvas. */
function BlockProps({ block, onChange, resources }: { block: Block; onChange: (patch: Record<string, unknown>) => void; resources: EditorResources }) {
  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
  const label = "mt-2 block text-[11px] font-medium text-ink-3";
  const t = block.type;

  const toolbar = (key: string) => (
    <span className="mt-1 flex gap-1">
      {[
        { t: "B", b: "<strong>", a: "</strong>", title: "Bold" },
        { t: "I", b: "<em>", a: "</em>", title: "Italic" },
        { t: "Link", b: '<a href="https://">', a: "</a>", title: "Link" },
        { t: "¶", b: "<p>", a: "</p>", title: "Paragraph" },
      ].map((btn) => (
        <button
          key={btn.t}
          type="button"
          title={btn.title}
          onMouseDown={(e) => {
            e.preventDefault();
            const el = (e.currentTarget.parentElement?.nextElementSibling ?? null) as HTMLTextAreaElement | null;
            if (el && el.tagName === "TEXTAREA") onChange({ [key]: wrapSelection(el, btn.b, btn.a) });
          }}
          className="rounded border border-line px-2 py-0.5 text-[11px] font-semibold text-ink-2 hover:border-brand hover:text-brand"
        >
          {btn.t}
        </button>
      ))}
    </span>
  );

  const linksEditor = (key: "links") => (
    <>
      <span className={label}>Links (one per line: Label | https://url)</span>
      <textarea
        rows={3} className={input}
        defaultValue={((block[key] as { label: string; url: string }[]) ?? []).map((l) => `${l.label} | ${l.url}`).join("\n")}
        onBlur={(e) => onChange({
          [key]: e.target.value.split("\n").map((line) => {
            const [lab, url] = line.split("|").map((s) => s.trim());
            return lab && url ? { label: lab, url } : null;
          }).filter(Boolean),
        })}
      />
    </>
  );

  switch (t) {
    case "heading":
      return (<div>
        <span className={label}>Text</span>
        <input className={input} value={String(block.text ?? "")} onChange={(e) => onChange({ text: e.target.value })} />
        <span className={label}>Level</span>
        <select className={input} value={String(block.level ?? 1)} onChange={(e) => onChange({ level: Number(e.target.value) })}>
          <option value="1">Large</option><option value="2">Small</option>
        </select>
      </div>);
    case "text":
      return (<div>
        <span className={label}>Content</span>
        {toolbar("html")}
        <textarea rows={5} className={input} value={String(block.html ?? "")} onChange={(e) => onChange({ html: e.target.value })} />
        <p className="mt-1 text-[10px] text-ink-3">Personalisation: {"{{first_name}}"}, {"{{customer_coupon.code}}"}</p>
      </div>);
    case "columns":
      return (<div>
        {([
          { key: "leftBlocks" as const, legacy: "left" as const, title: "Left column" },
          { key: "rightBlocks" as const, legacy: "right" as const, title: "Right column" },
        ]).map((s) => (
          <ColumnSide
            key={s.key}
            title={s.title}
            legacyHtml={String(block[s.legacy] ?? "")}
            nested={(block[s.key] as Block[] | undefined) ?? []}
            resources={resources}
            onLegacyChange={(html) => onChange({ [s.legacy]: html })}
            onNestedChange={(list) => onChange({ [s.key]: list.length ? list : undefined })}
          />
        ))}
        <p className="mt-1 text-[10px] text-ink-3">Personalisation: {"{{first_name}}"}, {"{{customer_coupon.code}}"}</p>
      </div>);
    case "image":
      return (<div>
        <span className={label}>Image URL</span>
        <input className={input} value={String(block.url ?? "")} onChange={(e) => onChange({ url: e.target.value })} />
        <span className={label}>Alt text (required for accessibility)</span>
        <input className={input} value={String(block.alt ?? "")} onChange={(e) => onChange({ alt: e.target.value })} />
        <span className={label}>Click-through URL (optional)</span>
        <input className={input} value={String(block.href ?? "")} onChange={(e) => onChange({ href: e.target.value || undefined })} />
      </div>);
    case "button":
      return (<div>
        <span className={label}>Label</span>
        <input className={input} value={String(block.label ?? "")} onChange={(e) => onChange({ label: e.target.value })} />
        <span className={label}>Link</span>
        <input className={input} value={String(block.href ?? "")} onChange={(e) => onChange({ href: e.target.value })} />
        <span className={label}>Alignment</span>
        <select className={input} value={String(block.align ?? "center")} onChange={(e) => onChange({ align: e.target.value })}>
          <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option>
        </select>
      </div>);
    case "spacer":
      return (<div>
        <span className={label}>Height (px)</span>
        <input type="number" className={input} value={Number(block.height ?? 24)} onChange={(e) => onChange({ height: Number(e.target.value) })} />
      </div>);
    case "logo":
      return (<div>
        <span className={label}>Logo URL (blank = brand logo)</span>
        <input className={input} value={String(block.url ?? "")} onChange={(e) => onChange({ url: e.target.value || undefined })} />
      </div>);
    case "menu":
    case "social":
      return <div>{linksEditor("links")}<p className="mt-1 text-[10px] text-ink-3">Blank = the brand kit&apos;s links.</p></div>;
    case "product":
      return (<div>
        <Picker label="Product" value={String(block.productId ?? "")} options={resources.products}
          onChange={(id) => onChange({ productId: id })} emptyHint="No products synced yet. Connect a store in Commerce." />
        <span className={label}>Button label</span>
        <input className={input} value={String(block.cta ?? "Shop now")} onChange={(e) => onChange({ cta: e.target.value })} />
      </div>);
    case "product_grid": {
      const ids = (block.productIds as string[]) ?? [];
      return (<div>
        <span className={label}>Products in the grid</span>
        <ul className="mt-1 space-y-1">
          {ids.map((id, i) => (
            <li key={`${id}${i}`} className="flex items-center justify-between gap-2 rounded-lg border border-line px-2 py-1 text-[11px]">
              <span className="truncate">{resources.products.find((p) => p.id === id)?.label ?? id}</span>
              <button onClick={() => onChange({ productIds: ids.filter((_, n) => n !== i) })} className="shrink-0 text-red-600">✕</button>
            </li>
          ))}
        </ul>
        <Picker label="Add a product" value="" options={resources.products.filter((p) => !ids.includes(p.id))}
          onChange={(id) => id && onChange({ productIds: [...ids, id] })} emptyHint="No products synced yet." />
        <span className={label}>Columns</span>
        <select className={input} value={String(block.columns ?? 2)} onChange={(e) => onChange({ columns: Number(e.target.value) })}>
          <option value="2">2</option><option value="3">3</option>
        </select>
      </div>);
    }
    case "product_feed":
      return (<div>
        <span className={label}>Rule</span>
        <select className={input} value={String(block.rule ?? "newest")} onChange={(e) => onChange({ rule: e.target.value })}>
          <option value="newest">Newest products</option>
          <option value="best_sellers">Best sellers</option>
          <option value="category">From a category</option>
          <option value="interest_tag">Matching an interest tag</option>
        </select>
        {(block.rule === "category" || block.rule === "interest_tag") && (<>
          <span className={label}>{block.rule === "category" ? "Category" : "Tag"}</span>
          <input className={input} value={String(block.value ?? "")} onChange={(e) => onChange({ value: e.target.value })} />
        </>)}
        <span className={label}>How many</span>
        <input type="number" className={input} value={Number(block.limit ?? 4)} onChange={(e) => onChange({ limit: Number(e.target.value) })} />
        <p className="mt-1 text-[10px] text-ink-3">Resolved into fixed products at send time, so sent emails never change later.</p>
      </div>);
    case "coupon":
      return (<div>
        <Picker label="Promotion" value={String(block.promotionId ?? "")} options={resources.promotions}
          onChange={(id) => onChange({ promotionId: id })} emptyHint="No promotions yet. Create one in Commerce → Promotions." />
        <span className={label}>Heading</span>
        <input className={input} value={String(block.heading ?? "Your discount code")} onChange={(e) => onChange({ heading: e.target.value })} />
        <span className={label}>Shop URL</span>
        <input className={input} value={String(block.shopUrl ?? "")} onChange={(e) => onChange({ shopUrl: e.target.value || undefined })} />
        <p className="mt-1 text-[10px] text-ink-3">Unique codes are generated per recipient at send time, never in previews.</p>
      </div>);
    case "poll":
      return (<div>
        <Picker label="Poll" value={String(block.pollId ?? "")} options={resources.polls}
          onChange={(id) => onChange({ pollId: id })} emptyHint="No polls yet. Create one in Audience → Polls." />
      </div>);
    case "global":
      return (<div>
        <Picker label="Saved element" value={String(block.elementId ?? "")} options={resources.elements}
          onChange={(id) => onChange({ elementId: id })} emptyHint="No saved elements yet. Create one in Brands." />
        <p className="mt-1 text-[10px] text-ink-3">Linked: central edits update this template. Duplicate the block to detach a local copy.</p>
      </div>);
    case "footer":
      return (<div>
        <span className={label}>Footer text (blank = brand default)</span>
        <textarea rows={2} className={input} value={String(block.text ?? "")} onChange={(e) => onChange({ text: e.target.value || undefined })} />
        <span className={label}>Mailing address</span>
        <input className={input} value={String(block.address ?? "")} onChange={(e) => onChange({ address: e.target.value || undefined })} />
        <p className="mt-1 text-[10px] text-ink-3">The unsubscribe link is always included and cannot be removed.</p>
      </div>);
    default:
      return <p className="mt-2 text-[12px] text-ink-3">No options for this block.</p>;
  }
}
