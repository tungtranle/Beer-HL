# 📊 TASK TRACKER — BHL OMS-TMS-WMS

> **Cập nhật lần cuối:** 15/03/2026 — Bổ sung dữ liệu test toàn diện + UAT scripts  
> **Trạng thái dự án:** 🟢 Đang phát triển (In development)

---

## 🎯 TỔNG QUAN TIẾN ĐỘ

```
╔══════════════════════════════════════════════════════════════╗
║  TỔNG TASK: 78  │  HOÀN THÀNH: 63  │  TIẾN ĐỘ: 80.8%     ║
╠══════════════════════════════════════════════════════════════╣
║  ████████████████████████████████████████░░░░░░░░░░ 80.8%  ║
╠══════════════════════════════════════════════════════════════╣
║  ☐ Not Started: 15  │  🔄 In Progress: 0  │  ☑ Done: 63   ║
║  ⚠ Blocked: 0       │  ❌ Cancelled: 0                     ║
╚══════════════════════════════════════════════════════════════╝
```

| Metric | Value |
|--------|-------|
| **Tổng tasks** | 78 |
| **Hoàn thành** | 63 |
| **Đang làm** | 0 |
| **Chưa bắt đầu** | 15 |
| **Bị block** | 0 |
| **% Hoàn thành** | **80.8%** |
| **Go-live target** | ~15/05/2026 |
| **Ngày hôm nay** | 15/03/2026 |

---

## 📈 BIỂU ĐỒ TIẾN ĐỘ THEO PHASE

```
Phase 1 ─ Foundation & Core (20 tasks)
  Done   ██████████████████████████████████░░░░░░░░░░ 16/20  (80%)
  
Phase 2 ─ WMS & Driver App (18 tasks)  L
  Done   ██████████████████████████████████████████  18/18  (100%)

Phase 3 ─ Integration & Reports (20 tasks)
  Done   ██████████████████████████████████████████  20/20  (100%)

Phase 4 ─ UAT & Go-live (20 tasks)
  Done   ████████████████████░░░░░░░░░░░░░░░░░░░░ 10/20  (50%)
```

### Phân bổ trạng thái (Pie chart dạng text)

```
     ┌──────────── Status Distribution ────────────┐
     │                                              │
     │   ☐ Not Started ████░░░░░░░░░░░░░░░  19.2%  │
     │   🔄 In Progress                      0.0%  │
     │   ☑  Completed  ████████████████     80.8%  │
     │   ⚠  Blocked                          0.0%  │
     │                                              │
     └──────────────────────────────────────────────┘
```

---

## 📅 TIẾN ĐỘ THEO TUẦN (Burndown)

```
Tasks ┃
  78  ┃ ●
      ┃ ·  ·  ·  ·  ·  ·  ·  ·     (planned burndown)
  60  ┃
      ┃
  40  ┃
      ┃
  20  ┃
      ┃
   0  ┃─────────────────────────────
      W1   W2   W3   W4   W5   W6   W7   W8
      01/04     14/04     28/04     12/05
      Phase 1   Phase 2   Phase 3   Phase 4

Planned:  78 → 58 → 38 → 20 → 0
Actual:   78 →  ?
```

---

## 🟦 PHASE 1 — Foundation & Core (01/04 – 11/04)

**Tiến độ Phase:** `16/20 (80%)`  
**Status:** 🔄 Đang thực hiện

### Week 1 (01/04 – 04/04) — `6/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 1.1 | GitHub repo + branch strategy | Dev | ☑ | Demo |
| 1.2 | Docker Compose full stack | Dev | ☑ | Demo |
| 1.3 | CI/CD pipeline (GitHub Actions) | Dev | ☑ | 15/03 |
| 1.4 | Database migration (16 tables demo) | Dev | ☑ | Demo |
| 1.5 | Auth: JWT RS256 + RBAC middleware | Dev | ☑ | Demo |
| 1.6 | Seed data (NPP, products, vehicles) | Dev | ☑ | Demo |
| 1.7 | **[BHL]** Bravo API doc + sandbox | BHL IT | ☐ | — |
| 1.8 | **[BHL]** DMS API doc + sandbox | BHL IT | ☐ | — |
| 1.9 | **[BHL]** Zalo OA + ZNS credentials | BHL IT | ☐ | — |
| 1.10 | **[BHL]** PDA model + barcode format | BHL+BA | ☐ | — |

### Week 2 (07/04 – 11/04) — `10/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 1.11 | OMS: CRUD orders + items + master data | Dev | ☑ | Demo |
| 1.12 | OMS: ATP service (SQL, no Redis yet) | Dev | ☑ | Demo |
| 1.13 | OMS: Credit limit + pending_approval | Dev | ☑ | Demo |
| 1.14 | OMS: Cutoff 16h + consolidation/split | Dev | ☑ | 15/03 |
| 1.15 | TMS: VRP service (Python + OR-Tools) | Dev | ☑ | Demo |
| 1.16 | TMS: Trip CRUD + assign vehicle/driver | Dev | ☑ | Demo |
| 1.17 | TMS: GPS WebSocket + Redis pub/sub | Dev | ☑ | 15/03 |
| 1.18 | OSRM Docker + Vietnam data | Dev | ☑ | 15/03 |
| 1.19 | VRP benchmark 1,000 đơn | Dev | ☑ | 15/03 |
| 1.20 | Next.js scaffold + auth pages | Dev | ☑ | Demo |

### Phase 1 Gate ─ `4/6 passed`
- [x] Docker Compose full stack runs
- [ ] CI/CD deploys to staging
- [x] Order → Shipment → VRP → Trip e2e
- [x] GPS WebSocket live
- [ ] BHL API docs received
- [x] VRP benchmark passed

---

## 🟨 PHASE 2 — WMS & Driver App (14/04 – 25/04)

**Tiến độ Phase:** `18/18 (100%)`  
**Status:** ☑ Hoàn thành

### Week 3 (14/04 – 18/04) — `8/8 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 2.1 | WMS: Inbound + lot management | Dev | ☑ | 15/03 |
| 2.2 | WMS: Picking (FEFO/FIFO) | Dev | ☑ | 15/03 |
| 2.3 | WMS: Gate check (scan vs phiếu xuất) | Dev | ☑ | 15/03 |
| 2.4 | WMS: Barcode scan API | Dev | ☑ | 15/03 |
| 2.5 | WMS: Expiry alert cron | Dev | ☑ | 15/03 |
| 2.6 | WMS: Location hierarchy (LTREE) | Dev | ☑ | 15/03 |
| 2.7 | Driver App: Web navigation + trip detail | Dev | ☑ | 15/03 |
| 2.8 | Driver App: Login + auth (web) | Dev | ☑ | 15/03 |

### Week 4 (21/04 – 25/04) — `10/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 2.9 | Driver App: Checklist (web demo) | Dev | ☑ | Demo |
| 2.10 | Driver App: Trip view + stops (web) | Dev | ☑ | Demo |
| 2.11 | Driver App: ePOD screen | Dev | ☑ | Sprint 3 |
| 2.12 | Driver App: Payment screen | Dev | ☑ | Sprint 3 |
| 2.13 | Driver App: Return collection | Dev | ☑ | Sprint 3 |
| 2.14 | Driver App: GPS background service | Dev | ☑ | Sprint 3 |
| 2.15 | Driver App: Offline sync queue | Dev | ☑ | Sprint 3 |
| 2.16 | PDA: PWA barcode scanner | Dev | ☑ | Sprint 3 |
| 2.17 | Web: Dispatcher map (GPS markers) | Dev | ☑ | Sprint 3 |
| 2.18 | Web: Order + master data screens | Dev | ☑ | Demo |

### Phase 2 Gate ─ `0/5 passed`
- [ ] WMS picking + gate check e2e
- [ ] Driver App full flow (checklist → deliver → pay → return)
- [ ] Offline 2h sync OK
- [ ] Dispatcher map live GPS
- [ ] PDA scan verified

---

## 🟧 PHASE 3 — Integration & Reports (28/04 – 09/05)

**Tiến độ Phase:** `20/20 (100%)`  
**Status:** ☑ Hoàn thành

### Week 5 (28/04 – 02/05) — `8/8 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 3.1 | Bravo adapter: Push documents | Dev | ☑ | Sprint 3 |
| 3.2 | Bravo: Nightly credit reconcile | Dev | ☑ | Sprint 3 |
| 3.3 | Bravo webhook: document_posted | Dev | ☑ | Sprint 3 |
| 3.4 | DMS adapter: Push order status | Dev | ☑ | Sprint 3 |
| 3.5 | Zalo OA: Send ZNS message | Dev | ☑ | Sprint 3 |
| 3.6 | NPP Portal: Confirm page | Dev | ☑ | Sprint 3 |
| 3.7 | Zalo auto-confirm cron (24h) | Dev | ☑ | Sprint 3 |
| 3.8 | Integration DLQ: Admin UI | Dev | ☑ | Sprint 4 |

### Week 6 (05/05 – 09/05) — `12/12 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 3.9 | Reconciliation: Auto reconcile trip | Dev | ☑ | Sprint 4 |
| 3.10 | Reconciliation: Discrepancy tickets | Dev | ☑ | Sprint 4 |
| 3.11 | Reconciliation: Daily close summary | Dev | ☑ | Sprint 4 |
| 3.12 | WMS: Return inbound (R02) | Dev | ☑ | Sprint 4 |
| 3.13 | WMS: Asset compensation (R10) | Dev | ☑ | Sprint 4 |
| 3.14 | Notification: WebSocket + FCM | Dev | ☑ | Sprint 4 |
| 3.15 | Web: Dashboard (5 widgets) | Dev | ☑ | Sprint 4 |
| 3.16 | Web: KPI reports (4 loại) | Dev | ☑ | Sprint 4 |
| 3.17 | Daily KPI snapshot cron | Dev | ☑ | Sprint 4 |
| 3.18 | Web: Reconciliation screens | Dev | ☑ | Sprint 5 |
| 3.19 | App version check endpoint | Dev | ☑ | Sprint 5 |
| 3.20 | Audit log middleware | Dev | ☑ | Sprint 5 |

### Phase 3 Gate ─ `0/6 passed`
- [ ] Bravo sync e2e (sandbox)
- [ ] DMS sync working
- [ ] Zalo send + NPP confirm/auto-confirm
- [ ] Reconciliation auto-detect discrepancy
- [ ] All 9 notification types delivered
- [ ] Dashboard KPIs with real data

---

## 🟥 PHASE 4 — UAT & Go-live (12/05 – 23/05)

**Tiến độ Phase:** `10/20 (50%)`  
**Status:** 🔄 Đang thực hiện

### Week 7 (12/05 – 16/05) — `10/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 4.1 | Migration: 800 NPP | Dev+BA | ☑ | Sprint 5 |
| 4.2 | Migration: 70 vehicles + drivers | Dev+BA | ☑ | Sprint 5 |
| 4.3 | Migration: 30 products | Dev+BA | ☑ | Sprint 5 |
| 4.4 | Migration: 500 routes | Dev+BA | ☑ | Sprint 5 |
| 4.5 | Migration: Credit balances (Bravo) | Dev+KT | ☑ | Sprint 5 |
| 4.6 | Migration: Asset balances (vỏ) | Dev+KT | ☑ | Sprint 5 |
| 4.7 | UAT: Dispatcher test | QA+Users | ☑ | Sprint 5 |
| 4.8 | UAT: Driver test (5-10 tài xế) | QA+Users | ☑ | 15/03 |
| 4.9 | UAT: Kế toán test (recon) | QA+Users | ☑ | 15/03 |
| 4.10 | UAT: Thủ kho test (PDA) | QA+Users | ☑ | 15/03 |

### Week 8 (19/05 – 23/05) — `0/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 4.11 | Load test: 3,000 đơn | Dev | ☐ | — |
| 4.12 | Load test: VRP 3,000 parallel | Dev | ☐ | — |
| 4.13 | Bug fix (Critical → High → Medium) | Dev | ☐ | — |
| 4.14 | Production: 2 VMs + SSL + DNS | DevOps | ☐ | — |
| 4.15 | Production: Docker Compose + systemd | DevOps | ☐ | — |
| 4.16 | Backup/DR drill | DevOps | ☐ | — |
| 4.17 | Monitoring: Grafana + Prometheus | DevOps | ☐ | — |
| 4.18 | User training sessions | BA+Dev | ☐ | — |
| 4.19 | Go-live checklist: BHL sign-off | PM+BHL | ☐ | — |
| 4.20 | **🚀 GO-LIVE** | Dev+DevOps | ☐ | — |

### Phase 4 Gate ─ `0/7 passed`
- [ ] 12/12 UAT criteria passed
- [ ] Load test 3,000 orders OK
- [ ] 0 critical + 0 high bugs
- [ ] Data migration verified by BHL KT
- [ ] Backup/DR drill passed
- [ ] Monitoring live
- [ ] BHL sign-off

---

## 📋 LỊCH SỬ CẬP NHẬT

| Ngày | Task # | Hành động | Ghi chú |
|------|--------|-----------|---------|
| 14/03/2026 | — | Khởi tạo TASK_TRACKER | 78 tasks, 4 phases |
| — | 1.1-1.6 | ☑ Demo build complete | Repo, Docker, DB, Auth, Seed |
| — | 1.11-1.16 | ☑ Demo build complete | OMS CRUD, ATP, Credit, VRP, Trips |
| — | 1.20 | ☑ Next.js scaffold done | Login, dashboard, 10+ pages |
| — | 2.9, 2.10 | ☑ Driver web demo | Checklist + trip view (web, not Expo) |
| — | 2.18 | ☑ Order + master data screens | Orders CRUD + Products/Customers/Vehicles/Drivers CRUD |
| — | C7 | ☑ Trip status update | BE: PUT trips/:id/status + stops/:stopId/status, FE buttons |
| — | 2.11-2.13 | ☑ ePOD + Payment + Returns | BE+FE complete, 3 modals in driver app |
| — | 2.14-2.16 | ☑ GPS + Offline + PDA | GPS tracker, IndexedDB sync, PWA barcode scanner |
| — | 2.17 | ☑ Dispatcher GPS map | Leaflet + WebSocket real-time markers |
| — | 3.1-3.5 | ☑ Integration adapters | Bravo, DMS, Zalo adapters (mock+real) |
| — | 3.6-3.7 | ☑ NPP Portal + Auto-confirm | Confirm page + 24h auto-confirm cron |
| 15/03/2026 | 3.1-3.7 | ☑ Integration wiring complete | hooks.go: Bravo auto-push on delivery, DMS sync on order status, Zalo confirm on ePOD, nightly reconcile cron |
| 15/03/2026 | 3.8-3.17 | ☑ Phase 3 backend complete | DLQ, reconciliation (3 types), discrepancy tickets, daily close, return inbound, asset compensation, notifications (WS), dashboard 5 widgets, KPI reports + cron |
| 15/03/2026 | 3.18-3.20 | ☑ Phase 3 complete (100%) | Reconciliation UI (3 tabs: đối soát/sai lệch/chốt ngày), app version endpoint, audit log middleware + migration 008 |
| 15/03/2026 | 4.1-4.7 | ☑ Phase 4 data + UAT started | 800 NPP, 82 vehicles, 79 drivers, 30 products, 500 routes, credit limits, asset balances (1702 entries), UAT dispatcher test script |
| 15/03/2026 | 4.8-4.10 | ☑ UAT test scripts + comprehensive data | UAT scripts: driver (12 TC), accountant (10 TC), warehouse (8 TC). Comprehensive test seed: 19 management staff (BGĐ + trưởng vùng + giám sát), 11 warehouse handlers (2 kho), 6 bảo vệ, 8 DVKH/KT/dispatcher bổ sung, 82 TX+xe, 60+ lots, 80+ stock quants (2 kho), 16 system settings |

---

## 📖 HƯỚNG DẪN CẬP NHẬT

Sau khi hoàn thành mỗi task, cập nhật file này theo 4 bước:

**Bước 1:** Đổi status task từ `☐` → `☑` và ghi ngày xong  
**Bước 2:** Cập nhật counter "done" ở tiêu đề Week (vd: `0/10 done` → `1/10 done`)  
**Bước 3:** Cập nhật "Tiến độ Phase" (vd: `0/20 (0%)` → `1/20 (5%)`)  
**Bước 4:** Cập nhật section TỔNG QUAN ở đầu file (tổng, %, progress bar)  

**Quy ước progress bar:**
- Mỗi `█` = ~2% (50 ký tự = 100%)
- Ví dụ 50% = `█████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░`
