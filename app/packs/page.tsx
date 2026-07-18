import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { num } from "@/lib/data";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";

export const dynamic = "force-dynamic";

export default async function PacksPage() {
  const wsId = await demoWorkspaceId();
  const [packs, recentExports] = await Promise.all([
    db.contactPack.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 40 }),
    db.exportLog.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return (
    <Shell
      title="Contact Packs"
      subtitle="Cleaned, frozen contact groups ready to copy or export · suppressed and unsubscribed always excluded"
      actions={<Link href="/subscribers" className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6]">Build from Contacts</Link>}
    >
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title={`Packs · ${packs.length}`} subtitle="Create packs from Contacts, Audiences, imports, search results or open tasks" />
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[720px]">
            <thead className="border-b border-line">
              <tr>
                <Th>Pack</Th>
                <Th className="text-right">Eligible</Th>
                <Th className="text-right">Emails</Th>
                <Th className="text-right">Phones</Th>
                <Th className="text-right">Excluded</Th>
                <Th className="text-right">Data</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {packs.map((p) => (
                <tr key={p.id} className="hover:bg-[#fafaf8]">
                  <Td>
                    <Link href={`/packs/${p.id}`} className="font-medium hover:text-brand">{p.name}</Link>
                    <p className="text-xs text-ink-3">{p.source} · by {p.createdBy.split("@")[0]} · {p.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
                  </Td>
                  <Td className="tabular text-right font-semibold">{num(p.eligible)}</Td>
                  <Td className="tabular text-right">{num(p.withEmail)}</Td>
                  <Td className="tabular text-right">{num(p.withPhone)}</Td>
                  <Td className="tabular text-right text-ink-3">{num(p.excludedSuppressed + p.excludedUnsubscribed + p.excludedNoRoute)}</Td>
                  <Td className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${p.simulated ? "bg-zinc-100 text-zinc-500" : "bg-emerald-50 text-emerald-700"}`}>
                      {p.simulated ? "Simulated" : "Real"}
                    </span>
                  </Td>
                </tr>
              ))}
              {packs.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-ink-3">No packs yet. Select contacts on the Contacts page, or use an audience card's "Create pack".</td></tr>
              )}
            </tbody>
          </table></div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Recent exports" subtitle="Every copy and download is logged" />
          <ul className="divide-y divide-line">
            {recentExports.map((e) => (
              <li key={e.id} className="px-5 py-2.5">
                <p className="text-[13px] font-medium">{e.format} · {e.contacts} contacts{e.batch ? ` · batch ${e.batch}` : ""}</p>
                <p className="text-[11px] text-ink-3">{e.source} · {e.user.split("@")[0]} · {e.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
              </li>
            ))}
            {recentExports.length === 0 && <li className="px-5 py-6 text-center text-sm text-ink-3">No exports yet.</li>}
          </ul>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">Full history in Admin → Export history.</p>
        </Card>
      </div>
    </Shell>
  );
}
