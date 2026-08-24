import { getCampaignsView } from "@/lib/server/views";
import { CampaignsClient } from "@/components/campaigns-client";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const archived = filter === "archived";
  const campaigns = await getCampaignsView({ archived });
  return <CampaignsClient campaigns={campaigns} archived={archived} />;
}
