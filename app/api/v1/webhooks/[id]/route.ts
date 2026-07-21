// /api/v1/webhooks/:id — inspect deliveries, enable/disable/test, delete.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { requireApiKey, ok, dispatchPlatformEvent, retryDueWebhooks } from "@/lib/server/platform";

async function owned(integrationId: string, id: string) {
  return db.webhookEndpoint.findFirst({ where: { id, integrationId } });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req, "webhooks:manage");
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const endpoint = await owned(auth.integrationId, id);
  if (!endpoint) return Response.json({ ok: false, error: "not found", requestId: auth.requestId }, { status: 404 });
  const deliveries = await db.webhookDelivery.findMany({
    where: { endpointId: endpoint.id },
    orderBy: { createdAt: "desc" },
    take: 25,
    select: { id: true, eventType: true, status: true, attempts: true, responseCode: true, responseNote: true, createdAt: true, deliveredAt: true, nextRetryAt: true },
  });
  return ok({
    endpoint: { id: endpoint.id, url: endpoint.url, events: JSON.parse(endpoint.events), status: endpoint.status, failCount: endpoint.failCount },
    deliveries,
  }, auth.requestId);
}

const PatchBody = z.object({ action: z.enum(["enable", "disable", "test", "retry_due"]) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req, "webhooks:manage");
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const endpoint = await owned(auth.integrationId, id);
  if (!endpoint) return Response.json({ ok: false, error: "not found", requestId: auth.requestId }, { status: 404 });
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.flatten(), requestId: auth.requestId }, { status: 400 });
  }
  const action = parsed.data.action;
  if (action === "enable" || action === "disable") {
    await db.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: { status: action === "enable" ? "active" : "disabled", ...(action === "enable" ? { failCount: 0 } : {}) },
    });
    await audit(auth.workspaceId, `integration:${auth.integrationSlug}`, `platform.webhook_${action}d`, endpoint.url);
    return ok({ status: action === "enable" ? "active" : "disabled" }, auth.requestId);
  }
  if (action === "test") {
    const sent = await dispatchPlatformEvent(auth.workspaceId, "webhook.test", {
      integration: auth.integrationSlug, note: "Test delivery from Sendloom",
    });
    return ok({ sent }, auth.requestId, 202);
  }
  const retried = await retryDueWebhooks();
  return ok({ retried }, auth.requestId, 202);
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiKey(req, "webhooks:manage");
  if (auth instanceof Response) return auth;
  const { id } = await ctx.params;
  const endpoint = await owned(auth.integrationId, id);
  if (!endpoint) return Response.json({ ok: false, error: "not found", requestId: auth.requestId }, { status: 404 });
  await db.webhookDelivery.deleteMany({ where: { endpointId: endpoint.id } });
  await db.webhookEndpoint.delete({ where: { id: endpoint.id } });
  await audit(auth.workspaceId, `integration:${auth.integrationSlug}`, "platform.webhook_deleted", endpoint.url);
  return ok({ deleted: true }, auth.requestId);
}
