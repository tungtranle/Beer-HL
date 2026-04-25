# CURRENT_STATE — BHL OMS-TMS-WMS

> **Cập nhật:** 25/04/2026 (session 25/04 — production auto deploy + DB sync master data + one-click full data sync workflow)  
> **Mục đích:** Mô tả trạng thái THỰC TẾ của hệ thống. AI đọc file này để biết code đang làm gì, **không** phải spec nói gì.  
> **Quy tắc:** Khi code thay đổi → cập nhật file này. Nếu CURRENT_STATE không khớp code → file này sai.

---

## Tổng quan hệ thống

| Component | Tech | Port | Status |
|-----------|------|------|--------|
| Backend API | Go + Gin | :8080 | ✅ Hoạt động (default port 8080) |
| Frontend | Next.js 14 + Tailwind | :3000 | ✅ Hoạt động (`restart-services.bat` now relaunches frontend in separate CMD window) |
| Database | PostgreSQL 16 | :5434 | ✅ 28 migration pairs (001-035) |
| Cache/PubSub | Redis | :6379 | ✅ GPS + pub/sub |
| VRP Solver | Python + OR-Tools | :8090 | ✅ Hoạt động |
| OSRM Routing | Docker (Vietnam data) | :5000 | ⚠️ Cần setup data (`./setup-osrm.ps1`), hỗ trợ refresh lại extract mới bằng `-ForceRefresh` |
| Mock Server | Go (Bravo/DMS/Zalo) | :9001-9003 | ✅ Optional — `go run cmd/mock_server/main.go` |
| Prometheus | Docker | :9090 | ✅ Configured (profile: monitoring) |
| Grafana | Docker | :3030 | ✅ Configured (profile: monitoring) |
| Sentry | Cloud (sentry.io) | — | ✅ DSN configured (frontend + backend) |

## Vận hành Production

- Production server hiện chạy trên Mac mini qua Docker Compose file `bhl-oms/docker-compose.prod.yml`.
- GitHub Actions self-hosted runner trên Mac mini tự deploy khi push lên `master`, dùng labels `self-hosted`, `macOS`, `production`.
- Có thêm bootstrap one-shot `enable-auto-deploy.sh`: chạy 1 lần trên Mac mini để cài/cập nhật runner theo repo hiện tại, kiểm tra nhanh `.env`/`keys`, rồi từ đó chỉ cần push `master` hoặc bấm `Run workflow` là deploy.
- `setup-runner.sh` hiện có thể tự lấy registration token qua `gh`, đồng thời tự re-register runner nếu máy đang còn trỏ tới repo/account GitHub cũ.
- Có 2 cách đồng bộ data:
  - sync master data/users qua `seed_master.sql` + `db-sync.sh`,
  - restore full DB package qua `export-full-data-package.sh` và `import-full-data-from-usb.sh` khi cần server giống hệt máy code.
- Sau mỗi deploy, workflow chạy script `bhl-oms/scripts/db-sync.sh` để:
  - tạo bảng `schema_migrations` nếu chưa có,
  - áp dụng các file `bhl-oms/migrations/[0-9]*.up.sql` chưa từng chạy,
  - áp dụng `bhl-oms/migrations/seed_master.sql` để đồng bộ danh sách users master.
- `seed_master.sql` là nguồn sự thật cho users/master data cần giữ đồng bộ giữa máy code và server.
- Nếu danh sách users được sửa trực tiếp trong DB đang dùng làm chuẩn, chạy `bash bhl-oms/scripts/export-users-seed.sh` để export ngược DB đó ra `seed_master.sql`, rồi commit/push lên GitHub.
- Đồng bộ users dùng `ON CONFLICT (username) DO UPDATE`, có chủ ý **không** ghi đè `password_hash`, nên người dùng đã đổi mật khẩu trên server sẽ không bị reset khi deploy.
- Điều kiện ổn định cho Mac mini production: cần tắt system sleep khi cắm điện, bật auto-restart sau mất điện, và bật auto-login cho user chạy Docker Desktop/runner; nếu không `bhl.symper.us` có thể down dù code/container vẫn đúng.

---

## Modules & Endpoints (thực tế đang chạy)

### Auth — ✅ Hoàn chỉnh
- POST `/v1/auth/login`, `/v1/auth/refresh`
- RS256 JWT, 9 roles: admin, dispatcher, driver, warehouse_handler, management, accountant, dvkh, security, workshop
- Test credentials: tất cả password `demo123`

### Admin — ✅ Hoạt động (30 endpoints) — Updated Session 25/03
- **Quản lý người dùng:** List, Get, Create, Update, Delete (soft), Reset password (6 endpoints)
- **Danh sách quyền:** List roles (1 endpoint) — includes workshop role
- **Dynamic RBAC (MỚI Session 24/03):** GET/PUT `/admin/permissions` (matrix), user overrides CRUD (`GET/POST /admin/users/:id/overrides`, `DELETE /admin/users/:id/overrides/:oid`) (5 endpoints)
- **Session Management (MỚI Session 24/03):** GET `/admin/sessions`, DELETE `/admin/sessions/:id`, DELETE `/admin/users/:id/sessions` (3 endpoints)
- **Audit Logs:** GET `/admin/audit-logs`, GET `/admin/audit-logs/:id/diff` (2 endpoints)
- **DB monitoring:** GET `/admin/slow-queries`, POST `/admin/slow-queries/reset` (2 endpoints)
- **System Health (Enhanced):** GET `/admin/health` — PostgreSQL, Redis, VRP Solver checks + GPS tracking stats + recent operations
- **Routes CRUD:** GET/POST/PUT/DELETE `/admin/routes` (4 endpoints)
- **Configs:** GET/PUT `/admin/configs` (2 endpoints)
- **Credit Limits:** GET/POST/PUT/DELETE `/admin/credit-limits` + GET `/admin/credit-limits/expiring` (5 endpoints)
- **Credit Limit Audit Trail (MỚI Session 25/03b):** UpdateCreditLimit ghi entity_events type `credit_limit.updated` với old/new values + actor info
- **App version:** GET `/v1/app/version` (1 endpoint)
- **PermissionGuard middleware (MỚI Session 24/03):** Redis cache (300s TTL) + DB fallback, admin bypasses all checks
- Chỉ admin mới truy cập được (trừ app/version)
- Frontend: `/dashboard/settings` — Quản trị hệ thống (Users, Sessions, Configs, Credit Limits)
- Frontend: `/dashboard/settings/health` — System Health & Monitoring dashboard
- Frontend: `/dashboard/settings/permissions` — Permission Matrix Editor (MỚI Session 24/03)
- Frontend: `/dashboard/settings/audit-logs` — Audit Logs with Diff modal
- Frontend: `/dashboard/settings/routes` — Routes management
- Frontend: `/dashboard/settings/configs` — System configs

### OMS — ✅ Hoạt động (18 endpoints)
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

### TMS — ✅ Hoạt động (50+ endpoints) — Updated Session 25/03b
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
- **Trips Excel Export (MỚI Session 25/03b):** GET `/v1/trips/export` — xuất Excel 2 sheet (Chuyến xe + Điểm giao)
- **Driver flow:** my-trips → checkin → start → update-stop (arrive/delivering/deliver/fail/skip) → checklist → ePOD → payment → returns → complete
- **Stop actions:** arrive, delivering, deliver, fail, skip — Session 11 (added "delivering" intermediate step)
- **ePOD (CẬP NHẬT Session 25/03b):** Server-side enforce ≥ 1 photo bắt buộc (BRD US-TMS-13 AC#5)
- **StartTrip (CẬP NHẬT Session 22/03):** Khi tài xế bắt đầu chuyến → tự động cập nhật tất cả đơn hàng sang `in_transit` + ghi event `order.in_transit`
- **CompleteTrip (SỬa BUG Session 22/03):** Sửa lỗi stop status `partially_delivered` không được chấp nhận → đã thêm vào terminal statuses. Ghi event `order.status_changed` cho mỗi đơn.
- **Integration hooks:** Khi ePOD delivered/partial → auto push Bravo + Zalo confirm (Task 3.1, 3.5, 3.6)

### WMS — ✅ Hoạt động (24 endpoints) — Updated Session BRD v3.2
- Stock query, inbound + lot management, FEFO picking
- Gate check (R01: 0 variance), barcode scan, expiry alerts, locations
- **Return inbound** (Task 3.12): pending returns list + process return into stock
- **Asset compensation** (Task 3.13): calculate lost asset compensation per BR-WMS-03
- **Gate check queue (MỚI Phase 6):** GET `/warehouse/gate-check-queue` — trips pending gate check today
- **Bottle classification (MỚI Phase 6):** POST `/warehouse/bottles/classify`, GET `/warehouse/bottles/summary` — phân loại vỏ tốt/hỏng/mất per trip
- **Picking by Vehicle (MỚI UX v5):** GET `/warehouse/picking-by-vehicle?date=YYYY-MM-DD` — soạn hàng gom theo xe, aggregated products with FEFO, per-stop orders, progress %
- **Bàn giao A/B/C (MỚI BRD v3.2):** POST `/warehouse/handovers` — tạo bàn giao; POST `/warehouse/handovers/:id/sign` — ký bàn giao; GET `/warehouse/handovers/trip/:tripId` — lấy danh sách bàn giao theo chuyến; GET `/warehouse/handovers/:id` — chi tiết bàn giao

### WMS Phase 9 — ✅ ACTIVE (15/15 done — 23/04/2026)
- **Phạm vi:** Pallet/LPN + Bin location + QR scan workflows + Cycle count + Realtime dashboard + Bin-map
- **Decisions:** DEC-WMS-01 (LPN layer), DEC-WMS-02 (FEFO-only), DEC-WMS-03 (Hybrid PDA+PWA), DEC-WMS-04 (Bravo PENDING)
- **Migration 037:** `pallets`, `bin_locations`, `qr_scan_log`, `cycle_count_tasks` — 4 bảng mới (đã APPLIED, KHÔNG sync_status)
- **Backend files:** `internal/wms/phase9_workflows.go` (~600 LOC) + `phase9_workflows_handler.go` (mount routes)
- **Endpoints (13 mới):**
  - `GET /v1/warehouse/pallets/:lpn` · `GET/POST /v1/warehouse/bins` · `GET /v1/warehouse/bins/:code/contents` (Sprint 1)
  - `POST /v1/warehouse/inbound/{receive,suggest-bin,putaway}` (Sprint 2 — receive sinh GS1 SSCC + ZPL string)
  - `GET /v1/warehouse/picking/:id/suggest-pallets` (FEFO ASC), `POST /v1/warehouse/picking/scan-pick` (FEFO check + override+reason)
  - `POST /v1/warehouse/loading/{start,scan,complete}` (validate plate vs vehicles, set status=shipped)
  - `POST /v1/warehouse/cycle-count/generate` (theo velocity class A/B/C), `GET /v1/warehouse/cycle-count/tasks`, `POST /v1/warehouse/cycle-count/submit` (variance auto → discrepancy)
  - `GET /v1/warehouse/dashboard/alerts` (4 cảnh báo: low_safety_stock / near_expiry_high_qty / bins_over_90 / orphan_pallets)
  - `GET /v1/warehouse/lots/:id/distribution` (recall traceability)
- **Frontend pages (7 mới)** dưới `web/src/app/dashboard/warehouse/`:
  - `scan/` (PWA dual-input PDA KeyEvent + camera BarcodeDetector qr/data_matrix/code_128, parser GS1)
  - `inbound/` (form receive → ZPL print)
  - `putaway/` (LPN lookup → 3 bin gợi ý → confirm/override)
  - `loading/` (trip+plate → loop scan → complete)
  - `cycle-count/` (generate ABC + modal scan submit)
  - `dashboard/` (4 widget polling 10s)
  - `bin-map/` (canvas heatmap occupancy 5 mức + click drill-down)
- **Live tested:** receive, suggest-bin, putaway, cycle-count generate/list, dashboard alerts, lot distribution. `go build ./...` exit 0.

### Integration — ✅ Hoạt động (19 endpoints) — Updated Session 25/03
- **Bravo:** Push document, webhook, reconcile (mock mode) (3 endpoints)
- **DMS:** Sync order status (mock mode) (1 endpoint)
- **Zalo:** Send ZNS (1 endpoint)
- **Delivery Confirm:** Send + auto-confirm (2 endpoints)
- **NPP Delivery Portal:** GET/POST `/v1/confirm/:token` (confirm, dispute) (3 public endpoints)
- **Order Confirm Portal:** GET `/v1/order-confirm/:token` (view, pdf, confirm, reject) (4 public endpoints)
- **DLQ** (Task 3.8): List, stats, retry, resolve (4 endpoints)
- **Config:** `INTEGRATION_MOCK=true` → tất cả adapter trả mock data

### Reconciliation — ✅ Hoạt động (11 endpoints) — Updated Session 25/03b
- **Trip reconcile:** POST/GET `/reconciliation/trips/:tripId` (2 endpoints)
- **Reconciliation list + resolve:** GET `/reconciliation`, POST `/reconciliation/:id/resolve` (2 endpoints)
- **Discrepancies:** List, resolve, history (3 endpoints)
- **Daily close:** Generate, list, get by date (3 endpoints)
- **Excel Export (MỚI Session 25/03b):** GET `/v1/reconciliation/export` — xuất Excel với type/status labels tiếng Việt
- **Action history (MỚI Phase 6):** GET `/reconciliation/discrepancies/:id/history` — entity_events timeline per discrepancy
- **RBAC (MỚI Phase 6):** ResolveDiscrepancy requires admin or is_chief_accountant flag

### Test Portal — ✅ Hoạt động (24 endpoints) — Updated Session 21/04
- **Bảo mật:** `ENABLE_TEST_PORTAL=true|false` env flag — default true (dev), set false trên production
- **Không cần auth** — module riêng cho QA/UAT testing
- **Launcher cho người non-tech (MỚI Session 17/04):** double-click `bhl-oms/START_TEST_PORTAL.bat` để bật backend `:8080`, frontend `:3001`, rồi tự mở `http://localhost:3001/test-portal`
- **Frontend fail-safe (MỚI Session 17/04):** nếu frontend còn sống nhưng backend `:8080` đang tắt, tab Kịch bản test hiển thị cảnh báo backend chưa chạy thay vì empty state gây hiểu nhầm là không có scenario
- **Data overview:** orders, order detail, order timeline, order notes, order-confirmations, delivery-confirmations, stock, credit-balances, customers, products, drivers, ops-audit aggregate (12 endpoints)
- **Test actions:** reset-data, create-test-order, simulate-delivery, run-scenario, load-scenario, list-scenarios, zalo-inbox (7 endpoints)
- **GPS Simulation:** scenarios, vehicles, start, stop, status (5+1 endpoints)
- **12 kịch bản test (MỚI SC-12 Session 21/04):**
  - SC-01: E2E Happy Path (8 đơn, 3 chuyến)
  - SC-02: Credit Exceed (vượt hạn mức)
  - SC-03: ATP Fail (tồn kho không đủ)
  - SC-04: Zalo Reject (KH từ chối)
  - SC-05: Dispatch Trip (12 đơn, VRP)
  - SC-06: Multi-Stop (5 stops, driver flow)
  - SC-07: Gate Check Fail
  - SC-08: Reconciliation Discrepancy
  - **SC-09: VRP Tối ưu (MỚI) — 300 đơn, 5 nhóm trọng lượng (40kg→6.5T), 50 xe WH-HL (3.5T/5T/8T/15T = 284T), ~245T hàng. Mock fallback fixed**
  - SC-10: Dữ liệu thực 13/06, GPS mặc định `from_active_trips`
  - SC-11: Control Tower, GPS mặc định `from_active_trips`
  - SC-12: Ops & Audit regression — 3 order status, timeline, notes, DLQ, discrepancy, daily close, KPI snapshot
- **GPS Simulation (MỚI Session 19g):**
  - GET `/v1/test-portal/gps/scenarios` — 7 kịch bản sẵn có
  - GET `/v1/test-portal/gps/vehicles` — Danh sách xe active từ DB
  - POST `/v1/test-portal/gps/start` — Bắt đầu giả lập (scenario + xe + interval)
  - POST `/v1/test-portal/gps/stop` — Dừng giả lập + xóa Redis data
  - GET `/v1/test-portal/gps/status` — Trạng thái realtime (tick, vị trí xe)
  - 7 scenarios: normal_delivery (5 xe), rush_hour (10 xe), gps_lost_signal, idle_vehicle, speed_violation, long_route (QN→HP), from_active_trips (DB)
  - Route generator lấy kho + NPP thực từ DB, sau đó gọi OSRM route geometry để densify waypoint theo đường đi thật; `from_active_trips` suy từ kho của chuyến + customer trên `trip_stops`, không đọc `trip_stops.latitude/longitude` vì schema hiện tại không có cột này
  - Data flow: Start → goroutine → Redis HSET + PUBLISH → WebSocket hub → Control Tower map
- **Frontend:** `http://localhost:3001/test-portal` khi chạy detached launcher (hoặc `:3000` với flow dev cũ) — 10 tab UI: Kịch bản test, Đơn hàng, Xác nhận đơn Zalo, Xác nhận giao hàng, Tồn kho/ATP, Dư nợ, **Ops & Audit**, Tạo đơn test, **Giả lập GPS**, **Tài xế**
- **Test Portal coverage (21/04):** 12 scenario backend (SC-01..SC-12) + 7 GPS profile; tab Ops & Audit gom coverage cho timeline/notes, integration DLQ, reconciliation, KPI và admin smoke, đồng thời SC-10/SC-11 mặc định route theo `from_active_trips`
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

### Notification — ✅ Hoạt động (6 endpoints + WS + events) — Updated Session 25/03b
- **Link audit (Session 25/03b):** Tất cả 25 notification links đã chuyển sang relative path (không `/dashboard/` prefix). Frontend `NotificationBell.handleClick` tự thêm prefix. Thêm category icons: `eod_checkpoint`, `eod_confirmed`, `eod_rejected`, `document_expiry`.
- List (`GET /v1/notifications`), unread count, mark read (`POST /v1/notifications/:id/read`), mark all read (`POST /v1/notifications/read-all`), **grouped** (`GET /v1/notifications/grouped`)
- WebSocket: `/ws/notifications?token=` for real-time push
- **4-Layer Delivery System (MỚI Session 24/03):**
  - Layer 1: In-app notification (DB + WebSocket push)
  - Layer 2: Toast popup (AutoToast 6s cho high, PersistentToast cho urgent)
  - Layer 3: Sound/vibration based on priority level
  - Layer 4: External (Zalo ZNS) — mock mode
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
- **Event triggers:** order.created, order.confirmed_by_customer, order.rejected_by_customer, order.approved, order.cancelled, **order.in_transit (MỚI Session 22/03)**, **order.status_changed (MỚI Session 22/03)**, order.redelivery_created, **handover.a_signed, handover.b_signed, handover.c_signed (MỚI BRD v3.2)**
- **Notification enhancements:** priority (urgent/high/normal/low), entity_type, entity_id — liên kết notification → entity
- **Notification triggers (auto):** Tạo đơn → notify accountant (pending_approval) hoặc dvkh (pending_customer_confirm). Duyệt công nợ → notify dvkh.

### KPI — ✅ Hoạt động (5 endpoints + cron) — Updated Session 25/03b
- KPI report with date range + warehouse filter
- **Issues report (MỚI):** GET `/v1/kpi/issues?from=&to=&limit=` — Báo cáo giao thất bại, sai lệch, giao trễ
- **Cancellations report (MỚI):** GET `/v1/kpi/cancellations?from=&to=&limit=` — Báo cáo hủy, từ chối, nợ, chờ duyệt
- **Redelivery report (MỚI Session 25/03b):** GET `/v1/kpi/redeliveries?from=&to=&limit=` — Số lần giao lại trung bình, top lý do thất bại
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
- **GPS Simulation API (MỚI):** In-process simulation controller for dispatcher testing:
  - POST `/v1/gps/simulate/start` — Bắt đầu giả lập (trip_ids, use_demo, speed_mul)
  - POST `/v1/gps/simulate/stop` — Dừng giả lập
  - GET `/v1/gps/simulate/status` — Trạng thái (running, vehicles, uptime)
  - Loads active trips from DB hoặc demo routes, publishes GPS qua Hub.PublishGPS

### Cost Engine — MỚI (Migration 020) + Planning Redesign Phase 1
- **6 bảng mới:** toll_stations, toll_expressways, toll_expressway_gates, vehicle_type_cost_defaults, vehicle_cost_profiles, driver_cost_rates
- **Seed data:** 16 trạm thu phí miền Bắc (15 quốc lộ + Cầu Bạch Đằng), 5 cao tốc + 24 gates, 4 vehicle type defaults (diesel 24,500đ/L), 5 driver rates
- **Migration 025:** Thay seed data cũ bằng dữ liệu thực tế miền Bắc VN (15 trạm hở QL1A/2/3/5/6/10/18/21B/32/38 + 5 cao tốc CT Hà Nội-HP, Nội Bài-Lào Cai, Pháp Vân-Ninh Bình, HP-HL-VĐ-MC, BG-LS)
- **VRP Route Geometry Detection (HYBRID):** VRP solver dùng arc-based cho optimization speed, sau khi solve xong dùng OSRM route geometry để detect toll chính xác trên đường thực tế
  - `get_route_geometry(waypoints)`: gọi OSRM /route/ lấy polyline thực tế
  - `detect_tolls_on_polyline()`: duyệt từng điểm trên polyline, haversine proximity cho trạm hở, track entry/exit gates IN ORDER cho cao tốc
  - **Cost mode safeguard (MỚI 17/04/2026):** nếu route được lấy bằng `exclude=toll`, solver tin kết quả OSRM và KHÔNG chạy proximity toll detection lại. Tránh false-positive khi quốc lộ/song hành đi sát trạm BOT nhưng không chạy trên cung thu phí.
  - Fallback: nếu OSRM fail → dùng arc-based detection
- **TollType field:** `toll_type` (open/expressway) trong TollPassDetail — phân biệt trên bản đồ (🟠 trạm hở / 🔵 cao tốc)
- **VRP Cost Optimization:** LUÔN tính chi phí — UseCostOptimization=true mọi lần chạy VRP
  - Python solver: per-vehicle arc cost = fuel_cost_per_km × distance + toll_cost (point-to-segment matching)
  - Go service: LUÔN enrichSolverWithCostData + LUÔN set UseCostOptimization=true (không phụ thuộc criteria toggle)
  - Response: cost_breakdown per trip (fuel_cost_vnd, toll_cost_vnd, total_cost_vnd, tolls_passed[])
  - Summary: total_cost_vnd, total_fuel_cost_vnd, total_toll_cost_vnd, avg_cost_per_ton_vnd
- **Cost Readiness API:** `GET /v1/planning/cost-readiness` — returns data counts + ready boolean
- **Admin APIs:** (admin, dispatcher roles)
  - CRUD `/v1/cost/toll-stations`, `/v1/cost/toll-expressways` + gates
  - `/v1/cost/vehicle-type-defaults` (list, update)
  - `/v1/cost/vehicles/:id/profile` (get, upsert, delete) — per-vehicle override
  - `/v1/cost/driver-rates` (CRUD)
- **Frontend — Cost Settings page:** `/dashboard/settings/transport-costs` (4 tabs: Toll Stations, Expressways, Vehicle Defaults, Driver Rates) — full CRUD + **quản lý cổng cao tốc** (thêm/xóa gate inline)
- **Frontend — Planning page — Toll Visualization:**
  - Toll markers trên bản đồ: 🟠 trạm hở / 🔵 cao tốc, popup hiển thị tên + phí
  - Toggle 🚏 hiển thị TẤT CẢ trạm thu phí (đã đi qua = màu, chưa = xám)
  - Per-trip cost badge: ⛽ fuel + 🚏 toll breakdown
- **Frontend — Planning page redesign:**
  - Removed manual cost toggle → auto-detect from cost readiness
  - Dynamic labels (💰 cost mode / 🗺️ distance mode) throughout
  - Criteria renamed "Ràng buộc phân bổ", removed min_distance (always active as objective)
  - Real-time progress reliability (MỚI 17/04): planning page dùng **WebSocket + polling fallback** cho `stage/pct/detail`, tránh tình trạng so sánh 3 phương án bị đứng 0% khi miss event đầu.
  - Cost readiness status box (green ✅ / amber ⚠️) with data counts + settings link
  - KPI results: 2 rows — cost summary (8 cards, always visible) first, then operational (6 cards)
  - Per-trip cost: inline badge with ⛽fuel + 🚏toll breakdown
  - "Tiêu chí đã dùng" badges above results (criteria used, cost optimize status, time limit)
  - VRP Quality Assessment: 💰 Phân tích chi phí section (tổng chi phí, xăng/dầu %, cầu đường %, VND/chuyến, VND/km, VND/tấn)
  - Scenario management: duplicate save prevented (savedJobId), "📥 Tải" button to load saved scenario
  - "Tối ưu lại" resets state → shows criteria panel (no longer bypasses criteria)

### Cron Jobs
- Auto-confirm Zalo delivery 24h expired (mỗi 1 giờ)
- **Auto-confirm Zalo order 2h expired (mỗi 5 phút) — MỚI Session 15**
- Nightly Bravo credit reconcile (mỗi giờ, chỉ chạy lúc 0:00 VN)
- **Daily KPI snapshot** (23:50 ICT, all warehouses) — NEW
- **Document expiry check** (07:00 ICT daily, vehicle + driver docs) — MỚI Session 18
  - Alerts dispatcher khi giấy tờ xe/tài xế hết hạn (≤ 7 ngày) hoặc đã hết hạn
- **Credit limit expiry check (MỚI Phase 6):** mỗi 6 giờ — alerts khi hạn mức công nợ hết hạn trong 7 ngày
  - Records entity_events per expiring limit, typ = credit_limit

### Frontend — 44 pages — Updated Session 25/03
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
- **Admin Permissions (MỚI Session 24/03):** `/dashboard/settings/permissions` — Permission Matrix Editor, toggle permissions per role
- **Admin Credit Limits (MỚI):** `/dashboard/settings/credit-limits` — Credit limit management page
- **UI Localization:** Toàn bộ giao diện tiếng Việt, không có AI/VRP/ePOD/English text visible — Session 9
- **UX/UI Design System (MỚI Session 19):**
  - `docs/specs/UXUI_SPEC.md` — Source of truth cho mọi role layout + brand color
  - 8 per-role layout specs: Dispatcher 3-column cockpit, DVKH 2-column form/preview, Driver mobile thumb-zone, Accountant T+1 countdown, Warehouse PDA scan-first, Management 5-second view, Security green/red, Admin config panel
  - Brand Primary: #F68634 (cam BHL) — max 10% visual area, KHÔNG lẫn amber/warning
  - 5 UX rules bắt buộc: zero dead ends, instant business feedback, role-aware empty states, trace ID in errors, driver h-12/h-14 tap targets
  - DEC-009: UXUI_SPEC.md per-role specification formalized
  - `.github/instructions/frontend-patterns.instructions.md` — Auto-applied cho .tsx/.ts files, đã cập nhật UX rules + brand color
- **Test Portal (MỚI Session 16):** `http://localhost:3001/test-portal` với launcher mới (hoặc `:3000`/`:3001` trong local dev), 10 tab: Kịch bản test, Đơn hàng, Xác nhận đơn Zalo, Xác nhận giao hàng, Tồn kho/ATP, Dư nợ, **Ops & Audit**, Tạo đơn test, **Giả lập GPS**, **Tài xế**. No auth, standalone module cho QA/UAT.
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
  - **Test Portal scenario sourcing (17/04):** Frontend Test Portal không còn fallback scenario/test case hardcode; danh sách scenario và dữ liệu test chỉ đến từ backend `GET/POST /v1/test-portal/scenarios|load-scenario`.
  - **Test Portal Ops & Audit (21/04):** Tab mới gọi `GET /v1/test-portal/ops-audit`, `GET /v1/test-portal/orders/:id/timeline`, `GET /v1/test-portal/orders/:id/notes` để kiểm tra order history, notes ghim, DLQ, discrepancy, daily close, KPI snapshot và admin smoke counters tại một chỗ.
  - **Test Portal drivers tab (17/04):** Tab `Tài xế` lấy roster tài xế thực từ `GET /v1/test-portal/drivers`, không còn hiển thị username/password demo hardcode trong UI.
  - **Biên bản giao hàng (MỚI Session 22/03):** ePOD view upgraded — formal header, product table (ordered/delivered/variance), photo gallery, signature display
  - **Workshop page:** `/dashboard/workshop` — Bottle classification form (classify tốt/hỏng/mất) + summary view
  - **Reconciliation page:** T+1 countdown badges, split sub-tabs (Tất cả/Tiền/Hàng/Vỏ), action history modal
  - **Audit logs:** ConfigDiffView component — before/after diff when viewing config changes
  - **KPI page:** Clickable metric cards → drill to filtered order/trip/recon views
  - **Gate check page:** Queue display with count badge + mandatory fail reason dropdown (6 types)
  - **Picking page:** Priority badge "Soạn trước" for first pending item
  - **Control tower:** Exception descriptions (Vietnamese), bulk move stops (multi-select + modal), fleet tab toggle (trips/fleet)
  - **Control tower trip progress (MỚI 17/04):** Hiển thị progress bar theo từng chuyến + snapshot ETA countdown/lệch ETA (on-time/late/no-eta) ngay trong danh sách chuyến, lấy dữ liệu từ `/trips/:id` để theo dõi theo điểm giao.
  - **Control tower map UX (MỚI 17/04, cập nhật 21/04):** SVG truck markers (heading rotation + plate badge + glow), route polyline cam đứt nét, stop markers màu theo status, ETA path chỉ vẽ khi lấy được OSRM geometry thật, trip-map linking (flyTo/fitBounds), GPS simulator button trên map, toggle `Mở rộng bản đồ`, chế độ `Toàn màn hình`, drawer cảnh báo nổi, và lớp nền mặc định dùng OpenStreetMap standard để ưu tiên nhãn địa danh bản địa hơn kiểu quốc tế hóa của CARTO.
  - **Control tower OSRM source (21/04):** frontend không còn gọi trực tiếp `router.project-osrm.org`; route và ETA preview đi qua rewrite `/osrm/*` tới OSRM local `:5000` để đồng nhất với simulator/backend và tránh lệch dữ liệu mạng đường.
  - **Control tower map lifecycle fix (17/04):** Leaflet map chỉ khởi tạo sau khi page thoát trạng thái loading; thêm `invalidateSize()` sau init và `min-height` cho map container để tránh panel giữa trắng do map effect chạy khi `ref` chưa mount.
  - **Control tower GPS WS fix (17/04):** Frontend Control Tower kết nối trực tiếp backend WebSocket `/ws/gps`; local dev tự dùng `localhost:8080`, không đi qua Next.js `/api` rewrite vốn chỉ áp dụng cho HTTP `/v1/*`.
  - **Control tower active route overlay (17/04):** Các chuyến active `in_transit`, `assigned`, `ready` đều hiện tuyến trên map overview; chuyến đang chạy dùng line liền, chuyến chuẩn bị chạy dùng line xám đứt nét; selected trip vẫn được highlight đậm hơn và giữ stop markers.
  - **Control tower vehicle-to-route linking (17/04):** Bấm trực tiếp vào marker xe hoặc polyline tuyến sẽ tự chọn chuyến tương ứng, flyTo vào vị trí xe và mở chi tiết stop/ETA của chính tuyến đó.
  - **Control tower GPS start behavior (17/04):** Nút GPS simulator trên map chỉ khởi động giả lập theo chuyến hiện có trong DB/Test Portal; frontend không còn gửi `use_demo=true` để tự dựng data test.
  - **Control tower road geometry (17/04):** Route overlay ưu tiên geometry từ OSRM để hiển thị theo đường thực tế; fallback mới dùng polyline waypoint nếu OSRM không trả dữ liệu.
  - **Control tower off-route detection (17/04):** Tính khoảng cách xe → route geometry; nếu vượt ngưỡng ~1.2 km thì marker, popup và trip list hiển thị `Lệch tuyến X km`.
  - **Control tower map UX polish (21/04):** Marker click chuyển sang vehicle focus panel cố định trên map (không dùng modal giữa màn hình), giữ context theo xe/chuyến trong luồng realtime; bổ sung quick actions `Theo dõi xe`, `Mở Google Maps`.
  - **Control tower map controls (21/04):** Thêm bộ điều khiển kiểu Google Maps (Street View pegman, zoom +/- custom, my-location, Map/Satellite pill), chuẩn hóa visual controls với shadow `0 2px 6px rgba(0,0,0,0.3)`, border-radius 8px, hover nền `#f5f5f5`, font Roboto.
  - **Control tower base map style (21/04):** Chuyển default tile sang light basemap của CARTO và hỗ trợ vệ tinh Esri qua toggle để cảm giác bản đồ gần Google Maps hơn so với OSM mặc định.
  - **Login screen hardening (17/04):** Trang `/login` không còn hiển thị danh sách tài khoản demo/mật khẩu; chỉ giữ thông điệp liên hệ quản trị hệ thống để nhận tài khoản.
  - **SC-11 realistic route data (17/04):** `WH-HL` được neo về KCN Cái Lân; 26 khách đầu tiên được chia thành 7 cụm NPP thực tế (Hồng Gai/Cao Xanh, Bãi Cháy/Tuần Châu, Quảng Yên, Uông Bí, Mạo Khê, Đông Triều, Cẩm Phả/Cửa Ông). GPS simulator mặc định chạy 7 chuyến active; chuyến `completed` giữ lại để test lịch sử thay vì tính vào xe online.
  - **SC-11 Control Tower (MỚI 17/04):** Test Portal scenario — 8 trips, 26 orders, 3 exceptions (failed_stop + late_eta + idle_vehicle). 12 khách đầu tiên được re-anchor về cụm tuyến thực tế Hạ Long–Quảng Yên–Uông Bí–Cẩm Phả; GPS simulator giữ đủ 8 xe bằng cách để chuyến completed online đứng yên tại điểm cuối.

---

## Những thứ KHÁC VỚI spec

| Spec nói | Thực tế code | File spec | Kế hoạch |
|----------|-------------|-----------|----------|
| React Native Expo | Next.js web + PWA (cho demo) | SAD | DEC-001: Native vẫn planned, web bổ sung cho demo |
| Per-module domain files | Single `models.go` | SAD | DEC-002: Giữ nguyên |
| `pkg/apperror/` | `pkg/response/` | ERROR_CATALOGUE | DEC-003: Phase 3 |
| sqlc generated | Raw pgx queries | SAD | DEC-004: Giữ nguyên |
| Ant Design 5.x | Tailwind CSS | UXUI | DEC-005: Giữ nguyên |
| 17 trip statuses (code) | DB enum có 17 (thêm handover_a_signed, unloading_returns, settling, vehicle_breakdown), code dùng ~12 | STATE_MACHINES | Bổ sung dần theo feature |
| Integration thực (HTTP) | Mock mode mặc định + standalone mock server (cmd/mock_server) | INT | Mock server sẵn sàng, chờ BHL IT sandbox cho real |
| zerolog structured | stdlib `log` | SAD | Low priority |
| 11 roles (BRD v3.0) | 9 roles (code): admin, dispatcher, driver, warehouse_handler, accountant, management, dvkh, security, workshop | BRD §9 | Phase 6: tách workshop (done), fleet tab in dispatcher (done), KT Trưởng RBAC (done). Còn lại: đội_trưởng (sub-role of dispatcher), phó_giám_đốc (≈management) |
| BRD v2.2 | BRD v3.2 (updated BRD v3.2) | BRD | Đã sync — BRD v3.2: Bàn giao A/B/C, US-NEW-20 Import/Export Excel, trip status mở rộng, entity events 26 |
| API spec v1.0 | API spec v1.1 (updated session 11) | API | Đã sync — Session 11 |

---

## Database: 40+ bảng, 20 migration pairs (001-017)

**Migrations applied (20 pairs):** 001_init → 002_checklist → 003_cutoff_consolidation → 004_wms → 005_epod_payment → 006_zalo_confirm → 007_recon_dlq_kpi → 008_audit_log → 009_driver_checkin + 009_urgent_priority (hai file cùng số) → 010_order_confirmation + 010_order_number_seq + 010_workshop_phase6 (ba file cùng số) → 011_entity_events → 012_redelivery_vehicle_docs → 013_partial_payment_reject → 014_note_type_pinned → 015_eod_checkpoints → 016_notification_admin_rbac → **017_handover_records (MỚI — handover_records table + handover_type enum + 4 trip_status values)**

**Enums quan trọng (PostgreSQL):**
- `order_status` — 13 states
- `trip_status` — 17 states (thêm handover_a_signed, unloading_returns, settling, vehicle_breakdown)
- `stop_status` — 7 states

## User catalog rebuild (2026-04-24)

- Scripts added to inspect and rebuild the `users` catalog: [bhl-oms/scripts/rebuild_user_catalog.sql](bhl-oms/scripts/rebuild_user_catalog.sql), [bhl-oms/scripts/run_user_anomaly_report.py](bhl-oms/scripts/run_user_anomaly_report.py), and helper wrappers in `bhl-oms/scripts/`.
- Progress: anomaly-report generation and mapping helpers prepared; migration INSERT/COMMIT blocks are commented for manual review and staging apply. Follow `bhl-oms/scripts/README.md` for steps.

## Non-tech deploy helpers (2026-04-25)

- Added code-only deploy helper: `bhl-oms/deploy.ps1` + `bhl-oms/DEPLOY_CODE_ONLY.bat`.
- Added one-time full data sync helper: `bhl-oms/sync-full-data-once.ps1` + `bhl-oms/SYNC_FULL_DATA_TO_SERVER_ONCE.bat`.
- Added server-side restore helper: `bhl-oms/restore-full-data-once.sh`.
- Added USB transfer workflow for non-tech use: `bhl-oms/export-full-data-to-usb.ps1` + `bhl-oms/EXPORT_DATA_TO_USB.bat` on Windows, then `bhl-oms/IMPORT_ON_MAC.command` + `bhl-oms/import-full-data-from-usb.sh` on Mac.
- Workflow intent: first sync current local full DB lên Mac Mini để test, các lần sau chỉ deploy code qua Git + SSH, không restore full data nữa.
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

## Fleet & Driver Management (FMS+/DMS+) — ✅ Hoạt động (28 endpoints)

> **Scope:** BRD v3.6 Section 14C, TASK_TRACKER Phase 8 (30 tasks)  
> **Quyết định kiến trúc:** DEC-015  
> **Module:** `internal/fleet/` (models.go, repository.go, service.go, handler.go)

**Migrations đã apply (6):**
- 030_work_orders: enums (work_order_status, wo_trigger_type, wo_category, wo_priority), tables (work_orders, repair_items, repair_attachments), ALTER vehicles (health_score, last_health_check, current_km, year_of_manufacture, fuel_type)
- 031_garages: tables (garages, garage_ratings), FK work_orders.garage_id → garages.id
- 032_fuel_logs: enums (fuel_channel, fuel_anomaly_status), tables (fuel_logs, fuel_anomalies, fuel_consumption_rates + seed 6 types)
- 033_driver_scores: tables (driver_scores UNIQUE(driver_id, score_date), driver_score_snapshots), ALTER drivers ADD current_score
- 034_gamification: tables (gamification_badges, badge_awards UNIQUE(badge_id, driver_id, period_month)), seed 7 badge types
- 035_tire_leave: enums (leave_status, leave_type, tire_condition), tables (tire_sets, leave_requests), ALTER drivers ADD emergency_contact, annual_leave_days, used_leave_days

**Fleet endpoints (15):**
- POST/GET/PUT `/v1/fleet/work-orders` — Repair Order CRUD + filter
- POST `/v1/fleet/work-orders/:id/approve` — Approve (status validation)
- POST `/v1/fleet/work-orders/:id/complete` — Complete (triggers health recalc)
- GET/POST/PUT `/v1/fleet/garages` — Garage CRUD
- POST `/v1/fleet/garages/:id/rate` — Rate after RO complete
- GET `/v1/fleet/garages/benchmark` — Garage benchmark analytics
- GET/POST `/v1/fleet/fuel-logs` — Fuel log list + create (anomaly detection)
- GET `/v1/fleet/fuel-logs/anomalies` — Fuel anomalies list
- PUT `/v1/fleet/fuel-logs/anomalies/:id/resolve` — Resolve anomaly
- GET/POST/PUT `/v1/fleet/tyres` — Tire set CRUD per vehicle
- GET `/v1/fleet/vehicles/:id/health` — Vehicle health data
- GET `/v1/fleet/health-overview` — Fleet health overview (critical/warning/healthy)
- GET `/v1/fleet/tco/:vehicle_id` — Vehicle TCO (repair + fuel + tire costs)
- GET `/v1/fleet/tco/summary` — Fleet TCO summary
- GET `/v1/fleet/analytics/cost` — Cost analytics (top vehicles, category breakdown)

**Driver endpoints (8):**
- GET `/v1/drivers/:id/scorecard` — Driver scorecard (5 metrics + rank + badges + history)
- GET `/v1/drivers/leaderboard` — Leaderboard (week/month toggle)
- GET `/v1/drivers/:id/badges` — Driver badge awards
- GET `/v1/drivers/gamification/bonus-report` — Bonus report (badges × value)
- POST/GET `/v1/drivers/:id/leave-requests` — Leave request CRUD
- PUT `/v1/drivers/leave-requests/:id/approve` — Approve leave
- GET `/v1/drivers/:id/fuel-logs` — Driver fuel log history

**Business logic:**
- Emergency RO auto-approve: ≤ 5M VNĐ
- Health Score rule-based: -10/open RO, -15/overdue maintenance, -5/-10 for age
- Fuel anomaly detection: expected = distance × base_rate × factors, flag if >25% deviation
- Driver Score: OTD 30%, Delivery 25%, Safety 25%, Compliance 10%, Customer 10%
- Gamification: 7 badge types (top_driver, otd_champion, safe_driver, fuel_saver, streak_30, epod_master, milestone_100)

**Frontend pages (7):**
- `/dashboard/fleet/repairs` — Work orders list with status/category filters
- `/dashboard/fleet/fuel` — Fuel logs + anomalies (2 tabs)
- `/dashboard/fleet/garages` — Garage cards with rating + specialties
- `/dashboard/fleet/health` — Vehicle health overview (critical/warning/healthy)
- `/dashboard/fleet/scorecard` — Driver scorecard (score breakdown + badges + history)
- `/dashboard/fleet/leaderboard` — Driver leaderboard (week/month)
- `/dashboard/fleet/tco` — TCO cost analytics per vehicle

**Bỏ khỏi scope:** US-TMS-28 (HOS), US-TMS-30 (Shift), US-TMS-35 (Spare Parts), OCR PaddleOCR
- vehicle_maintenance_schedules + records ✅ (schema+API, chưa cron auto-overdue)
- Cost Engine + toll/fuel/driver rates ✅
- Entity Events system (26 event types) ✅

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
