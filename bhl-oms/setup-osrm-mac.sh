#!/bin/bash
# ============================================================
# BHL OMS — Setup OSRM data trên Mac Mini
# Download Vietnam OSM data và process cho OSRM MLD algorithm
# Chạy 1 lần duy nhất. Mất 10-30 phút.
# Usage: bash setup-osrm-mac.sh
# ============================================================
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
BLUE="\033[34m"
NC="\033[0m"

# Detect app dir — always resolve to real bhl-oms directory
if [ -n "${BHL_DEPLOY_DIR:-}" ]; then
    APP_DIR="$BHL_DEPLOY_DIR"
elif [ -f "$(pwd)/docker-compose.prod.yml" ]; then
    APP_DIR="$(pwd)"
else
    # Find upward from script location
    SEARCH="$(cd "$(dirname "$0")" && pwd)"
    APP_DIR=""
    while [ "$SEARCH" != "/" ]; do
        if [ -f "$SEARCH/docker-compose.prod.yml" ]; then
            APP_DIR="$SEARCH"
            break
        fi
        SEARCH="$(dirname "$SEARCH")"
    done
    if [ -z "$APP_DIR" ]; then
        echo -e "${RED}[✗] Không tìm thấy docker-compose.prod.yml. Set BHL_DEPLOY_DIR.${NC}"
        exit 1
    fi
fi

DATA_DIR="$APP_DIR/osrm-data"
OSRM_IMAGE="osrm/osrm-backend:latest"
PBF_URL="https://download.geofabrik.de/asia/vietnam-latest.osm.pbf"
PBF_FILE="vietnam-latest.osm.pbf"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   BHL OMS — OSRM Data Setup                 ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Data dir: ${BLUE}$DATA_DIR${NC}"
echo ""

# Tạo thư mục data nếu chưa có
mkdir -p "$DATA_DIR"

# Check xem data đã có chưa
if [ -f "$DATA_DIR/vietnam-latest.osrm" ]; then
    # Kiểm tra các file quan trọng
    MISSING=false
    for f in geometry turn_weight_penalties turn_duration_penalties names properties; do
        if [ ! -f "$DATA_DIR/vietnam-latest.osrm.$f" ]; then
            echo -e "  ${YELLOW}! Thiếu: vietnam-latest.osrm.$f${NC}"
            MISSING=true
        fi
    done
    if [ "$MISSING" = "false" ]; then
        echo -e "${GREEN}[✓] OSRM data đã sẵn sàng!${NC}"
        exit 0
    fi
    echo -e "  ${YELLOW}→ Data không đầy đủ, tải lại...${NC}"
fi

# Tải Vietnam PBF nếu chưa có
if [ ! -f "$DATA_DIR/$PBF_FILE" ]; then
    echo -e "${BOLD}[1/4] Đang tải Vietnam OSM data (~120MB)...${NC}"
    curl -L --progress-bar -o "$DATA_DIR/$PBF_FILE" "$PBF_URL"
    echo -e "${GREEN}[✓] Tải xong${NC}"
else
    echo -e "${YELLOW}[1/4] File PBF đã có sẵn${NC}"
fi

# Tạo stub docker credential helper (bypass keychain)
STUB_DIR="/tmp/osrm-stub-bin.$$"
mkdir -p "$STUB_DIR"
cat > "$STUB_DIR/docker-credential-desktop" <<'STUB'
#!/bin/bash
case "$1" in
  get) echo '{"ServerURL":"","Username":"","Secret":""}' ;;
  *) echo '{}' ;;
esac
exit 0
STUB
chmod +x "$STUB_DIR/docker-credential-desktop"

cleanup() {
    rm -rf "$STUB_DIR" 2>/dev/null || true
}
trap cleanup EXIT

# Helper: tạo DOCKER_CONFIG không có credsStore (bypass keychain)
make_docker_cfg() {
    local tmpdir
    tmpdir="$(mktemp -d)"
    cat > "$tmpdir/config.json" <<EOF
{
  "auths": {},
  "currentContext": "default",
  "cliPluginsExtraDirs": [
    "/opt/homebrew/lib/docker/cli-plugins",
    "/usr/local/lib/docker/cli-plugins"
  ]
}
EOF
    echo "$tmpdir"
}

# Pull OSRM image
echo ""
echo -e "${BOLD}[2/4] Pull OSRM Docker image...${NC}"
DCFG="$(make_docker_cfg)"
PATH="$STUB_DIR:$PATH" DOCKER_CONFIG="$DCFG" docker pull "$OSRM_IMAGE" 2>&1 | tail -5
rm -rf "$DCFG"
echo -e "${GREEN}[✓] Image ready${NC}"

# Extract
echo ""
echo -e "${BOLD}[3/4] Extract road network (5-10 phút)...${NC}"
PATH="$STUB_DIR:$PATH" docker run --rm \
    --platform linux/amd64 \
    -v "$DATA_DIR:/data" \
    "$OSRM_IMAGE" \
    osrm-extract -p /opt/car.lua "/data/$PBF_FILE"
echo ""

# Partition
echo -e "  ${BLUE}→${NC} Partition (5-10 phút)..."
PATH="$STUB_DIR:$PATH" docker run --rm \
    --platform linux/amd64 \
    -v "$DATA_DIR:/data" \
    "$OSRM_IMAGE" \
    osrm-partition "/data/vietnam-latest.osrm"

# Customize
echo -e "  ${BLUE}→${NC} Customize (2-5 phút)..."
PATH="$STUB_DIR:$PATH" docker run --rm \
    --platform linux/amd64 \
    -v "$DATA_DIR:/data" \
    "$OSRM_IMAGE" \
    osrm-customize "/data/vietnam-latest.osrm"

echo ""
echo -e "${GREEN}[✓] OSRM data đã xử lý xong!${NC}"
echo ""

# Restart OSRM container
echo -e "${BOLD}[4/4] Khởi động lại OSRM container...${NC}"
DCFG2="$(make_docker_cfg)"
PATH="$STUB_DIR:$PATH" DOCKER_CONFIG="$DCFG2" docker compose \
    -f "$APP_DIR/docker-compose.prod.yml" \
    --env-file "$APP_DIR/.env.prod" \
    restart osrm 2>&1 | tail -5
rm -rf "$DCFG2"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   OSRM đã sẵn sàng!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════╝${NC}"
echo ""
