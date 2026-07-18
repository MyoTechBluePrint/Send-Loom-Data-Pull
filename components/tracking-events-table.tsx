"use client";

// Filterable event stream for the Store Tracking QA page. Server passes the
// last 50 events; filtering happens client-side (store chips + type select).
import { useMemo, useState } from "react";
import { Th, Td } from "@/components/ui";

export type QaEvent = {
  id: string;
  occurredAt: string;
  storeId: string | null;
  storeName: string | null;
  type: string;
  who: string | null; // resolved contact label, null = anonymous
  anonymousId: string | null;
  payload: string | null;
};

export function TrackingEventsTable({ events, stores }: { events: QaEvent[]; stores: { id: string; name: string }[] }) {
  const [storeFilter, setStoreFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const types = useMemo(() => Array.from(new Set(events.map((e) => e.type))).sort(), [events]);
  const filtered = events.filter(
    (e) => (storeFilter === "all" || e.storeId === storeFilter) && (typeFilter === "all" || e.type === typeFilter)
  );

  const chip = (active: boolean) =>
    `rounded-full px-3 py-1 text-[12px] font-semibold transition ${active ? "bg-brand text-white" : "bg-[#f0efec] text-ink-2 hover:bg-[#e7e5e0]"}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <button className={chip(storeFilter === "all")} onClick={() => setStoreFilter("all")}>All stores</button>
        {stores.map((s) => (
          <button key={s.id} className={chip(storeFilter === s.id)} onClick={() => setStoreFilter(s.id)}>{s.name}</button>
        ))}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="ml-auto rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium outline-none focus:border-brand"
        >
          <option value="all">All event types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[820px]">
        <thead className="border-b border-line">
          <tr><Th>When</Th><Th>Store</Th><Th>Event</Th><Th>Who</Th><Th>Payload</Th></tr>
        </thead>
        <tbody className="divide-y divide-line">
          {filtered.map((e) => (
            <tr key={e.id} className="hover:bg-[#fafaf8]">
              <Td className="whitespace-nowrap text-xs text-ink-3">{e.occurredAt}</Td>
              <Td className="text-xs">{e.storeName ?? "–"}</Td>
              <Td><span className="rounded bg-[#f0efec] px-1.5 py-0.5 text-[11px] font-bold text-ink-2">{e.type}</span></Td>
              <Td className="text-xs">
                {e.who ?? <span className="text-ink-3">anonymous{e.anonymousId ? ` · ${e.anonymousId.slice(0, 10)}` : ""}</span>}
              </Td>
              <Td className="max-w-md truncate text-[11px] text-ink-3">{e.payload ?? "–"}</Td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-3">
              {events.length === 0
                ? "No tracking events yet. Install the plugin and send a test event."
                : "No events match this filter yet."}
            </td></tr>
          )}
        </tbody>
      </table></div>
    </div>
  );
}
