// Settings is the page the owner opens to ask "is my store connected, is
// sending on". Every value here is read live from the database or the server
// environment; nothing is hard-coded. The old tabbed demo (fake store, fake
// access matrix, fake deliverability) is gone rather than kept alongside.
import Link from "next/link";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, CardHeader, Badge } from "@/components/ui";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";

export const dynamic = "force-dynamic";

const when = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "never";

export default async function SettingsPage() {
  const wsId = await demoWorkspaceId();
  const [workspace, stores, contactCount, memberCount, brandCount, brandSenderCount] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: wsId } }),
    db.store.findMany({ where: { workspaceId: wsId }, orderBy: { createdAt: "asc" } }),
    db.contact.count({ where: { workspaceId: wsId } }),
    // Unfiltered on purpose: the Team page lists every login the same way,
    // so the count here always matches what that page shows.
    db.user.count(),
    db.brand.count({ where: { workspaceId: wsId } }),
    db.brand.count({ where: { workspaceId: wsId, senderEmail: { not: null } } }),
  ]);

  // Real synced volumes per store, counted from the rows the plugin actually
  // delivered, never a cached or invented figure.
  const storeData = await Promise.all(
    stores.map(async (s) => ({
      store: s,
      products: await db.product.count({ where: { storeId: s.id } }),
      orders: await db.order.count({ where: { storeId: s.id } }),
    }))
  );

  // The same decision activeProvider() makes in lib/server/sending.ts, shown
  // as a status only. Key values never reach this page.
  const sendingEnabled = process.env.EMAIL_SENDING_ENABLED === "true";
  const resendReady = Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM);
  const sesReady = Boolean(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.SES_FROM_ADDRESS);
  const provider =
    sendingEnabled && resendReady
      ? { name: "Resend", state: "live", note: "Live sending is on. Campaign and automation emails really go to recipients through Resend." }
      : sendingEnabled && sesReady
        ? { name: "Amazon SES", state: "simulated", note: "SES is selected but its transport is not wired yet, so sends fail loudly rather than pretend. Set Resend keys for live sending." }
        : { name: "Dev transport", state: "simulated", note: "Sends are logged and recorded as simulated. No real email leaves until provider keys and the sending switch are set on the server." };
  const fromIdentity = process.env.RESEND_FROM ?? null;

  return (
    <Shell title="Settings" subtitle={`Workspace: ${workspace.name} · everything below is read live from the database and server environment`}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Store connection"
            subtitle="The stores this workspace is actually connected to"
            action={<Link href="/tracking"><GhostButton>Open Store Tracking</GhostButton></Link>}
          />
          <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-2">
            {storeData.map(({ store: s, products, orders }) => (
              <div key={s.id} className="rounded-xl border border-line px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[13px] font-semibold">{s.name}</p>
                  <div className="flex items-center gap-1.5">
                    {s.trackingMode === "test" && (
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-700">TEST MODE</span>
                    )}
                    <Badge value={s.status} />
                  </div>
                </div>
                <dl className="mt-3 space-y-2 text-sm">
                  {([
                    ["Storefront", s.url],
                    ["Platform", s.platform === "woocommerce" ? "WooCommerce" : s.platform],
                    ["Environment", s.environment],
                    ["Tracked domains", s.domains || "any origin"],
                    ["Plugin", s.pluginVersion ? `v${s.pluginVersion}` : "not installed"],
                    ["Synced products", products.toLocaleString("en-GB")],
                    ["Synced orders", orders.toLocaleString("en-GB")],
                    ["Last event", when(s.lastEventAt)],
                    ["Last sync", when(s.lastSyncAt)],
                  ] as [string, string][]).map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4">
                      <dt className="text-xs font-medium text-ink-3">{k}</dt>
                      <dd className="text-right text-[13px] font-medium">{v}</dd>
                    </div>
                  ))}
                  <div className="flex justify-between gap-4">
                    <dt className="text-xs font-medium text-ink-3">Tracking ID (public)</dt>
                    <dd className="text-right"><code className="text-xs">{s.publicId}</code></dd>
                  </div>
                </dl>
              </div>
            ))}
            {storeData.length === 0 && (
              <p className="text-sm text-ink-3 md:col-span-2">
                No store is connected yet. Download the plugin and connect one from the Store Tracking page.
              </p>
            )}
          </div>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
            {contactCount.toLocaleString("en-GB")} contact{contactCount === 1 ? "" : "s"} in this workspace across all sources.
            Live events, install keys, rejected tracking attempts and the full event stream are on the Store Tracking page.
          </p>
        </Card>

        <Card>
          <CardHeader title="Sending & deliverability" subtitle="The current sending state of this server" />
          <div className="space-y-3 px-5 py-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-ink-3">Provider</span>
              <span className="flex items-center gap-2 font-medium">{provider.name} <Badge value={provider.state} /></span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs font-medium text-ink-3">Default from address</span>
              {fromIdentity ? <code className="text-xs font-semibold">{fromIdentity}</code> : <span className="text-xs text-ink-3">not set</span>}
            </div>
            <p className="text-xs leading-relaxed text-ink-3">{provider.note}</p>
            <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-3">
              Per-brand sender identities are managed on the Brands page. {brandCount === 0
                ? "No brands are set up yet, so every send uses the default from address above."
                : `${brandSenderCount} of ${brandCount} brand${brandCount === 1 ? "" : "s"} define their own from address; the rest use the default above.`}{" "}
              Domain authentication (SPF, DKIM, DMARC) is managed at the provider and is not verified on this page.
            </p>
            <Link href="/brands"><GhostButton>Open Brands</GhostButton></Link>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader title="Team" action={<Link href="/team"><PrimaryButton>Open Team</PrimaryButton></Link>} />
            <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-2">
              {memberCount} login{memberCount === 1 ? "" : "s"} can access this workspace. Roles, password resets and
              disabling accounts are handled on the Team page, and every change is audited.
            </p>
          </Card>

          <Card>
            <CardHeader title="Billing" action={<Link href="/settings/billing"><PrimaryButton>Open billing</PrimaryButton></Link>} />
            <div className="px-5 py-4">
              <p className="text-[13px] leading-relaxed text-ink-2">
                Your plan, trial status, exact next payment date and amount, saved payment method, usage against your
                allowances and every invoice are on the billing page.
              </p>
              <div className="mt-3"><Link href="/plans"><GhostButton>Compare plans</GhostButton></Link></div>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
