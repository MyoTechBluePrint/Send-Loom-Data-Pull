<?php
/**
 * Settings screen: WooCommerce → Sendloom. Written so a store owner can
 * connect and verify everything without a developer.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Sendloom_Admin {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_sendloom_save', [__CLASS__, 'handle_save']);
        add_action('admin_post_sendloom_action', [__CLASS__, 'handle_action']);
    }

    public static function menu() {
        add_submenu_page('woocommerce', 'Sendloom', 'Sendloom', 'manage_woocommerce', 'sendloom', [__CLASS__, 'render']);
    }

    public static function handle_save() {
        check_admin_referer('sendloom_save');
        update_option('sendloom_api_url', esc_url_raw(wp_unslash($_POST['sendloom_api_url'] ?? '')));
        update_option('sendloom_api_key', sanitize_text_field(wp_unslash($_POST['sendloom_api_key'] ?? '')));
        update_option('sendloom_tracking_enabled', isset($_POST['sendloom_tracking_enabled']) ? 'yes' : 'no');
        update_option('sendloom_popups_enabled', isset($_POST['sendloom_popups_enabled']) ? 'yes' : 'no');
        update_option('sendloom_debug_mode', isset($_POST['sendloom_debug_mode']) ? 'yes' : 'no');
        $result = Sendloom_Api::connect();
        wp_safe_redirect(admin_url('admin.php?page=sendloom&sendloom_msg=' . (!empty($result['ok']) ? 'connected' : 'connect_failed')));
        exit;
    }

    public static function handle_action() {
        check_admin_referer('sendloom_action');
        $action = sanitize_key(wp_unslash($_POST['sendloom_do'] ?? ''));
        $msg    = 'done';
        switch ($action) {
            case 'test_connection':
                $health = Sendloom_Api::health_check();
                $msg    = (!empty($health['ok']) && !empty($health['authenticated'])) ? 'connection_ok' : 'connection_failed';
                break;
            case 'test_event':
                $r   = Sendloom_Api::send_test_event();
                $msg = !empty($r['ok']) ? 'event_sent' : 'event_failed';
                break;
            case 'sync_products':
                Sendloom_Sync::sync_products();
                update_option('sendloom_last_sync', current_time('mysql'));
                $msg = 'synced_products';
                break;
            case 'sync_customers':
                Sendloom_Sync::sync_customers();
                update_option('sendloom_last_sync', current_time('mysql'));
                $msg = 'synced_customers';
                break;
            case 'sync_orders':
                Sendloom_Sync::sync_orders();
                update_option('sendloom_last_sync', current_time('mysql'));
                $msg = 'synced_orders';
                break;
            case 'clear_log':
                update_option('sendloom_error_log', []);
                $msg = 'log_cleared';
                break;
        }
        wp_safe_redirect(admin_url('admin.php?page=sendloom&sendloom_msg=' . $msg));
        exit;
    }

    private static function notice($msg) {
        $map = [
            'connected'         => ['success', 'Connected to Sendloom. Store ID and tracking ID saved automatically.'],
            'connect_failed'    => ['error', 'Connection failed. Check the Sendloom endpoint URL, the API key (this store\'s key, not the other store\'s) and the error log below.'],
            'connection_ok'     => ['success', 'Connection test passed.'],
            'connection_failed' => ['error', 'Connection test failed. See the error log below.'],
            'event_sent'        => ['success', 'Test event sent. Now open Sendloom Store Tracking and filter by this store; it should appear within a minute.'],
            'event_failed'      => ['error', 'Test event failed. See the error log below.'],
            'synced_products'   => ['success', 'Products synced.'],
            'synced_customers'  => ['success', 'Customers synced.'],
            'synced_orders'     => ['success', 'Orders synced.'],
            'log_cleared'       => ['success', 'Debug log cleared.'],
        ];
        if (isset($map[$msg])) {
            printf('<div class="notice notice-%s"><p>%s</p></div>', esc_attr($map[$msg][0]), esc_html($map[$msg][1]));
        }
    }

    private static function action_button($do, $label, $disabled = false) {
        ?>
        <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline-block;margin:0 6px 6px 0;">
            <?php wp_nonce_field('sendloom_action'); ?>
            <input type="hidden" name="action" value="sendloom_action" />
            <input type="hidden" name="sendloom_do" value="<?php echo esc_attr($do); ?>" />
            <button type="submit" class="button" <?php disabled($disabled); ?>><?php echo esc_html($label); ?></button>
        </form>
        <?php
    }

    public static function render() {
        $diag      = Sendloom_Api::diagnostics();
        $connected = $diag['connected'] === 'yes';
        $errors    = array_reverse(get_option('sendloom_error_log', []));
        self::notice(sanitize_key(wp_unslash($_GET['sendloom_msg'] ?? '')));
        ?>
        <div class="wrap">
            <h1>Sendloom for WooCommerce</h1>
            <p style="max-width:640px;">Connects this store to Sendloom: behaviour tracking, abandoned cart &amp; checkout recovery, popups and data sync. Environment: <strong><?php echo esc_html($diag['environment']); ?></strong><?php if ($diag['environment'] === 'staging') : ?> — no live marketing emails are sent from staging.<?php endif; ?></p>

            <h2 style="margin-top:20px;">Status</h2>
            <table class="widefat striped" style="max-width:720px;">
                <tbody>
                    <tr><td style="width:220px;"><strong>Connection</strong></td><td><?php echo $connected ? '<span style="color:#008a20;">● Connected</span>' : '<span style="color:#d63638;">● Not connected</span>'; ?></td></tr>
                    <tr><td><strong>Storefront domain</strong></td><td>
                        <?php
                        $sendloom_host = preg_replace('#^https?://(www\.)?#', '', home_url());
                        $sendloom_host = strtolower(explode('/', $sendloom_host)[0]);
                        echo '<code>' . esc_html($sendloom_host) . '</code>';
                        if (preg_match('/^(api|admin|backend|staging|dev)\./', $sendloom_host)) {
                            echo '<p style="color:#d63638;margin:6px 0 0;"><strong>This looks like a backend or API domain.</strong> Customer behaviour should be tracked on the public storefront domain (for example myotech.store). The tracker only loads on pages this WordPress serves; if customers browse a separate storefront, tracking must be added to that site instead.</p>';
                        }
                        ?>
                    </td></tr>
                    <tr><td><strong>Store ID</strong></td><td><code><?php echo esc_html($diag['store_id'] ?: '—'); ?></code></td></tr>
                    <tr><td><strong>Tracking ID (public)</strong></td><td><code><?php echo esc_html($diag['store_public_id'] ?: '—'); ?></code></td></tr>
                    <tr><td><strong>Tracker</strong></td><td><?php echo $connected && $diag['tracking'] === 'yes' ? 'Active on storefront' : 'Off'; ?></td></tr>
                    <tr><td><strong>Popups</strong></td><td><?php echo $connected && $diag['popups'] === 'yes' ? 'Active' : 'Off'; ?></td></tr>
                    <tr><td><strong>Last sync</strong></td><td><?php echo esc_html($diag['last_sync']); ?></td></tr>
                    <tr><td><strong>Last event sent</strong></td><td><?php echo esc_html($diag['last_event']); ?></td></tr>
                    <tr><td><strong>Versions</strong></td><td>Plugin <?php echo esc_html($diag['plugin_version']); ?> · WordPress <?php echo esc_html($diag['wordpress']); ?> · WooCommerce <?php echo esc_html($diag['woocommerce']); ?> · PHP <?php echo esc_html($diag['php']); ?></td></tr>
                </tbody>
            </table>

            <h2 style="margin-top:24px;">Connection</h2>
            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="max-width:720px;">
                <?php wp_nonce_field('sendloom_save'); ?>
                <input type="hidden" name="action" value="sendloom_save" />
                <table class="form-table">
                    <tr>
                        <th><label for="sendloom_api_url">Sendloom endpoint</label></th>
                        <td><input type="url" class="regular-text" id="sendloom_api_url" name="sendloom_api_url" value="<?php echo esc_attr(get_option('sendloom_api_url')); ?>" placeholder="https://sendloom.onrender.com" /></td>
                    </tr>
                    <tr>
                        <th><label for="sendloom_api_key">API key</label></th>
                        <td>
                            <input type="password" class="regular-text" id="sendloom_api_key" name="sendloom_api_key" value="<?php echo esc_attr(get_option('sendloom_api_key')); ?>" autocomplete="new-password" />
                            <p class="description">From Sendloom → Settings → Store Tracking. Store ID and Tracking ID fill in automatically after connecting. Use the public website domain customers visit, for example myotech.store. Do not use an API/admin/backend domain.</p>
                        </td>
                    </tr>
                    <tr>
                        <th>Features</th>
                        <td>
                            <label><input type="checkbox" name="sendloom_tracking_enabled" <?php checked(get_option('sendloom_tracking_enabled', 'yes'), 'yes'); ?> /> Behaviour tracking</label><br />
                            <label><input type="checkbox" name="sendloom_popups_enabled" <?php checked(get_option('sendloom_popups_enabled', 'yes'), 'yes'); ?> /> Popups</label><br />
                            <label><input type="checkbox" name="sendloom_debug_mode" <?php checked(get_option('sendloom_debug_mode', 'no'), 'yes'); ?> /> Debug mode (console logging)</label>
                        </td>
                    </tr>
                </table>
                <p><button type="submit" class="button button-primary">Save &amp; connect</button></p>
            </form>

            <h2 style="margin-top:24px;">Actions</h2>
            <?php
            self::action_button('test_connection', 'Test connection');
            self::action_button('test_event', 'Send test event', !$connected);
            self::action_button('sync_products', 'Sync products', !$connected);
            self::action_button('sync_customers', 'Sync customers', !$connected);
            self::action_button('sync_orders', 'Sync orders', !$connected);
            self::action_button('clear_log', 'Clear debug log');
            ?>
            <p style="margin-top:8px;"><a class="button" href="<?php echo esc_url(Sendloom_Api::base_url() . '/tracking'); ?>" target="_blank" rel="noopener">Open Sendloom Store Tracking ↗</a> <span class="description">Watch events arrive live while you test.</span></p>

            <h2 style="margin-top:24px;">Store diagnostics <small>(copy this when reporting a problem)</small></h2>
            <textarea id="sendloom-diag" readonly rows="6" style="width:100%;max-width:720px;font-family:monospace;font-size:11px;" onclick="this.select()"><?php echo esc_textarea(wp_json_encode($diag, JSON_PRETTY_PRINT)); ?></textarea>
            <p><button type="button" class="button" onclick="var t=document.getElementById('sendloom-diag');t.select();document.execCommand('copy');this.textContent='Copied';">Copy diagnostics</button> <span class="description">Safe to share: contains no API key.</span></p>

            <h2 style="margin-top:24px;">Error log</h2>
            <?php if (empty($errors)) : ?>
                <p>No errors recorded.</p>
            <?php else : ?>
                <table class="widefat striped" style="max-width:900px;">
                    <thead><tr><th style="width:160px;">Time</th><th style="width:200px;">Context</th><th>Message</th></tr></thead>
                    <tbody>
                        <?php foreach (array_slice($errors, 0, 20) as $e) : ?>
                            <tr>
                                <td><?php echo esc_html($e['time']); ?></td>
                                <td><code><?php echo esc_html($e['context']); ?></code></td>
                                <td><?php echo esc_html($e['message']); ?></td>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            <?php endif; ?>
        </div>
        <?php
    }
}
