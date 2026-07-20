import { getImportBatchesView, demoWorkspaceId } from "@/lib/server/views";
import { db } from "@/lib/server/db";
import { ImportsClient } from "@/components/imports-client";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const [batches, wsId] = await Promise.all([getImportBatchesView(), demoWorkspaceId()]);
  const folders = await db.dataFolder.findMany({
    where: { workspaceId: wsId },
    orderBy: { name: "asc" },
    include: { _count: { select: { batches: true } } },
  });
  return (
    <ImportsClient
      batches={batches}
      folders={folders.map((f) => ({ id: f.id, name: f.name, count: f._count.batches }))}
    />
  );
}
