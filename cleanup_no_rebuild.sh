#!/bin/bash
# Clean old test data and restart API without Docker rebuild
set -e

cd ~/Projects/Beer-HL/bhl-oms

echo "🧹 Cleanup Test Data (No Docker Rebuild)"
echo "========================================"

# Check if containers are running
echo "1️⃣ Checking containers..."
if ! /Applications/Docker.app/Contents/Resources/bin/docker ps | grep -q bhl-oms-postgres-1; then
    echo "❌ PostgreSQL container not running"
    exit 1
fi
if ! /Applications/Docker.app/Contents/Resources/bin/docker ps | grep -q bhl-oms-api-1; then
    echo "❌ API container not running"
    exit 1
fi
echo "✅ Containers OK"

# Delete old test data - using separate exec calls to avoid quoting issues
echo "2️⃣ Deleting old test data..."

/Applications/Docker.app/Contents/Resources/bin/docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_prod << 'EOSQL'
DELETE FROM picking_orders WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='picking_orders');
DELETE FROM trip_stops WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='trip_stops');
DELETE FROM trips WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='trips');
DELETE FROM shipments WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='shipments');
DELETE FROM order_confirmations WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='order_confirmations');
DELETE FROM sales_orders WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='sales_orders');
DELETE FROM qa_owned_entities;
EOSQL

echo "✅ Old test data deleted"

# Restart API
echo "3️⃣ Restarting API container..."
/Applications/Docker.app/Contents/Resources/bin/docker compose -f docker-compose.prod.yml restart api > /dev/null 2>&1
sleep 3

# Verify health
echo "4️⃣ Checking health..."
if /Applications/Docker.app/Contents/Resources/bin/docker exec bhl-oms-api-1 wget -qO- http://localhost:8080/v1/health 2>/dev/null | grep -q '"status":"ok"'; then
    echo "✅ API is healthy!"
else
    echo "⏳ API starting up... wait 10 seconds then refresh browser"
fi

echo ""
echo "✅ Cleanup complete! (No Docker rebuild needed)"
echo ""
echo "🧪 Test it:"
echo "   → https://bhl.symper.us/test-portal"
echo "   → Click DEMO-01 → 'Nạp data' → 'Xóa scoped'"
echo "   → Should succeed without FK error"
