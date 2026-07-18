import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { recomputeLeadScore } from "@/lib/server/scoring";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({
  note: z.string().max(2000).optional(),
  archive: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const contact = await db.contact.findUnique({ where: { id } });
  if (!contact) return Response.json({ ok: false, error: "Contact not found" }, { status: 404 });

  if (parsed.data.note) {
    await db.contact.update({
      where: { id },
      data: { notes: contact.notes ? `${contact.notes}\n${parsed.data.note}` : parsed.data.note },
    });
    await db.timelineItem.create({
      data: { contactId: id, type: "task", title: "Note added", detail: parsed.data.note },
    });
    await audit(contact.workspaceId, actor, "contact.note_added", `Note on ${contact.email ?? contact.phone}`);
  }

  if (parsed.data.archive) {
    // Archive = suppress. Reversible via SuppressionRecord removal; never a
    // hard delete, so ledger and audit history survive.
    if (contact.email) {
      await db.suppressionRecord.upsert({
        where: { workspaceId_email: { workspaceId: contact.workspaceId, email: contact.email } },
        create: { workspaceId: contact.workspaceId, email: contact.email, reason: "manual", detail: `Archived by ${actor} (staging)` },
        update: { reason: "manual", detail: `Archived by ${actor} (staging)` },
      });
    }
    await db.consentRecord.create({
      data: { contactId: id, channel: "email", status: "suppressed", lawfulBasis: "Archived on staging", actor },
    });
    await db.timelineItem.create({
      data: { contactId: id, type: "import", title: "Archived", detail: `Demo change by ${actor} · excluded from all sending` },
    });
    await recomputeLeadScore(id);
    await audit(contact.workspaceId, actor, "contact.archived", contact.email ?? contact.phone ?? id);
  }

  return Response.json({ ok: true });
}
