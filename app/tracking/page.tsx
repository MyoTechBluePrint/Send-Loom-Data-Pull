import { Shell } from "@/components/shell";
import { Card, CardHeader, Funnel, Th, Td } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { cartStats } from "@/lib/server/carts";
import { can, currentUser } from "@/lib/server/permissions";
import { TrackingTestButtons } from "@/components/tracking-test-buttons";
import { TrackingEventsTable, type QaEvent } from "@/components/tracking-events-table";
import { LiveRefresh } from "@/components/live-refresh";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const wsId = await demoWorkspaceId();
  const user = await currentUser();
  const showKeys = can(user?.role ?? "viewer", "manage_users");
  const canDownload = can(user?.role ?? "viewer", "download_plugin");

  const [stores, events, stats, rejects] = await Promise.all([
    db.store.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "asc" } }),
    db.event.findMany({
      where: { workspaceId: wsId, type: { notIn: ["imported", "consent_recorded"] } },
      orderBy: { occurredAt: "desc" }, take: 50,
      include: { contact: { select: { email: true, firstName: true, lastName: true } }, store: { select: { name: true } } },
    }),
    cartStats(),
    db.trackingReject.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { store: { select: { name: true } } } }),
  ]);

  const qaEvents: QaEvent[] = events.map((e) => {
    let host: string | null = null;
    let isTest = false;
    let fromTracker = false;
    try {
      const pl = e.payload ? JSON.parse(e.payload) : {};
      host = typeof pl.hostname === "string" ? pl.hostname : null;
      isTest = pl.source === "qa-panel" || pl.url === "/sendloom-test" || pl.pageType === "test";
      fromTracker = pl.source === "tracker";
    } catch {}
    return {
      id: e.id,
      occurredAt: e.occurredAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      storeId: e.storeId,
      storeName: e.store?.name ?? null,
      type: e.type,
      who: e.contact ? [e.contact.firstName, e.contact.lastName].filter(Boolean).join(" ") || e.contact.email : null,
      anonymousId: e.anonymousId,
      payload: e.payload,
      host,
      kind: isTest ? ("test" as const) : fromTracker ? ("storefront" as const) : ("server" as const),
    };
  });
  const cartsQuiet = stats.open + stats.checkoutStarted + stats.abandoned + stats.abandonedCheckout + stats.converted + stats.recovered === 0;

  const funnelCounts = await Promise.all(
    ["product_viewed", "cart_add", "checkout_started", "purchase_completed"].map((t) =>
      db.event.count({ where: { workspaceId: wsId, type: t } })
    )
  );

  return (
    <Shell
      title="Store Tracking QA"
      subtitle="Live events, cart lifecycle and store connections · install checks for MyoTech and Novatec"
      actions={<div className="flex items-center gap-2"><LiveRefresh /><TrackingTestButtons /></div>}
    >
      {/* Stores */}
      <Card>
        <CardHeader
          title="Connected stores"
          subtitle={showKeys ? "API keys visible to owner only · paste into the WordPress plugin" : "Keys are owner-only · ask Steve for install credentials"}
          action={canDownload ? (
            <a href="/api/admin/plugin-zip" className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
              Download plugin ZIP
            </a>
          ) : undefined}
        />
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[860px]">
          <thead className="border-b border-line">
            <tr>
              <Th>Store</Th><Th>Environment</Th><Th>Status</Th>
              <Th>Tracking ID (public)</Th>{showKeys && <Th>API key (secret)</Th>}
              {showKeys && <Th>Install details</Th>}
              <Th className="text-right">Last event</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stores.map((s) => (
              <tr key={s.id} className="hover:bg-[#fafaf8]">
                <Td>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-ink-3">Storefront: <b>{s.url}</b> · plugin {s.pluginVersion ?? "not installed"}</p>
                  <p className="text-xs text-ink-3">Tracks: {s.domains || "any"}{s.backendDomains ? <> · rejects: <span className="text-red-700">{s.backendDomains}</span></> : null}</p>
                </Td>
                <Td><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{s.environment}</span></Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {s.status}
                  </span>
                </Td>
                <Td><code className="text-xs">{s.publicId}</code></Td>
                {showKeys && <Td><code className="text-xs">{s.apiKey}</code></Td>}
                {showKeys && (
                  <Td>
                    <div className="flex gap-1.5">
                      <CopyButton small label="Copy key" text={s.apiKey} />
                      <CopyButton
                        small
                        label="Copy install details"
                        text={`Sendloom · ${s.name} plugin install\nSendloom URL: https://sendloom.onrender.com\nAPI key (paste into WooCommerce → Sendloom on ${s.name} ONLY): ${s.apiKey}\nTracking ID (fills in automatically): ${s.publicId}\nNever paste this key into any other store's plugin.`}
                      />
                    </div>
                  </Td>
                )}
                <Td className="text-right text-xs text-ink-2">{s.lastEventAt ? s.lastEventAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}</Td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <p className="border-t border-line px-5 py-3 text-[13px] leading-relaxed text-ink-2">
          To connect a WooCommerce store: download the Sendloom plugin ZIP, upload it to WordPress, activate it, paste
          the store's key, then send a test event. <b>No coding needed.</b> Install on staging first if available. Use
          the MyoTech key only on MyoTech and the Novatec key only on Novatec.
        </p>
      </Card>

      {/* Install steps */}
      <Card className="mt-4">
        <CardHeader
          title="Install Sendloom on WordPress/WooCommerce"
          subtitle="Ten steps, then this page fills with real events · full 18-step version on Ads Launch"
          action={<a href="/launch" className="rounded-lg border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-2 hover:bg-[#f0efec]">Open install guide</a>}
        />
        <ol className="grid grid-cols-1 gap-x-8 gap-y-2 px-5 py-4 sm:grid-cols-2">
          {[
            "Download the plugin ZIP (button above)",
            "Open WordPress Admin (wp-admin)",
            "Plugins → Add New → Upload Plugin",
            "Upload sendloom-woocommerce.zip",
            "Activate the plugin",
            "Open WooCommerce → Sendloom",
            "Paste the Sendloom URL and THIS store's API key (Store ID fills in automatically)",
            "Click Save & connect, then Test connection",
            "Click Send test event",
            "Watch it appear here with Live refresh on",
          ].map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-ink-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-brand">{i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
        <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
          Once the test event appears in the stream below, product, cart and checkout events can be tested from the storefront.
        </p>
      </Card>

      {/* Funnel + cart lifecycle */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Behaviour funnel" subtitle="Live event counts across all stores" />
          <div className="px-5 py-4">
            <Funnel stages={[
              { label: "Product viewed", value: funnelCounts[0] },
              { label: "Added to cart", value: funnelCounts[1] },
              { label: "Checkout started", value: funnelCounts[2] },
              { label: "Purchase completed", value: funnelCounts[3] },
            ]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Cart lifecycle" subtitle="Live · sweeps: cart 1h, checkout 30min" />
          <dl className="space-y-2 px-5 py-4 text-sm">
            {([
              ["Open carts", stats.open],
              ["In checkout", stats.checkoutStarted],
              ["Abandoned carts", stats.abandoned],
              ["Abandoned checkouts", stats.abandonedCheckout],
              ["Converted", stats.converted],
              ["Recovered", stats.recovered],
            ] as [string, number][]).map(([k, v]) => (
              <div key={k} className="flex justify-between"><dt className="text-xs font-medium text-ink-3">{k}</dt><dd className="tabular font-semibold">{num(v)}</dd></div>
            ))}
            <div className="flex justify-between border-t border-line pt-2">
              <dt className="text-xs font-medium text-ink-3">Abandoned value</dt>
              <dd className="tabular font-semibold text-amber-700">{gbp(stats.abandonedValue)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-xs font-medium text-ink-3">Recovered revenue</dt>
              <dd className="tabular font-semibold text-emerald-700">{gbp(stats.recoveredRevenue)}</dd>
            </div>
          </dl>
          {cartsQuiet && (
            <p className="border-t border-line px-5 py-3 text-xs leading-relaxed text-ink-3">
              No carts tracked yet. A cart becomes <b>abandoned</b> after 1 hour of inactivity, an entered checkout after
              30 minutes. To test: add to cart on the storefront, enter an email at checkout, leave, then press Run sweep above.
            </p>
          )}
        </Card>
      </div>

      {/* Rejected tracking attempts */}
      <Card className="mt-4">
        <CardHeader
          title="Rejected tracking attempts"
          subtitle="Backend/API domains, admin pages and unknown origins land here with a reason, never in customer analytics"
        />
        {rejects.length === 0 ? (
          <p className="px-5 py-6 text-sm text-ink-3">
            None yet. Events from backend/API domains (for example api.myotech.store) or WordPress admin pages will be
            listed here as rejected instead of being counted as customer traffic.
          </p>
        ) : (
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[760px]">
            <thead className="border-b border-line">
              <tr><Th>When</Th><Th>Store</Th><Th>Hostname</Th><Th>Event</Th><Th>Reason</Th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rejects.map((r) => (
                <tr key={r.id}>
                  <Td className="whitespace-nowrap text-xs text-ink-3">{r.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                  <Td className="text-xs">{r.store.name}</Td>
                  <Td><code className="text-xs">{r.host}</code>{r.url && <span className="ml-1 text-[11px] text-ink-3">{r.url}</span>}</Td>
                  <Td className="text-xs">{r.eventType ?? "–"}</Td>
                  <Td className="text-xs text-red-700">{r.reason}</Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </Card>

      {/* Event stream */}
      <Card className="mt-4">
        <CardHeader title="Last 50 events" subtitle="Everything the trackers and plugins sent, newest first · filter by store and event type" />
        <TrackingEventsTable events={qaEvents} stores={stores.map((s) => ({ id: s.id, name: s.name }))} />
      </Card>
    </Shell>
  );
}
