# CHANGELOG — BHL OMS-TMS-WMS

> Track actual code changes vs spec. Updated after each task completion.  
> **Quy tắc:** Mỗi entry phải có section "Docs Updated" liệt kê file docs đã cập nhật.

---

## [Unreleased] — Phase 4 in progress

### 2026-03-15 — Session 5: Urgent Priority & Order Timestamps

#### Added
- **Urgent delivery priority field** — `is_urgent` boolean on shipments
  - Migration `009_urgent_priority.up.sql` adds `is_urgent BOOLEAN NOT NULL DEFAULT false` + index
  - Toggle endpoint `PUT /v1/shipments/:id/urgent` (admin/dispatcher only)
  - Frontend: ⚡ icon button to toggle urgent per shipment in Step 2
  - Urgent shipments highlighted with red background row
  - Summary badge "⚡ N đơn gấp" in Step 2 header
  - 85 demo shipments seeded as urgent
- **Order timestamps in shipment list** — Step 2 table
  - "Đặt hàng" column shows `sales_orders.created_at`
  - "Xác nhận" column shows `sales_orders.approved_at`
  - Vietnamese-formatted date/time (dd/mm HH:mm)
- **Priority-aware sorting** — shipments list
  - Backend sorts: urgent first → then by order creation time ASC → then route code/customer name
  - Dispatchers can visually identify and prioritize urgent orders

#### Changed
- **Shipment domain model** — `internal/domain/models.go`
  - Added fields: `IsUrgent`, `CreatedAt`, `OrderCreatedAt`, `OrderConfirmedAt`
- **ListPendingShipments query** — `internal/tms/repository.go`
  - Now JOINs `sales_orders` table for timestamps
  - Sorts by `is_urgent DESC, o.created_at ASC`
- **Frontend Shipment interface** — added `is_urgent`, `created_at`, `order_created_at`, `order_confirmed_at`

**Docs Updated:** CHANGELOG.md, CURRENT_STATE.md, DBS_BHL_OMS_TMS_WMS.md, API_BHL_OMS_TMS_WMS.md

### 2026-03-15 — Session 4: Trip Modal Enhancements + VRP UX Improvements

#### Changed
- **Trip Detail Modal — OSRM road routing** — `web/src/app/dashboard/planning/page.tsx`
  - Uses OSRM public API (`router.project-osrm.org`) for actual road-following routes instead of straight lines
  - Leg-by-leg distances shown between each stop (Kho→#1: X km ~Y phút)
  - Return leg to depot shown in green with "(về kho)" label
  - Loading indicator while OSRM route loads
  - Fallback to straight-line polyline if OSRM fails
- **Trip Detail Modal — Fullscreen toggle**
  - Added ⊞/⊡ button to expand modal to fullscreen or collapse back
  - Map resizes correctly on toggle via `invalidateSize()`
- **Trip Detail Modal — Overlapping marker fix**
  - Co-located stops (same customer, multiple shipments) now get small coordinate offsets
  - All markers visible even when multiple stops share same GPS coordinates
- **VRP optimization criteria panel** — Step 3 pre-run screen
  - Shows 6 optimization criteria: min distance, capacity limits, 8h time window, depot round-trip, min vehicles, cluster by zone
  - Auto-limit info when vehicles > available drivers
- **Auto-limit vehicles to driver count** — `runVRP()` function
  - When selected vehicles > available drivers, VRP only sends min(vehicles, drivers) vehicle IDs
  - Warning displayed in criteria panel
- **Overload UX improvement** — Unassigned shipments section
  - Actionable buttons: "Quay bước 2 — Thêm xe", "Quay bước 3 — Bớt đơn hàng", "Chạy lại VRP"
  - Expandable list showing all unassigned shipments with details
- **Vehicle Status Dashboard Modal** — Click vehicle count on dashboard
  - Shows all vehicles grouped by status (active/maintenance/broken/impounded)
  - Vehicle details: plate number, type, capacity
- **Driver Status Dashboard Modal** — Click driver count on dashboard
  - Shows all drivers grouped by check-in status (available/on_trip/off_duty/not_checked_in)
  - Click individual driver opens profile with phone number and call button
- **Customer GPS coordinates fixed** — All 800 customers relocated to verified on-land coordinates
  - Quảng Ninh: Hạ Long city, Cẩm Phả, Đông Triều, Uông Bí, Quảng Yên
  - Hải Phòng: Hải An, Kiến An, Lê Chân
  - Addresses and provinces updated to match actual coordinate locations
- **Vehicle status variety** — Added maintenance (3), broken (2), impounded (1) vehicles for demo realism

#### Database
- `migrations/fix_customer_coords.sql` — Updated all customer GPS to on-land bounding boxes
- `migrations/fix_addresses_vehicles.sql` — Fixed customer addresses/provinces, added vehicle status variety

#### Docs Updated
- CHANGELOG.md (this file)

### 2026-03-15 — Session 3: Planning Page UX Redesign + Load Test Data

#### Changed
- **Planning page completely redesigned** — `web/src/app/dashboard/planning/page.tsx`
  - **5-step wizard workflow**: Tổng quan → Chọn xe → Xem đơn → Tối ưu VRP → Duyệt & Tạo chuyến
  - Step 0 (Tổng quan): Resource cards (shipments/vehicles/drivers), capacity comparison bars, estimates, warnings
  - Step 1 (Chọn xe): Vehicle selection with checkboxes grouped by vehicle type, capacity vs demand comparison
  - Step 2 (Xem đơn): Shipment list with exclude/include toggle, live total recalculation
  - Step 3 (Tối ưu VRP): Pre-run summary, progress animation, KPI dashboard, drag-drop trip adjustment
  - Step 4 (Duyệt): Driver assignment with conflict detection, final summary, approve button
  - Step indicator with clickable progress bar (green=done, amber=current, gray=future)
  - Capacity overload warnings and status indicators throughout
  - **Auto-detect delivery date**: Fetches pending dates from API, auto-selects first date with data
  - **Quick date picker**: Shows buttons for all dates with pending shipments
  - **Driver availability warning** in Step 1: Warns when selected vehicles exceed available drivers
  - **Pre-validation before VRP**: Checks warehouse, date, shipments, and vehicle selection before calling API

- **API error handling improved** — `web/src/lib/api.ts`
  - `apiFetch` now catches non-JSON responses (e.g., 500 "Internal Server Error") gracefully
  - Shows user-friendly "Server trả về lỗi {status}" instead of "Unexpected token" crash

#### Added
- **New API endpoint**: `GET /v1/shipments/pending-dates?warehouse_id=UUID`
  - Returns delivery dates with pending shipment counts and total weight per date
  - Used by planning page to auto-detect correct delivery date

- **Driver Check-in Feature** — Daily availability management
  - **Migration 009**: `driver_checkins` table with UPSERT per (driver_id, date)
  - **Driver API**: `POST /v1/driver/checkin` (available/off_duty + reason) + `GET /v1/driver/checkin` (today's status)
  - **Dispatcher API**: `GET /v1/drivers/checkins?warehouse_id=UUID&date=YYYY-MM-DD`
    - Returns all drivers with combined status: 🟢 available, 🔵 on_trip, 🔴 off_duty, 🟡 not_checked_in
  - **Driver page UI** (`web/src/app/dashboard/driver/page.tsx`): Check-in banner with "Sẵn sàng" / "Hôm nay nghỉ" buttons
  - **Planning page** Step 0: Shows driver check-in breakdown (available/on_trip/off_duty/not_checked_in)

#### Data
- Updated ~500 shipments to `pending` status for delivery_date 2026-03-16
  - WH-HL: 400 pending shipments
  - WH-HP: 180 pending shipments
  - Total pending: 584 shipments for load testing the planning feature

#### Docs Updated
- CHANGELOG.md — this entry

---

### 2026-03-15 — Session 2: Tasks 4.8–4.10 + Comprehensive Test Data

#### Added
- **Comprehensive test seed data** — `migrations/seed_comprehensive_test.sql`
  - 19 management staff: 3 Ban Giám đốc (Phó GĐ KD, Phó GĐ SX, KT trưởng) + 8 Trưởng vùng (1/tỉnh) + 8 Giám sát khu vực
  - 11 warehouse handlers: Trưởng kho + 2-3 thủ kho + 2 soạn hàng × 2 kho (WH-HL, WH-HP)
  - 6 bảo vệ (security guards): 3/kho, cho gate check
  - 8 bổ sung: 2 dispatcher, 2 kế toán, 4 DVKH
  - 12 tài xế phụ trợ (driver71-82) + 12 xe phụ trợ → tổng 82 xe, 82 tài xế
  - 60+ lots (2-3 lô/SP, hỗ trợ FEFO: 1 sắp hết hạn + 1 mới + 1 rất mới)
  - 80+ stock quants cho 30 SP × 2 kho (Hạ Long + Hải Phòng)
  - 16 system settings (company info, VAT, auto-approve threshold, alert configs…)
  - Receivable ledger cho ~60% NPP (khởi tạo công nợ)

- **UAT test scripts** (Tasks 4.8-4.10) — already existed from previous session
  - Driver test: 12 test cases (docs/UAT_DRIVER_TEST.md)
  - Accountant test: 10 test cases (docs/UAT_ACCOUNTANT_TEST.md)
  - Warehouse test: 8 test cases (docs/UAT_WAREHOUSE_TEST.md) — updated with correct accounts

#### Changed
- Updated UAT_WAREHOUSE_TEST.md with correct warehouse handler accounts (truongkho_hl, thukho_hl01-03, soanhang_hl01-02, baove_hl01-03)
- CURRENT_STATE.md: Fixed migration count 7→8, added seed data summary section
- TASK_TRACKER.md: 60→63 done (80.8%), Phase 4: 7→10/20 (50%)

#### Docs Updated
- CURRENT_STATE.md — migration count, seed data section
- TASK_TRACKER.md — 4.8-4.10 ☑, counters updated to 63/78
- CHANGELOG.md — this entry
- UAT_WAREHOUSE_TEST.md — correct test accounts
- repo memory — updated

---

### 2026-03-15 — Session 1: Tasks 3.18–3.20, 4.1–4.7

#### Added
- **Reconciliation UI** (Task 3.18) — `web/src/app/dashboard/reconciliation/page.tsx`
  - 3 tabs: Đối soát (reconciliations), Sai lệch (discrepancies), Chốt ngày (daily close)
  - Status filter, inline resolve discrepancy, generate daily close button
  - Added to sidebar navigation for admin/accountant roles

- **App version check** (Task 3.19) — `GET /v1/app/version`
  - Public endpoint (no auth), returns current_version, minimum_version, force_update
  - For mobile/PWA client version gating

- **Audit log middleware** (Task 3.20) — `internal/middleware/audit.go`
  - Logs all POST/PUT/PATCH/DELETE requests to `audit_logs` table
  - Captures user_id, method, path, status_code, duration_ms, IP, body (2KB limit)
  - Async DB insert to avoid blocking responses
  - Migration 008: `audit_logs` table with indexes

- **Production seed data** (Tasks 4.1-4.6) — `migrations/seed_production.sql`
  - 800 NPP customers across 8 provinces (QN, HP, HD, BN, TB, ND, LS, BG)
  - 82 vehicles (40 WH-HL, 30+ WH-HP) with 4 truck types
  - 79 drivers with user accounts (demo123), license numbers
  - 30 products (bia lon, bia chai, bia cao cấp, bia đặc biệt, NGK, vỏ chai/két/keg)
  - 500 delivery routes (50 main + 450 seasonal sub-routes)
  - Credit limits for all 800 NPPs (100M-800M per NPP)
  - 1,702 asset ledger entries (bottle/crate/keg initial balances)

- **UAT Dispatcher test script** (Task 4.7) — `docs/UAT_DISPATCHER_TEST.md`
  - 10 test cases covering full dispatcher workflow
  - Covers login, orders, VRP, trips, GPS, master data, reconciliation, version, audit

#### Changed
- Applied missing migrations 004 (WMS), 005 (ePOD+payments), 006 (Zalo confirm) to dev DB

#### Database
- Migration 008: `audit_logs` table
- Applied migrations 004-008 all verified

#### Docs Updated
- TASK_TRACKER.md — 3.18-3.20 ☑, 4.1-4.7 ☑, Phase 3 100%, Phase 4 35%, total 60/78 (76.9%)
- CHANGELOG.md — this entry
- repo memory — updated

---

## [Unreleased] — Phase 3 complete

### 2026-03-15 — Session: Tasks 3.8–3.17 backend complete

#### Added
- **Integration DLQ** (Task 3.8) — `internal/integration/dlq.go`
  - Dead letter queue for failed Bravo/DMS/Zalo calls
  - Record, List, Retry, Resolve, Stats endpoints
  - Auto-recording in hooks.go on adapter failures

- **Reconciliation module** (Tasks 3.9-3.11) — `internal/reconciliation/`
  - Auto-reconcile trip: 3 types (goods, payment, asset) per BR-REC-01
  - Discrepancy tickets with T+1 deadline auto-creation
  - Daily close summary generation with warehouse-level aggregation
  - Full handler/service/repository per coding standards

- **WMS return inbound** (Task 3.12)
  - Process good-condition returns back into stock
  - `GET /warehouse/returns/pending` + `POST /warehouse/returns/inbound`

- **WMS asset compensation** (Task 3.13) — per BR-WMS-03
  - Calculate lost asset compensation: qty_lost × asset_price
  - `GET /warehouse/asset-compensation` + `/trip/:tripId`

- **Notification module** (Task 3.14) — `internal/notification/`
  - WebSocket hub for real-time notification push
  - REST: list, unread count, mark read, mark all read
  - `ws://host/ws/notifications?token=` endpoint

- **Dashboard 5 widgets** (Task 3.15)
  - Orders today, active trips, delivery rate, revenue, pending discrepancies
  - Plus: confirmed orders, completed trips today, pending shipments

- **KPI module** (Tasks 3.16-3.17) — `internal/kpi/`
  - KPI report endpoint with date range + warehouse filter
  - Manual snapshot generation endpoint
  - Daily cron at 23:50 ICT for all warehouses
  - 6 KPI metrics: OTD rate, delivery success, vehicle utilization, revenue, recon match rate, discrepancies

- **Migration 007** — `007_recon_dlq_kpi.up.sql`
  - Tables: integration_dlq, reconciliations, discrepancies, daily_close_summaries, notifications, daily_kpi_snapshots
  - Enums: dlq_status, recon_status, recon_type, discrepancy_status

- **Domain models** — 6 new structs in models.go
  - DLQEntry, Reconciliation, Discrepancy, DailyCloseSummary, Notification, DailyKPISnapshot

#### Docs Updated
- TASK_TRACKER.md — ☑ Tasks 3.8-3.17 marked complete (50/78, 64.1%)
- CHANGELOG.md — ✅ This entry

---

### 2026-03-15 — Session: Tasks 3.1–3.7 integration wiring

#### Added
- **Integration hooks module** (`internal/integration/hooks.go`)
  - `OnDeliveryCompleted()` — auto push Bravo + Zalo confirm khi ePOD delivered
  - `OnOrderStatusChanged()` — auto sync DMS khi order status thay đổi
  - `BuildDeliveryEvent()` — query DB tự động build event data
  - `RunNightlyReconcileCron()` — Bravo credit reconcile mỗi đêm (0:00 VN)

- **OMS ← Integration wiring** (Task 3.4)
  - `oms.Service.SetIntegrationHooks()` — inject hooks
  - DMS sync fires on CreateOrder, CancelOrder, ApproveOrder

- **TMS ← Integration wiring** (Tasks 3.1, 3.5, 3.6)
  - `tms.Service.SetIntegrationHooks()` — inject hooks
  - ePOD delivered/partial → auto Bravo push + Zalo confirm

- **Nightly reconcile cron** (Task 3.2)
  - Goroutine chạy mỗi giờ, execute lúc 0:00 VN
  - Query all active customers → reconcile với Bravo

#### Docs Updated
- CURRENT_STATE.md — ✅ Tạo mới (trạng thái thực tế toàn bộ hệ thống)
- TECH_DEBT.md — ✅ Tạo mới (10 mục nợ kỹ thuật)
- TASK_TRACKER.md — ✅ Ghi integration wiring complete
- CHANGELOG.md — ✅ Entry này
- .github/instructions/doc-update-rules.instructions.md — ✅ Tạo mới

---

### 2026-03-15 — Session: Tasks 2.11–3.7 (adapters + driver features)

#### Added
- **ePOD + Payment + Returns** (Tasks 2.11-2.13)
  - EPOD submission with delivered items, signature, photos
  - Payment recording (cash, transfer, credit, cod)
  - Return collection (bottles, crates, kegs) + asset ledger
  - Migration `005_epod_payment.up.sql`

- **GPS + Offline + PDA** (Tasks 2.14-2.16)
  - GPS background tracker (`useGpsTracker` hook)
  - Offline sync queue (IndexedDB via `useOfflineSync`)
  - PWA barcode scanner page

- **Dispatcher GPS map** (Task 2.17)
  - Leaflet + WebSocket real-time vehicle markers

- **Integration adapters** (Tasks 3.1-3.5)
  - Bravo adapter: push document, get credit balances, nightly reconcile, webhook handler
  - DMS adapter: push order status
  - Zalo adapter: send ZNS, send delivery confirmation
  - All adapters support mock mode (`INTEGRATION_MOCK=true`)

- **NPP Portal + Auto-confirm** (Tasks 3.6-3.7)
  - Confirm page: `/confirm/[token]` (public, no auth)
  - ConfirmService: send confirmation, confirm/dispute, auto-confirm 24h
  - Migration `006_zalo_confirm.up.sql`
  - Auto-confirm cron (every 1 hour)

---

### 2026-03-15 — Session: Tasks 1.3, 1.14, 1.17–1.19, 2.1–2.10

#### Added
- **OSRM Docker + Vietnam data** (Task 1.18)
  - OSRM service in docker-compose.yml with healthcheck
  - `setup-osrm.ps1` for Vietnam OSM data download
  - VRP solver OSRM integration (distance matrix + duration)
  - `/status` endpoint on VRP solver

- **VRP benchmark** (Task 1.19)
  - `vrp-solver/benchmark_vrp.py` — 1,000 orders stress test
  - Makefile `benchmark` target

- **WMS Module** (Tasks 2.1–2.6)
  - Migration `004_wms.up.sql` — 7 enums, 5 tables, 2 table ALTERs
  - `internal/wms/` — repository.go, service.go, handler.go (13 endpoints)
  - Inbound + lot management, FEFO/FIFO picking
  - Gate check (R01 compliance), barcode scan API
  - Expiry alert, location hierarchy (LTREE)

- **Driver Web Pages** (Tasks 2.7–2.8)
  - `web/src/app/dashboard/driver/[id]/page.tsx` — trip detail + actions
  - Start trip, update stops (arrived/delivered/failed), complete trip

- **CI/CD** (Task 1.3)
  - `.github/workflows/ci.yml` — 5-job pipeline

- **OMS Enhancements** (Task 1.14)
  - Cutoff 16h, consolidation/split
  - Migration `003_cutoff_consolidation.up.sql`

- **GPS WebSocket** (Task 1.17)
  - `internal/gps/` — hub.go + handler.go
  - Redis pub/sub for GPS positions

#### Spec Deviations (from docs/specs/)
- **Trip status:** Code has ~6 statuses (created, assigned, in_transit, completed, cancelled). Spec has 13 (SM-02). Will align in Phase 3.
- **Stop status:** Code uses simplified flow (pending → arrived → delivered/failed). Spec has delivering/partial/re_delivery. Will align in tasks 2.11+.
- **Error codes:** Code uses `pkg/response/` simple errors. ERROR_CATALOGUE defines structured codes. Will migrate gradually.
- **Logger:** Code uses `log` stdlib. Spec recommends `zerolog`. Low priority.

---

## [0.1.0] — Demo Build (pre-task-tracker)

### Added
- Docker Compose (postgres, redis, vrp)
- Auth (JWT RS256, login, refresh, RBAC middleware)
- OMS CRUD (orders, products, customers, shipments, ATP, credit)
- TMS (trips, drivers, vehicles, VRP planning)
- Next.js frontend (login, dashboard, 10+ pages)
- Seed data (8 drivers, 20+ customers, products, vehicles)
