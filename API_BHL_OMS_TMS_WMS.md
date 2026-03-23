# API CONTRACT SPECIFICATION — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.2** |
| Cập nhật | 20/03/2026 (session 18) |
| Dựa trên | SAD v2.1, BRD v2.3, DBS v1.0 |
| Base URL | `https://api.bhl-ops.vn/v1` |
| Auth | Bearer JWT RS256 |
| Content-Type | `application/json` |
| Timezone | UTC (ISO 8601). Client convert Asia/Ho_Chi_Minh |

> **⚠️ DRIFT NOTICE (v1.2):** File này được cập nhật session 18 để bổ sung các sections còn thiếu. Một số endpoint trong spec gốc chưa implement (đánh dấu `[SPEC-ONLY]`), một số endpoint mới chỉ có trong code (đánh dấu `[NEW]`). Xem CURRENT_STATE.md cho trạng thái thực tế.

---

# MỤC LỤC

1. [Quy ước chung](#1-quy-ước-chung)
2. [Auth Endpoints](#2-auth-endpoints)
3. [OMS Endpoints](#3-oms-endpoints)
4. [TMS Endpoints](#4-tms-endpoints)
5. [Driver App Endpoints](#5-driver-app-endpoints)
6. [WMS Endpoints](#6-wms-endpoints)
7. [Reconciliation Endpoints](#7-reconciliation-endpoints)
8. [Reports & Dashboard](#8-reports--dashboard)
9. [Admin & Master Data](#9-admin--master-data)
10. [Notification & WebSocket](#10-notification--websocket)
11. [Public Endpoints](#11-public-endpoints)
12. [Integration Webhooks](#12-integration-webhooks)
13. [KPI Endpoints](#13-kpi-endpoints)
14. [GPS Endpoints](#14-gps-endpoints)
15. [Error Codes](#15-error-codes)
16. [Appendix A — Endpoints mới (Session 15-18)](#appendix-a--endpoints-mới-session-15-18-new)
17. [Appendix B — Spec-only Endpoints (chưa implement)](#appendix-b--spec-only-endpoints-chưa-implement)

---

# 1. QUY ƯỚC CHUNG

## 1.1 Request Format

```
Authorization: Bearer <access_token>
Content-Type: application/json
Idempotency-Key: <uuid>           # Required cho POST/PUT
X-Request-Id: <uuid>              # Optional, auto-gen nếu thiếu
```

## 1.2 Response Format

**Success:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {                      // Có cho paginated
    "total": 150,
    "page": 1,
    "limit": 20,
    "total_pages": 8
  }
}
```

**Error:**
```json
{
  "success": false,
  "error": {
    "code": "CREDIT_LIMIT_EXCEEDED",
    "message": "NPP ABC vượt hạn mức công nợ 500,000,000 VND",
    "details": {
      "current_balance": 480000000,
      "order_amount": 50000000,
      "credit_limit": 500000000
    }
  }
}
```

## 1.3 Pagination

```
GET /v1/orders?page=1&limit=20&sort=created_at&order=desc
```

## 1.4 Filtering

```
GET /v1/orders?status=confirmed&customer_id=xxx&from_date=2026-03-01&to_date=2026-03-31
```

## 1.5 HTTP Status Codes

| Code | Ý nghĩa | Khi nào |
|------|---------|---------|
| 200 | OK | GET, PUT, PATCH thành công |
| 201 | Created | POST tạo mới thành công |
| 400 | Bad Request | Validation fail, thiếu field |
| 401 | Unauthorized | Token missing/expired |
| 403 | Forbidden | Không đủ quyền (RBAC) |
| 404 | Not Found | Resource không tồn tại |
| 409 | Conflict | Duplicate (idempotency), race condition |
| 422 | Unprocessable | Business rule violation (credit limit, ATP, gate check) |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Error | Server error |

---

# 2. AUTH ENDPOINTS

## POST /v1/auth/login

| | |
|-|---|
| Auth | None |
| Roles | Tất cả |

**Request:**
```json
{
  "username": "dvkh_01",
  "password": "***"
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbG...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "uuid",
      "username": "dvkh_01",
      "full_name": "Nguyễn Văn A",
      "role": "dvkh",
      "permissions": ["order:create", "order:read", "order:update"],
      "warehouse_ids": ["uuid-kho-hl"]
    }
  }
}
```

> Refresh Token set trong HttpOnly Cookie `bhl_refresh_token` (Web) hoặc trả trong body cho Mobile.

## POST /v1/auth/refresh

| | |
|-|---|
| Auth | Refresh Token (Cookie hoặc Body) |

**Response 200:** Trả access_token mới + rotate refresh token.

## POST /v1/auth/logout

| | |
|-|---|
| Auth | Bearer Token |

Invalidate refresh token trong DB.

---

# 3. OMS ENDPOINTS

## 3.1 Orders — CRUD

### POST /v1/orders
**Tạo đơn hàng** — DVKH nhập đơn (US-OMS-01)

| | |
|-|---|
| Roles | `admin`, `dvkh` |
| Business Rules | ATP check (US-OMS-02), Credit limit (R15, US-OMS-07), Cutoff 16h (R08) |

**Request:**
```json
{
  "customer_id": "uuid",
  "warehouse_id": "uuid",
  "delivery_date": "2026-03-20",
  "delivery_address": {
    "label": "Kho NPP ABC",
    "address": "123 Trần Phú, Hạ Long",
    "lat": 20.9511,
    "lng": 107.0748
  },
  "time_window": "morning",
  "items": [
    { "product_id": "uuid", "quantity": 100, "unit_price": 250000 },
    { "product_id": "uuid", "quantity": 50, "unit_price": 180000 }
  ],
  "notes": "Giao trước 10h"
}
```

**Response 201:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_number": "SO-20260320-0001",
    "status": "confirmed",
    "cutoff_group": "before_16h",
    "total_amount": 34000000,
    "deposit_amount": 1500000,
    "atp_status": "sufficient",
    "credit_status": "within_limit",
    "items": [...]
  }
}
```

**Response 422 (vượt hạn mức):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "order_number": "SO-20260320-0002",
    "status": "pending_approval",
    "credit_status": "exceeded",
    "credit_details": {
      "current_balance": 480000000,
      "order_amount": 34000000,
      "credit_limit": 500000000
    }
  }
}
```

### GET /v1/orders
**Danh sách đơn hàng**

| | |
|-|---|
| Roles | `admin`, `dvkh`, `dispatcher`, `accountant`, `management` |

**Query params:** `status`, `customer_id`, `warehouse_id`, `from_date`, `to_date`, `cutoff_group`, `page`, `limit`

### GET /v1/orders/:id
**Chi tiết đơn hàng** — Bao gồm items, shipment, delivery attempts, payments

### PUT /v1/orders/:id
**Cập nhật đơn** — Chỉ khi status = `draft`, `confirmed` hoặc `pending_approval`

| | |
|-|---|
| Roles | `admin`, `dvkh`, `dispatcher` |

**Request body:** (giống POST /v1/orders)
```json
{
  "customer_id": "uuid",
  "warehouse_id": "uuid",
  "delivery_date": "2026-03-15",
  "notes": "Ghi chú cập nhật",
  "items": [
    { "product_id": "uuid", "quantity": 100 }
  ]
}
```

**Logic xử lý:**
1. Giải phóng tồn kho reserved cũ
2. Xóa order_items cũ, shipment pending cũ, debit entry cũ
3. Kiểm tra ATP mới (ATP hiện tại + qty cũ đã release)
4. Re-check hạn mức tín dụng → nếu vượt → `pending_approval`
5. Tạo lại items, reserve stock, tạo shipment + debit (nếu confirmed)

**Response:** Order object đã cập nhật

### POST /v1/orders/:id/cancel
**Hủy đơn** — Hoàn lại ATP

### POST /v1/orders/:id/approve
**Duyệt đơn vượt hạn mức** — Kế toán (R15)

| | |
|-|---|
| Roles | `admin`, `accountant`, `management` |

**Request:**
```json
{
  "action": "approve",
  "notes": "Đã kiểm tra công nợ, cho phép"
}
```

## 3.2 ATP

### GET /v1/atp

**Kiểm tra tồn kho khả dụng** (US-OMS-02)

**Query params:** `product_id`, `warehouse_id`

**Response:**
```json
{
  "success": true,
  "data": {
    "product_id": "uuid",
    "warehouse_id": "uuid",
    "available": 500,
    "committed": 120,
    "reserved": 30,
    "atp": 350,
    "cached_at": "2026-03-20T08:30:00Z"
  }
}
```

## 3.3 Consolidation & Split

### POST /v1/orders/consolidate
**Gom đơn** (US-OMS-03)

| | |
|-|---|
| Roles | `admin`, `dispatcher` |

**Request:**
```json
{
  "order_ids": ["uuid1", "uuid2", "uuid3"],
  "warehouse_id": "uuid"
}
```

**Response:** Trả `shipment` object mới gom từ các orders.

### POST /v1/orders/:id/split
**Tách đơn** (US-OMS-04)

**Request:**
```json
{
  "splits": [
    { "items": [{ "product_id": "uuid", "quantity": 300 }] },
    { "items": [{ "product_id": "uuid", "quantity": 200 }] }
  ]
}
```

---

# 4. TMS ENDPOINTS

## 4.1 Planning

### POST /v1/planning/run-vrp
**Chạy VRP solver** (US-TMS-01)

| | |
|-|---|
| Roles | `admin`, `dispatcher` |

**Request:**
```json
{
  "warehouse_id": "uuid",
  "delivery_date": "2026-03-20",
  "shipment_ids": ["uuid1", "uuid2"],   // Optional: auto-select nếu bỏ trống
  "vehicle_ids": ["uuid1", "uuid2"]      // Optional: auto-select available
}
```

**Response 200:** (Async — trả job_id, poll cho kết quả)
```json
{
  "success": true,
  "data": {
    "job_id": "vrp-20260320-001",
    "status": "processing",
    "poll_url": "/v1/planning/jobs/vrp-20260320-001"
  }
}
```

### GET /v1/planning/jobs/:jobId
**Kết quả VRP**

**Response 200 (completed):**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "solve_time_ms": 45000,
    "trips": [
      {
        "vehicle_id": "uuid",
        "driver_id": null,
        "stops": [
          {
            "shipment_id": "uuid",
            "customer_id": "uuid",
            "stop_order": 1,
            "estimated_arrival": "2026-03-20T08:30:00Z",
            "estimated_departure": "2026-03-20T09:00:00Z",
            "cumulative_load_kg": 2500
          }
        ],
        "total_distance_km": 45.2,
        "total_duration_min": 180
      }
    ],
    "unassigned_shipments": ["uuid5"],
    "summary": {
      "total_trips": 12,
      "total_vehicles": 12,
      "total_shipments_assigned": 85,
      "total_distance_km": 580
    }
  }
}
```

### POST /v1/planning/approve
**Duyệt kế hoạch → Tạo trips trong DB**

**Request:**
```json
{
  "job_id": "vrp-20260320-001",
  "trip_assignments": [
    { "trip_index": 0, "driver_id": "uuid", "vehicle_id": "uuid" }
  ]
}
```

### POST /v1/planning/manual-adjust
**Chỉnh tay trip** — Dispatcher thêm/bớt stop, đổi thứ tự

## 4.2 Trips

### GET /v1/trips
**Danh sách trip**

**Query params:** `status`, `planned_date`, `vehicle_id`, `driver_id`, `warehouse_id`

### GET /v1/trips/:id
**Chi tiết trip** — stops, delivery attempts, payments, checklists

### GET /v1/trips/:id/timeline
**Timeline sự kiện trip** — log mọi status change

### POST /v1/trips/:id/assign
**Gán xe + tài xế**

### GET /v1/trips/active-map
**Tất cả trips đang chạy** — cho Dispatcher map

**Response:**
```json
{
  "data": {
    "trips": [
      {
        "trip_id": "uuid",
        "vehicle_id": "uuid",
        "plate_number": "14C-12345",
        "driver_name": "Nguyễn Văn B",
        "status": "in_transit",
        "current_stop": 3,
        "total_stops": 8,
        "gps": { "lat": 20.95, "lng": 107.07, "speed": 40, "updated_at": "..." }
      }
    ]
  }
}
```

## 4.3 Vehicles & Drivers

### GET /v1/vehicles
### GET /v1/vehicles/available
**Xe khả dụng** (status=active, không có trip chưa completed, giấy tờ còn hạn)

### CRUD /v1/vehicles/:id
### CRUD /v1/drivers/:id

## 4.4 Shipments

### GET /v1/shipments/pending
**Danh sách shipments chờ giao**
**Query params:** `warehouse_id` (required), `delivery_date` (required)
**Response fields mới (Session 5):**
- `is_urgent` (boolean) — ưu tiên giao gấp
- `created_at` (timestamp) — thời gian tạo shipment
- `order_created_at` (timestamp) — thời gian đặt hàng (từ sales_orders)
- `order_confirmed_at` (timestamp, nullable) — thời gian xác nhận đơn
- Sắp xếp: urgent DESC → order_created_at ASC → route_code → customer name

### PUT /v1/shipments/:id/urgent
**Toggle ưu tiên giao gấp** — admin/dispatcher only
**Body:** `{ "is_urgent": true }`
**Response 200:** `{ "success": true, "data": { "id": "...", "is_urgent": true } }`

### GET /v1/shipments/pending-dates
**Ngày có shipments chờ giao** — để frontend auto-detect ngày giao
**Query params:** `warehouse_id` (required)

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "delivery_date": "2026-03-15", "shipment_count": 4, "total_weight_kg": 23532.7 },
    { "delivery_date": "2026-03-16", "shipment_count": 400, "total_weight_kg": 595875.6 }
  ]
}
```

## 4.5 Driver Check-in

### POST /v1/driver/checkin
**Tài xế check-in hàng ngày** — báo sẵn sàng hoặc nghỉ

| | |
|-|---|
| Roles | `driver` |

**Request:**
```json
{
  "status": "available",   // "available" hoặc "off_duty"
  "reason": "sick",        // Optional: sick, personal, vehicle_maintenance, other
  "note": "Bị sốt"         // Optional
}
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "driver_id": "uuid",
    "checkin_date": "2026-03-15",
    "status": "available",
    "checked_in_at": "2026-03-15T07:30:00+07:00"
  }
}
```

### GET /v1/driver/checkin
**Xem trạng thái check-in hôm nay** — trả `not_checked_in` nếu chưa check-in

### GET /v1/drivers/checkins
**Dispatcher xem trạng thái toàn bộ tài xế** — cho lập kế hoạch
**Query params:** `warehouse_id` (required), `date` (required)

**Response 200:**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "full_name": "Phạm Văn Đức", "phone": "...", "checkin_status": "available", "has_active_trip": false },
    { "id": "uuid", "full_name": "Nguyễn Văn Hùng", "phone": "...", "checkin_status": "on_trip", "has_active_trip": true },
    { "id": "uuid", "full_name": "Trần Văn Toàn", "phone": "...", "checkin_status": "off_duty", "reason": "sick" }
  ]
}
```

---

# 5. DRIVER APP ENDPOINTS

> Base: `/v1/driver` — Tất cả require role `driver`

## 5.1 Trip & Checklist

### GET /v1/driver/my-trip
**Trip hiện tại của tài xế** — Bao gồm stops, items, customer info

### POST /v1/driver/checklist
**Submit checklist đầu ca / cuối ca** (US-TMS-10, US-TMS-18)

**Request:**
```json
{
  "trip_id": "uuid",
  "checklist_type": "pre_trip",
  "items": [
    { "name": "Phanh", "passed": true },
    { "name": "Lốp", "passed": true },
    { "name": "Đèn", "passed": false, "notes": "Đèn phải hỏng", "photo_url": "s3://..." }
  ],
  "photo_urls": ["s3://..."],
  "all_passed": false
}
```

## 5.2 ePOD & Delivery

### POST /v1/driver/epod
**Xác nhận giao hàng** (US-TMS-13)

**Request:**
```json
{
  "trip_stop_id": "uuid",
  "order_id": "uuid",
  "status": "delivered",
  "delivered_items": [
    { "product_id": "uuid", "qty_ordered": 100, "qty_delivered": 100 },
    { "product_id": "uuid", "qty_ordered": 50, "qty_delivered": 45 }
  ],
  "photo_urls": ["s3://..."],
  "gps": { "lat": 20.9511, "lng": 107.0748, "accuracy_m": 15.5 },
  "notes": ""
}
```

**Response 201:** Trả delivery_attempt + triggers Zalo confirmation.

### POST /v1/driver/incident
**Báo sự cố** (US-TMS-14)

**Request:**
```json
{
  "trip_id": "uuid",
  "incident_type": "vehicle_breakdown",
  "description": "Xe hỏng tại km 25 QL18",
  "photo_urls": ["s3://..."],
  "gps": { "lat": 20.95, "lng": 107.07 }
}
```

## 5.3 Payment

### POST /v1/driver/payment
**Thu tiền / Ghi nhận công nợ** (US-TMS-15)

**Request:**
```json
{
  "delivery_attempt_id": "uuid",
  "order_id": "uuid",
  "customer_id": "uuid",
  "payment_type": "cash",
  "amount": 25000000,
  "photo_url": "s3://...",
  "notes": ""
}
```

> Nếu `payment_type` = `credit` → Hệ thống ghi `receivable_ledger` debit entry.
> Nếu `payment_type` = `transfer` → status = `pending` → chờ Dispatcher confirm.

## 5.4 Return Collection

### POST /v1/driver/return-collection
**Thu vỏ** (US-TMS-16)

**Request:**
```json
{
  "trip_stop_id": "uuid",
  "customer_id": "uuid",
  "items": [
    { "asset_type": "bottle", "quantity": 50, "condition": "good" },
    { "asset_type": "bottle", "quantity": 5, "condition": "damaged", "photo_url": "s3://..." },
    { "asset_type": "crate", "quantity": 10, "condition": "good" }
  ]
}
```

## 5.5 GPS

### POST /v1/driver/gps/batch
**Batch gửi GPS** (offline buffer)

**Request:**
```json
{
  "points": [
    { "lat": 20.95, "lng": 107.07, "speed": 40, "heading": 180, "accuracy_m": 10, "recorded_at": "..." },
    { "lat": 20.96, "lng": 107.08, "speed": 35, "heading": 175, "accuracy_m": 12, "recorded_at": "..." }
  ]
}
```

## 5.6 Sync Queue

### POST /v1/driver/sync
**Bulk sync offline actions** — FIFO ordered

**Request:**
```json
{
  "actions": [
    { "type": "epod", "payload": {...}, "local_id": "local-uuid-1", "timestamp": "..." },
    { "type": "payment", "payload": {...}, "local_id": "local-uuid-2", "timestamp": "..." },
    { "type": "return_collection", "payload": {...}, "local_id": "local-uuid-3", "timestamp": "..." }
  ]
}
```

**Response:** Trả kết quả từng action (success/conflict + server ID mapping).

## 5.7 File Upload

### GET /v1/driver/upload-url
**Pre-signed URL cho upload ảnh → S3**

**Query:** `filename=checklist_001.jpg&content_type=image/jpeg`

**Response:**
```json
{
  "data": {
    "upload_url": "https://s3.../presigned-url",
    "file_key": "uploads/2026/03/20/uuid.jpg",
    "expires_in": 3600
  }
}
```

---

# 6. WMS ENDPOINTS

## 6.1 Stock

### GET /v1/warehouse/stock
**Tồn kho** — filter theo warehouse, product, lot

**Response:**
```json
{
  "data": [
    {
      "product_id": "uuid",
      "product_name": "Bia Hạ Long chai 450ml",
      "lot_id": "uuid",
      "batch_number": "BHL-2026-001",
      "expiry_date": "2026-09-15",
      "location": "HL.ZoneA.Aisle1.Bin03",
      "quantity": 500,
      "reserved_qty": 50,
      "available": 450
    }
  ]
}
```

## 6.2 Inbound

### POST /v1/warehouse/inbound
**Nhập kho** (US-WMS-02)

**Request:**
```json
{
  "warehouse_id": "uuid",
  "source_type": "production",
  "items": [
    {
      "product_id": "uuid",
      "batch_number": "BHL-2026-002",
      "production_date": "2026-03-19",
      "expiry_date": "2026-09-19",
      "quantity": 1000,
      "location_id": "uuid"
    }
  ]
}
```

## 6.3 Picking

### GET /v1/warehouse/picking-orders
**Danh sách lệnh đóng hàng** — filter status, warehouse

### GET /v1/warehouse/picking-orders/:id
**Chi tiết picking** — gợi ý vị trí FEFO/FIFO

### POST /v1/warehouse/confirm-pick
**Xác nhận pick** (quét PDA → verify lô đúng)

**Request:**
```json
{
  "picking_order_id": "uuid",
  "picked_items": [
    { "product_id": "uuid", "lot_id": "uuid", "location_id": "uuid", "quantity": 100, "barcode": "BHL-SKU001-LOT002" }
  ]
}
```

**Response 422 (sai lô):**
```json
{
  "success": false,
  "error": {
    "code": "WRONG_LOT_PICKED",
    "message": "Lô BHL-2026-003 không đúng FEFO. Nên pick lô BHL-2026-001 (HSD 15/06/2026)",
    "details": {
      "picked_lot": "BHL-2026-003",
      "suggested_lot": "BHL-2026-001",
      "suggested_expiry": "2026-06-15"
    }
  }
}
```

## 6.4 Gate Check

### POST /v1/warehouse/gate-check
**Kiểm đếm cổng** (US-WMS-04, R01)

**Request:**
```json
{
  "trip_id": "uuid",
  "shipment_id": "uuid",
  "scanned_items": [
    { "product_id": "uuid", "lot_id": "uuid", "quantity": 100, "barcode": "BHL-SKU001-LOT001" }
  ]
}
```

**Response 200 (pass):**
```json
{
  "data": {
    "result": "pass",
    "exit_time": "2026-03-20T06:30:00Z",
    "message": "Kiểm đếm OK — sai lệch = 0"
  }
}
```

**Response 422 (fail — R01 sai lệch = 0):**
```json
{
  "success": false,
  "error": {
    "code": "GATE_CHECK_FAILED",
    "message": "Sai lệch hàng tại cổng. Xe KHÔNG được ra.",
    "details": {
      "discrepancies": [
        { "product_id": "uuid", "expected": 100, "scanned": 95, "diff": -5 }
      ]
    }
  }
}
```

## 6.5 Barcode Scan

### POST /v1/warehouse/barcode-scan
**Quét mã vạch PDA** — tra cứu sản phẩm + lô

**Request:**
```json
{ "barcode": "BHL-SKU001-LOT002" }
```

**Response:**
```json
{
  "data": {
    "product_id": "uuid",
    "product_name": "Bia Hạ Long chai 450ml",
    "lot_id": "uuid",
    "batch_number": "BHL-2026-002",
    "expiry_date": "2026-09-19",
    "location": "HL.ZoneA.Aisle1.Bin03",
    "quantity_at_location": 500
  }
}
```

## 6.6 Returns (Phân xưởng)

### GET /v1/returns/pending
**Vỏ chờ phân xưởng xác nhận**

### POST /v1/returns/confirm-return-inbound
**Phân xưởng xác nhận nhập vỏ** (US-WMS-22, R02)

**Request:**
```json
{
  "return_collection_id": "uuid",
  "confirmed_items": [
    { "asset_type": "bottle", "condition": "good", "confirmed_qty": 48 },
    { "asset_type": "bottle", "condition": "damaged", "confirmed_qty": 5 }
  ],
  "notes": "Thiếu 2 vỏ so với tài xế khai — lái xe chịu"
}
```

## 6.7 Assets

### GET /v1/assets/ledger-by-customer
**Công nợ vỏ theo NPP**

**Query:** `customer_id`, `asset_type`, `from_date`, `to_date`

### GET /v1/assets/outstanding
**Tổng vỏ tồn tại NPP** — Summary all customers

---

# 7. RECONCILIATION ENDPOINTS

### GET /v1/reconciliation/trip-summary/:tripId
**Biên bản đối soát chuyến** (US-REC-01)

**Response:**
```json
{
  "data": {
    "trip_id": "uuid",
    "trip_number": "TRIP-20260320-001",
    "status": "discrepancy",
    "goods": {
      "expected": [{ "product_id": "uuid", "qty": 100 }],
      "delivered": [{ "product_id": "uuid", "qty": 95 }],
      "returned": [{ "product_id": "uuid", "qty": 5 }],
      "match": true
    },
    "money": {
      "expected": 25000000,
      "collected_cash": 20000000,
      "collected_transfer": 0,
      "credited": 5000000,
      "match": true
    },
    "assets": {
      "driver_reported": [{ "type": "bottle", "good": 50, "damaged": 5 }],
      "workshop_confirmed": [{ "type": "bottle", "good": 48, "damaged": 5 }],
      "match": false,
      "discrepancy": [{ "type": "bottle", "diff": -2, "responsible": "driver" }]
    }
  }
}
```

### POST /v1/reconciliation/open-discrepancy
**Mở hồ sơ sai lệch** (US-REC-02, R06)

| | |
|-|---|
| Roles | `admin`, `accountant` |

**Request:**
```json
{
  "reconciliation_id": "uuid",
  "trip_id": "uuid",
  "discrepancy_type": "assets",
  "description": "Thiếu 2 vỏ chai — lái xe chịu trách nhiệm (R02)",
  "quantity": 2,
  "responsible_party": "Nguyễn Văn B (TX-042)"
}
```

### PUT /v1/reconciliation/discrepancy/:id
**Cập nhật / Đóng sai lệch**

**Request:**
```json
{
  "status": "closed",
  "resolved_notes": "Tài xế đã nộp bồi hoàn 200,000 VND"
}
```

### GET /v1/reconciliation/daily-report
**Tổng hợp đối soát ngày** (US-REC-03)

**Query:** `date=2026-03-20`, `warehouse_id`

---

# 8. REPORTS & DASHBOARD

### GET /v1/reports/kpi-otd
**Tỷ lệ giao đúng hẹn** — BRD §10.2

**Query:** `from_date`, `to_date`, `warehouse_id`, `granularity=day|week|month`

### GET /v1/reports/kpi-empty-run
**Tỷ lệ xe rỗng**

### GET /v1/reports/kpi-vehicle-utilization
**Hiệu suất sử dụng xe**

### GET /v1/reports/kpi-redelivery
**Số đơn giao lại + top lý do**

### GET /v1/reports/dashboard-data
**Dashboard tổng hợp real-time** — Widget data

**Response:**
```json
{
  "data": {
    "orders_today": { "total": 980, "delivered": 850, "in_transit": 100, "pending": 30 },
    "trips_today": { "total": 120, "active": 45, "completed": 70, "with_issues": 5 },
    "money_today": { "expected": 500000000, "collected": 420000000, "credited": 80000000 },
    "alerts": [
      { "type": "vehicle_idle", "message": "Xe 14C-123 dừng 25 phút tại KM5 QL18", "severity": "warning" }
    ]
  }
}
```

---

# 9. ADMIN & MASTER DATA

> Base: `/v1/admin` — Tất cả require role `admin`

### GET /v1/admin/users
**Danh sách người dùng** — Paginated, filter by role

**Query params:** `role`, `page`, `limit`

### GET /v1/admin/users/:id
**Chi tiết người dùng**

### POST /v1/admin/users
**Tạo người dùng mới**

**Request:**
```json
{
  "username": "dvkh_05",
  "password": "***",
  "full_name": "Nguyễn Văn A",
  "role": "dvkh",
  "warehouse_ids": ["uuid-wh-hl"]
}
```

### PUT /v1/admin/users/:id
**Cập nhật người dùng** — Sửa full_name, role, warehouse_ids

### DELETE /v1/admin/users/:id
**Xóa người dùng** — Soft delete

### POST /v1/admin/users/:id/reset-password
**Reset mật khẩu** — Admin reset

**Request:**
```json
{ "new_password": "***" }
```

### GET /v1/admin/roles
**Danh sách roles** — Trả roles với default permissions

**Response:**
```json
{
  "data": [
    { "role": "admin", "name": "Quản trị viên", "permissions": ["*"] },
    { "role": "dispatcher", "name": "Điều phối viên" },
    { "role": "driver", "name": "Tài xế" },
    { "role": "warehouse_handler", "name": "Thủ kho" },
    { "role": "accountant", "name": "Kế toán" },
    { "role": "management", "name": "Ban giám đốc" },
    { "role": "dvkh", "name": "DVKH" },
    { "role": "security", "name": "Bảo vệ" }
  ]
}
```

---

# 10. NOTIFICATION & WEBSOCKET

### GET /v1/notifications
**Danh sách thông báo** — Người dùng hiện tại

**Query params:** `page`, `limit`, `unread_only`

### GET /v1/notifications/unread-count
**Số thông báo chưa đọc**

**Response:** `{ "data": { "count": 5 } }`

### PUT /v1/notifications/:id/read
**Đánh dấu đã đọc**

### PUT /v1/notifications/read-all
**Đánh dấu tất cả đã đọc**

### WebSocket /ws/notifications
**Real-time notifications**

**Kết nối:** `ws://host/ws/notifications?token=<access_token>`

---

# 11. PUBLIC ENDPOINTS

> Không yêu cầu authentication

### GET /v1/public/confirm/:token
**Trang xác nhận NPP** — Zalo confirmation token

### POST /v1/public/confirm/:token
**NPP xác nhận hoặc báo sai lệch**

**Request:** `{ "action": "confirm" }` hoặc `{ "action": "dispute", "items": [...] }`

---

# 12. INTEGRATION WEBHOOKS

### POST /v1/integration/bravo/webhook
**Bravo webhook** — Nhận data từ Bravo

### POST /v1/integration/bravo/push-document
**Push chứng từ sang Bravo**

### POST /v1/integration/bravo/reconcile
**Đối soát Bravo**

### POST /v1/integration/dms/sync
**Sync đơn hàng sang DMS**

### POST /v1/integration/zalo/send
**Gửi tin nhắn Zalo ZNS**

### POST /v1/integration/npp/send-confirmation
**Gửi link xác nhận cho NPP**

### POST /v1/integration/npp/auto-confirm
**Auto-confirm NPP quá 24h** — Cron trigger

### GET /v1/integration/dlq
**Danh sách DLQ entries**

### GET /v1/integration/dlq/stats
**Thống kê DLQ**

### POST /v1/integration/dlq/:id/retry
**Retry DLQ entry**

### POST /v1/integration/dlq/:id/resolve
**Resolve DLQ entry**

---

# 13. KPI ENDPOINTS

### GET /v1/kpi/report
**KPI report** — date range + warehouse filter

**Query:** `from_date`, `to_date`, `warehouse_id`

**Metrics:** otd_rate, delivery_success_rate, vehicle_utilization, total_distance_km, total_revenue, total_collections, recon_match_rate

### POST /v1/kpi/snapshot
**Manual KPI snapshot**

**Request:** `{ "warehouse_id": "uuid", "snapshot_date": "2026-03-20" }`

---

# 14. GPS ENDPOINTS

### POST /v1/driver/gps/batch
**Batch upload GPS** — Up to 1000 points *(See section 5.5)*

### GET /v1/gps/latest
**Latest GPS positions (enriched)** — vehicle_plate, driver_name, trip_status

| | |
|-|---|
| Roles | `admin`, `dispatcher`, `management` |

### WebSocket /ws/gps
**Real-time GPS stream** — Redis pub/sub

**Kết nối:** `ws://host/ws/gps?token=<access_token>`

---

# 15. ERROR CODES

| Code | HTTP | Ý nghĩa |
|------|------|---------|
| `VALIDATION_ERROR` | 400 | Thiếu field hoặc format sai |
| `UNAUTHORIZED` | 401 | Token missing/expired |
| `FORBIDDEN` | 403 | Không đủ quyền |
| `NOT_FOUND` | 404 | Resource không tồn tại |
| `CREDIT_LIMIT_EXCEEDED` | 422 | Vượt hạn mức công nợ NPP |
| `ATP_INSUFFICIENT` | 422 | Tồn kho không đủ |
| `GATE_CHECK_FAILED` | 422 | Sai lệch hàng tại cổng |
| `WRONG_LOT_PICKED` | 422 | Pick sai lô (FEFO violation) |
| `INVALID_STATUS_TRANSITION` | 422 | Chuyển trạng thái không hợp lệ |
| `DUPLICATE_ENTRY` | 409 | Trùng lặp (idempotency) |
| `INTERNAL_ERROR` | 500 | Lỗi server |

### GET /v1/reports/receivable-by-customer
**Công nợ tiền hàng theo NPP**

### GET /v1/reports/asset-outstanding
**Công nợ vỏ theo NPP**

---

# 9. ADMIN & MASTER DATA

## 9.1 Master Data CRUD

| Endpoint | Resource | Roles |
|----------|---------|-------|
| `/v1/admin/products` | Sản phẩm (SKU) | `admin` |
| `/v1/admin/customers` | NPP/Khách hàng | `admin`, `dvkh` |
| `/v1/admin/routes` | Tuyến đường | `admin` |
| `/v1/admin/warehouses` | Kho + vị trí (LTREE) | `admin` |
| `/v1/admin/vehicles` | Xe | `admin`, `fleet_manager` |
| `/v1/admin/drivers` | Tài xế | `admin`, `fleet_manager` |
| `/v1/admin/users` | Users + RBAC | `admin` |

Tất cả follow RESTful CRUD: `GET /`, `GET /:id`, `POST /`, `PUT /:id`, `DELETE /:id`

## 9.2 System Configs

### GET /v1/admin/configs
### PUT /v1/admin/configs/:key

**Request:**
```json
{
  "value": 17,
  "description": "Mốc chốt đơn (thay từ 16h → 17h thí điểm)"
}
```

## 9.3 Credit Limits

### GET /v1/admin/credit-limits
### POST /v1/admin/credit-limits

**Request:**
```json
{
  "customer_id": "uuid",
  "amount": 500000000,
  "from_date": "2026-01-01",
  "to_date": "2026-06-30"
}
```

## 9.4 Deposit Prices (Đơn giá bồi hoàn vỏ)

### GET /v1/admin/deposit-prices
### POST /v1/admin/deposit-prices

## 9.5 Delivery Windows (Khung giờ giao)

### GET /v1/admin/delivery-windows
### POST /v1/admin/delivery-windows

## 9.6 Priority Rules (Ưu tiên xe)

### GET /v1/admin/priority-rules
### POST /v1/admin/priority-rules
### PUT /v1/admin/priority-rules/:id

## 9.7 Forbidden Zones (Giờ cấm tải)

### CRUD /v1/admin/forbidden-zones

---

# 10. NOTIFICATION & WEBSOCKET

## 10.1 REST

### GET /v1/notifications
**Danh sách thông báo** — filter `type`, `read` (true/false)

### GET /v1/notifications/unread-count
**Response:** `{ "data": { "count": 5 } }`

### PUT /v1/notifications/:id/read
**Đánh dấu đã đọc**

### PUT /v1/notifications/read-all
**Đánh dấu tất cả đã đọc**

## 10.2 WebSocket — GPS

```
wss://api.bhl-ops.vn/ws/gps
Auth: ?token=<jwt>
```

**Driver → Server (mỗi 30s):**
```json
{ "type": "gps", "vehicle_id": "uuid", "lat": 20.95, "lng": 107.07, "speed": 40, "heading": 180, "ts": "..." }
```

**Server → Dispatcher (broadcast via Redis pub/sub):**
```json
{ "type": "gps_update", "vehicle_id": "uuid", "lat": 20.95, "lng": 107.07, "status": "in_transit", "stop_index": 3 }
```

## 10.3 WebSocket — Notifications

```
wss://api.bhl-ops.vn/ws/notifications
Auth: ?token=<jwt>
```

**Server → User:**
```json
{ "type": "notification", "id": "uuid", "title": "Đơn #XXX vượt hạn mức", "body": "...", "data": { "order_id": "uuid" } }
```

---

# 11. PUBLIC ENDPOINTS

## 11.1 NPP Confirmation (Zalo link)

### GET /v1/confirm/:token
**Load trang xác nhận** — No auth required (token = auth)

| | |
|-|---|
| Auth | None (token in URL) |
| Rate Limit | 10 req/min per token |

**Response 200:**
```json
{
  "data": {
    "order_number": "SO-20260320-0001",
    "customer_name": "NPP ABC",
    "delivered_at": "2026-03-20T09:15:00Z",
    "items": [
      { "product_name": "Bia Hạ Long chai 450ml", "quantity": 100 },
      { "product_name": "Bia Hạ Long lon 330ml", "quantity": 50 }
    ],
    "expires_at": "2026-03-21T09:15:00Z",
    "already_responded": false
  }
}
```

### POST /v1/confirm/:token
**NPP xác nhận / báo sai lệch**

**Request (xác nhận):**
```json
{ "status": "confirmed" }
```

**Request (sai lệch):**
```json
{
  "status": "disputed",
  "items": [
    { "product_name": "Bia Hạ Long chai 450ml", "expected": 100, "actual": 95, "notes": "Thiếu 5 thùng" }
  ]
}
```

## 11.2 App Version

### GET /v1/app/version
```json
{
  "data": {
    "min_version": "1.0.0",
    "latest_version": "1.0.0",
    "force_update": false
  }
}
```

---

# 12. INTEGRATION WEBHOOKS

## POST /v1/integrations/bravo/webhook
**Bravo → Hệ thống mới** — xác nhận hạch toán

| | |
|-|---|
| Auth | Header `X-Bravo-API-Key` |
| Rate Limit | 100 req/min |

**Request:**
```json
{
  "event": "document_posted",
  "document_id": "BRV-2026-00123",
  "status": "posted",
  "reference_type": "delivery",
  "reference_id": "uuid",
  "posted_at": "2026-03-20T10:00:00Z"
}
```

**Response 200:**
```json
{ "success": true, "message": "acknowledged" }
```

---

# 13. ERROR CODES

| Code | HTTP | Mô tả |
|------|------|-------|
| `VALIDATION_ERROR` | 400 | Input không hợp lệ |
| `UNAUTHORIZED` | 401 | Token missing / expired |
| `FORBIDDEN` | 403 | Không đủ quyền |
| `NOT_FOUND` | 404 | Resource không tồn tại |
| `DUPLICATE_REQUEST` | 409 | Idempotency key trùng |
| `ATP_INSUFFICIENT` | 422 | Tồn kho không đủ (US-OMS-02) |
| `CREDIT_LIMIT_EXCEEDED` | 422 | Vượt hạn mức công nợ (R15) |
| `GATE_CHECK_FAILED` | 422 | Sai lệch tại cổng (R01) |
| `WRONG_LOT_PICKED` | 422 | Pick sai lô, không đúng FEFO |
| `TOKEN_EXPIRED` | 422 | Zalo confirm token hết hạn |
| `TOKEN_ALREADY_USED` | 422 | Zalo confirm token đã dùng |
| `TRANSFER_TIMEOUT` | 422 | CK chưa xác nhận quá timeout |
| `ORDER_NOT_EDITABLE` | 422 | Đơn ở status không cho sửa |
| `TRIP_NOT_CANCELABLE` | 422 | Trip đã in_transit, không hủy |
| `RATE_LIMITED` | 429 | Quá nhiều request |
| `INTERNAL_ERROR` | 500 | Lỗi server |
| `INTEGRATION_ERROR` | 502 | External service (Bravo/DMS/Zalo) lỗi |

---

**=== HẾT TÀI LIỆU API v1.2 ===**

*API Contract Specification v1.2 — 140+ endpoints, RESTful JSON, JWT RS256.*

---

# APPENDIX A — ENDPOINTS MỚI (Session 15-18) [NEW]

> Các endpoints bổ sung sau v1.0 gốc. Đã implement trong code, chưa có trong spec gốc.

## A.1 Order Pending Approvals [NEW — Session 9]

### GET /v1/orders/pending-approvals
**Danh sách đơn chờ duyệt công nợ** — Enriched with credit details + order items

| | |
|-|---|
| Roles | `admin`, `accountant`, `management` |

**Response:** Array of orders with `credit_status: "exceeded"`, kèm `credit_limit`, `current_balance`, `available_limit`, `items[]`

## A.2 Products CRUD [NEW — Session 1]

### GET /v1/products
### GET /v1/products/:id
### POST /v1/products
### PUT /v1/products/:id
### DELETE /v1/products/:id
**CRUD sản phẩm** — Public routes (authenticated, not admin-only like spec 9.1)

| | |
|-|---|
| Roles | `admin`, `dispatcher`, `dvkh` |

## A.3 Customers CRUD [NEW — Session 1]

### GET /v1/customers
### GET /v1/customers/:id
### POST /v1/customers
### PUT /v1/customers/:id
### DELETE /v1/customers/:id
**CRUD khách hàng** — Includes credit info in detail

| | |
|-|---|
| Roles | `admin`, `dispatcher`, `dvkh` |

## A.4 Warehouses [NEW]

### GET /v1/warehouses
**Danh sách kho** — Active warehouses with child locations

## A.5 ATP Batch [NEW — Session 1]

### POST /v1/atp/batch
**Batch ATP check** — Up to 20 products at once

**Request:** `{ "items": [{ "product_id": "uuid", "warehouse_id": "uuid" }] }`

## A.6 Dashboard Stats [NEW — Session 7]

### GET /v1/dashboard/stats
**Dashboard widgets** — 5 metrics: total_orders, total_trips, delivery_rate, revenue, discrepancies

| | |
|-|---|
| Roles | All authenticated roles |

## A.7 Order Timeline & Notes [NEW — Session 17]

### GET /v1/orders/:id/timeline
**Lịch sử sự kiện đơn hàng** — Immutable event log từ bảng `entity_events`

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "event_type": "order.created",
      "title": "Đơn hàng được tạo",
      "actor_name": "Nguyễn Văn A",
      "detail": { "order_number": "SO-20260320-0001" },
      "created_at": "2026-03-20T08:00:00Z"
    }
  ]
}
```

### GET /v1/orders/:id/notes
**Ghi chú nội bộ đơn hàng**

### POST /v1/orders/:id/notes
**Thêm ghi chú nội bộ**

**Request:** `{ "content": "Đã liên hệ KH xác nhận địa chỉ" }`

## A.8 Order Confirmation — Zalo [NEW — Session 15]

> Public endpoints — Token-based auth (không cần JWT)

### GET /v1/order-confirm/:token
**Trang xác nhận đơn hàng từ Zalo** — Hiển thị chi tiết đơn cho KH

### GET /v1/order-confirm/:token/pdf
**Download PDF đơn hàng**

### POST /v1/order-confirm/:token/confirm
**KH xác nhận đơn hàng** — Triggers: tạo shipment + debit entry

### POST /v1/order-confirm/:token/reject
**KH từ chối đơn hàng** — Triggers: hủy đơn + hoàn tồn kho

**Request:** `{ "reason": "Lý do từ chối" }`

**Timeout:** 2 giờ → auto-confirm (cron 5 phút)

## A.9 Admin Slow Queries [NEW — Session 14]

### GET /v1/admin/slow-queries
**Log truy vấn chậm** — pg_stat_statements

### POST /v1/admin/slow-queries/reset
**Reset log truy vấn chậm**

| | |
|-|---|
| Roles | `admin` |

## A.10 Test Portal [NEW — Session 16] (No auth — QA only)

> Development/QA endpoints. Không nên expose trong production.

### GET /v1/test-portal/orders
### GET /v1/test-portal/orders/:id
### GET /v1/test-portal/order-confirmations
### GET /v1/test-portal/delivery-confirmations
### GET /v1/test-portal/stock
### GET /v1/test-portal/credit-balances
### GET /v1/test-portal/customers
### GET /v1/test-portal/products
### POST /v1/test-portal/reset-data
### POST /v1/test-portal/create-test-order
### POST /v1/test-portal/simulate-delivery
### POST /v1/test-portal/run-scenario
### GET /v1/test-portal/zalo-inbox

---

# APPENDIX B — SPEC-ONLY ENDPOINTS (chưa implement)

> Endpoints trong spec gốc nhưng chưa có trong code. Sẽ implement khi cần.

| Endpoint | Status | Ghi chú |
|----------|--------|---------|
| `POST /v1/auth/logout` | Chưa implement | Client tự xóa token |
| `POST /v1/planning/manual-adjust` | Chưa implement | VRP kết quả adjust trực tiếp |
| `GET /v1/trips/:id/timeline` | Chưa implement | Order timeline có, trip chưa |
| `POST /v1/trips/:id/assign` | Chưa implement | VRP tự assign |
| `GET /v1/trips/active-map` | Chưa implement | Dùng GPS WebSocket thay thế |
| `POST /v1/driver/incident` | Chưa implement | Dùng notes thay thế |
| `POST /v1/driver/sync` | Chưa implement | Offline sync chưa triển khai |
| `GET /v1/driver/upload-url` | Chưa implement | Upload trực tiếp qua multipart |
| `GET /v1/assets/ledger-by-customer` | Path khác | Code: `/warehouse/asset-compensation` |
| `GET /v1/assets/outstanding` | Path khác | Code: `/warehouse/asset-compensation/trip/:tripId` |
| `GET /v1/reports/kpi-otd` | Gộp lại | Code: `/kpi/report` trả tất cả metrics |
| `GET /v1/reports/receivable-by-customer` | Chưa implement | Dùng test-portal credit-balances |
| `GET/PUT /v1/admin/configs` | Chưa implement | system_settings quản lý qua SQL |
| `CRUD /v1/admin/credit-limits` | Chưa implement | Quản lý qua SQL seed |
| `CRUD /v1/admin/delivery-windows` | Chưa implement | |
| `CRUD /v1/admin/priority-rules` | Chưa implement | |
| `CRUD /v1/admin/forbidden-zones` | Chưa implement | |
