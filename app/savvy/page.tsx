import Link from "next/link";
import { Shell } from "@/components/shell";
import { Card, CardHeader, Donut, Funnel, HBarChart } from "@/components/ui";
import { num } from "@/lib/data";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";

export const dynamic = "force-dynamic";

// All figures on this page come from the SIMULATED Savvy Mango project seeded
// as aggregates. No real Savvy Mango records exist in this database.
const SIM = {
  total: 100_000, ready: 73_412, duplicates: 11_860, suppressed: 4_900,
  missingEmail: 8_321, invalidPhone: 1_507, needsReview: 4_567,
  emailReady: 41_800, phoneReady: 52_300, highScore: 18_400,
  locations: [
    { label: "London", value: 24_100 }, { label: "Manchester", value: 9_800 },
    { label: "Birmingham", value: 7_400 }, { label: "Edinburgh", value: 5_900 },
    { label: "Marbella / Costa del Sol", value: 4_300 },
  ],
  signals: [
    { label: "Company officer / PSC", value: 12_600 }, { label: "Prior investor activity", value: 8_900 },
    { label: "Property-linked", value: 6_100 }, { label: "Business owner", value: 14_800 },
  ],
};

export default async function SavvyPage() {
  const wsId = await demoWorkspaceId();
  const project = await db.importProject.findFirst({
    where: { workspaceId: wsId, simulated: true, name: { contains: "Savvy Mango" } },
  });

  return (
    <Shell
      title="Savvy Mango Data Vault"
      subtitle="Sister-company data stays labelled, separated and consent-gated · everything below is SIMULATED demo data"
      actions={<Link href="/imports" className="rounded-lg bg-[#6d28d9] px-3.5 py-2 text-[13px] font-semibold text-white shadow-sm hover:bg-[#5b21b6]">Import a real export →</Link>}
    >
      <div className="mb-4 rounded-lg border border-zinc-300 bg-zinc-100 px-4 py-3 text-[13px] font-semibold text-zinc-700">
        PARKED — Savvy Mango import is on hold at the ads team's request. This page is an archived preview, not part of the launch workspace. No Savvy data will be imported for now.
      </div>
      <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] leading-relaxed text-amber-800">
        <b>Simulated.</b> These aggregates show what a ~100k Savvy Mango import looks like; no real records exist here.
        Before importing real Savvy Mango personal data: lawful-basis and consent review (it was collected by a different company for a different purpose),
        plus the production checklist in STAGING.md. The import path enforces source tagging, dedupe and contactability gates either way.
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[
          ["Records in export", num(SIM.total), "raw rows"],
          ["Ready after cleaning", num(SIM.ready), `${Math.round((SIM.ready / SIM.total) * 100)}% usable`],
          ["High-score prospects", num(SIM.highScore), "investor/owner signals"],
          ["Unusable", num(SIM.suppressed + SIM.invalidPhone), `${num(SIM.suppressed)} suppressed · ${num(SIM.invalidPhone)} invalid`],
        ].map(([k, v, d]) => (
          <Card key={k as string} className="px-5 py-4">
            <p className="text-xs font-medium text-ink-3">{k}</p>
            <p className="tabular mt-1.5 text-2xl font-semibold">{v}</p>
            <p className="mt-1 text-xs text-ink-3">{d}</p>
          </Card>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="Raw to campaign-ready funnel" subtitle="Where records drop out and why · simulated" />
          <div className="px-5 py-4">
            <Funnel stages={[
              { label: "Raw records", value: SIM.total },
              { label: "After duplicate removal", value: SIM.total - SIM.duplicates },
              { label: "Cleaned & valid", value: SIM.ready },
              { label: "Contactable (email or phone)", value: SIM.emailReady + SIM.phoneReady - 25_000 },
              { label: "High-score prospects", value: SIM.highScore },
            ]} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Contactability" subtitle="Simulated" />
          <div className="px-5 py-4">
            <Donut
              centreLabel="records"
              items={[
                { label: "Phone-ready", value: SIM.phoneReady, color: "var(--s1)" },
                { label: "Email-ready", value: SIM.emailReady, color: "var(--s2)" },
                { label: "Needs enrichment", value: SIM.missingEmail, color: "var(--s3)" },
                { label: "Suppressed/unusable", value: SIM.suppressed + SIM.invalidPhone, color: "#c3c2b7" },
              ]}
            />
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top locations" subtitle="Simulated" />
          <div className="px-5 py-4"><HBarChart items={SIM.locations} format={num} /></div>
        </Card>
        <Card>
          <CardHeader title="Investor / business signals" subtitle="Simulated · Companies House enrichment would confirm these" />
          <div className="px-5 py-4"><HBarChart items={SIM.signals} format={num} /></div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Actions" subtitle="Live buttons run on real data only · simulated-data actions explain themselves" />
        <div className="flex flex-wrap gap-2 px-5 py-4">
          <Link href="/imports" className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">
            Import real Savvy export (Dropzone)
          </Link>
          <Link href="/packs" className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">
            View the simulated prospect pack
          </Link>
          <Link href="/providers" className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">
            Enrichment providers (Companies House, Hunter)
          </Link>
          <span className="self-center text-xs text-ink-3">
            {project ? "Vault project seeded · aggregate-only" : "Vault project missing: run the seed top-up"}
          </span>
        </div>
      </Card>
    </Shell>
  );
}
