// Plan catalogue management. Prices, limits and entitlements are data, so this
// is how they change: no deploy, no code edit.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { can, currentUser } from "@/lib/server/permissions";

export async function GET() {
  const user = await currentUser();
  if (!user || !can(user.role, "view_admin")) {
    return Response.json({ ok: false, error: "Admin access required." }, { status: 403 });
  }
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  return Response.json({
    ok: true,
    plans: plans.map((p) => ({
      id: p.id, key: p.key, name: p.name, blurb: p.blurb,
      monthlyPence: p.monthlyPence, annualPence: p.annualPence, currency: p.currency,
      entitlements: p.entitlements, recommended: p.recommended, contactSales: p.contactSales,
      visible: p.visible, sortOrder: p.sortOrder,
    })),
  });
}

const Upsert = z.object({
  key: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/, "Use lowercase letters, numbers, hyphens or underscores."),
  name: z.string().min(1).max(80),
  blurb: z.string().max(300).nullable().optional(),
  monthlyPence: z.number().int().min(0).max(10_000_000).nullable().optional(),
  annualPence: z.number().int().min(0).max(100_000_000).nullable().optional(),
  currency: z.string().length(3).default("GBP"),
  entitlements: z.string(),
  recommended: z.boolean().default(false),
  contactSales: z.boolean().default(false),
  visible: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user || !can(user.role, "change_billing")) {
    return Response.json({ ok: false, error: "Owner access required to change plans." }, { status: 403 });
  }

  const parsed = Upsert.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "Check the plan details." }, { status: 400 });
  }

  try {
    JSON.parse(parsed.data.entitlements);
  } catch {
    return Response.json({ ok: false, error: "Entitlements must be valid JSON." }, { status: 400 });
  }

  const before = await db.plan.findUnique({ where: { key: parsed.data.key } });
  const data = { ...parsed.data, blurb: parsed.data.blurb ?? null };
  const plan = await db.plan.upsert({ where: { key: data.key }, create: data, update: data });

  const ws = await db.workspace.findFirst({ select: { id: true } });
  if (ws) {
    await audit(
      ws.id, user.email,
      before ? "billing.plan_updated" : "billing.plan_created",
      `${plan.name} (${plan.key}) · ${plan.monthlyPence !== null ? `£${(plan.monthlyPence / 100).toFixed(2)}/mo` : "contact sales"} · limits: ${plan.entitlements}`
    );
  }

  return Response.json({ ok: true, plan: { key: plan.key, name: plan.name } });
}
