<?php
// Clean removal: delete Sendloom options on uninstall. Store data in Sendloom
// itself is untouched — disconnecting a plugin never deletes platform data.
if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

$options = [
    'sendloom_api_url', 'sendloom_api_key', 'sendloom_store_public_id',
    'sendloom_store_id', 'sendloom_environment', 'sendloom_connected',
    'sendloom_tracking_enabled', 'sendloom_popups_enabled', 'sendloom_debug_mode',
    'sendloom_last_sync', 'sendloom_last_event', 'sendloom_error_log',
    'sendloom_webhook_id',
];
foreach ($options as $option) {
    delete_option($option);
}
