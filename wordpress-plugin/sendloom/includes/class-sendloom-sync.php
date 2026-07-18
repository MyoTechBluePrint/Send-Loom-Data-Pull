<?php
/**
 * Batch sync of customers, orders and products to Sendloom. Runs from the
 * settings page ("Sync now") or the sendloom_run_full_sync action (cron-ready).
 */

if (!defined('ABSPATH')) {
    exit;
}

class Sendloom_Sync {

    const BATCH = 100;

    public static function run_full_sync() {
        $results = [
            'customers' => self::sync_customers(),
            'products'  => self::sync_products(),
            'orders'    => self::sync_orders(),
        ];
        update_option('sendloom_last_sync', current_time('mysql'));
        return $results;
    }

    public static function sync_customers() {
        $customers = get_users(['role' => 'customer', 'number' => self::BATCH]);
        $payload   = [];
        foreach ($customers as $user) {
            $wc = new WC_Customer($user->ID);
            $payload[] = [
                'externalId'       => (string) $user->ID,
                'email'            => $user->user_email,
                'firstName'        => $wc->get_first_name(),
                'lastName'         => $wc->get_last_name(),
                'phone'            => $wc->get_billing_phone(),
                'city'             => $wc->get_billing_city(),
                'country'          => $wc->get_billing_country(),
                'postcode'         => $wc->get_billing_postcode(),
                'createdAt'        => $user->user_registered,
                'totalOrders'      => (int) $wc->get_order_count(),
                'totalRevenue'     => (float) $wc->get_total_spent(),
                // Consent is NEVER assumed: only true when the store records an
                // explicit marketing opt-in for this customer.
                'marketingConsent' => get_user_meta($user->ID, 'marketing_opt_in', true) === 'yes',
            ];
        }
        return $payload ? Sendloom_Api::request('POST', '/api/v1/sync/customers', ['customers' => $payload]) : ['ok' => true, 'created' => 0];
    }

    public static function sync_products() {
        $products = wc_get_products(['limit' => self::BATCH]);
        $payload  = [];
        foreach ($products as $product) {
            $payload[] = [
                'externalId' => (string) $product->get_id(),
                'title'      => $product->get_name(),
                'sku'        => $product->get_sku(),
                'price'      => (float) $product->get_regular_price(),
                'salePrice'  => $product->get_sale_price() ? (float) $product->get_sale_price() : null,
                'imageUrl'   => wp_get_attachment_url($product->get_image_id()) ?: null,
                'url'        => get_permalink($product->get_id()),
                'categories' => wp_list_pluck(get_the_terms($product->get_id(), 'product_cat') ?: [], 'name'),
                'inventory'  => $product->get_stock_quantity(),
            ];
        }
        return $payload ? Sendloom_Api::request('POST', '/api/v1/sync/products', ['products' => $payload]) : ['ok' => true, 'upserted' => 0];
    }

    public static function sync_orders() {
        $orders  = wc_get_orders(['limit' => self::BATCH, 'orderby' => 'date', 'order' => 'DESC']);
        $payload = [];
        foreach ($orders as $order) {
            $payload[] = self::order_payload($order);
        }
        return $payload ? Sendloom_Api::request('POST', '/api/v1/sync/orders', ['orders' => $payload]) : ['ok' => true, 'upserted' => 0];
    }

    public static function push_order($order_id) {
        $order = wc_get_order($order_id);
        if (!$order) {
            return;
        }
        Sendloom_Api::request('POST', '/api/v1/sync/orders', ['orders' => [self::order_payload($order)]]);
    }

    private static function order_payload($order) {
        $items = [];
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            $items[] = [
                'externalProductId' => (string) $item->get_product_id(),
                'title'             => $item->get_name(),
                'qty'               => (int) $item->get_quantity(),
                'price'             => (float) $order->get_item_total($item),
                'categories'        => $product ? wp_list_pluck(get_the_terms($product->get_id(), 'product_cat') ?: [], 'name') : [],
            ];
        }
        $coupons = $order->get_coupon_codes();
        return [
            'externalId'    => (string) $order->get_id(),
            'number'        => (string) $order->get_order_number(),
            'status'        => $order->get_status(),
            'email'         => $order->get_billing_email(),
            'total'         => (float) $order->get_total(),
            'tax'           => (float) $order->get_total_tax(),
            'shipping'      => (float) $order->get_shipping_total(),
            'discount'      => (float) $order->get_total_discount(),
            'coupon'        => $coupons ? $coupons[0] : null,
            'paymentMethod' => $order->get_payment_method_title(),
            'placedAt'      => $order->get_date_created() ? $order->get_date_created()->format('c') : null,
            'items'         => $items,
        ];
    }
}
