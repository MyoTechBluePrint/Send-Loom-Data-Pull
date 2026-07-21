// One integration on the platform: health, keys, webhooks, delivery log
// and live event feed. Server-rendered data, client-side controls.
import Link from "next/link";
import { notFound } from "next/navigation";
import { Shell } from "@/components/shell";
import { db } from "@/lib/server/db";
import { CATALOG, PERMISSIONS, WEBHOOK_EVENTS, ensureCatalog } from "@/lib/server/platform";
import { IntegrationDetailClient, type KeyRow, type EndpointRow } from "@/components/integration-detail";

export const dynamic = "force-dynamic";

export default async function IntegrationPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = await db.workspace.findFirstOrThrow();
  await ensureCatalog(ws.id);
  const integration = await db.integration.findUnique({ where: { workspaceId_slug: { workspaceId: ws.id, slug } } });
  if (!integration) notFound();
  const cat = CATALOG.find((c) => c.slug === slug);

  const [keys, endpoints, deliveries, feed] = await Promise.all([
    db.apiKey.findMany({ where: { integrationId: integration.id }, orderBy: { createdAt: "desc" } }),
    db.webhookEndpoint.findMany({ where: { integrationId: integration.id }, orderBy: { createdAt: "desc" } }),
    db.webhookDelivery.findMany({
      where: { workspaceId: ws.id, endpoint: { integrationId: integration.id } },
      orderBy: { createdAt: "desc" }, take: 15, include: { endpoint: { select: { url: true } } },
    }),
    db.event.findMany({
      where: { workspaceId: ws.id, type: "integration_event", sourceContext: `integration:${slug}` },
      orderBy: { occurredAt: "desc" }, take: 15,
    }),
  ]);

  const keyRows: KeyRow[] = keys.map((k) => ({
    id: k.id, name: k.name, publicKey: k.publicKey, secretHint: k.secretHint,
    permissions: JSON.parse(k.permissions) as string[], status: k.status,
    lastUsedAt: k.lastUsedAt?.toISOString() ?? null, expiresAt: k.expiresAt?.toISOString() ?? null,
    createdAt: k.createdAt.toISOString(),
  }));
  const endpointRows: EndpointRow[] = endpoints.map((e) => ({
    id: e.id, url: e.url, events: JSON.parse(e.events) as string[], status: e.status, failCount: e.failCount,
    lastSuccessAt: e.lastSuccessAt?.toISOString() ?? null, lastFailureAt: e.lastFailureAt?.toISOString() ?? null,
  }));

  return (
    <Shell
      title={integration.name}
      subtitle={cat?.blurb ?? "Custom integration on the Sendloom platform"}
      actions={<Link href="/integrations" className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-zinc-50">← Platform</Link>}
    >
      <div className="rounded-2xl bg-[#0f0d17] p-5">
        <IntegrationDetailClient
          integrationId={integration.id}
          slug={slug}
          allPermissions={[...PERMISSIONS]}
          defaultPermissions={cat?.defaultPermissions ?? ["contacts:read"]}
          webhookEvents={[...WEBHOOK_EVENTS]}
          vocabulary={cat?.eventVocabulary ?? []}
          keys={keyRows}
          endpoints={endpointRows}
        />

        {/* Delivery log */}
        <div className="mt-4 rounded-xl border border-[#262433] bg-[#171522] p-4">
          <p className="text-[13.5px] font-bold text-white">Recent webhook deliveries</p>
          <div className="mt-2 divide-y divide-[#262433]">
            {deliveries.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-[12px]">
                <code className="text-[#c4b5fd]">{d.eventType}</code>
                <span className="truncate text-white/45">{d.endpoint.url}</span>
                <span className="ml-auto text-white/40">
                  {d.status}{d.responseCode ? ` · ${d.responseCode}` : ""} · attempt {d.attempts}
                  {d.nextRetryAt ? ` · retries ${d.nextRetryAt.toLocaleTimeString("en-GB")}` : ""}
                </span>
              </div>
            ))}
            {deliveries.length === 0 && <p className="py-2 text-[12px] text-white/40">No deliveries yet.</p>}
          </div>
        </div>

        {/* Live event feed */}
        <div className="mt-4 rounded-xl border border-[#262433] bg-[#171522] p-4">
          <p className="text-[13.5px] font-bold text-white">Event feed</p>
          <div className="mt-2 divide-y divide-[#262433]">
            {feed.map((e) => {
              let name = "event";
              try { name = (JSON.parse(e.payload ?? "{}") as { name?: string }).name ?? "event"; } catch {}
              return (
                <div key={e.id} className="flex items-center gap-3 py-2 text-[12px]">
                  <code className="text-[#c4b5fd]">{name}</code>
                  {e.contactId && <span className="text-white/40">contact linked</span>}
                  <span className="ml-auto text-white/40">{e.occurredAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              );
            })}
            {feed.length === 0 && <p className="py-2 text-[12px] text-white/40">Nothing pushed yet. POST /api/v1/track with this integration's key and it appears here.</p>}
          </div>
        </div>
      </div>
    </Shell>
  );
}
