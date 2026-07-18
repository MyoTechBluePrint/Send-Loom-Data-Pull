<?php
/**
 * Plugin Name: Sendloom for WooCommerce
 * Plugin URI: https://sendloom.onrender.com
 * Description: Connects this WooCommerce store to Sendloom — behaviour tracking, abandoned cart & checkout recovery, popups, and customer/order/product sync.
 * Version: 4.0.0
 * Author: Sendloom
 * Requires at least: 6.4
 * Requires PHP: 8.0
 * Requires Plugins: woocommerce
 * License: GPL-2.0+
 * Text Domain: sendloom
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SENDLOOM_VERSION', '4.0.0');
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

add_action('plugins_loaded', ['Sendloom_Plugin', 'init']);
