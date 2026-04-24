# VRP System Review — BHL OMS-TMS-WMS

> **Mục đích:** Tài liệu này trích xuất toàn bộ BRD + code VRP để gửi chuyên gia phản biện.  
> **Ngày:** 16/04/2026  
> **Hệ thống:** Phân phối bia Hạ Long (Quảng Ninh) — 300+ đơn/ngày, 50 xe, 2 kho

---

## MỤC LỤC

1. [BRD — Yêu cầu nghiệp vụ VRP](#1-brd--yêu-cầu-nghiệp-vụ-vrp)
2. [Kiến trúc tổng quan](#2-kiến-trúc-tổng-quan)
3. [Go Backend — Orchestration Layer](#3-go-backend--orchestration-layer)
4. [Python Solver — OR-Tools Engine](#4-python-solver--or-tools-engine)
5. [Domain Models](#5-domain-models)
6. [Vấn đề đang tranh luận](#6-vấn-đề-đang-tranh-luận)

---

## 1. BRD — Yêu cầu nghiệp vụ VRP

### US-TMS-01: Tự động xếp xe (VRP Solver)
- **Input:** Danh sách Shipment + Danh sách xe khả dụng + Ràng buộc
- **Output:** Danh sách Trip (chuyến xe) với thứ tự điểm giao tối ưu
- **Engine:** Google OR-Tools — Python service port 8090
- **Multi-drop:** 1 xe giao nhiều điểm, không giới hạn số điểm
- **Thời gian xử lý:** < 2 phút cho 1,000 đơn
- **Tiêu chí:** 6 tiêu chí drag-to-reorder + toggle

### US-TMS-01d: Tối ưu chi phí vận chuyển (Cost Engine)
- Toggle "Tối ưu chi phí" → solver minimize VND thay vì km
- Chi phí mỗi tuyến = `fuel_cost_per_km × khoảng_cách + phí_toll`
- Solver dùng `SetArcCostEvaluatorOfVehicle` — chi phí khác nhau theo loại xe
- Kết quả: cost_breakdown (xăng/dầu, cầu đường, tổng, chi phí/tấn)
- **Phát hiện toll:** point-to-segment matching + entry/exit gate matching

### US-TMS-01e: Quản lý biểu phí vận chuyển (Cost Admin)
- CRUD trạm thu phí (tên, GPS, phí 5 hạng xe L1-L5)
- CRUD cao tốc + cổng (giá/km 5 hạng, km_marker)
- Chi phí mặc định theo loại xe + override riêng từng xe
- CRUD phụ phí tài xế

---

## 2. Kiến trúc tổng quan

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Frontend   │────→│  Go Backend  │────→│ Python Solver│
│  Next.js 14  │     │  Gin :8080   │     │ OR-Tools:8090│
│    :3000     │←────│              │←────│              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │ PostgreSQL 16│
                    │    :5434     │
                    └──────────────┘
```

**Data flow:**
1. Frontend POST `/v1/planning/run-vrp` → Go `RunVRP()`
2. Go loads shipments, vehicles, cost data from DB
3. Go builds `solverRequest` (nodes, vehicles, tolls, expressways)
4. Go POST to Python `:8090/solve` (timeout 300s)
5. Python builds distance matrix (OSRM or Haversine)
6. If `use_cost_optimization=true`: builds per-vehicle cost matrix with toll detection
7. Python solves CVRP with OR-Tools, extracts cost_breakdown per route
8. Go `convertSolverResult()` maps to domain model
9. If Python unreachable → Go falls back to `buildMockResult()` (heuristic)

---

## 3. Go Backend — Orchestration Layer

### 3.1 VRPCriteria Struct
```go
type VRPCriteria struct {
    MaxCapacity    int  `json:"max_capacity"`     // priority 1-6, 0=off
    MinVehicles    int  `json:"min_vehicles"`      // priority 1-6, 0=off
    ClusterRegion  int  `json:"cluster_region"`    // priority 1-6, 0=off
    MinDistance     int  `json:"min_distance"`      // priority 1-6, 0=off
    RoundTrip      int  `json:"round_trip"`        // priority 1-6, 0=off
    TimeLimit      int  `json:"time_limit"`        // priority 1-6, 0=off
    MaxTripMinutes int  `json:"max_trip_minutes"`  // default 480 (8h)
    CostOptimize   bool `json:"cost_optimize"`     // solver minimizes VND vs km
}
```

### 3.2 RunVRP — Orchestration
```go
func (s *Service) RunVRP(ctx context.Context, req RunVRPRequest) (string, error) {
    // 1. Get warehouse (depot) GPS
    depotLat, depotLng, err := s.repo.GetWarehouse(ctx, req.WarehouseID)
    
    // 2. Get pending shipments for date
    shipments, err := s.repo.ListPendingShipments(ctx, req.WarehouseID, req.DeliveryDate)
    
    // 3. Get available vehicles
    vehicles, err := s.repo.ListAvailableVehicles(ctx, req.WarehouseID, req.DeliveryDate)
    
    // 4. Resolve vehicle cost info (per-vehicle profile → type default → fallback)
    costInfos, err := s.repo.ResolveVehicleCostInfo(ctx, vehicles)
    
    // 5. Build solver request
    solverReq := buildSolverRequest(depotLat, depotLng, shipments, vehicles, jobID, costInfos)
    
    // 6. Always enrich with toll data + set cost optimization = true
    s.enrichSolverWithCostData(ctx, solverReq)
    solverReq.UseCostOptimization = true
    
    // 7. Call solver async
    go s.callVRPSolver(jobID, solverReq, shipments, vehicles, criteria)
    
    return jobID, nil
}
```

### 3.3 callVRPSolver — Solver Communication
```go
func (s *Service) callVRPSolver(jobID string, req *solverRequest, ...) {
    client := &http.Client{Timeout: 300 * time.Second}
    resp, err := client.Post(s.vrpSolverURL+"/solve", "application/json", body)
    
    if err != nil {
        // Fallback to mock heuristic
        result := s.buildMockResult(jobID, req.Depot, shipments, vehicles, criteria)
        s.jobs.Store(jobID, result)
        return
    }
    
    // Convert solver response to domain
    result := s.convertSolverResult(jobID, &solverResp, shipments, vehicles)
    s.jobs.Store(jobID, result)
}
```

### 3.4 convertSolverResult — Maps cost_breakdown to trips
```go
func (s *Service) convertSolverResult(jobID string, resp *solverResponse, ...) *domain.VRPResult {
    for _, route := range resp.Routes {
        trip := domain.VRPTrip{...}
        
        // Map cost breakdown from solver response
        if route.CostBreakdown != nil {
            cb := route.CostBreakdown
            trip.FuelCostVND = cb.FuelCostVND
            trip.TollCostVND = cb.TollCostVND
            trip.TotalCostVND = cb.TotalCostVND
            trip.CostPerTonVND = cb.TotalCostVND / (trip.TotalWeightKg / 1000)
            // Map tolls_passed details
        }
    }
    result.Summary = computeSummary(result, vehicles, shipments)
    return result
}
```

### 3.5 buildMockResult — Heuristic Fallback (khi solver unavailable)
```
Algorithm: Pack-First, Route-Later
Phase 0: Consolidate same-customer shipments → virtual nodes
Phase 1: Geo-cluster into sectors
Phase 2: Bin-pack with best-fit-decreasing + split delivery
Phase 3: Nearest-neighbor ordering; expand consolidated/split stops

Post-hoc cost: fuel_cost = mockCostPerKm[vehicle_type] × distance_km
(No toll calculation in mock — only fuel)
```

### 3.6 enrichSolverWithCostData
```go
func (s *Service) enrichSolverWithCostData(ctx context.Context, req *solverRequest) {
    // Load active toll stations from DB → append to req.TollStations
    stations, _ := s.repo.ListActiveTollStations(ctx)
    // Load expressways + gates → append to req.TollExpressways
    expressways, _ := s.repo.ListActiveTollExpressways(ctx)
}
```

### 3.7 Solver Request/Response Structs
```go
type solverRequest struct {
    JobID               string              `json:"job_id"`
    Depot               [2]float64          `json:"depot"`
    Nodes               []solverNode        `json:"nodes"`
    Vehicles            []solverVehicle     `json:"vehicles"`
    UseCostOptimization bool                `json:"use_cost_optimization"`
    TollStations        []solverTollStation `json:"toll_stations"`
    TollExpressways     []solverTollExway   `json:"toll_expressways"`
}

type solverVehicle struct {
    ID            string  `json:"id"`
    Capacity      float64 `json:"capacity"`
    VehicleType   string  `json:"vehicle_type"`
    TollClass     string  `json:"toll_class"`      // L1-L5
    FuelCostPerKm float64 `json:"fuel_cost_per_km"` // VND/km
}

type solverTollStation struct {
    Name    string  `json:"name"`
    Lat     float64 `json:"lat"`
    Lng     float64 `json:"lng"`
    RadiusM int     `json:"radius_m"`
    FeeL1-L5 float64 // 5 levels
}
```

---

## 4. Python Solver — OR-Tools Engine

### 4.1 detect_toll_cost_on_arc
```python
def detect_toll_cost_on_arc(from_lat, from_lng, to_lat, to_lng, 
                             toll_stations, toll_expressways, toll_class):
    """
    Thuật toán: Point-to-segment distance matching
    
    Open toll stations: 
      - Tính khoảng cách từ trạm đến đoạn thẳng (from → to)
      - Nếu distance < radius_m → xe qua trạm → tính phí theo toll_class
    
    Closed toll expressways:
      - Check từng cổng (gate) xem có nằm gần arc không
      - Nếu ≥ 2 cổng gần → xe đi trên cao tốc
      - Phí = |km_marker_exit - km_marker_entry| × rate_per_km
    
    Returns: (total_toll_vnd, list of {station_name, fee_vnd})
    """
```

### 4.2 build_vehicle_cost_matrices (Optimized)
```python
def build_vehicle_cost_matrices(all_points, distance_matrix, vehicles, 
                                 toll_stations, toll_expressways):
    """
    Tối ưu: 2-pass approach
    
    Pass 1 (vehicle-agnostic): Pre-compute toll detection cho mỗi arc (i,j)
      - O(N² × T) thay vì O(V × N² × T)
      - Lưu hits = [{type: 'station'|'expressway', data: ...}]
    
    Pass 2 (per-vehicle): Build cost matrix
      - cost[v][i][j] = fuel_cost_per_km[v] × dist_km + toll_fee[toll_class[v]]
      - Lookup pre-computed hits, multiply by vehicle's toll class rate
    
    Performance: 
      - 301 nodes, 50 vehicles, 20 stations, 31 gates
      - Pass 1: ~7s (90K arcs × 51 toll points)
      - Pass 2: ~4s (50 vehicles × 90K arcs, simple lookup)
      - Total: ~11s (was >5min before optimization)
    """
```

### 4.3 solve_vrp — Core Algorithm
```python
def solve_vrp(data):
    """
    CVRP (Capacitated Vehicle Routing Problem) solver using OR-Tools
    
    1. Build distance matrix (OSRM real road distances / Haversine fallback)
    2. If use_cost_optimization:
       - Build per-vehicle cost matrices (fuel + toll VND)
       - SetArcCostEvaluatorOfVehicle → mỗi xe có cost function riêng
    3. Else:
       - SetArcCostEvaluatorOfAllVehicles → shared distance callback
    4. Capacity constraint (AddDimensionWithVehicleCapacity)
    5. Allow dropping nodes (penalty 100,000)
    6. Search strategy: PATH_CHEAPEST_ARC + GUIDED_LOCAL_SEARCH
    7. Time limit: 30 seconds
    8. Extract routes + cost_breakdown per route
    
    Key OR-Tools APIs:
    - RoutingIndexManager(num_nodes, num_vehicles, depot=0)
    - RoutingModel.SetArcCostEvaluatorOfVehicle(cb, vehicle_idx)
    - RoutingModel.AddDimensionWithVehicleCapacity(demand_cb, 0, caps, True, 'Capacity')
    - RoutingModel.AddDisjunction([node], penalty) — cho phép bỏ node
    - SolveWithParameters(guided_local_search, timeout=30s)
    """
```

---

## 5. Domain Models

### VRPTrip
```go
type VRPTrip struct {
    VehicleID        uuid.UUID        // Xe được phân
    PlateNumber      string           // Biển số
    VehicleType      string           // truck_3t5/5t/8t/15t
    Stops            []VRPStop        // Danh sách điểm giao
    TotalDistanceKm  float64          // Tổng km
    TotalDurationMin int              // Tổng phút
    TotalWeightKg    float64          // Tổng tải
    FuelCostVND      float64          // Chi phí xăng/dầu
    TollCostVND      float64          // Chi phí cầu đường
    DriverCostVND    float64          // Chi phí tài xế
    TotalCostVND     float64          // Tổng chi phí
    CostPerTonVND    float64          // Chi phí/tấn
    TollsPassed      []TollPassDetail // DS trạm đi qua
}
```

### VRPSummary
```go
type VRPSummary struct {
    TotalTrips             int     // Số chuyến
    TotalShipmentsAssigned int     // Số đơn đã xếp
    TotalUnassigned        int     // Số đơn chưa xếp
    TotalDistanceKm        float64 // Tổng km
    TotalWeightKg          float64 // Tổng tải
    AvgCapacityUtil        float64 // % sử dụng tải trọng TB
    TotalCostVND           float64 // Tổng chi phí VND
    TotalFuelCostVND       float64 // Tổng xăng/dầu
    TotalTollCostVND       float64 // Tổng cầu đường
    AvgCostPerTonVND       float64 // VND/tấn
    AvgCostPerKmVND        float64 // VND/km
    TollCostRatioPct       float64 // % toll / tổng chi phí
}
```

---

## 6. Vấn đề đang tranh luận

### 6.1 Toll On/Off — Có nên thêm tiêu chí bật/tắt toll?

**Quan điểm người dùng:**
> "Chạy xong tôi không biết nó có tối ưu không. Vấn đề là chạy tuyến có toll hoặc không toll. Tại sao không có tiêu chí toll on/off để so sánh?"

**Hiện trạng code:**
- `UseCostOptimization = true` LUÔN bật → solver luôn dùng cost matrix (fuel + toll)
- Solver tối ưu minimize VND → tự động **tránh toll** khi đi vòng rẻ hơn
- Không có cách chạy "chỉ tính fuel, bỏ toll" để so sánh

**Phân tích kỹ thuật (cần phản biện):**

| Option | Ưu | Nhược |
|--------|-----|-------|
| A: Toll on/off toggle | User so sánh 2 kịch bản | Solver đã tự tối ưu, "off toll" ≠ "cấm đường toll" |
| B: 2 lần chạy tự động | Hiện 2 kết quả song song, Pareto chart | Tốn 2× thời gian (60s → 120s) |
| C: Toll penalty slider | User điều chỉnh "mức phạt" khi đi toll | UX phức tạp, mất trực quan |
| D: Giữ nguyên (solver tự quyết) | Đơn giản, solver đã optimal | User không hiểu tại sao toll = 0 |

**Câu hỏi cho chuyên gia:**
1. VRP solver minimize total cost (fuel + toll). Khi solver trả toll = 0, đó là vì routes tối ưu TRÁNH toll. Có nên giải thích cho user hay thêm so sánh mode?
2. Nếu thêm "exclude toll roads" constraint — cần cấm các arc đi qua toll hay chỉ không tính phí toll?
3. Với 300 đơn/ngày ở vùng Quảng Ninh (chỉ có QL18, QL5, CT HP-QN), toll avoidance có hợp lý không?
4. `point_to_segment_distance_km` dùng Haversine perpendicular distance — có đủ chính xác cho toll detection khi chưa có OSRM?
5. Pre-compute toll detection (O(N² × T)) vs on-demand (O(V × N² × T)) — trade-off memory vs speed?

### 6.2 Cost Accuracy — Haversine vs OSRM

- Hiện tại dùng Haversine (đường chim bay × 1.3 winding factor)
- OSRM cho khoảng cách thực tế trên đường
- Toll detection dùng point-to-segment trên đường thẳng → có thể detect sai nếu đường thực tế đi vòng

### 6.3 Performance

- 300 nodes × 50 vehicles: ~40s total (10s matrix + 30s solve)
- Go timeout: 300s
- Mock fallback: chỉ có fuel cost, không có toll

---

## Phụ lục: Dữ liệu test hiện tại

| Data | Count | Note |
|------|-------|------|
| Toll stations | 20 | QN/HP/Miền Bắc |
| Expressways | 8 | HP-QN, HL-VĐ, VĐ-MC, HN-TN, HN-HP, HP-QN(cũ), NB-HP, HN-LC |
| Expressway gates | 31 | Entry/exit points |
| Vehicle type defaults | 4 | truck_3t5/5t/8t/15t, diesel 24,500 VND/L |
| Driver rates | 5 | Phụ cấp/chuyến + tiền ăn |
| Test shipments | 300 | SC-09 scenario, 5 weight groups |
| Test vehicles | 50 | WH-HL, mixed 3.5T-15T |
