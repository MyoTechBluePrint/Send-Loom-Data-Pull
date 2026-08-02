<?php
/**
 * Coupon consumer (plugin >= 4.5).
 *
 * Sendloom generates unique per-customer codes at send time; this class pulls
 * the pending jobs on an hourly cron, creates them as WooCommerce coupons
 * with the full restriction set, and confirms each result back so Sendloom
 * shows honest pushed/failed states. Everything is idempotent: a coupon that
 * already exists locally is confirmed, never duplicated.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Sendloom_Coupons {

    const CRON_HOOK = 'sendloom_pull_coupons';

    public static function init() {
        add_action(self::CRON_HOOK, [__CLASS__, 'pull_and_create']);
        if (!wp_next_scheduled(self::CRON_HOOK)) {
            wp_schedule_event(time() + 300, 'hourly', self::CRON_HOOK);
        }
    }

    public static function deactivate() {
        wp_clear_scheduled_hook(self::CRON_HOOK);
    }

    /** Pull pending coupon jobs, create them in Woo, confirm results. */
    public static function pull_and_create() {
        if (!Sendloom_Api::is_connected() || !class_exists('WC_Coupon')) {
            return;
        }

        $response = Sendloom_Api::request('GET', '/api/v1/sync/coupons');
        if (is_wp_error($response) || empty($response['coupons']) || !is_array($response['coupons'])) {
            return;
        }

        $confirmed = [];
        foreach ($response['coupons'] as $job) {
            $confirmed[] = self::create_coupon($job);
        }

        if ($confirmed) {
            Sendloom_Api::request('POST', '/api/v1/sync/coupons', ['confirmed' => $confirmed]);
        }
    }

    /** @return array{id:string, ok:bool, externalId?:string, error?:string} */
    private static function create_coupon($job) {
        $code = isset($job['code']) ? sanitize_text_field($job['code']) : '';
        $id   = isset($job['id']) ? sanitize_text_field($job['id']) : '';
        if ($code === '' || $id === '') {
            return ['id' => $id, 'ok' => false, 'error' => 'Malformed job'];
        }

        // Idempotency: an existing coupon with this code is a success, not a
        // duplicate attempt.
        $existing_id = wc_get_coupon_id_by_code($code);
        if ($existing_id) {
            return ['id' => $id, 'ok' => true, 'externalId' => (string) $existing_id];
        }

        try {
            $coupon = new WC_Coupon();
            $coupon->set_code($code);

            $kind = isset($job['kind']) ? $job['kind'] : 'percent';
            if ($kind === 'free_shipping') {
                $coupon->set_discount_type('fixed_cart');
                $coupon->set_amount(0);
                $coupon->set_free_shipping(true);
            } else {
                $coupon->set_discount_type($kind === 'fixed' ? 'fixed_cart' : 'percent');
                $coupon->set_amount(isset($job['amount']) ? floatval($job['amount']) : 0);
            }

            if (!empty($job['expiresAt'])) {
                $coupon->set_date_expires(strtotime($job['expiresAt']));
            }
            if (!empty($job['usageLimit'])) {
                $coupon->set_usage_limit(intval($job['usageLimit']));
            }
            if (!empty($job['usageLimitPerCustomer'])) {
                $coupon->set_usage_limit_per_user(intval($job['usageLimitPerCustomer']));
            }
            if (!empty($job['minSpend'])) {
                $coupon->set_minimum_amount(floatval($job['minSpend']));
            }
            if (!empty($job['maxSpend'])) {
                $coupon->set_maximum_amount(floatval($job['maxSpend']));
            }
            if (!empty($job['individualUse'])) {
                $coupon->set_individual_use(true);
            }
            if (!empty($job['email']) && is_email($job['email'])) {
                $coupon->set_email_restrictions([sanitize_email($job['email'])]);
            }

            $coupon->update_meta_data('_sendloom_coupon', $id);
            $coupon->save();

            return ['id' => $id, 'ok' => true, 'externalId' => (string) $coupon->get_id()];
        } catch (Exception $e) {
            return ['id' => $id, 'ok' => false, 'error' => substr($e->getMessage(), 0, 200)];
        }
    }
}
