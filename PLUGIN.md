# Sendloom Connect · WooCommerce plugin

Folder: [wordpress-plugin/sendloom](wordpress-plugin/sendloom)

## What it does (V3 skeleton)

- Settings page at **WooCommerce → Sendloom**: Sendloom URL + API key,
  connection status, store identifier, last sync, error log.
- **Save & connect** calls `POST /api/v1/connect` and verifies with
  `GET /api/v1/health`.
- **Sync now** pushes customers, products and orders in batches of 100.
- Live event hooks once connected:

| WooCommerce hook | Sendloom event |
|---|---|
| product page view | `product_viewed` |
| category page view | `category_viewed` |
| site search (`pre_get_posts`) | `search` (term + result count) |
| `woocommerce_add_to_cart` | `cart_add` |
| `woocommerce_cart_item_removed` | `cart_remove` |
| `woocommerce_checkout_order_processed` | `checkout_started` |
| `woocommerce_order_status_completed` | order sync (`purchase_completed` downstream) |
| `user_register` | `account_created` |

- Logged-in customers are identified by email. Anonymous visitors get a
  hashed first-party cookie id; Sendloom keeps anonymous events aggregate-only
  and never creates contacts from them.
- Consent is never assumed: customer sync sends `marketingConsent: true` only
  when the store recorded an explicit opt-in (`marketing_opt_in` user meta).
- Failed API calls append to a rolling 50-entry error log on the settings page.

## Local install

1. Run a local WordPress with WooCommerce (LocalWP, Studio, or wp-env).
2. Copy `wordpress-plugin/sendloom/` into `wp-content/plugins/`.
3. Activate **Sendloom Connect**.
4. In WooCommerce → Sendloom set:
   - Sendloom URL: `http://localhost:3009`
   - API key: `slm_live_demo_vitalis_4f2a` (seeded demo store)
5. Save & connect → status turns green, and a `store.connected` entry appears
   in Sendloom's Admin → Audit log.
6. Press **Sync now**, then view a product, search, and place a test order on
   the storefront. Each action lands in Sendloom: check the contact timeline
   and Demand Radar → Site search.

Note: if WordPress runs in Docker, use `http://host.docker.internal:3009` as
the Sendloom URL.

## Honest status

- The PHP has not been lint-run in this environment (no PHP installed on this
  machine); run `php -l` on the four files when first installing.
- Sync batches are capped at 100 records (no pagination loop yet).
- No webhook signing yet (API key auth only); no retry queue on the WP side.
