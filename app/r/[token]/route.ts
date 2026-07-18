// PUBLIC cart/checkout recovery links. Logs the click (which is what later
// marks a conversion as "recovered" rather than merely "converted") and
// redirects to the store checkout with the recovery token, where the plugin
// restores the cart contents server-side.
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { enqueue } from "@/lib/server/queue";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const cart = await db.cart.findUnique({ where: { recoveryToken: token }, include: { store: true, contact: true } });
  if (!cart) {
    return Response.redirect("https://sendloom.onrender.com/login", 302);
  }

  await enqueue({
    name: "event.ingest",
    payload: {
      workspaceId: cart.store.workspaceId,
      storeId: cart.storeId,
      type: "recovery_link_clicked",
      email: cart.contact?.email ?? cart.email ?? undefined,
      payload: { recoveryToken: token, cartToken: cart.token, value: cart.total },
    },
  });

  const base = cart.store.url.startsWith("http") ? cart.store.url : `https://${cart.store.url}`;
  return Response.redirect(`${base.replace(/\/$/, "")}/checkout/?sendloom_recovery=${token}`, 302);
}
