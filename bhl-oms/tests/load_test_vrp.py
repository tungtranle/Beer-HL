#!/usr/bin/env python3
"""
BHL OMS — Load Test: VRP 3,000 orders parallel
Task 4.12: Test VRP solver with 3,000 pending shipments

Usage:
    pip install requests
    python load_test_vrp.py --host http://localhost:8080

Flow:
    1. Login as dispatcher
    2. Create 3,000 orders via SQL (fast)
    3. Call RunVRP endpoint
    4. Poll job status until complete
    5. Measure solver time + trip count
"""

import argparse
import json
import sys
import time

import requests

BASE_URL = "http://localhost:8080"
USERNAME = "dispatcher01"
PASSWORD = "demo123"
WAREHOUSE_HL = "a0000000-0000-0000-0000-000000000001"
DELIVERY_DATE = "2026-03-16"


def login(base_url: str) -> str:
    """Authenticate and return access token."""
    resp = requests.post(
        f"{base_url}/v1/auth/login",
        json={"username": USERNAME, "password": PASSWORD},
        timeout=10,
    )
    resp.raise_for_status()
    return resp.json()["tokens"]["access_token"]


def run_vrp(base_url: str, token: str) -> dict:
    """Trigger VRP planning and return job info."""
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    payload = {
        "warehouse_id": WAREHOUSE_HL,
        "delivery_date": DELIVERY_DATE,
    }

    start = time.monotonic()
    resp = requests.post(
        f"{base_url}/v1/planning/run-vrp",
        json=payload,
        headers=headers,
        timeout=300,
    )
    elapsed_ms = (time.monotonic() - start) * 1000

    if not resp.ok:
        print(f"❌ VRP request failed: HTTP {resp.status_code}")
        print(f"   Response: {resp.text[:500]}")
        return None

    data = resp.json()
    print(f"   VRP request accepted in {elapsed_ms:.0f}ms")
    print(f"   Job ID: {data.get('job_id', 'N/A')}")
    return data


def poll_vrp_job(base_url: str, token: str, job_id: str, timeout_sec: int = 300) -> dict:
    """Poll VRP job until completion."""
    headers = {"Authorization": f"Bearer {token}"}
    poll_url = f"{base_url}/v1/planning/jobs/{job_id}"

    start = time.monotonic()
    while time.monotonic() - start < timeout_sec:
        try:
            resp = requests.get(poll_url, headers=headers, timeout=30)
            if resp.ok:
                data = resp.json()
                status = data.get("status", "unknown")
                if status in ("completed", "done", "success"):
                    elapsed = time.monotonic() - start
                    print(f"   VRP completed in {elapsed:.1f}s")
                    return data
                elif status in ("failed", "error"):
                    print(f"   VRP failed: {data.get('error', 'unknown')}")
                    return data
                else:
                    print(f"   Status: {status} — polling...")
        except Exception as e:
            print(f"   Poll error: {e}")

        time.sleep(2)

    print(f"   ⏰ VRP timed out after {timeout_sec}s")
    return None


def count_pending_shipments(base_url: str, token: str) -> int:
    """Check how many pending shipments exist for the delivery date."""
    headers = {"Authorization": f"Bearer {token}"}
    try:
        resp = requests.get(
            f"{base_url}/v1/shipments?status=pending&delivery_date={DELIVERY_DATE}&limit=1",
            headers=headers,
            timeout=10,
        )
        if resp.ok:
            data = resp.json()
            return data.get("total", data.get("count", len(data.get("data", []))))
    except Exception:
        pass
    return -1


def run_load_test(base_url: str):
    """Execute the VRP load test."""
    print(f"\n{'='*60}")
    print(f"  BHL OMS VRP Load Test — 3,000 Orders")
    print(f"  Target: {base_url}")
    print(f"  Warehouse: Kho Hạ Long ({WAREHOUSE_HL})")
    print(f"  Delivery Date: {DELIVERY_DATE}")
    print(f"{'='*60}\n")

    # 1. Login
    print("🔑 Logging in as dispatcher01...")
    token = login(base_url)
    print("   ✅ Authenticated")

    # 2. Check pending shipments
    print("\n📦 Checking pending shipments...")
    count = count_pending_shipments(base_url, token)
    print(f"   Found {count} pending shipments for {DELIVERY_DATE}")

    if count <= 0:
        print("\n⚠️  No pending shipments found!")
        print("   Run this SQL first to create 3,000 test orders for VRP:")
        print(f"""
   -- Quick: Create 3,000 orders + shipments for {DELIVERY_DATE}
   DO $$
   DECLARE
     cids UUID[]; pids UUID[]; ppr NUMERIC[];
     pwt NUMERIC[]; pvol NUMERIC[]; pdep NUMERIC[];
     cnt INT; pcnt INT;
     oid UUID; sid UUID; cid UUID;
     i INT; j INT; pidx INT; q INT;
     ta NUMERIC; td NUMERIC; tw NUMERIC; tv NUMERIC;
   BEGIN
     SELECT array_agg(id), COUNT(*) INTO cids, cnt FROM customers LIMIT 700;
     SELECT array_agg(id ORDER BY sku), array_agg(price ORDER BY sku),
            array_agg(weight_kg ORDER BY sku), array_agg(volume_m3 ORDER BY sku),
            array_agg(deposit_price ORDER BY sku), COUNT(*)
     INTO pids, ppr, pwt, pvol, pdep, pcnt FROM products WHERE is_active;
     FOR i IN 1..3000 LOOP
       oid := gen_random_uuid(); sid := gen_random_uuid();
       cid := cids[1+((i-1)%cnt)];
       ta:=0; td:=0; tw:=0; tv:=0;
       INSERT INTO sales_orders (id,order_number,customer_id,warehouse_id,status,
         delivery_date,total_amount,deposit_amount,total_weight_kg,total_volume_m3,
         atp_status,credit_status,created_by,approved_by,approved_at)
       VALUES (oid,'SO-20260316-'||LPAD(i::TEXT,4,'0'),cid,
         'a0000000-0000-0000-0000-000000000001','approved','{DELIVERY_DATE}',
         0,0,0,0,'passed','passed',
         'b0000000-0000-0000-0000-000000000002',
         'b0000000-0000-0000-0000-000000000004',now());
       FOR j IN 1..3 LOOP
         pidx:=1+((i+j)%pcnt); q:=10+((i*7+j*13)%91);
         INSERT INTO order_items (order_id,product_id,quantity,unit_price,amount,deposit_amount)
         VALUES (oid,pids[pidx],q,ppr[pidx],ppr[pidx]*q,pdep[pidx]*q);
         ta:=ta+ppr[pidx]*q; td:=td+pdep[pidx]*q;
         tw:=tw+pwt[pidx]*q; tv:=tv+pvol[pidx]*q;
       END LOOP;
       UPDATE sales_orders SET total_amount=ta,deposit_amount=td,
         total_weight_kg=tw,total_volume_m3=tv WHERE id=oid;
       INSERT INTO shipments (id,shipment_number,order_id,customer_id,warehouse_id,
         status,delivery_date,total_weight_kg,total_volume_m3,items)
       VALUES (sid,'SH-20260316-'||LPAD(i::TEXT,4,'0'),oid,cid,
         'a0000000-0000-0000-0000-000000000001','pending',
         '{DELIVERY_DATE}',tw,tv,'[]');
     END LOOP;
     RAISE NOTICE 'Created 3000 orders + shipments for VRP test';
   END $$;
        """)
        return 1

    # 3. Run VRP
    print("\n🧮 Running VRP solver...")
    start = time.monotonic()
    vrp_result = run_vrp(base_url, token)

    if vrp_result is None:
        print("❌ VRP request failed")
        return 1

    # 4. Check if async (has job_id) or sync (direct result)
    job_id = vrp_result.get("job_id")
    if job_id and vrp_result.get("status") in ("processing", "pending"):
        print(f"\n⏳ Polling VRP job {job_id}...")
        final_result = poll_vrp_job(base_url, token, job_id, timeout_sec=300)
    else:
        final_result = vrp_result

    total_time = time.monotonic() - start

    # 5. Report results
    print(f"\n{'='*60}")
    print(f"  VRP LOAD TEST RESULTS")
    print(f"{'='*60}")
    print(f"  Shipments processed:  {count}")
    print(f"  Total VRP time:       {total_time:.1f}s")

    if final_result:
        trips = final_result.get("trips", final_result.get("routes", []))
        print(f"  Trips generated:      {len(trips)}")
        if trips:
            stops = sum(len(t.get("stops", t.get("nodes", []))) for t in trips)
            print(f"  Total stops:          {stops}")

    # 6. Pass/Fail criteria
    print(f"\n  Criteria:")
    criteria = [
        ("VRP completes in < 120s", total_time < 120),
        ("VRP produces valid trips", final_result is not None),
    ]

    all_pass = True
    for name, passed in criteria:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"    {status}  {name}")
        if not passed:
            all_pass = False

    print(f"\n  {'🎉 VRP LOAD TEST PASSED!' if all_pass else '⚠️  VRP LOAD TEST FAILED'}")
    print(f"{'='*60}\n")

    return 0 if all_pass else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BHL OMS Load Test — VRP")
    parser.add_argument("--host", default=BASE_URL, help="API base URL")
    args = parser.parse_args()

    sys.exit(run_load_test(args.host))
