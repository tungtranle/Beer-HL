# DECISIONS — BHL OMS-TMS-WMS

> Record architectural and implementation decisions with rationale.  
> AI reads this to understand WHY code is written a certain way.  
> **Quy tắc:** Mỗi decision ghi rõ "Docs Impact" — file docs nào cần cập nhật khi đọc decision này.

---

## DEC-WMS-05: Reuse Phase 9 bin_locations rather than introduce a separate "suggested_bins" table
**Date:** 2026-04-28  **Status:** Implemented

**Context:** WMS Bin Guidance cần (1) chỉ ra bin gợi ý lúc nhập hàng và (2) hiển thị bin chính xác trên phiếu lấy hàng. Có 2 lựa chọn: (a) tạo bảng riêng `suggested_bins` cache top-3 trước, hoặc (b) tính realtime từ `bin_locations` + `stock_quants` + `pallets`.

**Decision:** Chọn (b) — tính realtime, không cache. Lý do:
- Số lượng bin nhỏ (~52/kho), query <50ms.
- Tránh staleness — tồn kho/free slots thay đổi liên tục.
- Không cần migration thêm table; mig 044 chỉ seed bins thực tế.

**Consequences:**
- ✅ Code đơn giản, không có background job đồng bộ.
- ⚠️ Nếu warehouse mở rộng >500 bin/kho → cần materialize hoặc thêm index trên `(warehouse_id, status)`.

**Docs Impact:** `BRD_BHL_OMS_TMS_WMS.md`, `CURRENT_STATE.md`, `DBS_BHL_OMS_TMS_WMS.md`.

---

## DEC-VRP-01: Lưu customer constraints dạng JSONB columns thay vì tách bảng `customer_traffic_zones` / `customer_windows`
**Date:** 2026-04-28  **Status:** Implemented (mig 045)

**Context:** Mỗi customer có thể có nhiều delivery windows + forbidden windows, mỗi cái là object {start, end, days, reason}. Có thể (a) tách 2 bảng many-to-one, hoặc (b) JSONB trên `customers`.

**Decision:** Chọn (b) JSONB. Lý do:
- 200 customers × ~3 windows = ~600 row total → JSONB không tốn nhiều storage.
- Read pattern: 100% lấy theo customer_id (không filter cross-customer theo window) → JSONB load all in single SELECT.
- Tránh 4 join cho mỗi planning request.
- Editor UI dễ implement: load 1 object, edit, PUT 1 lần.

**Consequences:**
- ✅ API đơn giản, frontend không cần CRUD nhiều endpoint.
- ⚠️ Không thể full-text search "khách nào cấm 06-09" — nhưng đây không phải use case thực tế.
- ⚠️ Validation chỉ làm ở frontend; backend không enforce schema. Nếu cần strict, thêm CHECK constraint với `jsonb_typeof()`.

**Docs Impact:** `BRD_BHL_OMS_TMS_WMS.md`, `DBS_BHL_OMS_TMS_WMS.md`, `INT_BHL_OMS_TMS_WMS.md` (API spec mới).

---

## DEC-VRP-02: Vehicle-weight enforcement bằng `routing.VehicleVar(node).SetValues([-1] + allowed)` thay vì allowed_vehicles list per node trong RoutingModel
**Date:** 2026-04-28  **Status:** Implemented (vrp-solver/main.py)

**Context:** OR-Tools cho phép giới hạn xe nào được visit node nào theo 2 cách: (a) `routing.SetAllowedVehiclesForIndex(allowed_list, index)` — API chính thức nhưng **không tồn tại trong python binding** stable, hoặc (b) `routing.VehicleVar(index).SetValues(allowed_with_minus_1)` — manipulate underlying CP variable trực tiếp.

**Decision:** Chọn (b) SetValues với `[-1] + allowed_vehicle_indices`. `-1` là sentinel cho "node không được visit" (đã được xử lý qua AddDisjunction phía trên).

**Consequences:**
- ✅ Hoạt động ngay với OR-Tools 9.x Python binding.
- ⚠️ Phụ thuộc vào internal API của OR-Tools — phải retest khi nâng version major.

**Docs Impact:** `BRD_BHL_OMS_TMS_WMS.md`, `INT_BHL_OMS_TMS_WMS.md` (VRP solver contract).

---

## DEC-PASSPORT-01: Asset Passport endpoints viết inline trong `cmd/server/main.go` thay vì tạo module `internal/passport/`
**Date:** 2026-04-28  **Status:** Implemented (TD-PASSPORT-INLINE accepted)

**Context:** Vehicle/driver timeline + stats là 4 query đơn lẻ aggregate từ tables sẵn có (work_orders, fuel_logs, trips, driver_scores, leave_requests, badge_awards). Không có business logic phức tạp.

**Decision:** Inline trong main.go ở giai đoạn này. Khi nào cần predictive maintenance, anomaly detection hoặc cron-warmed cache → tách module.

**Consequences:**
- ✅ Ship nhanh, không tăng độ phức tạp project layout.
- ⚠️ main.go dài hơn ~120 dòng → đã ghi vào TD-PASSPORT-INLINE.

**Docs Impact:** `BRD_BHL_OMS_TMS_WMS.md`, `SAD_BHL_OMS_TMS_WMS.md`, `TECH_DEBT.md`.

---

## DEC-QA-02: AQF is a mandatory vibe-code gate, not only a QA dashboard

**Date:** 2026-04-26  **Status:** Implemented in docs/process

**Context:** AQF 4.1 đã mô tả QA Portal v2, Decision Brief, gate timeline, evidence, monitoring và data safety. Tuy nhiên các file điều phối AI/vibe-code trước đây chủ yếu nhắc compile/test/localhost, chưa bắt buộc mọi phiên code phải map thay đổi vào G0/G1/G2/G3/G4 hoặc chứng minh scenario data không đụng history. Điều này dễ làm AI báo "xong" khi chỉ build pass nhưng thiếu evidence AQF.

**Decision:** Đưa AQF thành guardrail bắt buộc trong các tài liệu AI đọc khi vibe code:
- `CLAUDE.md` thêm routing AQF, quy tắc không vi phạm #7, checklist cuối phiên.
- `.github/instructions/test-after-code.instructions.md` thêm gate mapping G0-G4 và QA Portal data safety verification.
- `.github/instructions/doc-update-rules.instructions.md` và `sync-brd-docs.instructions.md` buộc cập nhật `AQF_BHL_SETUP.md`/`TST_BHL_OMS_TMS_WMS.md` khi QA/AQF thay đổi.
- `BACKEND_GUIDE.md`, `FRONTEND_GUIDE.md`, `RULES.md` thêm rule cụ thể cho ownership, Data Safety Panel, evidence và HOLD behavior.
- QA prompts/agent được cập nhật để không dùng legacy destructive test flow.

**Consequences:**
- ✅ Mọi thay đổi code phải báo gate AQF pass/skip thay vì chỉ nói build pass.
- ✅ Scenario/test data phải chứng minh `historical_rows_touched = 0` khi có DB mutation.
- ✅ AI session sau có router rõ ràng để đọc AQF trước khi đụng QA Portal/test data/go-live.
- ⚠️ Đây là process/docs guardrail, chưa phải enforcement tự động bằng hook. Nếu cần chặn cứng, thêm script G0/G2 quét destructive SQL và bắt buộc evidence JSON.

**Docs Impact:** `CLAUDE.md`, `.github/instructions/*.instructions.md`, `AQF_BHL_SETUP.md`, `TST_BHL_OMS_TMS_WMS.md`, `docs/specs/*_GUIDE.md`, `docs/specs/RULES.md`, `docs/specs/CURRENT_STATE_COMPACT.md`, `.github/prompts/*.prompt.md`, `.github/agents/qa-analyst.agent.md`, `TASK_TRACKER.md`, `CHANGELOG.md`.

---

## DEC-QA-01: QA Portal v2 replaces legacy Test Portal; scenario data must be scoped-owned

**Date:** 2026-04-26  **Status:** Implemented

**Context:** DB hiện đã có dữ liệu lịch sử. Test Portal cũ có UI 10 tab và các endpoint `reset-data`, `load-scenario`, `run-scenario`, `run-all-smoke` từng dùng `DELETE`/`TRUNCATE` rộng để reset transactional data. Cách này không còn chấp nhận được vì có thể xóa đơn/chuyến/tồn kho/lịch sử thật.

**Decision:** Bỏ UI Test Portal cũ khỏi `/test-portal`; route này render QA Demo Portal v2 và AQF Command Center sau login. Tắt các legacy destructive endpoints để bảo toàn dữ liệu. QA Portal v2 chỉ được nạp/xóa dữ liệu test qua ownership model: `qa_scenario_runs` + `qa_owned_entities`, cleanup theo scenario/run scope, historical rows touched = 0.

**Consequences:**
- ✅ Không còn nút/flow UI xóa rộng dữ liệu test.
- ✅ Legacy reset/load/run endpoints trả lỗi rõ ràng thay vì thao tác DB.
- ✅ AQF Command Center tiếp tục dùng được cho Decision Brief, Golden, Health, Evidence, Open Questions.
- ✅ Customer demo scenarios có runner scoped-owned, cleanup chỉ xóa entity được đăng ký trong `qa_owned_entities`.
- ⚠️ Package/backend vẫn tên `internal/testportal` để tránh refactor lớn trước go-live.

**Docs Impact:** `AQF_BHL_SETUP.md`, `CURRENT_STATE.md`, `API_BHL_OMS_TMS_WMS.md`, `TASK_TRACKER.md`, `TECH_DEBT.md`, `CHANGELOG.md`.

---

## DEC-AI-02: AI-Native UX v3 — Progressive enhancement + AI feature flags

**Date:** 2026-04-26  **Status:** Planned → Phase 1 in implementation

**Context:** Blueprint v3 yêu cầu AI UX/UI có thể bật/tắt theo nhu cầu. Khi tắt AI, UX/UI baseline vẫn phải hoạt động như trước. `DEC-AI-01` chỉ mô tả provider free-tier first, chưa đủ cho rollout an toàn, privacy routing, simulation và trust loop.

**Decision:** Adopt AI-Native Blueprint v3 as the governing spec for AI work. AI is progressive enhancement, not dependency. Build an AI feature flag backbone first (`ai_feature_flags`) with org/role/user scope and safe default OFF. Backend AI endpoints must check flags before provider calls; frontend AI UI must render baseline first and use `useAIFeature(flag)` for conditional enhancements.

**Queue decision:** Use existing Redis/Asynq-first strategy for async AI jobs because the codebase already runs Redis/Asynq. Do not add pgboss unless a later DEC proves Asynq cannot satisfy simulation/job requirements.

**Consequences:**
- ✅ AI can be rolled out per feature/role/user.
- ✅ Master switch can disable all AI without breaking core workflows.
- ✅ Code review has a clear baseline-off test.
- ✅ `ROADMAP.md` EC-10 is reclassified for AI scope only.
- ⚠️ Existing AI endpoints from `DEC-AI-01` need flag wrapping incrementally.

**Docs Impact:** `docs/specs/AI_NATIVE_BLUEPRINT_v3.md`, `CLAUDE.md`, `BRD_BHL_OMS_TMS_WMS.md`, `SAD_BHL_OMS_TMS_WMS.md`, `UIX_BHL_OMS_TMS_WMS.md`, `API_BHL_OMS_TMS_WMS.md`, `DBS_BHL_OMS_TMS_WMS.md`, `TASK_TRACKER.md`, `CURRENT_STATE.md` when code is implemented.

---

## DEC-AI-01: AI Intelligence Layer Architecture — Free-tier first, provider-agnostic

**Date:** 2026-04-24  **Status:** Planned (Sprint 2 — implement from 24/04/2026)

**Context:** BHL cần AI/ML experience để đạt world-class về Data-Driven và Customer-Centric. Constraint: hạ tầng VPS hiện tại không đủ RAM để chạy LLM on-premise (Ollama cần ≥16GB), không có ngân sách cho paid API ở giai đoạn pre-revenue.

**Options evaluated:**

1. **Ollama on-premise** (Qwen2.5:7b, 4.7GB RAM): Chất lượng tốt, $0/tháng sau khi setup. **Loại** — VPS hiện tại không đủ RAM, rủi ro ảnh hưởng PostgreSQL/Redis khi RAM contention.

2. **Claude/GPT-4 paid API**: Chất lượng cao nhất. **Loại cho hiện tại** — chi phí $30–200/tháng chưa phù hợp giai đoạn pre-revenue. Giữ làm upgrade path sau go-live.

3. **Gemini 2.0 Flash free tier + Groq fallback + Smart Rules**: Gemini free 1,500 req/ngày; BHL dùng ~50 req/ngày (3.3% quota). Groq free 14,400 req/ngày làm fallback. Smart Rules cho scoring không cần API. **Chọn.**

4. **Smart Rules only (không LLM)**: $0, zero latency. Nhưng output là số/badge, không có generative text — thiếu AI experience cho Dispatch Brief và Exception Explanation.

**Decision: Option 3 — Hybrid: Smart Rules + Gemini free + Groq fallback**

**Kiến trúc:**
```
internal/ai/
├── provider.go     # interface Provider { Generate(ctx, prompt, opts) (string, error) }
├── rules.go        # RulesEngine — deterministic scoring (AnomalyScore, CreditRisk, Seasonal)
├── gemini.go       # GeminiProvider — primary free LLM
├── groq.go         # GroqProvider — fallback
├── fallback.go     # FallbackChain — try Gemini → Groq → rules-based template
├── service.go      # AIService — high-level methods used by handlers
└── prompts/        # Prompt templates per use case (tiếng Việt)
```

**Config (env):**
```
AI_PROVIDER=gemini          # default free
AI_GEMINI_API_KEY=...       # free, lấy từ Google AI Studio
AI_GROQ_API_KEY=...         # free, lấy từ console.groq.com
# Upgrade path — không đổi code:
# AI_PROVIDER=claude         → dùng Anthropic SDK cùng interface
```

**Smart Rules không cần API:**
- `AnomalyScore(vehicle)` = deviation_km×0.4 + stop_min×0.4 + speed_score×0.2 → 0–100
- `CreditRiskScore(customer)` = payment_delay_days×3 + debt_growth_14d×2 + order_drop_30d×1
- `SeasonalDemandAlert(npp, sku, qty)` = qty < seasonal_index × historical_avg × 0.7

**Python :8090 extension (không tạo service mới):**
- Thêm `POST /ml/forecast-demand` vào vrp-solver hiện có
- Dùng `sku_daily_demand.parquet` đã có tại `D:\Xu ly Data cho BHL\output\enriched\`

**Trade-offs accepted:**
- Gemini response latency ~500–1500ms → dùng cache (`ai_insights` table, TTL 24h) cho dispatch brief và exception explain (lazy load)
- Groq free tier có rate limit burst — acceptable vì BHL ~50 req/ngày vs 14,400/ngày
- Gemini free không có SLA → fallback chain đảm bảo không có blocking failure
- Khi upgrade lên Claude/paid API: chỉ đổi `AI_PROVIDER` env var, không sửa business logic

**Upgrade trigger (khi nào dùng paid API):**
- Go-live >3 tháng, có revenue ổn định
- Gemini quota hit >50% consistently
- Cần multi-modal (ảnh ePOD phân tích chi tiết hơn)

**Docs Impact:** `BRD_BHL_OMS_TMS_WMS.md` (Section 14D added), `ROADMAP.md` (EC-19 reclassified A, EC-21 added, P1.5 added), `TASK_TRACKER.md` (Sprint 2 AI 11 tasks), `CURRENT_STATE.md` (khi implement xong).

---

## DEC-WC-05: Design System Foundation — Tokens + Primitives module under `web/src/components/ui/`

**Date:** 2026-04-30  **Status:** Implemented (Sprint UX-1)

**Context:** Audit toàn bộ FE (60+ pages, ~25k LOC) cho thấy 8 anti-patterns lặp lại: header `<h1 text-2xl font-bold>` ở 50+ chỗ, card `bg-white rounded-xl shadow-sm p-5` ở 100+ chỗ, button `bg-brand-500 hover:bg-brand-600` ở 200+ chỗ, status chip màu hardcode 80+ chỗ, spinner ad-hoc ở 90% page. Kết quả: visual hierarchy yếu, không có dark-mode-ready, refactor đụng đâu vỡ đó. Xem `UX_AUDIT_REPORT.md`.

**Options:**
1. Adopt 1 thư viện ngoài (shadcn/ui, Mantine, Chakra). **Loại** — quá nặng, lock-in, không match brand BHL orange.
2. Tự build 1 design tokens + 5–8 primitives base trên Tailwind hiện có. **Chọn** — tận dụng Tailwind đã có, brand-* palette đã set, không cần dependency mới.
3. Không làm gì, fix từng page. **Loại** — không scale, mỗi page tiếp tục tự style.

**Decision:** Build internal design system theo từng bước:
1. `web/src/lib/design-tokens.ts` — TS tokens (semantic colors, spacing, radius, motion, typography) + helper functions.
2. Primitives ở `web/src/components/ui/`: `PageHeader`, `Card`+`CardHeader`, `Button`, `KpiCard`, `LoadingState` (cộng thêm `EmptyState`, `Skeleton`, `StatusChip` đã có).
3. Barrel export `web/src/components/ui/index.ts`.
4. Áp dụng từng page mới + refactor dần page cũ — KHÔNG big-bang refactor (theo CLAUDE.md rule #4).

**Consequences:**
- ✅ Page mới chỉ cần ~150–250 LOC (vs 290 trung bình hiện tại).
- ✅ Visual consistency tự động.
- ✅ Dễ thêm dark mode sau (đổi tokens, không sửa page).
- ✅ Accessibility: focus-ring + aria pattern centralized.
- ⚠️ Còn 50+ page chưa migrate — cần Sprint UX-2/UX-3 áp dụng dần.

**Docs Impact:** `UX_AUDIT_REPORT.md` (created), `CHANGELOG.md` (Sprint UX-1 entry), khi tất cả page migrate xong → cập nhật `FRONTEND_GUIDE.md` chuẩn coding với primitives.

---

## DEC-WC-04: GPS Anomaly Detection — In-process detector hooked into GPS Hub

**Date:** 2026-04-30  **Status:** Implemented (Sprint 1 W3)

**Context:** F7 yeu cau real-time detection 4 loai bat thuong (deviation>2km, stop>20min, speed>90km/h, off-route) tu GPS stream cua 50+ xe.

**Options:**
1. **Stream processor rieng** (Kafka/NATS + worker) — scalable nhung phai stand up infra moi.
2. **In-process listener tren GPS Hub** — don gian, async qua goroutine, dung lai pool DB co san.
3. **Polling cron** moi 1 phut — don gian nhung tre 60s, sai SLA P0=20min stop alert.

**Decision:** **Option 2** — `internal/anomaly/Service.DetectPoint` implement interface `gps.PointDetector`. Hub goi `go detector.DetectPoint(...)` sau moi `PublishGPS`, panic-recovered. Per-vehicle stationary state luu in-memory `map[uuid.UUID]stationaryState` w/ Mutex. Threshold cache reload 5min tu `ml_features.gps_anomaly_thresholds`. Dedup 10-min window via `HasOpenSimilar`.

**Rationale:**
- Throughput hien tai ~50 xe × 1 point/s = 50 RPS → in-process du suc.
- Khong them dependency (Kafka/Redis stream) → deploy don gian.
- State in-memory mat khi restart → chap nhan: stop-overdue chi tre toi da `dedupWindow=10min` sau restart.

**Trade-offs accepted:**
- Single-instance only — khi scale horizontal phai migrate state ra Redis (TD).
- Zalo notification stub — chi log `anomaly_detected_zalo_pending` (TD: integrate `internal/integration/zalo` Sprint 2).

**Docs Impact:** SAD (anomaly module), API_BHL (anomaly endpoints), CURRENT_STATE (Sprint 1 W3 status).

---

## DEC-WMS-01: Phase 9 — WMS Pallet/QR/Bin Architecture (LPN-driven)

**Date:** 2026-04-23  
**Context:** User yêu cầu module Kho world-class với QR-driven xuất/nhập/tồn, FIFO theo đơn đã lập kế hoạch giao, KHÔNG bao gồm tính giá thành kế toán. Hiện tại WMS đã có lots/picking/gate-check/handover (24 endpoints) nhưng chưa có lớp Pallet+LPN+Bin → không đủ truy vết & scan-driven.  
**Decision:** Thêm layer mới (Migration 037) gồm 4 bảng: `pallets` (LPN), `bin_locations`, `qr_scan_log`, `cycle_count_tasks`. Layer mới **bổ sung**, không refactor `lots` / `stock_moves` cũ. Phạm vi **chỉ quản lý số lượng vật lý**, không cost layer.  
**Rationale:**
- LPN = spine cho mọi scan workflow (inbound putaway, picking, loading, cycle count).
- Chuẩn GS1 SSCC/GTIN/LOT/EXP đảm bảo tương thích quốc tế khi BHL xuất khẩu / bán cho NPP lớn.
- 1 pallet = 1 lot duy nhất (WMS-05) → FEFO chính xác tuyệt đối.
- Tách layer mới đảm bảo tuân CLAUDE.md rule #4 (KHÔNG refactor code cũ).
**Impact:**
- Migration 037 (4 bảng) + ~20 endpoint mới `/v1/warehouse/pallets|bins|inbound|picking/scan|loading|cycle-counts`.
- BRD section 6.6 (US-WMS-25..32, WMS-05..08).
- Frontend: `/warehouse/scan` (PWA), `/warehouse/inbound`, `/warehouse/bin-map`, `/warehouse/cycle-count`, `/warehouse/dashboard/realtime`.
- Roadmap: 5 sprints × 2 tuần (~10 tuần) = Phase 9.
**Docs Impact:** BRD ✅ (6.6), TASK_TRACKER (Phase 9 mới), CURRENT_STATE (Planned section), CHANGELOG.

---

## DEC-WMS-02: FEFO-only — Drop FIFO_RECEIVED requirement

**Date:** 2026-04-23  
**Context:** Đề xuất ban đầu có config 3 chiến lược picking (FIFO_RECEIVED / FEFO_EXPIRY / FIFO_WITH_FEFO_GUARD). User confirm: "Có FEFO rồi không cần FIFO nữa".  
**Decision:** Picking **chỉ dùng FEFO theo `lots.expiry_date`** (đã implement). Bỏ hoàn toàn nhánh FIFO_RECEIVED khỏi Phase 9. Không thêm field `picking_strategy`.  
**Rationale:**
- Chu kỳ bia ngắn (HSD ~120 ngày) + luân chuyển nhanh → FIFO ≈ FEFO khi nhập đều.
- FEFO đã đảm bảo lot cận hạn xuất trước → đủ kiểm soát rủi ro HSD.
- Bỏ tùy chọn = đơn giản hóa UI + giảm rủi ro thủ kho chọn nhầm strategy.
- 1 pallet = 1 lot (DEC-WMS-01) đảm bảo FEFO áp ở mức pallet, không bị "trộn lot" làm sai nguyên tắc.
**Impact:** US-WMS-28 chỉ định FEFO duy nhất. Không có config `picking_strategy` ở warehouse/product.  
**Docs Impact:** BRD ✅ (US-WMS-28, WMS-05).

---

## DEC-WMS-03: Hybrid PDA + Smartphone PWA (single codebase)

**Date:** 2026-04-23  
**Context:** Câu hỏi thiết bị scan: PDA hay smartphone. User confirm: "dùng cả 2 phương án".  
**Decision:** 1 codebase frontend `/warehouse/scan` (PWA) chạy cho **cả PDA Android** (Zebra TC22 / Honeywell EDA52, hardware key emit KeyEvent) **và smartphone Android** (camera scan qua `BarcodeDetector` API hoặc `@zxing/browser`). Không build 2 app riêng.  
**Rationale:**
- PDA: thủ kho chính / soạn hàng cường độ cao — cần quét nhanh, chịu rơi.
- Phone: bảo vệ, phân xưởng, dispatcher, tài xế — tận dụng thiết bị sẵn, tiết kiệm chi phí.
- PWA hỗ trợ cả 2 input mode → không tăng chi phí maintain.
- Offline-first IndexedDB queue cho cả 2 trường hợp mất kết nối.
**Impact:** Frontend page `/warehouse/scan` có dual input handler (KeyEvent listener + camera). Không tách route riêng.  
**Docs Impact:** BRD ✅ (6.6.2).

---

## DEC-WMS-04: Bravo integration cho Phase 9 = PENDING (independent first)

**Date:** 2026-04-23  
**Context:** User confirm: "Phát triển độc lập với Bravo trước, câu chuyện API kết nối tính sau".  
**Decision:** Toàn bộ entity mới của Phase 9 (`pallets`, `bin_locations`, `qr_scan_log`, `cycle_count_tasks`) **KHÔNG có** `bravo_sync_status` field, **KHÔNG** wire vào BravoAdapter. Chỉ có internal events `pallet.created/moved/picked/loaded` qua `entity_events` để truy vết nội bộ.  
**Rationale:**
- Tránh blocking khi Bravo chưa có spec field LPN/bin.
- Phase 9 đã rộng (5 sprints) — không nên gánh thêm scope tích hợp.
- Khi cần kết nối sau, chỉ cần thêm bảng `pallets_bravo_sync` riêng (không ALTER bảng cũ) — tuân CLAUDE.md rule #4.
**Impact:** Migration 037 không có sync columns. Backlog ghi rõ "Bravo integration for WMS Phase 9 — TBD".  
**Docs Impact:** BRD ✅ (WMS-08), TECH_DEBT (thêm TD ghi nhận pending).

---

## DEC-WC-03: ML Features dedicated schema + `/v1/ml/*` API prefix

**Date:** 2026-04-23
**Context:** F1–F15 cần nhiều table dẫn xuất (ML/analytics) và nhiều endpoint mới. Để tránh pollute schema OLTP `public` và router OMS, cần quy ước tách rõ.
**Decision:**
- Schema: tất cả bảng read-only/derived đặt trong `ml_features.*`.
- API: mọi endpoint serve dữ liệu từ `ml_features.*` mount dưới `/v1/ml/*`.
- Module Go: `internal/mlfeatures/` riêng, KHÔNG nhúng vào `oms/`, `tms/`, `wms/`. Cho phép sau này tách ra microservice hoặc đặt sau ML service Python (Sprint 2 — FastAPI :8091).
- Cron refresh: cập nhật `ml_features.*` thông qua import script hoặc pg_cron (Sprint 1 W2). KHÔNG ghi từ HTTP handler.
**Rationale:**
- Backward compatible: không đổi schema OMS Core; rollback = drop schema + remove module wiring.
- Tính rõ ràng: dev thấy `ml_features.npp_health_scores` thì hiểu là derived data, không sửa tay.
- Tương lai (Sprint 2): khi ML service FastAPI đứng lên, `internal/mlfeatures` thành proxy/cache — vẫn giữ route signature `/v1/ml/*`.
**Impact:** Migration 036 + 036b dedicate schema. Module `internal/mlfeatures/{repository,service,handler}.go`. 4 endpoints. Frontend wire vào orders/new + customers.
**Docs Impact:** DATA_DICTIONARY.md ✅ (locked schema), CHANGELOG.md ✅, API_BHL_OMS_TMS_WMS.md (TODO: thêm section ML Features).

---

## DEC-WC-02: Component-first approach cho UX Redesign

**Date:** 2026-04-23
**Context:** UX_AUDIT_AND_REDESIGN.md xác định 7 critical issues + redesign cho 12 features mới. Có 2 cách triển khai:
1. **Page-first:** sửa từng trang một (orders/new, control-tower, ...) — high risk vì touch business logic.
2. **Component-first:** build shared components (NppHealthBadge, SmartSuggestionsBox, ExplainabilityButton, CommandPalette, ...) trước, integrate vào pages sau.
**Decision:** Chọn Component-first (Phase 1 → 4 trong UX_REDESIGN_EXECUTION_PLAN.md).
**Rationale:**
- Backward compatible 100% — components mới = file mới, không break existing pages.
- Reusable ngay cho 12 features F1–F15 (ExplainabilityButton dùng cho F1, F2, F3, F4, F7, F14...).
- Test riêng từng component với Vitest dễ hơn test integration.
- Rollback dễ: comment out 1 dòng mount globally (CommandPalette).
**Impact:** 7 components mới trong Sprint 1 Phase 1 (Skeleton, EmptyState, ExplainabilityModal, NppHealthBadge, SmartSuggestionsBox, InboxItem, CommandPalette). Phase 2 mới integrate vào pages.
**Docs Impact:** docs/specs/FRONTEND_GUIDE.md §11 ✅, docs/specs/UX_REDESIGN_EXECUTION_PLAN.md ✅, CHANGELOG.md ✅.

---

## DEC-WC-01: Reclassify EC-12 Demand Forecasting C → A + adopt World-Class Strategy

**Date:** 2026-04-23
**Context:** Strategy doc `c:\Users\tungt\Downloads\BHL_WorldClass_Strategy.html` đề xuất 12 features data-driven + customer-centric. ROADMAP cũ phân loại EC-12 (Demand Forecasting) vào nhóm C "không phù hợp" với lý do "BHL sản xuất-to-order". Tuy nhiên, dữ liệu enriched 5 năm LENH tại `D:\Xu ly Data cho BHL\output\enriched` (file `sku_forecastability.csv`) chứng minh **21 SKU có ≥100 active days** đủ cho Prophet, **8 SKU Tết** đủ cho Croston intermittent.
**Decision:**
1. Move EC-12 từ ROADMAP nhóm C → nhóm A (P2, tháng 4–6).
2. Adopt 12 features (F1–F15) trong [`docs/specs/WORLDCLASS_EXECUTION_PLAN.md`](docs/specs/WORLDCLASS_EXECUTION_PLAN.md ) chia 3 sprints × 4 tuần.
3. Schema riêng `ml_features.*` (migration 036), KHÔNG ghi đè bảng Core.
4. ML service riêng FastAPI :8091, không nhúng vào monolith Go.
5. Build F1 + H9 Feedback Loop **CÙNG SPRINT** để tránh ML "fire-and-forget".
**Rationale:**
- BHL dù sản xuất-to-order vẫn cần forecast để: planning kho NPP, alert DVKH khi đơn < 70% trend, gợi ý SKU cross-sell.
- Tách schema `ml_features.*` đảm bảo nguyên tắc "không refactor code cũ" (CLAUDE.md rule #4).
- ML service riêng cho phép: Python ecosystem (Prophet/Croston), scale độc lập, fail-soft (timeout → no suggestion).
- F15 Explainability bắt buộc — không có "tại sao?" thì user không tin và bỏ tool.
**Impact:**
- ROADMAP.md: EC-12 moved C→A, Phase plan extended P2/P2.5/P3.
- Migration 036_ml_features_schema added (9 bảng).
- New folder: `docs/specs/WORLDCLASS_EXECUTION_PLAN.md` + `docs/specs/DATA_DICTIONARY.md`.
- BLOCKER: cần BHL confirm fleet structure (GPS 2024 plates 26xxx-30xxx vs LENH 2022-2023 plates 14C/14H/34M) — zero overlap, ảnh hưởng F4/F6/F7. Tạm xử lý: 2 fleet domains tách biệt (analytics vs live ops).
**Docs Impact:** ROADMAP.md ✅, CHANGELOG.md ✅, docs/specs/DATA_DICTIONARY.md ✅, docs/specs/WORLDCLASS_EXECUTION_PLAN.md ✅, TASK_TRACKER.md (cần thêm Sprint 1–3 tasks).

---

## DEC-001: Bổ sung Web Driver UI cho bản demo (không thay thế React Native)

**Date:** 2026-03-15  
**Context:** BRD spec yêu cầu React Native Expo driver app (SDK 51+). Yêu cầu native app **KHÔNG thay đổi** — vẫn là mục tiêu chính cho production.  
**Decision:** Bổ sung thêm driver UI dạng Next.js web `/dashboard/driver/` để phục vụ demo trong khi chưa có app native.  
**Rationale:**
- App native cần thời gian build + publish lên store → chưa kịp cho phase demo
- Web driver UI cho phép demo ngay trên trình duyệt, không cần cài app
- Cùng API backend, sau này React Native Expo chỉ cần gọi lại API sẵn có
- PWA fallback: web có thể "Add to Home Screen" để tạm thay thế native
- **Native app vẫn nằm trong roadmap Phase 4/5** — web không thay thế, chỉ bổ sung
**Impact:** Tasks 2.7-2.8 done as web pages cho demo. Native app sẽ implement riêng khi đến phase.  
**Docs Impact:** CURRENT_STATE.md (ghi rõ "Driver app = Next.js web cho demo, native vẫn planned"), TECH_DEBT.md (TD-006)

---

## DEC-002: Single models.go instead of per-module domain files

**Date:** 2026-03-14  
**Context:** CONVENTIONS.md suggests separate files (order.go, trip.go, stock.go)  
**Decision:** Keep all structs in `internal/domain/models.go`  
**Rationale:**
- Project is medium-sized (~31 entities), single file is manageable
- Avoids circular import issues between modules
- Easy to grep and find any struct
**Impact:** All new structs go into models.go  
**Docs Impact:** CURRENT_STATE.md (ghi "31 structs in models.go")

---

## DEC-003: pkg/response/ instead of apperror package

**Date:** 2026-03-14  
**Context:** CONVENTIONS and ERROR_CATALOGUE spec define `pkg/apperror/` with typed errors  
**Decision:** Use simpler `pkg/response/` with direct HTTP helpers  
**Rationale:**
- Faster to implement during demo phase
- Less ceremony for simple CRUD operations
- Will migrate to apperror when error handling becomes complex (Phase 3)
**Impact:** Handlers use response.OK(), response.Err(), etc.  
**Docs Impact:** TECH_DEBT.md (TD-001), KNOWN_ISSUES.md (KI-004)

---

## DEC-004: Raw pgx queries instead of sqlc

**Date:** 2026-03-14  
**Context:** AI_CONTEXT_PRIMER specifies sqlc for DB access  
**Decision:** Use raw pgx v5 queries in repository.go  
**Rationale:**
- sqlc requires separate compilation step and config
- Dynamic queries (filters, pagination) are easier with raw pgx
- pgx v5 enum/date casting issues are handled inline
**Impact:** No sqlc.yaml, no generated code. Manual SQL in repository files.  
**Docs Impact:** TECH_DEBT.md (TD-005), KNOWN_ISSUES.md (KI-001, KI-002)

---

## DEC-005: Tailwind CSS instead of Ant Design

**Date:** 2026-03-14  
**Context:** BOILERPLATE_SPEC and AI_CONTEXT_PRIMER specify Ant Design 5.x  
**Decision:** Use Tailwind CSS with custom components  
**Rationale:**
- Lighter bundle size for demo
- More control over styling
- No antd dependency conflicts with Next.js 14
**Impact:** All UI uses Tailwind utility classes, no Ant Design components  
**Docs Impact:** TECH_DEBT.md (TD-002)

---

## DEC-006: Integration hooks pattern (fire-and-forget async)

**Date:** 2026-03-15  
**Context:** Tasks 3.1-3.7 require wiring Bravo/DMS/Zalo into business flows  
**Decision:** Create `integration.Hooks` struct injected into OMS/TMS services via `SetIntegrationHooks()`. All integration calls are goroutine fire-and-forget — never block the user.  
**Rationale:**
- Integration errors should NEVER fail business operations (error-codes instruction: return 202)
- Clean separation: services don't import adapters directly
- Hooks are optional — nil check before calling
- Easy to add new hooks without changing service constructors
**Impact:** `hooks.go` created, OMS/TMS services accept hooks  
**Docs Impact:** CURRENT_STATE.md (integration wiring section)

---

## DEC-007: Notification Bell → Right-side Slide Panel (topbar design)

**Date:** 2026-03-20  
**Context:** Session 17 đặt NotificationBell trong sidebar header (w-64). Text bị cắt, khó đọc. User feedback: UI khó đọc, đề xuất đặt bên phải.  
**Decision:** Chuyển NotificationBell từ sidebar sang topbar trong main content area. Click mở slide-in panel full-height bên phải (max-w-md), thay vì dropdown nhỏ w-80.  
**Rationale:**
- Sidebar chỉ rộng 256px (w-64), dropdown w-80 bị tràn ra ngoài viewport
- Slide panel từ phải cho phép hiển thị nội dung đầy đủ (400px+ width)
- Topbar là vị trí chuẩn cho notification bell (GitHub, Slack, Teams pattern)
- Panel có backdrop overlay, ESC close, body scroll lock — UX chuẩn
**Impact:** Layout restructured: sidebar (nav only) + topbar (greeting + bell) + main content. NotificationBell renders portal-style fixed positioning.  
**Docs Impact:** CURRENT_STATE.md (notification UI section), CHANGELOG.md

---

## DEC-008: Entity Events as immutable audit log (JSONB detail)

**Date:** 2026-03-20  
**Context:** Cần track timeline/history cho orders + trips. Options: (a) separate columns cho mỗi event type, (b) JSONB detail column.  
**Decision:** Sử dụng bảng `entity_events` với `detail JSONB` — mỗi event type tự define fields trong JSONB.  
**Rationale:**
- Immutable log — không update, chỉ INSERT
- Flexible: mỗi event type có fields khác nhau (reject_reason, order_number, etc.)
- Không cần migration khi thêm event type mới
- 23 event types hiện tại, dễ mở rộng
- Query bằng JSONB operators khi cần
**Impact:** `internal/events/` package, `entity_events` + `order_notes` tables  
**Docs Impact:** DBS_BHL_OMS_TMS_WMS.md (schema), CURRENT_STATE.md

---

## DEC-009: UXUI_SPEC.md — Per-role UX/UI specification

**Date:** 2026-03-21  
**Context:** Frontend pages đang code không nhất quán về layout, color, interaction. Mỗi role có context khác nhau (driver mobile vs dispatcher desktop vs PDA warehouse). Cần source of truth cho UI decisions.  
**Decision:** Tạo `docs/specs/UXUI_SPEC.md` — per-role UX spec với layout patterns, color rules, component snippets. Brand color #F68634 + 5 UX rules bắt buộc.  
**Rationale:**
- 8 roles → 8 layout patterns khác nhau (3-column cockpit, mobile full-width, PDA scan-first, etc.)
- Brand color #F68634 ≠ amber warning → phải phân biệt rõ ràng
- 5 UX rules (zero dead ends, instant feedback, role-aware empty states, trace ID, tap targets) đảm bảo consistency
- Copy-paste color snippets tiết kiệm thời gian, giảm sai sót
- `frontend-patterns.instructions.md` updated → AI auto-read UXUI_SPEC.md trước khi code
**Impact:** `docs/specs/UXUI_SPEC.md` (mới), `.github/instructions/frontend-patterns.instructions.md` (updated), `CLAUDE.md` (added UX section)  
**Docs Impact:** CLAUDE.md, frontend-patterns.instructions.md

---

## DEC-010: Gap Analysis — Priority Adjustments (11 role UX gaps)

**Date:** 2026-03-21  
**Context:** Phản biện bảng gap analysis 11 roles. Bảng gốc đánh P0 cho 6 items. Sau phân tích code thực tế + business context BHL (~70 xe, ~800 NPP), nhiều items bị over-prioritized.  
**Decision:** Điều chỉnh priorities theo bảng sau:

| Role | Đề xuất gốc | Điều chỉnh | Lý do |
|------|-------------|------------|-------|
| Admin (config versioning, 4-eye) | P0 | **P1** | Audit log đã cover; 4-eye overkill cho 1-2 admin |
| BGĐ (executive narrative) | P1 | **P1** ✓ | Chỉ cần drill links, không cần narrative engine |
| Điều phối (what-if, bulk) | P0 | **P2** | Đã là role mạnh nhất; what-if quá sớm cho ~70 xe |
| DVKH (customer workspace) | P0 | **P1** | Thêm vài links/tabs, không cần redesign |
| Kế toán (recon workbench) | P0 | **P0** ✓ | Nhưng scope gọn: T+1, split view, history |
| KT Trưởng (đà riêng) | P0 | **P2** | 1 người; action-level RBAC đủ, không cần screen riêng |
| Thủ kho (workbench) | P1 | **P1** ✓ | Queue picking + gate backlog |
| Đội trưởng (fleet console) | P1 | **P2** | Gộp vào dispatcher là deliberate (CURRENT_STATE.md) |
| Bảo vệ (evidence) | P1 | **P1** ✓ | Photo + per-item + reason code |
| Phân xưởng (assets desk) | P0 | **P0** ✓ | Gap lớn nhất: role + page cần thiết |
| Tài xế (native app) | P0 | **P3** | PWA đủ go-live; native = 6-12 tháng, 200-500M VND |

**Rationale:**
- BHL chưa chạy production → chưa biết pain points thực tế
- "World-class" features (what-if, 4-eye, executive narrative) không cần cho go-live ~70 xe
- P0 trước go-live chỉ nên là features ảnh hưởng trực tiếp đến daily operations
- Native mobile đánh giá lại sau 3 tháng production với data thực tế

**Impact:** Tạo Phase 6 (18 tasks): 5 P0 + 8 P1 + 5 P2/P3. Tổng 128 tasks.  
**Docs Impact:** TASK_TRACKER.md (Phase 6), TECH_DEBT.md (TD-014–TD-017), UXUI_SPEC.md (add workshop role)

---

## DEC-011: Workshop (Phân xưởng) = sub-role của warehouse_handler

**Date:** 2026-03-21  
**Context:** BRD định nghĩa "Phân xưởng" là role riêng, nhưng business logic gồng warehouse_handler (cùng thuộc WMS). Tách role hoàn toàn sẽ cần migration, RBAC update, frontend routing.  
**Decision:** Implement workshop như role `workshop` riêng trong DB nhưng share WMS API endpoints. Frontend page riêng `/dashboard/workshop/`. Sub-set quyền của warehouse_handler — chỉ thấy returns + asset classification, không thấy picking/inbound.  
**Rationale:**
- Role riêng cho RBAC sạch (security boundary)
- Share endpoints tránh duplicate code
- Scope gọn: 1 page phân loại vỏ + 1 report đối chiếu
**Impact:** Thêm role `workshop` vào auth enum, migration, seed data. 2 frontend pages.  
**Docs Impact:** UXUI_SPEC.md (§9b), CURRENT_STATE.md, BRD role mapping

---

## DEC-012: NPP App defer sang Phase 2 (sau 3-6 tháng go-live)

**Date:** 2026-03-22  
**Context:** v4 spec thiết kế đầy đủ NPP App với token-based confirm/reject, xem công nợ, báo sai lệch. Tuy nhiên Phase 1 chỉ có ~70 xe và NPP chưa quen dùng app.  
**Decision:** Phase 1 dùng Zalo OA + DVKH ghi thay (DEC-013). NPP App bằng React Native Expo sẽ triển khai Phase 2 sau 3-6 tháng production ổn định.  
**Rationale:**
- Zalo OA đã quen thuộc với NPP, không cần cài thêm app
- DVKH ghi thay đảm bảo quy trình không bị block
- Auto-confirm 2h/24h giảm tải cho DVKH khi NPP không phản hồi
- Schema DB đã sẵn sàng (`reject_reason_code`, `dispute_reason_code`, `visibility`) — không cần migration Phase 2
**Impact:** Token-based endpoints (`confirm_order`, `reject_order`) → TD-026. Note visibility locked → TD-027.  
**Docs Impact:** TECH_DEBT.md (TD-026, TD-027), UXUI_SPEC.md (§14.8)

---

## DEC-013: DVKH ghi thay NPP trong Phase 1

**Date:** 2026-03-22  
**Context:** NPP phản hồi qua Zalo/ĐT, không trực tiếp thao tác trên hệ thống. DVKH phải ghi nhận thay.  
**Decision:** DVKH sử dụng 2 modal chuyên dụng:
- `record_npp_rejection` — NPP từ chối đơn (reason code + ghi chú)
- `record_npp_dispute` — NPP báo sai lệch giao hàng (reason code + ghi chú)
Cả 2 modal ghi log `actor_type = 'dvkh'`, `on_behalf_of = 'npp'` vào entity_events.  
**Rationale:**
- Không cần NPP learn hệ thống mới
- DVKH đã là touchpoint chính với NPP
- Audit trail rõ ràng: ai ghi, ghi thay ai, lý do gì
**Impact:** 2 modals mới trong frontend DVKH, backend endpoint ghi entity_events.  
**Docs Impact:** UXUI_SPEC.md (§13, §14.1), BUSINESS_RULES.md (BR-OMS-AUTO)

---

## DEC-014: Hybrid toll detection — arc-based for VRP solver + route geometry for post-solve reporting

**Date:** 2026-06-18  
**Context:** Arc-based toll detection (point-to-segment matching on straight lines between stops) is fast but inaccurate — real roads curve significantly. Expressway entry/exit detection per-arc fails when vehicle enters on one leg and exits on another.  
**Decision:** Keep arc-based detection in VRP solver cost matrix (speed-critical), add OSRM route geometry-based detection after solve for accurate per-trip toll reporting. Fallback to arc-based if OSRM fails.  
**Rationale:**
- VRP solver needs fast cost matrix computation (hundreds of arcs)
- Post-solve reporting runs once per trip, can afford OSRM call
- Route geometry walks actual road polyline → accurate proximity detection
- Expressway gates tracked IN ORDER across full route → correct entry/exit pairing
**Impact:** `vrp-solver/main.py` — 2 new functions, modified post-solve loop. Backend unchanged (already passes all toll data). Frontend shows toll_type differentiation.  
**Docs Impact:** CURRENT_STATE.md (Cost Engine section), CHANGELOG.md

---

## DEC-015: Fleet & Driver Management — Scope Decisions

**Date:** 2026-04-21  
**Context:** 3 đề xuất FMS+/DMS+ được phân tích so sánh. User có 4 ràng buộc rõ: (1) không GPS hộp đen Phase đầu, (2) bỏ quản lý giờ lái xe, (3) bỏ làm ca, (4) OCR hạ ưu tiên.  
**Decision:**

| Quyết định | Lý do |
|------------|-------|
| **Bỏ US-TMS-28 (HOS)** | TT12/2020 sắp bỏ, user xác nhận |
| **Bỏ US-TMS-30 (Shift/Roster)** | User xác nhận |
| **Bỏ US-TMS-35 (Spare Parts Inventory)** | BHL không tự sửa xe, sửa tại garage ngoài |
| **Rule-based Health Score thay ML Phase đầu** | Chưa có data sửa chữa (0 records), ML cần ≥6 tháng |
| **Bỏ accelerometer Safety Score** | Smartphone false positive 30-50% trên xe tải, chỉ dùng GPS speed |
| **Tire tracking per bộ lốp, không per serial** | BHL chưa có nhân sự chuyên trách bảo trì |
| **OCR (PaddleOCR) hạ xuống Phase 4+** | User xác nhận chưa ưu tiên |
| **E-Learning dùng YouTube + Forms thay build LMS** | Đủ cho 70 tài xế, không cần build riêng |
| **Leave Request giữ, bỏ tạm ứng lương/khám sức khỏe** | Chỉ leave ảnh hưởng VRP, phần còn lại là HR scope |

**Rationale:** "Tốt hơn là đo 5 chỉ số chính xác còn hơn 7 chỉ số mà 2 cái bị sai 30-50%." Scale BHL (70 xe) không cần enterprise features.  
**Impact:** Giảm từ 18 tuần → 12 tuần, 16 bảng → 10 bảng, 9 US giữ lại (bỏ 3).  
**Docs Impact:** BRD Section 14C, TASK_TRACKER Phase 8, CURRENT_STATE.md

---

*Cập nhật: 21/04/2026 — DEC-015 from fleet management analysis session*
