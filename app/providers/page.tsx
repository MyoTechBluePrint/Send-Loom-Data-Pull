import { Shell } from "@/components/shell";
import { Card, CardHeader, Th, Td } from "@/components/ui";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";

export const dynamic = "force-dynamic";

// Static metadata per provider; live status comes from the DataProvider table.
const META: Record<string, { cost: string; bestFor: string; limits: string }> = {
  "WooCommerce Connect": { cost: "Free", bestFor: "Customers, orders, products, live events", limits: "Store API rate limits" },
  "Amazon SES (managed)": { cost: "Pay-as-you-go", bestFor: "Email sending at scale", limits: "Sandbox until verified" },
  "Meta Lead Ads": { cost: "Free API", bestFor: "Lead form capture with consent field", limits: "Token refresh required" },
  "Google Search Console": { cost: "Free", bestFor: "First-party queries, impressions, rising keywords", limits: "16 months history" },
  "DataForSEO": { cost: "Paid · ~£12/mo current", bestFor: "Volumes, CPC, difficulty", limits: "Per-request billing" },
  "Dropcontact-style enrichment (EU)": { cost: "Paid per record", bestFor: "GDPR-aligned B2B enrichment", limits: "B2B only" },
  "HubSpot CRM": { cost: "Free tier", bestFor: "CRM contact/deal sync", limits: "API call quotas" },
  "Twilio SMS": { cost: "Paid per message", bestFor: "SMS sending (Phase 2)", limits: "Sender registration" },
  "Companies House": { cost: "Free", bestFor: "UK company, officer and PSC lookup; investor-signal confirmation", limits: "600 req / 5 min · public register data, NOT a contact finder" },
  "GOV.UK Content API": { cost: "Free", bestFor: "Regulation and policy-change monitoring for sector mode", limits: "Content only" },
  "Postcodes.io": { cost: "Free", bestFor: "UK postcode validation, region grouping, geo segments", limits: "Fair use" },
  "Google Analytics Data API": { cost: "Free", bestFor: "Traffic, conversion events, attribution", limits: "Quota per property" },
  "Hunter (free plan)": { cost: "Free tier", bestFor: "Email verification tests, small-scale finding", limits: "25 searches + 50 verifications / mo" },
  "YouTube Data API": { cost: "Free quota", bestFor: "Content demand and competitor topics", limits: "10k units/day" },
  "Reddit API": { cost: "Free tier", bestFor: "Public discussion trends, questions, objections", limits: "Respect terms · public data only" },
  "People Data Labs (test)": { cost: "Free test tier", bestFor: "Workflow testing ONLY", limits: "Not for production contact data" },
};

// Recommended connection order (opportunity ranking from the brief).
const RANKING: { name: string; value: string; difficulty: string }[] = [
  { name: "WooCommerce Connect", value: "Live behaviour + revenue truth", difficulty: "Done · plugin built" },
  { name: "Google Search Console", value: "Real demand from your own search data", difficulty: "Easy · OAuth" },
  { name: "Companies House", value: "Confirms Savvy Mango investor/company signals", difficulty: "Easy · free key" },
  { name: "Postcodes.io", value: "Geo segments for 100k-record imports", difficulty: "Trivial · no key" },
  { name: "Hunter (free plan)", value: "Email verification before outreach packs", difficulty: "Easy · free key" },
  { name: "GOV.UK Content API", value: "Sector-mode compliance monitoring", difficulty: "Easy · no key" },
  { name: "Google Analytics Data API", value: "Attribution beyond email clicks", difficulty: "Medium · OAuth" },
  { name: "YouTube Data API", value: "Content gap research for Demand Radar", difficulty: "Easy · free key" },
  { name: "Reddit API", value: "Market language and objections", difficulty: "Medium · app review" },
  { name: "People Data Labs (test)", value: "Enrichment workflow testing only", difficulty: "Easy · not production" },
];

const statusChip: Record<string, string> = {
  healthy: "bg-emerald-50 text-emerald-700",
  syncing: "bg-blue-50 text-blue-700",
  error: "bg-red-50 text-red-700",
  not_connected: "bg-zinc-100 text-zinc-600",
};

export default async function ProvidersPage() {
  const wsId = await demoWorkspaceId();
  const providers = await db.dataProvider.findMany({ where: { workspaceId: wsId }, orderBy: [{ status: "asc" }, { name: "asc" }] });
  const byType = new Map<string, typeof providers>();
  for (const p of providers) {
    const key = p.type.split("_").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
    byType.set(key, [...(byType.get(key) ?? []), p]);
  }

  return (
    <Shell
      title="API Provider Centre"
      subtitle="Every external data source is a provider · nothing hard-coded · keys live in env, never the database"
    >
      <Card>
        <CardHeader title="Connect-next ranking" subtitle="Best value first, weighted by cost and setup difficulty · free tiers prioritised" />
        <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[720px]">
          <thead className="border-b border-line">
            <tr><Th className="w-10">#</Th><Th>Provider</Th><Th>Expected value</Th><Th>Setup</Th><Th className="text-right">Status</Th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {RANKING.map((r, i) => {
              const p = providers.find((x) => x.name === r.name);
              return (
                <tr key={r.name} className="hover:bg-[#fafaf8]">
                  <Td className="tabular font-bold text-brand">{i + 1}</Td>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-xs text-ink-2">{r.value}</Td>
                  <Td className="text-xs text-ink-2">{r.difficulty}</Td>
                  <Td className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip[p?.status ?? "not_connected"]}`}>
                      {(p?.status ?? "not connected").replace("_", " ")}
                    </span>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </Card>

      {[...byType.entries()].map(([type, list]) => (
        <Card key={type} className="mt-4">
          <CardHeader title={type} />
          <div className="overflow-x-auto scroll-thin"><table className="w-full min-w-[760px]">
            <thead className="border-b border-line">
              <tr><Th>Provider</Th><Th>Cost</Th><Th>Best for</Th><Th>Limits / risk</Th><Th className="text-right">Status</Th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((p) => (
                <tr key={p.id} className="hover:bg-[#fafaf8]">
                  <Td>
                    <p className="text-[13px] font-medium">{p.name}</p>
                    {p.note && <p className="text-[11px] text-ink-3">{p.note}</p>}
                  </Td>
                  <Td className="text-xs text-ink-2">{META[p.name]?.cost ?? "–"}</Td>
                  <Td className="text-xs text-ink-2">{META[p.name]?.bestFor ?? "–"}</Td>
                  <Td className="text-xs text-ink-2">{META[p.name]?.limits ?? "–"}</Td>
                  <Td className="text-right">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusChip[p.status] ?? statusChip.not_connected}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </Card>
      ))}

      <p className="mt-4 text-xs text-ink-3">
        Connecting a provider: add its key to the environment, flip status here, and implement its sync in the provider registry (ARCHITECTURE.md). API keys are never stored in the database or repo.
      </p>
    </Shell>
  );
}
