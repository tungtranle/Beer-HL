# AI_NATIVE_BLUEPRINT_v3 — BHL OMS-TMS-WMS

> Source of truth cho hướng UX/UI AI-native từ 26/04/2026. Blueprint chi tiết gốc: `BHL_AI_NATIVE_BLUEPRINT_v3.md` do Product cung cấp.
> Tài liệu này là bản engineering digest để AI/session sau đọc nhanh trước khi code.

---

## 1. Nguyên tắc bắt buộc

1. AI chỉ là progressive enhancement. Core workflow phải hoạt động 100% khi AI flag OFF.
2. Mọi action có rủi ro vận hành phải qua approval hoặc undo 30s.
3. Privacy Router fail-closed ở backend. UI không tự quyết định dữ liệu nào được gửi cloud.
4. Mọi AI suggestion phải có explainability hoặc lý do explicit vì sao không có.
5. Mọi AI action phải audit được trong `ai_audit_log` hoặc `entity_events` tương ứng.
6. Rollout AI bằng feature flags 3 cấp: org, role, user. Default OFF.
7. Test từng feature ngay sau code: flag ON, flag OFF, fallback/error state.
8. Decision Intelligence là hướng triển khai UX: AI xuất hiện tại điểm quyết định, không tạo widget dày đặc trên mọi màn hình.
9. Mỗi page chỉ có tối đa 1 AI surface expanded mặc định; insight phụ dùng chip/drawer và có dismiss theo entity/session.
10. Voice/camera/write action chỉ prefill hoặc mở flow xác nhận; không auto-submit hành động có tác động vận hành/tài chính.

---

## 2. AI Toggle Architecture

### 2.1 Flags chuẩn

| Flag | Mục đích | Baseline khi OFF |
|---|---|---|
| `ai.master` | Tắt/bật toàn bộ AI | Toàn bộ AI hidden/disabled |
| `ai.copilot` | Copilot panel | Navigation/menu thủ công |
| `ai.briefing` | Daily briefing | Dashboard KPI truyền thống |
| `ai.voice` | Driver voice commands | Driver tap manual |
| `ai.camera` | Camera extract | Điền form thủ công |
| `ai.simulation` | Simulation layer | Dispatcher quyết định thủ công |
| `ai.intent` | Cmd+K AI intent | Cmd+K chỉ navigate |
| `ai.automation.t3` | Scheduled AI jobs | Chạy thủ công |
| `ai.automation.t2` | Approval suggestions | User tự tạo action |
| `ai.gps_anomaly` | AI/rules anomaly | Rule-based cũ hoặc không badge AI |
| `ai.forecast` | Demand forecast | Không hiện forecast widget |
| `ai.credit_score` | Credit scoring | Hiển thị raw công nợ/hạn mức |
| `ai.adaptive_ui` | Smart defaults | Fixed defaults |
| `ai.transparency` | Transparency Center | Page hidden |
| `ai.trust_loop` | Trust escalator | Tier rules thủ công |
| `ai.explainability` | Vì sao? popover | Không hiện nút explain |
| `ai.feedback` | Feedback loop | Không thu feedback AI |

### 2.2 Rule code review

- Component phải render baseline trước, AI block chỉ render dưới `useAIFeature(flag)`.
- Không dùng AI response làm điều kiện render page chính.
- Không để skeleton AI chặn nội dung baseline.
- Backend endpoint AI phải kiểm tra flag trước khi gọi provider.
- Flag lookup fail hoặc missing row = disabled.

---

## 3. Hybrid-Edge AI Stack

| Role | Provider | Ghi chú |
|---|---|---|
| LLM cloud chính | Gemini 2.0 Flash | Chỉ cloud-safe/anonymized data |
| LLM fallback | Groq Llama | Fallback khi Gemini lỗi/quota |
| LLM local | Ollama M1 Qwen2.5 7B | Sensitive/local-only data |
| Embedding | Ollama nomic-embed-text | Batch/local |
| STT | Web Speech API phase 1; faster-whisper-small phase 2 | Voice command vẫn phải confirm |
| Forecast/anomaly | Python :8090 + Go rules | Không block core workflow |

Queue strategy hiện tại: ưu tiên Redis/Asynq đang có trong codebase. Chỉ thêm pgboss khi có DEC riêng.

---

## 4. UX Patterns

| Pattern | Component/Page | Rule |
|---|---|---|
| AI Inbox | `/dashboard` role widgets | Group root cause, suggested action, snooze reason |
| Copilot | `components/copilot/*` | Role-aware tools, no free-form write action |
| Explainability | `ExplainabilityPopover` | Lazy load on click, skeleton 1-3s, retry after 5s |
| Approval | `ApprovalCard` | Tier 2 actions only, show undo/audit |
| Undo | `UndoBanner` | 30s TTL for reversible AI-driven actions |
| Simulation | `SimulationCard` | Async status, snapshot time, expire 5 phút, revalidate before apply |
| AI Settings | `/dashboard/settings/ai` | Admin only, master switch + per-feature/role toggles |
| Transparency | `/dashboard/ai/transparency` | Model status, automation log, cost dashboard |

### 4.1 Decision Intelligence Layer

Decision Intelligence Layer thay cho tư duy “AI everywhere”. User BHL không cần thêm một khu AI riêng để ra quyết định hằng ngày; họ cần insight đúng lúc tại 5 workflow vàng:

| Workflow | Decision point | Surface |
|---|---|---|
| OMS tạo đơn | Có nhận đơn này không, có rủi ro NPP/ATP không | `AIContextStrip` dưới customer selector + forecast/ATP chip nhỏ |
| Approval queue | Đơn nào cần xử lý trước, có hard gate R15 không | Tab “Ưu tiên xử lý” + `CreditRiskChip` + explainability |
| Planning/VRP | Có duyệt kế hoạch này không | Panel “Điểm cần xem trước khi duyệt” build từ VRP result |
| Control Tower | Xe nào cần xử lý trước | Marker score chỉ khi `ai.gps_anomaly` ON; fallback baseline map |
| Driver PWA | Tài xế thao tác ít hơn nhưng vẫn xác nhận | `VoiceCommandFAB` chỉ mở confirm/prefill, không auto-submit |

Trust metadata nên hiển thị đa yếu tố thay vì chỉ một con số: confidence, data freshness, sample size, source và impact level.

---

## 5. Sprint Coding Plan

### Phase 0 — Docs + foundation
- Create this spec, update BRD/SAD/UIX/API/DBS/DECISIONS/TASK_TRACKER.
- Decide queue strategy: Asynq-first.

### Phase 1 — AI Toggle Backbone
- Migration `042_ai_feature_flags`.
- Backend flag repository/service/API.
- Frontend `useFeatureFlags`, `useAIFeature`.
- Admin page `/dashboard/settings/ai`.
- Verify: admin API, page load, flag ON/OFF behavior.

### Phase 2 — Privacy Router + Provider Fallback
- Sensitive pattern classifier with >=50 test cases.
- Audit log writes for provider route/model/latency.
- Gemini/Groq/Ollama providers behind interface.
- Status 26/04/2026: implemented with `privacy_router.go`, `ai_audit_log`, existing Gemini/Groq/Mock chain; `go test ./internal/ai` PASS.

### Phase 3 — AI UX primitives
- ExplainabilityPopover, AIStatusBadge, ApprovalCard, UndoBanner, SimulationCard.
- Ensure baseline renders with every AI flag OFF.
- Status 27/04/2026: implemented under `web/src/components/ai`; added `AIContextStrip`, `ConfidenceMeter`, AI tokens, TTL cache and feedback adapter; `ExplainabilityPopover` supports factors/trust metadata.

### Phase 4 — P0 Safety features
- Voice Driver phase 1, Daily Briefing, GPS anomaly flagging, AI Inbox basic.
- Status 27/04/2026: voice whitelist endpoint + Driver `VoiceCommandFAB` implemented; write intents require visual confirmation. Control Tower vehicle score calls are gated by `ai.gps_anomaly`.

### Phase 5 — Copilot + Intent MVP
- 5 read-only tools, intent registry, Cmd+K AI with disambiguation.
- Status 26/04/2026: backend intent registry + Cmd+K AI intent integration implemented; flag OFF keeps static command palette.

### Phase 6 — Simulation + Trust Loop
- VRP/re-route simulations first, then stock/credit/cutoff.
- Trust escalator suggests only; admin approves promotions.
- Status 26/04/2026: VRP/re-route dry-run snapshots, approval-required apply and Trust Suggestions endpoint implemented; no core table mutation.

---

## 6. Acceptance Gates

| Gate | Must pass |
|---|---|
| G0 | Backend compile, frontend type/lint for touched area |
| G1 | Unit tests for Privacy Router/flag resolution |
| G2 | API happy/error cases |
| G3 | Frontend page load + AI OFF baseline check |
| AQF | If demo/test data touched: `historical_rows_touched = 0` |
