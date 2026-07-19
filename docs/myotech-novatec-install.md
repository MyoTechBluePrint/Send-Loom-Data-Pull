# Installing Sendloom on MyoTech and Novatec

Written for Steve. Twenty steps, roughly ten minutes per site.

## Before you start

- The plugin ZIP: run `npm run plugin:zip` in the Sendloom repo, or ask for
  the latest build. File: `plugin-builds/sendloom-woocommerce.zip`.
- Credentials: Sendloom → **Store Tracking** (Control section) shows both
  stores with their **API key** (secret, owner-only view) and **Tracking ID**
  (public, fills in automatically). MyoTech and Novatec store records already
  exist.
- Heads-up: once installed, REAL visitor and customer behaviour flows into
  Sendloom staging. Treat staging like production from that moment: rotate
  the shared password first, keep the GitHub repo private, and plan the
  Postgres switch.

## Install (per site)

1. In Sendloom → Store Tracking, copy the store's **API key** (MyoTech key
   for MyoTech, Novatec key for Novatec, never crossed).
2. Log into that site's WordPress admin.
3. Plugins → Add New → **Upload Plugin**.
4. Choose `sendloom-woocommerce.zip` → **Install Now**.
5. **Activate**. You'll see "Sendloom for WooCommerce" in the plugin list.
6. Go to **WooCommerce → Sendloom**.
7. Endpoint: `https://sendloom.onrender.com` (pre-filled).
8. Paste the API key. Leave tracking + popups ticked.
9. Click **Save & connect**. Status turns green; Store ID and Tracking ID
   fill in automatically.
10. Click **Test connection** → "Connection test passed."
11. Click **Send test event** → then check Sendloom → Store Tracking: the
    event appears in "Last 20 events" within seconds.
12. Click **Sync products**, then **Sync customers**, then **Sync orders**
    (first 100-page batches each; large stores may take a minute).
13. Orders push automatically when they complete; the manual **Sync orders** button backfills history.

## Verify tracking (per site)

14. Open the storefront in a private window. Browse a product page.
15. Add something to the cart, start checkout, and type an email into the
    checkout email field (use a test address).
16. In Sendloom → Store Tracking: you should see product_viewed, cart_add,
    checkout_started and checkout_email_entered for that store.
17. Abandon it. After ~30 minutes the cart shows as **abandoned checkout**
    in the Cart lifecycle card ("Run abandon sweep" forces the check).
18. In Sendloom → Contacts: the test email exists with the behaviour on its
    timeline and a "why this contact matters" line.
19. Complete a test purchase: the cart flips to converted and the order
    syncs.
20. If a popup is live in Sendloom (Forms), it appears on the storefront
    after ~8 seconds; submitting it creates a consented contact.

## If something fails

- WooCommerce → Sendloom → **Store diagnostics**: click the box, copy, and
  paste it to me/Claude.
- The Error log on the same page shows the last 20 failures with reasons.
- Common issues: caching plugin serving old pages (purge after activation);
  Cloudflare blocking `sendloom.onrender.com` (allowlist it); wrong store's
  API key.

## Known limitations (honest list)

- Block-based (Gutenberg) checkout field capture uses a polling fallback;
  classic checkout is fully supported. Heavily customised checkouts may need
  selector tweaks.
- Recovery links restore carts by product ID + quantity; variations and
  custom line-item meta aren't restored yet.
- The PHP has not been lint-run in this environment (no php binary): run
  `php -l` on the includes once before first install, or just install on a
  staging copy of MyoTech first.

## Compatibility

Targets WordPress 7.0.x and WooCommerce 10.9 (headers declare WC requires
9.0, WC tested up to 10.9), PHP 8.0+. HPOS (High-Performance Order Storage)
and block cart/checkout compatibility are declared in code. Honest status:
structure validated, live install testing pending; see docs/COMPATIBILITY.md.

[WordPress Plugins page screenshot here]
[Upload plugin button screenshot here]
[WooCommerce → Sendloom settings screenshot here]
[Store Tracking test event screenshot here]

## Getting the plugin ZIP

Owners can download it inside Sendloom: **Store Tracking → Download plugin
ZIP** (also on the Ads Launch page). No file transfer outside Sendloom is
needed; every download is written to the audit log.

## MyoTech test plan (run after install, in order)

1. **Test event**: plugin Send test event → appears in Store Tracking under
   MyoTech within a minute.
2. **Browse tracking**: open a product page in a private window →
   `product_viewed` shows with the MyoTech chip.
3. **Popup capture**: set a `MyoTech ·` template live in Forms, submit it
   with a test email → a consented contact appears in Contacts, source popup.
4. **Cart + abandonment**: add to cart, start checkout, enter the test
   email, leave. After 30 min (or Run sweep on Store Tracking) the cart shows
   as abandoned checkout with the email attached.
5. **Sync**: run product, customer and order sync from the plugin →
   counts appear in the plugin diagnostics and events in Store Tracking.

## Novatec test plan

Repeat the same five checks with the **Novatec key on the Novatec site** and
`Novatec ·` popup templates. While testing, use the store filter on Store
Tracking to confirm every Novatec event carries the Novatec chip and none of
it appears under MyoTech. The two stores must stay fully separate; if data
crosses over, a key was pasted into the wrong plugin, so stop and report it.
