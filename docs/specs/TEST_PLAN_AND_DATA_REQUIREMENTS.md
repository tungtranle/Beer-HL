# TEST_PLAN_AND_DATA_REQUIREMENTS — World-Class Features (F1–F15)

> **Mục đích:** Kế hoạch test chi tiết + đề bài data đầu vào cho 12 tính năng Data-driven & Customer-centric.
>
> **Đối tượng:** QA, Backend dev, Data engineer, AI agent.
>
> **Đọc kèm:** [WORLDCLASS_EXECUTION_PLAN.md](WORLDCLASS_EXECUTION_PLAN.md ), [DATA_DICTIONARY.md](DATA_DICTIONARY.md ), [UX_AUDIT_AND_REDESIGN.md](UX_AUDIT_AND_REDESIGN.md ), `.github/instructions/test-after-code.instructions.md`.
>
> **Ngày:** 23/04/2026.

---

## PHẦN A — KẾ HOẠCH TEST

### A.1 Chiến lược test phân tầng

| Tầng | Công cụ | Phạm vi | When |
|---|---|---|---|
| **Unit (backend)** | `go test` | Service/Repository functions | mỗi commit |
| **Unit (frontend)** | Vitest + React Testing Library | Components UI mới (NPP health badge, suggestion box, coaching card, F15 modal) | mỗi commit |
| **Unit (ML)** | pytest | Prophet/Croston wrapper, MAPE calculator | mỗi commit ML service |
| **Integration (backend)** | `go test` + testcontainers Postgres | Handler→Service→Repository chain với DB thật | nightly |
| **Contract (API)** | Schemathesis (OpenAPI) | API ML service `:8091` ↔ OMS Go `:8080` | trước merge |
| **E2E happy path** | Playwright | 5 critical flows (login, create order, dispatch, ePOD, recon) | trước merge feature |
| **Visual regression** | Playwright snapshots | UI critical pages (control tower, order new, driver detail) | trước merge UI |
| **A11y** | axe-playwright | Mọi page mới | trước merge |
| **Performance** | k6 | API endpoints + WebSocket | sprint review |
| **Load** | k6 | 3x peak (3000 đơn/ngày, 70 GPS WS) | trước go-live phase |
| **ML accuracy** | jupyter + papermill | MAPE on holdout set | weekly |
| **Manual UAT** | scripted scenarios | 1 user mỗi role × 30 phút | sprint review |
| **Mobile usability** | Maze.co hoặc on-site | Driver one-thumb test, 5 NPP simulators | quarterly |

### A.2 Testing tools cần install (chưa có)

```bash
# Backend
go get -u github.com/stretchr/testify
go get -u github.com/testcontainers/testcontainers-go/modules/postgres

# Frontend
cd web && npm i -D vitest @testing-library/react @testing-library/jest-dom @vitest/ui
cd web && npm i -D @playwright/test axe-playwright

# ML Service
cd ml-service && pip install pytest pytest-cov httpx schemathesis

# Load
choco install k6
```

### A.3 Test data lifecycle

| Stage | DB | Source |
|---|---|---|
| Local dev | postgres:5434 `bhl_oms` | seed script + import enriched |
| CI | testcontainers spin-up | fixtures JSON nhỏ |
| UAT | postgres prod-like | snapshot from prod, anonymized |
| Prod | _N/A_ | shadow traffic only |

---

## PHẦN B — TEST CASES PER FEATURE

> Format: TC-`<feature>`-`<seq>` · `<title>` · Given/When/Then · Pass criteria

### F1 — Demand Intelligence Panel

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F1-01 | Forecast Prophet cho SKU active | G: SKU `Vỉ Sapphire` có 303 active days. W: gọi `POST /predict/demand {sku, npp_code, horizon_days=7}`. T: response có `qty_pred`, `qty_lower`, `qty_upper`, `model_method='prophet'`. | qty_pred > 0, lower < pred < upper |
| TC-F1-02 | Forecast Croston cho SKU intermittent (Tết) | G: SKU `tet_share > 0.3`. W: predict. T: `model_method='croston'`. | response valid |
| TC-F1-03 | Naive fallback cho SKU rare | G: SKU `n_active_days < 30`. W: predict. T: `model_method='naive'`, dùng MA 4-week. | response valid |
| TC-F1-04 | Hierarchical disaggregate | G: warehouse-level forecast = 1000. NPP HD-53 chiếm 5% historical. W: query NPP-level. T: HD-53 ≈ 50 ± noise. | within 10% of expected ratio |
| TC-F1-05 | Confidence interval coverage | G: backtest 30 ngày. W: tính % ngày `actual` nằm trong `[lower, upper]`. T: ≥ 85% (cho 90% CI). | ≥ 85% |
| TC-F1-06 | UI hiển thị forecast trong order form | G: DVKH chọn NPP HD-53. W: load order form. T: thấy "Forecast tuần này: 340 ± 15". | element visible, format đúng |
| TC-F1-07 | UI cảnh báo khi order < 70% forecast | G: forecast 340. W: DVKH gõ qty=200. T: badge "⚠ Đơn này dưới forecast 41%". | warning visible, không block submit |
| TC-F1-08 | Explainability click | G: forecast hiển thị. W: click ⓘ. T: modal hiện logic + MAPE 30 ngày. | modal có 4 sections (model/data/logic/MAPE) |

### F2 — NPP Health Score

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F2-01 | Compute health score | G: NPP HD-53 last_order=hôm qua, 339 orders, 48383 units. W: chạy job compute. T: score = 100, segment="Champion", risk="GREEN". | match expected |
| TC-F2-02 | Recency decay khi NPP không đặt | G: NPP X last_order = 95 ngày trước. W: compute. T: R_score giảm, risk="RED". | risk = RED |
| TC-F2-03 | Cron pg_cron refresh nightly | G: cron schedule `0 2 * * *`. W: trigger manual. T: `refreshed_at` updated. | timestamp updated |
| TC-F2-04 | API GET /v1/npp/:code/health | G: NPP HD-53 trong DB. W: GET. T: 200 OK + JSON full fields. | response schema match |
| TC-F2-05 | UI heatmap render | G: 19 tỉnh data. W: load DVKH dashboard. T: choropleth render, 19 polygons có màu. | map renders, hover tooltip OK |
| TC-F2-06 | UI badge inline order form | G: DVKH chọn NPP RED-banded. W: form load. T: badge red + copy "cần chăm sóc". | badge visible, copy đúng |

### F3 — Smart SKU Suggestions

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F3-01 | API trả suggestions theo confidence | G: items=[Bia tươi 2L]. W: GET suggestions. T: trả [Gông 5 keg 2L confidence=0.999, Gông 6 keg 2L confidence=0.985]. | array sorted desc by confidence |
| TC-F3-02 | Filter confidence ≥ 0.60 | G: rule X confidence=0.55. W: query. T: rule X NOT in response. | absent |
| TC-F3-03 | Auto-add cho rule confidence ≥ 0.985 | G: bundle rule. W: DVKH thêm "Bia tươi 2L". T: UI auto-add "Gông 5 keg 2L" với indicator "tự động". | item added with badge |
| TC-F3-04 | Suggestion explainability | G: suggestion shown. W: click ⓘ. T: modal hiện "98% NPP đặt cùng + lift 1.85". | modal correct |

### F4 — GPS-Calibrated VRP

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F4-01 | Travel matrix lookup | G: pair (HD, NPP HD-53) trong matrix bucket=morning_peak. W: VRP query travel time. T: dùng matrix value (not OSRM). | matrix value used |
| TC-F4-02 | Fallback OSRM nếu pair không có | G: pair (HD, NPP_NEW) không có trong matrix. W: VRP query. T: dùng OSRM live. | OSRM called |
| TC-F4-03 | A/B test 50/50 | G: AB flag bật. W: 1000 trips. T: ~500 dùng matrix, ~500 dùng OSRM. | split within 5% |
| TC-F4-04 | ETA accuracy improvement | G: 30 days backtest. W: so sánh actual vs ETA cho cả 2 group. T: matrix group MAPE < OSRM group MAPE. | improvement ≥ 15% |

### F5 — Seasonal Mode

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F5-01 | Toggle Tết mode | G: admin page. W: toggle ON. T: VRP buffer +20%, banner cam mọi trang. | banner visible |
| TC-F5-02 | Pre-alert NPP T-14 | G: Tết mode ON, ngày X. W: cron check. T: 14 ngày trước Tết, push Zalo template "đặt hàng sớm". | Zalo sent |
| TC-F5-03 | Reset normal mode | G: Tết ON. W: toggle OFF. T: VRP buffer = baseline. | buffer reset |

### F6 — Driver Performance Dashboard (READ-ONLY)

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F6-01 | RBAC chỉ dispatcher + admin | G: user role=driver. W: GET /dashboard/dispatcher/drivers. T: 403. | forbidden |
| TC-F6-02 | NĐ13 banner | G: page load. W: render. T: banner consent visible. | element exists |
| TC-F6-03 | KHÔNG hiển thị lương | G: page rendered. W: search DOM for "lương" / "salary". T: 0 matches. | text absent |
| TC-F6-04 | Tip cá nhân hóa | G: driver Hùng có route HD-CB top performance. W: load card. T: tip ghi rõ route + improvement. | tip text correct |

### F7 — GPS Anomaly Detection

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F7-01 | Detect deviation > 2km | G: planned route. W: GPS điểm cách >2km. T: alert created P1. | alert in DB |
| TC-F7-02 | Detect stop > 20min off-plan | G: trip in_transit. W: GPS speed=0 cho 21 phút tại non-stop location. T: alert P0. | alert P0 |
| TC-F7-03 | Push Zalo dispatcher | G: alert created. W: webhook trigger. T: Zalo message sent (mock). | mock receives |
| TC-F7-04 | UI map pin animate | G: alert on map. W: render. T: red pin animate-ping. | CSS class present |
| TC-F7-05 | Threshold tuning từ baseline | G: gps_anomalies_baseline.csv loaded. W: detect engine load thresholds. T: dùng đúng percentile từ baseline. | thresholds match |

### F10 — Revenue Intelligence

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F10-01 | Metabase iframe load | G: BGĐ login. W: open /dashboard/kpi/revenue. T: iframe render Metabase dashboard. | iframe 200 |
| TC-F10-02 | Top routes by margin | G: route_pnl loaded. W: dashboard query. T: top 10 sorted desc by margin. | sort correct |
| TC-F10-03 | SSO via JWT | G: BHL JWT. W: forward to Metabase. T: auto-login. | no Metabase login screen |

### F13 — Driver Coaching Card

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F13-01 | Card show after EOD | G: driver complete EOD. W: navigate. T: coaching card visible. | element exists |
| TC-F13-02 | Positive framing | G: card text. W: parse. T: không chứa từ negative ("kém", "tệ", "yếu"). | regex test pass |
| TC-F13-03 | Max 3 bullets | G: card render. W: count `<li>`. T: ≤ 3. | count ≤ 3 |
| TC-F13-04 | Tip cụ thể (route + action) | G: tip text. W: regex `route|km|stop`. T: match. | match found |

### F14 — Warehouse Tomorrow Panel

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F14-01 | Cron 16:00 compute | G: time=16:00. W: cron trigger. T: ml_features.warehouse_tomorrow_plan inserted. | row inserted |
| TC-F14-02 | UI render plan | G: plan exists. W: warehouse handler load page. T: card hiện "1,400 keg + 2,800 vỉ → 6 xe". | content correct |
| TC-F14-03 | Low-stock alert | G: SKU X tồn 200, dự kiến 280. W: panel render. T: warning badge + nút "Báo trợ lý kho". | button exists |

### F15 — Explainability Layer

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-F15-01 | Mọi forecast/suggestion có ⓘ | G: page render. W: query DOM. T: `[data-testid="explain-btn"]` count = số suggestions. | count match |
| TC-F15-02 | Modal có 4 sections | G: click ⓘ. W: modal open. T: model + data + logic + MAPE. | 4 sections |
| TC-F15-03 | Feedback "gợi ý sai" | G: modal open. W: click "Báo cáo sai". T: row in `ml_features.suggestion_feedback`. | DB row added |

### H9 — Feedback Loop (cùng F1)

| TC | Title | G/W/T | Pass |
|---|---|---|---|
| TC-H9-01 | Weekly cron compute MAPE | G: cron Sunday 03:00. W: trigger. T: forecast_actuals updated, MAPE per (sku,method) computed. | rows present |
| TC-H9-02 | Alert MAPE > 30% | G: SKU top-10 MAPE = 35%. W: cron post-compute. T: Zalo BGĐ alert sent. | mock receives |
| TC-H9-03 | Dashboard /dashboard/ml/health | G: admin login. W: navigate. T: chart MAPE trend per SKU visible. | chart renders |

---

## PHẦN C — ĐỀ BÀI DATA ĐẦU VÀO

### C.1 Hiện trạng data đã có (✅ ready to import)

| File | Size | Records | Status | Dùng cho |
|---|---|---|---|---|
| `npp_health_scores.csv` | 19 KB | ~300 NPP | ✅ READY | F2 |
| `sku_forecastability.csv` | 4 KB | ~30 SKU | ✅ READY | F1 routing |
| `sku_daily_demand.parquet` | 47 KB | daily × SKU 2022-23 | ✅ READY | F1 train |
| `basket_rules.csv` | 5 KB | ~hundreds rules | ✅ READY | F3 |
| `basket_transactions.csv` | 971 KB | raw txns | ✅ READY | F3 retrain |
| `driver_kpi_baseline.csv` | 7 KB | ~100 drivers | ✅ READY | F6 baseline |
| `gps_anomalies_baseline.csv` | 142 KB | thresholds | ✅ READY | F7 |
| `gps_clean.parquet` | 17.8 MB | GPS 2024 | ✅ READY | F4 train, F7 retrain |
| `travel_time_matrix.csv` | 5 KB | OD pairs × time bucket | ✅ READY | F4 |
| `route_pnl.csv` | 458 KB | route × week PnL | ✅ READY | F10 |
| `routes_official.csv` | 9 KB | 39 routes | ✅ READY | H2 import |
| `routes_archive_longtail.csv` | 629 KB | long-tail | ✅ READY | H2 archive |
| `seasonal_5year_long.csv` | 4 KB | seasonal index | ✅ READY | F5 |
| `seasonal_index_kho_month.csv` | <1 KB | warehouse × month | ✅ READY | F14 |
| `seed_scenarios.json` | <1 KB | 3 scenarios | ✅ LOCKED | regression test |
| `seed_snapshot_2022-07-27.csv` | 98 KB | peak day | ✅ READY | VRP regression |
| `sku_column_map_5y.csv` | 6 KB | excel→canonical | ✅ READY | ETL re-runs |

### C.2 Data CÒN THIẾU — cần BHL cung cấp hoặc thu thập thêm

> **Đây là phần quan trọng nhất.** Nếu không có data dưới đây, một số features không thể đạt world-class.

#### C.2.1 BẮT BUỘC trước Sprint 1 (BLOCKER)

| Data | Mục đích | Nguồn đề xuất | Format | Owner |
|---|---|---|---|---|
| **Fleet structure 2024+** | Resolve GPS≠LENH mismatch (F4/F6/F7) | BHL ops manager | CSV: `plate, vehicle_type, owner_type (own/leased), since_date, status` | BHL → PM |
| **NPP code map (LENH↔OMS)** | F2 health score query từ live OMS | BHL DVKH | CSV: `npp_code_lenh, customer_code_oms, customer_id_uuid` | BHL DVKH |
| **GPS coordinates per NPP** | F4 VRP cần địa chỉ giao thực | BHL DVKH + geocode | CSV: `npp_code, address, lat, lon, geocode_source, accuracy_m` | BHL + geocode tool |
| **Active SKU list 2026** | F1 chỉ forecast SKU đang bán | BHL sản xuất | CSV: `sku_chuan, active_yn, launch_date, eol_date, target_warehouses` | BHL sản xuất |

#### C.2.2 NÊN CÓ trước Sprint 2 (degraded mode nếu thiếu)

| Data | Mục đích | Fallback nếu thiếu |
|---|---|---|
| **Promotion calendar** | F1 forecast cần biết khuyến mãi | Skip — accept higher MAPE |
| **Weather data** | F4 ETA cần điều chỉnh khi mưa bão | Skip — chấp nhận no weather adjustment |
| **NPP demographic** (loại hình: bar/quán nhậu/đại lý) | F2 segment chính xác hơn | Dùng RFM thuần |
| **Driver consent records (NĐ13)** | F6 hiển thị KPI cá nhân hóa | Defer F6 sang Phase 2 |
| **Toll prices update 2026** | H4 BOT cost-aware | Dùng giá 2024 + manual update |
| **Vehicle capacity per plate** | F4 VRP capacity constraint | Default 5T cho mọi xe |

#### C.2.3 NICE-TO-HAVE (nâng cấp accuracy)

| Data | Cải thiện | Effort BHL |
|---|---|---|
| Customer feedback NPS | F2 health bổ sung qualitative | survey hàng tháng |
| Driver satisfaction survey | F13 coaching cá nhân hóa | quarterly |
| Manufacturing schedule | F1 biết SKU nào sắp hết | xuất từ MES |
| Competitor pricing | Strategic — Phase 3 | manual collect |
| External holidays calendar VN | F5 seasonal mode chính xác | static file |

### C.3 Data quality requirements

Mọi file phải đáp ứng:

| Check | Threshold | Cách verify |
|---|---|---|
| **Schema match** | 100% column names khớp DATA_DICTIONARY | python pandera validation |
| **No PII leak** | 0 SDT NPP/driver visible cho non-authorized | grep regex `\d{10,11}` |
| **NPP code unique** | duplicate = 0 | `SELECT npp_code, COUNT(*) GROUP BY 1 HAVING COUNT(*)>1` |
| **Date range valid** | 2022-01-01 ≤ date ≤ today | range check |
| **Numeric non-negative** | qty/amount ≥ 0 | sanity |
| **Encoding UTF-8** | không mojibake | `file -I` mime |
| **Geocode coverage** | ≥ 95% NPP có lat/lon | NULL count |

### C.4 Synthetic data cho test environment

CI/UAT cần data fixtures KHÔNG dùng prod:

| Fixture | Build by | Description |
|---|---|---|
| `tests/fixtures/npp_10.json` | manual | 10 NPP đại diện 5 segments |
| `tests/fixtures/sku_5.json` | manual | 5 SKU cover Prophet/Croston/Naive |
| `tests/fixtures/orders_peak_day.json` | derived from `seed_snapshot_2022-07-27.csv` | replay peak day |
| `tests/fixtures/gps_simulator_routes.geojson` | already exists in `bhl-oms/cmd/gps_simulator/` | simulate trips |
| `tests/fixtures/forecast_holdout.parquet` | split last 30 days from sku_daily_demand | ML accuracy test |

### C.5 Data refresh cadence sau go-live

| Data | Tần suất refresh | Owner | Method |
|---|---|---|---|
| `npp_health_scores` | nightly 02:00 | system | pg_cron job |
| `demand_forecast` | weekly Sun 23:00 | ML service | retrain Prophet |
| `basket_rules` | monthly | ML service | re-run Apriori |
| `travel_time_matrix` | weekly | ETL job | aggregate GPS week trước |
| `forecast_actuals` | daily 23:00 | system | join order_items vs forecast |
| `route_pnl` | weekly | KT module | aggregate from trips + invoices |
| `gps_anomalies_baseline` | monthly | ML service | recompute thresholds |
| `seasonal_index` | yearly + on-demand | data team | manual refresh |

---

## PHẦN D — TEST EXECUTION SCHEDULE

### D.1 Sprint 1 (Tuần 1–4) — Quick Wins testing

| Tuần | Test focus | Deliverable |
|---|---|---|
| 1 | TC-H4 BOT/Toll regression, TC-H2 route import | Test report |
| 2 | TC-F2-01..06, TC-F3-01..04 | E2E playwright + Vitest components |
| 3 | TC-F7-01..05, TD-020 toast smoke test | Anomaly simulator dataset |
| 4 | k6 load test 3 endpoints + UAT scripted | k6 report + UAT signoff |

### D.2 Sprint 2 (Tuần 5–8) — Intelligence Core testing

| Tuần | Test focus | Deliverable |
|---|---|---|
| 5 | ML service contract tests (Schemathesis) | OpenAPI contract pass |
| 6 | TC-F1-01..08, holdout MAPE backtest | ML accuracy report |
| 7 | TC-H9-01..03 feedback loop | Dashboard /ml/health screenshot |
| 8 | TC-F4-01..04 A/B test 1 tuần, TC-F15-01..03 | A/B comparison report |

### D.3 Sprint 3 (Tuần 9–12) — Customer-Centric testing

| Tuần | Test focus | Deliverable |
|---|---|---|
| 9 | TC-F5-01..03 seasonal toggle | Toggle E2E |
| 10 | TC-F13-01..04, TC-F14-01..03 | Driver mobile usability test (5 drivers) |
| 11 | TC-F6-01..04 (if NĐ13 done), TC-F10-01..03 | Metabase SSO E2E |
| 12 | Full regression Playwright + UAT 5-role | UAT signoff for go/no-go Phase 2 |

---

## PHẦN E — TEST RESPONSIBILITY MATRIX

| Test type | Owner | Reviewer | Frequency |
|---|---|---|---|
| Unit (backend) | Backend dev | Tech lead | per commit |
| Unit (frontend) | Frontend dev | Tech lead | per commit |
| Unit (ML) | Data engineer | Tech lead | per commit |
| Integration | Backend dev | QA | nightly |
| E2E Playwright | QA | Tech lead | per merge |
| ML accuracy | Data engineer | Product | weekly |
| UAT | Product manager | BHL stakeholder | sprint review |
| Mobile usability | UX designer | Product | quarterly |
| Load/Performance | DevOps | Tech lead | sprint review + pre-go-live |
| Security/A11y | DevOps + UX | Tech lead | per merge |

---

## PHẦN F — DATA REQUEST EMAIL TEMPLATE (gửi BHL)

```
Tiêu đề: [BHL OMS] Yêu cầu dữ liệu đầu vào cho phát triển hệ thống World-Class

Kính gửi anh/chị BHL,

Để triển khai 12 tính năng dữ liệu thông minh + chăm sóc khách hàng (xem kế hoạch
đính kèm WORLDCLASS_EXECUTION_PLAN.md), chúng tôi cần BHL cung cấp các dữ liệu sau:

🔴 BẮT BUỘC (ảnh hưởng go-live Sprint 1):

1. Cấu trúc đội xe 2024+
   - File CSV: biển số | loại xe | tự sở hữu/thuê ngoài | từ ngày | trạng thái
   - Lý do: dữ liệu GPS 2024 (71 plates 26xxx-30xxx) không trùng với LENH
     2022-2023 (plates 14C/14H/34M). Cần biết đội xe hiện hành để map đúng.

2. Bảng map mã NPP
   - File CSV: NPP code lịch sử (HD-53, HY-12...) | mã NPP trong OMS | UUID OMS
   - Lý do: NPP health score đã tính cho 300 NPP từ lịch sử, cần map sang OMS
     để hiển thị live trên dashboard DVKH.

3. Tọa độ giao hàng từng NPP
   - File CSV: NPP code | địa chỉ chi tiết | lat | lon
   - Lý do: VRP hiện chỉ có centroid tỉnh, ETA sai 5–10km. Cần tọa độ địa chỉ
     thực để route chính xác.

4. Danh sách SKU đang bán 2026
   - File CSV: tên SKU chuẩn | còn bán Y/N | ngày ra mắt | ngày EOL | kho áp dụng
   - Lý do: forecast chỉ chạy cho SKU active, tránh dự báo SKU đã ngừng.

🟡 NÊN CÓ (degraded mode nếu thiếu):

5. Lịch khuyến mãi 2026 (Excel)
6. Form đồng ý NĐ13 cho lái xe (mẫu + danh sách đã ký)
7. Bảng giá BOT 2026 update
8. Sức chở từng xe (tải trọng kg, m³)

Thời hạn: trước thứ Hai tuần sau (30/04/2026).
Liên hệ: [PM email]

Trân trọng,
```

---

*Phiên bản v1.0 — 23/04/2026. Sprint 0 World-Class. Sẽ cập nhật mỗi cuối sprint.*
