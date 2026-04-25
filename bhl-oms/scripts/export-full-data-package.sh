#!/bin/bash
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
BLUE="\033[34m"
NC="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BHL_ROOT="$REPO_ROOT/bhl-oms"

cd "$BHL_ROOT"

if [ -f "./osrm-data/vietnam-latest.osrm" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.simple.yml"
fi

COMPOSE_ARGS=(-f "$COMPOSE_FILE")
if [ -f ".env.prod" ]; then
    COMPOSE_ARGS+=(--env-file ".env.prod")
elif [ -f ".env" ]; then
    COMPOSE_ARGS+=(--env-file ".env")
fi

TIMESTAMP_LOCAL=$(date +%Y%m%dT%H%M%S)
PACKAGE_DIR=${1:-"$REPO_ROOT/usb-sync-${TIMESTAMP_LOCAL}"}
mkdir -p "$PACKAGE_DIR"

echo ""
echo -e "${BOLD}==============================================${NC}"
echo -e "${BOLD}  BHL OMS - EXPORT FULL DATA PACKAGE${NC}"
echo -e "${BOLD}==============================================${NC}"
echo -e "  Output:  ${BLUE}$PACKAGE_DIR${NC}"
echo -e "  Compose: ${BLUE}$COMPOSE_FILE${NC}"
if [ ${#COMPOSE_ARGS[@]} -gt 2 ]; then
    echo -e "  Env:     ${BLUE}${COMPOSE_ARGS[2]}${NC}"
else
    echo -e "  Env:     ${BLUE}(khong dung env file)${NC}"
fi

echo ""
echo "[1/4] Dam bao Postgres dang chay..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres >/dev/null
for i in {1..20}; do
    if docker compose "${COMPOSE_ARGS[@]}" exec -T postgres pg_isready -U bhl >/dev/null 2>&1; then
        break
    fi
    sleep 2
    printf "."
done
echo ""
echo -e "  ${GREEN}OK${NC}"

echo ""
echo "[2/4] Export full database dump..."
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    sh -lc "pg_dump -U bhl -d bhl_prod -Fc" > "$PACKAGE_DIR/full-sync.dump"
echo -e "  ${GREEN}OK${NC} Dump saved: $PACKAGE_DIR/full-sync.dump"

echo ""
echo "[3/4] Copy import script vao package..."
cp "$SCRIPT_DIR/import-full-data-from-usb.sh" "$PACKAGE_DIR/import-full-data-from-usb.sh"
chmod +x "$PACKAGE_DIR/import-full-data-from-usb.sh"
cat > "$PACKAGE_DIR/IMPORT_ON_MAC.command" <<'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
bash "$SCRIPT_DIR/import-full-data-from-usb.sh"
echo ""
read -r -p "Nhan Enter de dong cua so..." _
EOF
chmod +x "$PACKAGE_DIR/IMPORT_ON_MAC.command"
echo -e "  ${GREEN}OK${NC}"

echo ""
echo "[4/4] Ghi huong dan nhanh..."
cat > "$PACKAGE_DIR/README.txt" <<EOF
BHL OMS - USB FULL DATA PACKAGE

Folder nay chua:
- full-sync.dump: full database dump de restore tren Mac mini
- import-full-data-from-usb.sh: script import bang Terminal
- IMPORT_ON_MAC.command: double-click tren Mac de chay import

Cach dung tren Mac mini:
1. Copy ca folder usb-sync-... vao trong repo Beer-HL
2. Chay IMPORT_ON_MAC.command hoac bash import-full-data-from-usb.sh

Luu y:
- Script se backup DB hien tai truoc khi restore
- Script se restore TOAN BO DB bhl_prod
- Sau khi xong, data tren bhl.symper.us se giong may da export package nay
EOF
echo -e "  ${GREEN}OK${NC}"

echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}  EXPORT PACKAGE THANH CONG${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "  Folder: ${BLUE}$PACKAGE_DIR${NC}"
echo -e "  Copy ca folder nay sang Mac mini de import."