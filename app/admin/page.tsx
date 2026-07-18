import { Shell, GhostButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { providers } from "@/lib/data";

const provChip: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-700",
  syncing: "bg-blue-50 text-blue-700",
  error: "bg-red-50 text-red-700",
  "not connected": "bg-zinc-100 text-zinc-600",
};

export default function AdminPage() {
  return (
    <Shell
      title="Admin Control Centre"
      subtitle="Platform operator view · workspaces, imports, providers, reputation and audit"
      actions={<GhostButton>Export audit log</GhostButton>}
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ["Active workspaces", "212", "8 new this week"],
          ["Sends today", "1.42M", "queue healthy · p95 4.1s"],
          ["Platform bounce rate", "0.51%", "within threshold"],
          ["High-risk flags", "3", "2 imports · 1 complaint spike"],
        ].map(([k, v, d]) => (
          <Card key={k} className="px-5 py-4">
            <p className="text-xs font-medium text-ink-3">{k}</p>
            <p className="tabular mt-1.5 text-2xl font-semibold">{v}</p>
            <p className="mt-1 text-xs text-ink-3">{d}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader title="Risk queue" subtitle="Accounts and imports needing operator review" />
          <ul className="divide-y divide-line">
            {[
              { title: "Vitalis Wellness · import blocked", detail: "'Purchased list · unknown origin' · 5,000 rows, no consent trail · auto-quarantined, awaiting operator confirmation", level: "high", action: "Review import" },
              { title: "PulseFit Store · complaint spike", detail: "0.31% complaints on last campaign (threshold 0.1%) · sending auto-throttled", level: "high", action: "Inspect campaign" },
              { title: "GlowLab Beauty · suppression re-upload", detail: "112 previously unsubscribed contacts in new import · blocked automatically", level: "medium", action: "View records" },
            ].map((r) => (
              <li key={r.title} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="flex gap-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${r.level === "high" ? "bg-[#d03b3b]" : "bg-[#eda100]"}`} />
                  <div>
                    <p className="text-sm font-semibold">{r.title}</p>
                    <p className="mt-0.5 text-xs text-ink-2">{r.detail}</p>
                  </div>
                </div>
                <button className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">{r.action}</button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 border-t border-line px-5 py-3">
            <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">Pause workspace sending</button>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">Force suppression</button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Provider health" subtitle="All integrations run through the provider layer" />
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[560px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Provider</Th>
                <Th>Type</Th>
                <Th>Last sync</Th>
                <Th className="text-right">Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {providers.map((p) => (
                <tr key={p.name} className="hover:bg-[#fafaf8]">
                  <Td>
                    <p className="text-[13px] font-medium">{p.name}</p>
                    <p className="text-[11px] text-ink-3">{p.note}</p>
                  </Td>
                  <Td className="text-xs text-ink-2">{p.type}</Td>
                  <Td className="text-xs text-ink-2">{p.lastSync}</Td>
                  <Td className="text-right"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${provChip[p.status]}`}>{p.status}</span></Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Audit log" subtitle="Every consequential action, immutable" />
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[560px]">
          <tbody className="divide-y divide-line text-[13px]">
            {[
              ["Today 09:02", "system", "Campaign 'NAD+ Restock' completed · 9,204 delivered · 0 policy holds"],
              ["Today 08:47", "system", "Import imp_01 quality review complete · 44 rows held for consent"],
              ["Yesterday 17:20", "steve@vitaliswellness.co.uk", "Keyword 'semaglutide' classified Restricted (sector mode rule #12)"],
              ["Yesterday 16:44", "hannah@vitaliswellness.co.uk", "Uploaded import batch 'Webinar attendees · July' (1,240 rows)"],
              ["20 Jun 14:02", "system", "Import imp_06 BLOCKED · no verifiable consent · operator notified"],
              ["20 Jun 14:02", "studio-north@partner", "Attempted upload 'prospects-q3.csv' · flagged by consent gate"],
            ].map(([t, who, what], i) => (
              <tr key={i}>
                <td className="w-32 px-5 py-2.5 text-xs text-ink-3">{t}</td>
                <td className="w-64 px-5 py-2.5"><code className="text-xs font-semibold text-ink-2">{who}</code></td>
                <td className="px-5 py-2.5">{what}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </Shell>
  );
}
