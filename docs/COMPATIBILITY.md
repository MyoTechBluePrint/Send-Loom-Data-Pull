# Sendloom for WooCommerce · Compatibility Checklist

Plugin version: 4.4.0 · checked 19 Jul 2026.
Targets: WordPress 7.0.x (current stable), WooCommerce 10.9 (11.0 due 28 Jul 2026), PHP 8.0+.

Honest status: **structure validated; live WordPress/WooCommerce install testing pending.**
Everything marked "pending live WordPress test" needs the first real install on
MyoTech (staging copy first if available) to flip to passed.

| Check | Status |
|---|---|
| PHP syntax valid (all 8 files, real parser) | passed |
| No secrets, node_modules, dev files or DB dumps in ZIP | passed (build script greps on every build) |
| Plugin header valid, Requires/WC fields present | passed |
| HPOS (custom order tables) compatibility declared | passed (code declares; uses CRUD API only) |
| Cart/checkout blocks compatibility declared | passed (tracker polls block checkout fields) |
| Text domain matches plugin folder | passed |
| Uninstall cleans options | passed (uninstall.php) |
| API key never sent to the browser | passed (tracker gets publicId only; verified in code) |
| Sendloom API handshake (health, signed connect, events, origin allowlist) | passed (replayed against a local production build, 19 Jul) |
| Tolerant tracker ingestion (bad email cannot kill a batch) | passed (unit-checked) |
| Activates without fatal errors on WordPress 7.0.x | pending live WordPress test |
| Settings page loads and saves | pending live WordPress test |
| Test connection / test event from wp-admin | pending live WordPress test |
| Frontend tracker loads on the theme | pending live WordPress test |
| Product page / add-to-cart / checkout events from a real storefront | pending live WordPress test |
| Popup script loads without theme layout breakage | pending live WordPress test |
| No console errors / PHP warnings on the live site | pending live WordPress test |

First live install flips the pending rows: follow the checklist on /launch,
then update this file.
