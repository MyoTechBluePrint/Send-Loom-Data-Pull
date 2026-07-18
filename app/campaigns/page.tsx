import { getCampaignsView } from "@/lib/server/views";
import { CampaignsClient } from "@/components/campaigns-client";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const campaigns = await getCampaignsView();
  return <CampaignsClient campaigns={campaigns} />;
}
