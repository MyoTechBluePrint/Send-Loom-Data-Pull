"use client";

// Activity feed with per-user filtering, so Steve can see exactly what Will
// did and where he stopped.
import { useMemo, useState } from "react";
import { Card, CardHeader } from "@/components/ui";

export type AuditRow = { time: string; who: string; action: string; what: string };

const sel = "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink-2 outline-none focus:border-brand";

export function AdminAuditClient({ rows }: { rows: AuditRow[] }) {
  const [who, setWho] = useState("all");
  const [kind, setKind] = useState("all");

  const actors = useMemo(() => [...new Set(rows.map((r) => r.who))], [rows]);
  const kinds = useMemo(() => [...new Set(rows.map((r) => r.action.split(".")[0]))], [rows]);

  const filtered = rows.filter((r) =>
    (who === "all" || r.who === who) && (kind === "all" || r.action.startsWith(kind))
  );

  return (
    <Card className="mt-4">
      <CardHeader title="Activity & audit log" subtitle="Append-only · logins, contacts, tasks, intake, sends, feedback and resets" />
      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
        <select value={who} onChange={(e) => setWho(e.target.value)} className={sel}>
          <option value="all">User: all</option>
          {actors.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className={sel}>
          <option value="all">Type: all</option>
          {kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <span className="self-center text-xs text-ink-3">{filtered.length} entries</span>
      </div>
      <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[640px]">
        <tbody className="divide-y divide-line text-[13px]">
          {filtered.map((l, i) => (
            <tr key={i}>
              <td className="w-32 px-5 py-2.5 text-xs text-ink-3">{l.time}</td>
              <td className="w-56 px-5 py-2.5"><code className="text-xs font-semibold text-ink-2">{l.who}</code></td>
              <td className="w-44 px-5 py-2.5"><span className="rounded bg-[#f0efec] px-1.5 py-0.5 text-[10px] font-bold text-ink-2">{l.action}</span></td>
              <td className="px-5 py-2.5">{l.what}</td>
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr><td colSpan={4} className="px-5 py-8 text-center text-sm text-ink-3">No activity for this filter yet.</td></tr>
          )}
        </tbody>
      </table></div>
    </Card>
  );
}
