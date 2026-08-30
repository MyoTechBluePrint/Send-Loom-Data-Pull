import { getCampaignsView, getPerformanceSummary, type CampaignList } from "@/lib/server/views";
import { can, currentUser } from "@/lib/server/permissions";
import { CampaignsClient } from "@/components/campaigns-client";

export const dynamic = "force-dynamic";

export default async function CampaignsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const user = await currentUser();
  const role = user?.role ?? "viewer";
  // The deleted and all lenses are oversight views: they exist so account
  // history can be inspected, so they follow the view_deleted permission.
  const canSeeDeleted = can(role, "view_deleted");
  const requested: CampaignList =
    filter === "archived" ? "archived" : filter === "deleted" ? "deleted" : filter === "all" ? "all" : "working";
  const list = (requested === "deleted" || requested === "all") && !canSeeDeleted ? "working" : requested;
  const [campaigns, summary] = await Promise.all([getCampaignsView({ list }), getPerformanceSummary()]);
  return <CampaignsClient campaigns={campaigns} list={list} canSeeDeleted={canSeeDeleted} perf={summary} />;
}
