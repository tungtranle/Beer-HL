# Cost Engine Design — Phương án C: Route Polyline Matching

> **Version**: 1.0 | **Date**: 2025-01-XX  
> **Status**: DRAFT — chờ review trước khi implement  
> **Scope**: VRP Solver chuyển từ tối ưu khoảng cách → tối ưu chi phí (VND)

---

## 1. Vấn đề hiện tại

### 1.1 Solver đang tối ưu sai mục tiêu

```
Hiện tại:  minimize Σ distance[i][j]        (= tối ưu khoảng cách)
Cần:       minimize Σ cost[i][j][vehicle]    (= tối ưu chi phí VND)
```

- **OSRM `/table`** trả về ma trận khoảng cách — nhưng OSRM ưu tiên đường ngắn nhất, thường đi qua đường cao tốc có phí.
- Solver tối ưu distance = tối ưu trong thế giới "mọi đường đều miễn phí".
- Chi phí phí đường ở Việt Nam = **30-40% tổng chi phí vận chuyển** → sai số rất lớn.

### 1.2 Thiếu sót trong dữ liệu

| Dữ liệu | Hiện tại | Cần |
|----------|---------|-----|
| Chi phí nhiên liệu/km | ❌ Không có | Tiêu hao nhiên liệu (lít/km) × giá xăng dầu |
| Phí đường bộ | ❌ Không có | Trạm thu phí hở + cao tốc kín |
| Chi phí tài xế | ❌ Không có | Lương + phụ cấp |
| Phân loại phương tiện (toll class) | ❌ Không gửi vehicle_type cho solver | L2/L3/L4 theo tải trọng |
| Chi phí per-vehicle | ❌ Cùng arc cost cho mọi xe | Mỗi xe có fuel rate + toll class riêng |

---

## 2. Giải pháp: Cost Matrix thay Distance Matrix

### 2.1 Công thức chi phí

Với mỗi cặp (i, j) và xe v:

$$
cost_{v}(i,j) = fuel\_cost_{v}(i,j) + toll\_cost_{v}(i,j)
$$

Trong đó:

$$
fuel\_cost_{v}(i,j) = distance(i,j) \times fuel\_rate_{v}
$$

$$
fuel\_rate_{v} = consumption\_per\_km_{v} \times fuel\_price
$$

$$
toll\_cost_{v}(i,j) = \sum_{s \in S_{route(i,j)}} fee_{s}(toll\_class_{v})
$$

- $S_{route(i,j)}$ = tập trạm thu phí mà tuyến đường (i→j) đi qua
- $fee_s(L)$ = phí tại trạm s cho loại xe L

### 2.2 Per-Vehicle Arc Cost (OR-Tools)

Thay `SetArcCostEvaluatorOfAllVehicles` bằng `SetArcCostEvaluatorOfVehicle` cho mỗi xe:

```python
# TRƯỚC: Mọi xe cùng cost = distance
routing.SetArcCostEvaluatorOfAllVehicles(distance_callback)

# SAU: Mỗi xe có cost riêng = f(fuel_rate, toll_class)
for v_idx, vehicle in enumerate(vehicles):
    cb = make_cost_callback(v_idx, vehicle['fuel_cost_per_km'], vehicle['toll_class'])
    cb_index = routing.RegisterTransitCallback(cb)
    routing.SetArcCostEvaluatorOfVehicle(cb_index, v_idx)
```

### 2.3 Return Trip (chiều về)

| Component | Status | Giải thích |
|-----------|--------|-----------|
| OR-Tools solver | ✅ Tự xử lý | `RoutingIndexManager(n, k, 0)` → depot là start+end. Arc cost `[last_stop → depot]` đã nằm trong cost matrix |
| Mock result | ✅ Đã tính khoảng cách | `routeDist += haversineKm(pLat, pLng, depot[0], depot[1])` |
| Toll chiều về | ❌ → ✅ Sẽ fix | Cost matrix đã bao gồm `cost[last_stop][depot]` với toll chiều về. Mock result cần thêm logic tính toll tương tự |

**Lưu ý**: Cost matrix là asymmetric — `toll(A→B)` có thể ≠ `toll(B→A)` vì trạm thu phí hở đặt ở một chiều. OSRM `/table` hỗ trợ asymmetric matrix.

---

## 3. Thuật toán Polyline Matching

### 3.1 Flow tổng quan

```
┌─────────────────────────────────────────────────────────┐
│ OSRM /table (1 call) → distance_matrix + duration_matrix │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Với mỗi cặp (i,j):                                      │
│   1. Bounding box filter: đường thẳng i→j có giao       │
│      corridor nào không?                                  │
│      → Không: toll_cost[i][j] = 0, SKIP                  │
│      → Có: tiếp bước 2                                   │
│   2. OSRM /route i→j (overview=full, geometries=geojson, │
│      steps=true)                                          │
│   3. Quick check: bất kỳ step nào có intersection.classes │
│      chứa "toll"?                                         │
│      → Không: toll_cost[i][j] = 0                        │
│      → Có: tiếp bước 4                                   │
│   4. Decode route geometry → GPS points                   │
│   5. Match points vs toll stations DB                     │
│      - Open station: "điểm nào < detection_radius?"      │
│      - Closed expressway: "tìm cặp entry/exit gate"     │
│   6. toll_cost[toll_class][i][j] = Σ fees                │
└─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Với mỗi xe v:                                            │
│   cost[v][i][j] = distance[i][j] × fuel_rate[v]         │
│                  + toll_cost[toll_class[v]][i][j]        │
│                                                           │
│ → RegisterTransitCallback per vehicle                     │
│ → SetArcCostEvaluatorOfVehicle                           │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Bounding Box Pre-filter

Tránh gọi N² route API calls (N=50 → 2500 calls). Thay vào đó:

1. Xây bounding box ~10km quanh mỗi toll station/corridor
2. Với mỗi cặp (i,j): kiểm tra **minimum bounding rectangle** của đường thẳng i→j có overlap bbox nào không
3. Nếu không overlap → không thể đi qua toll → skip

**Kết quả dự kiến**: Giảm từ 2500 xuống ~400-600 route calls cho khu vực Quảng Ninh.

### 3.3 OSRM `classes` Pre-filter (Bonus)

OSRM Route API với `steps=true` trả về Intersection objects có `"classes": ["toll"]`. Dùng làm lớp filter thứ hai:

```python
# Gọi OSRM /route
response = osrm_route(from_point, to_point, steps=True)

# Quick check: bất kỳ intersection nào có class "toll"?
has_toll = False
for leg in response['routes'][0]['legs']:
    for step in leg['steps']:
        for intersection in step.get('intersections', []):
            if 'toll' in intersection.get('classes', []):
                has_toll = True
                break

if not has_toll:
    return 0  # No toll on this route
```

Nếu OSRM nói route này không có đoạn toll → tin tưởng, skip matching. Chỉ khi "có toll" mới match GPS cụ thể.

### 3.4 Toll Detection Algorithm

#### Open Station (trạm thu phí hở)

```python
def detect_open_tolls(route_coords, toll_stations, detection_radius_m=200):
    """
    route_coords: [[lng, lat], [lng, lat], ...] from GeoJSON
    toll_stations: list of {name, lat, lng, fee_l1..l5, detection_radius_m}
    """
    tolls_hit = []
    for station in toll_stations:
        if station['toll_type'] != 'open':
            continue
        radius = station.get('detection_radius_m', detection_radius_m)
        
        for coord in route_coords:
            dist_m = haversine_m(coord[1], coord[0], station['lat'], station['lng'])
            if dist_m < radius:
                tolls_hit.append(station)
                break  # Chỉ tính 1 lần per station
    
    return tolls_hit
```

#### Closed Expressway (cao tốc kín — tính theo km)

```python
def detect_closed_tolls(route_coords, expressway, gates):
    """
    Tìm cặp gate (entry, exit) mà route đi qua.
    Phí = |km_marker_exit - km_marker_entry| × rate_per_km
    """
    gates_hit = []
    for gate in gates:
        radius = gate.get('detection_radius_m', 300)
        for idx, coord in enumerate(route_coords):
            dist_m = haversine_m(coord[1], coord[0], gate['lat'], gate['lng'])
            if dist_m < radius:
                gates_hit.append({
                    'gate': gate,
                    'route_index': idx  # Vị trí trên route → phân biệt entry vs exit
                })
                break
    
    if len(gates_hit) < 2:
        return None  # Không đủ 2 gate → không tính phí cao tốc
    
    # Sắp xếp theo thứ tự trên route (route_index)
    gates_hit.sort(key=lambda g: g['route_index'])
    entry_gate = gates_hit[0]['gate']
    exit_gate = gates_hit[-1]['gate']
    
    distance_km = abs(exit_gate['km_marker'] - entry_gate['km_marker'])
    
    return {
        'expressway': expressway['name'],
        'entry': entry_gate['gate_name'],
        'exit': exit_gate['gate_name'],
        'distance_km': distance_km
        # fee = distance_km × rate_per_km[toll_class]
    }
```

### 3.5 Performance Analysis

| Step | N=30 | N=50 | N=80 |
|------|------|------|------|
| OSRM /table | 1 call, <1s | 1 call, <1s | 1 call, ~2s |
| Route pairs | 900 | 2500 | 6400 |
| After bbox filter | ~250 | ~600 | ~1500 |
| After OSRM toll class filter | ~80 | ~200 | ~500 |
| Route API time (parallel 20 threads) | ~1s | ~2s | ~4s |
| GPS matching | ~0.5s | ~1s | ~2s |
| OR-Tools solve | ≤30s | ≤30s | ≤30s |
| **Tổng** | **~33s** | **~35s** | **~38s** |

Hoàn toàn chấp nhận được cho async VRP job (hiện tại đã async).

---

## 4. Database Schema

### 4.1 Toll Stations (Trạm thu phí hở)

```sql
CREATE TABLE toll_stations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_name    VARCHAR(200) NOT NULL,
    road_name       VARCHAR(100),           -- QL18, QL10, QL5...
    toll_type       VARCHAR(20) NOT NULL DEFAULT 'open'
                    CHECK (toll_type IN ('open')),
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    detection_radius_m INT NOT NULL DEFAULT 200,
    -- Phí theo loại xe (VND), dùng NUMERIC(15,2) theo rule BHL
    fee_l1          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- <12 chỗ, <2T
    fee_l2          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- 12-30 chỗ, 2-4T
    fee_l3          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- 31+ chỗ, 4-10T
    fee_l4          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- 10-18T
    fee_l5          NUMERIC(15,2) NOT NULL DEFAULT 0,  -- >18T, container
    is_active       BOOLEAN NOT NULL DEFAULT true,
    effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.2 Toll Expressways (Cao tốc kín)

```sql
CREATE TABLE toll_expressways (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expressway_name VARCHAR(200) NOT NULL,    -- CT Hà Nội - Hải Phòng
    -- Rate per km theo loại xe (VND/km)
    rate_per_km_l1  NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l2  NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l3  NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l4  NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_per_km_l5  NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE toll_expressway_gates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expressway_id   UUID NOT NULL REFERENCES toll_expressways(id),
    gate_name       VARCHAR(200) NOT NULL,   -- Nút giao Đình Vũ, IC Hưng Yên...
    gate_type       VARCHAR(20) NOT NULL DEFAULT 'entry_exit'
                    CHECK (gate_type IN ('entry_exit', 'entry_only', 'exit_only')),
    km_marker       NUMERIC(8,2) NOT NULL,   -- Vị trí km trên cao tốc
    latitude        DOUBLE PRECISION NOT NULL,
    longitude       DOUBLE PRECISION NOT NULL,
    detection_radius_m INT NOT NULL DEFAULT 300,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.3 Vehicle Cost Profiles (Chi phí xe — per vehicle)

```sql
-- Per-vehicle cost profile (ưu tiên dùng nếu có)
-- Ý nghĩa: xe cũ vs xe mới cùng loại 3.5T nhưng tiêu hao khác nhau
CREATE TABLE vehicle_cost_profiles (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id              UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    toll_class              VARCHAR(5) NOT NULL
                            CHECK (toll_class IN ('L1','L2','L3','L4','L5')),
    fuel_consumption_per_km NUMERIC(6,3) NOT NULL,  -- lít/km
    fuel_price_per_liter    NUMERIC(10,2) NOT NULL,  -- VND/lít (cập nhật khi giá xăng thay đổi)
    is_active               BOOLEAN NOT NULL DEFAULT true,
    effective_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    notes                   TEXT,    -- ghi chú: "xe cũ 2015, tiêu hao nhiều hơn"
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(vehicle_id)
);

-- Per-type default (fallback khi xe chưa có profile riêng)
CREATE TABLE vehicle_type_cost_defaults (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_type            VARCHAR(20) NOT NULL,     -- truck_3t5, truck_5t, truck_8t, truck_15t
    toll_class              VARCHAR(5) NOT NULL
                            CHECK (toll_class IN ('L1','L2','L3','L4','L5')),
    fuel_consumption_per_km NUMERIC(6,3) NOT NULL,
    fuel_price_per_liter    NUMERIC(10,2) NOT NULL,
    is_active               BOOLEAN NOT NULL DEFAULT true,
    effective_date          DATE NOT NULL DEFAULT CURRENT_DATE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(vehicle_type)
);
```

### 4.4 Driver Cost Rates

```sql
CREATE TABLE driver_cost_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rate_name       VARCHAR(100) NOT NULL,  -- "Lương tài xế/ngày", "Phụ cấp/chuyến"
    rate_type       VARCHAR(30) NOT NULL
                    CHECK (rate_type IN ('daily_salary', 'per_trip', 'per_km', 'overtime_hourly')),
    amount          NUMERIC(15,2) NOT NULL, -- VND
    vehicle_type    VARCHAR(20),            -- NULL = áp dụng tất cả, hoặc cho vehicle_type cụ thể
    is_active       BOOLEAN NOT NULL DEFAULT true,
    effective_date  DATE NOT NULL DEFAULT CURRENT_DATE,
    notes           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.5 Seed Data

#### Vehicle Type → Toll Class Mapping

| Vehicle Type | Toll Class | Tiêu hao mặc định (lít/km) | Giá dầu (VND/lít) | Fuel cost (VND/km) |
|-------------|-----------|---------------------------|-------------------|-------------------|
| truck_3t5 | L2 | 0.12 | 22,000 | 2,640 |
| truck_5t | L3 | 0.18 | 22,000 | 3,960 |
| truck_8t | L3 | 0.22 | 22,000 | 4,840 |
| truck_15t | L4 | 0.30 | 22,000 | 6,600 |

#### Open Toll Stations (14 trạm — dữ liệu cần xác minh với thực tế)

| Trạm | Đường | Lat | Lng | L2 | L3 | L4 |
|-------|-------|-----|-----|----|----|-----|
| Đại Yên | QL18 | 20.9556 | 107.0103 | 25,000 | 40,000 | 80,000 |
| Bắc Phả | QL18 | 20.9417 | 106.7533 | 25,000 | 40,000 | 80,000 |
| Biên Cương | QL18 | 21.3222 | 107.3472 | 30,000 | 50,000 | 100,000 |
| ... | | | | | | |

> ⚠️ **GPS chính xác + phí chính xác cần xác minh thực tế trước khi nhập DB**

#### Closed Expressways (5 tuyến)

| Cao tốc | Rate L2 (VND/km) | Rate L3 | Rate L4 |
|---------|------------------|---------|---------|
| Hà Nội - Hải Phòng | 2,000 | 2,800 | 4,200 |
| Hà Nội - Lào Cai | 1,500 | 2,100 | 3,200 |
| Cầu Giẽ - Ninh Bình | 1,500 | 2,100 | 3,200 |
| Bắc Giang - Lạng Sơn | 2,100 | 2,900 | 4,400 |
| Vân Đồn - Móng Cái | 1,900 | 2,650 | 4,000 |

#### Driver Cost Rates (mẫu)

| Rate | Type | Số tiền |
|------|------|---------|
| Lương tài xế cơ bản | daily_salary | 400,000 VND/ngày |
| Phụ cấp theo chuyến | per_trip | 100,000 VND/chuyến |
| Phụ cấp xăng dầu | per_km | 500 VND/km |
| Làm thêm giờ | overtime_hourly | 50,000 VND/giờ |

---

## 5. API Changes

### 5.1 Solver Request (Go → Python)

**Thêm vào `solverRequest`:**

```go
type solverVehicle struct {
    ID             string  `json:"id"`
    Capacity       float64 `json:"capacity"`
    Plate          string  `json:"plate"`
    // NEW
    VehicleType    string  `json:"vehicle_type"`
    TollClass      string  `json:"toll_class"`       // L1-L5
    FuelCostPerKm  float64 `json:"fuel_cost_per_km"` // VND/km (đã tính = lít/km × giá dầu)
}

type solverRequest struct {
    JobID           string            `json:"job_id"`
    Depot           [2]float64        `json:"depot"`
    Nodes           []solverNode      `json:"nodes"`
    Vehicles        []solverVehicle   `json:"vehicles"`
    // NEW
    TollStations    []tollStationData `json:"toll_stations,omitempty"`
    TollExpressways []tollExpData     `json:"toll_expressways,omitempty"`
    UseCostOptimization bool          `json:"use_cost_optimization"`
}
```

### 5.2 Solver Response (Python → Go)

**Thêm vào route response:**

```json
{
  "routes": [
    {
      "vehicle_id": "...",
      "node_ids": ["id1", "id2"],
      "distance_km": 85.3,
      "duration_min": 340,
      "cost_breakdown": {
        "fuel_cost_vnd": 320000,
        "toll_cost_vnd": 175000,
        "total_route_cost_vnd": 495000,
        "tolls_passed": [
          {"station_name": "Trạm Đại Yên", "fee_vnd": 40000},
          {"station_name": "CT HN-HP (Đình Vũ→Hưng Yên)", "fee_vnd": 135000, "distance_km": 48.2}
        ]
      }
    }
  ]
}
```

### 5.3 Domain Model Changes (Go)

```go
// Thêm vào VRPTrip
type VRPTrip struct {
    // ... existing fields giữ nguyên ...
    TotalCostVND     decimal.Decimal   `json:"total_cost_vnd"`
    FuelCostVND      decimal.Decimal   `json:"fuel_cost_vnd"`
    TollCostVND      decimal.Decimal   `json:"toll_cost_vnd"`
    DriverCostVND    decimal.Decimal   `json:"driver_cost_vnd"`
    CostPerTonVND    decimal.Decimal   `json:"cost_per_ton_vnd"`  // VND/tấn
    TollsPassed      []TollPassDetail  `json:"tolls_passed,omitempty"`
}

type TollPassDetail struct {
    StationName string          `json:"station_name"`
    FeeVND      decimal.Decimal `json:"fee_vnd"`
    DistanceKm  *float64        `json:"distance_km,omitempty"` // Chỉ cho closed expressway
}

// Thêm vào VRPSummary
type VRPSummary struct {
    // ... existing fields giữ nguyên ...
    TotalCostVND     decimal.Decimal `json:"total_cost_vnd"`
    TotalFuelCostVND decimal.Decimal `json:"total_fuel_cost_vnd"`
    TotalTollCostVND decimal.Decimal `json:"total_toll_cost_vnd"`
    TotalDriverCost  decimal.Decimal `json:"total_driver_cost_vnd"`
    AvgCostPerTonVND decimal.Decimal `json:"avg_cost_per_ton_vnd"`
}
```

---

## 6. Full Processing Flow

```
┌─────────────────────────────────────────────────────────┐
│                    GO BACKEND                            │
├─────────────────────────────────────────────────────────┤
│ 1. RunVRP() nhận request                                │
│ 2. Fetch: shipments, vehicles, warehouse (depot)        │
│ 3. Fetch: toll_stations, toll_expressways + gates        │
│ 4. Với mỗi vehicle:                                     │
│    - Lookup vehicle_cost_profiles (per vehicle)          │
│    - Fallback to vehicle_type_cost_defaults              │
│    - Set toll_class + fuel_cost_per_km                   │
│ 5. buildSolverRequest() + toll data + cost profiles      │
│ 6. POST to Python solver async                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                   PYTHON SOLVER                          │
├─────────────────────────────────────────────────────────┤
│ IF use_cost_optimization AND toll_stations given:        │
│                                                          │
│ A. OSRM /table → distance_matrix[N×N] (meters)          │
│    (1 API call, <1s)                                     │
│                                                          │
│ B. Build toll corridors bounding boxes                   │
│                                                          │
│ C. For each pair (i,j):                                  │
│    - Bbox filter → skip if not near any toll             │
│    - OSRM /route → get geometry + check classes          │
│    - Match geometry vs toll stations                     │
│    - toll_matrix[toll_class][i][j] = Σ fees              │
│    (Parallel with ThreadPoolExecutor, 20 threads)       │
│                                                          │
│ D. For each vehicle v:                                   │
│    cost_callback(i,j) =                                  │
│      distance[i][j] × fuel_rate[v] +                    │
│      toll[toll_class[v]][i][j]                           │
│    → RegisterTransitCallback per vehicle                 │
│    → SetArcCostEvaluatorOfVehicle                       │
│                                                          │
│ E. Solve OR-Tools (GLS, 30s)                            │
│                                                          │
│ F. Extract routes + cost breakdown                       │
│                                                          │
│ ELSE (fallback = giữ nguyên logic cũ):                  │
│   Solve distance-only as before                          │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────┐
│                  GO BACKEND (receive)                     │
├─────────────────────────────────────────────────────────┤
│ 7. Receive solver response with cost_breakdown           │
│ 8. convertSolverResult():                                │
│    - Map routes → VRPTrip with cost fields               │
│    - Add driver costs from driver_cost_rates             │
│      driver_cost = per_trip + per_km × distance + ...    │
│    - Calculate cost_per_ton = total / weight             │
│ 9. Store result                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Backward Compatibility

| Item | Strategy |
|------|----------|
| `use_cost_optimization` flag | Default `false` → không break gì |
| Solver input | Toll data optional → solver fallback to distance-only |
| Solver output | `cost_breakdown` field optional |
| VRPTrip fields | New cost fields default 0 → frontend hiển thị nếu > 0 |
| Mock result | Thêm cost tính tương tự (fuel × distance + toll estimation) |
| DB tables | Hoàn toàn mới, không đụng tables cũ |
| VRPCriteria | Thêm `CostOptimize bool` field (mặc định false) |

---

## 8. Implementation Phases

### Phase 1: DB + Data (2 ngày)
- [ ] Migration: tạo 5 tables mới
- [ ] Seed data: vehicle_type_cost_defaults
- [ ] Seed data: toll stations + expressways (dữ liệu đã xác minh)
- [ ] Admin API: CRUD toll stations, cost profiles

### Phase 2: Python Solver — Cost Matrix (3 ngày)
- [ ] Route polyline fetching + parallel execution
- [ ] Toll detection algorithm (open + closed)
- [ ] Per-vehicle arc cost callbacks
- [ ] Cost breakdown in response
- [ ] Unit tests với mock OSRM responses

### Phase 3: Go Backend Integration (2 ngày)
- [ ] buildSolverRequest: gắn toll data + vehicle cost profiles
- [ ] convertSolverResult: map cost breakdown
- [ ] Driver cost calculation
- [ ] Mock result: thêm cost estimation
- [ ] Domain models + VRPSummary cập nhật

### Phase 4: Frontend Display (1 ngày)
- [ ] VRP result page: hiển thị cost breakdown per trip
- [ ] Summary: total cost, avg VND/tấn
- [ ] Toll stations admin page (CRUD)

### Phase 5: Testing + Tuning (2 ngày)
- [ ] End-to-end test với real OSRM data
- [ ] Verify toll detection accuracy
- [ ] Tune detection_radius_m cho từng trạm
- [ ] Performance test N=50, N=80

**Tổng: ~10 ngày**

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| GPS trạm thu phí không chính xác | Match sai/bỏ sót | Tune detection_radius, verify với Google Maps |
| OSRM route khác Google Maps route | toll detection sai | OSRM profile phải match thực tế. Fallback: manual override |
| Route API latency cao | Slow VRP | Pre-filter + parallel + cache route results |
| Giá nhiên liệu/phí thay đổi | Cost tính sai | effective_date field, UI để cập nhật |
| OSM data thiếu toll markers | OSRM `classes` filter miss | GPS matching là primary, OSRM classes là secondary filter |
| Asymmetric tolls (1 chiều thu phí) | Over/under-count | Seed data cần ghi rõ chiều, hoặc dùng 2 entries cho 2 chiều |

---

## 10. Decision Log

| # | Quyết định | Lý do |
|---|-----------|-------|
| D1 | Cost matrix thay distance matrix | Distance ≠ Cost khi toll = 30-40% chi phí |
| D2 | Per-vehicle arc cost | Xe khác loại có fuel rate + toll class khác |
| D3 | Polyline matching thay zone-based | Chính xác nhất, tránh false positive/negative |
| D4 | OSRM /route cho polyline | Table API không trả geometry |
| D5 | Bbox + classes pre-filter | Giảm route API calls từ N² xuống ~20% |
| D6 | Per-vehicle cost profile | Xe cũ vs mới cùng loại nhưng tiêu hao khác |
| D7 | Driver cost tính ở Go (không ở solver) | Driver cost không ảnh hưởng routing decision, chỉ là reporting |
| D8 | Cost dùng NUMERIC(15,2) / decimal.Decimal | Rule BHL: KHÔNG float64 cho tiền |
| D9 | `use_cost_optimization` flag | Backward compatible, bật/tắt dễ |
| D10 | Return trip toll auto-handled | Cost matrix[last_stop][depot] đã bao gồm toll chiều về |

---

## Appendix A: Tại Sao Không Dùng OSRM `exclude=toll`?

OSRM hỗ trợ `exclude=toll` để tìm route né đường có phí. Tại sao không dùng?

1. **Binary choice**: Chỉ có "đi qua" vs "né tuyệt đối". Không tối ưu trade-off "đi qua nếu tiết kiệm tổng thể".
2. **Không phân biệt phí cao/thấp**: Trạm 25,000 VND và trạm 200,000 VND bị coi giống nhau.
3. **Có thể không có route**: Nếu xe ở giữa 2 trạm, `exclude=toll` có thể không tìm được đường.
4. **Không per-vehicle**: Cùng 1 toll road, xe 3.5T trả 25K nhưng xe 15T trả 80K. Đường đó "đáng" né cho xe 15T nhưng "đáng" đi cho xe 3.5T.

**Kết luận**: Cost matrix cho solver quyết định trading-off, KHÔNG binary exclude.

---

## Appendix B: So sánh 3 phương án

| Tiêu chí | A: Zone-based | B: OSRM exclude | **C: Polyline Matching** |
|----------|--------------|----------------|----------------------|
| Độ chính xác | ⭐⭐ | ⭐ | ⭐⭐⭐⭐⭐ |
| Phát triển | 3 ngày | 1 ngày | 10 ngày |
| Runtime overhead | +0s | +0s | +5s |
| Xử lý cao tốc kín | ❌ | ❌ | ✅ |
| Per-vehicle cost | ✅ | ❌ | ✅ |
| Asymmetric tolls | ❌ | ❌ | ✅ |
| False positive | High | N/A | Very Low |
| Maintainability | Medium | Low | High |

**Chọn C**: Phương án duy nhất xử lý đúng cao tốc kín (per-km pricing) và asymmetric tolls.
