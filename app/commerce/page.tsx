// Commerce: the internal product catalogue, promotions, and honest platform
// status. Server component: the data is read-heavy and static per view.

import { Shell } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { db } from "@/lib/server/db";
import { currentUser } from "@/lib/server/permissions";
import { redirect } from "next/navigation";
import { allAdapters, adapterFor } from "@/lib/server/commerce/adapter";
import { PromotionsClient } from "@/components/promotions-client";

export const dynamic = "force-dynamic";

const money = (n: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);

export default async function CommercePage({ searchParams }: { searchParams: Promise<{ q?: string; store?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { q, store: storeFilter } = await searchParams;

  const stores = await db.store.findMany({ where: { workspaceId: user.workspaceId }, orderBy: { name: "asc" } });
  const products = await db.product.findMany({
    where: {
      store: { workspaceId: user.workspaceId, ...(storeFilter ? { id: storeFilter } : {}) },
      ...(q ? { title: { contains: q } } : {}),
    },
    include: { store: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
    take: 60,
  });

  const health = await Promise.all(
    stores.map(async (s) => {
      const adapter = adapterFor(s.platform);
      return {
        store: s.name,
        platform: s.platform,
        status: adapter?.status ?? "coming_soon",
        health: adapter ? await adapter.health(s) : null,
        transport: adapter?.transport ?? "No adapter",
      };
    })
  );

  return (
    <Shell title="Commerce" subtitle="Products, promotions and store connections">
      {/* Platform status: honest labels, from the adapter itself. */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {health.map((h) => (
          <Card key={h.store} className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">{h.store}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                h.status === "operational" && h.health?.connected ? "bg-emerald-50 text-emerald-700"
                : h.status === "coming_soon" ? "bg-zinc-100 text-zinc-500"
                : "bg-amber-50 text-amber-800"
              }`}>
                {h.health?.connected ? h.status.replace("_", " ") : h.status === "coming_soon" ? "coming soon" : "not connected"}
              </span>
            </div>
            <p className="mt-1 text-[11px] capitalize text-ink-3">{h.platform}</p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-2">{h.health?.detail ?? h.transport}</p>
          </Card>
        ))}
        {allAdapters().filter((a) => !health.some((h) => h.platform === a.platform)).map((a) => (
          <Card key={a.platform} className="px-4 py-3.5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold capitalize">{a.platform}</p>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase text-zinc-500">
                {a.status.replace("_", " ")}
              </span>
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-ink-2">{a.transport}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <PromotionsClient stores={stores.map((s) => ({ id: s.id, name: s.name }))} />
      </div>

      <Card className="mt-4">
        <CardHeader
          title="Product catalogue"
          subtitle={`${products.length} shown · synced from connected stores by the plugin · used by email product blocks and feeds`}
        />
        <form className="flex flex-wrap gap-2 border-b border-line px-5 py-3">
          <input
            name="q" defaultValue={q ?? ""} placeholder="Search products…"
            className="w-56 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] outline-none focus:border-brand"
          />
          <select name="store" defaultValue={storeFilter ?? ""} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px]">
            <option value="">All stores</option>
            {stores.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button type="submit" className="rounded-lg border border-line px-3.5 py-1.5 text-[13px] font-semibold text-ink-2 hover:border-brand hover:text-brand">Filter</button>
        </form>
        {products.length === 0 ? (
          <p className="px-5 py-10 text-center text-[13px] text-ink-3">
            No products yet. Products arrive when a connected store&apos;s plugin runs its catalogue sync.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line">
                <tr><Th>Product</Th><Th>Store</Th><Th>Price</Th><Th>Stock</Th><Th>Categories</Th><Th>ID for email blocks</Th></tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="border-b border-line/70 last:border-0">
                    <Td>
                      <span className="flex items-center gap-2.5">
                        {p.imageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="h-9 w-9 rounded-lg border border-line object-cover" />
                        )}
                        <span className="font-medium">{p.title}</span>
                      </span>
                    </Td>
                    <Td>{p.store.name}</Td>
                    <Td>{p.salePrice !== null ? <><strong>{money(p.salePrice)}</strong> <s className="text-ink-3">{money(p.price)}</s></> : money(p.price)}</Td>
                    <Td>{p.inventory ?? "—"}</Td>
                    <Td className="max-w-[180px] truncate text-[12px] text-ink-3">
                      {(() => { try { return (JSON.parse(p.categories ?? "[]") as string[]).join(", ") || "—"; } catch { return "—"; } })()}
                    </Td>
                    <Td><code className="rounded bg-[#f0efec] px-1.5 py-0.5 font-mono text-[11px]">{p.id}</code></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Shell>
  );
}
