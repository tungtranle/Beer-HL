# PROJECT EXECUTION PLAN — BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Dựa trên | SAD v2.1, BRD v2.0 |
| Phương pháp | Vibe Coding Accelerated — 4 Phase × 2 tuần |
| Go-live mục tiêu | ~15/05/2026 |
| Ngày bắt đầu | 01/04/2026 (Phase 1 Week 1) |

---

# MỤC LỤC

1. [Tổng quan Timeline](#1-tổng-quan-timeline)
2. [Phase 1 — Foundation & Core](#2-phase-1--foundation--core)
3. [Phase 2 — WMS & Driver App](#3-phase-2--wms--driver-app)
4. [Phase 3 — Integration & Reports](#4-phase-3--integration--reports)
5. [Phase 4 — UAT & Go-live](#5-phase-4--uat--go-live)
6. [Milestones & Gates](#6-milestones--gates)
7. [Dependencies & Blockers](#7-dependencies--blockers)
8. [Risk Register](#8-risk-register)
9. [Team & Responsibilities](#9-team--responsibilities)
10. [Progress Tracking](#10-progress-tracking)
11. [Definition of Done](#11-definition-of-done)

---

# 1. TỔNG QUAN TIMELINE

```
April 2026                          │   May 2026
W1    W2    W3    W4                │   W1    W2    W3    W4
┌─────┬─────┬─────┬─────┬──────────┼─────┬─────┬─────┐
│ Phase 1   │ Phase 2   │ Phase 3  │ Phase 4   │ GO! │
│Foundation │WMS+Driver │Integr.   │UAT+GoLive │     │
│ + Core    │App        │+Reports  │           │     │
└─────┴─────┴─────┴─────┴──────────┼─────┴─────┘     │
│<=== Vibe Coding: AI gen CRUD ===>│ <=Manual Test=>  │
│                                  │                   │
│ ⚠ BHL cung cấp API docs Phase 1 │ ⚠ Cần user thật  │
```

| Phase | Thời gian | Ngày | Focus |
|-------|-----------|------|-------|
| **Phase 1** | 2 tuần | 01/04 – 11/04 | Setup, DB, Auth, OMS core, TMS planning, GPS |
| **Phase 2** | 2 tuần | 14/04 – 25/04 | WMS, PDA, Driver App MVP, Offline sync |
| **Phase 3** | 2 tuần | 28/04 – 09/05 | Integration (Bravo/DMS/Zalo), Recon, Reports |
| **Phase 4** | 2 tuần | 12/05 – 23/05 | UAT, Data migration, Load test, Bug fix, Go-live prep |
| **Go-live** | 1 ngày | ~15/05–26/05 | Production deploy (flex based on UAT) |

---

# 2. PHASE 1 — FOUNDATION & CORE (01/04 – 11/04)

**Mục tiêu:** Hệ thống chạy end-to-end từ nhập đơn → xếp xe → GPS tracking. CI/CD hoàn chỉnh.

## Week 1 (01/04 – 04/04)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 1.1 | GitHub repo + branch strategy (main/develop/feature) | Dev | Repo ready, PR template, .gitignore | ☐ |
| 1.2 | Docker Compose: Go app + PostgreSQL + Redis + MinIO + OSRM + VRP | Dev | `docker-compose up` 1 lệnh, all services healthy | ☐ |
| 1.3 | CI/CD pipeline (GitHub Actions): lint → test → build → deploy staging | Dev | PR trigger, auto-test, auto-deploy staging | ☐ |
| 1.4 | Database migration đầy đủ (DBS v1.0): 35+ tables + indexes + enums | Dev | `migrate up` thành công, sqlc generate OK | ☐ |
| 1.5 | Auth module: JWT RS256 login/refresh/logout + RBAC middleware | Dev | Login → token → protected route OK, RS256 verified | ☐ |
| 1.6 | Seed data: 10 NPP, 5 products, 2 warehouses, 3 vehicles, 3 drivers | Dev | Test data available | ☐ |
| 1.7 | **[BHL]** Cung cấp Bravo API doc + sandbox | BHL IT | Doc received, sandbox URL confirmed | ☐ |
| 1.8 | **[BHL]** Cung cấp DMS API doc + sandbox | BHL IT | Doc received, sandbox URL confirmed | ☐ |
| 1.9 | **[BHL]** Đăng ký Zalo OA + lấy ZNS credentials | BHL IT | OA ID + API key received | ☐ |
| 1.10 | **[BHL]** Xác nhận PDA model + barcode format | BHL + BA | Email confirmation | ☐ |

## Week 2 (07/04 – 11/04)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 1.11 | OMS module: CRUD orders + items | Dev | POST/GET/PUT/DELETE orders OK | ☐ |
| 1.12 | OMS: ATP service (stock_quants query + Redis cache 30s) | Dev | GET /atp → realtime, cached hit verified | ☐ |
| 1.13 | OMS: Credit limit check + pending_approval flow | Dev | Vượt hạn mức → pending_approval → approve OK | ☐ |
| 1.14 | OMS: Cutoff 16h logic + consolidation + split | Dev | Cutoff group assigned, gom/tách verified | ☐ |
| 1.15 | TMS: VRP service setup (Python + OR-Tools + OSRM) | Dev | POST /solve → trips returned, < 120s timeout | ☐ |
| 1.16 | TMS: Trip CRUD + assign vehicle/driver | Dev | Trip lifecycle: created → assigned | ☐ |
| 1.17 | TMS: GPS WebSocket (gorilla/websocket + Redis pub/sub) | Dev | Driver gửi GPS → Redis → Dispatcher nhận | ☐ |
| 1.18 | OSRM Docker + Vietnam OSM data loaded | Dev | Distance matrix query working | ☐ |
| 1.19 | VRP benchmark: 1,000 đơn + 100 xe giả lập | Dev | Solver < 120s confirmed, log results | ☐ |
| 1.20 | Next.js scaffold: layout, auth pages, navigation | Dev | Login → dashboard shell (empty widgets) | ☐ |

### Phase 1 Gate Criteria
- [ ] Docker Compose full stack runs
- [ ] CI/CD deploys to staging
- [ ] Order → Shipment → VRP → Trip end-to-end
- [ ] GPS WebSocket live
- [ ] BHL API docs received (**BLOCKER for Phase 3**)
- [ ] VRP benchmark passed

---

# 3. PHASE 2 — WMS & DRIVER APP (14/04 – 25/04)

**Mục tiêu:** Kho vận hành: picking, gate check, PDA scan. Driver App MVP giao hàng, thu tiền, thu vỏ.

## Week 3 (14/04 – 18/04)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 2.1 | WMS: Inbound (nhập kho) + lot/batch management | Dev | POST /inbound → stock_quants updated | ☐ |
| 2.2 | WMS: Picking service (FEFO/FIFO gợi ý lô) | Dev | Picking order → suggested lots ordered by expiry | ☐ |
| 2.3 | WMS: Gate check (đối chiếu scan vs phiếu xuất, R01) | Dev | Scan match → pass; mismatch → fail + block | ☐ |
| 2.4 | WMS: Barcode scan API | Dev | POST /barcode-scan → product + lot info | ☐ |
| 2.5 | WMS: Expiry alert cron (Asynq scheduled task) | Dev | Daily scan → notification for near-expiry lots | ☐ |
| 2.6 | WMS: Location hierarchy (LTREE queries) | Dev | Query child locations, move between locations | ☐ |
| 2.7 | Driver App: Expo project setup + navigation | Dev | App builds iOS + Android simulators | ☐ |
| 2.8 | Driver App: Login + JWT SecureStore | Dev | Login → persist token → auto-refresh | ☐ |

## Week 4 (21/04 – 25/04)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 2.9 | Driver App: Checklist screen (pre/post trip) | Dev | Submit checklist + photos → API saved | ☐ |
| 2.10 | Driver App: Trip view (stops list, navigation link) | Dev | Show stops, open Google Maps | ☐ |
| 2.11 | Driver App: ePOD screen (confirm delivery + photos + GPS) | Dev | Submit ePOD → delivery_attempt created | ☐ |
| 2.12 | Driver App: Payment screen (cash/transfer/credit) | Dev | Submit payment → receivable_ledger updated | ☐ |
| 2.13 | Driver App: Return collection screen (vỏ + photos) | Dev | Submit returns → asset_ledger updated | ☐ |
| 2.14 | Driver App: GPS background service (30s interval) | Dev | GPS tracked even when app background | ☐ |
| 2.15 | Driver App: Offline sync queue (SQLite + FIFO) | Dev | Queue actions offline → sync when reconnect | ☐ |
| 2.16 | PDA: PWA barcode scanner page | Dev | Zebra PDA scans → API lookup → show result | ☐ |
| 2.17 | Web: Dispatcher map (Google Maps + GPS markers) | Dev | Real-time vehicle positions on map | ☐ |
| 2.18 | Web: Order management screens (list + detail + edit) | Dev | CRUD orders with ATP display | ☐ |

### Phase 2 Gate Criteria
- [ ] WMS picking + gate check end-to-end
- [ ] Driver App: checklist → delivery → payment → return
- [ ] Offline mode: 2h airplane mode, sync OK after reconnect
- [ ] Dispatcher map shows live GPS
- [ ] PDA scan verified on real/emulated device

---

# 4. PHASE 3 — INTEGRATION & REPORTS (28/04 – 09/05)

**Mục tiêu:** Bravo/DMS/Zalo connected. Reconciliation module. Dashboard & KPIs.

> ⚠️ **BLOCKER:** Nếu BHL chưa cung cấp API docs/credentials từ Phase 1, Phase 3 bị block.

## Week 5 (28/04 – 02/05)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 3.1 | Bravo adapter: Push delivery/payment/credit/return/gate-check | Dev | Asynq queue → Bravo sandbox OK, retry verified | ☐ |
| 3.2 | Bravo adapter: Nightly credit balance reconcile (02:00 cron) | Dev | Reconcile receivable_ledger vs Bravo → log diffs | ☐ |
| 3.3 | Bravo webhook: Receive document_posted event | Dev | POST /bravo/webhook → integration_log updated | ☐ |
| 3.4 | DMS adapter: Push order status changes | Dev | Order status change → DMS sync → log success | ☐ |
| 3.5 | Zalo OA adapter: Send ZNS confirmation message | Dev | ePOD confirmed → Zalo message sent with link | ☐ |
| 3.6 | NPP Portal: Confirm page (GET/POST /confirm/:token) | Dev | NPP click link → view items → confirm/dispute | ☐ |
| 3.7 | Zalo auto-confirm cron (24h silent consent, R13) | Dev | Unresponded tokens auto-confirmed after 24h | ☐ |
| 3.8 | Integration DLQ: Admin UI view failed jobs + re-process | Dev | View DLQ, retry, skip | ☐ |

## Week 6 (05/05 – 09/05)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 3.9 | Reconciliation module: Auto reconcile trip end (hàng-tiền-vỏ) | Dev | Trip completed → reconciliation_record auto-created | ☐ |
| 3.10 | Reconciliation: Discrepancy ticket CRUD + T+1 deadline alert | Dev | Open/close ticket, escalation notification | ☐ |
| 3.11 | Reconciliation: Daily close summary | Dev | GET /daily-report → all trips summarized | ☐ |
| 3.12 | WMS: Return inbound (phân xưởng confirm, R02 vỏ) | Dev | Workshop confirm → discrepancy auto-created if diff | ☐ |
| 3.13 | WMS: Asset compensation (bồi hoàn vỏ, R10) | Dev | Damaged vỏ → price lookup → compensation calculated | ☐ |
| 3.14 | Notification engine: Web push (WebSocket) + FCM (Driver App) | Dev | All 9 notification types working (BRD §11.2) | ☐ |
| 3.15 | Web: Dashboard (5 widgets: map, pipeline, alerts, today, recon) | Dev | Real-time dashboard rendering | ☐ |
| 3.16 | Web: KPI reports (OTD, empty run, utilization, redelivery) | Dev | Charts rendered, correct data | ☐ |
| 3.17 | Daily KPI snapshot cron | Dev | Nightly compute → daily_kpi_snapshots populated | ☐ |
| 3.18 | Web: Reconciliation screens (trip summary, discrepancy list) | Dev | View recon, open/close discrepancy | ☐ |
| 3.19 | App version check endpoint | Dev | GET /app/version → force_update logic | ☐ |
| 3.20 | Audit log middleware | Dev | All create/update/delete → audit_logs recorded | ☐ |

### Phase 3 Gate Criteria
- [ ] Bravo sync end-to-end (sandbox confirmed)
- [ ] DMS sync working
- [ ] Zalo send + NPP confirm/auto-confirm verified
- [ ] Reconciliation: 0 discrepancy for clean trips, auto-detect for dirty
- [ ] All 9 notification types delivered
- [ ] Dashboard KPIs render with real data

---

# 5. PHASE 4 — UAT & GO-LIVE (12/05 – 23/05)

**Mục tiêu:** Test với người dùng thật. Data migration. Load test. Bug fix. Go-live.

## Week 7 (12/05 – 16/05)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 4.1 | Data migration: Import 800 NPP + addresses | Dev + BA | All customers in DB, addresses verified | ☐ |
| 4.2 | Data migration: Import 70 vehicles + drivers | Dev + BA | Vehicles + drivers linked, giấy tờ entered | ☐ |
| 4.3 | Data migration: Import 30 products + barcode prefix | Dev + BA | Products with correct weights/volumes | ☐ |
| 4.4 | Data migration: Import 500 routes + waypoints | Dev + BA | Routes loaded, distance calculated | ☐ |
| 4.5 | Data migration: Import credit balances từ Bravo | Dev + KT | receivable_ledger opening balances = Bravo | ☐ |
| 4.6 | Data migration: Import asset balance (vỏ tồn tại NPP) | Dev + KT | asset_ledger opening balances match | ☐ |
| 4.7 | UAT: Dispatcher test (2-3 người): nhập đơn → VRP → duyệt | QA + Users | 12 UAT criteria (BRD §14) checked | ☐ |
| 4.8 | UAT: Driver test (5-10 tài xế): checklist → giao → thu tiền/vỏ | QA + Users | End-to-end trip completed on real phone | ☐ |
| 4.9 | UAT: Kế toán test: gate check → reconciliation → discrepancy | QA + Users | Recon flow verified | ☐ |
| 4.10 | UAT: Thủ kho test: picking → PDA scan → gate check | QA + Users | PDA scan on real device | ☐ |

## Week 8 (19/05 – 23/05)

| # | Task | Owner | DoD | Status |
|---|------|-------|-----|--------|
| 4.11 | Load test: 3,000 đơn giả lập (Tết scenario) | Dev | Response time < 2s P95, no errors | ☐ |
| 4.12 | Load test: VRP 3,000 đơn parallel 2 kho | Dev | Solver < 2 min per warehouse batch | ☐ |
| 4.13 | Bug fix priority: Critical → High → Medium | Dev | 0 critical, 0 high bugs remaining | ☐ |
| 4.14 | Production environment setup: 2 VMs, SSL, DNS | DevOps | api.bhl-ops.vn resolves, HTTPS working | ☐ |
| 4.15 | Production Docker Compose + systemd | DevOps | Auto-restart on reboot verified | ☐ |
| 4.16 | Backup/DR drill: pg_dump → restore staging → verify | DevOps | Restore < 1h, data integrity confirmed | ☐ |
| 4.17 | Monitoring: Grafana dashboards + Prometheus alerts | DevOps | 3 dashboards live, alerts fire on test trigger | ☐ |
| 4.18 | User training: Dispatcher + DVKH + Kế toán + Thủ kho | BA + Dev | Training sessions completed, user guide delivered | ☐ |
| 4.19 | Go-live checklist: final sign-off by BHL | PM + BHL | Written approval from BHL PM | ☐ |
| 4.20 | **GO-LIVE:** Production deploy + smoke test + monitor | Dev + DevOps | System live, first real order processed | ☐ |

### Phase 4 Gate Criteria
- [ ] All 12 UAT criteria passed (BRD §14)
- [ ] Load test 3,000 orders → no degradation
- [ ] 0 critical bugs, 0 high bugs
- [ ] Data migration verified by BHL accountant
- [ ] Backup/DR drill passed
- [ ] Monitoring live
- [ ] BHL sign-off

---

# 6. MILESTONES & GATES

| # | Milestone | Date | Gate Criteria | Owner |
|---|-----------|------|---------------|-------|
| M1 | **Phase 1 Complete** | 11/04 | Order→VRP→Trip e2e, GPS live, CI/CD working, BHL APIs received | Dev + BHL |
| M2 | **Phase 2 Complete** | 25/04 | WMS+PDA working, Driver App MVP, Offline tested | Dev |
| M3 | **Phase 3 Complete** | 09/05 | Bravo/DMS/Zalo connected, Recon+Dashboard working | Dev |
| M4 | **UAT Sign-off** | 16/05 | 12 UAT criteria passed, data migrated | QA + BHL |
| M5 | **GO-LIVE** | ~15-26/05 | 0 critical bugs, monitoring live, BHL approval | All |

**Gate Rule:** Phase N+1 KHÔNG bắt đầu nếu Phase N gate chưa pass. Flex 2-3 ngày cho Phase 1-3. Phase 4 UAT không flex.

---

# 7. DEPENDENCIES & BLOCKERS

| # | Dependency | Required By | Provider | Status | Impact nếu trễ |
|---|-----------|-------------|----------|--------|----------------|
| D1 | Bravo API doc + sandbox | Phase 3 W5 | BHL IT | ☐ Chưa | 🔴 Phase 3 block hoàn toàn |
| D2 | DMS API doc + sandbox | Phase 3 W5 | BHL IT | ☐ Chưa | 🟡 DMS sync delay |
| D3 | Zalo OA credentials (ZNS) | Phase 3 W5 | BHL IT | ☐ Chưa | 🔴 Zalo confirm không hoạt động |
| D4 | PDA model + barcode format | Phase 2 W4 | BHL + BA | ☐ Chưa | 🟡 PDA test delay |
| D5 | Master data (800 NPP, xe, tài xế, routes) | Phase 4 W7 | BHL PM | ☐ Chưa | 🔴 UAT không thể chạy data thật |
| D6 | Credit balances từ Bravo export | Phase 4 W7 | BHL KT | ☐ Chưa | 🔴 Công nợ sai khi go-live |
| D7 | Production VM servers (2 VMs) | Phase 4 W8 | BHL IT | ☐ Chưa | 🔴 Không deploy production được |
| D8 | SSL certificate + domain DNS | Phase 4 W8 | BHL IT | ☐ Chưa | 🔴 HTTPS không hoạt động |

---

# 8. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation | Owner |
|------|-----------|--------|------------|-------|
| BHL chậm cung cấp Bravo API doc | Cao | 🔴 | Yêu cầu commit deadline Phase 1 W1. Fallback: CSV import | PM |
| Zalo OA chưa được duyệt | TB | 🔴 | Đăng ký sớm, placeholder confirm (skip Zalo) | BHL IT |
| VRP chậm > 120s cho 1000 đơn | Thấp | 🟡 | Benchmark Phase 1. Batch theo kho nếu chậm | Dev |
| Offline sync conflict (Driver App) | TB | 🟡 | Server-wins, test kỹ Phase 2 | Dev |
| PDA model không tương thích | Thấp | 🟡 | PWA browser-based, không phụ thuộc native app | Dev |
| Team capacity (1 dev + vibe coding) | TB | 🟡 | Vibe coding giúp gen CRUD nhanh, focus logic nghiệp vụ phức tạp | Dev |
| UAT user không đủ thời gian | TB | 🟡 | Book lịch sớm Phase 3. UAT kịch bản chạy sẵn | PM + BA |

---

# 9. TEAM & RESPONSIBILITIES

| Role | Người | Trách nhiệm chính |
|------|-------|-------------------|
| **Lead Dev** | (You) | Kiến trúc, code backend+frontend, vibe coding, deploy |
| **BA** | (You/BHL) | Nghiệp vụ, UAT scenarios, data migration mapping |
| **BHL PM** | BHL assigned | Cung cấp API docs, credentials, master data, UAT participants |
| **BHL IT** | BHL assigned | Bravo/DMS sandbox, Zalo OA, server VM, DNS |
| **BHL Kế toán** | BHL assigned | Credit balance export, asset balance, UAT recon |
| **UAT Participants** | BHL staff | Dispatcher, DVKH, Tài xế, Thủ kho, Kế toán |

---

# 10. PROGRESS TRACKING

## 10.1 Phương pháp tracking

| Tool | Purpose |
|------|---------|
| GitHub Issues | Task tracking — mỗi task 1 issue, labeled by Phase |
| GitHub Projects (Board) | Kanban: Backlog → In Progress → Review → Done |
| Tài liệu PEP (này) | Checklist master — update status ☐/☑ hàng tuần |
| Weekly standup | 15 phút mỗi thứ 2 — progress + blockers |

## 10.2 Status Convention

| Symbol | Meaning |
|--------|---------|
| ☐ | Not started |
| 🔄 | In progress |
| ☑ | Completed |
| ⚠ | Blocked |
| ❌ | Cancelled / Descoped |

## 10.3 Weekly Progress Report Template

```
## Week [N] (DD/MM – DD/MM)
### Completed
- [task]

### In Progress
- [task] — ETA: [date]

### Blocked
- [task] — Reason: [reason], Needed from: [who]

### Risks
- [risk description]

### Next Week Plan
- [task list]
```

---

# 11. DEFINITION OF DONE

## Task level
- [ ] Code written + compiles (Go `go vet`, `golangci-lint`)
- [ ] Unit tests for business logic (>80% coverage on service layer)
- [ ] API tested manually (Postman/curl)
- [ ] PR reviewed (self-review OK for solo dev)
- [ ] CI pipeline passes
- [ ] Staging deployed and verified

## Phase level
- [ ] All tasks in checklist ☑
- [ ] Gate criteria all passed
- [ ] Integration tests passing on staging
- [ ] No critical/high bugs open

## Go-live level
- [ ] All 12 UAT criteria passed (BRD §14)
- [ ] Load test passed (3,000 orders)
- [ ] 0 critical, 0 high bugs
- [ ] Data migration verified by BHL accountant
- [ ] Backup/DR drill passed
- [ ] Monitoring + alerting live
- [ ] BHL written sign-off

---

**=== HẾT TÀI LIỆU PEP v1.0 ===**

*Project Execution Plan v1.0 — 4 Phases, 60+ tasks, milestones, dependencies, risk register.*
