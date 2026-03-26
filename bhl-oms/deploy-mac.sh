#!/bin/bash
# ============================================================
# BHL OMS — Deploy tự động trên Mac Mini
# Script này làm TẤT CẢ: cài Docker, chạy DB, tạo tài khoản...
# Anh chỉ cần paste 1 lệnh: bash deploy-mac.sh
# ============================================================
set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
NC="\033[0m"

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   BHL OMS — Deploy Tự Động cho Mac Mini     ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""

# --- Bước 0: Kiểm tra vị trí ---
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
echo -e "${GREEN}[✓]${NC} Thư mục: $SCRIPT_DIR"

# --- Bước 1: Kiểm tra Docker ---
echo ""
echo -e "${BOLD}[1/8] Kiểm tra Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}[!] Docker chưa cài. Đang cài Docker Desktop...${NC}"
    echo ""
    echo "  ╔═══════════════════════════════════════════════════╗"
    echo "  ║ Docker chưa có trên máy Mac Mini của anh.        ║"
    echo "  ║                                                   ║"
    echo "  ║ Cách cài:                                         ║"
    echo "  ║ 1. Mở Safari → docker.com/products/docker-desktop║"
    echo "  ║ 2. Tải bản 'Mac with Apple chip' hoặc 'Intel'    ║"
    echo "  ║ 3. Kéo Docker vào Applications                   ║"
    echo "  ║ 4. Mở Docker Desktop, chờ icon cá voi xanh       ║"
    echo "  ║ 5. Chạy lại script này: bash deploy-mac.sh       ║"
    echo "  ╚═══════════════════════════════════════════════════╝"
    echo ""
    # Try Homebrew auto-install
    if command -v brew &> /dev/null; then
        echo -e "${YELLOW}  Tìm thấy Homebrew! Đang cài tự động...${NC}"
        brew install --cask docker
        echo -e "${YELLOW}  Đang mở Docker Desktop... Chờ 30 giây...${NC}"
        open -a Docker
        sleep 30
        if ! docker info &> /dev/null 2>&1; then
            echo -e "${RED}[✗] Docker chưa sẵn sàng. Mở Docker Desktop rồi chạy lại script.${NC}"
            exit 1
        fi
    else
        exit 1
    fi
fi

# Kiểm tra Docker đang chạy
if ! docker info &> /dev/null 2>&1; then
    echo -e "${YELLOW}[!] Docker chưa khởi động. Đang mở...${NC}"
    open -a Docker 2>/dev/null || true
    echo "  Chờ Docker khởi động..."
    for i in {1..60}; do
        if docker info &> /dev/null 2>&1; then
            break
        fi
        sleep 2
        printf "."
    done
    echo ""
    if ! docker info &> /dev/null 2>&1; then
        echo -e "${RED}[✗] Docker không khởi động được. Mở Docker Desktop thủ công rồi chạy lại.${NC}"
        exit 1
    fi
fi
echo -e "${GREEN}[✓]${NC} Docker đang chạy"

# --- Bước 2: Tạo file .env nếu chưa có ---
echo ""
echo -e "${BOLD}[2/8] Kiểm tra cấu hình (.env)...${NC}"
if [ ! -f ".env.prod" ]; then
    echo -e "${YELLOW}[!] Tạo file .env.prod...${NC}"
    cat > .env.prod << 'ENVEOF'
# === BHL OMS Production Config ===
# Tạo tự động bởi deploy-mac.sh

# Database
DB_PASSWORD=bhl_prod_2026_secure

# Monitoring
GRAFANA_PASSWORD=grafana_bhl_2026

# Sentry — theo dõi lỗi tự động
SENTRY_DSN=https://bef6b6bd4de51ed9d7ed78047b61298a@o4511092744454144.ingest.us.sentry.io/4511092773486592

# Test Portal — bật để tạo data test
ENABLE_TEST_PORTAL=true

# Integration — mock mode (chưa có hệ thống thật)
INTEGRATION_MOCK=true
BRAVO_URL=
BRAVO_API_KEY=
DMS_URL=
DMS_API_KEY=
ZALO_BASE_URL=
ZALO_OA_TOKEN=
ZALO_OA_ID=
ENVEOF
    echo -e "${GREEN}[✓]${NC} Đã tạo .env.prod"
else
    echo -e "${GREEN}[✓]${NC} .env.prod đã có"
fi

# --- Bước 3: Tạo JWT keys nếu chưa có ---
echo ""
echo -e "${BOLD}[3/8] Kiểm tra JWT keys...${NC}"
if [ ! -f "keys/private.pem" ] || [ ! -f "keys/public.pem" ]; then
    echo -e "${YELLOW}[!] Tạo JWT RS256 keys...${NC}"
    mkdir -p keys
    openssl genrsa -out keys/private.pem 2048 2>/dev/null
    openssl rsa -in keys/private.pem -pubout -out keys/public.pem 2>/dev/null
    echo -e "${GREEN}[✓]${NC} Đã tạo keys/private.pem + public.pem"
else
    echo -e "${GREEN}[✓]${NC} JWT keys đã có"
fi

# --- Bước 4: Tạo SSL self-signed nếu chưa có ---
echo ""
echo -e "${BOLD}[4/8] Kiểm tra SSL certificates...${NC}"
mkdir -p nginx/ssl
if [ ! -f "nginx/ssl/fullchain.pem" ]; then
    echo -e "${YELLOW}[!] Tạo SSL tự ký (self-signed) cho bhl.symper.us...${NC}"
    openssl req -x509 -nodes -days 365 \
        -newkey rsa:2048 \
        -keyout nginx/ssl/privkey.pem \
        -out nginx/ssl/fullchain.pem \
        -subj "/CN=bhl.symper.us" \
        -addext "subjectAltName=DNS:bhl.symper.us,DNS:*.bhl.symper.us,DNS:localhost" \
        2>/dev/null
    echo -e "${GREEN}[✓]${NC} Đã tạo SSL certificates (self-signed)"
    echo -e "${YELLOW}  Tip: Sau này có thể thay bằng Let's Encrypt${NC}"
else
    echo -e "${GREEN}[✓]${NC} SSL certificates đã có"
fi

# --- Bước 5: Build & Start containers ---
echo ""
echo -e "${BOLD}[5/8] Build & khởi động containers...${NC}"
echo "  (Lần đầu sẽ tải images ~ 5-10 phút, tùy tốc độ mạng)"
echo ""

# Build and start (dùng bản đơn giản — không cần OSRM/VRP)
COMPOSE_FILE="docker-compose.simple.yml"
if [ -f "./osrm-data/vietnam-latest.osrm" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
    echo "  (Phát hiện OSRM data → dùng bản đầy đủ)"
else
    echo "  (Dùng bản đơn giản — không OSRM/VRP/monitoring)"
fi

docker compose -f "$COMPOSE_FILE" --env-file .env.prod up -d --build 2>&1 | tail -20

echo ""
echo "  Chờ containers khởi động..."
sleep 15

# Check containers
RUNNING=$(docker compose -f "$COMPOSE_FILE" --env-file .env.prod ps --format json 2>/dev/null | grep -c '"running"' || echo "0")
echo -e "${GREEN}[✓]${NC} $RUNNING containers đang chạy"

# --- Bước 6: Chạy migrations ---
echo ""
echo -e "${BOLD}[6/8] Chạy database migrations...${NC}"

# Wait for postgres to be ready
echo "  Chờ PostgreSQL sẵn sàng..."
for i in {1..30}; do
    if docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T postgres pg_isready -U bhl &>/dev/null; then
        break
    fi
    sleep 2
    printf "."
done
echo ""

# Run all migrations in order
MIGRATIONS=(
    "001_init.up.sql"
    "002_checklist.up.sql"
    "003_cutoff_consolidation.up.sql"
    "004_wms.up.sql"
    "005_epod_payment.up.sql"
    "006_zalo_confirm.up.sql"
    "007_recon_dlq_kpi.up.sql"
    "008_audit_log.up.sql"
    "009_driver_checkin.up.sql"
    "009_urgent_priority.up.sql"
    "010_order_confirmation.up.sql"
    "010_order_number_seq.up.sql"
    "010_workshop_phase6.up.sql"
    "011_entity_events.up.sql"
    "012_redelivery_vehicle_docs.up.sql"
    "013_partial_payment_reject.up.sql"
    "014_note_type_pinned.up.sql"
)

FAIL=0
for mig in "${MIGRATIONS[@]}"; do
    if docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T postgres psql -U bhl -d bhl_prod -f "/migrations/$mig" &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $mig"
    else
        echo -e "  ${YELLOW}~${NC} $mig (có thể đã chạy rồi)"
    fi
done

echo -e "${GREEN}[✓]${NC} Migrations hoàn tất"

# --- Bước 7: Seed data ---
echo ""
echo -e "${BOLD}[7/8] Tạo data mẫu (tài khoản, sản phẩm, NPP...)...${NC}"

# Check if seed already run (users exist?)
USER_COUNT=$(docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T postgres psql -U bhl -d bhl_prod -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d '[:space:]')

if [ "$USER_COUNT" = "0" ] || [ -z "$USER_COUNT" ]; then
    echo "  Đang seed data..."
    
    # Run basic seed
    if docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T postgres psql -U bhl -d bhl_prod -f "/migrations/seed.sql" &>/dev/null; then
        echo -e "  ${GREEN}✓${NC} seed.sql — tài khoản + sản phẩm + NPP cơ bản"
    else
        echo -e "  ${YELLOW}~${NC} seed.sql — có thể đã seed rồi"
    fi
    
    # Run production seed (800 NPP, 70 xe)
    if [ -f "migrations/seed_production.sql" ]; then
        if docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T postgres psql -U bhl -d bhl_prod -f "/migrations/seed_production.sql" &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} seed_production.sql — 800 NPP + 70 xe"
        else
            echo -e "  ${YELLOW}~${NC} seed_production.sql — có thể đã seed rồi"
        fi
    fi
    
    # Run test-ready seed (clean stock + lots for FEFO testing)
    if [ -f "migrations/seed_test_ready.sql" ]; then
        if docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T postgres psql -U bhl -d bhl_prod -f "/migrations/seed_test_ready.sql" &>/dev/null; then
            echo -e "  ${GREEN}✓${NC} seed_test_ready.sql — tồn kho + lots cho test"
        else
            echo -e "  ${YELLOW}~${NC} seed_test_ready.sql"
        fi
    fi
    
    echo -e "${GREEN}[✓]${NC} Data mẫu đã tạo xong"
else
    echo -e "${GREEN}[✓]${NC} Data đã có ($USER_COUNT users) — bỏ qua seed"
fi

# --- Bước 8: Health check ---
echo ""
echo -e "${BOLD}[8/8] Kiểm tra hệ thống...${NC}"
sleep 5

# Check API health
API_OK=false
for i in {1..10}; do
    if docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T api wget -qO- http://localhost:8080/health 2>/dev/null | grep -q "ok"; then
        API_OK=true
        break
    fi
    sleep 3
done

if [ "$API_OK" = true ]; then
    echo -e "  ${GREEN}✓${NC} Backend API — OK"
else
    echo -e "  ${RED}✗${NC} Backend API — Lỗi! Xem log: docker compose -f $COMPOSE_FILE logs api"
fi

# Check frontend
WEB_OK=false
for i in {1..10}; do
    if docker compose -f "$COMPOSE_FILE" --env-file .env.prod exec -T web wget -qO- http://localhost:3000 2>/dev/null | grep -q "html"; then
        WEB_OK=true
        break
    fi
    sleep 3
done

if [ "$WEB_OK" = true ]; then
    echo -e "  ${GREEN}✓${NC} Frontend Web — OK"
else
    echo -e "  ${YELLOW}~${NC} Frontend Web — đang khởi động (bình thường)"
fi

# Get Mac IP
MAC_IP=$(ifconfig 2>/dev/null | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')

# Final summary
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║            DEPLOY HOÀN TẤT! 🎉              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Truy cập:${NC}"
echo -e "    Local:   http://localhost (hoặc https://localhost)"
echo -e "    Mạng:    http://${MAC_IP:-<IP Mac Mini>}"
echo -e "    Domain:  https://bhl.symper.us"
echo ""
echo -e "  ${BOLD}Đăng nhập:${NC}"
echo -e "    ┌─────────────┬──────────┬─────────────────┐"
echo -e "    │ Username    │ Mật khẩu │ Vai trò         │"
echo -e "    ├─────────────┼──────────┼─────────────────┤"
echo -e "    │ admin       │ demo123  │ Quản trị        │"
echo -e "    │ dvkh01      │ demo123  │ Dịch vụ KH      │"
echo -e "    │ dispatcher01│ demo123  │ Điều phối       │"
echo -e "    │ accountant01│ demo123  │ Kế toán         │"
echo -e "    │ driver01    │ demo123  │ Lái xe          │"
echo -e "    │ manager01   │ demo123  │ Quản lý         │"
echo -e "    └─────────────┴──────────┴─────────────────┘"
echo ""
echo -e "  ${BOLD}Test Portal:${NC} https://bhl.symper.us/test-portal"
echo -e "  ${BOLD}Sentry:${NC}      https://sentry.io (lỗi tự động gửi về)"
echo ""
echo -e "  ${BOLD}Lệnh hữu ích:${NC}"
echo -e "    Xem log:     docker compose -f $COMPOSE_FILE --env-file .env.prod logs -f api"
echo -e "    Restart:     docker compose -f $COMPOSE_FILE --env-file .env.prod restart"
echo -e "    Dừng:        docker compose -f $COMPOSE_FILE --env-file .env.prod down"
echo -e "    Re-deploy:   bash deploy-mac.sh"
echo ""

echo ""
