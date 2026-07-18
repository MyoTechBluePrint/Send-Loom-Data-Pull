import { Shell, GhostButton } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { num } from "@/lib/data";
import { getAuditView, getImportBatchesView, getProvidersView } from "@/lib/server/views";

export const dynamic = "force-dynamic";

const provChip: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-700",
  syncing: "bg-blue-50 text-blue-700",
  error: "bg-red-50 text-red-700",
  "not connected": "bg-zinc-100 text-zinc-600",
};

export default async function AdminPage() {
  const [providers, audit, batches, pendingIntake] = await Promise.all([
    getProvidersView(),
    getAuditView(),
    getImportBatchesView(),
    (await import("@/lib/server/db")).db.intakeItem.count({ where: { status: { in: ["review", "partial"] } } }),
  ]);
  const risky = batches.filter((b) => b.status === "blocked" || b.status === "needs review");

  return (
    <Shell
      title="Admin Control Centre"
      subtitle="Operator view · live imports, providers and audit from the database"
      actions={<GhostButton>Export audit log</GhostButton>}
    >
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ["Import batches", String(batches.length), `${num(batches.reduce((s, b) => s + b.total, 0))} rows processed`],
          ["Blocked rows", num(batches.reduce((s, b) => s + b.blocked, 0)), "suppression + consent gates"],
          ["Providers healthy", `${providers.filter((p) => p.status === "healthy").length} / ${providers.length}`, providers.find((p) => p.status === "error") ? `${providers.find((p) => p.status === "error")!.name} needs re-auth` : "all connections OK"],
          ["Risk queue", String(risky.length + pendingIntake), `${risky.length} imports · ${pendingIntake} inbox items awaiting review`],
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
          <CardHeader title="Risk queue" subtitle="Imports needing operator review, live from the import pipeline" />
          <ul className="divide-y divide-line">
            {risky.map((b) => (
              <li key={b.id} className="flex items-start justify-between gap-4 px-5 py-3.5">
                <div className="flex gap-3">
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${b.status === "blocked" ? "bg-[#d03b3b]" : "bg-[#eda100]"}`} />
                  <div>
                    <p className="text-sm font-semibold">{b.name}</p>
                    <p className="mt-0.5 text-xs text-ink-2">
                      {b.status === "blocked"
                        ? `${num(b.blocked)} rows blocked · ${b.source}`
                        : `${num(b.missingConsent)} rows missing consent · ${num(b.ready)} ready · ${b.source}`}
                    </p>
                  </div>
                </div>
                <button className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">Review</button>
              </li>
            ))}
            {risky.length === 0 && <li className="px-5 py-8 text-center text-sm text-ink-3">Nothing in the queue.</li>}
          </ul>
          <div className="flex gap-2 border-t border-line px-5 py-3">
            <button className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-100">Pause workspace sending</button>
            <button className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-2 hover:bg-[#f0efec]">Force suppression</button>
          </div>
        </Card>

        <Card>
          <CardHeader title="Provider health" subtitle="Live from the provider registry" />
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
        <CardHeader title="Audit log" subtitle="Append-only · written by imports, plugin connections, segments and sector-mode rules" />
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[640px]">
          <tbody className="divide-y divide-line text-[13px]">
            {audit.map((l, i) => (
              <tr key={i}>
                <td className="w-36 px-5 py-2.5 text-xs text-ink-3">{l.time}</td>
                <td className="w-64 px-5 py-2.5"><code className="text-xs font-semibold text-ink-2">{l.who}</code></td>
                <td className="px-5 py-2.5">{l.what}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </Card>
    </Shell>
  );
}
