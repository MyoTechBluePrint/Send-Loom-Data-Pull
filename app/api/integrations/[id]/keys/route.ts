// Internal (session-authed) key management for the developer portal.
// POST: create a key — the secret appears once in this response and never
// again. PATCH: rotate or disable.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";
import { createApiKey, rotateApiKey, PERMISSIONS, type Permission } from "@/lib/server/platform";

function actorOr401(req: NextRequest): string | Response {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (!actor) return Response.json({ ok: false, error: "sign in required" }, { status: 401 });
  return actor;
}

const CreateBody = z.object({
  name: z.string().min(1).max(80),
  permissions: z.array(z.enum(PERMISSIONS)).min(1),
  expiresInDays: z.number().int().min(1).max(730).optional(),
  ipAllowlist: z.string().max(300).optional(),
});

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = actorOr401(req);
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const integration = await db.integration.findUnique({ where: { id } });
  if (!integration) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const key = await createApiKey({
    workspaceId: integration.workspaceId,
    integrationId: integration.id,
    name: parsed.data.name,
    permissions: parsed.data.permissions as Permission[],
    expiresAt: parsed.data.expiresInDays ? new Date(Date.now() + parsed.data.expiresInDays * 86400_000) : null,
    ipAllowlist: parsed.data.ipAllowlist?.trim() || null,
  });
  await audit(integration.workspaceId, actor, "platform.key_created", `${parsed.data.name} for ${integration.name}`);
  return Response.json({ ok: true, key }, { status: 201 });
}

const PatchBody = z.object({ keyId: z.string().min(4), action: z.enum(["rotate", "disable", "enable"]) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = actorOr401(req);
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const key = await db.apiKey.findFirst({ where: { id: parsed.data.keyId, integrationId: id } });
  if (!key) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  if (parsed.data.action === "rotate") {
    const next = await rotateApiKey(key.id, actor);
    return Response.json({ ok: true, key: next });
  }
  const status = parsed.data.action === "disable" ? "disabled" : "active";
  await db.apiKey.update({ where: { id: key.id }, data: { status } });
  await audit(key.workspaceId, actor, `platform.key_${parsed.data.action}d`, key.name);
  return Response.json({ ok: true, status });
}
