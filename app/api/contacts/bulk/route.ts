import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";
import { recomputeLeadScore } from "@/lib/server/scoring";

const Body = z.object({
  contactIds: z.array(z.string()).min(1).max(5000),
  action: z.enum(["add_tag", "create_task", "suppress"]),
  tag: z.string().max(60).optional(),
  taskType: z.string().max(80).optional(),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const { contactIds, action } = parsed.data;
  const contacts = await db.contact.findMany({ where: { id: { in: contactIds }, workspaceId } });
  let affected = 0;

  if (action === "add_tag" && parsed.data.tag) {
    const tag = await db.tag.upsert({
      where: { workspaceId_name: { workspaceId, name: parsed.data.tag } },
      create: { workspaceId, name: parsed.data.tag }, update: {},
    });
    for (const c of contacts) {
      await db.contactTag.upsert({
        where: { contactId_tagId: { contactId: c.id, tagId: tag.id } },
        create: { contactId: c.id, tagId: tag.id }, update: {},
      });
      affected++;
    }
    await audit(workspaceId, user.email, "contacts.bulk_tagged", `'${parsed.data.tag}' on ${affected} contacts`);
  }

  if (action === "create_task") {
    for (const c of contacts) {
      await db.salesTask.create({
        data: {
          workspaceId, contactId: c.id,
          contactLabel: [c.firstName, c.lastName].filter(Boolean).join(" ") || c.email || c.phone || "Unknown",
          type: parsed.data.taskType ?? "Follow up", priority: "medium",
          source: "manual", assigneeLabel: "Unassigned",
          dueAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });
      affected++;
    }
    await audit(workspaceId, user.email, "contacts.bulk_tasks", `${affected} '${parsed.data.taskType ?? "Follow up"}' tasks created`);
  }

  if (action === "suppress") {
    for (const c of contacts) {
      if (c.email) {
        await db.suppressionRecord.upsert({
          where: { workspaceId_email: { workspaceId, email: c.email } },
          create: { workspaceId, email: c.email, reason: "manual", detail: `Bulk suppressed by ${user.email} (staging)` },
          update: { reason: "manual" },
        });
      }
      await db.consentRecord.create({
        data: { contactId: c.id, channel: "email", status: "suppressed", lawfulBasis: "Bulk archived on staging", actor: user.email },
      });
      await recomputeLeadScore(c.id);
      affected++;
    }
    await audit(workspaceId, user.email, "contacts.bulk_suppressed", `${affected} contacts archived/suppressed`);
  }

  return Response.json({ ok: true, affected });
}
