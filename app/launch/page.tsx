import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, CardHeader } from "@/components/ui";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";

export const dynamic = "force-dynamic";

const CHECKLIST: { label: string; href: string; how: string }[] = [
  { label: "Connect MyoTech WooCommerce plugin", href: "/tracking", how: "Upload sendloom-woocommerce.zip on MyoTech, paste the MyoTech API key from Store Tracking, Save & connect." },
  { label: "Connect Novatec WooCommerce plugin", href: "/tracking", how: "Same steps with the Novatec key. Never mix the two keys." },
  { label: "Confirm tracking events are arriving", href: "/tracking", how: "Browse the storefront; events appear in Store Tracking within seconds." },
  { label: "Create your first popup", href: "/forms", how: "Pick a template (discount signup is the classic) and set it live." },
  { label: "Test popup submission", href: "/tracking", how: "Submit it yourself with a test email; a consented contact appears in Contacts." },
  { label: "Test product view tracking", href: "/tracking", how: "Open any product page on the storefront." },
  { label: "Test add-to-cart tracking", href: "/tracking", how: "Add a product to the cart." },
  { label: "Test checkout-started tracking", href: "/tracking", how: "Reach the checkout page and enter a test email." },
  { label: "Test abandoned cart detection", href: "/tracking", how: "Abandon that checkout; after 30 minutes it shows as abandoned (Store Tracking → Cart lifecycle)." },
  { label: "Create your first campaign draft", href: "/campaigns", how: "Duplicate a template. Sends stay off until we enable the provider." },
  { label: "Create your first audience from real data", href: "/segments", how: "Once contacts exist, build rules and watch the live count." },
  { label: "Review analytics after traffic starts", href: "/analytics", how: "Charts fill in from real events only. Nothing here is faked." },
];

export default async function LaunchPage() {
  const wsId = await demoWorkspaceId();
  const stores = await db.store.findMany({ where: { workspaceId: wsId }, orderBy: { name: "asc" } });

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
            <CardHeader title="Store status" />
            <ul className="divide-y divide-line">
              {stores.map((s) => (
                <li key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold">{s.name}</p>
                    <p className="text-xs text-ink-3">{s.url}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${s.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {s.status === "connected" ? "Connected" : "Plugin pending"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
              Install guide: <span className="font-semibold">docs/myotech-novatec-install.md</span> · keys in <Link href="/tracking" className="font-semibold text-brand hover:underline">Store Tracking</Link>
            </p>
          </Card>

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
