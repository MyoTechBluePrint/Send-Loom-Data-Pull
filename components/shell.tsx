"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { store } from "@/lib/data";

const nav = [
  { href: "/", label: "Dashboard", icon: "◧" },
  { href: "/campaigns", label: "Campaigns", icon: "✉" },
  { href: "/automations", label: "Automations", icon: "⌁" },
  { href: "/subscribers", label: "Subscribers", icon: "◉" },
  { href: "/segments", label: "Segments", icon: "◫" },
  { href: "/forms", label: "Forms & Popups", icon: "▤" },
  { href: "/analytics", label: "Analytics", icon: "∿" },
  { href: "/settings", label: "Settings", icon: "⚙" },
];

export function Shell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 flex w-60 flex-col border-r border-[#262433] bg-[#14121f] text-white">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#6d28d9] text-sm font-bold">S</div>
          <div>
            <p className="text-sm font-semibold leading-tight">Sendloom</p>
            <p className="text-[11px] text-white/50">for WooCommerce</p>
          </div>
        </div>
        <nav className="mt-2 flex-1 space-y-0.5 px-3">
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active ? "bg-[#6d28d9] text-white" : "text-white/65 hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="w-4 text-center text-[15px] leading-none opacity-90">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="mx-3 mb-4 rounded-lg border border-white/10 bg-white/5 px-3 py-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <p className="truncate text-xs font-medium">{store.name}</p>
          </div>
          <p className="mt-1 text-[11px] text-white/50">
            {store.platform} · synced {store.lastSync}
          </p>
        </div>
      </aside>

      <div className="ml-60 flex-1">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-[rgba(247,247,245,0.85)] px-8 py-4 backdrop-blur">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-3">{actions}</div>
        </header>
        <main className="px-8 py-6">{children}</main>
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
