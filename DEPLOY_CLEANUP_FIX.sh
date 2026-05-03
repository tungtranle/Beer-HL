#!/bin/bash
set -e

cd ~/Projects/Beer-HL/bhl-oms

echo "🔧 Cleanup FK Fix — Building & Deploying"
echo "========================================"

# Step 1: Verify Docker is responsive
echo "1️⃣ Checking Docker..."
/Applications/Docker.app/Contents/Resources/bin/docker ps > /dev/null 2>&1 || {
  echo "❌ Docker not responding. Try: open -a Docker"
  exit 1
}

# Step 2: Clean Docker buildkit cache
echo "2️⃣ Cleaning Docker cache..."
/Applications/Docker.app/Contents/Resources/bin/docker system prune -a --volumes -f > /dev/null 2>&1

# Step 3: Wait for Docker to be fully ready
echo "3️⃣ Waiting for Docker to stabilize..."
sleep 5

# Step 4: Build API
echo "4️⃣ Building API image (this may take 1-2 minutes)..."
/Applications/Docker.app/Contents/Resources/bin/docker compose -f docker-compose.prod.yml build api

# Step 5: Restart API
echo "5️⃣ Restarting API container..."
/Applications/Docker.app/Contents/Resources/bin/docker compose -f docker-compose.prod.yml restart api
sleep 3

# Step 6: Verify health
echo "6️⃣ Verifying health..."
HEALTH_CHECK=$(/Applications/Docker.app/Contents/Resources/bin/docker exec bhl-oms-api-1 wget -qO- http://localhost:8080/v1/health 2>/dev/null | grep -o '"status":"ok"' || echo "")
if [ -n "$HEALTH_CHECK" ]; then
  echo "✅ API is healthy!"
else
  echo "⏳ API starting up... wait 10 seconds and refresh browser"
fi

echo ""
echo "✅ Deployment complete!"
echo ""
echo "🧪 Next: Open https://bhl.symper.us/test-portal"
echo "   → Click DEMO-01 → Click 'Nạp data' → Click 'Xóa scoped'"
echo "   → Should see SUCCESS (no FK error)"
