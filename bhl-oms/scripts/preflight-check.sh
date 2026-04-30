#!/bin/bash
# ============================================================
# BHL OMS — Pre-flight Check before Starting Services
# Đảm bảo mọi điều kiện đầu vào thoả mãn trước khi docker compose up
# Sử dụng: bash scripts/preflight-check.sh
# ============================================================
set -e

BOLD="\033[1m"
GREEN="\033[32m"
RED="\033[31m"
YELLOW="\033[33m"
BLUE="\033[34m"
NC="\033[0m"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"

echo ""
echo -e "${BOLD}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   BHL OMS — Pre-flight System Check               ║${NC}"
echo -e "${BOLD}╚════════════════════════════════════════════════════╝${NC}"
echo ""

CHECKS_PASSED=0
CHECKS_FAILED=0

check() {
    local name=$1
    local condition=$2
    local error_msg=${3:-"Check failed"}
    
    if eval "$condition"; then
        echo -e "  ${GREEN}✓${NC} $name"
        ((CHECKS_PASSED++))
    else
        echo -e "  ${RED}✗${NC} $name"
        echo -e "    ${YELLOW}→ $error_msg${NC}"
        ((CHECKS_FAILED++))
    fi
}

# 1. Docker
echo -e "${BLUE}[1] Docker & Compose${NC}"
check "Docker is installed" "command -v docker" "Install Docker Desktop from docker.com"
check "Docker is running" "docker info > /dev/null 2>&1" "Start Docker Desktop"
check "Docker Compose is installed" "command -v docker compose" "Update Docker Desktop"

# 2. Configuration Files
echo ""
echo -e "${BLUE}[2] Configuration Files${NC}"
check ".env.prod exists" "[ -f '$PROJECT_DIR/.env.prod' ]" "Run: cd $PROJECT_DIR && cp .env.example .env.prod && edit .env.prod"
check "SSL certificates exist" "[ -d '$PROJECT_DIR/nginx/ssl' ] && [ -f '$PROJECT_DIR/nginx/ssl/fullchain.pem' ]" "Generate SSL certs or copy from existing setup"
check "Nginx config exists" "[ -f '$PROJECT_DIR/nginx/nginx.conf' ]" "Nginx config missing - check repository"
check "Keys directory exists" "[ -d '$PROJECT_DIR/keys' ] && [ -f '$PROJECT_DIR/keys/private.pem' ]" "Generate JWT keys: go run cmd/keygen/main.go"

# 3. OSRM Data (Critical for VRP)
echo ""
echo -e "${BLUE}[3] OSRM & Routing${NC}"
OSRM_DATA="$PROJECT_DIR/osrm-data/vietnam-latest.osrm"
if [ -f "$OSRM_DATA" ]; then
    OSRM_SIZE=$(du -h "$OSRM_DATA" | cut -f1)
    echo -e "  ${GREEN}✓${NC} OSRM data exists ($OSRM_SIZE)"
    ((CHECKS_PASSED++))
else
    echo -e "  ${YELLOW}⊘${NC} OSRM data not found (VRP will be limited)"
    echo -e "    ${BLUE}→ Optional: Generate data with${NC}"
    echo -e "    ${YELLOW}  bash scripts/setup-osrm.ps1${NC} (Windows PowerShell)"
    echo -e "    ${YELLOW}  OR wait for first VRP solver fallback${NC}"
fi

# 4. Migrations
echo ""
echo -e "${BLUE}[4] Migrations${NC}"
check "Migration files exist" "[ -d '$PROJECT_DIR/migrations' ] && [ $(ls $PROJECT_DIR/migrations/*.sql 2>/dev/null | wc -l) -gt 0 ]" "Migrations directory missing"
MIGRATION_COUNT=$(ls "$PROJECT_DIR/migrations/"*.up.sql 2>/dev/null | wc -l || echo 0)
echo -e "  ${GREEN}✓${NC} Found $MIGRATION_COUNT migration files"

# 5. Required ENV Variables
echo ""
echo -e "${BLUE}[5] Environment Variables${NC}"
check "DB_PASSWORD set" "grep -q 'DB_PASSWORD=' '$PROJECT_DIR/.env.prod'" "Set DB_PASSWORD in .env.prod"
check "GRAFANA_PASSWORD set" "grep -q 'GRAFANA_PASSWORD=' '$PROJECT_DIR/.env.prod'" "Set GRAFANA_PASSWORD in .env.prod"
check "SENTRY_DSN set or empty OK" "grep -qE 'SENTRY_DSN=' '$PROJECT_DIR/.env.prod'" "Set SENTRY_DSN in .env.prod (can be empty)"

# 6. Ports Availability (Mac/Linux only)
if command -v lsof &> /dev/null; then
    echo ""
    echo -e "${BLUE}[6] Port Availability${NC}"
    for port in 80 443 5432 6379 8080 3000 5000 8090 9090 3030; do
        if ! lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            echo -e "    ${GREEN}✓${NC} Port $port is free"
            ((CHECKS_PASSED++))
        else
            echo -e "    ${YELLOW}⚠${NC} Port $port is in use (may need docker restart)"
        fi
    done
fi

# Summary
echo ""
echo -e "${BOLD}Summary:${NC}"
echo -e "  ${GREEN}Passed: $CHECKS_PASSED${NC}"
if [ $CHECKS_FAILED -gt 0 ]; then
    echo -e "  ${RED}Failed: $CHECKS_FAILED${NC}"
    echo ""
    echo -e "${YELLOW}⚠ Please fix the above issues before starting services${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ All checks passed! Ready to start services.${NC}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo -e "  1. Start services:     ${YELLOW}docker compose -f $COMPOSE_FILE --env-file .env.prod up -d${NC}"
echo -e "  2. Verify health:      ${YELLOW}curl https://localhost/health${NC}"
echo -e "  3. Monitor OSRM:       ${YELLOW}bash scripts/osrm-monitor.sh${NC}"
echo -e "  4. Access dashboard:   ${YELLOW}https://bhl.symper.us${NC}"
echo ""
