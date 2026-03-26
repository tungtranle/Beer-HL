# CHANGELOG — BHL OMS-TMS-WMS

> Track actual code changes vs spec. Updated after each task completion.  
> **Quy tắc:** Mỗi entry phải có section "Docs Updated" liệt kê file docs đã cập nhật.

---

## [Unreleased] — Phase 6 complete + UX Overhaul v4 + UX v5 full

### 2026-03-26 — Session: VRP Optimization Demo Scenario

#### Fixed — VRP Utilization: 52% → 98.1% (Definitive Algorithm Rewrite)
- **`internal/tms/service.go` — `buildMockResult()`:** Viết lại hoàn toàn Phase 1-2 với thuật toán "Pack-First, Route-Later":
  - **ROOT CAUSE trước đó:** Sector-based packing + time constraint during packing → quá nhiều bin thưa, 1-stop trip 2948km
  - **Thuật toán mới:**
    1. **Global FFD:** Sort ALL geos by weight DESC (không chia sector) → best-fit decreasing vào bin có ít chỗ trống nhất
    2. **Vehicle-on-open:** Khi mở bin mới, chọn xe NHỎ NHẤT vừa đủ (`vPool` sắp ASC, first-fit) → bin 4200kg mở xe 5T (84%), không mở 15T (28%)
    3. **No time/geo constraint during packing:** Chỉ pack theo trọng lượng. Nearest-neighbor ordering sau
    4. **Split delivery:** Khi không bin/xe nào chứa hết → tách vào bin có nhiều chỗ trống nhất
  - **Self-test SC-09 (300 đơn, ~245T, 50 xe):**
    - Before: 50 trips, 52% util, grade D (27/100)
    - After: **48 trips, 98.1% util**, 0 unassigned, 82 consolidated stops
    - Xe 8T: 99%+, xe 5T: 99%+, xe 3.5T: 97%+
  - Removed: sector-based clustering, `estimateTime` during packing, virtual-cap-then-right-size approach
  - Removed unused vars: `maxTripMin`, `timeLimitEnabled`, `clusterEnabled`, `packAggression`
- **`cmd/_test_vrp/main.go`:** Test script tự động: login → load SC-09 → run VRP → kiểm tra ≥85%

#### Added — VRP Auto-Consolidation + Split Delivery
- **`internal/tms/service.go` — `buildMockResult()`:** Thêm Phase 0 (consolidation) + split delivery vào bin-packing:
  - **Phase 0 — Ghép đơn:** Nhóm shipment theo `CustomerID` → tạo virtual consolidated node với tổng trọng, giữ DS shipment gốc
  - **Split Delivery:** Khi đơn quá nặng không vào bin nào nguyên vẹn, tách ra: phần vào bin có chỗ, phần còn lại sang bin/xe khác
  - **Min split:** 100kg — không tách nhỏ hơn mức này
  - **Split tracker:** Theo dõi customer bị tách bao nhiêu phần, backfill `splitTotal` sau khi xong
  - **Phase 3 expand:** Consolidated node expand ra individual stops với `ConsolidatedIDs` list, split stops có `IsSplit`/`SplitPart`/`SplitTotal`/`OriginalWeightKg`
- **`internal/domain/models.go`:** VRPStop thêm 6 fields (WeightKg, ConsolidatedIDs, IsSplit, SplitPart, SplitTotal, OriginalWeightKg); VRPSummary thêm 2 fields (ConsolidatedStops, SplitDeliveries)
- **`web/src/app/dashboard/planning/page.tsx`:** Hiển thị badges:
  - 📦×N (tím) cho điểm ghép đơn — "N đơn cùng NPP gộp 1 điểm giao"
  - ✂️ X/Y (cam) cho tách đơn — "Phần X trong tổng Y phần"
  - Badges hiển thị ở: trip sidebar, map popup, bảng chỉnh sửa điểm (Step 5)
  - Quality panel: thêm khối "Ghép đơn: N điểm" + "Tách đơn: N lần tách" khi có data

#### Improved — VRP Geographic Clustering + 8h Time Constraint
- **`internal/tms/service.go` — `buildMockResult()`:** Rewrite hoàn toàn thuật toán VRP mock:
  - **3-phase algorithm:** geo-cluster (angular sweep) → capacity bin-pack (best-fit) → nearest-neighbor ordering
  - **Configurable criteria:** 6 tiêu chí có priority 1-6 + bật/tắt, gửi từ frontend
  - **Configurable time limit:** user chọn số giờ/chuyến (default 8h), backend nhận `max_trip_minutes`
  - **Best-fit packing:** thay vì first-fit vào bin cuối, tìm bin có util% cao nhất → tối đa tải trọng
  - **Post-process merge:** bins dưới 30% tải tự động merge vào bin khác → giảm số xe
  - **`VRPCriteria` struct mới:** `max_capacity`, `min_vehicles`, `cluster_region`, `min_distance`, `round_trip`, `time_limit` (priority 1-6), `max_trip_minutes`
  - **`RunVRPRequest`** thêm field `criteria *VRPCriteria`

#### Added — VRP Criteria UI (Drag-to-Reorder + Time Config)
- **`web/src/app/dashboard/planning/page.tsx`:** Thay thế grid toggle cũ bằng danh sách kéo thả:
  - Kéo ↕ để thay đổi thứ tự ưu tiên (1 = cao nhất)
  - Bấm ✓/✗ để bật/tắt từng tiêu chí
  - Nút +/- chỉnh giờ/chuyến ngay trên dòng "Giới hạn thời gian" (2h-24h)
  - Frontend gửi `criteria` object cùng `max_trip_minutes` trong API request
- **Fix type error:** `getUser()?.token` → `getToken()` trong reconciliation + trips page

#### Added — VRP Quality Assessment Panel
- **`web/src/app/dashboard/planning/page.tsx`:** Panel đánh giá chất lượng VRP mở sẵn (open by default)
  - 6 metrics: tỷ lệ xếp, tải trọng TB, quá tải, km/điểm giao, quá 8h, km/chuyến TB
  - Overall grade A/B/C/D (5 dimensions: assign + util + overload + underutil + route)
  - Vehicle type breakdown table
  - Auto-suggestions khi phát hiện vấn đề (8h vượt, distance quá cao, etc.)

#### Fixed — VRP Mock Overload Bug
- **`internal/tms/service.go` — `buildMockResult()`:** Khi VRP Python solver không chạy (port 8090), Go fallback mock **ép hàng quá tải** khi hết xe → đơn không xếp được giờ vào `unassigned` thay vì overload
- **Ngọn nguồn:** else branch "All vehicles full" không check capacity, nhét thẳng vào xe ít tải nhất

#### Fixed — SC-09 Weight vs Fleet Capacity Mismatch
- **`internal/testportal/scenarios.go`:** SC-09 tạo ~695T hàng nhưng fleet WH-HL chỉ có 284T (50 xe: 20×3.5T + 18×5T + 8×8T + 4×15T)
- **Sửa:** Giảm weight tiers để tổng ~245T (86% fleet capacity):
  - XS: 40-120kg (100 đơn) | S: 200-400kg (80 đơn) | M: 500-900kg (60 đơn)
  - L: 1200-2400kg (40 đơn) | XL: 3500-6500kg (20 đơn)
- **Sửa metadata:** Fleet info từ "70 xe" → "50 xe WH-HL (284T capacity)"

#### Docs Updated
- CHANGELOG.md (this entry)
- CURRENT_STATE.md — Test Portal section updated

### 2026-03-25 — Session: Notification Audit + BRD Gap Implementation

#### Fixed — Notification Link Audit (12 links fixed)
- **`internal/tms/service.go`:** Removed `/dashboard/` prefix from ALL 11 notification links:
  - Plan approved → warehouse (`/warehouse/picking`), driver (`/driver`)
  - Trip started/failed/completed → dispatcher (`/control-tower`)
  - Trip completed → accountant (`/reconciliation`)
  - NPP rejected → dispatcher + accountant
  - EOD checkpoint/confirmed/rejected → receiver + driver
- **`internal/wms/service.go`:** Removed `/dashboard/` prefix from picking completed notification → dispatcher (`/warehouse`)
- **Root cause:** NotificationBell.tsx `handleClick` prepends `/dashboard` — so links stored with `/dashboard/` resulted in `/dashboard/dashboard/...` = 404

#### Added — Notification Icons for EOD & Document Expiry
- **`web/src/components/NotificationBell.tsx`:** Added `categoryIcons` for `eod_checkpoint` (📋), `eod_confirmed` (✅), `eod_rejected` (❌), `document_expiry` (📄)

#### Added — TMS & Reconciliation Excel Export (BRD US-NEW-20)
- **`internal/tms/excel.go` (NEW):** GET `/v1/trips/export` — exports trips to .xlsx with 2 sheets (Chuyến xe + Điểm giao), Vietnamese status labels, BHL orange headers
- **`internal/reconciliation/excel.go` (NEW):** GET `/v1/reconciliation/export` — exports reconciliations with type/status Vietnamese labels
- **`web/src/app/dashboard/trips/page.tsx`:** Added "📥 Xuất Excel" export button
- **`web/src/app/dashboard/reconciliation/page.tsx`:** Added "📥 Xuất Excel" export button

#### Added — ePOD Photo Server Enforcement (BRD US-TMS-13 AC#5)
- **`internal/tms/service.go` SubmitEPOD:** Server-side validation requires ≥ 1 photo (`photo_urls` non-empty), returns error "cần ít nhất 1 ảnh chứng từ giao hàng"

#### Added — Credit Limit Audit Trail (BRD US-OMS-07 AC#8)
- **`internal/admin/service.go` UpdateCreditLimit:** Records `entity_events` with old→new diff for credit_limit and effective_to changes
- **`internal/admin/handler.go`:** Passes actor_id + actor_name to service for audit trail

#### Added — Redelivery Report (BRD US-TMS-14b AC#6)
- **`internal/kpi/service.go`:** `GetRedeliveryReport` — queries delivery_attempts with summary (total, avg attempts/order, top failure reasons)
- **`internal/kpi/handler.go`:** GET `/v1/kpi/redeliveries?from=&to=&limit=` — new KPI report endpoint

#### Fixed — Credit Limit Expiry Cron SQL Error
- **`internal/admin/service.go` CheckCreditLimitExpiry:** Fixed `EXTRACT(DAY FROM cl.effective_to - CURRENT_DATE)` → `(cl.effective_to - CURRENT_DATE)`. PostgreSQL `DATE - DATE` returns integer directly, EXTRACT expects interval/timestamp — was causing `pg_catalog.extract(unknown, integer)` function type mismatch error.

#### Docs Updated
- CHANGELOG.md (this entry)
- CURRENT_STATE.md — Updated TMS (export, ePOD enforcement), Reconciliation (export), KPI (redeliveries), Admin (credit audit trail), Notification (link audit)

### 2026-03-25 — Session: Excel Import/Export + Handover Flow Fix

#### Added — Excel Import/Export (US-NEW-20)
- **Backend `internal/oms/excel.go` (NEW):**
  - `ExportOrders` handler — GET `/v1/orders/export`, exports all orders to .xlsx with Vietnamese headers, BHL orange header style (#F68634), Vietnamese status labels
  - `DownloadImportTemplate` handler — GET `/v1/orders/import/template`, generates template with example row + "Hướng dẫn" (instructions) sheet
  - `ImportOrders` handler — POST `/v1/orders/import` with multipart file upload, validates customers/products, groups rows into orders
  - `ImportOrders` service method — groups rows by (customer_code, warehouse_id, delivery_date), validates each field, creates orders via `CreateOrder`
- **Backend `internal/oms/handler.go`:** Registered 3 Excel routes (export, import/template, import)
- **Frontend `web/src/app/dashboard/orders/page.tsx`:**
  - Added "📥 Xuất Excel" and "📤 Import Excel" buttons in header
  - Import modal with: template download, file upload (.xlsx), result display (success/error per row)
  - Export downloads file as `don-hang-YYYY-MM-DD.xlsx`
- **Dependency:** Added `github.com/xuri/excelize/v2` v2.10.1

#### Fixed — Handover A Flow from Picking Page
- **picking-by-vehicle/page.tsx:** "Tạo biên bản bàn giao xuất kho" button now:
  - Stores trip data + picked items in sessionStorage
  - Navigates to `/dashboard/handover-a?trip_id=xxx` (was plain `/dashboard/handover-a` with no context)
- **handover-a/page.tsx — Full rewrite of create flow:**
  - Reads `trip_id` from URL searchParams → auto-selects trip, auto-populates items
  - Items table with editable actual_qty (pre-filled from picking data): product_name, product_sku, expected_qty, actual_qty, match indicator
  - Sends items array in POST body to `/warehouse/handovers` (was missing before)
  - Auto-signs warehouse_handler role after creation (no extra click needed)
  - After creation, auto-navigates to detail view showing 3-party signing status
  - Detail view now shows: items table with match/mismatch, signing status per party (Thủ kho/Tài xế/Bảo vệ), confirm buttons for unsigned roles, photos, notes
  - 3-party confirm flow: warehouse auto-signed → driver + security see "Xác nhận" buttons

#### Docs Updated
- CHANGELOG.md (this entry)

### BRD v3.2 — Bàn giao A/B/C + Trip Status Mở rộng + Import/Export Excel

#### Changed — BRD_BHL_OMS_TMS_WMS.md (v3.1 → v3.2)
- **Header:** v3.1 → v3.2, NPP Portal 300 → 800 users
- **Section 2.2:** To-Be flow updated — Bàn giao A/B/C thay gate-check
- **Section 3:** R04/R15 hạn mức tùy chọn 4 trường hợp; R16/R17/R18 mới cho Bàn giao A/B/C
- **Section 4:** US-OMS-01 4 hạn mức cases; US-OMS-02a thuật ngữ; US-OMS-07 optional hạn mức
- **Section 5:** US-TMS-01 manual planning + VRP criteria; US-TMS-17 Bàn giao B/C signatures; Trip Status Flow thêm handover_a_signed, vehicle_breakdown
- **Section 6:** WMS overview (no PDA outbound); US-WMS-03 Bàn giao A 3-party; US-WMS-04 barrier post-Handover A; US-WMS-15 PDA only inbound+inventory; US-WMS-22 Bàn giao B
- **Section 12:** Timeline layers updated (Layer 6→Bàn giao A, Layer 10→Bàn giao B/C); 12.2 event mapping; 12.4 acceptance criteria
- **Section 14B:** US-NEW-11 events 23→26; Thêm US-NEW-20 Import/Export Excel
- **Section 15:** UAT #10 updated cho Bàn giao A/B/C

#### Added — Backend Code
- **Migration 017:** `handover_records` table + `handover_type` enum + 4 trip_status values (handover_a_signed, unloading_returns, settling, vehicle_breakdown)
- **Domain model:** `HandoverRecord` struct in `internal/domain/models.go`
- **Events:** 3 new constants — `handover.a_signed`, `handover.b_signed`, `handover.c_signed` + builder helpers
- **Trip transitions:** `validTripTransitions` mở rộng — thêm handover_a_signed, vehicle_breakdown, unloading_returns, settling states
- **WMS endpoints (4 mới):**
  - POST `/v1/warehouse/handovers` — tạo bàn giao A/B/C
  - POST `/v1/warehouse/handovers/:id/sign` — ký bàn giao (multi-party)
  - GET `/v1/warehouse/handovers/trip/:tripId` — list bàn giao theo chuyến
  - GET `/v1/warehouse/handovers/:id` — chi tiết bàn giao
- **Repository:** `CreateHandoverRecord`, `GetHandoverRecord`, `GetHandoversByTrip`, `UpdateHandoverSignatories`
- **Service:** `CreateHandover`, `SignHandover`, `GetHandoversByTrip`, `GetHandoverRecord`

#### Docs Updated
- CURRENT_STATE.md (migration 017, WMS 20→24 endpoints, trip_status 13→17, BRD v3.2 ref)
- BRD_BHL_OMS_TMS_WMS.md (v3.2)
- CHANGELOG.md (this entry)

### 2026-03-25 — Session: Documentation Audit & Sync

#### Changed — CURRENT_STATE.md (source of truth sync)
- **Header:** Date → 25/03/2026
- **Admin section:** 16 → 30 endpoints — added RBAC (permissions CRUD, user overrides), sessions (list, revoke), audit-log diff
- **TMS section:** 50+ → 55 endpoints — added EOD checkpoint module (6 endpoints), trip cancel, move stop, exceptions, control-tower stats; detailed Vehicle/Driver counts
- **WMS section:** 28 → 20 endpoints (corrected to match actual routes)
- **Reconciliation section:** 12 → 10 endpoints with detailed endpoint breakdown
- **Integration section:** 18 → 19 endpoints with detailed breakdown (Bravo 3, DMS 1, Zalo 1, Delivery Confirm 2, NPP Portal 3, Order Confirm Portal 4, DLQ 4, Config 1)
- **Notification section:** 5 → 6 endpoints + documented 4-Layer Delivery System (Layer 1-4)
- **TestPortal section:** 18 → 21 endpoints (data overview 8, test actions 7, GPS simulation 6)
- **Frontend section:** 42 → 44 pages (added settings/permissions, settings/credit-limits)
- **Database section:** 38+ tables/17 files → 40+ tables/19 migration pairs; added 015_eod_checkpoints + 016_notification_admin_rbac
- **Spec drift table:** BRD v3.0 → v3.1 reference

#### Changed — BRD_BHL_OMS_TMS_WMS.md (v3.0 → v3.1)
- **Version:** 3.0 → 3.1, date → 25/03/2026
- **Section 9.2:** Action-level RBAC `[ ] Chưa triển khai` → `[◐] Partial — PermissionGuard middleware + role_permissions + user_permission_overrides`
- **Section 11.4:** P1 toast persistent `[ ]` → `[x]` (PersistentToast component, Session 24/03)
- **Section 11 status:** Updated — 4-Layer Delivery System đã triển khai
- **US-NEW-13:** Test Portal endpoints 13 → 21
- **US-NEW-14 (NEW):** Notification 4-Layer Delivery System
- **US-NEW-15 (NEW):** Admin Dynamic RBAC + Session Management
- **US-NEW-16 (NEW):** End-of-Day (EOD) Checkpoint System
- **US-NEW-17 (NEW):** Vehicle/Driver Document Management
- **US-NEW-18 (NEW):** Sentry Error Tracking
- **US-NEW-19 (NEW):** Control Tower Enhancements

#### Docs Updated
- `CURRENT_STATE.md` — Full audit, all module endpoint counts corrected
- `BRD_BHL_OMS_TMS_WMS.md` — v3.1, 6 new user stories, RBAC/notification status fixed
- `CHANGELOG.md` — This entry

### 2026-03-24 — Session: Notification 4-Layer + Admin RBAC Module

#### Added — Notification System 4-Layer Delivery
- **Migration 016:** `actions JSONB`, `group_key TEXT` columns on notifications; `role_permissions`, `user_permission_overrides`, `active_sessions` tables with seed data (96 permissions)
- **Backend:** `notification/repository.go` — `GetGrouped()`, `GetByCategory()`; `notification/service.go` — `SendWithActions()`, `GetGroupedNotifications()`, `GetByCategory()`; `notification/handler.go` — `GET /v1/notifications/grouped`
- **Frontend PersistentToast.tsx** — urgent priority: manual dismiss, max 3 stacked, inline action buttons via apiFetch, brand #F68634
- **Frontend AutoToast.tsx** — high priority: 8s auto-dismiss with progress bar, deep links via router.push
- **NotificationProvider** (`notifications.tsx`) — 4-layer routing: urgent→PersistentToast, high→AutoToast, normal/low→bell+panel only; auto-toast queue for sequential display
- **NotificationBell.tsx** — filter chips (Tất cả/OMS/TMS/WMS/Đối soát/Hệ thống), brand #F68634 unread dot (was bg-amber-500), priority badges
- Removed old `NotificationToast` from dashboard layout (replaced by new toast system)

#### Added — Admin Dynamic RBAC + Session Management
- **`admin/repository.go`** (NEW) — full RBAC repo: `GetAllRolePermissions`, `UpsertRolePermission`, `GetUserOverrides`, `UpsertUserOverride`, `DeleteUserOverride`, `ListActiveSessions`, `RevokeSession`, `RevokeAllUserSessions`, `GetEffectivePermissions`, `WriteAuditLog`, `GetAuditLogs`, `GetAuditLogByID`, `GetSystemConfigs`, `UpsertSystemConfig`, `ListCreditLimits`
- **`admin/service.go`** — added repo field, RBAC methods (`GetPermissionMatrix`, `UpdateRolePermission` with audit + cache invalidation), session management, audit log pagination/diff
- **`admin/handler.go`** — routes: `GET/PUT /permissions`, user overrides CRUD, `GET/DELETE /sessions`, `GET /audit-logs/:id/diff`
- **`middleware/auth.go`** — `PermissionGuard(resource, action, db, rdb)`: Redis cache (300s TTL) + DB fallback, admin bypasses all checks
- **`cmd/server/main.go`** — wired `adminRepo` into admin module init

#### Added — Admin Frontend Pages
- **`settings/permissions/page.tsx`** — Permission Matrix Editor: role tabs, resource×action grid, inline toggle, optimistic update, filter by resource
- **`settings/page.tsx`** — added "Phiên đăng nhập" tab (active sessions list, revoke single/all), link to Permission Matrix
- **`settings/audit-logs/page.tsx`** — added Diff modal: field-level old/new comparison, before/after JSON display, ESC to close
- **Dashboard layout** — added Shield icon + "Phân quyền" link in sidebar nav

#### Docs Updated
- CHANGELOG.md (this entry)

### 2026-03-23 — Session: Sentry + Test Portal security

#### Added — Sentry error tracking
- **Sentry Frontend (Next.js):** `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, `global-error.tsx` — DSN configured, Session Replay 10% + 100% on error, Performance tracing 30%
- **Sentry Backend (Go/Gin):** `sentry-go` + `sentrygin` middleware — captures panics and errors, tracing 30%
- **Config:** `SentryDSN` env var in `config.go`, `SENTRY_DSN` env variable
- **`next.config.js`:** Wrapped with `withSentryConfig()`

#### Changed — Test Portal security guard
- **`ENABLE_TEST_PORTAL` env flag:** Default `true` (dev), set `false` to disable on production
- **`config.go`:** Added `EnableTestPortal` field
- **`main.go`:** Test portal routes only registered when `EnableTestPortal=true`, logs `test_portal_disabled` otherwise

#### Changed — Production deployment
- **`docker-compose.prod.yml`:** Added `SENTRY_DSN`, `ENABLE_TEST_PORTAL` env vars; mounted `./migrations` into postgres container
- **`nginx.conf`:** Added `bhl.symper.us` as server_name alongside `oms.bhl.vn`
- **`docs/DEPLOY_GUIDE.md`:** New — hướng dẫn deploy, fix bug, bật test-portal, xem Sentry (non-tech friendly)

### 2026-03-22 — Session: UX v5 full — §17-§23 implementation

#### Added — 7 remaining v5 features
- **§22 note_type fix:** Migration 014 (note_type VARCHAR, is_pinned BOOLEAN on order_notes), backend supports 4 note types (internal/npp_feedback/driver_note/system), pin/unpin endpoints
- **§17 PinnedNotesBar:** Component showing top-3 pinned notes with amber styling, unpin button
- **§19 WaitingForBanner:** Sticky banner showing "Đang chờ ai" per order status (10 statuses mapped)
- **§20 CreditAgingChip:** Credit aging indicator (>7d amber, >14d light red, >30d solid red)
- **§23 TimelineKPIBar:** 4 KPI cards (processing time, cutoff, trip info, recon status)
- **§18 Notes inline Timeline:** OrderTimeline merged events+notes, inline note composer, pin toggle, NOTE_STYLE per type
- **§21 Duration Chips Enhanced:** Color-coded duration chips (gray <30min, amber 30min-2h, red >2h)

#### Changed
- Order detail page: removed separate "Ghi chú" tab → notes now inline in "Lịch sử & Ghi chú" tab
- Order detail page: added WaitingForBanner + PinnedNotesBar above order info, CreditAgingChip next to StatusChip, TimelineKPIBar in timeline tab

#### New endpoints
- `PUT /v1/orders/:id/notes/:noteId/pin` — pin a note
- `DELETE /v1/orders/:id/notes/:noteId/pin` — unpin a note

#### Docs Updated
- `CURRENT_STATE.md` — migration 014, new endpoints, new components
- `CHANGELOG.md` — this entry

### 2026-03-22 — Session: UX v5 delta — Picking by Vehicle + Spec

#### Added — UX Vibe Coding Spec v5 (8 new features from UX Analysis)
- **Picking by Vehicle (Backend):** `GET /v1/warehouse/picking-by-vehicle?date=` — aggregated products per vehicle with FEFO, per-stop orders, progress percentage
- **Picking by Vehicle (Frontend):** `/dashboard/warehouse/picking-by-vehicle` — 4 KPI cards, filter tabs, expandable vehicle cards, FEFO badges (🔥 Pick trước!), progress bars, per-stop order breakdown
- **Warehouse dashboard nav:** Added "🚛 Soạn theo xe" shortcut with brand border (#F68634)
- **UX Vibe Coding Spec v5:** `docs/specs/BHL_UX_VIBE_CODING_SPEC_v5.md` — §16-§23: Picking by Vehicle, PinnedNotes, Notes inline Timeline, "Đang chờ ai" banner, Credit Aging Chip, Duration Chips, note_type fix, Timeline KPI Bar

#### Docs Updated
- `CURRENT_STATE.md` — WMS endpoints 27→28, new Picking by Vehicle page
- `CHANGELOG.md` — this entry
- `docs/specs/BHL_UX_VIBE_CODING_SPEC_v5.md` — NEW file (delta from v4)

### 2026-03-22 — Session: UX Overhaul v4 (6 phases)

#### Added — UX Overhaul theo BHL_UX_VIBE_CODING_SPEC_v4
- **Phase 1:** `useToast` hook + `ToastContainer` thay thế tất cả `alert()` | `formatVND()` thay `formatMoney()` toàn bộ
- **Phase 2:** Toast + traceRef across 20+ pages (orders, planning, trips, warehouse, drivers, kpi, reconciliation, gate-check, approvals, control-tower)
- **Phase 3:** Driver UX — h-12/h-14 tap targets, anti double-submit pattern
- **Phase 4:** Brand color #F68634 consistency — 83+ violations fixed (bg-amber-600/bg-blue-600 → bg-[#F68634])
- **Phase 5:** T+1 countdown (approvals page), FEFO "Pick trước" badge (warehouse page)
- **Phase 6:** Role-aware empty states (driver, warehouse, gate-check, approvals, orders, reconciliation)
- **New components:** `StatusChip.tsx`, `CountdownDisplay.tsx`, `InteractionModal.tsx`
- **Backend:** `pkg/safego/safego.go` — goroutine wrapper with panic recovery
- **Files modified:** 20+ dashboard pages, 4 new components, status-config.ts expanded to 16 statuses
- **next.config.js:** Proxy → localhost:8083

#### Docs Updated (UX Overhaul)
- `CURRENT_STATE.md`: Ports 8083/3005, UX components section
- `CHANGELOG.md`: This entry
- `CLAUDE.md`: Updated earlier with v4 spec references

---

### 2026-03-22 — Session: Bug fixes + Order Timeline Redesign + Status Sync

#### Fixed — CompleteTrip silent failure
- **Bug:** `CompleteTrip` backend rejected `partially_delivered` stop status → frontend caught error but only logged to console (no UI feedback)
- **Fix:** Added `partially_delivered` to terminal statuses set in `tms/service.go`
- **Fix:** Frontend `handleCompleteTrip` now shows alert on error instead of silent `console.error`
- **File:** `internal/tms/service.go`, `web/src/app/dashboard/driver/[id]/page.tsx`

#### Fixed — Order status stays at "Đang xử lý" during delivery
- **Bug:** `StartTrip` didn't update order statuses from `processing` to `in_transit` → orders stayed at "Đang xử lý" on the list page even when driver was delivering
- **Fix:** `StartTrip` now updates all trip’s order statuses to `in_transit` + records entity events
- **File:** `internal/tms/service.go`

#### Added — Event Recorder in TMS
- **TMS Service** now has `evtRecorder *events.Recorder` field + `SetEventRecorder()` setter
- **CompleteTrip** records `order.status_changed` events for each order when trip completes
- **StartTrip** records `order.in_transit` events with driver name + trip number
- **Wired** in `cmd/server/main.go`: `tmsSvc.SetEventRecorder(eventRecorder)`

#### Redesigned — Order Timeline (world-class)
- **Grouped by date:** Events grouped into "Hôm nay", "Hôm qua", dated sections
- **Filter tabs:** Tất cả / Trạng thái / Giao hàng / Ghi chú (with counts)
- **Summary banner:** Total events count, date range, total duration
- **Duration chips:** Time elapsed between consecutive events ("⏱ 15 phút sau")
- **Rich detail cards:** Actor role badges, status transition pills (old → new with Vietnamese labels), financial amounts, redelivery indicators, note content in amber cards
- **Absolute + relative timestamps:** Full datetime + "5 phút trước" indicator
- **File:** `web/src/components/OrderTimeline.tsx`

#### Docs Updated
- `CURRENT_STATE.md`: Updated frontend sections with new components
- `CHANGELOG.md`: This entry

#### Changed — "Tạo giao lại" → "Giao bổ sung" (Audit Session 22/03)
- **Bỏ:** `rejected` và `delivered` khỏi danh sách trạng thái cho phép giao bổ sung
- **Lý do:** Đơn hàng bị KH từ chối (rejected) → nên hủy hẳn và tạo đơn mới. Đơn đã giao (delivered) → không cần giao lại.
- **Chỉ còn:** `partially_delivered` (giao thiếu → giao bổ sung) và `failed` (giao thất bại → giao lại)
- **UI:** Button đổi từ "🔄 Tạo giao lại" (rose-600) → "📦 Giao bổ sung" (brand #F68634), context message theo trạng thái
- **Files:** `internal/oms/service.go`, `web/src/app/dashboard/orders/[id]/page.tsx`

#### Added — Code Compliance Audit (TD-018 ~ TD-025)
- **Kiểm tra toàn bộ codebase:** 200+ vi phạm phát hiện trong 37 files
- **TECH_DEBT.md:** Ghi nhận 8 mục mới (TD-018 đến TD-025)
- **CURRENT_STATE.md:** Thêm section "Code Compliance Audit" 
- **Quy tắc:** Sẽ dần fix khi chạm vào file liên quan trong features mới, KHÔNG refactor riêng lẻ

#### Added — Localhost verification rule
- **CLAUDE.md:** Rule #11 — BẮT BUỘC verify localhost sau mỗi code change
- **doc-update-rules.instructions.md:** Mục #0 cuối session — verify trước khi báo "đã xong"
- **User memory:** Ghi nhớ vĩnh viễn qua mọi session

#### Docs Updated (Audit)
- `CURRENT_STATE.md`: Cập nhật toàn diện — port 8081/3003, 16 migrations, 32 OMS endpoints, 50+ TMS endpoints, 27 WMS endpoints, 42 frontend pages, code compliance section
- `TECH_DEBT.md`: TD-018~TD-025 (float64, testportal, console.error, fetch, timezone, ::text, logging, repository)
- `CLAUDE.md`: Rule #11 localhost verify, checklist mục #0, compounding engineering
- `CHANGELOG.md`: This entry

---

### 2026-03-21 — Session 19g (cont): Phase 6 Implementation (18/18 tasks)

#### Added — P0: Kế toán Recon Workbench (6.1–6.3)
- **T+1 countdown badge:** Discrepancy table shows deadline countdown, red animated pulse when < 2h, auto-refresh every 60s
- **Split view tiền-hàng-vỏ:** Sub-tabs (Tất cả/💰Tiền/📦Hàng/🏷️Vỏ) with per-type count badges
- **Action history:** Backend `GET /reconciliation/discrepancies/:id/history` endpoint, 📜 button opens history modal, entity_events recorded on resolve

#### Added — P0: Workshop Role (6.4–6.5)
- **Migration 010:** `bottle_classifications` table, `is_chief_accountant` BOOLEAN on users
- **Workshop role:** New role with `bottles:read`, `bottles:write` permissions in admin/service.go
- **Bottle classification:** `POST /warehouse/bottles/classify`, `GET /warehouse/bottles/summary` endpoints
- **Workshop page:** Full frontend `/dashboard/workshop` with classify form + summary view

#### Added — P1: Admin Improvements (6.6–6.7)
- **Audit log diff:** `UpdateConfigs` records before/after values to entity_events; `ConfigDiffView` component shows red strikethrough → green highlight per key
- **Credit limit expiry cron:** `RunCreditLimitExpiryCron()` (6h ticker), `GET /admin/credit-limits/expiring` API, entity_events alerts for expiring limits

#### Added — P1: BGĐ + DVKH (6.8–6.10)
- **KPI drill links:** Clickable KPI cards → `router.push` to filtered views (planning, orders?status=rejected, reconciliation)
- **Zalo link:** `https://zalo.me/{phone}` in order detail customer info section
- **ePOD photos tab:** New tab in order detail showing image grid of ePOD photos

#### Added — P1: Warehouse + Security (6.11–6.13)
- **Picking queue view:** Priority badge "Soạn trước" (brand-colored) for first pending item, ring highlight
- **Gate check queue:** `GET /warehouse/gate-check-queue` endpoint + frontend queue display with amber count badge + pulse animation
- **Mandatory fail reason:** Dropdown required on gate check fail (6 types: Thiếu hàng/Thừa hàng/Hàng hư hỏng/Sai sản phẩm/Sai số lượng/Khác)

#### Added — P2: Dispatcher + RBAC (6.14–6.17)
- **Exception descriptions:** Vietnamese `exceptionTypeDescription` map (late_eta, idle_vehicle, failed_stop, no_checkin) shown as italic gray text in control tower alerts
- **Bulk move stops:** Multi-select checkboxes on stops list + "Chuyển N điểm →" button + bulk move modal with trip selector
- **Action-level RBAC:** `IsChiefAccountant(ctx, userID)` check in ResolveDiscrepancy handler; 403 for non-chief accountants
- **Fleet tab:** Trips/fleet toggle in dispatcher left column; fleet view shows vehicles with speed, status dot (green/amber/gray), click opens driver modal

#### Evaluated — P3 (6.18)
- **Native mobile:** Evaluated — PWA đủ cho go-live, native app đánh giá lại sau 3 tháng production

#### Docs Updated
- `TASK_TRACKER.md`: All 18 Phase 6 tasks marked ☑, 119/128 (93.0%)
- `CHANGELOG.md`: This entry
- `CURRENT_STATE.md`: Updated (pending)

---

### 2026-03-21 — Session 19g: Gap Analysis → Phase 6 Planning

#### Analysis
- **UX Gap Analysis:** Phản biện 11 role gaps từ bảng đề xuất. Điều chỉnh priorities: 6 items hạ mức (Admin P0→P1, Dispatcher P0→P2, DVKH P0→P1, KT Trưởng P0→P2, Đội trưởng P1→P2, Tài xế P0→P3), 2 giữ P0 (Kế toán recon, Phân xưởng).
- **Phase 6 created:** 18 tasks (5 P0 + 8 P1 + 5 P2/P3). Tổng tasks: 110 → 128.
- **Key decisions:** DEC-010 (priority adjustments), DEC-011 (workshop sub-role).

#### Added
- **GPS Simulation Test Portal (Session 19f cont.):**
  - 5 backend endpoints: GET scenarios, GET vehicles, POST start, POST stop, GET status
  - 7 predefined scenarios: normal delivery (5 xe), rush hour (10 xe), GPS lost signal, idle vehicle, speed violation, long route QN→HP, from active DB trips
  - Frontend tab "📡 Giả lập GPS" in Test Portal: scenario cards, vehicle multi-select, interval slider, live status panel
  - Data flow: Test Portal → Redis HSET + PUBLISH → WebSocket hub → Control Tower map

#### Docs Updated
- `TASK_TRACKER.md`: Added Phase 6 (18 tasks), updated totals (128 tasks, 78.9%)
- `DECISIONS.md`: Added DEC-010 (gap priority adjustments), DEC-011 (workshop sub-role)
- `TECH_DEBT.md`: Added TD-014 (action-level RBAC), TD-015 (data-scoping), TD-016 (phân xưởng), TD-017 (đội trưởng)
- `UXUI_SPEC.md`: Added §9b WORKSHOP role spec
- `CURRENT_STATE.md`: Added GPS test portal section, Phase 6 overview
- `CLAUDE.md`: Added gap analysis lessons learned

### 2026-03-21 — Session 19f: KPI Reports + GPS Simulator + Monitoring Enhancements

#### Fixed
- **Routes page TypeError:** `admin/handler.go` `ListRoutes` was double-wrapping data (`response.OK(c, gin.H{"data": routes})` → `response.OK(c, routes)`). Frontend `routes.map()` was failing because `.data` was an object, not array.
- **PWA icon 404:** Created SVG icons (`icon-192.svg`, `icon-512.svg`) with BHL brand #F68634. Updated `manifest.json` refs.
- **SystemHealth double-wrapping:** Fixed same `gin.H{"data": health}` pattern in health endpoint.

#### Added
- **KPI Issues Report:** `GET /v1/kpi/issues?from=&to=&limit=` — Failed deliveries, discrepancies with summary counts. Handler + service + SQL queries against `trip_stops`, `discrepancies`, `sales_orders`.
- **KPI Cancellations Report:** `GET /v1/kpi/cancellations?from=&to=&limit=` — Cancelled, rejected, on_credit, pending_approval orders with total debt summary.
- **KPI Frontend tabs:** "Tổng quan" / "Có vấn đề" / "Hủy/Nợ" tabs in KPI dashboard with summary cards + detail tables.
- **GPS Simulator:** `cmd/gps_simulator/main.go` — Comprehensive GPS simulation:
  - Auto-loads active trips from DB (vehicle+stops), falls back to 5 demo routes
  - Realistic movement: 30-55 km/h, delivery stops 15-45s, heading calculation, ±5m GPS jitter
  - Publishes via Redis HSET `gps:latest` + PUBLISH `gps:updates` (same format as WebSocket hub)
  - Graceful shutdown with Ctrl+C
- **Enhanced System Health:** `admin/service.go` now checks Redis, VRP Solver (HTTP health), GPS tracking (active/stale vehicles from Redis), recent operations (orders today, active trips, audit logs 24h, notifications).
- **Health Dashboard enhanced:** GPS tracking section, recent operations cards, service status with color-coded borders, monitoring tools links (Prometheus/Grafana), auto-refresh indicator.

#### Changed
- `internal/admin/service.go`: Service now receives `*redis.Client` for health checks.
- `internal/admin/handler.go`: Fixed double-wrapping in `ListRoutes` and `SystemHealth`.
- `cmd/server/main.go`: Pass `rdb` to `admin.NewService()`.
- `web/src/app/dashboard/kpi/page.tsx`: Complete rewrite with 3-tab layout.
- `web/src/app/dashboard/settings/health/page.tsx`: Enhanced with GPS, ops, and monitoring sections.

#### Docs Updated
- `CURRENT_STATE.md`: Updated KPI (4 endpoints), GPS (simulator), Admin (14 endpoints)
- `CHANGELOG.md`: This entry

### 2026-03-21 — Session 19e: Load Test + Bug Fix + Monitoring + Prod Docker

#### Fixed (Critical)
- **Order number race condition (4.13):** `generateOrderNumber()` used `time.Now().UnixNano()%10000` — caused duplicate key violations under concurrent load (28% error rate). Replaced with PostgreSQL sequence `order_number_seq` via `nextval()`. Migration `010_order_number_seq.up.sql` auto-sets start from max existing order number. Fixed in `oms/service.go`, `oms/repository.go`, and `testportal/handler.go`.

#### Added (Infrastructure)
- **Prometheus metrics middleware (4.17):** `internal/middleware/metrics.go` — HTTP request counter/histogram/gauge + business metrics (OrdersCreatedTotal, TripsCompletedTotal, StopsDeliveredTotal, DBQueryDuration, etc.). `/metrics` endpoint exposed via promhttp.
- **Monitoring stack (4.17):** `monitoring/prometheus.yml`, `monitoring/grafana/` provisioning + dashboard JSON (10 panels: HTTP rate, latency p95, in-flight, orders, trips, delivery success rate, DB query latency, GPS WebSocket, integration calls, error rate). Docker Compose services: prometheus, grafana, postgres-exporter, redis-exporter (profile: monitoring).
- **Production Docker Compose (4.15):** `docker-compose.prod.yml` — full stack (api, web, postgres, redis, vrp, osrm, monitoring, nginx). Resource limits, healthchecks, production PostgreSQL tuning (max_connections=200, shared_buffers=256MB).
- **Nginx reverse proxy (4.15):** `nginx/nginx.conf` — rate limiting (30r/s API, 5r/m login), SSL termination, WebSocket upgrade for /ws/, /metrics restricted to internal IPs.
- **Deployment scripts (4.15):** `deploy/bhl-oms.service` (systemd), `deploy/deploy.sh` (5-step), `deploy/.env.example`.
- **Load test: Orders (4.11):** `tests/load_test_orders/main.go` — Go-based, configurable count/concurrency/host. Result: 3000 orders, 20 workers, 183.2 orders/sec, 0.17% errors, p95=148ms. ✅ PASSED.
- **Load test: VRP (4.12):** `tests/load_test_vrp/main.go` — Go-based VRP test + `tests/seed_vrp_test.sql` seed script. Result: 3000+ shipments, VRP solved in 70.2s, 50 trips/185 stops. ✅ PASSED.
- **Migration 010:** `order_number_seq` — PostgreSQL sequence for atomic order number generation.

#### Changed
- `cmd/server/main.go`: Added Prometheus middleware + /metrics endpoint.
- `docker-compose.yml`: Added monitoring services (prometheus, grafana, postgres-exporter, redis-exporter) with profiles.
- `internal/oms/service.go`: `generateOrderNumber()` replaced with `s.repo.NextOrderNumber(ctx)`.
- `internal/oms/repository.go`: Added `NextOrderNumber()` using DB sequence.
- `internal/testportal/handler.go`: Two instances of inline order number generation replaced with DB sequence.

#### Docs Updated
- TASK_TRACKER.md (4.11-4.13, 4.15, 4.17 marked done, 96→101, 87.3%→91.8%)
- CURRENT_STATE.md (monitoring components, port 3001, migration count)
- CHANGELOG.md (this entry)

---

### 2026-03-21 — Session 19: UXUI_SPEC.md + Phase 5 Restructure

#### Added (Documentation)
- **docs/specs/UXUI_SPEC.md:** Per-role UX/UI specification (~700 lines). Covers 8 role layouts (Dispatcher 3-column cockpit, DVKH 2-column form/preview, Driver mobile thumb-zone, Accountant T+1 countdown, Warehouse PDA scan-first, Management 5-second view, Security green/red, Admin config panel). Design system: brand #F68634, semantic colors, typography scale, spacing.
- **DEC-009:** UXUI_SPEC.md per-role specification formalized as architectural decision.
- **Phase 5 — UX Overhaul & Admin Console (32 tasks):** Added to TASK_TRACKER.md. Sub-phases: 5A Admin Console (8), 5B DVKH Control Desk (8), 5C Dispatcher Control Tower (10), 5D Driver Enforcement (6). Priority: B→A→C→D.

#### Changed (Documentation)
- **CLAUDE.md:** Added UX/UI world-class section (8 role table, 5 UX rules, brand color, formatVND), DEC-007/008/009 decisions, expanded lessons learned.
- **.github/instructions/frontend-patterns.instructions.md:** Complete rewrite — added 5 UX rules (UX-01 to UX-05), semantic color constants, formatVND/formatVNDCompact, notification priority mapping (P0-P3).
- **TASK_TRACKER.md:** Restructured from 78→110 tasks. Added Phase 5 with 32 new tasks. Updated progress from 82.1% to 58.2%.
- **CURRENT_STATE.md:** Updated date to Session 19, added UX/UI Design System section documenting UXUI_SPEC.md creation.
- **DECISIONS.md:** Added DEC-009.

#### Docs Updated
- CLAUDE.md, CURRENT_STATE.md, TASK_TRACKER.md, DECISIONS.md, CHANGELOG.md, .github/instructions/frontend-patterns.instructions.md, docs/specs/UXUI_SPEC.md (new)

---

## [Unreleased] — Phase 4 in progress

### 2026-03-20 — Session 18c: Uncoded Feature Implementation

#### Added (Backend)
- **Migration 012:** `delivery_attempts`, `vehicle_documents`, `driver_documents` tables + ALTER vehicles (is_external, supplier_name) + ALTER sales_orders (re_delivery_count, original_order_id)
- **Re-delivery flow (US-TMS-14b):** Full OMS implementation — CreateRedelivery + ListDeliveryAttempts (handler/service/repository). Validates order status, tracks attempt count, creates shipment, resets to "confirmed", fires event + notification.
- **Vehicle document CRUD:** TMS handler/service/repository — 5 endpoints (list, create, update, delete per vehicle + list expiring across all vehicles). doc_type: registration/inspection/insurance.
- **Driver document CRUD:** TMS handler/service/repository — 5 endpoints parallel to vehicle docs. doc_type: license/health_check with license_class (B2/C/D/E).
- **Document expiry cron:** Daily 07:00 ICT check for vehicle/driver docs expiring within 7 days. Sends notifications to dispatchers via existing notification service.
- **Domain models:** DeliveryAttempt, VehicleDocument, DriverDocument structs
- **Event:** `order.redelivery_created` event type + builder function

#### Added (Frontend)
- **Order detail:** "Tạo giao lại" button with reason modal for orders in partially_delivered/rejected/failed/delivered status. New "Giao lại" tab showing delivery attempts.
- **DeliveryAttempts component:** Shows attempt history with attempt number, previous status/reason, timestamps.
- **Vehicle documents page:** `/dashboard/vehicles/[id]/documents` — Full CRUD with expiry badges (red/orange/yellow/green). "Giấy tờ" link on vehicles list.
- **Driver documents page:** `/dashboard/drivers-list/[id]/documents` — Full CRUD with license class selector + expiry badges. "Giấy tờ" link on drivers list.

#### Docs Updated
- CURRENT_STATE.md: Updated endpoint counts (OMS 23, TMS 40+), added re-delivery + document sections, migration count 13, cron jobs, frontend 36 pages.
- CHANGELOG.md: This entry.

### 2026-03-20 — Session 18: Notification System Fixes + UI Redesign

#### Fixed
- **404 on /dashboard/notifications** — Page file was missing (not saved from session 17). Created `web/src/app/dashboard/notifications/page.tsx` with full filter (all/unread), priority badges, time formatting, click navigation.
- **Reject reason not showing in order timeline** — `CancelOrderByCustomer` now accepts `reason string` parameter. Updated `OrderConfirmCallback` interface + `integration/handler.go` to pass reason from Zalo rejection through to `entity_events` JSONB detail. `OrderTimeline` component already renders `evt.detail.reason` — now populated.

#### Changed
- **Notification Bell → Right-side slide panel** — Replaced cramped w-80 dropdown in sidebar with full-height right-side panel (max-w-md). Features: backdrop overlay, ESC key close, body scroll lock, styled-scrollbar, panel-slide-in animation.
- **Dashboard layout → Topbar** — Moved NotificationBell from sidebar header to a new topbar in main content area (`<header>` with greeting + bell). Better positioning context for the right-side panel.
- **globals.css** — Added `panel-slide-in`, `fade-in`, `slide-in-right`, `slide-out-right` animations + `.styled-scrollbar` utility class.

#### Docs Updated
#### Docs Updated
- **Comprehensive doc audit** (10+ files): CURRENT_STATE.md, TASK_TRACKER.md, API_BHL_OMS_TMS_WMS.md (v1.2 + Appendix A/B), DBS_BHL_OMS_TMS_WMS.md (v1.1 + Appendix), BRD_BHL_OMS_TMS_WMS.md (v2.4 + US-NEW-11~13), KNOWN_ISSUES.md (+6 resolved), DECISIONS.md (DEC-007/008), TECH_DEBT.md (TD-011~013), DOC_INDEX.md, CLAUDE.md, CHANGELOG.md

### 2026-03-20 — Session 18b: BRD v3.0 Restructuring + ROADMAP.md

#### Changed (Docs)
- **BRD v2.4 → v3.0** — Major restructuring, merge business content from BRD v4.0 gap analysis:
  - Section 1: KPI mục tiêu (table format), vai trò data flow (4-col table), quy mô (80 users, 300 NPP future, 180 concurrent)
  - Section 9: 3-layer RBAC (screen/action/data-scope), 11 roles with platform column, action matrix (8 functions × 8 roles)
  - Section 11: Expanded 13 → 33 notification events with P0-P3 priority tiers (Critical/Urgent/Important/Digest)
  - NEW Section 12: Timeline Đơn Hàng 10 Lớp (vertical stepper, UX features, acceptance criteria)
  - Renumbered: old 12→13 (Quy mô), old 13→14 (Phụ lục), old 13B→14B (Bổ sung), old 14→15 (UAT)
  - Section 9.3→9.4 Approval Flow (renumbered after new 9.3 Action Matrix)
- **UXUI.md** — Changed AntD → Tailwind CSS references (sections 3, 4)
- **UIX_BHL_OMS_TMS_WMS.md** — Section 14.1: brand colors (#F68634), font (Roboto), neutral palette, NotificationBell → slide panel
- **CLAUDE.md** — Removed "Boris" references (2 occurrences)
- **DOC_INDEX.md** — BRD v2.4 → v3.0, added ROADMAP.md entry

#### Added (Docs)
- **ROADMAP.md** — NEW file: 20 Ecosystem components (rated for BHL practicality: 6 practical, 8 defer, 6 not suitable), Phase plan (P0-P4), chi phí ước tính, tech stack bổ sung, UAT ecosystem criteria. Sourced from BRD v4.0 sections 14-18.

---

### 2026-03-20 — Session 17: Notification + Timeline System (Phase 1+2)

#### Added
- **Migration 011_entity_events** — New tables: `entity_events` (immutable event log), `order_notes` (internal staff notes). Enhanced `notifications` with `priority`, `entity_type`, `entity_id` columns.
- **`internal/events/` package** — EventRecorder service (`recorder.go`), event type constants + builders (`types.go`), HTTP handler (`handler.go`)
  - 20+ event type constants (order.created, order.confirmed_by_customer, order.rejected_by_customer, order.approved, order.cancelled, etc.)
  - Vietnamese titles for all events
  - Async event recording (fire-and-forget goroutines)
- **Timeline API:** GET `/v1/orders/:id/timeline` — immutable event history for orders
- **Notes API:** GET `/v1/orders/:id/notes`, POST `/v1/orders/:id/notes` — internal staff notes
- **Notification enhancements:**
  - `SendWithPriority()` — priority-aware notifications with entity references
  - `SendToRoleWithEntity()` — broadcast to role with entity_type/entity_id
  - Notifications now carry `priority`, `entity_type`, `entity_id` for linking to source entities
- **OMS event triggers:**
  - CreateOrder → record `order.created` + notify accountant (pending_approval) or dvkh (pending_customer_confirm)
  - ConfirmOrderByCustomer → record `order.confirmed_by_customer`
  - CancelOrderByCustomer → record `order.rejected_by_customer`
  - CancelOrder → record `order.cancelled`
  - ApproveOrder → record `order.approved` + notify dvkh
- **Auth/Middleware:** `FullName` field in JWT Claims, `FullNameFromCtx()` for context propagation
- **Frontend components:**
  - `NotificationProvider` — React context with WebSocket auto-connect/reconnect
  - `NotificationBell` — Bell icon with unread badge, dropdown with 10 latest
  - `NotificationToast` — Slide-in toast for real-time notifications, auto-dismiss 6s
  - `OrderTimeline` — Vertical timeline with event icons/colors per event type
  - `OrderNotes` — Notes list + textarea with Ctrl+Enter submit
  - `/dashboard/notifications` page — Full notification list with filter (all/unread), priority colors
  - Order detail tabs: 📦 Sản phẩm / 📜 Lịch sử / 💬 Ghi chú
  - Dashboard layout: NotificationBell in sidebar header (moved to topbar in session 18), NotificationToast overlay
- **Domain models:** `EntityEvent`, `OrderNote` structs; `Notification` enhanced with Priority/EntityType/EntityID

#### Fixed
- **actor_name empty** in entity_events — Added `middleware.FullNameFromCtx(ctx)` propagation from JWT → context → service layer

#### Docs Updated
- CURRENT_STATE.md, CHANGELOG.md

---

### 2026-03-20 — Session 16 (continued-2): Import Real NPP Data

#### Changed
- **customers table** — Replaced 945 old NPPs (20 real + 780 generated) with **218 real NPPs** from `danh sach NPP.txt`
  - 15 tỉnh/thành: Quảng Ninh (40), Hải Dương (33), Hải Phòng (26), Bắc Giang (22), Thái Bình (22), Hưng Yên (16), Nam Định (15), Bắc Ninh (12), Thái Nguyên (10), Hà Nội (6), Ninh Bình (6), Lạng Sơn (5), Thanh Hóa (3), Phú Thọ (1), TP.HCM (1)
  - Real addresses, coordinates, province data
- **credit_limits** — Auto-generated for all 218 NPPs (range 150M-800M based on province)
- **import_real_npp.sql** — Regenerated with UTF-16 LE decoder from TXT file
- **cmd/import_npp/main.go** — Updated: UTF-16 LE decoder (was Windows-1252), tab-separated (was CSV), simplified province fixer
- **seed_test_ready.sql** — Updated: use customer code subqueries instead of hardcoded UUIDs, 6 new test NPPs (NPP-001, HP-4745, TB-127, HD-59, BG-1, NPP-063)
- **HUONG_DAN_TEST_NGHIEP_VU.md** — Updated NPP references and credit amounts

#### Docs Updated
- CURRENT_STATE.md, CHANGELOG.md, docs/guides/HUONG_DAN_TEST_NGHIEP_VU.md

---

### 2026-03-20 — Session 16 (continued): Test Data Audit + Bug Fixes + Test Guide

#### Fixed
- **handler.go ListCreditBalances** — JOIN `credit_limits` table with date range (was referencing non-existent `customers.credit_limit` column)
- **handler.go ListCustomers** — Same fix: JOIN credit_limits instead of customers.credit_limit
- **handler.go CreateTestOrder credit check** — Fixed credit calculation: `SUM(CASE WHEN ledger_type='debit' THEN amount ELSE -amount END)` matching OMS logic
- **handler.go ResetTestData** — Fixed wrong table names: removed `epod_items` (non-existent), `dlq_entries` → `integration_dlq`, `reconciliation_tickets` → `reconciliations`, `kpi_snapshots` → `daily_kpi_snapshots`; added missing: `trip_checklists`, `discrepancies`, `driver_checkins`, `asset_ledger`
- **reset_test_data.sql** — Synced table names with handler.go fixes

#### Added
- **seed_test_ready.sql** — Comprehensive 6-phase reset+seed script:
  - Phase 1: Delete ALL transactional data (25+ tables)
  - Phase 2: Create WH-HP location bins (A/B zones)
  - Phase 3: Lots for all 30 products (main + near-expiry FEFO + returnable containers)
  - Phase 4: Stock quants WH-HL (all 30 products, realistic quantities)
  - Phase 5: Stock quants WH-HP (12 popular products)
  - Phase 6: Receivable ledger debits for 6 NPPs (150M–500M)
- **Test Guide** (`docs/guides/HUONG_DAN_TEST_NGHIEP_VU.md`) — 5 kịch bản test từng bước:
  1. Happy path: tạo đơn → KH xác nhận
  2. KH từ chối → stock hoàn lại
  3. Vượt hạn mức → pending_approval → kế toán duyệt
  4. Kiểm tra ATP + FEFO

#### Docs Updated
- CURRENT_STATE.md (test portal bug fixes + seed_test_ready.sql + test guide)
- CHANGELOG.md (this entry)
- docs/guides/HUONG_DAN_TEST_NGHIEP_VU.md (new file)

---

### 2026-03-20 — Session 16: Test Portal + Test Cases

#### Added
- **Test Portal Backend** (`internal/testportal/handler.go`) — 11 API endpoints, no auth:
  - GET orders, order-confirmations, delivery-confirmations, stock, credit-balances, customers, products
  - POST reset-data, create-test-order, simulate-delivery
- **Test Portal Frontend** (`web/src/app/test-portal/page.tsx`) — Standalone page with 6 tabs:
  - Đơn hàng (order list), Xác nhận đơn Zalo (confirm/reject as customer), Xác nhận giao hàng, Tồn kho/ATP, Dư nợ/Credit, Tạo đơn test
- **Reset Test Data SQL** (`migrations/reset_test_data.sql`) — Standalone SQL to clear transactional data, keep NPP/products/stock
- **Test Cases Document** (`docs/TEST_CASES.md`) — 20+ test cases covering OMS, Credit, Zalo Confirm, ATP, Delivery, E2E flows
- **Docs organization** — Moved guide .md files to `docs/guides/` (HUONG_DAN_CHAY_HE_THONG, README_BHL_OMS, INTEGRATION_MOCKS)

#### Changed
- `cmd/server/main.go` — Added testportal handler registration on v1 (public, no auth)

#### Docs Updated
- CURRENT_STATE.md (test portal module, frontend test portal page)
- CHANGELOG.md (this entry)
- docs/TEST_CASES.md (new file)
- docs/guides/ (new folder with moved files)

### 2026-03-20 — Session 15: Zalo Order Confirmation + Operational Guides

#### Added
- **Zalo Order Confirmation Flow** — After DVKH creates order, system sends Zalo ZNS to customer with PDF link + confirmation button. Customer has 2h to confirm/reject before auto-confirm kicks in.
  - New migration: `010_order_confirmation.up.sql` — `order_confirmations` table + `pending_customer_confirm` enum value
  - New domain model: `OrderConfirmation` struct
  - New `ZaloAdapter.SendOrderConfirmation()` method (template: `order_confirmation`)
  - New `ConfirmService` methods: `SendOrderConfirmation`, `GetOrderConfirmByToken`, `ConfirmOrder`, `RejectOrder`, `AutoConfirmExpiredOrders`, `RunOrderAutoConfirmCron` (5-min ticker)
  - New `Hooks.OnOrderCreated()` — fires async Zalo order confirmation
  - New OMS methods: `ConfirmOrderByCustomer` (creates shipment + debit), `CancelOrderByCustomer` (releases stock)
  - Public endpoints: `GET /v1/order-confirm/:token`, `GET .../pdf`, `POST .../confirm`, `POST .../reject`
  - `OrderConfirmCallback` interface to avoid circular dependency between integration handler and OMS service
- **HUONG_DAN_CHAY_HE_THONG.md** — Comprehensive Vietnamese guide covering: system startup, mock server usage, Zalo test scenarios, Bravo inventory test scenarios, troubleshooting

#### Changed
- **`CreateOrder`** — Status now `pending_customer_confirm` (was `confirmed`), shipment/debit deferred until customer confirms
- **`ApproveOrder`** — Now transitions `pending_approval → pending_customer_confirm` (was `→ confirmed`), fires Zalo confirmation
- **`UpdateOrder`** — Now allows editing orders in `pending_customer_confirm` status
- **`CancelOrder`** — Now allows cancelling orders in `pending_customer_confirm` status
- **Mock Server** — Zalo mock now logs order confirmation templates distinctly with confirm URL
- **`start-demo.ps1`** — Migration list updated to include `009_driver_checkin`, `009_urgent_priority`, `010_order_confirmation`

#### Docs Updated
- CURRENT_STATE.md (OMS order confirmation, integration 18 endpoints, cron jobs)
- CHANGELOG.md (this entry)
- HUONG_DAN_CHAY_HE_THONG.md (new file)

### 2026-03-20 — Session 14: Quality Infrastructure + Operational Tooling

#### Added
- **DB Slow Query Monitoring** — `pg_stat_statements` extension enabled in docker-compose.yml. Admin API: `GET /admin/slow-queries` (top N by total exec time, hit rate), `POST /admin/slow-queries/reset`. PostgreSQL also logs queries >500ms (`log_min_duration_statement=500`).
- **Quick Start Script** — `start.ps1` (lightweight restart, skips migrations/seeds) + `START_HERE.bat` (double-click). Supports flags: `-NoFrontend`, `-NoVRP`, `-MockServer`. Auto-kills old processes on ports 8080/3000, auto-starts Docker if needed.
- **Mock Server for External APIs** — `cmd/mock_server/main.go`. Three mock servers in one process:
  - Bravo ERP (:9001): `POST /api/documents/delivery`, `GET /api/credit-balance`, `POST /api/payment-receipt`
  - DMS (:9002): `POST /api/orders/sync`
  - Zalo OA (:9003): `POST /message/template`
  - Usage: `go run cmd/mock_server/main.go` then set `INTEGRATION_MOCK=false`
- **Zalo configurable base URL** — `ZaloAdapter` now accepts `baseURL` param (env: `ZALO_BASE_URL`). Defaults to `https://business.openapi.zalo.me` when empty.
- **Unit tests — OMS** (`internal/oms/service_test.go`) — 16 test cases
- **Unit tests — TMS** (`internal/tms/service_test.go`) — 19 test cases
- **Unit tests — WMS** (`internal/wms/service_test.go`) — 12 test cases
- **Logging instruction files split** — `logging-tracing.instructions.md` (650 lines) replaced by 3 focused files

#### Changed
- **`docker-compose.yml`** — PostgreSQL now starts with `shared_preload_libraries=pg_stat_statements`, `pg_stat_statements.track=all`, `log_min_duration_statement=500`
- **`internal/config/config.go`** — Added `ZaloBaseURL` field (env: `ZALO_BASE_URL`)
- **`internal/integration/zalo.go`** — `NewZaloAdapter` now takes `baseURL` as first param
- **`cmd/server/main.go`** — Passes `cfg.ZaloBaseURL` to `NewZaloAdapter`
- **`internal/admin/handler.go`** — Added `/admin/slow-queries` and `/admin/slow-queries/reset` routes
- **`internal/admin/service.go`** — Added `GetSlowQueries()` and `ResetSlowQueries()` methods
- **All `.instructions.md` files** — Fixed `applyTo` from YAML array `[]` to string format

#### Docs Updated
- CURRENT_STATE.md (pg_stat_statements, mock server, admin 9 endpoints)
- CHANGELOG.md (this entry)
- TECH_DEBT.md (TD-010 status)

### 2026-03-22 — Session 13: Real NPP Data Import

#### Added
- **`cmd/import_npp/main.go`** — Go script to parse BHL NPP CSV file (Latin-1 encoded) and generate SQL import. Includes `fixProvince()` function to map garbled province names to correct Vietnamese UTF-8.
- **`migrations/import_real_npp.sql`** — Generated SQL: TRUNCATE CASCADE customers + 218 INSERT statements with real coordinates

#### Changed
- **customers table** — Replaced 800 test NPPs with 218 real BHL NPPs across 15 provinces (Quảng Ninh 40, Hải Dương 33, Hải Phòng 26, Thái Bình 22, Bắc Giang 22, Hưng Yên 16, Nam Định 15, Bắc Ninh 12, Thái Nguyên 10, Hà Nội 6, Ninh Bình 6, Lạng Sơn 5, Thanh Hóa 3, Phú Thọ 1, TP.HCM 1)
- **All dependent tables truncated** — sales_orders, shipments, trip_stops, payments, epod, etc. cascaded from customers truncate

#### Known Issues
- NPP names and addresses have partial `?` characters due to Latin-1 encoding limitation in source CSV (characters like ả, ễ, ứ lost). Province names fixed via `fixProvince()`. Proper CSV re-export from BHL needed for clean names.

#### Docs Updated
- CURRENT_STATE.md (session 13, customers count updated to 218)
- CHANGELOG.md (this entry)

### 2026-03-21 — Session 12: Structured Logging & Tracing

#### Added
- **`pkg/logger/` package** — Logger interface, Field struct, Level enum, JSON structured logger implementation (3 files: logger.go, context.go, json_logger.go)
- **TracingMiddleware** — `internal/middleware/tracing.go` — Reads/creates `X-Trace-ID` header, injects into context, logs every HTTP request with method/path/status/duration_ms
- **LOG_LEVEL env var** — Configurable log level via environment variable (default: INFO)
- **Frontend X-Trace-ID** — `apiFetch` generates UUID per request, sends as `X-Trace-ID` header, includes trace ID in error messages

#### Changed
- **All module constructors** — Every Handler, Service, Repository now accepts `logger.Logger` via constructor injection (26+ files modified)
- **All `log.Printf` replaced** — Replaced with structured `s.log.Info/Error/Warn` calls across all internal modules (oms, tms, wms, kpi, reconciliation, notification, admin, integration, gps)
- **main.go rewired** — All constructor calls pass `appLog`, TracingMiddleware added to Gin router, startup/shutdown use structured logger
- **CORS updated** — Added `X-Trace-ID` to `Access-Control-Allow-Headers` and `Access-Control-Expose-Headers`
- **JWTAuth middleware** — Injects `user_id` into logger context after token validation
- **`.github/instructions/logging-tracing.instructions.md`** — New instruction file defining logging/tracing standards for AI coding

#### Docs Updated
- CURRENT_STATE.md (session 12, added Logging & Tracing section)
- CHANGELOG.md (this entry)
- CLAUDE.md (rules 7-9: Logger injection, Trace ID, I/O boundary logging)
- coding-standards.instructions.md (3 logging checklist items added)

### 2026-03-16 — Session 11: Dashboard & Data Fixes + Driver App BRD Compliance + Doc Sync

#### Fixed
- **Dashboard "Tổng đơn hàng" showing "-"** — API `/dashboard/stats` was missing `total_orders` field; added `SELECT COUNT(*) FROM sales_orders` query to return it
- **Vietnamese font corruption in order notes** — Orders SO-20260317-0001/0002 had garbled notes (????); fixed data in DB directly using Unicode escapes; root cause was `patch_demo_data.sql` piped through PowerShell (KI-006)
- **Frontend-backend action field mismatch** — Driver stop update was sending `{ status: 'arrived' }` but backend expected `{ action: 'arrive' }`; fixed frontend `handleUpdateStop` and incident handler to send correct field names and action values

#### Added
- **GPS map enrichment** — `/gps/latest` endpoint now returns vehicle_plate, driver_name, trip_status via DB join; map displays meaningful info instead of UUIDs
- **"Delivering" stop action (SM-03)** — Added `delivering` case to `UpdateStopStatus` in service.go; stop flow: pending → arrived → delivering → delivered/failed (matches BRD state machine)
- **Post-trip checklist (US-TMS-18)** — Frontend modal with 6 confirmation items (vehicle clean, no damage, fuel noted, cash ready, returns collected, keys ready); required before trip completion
- **Driver profile page (APP-10)** — `/dashboard/driver/profile` — Shows account info, role, app version, logout with confirmation dialog
- **Customer phone on stops** — Stop cards display phone number with click-to-call link
- **Estimated arrival time** — Stop cards display expected arrival time
- **GPS-based navigation** — Stop navigation uses coordinates when available, falls back to address-based Google Maps search
- **Test driver account** — `driver70` (Phạm Văn Vinh) with trip TRIP-TEST-001 (3 stops), vehicle 15C-11111

#### Documentation Sync (Code vs Spec Audit)
- **BRD v2.2 → v2.3** — Marked all implemented acceptance criteria with [x]; added 10 new user stories (US-NEW-01~10) for features not in original BRD: Admin CRUD, Driver Check-in, KPI, GPS enriched map, Offline Sync, Driver Profile, Urgent Priority, Pending Dates, Role-specific Dashboard, DLQ Management
- **API spec v1.0 → v1.1** — Added sections 9-15: Admin endpoints (7), Notification endpoints (5+WS), Public endpoints (2), Integration webhooks (11), KPI endpoints (2), GPS endpoints (3+WS), Error codes table
- **Deleted 4 demo files**: DEMO_PROGRESS.md, DEMO_SCRIPT.md, DEMO_SPRINT.md, DEMO_TEST_CASES.md

#### Docs Updated
- BRD_BHL_OMS_TMS_WMS.md (v2.3), API_BHL_OMS_TMS_WMS.md (v1.1), CURRENT_STATE.md, CHANGELOG.md

### 2026-03-20 — Session 10: Demo Data Fix, UX Bugs, GPS Integration

#### Added
- **Comprehensive demo seed SQL** — `migrations/seed_demo_comprehensive.sql` + `migrations/patch_demo_data.sql` — Driver checkins (63 available/6 off_duty out of 79 = 80%), reconciliation records (12: goods/payment/asset × 4 completed trips), discrepancies (4: open/investigating/escalated/resolved), daily close summaries (7), KPI snapshots (6), stock quants for 30 products in 2 warehouses
- **GPS injection tool** — `cmd/inject_gps/main.go` — Sets GPS positions for 4 in-transit vehicles in Redis via Go redis client (avoids quoting issues with redis-cli)
- **`pending_approvals` stat** — Dashboard stats API now returns count of `pending_approval` orders

#### Changed
- **Role-specific dashboard** — `dashboard/page.tsx` — Stat cards filtered by user role: admin/dispatcher see operational metrics, accountant sees financial (pending_approvals, discrepancies, revenue), dvkh sees order-related, management sees KPI
- **"Đơn chờ giao" navigation fix** — Changed href from `/dashboard/planning` to `/dashboard/orders?status=confirmed` (accessible to DVKH role)
- **Orders page URL filter** — `orders/page.tsx` — Reads `?status=` search param to pre-filter order list
- **ATP display fix** — `orders/new/page.tsx` — When warehouse selected but product has no stock, shows "ATP: 0" (red) instead of misleading "Chọn kho để kiểm tra"
- **DB port config** — `.env` DB_URL changed from port 5432 to 5434 (matches Docker postgres mapping)

#### Fixed
- GPS data stored with invalid JSON (no quoted keys) when using PowerShell inject script — resolved by using Go redis client tool
- Local Windows Redis (port 6379) conflicting with Docker Redis — Go server was connecting to local instance; GPS inject tool now targets correct instance

#### Docs Updated
- CURRENT_STATE.md, CHANGELOG.md

### 2026-03-20 — Session 9: UI Localization, RBAC, Credit Approval, Production Data

#### Added
- **Admin user management module** — `internal/admin/handler.go`, `service.go` — Full CRUD for users, password reset, role listing. Routes: GET/POST `/admin/users`, GET/PUT/DELETE `/admin/users/:id`, PUT `/admin/users/:id/reset-password`, GET `/admin/roles`. All protected by admin role.
- **Admin settings page** — `/dashboard/settings` — User management UI with create/edit/delete, role filter, search, password reset modal. Admin-only access.
- **Credit limit approval enriched endpoint** — GET `/orders/pending-approvals` — Returns orders with credit_limit, current_balance, available_limit, exceed_amount, and order items (product details).
- **Approvals page with full credit details** — `approvals/page.tsx` — Now shows: 5-column credit info cards, credit usage progress bar, expandable order items table, reject reason modal with required note, exceed percentage badge.
- **Reset-to-production SQL script** — `migrations/reset_to_production.sql` — Truncates all demo/transaction data, then loads production seed (70 vehicles, 70 drivers, 800 NPP, 30 products, 10 sample orders with items).

#### Changed
- **UI localization (Vietnamese)** — Removed all English text visible to users:
  - Login: "Demo accounts:" → "Tài khoản thử nghiệm:", "Hệ thống OMS-TMS-WMS" → "Hệ thống Quản lý Đơn hàng - Vận chuyển - Kho"
  - Layout: title → "BHL - Quản lý Đơn hàng, Vận chuyển & Kho"
  - Sidebar: "Dashboard" → "Tổng quan", "BHL System" → "BHL", "OMS - TMS - WMS" → "Đơn hàng · Vận chuyển · Kho"
  - KPI: "Dashboard KPI" → "Bảng điều khiển KPI"
  - Dashboard: "Quy trình Demo" → "Quy trình nghiệp vụ"
  - Driver: "Giao hàng (ePOD)" → "Xác nhận giao hàng", "Xem ePOD" → "Xem biên bản", "Checklist xe" → "Bảng kiểm tra xe"
  - Map: "Driver" fallback → "Tài xế"
- **RBAC enforcement on planning page** — Added client-side role check: only admin/dispatcher can access `/dashboard/planning`, others redirected to dashboard.
- **Sidebar navigation** — Added "⚙️ Quản trị hệ thống" menu item (admin-only)

#### Docs Updated
- CURRENT_STATE.md (session 9 updates, admin module, enriched approvals, reset script, page count 26→28)
- CHANGELOG.md (this entry)

---

### 2026-03-16 — Session 8: Driver App Major Enhancements

#### Added
- **Vehicle checklist submission form** — `driver/[id]/page.tsx` — Pre-trip inspection with 11 items (tires, brakes, lights, mirrors, horn, coolant, oil, fire extinguisher, first aid, documents, cargo) + fuel level slider + pass/fail summary. Required before starting trip (BRD US-TMS-10)
- **ePOD photo capture** — Camera capture with preview, mandatory 1+ photo before submit. Uses `capture="environment"` for mobile (BRD US-TMS-13)
- **Debt/credit payment option** — Added "📝 Công nợ" and "💰 Thu một phần" payment methods alongside cash and transfer. Debt shows receivable notice (BRD R04)
- **Google Maps navigation** — "Chỉ đường" button on each pending/arrived stop, opens Google Maps search with customer address (BRD US-TMS-11)
- **Incident reporting modal** — 7 incident types: wrong address, absent customer, vehicle breakdown, traffic police, road blockage, accident, other. Description + photo evidence (BRD US-TMS-14)
- **Trip completion summary** — Shows delivery stats (success/partial/failed), route metrics, financial summary, post-trip instructions before confirming completion (BRD US-TMS-17)
- **Photo for damaged/lost containers** — Returns modal now requires photo evidence when condition is damaged or lost (BRD R10)
- **Failed delivery indicator** — Shows re-delivery message on failed stops

#### Changed
- **Pre-trip checklist flow** — Trip cannot start without passing vehicle checklist. Shows warning if checklist fails, suggests contacting team lead for vehicle replacement
- **Stop action buttons** — Added "⚠️ Báo sự cố" button alongside ePOD and failure buttons at arrived stops
- **Trip completion flow** — Now shows summary modal before confirming, includes partially_delivered stops in completion check
- **Payment modal layout** — 2x2 grid layout for payment methods, amount hidden for credit/debt
- **Driver trips list** — Added progress bar for in-transit trips, next stop preview

#### Docs Updated
- CURRENT_STATE.md, CHANGELOG.md

---

### 2026-03-15 — Session 7: Role Pages + UI Improvements

#### Added
- **Warehouse dashboard page** — `/dashboard/warehouse` — Stock overview, picking queue, expiry alerts, quick links
- **Picking orders page** — `/dashboard/warehouse/picking` — Pending/completed picking list, confirm-pick action
- **Returns inbound page** — `/dashboard/warehouse/returns` — Process pending returns into stock
- **Gate check page** — `/dashboard/gate-check` — Security guard trip search, pass/fail check, notes
- **Approvals page** — `/dashboard/approvals` — Accountant order approval queue (pending_approval orders)
- **Daily close page** — `/dashboard/reconciliation/daily-close` — Generate daily close, resolve discrepancies
- **KPI dashboard page** — `/dashboard/kpi` — OTD rate, capacity utilization, financial KPIs, period filter
- **Sidebar navigation** — Added 5 new nav items for warehouse, gate-check, approvals, daily-close, KPI
- **Role labels** — Added warehouse ("Thu kho"), security ("Bảo vệ"), management ("Ban giám đốc") to sidebar

#### Changed
- **Driver assignment dropdown** — `planning/page.tsx` — Filtered to only show drivers with `checkin_status === 'available'`
- **Create order form** — `orders/new/page.tsx` — Added "⚡ Đơn gấp" checkbox (`is_urgent` field)
- **Credit label rename** — `orders/new/page.tsx` — "Hạn mức tín dụng" → "Hạn mức nợ" (2 locations)
- **Dashboard cards clickable** — `page.tsx` — Stats cards now navigate to corresponding detail pages
- **Demo flow steps clickable** — `page.tsx` — Each step navigates to the corresponding workflow page

#### Docs Updated
- CURRENT_STATE.md (page count 19→26, new pages listed)
- CHANGELOG.md (this entry)
- TASK_TRACKER.md

---

### 2026-03-15 — Session 6: Planning Page Bug Fixes

#### Fixed
- **Driver detail modal count mismatch** — Modal showed all 79 drivers (all warehouses) as "Chưa check-in" instead of warehouse-filtered list. Now uses `/drivers/checkins` data (warehouse-filtered) as primary source.
- **Unassigned orders list not displaying** — VRP returns bare UUID list for unassigned shipments. Frontend now cross-references with shipments list to show shipment number, customer name, and weight.
- **Driver assignment dropdown ordering** — Drivers already assigned to other trips are now sorted to the bottom of the dropdown list for easier selection.

#### Added
- **Vehicle/driver mismatch warning** — Step 0 (Tổng quan) shows orange warning when available vehicles exceed checked-in drivers, reminding dispatcher to have drivers check in before running VRP.

#### Docs Updated
- CHANGELOG.md, KNOWN_ISSUES.md

---

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
