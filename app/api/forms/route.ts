// Create a form. The builder UI posts here; new forms start as drafts so
// nothing reaches a storefront until someone deliberately sets it live.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { demoWorkspaceId } from "@/lib/server/views";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/server/auth";

const Body = z.object({
  name: z.string().min(1).max(140),
  type: z.enum(["popup", "exit_intent"]).default("popup"),
  headline: z.string().max(140).optional(),
  body: z.string().max(400).optional(),
  buttonLabel: z.string().max(60).optional(),
  consentLabel: z.string().max(200).optional(),
  successMessage: z.string().max(200).optional(),
  offerCode: z.string().max(40).optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  collectName: z.boolean().optional(),
  triggerKind: z.enum(["time_on_page", "exit_intent", "scroll"]).optional(),
  triggerSeconds: z.number().int().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const actor = verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value) ?? "unknown";
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });

  const workspaceId = await demoWorkspaceId();
  const d = parsed.data;
  const form = await db.form.create({
    data: {
      workspaceId,
      name: d.name,
      type: d.type,
      status: "draft",
      trigger: d.triggerKind === "exit_intent" ? "On exit intent" : d.triggerKind === "scroll" ? "At 50% scroll" : `After ${d.triggerSeconds ?? 8}s on page`,
      headline: d.headline,
      body: d.body,
      buttonLabel: d.buttonLabel,
      consentLabel: d.consentLabel,
      successMessage: d.successMessage,
      offerCode: d.offerCode,
      accent: d.accent,
      collectName: d.collectName ?? false,
      triggerKind: d.triggerKind ?? "time_on_page",
      triggerSeconds: d.triggerSeconds ?? 8,
    },
  });
  await audit(workspaceId, actor, "form.created", `'${d.name}'`);
  return Response.json({ ok: true, id: form.id });
}
