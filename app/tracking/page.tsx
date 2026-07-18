import { Shell } from "@/components/shell";
import { Card, CardHeader, Funnel, Th, Td } from "@/components/ui";
import { gbp, num } from "@/lib/data";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { cartStats } from "@/lib/server/carts";
import { can, currentUser } from "@/lib/server/permissions";
import { TrackingTestButtons } from "@/components/tracking-test-buttons";

export const dynamic = "force-dynamic";

export default async function TrackingPage() {
  const wsId = await demoWorkspaceId();
  const user = await currentUser();
  const showKeys = can(user?.role ?? "viewer", "manage_users");

  const [stores, events, stats] = await Promise.all([
    db.store.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "asc" } }),
    db.event.findMany({
      where: { workspaceId: wsId, type: { notIn: ["imported", "consent_recorded"] } },
      orderBy: { occurredAt: "desc" }, take: 20,
      include: { contact: { select: { email: true, firstName: true, lastName: true } }, store: { select: { name: true } } },
    }),
    cartStats(),
  ]);

  const funnelCounts = await Promise.all(
    ["product_viewed", "cart_add", "checkout_started", "purchase_completed"].map((t) =>
      db.event.count({ where: { workspaceId: wsId, type: t } })
    )
  );

  return (
    <Shell
      title="Store Tracking QA"
      subtitle="Live events, cart lifecycle and store connections · install checks for MyoTech and Novatec"
      actions={<TrackingTestButtons />}
    >
      {/* Stores */}
      <Card>
        <CardHeader title="Connected stores" subtitle={showKeys ? "API keys visible to owner only · paste into the WordPress plugin" : "Keys are owner-only · ask Steve for install credentials"} />
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[860px]">
          <thead className="border-b border-line">
            <tr>
              <Th>Store</Th><Th>Environment</Th><Th>Status</Th>
              <Th>Tracking ID (public)</Th>{showKeys && <Th>API key (secret)</Th>}
              <Th className="text-right">Last event</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {stores.map((s) => (
              <tr key={s.id} className="hover:bg-[#fafaf8]">
                <Td>
                  <p className="font-medium">{s.name}</p>
                  <p className="text-xs text-ink-3">{s.url} · plugin {s.pluginVersion ?? "not installed"}</p>
                </Td>
                <Td><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{s.environment}</span></Td>
                <Td>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-600"}`}>
                    {s.status}
                  </span>
                </Td>
                <Td><code className="text-xs">{s.publicId}</code></Td>
                {showKeys && <Td><code className="text-xs">{s.apiKey}</code></Td>}
                <Td className="text-right text-xs text-ink-2">{s.lastEventAt ? s.lastEventAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never"}</Td>
              </tr>
            ))}
          </tbody>
        </table></div>
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
        </Card>
      </div>

      {/* Event stream */}
      <Card className="mt-4">
        <CardHeader title="Last 20 events" subtitle="Everything the trackers and plugins sent, newest first" />
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[820px]">
          <thead className="border-b border-line">
            <tr><Th>When</Th><Th>Store</Th><Th>Event</Th><Th>Who</Th><Th>Payload</Th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {events.map((e) => (
              <tr key={e.id} className="hover:bg-[#fafaf8]">
                <Td className="whitespace-nowrap text-xs text-ink-3">{e.occurredAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</Td>
                <Td className="text-xs">{e.store?.name ?? "–"}</Td>
                <Td><span className="rounded bg-[#f0efec] px-1.5 py-0.5 text-[11px] font-bold text-ink-2">{e.type}</span></Td>
                <Td className="text-xs">
                  {e.contact
                    ? [e.contact.firstName, e.contact.lastName].filter(Boolean).join(" ") || e.contact.email
                    : <span className="text-ink-3">anonymous{e.anonymousId ? ` · ${e.anonymousId.slice(0, 10)}` : ""}</span>}
                </Td>
                <Td className="max-w-md truncate text-[11px] text-ink-3">{e.payload ?? "–"}</Td>
              </tr>
            ))}
            {events.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-ink-3">No events yet. Use the test buttons above.</td></tr>}
          </tbody>
        </table></div>
      </Card>
    </Shell>
  );
}
