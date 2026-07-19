"use client";

// UTM builder for the ads team. Saved links live in localStorage (personal
// scratchpad, not workspace data).
import { useEffect, useState } from "react";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";

const KEY = "sendloom_utm_links";
const field = "mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-brand";

type Saved = { name: string; url: string };

const STORE_ROOTS: Record<string, string> = {
  MyoTech: "https://myotech.store/",
  Novatec: "https://novateclabs.co.uk/",
};

export default function UtmBuilderPage() {
  const [form, setForm] = useState({
    store: "MyoTech", owner: "",
    landing: STORE_ROOTS.MyoTech, source: "facebook", medium: "paid_social",
    campaign: "", content: "", term: "",
  });

  function pickStore(store: string) {
    // Swap the landing root when it hasn't been customised beyond a store root.
    const untouched = form.landing === "https://" || Object.values(STORE_ROOTS).includes(form.landing);
    setForm({ ...form, store, landing: untouched ? STORE_ROOTS[store] : form.landing });
  }
  const [saved, setSaved] = useState<Saved[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch { setSaved([]); }
  }, []);

  const url = (() => {
    try {
      const u = new URL(form.landing);
      if (form.source) u.searchParams.set("utm_source", form.source);
      if (form.medium) u.searchParams.set("utm_medium", form.medium);
      if (form.campaign) u.searchParams.set("utm_campaign", form.campaign);
      if (form.content) u.searchParams.set("utm_content", form.content);
      if (form.term) u.searchParams.set("utm_term", form.term);
      return u.toString();
    } catch {
      return "";
    }
  })();

  async function copy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function save() {
    if (!url || !form.campaign) return;
    const owner = form.owner.trim() ? ` · ${form.owner.trim()}` : "";
    const next = [{ name: `${form.store} · ${form.campaign} · ${form.source}/${form.medium}${owner}`, url }, ...saved].slice(0, 30);
    setSaved(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  return (
    <Shell title="UTM Builder" subtitle="Tag every ad link before it goes live · pick the store first so the link lands on the right domain">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Build a tagged link" />
          <div className="space-y-3 px-5 py-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Store *</span>
                <select value={form.store} onChange={(e) => pickStore(e.target.value)} className={field}>
                  {Object.keys(STORE_ROOTS).map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Campaign owner</span>
                <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} placeholder="who runs this campaign" className={field} />
              </label>
            </div>
            {([
              ["landing", "Landing page URL *", "https://myotech.store/product/…"],
              ["campaign", "Campaign *", "july-nad-launch"],
              ["content", "Content (ad/creative)", "video-a"],
              ["term", "Term (keyword)", ""],
            ] as const).map(([key, label, ph]) => (
              <label key={key} className="block">
                <span className="text-xs font-medium text-ink-3">{label}</span>
                <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} placeholder={ph} className={field} />
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Source *</span>
                <select value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} className={field}>
                  {["facebook", "instagram", "google", "tiktok", "youtube", "email", "whatsapp", "referral"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-medium text-ink-3">Medium *</span>
                <select value={form.medium} onChange={(e) => setForm({ ...form, medium: e.target.value })} className={field}>
                  {["paid_social", "cpc", "paid_video", "email", "organic_social", "affiliate"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
            </div>
            <div className="rounded-lg bg-[#fafaf8] px-3.5 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-3">Tagged URL</p>
              <p className="mt-1 break-all font-mono text-xs leading-relaxed">{url || "Enter a valid landing page URL"}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={copy} disabled={!url} className="rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6] disabled:opacity-50">
                {copied ? "Copied ✓" : "Copy URL"}
              </button>
              <button onClick={save} disabled={!url || !form.campaign} className="rounded-lg border border-line px-4 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec] disabled:opacity-50">
                Save link
              </button>
            </div>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Saved links" subtitle="Stored on this browser" />
          <ul className="divide-y divide-line">
            {saved.map((s, i) => (
              <li key={i} className="px-5 py-3">
                <p className="text-[13px] font-semibold">{s.name}</p>
                <button
                  onClick={async () => { await navigator.clipboard.writeText(s.url); }}
                  className="mt-0.5 break-all text-left font-mono text-[11px] text-brand hover:underline"
                  title="Click to copy"
                >
                  {s.url}
                </button>
              </li>
            ))}
            {saved.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-3">No saved links yet.</li>}
          </ul>
        </Card>
      </div>
    </Shell>
  );
}
