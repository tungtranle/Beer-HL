#!/bin/bash
# ============================================================
# BHL OMS - Restore server data tren Mac Mini
# Ho tro ca custom dump (.dump/.backup/.tar) va plain SQL (.sql)
# Usage:
#   bash restore-full-data-once.sh backups/full-sync.dump
#   bash restore-full-data-once.sh backups/history.sql plain
# ============================================================
set -euo pipefail

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
BLUE="\033[34m"
NC="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

if [ $# -lt 1 ]; then
    echo -e "${RED}[x] Thieu duong dan file dump/sql${NC}"
    echo "Usage: bash restore-full-data-once.sh backups/full-sync.dump [custom|plain]"
    exit 1
fi

DATA_FILE="$1"
IMPORT_MODE="${2:-auto}"

if [ ! -f "$DATA_FILE" ]; then
    echo -e "${RED}[x] Khong tim thay file data: $DATA_FILE${NC}"
    exit 1
fi

if [ "$IMPORT_MODE" = "auto" ]; then
    case "$DATA_FILE" in
        *.sql) IMPORT_MODE="plain" ;;
        *) IMPORT_MODE="custom" ;;
    esac
fi

if [ "$IMPORT_MODE" != "custom" ] && [ "$IMPORT_MODE" != "plain" ]; then
    echo -e "${RED}[x] Import mode khong hop le: $IMPORT_MODE${NC}"
    exit 1
fi

if [ -f "./osrm-data/vietnam-latest.osrm" ]; then
    COMPOSE_FILE="docker-compose.prod.yml"
else
    COMPOSE_FILE="docker-compose.simple.yml"
fi

if [ -f ".env.prod" ]; then
    ENV_FILE=".env.prod"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
else
    echo -e "${RED}[x] Khong tim thay .env.prod hoac .env${NC}"
    exit 1
fi

TIMESTAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p backups

echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   BHL OMS - Restore Server Data            ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Compose: ${BLUE}$COMPOSE_FILE${NC}"
echo -e "  File:    ${BLUE}$DATA_FILE${NC}"
echo -e "  Mode:    ${BLUE}$IMPORT_MODE${NC}"

echo ""
echo -e "${BOLD}[1/6] Dam bao Postgres dang chay...${NC}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis >/dev/null
for i in {1..20}; do
    if docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_isready -U bhl >/dev/null 2>&1; then
        break
    fi
    sleep 2
    printf "."
done
echo ""
echo -e "  ${GREEN}OK${NC}"

POSTGRES_CONTAINER=$(docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q postgres)
if [ -z "$POSTGRES_CONTAINER" ]; then
    echo -e "${RED}[x] Khong lay duoc container postgres${NC}"
    exit 1
fi

echo ""
echo -e "${BOLD}[2/6] Backup DB hien tai tren server...${NC}"
SERVER_TMP_BACKUP="/tmp/server-before-data-restore-${TIMESTAMP}.dump"
SERVER_BACKUP_FILE="backups/server-before-data-restore-${TIMESTAMP}.dump"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    sh -lc "pg_dump -U bhl -d bhl_prod -Fc -f '$SERVER_TMP_BACKUP'"
docker cp "${POSTGRES_CONTAINER}:${SERVER_TMP_BACKUP}" "$SERVER_BACKUP_FILE"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    sh -lc "rm -f '$SERVER_TMP_BACKUP'"
echo -e "  ${GREEN}OK${NC} Backup saved: $SERVER_BACKUP_FILE"

echo ""
echo -e "${BOLD}[3/6] Tam dung API/Web de restore an toan...${NC}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop api web >/dev/null 2>&1 || true
echo -e "  ${GREEN}OK${NC}"

echo ""
echo -e "${BOLD}[4/6] Restore data vao bhl_prod...${NC}"
SERVER_FILE_NAME=$(basename "$DATA_FILE")
SERVER_TMP_IMPORT="/tmp/${TIMESTAMP}-${SERVER_FILE_NAME}"
docker cp "$DATA_FILE" "${POSTGRES_CONTAINER}:${SERVER_TMP_IMPORT}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    psql -U bhl -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'bhl_prod' AND pid <> pg_backend_pid();" >/dev/null
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    dropdb -U bhl --if-exists bhl_prod
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    createdb -U bhl bhl_prod

if [ "$IMPORT_MODE" = "plain" ]; then
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        psql -U bhl -d bhl_prod -f "$SERVER_TMP_IMPORT"
else
    docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
        pg_restore -U bhl -d bhl_prod --no-owner --no-privileges "$SERVER_TMP_IMPORT"
fi

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
    sh -lc "rm -f '$SERVER_TMP_IMPORT'"
echo -e "  ${GREEN}OK${NC}"

echo ""
echo -e "${BOLD}[5/6] Khoi dong lai API/Web va xoa cache...${NC}"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d api web redis >/dev/null
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T redis redis-cli FLUSHALL >/dev/null 2>&1 || true
sleep 15
echo -e "  ${GREEN}OK${NC}"

echo ""
echo -e "${BOLD}[6/6] Health check...${NC}"
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

if [ "$API_OK" != true ]; then
    echo -e "${RED}[x] Backend health check fail${NC}"
    echo "Xem log: docker compose -f $COMPOSE_FILE logs api --tail 30"
    exit 1
fi

echo -e "${GREEN}OK${NC} Data da duoc restore len server."
echo -e "Backup server truoc khi restore: ${BLUE}$SERVER_BACKUP_FILE${NC}"
echo -e "Test tai: ${BLUE}https://bhl.symper.us${NC}"