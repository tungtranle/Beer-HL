#!/usr/bin/env python3
"""
Clean old test data from PostgreSQL directly via Docker exec.
No Docker rebuild needed.
"""
import subprocess
import sys
import time

MAC_USER = "tungtranle"
MAC_IP = "192.168.88.123"

# SQL commands to delete old test data in correct FK order
CLEANUP_SQL = """
DELETE FROM picking_orders WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='picking_orders');
DELETE FROM trip_stops WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='trip_stops');
DELETE FROM trips WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='trips');
DELETE FROM shipments WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='shipments');
DELETE FROM order_confirmations WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='order_confirmations');
DELETE FROM sales_orders WHERE id IN (SELECT entity_id FROM qa_owned_entities WHERE entity_type='sales_orders');
DELETE FROM qa_owned_entities;
SELECT count(*) FROM qa_owned_entities;
"""

def run_ssh_cmd(cmd):
    """Run command via SSH to Mac"""
    key_path = "$env:USERPROFILE\\.ssh\\id_ed25519_bhl"
    full_cmd = f'''powershell -Command "$key='{key_path}'; ssh -i $key {MAC_USER}@{MAC_IP} '{cmd}' 2>&1"'''
    result = subprocess.run(full_cmd, shell=True, capture_output=True, text=True)
    return result.stdout + result.stderr

def psql_cmd(sql):
    """Execute SQL via docker exec psql"""
    # Escape quotes for shell
    sql_escaped = sql.replace('"', '\\"').replace("'", "'\\''")
    cmd = f'/Applications/Docker.app/Contents/Resources/bin/docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_prod -c "{sql_escaped}"'
    return run_ssh_cmd(cmd)

print("🧹 Cleaning old test data from PostgreSQL...")
print("=" * 50)

# Delete old test data
print("1️⃣ Deleting old test data...")
output = psql_cmd(CLEANUP_SQL)
print(output)

# Verify cleanup
print("\n2️⃣ Verifying cleanup...")
verify_output = psql_cmd("SELECT count(*) FROM qa_owned_entities;")
print(verify_output)

# Restart API
print("\n3️⃣ Restarting API container...")
restart_cmd = '/Applications/Docker.app/Contents/Resources/bin/docker compose -f ~/Projects/Beer-HL/bhl-oms/docker-compose.prod.yml restart api'
restart_output = run_ssh_cmd(restart_cmd)
print(restart_output)

print("\n4️⃣ Waiting for API to be ready...")
time.sleep(3)

# Verify health
print("5️⃣ Checking API health...")
health_cmd = 'curl -s http://localhost:8080/v1/health | grep -o \'"status":"ok"\''
health_output = run_ssh_cmd(health_cmd)
if "ok" in health_output:
    print("✅ API is healthy!")
else:
    print("⏳ API starting... wait 10 seconds and refresh browser")

print("\n" + "=" * 50)
print("✅ Cleanup complete!")
print("\n🧪 Next steps:")
print("   1. Open https://bhl.symper.us/test-portal")
print("   2. Click DEMO-01 → 'Nạp data'")
print("   3. Click 'Xóa scoped'")
print("   4. Should see SUCCESS (no FK error)")
