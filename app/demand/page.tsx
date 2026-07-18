import { getKeywordsView, getOpportunitiesView, getSiteSearchView } from "@/lib/server/views";
import { DemandClient } from "@/components/demand-client";

export const dynamic = "force-dynamic";

export default async function DemandPage() {
  const [keywords, opportunities, siteSearches] = await Promise.all([
    getKeywordsView(),
    getOpportunitiesView(),
    getSiteSearchView(),
  ]);
  if (keywords.length === 0 && siteSearches.length === 0) {
    const Link = (await import("next/link")).default;
    const { Shell } = await import("@/components/shell");
    const { Card } = await import("@/components/ui");
    return (
      <Shell title="Demand Radar" subtitle="Fresh workspace · no live demand provider connected yet">
        <Card className="px-6 py-12 text-center">
          <p className="text-2xl">☄</p>
          <h2 className="mt-2 text-base font-semibold">No demand data yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-ink-2">
            Connect Google Search Console, import keyword research through the Dropzone, or let store search events accumulate once the WooCommerce plugin is live.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href="/providers" className="rounded-lg bg-brand px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#5b21b6]">Open Provider Centre</Link>
            <Link href="/imports" className="rounded-lg border border-line px-3.5 py-2 text-[13px] font-semibold text-ink-2 hover:bg-[#f0efec]">Import keyword research</Link>
          </div>
        </Card>
      </Shell>
    );
  }
  return <DemandClient keywords={keywords} opportunities={opportunities} siteSearches={siteSearches} sectorMode="Health & Wellness" />;
}
