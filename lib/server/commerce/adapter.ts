// The commerce adapter contract: every platform SendLoom talks to implements
// this one interface, and nothing outside lib/server/commerce may contain
// platform-specific logic. The editor, forms and promotions only ever see
// SendLoom's own models.
//
// Statuses are honest by construction: an adapter reports what it can
// actually do right now, and the UI shows exactly that.

import type { Store } from "@prisma/client";

export type AdapterCapability =
  | "product_sync"      // products arrive into the internal catalogue
  | "order_sync"        // orders and refunds arrive
  | "customer_sync"
  | "coupon_push"       // generated codes are created at the store
  | "coupon_redemption" // redemptions are recognised
  | "storefront_tracking";

export type AdapterStatus = "operational" | "beta" | "partial" | "coming_soon";

export type ConnectionHealth = {
  connected: boolean;
  detail: string;
  lastSyncAt: Date | null;
  lastEventAt: Date | null;
};

export interface CommerceAdapter {
  readonly platform: string; // "woocommerce" | "shopify" | ...
  readonly status: AdapterStatus;
  readonly capabilities: AdapterCapability[];
  /** One-line honest description of how this adapter moves data. */
  readonly transport: string;
  health(store: Store): Promise<ConnectionHealth>;
}

import { woocommerceAdapter } from "./woocommerce";
import { shopifyAdapter } from "./shopify";

const ADAPTERS: Record<string, CommerceAdapter> = {
  woocommerce: woocommerceAdapter,
  shopify: shopifyAdapter,
};

export function adapterFor(platform: string): CommerceAdapter | null {
  return ADAPTERS[platform] ?? null;
}

export function allAdapters(): CommerceAdapter[] {
  return Object.values(ADAPTERS);
}
