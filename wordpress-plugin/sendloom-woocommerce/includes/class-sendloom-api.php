<?php
/**
 * HTTP client for the Sendloom API. All requests authenticate with the
 * store's API key via the x-sendloom-key header. Failures are recorded to a
 * rolling error log shown on the settings page.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Sendloom_Api {

    public static function is_connected() {
        return (bool) get_option('sendloom_connected', false);
    }

    public static function base_url() {
        return rtrim(get_option('sendloom_api_url', 'http://localhost:3009'), '/');
    }

    public static function request($method, $path, $body = null) {
        $args = [
            'method'  => $method,
            'timeout' => 10,
            'headers' => [
                'Content-Type'   => 'application/json',
                'x-sendloom-key' => get_option('sendloom_api_key', ''),
            ],
        ];
        if ($body !== null) {
            $json           = wp_json_encode($body);
            $args['body']   = $json;
            // Sign the payload with the store key; Sendloom rejects mismatches.
            $args['headers']['x-sendloom-signature'] = hash_hmac('sha256', $json, get_option('sendloom_api_key', ''));
        }

        $response = wp_remote_request(self::base_url() . $path, $args);

        if (is_wp_error($response)) {
            self::log_error($path, $response->get_error_message());
            return ['ok' => false, 'error' => $response->get_error_message()];
        }

        $code = wp_remote_retrieve_response_code($response);
        $json = json_decode(wp_remote_retrieve_body($response), true);

        if ($code >= 400 || empty($json['ok'])) {
            self::log_error($path, 'HTTP ' . $code . ' · ' . substr(wp_remote_retrieve_body($response), 0, 200));
            return ['ok' => false, 'error' => 'HTTP ' . $code, 'body' => $json];
        }

        return $json;
    }

    public static function health_check() {
        return self::request('GET', '/api/v1/health');
    }

    public static function connect() {
        $result = self::request('POST', '/api/v1/connect', [
            'storeUrl'      => home_url(),
            'pluginVersion' => SENDLOOM_VERSION,
            'wooVersion'    => defined('WC_VERSION') ? WC_VERSION : 'unknown',
        ]);
        update_option('sendloom_connected', !empty($result['ok']));
        if (!empty($result['ok']) && !empty($result['store'])) {
            update_option('sendloom_store_id', $result['store']['id'] ?? '');
            update_option('sendloom_store_public_id', $result['store']['publicId'] ?? '');
            update_option('sendloom_environment', $result['store']['environment'] ?? 'staging');
        }
        return $result;
    }

    public static function send_event($type, $data = []) {
        $event  = array_merge(['type' => $type], $data);
        $result = self::request('POST', '/api/v1/events', $event);
        if (!empty($result['ok'])) {
            update_option('sendloom_last_event', current_time('mysql') . ' · ' . $type);
        }
        return $result;
    }

    public static function send_test_event() {
        return self::send_event('page_viewed', [
            'payload' => (object) ['url' => '/sendloom-test', 'pageType' => 'test', 'note' => 'Sent from WordPress admin Test Event button'],
        ]);
    }

    public static function register_webhooks() {
        if (!class_exists('WC_Webhook')) {
            return ['ok' => false, 'error' => 'WooCommerce webhooks unavailable'];
        }
        // Redundant safety net alongside direct hooks: order updates also
        // arrive via a native WooCommerce webhook.
        $existing = get_option('sendloom_webhook_id', 0);
        if ($existing && wc_get_webhook($existing)) {
            return ['ok' => true, 'note' => 'already registered'];
        }
        $webhook = new WC_Webhook();
        $webhook->set_name('Sendloom order sync');
        $webhook->set_topic('order.updated');
        $webhook->set_delivery_url(self::base_url() . '/api/v1/sync/orders');
        $webhook->set_secret(get_option('sendloom_api_key', ''));
        $webhook->set_status('active');
        $webhook->set_user_id(get_current_user_id());
        $webhook->save();
        update_option('sendloom_webhook_id', $webhook->get_id());
        return ['ok' => true, 'id' => $webhook->get_id()];
    }

    public static function diagnostics() {
        global $wp_version;
        return [
            'plugin_version'  => SENDLOOM_VERSION,
            'endpoint'        => self::base_url(),
            'store_id'        => get_option('sendloom_store_id', ''),
            'store_public_id' => get_option('sendloom_store_public_id', ''),
            'environment'     => get_option('sendloom_environment', 'staging'),
            'domain'          => home_url(),
            'wordpress'       => $wp_version,
            'woocommerce'     => defined('WC_VERSION') ? WC_VERSION : 'not active',
            'php'             => PHP_VERSION,
            'connected'       => self::is_connected() ? 'yes' : 'no',
            'tracking'        => get_option('sendloom_tracking_enabled', 'yes'),
            'popups'          => get_option('sendloom_popups_enabled', 'yes'),
            'debug'           => get_option('sendloom_debug_mode', 'no'),
            'webhook_id'      => get_option('sendloom_webhook_id', 'none'),
            'last_sync'       => get_option('sendloom_last_sync', 'never'),
            'last_event'      => get_option('sendloom_last_event', 'never'),
            'last_errors'     => array_slice(array_reverse(get_option('sendloom_error_log', [])), 0, 3),
        ];
    }

    public static function log_error($context, $message) {
        $log   = get_option('sendloom_error_log', []);
        $log[] = ['time' => current_time('mysql'), 'context' => $context, 'message' => $message];
        update_option('sendloom_error_log', array_slice($log, -50));
    }
}
