import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { demoWorkspaceId } from "@/lib/server/views";
import { currentUser } from "@/lib/server/permissions";
import { recordConsent, setDoNotContact } from "@/lib/server/consent";
import { recomputeLeadScore } from "@/lib/server/scoring";

// One contact's marketing preferences, changed from the profile.
//
// A signed-in user changing a single contact by hand is the canonical
// "legitimately changed by the business" case, so reactivation is allowed
// here; what keeps it honest is that recordConsent writes the ledger row,
// the timeline entry and the audit line with the user's name on them.

const Body = z.union([
  z.object({
    channels: z.array(z.enum(["email", "sms", "whatsapp"])).min(1).max(3),
    status: z.enum(["granted", "declined", "unknown"]),
  }),
  z.object({ doNotContact: z.boolean() }),
]);

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Not signed in" }, { status: 401 });

  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const contact = await db.contact.findFirst({ where: { id, workspaceId }, select: { id: true } });
  if (!contact) return Response.json({ ok: false }, { status: 404 });

  if ("doNotContact" in parsed.data) {
    await setDoNotContact({
      contactId: id,
      workspaceId,
      value: parsed.data.doNotContact,
      actor: user.email,
      source: `Profile change by ${user.email}`,
    });
    await recomputeLeadScore(id);
    return Response.json({ ok: true });
  }

  const status = parsed.data.status === "unknown" ? "pending" : parsed.data.status;
  const result = await recordConsent({
    contactId: id,
    workspaceId,
    changes: parsed.data.channels.map((channel) => ({ channel, status })),
    source: `Profile change by ${user.email}`,
    actor: user.email,
    evidence: "Changed on the contact profile",
    allowReactivate: true,
  });
  if (status !== "granted") await recomputeLeadScore(id);
  return Response.json({ ok: true, applied: result.applied.length });
}
