#!/bin/bash
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
BLUE="\033[34m"
NC="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT=""

if [ -f "$SCRIPT_DIR/docker-compose.simple.yml" ] || [ -f "$SCRIPT_DIR/docker-compose.prod.yml" ]; then
    REPO_ROOT="$SCRIPT_DIR"
elif [ -f "$SCRIPT_DIR/../docker-compose.simple.yml" ] || [ -f "$SCRIPT_DIR/../docker-compose.prod.yml" ]; then
    REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
else
    echo "Khong tim thay thu muc repo tu dong."
    read -r -p "Nhap duong dan thu muc du an BHL tren Mac: " REPO_ROOT
fi

if [ ! -d "$REPO_ROOT" ]; then
    echo -e "${RED}[x] Thu muc repo khong ton tai: $REPO_ROOT${NC}"
    exit 1
fi

cd "$REPO_ROOT"

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

DUMP_FILE="$SCRIPT_DIR/full-sync.dump"
if [ ! -f "$DUMP_FILE" ]; then
    echo -e "${RED}[x] Khong tim thay file dump: $DUMP_FILE${NC}"
    exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups

echo ""
echo -e "${BOLD}==============================================${NC}"
echo -e "${BOLD}  BHL OMS - IMPORT FULL DATA FROM USB${NC}"
echo -e "${BOLD}==============================================${NC}"
echo ""
echo -e "  Repo:    ${BLUE}$REPO_ROOT${NC}"
echo -e "  Compose: ${BLUE}$COMPOSE_FILE${NC}"
if [ ${#COMPOSE_ARGS[@]} -gt 2 ]; then
    echo -e "  Env:     ${BLUE}${COMPOSE_ARGS[2]}${NC}"
else
    echo -e "  Env:     ${BLUE}(khong dung env file)${NC}"
fi
echo -e "  Dump:    ${BLUE}$DUMP_FILE${NC}"

echo ""
echo "[1/6] Dam bao Postgres dang chay..."
docker compose "${COMPOSE_ARGS[@]}" up -d postgres redis >/dev/null
for i in {1..20}; do
    if docker compose "${COMPOSE_ARGS[@]}" exec -T postgres pg_isready -U bhl >/dev/null 2>&1; then
        break
    fi
    sleep 2
    printf "."
done
echo ""
echo -e "  ${GREEN}OK${NC}"

POSTGRES_CONTAINER=$(docker compose "${COMPOSE_ARGS[@]}" ps -q postgres)
if [ -z "$POSTGRES_CONTAINER" ]; then
    echo -e "${RED}[x] Khong lay duoc container postgres${NC}"
    exit 1
fi

echo ""
echo "[2/6] Backup DB hien tai tren server..."
SERVER_TMP_BACKUP="/tmp/server-before-usb-import-${TIMESTAMP}.dump"
SERVER_BACKUP_FILE="backups/server-before-usb-import-${TIMESTAMP}.dump"
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    sh -lc "pg_dump -U bhl -d bhl_prod -Fc -f '$SERVER_TMP_BACKUP'"
docker cp "${POSTGRES_CONTAINER}:${SERVER_TMP_BACKUP}" "$SERVER_BACKUP_FILE"
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    sh -lc "rm -f '$SERVER_TMP_BACKUP'"
echo -e "  ${GREEN}OK${NC} Backup saved: $SERVER_BACKUP_FILE"

echo ""
echo "[3/6] Tam dung API/Web de restore an toan..."
docker compose "${COMPOSE_ARGS[@]}" stop api web >/dev/null 2>&1 || true
echo -e "  ${GREEN}OK${NC}"

echo ""
echo "[4/6] Restore full data tu USB package..."
SERVER_TMP_IMPORT="/tmp/usb-import-${TIMESTAMP}.dump"
docker cp "$DUMP_FILE" "${POSTGRES_CONTAINER}:${SERVER_TMP_IMPORT}"
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    psql -U bhl -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'bhl_prod' AND pid <> pg_backend_pid();" >/dev/null
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    dropdb -U bhl --if-exists bhl_prod
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    createdb -U bhl bhl_prod
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    pg_restore -U bhl -d bhl_prod --no-owner --no-privileges "$SERVER_TMP_IMPORT"
docker compose "${COMPOSE_ARGS[@]}" exec -T postgres \
    sh -lc "rm -f '$SERVER_TMP_IMPORT'"
echo -e "  ${GREEN}OK${NC}"

echo ""
echo "[5/6] Khoi dong lai API/Web va xoa cache..."
docker compose "${COMPOSE_ARGS[@]}" up -d api web redis >/dev/null
docker compose "${COMPOSE_ARGS[@]}" exec -T redis redis-cli FLUSHALL >/dev/null 2>&1 || true
sleep 15
echo -e "  ${GREEN}OK${NC}"

echo ""
echo "[6/6] Health check..."
API_OK=false
for i in {1..10}; do
    if docker compose "${COMPOSE_ARGS[@]}" exec -T api \
        wget -qO- http://localhost:8080/health 2>/dev/null | grep -q "ok"; then
        API_OK=true
        break
    fi
    sleep 3
    printf "."
done
echo ""

if [ "$API_OK" != true ]; then
    echo -e "${RED}[x] Backend health check fail${NC}"
    echo "Xem log: docker compose -f $COMPOSE_FILE logs api --tail 30"
    exit 1
fi

echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}  IMPORT DATA THANH CONG${NC}"
echo -e "${GREEN}==============================================${NC}"
echo -e "  Backup truoc khi restore: ${BLUE}$SERVER_BACKUP_FILE${NC}"
echo -e "  Test tai: ${BLUE}https://bhl.symper.us${NC}"