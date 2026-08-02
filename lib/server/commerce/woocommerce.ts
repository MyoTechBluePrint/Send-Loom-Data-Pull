// WooCommerce adapter.
//
// Transport is the signed plugin channel that already runs in production:
// the SendLoom WordPress plugin pushes products, orders, refunds and events
// to /api/v1/sync/* and /api/v1/track, and pulls pending coupon jobs from
// /api/v1/sync/coupons. SendLoom never needs Woo REST credentials, and the
// storefront-only tracking rules (backend domains rejected) stay intact.
//
// Coupon push requires plugin >= 4.5, which serves the coupon poll. Until a
// store's plugin is upgraded, generated codes remain usable in email and are
// marked "pending" here — the adapter reports that honestly rather than
// pretending they exist at the store.

import type { Store } from "@prisma/client";
import { db } from "@/lib/server/db";
import type { CommerceAdapter, ConnectionHealth } from "./adapter";

export const woocommerceAdapter: CommerceAdapter = {
  platform: "woocommerce",
  status: "operational",
  capabilities: ["product_sync", "order_sync", "coupon_push", "coupon_redemption", "storefront_tracking"],
  transport: "Signed SendLoom plugin channel (push for products/orders/events, poll for coupon jobs)",

  async health(store: Store): Promise<ConnectionHealth> {
    const pendingCoupons = await db.couponCode.count({
      where: { pushState: "pending", promotion: { storeId: store.id } },
    });
    const staleSync = store.lastSyncAt && Date.now() - store.lastSyncAt.getTime() > 48 * 3600_000;
    return {
      connected: store.status === "connected",
      lastSyncAt: store.lastSyncAt,
      lastEventAt: store.lastEventAt,
      detail: [
        store.status === "connected" ? `Plugin ${store.pluginVersion ?? "?"} connected` : `Store status: ${store.status}`,
        staleSync ? "product sync stale (>48h)" : null,
        pendingCoupons > 0 ? `${pendingCoupons} coupon${pendingCoupons === 1 ? "" : "s"} awaiting plugin push (needs plugin ≥ 4.5)` : null,
      ].filter(Boolean).join(" · "),
    };
  },
};
