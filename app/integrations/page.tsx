// Integration Platform home: the infrastructure layer of Sendloom. Every
// connector — MarketVox, MVSocial, WooCommerce, custom apps — is a catalog
// entry on the same engine: keys, permissions, events, webhooks.
import Link from "next/link";
import { Shell } from "@/components/shell";
import { db } from "@/lib/server/db";
import { CATALOG, ensureCatalog } from "@/lib/server/platform";

export const dynamic = "force-dynamic";

const STATUS_DOT: Record<string, string> = {
  connected: "bg-emerald-400",
  not_connected: "bg-zinc-500",
  error: "bg-red-400",
  disabled: "bg-amber-400",
};

export default async function IntegrationsPage() {
  const ws = await db.workspace.findFirstOrThrow();
  await ensureCatalog(ws.id);

  const dayAgo = new Date(Date.now() - 86400_000);
  const [integrations, keys, endpoints, deliveries24, events24] = await Promise.all([
    db.integration.findMany({ where: { workspaceId: ws.id }, orderBy: { name: "asc" } }),
    db.apiKey.findMany({ where: { workspaceId: ws.id }, select: { integrationId: true, status: true } }),
    db.webhookEndpoint.findMany({ where: { workspaceId: ws.id }, select: { integrationId: true, status: true } }),
    db.webhookDelivery.groupBy({ by: ["status"], where: { workspaceId: ws.id, createdAt: { gte: dayAgo } }, _count: true }),
    db.event.count({ where: { workspaceId: ws.id, type: "integration_event", occurredAt: { gte: dayAgo } } }),
  ]);

  const dcount = (s: string) => deliveries24.find((d) => d.status === s)?._count ?? 0;
  const activeKeys = keys.filter((k) => k.status === "active").length;

  return (
    <Shell
      title="Integration Platform"
      subtitle="The infrastructure layer: keys, permissions, lifecycle events and webhooks — one engine for every platform"
      actions={<Link href="/integrations/docs" className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6]">API documentation</Link>}
    >
      <div className="rounded-2xl bg-[#0f0d17] p-5 text-white">
        {/* Platform vitals */}
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            [String(activeKeys), "active API keys"],
            [String(endpoints.filter((e) => e.status === "active").length), "webhook endpoints"],
            [`${dcount("success")} ok · ${dcount("failed") + dcount("dead")} failed`, "deliveries · 24h"],
            [String(events24), "integration events · 24h"],
          ].map(([v, k]) => (
            <div key={k} className="rounded-xl border border-[#262433] bg-[#171522] px-4 py-3.5">
              <p className="tabular text-lg font-bold">{v}</p>
              <p className="text-[11px] uppercase tracking-wide text-white/40">{k}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {integrations.map((i) => {
            const cat = CATALOG.find((c) => c.slug === i.slug);
            const keyCount = keys.filter((k) => k.integrationId === i.id && k.status === "active").length;
            const hookCount = endpoints.filter((e) => e.integrationId === i.id).length;
            return (
              <Link
                key={i.id}
                href={`/integrations/${i.slug}`}
                className="group rounded-xl border border-[#262433] bg-[#171522] p-4 transition-colors hover:border-[#6d28d9]"
              >
                <div className="flex items-center gap-2.5">
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[i.status] ?? "bg-zinc-500"}`} />
                  <p className="text-[15px] font-bold">{i.name}</p>
                  <span className="rounded-full border border-[#262433] px-2 py-0.5 text-[10px] uppercase tracking-wide text-white/50">{i.kind}</span>
                  <span className="ml-auto text-[12px] text-white/30 transition-colors group-hover:text-[#a78bfa]">Open →</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-white/55">{cat?.blurb ?? "Custom integration."}</p>
                <p className="mt-3 text-[11.5px] text-white/40">
                  {keyCount} key{keyCount === 1 ? "" : "s"} · {hookCount} webhook{hookCount === 1 ? "" : "s"} ·{" "}
                  {i.lastEventAt ? `last event ${i.lastEventAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : "no events yet"}
                </p>
              </Link>
            );
          })}
        </div>

        <p className="mt-5 text-[11.5px] leading-relaxed text-white/35">
          Adding a platform (Shopify, Stripe, HubSpot, Zapier…) is a catalog entry, not a rebuild: every integration
          gets scoped keys, granular permissions, namespaced lifecycle events, signed webhooks with retries, audit
          history and the same versioned /api/v1 surface.
        </p>
      </div>
    </Shell>
  );
}
