# 📊 TASK TRACKER — BHL OMS-TMS-WMS

> **Cập nhật lần cuối:** 24/04/2026 — Sprint 2 AI Intelligence Layer: Planning + BRD 14D + DECISIONS DEC-AI-01  
> **Trạng thái dự án:** 🟢 Đang phát triển (In development)

## 🌍 Sprint 1 World-Class Strategy — Status ✅ DONE

| Task | Tuần | Status | Note |
|------|------|--------|------|
| F2 NPP Health (read-only) | W2 | ✅ DONE | GO LIVE — 3 endpoints, widget DVKH |
| F3 Smart SKU Suggestions  | W2 | ✅ DONE | GO LIVE — basket_rules confidence ≥0.6 |
| TD-020 Toast errors       | W3 | ✅ DONE | 18 high-impact catch chuyển handleError; 17 background còn lại → TD-020-followup |
| F7 GPS Anomaly Detection  | W3 | ✅ DONE | Mig 038 + module + UI + Control Tower link; smoke 4 endpoints PASS; Zalo stub → TD-F7-zalo-stub |
| H4 BOT/Toll 16→84         | W1 | ✅ DONE | Mig 039: +44 stations từ VETC 22-23 (is_active=FALSE chờ geocode → TD-H4-geocode); cost engine sẵn |
| H2 Route Library          | W1 | ⏳ TODO | Sprint 2 |
| Load test (k6)            | W4 | ✅ DONE | load_probe Go: p95 ≤ 42.8ms cho 4 endpoints — PASS criteria <500ms |

---

## 🤖 Sprint 2 — AI Intelligence Layer (24/04/2026 – ~20/05/2026)

> **Mục tiêu:** Đưa AI/ML từ batch-số-tĩnh → interactive, in-context, proactive.  
> **Nguyên tắc:** Zero infra mới. Free-tier APIs (Gemini 2.0 Flash + Groq). Smart Rules cho scoring.  
> **Kiến trúc:** `internal/ai/` package với provider interface — swap provider không đổi code.  
> **Quyết định:** DEC-AI-01. BRD: Section 14D. ROADMAP: P1.5 AI Sprint.

### Phase AI-R — Smart Rules Engine (Tuần 1–2, không cần API)

| ID | Task | Status | Deliverable |
|----|------|--------|-------------|
| AI-R1 | `internal/ai/` package: `Provider` interface + `RulesEngine` + `GeminiProvider` stub | ⏳ TODO | `internal/ai/{provider,rules,gemini,fallback}.go` |
| AI-R2 | Migration 040: bảng `ai_insights` (cache LLM), bảng `npp_risk_signals` (daily computed) | ⏳ TODO | `migrations/040_ai_insights.{up,down}.sql` |
| AI-R3 | Anomaly Score formula per vehicle → badge trên Control Tower marker | ⏳ TODO | BE endpoint + FE score badge (0–100, màu) |
| AI-R4 | Credit Risk Score (rule formula) → chip "RỦI RO CAO/TRUNG BÌNH/THẤP" Accountant page | ⏳ TODO | BE `/v1/customers/:id/risk-score` + FE chip |
| AI-R5 | Seasonal Demand Alert trong OMS order form | ⏳ TODO | So qty đặt vs seasonal_index → inline warning |

### Phase AI-G — Gemini Free API Integration (Tuần 3–4)

| ID | Task | Status | Deliverable | Quota |
|----|------|--------|-------------|-------|
| AI-G1 | `internal/ai/gemini.go`: Gemini 2.0 Flash free tier + Groq fallback | ⏳ TODO | Provider với retry + fallback logic | ~50 req/ngày |
| AI-G2 | Daily Dispatch Briefing: cron 7h → Gemini → widget Dashboard Dispatcher | ⏳ TODO | Cron job + `GET /v1/ai/dispatch-brief` + FE widget | 1 req/ngày |
| AI-G3 | Exception Explanation Engine: Control Tower exception → Gemini giải thích | ⏳ TODO | Hook vào anomaly create + FE panel expand | ~10 req/ngày |
| AI-G4 | Zalo NPP Auto-Draft: khi health_score drop >20 → DVKH xem draft + gửi tay | ⏳ TODO | `POST /v1/ai/npp-zalo-draft` + FE modal preview | ~5 req/ngày |

### Phase AI-M — Python ML Extension (Tuần 5–6, extend :8090 hiện có)

| ID | Task | Status | Deliverable |
|----|------|--------|-------------|
| AI-M1 | Demand Forecast endpoint trong vrp-solver/:8090 (Prophet 21 SKUs từ `sku_daily_demand.parquet`) | ⏳ TODO | `POST /ml/forecast-demand` → Go → FE |
| AI-M2 | Demand Intelligence Panel trong OMS order form (4-week forecast per NPP×SKU) | ⏳ TODO | Sidebar widget khi chọn NPP + SKU |
| AI-M3 | NPP Proactive Outreach queue: DVKH dashboard widget "3 NPP cần liên hệ hôm nay" | ⏳ TODO | FE widget + `GET /v1/ai/outreach-queue` |

### Sprint 2 Summary

| Metric | Value |
|--------|-------|
| Tổng tasks Sprint 2 | 11 |
| Infra thêm | $0 (zero) |
| API cost | $0 (Gemini free 1,500 req/ngày, Groq free 14,400 req/ngày) |
| BHL dùng thực tế | ~50–70 req/ngày |
| Estimate hoàn thành | ~20/05/2026 |

---

## 🎯 TỔNG QUAN TIẾN ĐỘ

```
╔══════════════════════════════════════════════════════════════╗
║  TỔNG TASK: 186 │  HOÀN THÀNH: 166 │  TIẾN ĐỘ: 89.2%    ║
╠═══════════════════════════════════════════════════════════╣
║  ████████████████████████████████████████████░░░░░░  89.2%    ║
╠═══════════════════════════════════════════════════════════╣
║  ☐ Not Started: 20  │  🔄 In Progress: 0  │  ☑ Done: 166  ║
║  ⚠ Blocked: 0       │  ❌ Cancelled: 0                     ║
╚═══════════════════════════════════════════════════════════╝
```

| Metric | Value |
|--------|-------|
| **Tổng tasks** | 186 |
| **Hoàn thành** | 166 |
| **Đang làm** | 0 |
| **Chưa bắt đầu** | 20 (9 cũ + 11 Sprint 2 AI) |
| **Bị block** | 0 |
| **% Hoàn thành** | **89.2%** |
| **Go-live target** | ~15/05/2026 (Core), ~20/05/2026 (AI Sprint 2) |
| **Ngày hôm nay** | 24/04/2026 |

---

## 📈 BIỂU ĐỒ TIẾN ĐỘ THEO PHASE

```
Phase 1 ─ Foundation & Core (20 tasks)
  Done   ████████████████████████████████░░░░░░░░ 16/20  (80%)
  
Phase 2 ─ WMS & Driver App (18 tasks)
  Done   ████████████████████████████████████████████████████  18/18  (100%)

Phase 3 ─ Integration & Reports (20 tasks)
  Done   ████████████████████████████████████████████████████  20/20  (100%)

Phase 4 ─ UAT & Go-live (20 tasks)
  Done   ███████████████████████████████████████░░░░░░░░░░░░░ 15/20  (75%)

Phase 5 ─ UX Overhaul & Admin Console (32 tasks)
  Done   ████████████████████████████████████████████████████  32/32  (100%)

Phase 6 ─ Gap Analysis & Role Deepening (18 tasks)
  Done   ████████████████████████████████████████████████████  18/18  (100%)

Phase 7 ─ Cost Engine & GPS Simulation (2 tasks)
  Done   ████████████████████████████████████████████████████  2/2  (100%)

Phase 8 ─ Fleet & Driver Management (30 tasks)
  Done   ████████████████████████████████████████████████████  30/30  (100%)

Phase 9 ─ WMS Pallet/QR/Bin/Cycle Count (15 tasks) ████████████████████ 100%
  Done   ████████████████████████████████████████████████████  15/15  (100%)
```

### Phân bổ trạng thái (Pie chart dạng text)

```
     ┌──────────── Status Distribution ────────────┐
     │                                              │
     │   ☐ Not Started ██░░░░░░░░░░░░░░░░░░  5.6%   │
     │   🔄 In Progress                      0.0%  │
     │   ☑  Completed  ██████████████████░░  94.4%  │
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
**Status:** 🔄 Đang thực hiện (4 tasks chờ BHL IT: 1.7-1.10)

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

### Week 8 (19/05 – 23/05) — `5/10 done`

| # | Task | Owner | Status | Ngày xong |
|---|------|-------|--------|----------|
| 4.11 | Load test: 3,000 đơn | Dev | ☑ | 21/03 |
| 4.12 | Load test: VRP 3,000 parallel | Dev | ☑ | 21/03 |
| 4.13 | Bug fix (Critical → High → Medium) | Dev | ☑ | 21/03 |
| 4.14 | Production: 2 VMs + SSL + DNS | DevOps | ☐ | — |
| 4.15 | Production: Docker Compose + systemd | DevOps | ☑ | 21/03 |
| 4.16 | Backup/DR drill | DevOps | ☐ | — |
| 4.17 | Monitoring: Grafana + Prometheus | DevOps | ☑ | 21/03 |
| 4.18 | User training sessions | BA+Dev | ☐ | — |
| 4.19 | Go-live checklist: BHL sign-off | PM+BHL | ☐ | — |
| 4.20 | **🚀 GO-LIVE** | Dev+DevOps | ☐ | — |

### Phase 4 Gate ─ `3/7 passed`
- [ ] 12/12 UAT criteria passed
- [x] Load test 3,000 orders OK (183 orders/sec, 0.17% errors, p95=148ms)
- [x] 0 critical + 0 high bugs (order number race condition fixed)
- [ ] Data migration verified by BHL KT
- [ ] Backup/DR drill passed
- [x] Monitoring live (Prometheus + Grafana configured)
- [ ] BHL sign-off

---

## 🟣 PHASE 5 — UX Overhaul & Admin Console (MỚI)

**Tiến độ Phase:** `32/32 (100%)`  
**Status:** ✅ Hoàn thành  
**Ưu tiên:** B (DVKH) → A (Admin) → C (Dispatcher) → D (Driver)  
**Spec:** `docs/specs/UXUI_SPEC.md` + DEC-009

### 5A — Admin Console v1 (8 tasks)

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 5.1 | Admin: System configs API (GET/PUT /admin/configs) | Dev | ✅ | P0 | CRUD system_settings + effective_date |
| 5.2 | Admin: System configs UI page | Dev | ✅ | P0 | `/dashboard/settings/configs` — settings editor |
| 5.3 | Admin: Credit limits CRUD API + effective_date | Dev | ✅ | P0 | GET/POST/PUT/DELETE /admin/credit-limits |
| 5.4 | Admin: Credit limits UI page | Dev | ✅ | P0 | `/dashboard/settings/credit-limits` — table + modal |
| 5.5 | Admin: Routes CRUD API + waypoints | Dev | ✅ | P1 | GET/POST/PUT/DELETE /admin/routes |
| 5.6 | Admin: Routes UI page + map preview | Dev | ✅ | P1 | `/dashboard/settings/routes` |
| 5.7 | Admin: Audit log viewer API + UI | Dev | ✅ | P0 | GET /admin/audit-logs + `/dashboard/settings/audit-logs` |
| 5.8 | Admin: System health dashboard | Dev | ✅ | P1 | `/dashboard/settings/health` — DB+pool+tables |

### 5B — DVKH Order Control Desk (8 tasks)

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 5.9 | DVKH: Control desk stats API | Dev | ✅ | P0 | GET /orders/control-desk/stats — count per status category |
| 5.10 | DVKH: Order list enrichment (Zalo + trip inline) | Dev | ✅ | P0 | Thêm zalo_status, trip_id, vehicle_plate, driver_name |
| 5.11 | DVKH: Global search API | Dev | ✅ | P0 | GET /orders/search — name, phone, order_number, plate |
| 5.12 | DVKH: Control desk frontend (summary cards) | Dev | ✅ | P0 | 7 summary cards: mới, chờ KH, chờ duyệt, đang giao, rủi ro, lỗi, cần xử lý |
| 5.13 | DVKH: Enriched order table + exception tabs | Dev | ✅ | P0 | Ngoại lệ tab + Giao lại tab + enriched columns |
| 5.14 | DVKH: Customer context sidebar (slide-in) | Dev | ✅ | P1 | Click KH → slide-in w-96 sidebar: order history + debt |
| 5.15 | DVKH: Zalo preview panel on order create | Dev | ✅ | P1 | 2-column layout: form 60% / Zalo preview 40% |
| 5.16 | DVKH: ATP bar inline + instant feedback | Dev | ✅ | P0 | UX-02: border đổi màu NGAY khi qty vượt ATP |

### 5C — Dispatcher Planning & Control Tower (10 tasks)

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 5.17 | Dispatcher: Exception detection API | Dev | ✅ | P0 | GET /trips/exceptions — late_eta, idle_vehicle, failed_stop |
| 5.18 | Dispatcher: Control tower stats API | Dev | ✅ | P0 | GET /trips/control-tower/stats — 14 metrics |
| 5.19 | Dispatcher: Map + exception panel split-screen | Dev | ✅ | P0 | 3-column cockpit: LEFT 25% + CENTER 50% map + RIGHT 25% |
| 5.20 | Dispatcher: Trip progress + ETA deviation | Dev | ✅ | P0 | Inline progress bar + ETA countdown/lệch ETA badge theo từng chuyến |
| 5.21 | Dispatcher: Alert items with inline CTA | Dev | ✅ | P0 | P0/P1 alerts, border-left accent, re-delivery CTA |
| 5.22 | Dispatcher: Move stop between trips API | Dev | ✅ | P1 | POST /trips/:id/stops/:stopId/move + modal UI |
| 5.23 | Dispatcher: Cancel trip + redistribute | Dev | ✅ | P1 | POST /trips/:id/cancel + confirmation modal |
| 5.24 | Dispatcher: VRP action bar (brand color) | Dev | ✅ | P1 | bg-brand-500 VRP btn |
| 5.25 | Dispatcher: Driver/vehicle status modals (UXUI) | Dev | ✅ | P1 | Driver info modal: vehicle, trip, speed, GPS |
| 5.26 | Dispatcher: Trip anomaly dots on map | Dev | ✅ | P1 | CSS @keyframes ping-ring pulsing red markers |

### 5D — Driver App Enforcement (6 tasks)

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 5.27 | Driver: Mandatory photo enforcement ePOD | Dev | ✅ | P0 | photo_urls in body + validation blocks submit |
| 5.28 | Driver: Mandatory return damage photo | Dev | ✅ | P0 | returnDamagePhotos state + validation |
| 5.29 | Driver: PWA install prompt + service worker | Dev | ✅ | P1 | beforeinstallprompt + install banner |
| 5.30 | Driver: Navigation route chain (multi-stop) | Dev | ✅ | P1 | buildNavUrl() with waypoints for remaining stops |
| 5.31 | Driver: Brand color stop header + tap targets | Dev | ✅ | P0 | bg-brand-500 header, h-14 primary, h-12 actions |
| 5.32 | Driver: Offline banner + payment option cards | Dev | ✅ | P1 | useOnlineStatus hook + red offline banner |

### Phase 5 Gate ─ `8/8 passed`
- [x] Admin configs UI working (system_settings CRUD)
- [x] DVKH control desk shows 7 status categories
- [x] Dispatcher cockpit 3-column layout with exceptions
- [x] Driver ePOD blocks without photo
- [x] Brand color #F68634 applied consistently
- [x] 5 UX rules verified (zero dead ends, instant feedback, role empty states, trace ID, tap targets)
- [x] Audit log viewer shows change history
- [x] All pages follow UXUI_SPEC.md layout

---

## 🟫 PHASE 6 — Gap Analysis & Role Deepening (MỚI)

**Tiến độ Phase:** `18/18 (100%)`  
**Status:** ☑ Hoàn thành  
**Nguồn gốc:** Session 19g Gap Analysis — phản biện 11 role UX gaps  
**Nguyên tắc:** Scope gọn, đúng business cần, không over-engineer

### 6A — P0: Trước Go-live (5 tasks)

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 6.1 | KT: Recon workbench — T+1 countdown badge | Dev | ☑ | P0 | T+1 countdown badge, đỏ khi < 2h, auto-refresh 60s |
| 6.2 | KT: Recon split view tiền-hàng-vỏ | Dev | ☑ | P0 | Sub-tabs Tất cả/Tiền/Hàng/Vỏ with type counts |
| 6.3 | KT: Recon action history (entity_events) | Dev | ☑ | P0 | BE endpoint + history modal + event recording on resolve |
| 6.4 | Workshop: Role `workshop` + phân loại vỏ page | Dev | ☑ | P0 | Migration 010, workshop role + permissions, bottle_classifications table |
| 6.5 | Workshop: Đối chiếu vỏ per trip | Dev | ☑ | P0 | Bottle classification page (GET/POST) + summary endpoint |

### 6B — P1: Sau Go-live sớm (8 tasks)

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 6.6 | Admin: Audit log diff UI cho configs | Dev | ☑ | P1 | ConfigDiffView component, before/after diff in entity_events |
| 6.7 | Admin: Credit limit expiry alert cron | Dev | ☑ | P1 | RunCreditLimitExpiryCron 6h + /credit-limits/expiring API |
| 6.8 | BGĐ: KPI drill links → filtered views | Dev | ☑ | P1 | Clickable KPI cards → router.push to filtered views |
| 6.9 | DVKH: Customer sidebar Zalo | Dev | ☑ | P1 | Zalo link (zalo.me/{phone}) in order detail |
| 6.10 | DVKH: ePOD photos link trong order detail | Dev | ☑ | P1 | ePOD photos tab with image grid in order detail |
| 6.11 | Thủ kho: Picking queue view | Dev | ☑ | P1 | Priority badge "Soạn trước" for first pending item |
| 6.12 | Thủ kho: Gate check queue/backlog | Dev | ☑ | P1 | BE /gate-check-queue endpoint + FE queue display |
| 6.13 | Bảo vệ: Gate check mandatory reason | Dev | ☑ | P1 | Fail reason dropdown required (6 reason types) |

### 6C — P2: Sau Go-live (5 tasks)

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 6.14 | Dispatcher: Exception description text | Dev | ☑ | P2 | Vietnamese exceptionTypeDescription map in control tower |
| 6.15 | Dispatcher: Bulk multi-select move stops | Dev | ☑ | P2 | Checkboxes + bulk move modal for multi-stop transfer |
| 6.16 | KT Trưởng: Action-level RBAC | Dev | ☑ | P2 | IsChiefAccountant check in ResolveDiscrepancy handler |
| 6.17 | Đội trưởng: Fleet tab trong dispatcher | Dev | ☑ | P2 | trips/fleet toggle in control tower left column |
| 6.18 | Tài xế: Evaluate native mobile | Dev+PM | ☑ | P3 | Evaluated: PWA đủ cho go-live, native sau 3 tháng production |

### Phase 6 Gate ─ `5/5`
- [x] KT recon workbench T+1 countdown live
- [x] Workshop role + phân loại vỏ working
- [x] KPI drill links navigate correctly
- [x] Gate check mandatory fail reason + queue display
- [x] Action-level RBAC distinguishes KT vs KT Trưởng

---
## 🔧 PHASE 7 — Cost Engine & GPS Simulation (MỚI)

> Tối ưu VRP theo chi phí thực tế (phí cầu đường + nhiên liệu + tài xế) + giả lập GPS cho testing.

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|---------|
| 7.1 | Cost Engine: VRP cost optimization + Admin CRUD | Dev | ☑ | P0 | Migration 020 + cập nhật toll data miền Bắc, 19 cost admin endpoints, Python solver cost matrix + OSRM route geometry, planning dùng cost readiness auto mode, UI `/dashboard/settings/transport-costs`. US-TMS-01d/01e |
| 7.2 | GPS Simulation API | Dev | ☑ | P1 | 3 endpoints (start/stop/status), load active trips thực tế (`planned/assigned/ready/in_transit/pre_check`) hoặc demo routes, GPS jitter ±5m, speed multiplier. US-TMS-01f |

### Phase 7 Gate ─ `2/2`
- [x] Migration 020 SQL tạo đủ 6 tables + seed data
- [x] Go code + Python solver + Frontend compile clean (0 errors)

✅ **Localhost đã verify sau đó** — theo Session 21: backend `:8080` + frontend `:3000` + login OK.

---

## 🚛 PHASE 8 — Fleet & Driver Management (MỚI)

**Tiến độ Phase:** `30/30 (100%)`  
**Status:** ☑ Hoàn thành  
**Nguồn gốc:** Session 24 — Đề xuất FMS+/DMS+ world-class, phản biện 3 đề xuất, điều chỉnh roadmap  
**Nguyên tắc:** Rule-based trước ML, đơn giản hóa cho BHL 70 xe, bỏ HOS/Shift/Spare Parts  
**Tham chiếu BRD:** Section 14C (US-TMS-23, 27, 29, 31-34, 36-37, 39)  
**Timeline:** 12 tuần (3 phases nội bộ)

### 8A — Phase 1 Foundation: Repair + Fuel + Garage (Tuần 1-5) — `12/12 done`

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 8.1 | DB: Migration 030 — work_orders, repair_items, repair_attachments | Dev | ☑ | P0 | ALTER vehicles ADD health_score, last_health_check |
| 8.2 | DB: Migration 031 — garages, garage_ratings | Dev | ☑ | P0 | Vendor/garage management |
| 8.3 | DB: Migration 032 — fuel_logs, fuel_anomalies | Dev | ☑ | P0 | Fuel tracking + anomaly detection |
| 8.4 | BE: Repair Order CRUD + approval workflow 3 cấp | Dev | ☑ | P0 | US-TMS-31: POST/GET/PUT work-orders, approve, complete |
| 8.5 | BE: Emergency RO auto-approve (ceiling 5M) + recurring maintenance auto-approve | Dev | ☑ | P0 | US-TMS-31 bổ sung: xe hỏng đường, thay dầu định kỳ |
| 8.6 | BE: Garage CRUD + rating after RO complete | Dev | ☑ | P0 | US-TMS-36: profile, score, preferred, blacklist |
| 8.7 | BE: Fuel Log CRUD + anomaly detection algorithm | Dev | ☑ | P0 | US-TMS-33: expected vs actual, anomaly_ratio > 25% |
| 8.8 | BE: Rule-based Vehicle Health Score (0-100) | Dev | ☑ | P0 | US-TMS-23: km_overdue, days_overdue, open_ROs, checklist_fails, age |
| 8.9 | BE: Vehicle health → VRP pool filter (score < 50 loại xe) | Dev | ☑ | P1 | Tích hợp VRP Engine port 8090 |
| 8.10 | BE: Repair Cost Dashboard API + budget alerts | Dev | ☑ | P1 | US-TMS-32: gauge, top 10 xe, breakdown, MTTR |
| 8.11 | FE: Repair Order pages — list + create + detail + timeline | Dev | ☑ | P0 | Web + entity events: repair_created/approved/completed |
| 8.12 | FE: Fuel Log pages — driver input + anomaly flag display | Dev | ☑ | P0 | Driver App: nhập km + lít + tiền + ảnh HĐ |

### 8B — Phase 2 Intelligence: Scorecard + Gamification + Tire (Tuần 6-9) — `12/12 done`

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 8.13 | DB: Migration 033 — driver_scores, driver_score_snapshots | Dev | ☑ | P0 | Driver performance tracking |
| 8.14 | DB: Migration 034 — gamification_badges, badge_awards | Dev | ☑ | P1 | Gamification engine |
| 8.15 | DB: Migration 035 — tire_sets, leave_requests | Dev | ☑ | P1 | Simplified tire per xe + leave |
| 8.16 | BE: Driver Safety Scorecard (5 chỉ số rule-based) | Dev | ☑ | P0 | US-TMS-27: OTD 30%, Delivery 25%, Compliance 25%, Customer 10%, Speed 10% |
| 8.17 | BE: Driver Score batch calculation (cron 23:59) | Dev | ☑ | P0 | Snapshot daily, trend 6 tháng |
| 8.18 | BE: Gamification badge system + leaderboard | Dev | ☑ | P1 | US-TMS-29: 8 badge types, auto-award cuối tháng |
| 8.19 | BE: Bonus calculator → Excel export (format Bravo) | Dev | ☑ | P1 | US-TMS-29: bonus = badges × value + performance |
| 8.20 | BE: Tire Set CRUD per vehicle + checklist integration | Dev | ☑ | P1 | US-TMS-34: simplified OK/Mòn/Cần thay per bộ lốp |
| 8.21 | BE: Leave Request CRUD + VRP integration | Dev | ☑ | P1 | US-TMS-39: nghỉ phép → VRP exclude driver |
| 8.22 | FE: Driver Scorecard page — gauge + radar + trend | Dev | ☑ | P0 | Driver App: "Điểm của Tôi" |
| 8.23 | FE: Leaderboard page — Top 5 + rank cá nhân | Dev | ☑ | P1 | Driver App: gamification display |
| 8.24 | FE: Manager view — driver scores table + drill-down | Dev | ☑ | P0 | Web: sort/filter, click → timeline vi phạm |

### 8C — Phase 3 Analytics: TCO + Cost + Document Alert (Tuần 10-12) — `6/6 done`

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 8.25 | BE: Fleet TCO Dashboard API — CPK, ROI per vehicle | Dev | ☑ | P1 | US-TMS-37: fuel + repair + tire + toll + driver cost |
| 8.26 | BE: Cost analytics — garage benchmark, internal vs external CPK | Dev | ☑ | P1 | US-TMS-32/37: scatter plot data, make vs buy |
| 8.27 | BE: Vehicle replacement recommendation (tuổi > 8 năm + repair > 60% giá) | Dev | ☑ | P2 | US-TMS-37: auto-generate đề xuất thanh lý |
| 8.28 | BE: Vehicle document expiry → VRP hard block | Dev | ☑ | P0 | Bổ sung: đăng kiểm/BH/phù hiệu quá hạn → loại VRP |
| 8.29 | FE: TCO Dashboard — scatter ROI vs tuổi xe, cost heatmap | Dev | ☑ | P1 | Web: BGĐ/Quản lý view |
| 8.30 | FE: Repair Cost Dashboard — gauge ngân sách, top 10, MTTR | Dev | ☑ | P1 | Web: Grafana-style charts |

### Phase 8 Gate ─ `8/8 passed`
- [x] Repair Order: tạo → approve → complete → cost tracked end-to-end
- [x] Fuel Log: driver nhập → anomaly detection → alert fleet manager
- [x] Garage rating: auto-score after RO, benchmark pricing visible
- [x] Vehicle Health Score: rule-based 0-100, xe < 50 loại khỏi VRP
- [x] Driver Scorecard: 5 chỉ số, daily batch, trend 6 tháng
- [x] Gamification: badge auto-award, leaderboard, bonus export Bravo
- [x] TCO Dashboard: CPK per vehicle, replacement recommendation
- [x] Document expiry: 30-day alert + 7-day VRP hard block

---

## 🏭 PHASE 9 — WMS Pallet · QR · Bin · Cycle Count (MỚI 23/04/2026)

**Tiến độ Phase:** `0/15 (0%)`  
**Status:** ☐ Chưa bắt đầu — chờ confirm để code Sprint 1  
**Nguồn gốc:** User request 23/04/2026 — module Kho world-class QR-driven, FEFO theo đơn đã lập kế hoạch giao  
**Quyết định:** DEC-WMS-01 (Pallet/QR/Bin layer), DEC-WMS-02 (FEFO-only), DEC-WMS-03 (Hybrid PDA+PWA), DEC-WMS-04 (Bravo PENDING)  
**Tham chiếu BRD:** Section 6.6 (US-WMS-25..32, WMS-05..08)  
**Timeline dự kiến:** 5 sprints × 2 tuần = ~10 tuần  
**Phạm vi loại trừ:** KHÔNG có cost layer / kế toán / tích hợp Bravo (Phase sau)

### 9A — Sprint 1 Foundation: Domain + Migration + Master CRUD (Tuần 1-2) — `4/4` ✅

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 9.1 | DB: Migration 037 — `pallets`, `bin_locations`, `qr_scan_log`, `cycle_count_tasks` + indices | Dev | ☑ | P0 | DEC-WMS-01; KHÔNG sync_status (DEC-WMS-04) |
| 9.2 | BE: Domain structs + repository (Pallet/Bin/ScanLog/CycleCount) trong `internal/wms/` | Dev | ☑ | P0 | Append vào models.go theo DEC-002 |
| 9.3 | BE: API CRUD bins + auto-generate bin codes + ZPL label generator | Dev | ☑ | P0 | `GET/POST /v1/warehouse/bins`, `GET /v1/warehouse/bins/:code/contents` |
| 9.4 | BE: API tra cứu pallet `/pallets/:lpn` + scan log immutable insert | Dev | ☑ | P0 | US-WMS-25, US-WMS-31 |

### 9B — Sprint 2 Inbound: Putaway scan-driven + ZPL print (Tuần 3-4) — `3/3` ✅

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 9.5 | BE: Inbound API tạo pallet sinh LPN + GS1 QR payload + ZPL string | Dev | ☑ | P0 | `POST /v1/warehouse/inbound/receive` — pallet đã đóng từ NMSX |
| 9.6 | BE: Putaway suggest-bin algorithm (3 gợi ý xếp hạng) + putaway confirm | Dev | ☑ | P0 | US-WMS-27 |
| 9.7 | FE: PWA `/warehouse/scan` (dual input PDA KeyEvent + camera) + `/warehouse/inbound` + in nhãn ZPL | Dev | ☑ | P0 | DEC-WMS-03 hybrid; gửi ZPL qua HTTP/WebUSB |

### 9C — Sprint 3 Picking & Loading scan-to-X (Tuần 5-6) — `3/3` ✅

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 9.8 | BE: Picking suggest-pallets FEFO chặt theo LPN + scan-pick confirm | Dev | ☑ | P0 | US-WMS-28; FEFO duy nhất (DEC-WMS-02) |
| 9.9 | BE: Loading scan-to-truck (scan biển số → scan LPN → pallet.status=loaded) | Dev | ☑ | P0 | US-WMS-29; tự động mở Bàn giao A |
| 9.10 | FE: Picking-by-pallet view + Loading session view trong `/warehouse/scan` | Dev | ☑ | P0 | Reuse PWA shell |

### 9D — Sprint 4 Cycle Count + Realtime Dashboard (Tuần 7-8) — `3/3` ✅

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 9.11 | BE: Cycle count auto-task generator (ABC velocity) + submit + auto-discrepancy → reconciliation | Dev | ☑ | P1 | US-WMS-30 |
| 9.12 | BE: Realtime stock dashboard API + 4 cảnh báo + WS push (reuse Redis pub/sub) | Dev | ☑ | P1 | US-WMS-32 — polling 10s thay vì WS (reuse later) |
| 9.13 | FE: `/warehouse/cycle-count` + `/warehouse/dashboard/realtime` (4 widget + drill-down) | Dev | ☑ | P1 | |

### 9E — Sprint 5 Bin-map + Traceability + Polish (Tuần 9-10) — `2/2` ✅

| # | Task | Owner | Status | Ưu tiên | Ghi chú |
|---|------|-------|--------|---------|--------|
| 9.14 | BE: Lot distribution + recall query + LPN history endpoints | Dev | ☑ | P1 | US-WMS-31; index pallets(lpn_code), qr_scan_log(qr_code, scanned_at) |
| 9.15 | FE: `/warehouse/bin-map` 2D canvas + heatmap occupancy + click bin drill-down | Dev | ☑ | P2 | US-WMS-26 |

### Phase 9 Gate ─ `0/6`
- [ ] Inbound: NMSX pallet → in nhãn LPN → scan putaway end-to-end ở 1 kho pilot
- [ ] Picking: FEFO chặt scan-by-pallet, sai LPN bị warn + override có lý do
- [ ] Loading: scan-to-truck đủ trước khi mở Bàn giao A
- [ ] Cycle count: ABC daily task → lệch tự sinh discrepancy
- [ ] Realtime dashboard: 4 cảnh báo bật đúng, WS push < 2s
- [ ] Migration tồn cũ → virtual pallet không gián đoạn vận hành

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
| 20/03/2026 | — | Session 16: Test Portal + Import 218 NPP | Test Portal (13 endpoints, 6-tab frontend), import 218 real NPPs from danh sach NPP.txt, seed_test_ready.sql, test guide 5 kịch bản |
| 20/03/2026 | — | Session 17: Notification + Timeline System | entity_events immutable log (23 event types), order_notes, NotificationBell dropdown, NotificationToast, OrderTimeline, OrderNotes, WebSocket push, priority notifications, FullName JWT propagation |
| 20/03/2026 | — | Session 18: Notification Fixes + UI Redesign | Fixed 404 on /dashboard/notifications, fixed reject_reason not passed to timeline, NotificationBell → right-side slide panel, moved bell to topbar, doc audit |
| 20/03/2026 | — | Session 18c: Uncoded features implemented | Re-delivery flow, vehicle/driver document CRUD, document expiry cron, migration 012, frontend updates |
| 21/03/2026 | — | Session 19: UXUI_SPEC.md + Phase 5 restructure | Created UXUI_SPEC.md (8 role specs), updated CLAUDE.md (DEC-009), updated frontend-patterns.instructions.md, added Phase 5 (32 tasks: Admin Console + DVKH Desk + Dispatcher Tower + Driver Enforce) |
| 21/03/2026 | 5.1-5.4,5.7,5.9-5.13,5.16 | Session 19b: Admin Console + DVKH complete | Admin: configs API+UI, credit limits CRUD+UI, audit log viewer API+UI. DVKH: control desk stats, order enrichment, global search, 7 summary cards, exception tabs, ATP bar feedback. Brand color #F68634. **11 tasks done → 75/110 (68.2%)** |
| 21/03/2026 | 5.5-5.8,5.14-5.15,5.17-5.32 | Session 19c-d: Phase 5 complete (32/32) | Routes CRUD+UI, system health, customer sidebar, Zalo preview, dispatcher cockpit (3-col map+exceptions+stats), move stop+cancel trip APIs, driver photo enforcement, PWA install, navigation chain, offline banner, anomaly dots. **96/110 (87.3%)** |
| 21/03/2026 | — | Session 19f: GPS Simulator + KPI Reports | GPS simulator standalone + test portal GPS tab, KPI issues/cancellations reports, enhanced system health. **101/110** |
| 21/03/2026 | — | Session 19g: Gap Analysis → Phase 6 | Phản biện 11 role UX gaps, điều chỉnh priorities (6 hạ mức, 2 giữ P0), thêm Phase 6 (18 tasks: 5 P0 + 8 P1 + 5 P2/P3). **101/128 (78.9%)** |
| 21/03/2026 | 6.1-6.18 | Session 19g: Phase 6 complete | Implemented all 18 tasks: KT recon workbench (T+1/split/history), workshop role+bottle classification, admin audit diff+credit expiry cron, KPI drill links, Zalo+ePOD, picking queue+gate check queue, mandatory fail reason, exception descriptions, bulk move stops, RBAC, fleet tab. **119/128 (93.0%)** |
| 27/03/2026 | 7.1-7.2 | Session 20: Cost Engine + GPS Simulation | Migration 020 (6 tables + seed), 19 cost admin API endpoints, VRP solver per-vehicle cost matrix (fuel+toll), frontend cost toggle+summary, GPS simulate API (3 endpoints). Docs: DBS+API+BRD v3.3. **121/130 (93.1%)** |
| 16/04/2026 | — | Session 21: Localhost verify + BRD v3.3 audit | Fix migration 020 (remove notes column from gate INSERTs), fix proxy port 8097→8080 in next.config.js, localhost verified (backend :8080 + frontend :3000 + login OK). BRD v3.2→v3.3: rà soát toàn bộ AC vs code thực tế, đánh dấu ~15 AC đã triển khai (VRP criteria, payment recording, credit limit, redelivery report, import/export Excel, EOD bàn giao, checklist photo). **121/130 (93.1%)** |
| 17/04/2026 | — | Session 22: Control Tower Map UX + SC-11 | Map P0: SVG truck markers, route polyline, stop markers, trip-map linking, GPS sim button. SC-11 test scenario (8 trips, 26 orders, 3 exceptions) được neo lại thành 7 tuyến giao hàng thực tế từ WH-HL; Control Tower hiển thị route cho đủ 7 xe active. Fixed ListExceptions `ts.customer_name` bug + SC-11 `plate`→`plate_number`. **121/130 (93.1%)** |
| 20/04/2026 | — | Audit code thực tế: sync BRD + Phase 7 notes | Đối chiếu lại code backend/frontend trước khi chốt docs. Chuẩn hóa lại BRD lên v3.5, cập nhật Phase 7 theo cost readiness auto mode, toll data miền Bắc, GPS Simulation load active trip statuses thực tế; bỏ note cũ mâu thuẫn về localhost chưa verify. **121/130 (93.1%)** |
| 21/04/2026 | 8.1-8.30 | Session 24: Phase 8 — Fleet & Driver Management | Thêm Phase 8 (30 tasks, 3 sub-phases): 8A Repair+Fuel+Garage (12 tasks), 8B Scorecard+Gamification+Tire (12 tasks), 8C TCO+Analytics (6 tasks). BRD v3.6: Section 14C FMS+/DMS+ (9 User Stories), 15 notification events mới. Bỏ HOS/Shift/Spare Parts theo ràng buộc user. **121/160 (75.6%)** |
| 21/04/2026 | 8.1-8.30 | Session 25: Phase 8 — IMPLEMENTED | Migrations 030-035 applied, `internal/fleet/` module (models+repo+service+handler), 28 API endpoints, 7 frontend pages (repairs, fuel, garages, health, scorecard, leaderboard, tco), sidebar nav updated. Backend build + start OK. **151/160 (94.4%)** |

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
