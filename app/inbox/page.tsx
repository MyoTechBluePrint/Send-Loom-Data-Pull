import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { InboxClient, type IntakeItemView } from "@/components/inbox-client";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const wsId = await demoWorkspaceId();
  const items = await db.intakeItem.findMany({
    where: { workspaceId: wsId },
    include: { records: { orderBy: { createdAt: "asc" } } },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const view: IntakeItemView[] = items.map((i) => ({
    id: i.id,
    kind: i.kind,
    title: i.title,
    raw: i.raw.length > 400 ? i.raw.slice(0, 397) + "…" : i.raw,
    status: i.status,
    confidence: i.confidence,
    when: i.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short" }) + ", " +
      i.createdAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    records: i.records.map((r) => ({
      id: r.id,
      status: r.status,
      confidence: r.confidence,
      duplicateOf: r.duplicateOf,
      contactId: r.contactId,
      fields: JSON.parse(r.fields),
    })),
  }));

  return <InboxClient items={view} />;
}
