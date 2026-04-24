"""
BHL VRP Solver - Vehicle Routing Problem solver using Google OR-Tools
Receives shipment locations + vehicle capacities → returns optimized routes
"""

import json
import math
import time
import os
import logging
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
try:
    from ortools.constraint_solver import routing_enums_pb2, pywrapcp
except ImportError:
    from ortools.constraint_routing import routing_enums_pb2, pywrapcp

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

OSRM_URL = os.environ.get('OSRM_URL', 'http://localhost:5000')
_osrm_available = None


def haversine(lat1, lon1, lat2, lon2):
    """Calculate distance in km between two GPS coordinates"""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    c = 2 * math.asin(math.sqrt(a))
    return R * c


def point_to_segment_distance_km(px, py, x1, y1, x2, y2):
    """Minimum haversine distance from point (px, py) to segment (x1,y1)-(x2,y2) in km.
    Uses lat/lon projection onto the line segment."""
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return haversine(px, py, x1, y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
    proj_x = x1 + t * dx
    proj_y = y1 + t * dy
    return haversine(px, py, proj_x, proj_y)


def is_toll_on_route(from_lat, from_lng, to_lat, to_lng, toll_lat, toll_lng):
    """Check if a toll station is 'on the way' between two points.
    
    Uses detour factor (triangle inequality): if going from→toll→to adds less
    than X% distance compared to direct from→to, the toll is on the route.
    
    This is fundamentally more accurate than point-to-segment distance because:
    - Real roads curve — straight-line distance misses tolls on curved routes
    - Detour factor is independent of road geometry
    - A toll with detour ratio 1.05 means going through it adds only 5% to journey
    
    The max allowed detour scales with distance:
    - Short arcs (<5km): generous (toll within ~3km radius)
    - Medium arcs (20km): ~15% detour
    - Long arcs (50km+): ~10% detour
    """
    direct_km = haversine(from_lat, from_lng, to_lat, to_lng)
    if direct_km < 0.3:
        return False  # Too short, skip
    
    via_toll_km = (haversine(from_lat, from_lng, toll_lat, toll_lng) +
                   haversine(toll_lat, toll_lng, to_lat, to_lng))
    
    # Scale max detour ratio: generous for short arcs, strict for long ones
    max_detour_pct = max(0.10, 3.0 / max(direct_km, 0.5))
    max_ratio = 1.0 + max_detour_pct
    
    return via_toll_km <= direct_km * max_ratio


def check_osrm_available(force_recheck=False):
    """Check if OSRM service is reachable (cached, reset per solve request)"""
    global _osrm_available
    if force_recheck:
        _osrm_available = None
    if _osrm_available is not None:
        return _osrm_available
    try:
        req = urllib.request.Request(f"{OSRM_URL}/health", method='GET')
        with urllib.request.urlopen(req, timeout=3) as resp:
            _osrm_available = resp.status == 200
    except Exception:
        # Also try a simple route query as health endpoint may not exist
        try:
            url = f"{OSRM_URL}/route/v1/driving/106.6297,10.8231;106.7009,10.7769?overview=false"
            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req, timeout=5) as resp:
                _osrm_available = resp.status == 200
        except Exception:
            _osrm_available = False
    logger.info(f"OSRM available: {_osrm_available} ({OSRM_URL})")
    return _osrm_available


# ═══════════════════════════════════════════════════════════════
# Route Geometry-Based Toll Detection (post-solve, chính xác)
# Thay vì kiểm tra khoảng cách đến đường thẳng (arc), ta lấy
# tuyến đường thực tế từ OSRM rồi duyệt từng điểm trên polyline
# để phát hiện trạm thu phí nào xe đi qua.
# ═══════════════════════════════════════════════════════════════

def get_route_geometry(waypoints, exclude=None):
    """Lấy tuyến đường thực tế từ OSRM cho danh sách waypoint.

    Args:
        waypoints: list of (lat, lng) tuples — [depot, stop1, ..., stopN, depot]
        exclude: optional OSRM exclude parameter, e.g. 'toll'
    Returns:
        dict {
            'polyline': [(lat, lng), ...],  — đường đi thực tế
            'total_distance_m': float,       — tổng quãng đường (mét)
            'total_duration_s': float,        — tổng thời gian (giây)
            'leg_distances_m': [float, ...]   — quãng đường từng chặng
        }
        hoặc None nếu OSRM lỗi
    """
    if not check_osrm_available() or len(waypoints) < 2:
        return None

    # OSRM format: lon,lat (ngược với lat,lon)
    coords = ";".join(f"{p[1]},{p[0]}" for p in waypoints)
    url = f"{OSRM_URL}/route/v1/driving/{coords}?geometries=geojson&overview=full&steps=false"
    if exclude:
        url += f"&exclude={exclude}"

    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())

        if data.get('code') != 'Ok' or not data.get('routes'):
            logger.warning(f"OSRM route trả về: {data.get('code')}")
            return None

        route = data['routes'][0]
        geometry = route['geometry']

        # GeoJSON coordinates: [lon, lat] → chuyển sang (lat, lon)
        polyline = [(c[1], c[0]) for c in geometry['coordinates']]

        # Tổng distance/duration
        total_distance_m = route.get('distance', 0)
        total_duration_s = route.get('duration', 0)

        # Distance từng chặng (leg)
        leg_distances_m = [leg.get('distance', 0) for leg in route.get('legs', [])]

        logger.info(f"OSRM route: {len(polyline)} điểm, {total_distance_m/1000:.1f}km, "
                     f"{len(waypoints)} waypoints")
        return {
            'polyline': polyline,
            'total_distance_m': total_distance_m,
            'total_duration_s': total_duration_s,
            'leg_distances_m': leg_distances_m,
        }
    except Exception as e:
        logger.warning(f"OSRM route request lỗi: {e}")
        return None


def detect_tolls_on_polyline(polyline, toll_stations, toll_expressways, toll_class):
    """Phát hiện trạm thu phí dọc theo tuyến đường thực tế (polyline).

    Thuật toán:
    1. Duyệt từng điểm trên polyline
    2. Với mỗi điểm, kiểm tra khoảng cách haversine đến tất cả trạm hở
       → nếu < detection_radius → xe đi qua trạm → tính phí cố định
    3. Với mỗi điểm, kiểm tra khoảng cách đến tất cả cổng cao tốc
       → ghi nhận cổng nào xe đi qua, THEO THỨ TỰ
    4. Sau khi duyệt xong, xác định cặp entry/exit cho mỗi cao tốc
       → phí = |km_exit - km_entry| × đơn giá/km
    5. Deduplicate: cùng 1 trạm hit bởi nhiều điểm polyline liên tiếp → tính 1 lần

    Args:
        polyline: [(lat, lng), ...] — tuyến đường từ OSRM
        toll_stations: [{'name', 'lat', 'lng', 'radius_m', 'fee_l1'...'fee_l5'}, ...]
        toll_expressways: [{'name', 'rate_per_km_l1'..., 'gates': [{'name', 'lat', 'lng', 'km_marker', 'radius_m'}, ...]}, ...]
        toll_class: 'L1'...'L5'
    Returns:
        (total_toll_vnd, tolls_passed_list)
        tolls_passed_list: [{'station_name', 'fee_vnd', 'latitude', 'longitude', 'distance_km'?}, ...]
    """
    toll_class_lower = (toll_class or 'L2').lower()
    fee_key = f'fee_{toll_class_lower}'
    rate_key = f'rate_per_km_{toll_class_lower}'

    total_toll = 0.0
    tolls_passed = []

    # ── Bước 1: Phát hiện trạm hở (open toll) ──
    # Đánh dấu trạm nào đã tính để không đếm trùng
    station_hit = set()

    for pt in polyline:
        for idx, ts in enumerate(toll_stations):
            if idx in station_hit:
                continue
            dist_m = haversine(pt[0], pt[1], ts['lat'], ts['lng']) * 1000
            if dist_m <= ts.get('radius_m', 150):
                fee = ts.get(fee_key, ts.get('fee_l2', 0))
                total_toll += fee
                tolls_passed.append({
                    'station_name': ts['name'],
                    'fee_vnd': fee,
                    'latitude': ts.get('lat', 0),
                    'longitude': ts.get('lng', 0),
                    'toll_type': 'open',
                })
                station_hit.add(idx)

    # ── Bước 2: Phát hiện cao tốc kín (expressway) ──
    # Duyệt polyline → ghi nhận cổng nào xe qua, theo thứ tự
    for ew in toll_expressways:
        gates = ew.get('gates', [])
        if len(gates) < 2:
            continue

        # Tìm tất cả cổng mà xe đi qua, theo thứ tự polyline
        gates_hit = []  # [(polyline_index, gate_data)]
        gate_hit_ids = set()

        for pt_idx, pt in enumerate(polyline):
            for g in gates:
                g_id = id(g)  # unique identifier cho mỗi gate object
                if g_id in gate_hit_ids:
                    continue
                dist_m = haversine(pt[0], pt[1], g['lat'], g['lng']) * 1000
                if dist_m <= g.get('radius_m', 250):
                    gates_hit.append((pt_idx, g))
                    gate_hit_ids.add(g_id)

        # Cần ít nhất 2 cổng (entry + exit) để tính phí
        if len(gates_hit) >= 2:
            # Sắp xếp theo thứ tự polyline (đã tự nhiên theo thứ tự duyệt)
            # Entry = cổng đầu tiên, Exit = cổng cuối cùng
            entry_gate = gates_hit[0][1]
            exit_gate = gates_hit[-1][1]

            km_diff = abs(exit_gate.get('km_marker', 0) - entry_gate.get('km_marker', 0))
            rate = ew.get(rate_key, ew.get('rate_per_km_l2', 0))
            fee = km_diff * rate

            if fee > 0:
                total_toll += fee
                tolls_passed.append({
                    'station_name': f"{ew['name']} ({entry_gate['name']}→{exit_gate['name']})",
                    'fee_vnd': fee,
                    'distance_km': km_diff,
                    'latitude': entry_gate.get('lat', 0),
                    'longitude': entry_gate.get('lng', 0),
                    'toll_type': 'expressway',
                })

    return total_toll, tolls_passed


def build_osrm_matrix(all_points, exclude=None):
    """Build distance and duration matrices from OSRM table service.
    
    Args:
        all_points: list of (lat, lng) tuples, index 0 = depot
        exclude: optional OSRM exclude parameter, e.g. 'toll' to avoid toll roads
    Returns:
        (distance_matrix, duration_matrix) in meters and seconds,
        or (None, None) if OSRM fails
    """
    # OSRM table API: coords are lon,lat (reversed from our lat,lon)
    coords = ";".join(f"{p[1]},{p[0]}" for p in all_points)
    url = f"{OSRM_URL}/table/v1/driving/{coords}?annotations=distance,duration"
    if exclude:
        url += f"&exclude={exclude}"
    
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.loads(resp.read().decode())
        
        if data.get('code') != 'Ok':
            logger.warning(f"OSRM table returned: {data.get('code')} (exclude={exclude})")
            return None, None
        
        distances = data['distances']  # meters
        durations = data['durations']  # seconds
        
        n = len(all_points)
        dist_matrix = [[0] * n for _ in range(n)]
        dur_matrix = [[0] * n for _ in range(n)]
        
        for i in range(n):
            for j in range(n):
                dist_matrix[i][j] = int(distances[i][j]) if distances[i][j] is not None else 999999
                dur_matrix[i][j] = int(durations[i][j]) if durations[i][j] is not None else 999999
        
        logger.info(f"OSRM matrix built: {n}x{n} points (exclude={exclude})")
        return dist_matrix, dur_matrix
        
    except Exception as e:
        logger.warning(f"OSRM table request failed: {e} (exclude={exclude})")
        return None, None


def build_distance_matrix(depot, nodes):
    """Build distance matrix using Haversine formula (fallback from OSRM)"""
    all_points = [depot] + [(n['location'][0], n['location'][1]) for n in nodes]
    n = len(all_points)
    matrix = [[0] * n for _ in range(n)]
    
    for i in range(n):
        for j in range(n):
            if i != j:
                dist = haversine(all_points[i][0], all_points[i][1],
                               all_points[j][0], all_points[j][1])
                matrix[i][j] = int(dist * 1000)  # Convert to meters for OR-Tools
    
    return matrix


def detect_toll_cost_on_arc(from_lat, from_lng, to_lat, to_lng, toll_stations, toll_expressways, toll_class):
    """Calculate total toll cost (VND) for an arc between two points for a given toll class.
    
    Returns (total_toll_vnd, list of {name, fee_vnd}).
    """
    toll_class_lower = toll_class.lower() if toll_class else 'l2'
    fee_key = f'fee_{toll_class_lower}'
    rate_key = f'rate_per_km_{toll_class_lower}'
    total = 0.0
    passed = []

    # Check open toll stations (fixed fee per pass)
    for ts in toll_stations:
        dist_km = point_to_segment_distance_km(ts['lat'], ts['lng'],
                                                from_lat, from_lng, to_lat, to_lng)
        if dist_km * 1000 <= ts.get('radius_m', 200):
            fee = ts.get(fee_key, ts.get('fee_l2', 0))
            total += fee
            passed.append({'station_name': ts['name'], 'fee_vnd': fee})

    # Check closed toll expressways (per-km pricing between entry/exit gates)
    for ew in toll_expressways:
        gates = ew.get('gates', [])
        if len(gates) < 2:
            continue
        # Find gates that THIS arc passes near
        near_gates = []
        for g in gates:
            dist_km = point_to_segment_distance_km(g['lat'], g['lng'],
                                                    from_lat, from_lng, to_lat, to_lng)
            if dist_km * 1000 <= g.get('radius_m', 300):
                near_gates.append(g)
        if len(near_gates) >= 2:
            # Sort by km_marker to find entry and exit
            near_gates.sort(key=lambda g: g.get('km_marker', 0))
            km_diff = abs(near_gates[-1].get('km_marker', 0) - near_gates[0].get('km_marker', 0))
            rate = ew.get(rate_key, ew.get('rate_per_km_l2', 0))
            fee = km_diff * rate
            if fee > 0:
                total += fee
                passed.append({
                    'station_name': f"{ew['name']} ({near_gates[0]['name']}→{near_gates[-1]['name']})",
                    'fee_vnd': fee,
                    'distance_km': km_diff,
                })

    return total, passed


def build_vehicle_cost_matrices(all_points, distance_matrix, vehicles, toll_stations, toll_expressways):
    """Build per-vehicle cost matrices in VND (integer).
    
    Cost = fuel_cost + toll_cost for each arc.
    The solver will minimize total cost, naturally balancing toll vs fuel.
    
    Also returns per-arc toll details for post-solve reporting.
    Optimized: pre-compute toll detection ONCE per arc, then multiply by vehicle rates.
    """
    n = len(all_points)
    num_v = len(vehicles)
    cost_matrices = []
    arc_toll_details = {}  # (vehicle_idx, from, to) → list of toll details

    # ── Step 1: Pre-compute toll detection per arc (vehicle-agnostic) ──
    # For each arc (i,j), store which toll stations/expressways are hit
    arc_toll_hits = {}  # (i,j) → list of {'type': 'station'|'expressway', ...}
    
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            hits = []
            from_lat, from_lng = all_points[i]
            to_lat, to_lng = all_points[j]
            
            # Check open toll stations (detour factor algorithm)
            for ts in toll_stations:
                if is_toll_on_route(from_lat, from_lng, to_lat, to_lng, ts['lat'], ts['lng']):
                    hits.append({'type': 'station', 'data': ts, 'toll_type': 'open'})
            
            # Check closed toll expressways (detour factor on each gate)
            for ew in toll_expressways:
                gates = ew.get('gates', [])
                if len(gates) < 2:
                    continue
                near_gates = []
                for g in gates:
                    if is_toll_on_route(from_lat, from_lng, to_lat, to_lng, g['lat'], g['lng']):
                        near_gates.append(g)
                if len(near_gates) >= 2:
                    near_gates.sort(key=lambda g: g.get('km_marker', 0))
                    km_diff = abs(near_gates[-1].get('km_marker', 0) - near_gates[0].get('km_marker', 0))
                    hits.append({'type': 'expressway', 'data': ew, 'km_diff': km_diff, 
                                 'gate_names': (near_gates[0]['name'], near_gates[-1]['name']),
                                 'toll_type': 'expressway'})
            
            if hits:
                arc_toll_hits[(i, j)] = hits
    
    logger.info(f"Pre-computed toll detection: {len(arc_toll_hits)} arcs have tolls out of {n*n} total")

    # ── Step 2: Build per-vehicle cost matrix using pre-computed tolls ──
    for vi, veh in enumerate(vehicles):
        fuel_cost_per_km = veh.get('fuel_cost_per_km', 3300)
        toll_class = veh.get('toll_class', 'L2')
        toll_class_lower = toll_class.lower() if toll_class else 'l2'
        fee_key = f'fee_{toll_class_lower}'
        rate_key = f'rate_per_km_{toll_class_lower}'
        matrix = [[0] * n for _ in range(n)]

        for i in range(n):
            for j in range(n):
                if i == j:
                    continue
                dist_km = distance_matrix[i][j] / 1000.0
                fuel_cost = fuel_cost_per_km * dist_km

                hits = arc_toll_hits.get((i, j))
                if hits:
                    toll_cost = 0.0
                    toll_details = []
                    for hit in hits:
                        if hit['type'] == 'station':
                            ts = hit['data']
                            fee = ts.get(fee_key, ts.get('fee_l2', 0))
                            toll_cost += fee
                            toll_details.append({'station_name': ts['name'], 'fee_vnd': fee,
                                                 'latitude': ts.get('lat', 0), 'longitude': ts.get('lng', 0),
                                                 'toll_type': 'open'})
                        elif hit['type'] == 'expressway':
                            ew = hit['data']
                            rate = ew.get(rate_key, ew.get('rate_per_km_l2', 0))
                            fee = hit['km_diff'] * rate
                            if fee > 0:
                                gates = ew.get('gates', [])
                                gate_lat = gates[0].get('lat', 0) if gates else 0
                                gate_lng = gates[0].get('lng', 0) if gates else 0
                                toll_cost += fee
                                toll_details.append({
                                    'station_name': f"{ew['name']} ({hit['gate_names'][0]}→{hit['gate_names'][1]})",
                                    'fee_vnd': fee,
                                    'distance_km': hit['km_diff'],
                                    'latitude': gate_lat, 'longitude': gate_lng,
                                    'toll_type': 'expressway',
                                })
                    if toll_details:
                        arc_toll_details[(vi, i, j)] = toll_details
                    matrix[i][j] = int(round(fuel_cost + toll_cost))
                else:
                    # No toll on this arc — pure fuel cost
                    matrix[i][j] = int(round(fuel_cost))

        cost_matrices.append(matrix)

    return cost_matrices, arc_toll_details


def solve_vrp(data, progress_callback=None):
    """Solve CVRP using OR-Tools. 
    progress_callback(stage, pct, detail) is called at each stage for streaming.
    """
    start_time = time.time()
    
    def emit(stage, pct, detail=""):
        if progress_callback:
            progress_callback(stage, pct, detail)
    
    depot = tuple(data['depot'])
    nodes = data['nodes']
    vehicles = data['vehicles']
    
    if not nodes:
        return {'status': 'completed', 'solve_time_ms': 0, 'routes': [], 'unassigned': []}
    
    num_vehicles = len(vehicles)
    num_nodes = len(nodes) + 1  # +1 for depot
    
    # Extract optimization mode
    # 'cost' = avoid tolls → minimize fuel (exclude=toll OSRM)
    # 'time' = minimize total delivery time (driving + loading)
    # 'distance' = minimize total km (normal OSRM)
    optimize_for = data.get('optimize_for', 'cost')
    use_cost = data.get('use_cost_optimization', False)
    max_trip_minutes = data.get('max_trip_minutes', 480)  # default 8 hours
    max_trip_seconds = max_trip_minutes * 60
    arc_toll_details = {}  # (vehicle_id, from_node, to_node) → toll details for fallback
    
    # Build distance matrix — prefer OSRM, fallback to Haversine
    all_points = [depot] + [(n['location'][0], n['location'][1]) for n in nodes]
    duration_matrix = None
    use_osrm = False
    
    emit("matrix", 10, f"{len(all_points)} điểm giao")
    
    if check_osrm_available(force_recheck=True):
        distance_matrix, duration_matrix = build_osrm_matrix(all_points)
        if distance_matrix is not None:
            use_osrm = True
            logger.info(f"Using OSRM distance matrix ({len(all_points)} points)")
    
    if not use_osrm:
        distance_matrix = build_distance_matrix(depot, nodes)
        logger.info("Using Haversine distance matrix (OSRM unavailable)")
    
    # Pre-compute arc toll details for fallback when OSRM route geometry fails
    toll_stations = data.get('toll_stations', [])
    toll_expressways = data.get('toll_expressways', [])
    if toll_stations or toll_expressways:
        emit("toll", 25, f"{len(toll_stations)} trạm BOT, {len(toll_expressways)} cao tốc")
        _, arc_toll_details = build_vehicle_cost_matrices(
            all_points, distance_matrix, vehicles, toll_stations, toll_expressways
        )
        logger.info(f"Arc toll fallback: {len(arc_toll_details)} vehicle-arc toll entries")
    
    # ── Cost mode: build SECOND OSRM matrix with exclude=toll ──
    # The solver uses this alternative matrix → naturally avoids toll roads.
    # This creates GENUINE routing differences from distance mode.
    cost_distance_matrix = None
    if optimize_for == 'cost' and use_osrm:
        emit("toll_matrix", 30, "Tính ma trận tránh BOT")
        notoll_dm, notoll_dur = build_osrm_matrix(all_points, exclude='toll')
        if notoll_dm is not None:
            cost_distance_matrix = notoll_dm
            logger.info(f"Cost mode: exclude=toll OSRM matrix built ({len(all_points)} points)")
        else:
            logger.warning("Cost mode: exclude=toll OSRM failed, falling back to normal matrix")
    
    # Demands (index 0 = depot with 0 demand)
    demands = [0] + [n.get('demand', 0) for n in nodes]
    
    # Vehicle capacities
    capacities = [int(v['capacity']) for v in vehicles]
    
    # Create routing model
    manager = pywrapcp.RoutingIndexManager(num_nodes, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)
    
    # ── Register all callbacks ──
    # 1. Normal distance callback (always)
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]
    transit_callback_index = routing.RegisterTransitCallback(distance_callback)

    # 2. Duration + service time callback
    # If OSRM available: use real durations. Otherwise: estimate from haversine (40 km/h avg).
    service_time_sec = 20 * 60  # 20 min per stop
    if duration_matrix is not None:
        def time_with_service_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            travel = duration_matrix[from_node][to_node]
            if to_node != 0:
                return travel + service_time_sec
            return travel
    else:
        # Fallback: estimate duration from haversine distance
        avg_speed_ms = 40 * 1000 / 3600  # 40 km/h in m/s
        def time_with_service_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            dist_m = distance_matrix[from_node][to_node]
            travel = int(dist_m / avg_speed_ms) if avg_speed_ms > 0 else 0
            if to_node != 0:
                return travel + service_time_sec
            return travel
    time_service_cb_index = routing.RegisterTransitCallback(time_with_service_callback)

    # 3. Cost mode distance callback (exclude=toll, if available)
    cost_cb_index = None
    if cost_distance_matrix is not None:
        def cost_distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return cost_distance_matrix[from_node][to_node]
        cost_cb_index = routing.RegisterTransitCallback(cost_distance_callback)

    # ── Set arc cost based on optimization mode ──
    if optimize_for == 'time':
        # TIME: arc cost = duration + 20min service per stop
        routing.SetArcCostEvaluatorOfAllVehicles(time_service_cb_index)
        logger.info(f"Optimize mode: TIME (duration + 20min/stop, source={'osrm' if duration_matrix is not None else 'haversine_est'})")
    elif optimize_for == 'cost' and cost_cb_index is not None:
        # COST: arc cost = exclude=toll OSRM distance (meters)
        routing.SetArcCostEvaluatorOfAllVehicles(cost_cb_index)
        logger.info("Optimize mode: COST (exclude=toll OSRM meters)")
    else:
        # DISTANCE (or COST without OSRM): arc cost = normal distance (meters)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
        if optimize_for == 'cost' and cost_cb_index is None:
            logger.warning("Optimize mode: COST degraded to DISTANCE (OSRM unavailable, no exclude=toll)")
        else:
            logger.info("Optimize mode: DISTANCE (normal meters)")

    # ── Time dimension — constrains max time per vehicle ──
    # Distance mode: relax time constraint by 50% so solver can focus on minimizing km
    # instead of being dominated by time limits.
    time_limit_seconds = max_trip_seconds
    if optimize_for == 'distance':
        time_limit_seconds = int(max_trip_seconds * 1.5)
        logger.info(f"DISTANCE mode: relaxed time limit {max_trip_minutes}min → {time_limit_seconds // 60}min")

    routing.AddDimension(
        time_service_cb_index,
        0,                    # no slack
        time_limit_seconds,   # max per vehicle
        True,                 # start cumul to zero
        'Time'
    )
    logger.info(f"Time dimension: max {time_limit_seconds // 60} min/vehicle")

    if optimize_for == 'time':
        # Minimize makespan: reduce the LONGEST vehicle's total time
        time_dimension = routing.GetDimensionOrDie('Time')
        for v in range(num_vehicles):
            routing.AddVariableMinimizedByFinalizer(
                time_dimension.CumulVar(routing.End(v))
            )
        logger.info("TIME mode: makespan minimizer active")

    # Capacity constraint
    def demand_callback(from_index):
        from_node = manager.IndexToNode(from_index)
        return int(demands[from_node])
    
    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,  # no slack
        [int(c) for c in capacities],
        True,  # start cumul to zero
        'Capacity'
    )
    
    # Allow dropping nodes (unassigned shipments)
    # Penalty must match the cost unit of the optimization mode
    if optimize_for == 'time':
        penalty = 100_000  # ~28 hours in seconds
    else:
        penalty = 1_000_000  # ~1000km in meters (both cost and distance modes use meters)
    for node in range(1, num_nodes):
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)
    
    # Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    if optimize_for == 'distance':
        # Distance mode: allow more search time to find better solutions
        search_params.time_limit.seconds = 45
    else:
        search_params.time_limit.seconds = 30
    
    # Solve
    emit("solving", 45, f"{num_nodes-1} điểm, {num_vehicles} xe, chế độ {optimize_for}")
    logger.info(f"Solving VRP: {num_nodes-1} nodes, {num_vehicles} vehicles, optimize_for={optimize_for}")
    solution = routing.SolveWithParameters(search_params)
    
    solve_time_ms = int((time.time() - start_time) * 1000)
    
    if not solution:
        logger.warning("No solution found")
        return {
            'status': 'no_solution',
            'solve_time_ms': solve_time_ms,
            'routes': [],
            'unassigned': [n['id'] for n in nodes]
        }
    
    # Extract routes
    routes = []
    unassigned = set(range(1, num_nodes))
    
    emit("routes", 70, f"Lấy lộ trình chi tiết cho {num_vehicles} xe")
    
    for vehicle_id in range(num_vehicles):
        route_nodes = []
        route_distance = 0
        route_actual_distance_m = 0  # Always in meters from distance_matrix
        route_duration_sec = 0
        
        index = routing.Start(vehicle_id)
        prev_index = index
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            if node > 0:  # Skip depot
                route_nodes.append(nodes[node - 1]['id'])
                unassigned.discard(node)
            
            prev_index = index
            index = solution.Value(routing.NextVar(index))
            route_distance += routing.GetArcCostForVehicle(prev_index, index, vehicle_id)
            
            # Always accumulate real distance from distance_matrix (meters)
            from_node = manager.IndexToNode(prev_index)
            to_node = manager.IndexToNode(index) if not routing.IsEnd(index) else 0
            route_actual_distance_m += distance_matrix[from_node][to_node]
            
            # Accumulate real duration from OSRM if available
            if duration_matrix is not None:
                route_duration_sec += duration_matrix[from_node][to_node]
        
        if route_nodes:
            distance_km = route_actual_distance_m / 1000.0
            if duration_matrix is not None:
                # OSRM real duration + 20min per stop for loading/unloading
                duration_min = int(route_duration_sec / 60) + len(route_nodes) * 20
            else:
                # Estimate: avg 40km/h + 20min per stop (updated below if tolls detected)
                duration_min = int(distance_km / 40 * 60) + len(route_nodes) * 20
            
            route_data = {
                'vehicle_id': vehicles[vehicle_id]['id'],
                'node_ids': route_nodes,
                'distance_km': round(distance_km, 1),
                'duration_min': duration_min,
                'source': 'osrm' if use_osrm else 'haversine'
            }

            # ── Always compute cost breakdown (fuel + toll) for reporting ──
            fuel_cost_per_km = vehicles[vehicle_id].get('fuel_cost_per_km', 3300)
            toll_class = vehicles[vehicle_id].get('toll_class', 'L2')
            toll_stations = data.get('toll_stations', [])
            toll_expressways = data.get('toll_expressways', [])

            # Xây danh sách waypoint cho trip: [depot, stop1, ..., stopN, depot]
            trip_waypoints = [depot]
            idx_walk = routing.Start(vehicle_id)
            while not routing.IsEnd(idx_walk):
                node = manager.IndexToNode(idx_walk)
                if node > 0:
                    trip_waypoints.append(all_points[node])
                idx_walk = solution.Value(routing.NextVar(idx_walk))
            trip_waypoints.append(depot)  # quay về kho

            # Lấy tuyến đường thực tế từ OSRM
            # Cost mode: dùng exclude=toll để hiển thị đúng tuyến solver đã chọn
            route_exclude = 'toll' if (optimize_for == 'cost' and cost_distance_matrix is not None) else None
            route_geo = get_route_geometry(trip_waypoints, exclude=route_exclude)

            if route_geo is not None:
                # ✅ Route geometry-based detection (chính xác)
                actual_distance_km = route_geo['total_distance_m'] / 1000.0
                fuel_total = fuel_cost_per_km * actual_distance_km

                # Cost mode uses OSRM exclude=toll for both matrix building and route geometry.
                # In this branch, the solver already chose a no-toll route on the routing graph.
                # Running proximity-based toll detection again causes false positives on parallel
                # national roads that pass near toll plazas without actually traversing tolled edges.
                if optimize_for == 'cost' and route_exclude == 'toll':
                    toll_total = 0.0
                    tolls_passed = []
                    route_data['toll_detection'] = 'osrm_exclude_toll'
                else:
                    toll_total, tolls_passed = detect_tolls_on_polyline(
                        route_geo['polyline'], toll_stations, toll_expressways, toll_class
                    )
                    route_data['toll_detection'] = 'route_geometry'

                route_data['distance_km'] = round(actual_distance_km, 1)
                route_data['route_polyline_count'] = len(route_geo['polyline'])

                # Use OSRM real duration (road speeds from OSM data)
                osrm_duration_min = int(route_geo['total_duration_s'] / 60)
                route_data['duration_min'] = osrm_duration_min + len(route_nodes) * 20  # + loading time

                logger.info(f"  Trip {vehicles[vehicle_id]['id']}: route geometry → "
                            f"{actual_distance_km:.1f}km, {osrm_duration_min}min drive, "
                            f"{len(tolls_passed)} trạm toll, toll={toll_total:,.0f}đ")
            else:
                # ⚠️ Fallback: arc-based detection (OSRM route lỗi)
                fuel_total = fuel_cost_per_km * distance_km
                toll_total = 0.0
                tolls_passed = []

                idx_fb = routing.Start(vehicle_id)
                while not routing.IsEnd(idx_fb):
                    next_idx = solution.Value(routing.NextVar(idx_fb))
                    fn = manager.IndexToNode(idx_fb)
                    tn = manager.IndexToNode(next_idx) if not routing.IsEnd(next_idx) else 0
                    key = (vehicle_id, fn, tn)
                    if key in arc_toll_details:
                        for td in arc_toll_details[key]:
                            toll_total += td['fee_vnd']
                            tolls_passed.append(td)
                    idx_fb = next_idx

                route_data['toll_detection'] = 'arc_fallback'
                logger.info(f"  Trip {vehicles[vehicle_id]['id']}: arc fallback → "
                            f"{distance_km:.1f}km, {len(tolls_passed)} trạm toll")

            route_data['cost_breakdown'] = {
                'fuel_cost_vnd': round(fuel_total, 0),
                'toll_cost_vnd': round(toll_total, 0),
                'total_route_cost_vnd': round(fuel_total + toll_total, 0),
                'tolls_passed': tolls_passed,
            }

            # ── Duration: prefer OSRM route geometry duration (set above) ──
            if duration_matrix is not None and route_data.get('toll_detection') == 'arc_fallback':
                route_data['duration_min'] = int(route_duration_sec / 60) + len(route_nodes) * 20
            elif duration_matrix is None and route_data.get('toll_detection') == 'arc_fallback':
                avg_speed = 45  # km/h generic estimate
                route_data['duration_min'] = int(distance_km / avg_speed * 60) + len(route_nodes) * 20

            routes.append(route_data)
    
    # Unassigned nodes
    unassigned_ids = [nodes[n - 1]['id'] for n in unassigned]
    
    logger.info(f"VRP solved in {solve_time_ms}ms: {len(routes)} routes, {len(unassigned_ids)} unassigned, source={'osrm' if use_osrm else 'haversine'}, optimize={optimize_for}")
    
    emit("done", 100, f"{len(routes)} tuyến, {len(unassigned_ids)} chưa xếp, {solve_time_ms}ms")
    
    return {
        'status': 'completed',
        'solve_time_ms': solve_time_ms,
        'distance_source': 'osrm' if use_osrm else 'haversine',
        'optimize_for': optimize_for,
        'routes': routes,
        'unassigned': unassigned_ids
    }


class VRPHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == '/solve':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body)
                result = solve_vrp(data)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps(result).encode())
            except Exception as e:
                logger.error(f"VRP solve error: {e}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': str(e)}).encode())
        elif self.path == '/solve-stream':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body)
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/x-ndjson')
                self.send_header('Transfer-Encoding', 'chunked')
                self.send_header('X-Content-Type-Options', 'nosniff')
                self.end_headers()
                
                def progress_callback(stage, pct, detail):
                    line = json.dumps({"type": "progress", "stage": stage, "pct": pct, "detail": detail}) + "\n"
                    self.wfile.write(line.encode())
                    self.wfile.flush()
                
                result = solve_vrp(data, progress_callback=progress_callback)
                
                # Final line: the result
                result_line = json.dumps({"type": "result", "data": result}) + "\n"
                self.wfile.write(result_line.encode())
                self.wfile.flush()
            except Exception as e:
                logger.error(f"VRP solve-stream error: {e}")
                try:
                    error_line = json.dumps({"type": "error", "error": str(e)}) + "\n"
                    self.wfile.write(error_line.encode())
                    self.wfile.flush()
                except:
                    pass
        else:
            self.send_response(404)
            self.end_headers()
    
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'status': 'ok', 'service': 'vrp-solver'}).encode())
        elif self.path == '/status':
            global _osrm_available
            _osrm_available = None  # reset cache to re-check
            osrm_ok = check_osrm_available()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': 'ok',
                'service': 'vrp-solver',
                'osrm_url': OSRM_URL,
                'osrm_available': osrm_ok
            }).encode())
        else:
            self.send_response(404)
            self.end_headers()
    
    def log_message(self, format, *args):
        logger.info(f"{self.address_string()} - {format % args}")


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8090))
    server = HTTPServer(('0.0.0.0', port), VRPHandler)
    logger.info(f"🚀 VRP Solver starting on :{port}")
    server.serve_forever()
