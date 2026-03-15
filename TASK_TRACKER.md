# 📊 TASK TRACKER — BHL OMS-TMS-WMS

> **Cập nhật lần cuối:** — Audit demo code vs task tracker  
> **Trạng thái dự án:** 🟢 Đang phát triển (In development)

---

## 🎯 TỔNG QUAN TIẾN ĐỘ

```
╔══════════════════════════════════════════════════════════════╗
║  TỔNG TASK: 78  │  HOÀN THÀNH: 27  │  TIẾN ĐỘ: 34.6%     ║
╠══════════════════════════════════════════════════════════════╣
║  █████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 34.6%  ║
╠══════════════════════════════════════════════════════════════╣
║  ☐ Not Started: 51  │  🔄 In Progress: 0  │  ☑ Done: 27   ║
║  ⚠ Blocked: 0       │  ❌ Cancelled: 0                     ║
╚══════════════════════════════════════════════════════════════╝
```

| Metric | Value |
|--------|-------|
| **Tổng tasks** | 78 |
| **Hoàn thành** | 27 |
| **Đang làm** | 0 |
| **Chưa bắt đầu** | 51 |
| **Bị block** | 0 |
| **% Hoàn thành** | **34.6%** |
| **Go-live target** | ~15/05/2026 |
| **Ngày hôm nay** | — |

---

## 📈 BIỂU ĐỒ TIẾN ĐỘ THEO PHASE

```
Phase 1 ─ Foundation & Core (20 tasks)
  Done   ██████████████████████████████████░░░░░░░░░░ 16/20  (80%)
  
Phase 2 ─ WMS & Driver App (18 tasks)  
  Done   ██████████████████░░░░░░░░░░░░░░░░░░░░░░  11/18  (61%)

Phase 3 ─ Integration & Reports (20 tasks)
  Done   ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0/20  (0%)

Phase 4 ─ UAT & Go-live (20 tasks)
  Done   ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  0/20  (0%)
```

### Phân bổ trạng thái (Pie chart dạng text)

```
     ┌──────────── Status Distribution ────────────┐
     │                                              │
     │   ☐ Not Started █████████████░░░░░░░  65.4%  │
     │   🔄 In Progress                      0.0%  │
     │   ☑  Completed  ███████              34.6%  │
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

**Tiến độ Phase:** `11/18 (61%)`  
**Status:** 🔄 Đang thực hiện

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

### Week 4 (21/04 – 25/04) — `3/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 2.9 | Driver App: Checklist (web demo) | Dev | ☑ | Demo |
| 2.10 | Driver App: Trip view + stops (web) | Dev | ☑ | Demo |
| 2.11 | Driver App: ePOD screen | Dev | ☐ | — |
| 2.12 | Driver App: Payment screen | Dev | ☐ | — |
| 2.13 | Driver App: Return collection | Dev | ☐ | — |
| 2.14 | Driver App: GPS background service | Dev | ☐ | — |
| 2.15 | Driver App: Offline sync queue | Dev | ☐ | — |
| 2.16 | PDA: PWA barcode scanner | Dev | ☐ | — |
| 2.17 | Web: Dispatcher map (GPS markers) | Dev | ☐ | — |
| 2.18 | Web: Order + master data screens | Dev | ☑ | Demo |

### Phase 2 Gate ─ `0/5 passed`
- [ ] WMS picking + gate check e2e
- [ ] Driver App full flow (checklist → deliver → pay → return)
- [ ] Offline 2h sync OK
- [ ] Dispatcher map live GPS
- [ ] PDA scan verified

---

## 🟧 PHASE 3 — Integration & Reports (28/04 – 09/05)

**Tiến độ Phase:** `0/20 (0%)`  
**Status:** ☐ Chưa bắt đầu

### Week 5 (28/04 – 02/05) — `0/8 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 3.1 | Bravo adapter: Push documents | Dev | ☐ | — |
| 3.2 | Bravo: Nightly credit reconcile | Dev | ☐ | — |
| 3.3 | Bravo webhook: document_posted | Dev | ☐ | — |
| 3.4 | DMS adapter: Push order status | Dev | ☐ | — |
| 3.5 | Zalo OA: Send ZNS message | Dev | ☐ | — |
| 3.6 | NPP Portal: Confirm page | Dev | ☐ | — |
| 3.7 | Zalo auto-confirm cron (24h) | Dev | ☐ | — |
| 3.8 | Integration DLQ: Admin UI | Dev | ☐ | — |

### Week 6 (05/05 – 09/05) — `0/12 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 3.9 | Reconciliation: Auto reconcile trip | Dev | ☐ | — |
| 3.10 | Reconciliation: Discrepancy tickets | Dev | ☐ | — |
| 3.11 | Reconciliation: Daily close summary | Dev | ☐ | — |
| 3.12 | WMS: Return inbound (R02) | Dev | ☐ | — |
| 3.13 | WMS: Asset compensation (R10) | Dev | ☐ | — |
| 3.14 | Notification: WebSocket + FCM | Dev | ☐ | — |
| 3.15 | Web: Dashboard (5 widgets) | Dev | ☐ | — |
| 3.16 | Web: KPI reports (4 loại) | Dev | ☐ | — |
| 3.17 | Daily KPI snapshot cron | Dev | ☐ | — |
| 3.18 | Web: Reconciliation screens | Dev | ☐ | — |
| 3.19 | App version check endpoint | Dev | ☐ | — |
| 3.20 | Audit log middleware | Dev | ☐ | — |

### Phase 3 Gate ─ `0/6 passed`
- [ ] Bravo sync e2e (sandbox)
- [ ] DMS sync working
- [ ] Zalo send + NPP confirm/auto-confirm
- [ ] Reconciliation auto-detect discrepancy
- [ ] All 9 notification types delivered
- [ ] Dashboard KPIs with real data

---

## 🟥 PHASE 4 — UAT & Go-live (12/05 – 23/05)

**Tiến độ Phase:** `0/20 (0%)`  
**Status:** ☐ Chưa bắt đầu

### Week 7 (12/05 – 16/05) — `0/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|-----------|
| 4.1 | Migration: 800 NPP | Dev+BA | ☐ | — |
| 4.2 | Migration: 70 vehicles + drivers | Dev+BA | ☐ | — |
| 4.3 | Migration: 30 products | Dev+BA | ☐ | — |
| 4.4 | Migration: 500 routes | Dev+BA | ☐ | — |
| 4.5 | Migration: Credit balances (Bravo) | Dev+KT | ☐ | — |
| 4.6 | Migration: Asset balances (vỏ) | Dev+KT | ☐ | — |
| 4.7 | UAT: Dispatcher test | QA+Users | ☐ | — |
| 4.8 | UAT: Driver test (5-10 tài xế) | QA+Users | ☐ | — |
| 4.9 | UAT: Kế toán test (recon) | QA+Users | ☐ | — |
| 4.10 | UAT: Thủ kho test (PDA) | QA+Users | ☐ | — |

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
