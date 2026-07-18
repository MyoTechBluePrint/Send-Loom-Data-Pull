<?php
/**
 * Plugin Name: Sendloom Connect
 * Description: Connects this WooCommerce store to Sendloom — syncs customers, orders, products and behavioural events for email marketing and growth intelligence.
 * Version: 3.0.0
 * Author: Sendloom
 * Requires Plugins: woocommerce
 * License: GPL-2.0+
 * Text Domain: sendloom
 */

if (!defined('ABSPATH')) {
    exit;
}

define('SENDLOOM_VERSION', '3.0.0');
define('SENDLOOM_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-api.php';
require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-events.php';
require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-sync.php';
require_once SENDLOOM_PLUGIN_DIR . 'includes/class-sendloom-admin.php';

class Sendloom_Plugin {

    public static function init() {
        Sendloom_Admin::init();

        // Only hook event/sync listeners when the store is connected.
        if (Sendloom_Api::is_connected()) {
            Sendloom_Events::init();
        }

        add_action('sendloom_run_full_sync', ['Sendloom_Sync', 'run_full_sync']);
    }
}

register_activation_hook(__FILE__, function () {
    add_option('sendloom_api_url', 'http://localhost:3009');
    add_option('sendloom_api_key', '');
    add_option('sendloom_last_sync', '');
    add_option('sendloom_error_log', []);
});

add_action('plugins_loaded', ['Sendloom_Plugin', 'init']);
