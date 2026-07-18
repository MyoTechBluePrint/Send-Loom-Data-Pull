import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { recomputeLeadScore } from "@/lib/server/scoring";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional().or(z.literal("")),
  tag: z.string().max(60).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Name required; email must be valid if given." }, { status: 400 });

  const { name, email, phone, tag } = parsed.data;
  if (!email && !phone) return Response.json({ ok: false, error: "Give at least an email or a phone number." }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const normEmail = email ? email.toLowerCase() : null;
  if (normEmail) {
    const existing = await db.contact.findUnique({ where: { workspaceId_email: { workspaceId, email: normEmail } } });
    if (existing) return Response.json({ ok: false, error: "A contact with this email already exists.", contactId: existing.id }, { status: 409 });
  }

  const [firstName, ...rest] = name.split(" ");
  const contact = await db.contact.create({
    data: {
      workspaceId, email: normEmail, firstName, lastName: rest.join(" ") || null,
      phone: phone || null, lastActivityAt: new Date(), confidence: 75,
    },
  });
  await db.contactSource.create({
    data: { contactId: contact.id, source: "Manual · staging", sourceType: "manual", uploadedBy: actor },
  });
  await db.consentRecord.create({
    data: { contactId: contact.id, channel: "email", status: "pending", lawfulBasis: "Manually added · no consent evidence", evidence: "Manual add", actor },
  });
  if (tag) {
    const t = await db.tag.upsert({ where: { workspaceId_name: { workspaceId, name: tag } }, create: { workspaceId, name: tag }, update: {} });
    await db.contactTag.create({ data: { contactId: contact.id, tagId: t.id } });
  }
  await db.timelineItem.create({
    data: { contactId: contact.id, type: "import", title: "Added manually", detail: `By ${actor} · staging demo contact` },
  });
  await recomputeLeadScore(contact.id);
  await audit(workspaceId, actor, "contact.created", `Manual contact '${name}'`);

  return Response.json({ ok: true, contactId: contact.id });
}
