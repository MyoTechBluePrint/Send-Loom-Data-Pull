// Key-authenticated cart contents for recovery restoration: the plugin calls
// this when a visitor lands with ?sendloom_recovery=<token> and rebuilds the
// WooCommerce cart server-side.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { authenticateStore, unauthorized } from "@/lib/server/apiAuth";

export async function GET(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const store = await authenticateStore(req);
  if (!store) return unauthorized();
  const { token } = await ctx.params;

  const cart = await db.cart.findUnique({ where: { recoveryToken: token } });
  if (!cart || cart.storeId !== store.id) {
    return Response.json({ ok: false, error: "Unknown recovery token" }, { status: 404 });
  }
  return Response.json({
    ok: true,
    items: cart.items ? JSON.parse(cart.items) : [],
    total: cart.total,
    email: cart.email,
    status: cart.status,
  });
}
