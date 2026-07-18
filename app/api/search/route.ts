// Global search across contacts, campaigns, audiences, tasks and keywords.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return Response.json({ ok: true, groups: [] });

  const wsId = await demoWorkspaceId();

  const [contacts, campaigns, segments, tasks, keywords] = await Promise.all([
    db.contact.findMany({
      where: {
        workspaceId: wsId,
        OR: [
          { firstName: { contains: q } }, { lastName: { contains: q } },
          { email: { contains: q } }, { phone: { contains: q } },
        ],
      },
      include: { score: true }, take: 5,
    }),
    db.campaign.findMany({ where: { workspaceId: wsId, OR: [{ name: { contains: q } }, { subject: { contains: q } }] }, take: 4 }),
    db.segment.findMany({ where: { workspaceId: wsId, name: { contains: q } }, take: 4 }),
    db.salesTask.findMany({ where: { workspaceId: wsId, OR: [{ type: { contains: q } }, { contactLabel: { contains: q } }, { note: { contains: q } }] }, take: 4 }),
    db.keyword.findMany({ where: { workspaceId: wsId, term: { contains: q } }, take: 4 }),
  ]);

  const groups = [
    {
      label: "Contacts",
      items: contacts.map((c) => ({
        title: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.phone || "Unknown",
        detail: `${c.email ?? c.phone ?? ""} · score ${c.score?.score ?? 0}`,
        href: `/subscribers/${c.id}`,
      })),
    },
    {
      label: "Campaigns",
      items: campaigns.map((c) => ({ title: c.name, detail: `${c.status}${c.subject ? ` · “${c.subject}”` : ""}`, href: `/campaigns/${c.id}` })),
    },
    {
      label: "Audiences",
      items: segments.map((s) => ({ title: s.name, detail: `${s.count} contacts`, href: "/segments" })),
    },
    {
      label: "Sales tasks",
      items: tasks.map((t) => ({ title: `${t.type} · ${t.contactLabel ?? ""}`, detail: t.status, href: "/tasks" })),
    },
    {
      label: "Keywords",
      items: keywords.map((k) => ({ title: k.term, detail: `${k.volume.toLocaleString("en-GB")}/mo · ${k.review.replace("_", " ")}`, href: "/demand" })),
    },
  ].filter((g) => g.items.length > 0);

  return Response.json({ ok: true, groups });
}
