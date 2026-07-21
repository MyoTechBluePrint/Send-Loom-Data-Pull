// Internal (session-authed) webhook endpoint management for the portal.
import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { dispatchPlatformEvent, retryDueWebhooks } from "@/lib/server/platform";

function actorOr401(req: NextRequest): string | Response {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!actor) return Response.json({ ok: false, error: "sign in required" }, { status: 401 });
  return actor;
}

const CreateBody = z.object({
  url: z.string().url().max(300),
  events: z.array(z.string().min(1).max(80)).min(1).max(30),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = actorOr401(req);
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const integration = await db.integration.findUnique({ where: { id } });
  if (!integration) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const secret = `whsec_${randomBytes(24).toString("hex")}`;
  const endpoint = await db.webhookEndpoint.create({
    data: {
      workspaceId: integration.workspaceId,
      integrationId: integration.id,
      url: parsed.data.url,
      secret,
      events: JSON.stringify(parsed.data.events),
    },
  });
  await audit(integration.workspaceId, actor, "platform.webhook_created", parsed.data.url);
  return Response.json({ ok: true, endpoint: { id: endpoint.id, url: endpoint.url, secret } }, { status: 201 });
}

const PatchBody = z.object({
  endpointId: z.string().min(4),
  action: z.enum(["enable", "disable", "delete", "test", "retry_due"]),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = actorOr401(req);
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const integration = await db.integration.findUnique({ where: { id } });
  if (!integration) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  if (parsed.data.action === "test") {
    const sent = await dispatchPlatformEvent(integration.workspaceId, "webhook.test", { integration: integration.slug, note: "Test delivery from the Sendloom portal" });
    return Response.json({ ok: true, sent });
  }
  if (parsed.data.action === "retry_due") {
    const retried = await retryDueWebhooks();
    return Response.json({ ok: true, retried });
  }

  const endpoint = await db.webhookEndpoint.findFirst({ where: { id: parsed.data.endpointId, integrationId: id } });
  if (!endpoint) return Response.json({ ok: false, error: "endpoint not found" }, { status: 404 });

  if (parsed.data.action === "delete") {
    await db.webhookDelivery.deleteMany({ where: { endpointId: endpoint.id } });
    await db.webhookEndpoint.delete({ where: { id: endpoint.id } });
    await audit(integration.workspaceId, actor, "platform.webhook_deleted", endpoint.url);
    return Response.json({ ok: true, deleted: true });
  }
  const status = parsed.data.action === "enable" ? "active" : "disabled";
  await db.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: { status, ...(status === "active" ? { failCount: 0 } : {}) },
  });
  await audit(integration.workspaceId, actor, `platform.webhook_${parsed.data.action}d`, endpoint.url);
  return Response.json({ ok: true, status });
}
