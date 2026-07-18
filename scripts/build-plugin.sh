#!/bin/bash
# Packages the WooCommerce plugin as an uploadable ZIP.
# Output: plugin-builds/sendloom-woocommerce.zip (contains the plugin folder
# at the archive root, exactly as WordPress expects).
set -euo pipefail
cd "$(dirname "$0")/.."

SRC="wordpress-plugin/sendloom-woocommerce"
OUT_DIR="plugin-builds"
ZIP="$OUT_DIR/sendloom-woocommerce.zip"

[ -f "$SRC/sendloom-woocommerce.php" ] || { echo "ERROR: main plugin file missing"; exit 1; }
grep -q "Plugin Name: Sendloom for WooCommerce" "$SRC/sendloom-woocommerce.php" || { echo "ERROR: plugin header missing"; exit 1; }

# No secrets allowed in the ZIP.
if grep -rEn "slm_live_[a-z0-9_]+|MyoTech123|SESSION_SECRET=" "$SRC" --include='*.php' --include='*.js' --include='*.css' | grep -v "get_option"; then
  echo "ERROR: possible secret found in plugin source — aborting."
  exit 1
fi

mkdir -p "$OUT_DIR"
rm -f "$ZIP"
cd wordpress-plugin
zip -r "../$ZIP" sendloom-woocommerce \
  -x "*/node_modules/*" -x "*/.DS_Store" -x "*/.git*" > /dev/null
cd ..

SIZE=$(du -h "$ZIP" | cut -f1)
echo "Built: $ZIP ($SIZE)"
unzip -l "$ZIP" | head -14
