# DEMO SPRINT PLAN — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Mục tiêu | **Demo 2 tính năng cho khách hàng BHL** |
| Ngày tạo | 2025 |

---

# 1. TÍNH NĂNG DEMO

## 1.1 Feature 1: OMS — Quản lý Đơn hàng + ATP

| Chức năng | Mô tả |
|-----------|-------|
| Tạo đơn hàng | DVKH/Dispatcher nhập đơn cho NPP |
| Kiểm tra ATP | Real-time check tồn kho khả dụng (Available-To-Promise) |
| Kiểm tra hạn mức | Credit limit check → auto pending_approval nếu vượt |
| Danh sách đơn | Filter theo status, ngày, khách hàng |
| Duyệt đơn vượt hạn mức | Kế toán approve/reject |

## 1.2 Feature 2: TMS — Lập kế hoạch VRP + Trip View

| Chức năng | Mô tả |
|-----------|-------|
| Chạy VRP solver | AI tối ưu tuyến đường (Google OR-Tools) |
| Xem kết quả VRP | Danh sách trips, stops, khoảng cách, thời gian |
| Duyệt kế hoạch | Gán xe + tài xế cho trip |
| Bản đồ trips | Hiển thị routes trên Leaflet map |
| Danh sách trips | Filter theo ngày, trạng thái, xe |

## 1.3 Demo Flow

```
Login (Dispatcher)
  → Dashboard (thống kê tổng quan)
  → Tạo đơn hàng (chọn KH, SP → hiện ATP real-time)
  → Xem danh sách đơn (filter confirmed)
  → Chạy VRP (chọn ngày giao → solver tối ưu)
  → Xem kết quả VRP (trips + bản đồ routes)
  → Duyệt kế hoạch (gán xe + tài xế)
  → Xem chi tiết trip (stops, timeline)
```

---

# 2. KIẾN TRÚC DEMO

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js 14  │────▶│   Go + Gin   │────▶│ VRP Solver   │
│  :3000       │     │   :8080      │     │ Python :8090 │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                   ┌────────┼────────┐
                   │        │        │
              ┌────┴───┐ ┌──┴──┐ ┌──┴───┐
              │ PG 16  │ │Redis│ │ OSRM │
              │ :5432  │ │:6379│ │ :5000│
              └────────┘ └─────┘ └──────┘
```

---

# 3. TASK BREAKDOWN

## Phase 0: Foundation (D0)

| ID | Task | Ước lượng |
|----|------|-----------|
| D0.1 | Go project scaffold (go.mod, main.go, config) | 30 min |
| D0.2 | Docker Compose (Go + PG + Redis + OSRM + VRP) | 30 min |
| D0.3 | DB migration (demo subset: 15 tables) | 45 min |
| D0.4 | JWT RS256 Auth (login/refresh/middleware) | 45 min |
| D0.5 | Seed data (users, products, customers, stock, vehicles) | 30 min |
| D0.6 | Common response helpers, error handling | 20 min |

## Phase 1: OMS (D1)

| ID | Task | Ước lượng |
|----|------|-----------|
| D1.1 | Products API (GET list, search) | 20 min |
| D1.2 | Customers API (GET list, search, credit info) | 20 min |
| D1.3 | Orders CRUD (POST/GET/PUT + cancel + approve) | 60 min |
| D1.4 | ATP Service (stock check, reserve on order) | 45 min |
| D1.5 | Credit Limit Check (receivable_ledger query) | 30 min |

## Phase 2: TMS (D2)

| ID | Task | Ước lượng |
|----|------|-----------|
| D2.1 | VRP Python solver (OR-Tools + OSRM matrix) | 60 min |
| D2.2 | Planning API (run-vrp → async job → poll result) | 45 min |
| D2.3 | Approve plan → create trips in DB | 30 min |
| D2.4 | Trips API (list, detail, stops) | 30 min |

## Phase 3: Frontend (D3)

| ID | Task | Ước lượng |
|----|------|-----------|
| D3.1 | Next.js scaffold + Tailwind + layout + sidebar | 30 min |
| D3.2 | Login page | 20 min |
| D3.3 | Dashboard (summary cards) | 20 min |
| D3.4 | Orders list page (table + filter) | 30 min |
| D3.5 | Create order page (form + ATP real-time) | 45 min |
| D3.6 | Planning page (run VRP + results table) | 30 min |
| D3.7 | Trip detail + Leaflet map visualization | 45 min |

---

# 4. BẢNG CẦN THIẾT (15 tables)

| # | Table | Module |
|---|-------|--------|
| 1 | users | Auth |
| 2 | products | Master |
| 3 | customers | Master |
| 4 | credit_limits | Master |
| 5 | warehouses | Master |
| 6 | vehicles | Master |
| 7 | drivers | Master |
| 8 | delivery_routes | Master |
| 9 | sales_orders | OMS |
| 10 | order_items | OMS |
| 11 | shipments | OMS→TMS |
| 12 | lots | WMS (ATP) |
| 13 | stock_quants | WMS (ATP) |
| 14 | trips | TMS |
| 15 | trip_stops | TMS |
| 16 | receivable_ledger | Finance |

---

# 5. SEED DATA

| Entity | Records | Mô tả |
|--------|---------|-------|
| users | 5 | admin, dvkh, dispatcher, accountant, driver |
| products | 20 | Bia Hạ Long các loại (lon, chai, thùng) |
| customers | 15 | NPP Quảng Ninh, Hải Phòng, Hà Nội |
| warehouses | 2 | Kho Hạ Long (chính), Kho Hải Phòng |
| vehicles | 8 | Xe tải 3.5T, 5T, 8T |
| drivers | 8 | Tài xế gán cho từng xe |
| stock_quants | 40 | Tồn kho demo (~500-2000 thùng/SP) |
| credit_limits | 15 | 200-800 triệu/NPP |

---

# 6. TIÊU CHÍ DEMO THÀNH CÔNG

- [ ] Login với tài khoản dispatcher
- [ ] Tạo đơn hàng → hiện ATP real-time khi chọn sản phẩm
- [ ] Đơn vượt hạn mức → auto chuyển pending_approval
- [ ] Login kế toán → duyệt đơn vượt hạn mức
- [ ] Chạy VRP → hiện kết quả tối ưu với N trips
- [ ] Bản đồ hiển thị routes (warehouse→stop1→stop2→...→warehouse)
- [ ] Duyệt kế hoạch → tạo trips chính thức
- [ ] Xem chi tiết trip (stops, thời gian ước tính, khối lượng)
