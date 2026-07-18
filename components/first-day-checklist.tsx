"use client";

// Will's first-day checklist. Progress is personal (localStorage), so ticking
// items is safe and survives refreshes on the same browser.
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardHeader } from "@/components/ui";

const KEY = "sendloom_first_day";

const ITEMS: { id: string; label: string; href: string }[] = [
  { id: "login", label: "Log in successfully (done, you're here)", href: "/" },
  { id: "guide", label: "Read this Handover Guide", href: "/team-handover" },
  { id: "paste", label: "Try Paste Anything with made-up data", href: "/inbox" },
  { id: "contact", label: "Create one demo contact", href: "/subscribers" },
  { id: "note", label: "Add a note to a contact", href: "/subscribers" },
  { id: "task", label: "Create one sales task", href: "/tasks" },
  { id: "complete", label: "Mark one task complete", href: "/tasks" },
  { id: "audience", label: "Create one test audience", href: "/segments" },
  { id: "radar", label: "Open Demand Radar", href: "/demand" },
  { id: "feedback", label: "Leave feedback on anything confusing", href: "/feedback" },
];

export function FirstDayChecklist() {
  const [done, setDone] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
    } catch {
      setDone([]);
    }
    setLoaded(true);
  }, []);

  function toggle(id: string) {
    const next = done.includes(id) ? done.filter((d) => d !== id) : [...done, id];
    setDone(next);
    localStorage.setItem(KEY, JSON.stringify(next));
  }

  const pct = Math.round((done.length / ITEMS.length) * 100);

  return (
    <Card>
      <CardHeader
        title="Your first-day checklist"
        subtitle="Ticks save on this browser only · aim to finish all ten"
        action={<span className="tabular rounded-full bg-brand-soft px-2.5 py-1 text-xs font-bold text-brand">{loaded ? `${pct}%` : "…"}</span>}
      />
      <div className="px-5 pt-3">
        <div className="h-1.5 w-full rounded-full bg-[#f0efec]">
          <div className="h-1.5 rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ul className="px-5 py-3">
        {ITEMS.map((item) => (
          <li key={item.id} className="flex items-center gap-3 py-1.5">
            <input
              type="checkbox"
              checked={done.includes(item.id)}
              onChange={() => toggle(item.id)}
              className="h-4 w-4 shrink-0 accent-[#6d28d9]"
            />
            <span className={`flex-1 text-[13px] ${done.includes(item.id) ? "text-ink-3 line-through" : ""}`}>{item.label}</span>
            <Link href={item.href} className="shrink-0 text-xs font-semibold text-brand hover:underline">Go →</Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
