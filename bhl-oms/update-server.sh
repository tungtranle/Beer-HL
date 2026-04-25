#!/bin/bash
# ============================================================
# BHL OMS — Cập nhật server (chạy trên Mac Mini)
# Chỉ làm: git pull + migrations mới + restart
# KHÔNG reset data, KHÔNG xóa users
# Usage: bash update-server.sh
# ============================================================
set -euo pipefail

export PATH="/opt/homebrew/bin:/usr/local/bin:/Applications/Docker.app/Contents/Resources/bin:$PATH"

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
BLUE="\033[34m"
NC="\033[0m"

if [ -n "${BHL_DEPLOY_DIR:-}" ]; then
    APP_DIR="$BHL_DEPLOY_DIR"
elif [ -f "$(pwd)/docker-compose.prod.yml" ] || [ -f "$(pwd)/docker-compose.simple.yml" ]; then
    APP_DIR="$(pwd)"
else
    APP_DIR="$(cd "$(dirname "$0")" && pwd)"
fi

SEARCH_DIR="$APP_DIR"
GIT_DIR=""
while [ "$SEARCH_DIR" != "/" ]; do
    if [ -d "$SEARCH_DIR/.git" ]; then
        GIT_DIR="$SEARCH_DIR"
        break
    fi
    SEARCH_DIR="$(dirname "$SEARCH_DIR")"
done

if [ -z "$GIT_DIR" ]; then
    echo -e "${RED}[✗] Không tìm thấy git repository từ APP_DIR=$APP_DIR${NC}"
    exit 1
fi

if ! command -v git >/dev/null 2>&1; then
    echo -e "${RED}[✗] Không tìm thấy lệnh git trong PATH=$PATH${NC}"
    exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
    echo -e "${RED}[✗] Không tìm thấy lệnh docker trong PATH=$PATH${NC}"
    exit 1
fi

# Helper: chay docker compose build/up khong dung credsStore (tranh keychain locked qua SSH)
docker_compose_build() {
    local tmp_cfg
    tmp_cfg="$(mktemp -d)"
    if [ -d "$HOME/.docker/contexts" ]; then
        cp -R "$HOME/.docker/contexts" "$tmp_cfg/contexts"
    fi
    local cur_ctx
    cur_ctx="$(grep -o '"currentContext"[[:space:]]*:[[:space:]]*"[^"]*"' "$HOME/.docker/config.json" 2>/dev/null | sed 's/.*"\([^"]*\)"$/\1/')"
    if [ -z "$cur_ctx" ]; then cur_ctx="default"; fi
    cat > "$tmp_cfg/config.json" <<EOF
{
  "auths": {},
  "currentContext": "$cur_ctx",
  "cliPluginsExtraDirs": [
    "/opt/homebrew/lib/docker/cli-plugins",
    "/usr/local/lib/docker/cli-plugins"
  ]
}
EOF
    DOCKER_CONFIG="$tmp_cfg" docker compose "$@"
    local rc=$?
    rm -rf "$tmp_cfg"
    return $rc
}

cd "$APP_DIR"

# Tự phát hiện compose file
if [ -f "./osrm-data/vietnam-latest.osrm" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.simple.yml"
fi

# Tự phát hiện env file
if [ -f ".env.prod" ]; then
    ENV_FILE=".env.prod"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
else
    cat > .env.prod <<'EOF'
DB_PASSWORD=
GRAFANA_PASSWORD=
SENTRY_DSN=
BRAVO_URL=
BRAVO_API_KEY=
DMS_URL=
DMS_API_KEY=
ZALO_BASE_URL=
ZALO_OA_TOKEN=
ZALO_OA_ID=
INTEGRATION_MOCK=false
ENABLE_TEST_PORTAL=false
EOF
    ENV_FILE=".env.prod"
    echo -e "${YELLOW}[!] Không tìm thấy .env.prod hoặc .env — đã tự tạo .env.prod tối thiểu${NC}"
fi

BUILD_COMMIT_SHA=$(git -C "$GIT_DIR" rev-parse HEAD)
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)
BUILD_BRANCH=$(git -C "$GIT_DIR" branch --show-current)
export BUILD_COMMIT_SHA BUILD_TIME BUILD_BRANCH

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   BHL OMS — Cập nhật Server                 ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  App dir:  ${BLUE}$APP_DIR${NC}"
echo -e "  Git dir:  ${BLUE}$GIT_DIR${NC}"
echo -e "  Compose: ${BLUE}$COMPOSE_FILE${NC}"
echo -e "  Env:     ${BLUE}$ENV_FILE${NC}"
echo ""

# ─── BƯỚC 1: Git pull ───────────────────────────────────────
echo -e "${BOLD}[1/5] Lấy code mới từ GitHub...${NC}"
SCRIPT_REPO_PATH="$(realpath --relative-to="$GIT_DIR" "$APP_DIR/update-server.sh" 2>/dev/null || true)"
if [ -n "$SCRIPT_REPO_PATH" ] && ! git -C "$GIT_DIR" diff --quiet -- "$SCRIPT_REPO_PATH" >/dev/null 2>&1; then
    echo -e "  ${YELLOW}→ Phát hiện thay đổi cục bộ ở $SCRIPT_REPO_PATH, tự khôi phục trước khi pull${NC}"
    git -C "$GIT_DIR" checkout -- "$SCRIPT_REPO_PATH"
fi
BEFORE=$(git -C "$GIT_DIR" rev-parse --short HEAD)
git -C "$GIT_DIR" pull origin master 2>&1 | tail -5
AFTER=$(git -C "$GIT_DIR" rev-parse --short HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
    echo -e "  ${YELLOW}→ Không có code mới ($BEFORE)${NC}"
else
    echo -e "  ${GREEN}✓ Đã cập nhật: $BEFORE → $AFTER${NC}"
    git -C "$GIT_DIR" log --oneline "$BEFORE..$AFTER" | sed 's/^/    /'
fi

# ─── BƯỚC 2: Tạo bảng tracking migrations (nếu chưa có) ────
echo ""
echo -e "${BOLD}[2/5] Kiểm tra hệ thống migration...${NC}"

if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    psql -U bhl -d bhl_prod -c "
    CREATE TABLE IF NOT EXISTS schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
    );
    "; then
    echo -e "  ${RED}[✗] Không thể kiểm tra/tạo bảng schema_migrations${NC}"
    exit 1
fi
echo -e "  ${GREEN}✓ Bảng schema_migrations OK${NC}"

# ─── BƯỚC 3: Chạy migrations mới ────────────────────────────
echo ""
echo -e "${BOLD}[3/5] Chạy migrations mới (bỏ qua đã chạy rồi)...${NC}"

# Lấy danh sách tất cả migration .up.sql theo thứ tự
ALL_MIGRATIONS=$(find migrations -name "*.up.sql" | sort)

NEW_COUNT=0
SKIP_COUNT=0

for MIG_PATH in $ALL_MIGRATIONS; do
    MIG_NAME=$(basename "$MIG_PATH")

    # Kiểm tra đã chạy chưa
    ALREADY=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        psql -U bhl -d bhl_prod -t -c \
        "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$MIG_NAME';" \
        2>/dev/null | tr -d '[:space:]')

    if [ "$ALREADY" = "1" ]; then
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi

    # Chưa chạy → chạy và ghi lại
    echo -e "  ${BLUE}→${NC} Đang chạy: $MIG_NAME"
    
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        psql -U bhl -d bhl_prod -f "/migrations/$MIG_NAME" > /tmp/mig_output.txt 2>&1; then
        
        # Ghi lại là đã chạy
        docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
            psql -U bhl -d bhl_prod -c \
            "INSERT INTO schema_migrations (filename) VALUES ('$MIG_NAME') ON CONFLICT DO NOTHING;" \
            > /dev/null 2>&1
        
        echo -e "  ${GREEN}✓ $MIG_NAME${NC}"
        NEW_COUNT=$((NEW_COUNT + 1))
    else
        echo -e "  ${RED}✗ $MIG_NAME — LỖI:${NC}"
        cat /tmp/mig_output.txt | head -10 | sed 's/^/    /'
        echo ""
        echo -e "  ${YELLOW}Tiếp tục với migration tiếp theo...${NC}"
    fi
done

if [ $NEW_COUNT -eq 0 ]; then
    echo -e "  ${YELLOW}→ Không có migration mới ($SKIP_COUNT đã chạy trước)${NC}"
else
    echo -e "  ${GREEN}✓ Đã chạy $NEW_COUNT migration mới, bỏ qua $SKIP_COUNT${NC}"
fi

# ─── BƯỚC 4: Rebuild & restart ──────────────────────────────
echo ""
echo -e "${BOLD}[4/5] Rebuild và khởi động lại dịch vụ...${NC}"

# Bypass keychain qua SSH: tao stub docker-credential-desktop khong cham keychain
STUB_DIR="/tmp/bhl-stub-bin.$$"
mkdir -p "$STUB_DIR"
cat > "$STUB_DIR/docker-credential-desktop" <<'STUB'
#!/bin/bash
# Stub: tra ve auth rong cho moi registry, khong dung keychain
case "$1" in
  get) echo '{"ServerURL":"","Username":"","Secret":""}' ;;
  list) echo '{}' ;;
  *) echo '{}' ;;
esac
exit 0
STUB
chmod +x "$STUB_DIR/docker-credential-desktop"
echo -e "  ${YELLOW}→ Dung stub credential helper de bypass keychain${NC}"

cleanup_stub() {
    rm -rf "$STUB_DIR" 2>/dev/null || true
}
trap cleanup_stub EXIT

set +e
PATH="$STUB_DIR:$PATH" \
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build api web 2>&1 | tee /tmp/bhl_build.log | \
    grep -E "(Building|built|Started|Recreated|Step |Pull|✓|error|ERROR)" | tail -40
BUILD_RC=${PIPESTATUS[0]}
set -e

cleanup_stub
trap - EXIT

if [ "$BUILD_RC" -ne 0 ]; then
    echo -e "${RED}[✗] Build/Up thất bại (rc=$BUILD_RC). Tail log:${NC}"
    tail -40 /tmp/bhl_build.log
    exit $BUILD_RC
fi

echo ""
echo "  Chờ service khởi động (15s)..."
sleep 15

# ─── BƯỚC 5: Health check ────────────────────────────────────
echo ""
echo -e "${BOLD}[5/5] Kiểm tra sức khỏe hệ thống...${NC}"

# Check API
API_OK=false
for i in {1..10}; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T api \
        wget -qO- http://localhost:8080/health 2>/dev/null | grep -q "ok"; then
        API_OK=true
        break
    fi
    sleep 3
    printf "."
done
echo ""

if [ "$API_OK" = true ]; then
    echo -e "  ${GREEN}✓ Backend API — OK${NC}"
else
    echo -e "  ${RED}✗ Backend API — Lỗi! Xem log:${NC}"
    echo -e "    docker compose -f $COMPOSE_FILE logs api --tail 30"
fi

# Check tổng số containers
RUNNING=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps --format "{{.Name}} {{.Status}}" 2>/dev/null | grep "Up" | wc -l | tr -d '[:space:]')
echo -e "  ${GREEN}✓ $RUNNING containers đang chạy${NC}"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   Cập nhật hoàn tất!                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Code: ${GREEN}$AFTER${NC}"
echo -e "  API:  ${BLUE}https://bhl.symper.us/health${NC}"
echo ""
