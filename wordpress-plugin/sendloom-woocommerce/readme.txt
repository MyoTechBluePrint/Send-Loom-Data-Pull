=== Sendloom for WooCommerce ===
Requires at least: 6.4
Tested up to: 6.8
Requires PHP: 8.0
Stable tag: 4.0.0
License: GPLv2 or later

Connects a WooCommerce store to Sendloom: behaviour tracking (page/product/
category views, search, cart, checkout progress), abandoned cart & checkout
detection with recovery links, popups with consent capture, and
customer/order/product sync.

== Installation ==

1. WordPress Admin -> Plugins -> Add New -> Upload Plugin.
2. Upload sendloom-woocommerce.zip -> Install Now -> Activate.
3. WooCommerce -> Sendloom.
4. Enter your Sendloom endpoint and API key (Sendloom -> Settings -> Store Tracking).
5. Save & connect. Store ID and Tracking ID fill in automatically.
6. Use the action buttons: Test connection, Send test event, Sync products/customers/orders.

Full walkthrough for MyoTech/Novatec: docs/myotech-novatec-install.md in the
Sendloom repository.

== Notes ==

* The browser tracker uses the store's PUBLIC tracking ID only; the secret
  API key never leaves the server.
* Theme-safe: proper enqueues, scoped CSS, no theme edits. Tested selectors
  target standard WooCommerce/Astra markup; heavily customised checkouts may
  need the block-checkout selectors adjusted.
* Consent: hook `sendloom_tracking_allowed` to integrate a consent plugin.
