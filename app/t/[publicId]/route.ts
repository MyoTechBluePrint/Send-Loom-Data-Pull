// Standalone tracker for HEADLESS storefronts (root domain tracking without
// the WordPress plugin). Serves the same tracker.js the plugin ships, with a
// config prelude derived from the store's PUBLIC id. Embed on the storefront:
//   <script src="https://sendloom.onrender.com/t/<publicId>.js" async></script>
// Optional page context, set before the script loads:
//   window.SENDLOOM_PAGE = { type: "product", productId: "…", productTitle: "…" };
// Consent gate for cookie banners: set window.sendloomConsent = false to veto.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: raw } = await ctx.params;
  const publicId = raw.replace(/\.js$/, "");
  const store = await db.store.findUnique({ where: { publicId }, select: { id: true, trackingMode: true } });
  if (!store) {
    return new Response("// unknown store", { status: 404, headers: { "Content-Type": "text/javascript" } });
  }

  const trackerPath = path.join(process.cwd(), "wordpress-plugin", "sendloom-woocommerce", "assets", "tracker.js");
  let tracker: string;
  try {
    tracker = await readFile(trackerPath, "utf8");
  } catch {
    return new Response("// tracker unavailable", { status: 500, headers: { "Content-Type": "text/javascript" } });
  }

  const endpoint = new URL(req.url).origin;
  const prelude = `// Sendloom standalone tracker (headless storefront build)
(function () {
  if (window.SENDLOOM_CFG) return; // plugin config wins if both are present
  var LS = window.localStorage;
  var cart;
  try {
    cart = LS.getItem("sendloom_cart_token");
    if (!cart) { cart = "hd_" + Math.random().toString(36).slice(2) + Date.now().toString(36); LS.setItem("sendloom_cart_token", cart); }
  } catch (e) { cart = "hd_session"; }
  window.SENDLOOM_CFG = {
    endpoint: ${JSON.stringify(endpoint)},
    store: ${JSON.stringify(publicId)},
    popups: true,
    debug: false,
    consented: window.sendloomConsent !== false,
    internal: window.sendloomInternal === true,
    cartToken: cart,
    page: window.SENDLOOM_PAGE || { type: "page" }
  };
})();
`;

  return new Response(prelude + tracker, {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
