"use client";

// The block-based email editor. Blocks are data (lib/server/email-blocks.ts);
// this component only edits the data and asks the server to render previews,
// so what you see is exactly the renderer's output, not a lookalike.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Block = Record<string, unknown> & { id: string; type: string };
type Issue = { level: "error" | "warning"; message: string; blockId?: string };
type PickOption = { id: string; label: string };
export type EditorResources = { products: PickOption[]; promotions: PickOption[]; elements: PickOption[]; polls: PickOption[] };

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
  const dragFrom = useRef<string | null>(null);

  useEffect(() => {
    fetch("/api/editor/resources").then((r) => r.json()).then((j) => j.ok && setResources(j)).catch(() => {});
  }, []);

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

  // Server-rendered preview, debounced.
  useEffect(() => {
    const t = setTimeout(() => {
      fetch(props.previewUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", content: JSON.stringify(blocks) }),
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
  }, [blocks, props.previewUrl]);

  const move = (id: string, dir: -1 | 1) => {
    const i = blocks.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    apply(next);
  };
  const duplicate = (id: string) => {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const copy = { ...blocks[i], id: newId() };
    apply([...blocks.slice(0, i + 1), copy, ...blocks.slice(i + 1)]);
  };
  const remove = (id: string) => apply(blocks.filter((b) => b.id !== id));
  const add = (item: (typeof BLOCK_MENU)[number]) => {
    const block = { id: newId(), type: item.type, ...item.make() } as Block;
    // Footer stays last.
    const fi = blocks.findIndex((b) => b.type === "footer");
    const next = fi >= 0 && item.type !== "footer"
      ? [...blocks.slice(0, fi), block, ...blocks.slice(fi)]
      : [...blocks, block];
    apply(next);
    setSelected(block.id);
  };
  const update = (id: string, patch: Record<string, unknown>) => {
    apply(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)));
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
            {blocks.map((b) => (
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
                  const i = blocks.findIndex((x) => x.id === from);
                  const j = blocks.findIndex((x) => x.id === b.id);
                  if (i < 0 || j < 0) return;
                  const next = [...blocks];
                  const [moved] = next.splice(i, 1);
                  next.splice(j, 0, moved);
                  apply(next);
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
    case "columns":
      return (<div>
        {t === "text" ? (<>
          <span className={label}>Content</span>
          {toolbar("html")}
          <textarea rows={5} className={input} value={String(block.html ?? "")} onChange={(e) => onChange({ html: e.target.value })} />
        </>) : (<>
          <span className={label}>Left column HTML</span>
          <textarea rows={3} className={input} value={String(block.left ?? "")} onChange={(e) => onChange({ left: e.target.value })} />
          <span className={label}>Right column HTML</span>
          <textarea rows={3} className={input} value={String(block.right ?? "")} onChange={(e) => onChange({ right: e.target.value })} />
        </>)}
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
