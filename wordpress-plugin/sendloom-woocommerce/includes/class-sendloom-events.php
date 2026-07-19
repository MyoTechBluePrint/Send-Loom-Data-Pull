<?php
/**
 * Behavioural event listeners. Each WooCommerce hook maps to one Sendloom
 * event type. Identified events include the customer email; anonymous browse
 * events send only a hashed visitor id (Sendloom keeps those aggregate-only).
 */

if (!defined('ABSPATH')) {
    exit;
}

class Sendloom_Events {

    public static function init() {
        // Server-truth hooks: always on. These capture transactions and
        // accounts even for visitors with JavaScript blocked.
        add_action('woocommerce_checkout_order_processed', [__CLASS__, 'on_checkout'], 10, 1);
        add_action('woocommerce_order_status_completed', [__CLASS__, 'on_order_completed'], 10, 1);
        add_action('user_register', [__CLASS__, 'on_account_created'], 10, 1);

        // Browse hooks: FALLBACK ONLY, when the JS tracker is switched off.
        // With the tracker on, the browser already sends these; sending them
        // from PHP too would double-count every product view and cart add.
        if (get_option('sendloom_tracking_enabled', 'yes') !== 'yes') {
            add_action('template_redirect', [__CLASS__, 'on_page_view']);
            add_action('woocommerce_add_to_cart', [__CLASS__, 'on_add_to_cart'], 10, 4);
            add_action('woocommerce_cart_item_removed', [__CLASS__, 'on_remove_from_cart'], 10, 2);
        }
    }

    private static function visitor() {
        $email = null;
        if (is_user_logged_in()) {
            $user  = wp_get_current_user();
            $email = $user->user_email;
        }
        return [
            'email'       => $email,
            'anonymousId' => $email ? null : substr(hash('sha256', self::anon_seed()), 0, 32),
        ];
    }

    private static function anon_seed() {
        if (isset($_COOKIE['sendloom_vid'])) {
            return sanitize_text_field(wp_unslash($_COOKIE['sendloom_vid']));
        }
        $vid = wp_generate_uuid4();
        setcookie('sendloom_vid', $vid, time() + YEAR_IN_SECONDS, '/', '', is_ssl(), true);
        return $vid;
    }

    private static function send($type, $payload = []) {
        $visitor = self::visitor();
        $event   = ['payload' => (object) $payload];
        if ($visitor['email']) {
            $event['email'] = $visitor['email'];
        } else {
            $event['anonymousId'] = $visitor['anonymousId'];
        }
        Sendloom_Api::send_event($type, $event, false); // fire-and-forget
    }

    public static function on_page_view() {
        if (is_product()) {
            $product = wc_get_product(get_the_ID());
            if ($product) {
                self::send('product_viewed', [
                    'productId'    => (string) $product->get_id(),
                    'productTitle' => $product->get_name(),
                ]);
            }
        } elseif (is_product_category()) {
            $term = get_queried_object();
            self::send('category_viewed', ['category' => $term ? $term->name : '']);
        } elseif (is_search()) {
            // template_redirect runs after the main query, so found_posts is real.
            global $wp_query;
            self::send('search', [
                'term'        => get_search_query(),
                'resultCount' => (int) $wp_query->found_posts,
            ]);
        }
    }

    public static function on_add_to_cart($cart_item_key, $product_id, $quantity, $variation_id) {
        $product = wc_get_product($product_id);
        self::send('cart_add', [
            'productId'    => (string) $product_id,
            'productTitle' => $product ? $product->get_name() : '',
            'quantity'     => $quantity,
        ]);
    }

    public static function on_remove_from_cart($cart_item_key, $cart) {
        self::send('cart_remove', []);
    }

    public static function on_checkout($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        // The order exists, so this is checkout COMPLETED (server truth, works
        // with JS blocked). The cart token links it to the tracked cart so the
        // lifecycle can mark it converted instead of abandoned.
        $cart_token = isset($_COOKIE['sendloom_cart']) ? sanitize_text_field(wp_unslash($_COOKIE['sendloom_cart'])) : null;
        Sendloom_Api::send_event('checkout_completed', [
            'email'   => $order->get_billing_email(),
            'payload' => (object) [
                'orderNumber' => $order->get_order_number(),
                'total'       => (float) $order->get_total(),
                'itemCount'   => $order->get_item_count(),
                'cartToken'   => $cart_token,
            ],
        ], false);
    }

    public static function on_order_completed($order_id) {
        Sendloom_Sync::push_order($order_id);
    }

    public static function on_account_created($user_id) {
        $user = get_userdata($user_id);
        if ($user) {
            Sendloom_Api::send_event('account_created', ['email' => $user->user_email], false);
        }
    }
}
