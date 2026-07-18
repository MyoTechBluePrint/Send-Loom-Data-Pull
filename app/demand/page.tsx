import { getKeywordsView, getOpportunitiesView, getSiteSearchView } from "@/lib/server/views";
import { DemandClient } from "@/components/demand-client";

export const dynamic = "force-dynamic";

export default async function DemandPage() {
  const [keywords, opportunities, siteSearches] = await Promise.all([
    getKeywordsView(),
    getOpportunitiesView(),
    getSiteSearchView(),
  ]);
  return <DemandClient keywords={keywords} opportunities={opportunities} siteSearches={siteSearches} sectorMode="Health & Wellness" />;
}
