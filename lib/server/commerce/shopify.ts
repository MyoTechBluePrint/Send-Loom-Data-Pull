// Shopify adapter: NOT YET IMPLEMENTED, and it says so.
//
// The honest position: Shopify needs an app (OAuth, scoped tokens, webhook
// registration, uninstall handling), none of which exists yet. This stub
// keeps the adapter contract satisfied so the rest of the product can show
// Shopify as "coming soon" without a single Shopify-specific branch leaking
// into campaign, form or promotion code.

import type { Store } from "@prisma/client";
import type { CommerceAdapter, ConnectionHealth } from "./adapter";

export const shopifyAdapter: CommerceAdapter = {
  platform: "shopify",
  status: "coming_soon",
  capabilities: [],
  transport: "Shopify app with OAuth (not yet built)",

  async health(store: Store): Promise<ConnectionHealth> {
    return {
      connected: false,
      lastSyncAt: store.lastSyncAt,
      lastEventAt: store.lastEventAt,
      detail: "Shopify support is not implemented yet. The promotion and product models are platform-neutral, so no campaign work needs redoing when the adapter lands.",
    };
  },
};
