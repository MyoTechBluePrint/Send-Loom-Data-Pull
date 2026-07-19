/**
 * Sendloom tracker. Async, batched, retrying, consent-aware. Talks to the
 * PUBLIC tracker endpoint with the store's public id only.
 * No jQuery dependency; tolerates Astra + cache/minify plugins.
 */
(function () {
  "use strict";
  var CFG = window.SENDLOOM_CFG;
  if (!CFG || !CFG.endpoint || !CFG.store || !CFG.consented) return;

  // Storefront only: never track backend/API hosts or WordPress admin.
  var HOST = location.hostname.replace(/^www\./, "");
  if (/^(api|admin|backend|staging|dev)\./.test(HOST)) return;
  if (location.pathname.indexOf("/wp-admin") === 0 || location.pathname.indexOf("wp-login.php") !== -1) return;

  var API = CFG.endpoint + "/api/t/events";
  var LS = window.localStorage;

  function uid() {
    return "sl_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function get(key, ttlMs) {
    try {
      var raw = LS.getItem(key);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (ttlMs && Date.now() - obj.t > ttlMs) return null;
      return obj.v;
    } catch (e) { return null; }
  }
  function set(key, v) {
    try { LS.setItem(key, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }

  var visitorId = get("sendloom_vid") || uid();
  set("sendloom_vid", visitorId);
  var sessionId = get("sendloom_sid", 30 * 60 * 1000) || uid();
  set("sendloom_sid", sessionId);

  var queue = [];
  var flushTimer = null;

  function utm() {
    var p = new URLSearchParams(location.search);
    var out = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) {
      if (p.get(k)) out[k] = p.get(k);
    });
    return out;
  }

  function track(type, payload, email) {
    queue.push({
      type: type,
      eventId: uid(),
      anonymousId: visitorId,
      sessionId: sessionId,
      email: email || get("sendloom_email") || undefined,
      ts: Date.now(),
      payload: Object.assign(
        { url: location.pathname, hostname: HOST, context: "storefront", referrer: document.referrer || undefined, cartToken: CFG.cartToken },
        utm(),
        payload || {}
      ),
    });
    if (CFG.debug) console.log("[sendloom]", type, queue[queue.length - 1]);
    clearTimeout(flushTimer);
    flushTimer = setTimeout(flush, queue.length >= 10 ? 0 : 1500);
  }

  function flush(useBeacon) {
    if (!queue.length) return;
    var batch = queue.splice(0, 25);
    var body = JSON.stringify({ store: CFG.store, events: batch });
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(API, new Blob([body], { type: "application/json" }));
      return;
    }
    fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true })
      .catch(function () {
        // One retry after 5s; then drop rather than loop forever.
        setTimeout(function () {
          fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: body, keepalive: true }).catch(function () {});
        }, 5000);
      });
  }
  window.addEventListener("pagehide", function () { flush(true); });

  function identify(email) {
    if (!email || !/@.+\./.test(email)) return;
    set("sendloom_email", email.trim().toLowerCase());
  }

  // ---- Page context events ----
  var page = CFG.page || { type: "page" };
  if (page.type === "product") {
    track("product_viewed", { productId: page.productId, productTitle: page.productTitle, sku: page.sku, price: page.price });
  } else if (page.type === "category") {
    track("category_viewed", { category: page.category });
  } else if (page.type === "search") {
    track("search", { term: page.term, resultCount: page.resultCount });
  } else if (page.type === "checkout") {
    track("checkout_started", { total: page.total, itemCount: page.itemCount });
  } else {
    track("page_viewed", { pageType: page.type });
  }

  // ---- Cart events (WooCommerce fires jQuery events; listen if present) ----
  if (window.jQuery) {
    window.jQuery(document.body).on("added_to_cart", function (e, fragments, hash, button) {
      var pid = button && button.data ? String(button.data("product_id") || "") : "";
      track("cart_add", { productId: pid });
    });
    window.jQuery(document.body).on("removed_from_cart", function () {
      track("cart_remove", {});
    });
    window.jQuery(document.body).on("updated_cart_totals", function () {
      track("cart_updated", {});
    });
  }
  // Non-AJAX add-to-cart fallback (single product form submit).
  document.addEventListener("submit", function (e) {
    var f = e.target;
    if (f && f.classList && f.classList.contains("cart")) {
      var pid = (f.querySelector("[name=add-to-cart]") || {}).value || "";
      track("cart_add", { productId: String(pid) });
    }
  }, true);

  // ---- Checkout field capture (identify at email/phone entry) ----
  function watchCheckoutFields() {
    var email = document.getElementById("billing_email") || document.querySelector('input[type="email"][name*="email"]');
    if (email && !email.__sendloom) {
      email.__sendloom = true;
      email.addEventListener("change", function () {
        identify(email.value);
        track("checkout_email_entered", { total: page.total }, email.value.trim().toLowerCase());
      });
    }
    var phone = document.getElementById("billing_phone");
    if (phone && !phone.__sendloom) {
      phone.__sendloom = true;
      phone.addEventListener("change", function () {
        track("checkout_phone_entered", { phone: phone.value });
      });
    }
    var address = document.getElementById("billing_address_1");
    if (address && !address.__sendloom) {
      address.__sendloom = true;
      address.addEventListener("change", function () {
        track("checkout_address_started", {});
      });
    }
  }
  if (page.type === "checkout") {
    watchCheckoutFields();
    setInterval(watchCheckoutFields, 3000); // block-based checkout re-renders
  }
  if (page.type === "purchase") {
    // Page view only: the plugin sends checkout_completed server-side with
    // the order number, which is the authoritative record.
    track("page_viewed", { pageType: "purchase" });
  }

  // ---- Popups ----
  if (CFG.popups) {
    fetch(CFG.endpoint + "/api/t/popups?store=" + encodeURIComponent(CFG.store))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok || !data.popups || !data.popups.length) return;
        var popup = data.popups[0];
        if (popup.oncePerVisitor && get("sendloom_popup_" + popup.id)) return;

        function show() {
          if (document.getElementById("sendloom-popup")) return;
          set("sendloom_popup_" + popup.id, "shown");
          var wrap = document.createElement("div");
          wrap.id = "sendloom-popup";
          wrap.innerHTML =
            '<div class="sendloom-popup-backdrop"></div>' +
            '<div class="sendloom-popup-card" role="dialog" aria-modal="true">' +
            '<button class="sendloom-popup-close" aria-label="Close">&times;</button>' +
            "<h3>" + popup.headline + "</h3>" +
            "<p>" + popup.body + "</p>" +
            '<form class="sendloom-popup-form">' +
            '<input type="email" required placeholder="you@email.com" />' +
            '<label class="sendloom-popup-consent"><input type="checkbox" checked /> ' + popup.consentLabel + "</label>" +
            '<button type="submit">' + popup.buttonLabel + "</button>" +
            "</form></div>";
          document.body.appendChild(wrap);
          track("popup_viewed", { popup: popup.id });

          wrap.querySelector(".sendloom-popup-close").addEventListener("click", function () {
            wrap.remove();
            track("popup_closed", { popup: popup.id });
          });
          wrap.querySelector(".sendloom-popup-backdrop").addEventListener("click", function () {
            wrap.remove();
            track("popup_closed", { popup: popup.id });
          });
          wrap.querySelector("form").addEventListener("submit", function (e) {
            e.preventDefault();
            var em = wrap.querySelector('input[type="email"]').value;
            var consent = wrap.querySelector('input[type="checkbox"]').checked;
            identify(em);
            track("popup_submitted", { popup: popup.id, consent: consent }, em.trim().toLowerCase());
            flush();
            wrap.querySelector(".sendloom-popup-card").innerHTML = "<h3>Done — check your inbox soon.</h3>";
            setTimeout(function () { wrap.remove(); }, 2500);
          });
        }

        if (popup.trigger && popup.trigger.kind === "exit_intent") {
          document.addEventListener("mouseout", function (e) {
            if (!e.relatedTarget && e.clientY <= 0) show();
          });
        } else {
          setTimeout(show, ((popup.trigger && popup.trigger.seconds) || 8) * 1000);
        }
      })
      .catch(function () {});
  }
})();
