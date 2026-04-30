#!/bin/bash
echo "=== Docker containers ==="
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|bhl"
echo ""
echo "=== Health endpoints ==="
curl -s -o /dev/null -w "API: %{http_code}\n" http://localhost:8080/v1/health || echo "API: DOWN"
curl -s -o /dev/null -w "WEB: %{http_code}\n" http://localhost:3000/ || echo "WEB: DOWN"
echo ""
echo "=== Recent compose log (last 30 lines) ==="
cd /Users/tungtranle/Projects/Beer-HL/bhl-oms
docker compose -f docker-compose.prod.yml --env-file .env.prod logs --tail=15 web 2>&1 | tail -20
echo "---DONE---"
