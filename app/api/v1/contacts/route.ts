// /api/v1/contacts — the platform's contact surface.
// GET: list/search (contacts:read). POST: upsert by email (contacts:write)
// with optional attribution and consent, all audited, all webhook-fanned.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { requireApiKey, ok, dispatchPlatformEvent } from "@/lib/server/platform";

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req, "contacts:read");
  if (auth instanceof Response) return auth;

  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase();
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 25) || 25, 100);

  const contacts = await db.contact.findMany({
    where: { workspaceId: auth.workspaceId, ...(email ? { email } : {}) },
    orderBy: { lastActivityAt: "desc" },
    take: limit,
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true,
      country: true, lastActivityAt: true, createdAt: true, ordersCount: true, revenue: true,
    },
  });
  return ok({ contacts, count: contacts.length }, auth.requestId);
}

const ContactBody = z.object({
  email: z.string().email(),
  firstName: z.string().max(80).optional(),
  lastName: z.string().max(80).optional(),
  phone: z.string().max(40).optional(),
  country: z.string().max(60).optional(),
  attribution: z.object({
    source: z.string().max(120).optional(),
    referralCode: z.string().max(60).optional(),
    ibId: z.string().max(60).optional(),
    campaign: z.string().max(120).optional(),
    utmSource: z.string().max(120).optional(),
    utmMedium: z.string().max(120).optional(),
    utmCampaign: z.string().max(120).optional(),
    utmContent: z.string().max(120).optional(),
    utmTerm: z.string().max(120).optional(),
    landingPage: z.string().max(300).optional(),
  }).optional(),
  consent: z.object({
    channel: z.enum(["email", "sms"]).default("email"),
    status: z.enum(["granted", "revoked"]),
    wording: z.string().max(400).optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req, "contacts:write");
  if (auth instanceof Response) return auth;

  const parsed = ContactBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten(), requestId: auth.requestId }, { status: 400 });
  }
  const d = parsed.data;
  const email = d.email.trim().toLowerCase();
  const existing = await db.contact.findUnique({
    where: { workspaceId_email: { workspaceId: auth.workspaceId, email } },
  });

  const fields = {
    ...(d.firstName !== undefined ? { firstName: d.firstName } : {}),
    ...(d.lastName !== undefined ? { lastName: d.lastName } : {}),
    ...(d.phone !== undefined ? { phone: d.phone } : {}),
    ...(d.country !== undefined ? { country: d.country } : {}),
    lastActivityAt: new Date(),
  };

  const contact = existing
    ? await db.contact.update({ where: { id: existing.id }, data: fields })
    : await db.contact.create({ data: { workspaceId: auth.workspaceId, email, ...fields } });

  if (!existing) {
    await db.contactSource.create({
      data: {
        contactId: contact.id,
        source: `Integration: ${auth.integrationSlug}`,
        sourceType: "api",
        detail: d.attribution?.source ?? d.attribution?.campaign ?? undefined,
      },
    });
  }
  if (d.attribution) {
    await db.event.create({
      data: {
        workspaceId: auth.workspaceId, contactId: contact.id, type: "integration_event",
        payload: JSON.stringify({ name: `${auth.integrationSlug}.attribution.set`, integration: auth.integrationSlug, ...d.attribution }),
        occurredAt: new Date(), stream: "server",
        sourceContext: `integration:${auth.integrationSlug}`, acceptReason: "integration api key",
      },
    });
  }
  if (d.consent) {
    await db.consentRecord.create({
      data: {
        contactId: contact.id,
        channel: d.consent.channel,
        status: d.consent.status,
        lawfulBasis: d.consent.wording ? "Consent (integration, wording supplied)" : "Consent (integration)",
        evidence: d.consent.wording ?? `via ${auth.integrationSlug} API`,
        actor: `integration:${auth.integrationSlug}`,
      },
    });
    await dispatchPlatformEvent(auth.workspaceId, "consent.updated", {
      contactId: contact.id, email, channel: d.consent.channel, status: d.consent.status, integration: auth.integrationSlug,
    });
  }

  await audit(auth.workspaceId, `integration:${auth.integrationSlug}`, existing ? "platform.contact_updated" : "platform.contact_created", email);
  await dispatchPlatformEvent(auth.workspaceId, existing ? "contact.updated" : "contact.created", {
    contactId: contact.id, email, integration: auth.integrationSlug,
  });

  return ok({ contact: { id: contact.id, email, created: !existing } }, auth.requestId, existing ? 200 : 201);
}
