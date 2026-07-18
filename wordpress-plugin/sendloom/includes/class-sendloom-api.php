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
            $args['body'] = wp_json_encode($body);
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
        return $result;
    }

    public static function send_event($type, $data = []) {
        $event = array_merge(['type' => $type], $data);
        return self::request('POST', '/api/v1/events', $event);
    }

    public static function log_error($context, $message) {
        $log   = get_option('sendloom_error_log', []);
        $log[] = ['time' => current_time('mysql'), 'context' => $context, 'message' => $message];
        update_option('sendloom_error_log', array_slice($log, -50));
    }
}
