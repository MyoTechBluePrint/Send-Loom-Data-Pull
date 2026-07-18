// Fires a test event through the real ingestion pipeline against the demo
// store, so the QA panel can be exercised without a storefront.
import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { enqueue } from "@/lib/server/queue";
import { currentUser } from "@/lib/server/permissions";
import { sweepAbandoned } from "@/lib/server/carts";

const Body = z.object({
  type: z.enum(["page_viewed", "product_viewed", "cart_add", "checkout_started", "checkout_email_entered", "popup_submitted", "purchase_completed", "sweep"]),
});

export async function POST(req: NextRequest) {
  const user = await currentUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  if (parsed.data.type === "sweep") {
    const r = await sweepAbandoned(true);
    return Response.json({ ok: true, swept: r.swept });
  }

  const store = (await db.store.findFirst({ where: { name: { contains: "Vitalis" } } })) ?? (await db.store.findFirst());
  if (!store) return Response.json({ ok: false, error: "No store exists yet" }, { status: 404 });

  const t = parsed.data.type;
  const cartToken = "qa-test-cart-1";
  const payloads: Record<string, object> = {
    page_viewed: { url: "/qa-test", pageType: "test" },
    product_viewed: { productId: "101", productTitle: "NAD+ Cellular Complex" },
    cart_add: { cartToken, productId: "101", productTitle: "NAD+ Cellular Complex", items: [{ productId: "101", title: "NAD+ Cellular Complex", qty: 1, price: 68 }], total: 68 },
    checkout_started: { cartToken, total: 68, itemCount: 1 },
    checkout_email_entered: { cartToken, email: "qa.tracker@example.com", total: 68 },
    popup_submitted: { popup: "qa-popup", consent: true },
    purchase_completed: { cartToken, orderNumber: "#QA-1", total: 68 },
  };

  await enqueue({
    name: "event.ingest",
    payload: {
      workspaceId: store.workspaceId,
      storeId: store.id,
      type: t,
      email: ["checkout_email_entered", "popup_submitted", "purchase_completed"].includes(t) ? "qa.tracker@example.com" : undefined,
      anonymousId: "qa-visitor-1",
      payload: { ...payloads[t], source: "qa-panel" },
    },
  });

  return Response.json({ ok: true });
}
