#!/bin/bash
# ============================================================
# OSRM Health Monitor & Auto-Restart Script
# Chạy với cron job: */5 * * * * /opt/bhl/scripts/osrm-monitor.sh
# ============================================================
set -e

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
COMPOSE_DIR="${COMPOSE_DIR:-.}"
OSRM_PORT="${OSRM_PORT:-5000}"
OSRM_URL="http://localhost:${OSRM_PORT}"
OSRM_DATA_PATH="${OSRM_DATA_PATH:-./osrm-data/vietnam-latest.osrm}"
LOG_FILE="/var/log/osrm-monitor.log"

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

check_osrm_health() {
    # Try status endpoint (requires curl)
    if ! command -v curl &> /dev/null; then
        # Fallback: try wget
        if ! command -v wget &> /dev/null; then
            log "WARN: Neither curl nor wget available. Skipping OSRM health check."
            return 2
        fi
        wget -qO- "$OSRM_URL/status" 2>/dev/null | grep -q "status" && return 0
        return 1
    fi
    
    curl -sf "$OSRM_URL/status" > /dev/null 2>&1 && return 0 || return 1
}

check_osrm_data() {
    if [ ! -f "$OSRM_DATA_PATH" ]; then
        log "ERROR: OSRM data file not found: $OSRM_DATA_PATH"
        return 1
    fi
    return 0
}

restart_osrm() {
    log "ACTION: Restarting OSRM service..."
    cd "$COMPOSE_DIR"
    if docker compose -f "$COMPOSE_FILE" restart osrm >> "$LOG_FILE" 2>&1; then
        log "SUCCESS: OSRM restarted"
        # Wait for OSRM to be ready
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
    log "CRITICAL: OSRM data missing. Manual intervention required."
    echo -e "${RED}ERROR: OSRM data file not found at $OSRM_DATA_PATH${NC}" >&2
    exit 1
fi

# Check OSRM health
if check_osrm_health; then
    log "OK: OSRM is healthy"
    echo -e "${GREEN}[✓]${NC} OSRM is healthy at $OSRM_URL"
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
