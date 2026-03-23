# CURRENT_STATE — BHL OMS-TMS-WMS

> **Cập nhật:** 22/03/2026 (session 22/03 — UX Overhaul v4 + Audit + Re-delivery fix + OrderTimeline redesign)  
> **Mục đích:** Mô tả trạng thái THỰC TẾ của hệ thống. AI đọc file này để biết code đang làm gì, **không** phải spec nói gì.  
> **Quy tắc:** Khi code thay đổi → cập nhật file này. Nếu CURRENT_STATE không khớp code → file này sai.

---

## Tổng quan hệ thống

| Component | Tech | Port | Status |
|-----------|------|------|--------|
| Backend API | Go + Gin | :8083 | ✅ Hoạt động (port 8083 từ session 22/03) |
| Frontend | Next.js 14 + Tailwind | :3005 | ✅ Hoạt động (port 3005 từ session 22/03) |
| Database | PostgreSQL 16 | :5434 | ✅ 17 migration files (001-014, two 009s, three 010s) |
| Cache/PubSub | Redis | :6379 | ✅ GPS + pub/sub |
| VRP Solver | Python + OR-Tools | :8090 | ✅ Hoạt động |
| OSRM Routing | Docker (Vietnam data) | :5000 | ⚠️ Cần setup data (./setup-osrm.ps1) |
| Mock Server | Go (Bravo/DMS/Zalo) | :9001-9003 | ✅ Optional — `go run cmd/mock_server/main.go` |
| Prometheus | Docker | :9090 | ✅ Configured (profile: monitoring) |
| Grafana | Docker | :3030 | ✅ Configured (profile: monitoring) |

---

## Modules & Endpoints (thực tế đang chạy)

### Auth — ✅ Hoàn chỉnh
- POST `/v1/auth/login`, `/v1/auth/refresh`
- RS256 JWT, 9 roles: admin, dispatcher, driver, warehouse_handler, management, accountant, dvkh, security, workshop
- Test credentials: tất cả password `demo123`

### Admin — ✅ Hoạt động (16 endpoints) — Updated Phase 6
- **Quản lý người dùng:** List, Get, Create, Update, Delete (soft), Reset password (6 endpoints)
- **Danh sách quyền:** List roles + default permissions (1 endpoint) — includes workshop role
- **DB monitoring:** GET `/admin/slow-queries`, POST `/admin/slow-queries/reset` (2 endpoints)
- **System Health (Enhanced):** GET `/admin/health` — PostgreSQL, Redis, VRP Solver checks + GPS tracking stats + recent operations
- **Routes CRUD:** GET/POST/PUT/DELETE `/admin/routes` (4 endpoints)
- **Config + Credit:** configs, credit-limits, audit-logs
- **Credit limit expiry (MỚI Phase 6):** GET `/admin/credit-limits/expiring` — limits expiring within 7 days
- **App version:** GET `/v1/app/version` (1 endpoint)
- Chỉ admin mới truy cập được (trừ app/version)
- Frontend: `/dashboard/settings` — Quản trị hệ thống
- Frontend: `/dashboard/settings/health` — System Health & Monitoring dashboard

### OMS — ✅ Hoạt động (32 endpoints)
- **Products:** Full CRUD (5 endpoints)
- **Customers:** Full CRUD + credit info (5 endpoints)
- **ATP:** Single + batch check (2 endpoints)
- **Orders:** Create, list, get, update, cancel, approve, split, consolidate, **search**, **pending-approvals** (10 endpoints)
- **Giao bổ sung (CẬP NHẬT Session 22/03):** POST `/v1/orders/:id/redelivery`, GET `/v1/orders/:id/delivery-attempts` (2 endpoints)
  - Chỉ cho phép từ `partially_delivered` hoặc `failed` (đã bỏ rejected/delivered — user nên hủy đơn và tạo mới)
  - Frontend: nút "📦 Giao bổ sung" (brand color #F68634), context message theo trạng thái
  - Backend: tăng `re_delivery_count`, tạo shipment mới, reset order về `confirmed`
  - Tracking delivery attempts: attempt_number, previous_status, previous_reason
- **Dashboard stats:** GET `/v1/dashboard/stats` — 5 widget metrics (orders, trips, delivery rate, revenue, discrepancies)
- **Control desk stats:** `GetControlDeskStats(warehouseID?)` (1 endpoint)
- **Cutoff 16h:** Hoạt động — configurable qua `system_settings`
- **Credit limit:** Auto `pending_approval` khi vượt hạn mức — **enriched endpoint with credit details + order items**
- **DMS sync:** Tự động fire khi tạo/hủy/duyệt đơn (Task 3.4 — async, không block)
- **Zalo Order Confirmation (MỚI Session 15):**
  - Sau khi DVKH tạo đơn → Zalo ZNS gửi cho khách hàng (PDF link + nút xác nhận)
  - Trạng thái: `draft → pending_customer_confirm → confirmed` 
  - Hạn xác nhận: 2 giờ → auto-confirm (cron 5 phút)
  - KH xác nhận → tạo shipment + debit entry
  - KH từ chối → hủy đơn + hoàn tồn kho
  - Public endpoints: `/v1/order-confirm/:token` (GET view, GET /pdf, POST /confirm, POST /reject)

### OMS bổ sung — ✅ Hoạt động
- **Warehouses:** GET `/v1/warehouses` (1 endpoint)
- **Dashboard stats:** GET `/v1/dashboard/stats` — 5 widget metrics (orders, trips, delivery rate, revenue, discrepancies)

### TMS — ✅ Hoạt động (50+ endpoints) — Updated Session 22/03
- **Vehicles/Drivers:** Full CRUD + availability check
- **Vehicle Documents (MỚI Session 18):** CRUD + expiry alerts (5 endpoints)
  - GET/POST/PUT/DELETE `/v1/vehicles/:id/documents`, GET `/v1/vehicles/expiring-documents`
  - doc_type: registration, inspection, insurance + expiry_date tracking
- **Driver Documents (MỚI Session 18):** CRUD + expiry alerts (5 endpoints)
  - GET/POST/PUT/DELETE `/v1/drivers/:id/documents`, GET `/v1/drivers/expiring-documents`
  - doc_type: license (with license_class B2/C/D/E), health_check + expiry_date tracking
- **VRP:** Run solver, get result, approve plan → tạo trips + stops
- **Shipments:** Pending list + **pending-dates** (dates with pending shipment counts per warehouse) + **urgent toggle**
- **Driver Check-in:** Check-in/out hàng ngày + dispatcher view trạng thái toàn kho
- **Trips:** List, get, update status (dispatcher + driver)
- **Driver flow:** my-trips → checkin → start → update-stop (arrive/delivering/deliver/fail/skip) → checklist → ePOD → payment → returns → complete
- **Stop actions:** arrive, delivering, deliver, fail, skip — Session 11 (added "delivering" intermediate step)
- **StartTrip (CẬP NHẬT Session 22/03):** Khi tài xế bắt đầu chuyến → tự động cập nhật tất cả đơn hàng sang `in_transit` + ghi event `order.in_transit`
- **CompleteTrip (SỬa BUG Session 22/03):** Sửa lỗi stop status `partially_delivered` không được chấp nhận → đã thêm vào terminal statuses. Ghi event `order.status_changed` cho mỗi đơn.
- **Integration hooks:** Khi ePOD delivered/partial → auto push Bravo + Zalo confirm (Task 3.1, 3.5, 3.6)

### WMS — ✅ Hoạt động (28 endpoints) — Updated Session 22/03
- Stock query, inbound + lot management, FEFO picking
- Gate check (R01: 0 variance), barcode scan, expiry alerts, locations
- **Return inbound** (Task 3.12): pending returns list + process return into stock
- **Asset compensation** (Task 3.13): calculate lost asset compensation per BR-WMS-03
- **Gate check queue (MỚI Phase 6):** GET `/warehouse/gate-check-queue` — trips pending gate check today
- **Bottle classification (MỚI Phase 6):** POST `/warehouse/bottles/classify`, GET `/warehouse/bottles/summary` — phân loại vỏ tốt/hỏng/mất per trip
- **Picking by Vehicle (MỚI UX v5):** GET `/warehouse/picking-by-vehicle?date=YYYY-MM-DD` — soạn hàng gom theo xe, aggregated products with FEFO, per-stop orders, progress %

### Integration — ✅ Hoạt động (18 endpoints) — Updated Session 15
- **Bravo:** Push document, webhook, reconcile (mock mode)
- **DMS:** Sync order status (mock mode)
- **Zalo:** Send ZNS, delivery confirmation, **order confirmation** (mock mode)
- **NPP Portal:** GET/POST confirm/:token (public, no auth)
- **Order Confirm Portal (MỚI):** GET/POST order-confirm/:token (public, no auth) — view order, PDF, confirm, reject
- **DLQ** (Task 3.8): List, stats, retry, resolve failed integration calls
- **Config:** `INTEGRATION_MOCK=true` → tất cả adapter trả mock data

### Reconciliation — ✅ Hoạt động (12 endpoints) — Updated Session 22/03
- **Action history (MỚI Phase 6):** GET `/reconciliation/discrepancies/:id/history` — entity_events timeline per discrepancy
- **RBAC (MỚI Phase 6):** ResolveDiscrepancy requires admin or is_chief_accountant flag

### Test Portal — ✅ Hoạt động (18 endpoints) — Updated Session 19g
- **Không cần auth** — module riêng cho QA/UAT testing
- **Data overview:** orders, order-confirmations, delivery-confirmations, stock, credit-balances, customers, products
- **Test actions:** reset-data (xóa data test, giữ master data), create-test-order, simulate-delivery
- **GPS Simulation (MỚI Session 19g):**
  - GET `/v1/test-portal/gps/scenarios` — 7 kịch bản sẵn có
  - GET `/v1/test-portal/gps/vehicles` — Danh sách xe active từ DB
  - POST `/v1/test-portal/gps/start` — Bắt đầu giả lập (scenario + xe + interval)
  - POST `/v1/test-portal/gps/stop` — Dừng giả lập + xóa Redis data
  - GET `/v1/test-portal/gps/status` — Trạng thái realtime (tick, vị trí xe)
  - 7 scenarios: normal_delivery (5 xe), rush_hour (10 xe), gps_lost_signal, idle_vehicle, speed_violation, long_route (QN→HP), from_active_trips (DB)
  - Data flow: Start → goroutine → Redis HSET + PUBLISH → WebSocket hub → Control Tower map
- **Frontend:** http://localhost:3003/test-portal — 8 tab UI: Kịch bản test, Đơn hàng, Xác nhận đơn Zalo, Xác nhận giao hàng, Tồn kho/ATP, Dư nợ, Tạo đơn test, **Tài xế & Tài khoản**, **Giả lập GPS**
- **Backend:** `internal/testportal/handler.go` — 18+ handler methods, direct DB queries, no service layer (→ TD-019)
- **Thêm endpoints (session 16 cont.):** SimulateDelivery, RunScenario, ZaloInbox
- **SQL scripts:**
  - `migrations/reset_test_data.sql` — standalone SQL reset
  - `migrations/seed_test_ready.sql` — **comprehensive 6-phase reset+seed** (delete all → create WH-HP bins → lots 30 SP → stock WH-HL + WH-HP → receivable_ledger 6 NPP)
- **Bug fixes (session 16 cont.):**
  - Fixed ListCreditBalances/ListCustomers: JOIN `credit_limits` table thay vì `customers.credit_limit` (column không tồn tại)
  - Fixed credit calculation: dùng `SUM(CASE debit/credit)` khớp OMS logic
  - Fixed ResetTestData: sửa tên bảng sai (`epod_items` → removed, `dlq_entries` → `integration_dlq`, etc.)
- **Test guide:** `docs/guides/HUONG_DAN_TEST_NGHIEP_VU.md` — 5 kịch bản test từng bước
- **Auto reconcile trip** (Task 3.9): 3 types per BR-REC-01 (goods, payment, asset)
- **Discrepancy tickets** (Task 3.10): auto-create with T+1 deadline, resolve with notes
- **Daily close summary** (Task 3.11): warehouse-level daily aggregation

### Notification — ✅ Hoạt động (5 endpoints + WS + events) — Updated Session 18
- List (`GET /v1/notifications`), unread count, mark read (`POST /v1/notifications/:id/read`), mark all read (`POST /v1/notifications/read-all`)
- WebSocket: `/ws/notifications?token=` for real-time push
- **Priority levels:** urgent, high, normal, low
- **Entity linking:** notification → entity (entity_type, entity_id) — để navigate từ notification tới source
- **Entity Events (MỚI Session 17):**
  - GET `/v1/orders/:id/timeline` — Lịch sử sự kiện đơn hàng (immutable log)
  - GET `/v1/orders/:id/notes` — Ghi chú đơn hàng (có note_type + is_pinned)
  - POST `/v1/orders/:id/notes` — Thêm ghi chú (hỗ trợ note_type: internal/npp_feedback/driver_note/system)
  - PUT `/v1/orders/:id/notes/:noteId/pin` — Ghim ghi chú (MỚI)
  - DELETE `/v1/orders/:id/notes/:noteId/pin` — Bỏ ghim ghi chú (MỚI)
  - Bảng `entity_events`: immutable event log cho mọi entity, JSONB detail
  - Bảng `order_notes`: ghi chú nội bộ giữa nhân viên
- **Event triggers:** order.created, order.confirmed_by_customer, order.rejected_by_customer, order.approved, order.cancelled, **order.in_transit (MỚI Session 22/03)**, **order.status_changed (MỚI Session 22/03)**, order.redelivery_created
- **Notification enhancements:** priority (urgent/high/normal/low), entity_type, entity_id — liên kết notification → entity
- **Notification triggers (auto):** Tạo đơn → notify accountant (pending_approval) hoặc dvkh (pending_customer_confirm). Duyệt công nợ → notify dvkh.

### KPI — ✅ Hoạt động (4 endpoints + cron) — Updated Session 19f
- KPI report with date range + warehouse filter
- **Issues report (MỚI):** GET `/v1/kpi/issues?from=&to=&limit=` — Báo cáo giao thất bại, sai lệch, giao trễ
- **Cancellations report (MỚI):** GET `/v1/kpi/cancellations?from=&to=&limit=` — Báo cáo hủy, từ chối, nợ, chờ duyệt
- Manual snapshot generation
- Daily cron 23:50 ICT for all warehouses
- **Frontend:** Tab "Tổng quan" / "Có vấn đề" / "Hủy/Nợ" trong KPI dashboard

### GPS — ✅ Hoạt động (3 endpoints + WS)
- REST: Batch upload (lên tới 1000 points), get latest positions **(enriched: vehicle_plate, driver_name, trip_status)** — Session 11
- WebSocket: `/ws/gps` (Redis pub/sub)
- **GPS inject tool:** `cmd/inject_gps/main.go` — Sets test GPS positions for in-transit vehicles via Go Redis client
- **GPS Simulator (MỚI Session 19f):** `cmd/gps_simulator/main.go` — Mô phỏng GPS thực tế:
  - Tự load active trips từ DB, lấy waypoints từ trip_stops
  - Nếu không có trips → dùng 5 demo routes (Hạ Long, Uông Bí, Cẩm Phả, Hải Phòng)
  - Vận tốc 30-55 km/h, dừng giao hàng 15-45s/điểm, heading thực tế
  - GPS jitter mô phỏng sai số thực (±5m)
  - Publish qua Redis HSET + PUBLISH (tương thích WebSocket hub)
  - Chạy: `go run ./cmd/gps_simulator/`

### Cron Jobs
- Auto-confirm Zalo delivery 24h expired (mỗi 1 giờ)
- **Auto-confirm Zalo order 2h expired (mỗi 5 phút) — MỚI Session 15**
- Nightly Bravo credit reconcile (mỗi giờ, chỉ chạy lúc 0:00 VN)
- **Daily KPI snapshot** (23:50 ICT, all warehouses) — NEW
- **Document expiry check** (07:00 ICT daily, vehicle + driver docs) — MỚI Session 18
  - Alerts dispatcher khi giấy tờ xe/tài xế hết hạn (≤ 7 ngày) hoặc đã hết hạn
- **Credit limit expiry check (MỚI Phase 6):** mỗi 6 giờ — alerts khi hạn mức công nợ hết hạn trong 7 ngày
  - Records entity_events per expiring limit, typ = credit_limit

### Frontend — 42 pages — Updated Session 22/03
- Login, dashboard (role-specific stat cards), orders CRUD, trips + map, products/customers/vehicles/drivers CRUD
- **Dashboard:** Role-specific — admin/dispatcher sees operational, accountant sees financial (pending_approvals, discrepancies), dvkh sees orders, management sees KPI — Session 10
- **Orders page:** Supports `?status=` URL param for pre-filtering — Session 10
- **Order detail (Updated Session 22/03):** Delivery attempts tab + "📦 Giao bổ sung" button (chỉ partially_delivered/failed) + **Zalo link** + **ePOD photos tab**
  - OrderStatusStepper: 5-step progress stepper visual
  - OrderTimeline: world-class redesign (nhóm ngày, filter tabs, duration chips, rich detail cards)
- **Vehicle documents (MỚI Session 18):** `/dashboard/vehicles/:id/documents` — CRUD with expiry badges
- **Driver documents (MỚI Session 18):** `/dashboard/drivers-list/:id/documents` — CRUD with license class + expiry badges
- **ATP display:** Shows "ATP: 0" (red) when warehouse selected but no stock — Session 10
- **Driver mobile** (my-trips + progress bar, checklist submission, ePOD + photo capture, payment with debt/credit, returns + damage photo, incident reporting, trip summary, Google Maps navigation, post-trip checklist, profile page)
- **Driver stop flow:** pending → arrived → delivering → ePOD/fail (matches SM-03 state machine) — Session 11
- **Driver profile** (APP-10): Account info, app version, logout — Session 11
- **Driver post-trip checklist** (US-TMS-18): 6-item confirmation before trip completion — Session 11
- PDA scanner (PWA barcode), NPP confirm portal, real-time GPS map (enriched with vehicle plates, driver names, trip status)
- **Warehouse** (dashboard, picking, returns) — NEW Session 7
- **Warehouse Picking by Vehicle** — page `/dashboard/warehouse/picking-by-vehicle` soạn hàng gom theo xe: KPI cards, filter tabs, expandable vehicle cards with FEFO badges, progress bars, per-stop orders — MỚI UX v5
- **Security** gate check — NEW Session 7
- **Accountant** approvals queue (enriched with credit details + order items), daily close — NEW Session 7, updated Session 9
- **Management** KPI dashboard — NEW Session 7
- **Admin** settings/user management — NEW Session 9
- **UI Localization:** Toàn bộ giao diện tiếng Việt, không có AI/VRP/ePOD/English text visible — Session 9
- **UX/UI Design System (MỚI Session 19):**
  - `docs/specs/UXUI_SPEC.md` — Source of truth cho mọi role layout + brand color
  - 8 per-role layout specs: Dispatcher 3-column cockpit, DVKH 2-column form/preview, Driver mobile thumb-zone, Accountant T+1 countdown, Warehouse PDA scan-first, Management 5-second view, Security green/red, Admin config panel
  - Brand Primary: #F68634 (cam BHL) — max 10% visual area, KHÔNG lẫn amber/warning
  - 5 UX rules bắt buộc: zero dead ends, instant business feedback, role-aware empty states, trace ID in errors, driver h-12/h-14 tap targets
  - DEC-009: UXUI_SPEC.md per-role specification formalized
  - `.github/instructions/frontend-patterns.instructions.md` — Auto-applied cho .tsx/.ts files, đã cập nhật UX rules + brand color
- **Test Portal (MỚI Session 16):** http://localhost:3003/test-portal — 8 tab: Kịch bản test, Đơn hàng, Xác nhận đơn Zalo, Xác nhận giao hàng, Tồn kho/ATP, Dư nợ, Tạo đơn test, **Tài xế & Tài khoản (MỚI Session 22/03)**. No auth, standalone module cho QA/UAT.
- **Notification UI (CẬP NHẬT Session 18):**
  - Notification Bell: chuông ở topbar (bên phải, main content area), click mở slide-in panel full-height bên phải
  - Notification Panel: slide-in từ phải, backdrop overlay, ESC/click-outside để đóng, body scroll lock, styled-scrollbar
  - Notification Toast: popup slide-in cho thông báo real-time qua WebSocket, auto-dismiss 6s
  - Notification Page: `/dashboard/notifications` — danh sách đầy đủ, filter all/unread, priority colors
  - Order Timeline: tab "📜 Lịch sử & Ghi chú" trong order detail — **redesign world-class + notes inline (Session 22/03):** merged events+notes, nhóm theo ngày, filter tabs, duration chips (color-coded: gray <30min, amber 30m-2h, red >2h), inline note composer, pin toggle, NOTE_STYLE per type, rich detail cards
  - WaitingForBanner: sticky banner "Đang chờ ai" per order status (10 statuses)
  - PinnedNotesBar: top-3 pinned notes with amber styling, unpin button
  - CreditAgingChip: credit aging indicator (>7d amber, >14d red, >30d solid red)
  - TimelineKPIBar: 4 KPI cards (processing time, cutoff, trip info, recon status)
  - Order detail tabs: 3 tab (📦 Sản phẩm / 📜 Lịch sử / 💬 Ghi chú) + **📷 ePOD (MỚI Phase 6)**
  - Dashboard layout: Topbar header (greeting + bell) + sidebar nav + main content
- **Phase 6 Frontend Enhancements (MỚI):**
  - **Centralized status config (MỚI Session 22/03):** `web/src/lib/status-config.ts` — SINGLE SOURCE OF TRUTH cho tất cả status labels/colors (order, trip, stop, recon, Zalo). Tất cả pages import từ đây.
  - **OrderStatusStepper (MỚI Session 22/03):** `web/src/components/OrderStatusStepper.tsx` — 5-step progress stepper (Đã tạo đơn → KH xác nhận → Kho xử lý → Đang vận chuyển → Hoàn thành) with special status banners (rejected, partially_delivered, etc.)
  - **Tài xế & Tài khoản tab (MỚI Session 22/03):** Tab mới trong Test Portal — driver-account mapping, E2E test guide
  - **Biên bản giao hàng (MỚI Session 22/03):** ePOD view upgraded — formal header, product table (ordered/delivered/variance), photo gallery, signature display
  - **Workshop page:** `/dashboard/workshop` — Bottle classification form (classify tốt/hỏng/mất) + summary view
  - **Reconciliation page:** T+1 countdown badges, split sub-tabs (Tất cả/Tiền/Hàng/Vỏ), action history modal
  - **Audit logs:** ConfigDiffView component — before/after diff when viewing config changes
  - **KPI page:** Clickable metric cards → drill to filtered order/trip/recon views
  - **Gate check page:** Queue display with count badge + mandatory fail reason dropdown (6 types)
  - **Picking page:** Priority badge "Soạn trước" for first pending item
  - **Control tower:** Exception descriptions (Vietnamese), bulk move stops (multi-select + modal), fleet tab toggle (trips/fleet)

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
| Integration thực (HTTP) | Mock mode mặc định + standalone mock server (cmd/mock_server) | INT | Mock server sẵn sàng, chờ BHL IT sandbox cho real |
| zerolog structured | stdlib `log` | SAD | Low priority |
| 11 roles (BRD v3.0) | 9 roles (code): admin, dispatcher, driver, warehouse_handler, accountant, management, dvkh, security, workshop | BRD §9 | Phase 6: tách workshop (done), fleet tab in dispatcher (done), KT Trưởng RBAC (done). Còn lại: đội_trưởng (sub-role of dispatcher), phó_giám_đốc (≈management) |
| BRD v2.2 | BRD v3.0 (updated session 18) | BRD | Đã sync — Session 18: 33 events, Timeline 10 lớp, 3-layer RBAC |
| API spec v1.0 | API spec v1.1 (updated session 11) | API | Đã sync — Session 11 |

---

## Database: 38+ bảng, 17 migration files (001-014)

**Migrations applied (17 files):** 001_init → 002_checklist → 003_cutoff_consolidation → 004_wms → 005_epod_payment → 006_zalo_confirm → 007_recon_dlq_kpi → 008_audit_log → 009_driver_checkin + 009_urgent_priority (hai file cùng số) → 010_order_confirmation + 010_order_number_seq + 010_workshop_phase6 (ba file cùng số) → 011_entity_events → 012_redelivery_vehicle_docs → 013_partial_payment_reject → 014_note_type_pinned (MỚI — note_type, is_pinned on order_notes)

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

## Domain Models: 40+ structs trong `internal/domain/models.go`

Auth (1): User  
OMS (7): Product, Customer, CustomerWithCredit, ATPResult, SalesOrder, OrderItem, Shipment  
TMS (5): Vehicle, Driver, Trip, TripStop (includes CustomerPhone — Session 11), TripChecklist  
VRP (5): VRPJob, VRPResult, VRPTrip, VRPStop, VRPSummary  
WMS (7): StockMove, StockMoveItem, PickingOrder, PickingItem, GateCheck, Lot, StockQuant  
Integration (6): AssetLedgerEntry, ReturnCollection, EPOD, EPODItem, Payment, ZaloConfirmation  
Reconciliation (3): DLQEntry, Reconciliation, Discrepancy, DailyCloseSummary
Notification (3): Notification (enhanced: priority, entity refs), **EntityEvent**, **OrderNote**
KPI (1): DailyKPISnapshot
Driver (1): DriverCheckin
Confirmation (1): OrderConfirmation

---

## Logging & Tracing — ✅ Đã triển khai (Session 12)

| Component | Mô tả |
|-----------|-------|
| `pkg/logger/` | Logger interface + JSON structured logger (3 files) |
| `middleware.Tracing` | Inject X-Trace-ID vào context, log http_request với duration_ms |
| Constructor injection | Tất cả Handler/Service/Repository nhận `logger.Logger` qua constructor |
| I/O boundary logging | DB queries, integration calls, cache hits: ghi op + duration_ms |
| Frontend X-Trace-ID | `apiFetch` tự tạo UUID → gửi header `X-Trace-ID`, error message kèm trace ID |
| LOG_LEVEL | Env var `LOG_LEVEL` (default: INFO), tuỳ chỉnh mức log: DEBUG/INFO/WARN/ERROR/FATAL |

**Pattern bắt buộc:**
```go
s.log.Info(ctx, "event_name", logger.F("key", "value"))
s.log.Error(ctx, "event_name", err, logger.F("key", "value"))
```

---

## Phụ thuộc bên ngoài (chờ BHL IT)

| Hệ thống | Status | Ảnh hưởng |
|-----------|--------|-----------|
| Bravo ERP sandbox | ☐ Chưa có | Mock server sẵn sàng (:9001), chờ real credentials |
| DMS API sandbox | ☐ Chưa có | Mock server sẵn sàng (:9002), chờ real credentials |
| Zalo OA credentials | ☐ Chưa có | Mock server sẵn sàng (:9003), ZaloAdapter hỗ trợ custom base URL |
| PDA hardware model | ☐ Chưa xác nhận | PWA barcode scanner thay thế |

---

## Seed Data Files (dữ liệu test)

| File | Mục đích | Dữ liệu chính |
|------|----------|----------------|
| `seed.sql` | Demo cơ bản | 13 users, 15 SP, 15 KH, 8 xe, 8 TX |
| `seed_full.sql` | Demo đầy đủ | 12 users, 15 SP, 20 KH, 12 xe, 12 TX, 50 đơn, lots, stock_quants, routes, receivable ledger |
| `seed_production.sql` | Production scale | 800 NPP (cũ, đã thay thế), 70 xe, 70 TX, 30 SP, 500 tuyến, credit limits, asset balances |
| `import_real_npp.sql` | **NPP thực tế BHL** | 218 NPP từ CSV BHL, 15 tỉnh, tọa độ thực tế, TRUNCATE CASCADE customers |
| `seed_planning_test.sql` | **Planning page test** | 80 đơn confirmed + 80 shipments pending (50 WH-HL + 30 WH-HP, delivery_date = tomorrow) |
| `seed_test_uat.sql` | UAT driver test | 70 xe, 70 TX, 700 đơn, 70 trips, 5 bảo vệ |
| `seed_comprehensive_test.sql` | **Test toàn diện** | Bổ sung: 19 quản lý (3 BGĐ + 8 trưởng vùng + 8 giám sát), 11 thủ kho, 6 bảo vệ, 8 DVKH+dispatcher+KT, 12 TX phụ, 12 xe phụ, 60+ lots, 80+ stock quants (2 kho), 15 system settings, receivable ledger 800 NPP |
| `reset_to_production.sql` | **Reset & nạp data SX** | Xóa toàn bộ demo data, nạp seed_production + 10 đơn hàng mẫu + lots/stock |
| `seed_demo_comprehensive.sql` | **Demo đầy đủ** | Stock quants 30 SP × 2 kho, lots SP 16-30, daily close 7 ngày, KPI 6 bản, closed orders — Session 10 |
| `patch_demo_data.sql` | **Bổ sung demo** | Driver checkins (63 available/6 off_duty), 12 reconciliations, 4 discrepancies, 2 pending_approval orders — Session 10 |

**Thứ tự chạy khuyến nghị:**
1. `seed_full.sql` (dữ liệu demo cơ bản)
2. `seed_production.sql` (scale lên 800 NPP, 70 xe+TX, 30 SP)
3. `seed_comprehensive_test.sql` (bổ sung quản lý, thủ kho, 12 xe/TX phụ, lots, tồn kho)
4. `seed_test_uat.sql` (tạo 700 đơn + 70 trips cho UAT)
5. `seed_planning_test.sql` (tạo 80 pending shipments cho planning page)
6. `seed_demo_comprehensive.sql` + `patch_demo_data.sql` (stock quants, checkins, reconciliations, discrepancies)

**Tổng sau khi chạy đầy đủ:**
- Users: ~120+ (admin 1, management 19, dispatcher 4, accountant 4, dvkh 7, warehouse_handler 11, security 6, driver 82)
- Vehicles: 82 (48 WH-HL + 36 WH-HP, mix 3.5t/5t/8t/15t)
- Drivers: 82 (tất cả có user account, license B2/C)
- Products: 30 SKU (bia lon, bia chai, bia cao cấp, bia tươi, NGK, vỏ chai/két/keg)
- Customers: **218 NPP thực tế BHL** (15 tỉnh: QN, HP, HD, HY, TB, NĐ, LS, BG, BN, TN, TH, NB, PT, HN, HCM) — Session 13: thay thế 800 NPP test bằng danh sách thực tế từ BHL
- Routes: 500 (50 chính + 450 phụ)
- Lots: 60+ (2-3 lô/SP, hỗ trợ FEFO)
- Stock quants: 80+ entries (đầy đủ tồn kho 2 kho)
- System settings: 16

---

## Code Compliance Audit — Session 22/03/2026

**Tổng vi phạm phát hiện:** 200+ across 37 files. Chi tiết trong TECH_DEBT.md (TD-018 đến TD-025).

| Loại vi phạm | Số lượng | Mức độ | TECH_DEBT ID |
|---|---|---|---|
| float64 cho tiền/giá | 30+ fields | 🔴 Quan trọng | TD-018 |
| TestPortal bypass 3-layer | 21 SQL queries | 🟡 Thấp (test-only) | TD-019 |
| console.error không báo user | 26 chỗ trong 13 pages | 🟡 Medium | TD-020 |
| Direct fetch() thay vì apiFetch | 10 chỗ | 🟡 Medium | TD-021 |
| time.Now() thiếu timezone | 20+ chỗ | 🟡 Medium | TD-022 |
| Thiếu ::text cast pgx enum/date | ~50 queries | 🔴 Quan trọng | TD-023 |
| Global logging (log.Printf) | 40+ chỗ (cmd/) | 🟢 Thấp | TD-024 |
| Thiếu Repository layer | 3 modules (auth, admin, kpi) | 🟡 Medium | TD-025 |

**Quy tắc:** Chỉ fix code violations khi implement feature mới chạm vào file đó. KHÔNG refactor code cũ riêng lẻ.

---

*Cập nhật file này mỗi khi: thêm endpoint mới, thêm migration, thêm/sửa module, thay đổi cấu trúc.*
