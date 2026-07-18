import { notFound } from "next/navigation";
import { db } from "@/lib/server/db";
import { PackDetailClient, type PackView } from "@/components/pack-detail-client";

export const dynamic = "force-dynamic";

export default async function PackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pack = await db.contactPack.findUnique({ where: { id } });
  if (!pack) notFound();

  const view: PackView = {
    id: pack.id, name: pack.name, source: pack.source,
    total: pack.total, eligible: pack.eligible,
    withEmail: pack.withEmail, withPhone: pack.withPhone,
    excludedSuppressed: pack.excludedSuppressed,
    excludedUnsubscribed: pack.excludedUnsubscribed,
    excludedNoRoute: pack.excludedNoRoute,
    duplicatesRemoved: pack.duplicatesRemoved,
    suggestedUse: pack.suggestedUse,
    simulated: pack.simulated,
    created: `${pack.createdBy.split("@")[0]} · ${pack.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`,
  };
  return <PackDetailClient pack={view} />;
}
