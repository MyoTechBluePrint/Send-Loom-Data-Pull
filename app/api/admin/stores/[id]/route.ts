// Owner-only store tracking-mode switch. In test mode EVERY event for the
// store lands in the test stream: visible in QA, excluded from analytics,
// carts, scoring and campaigns. Flip to live after the install checks pass.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { can, currentUser } from "@/lib/server/permissions";

const Body = z.object({ trackingMode: z.enum(["live", "test"]) });

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user || !can(user.role, "manage_users")) {
    return Response.json({ ok: false, error: "Owner access required." }, { status: 403 });
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: "trackingMode must be live or test" }, { status: 400 });

  const { id } = await ctx.params;
  const store = await db.store.update({ where: { id }, data: { trackingMode: parsed.data.trackingMode } }).catch(() => null);
  if (!store) return Response.json({ ok: false, error: "Store not found" }, { status: 404 });

  await audit(store.workspaceId, user.email, "store.tracking_mode",
    `${store.name} tracking mode set to ${parsed.data.trackingMode.toUpperCase()}${parsed.data.trackingMode === "test" ? " (events excluded from customer analytics)" : ""}`);
  return Response.json({ ok: true, trackingMode: store.trackingMode });
}
