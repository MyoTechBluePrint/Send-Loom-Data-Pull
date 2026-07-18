import { getImportBatchesView } from "@/lib/server/views";
import { ImportsClient } from "@/components/imports-client";

export const dynamic = "force-dynamic";

export default async function ImportsPage() {
  const batches = await getImportBatchesView();
  return <ImportsClient batches={batches} />;
}
