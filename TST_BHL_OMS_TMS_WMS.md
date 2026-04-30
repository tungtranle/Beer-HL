# TEST STRATEGY & PLAN — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v2.3** |
| Dựa trên | BRD v3.8, SAD v2.1, DBS v1.2, API v1.3, **Code thực tế 27/04/2026**, AQF 4.1 |
| Cập nhật | 27/04/2026 — thêm blueprint BRD-derived cho GPS route-real, AI actionability, report scope và demo/test đầy đủ |

> ⚠️ **Nguyên tắc v2.2:** Test cases phải đọc từ CODE, không chỉ từ spec. Spec là ý định, code là sự thật. AQF là gate bắt buộc trước khi báo xong.
> Xem chi tiết chiến lược: `AI_TEST_STRATEGY.md`
> Blueprint chi tiết mới: `docs/BHL_TEST_DEMO_BLUEPRINT_2026-04-27.md`

---

# MỤC LỤC

1. [Test Strategy Overview](#1-test-strategy-overview)
2. [Test Pyramid & Tools](#2-test-pyramid--tools)
3. [Unit Test Plan](#3-unit-test-plan)
4. [Integration Test Plan](#4-integration-test-plan)
5. [E2E Test Plan](#5-e2e-test-plan)
6. [Load & Performance Test](#6-load--performance-test)
7. [Security Test](#7-security-test)
8. [UAT Checklist](#8-uat-checklist)
9. [Driver App Test Plan](#9-driver-app-test-plan)
10. [Test Data Strategy](#10-test-data-strategy)
11. [Test Environment](#11-test-environment)
12. [Bug Classification](#12-bug-classification)
13. [Entry / Exit Criteria](#13-entry--exit-criteria)
14. [BRD-Derived Test/Demo Blueprint](#14-brd-derived-testdemo-blueprint)

---

# 1. TEST STRATEGY OVERVIEW

## 1.0 BRD-derived blueprint bắt buộc

Từ 27/04/2026, mọi kịch bản test/demo phải đối chiếu với `docs/BHL_TEST_DEMO_BLUEPRINT_2026-04-27.md` trước khi code hoặc seed dữ liệu. Ba guardrail mới là bắt buộc:

1. **GPS route-real:** mọi demo/test tuyến đường phải dùng OSRM/local route geometry hoặc route geometry đã lưu. Fallback đường chim bay chỉ được dùng trong kịch bản degraded mode có cảnh báo rõ, không dùng cho demo vận hành chính.
2. **AI actionability:** AI Inbox, Dispatch Brief, Outreach Queue không được chỉ là text tĩnh. Mỗi insight phải có action, drill-down, explainability hoặc label read-only rõ ràng.
3. **Report scope:** báo cáo và danh sách giao dịch vận hành không được mặc định quét toàn bộ lịch sử. UI/API phải có date scope, active/open scope, data-as-of và filter context; historical mode là lựa chọn chủ động.

## Nguyên tắc

1. **Shift-left:** Test song song code, không test cuối phase
2. **Automate first:** Unit + Integration auto chạy trong CI
3. **Business rule coverage:** Mỗi rule R01–R15 có ít nhất 1 test case
4. **Regression CI:** Mỗi PR phải pass toàn bộ test suite
5. **Production-like data:** Local/UAT hiện dùng 218 NPP thực đã import + 30 SKU; khi BHL cung cấp full dump thì nâng lên 800 NPP mà không đổi matrix test
6. **AQF after every code change:** mỗi thay đổi phải có gate phù hợp G0/G1/G2/G3/G4 hoặc báo skip có lý do.
7. **Data safety first:** test/demo data trong DB thật phải scoped-owned; không xóa dữ liệu lịch sử.
8. **AI baseline first:** mọi AI feature phải có test flag OFF để chứng minh baseline UX/API không bị phá.

## AI Toggle Phase 1 test matrix

| Case | Evidence required |
|---|---|
| Migration 042 | Apply migration, query `ai_feature_flags` tồn tại |
| Admin list flags | Login admin, `GET /v1/admin/ai-flags` trả 17 definitions |
| Admin upsert happy path | `PUT /v1/admin/ai-flags` với `ai.master/org/bhl` trả 200 |
| Admin upsert error path | Unknown flag trả HTTP 400 `AI_FLAG_INVALID` |
| Effective flags | `GET /v1/ai/features` trả map; master OFF ép mọi flag false |
| Frontend route | Load `/dashboard/settings/ai` HTTP 200, admin-only guard |
| Baseline default | Sau test reset `ai.master=false`; missing feature rows vẫn OFF |

## AI-native Phase 2-6 test matrix

| Case | Evidence required |
|---|---|
| Privacy Router | `go test ./internal/ai` pass với ≥50 classifier inputs; PII phone/email/address route local |
| Migration 043 | Apply migration, verify `ai_audit_log`, `ai_inbox_items`, `ai_simulations`, `ai_feedback` tồn tại |
| Transparency | `GET /v1/ai/transparency` trả providers + guardrails |
| Intent MVP | Flag ON: `GET /v1/ai/intents?q=mo phong vrp` trả `simulate.vrp_what_if`; flag OFF trả baseline/manual |
| Voice Driver safety | Flag ON: whitelist command trả `confirm_required=true`, `auto_cancel_second=10`; unknown command không allowed |
| Simulation | Flag ON: create snapshot `ready`, 3 options, apply trả `approval_required=true`, `core_tables_mutated=false` |
| Frontend routes | Load `/dashboard/ai/transparency`, `/dashboard/ai/simulations`, `/dashboard` HTTP 200 |

## AI-R / AI-G test matrix

| Case | Evidence required |
|---|---|
| Provider chain | `go test ./internal/ai` + `go build ./cmd/server`; Gemini/Groq retry before mock fallback |
| Vehicle anomaly score | `GET /v1/ai/vehicle-score` returns score/level; Control Tower marker diagnostics clean |
| Credit risk | Real customer `GET /v1/ai/customers/:id/risk-score` returns level; Approvals chip diagnostics clean |
| Seasonal demand | `GET /v1/ai/seasonal-alert` returns alert body; OMS order form diagnostics clean |
| Dispatch brief | `GET /v1/ai/dispatch-brief` returns provider/summary; Dashboard route HTTP 200 |
| Exception explain | If open anomaly exists, `GET /v1/ai/anomaly/:id/explain`; if none, record skip reason |
| Zalo draft | Real customer `POST /v1/ai/npp-zalo-draft` returns provider/message; Customers route HTTP 200 |
| Frontend smoke | `/dashboard`, `/dashboard/approvals`, `/dashboard/orders/new`, `/dashboard/control-tower`, `/dashboard/anomalies`, `/dashboard/customers` HTTP 200 |

## AI-M test matrix

| Case | Evidence required |
|---|---|
| Python forecast function | Syntax check `vrp-solver/main.py`; direct `forecast_demand(...)` returns `prophet-compatible-rules` and 4 forecast points |
| Go demand bridge | `GET /v1/ai/demand-forecast?customer_id=&product_id=&warehouse_id=` returns forecast body; with solver down returns `model_method=rules-fallback` HTTP 200 |
| Outreach queue | `GET /v1/ai/outreach-queue?limit=3` returns at most 3 read-only NPP risk items |
| Frontend diagnostics | `DemandIntelligencePanel`, `OutreachQueueWidget`, dashboard and order form TS diagnostics clean |
| Frontend smoke | `/dashboard/orders/new` and `/dashboard` HTTP 200 with AI-M widgets mounted |
| Data safety | No seed/migration/data mutation; AI-M reads `sales_orders`, `order_items`, `customers`, `products`, `warehouses`, `ml_features.npp_health_scores` only |

## AQF gate mapping cho vibe code

| Gate | Khi nào bắt buộc | Ví dụ evidence |
|------|------------------|----------------|
| G0 Build/Static | Mọi thay đổi code | `go build`, `go vet`, `tsc`, `next build`, lint, page/endpoint smoke |
| G1 Fast | Module/service/business flow nhỏ | Go unit test, targeted package test, API smoke liên quan |
| G2 Domain/Golden/Data Safety | Credit, ATP, FEFO, state, RBAC, recon, QA scenario | golden JSON, Bruno, API assertion, `historical_rows_touched=0` |
| G3 E2E | Journey người dùng hoặc page workflow quan trọng | Playwright report/trace/screenshot |
| G4 Production Watch | Deploy/go-live/monitoring | `/v1/health`, AQF status, Sentry/Clarity/Telegram status |

**Rule:** Không được dùng `status code 200` làm evidence duy nhất cho business rule. Phải assert body/state/DB/event phù hợp.

## QA Portal v2 test data strategy

1. Master/historical data là fixture read-only: customers, products, warehouses, vehicles, historical orders/trips.
2. Scenario DB được mutate chỉ khi có run scope:
  - `qa_scenario_runs.id`
  - `qa_owned_entities(run_id, entity_type, entity_id)`
3. Seed scenario phải ghi registry trong transaction ngay sau mỗi insert.
4. Cleanup chỉ xóa entity trong registry của run cũ cùng scenario.
5. Bất kỳ check nào fail (`historical_rows_touched > 0`, delete thiếu registry, master table modified) → rollback và Decision Brief = `HOLD`.
6. Playwright/Bruno/synthetic tests không được gọi legacy destructive endpoints; nếu cần data, dùng scoped scenario API hoặc fixture read-only.

## Test Coverage Target

| Layer | Target | Mandatory |
|-------|--------|-----------|
| Service layer (business logic) | ≥ 80% | Có |
| Handler/Controller layer | ≥ 50% | Không |
| Repository/DB layer | Integration test thay thế | — |
| Frontend (Next.js) | Smoke test + critical paths | — |
| Driver App (React Native) | Manual + critical E2E | — |

---

# 2. TEST PYRAMID & TOOLS

```
        ╱  ╲         Manual/Exploratory (UAT)
       ╱ E2E ╲       Playwright (Web), Detox (App)
      ╱───────╲
     ╱  Integ.  ╲    testcontainers-go (PG+Redis)
    ╱─────────────╲
   ╱    Unit Tests  ╲  Go testing + testify
  ╱═══════════════════╲
```

| Level | Tool | Frequency | Duration |
|-------|------|-----------|----------|
| **Unit** | `go test` + `testify` + `mockery` | Every PR | < 30s |
| **Integration** | `testcontainers-go` (Postgres + Redis real containers) | Every PR | < 2 min |
| **E2E** | `Playwright` (Web), Manual (App)  | Nightly + Pre-release | < 15 min |
| **Load** | `k6` (Grafana) | Phase 4 | 30 min runs |
| **Security** | `gosec` + `trivy` (Docker scan) | Every build | < 1 min |

---

# 3. UNIT TEST PLAN

## 3.1 Convention

```go
// File: internal/oms/service_test.go
func TestOMS_CreateOrder_Success(t *testing.T) { ... }
func TestOMS_CreateOrder_CreditLimitExceeded(t *testing.T) { ... }
func TestOMS_CreateOrder_PastCutoff(t *testing.T) { ... }
```

- Naming: `Test{Module}_{Function}_{Scenario}`
- Mock: `mockery` cho interfaces (repository, external services)
- Assert: `testify/assert` + `testify/require`
- Table-driven tests cho multi-scenario

## 3.2 Module Test Plan

### OMS Service

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| Create order: happy path | — | Valid order | Created, status=new |
| Create order: credit limit exceeded | R03 | Amount > remaining limit | status=pending_approval |
| Create order: past cutoff 16h | R04 | Created at 17:00 | Assigned to next-day batch |
| ATP check: sufficient stock | R09 | qty ≤ ATP | available=true |
| ATP check: insufficient | R09 | qty > ATP | available=false, show remaining |
| Consolidate orders: same NPP same day | — | 3 orders same NPP | 1 shipment |
| Split order: multi-warehouse | — | Items at different warehouses | 2 shipments |
| Approve credit-exceeded order | R03 | Manager approves | status → approved |
| Priority ordering: VIP + fresh | R06 | VIP customer, fresh product | Priority score = highest |
| Redelivery: allowed from partially_delivered | — | Status=partially_delivered | New shipment created, re_delivery_count++ |
| Redelivery: blocked from delivered | — | Status=delivered | 400: không cho phép |
| Zalo flow: pending_customer_confirm | — | Zalo enabled, tạo đơn | status=pending_customer_confirm, not=confirmed |
| Auto-confirm Zalo sau 2h | — | Token expire, cron chạy | status=confirmed, event=auto_confirmed |

### TMS Service

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| VRP solve: basic scenario | — | 50 orders, 5 vehicles | Valid trips, all orders assigned |
| VRP: vehicle capacity constraint | — | Exceed vehicle weight | Split to additional vehicle |
| VRP: time window constraint | R05 | 08:00-10:00 window | Stop scheduled in window |
| VRP: forbidden zone | R14 | NPP in forbidden zone | Excluded from route |
| Assign driver: valid | — | Available driver | Trip → assigned |
| Assign driver: already on trip | — | Busy driver | Error: driver_unavailable |
| GPS batch insert | — | 100 GPS points | All saved, latest in Redis |
| Trip complete: all delivered | — | All stops delivered | status=completed |
| Trip complete: partial delivery | — | 1 stop failed | status=completed, redelivery created |

### TMS — Stop Flow (Cập nhật: có bước "delivering" intermediate)

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| Stop: arrived → delivering | SM-03 | Driver bấm Đã đến | stop_status=arrived |
| Stop: delivering → delivered + ePOD | SM-03 | Driver giao + chụp ảnh | stop_status=delivered, epod photo saved |
| Stop: server enforce ≥ 1 photo ePOD | US-TMS-13 | Submit ePOD không có ảnh | 400: at least 1 photo required |
| StartTrip: auto order in_transit | — | Driver start trip | Tất cả orders trong trip → in_transit, event ghi |
| CompleteTrip: accept partially_delivered stop | — | Stop = partially_delivered | Trip completed (không reject) |

### WMS Service

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| Inbound: create lots | — | 100 cases, batch X | Lot created, stock_quants += 100 |
| Picking: FEFO suggestion | R09 | Multiple lots | Oldest expiry first |
| Gate check: match | R01 | Scan = picking order | gate_check_passed=true |
| Gate check: mismatch | R01 | Scan ≠ picking order | Error, vehicle blocked |
| Stock move: warehouse transfer | — | Move 50 from WH1→WH2 | WH1 -50, WH2 +50 |
| Expiry alert | — | Lot expires in 7 days | Notification generated |

### Reconciliation Service

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| Auto-reconcile: clean trip | R08 | Delivered = shipped | No discrepancy |
| Auto-reconcile: shortage | R08 | Delivered < shipped | Discrepancy ticket created |
| Auto-reconcile: payment diff | R08 | Collected ≠ invoice | Discrepancy ticket |
| Discrepancy T+1 deadline | R08 | Ticket open > 24h | Escalation notification |
| Return count: match | R02 | Driver count = factory count | OK |
| Return count: discrepancy | R02 | Driver ≠ factory | discrepancy_qty calculated |
| Asset compensation | R10 | Damaged vỏ | Compensation = qty × deposit_price |

### Cost Engine (MỚI — v2.0)

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| Toll cost > 0 khi route qua trạm | — | Route Hà Nội → Hải Phòng | toll_cost_vnd > 0 |
| Toll cost = 0 khi avoid_toll=true | — | avoid_toll route | toll_cost_vnd = 0, safeguard active |
| Haversine proximity: < 500m = detect | — | Gate trong 500m | toll detected |
| Haversine proximity: > 500m = skip | — | Gate ngoài 500m | toll not detected |
| Cost breakdown per trip | — | VRP result | fuel_cost + toll_cost = total_cost |
| Expressway: entry/exit gates ordered | — | Route qua CT HP-HL | gates in correct order |

### Reconciliation (MỚI — v2.0)

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| Auto-reconcile: goods match | BR-REC-01 | Delivered = shipped qty | No discrepancy, status=reconciled |
| Auto-reconcile: goods shortage | BR-REC-01 | Delivered < shipped | discrepancy_ticket type=goods |
| Auto-reconcile: payment diff | BR-REC-01 | Collected ≠ invoice | discrepancy_ticket type=payment |
| Auto-reconcile: asset shortage | BR-REC-01 | Returned vỏ < shipped | discrepancy_ticket type=asset |
| Daily close: aggregate correct | — | 5 trips, 3 deliveries | totals match sum of trips |
| Discrepancy T+1 escalation | R08 | Ticket open > 24h | Notification escalated |
| Reconciliation list scope | — | `from/to` tháng hiện tại | List/export chỉ trả trip planned_date trong scope; History mới bỏ `from/to` |
| Discrepancy list scope | — | `status=open&from&to` | Ticket ngoài scope ngày không xuất hiện trong work queue |
| Daily close scope | — | `from/to` + `warehouse_id` | Chỉ trả close_date trong khoảng ngày |

### Auth & RBAC

| Test Case | Rule | Input | Expected |
|-----------|------|-------|----------|
| Login: valid credentials | — | Correct username/password | JWT tokens returned |
| Login: wrong password | — | Wrong password | 401 |
| Token refresh: valid | — | Valid refresh token | New access token |
| Token refresh: expired | — | Expired refresh token | 401 |
| RBAC: dispatcher access OMS | — | Role=dispatcher | Allowed |
| RBAC: driver access admin | — | Role=driver | 403 |
| Credit limit approve: only manager | R03 | Role=dispatcher | 403 |
| Credit limit approve: manager OK | R03 | Role=manager | Approved |

---

# 4. INTEGRATION TEST PLAN

## 4.1 Setup

```go
// testcontainers-go: real Postgres + Redis ephemeral containers
func TestIntegration(t *testing.T) {
    ctx := context.Background()
    pgContainer, _ := postgres.RunContainer(ctx, ...)
    redisContainer, _ := redis.RunContainer(ctx, ...)
    // run migrations
    // seed test data
    // test...
}
```

## 4.2 Test Cases

| Test Case | Components | Validate |
|-----------|-----------|----------|
| Order → Shipment → Trip end-to-end | OMS + TMS | Shipment created, trip assignable |
| ATP cache invalidation | OMS + Redis | Stock change → cache invalidated → fresh query |
| GPS batch → Redis latest | TMS + Redis | Batch insert → latest position in Redis |
| Picking → Gate check → Outbound | WMS chain | Stock deducted, gate check verified |
| ePOD → Reconciliation auto | TMS + Recon | Delivery confirmed → recon record auto-created |
| Payment → Receivable ledger | TMS + Finance | Payment collected → ledger updated |
| Zalo token → NPP confirm | Notification + NPP Portal | Token generated → confirm endpoint works |
| Credit check → Pending approval | OMS + Finance | Over-limit → pending, ledger unchanged |
| VRP → OSRM distance matrix | TMS + VRP + OSRM | Routes include real distances |
| Offline sync → Server conflict | Driver + Server | Offline queue replayed, server-wins on conflict |

---

# 5. E2E TEST PLAN

## 5.1 Web (Playwright)

| Scenario | Role | Steps | Assert |
|----------|------|-------|--------|
| Login → Dashboard | dispatcher01 | Login → dashboard loads | 5 widgets visible |
| Create order | dvkh01 | Fill form → submit | Order in list with status=new or pending_customer_confirm |
| Run VRP | dispatcher01 | Select date + warehouse → Run | Job completes, trips shown, cost breakdown visible |
| Approve trip plan | dispatcher01 | Review trips → approve | status=approved |
| View GPS map | dispatcher01 | Open map → see markers | At least 1 vehicle marker |
| Control Tower | dispatcher01 | Open Control Tower → GPS simulate | 7 vehicles on map, progress bars visible |
| Reconciliation flow | accountant01 | View trip summary → open discrepancy → close | Ticket status=resolved |
| KPI report | manager01 | Open OTD report | Chart renders with data, 3 tabs visible |
| Warehouse picking | thukho_hl01 | Open Picking by Vehicle | Vehicle cards with FEFO badges |
| Gate check | baove_hl01 | Open Gate Check → scan | Pass/fail result displayed |
| Redelivery flow | dispatcher01 | Open partially_delivered order → create redelivery | New shipment, order back to confirmed |
| Cost settings | admin | Open Transport Costs page | 4 tabs: Toll Stations, Expressways, Vehicle Defaults, Driver Rates |
| Dynamic RBAC | admin | Toggle permission → test API | 403 after disable, 200 after re-enable |
| Bàn giao flow | thukho_hl01 | Create handover → sign A | handovers list shows new entry |

## 5.2 Mobile (Manual Test Checklist)

| Scenario | Device | Steps |
|----------|--------|-------|
| Login + auto-refresh | Android + iOS | Login → wait 30 min → still logged in |
| Checklist pre-trip | Android | Submit 8 items + 2 photos |
| Delivery + ePOD | Android + iOS | Arrive → confirm → photo → submit |
| Payment collection | Android | Cash + transfer, receipt shows |
| Return vỏ | Android | Count + photo → submit |
| Offline delivery | Android (airplane mode) | Deliver 3 stops offline → reconnect → sync |
| GPS tracking | Android | Drive 30 min, check dispatcher map |

---

# 6. LOAD & PERFORMANCE TEST

## 6.1 Tool: k6

```javascript
// scenario: 3000 orders, 100 concurrent users
export const options = {
  scenarios: {
    peak_load: {
      executor: 'constant-vus',
      vus: 100,
      duration: '30m',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],  // P95 < 2s
    http_req_failed: ['rate<0.01'],      // Error < 1%
  },
};
```

## 6.2 Scenarios

| Scenario | VUs | Duration | Target |
|----------|-----|----------|--------|
| **Normal day** | 30 concurrent | 15 min | P95 < 500ms |
| **Peak (Tết)** | 100 concurrent | 30 min | P95 < 2s |
| **VRP stress** | 5 parallel VRP jobs | — | Each < 120s |
| **GPS flood** | 70 vehicles × 30s = ~140 req/min | 30 min | 0 drops |
| **Concurrent ATP** | 50 ATP checks parallel | — | P95 < 200ms |

## 6.3 NFR Targets (từ SAD)

| Metric | Target | Measure |
|--------|--------|---------|
| API response (non-VRP) | P95 < 500ms, P99 < 2s | k6 + Prometheus |
| VRP solve time | < 120s for 1,000 orders | Application logs |
| GPS WebSocket | Latency < 3s | Client timestamp diff |
| Concurrent users | 50 simultaneous (200 peak) | k6 VUs |
| DB query time | P95 < 100ms | pg_stat_statements |
| Redis cache hit ratio | > 85% ATP | Redis INFO stats |
| Uptime | 99.5% (monthly) | Prometheus uptime metric |

---

# 7. SECURITY TEST

| Check | Tool | Frequency | Action on Fail |
|-------|------|-----------|----------------|
| Go security scan | `gosec` | Every PR (CI) | Block merge |
| Docker image CVE scan | `trivy` | Every build (CI) | Block deploy if Critical |
| SQL injection test | Manual + sqlc (parameterized) | Phase 3 | Fix immediately |
| JWT validation bypass | Manual test | Phase 3 | Fix immediately |
| RBAC escalation check | E2E test: low-role tries high API | Phase 3 | Fix immediately |
| Bravo webhook auth (API key) | Integration test | Phase 3 | — |
| Zalo token guessability | UUID v4 token test (128-bit entropy) | Phase 3 | — |
| CORS misconfiguration | Manual check | Phase 4 | — |
| Rate limit verify | k6: 1000 req/s from 1 IP | Phase 4 | — |

---

# 8. UAT CHECKLIST

Từ BRD §14 — 12 tiêu chí nghiệm thu. Mỗi tiêu chí cần **Passed** để go-live.

| # | Tiêu chí | Mô tả chi tiết | Test Steps | Status |
|---|----------|----------------|------------|--------|
| UAT-01 | Tạo đơn + gom/tách | Tạo 5 đơn, 2 đơn cùng NPP → gom, 1 đơn 2 kho → tách | Login dispatcher → create orders → verify consolidation + split | ☐ |
| UAT-02 | VRP chạy + duyệt plan | Chạy VRP 100 đơn → trips hiển thị → dispatcher duyệt | Run VRP → wait result → review → approve | ☐ |
| UAT-03 | Driver App giao hàng | Tài xế nhận trip → checklist → giao 3 điểm → ePOD | Driver login → start trip → deliver + photo → complete | ☐ |
| UAT-04 | Thu tiền + vỏ | Tài xế thu tiền mặt / chuyển khoản + thu vỏ tại NPP | Deliver → collect payment → collect containers → submit | ☐ |
| UAT-05 | GPS tracking | Dispatcher xem vị trí tài xế real-time trên bản đồ | Driver drives → dispatcher opens map → sees moving marker | ☐ |
| UAT-05A | Control Tower progress + ETA deviation | Dispatcher thấy progress bar theo điểm giao và badge ETA (đúng tiến độ/trễ) cho từng chuyến active | Seed 2 chuyến active có estimated_arrival khác nhau → mở Control Tower → đối chiếu tiến độ + ETA badge theo dữ liệu stop | ☐ |
| UAT-05B | Control Tower realistic route coverage | Dispatcher thấy đủ 7 tuyến active của SC-11 xuất phát từ WH-HL, không còn marker/route rơi ra biển | Load SC-11 → start GPS simulate → mở Control Tower → xác nhận 7 xe online, 7 route active hiển thị theo cụm Hạ Long/Quảng Yên/Uông Bí/Đông Triều/Cẩm Phả | ☐ |
| UAT-06 | Gate check PDA | Thủ kho scan barcode đối chiếu phiếu xuất kho | Scan items on PDA → system beeps match/mismatch | ☐ |
| UAT-07 | Reconciliation tự động | Hoàn thành trip → hệ thống tự tạo bản đối soát | Complete trip → check /reconciliation → record exists | ☐ |
| UAT-08 | Phát hiện chênh lệch | Giao thiếu hàng → hệ thống phát hiện discrepancy | Deliver 9/10 → recon → discrepancy ticket auto-created | ☐ |
| UAT-09 | Bravo sync | Giao hàng xong → Bravo sandbox nhận phiếu giao | ePOD confirmed → check Bravo sandbox → document present | ☐ |
| UAT-10 | Zalo OA xác nhận | NPP nhận tin Zalo chứa link → click confirm | ePOD → Zalo msg sent → click link → confirm page | ☐ |
| UAT-11 | Dashboard + KPIs | Dashboard hiển thị 5 widget + KPI tính đúng | Login manager → open dashboard → 5 widgets + KPI charts | ☐ |
| UAT-11A | Operational data scope | Dashboard/orders/trips/reconciliation không mặc định load 2 năm lịch sử | Open dashboard → total orders là month-to-date; open Orders → `from/to` tháng hiện tại + có History explicit; Control Tower/Handover dùng `active=true`; Reconciliation mặc định pending/open + `from/to` tháng hiện tại ở list/export/daily-close | ☐ |
| UAT-12 | Offline 2h | Tắt mạng 2h, giao 3 điểm → bật mạng → sync thành công | Airplane mode → deliver → reconnect → data synced | ☐ |
| UAT-13 | Ops & Audit regression | QA thấy timeline, pinned notes, DLQ, discrepancy, daily close, KPI snapshot trong một tab | Load SC-12 → mở Test Portal Ops & Audit → đối chiếu counters + order OPS-PART-* | ☐ |
| UAT-14 | Cost Engine VRP | Chạy VRP → trip hiển thị chi phí xăng dầu + phí cầu đường → tổng chi phí tính đúng | Run VRP SC-09 → mở kết quả → kiểm tra cost_breakdown: fuel_cost + toll_cost > 0 | ☐ |
| UAT-15 | Bàn giao A/B/C | Kho tạo bàn giao → tài xế ký A → thủ kho ký B → manager ký C | WMS handover → POST handovers → sign A/B/C → verify status = signed_c | ☐ |
| UAT-16 | Dynamic RBAC | Admin tắt quyền tạo đơn của DVKH → DVKH gọi API tạo đơn → 403 → Admin bật lại → 200 | Settings > Permissions → toggle → test API call → verify 403/200 | ☐ |

**Exit Criteria:** 16/16 passed. BHL PM ký xác nhận.

---

# 9. DRIVER APP TEST PLAN

## 9.1 Device Matrix

| Device | OS | Test Focus |
|--------|-----|-----------|
| Samsung Galaxy A14 | Android 13 | Primary test device |
| Samsung Galaxy A05s | Android 12 | Low-end performance |
| iPhone SE 3 | iOS 16 | iOS compatibility |
| Simulator (iOS) | Latest | Dev testing |
| Emulator (Android) | API 33 | Dev testing |

## 9.2 Offline Test Scenarios

| Scenario | Duration | Actions | Expected Sync |
|----------|----------|---------|---------------|
| Short disconnect | 5 min | 1 delivery | Sync < 5s after reconnect |
| Medium disconnect | 30 min | 3 deliveries + 1 payment | Sync all, correct order |
| Long disconnect | 2 hours | 5 deliveries + 2 payments + 1 return | Full sync, no data loss |
| Reconnect mid-sync | — | Kill connection during sync | Resume from last success |
| Conflict: server changed trip | — | Dispatcher modified stop while driver offline | Server-wins, driver notified |

## 9.3 GPS Test

| Scenario | Expected |
|----------|----------|
| Background GPS collection | Points collected even when app minimized |
| GPS batch upload (every 30s) | Batch of points sent, dispatcher receives |
| No GPS signal (tunnel) | Queue continues, upload when signal returns |
| Battery impact | < 5% battery per hour with GPS active |

---

# 10. TEST DATA STRATEGY

## 10.1 Seed Data (Phase 1–3)

| Entity | Count | Source |
|--------|-------|--------|
| Users | 15 (all roles) | Generated |
| Warehouses | 2 | From BRD |
| Products | 10 | Subset of 30 SKU |
| Customers (NPP) | 50 | Generated with realistic addresses |
| Vehicles | 10 | Generated |
| Drivers | 10 | Generated |
| Routes | 20 | Generated with OSRM distances |
| Credit limits | 50 (1 per NPP) | Generated |
| Opening stock | 10 products × 2 warehouses | Generated |

## 10.2 UAT Data (Phase 4)

| Entity | Count | Source |
|--------|-------|--------|
| Users | 30 (real staff) | BHL HR |
| Warehouses | 2 (real) | BHL |
| Products | 30 (all SKU) | BHL |
| Customers | 218 (master thực đang có trong local/UAT) | BHL export hiện tại |
| Vehicles | 70 (all) | BHL |
| Drivers | 70 (all) | BHL |
| Routes | 500 (all) | BHL |
| Credit balances | 218 baseline local, mở rộng khi có full import | Bravo export |
| Asset balances | 218 baseline local, mở rộng khi có full import | Bravo export |

## 10.3 Load Test Data

| Entity | Count | Generated By |
|--------|-------|-------------|
| Orders | 3,000–5,000 | k6 script |
| GPS points | 70 vehicles × 30 min × 2/min = 4,200 | k6 GPS script |
| Concurrent logins | 100–200 | k6 |

## 10.4 QA Demo Scenario Data (QA Portal v2)

| Scenario | Purpose | Data Created | Cleanup Rule |
|----------|---------|--------------|--------------|
| DEMO-01 | DVKH tạo đơn → NPP xác nhận Zalo | 2 orders, 2 order confirmations, timeline events | Delete only rows registered in `qa_owned_entities` |
| DEMO-02 | Vượt hạn mức tín dụng → kế toán duyệt | 1 pending approval order, 1 receivable ledger, item/event | Same scenario ownership cleanup |
| DEMO-03 | Điều phối tạo chuyến nhiều điểm | Historical-calibrated dispatch data: tối thiểu 24 orders, nhiều shipments/trips/stops, NPP có tọa độ | Same scenario ownership cleanup |
| DEMO-04 | NPP từ chối đơn → audit timeline | 1 cancelled order, rejected confirmation, events | Same scenario ownership cleanup |
| DEMO-HIST-01 | Replay ngày lịch sử có sản lượng thật | Read-only query chọn busiest `sales_orders.delivery_date`; 1 owned evidence event | No business history mutation; cleanup owned evidence only |
| DEMO-DISPATCH-01 | Điều phối live ops gần công suất | Theo busiest historical day; up to 40 active trips, tối thiểu 24 orders, driver_checkins scoped, AI Inbox dispatcher; fleet/driver master không bị sửa | Same scenario ownership cleanup; expected `historical_rows_touched = 0` |
| DEMO-AI-DISPATCH-01 | AI điều phối viên | Live ops owned data + 4 dispatcher AI Inbox items + AI audit + simulation evidence | Same scenario ownership cleanup; expected `historical_rows_touched = 0` |

**Invariant bắt buộc:** `historical_rows_touched = 0`. Test/demo data được nạp qua `POST /v1/test-portal/demo-scenarios/:id/load`; cleanup qua `POST /v1/test-portal/demo-scenarios/:id/cleanup`. Không dùng legacy `reset-data`, `load-scenario`, `run-scenario`, `run-all-smoke`.

---

# 11. TEST ENVIRONMENT

| Environment | Purpose | Infrastructure | Data |
|------------|---------|---------------|------|
| **Local** | Dev unit/integration test | Docker Compose | testcontainers ephemeral |
| **Staging** | CI/CD target, integration, E2E | 1 VM (4 vCPU, 8GB) | Seed data 50 NPP |
| **UAT** | BHL user testing | Staging (same) | 218 NPP thực hiện có; scale lên 800 khi import đầy đủ |
| **Production** | Live | 2 VMs (8 vCPU, 16GB) | Migrated real data |

---

# 12. BUG CLASSIFICATION

| Severity | SLA | Example |
|----------|-----|---------|
| **Critical** | Fix in 4h | System down, data loss, payment wrong |
| **High** | Fix in 1 day | Feature broken, VRP not working, sync fail |
| **Medium** | Fix in 3 days | UI bug affecting workflow, performance slow |
| **Low** | Next sprint | UI cosmetic, typo, minor UX |

**Go-live requirement:** 0 Critical + 0 High + ≤ 5 Medium open.

---

# 13. ENTRY / EXIT CRITERIA

## 13.1 Unit Test Entry
- Code compiles
- Module interface defined
- Test data available

## 13.2 Integration Test Entry
- Unit tests passing
- Docker Compose running
- Seed data loaded

## 13.3 UAT Entry
- All integration tests passing
- Staging deployed latest build
- Tối thiểu 218 NPP thực đã import; nếu có full dump thì nâng lên 800 NPP
- UAT participants trained
- UAT scenarios documented (this section 8)

## 13.4 Go-live Exit
- [ ] **16/16 UAT criteria passed** (v2.0: thêm UAT-14 Cost Engine, UAT-15 Bàn giao A/B/C, UAT-16 Dynamic RBAC)
- [ ] **Smoke test suite: 17/17 scenarios PASS** (xem AI_TEST_STRATEGY.md)
- [ ] **Playwright E2E: 14/14 role flows PASS**
- [ ] Load test passed (3,000 orders, P95 < 2s)
- [ ] 0 critical + 0 high bugs
- [ ] Security scan clean (gosec + trivy)
- [ ] go test ./... → 0 failures
- [ ] Data migration verified by BHL KT
- [ ] Backup/DR drill passed
- [ ] Monitoring live (Grafana + alerts)
- [ ] **ENABLE_TEST_PORTAL=false trên production**
- [ ] BHL PM signed off

---

**=== HẾT TÀI LIỆU TST v2.0 ===**

*Test Strategy & Plan v2.0 — 100+ test cases, UAT checklist 16 items, load test, security test, offline test.*  
*Cập nhật 23/04/2026: sync với code thực tế (BRD v3.2), thêm Cost Engine/Reconciliation/Redelivery/Control Tower tests.*  
*Chiến lược AI-First: xem AI_TEST_STRATEGY.md*
