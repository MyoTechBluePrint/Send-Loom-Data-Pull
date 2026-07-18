<?php
/**
 * Front-end tracker + popups + recovery restoration. Enqueues the Sendloom
 * tracking script with the store's PUBLIC id only (the secret API key never
 * reaches the browser), and rebuilds carts when a recovery link lands.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Sendloom_Tracker {

    public static function init() {
        if (get_option('sendloom_tracking_enabled', 'yes') === 'yes') {
            add_action('wp_enqueue_scripts', [__CLASS__, 'enqueue']);
        }
        add_action('template_redirect', [__CLASS__, 'maybe_restore_recovery_cart'], 5);
    }

    public static function enqueue() {
        $public_id = get_option('sendloom_store_public_id', '');
        if (!$public_id) {
            return; // not connected yet
        }

        wp_enqueue_script(
            'sendloom-tracker',
            SENDLOOM_PLUGIN_URL . 'assets/tracker.js',
            [],
            SENDLOOM_VERSION,
            ['in_footer' => true, 'strategy' => 'async']
        );
        wp_enqueue_style('sendloom-popup', SENDLOOM_PLUGIN_URL . 'assets/popup.css', [], SENDLOOM_VERSION);

        $context = [
            'endpoint'  => rtrim(get_option('sendloom_api_url', ''), '/'),
            'store'     => $public_id,
            'popups'    => get_option('sendloom_popups_enabled', 'yes') === 'yes',
            'debug'     => get_option('sendloom_debug_mode', 'no') === 'yes',
            // Consent gate: themes/consent plugins can veto via this filter.
            'consented' => apply_filters('sendloom_tracking_allowed', true) ? true : false,
            'cartToken' => self::cart_token(),
            'page'      => self::page_context(),
        ];
        wp_add_inline_script('sendloom-tracker', 'window.SENDLOOM_CFG = ' . wp_json_encode($context) . ';', 'before');
    }

    private static function cart_token() {
        if (isset($_COOKIE['sendloom_cart'])) {
            return sanitize_text_field(wp_unslash($_COOKIE['sendloom_cart']));
        }
        $token = wp_generate_uuid4();
        setcookie('sendloom_cart', $token, time() + 30 * DAY_IN_SECONDS, '/', '', is_ssl(), false);
        return $token;
    }

    private static function page_context() {
        $ctx = ['type' => 'page'];
        if (function_exists('is_product') && is_product()) {
            $product = wc_get_product(get_the_ID());
            if ($product) {
                $ctx = [
                    'type'         => 'product',
                    'productId'    => (string) $product->get_id(),
                    'productTitle' => $product->get_name(),
                    'sku'          => $product->get_sku(),
                    'price'        => (float) $product->get_price(),
                ];
            }
        } elseif (function_exists('is_product_category') && is_product_category()) {
            $term = get_queried_object();
            $ctx  = ['type' => 'category', 'category' => $term ? $term->name : ''];
        } elseif (function_exists('is_cart') && is_cart()) {
            $ctx = ['type' => 'cart', 'total' => WC()->cart ? (float) WC()->cart->get_total('edit') : 0];
        } elseif (function_exists('is_checkout') && is_checkout() && !is_order_received_page()) {
            $ctx = ['type' => 'checkout', 'total' => WC()->cart ? (float) WC()->cart->get_total('edit') : 0, 'itemCount' => WC()->cart ? WC()->cart->get_cart_contents_count() : 0];
        } elseif (function_exists('is_order_received_page') && is_order_received_page()) {
            $ctx = ['type' => 'purchase'];
        } elseif (is_search()) {
            global $wp_query;
            $ctx = ['type' => 'search', 'term' => get_search_query(), 'resultCount' => (int) $wp_query->found_posts];
        }
        return $ctx;
    }

    /**
     * Recovery restoration: ?sendloom_recovery=<token> pulls the saved cart
     * from Sendloom (key-authenticated, server side) and rebuilds it.
     */
    public static function maybe_restore_recovery_cart() {
        if (empty($_GET['sendloom_recovery']) || !function_exists('WC') || !WC()->cart) {
            return;
        }
        $token  = sanitize_text_field(wp_unslash($_GET['sendloom_recovery']));
        $result = Sendloom_Api::request('GET', '/api/v1/recovery/' . rawurlencode($token));
        if (empty($result['ok']) || empty($result['items'])) {
            Sendloom_Api::log_error('recovery', 'Recovery token lookup failed for ' . $token);
            return;
        }
        $added = 0;
        foreach ($result['items'] as $item) {
            $product_id = isset($item['productId']) ? absint($item['productId']) : 0;
            $qty        = isset($item['qty']) ? max(1, absint($item['qty'])) : 1;
            if ($product_id && wc_get_product($product_id)) {
                WC()->cart->add_to_cart($product_id, $qty);
                $added++;
            }
        }
        if ($added > 0) {
            wc_add_notice(sprintf(__('Welcome back — we restored %d item(s) to your cart.', 'sendloom'), $added), 'success');
        }
    }
}
