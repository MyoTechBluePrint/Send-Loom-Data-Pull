// Multi-step configuration for a form. PUT replaces the whole step list
// atomically — the builder always saves the full picture, so there are no
// half-edited orderings.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";

const Field = z.object({
  key: z.string().min(1).max(60),
  kind: z.enum(["email", "text", "choice", "multi_choice", "dropdown", "yes_no", "rating", "nps", "number_scale"]),
  label: z.string().min(1).max(200),
  options: z.array(z.string().max(120)).max(12).optional(),
  required: z.boolean().optional(),
  /** option value -> tag name applied when chosen */
  tagMap: z.record(z.string(), z.string()).optional(),
  /** contact property to store the answer under */
  propertyKey: z.string().max(60).optional(),
});

const Step = z.object({
  title: z.string().max(140).optional(),
  fields: z.array(Field).max(8),
  rules: z.string().default("[]"), // shared condition-engine rules, validated as JSON below
});

const Body = z.object({ steps: z.array(Step).max(10) });

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const form = await db.form.findFirst({ where: { id, workspaceId: user.workspaceId }, include: { steps: { orderBy: { order: "asc" } } } });
  if (!form) return Response.json({ ok: false, error: "Form not found." }, { status: 404 });
  return Response.json({
    ok: true,
    steps: form.steps.map((s) => ({ id: s.id, order: s.order, title: s.title, fields: s.fields, rules: s.rules })),
  });
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const { id } = await ctx.params;
  const form = await db.form.findFirst({ where: { id, workspaceId: user.workspaceId } });
  if (!form) return Response.json({ ok: false, error: "Form not found." }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the steps." }, { status: 400 });
  }
  for (const s of parsed.data.steps) {
    try { JSON.parse(s.rules); } catch {
      return Response.json({ ok: false, error: "A step's rules are not valid JSON." }, { status: 400 });
    }
  }

  await db.$transaction([
    db.formStep.deleteMany({ where: { formId: form.id } }),
    ...parsed.data.steps.map((s, i) =>
      db.formStep.create({
        data: { formId: form.id, order: i, title: s.title ?? null, fields: JSON.stringify(s.fields), rules: s.rules },
      })
    ),
  ]);

  await audit(user.workspaceId, user.email, "form.steps_saved", `'${form.name}': ${parsed.data.steps.length} step${parsed.data.steps.length === 1 ? "" : "s"}`);
  return Response.json({ ok: true, count: parsed.data.steps.length });
}
