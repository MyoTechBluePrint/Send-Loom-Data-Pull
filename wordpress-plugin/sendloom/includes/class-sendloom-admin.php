<?php
/**
 * Settings page under WooCommerce → Sendloom: API key, connection status,
 * manual sync, health check and the error log.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Sendloom_Admin {

    public static function init() {
        add_action('admin_menu', [__CLASS__, 'menu']);
        add_action('admin_post_sendloom_save', [__CLASS__, 'handle_save']);
        add_action('admin_post_sendloom_sync', [__CLASS__, 'handle_sync']);
    }

    public static function menu() {
        add_submenu_page(
            'woocommerce',
            'Sendloom',
            'Sendloom',
            'manage_woocommerce',
            'sendloom',
            [__CLASS__, 'render']
        );
    }

    public static function handle_save() {
        check_admin_referer('sendloom_save');
        update_option('sendloom_api_url', esc_url_raw(wp_unslash($_POST['sendloom_api_url'] ?? '')));
        update_option('sendloom_api_key', sanitize_text_field(wp_unslash($_POST['sendloom_api_key'] ?? '')));
        $result = Sendloom_Api::connect();
        $flag   = !empty($result['ok']) ? 'connected' : 'connect_failed';
        wp_safe_redirect(admin_url('admin.php?page=sendloom&sendloom_msg=' . $flag));
        exit;
    }

    public static function handle_sync() {
        check_admin_referer('sendloom_sync');
        Sendloom_Sync::run_full_sync();
        wp_safe_redirect(admin_url('admin.php?page=sendloom&sendloom_msg=synced'));
        exit;
    }

    public static function render() {
        $health    = Sendloom_Api::health_check();
        $connected = !empty($health['ok']) && !empty($health['authenticated']);
        $last_sync = get_option('sendloom_last_sync', '');
        $errors    = array_reverse(get_option('sendloom_error_log', []));
        $msg       = sanitize_text_field(wp_unslash($_GET['sendloom_msg'] ?? ''));
        ?>
        <div class="wrap">
            <h1>Sendloom Connect</h1>

            <?php if ($msg === 'connected') : ?>
                <div class="notice notice-success"><p>Connected to Sendloom.</p></div>
            <?php elseif ($msg === 'connect_failed') : ?>
                <div class="notice notice-error"><p>Connection failed. Check the API URL and key, then see the error log below.</p></div>
            <?php elseif ($msg === 'synced') : ?>
                <div class="notice notice-success"><p>Manual sync completed.</p></div>
            <?php endif; ?>

            <table class="widefat striped" style="max-width:680px;margin-bottom:20px;">
                <tbody>
                    <tr>
                        <td><strong>Connection status</strong></td>
                        <td><?php echo $connected ? '<span style="color:#008a20;">● Connected</span>' : '<span style="color:#d63638;">● Not connected</span>'; ?></td>
                    </tr>
                    <tr>
                        <td><strong>Store</strong></td>
                        <td><?php echo $connected ? esc_html($health['store']['name']) : '—'; ?></td>
                    </tr>
                    <tr>
                        <td><strong>Last manual sync</strong></td>
                        <td><?php echo $last_sync ? esc_html($last_sync) : 'Never'; ?></td>
                    </tr>
                    <tr>
                        <td><strong>Store identifier</strong></td>
                        <td><code><?php echo $connected ? esc_html($health['store']['id']) : '—'; ?></code></td>
                    </tr>
                </tbody>
            </table>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="max-width:680px;">
                <?php wp_nonce_field('sendloom_save'); ?>
                <input type="hidden" name="action" value="sendloom_save" />
                <table class="form-table">
                    <tr>
                        <th><label for="sendloom_api_url">Sendloom URL</label></th>
                        <td><input type="url" class="regular-text" id="sendloom_api_url" name="sendloom_api_url" value="<?php echo esc_attr(get_option('sendloom_api_url')); ?>" placeholder="https://app.sendloom.com" /></td>
                    </tr>
                    <tr>
                        <th><label for="sendloom_api_key">API key</label></th>
                        <td>
                            <input type="password" class="regular-text" id="sendloom_api_key" name="sendloom_api_key" value="<?php echo esc_attr(get_option('sendloom_api_key')); ?>" />
                            <p class="description">Find this under Settings → API &amp; webhooks in Sendloom.</p>
                        </td>
                    </tr>
                </table>
                <p><button type="submit" class="button button-primary">Save &amp; connect</button></p>
            </form>

            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                <?php wp_nonce_field('sendloom_sync'); ?>
                <input type="hidden" name="action" value="sendloom_sync" />
                <p><button type="submit" class="button" <?php disabled(!$connected); ?>>Sync now (customers · products · orders)</button></p>
            </form>

            <h2>Error log</h2>
            <?php if (empty($errors)) : ?>
                <p>No errors recorded.</p>
            <?php else : ?>
                <table class="widefat striped" style="max-width:900px;">
                    <thead><tr><th style="width:160px;">Time</th><th style="width:220px;">Context</th><th>Message</th></tr></thead>
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
