#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_URL="${1:-$(git -C "$SCRIPT_DIR" remote get-url origin 2>/dev/null || true)}"

echo "=============================================="
echo "  BHL OMS - Enable Auto Deploy on Push"
echo "=============================================="
echo ""

if [ -z "$REPO_URL" ]; then
  echo "ERROR: Khong xac dinh duoc repo GitHub."
  echo "Chay: bash enable-auto-deploy.sh https://github.com/<owner>/<repo>"
  exit 1
fi

echo "[1/3] Cai dat / cap nhat self-hosted runner"
bash "$SCRIPT_DIR/setup-runner.sh" "$REPO_URL"

echo ""
echo "[2/3] Kiem tra file production local tren server"

if [ -f "$SCRIPT_DIR/bhl-oms/.env.prod" ]; then
  echo "  OK bhl-oms/.env.prod"
elif [ -f "$SCRIPT_DIR/bhl-oms/.env" ]; then
  echo "  OK bhl-oms/.env"
else
  echo "  WARN chua co bhl-oms/.env.prod hoac bhl-oms/.env"
fi

if [ -f "$SCRIPT_DIR/bhl-oms/keys/private.pem" ] && [ -f "$SCRIPT_DIR/bhl-oms/keys/public.pem" ]; then
  echo "  OK bhl-oms/keys"
else
  echo "  WARN chua co bhl-oms/keys/private.pem va public.pem"
fi

echo ""
echo "[3/3] Huong dan test"
echo "  1. Tren GitHub, vao repo -> Actions -> 'Auto Deploy to Production'"
echo "  2. Dam bao runner 'mac-mini-prod' dang online"
echo "  3. Tu gio chi can push len nhanh master la workflow tu deploy"
echo ""
echo "Neu muon kich tay 1 lan de test:"
echo "  GitHub -> Actions -> Auto Deploy to Production -> Run workflow"
echo ""
