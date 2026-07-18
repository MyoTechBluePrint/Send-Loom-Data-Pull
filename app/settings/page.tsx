"use client";

import { useState } from "react";
import { Shell, PrimaryButton, GhostButton } from "@/components/shell";
import { Card, CardHeader, Badge } from "@/components/ui";
import { deliverability, store } from "@/lib/data";

const tabs = ["Store connection", "Sending & deliverability", "Team", "Billing", "API & webhooks", "Compliance"] as const;

export default function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]>("Store connection");

  return (
    <Shell title="Settings" subtitle="Workspace: Vitalis Wellness & Longevity">
      <div className="mb-4 rounded-xl border border-line bg-surface px-5 py-4 shadow-[0_1px_2px_rgba(11,11,11,0.04)]">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-3">Your access · staging worker account</p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
          You can test workflows, add demo data, run imports, approve inbox items, create audiences, draft campaigns and manage sales tasks.
          Live sending, billing changes, workspace deletion, production providers and secrets are disabled for everyone on staging.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {["Test imports ✓", "Demo contacts ✓", "Audiences ✓", "Sales tasks ✓", "Draft campaigns ✓", "Dashboards ✓"].map((c) => (
            <span key={c} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">{c}</span>
          ))}
          {["Live sending ✕", "Billing ✕", "Delete workspace ✕", "Production secrets ✕"].map((c) => (
            <span key={c} className="rounded-full bg-[#f0efec] px-2.5 py-1 text-[11px] font-semibold text-ink-3">{c}</span>
          ))}
        </div>
      </div>
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-line bg-surface p-1">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3.5 py-2 text-[13px] font-semibold transition-colors ${
              tab === t ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-[#f0efec]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Store connection" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="WooCommerce store" action={<Badge value="connected" />} />
            <dl className="space-y-3 px-5 py-4 text-sm">
              {[
                ["Store", `${store.name} · ${store.url}`],
                ["Platform", store.platform],
                ["Plugin", store.plugin],
                ["Last sync", store.lastSync],
                ["Synced contacts", store.contacts.toLocaleString("en-GB")],
                ["Synced orders", store.syncedOrders.toLocaleString("en-GB")],
                ["Synced products", store.syncedProducts.toLocaleString("en-GB")],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-xs font-medium text-ink-3">{k}</dt>
                  <dd className="text-right font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="flex gap-2 border-t border-line px-5 py-4">
              <GhostButton>Run manual sync</GhostButton>
              <GhostButton>View error log</GhostButton>
            </div>
          </Card>
          <Card>
            <CardHeader title="Real-time events" subtitle="Webhooks from the Sendloom Connect plugin" />
            <ul className="divide-y divide-line text-[13px]">
              {[
                ["product.viewed", "2 seconds ago", "healthy"],
                ["cart.updated", "14 seconds ago", "healthy"],
                ["checkout.started", "1 minute ago", "healthy"],
                ["order.completed", "2 minutes ago", "healthy"],
                ["customer.created", "9 minutes ago", "healthy"],
                ["newsletter.signup", "11 minutes ago", "healthy"],
              ].map(([ev, t]) => (
                <li key={ev} className="flex items-center justify-between px-5 py-2.5">
                  <code className="text-xs font-semibold text-ink-2">{ev}</code>
                  <span className="flex items-center gap-2 text-xs text-ink-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> last event {t}
                  </span>
                </li>
              ))}
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-ink-3">Median event latency: 1.8s · queue depth: 0</p>
          </Card>
        </div>
      )}

      {tab === "Sending & deliverability" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Sending infrastructure" />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="flex justify-between"><span className="text-xs font-medium text-ink-3">Provider</span><span className="font-medium">{deliverability.provider}</span></div>
              <div className="flex justify-between"><span className="text-xs font-medium text-ink-3">Sending domain</span><code className="text-xs font-semibold">{deliverability.domain}</code></div>
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-ink-3">SPF</span><Badge value="pass" /></div>
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-ink-3">DKIM</span><Badge value="pass" /></div>
              <div className="flex items-center justify-between"><span className="text-xs font-medium text-ink-3">DMARC</span><Badge value="pass" /></div>
              <p className="border-t border-line pt-3 text-xs text-ink-3">
                Bring your own provider (SendGrid, Mailgun, Postmark, SparkPost, SMTP) or stay on managed sending.
              </p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Reputation" subtitle="Rolling 30 days" />
            <div className="px-5 py-4">
              <div className="flex items-end gap-2">
                <p className="tabular text-4xl font-semibold">{deliverability.reputation}</p>
                <p className="pb-1 text-sm text-ink-3">/ 100</p>
              </div>
              <div className="mt-3 h-2 w-full rounded-full bg-[#f0efec]">
                <div className="h-2 rounded-full bg-[#0ca30c]" style={{ width: `${deliverability.reputation}%` }} />
              </div>
              <dl className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between"><dt className="text-xs font-medium text-ink-3">Bounce rate</dt><dd className="tabular font-medium">{deliverability.bounceRate}%</dd></div>
                <div className="flex justify-between"><dt className="text-xs font-medium text-ink-3">Complaint rate</dt><dd className="tabular font-medium">{deliverability.complaintRate}%</dd></div>
                <div className="flex justify-between"><dt className="text-xs font-medium text-ink-3">Suppression list</dt><dd className="tabular font-medium">612 contacts · automatic</dd></div>
              </dl>
            </div>
          </Card>
        </div>
      )}

      {tab === "Team" && (
        <Card>
          <CardHeader title="Members & roles" action={<PrimaryButton>Invite member</PrimaryButton>} />
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[520px]">
            <tbody className="divide-y divide-line text-sm">
              {[
                ["Steve Clark", "steve@vitaliswellness.co.uk", "Owner", "2FA on"],
                ["Hannah Morris", "hannah@vitaliswellness.co.uk", "Marketing Manager", "2FA on"],
                ["Studio North", "hello@studionorth.co", "Content Editor", "2FA off"],
                ["Finance shared", "accounts@vitaliswellness.co.uk", "Viewer", "2FA on"],
              ].map(([n, e, r, tfa]) => (
                <tr key={e as string} className="hover:bg-[#fafaf8]">
                  <td className="px-5 py-3">
                    <p className="font-medium">{n}</p>
                    <p className="text-xs text-ink-3">{e}</p>
                  </td>
                  <td className="px-5 py-3"><span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand">{r}</span></td>
                  <td className="px-5 py-3 text-right text-xs text-ink-2">{tfa}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">Roles: Owner, Admin, Marketing Manager, Content Editor, Viewer + custom permissions. All actions audit-logged.</p>
        </Card>
      )}

      {tab === "Billing" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            { name: "Starter", price: "£29/mo", desc: "Up to 5,000 contacts · 50k sends", current: false },
            { name: "Professional", price: "£79/mo", desc: "Up to 25,000 contacts · 150k sends · A/B testing, full automations", current: true },
            { name: "Enterprise", price: "Custom", desc: "Unlimited · dedicated IPs · IP restrictions · SLA", current: false },
          ].map((p) => (
            <Card key={p.name} className={`px-5 py-5 ${p.current ? "ring-2 ring-brand" : ""}`}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{p.name}</p>
                {p.current && <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">Current</span>}
              </div>
              <p className="mt-2 text-2xl font-semibold tracking-tight">{p.price}</p>
              <p className="mt-2 text-xs leading-relaxed text-ink-2">{p.desc}</p>
              <button className={`mt-4 w-full rounded-lg px-3 py-2 text-xs font-semibold ${p.current ? "border border-line text-ink-3" : "bg-brand text-white"}`}>
                {p.current ? "Manage via Stripe portal" : p.name === "Enterprise" ? "Contact sales" : "Switch plan"}
              </button>
            </Card>
          ))}
          <Card className="px-5 py-4 md:col-span-3">
            <p className="text-xs text-ink-3">Usage this cycle: <span className="font-semibold text-foreground">96,417 of 150,000 sends</span> · 18,432 of 25,000 contacts · renews 1 Aug 2026 · Stripe subscription active</p>
          </Card>
        </div>
      )}

      {tab === "API & webhooks" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="API keys" action={<GhostButton>Create key</GhostButton>} />
            <div className="space-y-3 px-5 py-4 text-sm">
              {[
                ["Production", "slm_live_••••••••••4f2a", "Full access"],
                ["Reporting only", "slm_live_••••••••••9c11", "Read: campaigns, analytics"],
              ].map(([n, k, s]) => (
                <div key={n as string} className="flex items-center justify-between rounded-lg border border-line px-3.5 py-2.5">
                  <div>
                    <p className="font-medium">{n}</p>
                    <code className="text-xs text-ink-3">{k}</code>
                  </div>
                  <span className="text-xs text-ink-2">{s}</span>
                </div>
              ))}
              <p className="text-xs text-ink-3">REST API covers subscribers, campaigns, automations, events, orders, products, lists, segments and templates. OAuth 2.0 for partner apps.</p>
            </div>
          </Card>
          <Card>
            <CardHeader title="Outbound webhooks" action={<GhostButton>Add endpoint</GhostButton>} />
            <div className="space-y-3 px-5 py-4 text-sm">
              <div className="rounded-lg border border-line px-3.5 py-2.5">
                <code className="text-xs font-semibold">https://hooks.vitaliswellness.co.uk/sendloom</code>
                <p className="mt-1 text-xs text-ink-3">Events: subscriber.created, campaign.sent, automation.completed · signed (HMAC)</p>
              </div>
              <p className="text-xs text-ink-3">Delivery retries with exponential backoff · last 100 deliveries visible with payloads.</p>
            </div>
          </Card>
        </div>
      )}

      {tab === "Compliance" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader title="Consent & GDPR" />
            <ul className="space-y-2.5 px-5 py-4 text-[13px]">
              {[
                ["Double opt-in", "On for all forms"],
                ["Consent logging", "IP + timestamp + form snapshot"],
                ["Preference centre", "Live at vitaliswellness.co.uk/preferences"],
                ["Right to erasure", "One-click, cascades to backups in 30 days"],
                ["Data export", "Per-contact JSON/CSV"],
                ["Cookie consent", "Tracking script waits for consent signal"],
              ].map(([k, v]) => (
                <li key={k} className="flex items-center justify-between gap-4">
                  <span className="font-medium">{k}</span>
                  <span className="text-right text-xs text-ink-2">{v}</span>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardHeader title="Regulations" />
            <div className="px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {["GDPR", "UK GDPR", "CAN-SPAM", "CASL"].map((r) => (
                  <span key={r} className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">✓ {r}</span>
                ))}
              </div>
              <p className="mt-4 text-xs leading-relaxed text-ink-3">
                Every email includes unsubscribe and preference links. Suppression lists are enforced at send time across campaigns and automations. Audit log retains consent history for 6 years.
              </p>
            </div>
          </Card>
        </div>
      )}
    </Shell>
  );
}
