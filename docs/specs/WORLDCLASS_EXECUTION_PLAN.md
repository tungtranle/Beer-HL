# WORLDCLASS_EXECUTION_PLAN — BHL OMS-TMS-WMS

> **Mục đích:** Kế hoạch triển khai chi tiết 12 tuần để đưa hệ thống BHL OMS-TMS-WMS từ "Core hoàn thành" lên **world-class data-driven & customer-centric**.
>
> **Nguồn gốc:** Phân tích `c:\Users\tungt\Downloads\BHL_WorldClass_Strategy.html` + dữ liệu enriched tại `D:\Xu ly Data cho BHL\output\enriched` (17 files, ~20 MB).
>
> **Ngày tạo:** 23/04/2026.
>
> **Đọc kèm:**
> - [DATA_DICTIONARY.md](DATA_DICTIONARY.md ) — định nghĩa data cross-source
> - [`ROADMAP.md`](../../ROADMAP.md ) — đã update EC-12 (Demand Forecasting) sang nhóm A
> - [`CLAUDE.md`](../../CLAUDE.md ) §6 quy tắc — không vi phạm

---

## 1. NGUYÊN TẮC CỐT LÕI

1. **Không refactor code cũ.** Mọi thứ mới ở schema riêng `ml_features.*` + service riêng (FastAPI :8091).
2. **Test ngay sau code** (tuân thủ `.github/instructions/test-after-code.instructions.md`).
3. **Mọi recommendation ML phải có "Tại sao?"** (F15 Explainability — không build feature mù mờ).
4. **Feedback loop build CÙNG forecast** (F1 + H9), không sau — để tránh dead-code ML.
5. **Customer-Centric áp dụng cho MỌI role** (NPP, BGĐ, dispatcher, lái xe, kho), không chỉ NPP.

---

## 2. ROADMAP 12 TUẦN — TỔNG QUAN

| Sprint | Tuần | Tên | Mục tiêu chính | Risk |
|---|---|---|---|---|
| **S0** | 0 | Foundation Lock | DATA_DICTIONARY + ETL re-lock + ROADMAP update + fleet confirm | LOW |
| **S1** | 1–4 | Quick Wins | F2 NPP Health, F3 SKU Suggestions, F7 GPS Anomaly, H4 BOT/Toll, H2 Route Library | MED (vendor confirm) |
| **S2** | 5–8 | Intelligence Core | ML service (FastAPI), F1 Demand Forecast + H9 Feedback Loop, F4 VRP calibrated, F15 Explainability | HIGH (ML accuracy) |
| **S3** | 9–12 | Customer-Centric Polish | F5 Seasonal mode, F13 Driver coaching, F14 Warehouse panel, F6 Driver dashboard, F10 Revenue BI | MED (NĐ13 consent) |

---

## 3. SPRINT 0 — FOUNDATION LOCK (1 tuần)

| # | Task | Owner | Output | Status |
|---|---|---|---|---|
| S0.1 | Tạo `docs/specs/DATA_DICTIONARY.md` | AI | File markdown | ✅ DONE |
| S0.2 | Update `ROADMAP.md`: EC-12 nhóm C → nhóm A | AI | Diff trong file | ✅ DONE |
| S0.3 | Migration 036 — tạo schema `ml_features` + 4 bảng baseline | AI | `036_ml_features_schema.up.sql` | ✅ DONE |
| S0.4 | Tạo `WORLDCLASS_EXECUTION_PLAN.md` | AI | File markdown | ✅ DONE |
| S0.5 | Update `DECISIONS.md` (DEC-WC-01 fleet mismatch) + `CHANGELOG.md` | AI | Diff trong file | ✅ DONE |
| S0.6 | **BHL meeting 30': confirm fleet structure** GPS 2024 vs LENH 2022–2023 | PM | Memo | ⏳ TODO (chờ user) |
| S0.7 | Script Python load 4 CSV vào `ml_features.*` | DevOps | `scripts/import_enriched.py` | ⏳ TODO (sau khi migration deployed) |
| S0.8 | Verify localhost: chạy migration + import + query 1 NPP health | AI | Smoke test pass | ⏳ TODO |

**Exit criteria:** DATA_DICTIONARY committed + 4 ML bảng exists trong DB local + 1 NPP có health score query OK.

---

## 4. SPRINT 1 — QUICK WINS (4 tuần)

### Tuần 1
- **H4 BOT/Toll 16→84:** import T2 file BHL → `toll_stations` (đã có table từ migration 025/026). Update VRP cost function thêm `bot_cost`.
- **H2 Route Library:** import `routes_official.csv` (39) → `route_templates`. Archive `routes_archive_longtail.csv` vào `route_templates_archive`.

### Tuần 2
- **F2 NPP Health Score (read-only):**
  - Backend: `GET /v1/npp/:code/health` đọc từ `ml_features.npp_health_scores`.
  - Cron pg_cron: refresh hàng đêm 02:00 (re-compute Recency với `now()`).
  - Frontend: widget trong DVKH dashboard, heatmap MapLibre theo tỉnh.
- **F3 Smart SKU Suggestions:**
  - Backend: `GET /v1/orders/suggestions?customer_code=X&items=[A,B]` → query `ml_features.basket_rules` WHERE confidence ≥ 0.60.
  - Frontend: inline trong OMS order form "Khách thường mua thêm: ...".

### Tuần 3
- **TD-020 fix:** Replace 26 `console.error` → `toast.error()` (Sonner).
- **F7 GPS Anomaly Detection:**
  - Backend: stream processor đọc threshold từ `ml_features.gps_anomalies_baseline`. Trigger Zalo dispatcher khi deviation > 2km hoặc stop > 20 min ngoài kế hoạch.
  - Frontend: alert pin trên Control Tower map.

### Tuần 4
- **Sprint 1 review** + load test k6 cho 3 endpoint mới (`/v1/npp/health`, `/v1/orders/suggestions`, anomaly webhook).
- UAT với 1 dispatcher + 1 DVKH (30 phút).

**Exit criteria:** 5 features live trên localhost + UAT pass + k6 báo p95 < 500ms.

---

## 5. SPRINT 2 — INTELLIGENCE CORE (4 tuần)

### Tuần 5 — ML Service Setup
- Stand up **FastAPI ML service** trong `vrp-solver/` neighborhood, port `:8091`.
- Stack: Python 3.11 + Prophet + Croston (`scikit-learn` extra) + MLflow tracking nội bộ + Polars cho data ops.
- Endpoint:
  - `POST /predict/demand` body `{sku, npp_code, horizon_days}` → forecast + confidence interval.
  - `POST /train/prophet` retrain trigger (admin only).
  - `GET /health` cho Prometheus.
- Docker compose: thêm `ml-service` block, depends_on `postgres`.

### Tuần 5–6 — F1 Demand Intelligence Panel
- Train Prophet cho 21 SKUs forecastable từ `sku_daily_demand.parquet`.
- Train Croston cho 8 Tết SKUs.
- **Hierarchical**: warehouse-level forecast → disaggregate xuống NPP-level theo tỷ trọng historical.
- Output → `ml_features.demand_forecast` (sku, npp_code, forecast_date, qty_pred, qty_lower, qty_upper, model_method, confidence).
- Frontend: OMS sidebar Recharts line chart + delta vs last week + alert nếu order < 70% forecast.

### Tuần 7 — H9 Feedback Loop (build CÙNG F1, không sau)
- Bảng `ml_features.forecast_actuals (forecast_date, sku, npp_code, qty_pred, qty_actual, abs_error, ape)`.
- Cron weekly Chủ nhật 03:00: tính MAPE per (sku, method).
- Alert Zalo BGĐ nếu MAPE > 30% trên SKU top-10 doanh thu.
- Dashboard: trang `/dashboard/ml/health` cho admin.

### Tuần 7–8 — F4 GPS-Calibrated VRP
- Replace OSRM matrix bằng `ml_features.travel_time_matrix` (đã import từ `travel_time_matrix.csv`).
- Time-of-day buckets: morning_peak / midday / evening_peak / night.
- Fallback: nếu cặp node không có → dùng OSRM live.
- **A/B test 1 tuần** trước khi default ON: 50% trips dùng matrix, 50% dùng OSRM, so sánh actual vs ETA.

### Tuần 8 — F15 Explainability Layer
- Mọi response từ F1 + F3 có field `explanation: string` (human-readable Vietnamese).
- VD: `"Gợi ý 340 vỉ Sapphire vì NPP HD-53 4 tuần gần nhất đặt 320/340/355/360 + tuần này là tuần 3 trong tháng (pattern peak +8%)."`.
- Frontend: nút icon (i) tooltip hiện `explanation`.

**Exit criteria:** ML service running + F1 forecast cho 21 SKU active + MAPE dashboard live + VRP A/B test có data.

---

## 6. SPRINT 3 — CUSTOMER-CENTRIC POLISH (4 tuần)

### Tuần 9 — F5 Seasonal Planning Mode
- Admin toggle `/dashboard/admin/seasonal-mode` → enum `normal | tet | summer_peak`.
- Hiệu ứng:
  - VRP: buffer time +20% (Tết) hoặc +10% (summer).
  - WMS: pre-alert kho 14 ngày trước cao điểm.
  - Zalo: nhắc NPP T-14 đặt hàng sớm.

### Tuần 9–10 — F13 Driver In-App Coaching
- Sau driver complete trip → API trả `coaching_card`:
  ```json
  {
    "today_trips": 8, "on_time": 7, "fleet_rank_pct": 30,
    "highlight": "Route HD-CB nhanh hơn baseline 12%",
    "tip": "Giữ tốc độ ổn định 50–60 km/h trên QL5 giúp tiết kiệm nhiên liệu"
  }
  ```
- Driver Web UI hiển thị card sau ePOD cuối cùng.

### Tuần 10 — F14 Warehouse "Tomorrow" Panel
- Cron 16:00 mỗi ngày: tính demand T+1 từ Prophet → push vào `ml_features.warehouse_tomorrow_plan`.
- Panel `/dashboard/warehouse/tomorrow`: hiện `1,400 keg + 2,800 vỉ → cần soạn 6 xe; SKU X tồn thấp, đề nghị sản xuất bổ sung`.

### Tuần 10–11 — F6 Driver Performance Dashboard (READ-ONLY)
- **Pre-condition:** EC-06 NĐ13 consent flow done. Nếu chưa → defer sang P2.
- Page `/dashboard/dispatcher/drivers` (RBAC: dispatcher + admin only).
- Source: `ml_features.driver_baseline_2022` + live KPI từ `trips`.
- **KHÔNG link tới lương** trong UI.

### Tuần 11 — F10 Revenue Intelligence
- Import `route_pnl.csv` (457 KB) vào `ml_features.route_pnl`.
- Deploy Metabase (port :3001) connect read-only PG user.
- Dashboard cho BGĐ: top routes by margin, SKU profitability, NPP LTV.

### Tuần 11–12 — Testing Infrastructure (TD-010 fix)
- Playwright E2E cho 5 happy paths critical (login, create order, dispatch trip, ePOD, payment recon).
- Vitest cho 10 components UI mới (NPP health widget, suggestion box, coaching card, ...).
- CI gate: tests must pass trước merge.

### Tuần 12 — Sprint 3 review + UAT
- UAT với BHL: 1 BGĐ + 1 DVKH + 1 dispatcher + 1 lái xe + 1 kho (2 giờ).
- Go/No-go decision cho **Phase 2** (NPP Self-Service Portal, AI Copilot LLM).

**Exit criteria:** 5 features S3 live + Playwright E2E pass + UAT signoff.

---

## 7. CÁCH ĐO LƯỜNG THÀNH CÔNG

| Metric | Baseline (now) | Target (Tuần 12) | Source |
|---|---|---|---|
| Forecast MAPE top-10 SKU | _N/A_ | < 25% | `ml_features.forecast_actuals` |
| ETA accuracy (actual vs predicted) | OSRM ±25% | < ±15% | trip logs |
| NPP churn rate (90-day) | _N/A_ | < 5% RED-banded | `ml_features.npp_health_scores` |
| Order time per NPP (DVKH) | ~3 phút | < 90s (với F3 suggestions) | analytics frontend |
| Driver on-time % | ~75% | > 85% | trips table |
| Dispatcher daily plan time | 90 phút | < 30 phút | UAT timing |
| GPS anomaly detection lead time | _N/A_ | < 5 phút từ event | F7 logs |

---

## 8. RISK REGISTER

| Risk | Likelihood | Impact | Mitigation | Trigger Sprint |
|---|---|---|---|---|
| BHL không confirm fleet mismatch | M | H | Default plan: 2 fleet domains tách biệt (analytics vs live ops) | S0 |
| NĐ13 consent flow chậm | H | M | Defer F6 driver dashboard sang P2 nếu chưa xong tuần 10 | S3 |
| Prophet MAPE > 35% trên SKU chính | M | H | Fallback Naive 4-week MA + cảnh báo BGĐ; không show forecast nếu MAPE > 30% | S2 |
| ML service down ảnh hưởng OMS | L | H | Circuit breaker: nếu `:8091` timeout 3s → fall back to "no suggestion" UI | S2 |
| Metabase auth phức tạp với SSO BHL | M | L | Phase 1 dùng local Metabase user; SSO Phase 2 | S3 |
| User không tin AI suggestions | H | M | F15 Explainability + UAT early + opt-in cho 1 DVKH trước khi roll-out | S2–S3 |

---

## 9. CHECKLIST CUỐI MỖI SPRINT

- [ ] Mọi feature đã test riêng lẻ (per `.github/instructions/test-after-code.instructions.md`)
- [ ] Localhost OK (backend `/health` + frontend load + ML service `/health`)
- [ ] `CURRENT_STATE_COMPACT.md` đã cập nhật
- [ ] `CHANGELOG.md` đã ghi
- [ ] `TASK_TRACKER.md` đã đánh dấu task xong
- [ ] Lỗi mới → `AI_LESSONS.md` / `KNOWN_ISSUES.md`; nợ kỹ thuật mới → `TECH_DEBT.md`
- [ ] Quyết định mới → `DECISIONS.md`
- [ ] **Mới:** `DATA_DICTIONARY.md` cập nhật nếu có schema/mapping mới

---

## 10. PHASE 2 PREVIEW (Tháng 4–6 sau Sprint 3)

Chỉ unlock nếu Sprint 3 UAT pass:

- **F8 NPP Self-Service Portal** (replace EC-17 evaluation): NPP login web, xem health score của mình, đặt hàng tự động, xem lịch sử.
- **F11 AI Chatbot Copilot** (replace EC-20): LLM nội bộ (Llama 3.1 8B + RAG trên BRD/SAD/RULES) cho dispatcher hỏi nghiệp vụ.
- **F12 Predictive Maintenance:** dùng `entity_events` fleet để dự đoán bảo dưỡng dựa trên km tích lũy + fault patterns.

---

*Sprint 0 đã hoàn thành ngày 23/04/2026 — Sprint 1 sẵn sàng kick-off khi BHL confirm fleet structure (S0.6).*
