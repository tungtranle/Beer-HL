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


def check_osrm_available():
    """Check if OSRM service is reachable (cached)"""
    global _osrm_available
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


def build_osrm_matrix(all_points):
    """Build distance and duration matrices from OSRM table service.
    
    Args:
        all_points: list of (lat, lng) tuples, index 0 = depot
    Returns:
        (distance_matrix, duration_matrix) in meters and seconds,
        or (None, None) if OSRM fails
    """
    # OSRM table API: coords are lon,lat (reversed from our lat,lon)
    coords = ";".join(f"{p[1]},{p[0]}" for p in all_points)
    url = f"{OSRM_URL}/table/v1/driving/{coords}?annotations=distance,duration"
    
    try:
        req = urllib.request.Request(url, method='GET')
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode())
        
        if data.get('code') != 'Ok':
            logger.warning(f"OSRM table returned: {data.get('code')}")
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
        
        logger.info(f"OSRM matrix built: {n}x{n} points")
        return dist_matrix, dur_matrix
        
    except Exception as e:
        logger.warning(f"OSRM table request failed: {e}")
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


def solve_vrp(data):
    """Solve CVRP using OR-Tools"""
    start_time = time.time()
    
    depot = tuple(data['depot'])
    nodes = data['nodes']
    vehicles = data['vehicles']
    
    if not nodes:
        return {'status': 'completed', 'solve_time_ms': 0, 'routes': [], 'unassigned': []}
    
    num_vehicles = len(vehicles)
    num_nodes = len(nodes) + 1  # +1 for depot
    
    # Build distance matrix — prefer OSRM, fallback to Haversine
    all_points = [depot] + [(n['location'][0], n['location'][1]) for n in nodes]
    duration_matrix = None
    use_osrm = False
    
    if check_osrm_available():
        distance_matrix, duration_matrix = build_osrm_matrix(all_points)
        if distance_matrix is not None:
            use_osrm = True
            logger.info("Using OSRM distance matrix")
    
    if not use_osrm:
        distance_matrix = build_distance_matrix(depot, nodes)
        logger.info("Using Haversine distance matrix (OSRM unavailable)")
    
    # Demands (index 0 = depot with 0 demand)
    demands = [0] + [n.get('demand', 0) for n in nodes]
    
    # Vehicle capacities
    capacities = [int(v['capacity']) for v in vehicles]
    
    # Create routing model
    manager = pywrapcp.RoutingIndexManager(num_nodes, num_vehicles, 0)
    routing = pywrapcp.RoutingModel(manager)
    
    # Distance callback
    def distance_callback(from_index, to_index):
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return distance_matrix[from_node][to_node]
    
    transit_callback_index = routing.RegisterTransitCallback(distance_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)
    
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
    penalty = 100000  # High penalty for dropping
    for node in range(1, num_nodes):
        routing.AddDisjunction([manager.NodeToIndex(node)], penalty)
    
    # Search parameters
    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    search_params.local_search_metaheuristic = routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    search_params.time_limit.seconds = 30
    
    # Solve
    logger.info(f"Solving VRP: {num_nodes-1} nodes, {num_vehicles} vehicles")
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
    
    for vehicle_id in range(num_vehicles):
        route_nodes = []
        route_distance = 0
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
            
            # Accumulate real duration from OSRM if available
            if duration_matrix is not None:
                from_node = manager.IndexToNode(prev_index)
                to_node = manager.IndexToNode(index) if not routing.IsEnd(index) else 0
                route_duration_sec += duration_matrix[from_node][to_node]
        
        if route_nodes:
            distance_km = route_distance / 1000.0
            if duration_matrix is not None:
                # OSRM real duration + 20min per stop for loading/unloading
                duration_min = int(route_duration_sec / 60) + len(route_nodes) * 20
            else:
                # Estimate: avg 40km/h + 20min per stop
                duration_min = int(distance_km / 40 * 60) + len(route_nodes) * 20
            
            routes.append({
                'vehicle_id': vehicles[vehicle_id]['id'],
                'node_ids': route_nodes,
                'distance_km': round(distance_km, 1),
                'duration_min': duration_min,
                'source': 'osrm' if use_osrm else 'haversine'
            })
    
    # Unassigned nodes
    unassigned_ids = [nodes[n - 1]['id'] for n in unassigned]
    
    logger.info(f"VRP solved in {solve_time_ms}ms: {len(routes)} routes, {len(unassigned_ids)} unassigned, source={'osrm' if use_osrm else 'haversine'}")
    
    return {
        'status': 'completed',
        'solve_time_ms': solve_time_ms,
        'distance_source': 'osrm' if use_osrm else 'haversine',
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
