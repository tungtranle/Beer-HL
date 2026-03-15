# TEST STRATEGY & PLAN — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Dựa trên | BRD v2.0, SAD v2.1, DBS v1.0, API v1.0 |

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

---

# 1. TEST STRATEGY OVERVIEW

## Nguyên tắc

1. **Shift-left:** Test song song code, không test cuối phase
2. **Automate first:** Unit + Integration auto chạy trong CI
3. **Business rule coverage:** Mỗi rule R01–R15 có ít nhất 1 test case
4. **Regression CI:** Mỗi PR phải pass toàn bộ test suite
5. **Production-like data:** UAT dùng data gần đúng thực tế (800 NPP, 30 SKU)

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

| Scenario | Steps | Assert |
|----------|-------|--------|
| Login → Dashboard | Login as dispatcher → dashboard loads | 5 widgets visible |
| Create order | Fill form → submit | Order in list with status=new |
| Run VRP | Select date + warehouse → Run | Job completes, trips shown |
| Approve trip plan | Review trips → approve | status=approved |
| View GPS map | Open map → see markers | At least 1 vehicle marker |
| Reconciliation flow | View trip summary → open discrepancy → close | Ticket status=resolved |
| KPI report | Open OTD report | Chart renders with data |

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
| UAT-06 | Gate check PDA | Thủ kho scan barcode đối chiếu phiếu xuất kho | Scan items on PDA → system beeps match/mismatch | ☐ |
| UAT-07 | Reconciliation tự động | Hoàn thành trip → hệ thống tự tạo bản đối soát | Complete trip → check /reconciliation → record exists | ☐ |
| UAT-08 | Phát hiện chênh lệch | Giao thiếu hàng → hệ thống phát hiện discrepancy | Deliver 9/10 → recon → discrepancy ticket auto-created | ☐ |
| UAT-09 | Bravo sync | Giao hàng xong → Bravo sandbox nhận phiếu giao | ePOD confirmed → check Bravo sandbox → document present | ☐ |
| UAT-10 | Zalo OA xác nhận | NPP nhận tin Zalo chứa link → click confirm | ePOD → Zalo msg sent → click link → confirm page | ☐ |
| UAT-11 | Dashboard + KPIs | Dashboard hiển thị 5 widget + KPI tính đúng | Login manager → open dashboard → 5 widgets + KPI charts | ☐ |
| UAT-12 | Offline 2h | Tắt mạng 2h, giao 3 điểm → bật mạng → sync thành công | Airplane mode → deliver → reconnect → data synced | ☐ |

**Exit Criteria:** 12/12 passed. BHL PM ký xác nhận.

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
| Customers | 800 (all NPP) | BHL export |
| Vehicles | 70 (all) | BHL |
| Drivers | 70 (all) | BHL |
| Routes | 500 (all) | BHL |
| Credit balances | 800 | Bravo export |
| Asset balances | 800 | Bravo export |

## 10.3 Load Test Data

| Entity | Count | Generated By |
|--------|-------|-------------|
| Orders | 3,000–5,000 | k6 script |
| GPS points | 70 vehicles × 30 min × 2/min = 4,200 | k6 GPS script |
| Concurrent logins | 100–200 | k6 |

---

# 11. TEST ENVIRONMENT

| Environment | Purpose | Infrastructure | Data |
|------------|---------|---------------|------|
| **Local** | Dev unit/integration test | Docker Compose | testcontainers ephemeral |
| **Staging** | CI/CD target, integration, E2E | 1 VM (4 vCPU, 8GB) | Seed data 50 NPP |
| **UAT** | BHL user testing | Staging (same) | Full 800 NPP data |
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
- 800 NPP data imported
- UAT participants trained
- UAT scenarios documented (this section 8)

## 13.4 Go-live Exit
- [ ] 12/12 UAT criteria passed
- [ ] Load test passed (3,000 orders, P95 < 2s)
- [ ] 0 critical + 0 high bugs
- [ ] Security scan clean (gosec + trivy)
- [ ] Data migration verified by BHL KT
- [ ] Backup/DR drill passed
- [ ] Monitoring live (Grafana + alerts)
- [ ] BHL PM signed off

---

**=== HẾT TÀI LIỆU TST v1.0 ===**

*Test Strategy & Plan v1.0 — 80+ test cases, UAT checklist, load test, security test, offline test.*
