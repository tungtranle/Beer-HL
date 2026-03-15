"""
BHL VRP Benchmark — 1,000 orders + 100 vehicles
Acceptance criteria: solve_time < 120s (BRD R-VRP-01)

Usage:
    python benchmark_vrp.py [--url http://localhost:8090] [--orders 1000] [--vehicles 100]

Generates random shipment locations within Ho Chi Minh City area,
sends to VRP solver, and reports performance metrics.
"""

import json
import random
import sys
import time
import urllib.request
import urllib.error

# HCM City bounding box (lat, lng)
HCM_CENTER = (10.8231, 106.6297)  # Depot: BHL warehouse (Quận 1 area)
HCM_BOUNDS = {
    'lat_min': 10.72,   # Southern HCM
    'lat_max': 10.92,   # Northern HCM
    'lng_min': 106.55,  # Western HCM
    'lng_max': 106.75,  # Eastern HCM
}

# Vehicle types matching DB enum
VEHICLE_TYPES = [
    {'type': 'truck_3t5', 'capacity': 3500},
    {'type': 'truck_5t',  'capacity': 5000},
    {'type': 'truck_8t',  'capacity': 8000},
    {'type': 'truck_15t', 'capacity': 15000},
]


def generate_orders(count):
    """Generate random shipment nodes in HCM area"""
    nodes = []
    for i in range(count):
        lat = random.uniform(HCM_BOUNDS['lat_min'], HCM_BOUNDS['lat_max'])
        lng = random.uniform(HCM_BOUNDS['lng_min'], HCM_BOUNDS['lng_max'])
        # Demand: 50-2000 kg per order (typical beer delivery)
        demand = random.randint(50, 2000)
        nodes.append({
            'id': f'SHP-{i+1:04d}',
            'location': [lat, lng],
            'demand': demand,
        })
    return nodes


def generate_vehicles(count):
    """Generate fleet of vehicles with mixed capacities"""
    vehicles = []
    for i in range(count):
        vtype = VEHICLE_TYPES[i % len(VEHICLE_TYPES)]
        vehicles.append({
            'id': f'VH-{i+1:03d}',
            'capacity': vtype['capacity'],
            'type': vtype['type'],
        })
    return vehicles


def run_benchmark(url, num_orders, num_vehicles):
    """Run VRP benchmark and print results"""
    print(f"{'='*60}")
    print(f"  BHL VRP Benchmark")
    print(f"  Solver URL:  {url}")
    print(f"  Orders:      {num_orders}")
    print(f"  Vehicles:    {num_vehicles}")
    print(f"{'='*60}")
    print()

    # Check solver health
    try:
        req = urllib.request.Request(f"{url}/health")
        with urllib.request.urlopen(req, timeout=5) as resp:
            health = json.loads(resp.read().decode())
        print(f"[OK] Solver healthy: {health}")
    except Exception as e:
        print(f"[FAIL] Solver not reachable at {url}: {e}")
        sys.exit(1)

    # Check OSRM status
    try:
        req = urllib.request.Request(f"{url}/status")
        with urllib.request.urlopen(req, timeout=10) as resp:
            status = json.loads(resp.read().decode())
        print(f"[INFO] OSRM available: {status.get('osrm_available', 'unknown')}")
    except Exception:
        print("[INFO] /status endpoint not available (old solver version)")

    print()

    # Generate test data
    print(f"Generating {num_orders} orders in HCM area...")
    nodes = generate_orders(num_orders)
    vehicles = generate_vehicles(num_vehicles)

    total_demand = sum(n['demand'] for n in nodes)
    total_capacity = sum(v['capacity'] for v in vehicles)
    print(f"  Total demand:   {total_demand:,} kg")
    print(f"  Total capacity: {total_capacity:,} kg")
    print(f"  Utilization:    {total_demand/total_capacity*100:.1f}%")
    print()

    # Build request
    payload = {
        'depot': list(HCM_CENTER),
        'nodes': nodes,
        'vehicles': vehicles,
    }

    body = json.dumps(payload).encode('utf-8')
    print(f"Payload size: {len(body):,} bytes")
    print(f"Sending to solver...")
    print()

    # Call solver
    start = time.time()
    req = urllib.request.Request(
        f"{url}/solve",
        data=body,
        headers={'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as resp:
            result = json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        elapsed = time.time() - start
        print(f"[FAIL] Solver request failed after {elapsed:.1f}s: {e}")
        sys.exit(1)
    except Exception as e:
        elapsed = time.time() - start
        print(f"[FAIL] Error after {elapsed:.1f}s: {e}")
        sys.exit(1)

    elapsed_total = time.time() - start

    # Print results
    status = result.get('status', 'unknown')
    solve_time_ms = result.get('solve_time_ms', 0)
    routes = result.get('routes', [])
    unassigned = result.get('unassigned', [])
    distance_source = result.get('distance_source', 'unknown')

    print(f"{'='*60}")
    print(f"  RESULTS")
    print(f"{'='*60}")
    print(f"  Status:           {status}")
    print(f"  Distance source:  {distance_source}")
    print(f"  Solve time:       {solve_time_ms:,} ms ({solve_time_ms/1000:.1f}s)")
    print(f"  Total time (net): {elapsed_total*1000:,.0f} ms ({elapsed_total:.1f}s)")
    print(f"  Routes created:   {len(routes)}")
    print(f"  Unassigned:       {len(unassigned)}")
    print()

    if routes:
        total_dist = sum(r['distance_km'] for r in routes)
        total_dur = sum(r['duration_min'] for r in routes)
        total_stops = sum(len(r['node_ids']) for r in routes)
        avg_stops = total_stops / len(routes)
        max_stops = max(len(r['node_ids']) for r in routes)
        min_stops = min(len(r['node_ids']) for r in routes)

        print(f"  Route statistics:")
        print(f"    Total distance:  {total_dist:,.1f} km")
        print(f"    Total duration:  {total_dur:,} min ({total_dur/60:.1f} hrs)")
        print(f"    Avg stops/route: {avg_stops:.1f}")
        print(f"    Min stops:       {min_stops}")
        print(f"    Max stops:       {max_stops}")

        # Top 5 longest routes
        sorted_routes = sorted(routes, key=lambda r: r['distance_km'], reverse=True)
        print(f"\n  Top 5 longest routes:")
        for i, r in enumerate(sorted_routes[:5]):
            print(f"    {i+1}. {r['vehicle_id']}: {r['distance_km']:.1f} km, "
                  f"{r['duration_min']} min, {len(r['node_ids'])} stops")

    print()
    print(f"{'='*60}")

    # Pass/fail
    threshold_ms = 120_000  # 120 seconds
    if solve_time_ms <= threshold_ms:
        print(f"  BENCHMARK: PASSED  ({solve_time_ms/1000:.1f}s < 120s)")
    else:
        print(f"  BENCHMARK: FAILED  ({solve_time_ms/1000:.1f}s > 120s)")

    print(f"{'='*60}")

    return solve_time_ms <= threshold_ms


if __name__ == '__main__':
    url = 'http://localhost:8090'
    num_orders = 1000
    num_vehicles = 100

    # Simple arg parsing
    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == '--url' and i + 1 < len(args):
            url = args[i + 1]
            i += 2
        elif args[i] == '--orders' and i + 1 < len(args):
            num_orders = int(args[i + 1])
            i += 2
        elif args[i] == '--vehicles' and i + 1 < len(args):
            num_vehicles = int(args[i + 1])
            i += 2
        elif args[i] in ('--help', '-h'):
            print(__doc__)
            sys.exit(0)
        else:
            print(f"Unknown arg: {args[i]}")
            sys.exit(1)

    passed = run_benchmark(url, num_orders, num_vehicles)
    sys.exit(0 if passed else 1)
