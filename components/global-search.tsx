"use client";

// Global search palette: ⌘K / Ctrl+K anywhere, or the header button.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type Group = { label: string; items: { title: string; detail: string; href: string }[] };

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const onOpen = () => setOpen(true);
    window.addEventListener("sendloom:search", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("sendloom:search", onOpen);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
    else { setQ(""); setGroups([]); }
  }, [open]);

  useEffect(() => {
    if (!open || q.trim().length < 2) { setGroups([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        if (json.ok) setGroups(json.groups);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [q, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <span className="text-ink-3">⌕</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search contacts, campaigns, audiences, tasks, keywords…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold text-ink-3">esc</kbd>
        </div>
        <div className="max-h-96 overflow-y-auto scroll-thin">
          {q.trim().length < 2 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">Type at least 2 characters. Searches the live database.</p>
          ) : busy && groups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">Searching…</p>
          ) : groups.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-3">No matches for "{q}".</p>
          ) : (
            groups.map((g) => (
              <div key={g.label} className="py-1.5">
                <p className="px-4 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-ink-3">{g.label}</p>
                {g.items.map((item, i) => (
                  <Link
                    key={i}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="flex items-baseline justify-between gap-3 px-4 py-2 hover:bg-brand-soft"
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{item.title}</span>
                    <span className="shrink-0 text-xs text-ink-3">{item.detail}</span>
                  </Link>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
