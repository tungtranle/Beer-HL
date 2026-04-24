# Cấm tải, Cấm xe tải theo giờ và Tách đơn hàng

> Tài liệu phân tích & đề xuất giải pháp cho VRP Solver  
> Ngày: 20/04/2026 | Phiên bản: 1.0

---

## Mục lục

1. [Tổng quan hiện trạng VRP](#1-tổng-quan-hiện-trạng-vrp)
2. [Bài toán 1: NPP giới hạn trọng tải xe](#2-bài-toán-1-npp-giới-hạn-trọng-tải-xe)
3. [Bài toán 2: Cấm xe tải theo giờ trên cung đường / tỉnh](#3-bài-toán-2-cấm-xe-tải-theo-giờ-trên-cung-đường--tỉnh)
4. [Bài toán 3: Tách đơn hàng](#4-bài-toán-3-tách-đơn-hàng)
5. [Lộ trình triển khai tổng thể](#5-lộ-trình-triển-khai-tổng-thể)
6. [Phụ lục: Cấu trúc dữ liệu chi tiết](#6-phụ-lục-cấu-trúc-dữ-liệu-chi-tiết)

---

## 1. Tổng quan hiện trạng VRP

### 1.1 Kiến trúc hiện tại

```
Go Service (tms/service.go)
  → Build solverRequest (depot, nodes, vehicles, toll data)
  → POST /solve-stream → Python VRP Solver (:8090)
  → OR-Tools CVRP solve
  → OSRM route geometry + toll detection
  → Response: routes[] + unassigned[]
  → Go: convert → VRPResult (trips, summary)
```

### 1.2 Các constraint đã hỗ trợ

| Constraint | Loại | Cách triển khai |
|-----------|------|-----------------|
| Trọng tải xe (capacity) | Hard | `AddDimensionWithVehicleCapacity()` |
| Thời gian chuyến (max 480 phút) | Hard | Time dimension |
| Chi phí nhiên liệu + phí BOT | Soft | Arc cost callback (3 mode: cost/time/distance) |
| Drop node (đơn không xếp được) | Soft | `AddDisjunction()` với penalty |
| Quay về kho | Hard | Implicit (route end = depot) |

### 1.3 Các constraint CHƯA hỗ trợ (đề xuất trong tài liệu này)

| Constraint | Mô tả |
|-----------|-------|
| Giới hạn xe tại NPP | Một số NPP chỉ nhận xe ≤ X tấn |
| Cấm xe tải theo giờ | Vùng nội đô cấm xe lớn vào giờ cao điểm |
| Tách đơn tự động | Đơn quá tải → solver gợi ý tách |

---

## 2. Bài toán 1: NPP giới hạn trọng tải xe

### 2.1 Mô tả

Một số NPP chỉ tiếp nhận xe có trọng tải đăng ký ≤ ngưỡng nhất định. Nguyên nhân:
- Đường vào hẹp, hạ tầng không chịu xe lớn
- Quy định khu dân cư / chung cư
- Bãi đỗ giới hạn kích thước xe

### 2.2 Phương án đề xuất: Node-Vehicle Compatibility (OR-Tools native)

**Cách tiếp cận:** Sử dụng `routing.SetAllowedVehiclesForIndex()` — gán danh sách xe hợp lệ cho từng node.

**Input bổ sung trong VRP request:**

```json
{
  "nodes": [
    {
      "id": "shipment-uuid",
      "location": [10.82, 106.62],
      "demand": 150,
      "name": "NPP Tân Bình",
      "max_vehicle_weight_kg": 5000
    }
  ]
}
```

**Logic trong Python solver:**

```python
for node_idx in range(1, num_nodes):
    node_data = nodes[node_idx - 1]
    max_weight = node_data.get('max_vehicle_weight_kg')
    
    if max_weight is not None:
        allowed = [v_idx for v_idx, veh in enumerate(vehicles)
                   if veh['capacity'] <= max_weight]
        
        if allowed:
            routing_index = manager.NodeToIndex(node_idx)
            routing.SetAllowedVehiclesForIndex(allowed, routing_index)
        else:
            logger.warning(f"Node {node_data['id']}: cần xe ≤{max_weight}kg "
                           f"nhưng không có xe phù hợp → sẽ bị unassigned")
```

### 2.3 Đánh giá

| Tiêu chí | Đánh giá |
|----------|----------|
| Hiệu năng | ⭐⭐⭐⭐⭐ — OR-Tools native, cắt nhánh sớm, nhanh hơn hiện tại |
| Hạ tầng | +0 (không thêm service nào) |
| Độ chính xác | Cao — hard constraint, solver đảm bảo 100% |
| Bảo trì | Thấp — thêm 1 cột DB, ~20 dòng Python |

### 2.4 Thay đổi cần thiết

| Bước | Nội dung | File ảnh hưởng |
|------|---------|---------------|
| 1 | Thêm cột `max_vehicle_weight_kg` vào bảng `customers` | migration mới |
| 2 | API admin cho phép set/edit giới hạn xe cho NPP | admin handler/service |
| 3 | Build VRP request: map field vào mỗi node | tms/service.go |
| 4 | Solver: `SetAllowedVehiclesForIndex()` | vrp-solver/main.py |
| 5 | Diagnostic: báo node bị unassigned do không có xe phù hợp | tms/service.go |

---

## 3. Bài toán 2: Cấm xe tải theo giờ trên cung đường / tỉnh

### 3.1 Mô tả

Tại các đô thị lớn (TP.HCM, Hà Nội, Đà Nẵng), xe tải bị cấm theo khung giờ:
- Xe ≥ 2.5 tấn: cấm 6h-9h, 16h-20h (giờ cao điểm)
- Xe ≥ 5 tấn: cấm 6h-21h (gần như cả ngày)
- Xe ≥ 10 tấn: cấm 24/7 nội đô

### 3.2 So sánh các phương án

#### PA2: Pre-filter node-vehicle theo giờ cấm

Trước khi solve, dựa trên `dispatch_hour` để lọc xe nào không được vào node nào.

| Tiêu chí | Đánh giá |
|----------|----------|
| Hiệu năng | ~30-35s (bằng hoặc nhanh hơn hiện tại) |
| RAM thêm | +0 MB |
| Độ chính xác | ⭐⭐ — cấm tại node nhưng không biết giờ đến thực tế |
| Bảo trì | Thấp |

**Điểm yếu:** Quyết định cấm/cho phép tại thời điểm setup, dựa trên giờ xuất kho. Không biết giờ xe ĐẾN thực tế (phụ thuộc thứ tự giao).

#### PA3: OSRM Multi-profile (1 profile riêng cho mỗi loại xe)

| Tiêu chí | Đánh giá |
|----------|----------|
| Hiệu năng | ~40-60s (chậm hơn 50%+) |
| RAM thêm | +4.5 GB (3 OSRM instance thêm) |
| Độ chính xác | ⭐⭐⭐⭐⭐ — cấm ở tầng routing, chính xác nhất |
| Bảo trì | Cao — rebuild OSRM profile khi thêm vùng cấm (~1h downtime) |

**So sánh hiệu năng PA2 vs PA3 theo scale:**

| Nodes | PA2 | PA3 | PA3 chậm hơn |
|-------|-----|-----|--------|
| 30 | ~25s | ~35s | 40% |
| 50 | ~33s | ~50s | 50% |
| 100 | ~45s | ~80s | 78% |
| 200 | ~60s | ~120s+ | 100%+ |

**Kết luận:** PA3 quá nặng hạ tầng (4 OSRM instance × 1.5 GB RAM mỗi cái) và thời gian build profile 30-60 phút mỗi lần update bản đồ. Không phù hợp.

#### PA5: OSRM Route Validation (post-solve, kiểm tra đường đi)

Sau khi solve, tái sử dụng polyline (đã fetch cho toll detection) để kiểm tra xe có đi QUA vùng cấm không.

| Tiêu chí | Đánh giá |
|----------|----------|
| Hiệu năng | +0.5-1s (tái sử dụng polyline có sẵn) |
| Hạ tầng | +0 |
| Độ chính xác | ⭐⭐⭐⭐ — kiểm tra từng điểm trên đường đi thực tế |
| Bảo trì | Thấp — zone polygon lưu DB |
| Hạn chế | Chỉ phát hiện vi phạm (warning), không tự sửa route |

#### PA7: Virtual Node Duplication (OR-Tools native, chính xác nhất)

Mỗi node trong vùng cấm → tạo K bản sao (1 per vehicle weight class), mỗi bản sao có time window + allowed vehicles khác nhau. OR-Tools chọn bản sao tối ưu.

```python
# Node "NPP Tân Bình" trong vùng cấm HCM:
# Xe ≤ 5t: time window [0, 480min]  (giao bất kỳ)
# Xe > 5t: time window [780, 1320min] (chỉ sau 21h)

routing.AddDisjunction(
    [idx_small_vehicle, idx_large_vehicle],
    penalty=1_000_000,
    max_cardinality=1  # chỉ serve 1 bản sao
)
```

| Tiêu chí | Đánh giá |
|----------|----------|
| Hiệu năng | +10-15% nodes (chỉ nhân bản node vùng cấm) |
| Hạ tầng | +0 |
| Độ chính xác | ⭐⭐⭐⭐⭐ — solver tự tìm time-vehicle combo tối ưu |
| Bảo trì | Trung bình — logic tạo virtual node cần cẩn thận |

### 3.3 Ma trận so sánh tổng hợp

| | PA2 (pre-filter) | PA3 (multi OSRM) | PA5 (route check) | PA7 (virtual node) |
|---|---|---|---|---|
| **Chính xác** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Hiệu năng** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Hạ tầng** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Bảo trì** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Tối ưu toàn cục** | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ |

### 3.4 Phương án đề xuất: Hybrid PA7 + PA5

Kết hợp điểm mạnh của 2 phương án, không tăng hạ tầng:

```
Bước 1: Virtual Node (PA7)
  → Nhân bản node vùng cấm
  → Mỗi bản sao có time window + allowed vehicles riêng
  → OR-Tools solve 1 lần, tối ưu toàn cục

Bước 2: OSRM Route Validate (PA5)
  → Tái sử dụng polyline (đã fetch cho toll detection)
  → Duyệt polyline qua vùng cấm
  → Nếu ĐƯỜNG ĐI qua vùng cấm (không chỉ điểm đến) → warning

Bước 3: Dispatcher review
  → Hiện warning trên Control Tower
  → Dispatcher accept hoặc adjust
```

**Tại sao hybrid tốt nhất:**
- PA7 giải quyết "xe nào giao node nào lúc nào" — solver tối ưu global
- PA5 bắt case PA7 bỏ sót: xe đi QUA vùng cấm mà không dừng — chi phí gần 0
- Không thêm OSRM instance, không thêm RAM
- Tổng thời gian solve: tăng ~10-15% so với hiện tại

### 3.5 Input cần bổ sung

```json
{
  "truck_ban_zones": [
    {
      "zone_id": "hcm-inner",
      "name": "Nội đô TP.HCM (Q1, Q3, Q5, Q10, Phú Nhuận, Bình Thạnh)",
      "polygon": [[10.78, 106.68], [10.79, 106.72], ...],
      "applies_to_nodes": ["shipment-uuid-1", "shipment-uuid-2"],
      "ban_rules": [
        {
          "min_vehicle_weight_kg": 2500,
          "banned_hours": [
            {"from": "06:00", "to": "09:00"},
            {"from": "16:00", "to": "20:00"}
          ]
        },
        {
          "min_vehicle_weight_kg": 5000,
          "banned_hours": [
            {"from": "06:00", "to": "21:00"}
          ]
        }
      ]
    }
  ]
}
```

### 3.6 Thay đổi cần thiết

| Bước | Nội dung | File ảnh hưởng |
|------|---------|---------------|
| 1 | Tạo bảng `truck_ban_zones` + `truck_ban_rules` | migration mới |
| 2 | API admin CRUD vùng cấm + quy tắc | admin handler/service |
| 3 | Build VRP request: load zones, map node vào zone | tms/service.go |
| 4 | Solver: tạo virtual nodes + time window + allowed vehicles | vrp-solver/main.py |
| 5 | Post-solve: duyệt polyline kiểm tra transit qua vùng cấm | vrp-solver/main.py |
| 6 | Frontend: hiển thị vùng cấm trên map + warning trên trip | planning/page.tsx |

---

## 4. Bài toán 3: Tách đơn hàng

### 4.1 Mô tả

Khi trọng lượng đơn hàng vượt khả năng fleet (hoặc fleet đã đầy), VRP cần gợi ý phương án tách đơn để dispatcher và DVKH xử lý.

**Nguyên tắc quan trọng:**
- **VRP KHÔNG bao giờ tự tách đơn** — đơn hàng = cơ sở pháp lý với NPP
- Tách đơn phải được DVKH thông báo cho NPP và NPP đồng ý trước
- VRP chỉ sinh **báo cáo phân tích** (diagnostic report) với lý do + gợi ý

### 4.2 Hiện trạng

| Thành phần | Trạng thái |
|-----------|-----------|
| 1 Order → 1 Shipment → 1 Node | ✅ Luồng chính |
| Manual split (dispatcher) | ✅ `POST /orders/{id}/split` |
| OR-Tools khi demand > max capacity | ❌ Drop node → `unassigned[]` |
| VRPStop model | ✅ Sẵn fields: `IsSplit`, `SplitPart`, `SplitTotal`, `OriginalWeightKg` |
| Frontend hiện unassigned | ⚠️ Chỉ hiện UUID + cảnh báo, không giải thích lý do |

### 4.3 Các phương án tách đơn — Phân tích & Phản biện

#### PA-A: Pre-split cố định (chia đều trước khi solve)

```
8000kg ÷ max_cap = 2 phần × 4000kg
```

| Ưu | Nhược |
|----|-------|
| Đơn giản, ~20 dòng code | Chia sai kích thước — 4000kg không fit xe 3.5t, lãng phí xe 5t (chỉ chở 80%) |
| OR-Tools CVRP bình thường | Không biết fleet context — kích thước tách không dựa trên xe khả dụng |
| | Service time sai: mỗi part bị tính 20 phút riêng |

#### PA-B: Adaptive pre-split theo fleet composition

```
Thử combo xe: 5000kg (xe 5t) + 3000kg (xe 3.5t) = 8000kg ✓
```

| Ưu | Nhược |
|----|-------|
| Tách kích thước phù hợp fleet | Greedy — lock xe vào đơn lớn trước khi solver thấy bức tranh toàn cục |
| Vẫn dùng standard CVRP | Giả sử xe khả dụng — xe 5t có thể đã đầy từ đơn khác |
| Utilization cao hơn PA-A | Vẫn suboptimal so với giải global |

#### PA-C: Granular virtual nodes (500kg mỗi phần, OR-Tools tự tổ hợp)

```
8000kg = 16 × 500kg virtual nodes
OR-Tools tự gán: xe 5t lấy 10 parts, xe 3.5t lấy 6 parts
```

| Ưu | Nhược |
|----|-------|
| Solver tìm tổ hợp tối ưu | **Bùng nổ problem size:** 5 đơn × 16 parts = 80 nodes thêm |
| Linh hoạt, toàn cục | **Service time sai trầm trọng:** 16 × 20 phút = 320 phút (thực tế ~30 phút) |
| | `AddDisjunction` với `max_cardinality = N` = serve tối đa, không chính xác N |
| | Distance matrix redundancy: 16 hàng/cột giống hệt |

**Service time circular dependency:** Chỉ tính 20 phút cho part đầu tiên → nhưng "part đầu tiên" phụ thuộc xe nào đến trước → phụ thuộc solution → chưa có. Không giải được trong callback.

#### PA-D: Two-Phase Solve (CVRP → Split → Re-CVRP)

```
Phase 1: Solve bình thường → đơn lớn bị unassigned
Phase 2: Tính remaining capacity → bin-pack đơn lớn vào chỗ trống
Phase 3: Re-optimize routing cho xe bị ảnh hưởng
```

| Ưu | Nhược |
|----|-------|
| Biết context thực tế (remaining capacity) | Suboptimal — Phase 1 routing không tính đến đơn oversized |
| Không tăng problem size | Xe có thể đi hướng khác nếu biết sẽ ghé thêm điểm oversized |
| Re-optimize cục bộ nhanh | Search space nhỏ hơn global |

### 4.4 Tổng hợp so sánh

| Tiêu chí | PA-A | PA-B | PA-C | PA-D |
|----------|------|------|------|------|
| Chất lượng split | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Routing quality | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Hiệu năng | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Service time đúng | ❌ | ❌ | ❌ | ✅ |
| Tính toàn cục | ❌ | ❌ | ✅ | ⚠️ |

**Kết luận:** Không phương án nào hoàn hảo. SDVRP (Split Delivery VRP) là NP-hard và OR-Tools CVRP không hỗ trợ native. Mọi PA đều là approximation.

### 4.5 Phương án đề xuất: VRP Diagnostic Report (advisory-only)

**Thay vì để solver tự tách, chuyển sang hướng phân tích để con người quyết định.**

Lý do:
- Đơn hàng = cơ sở pháp lý → tách phải có đồng ý NPP
- DVKH cần liên hệ NPP TRƯỚC khi tách
- Tool tự tách → phát sinh rủi ro: NPP không biết, kiện thương mại

#### Luồng nghiệp vụ

```
VRP solve
  ↓
Kết quả + Diagnostic Report (chỉ phân tích, không action)
  ↓
Dispatcher xem trên Planning UI
  → Đơn xếp được: confirm trip
  → Đơn KHÔNG xếp được: đọc lý do + gợi ý
  ↓
Dispatcher chuyển thông tin cho DVKH
  ↓
DVKH gọi/Zalo NPP:
  "Anh ơi, đơn 8 tấn ngày mai không có xe phù hợp.
   PA 1: Tách 2 đơn (5t + 3t), giao cùng ngày 2 xe
   PA 2: Dời sang ngày kia, có xe 8t rảnh
   Anh chọn phương án nào?"
  ↓
NPP đồng ý → DVKH/Dispatcher tạo đơn mới → Re-run VRP
```

#### Cấu trúc Diagnostic Report

```json
{
  "diagnostics": {
    "unassigned_analysis": [...],
    "fleet_analysis": {...},
    "capacity_warnings": [...],
    "suggestions": [...]
  }
}
```

#### 4.5.1 `unassigned_analysis[]` — Phân tích từng đơn không xếp được

Mỗi đơn unassigned được phân loại lý do và kèm gợi ý:

**Mã lý do:**

| Mã | Ý nghĩa | Ví dụ |
|----|---------|-------|
| `weight_exceeds_all` | Nặng hơn xe lớn nhất | 8000kg, xe max 5000kg |
| `weight_exceeds_available` | Có xe đủ tải nhưng đã đầy | Xe 8t đã chở đơn khác |
| `no_capacity_remaining` | Tổng tải fleet đã hết | 50t hàng, fleet chỉ 45t |
| `time_exceeded` | Giao đơn này vượt giờ làm | Đơn xa, thêm vào = quá 8h |
| `no_geo` | Thiếu tọa độ GPS | NPP chưa có lat/lng |

**Mẫu phân tích:**

```json
{
  "shipment_id": "sh-uuid",
  "shipment_number": "SH-2026-0042",
  "customer_name": "NPP Bình Dương",
  "weight_kg": 8000,
  "reason_code": "weight_exceeds_available",
  "reason_text": "Đơn nặng 8,000 kg. Xe lớn nhất khả dụng (51A-99999, 8,000 kg) đã xếp 2,500 kg hàng khác, chỉ còn trống 5,500 kg.",
  "options": [
    {
      "option_code": "split_2",
      "description": "Tách thành 2 đơn: ~5,000 kg + ~3,000 kg",
      "detail": "Phần 1 (5,000 kg) → xe 51A-12345 (5t, còn trống 5,000 kg). Phần 2 (3,000 kg) → xe 51A-67890 (3.5t, còn trống 3,200 kg). Cả 2 giao cùng ngày.",
      "feasibility": "high"
    },
    {
      "option_code": "reschedule",
      "description": "Dời sang ngày 22/04 — xe 8t rảnh",
      "detail": "Ngày 22/04 xe 51A-99999 (8t) chưa có đơn nào. Giao nguyên đơn 8,000 kg bằng 1 chuyến.",
      "feasibility": "high"
    },
    {
      "option_code": "rearrange",
      "description": "Chuyển bớt hàng xe khác ra, dùng xe 8t chở nguyên đơn",
      "detail": "Di chuyển 2,500 kg từ xe 51A-99999 sang xe khác còn trống. Xe 51A-99999 chở nguyên 8,000 kg.",
      "feasibility": "medium"
    }
  ]
}
```

#### 4.5.2 `fleet_analysis` — Tổng quan năng lực fleet

```json
{
  "total_demand_kg": 42000,
  "total_fleet_capacity_kg": 38500,
  "utilization_pct": 92.3,
  "is_over_capacity": true,
  "over_capacity_kg": 3500,
  "vehicles": [
    {
      "plate": "51A-12345",
      "type": "truck_5t",
      "capacity_kg": 5000,
      "assigned_kg": 4800,
      "remaining_kg": 200,
      "utilization_pct": 96.0,
      "num_stops": 4
    }
  ],
  "bottleneck": "Tổng đơn hàng (42,000 kg) vượt tổng tải fleet (38,500 kg) là 3,500 kg. Cần thêm 1 xe 3.5t hoặc dời 3,500 kg sang ngày khác."
}
```

#### 4.5.3 `capacity_warnings[]` — Cảnh báo xe gần đầy

```json
[
  {
    "vehicle_plate": "51A-99999",
    "utilization_pct": 95.2,
    "remaining_kg": 380,
    "warning": "Chỉ còn 380 kg trống — không đủ cho hầu hết đơn bổ sung"
  }
]
```

#### 4.5.4 `suggestions[]` — Gợi ý tổng thể

```json
[
  {
    "type": "add_vehicle",
    "text": "Thêm 1 xe 3.5t sẽ giải quyết 2/3 đơn chưa xếp"
  },
  {
    "type": "reschedule_batch",
    "text": "3 đơn nhỏ (tổng 1,200 kg) ở Tân Phú có thể dời sang 22/04 để giảm tải hôm nay"
  }
]
```

### 4.6 Logic diagnostic — Ở đâu?

| Tiêu chí | Trong Python solver | Trong Go service ✅ |
|-----------|-------------------|------------------|
| Truy cập DB (xe rảnh ngày khác) | ❌ | ✅ |
| Thông tin NPP (tên, mã, SĐT) | ❌ Chỉ có UUID | ✅ |
| Xem lịch giao ngày khác | ❌ | ✅ |
| Tính remaining capacity | Cần parse solution | ✅ Có solution + vehicle info |
| Kiến trúc sạch | Solver chỉ nên solve | ✅ Service layer phân tích |

**Kết luận:** Logic diagnostic nằm trong Go `tms/service.go`, Python solver **KHÔNG thay đổi**.

### 4.7 Frontend — Diagnostic Panel

Thay vì chỉ hiện *"⚠️ Còn 3 đơn chưa xếp"*, thêm panel phân tích chi tiết:

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Phân tích VRP                                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔴 3 đơn chưa xếp được                                │
│                                                         │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ SH-2026-0042 • NPP Bình Dương • 8,000 kg           │ │
│ │                                                     │ │
│ │ Lý do: Đơn nặng 8,000 kg, vượt sức chở xe lớn     │ │
│ │ nhất khả dụng (5,000 kg). Xe 8t (51A-99999) đã     │ │
│ │ xếp 2,500 kg hàng khác.                            │ │
│ │                                                     │ │
│ │ Phương án gợi ý:                                    │ │
│ │  ✅ Tách 2 đơn: 5,000 kg + 3,000 kg                │ │
│ │  📅 Dời sang ngày 22/04 — xe 8t rảnh               │ │
│ │  🔄 Chuyển bớt hàng xe khác, chở nguyên đơn        │ │
│ │                                                     │ │
│ │            [ 📋 Copy thông tin cho DVKH ]            │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ── Tổng quan fleet ──────────────────────────────────── │
│ Tổng đơn: 42,000 kg │ Tổng tải fleet: 38,500 kg       │
│ ⚠️ Vượt tải 3,500 kg — cần thêm xe hoặc dời đơn      │
│                                                         │
│ Xe       │ Tải    │ Đã xếp │ Còn   │ Sử dụng          │
│ 51A-123  │ 5,000  │ 4,800  │ 200   │ ████████░ 96%    │
│ 51A-456  │ 3,500  │ 3,500  │ 0     │ █████████ 100%   │
│ 51A-789  │ 8,000  │ 5,500  │ 2,500 │ ██████░░ 69%     │
└─────────────────────────────────────────────────────────┘
```

### 4.8 Nút "Copy thông tin cho DVKH"

Khi bấm, copy text sẵn dùng để gửi cho DVKH:

```
Đơn SH-2026-0042 — NPP Bình Dương (8,000 kg) — Ngày giao: 21/04/2026

Đơn hàng không xếp được xe do vượt tải. Đề xuất phương án:

1. Tách thành 2 đơn giao cùng ngày:
   - Đơn 1: ~5,000 kg (xe 5 tấn)
   - Đơn 2: ~3,000 kg (xe 3.5 tấn)

2. Dời giao sang ngày 22/04 — có xe 8 tấn rảnh, giao nguyên đơn.

Vui lòng xác nhận với NPP và phản hồi phương án được chọn.
```

### 4.9 Thay đổi cần thiết

| Bước | Nội dung | File ảnh hưởng |
|------|---------|---------------|
| 1 | Thêm struct `VRPDiagnostics` + sub-structs | domain/models.go |
| 2 | Implement `buildDiagnostics()` trong service | tms/service.go |
| 3 | Gắn diagnostics vào VRPResult trước khi trả về | tms/service.go |
| 4 | Frontend: Diagnostic panel + copy button | planning/page.tsx |
| 5 | Python solver: **KHÔNG thay đổi** | — |

---

## 5. Lộ trình triển khai tổng thể

### Phase A: Giới hạn xe tại NPP (ưu tiên cao)

- OR-Tools native, ~20 dòng Python
- Thêm 1 cột DB + API admin
- **Không ảnh hưởng hiệu năng** (nhanh hơn hiện tại do pruning)

### Phase B: VRP Diagnostic Report (ưu tiên cao)

- Chỉ thay đổi Go service + frontend
- Python solver không đổi
- **Giá trị nghiệp vụ cao** — giải quyết pain point dispatcher/DVKH hiện tại
- Nút "Copy cho DVKH" tiết kiệm thời gian đáng kể

### Phase C: Cấm xe tải theo giờ — Hybrid PA7 + PA5 (ưu tiên trung bình)

- Phức tạp hơn: virtual nodes + time window + polyline validation
- Cần bảng DB cho vùng cấm + API admin CRUD
- Tăng ~10-15% thời gian solve

### Ưu tiên: A → B → C

Phase A và B độc lập nhau, có thể làm song song. Phase C phụ thuộc vào time window dimension (hiện chưa có trong solver).

---

## 6. Phụ lục: Cấu trúc dữ liệu chi tiết

### 6.1 Database: bảng `customers` (bổ sung)

```sql
ALTER TABLE customers
ADD COLUMN max_vehicle_weight_kg NUMERIC(10,2) DEFAULT NULL;
-- NULL = không giới hạn, chấp nhận mọi xe
```

### 6.2 Database: bảng `truck_ban_zones`

```sql
CREATE TABLE truck_ban_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    polygon JSONB NOT NULL,          -- [[lat, lng], ...]
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE truck_ban_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id UUID REFERENCES truck_ban_zones(id),
    min_vehicle_weight_kg NUMERIC(10,2) NOT NULL,
    banned_hours JSONB NOT NULL,     -- [{"from": "06:00", "to": "09:00"}, ...]
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT true
);
```

### 6.3 Domain model: `VRPDiagnostics`

```go
type VRPDiagnostics struct {
    UnassignedAnalysis []UnassignedAnalysis `json:"unassigned_analysis"`
    FleetAnalysis      FleetAnalysis        `json:"fleet_analysis"`
    CapacityWarnings   []CapacityWarning    `json:"capacity_warnings"`
    Suggestions        []DiagSuggestion     `json:"suggestions"`
}

type UnassignedAnalysis struct {
    ShipmentID     uuid.UUID     `json:"shipment_id"`
    ShipmentNumber string        `json:"shipment_number"`
    CustomerName   string        `json:"customer_name"`
    WeightKg       float64       `json:"weight_kg"`
    ReasonCode     string        `json:"reason_code"`
    ReasonText     string        `json:"reason_text"`
    Options        []SplitOption `json:"options"`
}

type SplitOption struct {
    Code        string `json:"option_code"`
    Description string `json:"description"`
    Detail      string `json:"detail"`
    Feasibility string `json:"feasibility"` // high, medium, low
}

type FleetAnalysis struct {
    TotalDemandKg        float64          `json:"total_demand_kg"`
    TotalFleetCapacityKg float64          `json:"total_fleet_capacity_kg"`
    UtilizationPct       float64          `json:"utilization_pct"`
    IsOverCapacity       bool             `json:"is_over_capacity"`
    OverCapacityKg       float64          `json:"over_capacity_kg"`
    Vehicles             []VehicleSlot    `json:"vehicles"`
    Bottleneck           string           `json:"bottleneck"`
}

type VehicleSlot struct {
    Plate          string  `json:"plate"`
    VehicleType    string  `json:"type"`
    CapacityKg     float64 `json:"capacity_kg"`
    AssignedKg     float64 `json:"assigned_kg"`
    RemainingKg    float64 `json:"remaining_kg"`
    UtilizationPct float64 `json:"utilization_pct"`
    NumStops       int     `json:"num_stops"`
}

type CapacityWarning struct {
    VehiclePlate   string  `json:"vehicle_plate"`
    UtilizationPct float64 `json:"utilization_pct"`
    RemainingKg    float64 `json:"remaining_kg"`
    Warning        string  `json:"warning"`
}

type DiagSuggestion struct {
    Type string `json:"type"` // add_vehicle, reschedule_batch, split_order
    Text string `json:"text"`
}
```

---

> **Ghi chú:** Tài liệu này là phân tích & đề xuất, chưa phải spec triển khai chi tiết. Khi bắt đầu code từng phase, cần viết spec API + migration cụ thể.
