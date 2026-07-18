import { getSegmentsView } from "@/lib/server/views";
import { SegmentsClient } from "@/components/segments-client";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const segments = await getSegmentsView();
  return <SegmentsClient segments={segments} />;
}
