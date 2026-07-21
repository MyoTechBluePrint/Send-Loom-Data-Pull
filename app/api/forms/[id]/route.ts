// Update or delete one form. Status changes are the on/off switch for the
// storefront: live forms reach trackers within their 5-minute config cache.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({
  name: z.string().min(1).max(140).optional(),
  type: z.enum(["popup", "exit_intent"]).optional(),
  status: z.enum(["draft", "live", "paused"]).optional(),
  headline: z.string().max(140).nullable().optional(),
  body: z.string().max(400).nullable().optional(),
  buttonLabel: z.string().max(60).nullable().optional(),
  consentLabel: z.string().max(200).nullable().optional(),
  successMessage: z.string().max(200).nullable().optional(),
  offerCode: z.string().max(40).nullable().optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
  collectName: z.boolean().optional(),
  triggerKind: z.enum(["time_on_page", "exit_intent", "scroll"]).optional(),
  triggerSeconds: z.number().int().min(1).max(120).optional(),
});

async function ownedForm(id: string) {
  const workspaceId = await demoWorkspaceId();
  const form = await db.form.findFirst({ where: { id, workspaceId } });
  return { workspaceId, form };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const { workspaceId, form } = await ownedForm(id);
  if (!form) return Response.json({ ok: false, error: "not found" }, { status: 404 });

  const d = parsed.data;
  const triggerKind = d.triggerKind ?? form.triggerKind;
  const triggerSeconds = d.triggerSeconds ?? form.triggerSeconds;
  const updated = await db.form.update({
    where: { id: form.id },
    data: {
      ...d,
      // A configured form is no longer a seeded template row.
      isDemo: false,
      trigger: triggerKind === "exit_intent" ? "On exit intent" : triggerKind === "scroll" ? "At 50% scroll" : `After ${triggerSeconds}s on page`,
    },
  });
  if (d.status && d.status !== form.status) {
    await audit(workspaceId, actor, "form.status_changed", `'${form.name}' → ${d.status}`);
  } else {
    await audit(workspaceId, actor, "form.updated", `'${form.name}'`);
  }
  return Response.json({ ok: true, id: updated.id, status: updated.status });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const { id } = await ctx.params;
  const { workspaceId, form } = await ownedForm(id);
  if (!form) return Response.json({ ok: false, error: "not found" }, { status: 404 });
  await db.form.delete({ where: { id: form.id } });
  await audit(workspaceId, actor, "form.deleted", `'${form.name}'`);
  return Response.json({ ok: true });
}
