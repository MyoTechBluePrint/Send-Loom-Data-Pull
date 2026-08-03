// Create an automation. Starts as a draft so nothing runs until it is
// deliberately set live.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { currentUser } from "@/lib/server/permissions";

const TRIGGERS = [
  "cart_abandoned", "checkout_started", "purchase_completed", "popup_submitted",
  "tag_added", "contact_created", "coupon_redeemed",
] as const;

const Body = z.object({
  name: z.string().min(1).max(120),
  trigger: z.enum(TRIGGERS),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false, error: "Sign in required." }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "Give the automation a name and a trigger." }, { status: 400 });

  const automation = await db.automation.create({
    data: {
      workspaceId: user.workspaceId,
      name: parsed.data.name,
      trigger: parsed.data.trigger,
      status: "draft",
    },
  });
  await audit(user.workspaceId, user.email, "automation.created", `'${parsed.data.name}' · trigger ${parsed.data.trigger} · draft`);
  return Response.json({ ok: true, id: automation.id });
}
