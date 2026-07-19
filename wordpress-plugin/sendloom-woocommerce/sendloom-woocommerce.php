<?php
/**
 * Plugin Name: Sendloom for WooCommerce
 * Plugin URI: https://sendloom.onrender.com
 * Description: Connects this WooCommerce store to Sendloom — behaviour tracking, abandoned cart & checkout recovery, popups, and customer/order/product sync.
 * Version: 4.3.0
 * Author: Sendloom
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * Requires Plugins: woocommerce
 * WC requires at least: 9.0
 * WC tested up to: 10.9
 * License: GPL-2.0+
 * Text Domain: sendloom-woocommerce
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SENDLOOM_VERSION', '4.3.0');
define('SENDLOOM_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('SENDLOOM_PLUGIN_URL', plugin_dir_url(__FILE__));

require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-api.php';
require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-events.php';
require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-sync.php';
require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-admin.php';
require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-tracker.php';

class Sendloom_Plugin {

    public static function init() {
        Sendloom_Admin::init();

        if (Sendloom_Api::is_connected()) {
            Sendloom_Events::init();
            Sendloom_Tracker::init();
        }

        add_action('sendloom_run_full_sync', ['Sendloom_Sync', 'run_full_sync']);
    }
}

register_activation_hook(__FILE__, function () {
    add_option('sendloom_api_url', 'https://sendloom.onrender.com');
    add_option('sendloom_api_key', '');
    add_option('sendloom_store_public_id', '');
    add_option('sendloom_store_id', '');
    add_option('sendloom_environment', 'staging');
    add_option('sendloom_tracking_enabled', 'yes');
    add_option('sendloom_popups_enabled', 'yes');
    add_option('sendloom_debug_mode', 'no');
    add_option('sendloom_last_sync', '');
    add_option('sendloom_last_event', '');
    add_option('sendloom_error_log', []);
});

// Declare compatibility with WooCommerce High-Performance Order Storage and
// block-based cart/checkout. Without these, current WooCommerce flags the
// plugin as incompatible on HPOS stores. All order access already goes
// through the CRUD API (wc_get_order/wc_get_orders), which is HPOS-safe.
add_action('before_woocommerce_init', function () {
    if (class_exists(\Automattic\WooCommerce\Utilities\FeaturesUtil::class)) {
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('custom_order_tables', __FILE__, true);
        \Automattic\WooCommerce\Utilities\FeaturesUtil::declare_compatibility('cart_checkout_blocks', __FILE__, true);
    }
});

add_action('plugins_loaded', ['Sendloom_Plugin', 'init']);
