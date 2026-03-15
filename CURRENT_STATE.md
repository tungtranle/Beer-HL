# CURRENT_STATE — BHL OMS-TMS-WMS

> **Cập nhật:** 15/03/2026 (session 2)  
> **Mục đích:** Mô tả trạng thái THỰC TẾ của hệ thống. AI đọc file này để biết code đang làm gì, **không** phải spec nói gì.  
> **Quy tắc:** Khi code thay đổi → cập nhật file này. Nếu CURRENT_STATE không khớp code → file này sai.

---

## Tổng quan hệ thống

| Component | Tech | Port | Status |
|-----------|------|------|--------|
| Backend API | Go + Gin | :8080 | ✅ Hoạt động |
| Frontend | Next.js 14 + Tailwind | :3000 | ✅ Hoạt động |
| Database | PostgreSQL 16 | :5434 | ✅ 9 migrations applied |
| Cache/PubSub | Redis | :6379 | ✅ GPS + pub/sub |
| VRP Solver | Python + OR-Tools | :8090 | ✅ Hoạt động |
| OSRM Routing | Docker (Vietnam data) | :5000 | ✅ Hoạt động |

---

## Modules & Endpoints (thực tế đang chạy)

### Auth — ✅ Hoàn chỉnh
- POST `/v1/auth/login`, `/v1/auth/refresh`
- RS256 JWT, 6 roles: admin, dispatcher, driver, warehouse_handler, management, accountant
- Test credentials: tất cả password `demo123`

### OMS — ✅ Hoạt động (20 endpoints)
- **Products:** Full CRUD (5 endpoints)
- **Customers:** Full CRUD + credit info (5 endpoints)
- **ATP:** Single + batch check (2 endpoints)
- **Orders:** Create, list, get, update, cancel, approve, split, consolidate (8 endpoints)
- **Cutoff 16h:** Hoạt động — configurable qua `system_settings`
- **Credit limit:** Auto `pending_approval` khi vượt hạn mức
- **DMS sync:** Tự động fire khi tạo/hủy/duyệt đơn (Task 3.4 — async, không block)

### TMS — ✅ Hoạt động (34 endpoints)
- **Vehicles/Drivers:** Full CRUD + availability check
- **VRP:** Run solver, get result, approve plan → tạo trips + stops
- **Shipments:** Pending list + **pending-dates** (dates with pending shipment counts per warehouse)
- **Driver Check-in:** Check-in/out hàng ngày + dispatcher view trạng thái toàn kho
- **Trips:** List, get, update status (dispatcher + driver)
- **Driver flow:** my-trips → checkin → start → update-stop → checklist → ePOD → payment → returns → complete
- **Integration hooks:** Khi ePOD delivered/partial → auto push Bravo + Zalo confirm (Task 3.1, 3.5, 3.6)

### WMS — ✅ Hoạt động (15 endpoints)
- Stock query, inbound + lot management, FEFO picking
- Gate check (R01: 0 variance), barcode scan, expiry alerts, locations
- **Return inbound** (Task 3.12): pending returns list + process return into stock
- **Asset compensation** (Task 3.13): calculate lost asset compensation per BR-WMS-03

### Integration — ✅ Hoạt động (14 endpoints)
- **Bravo:** Push document, webhook, reconcile (mock mode)
- **DMS:** Sync order status (mock mode)
- **Zalo:** Send ZNS, delivery confirmation (mock mode)
- **NPP Portal:** GET/POST confirm/:token (public, no auth)
- **DLQ** (Task 3.8): List, stats, retry, resolve failed integration calls
- **Config:** `INTEGRATION_MOCK=true` → tất cả adapter trả mock data

### Reconciliation — ✅ Hoạt động (9 endpoints) — NEW
- **Auto reconcile trip** (Task 3.9): 3 types per BR-REC-01 (goods, payment, asset)
- **Discrepancy tickets** (Task 3.10): auto-create with T+1 deadline, resolve with notes
- **Daily close summary** (Task 3.11): warehouse-level daily aggregation

### Notification — ✅ Hoạt động (4 endpoints + WS) — NEW
- List, unread count, mark read, mark all read
- WebSocket: `/ws/notifications?token=` for real-time push

### KPI — ✅ Hoạt động (2 endpoints + cron) — NEW
- KPI report with date range + warehouse filter
- Manual snapshot generation
- Daily cron 23:50 ICT for all warehouses

### GPS — ✅ Hoạt động
- REST: Batch upload, get latest positions
- WebSocket: `/ws/gps` (Redis pub/sub)

### Cron Jobs
- Auto-confirm Zalo 24h expired (mỗi 1 giờ)
- Nightly Bravo credit reconcile (mỗi giờ, chỉ chạy lúc 0:00 VN)
- **Daily KPI snapshot** (23:50 ICT, all warehouses) — NEW

### Frontend — 19 pages
- Login, dashboard, orders CRUD, trips + map, products/customers/vehicles/drivers CRUD
- Driver mobile (my-trips, checklist, ePOD, payment, returns)
- PDA scanner (PWA barcode), NPP confirm portal, real-time GPS map

---

## Những thứ KHÁC VỚI spec

| Spec nói | Thực tế code | File spec | Kế hoạch |
|----------|-------------|-----------|----------|
| React Native Expo | Next.js web + PWA (cho demo) | SAD | DEC-001: Native vẫn planned, web bổ sung cho demo |
| Per-module domain files | Single `models.go` | SAD | DEC-002: Giữ nguyên |
| `pkg/apperror/` | `pkg/response/` | ERROR_CATALOGUE | DEC-003: Phase 3 |
| sqlc generated | Raw pgx queries | SAD | DEC-004: Giữ nguyên |
| Ant Design 5.x | Tailwind CSS | UXUI | DEC-005: Giữ nguyên |
| 13 trip statuses (code) | DB enum có 13, code dùng ~8 | STATE_MACHINES | Bổ sung dần theo feature |
| Integration thực (HTTP) | Mock mode mặc định | INT | Chờ BHL IT sandbox |
| zerolog structured | stdlib `log` | SAD | Low priority |

---

## Database: 33+ bảng, 9 migrations

**Migrations applied:** 001_init → 002_checklist → 003_cutoff_consolidation → 004_wms → 005_epod_payment → 006_zalo_confirm → 007_recon_dlq_kpi → 008_audit_log → 009_urgent_priority

**Enums quan trọng (PostgreSQL):**
- `order_status` — 13 states
- `trip_status` — 13 states
- `stop_status` — 7 states
- `zalo_confirm_status` — 5 states
- `payment_status` — 4 states
- `dlq_status` — 4 states (pending, retrying, resolved, failed) — NEW
- `recon_status` — 5 states (pending, matched, discrepancy, resolved, closed) — NEW
- `recon_type` — 3 types (goods, payment, asset) — NEW
- `discrepancy_status` — 5 states (open, investigating, resolved, escalated, closed) — NEW

---

## Domain Models: 37 structs trong `internal/domain/models.go`

Auth (1): User  
OMS (7): Product, Customer, CustomerWithCredit, ATPResult, SalesOrder, OrderItem, Shipment  
TMS (5): Vehicle, Driver, Trip, TripStop, TripChecklist  
VRP (5): VRPJob, VRPResult, VRPTrip, VRPStop, VRPSummary  
WMS (7): StockMove, StockMoveItem, PickingOrder, PickingItem, GateCheck, Lot, StockQuant  
Integration (6): AssetLedgerEntry, ReturnCollection, EPOD, EPODItem, Payment, ZaloConfirmation  
New (6): DLQEntry, Reconciliation, Discrepancy, DailyCloseSummary, Notification, DailyKPISnapshot

---

## Phụ thuộc bên ngoài (chờ BHL IT)

| Hệ thống | Status | Ảnh hưởng |
|-----------|--------|-----------|
| Bravo ERP sandbox | ☐ Chưa có | Integration chạy mock mode |
| DMS API sandbox | ☐ Chưa có | Integration chạy mock mode |
| Zalo OA credentials | ☐ Chưa có | ZNS chạy mock mode |
| PDA hardware model | ☐ Chưa xác nhận | PWA barcode scanner thay thế |

---

## Seed Data Files (dữ liệu test)

| File | Mục đích | Dữ liệu chính |
|------|----------|----------------|
| `seed.sql` | Demo cơ bản | 13 users, 15 SP, 15 KH, 8 xe, 8 TX |
| `seed_full.sql` | Demo đầy đủ | 12 users, 15 SP, 20 KH, 12 xe, 12 TX, 50 đơn, lots, stock_quants, routes, receivable ledger |
| `seed_production.sql` | Production scale | 800 NPP, 70 xe, 70 TX, 30 SP, 500 tuyến, credit limits, asset balances |
| `seed_planning_test.sql` | **Planning page test** | 80 đơn confirmed + 80 shipments pending (50 WH-HL + 30 WH-HP, delivery_date = tomorrow) |
| `seed_test_uat.sql` | UAT driver test | 70 xe, 70 TX, 700 đơn, 70 trips, 5 bảo vệ |
| `seed_comprehensive_test.sql` | **Test toàn diện** | Bổ sung: 19 quản lý (3 BGĐ + 8 trưởng vùng + 8 giám sát), 11 thủ kho, 6 bảo vệ, 8 DVKH+dispatcher+KT, 12 TX phụ, 12 xe phụ, 60+ lots, 80+ stock quants (2 kho), 15 system settings, receivable ledger 800 NPP |

**Thứ tự chạy khuyến nghị:**
1. `seed_full.sql` (dữ liệu demo cơ bản)
2. `seed_production.sql` (scale lên 800 NPP, 70 xe+TX, 30 SP)
3. `seed_comprehensive_test.sql` (bổ sung quản lý, thủ kho, 12 xe/TX phụ, lots, tồn kho)
4. `seed_test_uat.sql` (tạo 700 đơn + 70 trips cho UAT)
5. `seed_planning_test.sql` (tạo 80 pending shipments cho planning page)

**Tổng sau khi chạy đầy đủ:**
- Users: ~120+ (admin 1, management 19, dispatcher 4, accountant 4, dvkh 7, warehouse_handler 11, security 6, driver 82)
- Vehicles: 82 (48 WH-HL + 36 WH-HP, mix 3.5t/5t/8t/15t)
- Drivers: 82 (tất cả có user account, license B2/C)
- Products: 30 SKU (bia lon, bia chai, bia cao cấp, bia tươi, NGK, vỏ chai/két/keg)
- Customers: 800 NPP (8 tỉnh: QN, HP, HD, BN, TB, ND, LS, BG)
- Routes: 500 (50 chính + 450 phụ)
- Lots: 60+ (2-3 lô/SP, hỗ trợ FEFO)
- Stock quants: 80+ entries (đầy đủ tồn kho 2 kho)
- System settings: 16

---

*Cập nhật file này mỗi khi: thêm endpoint mới, thêm migration, thêm/sửa module, thay đổi cấu trúc.*
