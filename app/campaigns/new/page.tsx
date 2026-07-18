"use client";

import Link from "next/link";
import { useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card } from "@/components/ui";

type Block =
  | { id: number; type: "logo" }
  | { id: number; type: "heading"; text: string }
  | { id: number; type: "text"; text: string }
  | { id: number; type: "button"; text: string }
  | { id: number; type: "product"; title: string; price: string }
  | { id: number; type: "recommended" }
  | { id: number; type: "countdown" }
  | { id: number; type: "divider" };

const palette: { type: Block["type"]; label: string; icon: string }[] = [
  { type: "heading", label: "Heading", icon: "H" },
  { type: "text", label: "Text", icon: "¶" },
  { type: "button", label: "Button", icon: "▭" },
  { type: "product", label: "Product", icon: "◨" },
  { type: "recommended", label: "Recommended", icon: "✦" },
  { type: "countdown", label: "Countdown", icon: "◷" },
  { type: "divider", label: "Divider", icon: "―" },
];

let nextId = 100;

export default function CampaignBuilder() {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [selected, setSelected] = useState<number | null>(2);
  const [blocks, setBlocks] = useState<Block[]>([
    { id: 1, type: "logo" },
    { id: 2, type: "heading", text: "Cellular energy, explained" },
    { id: 3, type: "text", text: "Hi {{ first_name }}, here's what NAD+ actually does, what the research says, and 15% off your first bottle with code {{ discount_code }}." },
    { id: 4, type: "countdown" },
    { id: 5, type: "product", title: "NAD+ Cellular Complex", price: "£68 £57.80" },
    { id: 6, type: "button", text: "Read the guide" },
    { id: 7, type: "divider" },
    { id: 8, type: "recommended" },
  ]);

  function addBlock(type: Block["type"]) {
    const base = { id: nextId++ } as { id: number };
    const b: Block =
      type === "heading" ? { ...base, type, text: "New heading" }
      : type === "text" ? { ...base, type, text: "Write something…" }
      : type === "button" ? { ...base, type, text: "Call to action" }
      : type === "product" ? { ...base, type, title: "Marine Collagen Peptides", price: "£42" }
      : ({ ...base, type } as Block);
    setBlocks((prev) => [...prev, b]);
    setSelected(b.id);
  }

  function move(id: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const i = prev.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  return (
    <Shell
      title="Create campaign"
      subtitle="NAD+ education push · Draft · audience: Longevity interest (9,204)"
      actions={
        <>
          <GhostButton>Send test</GhostButton>
          <GhostButton>Schedule</GhostButton>
          <PrimaryButton>Review & send</PrimaryButton>
        </>
      }
    >
      <Link href="/campaigns" className="text-xs font-semibold text-brand hover:underline">← All campaigns</Link>

      <div className="mt-3 grid grid-cols-[220px_1fr_260px] gap-4">
        {/* Block palette */}
        <Card className="self-start">
          <p className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Blocks</p>
          <div className="grid grid-cols-2 gap-2 p-3">
            {palette.map((p) => (
              <button
                key={p.type}
                onClick={() => addBlock(p.type)}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-line bg-surface px-2 py-3 text-center hover:border-brand hover:bg-brand-soft"
              >
                <span className="text-base text-ink-2">{p.icon}</span>
                <span className="text-[11px] font-medium text-ink-2">{p.label}</span>
              </button>
            ))}
          </div>
          <p className="border-t border-line px-4 py-3 text-[11px] leading-relaxed text-ink-3">
            Click to add. In the full builder, blocks drag and drop with live merge-tag preview.
          </p>
        </Card>

        {/* Canvas */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg border border-line bg-surface p-1">
              {(["desktop", "mobile"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDevice(d)}
                  className={`rounded-md px-3 py-1 text-xs font-semibold capitalize ${device === d ? "bg-brand-soft text-brand" : "text-ink-2"}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-3">Subject: <span className="font-medium text-foreground">What NAD+ actually does</span></p>
          </div>

          <div className={`mx-auto transition-all ${device === "mobile" ? "max-w-[380px]" : "max-w-[600px]"}`}>
            <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
              {blocks.map((b, i) => (
                <div
                  key={b.id}
                  onClick={() => setSelected(b.id)}
                  className={`group relative cursor-pointer px-8 py-4 ${selected === b.id ? "ring-2 ring-inset ring-brand" : "hover:ring-1 hover:ring-inset hover:ring-[#c9b8ec]"}`}
                >
                  <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                    <button onClick={(e) => { e.stopPropagation(); move(b.id, -1); }} className="rounded bg-[#14121f] px-1.5 py-0.5 text-[10px] text-white">↑</button>
                    <button onClick={(e) => { e.stopPropagation(); move(b.id, 1); }} className="rounded bg-[#14121f] px-1.5 py-0.5 text-[10px] text-white">↓</button>
                    <button onClick={(e) => { e.stopPropagation(); setBlocks(blocks.filter((x) => x.id !== b.id)); }} className="rounded bg-[#14121f] px-1.5 py-0.5 text-[10px] text-white">✕</button>
                  </div>

                  {b.type === "logo" && (
                    <p className="text-center font-serif text-xl tracking-[0.25em] text-[#3a3532]">VITALIS</p>
                  )}
                  {b.type === "heading" && <h2 className="text-center text-2xl font-semibold tracking-tight text-[#2b2724]">{b.text}</h2>}
                  {b.type === "text" && (
                    <p className="text-center text-sm leading-relaxed text-[#5a544f]">
                      {b.text.split(/(\{\{[^}]+\}\})/g).map((part, j) =>
                        part.startsWith("{{") ? <code key={j} className="rounded bg-brand-soft px-1 py-0.5 text-[11px] font-semibold text-brand">{part}</code> : part
                      )}
                    </p>
                  )}
                  {b.type === "button" && (
                    <div className="text-center">
                      <span className="inline-block rounded-md bg-[#2b2724] px-6 py-2.5 text-sm font-semibold text-white">{b.text}</span>
                    </div>
                  )}
                  {b.type === "product" && (
                    <div className="flex items-center gap-4 rounded-lg border border-[#eceae6] p-3">
                      <div className="h-20 w-20 shrink-0 rounded-md bg-gradient-to-br from-[#dde4e8] to-[#b4c2c8]" />
                      <div>
                        <p className="text-sm font-semibold text-[#2b2724]">{b.title}</p>
                        <p className="mt-0.5 text-sm text-[#5a544f]">
                          <s className="text-[#a09a93]">{b.price.split(" ")[0]}</s> {b.price.split(" ")[1] ?? ""}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-brand">View product →</p>
                      </div>
                    </div>
                  )}
                  {b.type === "recommended" && (
                    <div>
                      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-[#a09a93]">Picked for {"{{ first_name }}"}</p>
                      <div className="grid grid-cols-3 gap-2">
                        {["#e4ddd3", "#d3dbe4", "#e4d3d8"].map((c, j) => (
                          <div key={j}>
                            <div className="h-20 rounded-md" style={{ background: c }} />
                            <p className="mt-1 text-[11px] font-medium text-[#5a544f]">Product {j + 1}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {b.type === "countdown" && (
                    <div className="flex justify-center gap-2">
                      {["04", "18", "36", "12"].map((v, j) => (
                        <div key={j} className="w-12 rounded-md bg-[#2b2724] py-2 text-center">
                          <p className="tabular text-lg font-bold text-white">{v}</p>
                          <p className="text-[9px] uppercase text-white/60">{["days", "hrs", "min", "sec"][j]}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {b.type === "divider" && <hr className="border-[#eceae6]" />}
                </div>
              ))}
              <p className="border-t border-[#eceae6] px-8 py-4 text-center text-[10px] text-[#a09a93]">
                Vitalis Wellness & Longevity · 8 Harley Mews, London · {"{{ unsubscribe }}"} · {"{{ preferences }}"}
              </p>
            </div>
          </div>
        </div>

        {/* Settings rail */}
        <div className="space-y-4 self-start">
          <Card>
            <p className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Send settings</p>
            <div className="space-y-3 p-4 text-[13px]">
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Audience</span>
                <select className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 outline-none focus:border-brand">
                  <option>Longevity interest (9,204)</option>
                  <option>VIP customers (412)</option>
                  <option>Weight-management intent (1,966)</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Subject line</span>
                <input defaultValue="What NAD+ actually does" className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 outline-none focus:border-brand" />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Preview text</span>
                <input defaultValue="The research, the honest caveats, and 15% off" className="mt-1 w-full rounded-lg border border-line bg-surface px-2.5 py-2 outline-none focus:border-brand" />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                <span className="font-medium">A/B test subject line</span>
                <input type="checkbox" defaultChecked className="h-4 w-4 accent-[#6d28d9]" />
              </label>
              <label className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5">
                <span className="font-medium">Send in recipient time zone</span>
                <input type="checkbox" className="h-4 w-4 accent-[#6d28d9]" />
              </label>
            </div>
          </Card>
          <Card>
            <p className="border-b border-line px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-3">Merge tags</p>
            <div className="flex flex-wrap gap-1.5 p-4">
              {["first_name", "discount_code", "cart_url", "order_total", "recommended_products", "unsubscribe"].map((t) => (
                <code key={t} className="rounded bg-brand-soft px-2 py-1 text-[11px] font-semibold text-brand">{"{{ " + t + " }}"}</code>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
