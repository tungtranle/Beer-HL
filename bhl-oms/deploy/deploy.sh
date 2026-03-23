#!/bin/bash
# BHL OMS — Production Deployment Script
# Usage: ./deploy.sh [--first-run]
set -euo pipefail

DEPLOY_DIR="/opt/bhl-oms"
COMPOSE_FILE="docker-compose.prod.yml"

echo "=== BHL OMS Deployment ==="

# Check required env file
if [ ! -f "$DEPLOY_DIR/.env" ]; then
    echo "ERROR: $DEPLOY_DIR/.env not found."
    echo "Create it with: DB_PASSWORD, GRAFANA_PASSWORD, BRAVO_URL, etc."
    exit 1
fi

cd "$DEPLOY_DIR"

# Pull latest images
echo "[1/5] Pulling images..."
docker compose -f "$COMPOSE_FILE" pull

# Build custom images
echo "[2/5] Building application images..."
docker compose -f "$COMPOSE_FILE" build --no-cache api web vrp

# Run migrations
if [ "${1:-}" = "--first-run" ]; then
    echo "[3/5] Running database migrations..."
    docker compose -f "$COMPOSE_FILE" up -d postgres
    sleep 5
    for f in migrations/*.up.sql; do
        echo "  Applying $f..."
        docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U bhl -d bhl_prod -f "/migrations/$f"
    done
fi

# Deploy
echo "[4/5] Starting services..."
docker compose -f "$COMPOSE_FILE" up -d

# Health check
echo "[5/5] Health check..."
sleep 10
if docker compose -f "$COMPOSE_FILE" exec api wget -qO- http://localhost:8080/health > /dev/null 2>&1; then
    echo "API: OK"
else
    echo "API: FAILED — check logs: docker compose -f $COMPOSE_FILE logs api"
fi

echo ""
echo "=== Deployment Complete ==="
echo "API:      https://oms.bhl.vn/health"
echo "Web:      https://oms.bhl.vn"
echo "Grafana:  https://monitor.bhl.vn (admin / \$GRAFANA_PASSWORD)"
echo "Metrics:  http://localhost:9090 (Prometheus)"
