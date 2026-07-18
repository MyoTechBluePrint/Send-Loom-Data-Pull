"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { store } from "@/lib/data";
import { Walkthrough, WALKTHROUGH_KEY } from "@/components/walkthrough";
import { GlobalSearch } from "@/components/global-search";

type Me = { name: string; roleLabel: string; env: string };

const nav: { section?: string; items: { href: string; label: string; icon: string }[] }[] = [
  { items: [{ href: "/", label: "Dashboard", icon: "◧" }] },
  {
    section: "Capture",
    items: [
      { href: "/inbox", label: "Universal Inbox", icon: "⤓" },
      { href: "/imports", label: "Data Dropzone", icon: "⇪" },
      { href: "/forms", label: "Forms & Quizzes", icon: "▤" },
    ],
  },
  {
    section: "Audience",
    items: [
      { href: "/subscribers", label: "Contacts", icon: "◉" },
      { href: "/segments", label: "Audience Builder", icon: "◫" },
      { href: "/packs", label: "Contact Packs", icon: "⧉" },
      { href: "/prospects", label: "Prospect Discovery", icon: "✧" },
    ],
  },
  {
    section: "Growth",
    items: [
      { href: "/campaigns", label: "Campaigns", icon: "✉" },
      { href: "/automations", label: "Automations", icon: "⌁" },
      { href: "/demand", label: "Demand Radar", icon: "☄" },
      { href: "/tasks", label: "Sales Tasks", icon: "☑" },
    ],
  },
  {
    section: "Control",
    items: [
      { href: "/analytics", label: "Analytics", icon: "∿" },
      { href: "/tracking", label: "Store Tracking", icon: "◉" },
      { href: "/providers", label: "API Providers", icon: "↯" },
      { href: "/admin", label: "Admin", icon: "▣" },
      { href: "/settings", label: "Settings", icon: "⚙" },
      { href: "/team-handover", label: "Handover Guide", icon: "✦" },
    ],
  },
];

export function Shell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [navOpen, setNavOpen] = useState(false);
  useEffect(() => {
    fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)).then((j) => j?.ok && setMe(j)).catch(() => {});
  }, []);
  return (
    <div className="flex min-h-screen">
      {navOpen && <button aria-label="Close menu" onClick={() => setNavOpen(false)} className="fixed inset-0 z-30 bg-black/50 lg:hidden" />}
      <aside className={`fixed inset-y-0 left-0 z-40 w-60 flex-col border-r border-[#262433] bg-[#14121f] text-white ${navOpen ? "flex" : "hidden"} lg:flex`}>
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6d28d9] text-sm font-bold">S</div>
          <div>
            <p className="text-sm font-semibold leading-tight">Sendloom</p>
            <p className="text-[11px] text-white/50">Growth Intelligence OS</p>
          </div>
        </div>
        <nav className="mt-1 flex-1 space-y-3 overflow-y-auto px-3 scroll-thin">
          {nav.map((group, gi) => (
            <div key={gi}>
              {group.section && (
                <p className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-widest text-white/35">{group.section}</p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setNavOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                        active ? "bg-[#6d28d9] text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <span className="w-4 text-center text-[14px] leading-none opacity-90">{item.icon}</span>
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mx-3 mb-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold">{me?.name ?? "Signed in"}</p>
              <p className="text-[10px] text-white/50">{me ? `${me.roleLabel} · ${me.env}` : "Staging"}</p>
            </div>
            <button
              onClick={async () => {
                await fetch("/api/auth/logout", { method: "POST" });
                window.location.href = "/login";
              }}
              className="shrink-0 rounded-md border border-white/15 px-2 py-1 text-[10px] font-semibold text-white/60 hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-white/10 pt-2">
            <Link href="/team-handover" className="text-[10px] font-semibold text-white/60 hover:text-white">Handover guide</Link>
            <button
              onClick={() => {
                localStorage.removeItem(WALKTHROUGH_KEY);
                window.dispatchEvent(new Event("sendloom:walkthrough"));
              }}
              className="text-[10px] font-semibold text-white/60 hover:text-white"
            >
              Restart walkthrough
            </button>
            <Link href="/feedback" className="text-[10px] font-semibold text-white/60 hover:text-white">Feedback</Link>
          </div>
        </div>
        <div className="mx-3 mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <p className="truncate text-xs font-medium">{store.name}</p>
          </div>
          <p className="mt-1 text-[11px] text-white/50">
            {store.platform} · synced {store.lastSync}
          </p>
          <p className="mt-1.5 inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-white/70">
            Sector mode: {store.sectorMode}
          </p>
        </div>
      </aside>

      <div className="flex-1 lg:ml-60">
        <div className="flex items-center justify-center gap-2 bg-[#14121f] px-4 py-1.5 text-center text-[11px] font-medium text-white/80">
          <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
          Sendloom Staging · Demo data only · No live sending
          <Link href="/team-handover" className="font-bold text-white underline underline-offset-2 hover:text-amber-200">What to try →</Link>
        </div>
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-[rgba(247,247,245,0.85)] px-8 py-4 backdrop-blur max-xl:px-5">
          <button
            aria-label="Open menu"
            onClick={() => setNavOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-lg lg:hidden"
          >
            ☰
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              onClick={() => window.dispatchEvent(new Event("sendloom:search"))}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] text-ink-3 hover:bg-[#f0efec]"
              title="Search (⌘K)"
            >
              ⌕ <span className="max-sm:hidden">Search</span> <kbd className="rounded border border-line px-1 text-[10px]">⌘K</kbd>
            </button>
            {actions}
          </div>
        </header>
        <main className="px-5 py-6 xl:px-8">{children}</main>
        <Walkthrough />
        <GlobalSearch />
      </div>
    </div>
  );
}

export function PrimaryButton({ children }: { children: ReactNode }) {
  return (
    <button className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-[#5b21b6]">
      {children}
    </button>
  );
}

export function GhostButton({ children }: { children: ReactNode }) {
  return (
    <button className="rounded-lg border border-line bg-surface px-3.5 py-2 text-[13px] font-semibold text-ink-2 transition-colors hover:bg-[#f0efec]">
      {children}
    </button>
  );
}
