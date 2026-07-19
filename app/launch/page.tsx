import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { can, currentUser } from "@/lib/server/permissions";

export const dynamic = "force-dynamic";

// Per-store install checklist shown on this page. Kept in sync with
// docs/myotech-novatec-install.md; the doc stays the long-form version.
const INSTALL_STEPS: string[] = [
  "Log in to the store's WordPress admin (wp-admin).",
  "Go to Plugins → Add New → Upload Plugin.",
  "Upload sendloom-woocommerce.zip (owner downloads it from the button on Store Tracking).",
  "Click Install Now, then Activate.",
  "Open WooCommerce → Sendloom in the admin menu.",
  "Set Sendloom URL to https://sendloom.onrender.com",
  "Paste THIS store's API key from Store Tracking. Never paste the other store's key.",
  "Click Save & connect. Store ID and tracking ID fill in automatically on success.",
  "Check the connection box shows Connected with the store name.",
  "Click Send test event in the plugin.",
  "In Sendloom, open Store Tracking and confirm the test event appears under this store.",
  "Click Sync products, then Sync customers, then Sync orders (in that order).",
  "Open the storefront in a private window and browse a product page.",
  "Confirm a product_viewed event appears in Store Tracking within a minute.",
  "Add a product to the cart and start checkout with a test email.",
  "Confirm the cart appears in the Cart lifecycle panel.",
  "Abandon the checkout; after 30 minutes (or Run sweep) it flips to abandoned checkout.",
  "Report anything unclear via the Feedback page before moving to the next store.",
];

const CHECKLIST: { label: string; href: string; how: string }[] = [
  { label: "Connect MyoTech WooCommerce plugin", href: "/tracking", how: "Upload sendloom-woocommerce.zip on MyoTech, paste the MyoTech API key from Store Tracking, Save & connect." },
  { label: "Connect Novatec WooCommerce plugin", href: "/tracking", how: "Same steps with the Novatec key. Never mix the two keys." },
  { label: "Confirm tracking events are arriving", href: "/tracking", how: "Browse the storefront; events appear in Store Tracking within seconds." },
  { label: "Create your first popup", href: "/forms", how: "Templates are prefixed MyoTech · and Novatec ·, so pick the right store's template and set it live." },
  { label: "Test popup submission", href: "/tracking", how: "Submit it yourself with a test email; a consented contact appears in Contacts." },
  { label: "Test product view tracking", href: "/tracking", how: "Open any product page on the storefront." },
  { label: "Test add-to-cart tracking", href: "/tracking", how: "Add a product to the cart." },
  { label: "Test checkout-started tracking", href: "/tracking", how: "Reach the checkout page and enter a test email." },
  { label: "Test abandoned cart detection", href: "/tracking", how: "Abandon that checkout; after 30 minutes it shows as abandoned (Store Tracking → Cart lifecycle)." },
  { label: "Create your first campaign draft", href: "/campaigns", how: "Duplicate a template. Drafts only. Activate after tracking and the sending provider are confirmed." },
  { label: "Create your first audience from real data", href: "/segments", how: "Once contacts exist, build rules and watch the live count." },
  { label: "Review analytics after traffic starts", href: "/analytics", how: "Charts fill in from real events only. Nothing here is faked." },
];

function StatusChip({ ok, okLabel, pendingLabel }: { ok: boolean; okLabel: string; pendingLabel: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-500"}`}>
      {ok ? okLabel : pendingLabel}
    </span>
  );
}

export default async function LaunchPage() {
  const wsId = await demoWorkspaceId();
  const user = await currentUser();
  const isOwner = can(user?.role ?? "viewer", "download_plugin");

  const [stores, contacts, realCampaigns] = await Promise.all([
    db.store.findMany({ where: { workspaceId: wsId }, orderBy: { name: "asc" } }),
    db.contact.count({ where: { workspaceId: wsId } }),
    db.campaign.count({ where: { workspaceId: wsId, isDemo: false } }),
  ]);

  const CUSTOMER_TYPES = ["product_viewed", "category_viewed", "search", "cart_add", "cart_remove", "cart_updated", "checkout_started", "checkout_email_entered", "checkout_completed", "purchase_completed", "popup_submitted"];
  const storeBoards = await Promise.all(
    stores.map(async (s) => {
      const [eventCount, customerCount, testCount, abandonedCount, livePopup] = await Promise.all([
        db.event.count({ where: { storeId: s.id } }),
        // Customer behaviour = real journeys only: behaviour types, minus
        // anything tagged as a QA/plugin test event.
        db.event.count({ where: { storeId: s.id, type: { in: CUSTOMER_TYPES }, NOT: [{ payload: { contains: "qa-panel" } }, { payload: { contains: "/sendloom-test" } }] } }),
        db.event.count({ where: { storeId: s.id, OR: [{ payload: { contains: "qa-panel" } }, { payload: { contains: "/sendloom-test" } }] } }),
        db.cart.count({ where: { storeId: s.id, status: { in: ["abandoned", "abandoned_checkout"] } } }),
        db.form.findFirst({ where: { workspaceId: wsId, status: "live", name: { startsWith: s.name } } }),
      ]);
      return { store: s, eventCount, customerCount, testCount, abandonedCount, livePopup };
    })
  );

  return (
    <Shell
      title="Ads Launch"
      subtitle="Fresh launch workspace · no imported Savvy Mango data, no demo contacts, no fake revenue"
    >
      <Card className="border-brand bg-brand-soft/30 px-5 py-4">
        <p className="text-sm leading-relaxed">
          <b>This workspace is clean.</b> Data appears here only when WooCommerce, popups, uploads or ad lead forms are
          connected. Sendloom is ready to capture fresh data from MyoTech and Novatec; nothing you see will ever be
          fake numbers pretending to be performance.
        </p>
      </Card>

      {/* Per-store launch status */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {storeBoards.map(({ store: s, eventCount, customerCount, testCount, abandonedCount, livePopup }) => (
          <Card key={s.id}>
            <CardHeader
              title={s.name}
              subtitle={`Storefront: ${s.url}${s.backendDomains ? ` · backend: ${s.backendDomains} (never tracked)` : ""}`}
              action={
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  {s.status === "connected" ? "Connected" : "Plugin pending"}
                </span>
              }
            />
            <dl className="divide-y divide-line text-sm">
              {([
                ["Plugin connection", <StatusChip key="p" ok={s.status === "connected"} okLabel={`Connected · v${s.pluginVersion ?? "?"}`} pendingLabel="Not installed" />],
                ["Tracking events", <StatusChip key="t" ok={eventCount > 0} okLabel={`${eventCount} received${testCount > 0 ? ` · ${testCount} test` : ""}`} pendingLabel="No storefront events yet" />],
                ["Customer behaviour", <StatusChip key="c" ok={customerCount > 0} okLabel={`${customerCount} real events`} pendingLabel="No product/cart/checkout events yet" />],
                ["First popup", <StatusChip key="f" ok={!!livePopup} okLabel={livePopup?.name.replace(" (template)", "") ?? "Live"} pendingLabel="Templates ready · none live" />],
                ["Abandoned cart detection", <StatusChip key="a" ok={abandonedCount > 0} okLabel={`${abandonedCount} detected`} pendingLabel={eventCount > 0 ? "Armed · waiting for carts" : "Activates once tracking is live"} />],
              ] as [string, React.ReactNode][]).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-5 py-2.5">
                  <dt className="text-xs font-medium text-ink-3">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
            <details className="border-t border-line">
              <summary className="cursor-pointer px-5 py-3 text-[13px] font-bold text-brand hover:underline">
                Install checklist · {INSTALL_STEPS.length} steps
              </summary>
              <ol className="space-y-1.5 px-5 pb-4 pl-6 text-[13px] leading-relaxed text-ink-2">
                {INSTALL_STEPS.map((step, i) => (
                  <li key={i} className="list-decimal">{step}</li>
                ))}
              </ol>
            </details>
          </Card>
        ))}
      </div>

      {/* Workspace-level firsts */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-3">
          <span className="text-xs font-bold uppercase tracking-wide text-ink-3">Workspace firsts</span>
          <span className="flex items-center gap-2 text-sm"><StatusChip ok={contacts > 0} okLabel={`${contacts} contacts`} pendingLabel="First lead pending" /></span>
          <span className="flex items-center gap-2 text-sm"><StatusChip ok={realCampaigns > 0} okLabel={`${realCampaigns} real campaign draft${realCampaigns === 1 ? "" : "s"}`} pendingLabel="First campaign draft pending" /></span>
          {isOwner && (
            <a href="/api/admin/plugin-zip" className="ml-auto rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
              Download plugin ZIP
            </a>
          )}
        </div>
      </Card>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Launch setup checklist" subtitle="In order · each step links to where it happens" />
          <ol className="px-5 py-4">
            {CHECKLIST.map((c, i) => (
              <li key={i} className="flex gap-3 border-b border-line py-3 last:border-0">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <Link href={c.href} className="text-sm font-semibold hover:text-brand">{c.label} →</Link>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{c.how}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>

        <div className="space-y-4 self-start">
          <Card>
            <CardHeader title="What Sendloom is ready to do" />
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] text-ink-2">
              <li>Track every product view, cart, checkout and search</li>
              <li>Detect abandoned carts (1h) and checkouts (30min) with recovery links</li>
              <li>Capture leads with consent via popups</li>
              <li>Clean and import any file through the Dropzone</li>
              <li>Build audiences and Contact Packs from real captured data</li>
              <li>Draft campaigns now, send when the provider is enabled</li>
            </ul>
          </Card>

          <Card>
            <CardHeader title="UTM discipline" subtitle="Do this from day one" />
            <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-2">
              Tag every ad link with the <Link href="/utm-builder" className="font-semibold text-brand hover:underline">UTM Builder</Link> before it goes live.
              The tracker stores UTM parameters on every event, so attribution works from the first click, but only if the links are tagged.
            </p>
          </Card>

          <Card>
            <CardHeader title="Keep the stores separate" />
            <p className="px-5 py-4 text-[13px] leading-relaxed text-ink-2">
              MyoTech and Novatec each have their own API key, tracking ID and templates. Data never mixes: every event,
              cart and sync is tied to the store whose key sent it. If you ever see MyoTech data under Novatec (or the
              reverse), stop and report it. It means a key was pasted into the wrong plugin.
            </p>
          </Card>

          <Card>
            <CardHeader title="Feedback Stephen wants" />
            <ul className="list-disc space-y-1.5 px-5 py-4 pl-9 text-[13px] text-ink-2">
              <li>Anything unclear during plugin install</li>
              <li>Events you expected that didn't appear</li>
              <li>What's missing before you'd run real spend</li>
            </ul>
            <div className="border-t border-line px-5 py-3">
              <Link href="/feedback" className="text-[13px] font-bold text-brand hover:underline">Leave feedback →</Link>
            </div>
          </Card>
        </div>
      </div>
    </Shell>
  );
}
