=== Sendloom for WooCommerce ===
Contributors: sendloom
Tags: woocommerce, tracking, abandoned cart, popups, email marketing
Requires at least: 6.4
Tested up to: 7.0
Requires PHP: 8.0
WC requires at least: 9.0
WC tested up to: 10.9
Stable tag: 4.3.0
License: GPL-2.0+

Connects WooCommerce to Sendloom for tracking, popups, abandoned cart/checkout recovery and store data sync.

== Description ==

Sendloom for WooCommerce connects your store to your Sendloom workspace:

* Behaviour tracking (product views, carts, checkouts, search) via an async browser tracker using the store's public id only; the secret API key never reaches the browser
* Abandoned cart and abandoned checkout detection with recovery links that rebuild the cart
* Popup lead capture with explicit consent
* Customer, order and product sync (batched, HPOS-compatible)
* Declares compatibility with WooCommerce High-Performance Order Storage and block-based cart/checkout

Compatibility note: structure and syntax validated (PHP 7/8 parse, no secrets in the package). Live WordPress/WooCommerce install testing is pending; install on a staging site first if one is available.

== Installation ==

1. In Sendloom, open Store Tracking and download the plugin ZIP (owner only)
2. WordPress admin: Plugins, Add New, Upload Plugin, choose sendloom-woocommerce.zip
3. Install Now, then Activate
4. Open WooCommerce, Sendloom
5. Set the Sendloom endpoint URL and paste THIS store's API key
6. Save & connect; Store ID and tracking ID fill in automatically
7. Send test event, then confirm it appears in Sendloom Store Tracking
8. Run Sync products, Sync customers, Sync orders

No coding needed. Never paste one store's key into another store's plugin.

== Changelog ==

= 4.3.0 =
* Storefront-only tracking: the tracker refuses to run on api./admin./backend. hosts and WordPress admin paths
* Every event reports its hostname; Sendloom rejects backend/API domains with a visible reason
* Settings page shows the storefront domain with a warning when it looks like a backend/API domain


= 4.2.0 =
* Declared WooCommerce HPOS (custom order tables) and cart/checkout blocks compatibility
* WC requires at least / WC tested up to headers added
* Text domain corrected to sendloom-woocommerce
* Copy diagnostics button (key-free support block)
* Clearer test event and connection failure messages

= 4.1.0 =
* Behavioural events are now fire-and-forget: a slow Sendloom endpoint can never delay a storefront page
* Removed double-counting: PHP browse events only fire when the JS tracker is disabled
* Order-processed hook now reports checkout_completed with the cart token (correct lifecycle stage)
* Search events carry real result counts
* Removed the webhook button (orders already push directly on completion)
* Settings page links straight to Sendloom Store Tracking

= 4.0.0 =
* First installable release: tracker, popups, recovery, sync, diagnostics
