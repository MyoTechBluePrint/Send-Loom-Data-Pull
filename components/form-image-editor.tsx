"use client";

// Image presentation for a popup: layout, source URL, alt text, click-through
// and a live layout preview. Images live at URLs (brand assets or product
// images); base64 uploads are rejected by the API on purpose.

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui";

const LAYOUTS = [
  { v: "none", l: "No image" },
  { v: "hero", l: "Hero — image above the form" },
  { v: "left", l: "Split — image left, form right" },
  { v: "right", l: "Split — form left, image right" },
  { v: "background", l: "Background image with overlay" },
] as const;

export function FormImageEditor(props: {
  formId: string;
  initial: { imageLayout: string; imageUrl: string | null; imageAlt: string | null; imageLinkUrl: string | null; imageOverlay: boolean };
  productImages: { title: string; imageUrl: string }[];
}) {
  const [layout, setLayout] = useState(props.initial.imageLayout);
  const [url, setUrl] = useState(props.initial.imageUrl ?? "");
  const [alt, setAlt] = useState(props.initial.imageAlt ?? "");
  const [linkUrl, setLinkUrl] = useState(props.initial.imageLinkUrl ?? "");
  const [overlay, setOverlay] = useState(props.initial.imageOverlay);
  const [notice, setNotice] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  async function save() {
    const r = await fetch(`/api/forms/${props.formId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageLayout: layout,
        imageUrl: url || null,
        imageAlt: alt || null,
        imageLinkUrl: linkUrl || null,
        imageOverlay: overlay,
      }),
    });
    const j = await r.json();
    setNotice(j.ok ? "Saved. Live within the tracker's 5-minute cache." : j.error?.formErrors?.join(", ") ?? j.error ?? "Could not save.");
  }

  const input = "mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-brand";
  const small = "text-[11px] font-medium text-ink-3";
  const showImage = layout !== "none" && url;

  return (
    <Card className="mt-4">
      <CardHeader
        title="Popup image"
        subtitle="Hero, split or background layouts · stacks vertically on mobile automatically"
        action={
          <button onClick={save} className="rounded-lg bg-gradient-to-b from-[#7c3aed] to-[#5b21b6] px-3.5 py-2 text-[13px] font-semibold text-white">
            Save image
          </button>
        }
      />
      <div className="grid gap-4 px-5 py-4 lg:grid-cols-2">
        <div>
          {notice && <p className="mb-3 rounded-lg border border-line bg-[#f7f6f4] px-3 py-2 text-[12px] text-ink-2">{notice}</p>}
          <label className="block">
            <span className={small}>Layout</span>
            <select className={input} value={layout} onChange={(e) => setLayout(e.target.value)}>
              {LAYOUTS.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}
            </select>
          </label>
          {layout !== "none" && (
            <>
              <label className="mt-2 block">
                <span className={small}>Image URL</span>
                <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
              </label>
              <label className="mt-2 block">
                <span className={small}>Or upload an image (PNG, JPEG, WebP · max 5MB)</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="mt-1 block w-full text-[12px] text-ink-3 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-brand"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const fd = new FormData();
                    fd.append("file", f);
                    const r = await fetch("/api/assets", { method: "POST", body: fd });
                    const j = await r.json();
                    if (j.ok) { setUrl(location.origin + j.url); if (!alt) setAlt(f.name.replace(/\.[^.]*$/, "")); setNotice("Uploaded. Remember to save."); }
                    else setNotice(j.error ?? "Upload failed.");
                  }}
                />
              </label>
              {props.productImages.length > 0 && (
                <label className="mt-2 block">
                  <span className={small}>Or pick a product image</span>
                  <select className={input} defaultValue="" onChange={(e) => { if (e.target.value) { setUrl(e.target.value); const p = props.productImages.find((x) => x.imageUrl === e.target.value); if (p && !alt) setAlt(p.title); } }}>
                    <option value="">Choose…</option>
                    {props.productImages.map((p) => <option key={p.imageUrl} value={p.imageUrl}>{p.title}</option>)}
                  </select>
                </label>
              )}
              <label className="mt-2 block">
                <span className={small}>Alt text (accessibility, required to look after everyone)</span>
                <input className={input} value={alt} onChange={(e) => setAlt(e.target.value)} />
              </label>
              <label className="mt-2 block">
                <span className={small}>Click-through URL (optional)</span>
                <input className={input} value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://…" />
              </label>
              {layout === "background" && (
                <label className="mt-2 flex items-center gap-2 text-[12px] text-ink-2">
                  <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} className="h-3.5 w-3.5 accent-[#6d28d9]" />
                  Contrast overlay so the text stays readable
                </label>
              )}
            </>
          )}
        </div>

        {/* Layout preview */}
        <div>
          <div className="mb-2 inline-flex rounded-full border border-line bg-surface p-0.5">
            {(["desktop", "mobile"] as const).map((d) => (
              <button key={d} onClick={() => setDevice(d)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold capitalize ${device === d ? "bg-[#14121f] text-white" : "text-ink-3"}`}>
                {d}
              </button>
            ))}
          </div>
          <div className="mx-auto rounded-xl border border-line bg-[#efeee9] p-4" style={{ maxWidth: device === "mobile" ? 280 : 460 }}>
            <div className="relative overflow-hidden rounded-xl bg-white shadow-lg">
              {showImage && layout === "background" && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={alt} className="absolute inset-0 h-full w-full object-cover" />
                  {overlay && <div className="absolute inset-0 bg-black/45" />}
                </>
              )}
              <div className={`relative ${showImage && (layout === "left" || layout === "right") && device === "desktop" ? "flex" : ""} ${layout === "right" ? "flex-row-reverse" : ""}`}>
                {showImage && layout !== "background" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={url} alt={alt}
                    className={layout === "hero" || device === "mobile" ? "h-28 w-full object-cover" : "w-2/5 object-cover"}
                  />
                )}
                <div className={`p-4 ${showImage && layout === "background" ? "text-white" : ""}`}>
                  <p className="text-sm font-bold">Get 10% off your first order</p>
                  <p className={`mt-1 text-[11px] ${showImage && layout === "background" ? "text-white/80" : "text-ink-3"}`}>Join for early access and honest product education.</p>
                  <div className="mt-2 h-7 rounded border border-line bg-white/90" />
                  <div className="mt-1.5 h-7 rounded bg-[#6d28d9]" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
