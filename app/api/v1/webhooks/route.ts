// /api/v1/webhooks — manage this integration's webhook endpoints
// (webhooks:manage). The signing secret is returned exactly once.
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { requireApiKey, ok } from "@/lib/server/platform";

export async function GET(req: NextRequest) {
  const auth = await requireApiKey(req, "webhooks:manage");
  if (auth instanceof Response) return auth;
  const endpoints = await db.webhookEndpoint.findMany({
    where: { integrationId: auth.integrationId },
    select: { id: true, url: true, events: true, status: true, failCount: true, lastSuccessAt: true, lastFailureAt: true, createdAt: true },
  });
  return ok({ endpoints: endpoints.map((e) => ({ ...e, events: JSON.parse(e.events) })) }, auth.requestId);
}

const CreateBody = z.object({
  url: z.string().url().max(300).refine((u) => u.startsWith("https://") || u.includes("localhost") || u.includes("127.0.0.1"), "https required (localhost allowed for development)"),
  events: z.array(z.string().min(1).max(80)).min(1).max(30),
});

export async function POST(req: NextRequest) {
  const auth = await requireApiKey(req, "webhooks:manage");
  if (auth instanceof Response) return auth;
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten(), requestId: auth.requestId }, { status: 400 });
  }
  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const endpoint = await db.webhookEndpoint.create({
    data: {
      workspaceId: auth.workspaceId,
      integrationId: auth.integrationId,
      url: parsed.data.url,
      secret,
      events: JSON.stringify(parsed.data.events),
    },
  });
  await audit(auth.workspaceId, `integration:${auth.integrationSlug}`, "platform.webhook_created", parsed.data.url);
  // The one and only time the secret is shown.
  return ok({ endpoint: { id: endpoint.id, url: endpoint.url, events: parsed.data.events, secret } }, auth.requestId, 201);
}
