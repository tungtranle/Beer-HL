#!/bin/bash
# ============================================================
# OSRM Health Monitor & Auto-Restart Script
# Chạy với cron job: */5 * * * * /path/to/scripts/osrm-monitor.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-$PROJECT_DIR/docker-compose.prod.yml}"
OSRM_CHECK_SERVICE="${OSRM_CHECK_SERVICE:-api}"
OSRM_INTERNAL_URL="${OSRM_INTERNAL_URL:-http://osrm:5000}"
OSRM_DATA_PATH="${OSRM_DATA_PATH:-$PROJECT_DIR/osrm-data/vietnam-latest.osrm}"
LOG_FILE="${LOG_FILE:-/var/log/osrm-monitor.log}"

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

docker_compose() {
    docker compose -f "$COMPOSE_FILE" "$@"
}

service_is_running() {
    local service=$1
    local container_id
    container_id="$(docker_compose ps -q "$service" 2>/dev/null | head -n 1)"
    [ -n "$container_id" ] || return 1
    [ "$(docker inspect -f '{{.State.Status}}' "$container_id" 2>/dev/null || true)" = "running" ]
}

check_osrm_data() {
    [ -f "$OSRM_DATA_PATH" ]
}

check_osrm_health() {
    # Probe OSRM via Docker internal network through the api service
    # OSRM port 5000 is not exposed to host — must go through Docker network
    if ! service_is_running "$OSRM_CHECK_SERVICE"; then
        log "WARN: Helper service '$OSRM_CHECK_SERVICE' is not running. Cannot probe OSRM from Docker network."
        return 2
    fi

    if docker_compose exec -T "$OSRM_CHECK_SERVICE" wget -qO- "$OSRM_INTERNAL_URL/status" 2>/dev/null | grep -q '"status"'; then
        return 0
    fi
    return 1
}

restart_osrm() {
    log "ACTION: Restarting OSRM service..."
    if docker_compose restart osrm >> "$LOG_FILE" 2>&1; then
        log "SUCCESS: OSRM restarted"
        sleep 15
        if check_osrm_health; then
            log "SUCCESS: OSRM is healthy after restart"
            return 0
        else
            log "WARN: OSRM restarted but health check failed"
            return 1
        fi
    else
        log "ERROR: Failed to restart OSRM via docker compose"
        return 1
    fi
}

# ====== MAIN LOGIC ======
log "=== OSRM Health Check Started ==="

# Check if OSRM data exists
if ! check_osrm_data; then
    log "CRITICAL: OSRM data missing at $OSRM_DATA_PATH. Manual intervention required."
    echo -e "${RED}ERROR: OSRM data file not found at $OSRM_DATA_PATH${NC}" >&2
    exit 1
fi

# Check OSRM health via Docker network
if check_osrm_health; then
    log "OK: OSRM is healthy via $OSRM_CHECK_SERVICE -> $OSRM_INTERNAL_URL"
    echo -e "${GREEN}[✓]${NC} OSRM is healthy via $OSRM_CHECK_SERVICE -> $OSRM_INTERNAL_URL"
    exit 0
else
    log "WARN: OSRM health check failed"
    echo -e "${YELLOW}[!]${NC} OSRM health check failed. Attempting restart..."
    
    if restart_osrm; then
        exit 0
    else
        log "ERROR: OSRM restart failed. Please check logs."
        echo -e "${RED}[✗]${NC} OSRM restart failed. Check $LOG_FILE for details."
        exit 1
    fi
fi
