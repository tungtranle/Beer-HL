#!/usr/bin/env python3
"""
BHL OMS — Load Test: 3,000 đơn hàng
Task 4.11: Tạo 3,000 orders via API và đo performance

Usage:
    pip install requests
    python load_test_orders.py --host http://localhost:8080 --count 3000

Metrics:
    - Throughput (orders/sec)
    - Latency p50, p95, p99
    - Error rate
    - Total time
"""

import argparse
import json
import random
import statistics
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, timedelta

import requests

# ─── Configuration ───────────────────────────────────────
BASE_URL = "http://localhost:8080"
USERNAME = "dispatcher01"
PASSWORD = "demo123"
WAREHOUSE_HL = "a0000000-0000-0000-0000-000000000001"
WAREHOUSE_HP = "a0000000-0000-0000-0000-000000000002"
DELIVERY_DATE = (date.today() + timedelta(days=1)).isoformat()
TIME_WINDOWS = ["08:00-12:00", "09:00-13:00", "13:00-17:00", "14:00-18:00"]


def login(base_url: str) -> str:
    """Authenticate and return access token."""
    resp = requests.post(
        f"{base_url}/v1/auth/login",
        json={"username": USERNAME, "password": PASSWORD},
        timeout=10,
    )
    resp.raise_for_status()
    data = resp.json()
    return data["tokens"]["access_token"]


def load_metadata(base_url: str, token: str) -> tuple:
    """Load customer and product IDs for order generation."""
    headers = {"Authorization": f"Bearer {token}"}

    # Get customers
    resp = requests.get(f"{base_url}/v1/customers?limit=800", headers=headers, timeout=10)
    resp.raise_for_status()
    customers = [c["id"] for c in resp.json().get("data", resp.json().get("customers", []))]

    # Get products
    resp = requests.get(f"{base_url}/v1/products?limit=50", headers=headers, timeout=10)
    resp.raise_for_status()
    products = [p["id"] for p in resp.json().get("data", resp.json().get("products", []))]

    if not customers or not products:
        print(f"ERROR: Found {len(customers)} customers, {len(products)} products")
        sys.exit(1)

    print(f"Loaded {len(customers)} customers, {len(products)} products")
    return customers, products


def create_order(base_url: str, token: str, customers: list, products: list, idx: int) -> dict:
    """Create a single order and return timing info."""
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    customer_id = customers[idx % len(customers)]
    warehouse_id = WAREHOUSE_HL if idx % 5 != 0 else WAREHOUSE_HP
    num_items = random.randint(2, 5)

    items = []
    used_products = set()
    for _ in range(num_items):
        product_id = random.choice(products)
        while product_id in used_products and len(used_products) < len(products):
            product_id = random.choice(products)
        used_products.add(product_id)
        items.append({
            "product_id": product_id,
            "quantity": random.randint(10, 100),
        })

    payload = {
        "customer_id": customer_id,
        "warehouse_id": warehouse_id,
        "delivery_date": DELIVERY_DATE,
        "time_window": random.choice(TIME_WINDOWS),
        "items": items,
    }

    start = time.monotonic()
    try:
        resp = requests.post(
            f"{base_url}/v1/orders",
            json=payload,
            headers=headers,
            timeout=30,
        )
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "idx": idx,
            "status": resp.status_code,
            "ok": 200 <= resp.status_code < 300,
            "latency_ms": elapsed_ms,
            "error": None if resp.ok else resp.text[:200],
        }
    except Exception as e:
        elapsed_ms = (time.monotonic() - start) * 1000
        return {
            "idx": idx,
            "status": 0,
            "ok": False,
            "latency_ms": elapsed_ms,
            "error": str(e)[:200],
        }


def run_load_test(base_url: str, count: int, concurrency: int):
    """Execute the load test."""
    print(f"\n{'='*60}")
    print(f"  BHL OMS Load Test — {count} Orders")
    print(f"  Target: {base_url}")
    print(f"  Concurrency: {concurrency} threads")
    print(f"  Delivery Date: {DELIVERY_DATE}")
    print(f"{'='*60}\n")

    # 1. Login
    print("🔑 Logging in...")
    token = login(base_url)
    print(f"   Token obtained ✅")

    # 2. Load metadata
    print("📦 Loading metadata...")
    customers, products = load_metadata(base_url, token)

    # 3. Run orders
    print(f"\n🚀 Creating {count} orders with {concurrency} threads...\n")
    results = []
    start_time = time.monotonic()
    completed = 0

    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        futures = {
            executor.submit(create_order, base_url, token, customers, products, i): i
            for i in range(1, count + 1)
        }

        for future in as_completed(futures):
            result = future.result()
            results.append(result)
            completed += 1

            if completed % 100 == 0:
                elapsed = time.monotonic() - start_time
                rate = completed / elapsed
                pct = (completed / count) * 100
                print(f"   [{pct:5.1f}%] {completed}/{count} orders — {rate:.1f} orders/sec")

    total_time = time.monotonic() - start_time

    # 4. Calculate metrics
    latencies = [r["latency_ms"] for r in results if r["ok"]]
    errors = [r for r in results if not r["ok"]]
    success_count = len(latencies)

    print(f"\n{'='*60}")
    print(f"  RESULTS")
    print(f"{'='*60}")
    print(f"  Total orders:     {count}")
    print(f"  Successful:       {success_count}")
    print(f"  Failed:           {len(errors)}")
    print(f"  Error rate:       {len(errors)/count*100:.2f}%")
    print(f"  Total time:       {total_time:.1f}s")
    print(f"  Throughput:       {success_count/total_time:.1f} orders/sec")

    if latencies:
        latencies.sort()
        print(f"\n  Latency (ms):")
        print(f"    p50:  {statistics.median(latencies):.0f} ms")
        print(f"    p95:  {latencies[int(len(latencies)*0.95)]:.0f} ms")
        print(f"    p99:  {latencies[int(len(latencies)*0.99)]:.0f} ms")
        print(f"    min:  {min(latencies):.0f} ms")
        print(f"    max:  {max(latencies):.0f} ms")
        print(f"    avg:  {statistics.mean(latencies):.0f} ms")

    if errors:
        print(f"\n  ⚠️  First 5 errors:")
        for e in errors[:5]:
            print(f"    Order #{e['idx']}: HTTP {e['status']} — {e['error']}")

    # 5. Pass/Fail criteria
    print(f"\n{'='*60}")
    error_rate = len(errors) / count * 100
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 99999
    throughput = success_count / total_time

    criteria = [
        ("Error rate < 1%", error_rate < 1),
        ("p95 latency < 2000ms", p95 < 2000),
        ("Throughput > 10 orders/sec", throughput > 10),
    ]

    all_pass = True
    for name, passed in criteria:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {status}  {name}")
        if not passed:
            all_pass = False

    print(f"\n  {'🎉 LOAD TEST PASSED!' if all_pass else '⚠️  LOAD TEST FAILED'}")
    print(f"{'='*60}\n")

    return 0 if all_pass else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="BHL OMS Load Test — Orders")
    parser.add_argument("--host", default=BASE_URL, help="API base URL")
    parser.add_argument("--count", type=int, default=3000, help="Number of orders")
    parser.add_argument("--concurrency", type=int, default=20, help="Concurrent threads")
    args = parser.parse_args()

    sys.exit(run_load_test(args.host, args.count, args.concurrency))
