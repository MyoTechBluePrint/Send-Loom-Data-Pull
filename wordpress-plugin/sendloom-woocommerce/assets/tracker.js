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
        { url: location.pathname, hostname: HOST, context: CFG.internal ? "internal" : "storefront", referrer: document.referrer || undefined, cartToken: CFG.cartToken },
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

        // Escape everything that reaches innerHTML: config is workspace
        // content, the storefront must never execute it.
        function esc(v) {
          return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
          });
        }

        // Styles ship with the tracker so headless (GTM/snippet) stores get
        // the same popup as plugin stores; the accent rides a CSS variable.
        function injectStyles() {
          if (document.getElementById("sendloom-popup-style")) return;
          var st = document.createElement("style");
          st.id = "sendloom-popup-style";
          st.textContent =
            "#sendloom-popup .sendloom-popup-backdrop{position:fixed;inset:0;background:rgba(15,12,25,.55);z-index:99998}" +
            "#sendloom-popup .sendloom-popup-card{position:fixed;z-index:99999;top:50%;left:50%;transform:translate(-50%,-50%);width:min(92vw,380px);background:#fff;border-radius:14px;padding:28px 24px;box-shadow:0 24px 64px rgba(0,0,0,.25);font-family:inherit;text-align:center}" +
            "#sendloom-popup h3{margin:0 0 8px;font-size:20px;line-height:1.25;color:#111}" +
            "#sendloom-popup p{margin:0 0 16px;font-size:14px;color:#555}" +
            "#sendloom-popup .sendloom-popup-form input[type=email],#sendloom-popup .sendloom-popup-form input[type=text]{width:100%;box-sizing:border-box;padding:10px 12px;font-size:14px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px}" +
            "#sendloom-popup .sendloom-popup-consent{display:flex;gap:8px;align-items:flex-start;text-align:left;font-size:11px;color:#777;margin-bottom:12px}" +
            "#sendloom-popup .sendloom-popup-form button[type=submit]{width:100%;padding:11px 16px;font-size:14px;font-weight:600;color:#fff;background:var(--sl-accent,#6d28d9);border:0;border-radius:8px;cursor:pointer}" +
            "#sendloom-popup .sendloom-popup-form button[type=submit]:hover{filter:brightness(.94)}" +
            "#sendloom-popup .sendloom-popup-close{position:absolute;top:8px;right:12px;background:none;border:0;font-size:22px;color:#999;cursor:pointer;line-height:1}" +
            "#sendloom-popup .sendloom-popup-code{margin:14px 0 4px;padding:10px;border:1px dashed var(--sl-accent,#6d28d9);border-radius:8px;font-weight:700;font-size:16px;letter-spacing:.06em;color:var(--sl-accent,#6d28d9)}";
          document.head.appendChild(st);
        }

        function show() {
          if (document.getElementById("sendloom-popup")) return;
          set("sendloom_popup_" + popup.id, "shown");
          injectStyles();
          var wrap = document.createElement("div");
          wrap.id = "sendloom-popup";
          if (popup.accent) wrap.style.setProperty("--sl-accent", String(popup.accent));
          wrap.innerHTML =
            '<div class="sendloom-popup-backdrop"></div>' +
            '<div class="sendloom-popup-card" role="dialog" aria-modal="true">' +
            '<button class="sendloom-popup-close" aria-label="Close">&times;</button>' +
            "<h3>" + esc(popup.headline) + "</h3>" +
            "<p>" + esc(popup.body) + "</p>" +
            '<form class="sendloom-popup-form">' +
            (popup.collectName ? '<input type="text" name="sl-name" placeholder="First name" autocomplete="given-name" />' : "") +
            '<input type="email" required placeholder="you@email.com" autocomplete="email" />' +
            '<label class="sendloom-popup-consent"><input type="checkbox" checked /> ' + esc(popup.consentLabel) + "</label>" +
            '<button type="submit">' + esc(popup.buttonLabel) + "</button>" +
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
            var nameEl = wrap.querySelector('input[name="sl-name"]');
            var nm = nameEl ? nameEl.value.trim() : "";
            var consent = wrap.querySelector('input[type="checkbox"]').checked;
            identify(em);
            track("popup_submitted", { popup: popup.id, consent: consent, name: nm || undefined }, em.trim().toLowerCase());
            flush();
            var doneHtml = "<h3>" + esc(popup.successMessage || "Done — check your inbox soon.") + "</h3>";
            if (popup.offerCode) doneHtml += '<div class="sendloom-popup-code">' + esc(popup.offerCode) + "</div>";
            wrap.querySelector(".sendloom-popup-card").innerHTML = doneHtml;
            setTimeout(function () { wrap.remove(); }, popup.offerCode ? 7000 : 2500);
          });
        }

        if (popup.trigger && popup.trigger.kind === "exit_intent") {
          document.addEventListener("mouseout", function (e) {
            if (!e.relatedTarget && e.clientY <= 0) show();
          });
        } else if (popup.trigger && popup.trigger.kind === "scroll") {
          var fired = false;
          window.addEventListener("scroll", function () {
            if (fired) return;
            var h = document.documentElement;
            var max = h.scrollHeight - h.clientHeight;
            if (max > 0 && h.scrollTop / max > 0.5) { fired = true; show(); }
          }, { passive: true });
        } else {
          setTimeout(show, ((popup.trigger && popup.trigger.seconds) || 8) * 1000);
        }
      })
      .catch(function () {});
  }
})();
