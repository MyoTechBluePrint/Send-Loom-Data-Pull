// Abandoned cart/checkout lifecycle. Carts are keyed by the tracker's cart
// token. Sweeps flip idle carts to abandoned (cart 1h, checkout 30min);
// purchases convert or recover; recovered revenue is only attributed when the
// recovery link was actually clicked. Sweeps run opportunistically on plugin
// traffic (throttled) and via POST /api/v1/sweep for cron.
import { db } from "./db";
import { audit } from "./audit";

export const CART_ABANDON_MINUTES = 60;
export const CHECKOUT_ABANDON_MINUTES = 30;

type CartEventPayload = {
  cartToken?: string;
  items?: { productId?: string; title?: string; qty?: number; price?: number }[];
  total?: number;
  currency?: string;
  step?: string;
  email?: string;
  phone?: string;
};

export async function touchCart(storeId: string, type: string, payload: CartEventPayload, contactId: string | null) {
  const token = payload.cartToken;
  if (!token) return;

  const existing = await db.cart.findUnique({ where: { token } });
  const data = {
    storeId,
    contactId: contactId ?? existing?.contactId ?? null,
    items: payload.items ? JSON.stringify(payload.items) : existing?.items,
    total: payload.total ?? existing?.total ?? 0,
    currency: payload.currency ?? existing?.currency ?? "GBP",
    email: payload.email?.toLowerCase() ?? existing?.email,
    phone: payload.phone ?? existing?.phone,
    lastActivityAt: new Date(),
  };

  if (type === "checkout_started" || type === "checkout_email_entered" || type === "checkout_phone_entered" || type === "checkout_address_started") {
    await db.cart.upsert({
      where: { token },
      create: { token, ...data, status: "checkout_started", checkoutStartedAt: new Date(), checkoutStep: payload.step ?? type },
      update: {
        ...data,
        // Any checkout activity promotes the cart to checkout_started unless
        // it already finished (converted/recovered stay terminal).
        status: existing && ["converted", "recovered"].includes(existing.status) ? existing.status : "checkout_started",
        checkoutStartedAt: existing?.checkoutStartedAt ?? new Date(),
        checkoutStep: payload.step ?? type,
      },
    });
    return;
  }

  if (type === "cart_add" || type === "cart_updated" || type === "cart_remove") {
    await db.cart.upsert({
      where: { token },
      create: { token, ...data, status: "open" },
      update: { ...data, status: existing?.status === "abandoned" ? "open" : existing?.status ?? "open" },
    });
    return;
  }

  if (type === "purchase_completed" || type === "checkout_completed") {
    if (!existing) return;
    const wasAbandoned = existing.status === "abandoned" || existing.status === "abandoned_checkout";
    const clicked = await db.event.findFirst({
      where: { storeId, type: "recovery_link_clicked", payload: { contains: existing.recoveryToken ?? "∅" } },
    });
    const recovered = wasAbandoned && !!clicked;
    await db.cart.update({
      where: { token },
      data: {
        ...data,
        status: recovered ? "recovered" : "converted",
        recoveredAt: recovered ? new Date() : null,
      },
    });
    if (recovered) {
      await audit(
        (await db.store.findUniqueOrThrow({ where: { id: storeId } })).workspaceId,
        "system", "cart.recovered",
        `Cart ${token.slice(0, 8)}… recovered via recovery link · £${data.total}`
      );
    }
  }
}

// Flip idle carts. Cheap enough to run on plugin traffic; throttled to once/min.
let lastSweep = 0;
export async function sweepAbandoned(force = false) {
  if (!force && Date.now() - lastSweep < 60_000) return { swept: 0 };
  lastSweep = Date.now();

  const cartCutoff = new Date(Date.now() - CART_ABANDON_MINUTES * 60_000);
  const checkoutCutoff = new Date(Date.now() - CHECKOUT_ABANDON_MINUTES * 60_000);

  const [cartRes, checkoutRes] = await Promise.all([
    db.cart.updateMany({
      where: { status: "open", lastActivityAt: { lt: cartCutoff } },
      data: { status: "abandoned", abandonedAt: new Date() },
    }),
    db.cart.updateMany({
      where: { status: "checkout_started", lastActivityAt: { lt: checkoutCutoff } },
      data: { status: "abandoned_checkout", abandonedAt: new Date() },
    }),
  ]);
  return { swept: cartRes.count + checkoutRes.count };
}

export async function cartStats(storeId?: string) {
  const where = storeId ? { storeId } : {};
  const grouped = await db.cart.groupBy({ by: ["status"], where, _count: true, _sum: { total: true } });
  const get = (s: string) => grouped.find((g) => g.status === s);
  return {
    open: get("open")?._count ?? 0,
    checkoutStarted: get("checkout_started")?._count ?? 0,
    abandoned: get("abandoned")?._count ?? 0,
    abandonedCheckout: get("abandoned_checkout")?._count ?? 0,
    recovered: get("recovered")?._count ?? 0,
    converted: get("converted")?._count ?? 0,
    recoveredRevenue: get("recovered")?._sum.total ?? 0,
    abandonedValue: (get("abandoned")?._sum.total ?? 0) + (get("abandoned_checkout")?._sum.total ?? 0),
  };
}
