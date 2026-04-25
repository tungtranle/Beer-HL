#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
chmod +x "$SCRIPT_DIR/import-full-data-from-usb.sh"
bash "$SCRIPT_DIR/import-full-data-from-usb.sh"
echo ""
read -r -p "Nhan Enter de dong cua so..." _
