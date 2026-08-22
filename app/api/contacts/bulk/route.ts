import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";
import { recomputeLeadScore } from "@/lib/server/scoring";
import { recordConsent, setDoNotContact } from "@/lib/server/consent";

const Body = z.object({
  contactIds: z.array(z.string()).min(1).max(5000),
  action: z.enum(["add_tag", "create_task", "suppress", "set_consent", "set_dnc"]),
  tag: z.string().max(60).optional(),
  taskType: z.string().max(80).optional(),
  // set_consent: which channels, and what to set them to. "unknown" means
  // "we know nothing" and is stored honestly as a pending row.
  channels: z.array(z.enum(["email", "sms", "whatsapp"])).min(1).max(3).optional(),
  status: z.enum(["granted", "declined", "unknown"]).optional(),
  // set_dnc
  value: z.boolean().optional(),
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

  if (action === "set_consent" && parsed.data.channels && parsed.data.status) {
    // The bulk review workflow: hundreds of contacts, three channels, one
    // decision. Applied through the one consent door per contact so the
    // ledger, the mirror, the timeline and the audit stay one story; a
    // manual decision by a signed-in user is allowed to bring an opted-out
    // contact back, which is exactly the "legitimately changed" rule.
    const status = parsed.data.status === "unknown" ? "pending" : parsed.data.status;
    const changes = parsed.data.channels.map((channel) => ({ channel, status: status as "granted" | "declined" | "pending" }));
    let held = 0;
    for (const c of contacts) {
      const result = await recordConsent({
        contactId: c.id,
        workspaceId,
        changes,
        source: `Bulk update by ${user.email}`,
        actor: user.email,
        evidence: parsed.data.status === "unknown" ? "Marked unknown in bulk review" : "Bulk consent review",
        allowReactivate: true,
      });
      if (result.applied.length) affected++;
      if (result.held.length) held++;
      if (status !== "granted") await recomputeLeadScore(c.id);
    }
    await audit(
      workspaceId, user.email, "contacts.bulk_consent",
      `${parsed.data.channels.join("+")} → ${parsed.data.status} on ${affected} contacts`,
    );
    return Response.json({ ok: true, affected, held });
  }

  if (action === "set_dnc" && parsed.data.value !== undefined) {
    for (const c of contacts) {
      const done = await setDoNotContact({
        contactId: c.id,
        workspaceId,
        value: parsed.data.value,
        actor: user.email,
        source: `Bulk update by ${user.email}`,
      });
      if (done) affected++;
      await recomputeLeadScore(c.id);
    }
    await audit(
      workspaceId, user.email,
      parsed.data.value ? "contacts.bulk_dnc_on" : "contacts.bulk_dnc_off",
      `${affected} contacts`,
    );
    return Response.json({ ok: true, affected });
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
      await recordConsent({
        contactId: c.id,
        workspaceId,
        changes: [{ channel: "email", status: "suppressed" }],
        source: "Bulk archived on staging",
        actor: user.email,
        allowReactivate: true,
        quiet: true,
      });
      await recomputeLeadScore(c.id);
      affected++;
    }
    await audit(workspaceId, user.email, "contacts.bulk_suppressed", `${affected} contacts archived/suppressed`);
  }

  return Response.json({ ok: true, affected });
}
