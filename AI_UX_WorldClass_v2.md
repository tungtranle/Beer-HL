# BHL OMS-TMS-WMS — AI-Native UX/UI Master Plan v2.0
## Hợp nhất Blueprint Hybrid-Edge + Intent-Driven UX + Simulation Layer

**Phiên bản:** 2.0 (consolidated)
**Ngày:** 26/04/2026
**Trạng thái:** Production-ready blueprint — đủ để engineering team build từ Sprint 1
**Thay thế:** `AI_UX_WorldClass_Proposal.md` v1.0 (strategy-only)
**Đọc kèm:** `BHL_AI_NATIVE_BLUEPRINT.md`, `UX_AUDIT_AND_REDESIGN.md`, `BRD_BHL_OMS_TMS_WMS.md`

---

## 0. LỜI MỞ — Tự phản biện và quyết định kết hợp

Bản v1.0 trước đó của tôi đúng về **triết lý** nhưng dừng ở tầng strategy: thiếu phân bổ RAM cụ thể, thiếu Privacy Router, thiếu model version, thiếu effort estimate, thiếu cost analysis, thiếu graceful degradation, và **trùng lặp** với `UX_AUDIT_AND_REDESIGN.md` (U2/U4/F15) thay vì xây tiếp lên nó. Bản phản biện đã chỉ đúng — tôi adopt toàn bộ.

`BHL_AI_NATIVE_BLUEPRINT.md` đã giải quyết đúng 7 gap đó. Bản v2.0 này **giữ Blueprint làm xương sống** (Privacy Router, Hybrid-Edge, model selection, RAM, cost, sprint effort), và **bổ sung 3 lớp UX còn thiếu** mà Blueprint chưa đào sâu:

1. **Intent Layer** (Cmd+K nâng cấp thành intent execution, không chỉ navigation)
2. **Simulation Before Action** (preview trade-off trước khi apply — pattern Stripe/Linear áp dụng cho VRP/transfer/credit)
3. **Trust Loop** (feedback → retrain → escalate tự động hóa) — khép kín vòng lặp giữa người và AI

Đây là 3 chỗ mà BHL có thể vượt Stripe/Linear nếu làm đúng, vì vận hành B2B logistics có ngữ cảnh quyết định rõ ràng hơn nhiều so với SaaS ngang.

---

## 1. NGUYÊN TẮC CHỦ ĐẠO (5 axioms — không thương lượng)

| # | Axiom | Hệ quả thiết kế |
|---|---|---|
| 1 | **AI đề xuất, người duyệt ở điểm rủi ro cao** | Mọi action có tác động vận hành phải qua approval card hoặc undo 30s |
| 2 | **Privacy là rule cứng, không phải feature** | Privacy Router chặn ở backend; UI không cần biết — fail-closed |
| 3 | **Mọi gợi ý AI phải có "Vì sao?"** | Component `<ExplainabilityPopover>` dùng chung, mọi card AI bắt buộc render |
| 4 | **Mọi action AI phải reversible hoặc auditable** | `ai_audit_log` schema thống nhất; undo TTL 30s cho Tier 2; rollback procedure cho Tier 3 |
| 5 | **Graceful degradation là requirement, không phải nice-to-have** | Cloud → M1 → Rule-based → Cached. Mỗi feature phải pass kill-test (kill Gemini + kill M1) |

7 câu hỏi checklist (giữ từ v1.0 — đã được phản hồi là dùng được trong sprint review):

1. Mở màn hình có thấy ngay việc quan trọng nhất không?
2. Hệ thống có đề xuất hành động tiếp theo không?
3. AI có giải thích vì sao không?
4. Duyệt/sửa/từ chối trong ≤ 2 thao tác không?
5. Có undo hoặc audit trail không?
6. Có đo feedback để cải thiện AI không?
7. UX có giảm cognitive load thực sự, hay chỉ thêm widget mới?

---

## 2. KIẾN TRÚC HYBRID-EDGE (giữ nguyên từ Blueprint)

Tham chiếu `BHL_AI_NATIVE_BLUEPRINT.md` §2 — sơ đồ kiến trúc, luồng request A/B. Không lặp lại ở đây.

**Bổ sung 3 thành phần v2.0 chưa có trong Blueprint:**

```
┌────────────────────────────────────────────────────────────┐
│   internal/ai/intent.go        ← Intent Layer (NEW)        │
│   • Parse intent từ Command Palette / voice / NL search    │
│   • Map sang function call hoặc page navigation            │
│   • Disambiguation prompt khi confidence < 0.7             │
├────────────────────────────────────────────────────────────┤
│   internal/ai/simulation.go    ← Simulation Engine (NEW)   │
│   • Dry-run VRP / transfer / credit override / re-route    │
│   • Trả về 2-3 phương án + trade-off matrix                │
│   • KHÔNG ghi DB, chỉ tạo `simulation_id` để approve sau  │
├────────────────────────────────────────────────────────────┤
│   internal/ai/trust_loop.go    ← Trust Escalator (NEW)     │
│   • Track approval rate per (user, action_type, model)     │
│   • Suggest promote Tier 1→2 khi 30/30 approve             │
│   • Suggest demote Tier 3→2 khi rollback rate > 5%         │
└────────────────────────────────────────────────────────────┘
```

---

## 3. MODEL SELECTION — VERSION CỤ THỂ (chốt từ Blueprint §3)

Không lặp lại bảng đầy đủ. Quyết định cuối:

- **LLM cloud chính:** `gemini-2.0-flash` (free 1,500 req/day)
- **LLM cloud fallback:** `llama-3.3-70b-versatile` qua Groq (free 14,400 req/day)
- **LLM intent parser:** `llama-3.1-8b-instant` qua Groq (~300ms — đủ nhanh cho Cmd+K)
- **LLM local:** `qwen2.5:7b-instruct-q4_K_M` (KHÔNG phải `coder` variant — sửa lỗi v1.0)
- **Embedding:** `nomic-embed-text` local trước, A/B với `text-embedding-004` sau 4 tuần
- **STT:** `faster-whisper-small` local; upgrade `medium` nếu WER > 25% sau 2 tuần
- **Vision:** `gemini-2.0-flash` (multimodal cùng API key)
- **Forecast:** Prophet hiện tại + A/B `NeuralProphet`; `Chronos-T5-Small` cho NPP cold-start
- **Anomaly:** `IsolationForest` (sklearn) thay rule-based GPS

---

## 4. PRIVACY ROUTER — LỚP BẮT BUỘC ĐẦU TIÊN

Đây là lỗ hổng lớn nhất trong v1.0 của tôi. Blueprint §5 đã thiết kế đúng. v2.0 thêm **decision flowchart** rõ ràng cho engineer:

```
┌─────────────────────────────────────────────────────────────┐
│  REQUEST TỪ FRONTEND                                        │
│  { prompt: "...", context: {...}, user_role: "dispatcher" } │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
              ┌────────────────────────┐
              │ 1. Strip raw PII?      │  Audio? → ALWAYS LOCAL
              │    (audio/image/PII)   │  Image với khuôn mặt? → LOCAL
              └─────────┬──────────────┘  Text có pattern PII? → ANONYMIZE
                        ▼
              ┌────────────────────────┐
              │ 2. Classify sensitivity│  Danh sách pattern (regex):
              │    via patterns +      │  - "HD-\d+" (NPP code)
              │    role policy         │  - "\d+[,.]?\d*\s*(triệu|VNĐ|đ)"
              └─────────┬──────────────┘  - "tồn kho.*\d+"
                        ▼                  - SDT, CCCD, biển số
              ┌────────────────────────┐
              │ 3. Có anonymize được   │
              │    mà giữ semantics?   │
              └────┬──────────────┬────┘
                YES│              │NO
                   ▼              ▼
        ┌──────────────────┐  ┌───────────────────┐
        │ ANONYMIZE → Cloud│  │ LOCAL ONLY (M1)   │
        │ - Gemini Flash   │  │ - Ollama Qwen2.5  │
        │ - Reverse map    │  │ - Không log raw   │
        │   để de-anonymize│  │ - Audit "local"   │
        │   trong response │  │                   │
        └────────┬─────────┘  └─────────┬─────────┘
                 │                      │
                 └──────────┬───────────┘
                            ▼
              ┌────────────────────────┐
              │ ai_audit_log INSERT    │
              │ {request_hash, route,  │
              │  model, latency, ...}  │
              └────────────────────────┘
```

**Fail-closed default:** Nếu classifier confidence < 0.8 → route LOCAL. Tốt hơn là chậm, không tốt hơn là leak.

**Test plan bắt buộc trước Sprint 1:**
- 100 prompt thật từ DVKH/Dispatcher (anonymized) → chạy qua Router
- Manual review: 0 PII nào lọt sang Cloud branch (zero tolerance)
- Performance: classification < 5ms (regex + keyword, không gọi LLM)

---

## 5. INTENT LAYER — Vượt khỏi Command Palette thông thường

`UX_AUDIT_AND_REDESIGN.md` U2 đã đề xuất cmdk cho navigation. v2.0 nâng lên thành **Intent Execution** — cùng một ô input có thể:

1. **Navigate** — "đơn HD-53 tuần này" → mở list filtered
2. **Query** — "doanh thu hôm nay" → trả KPI ngay trong palette
3. **Execute** — "tạo đơn giống tuần trước cho HD-53" → tạo draft + mở form
4. **Simulate** — "nếu thêm 3 xe thuê thì sao" → mở Simulation panel

### 5.1 Architecture

```
User gõ vào cmdk
    ↓
Intent Parser (Groq Llama-3.1-8B, ~300ms)
    ↓ JSON: {intent: "execute", action: "create_order_from_template", args: {...}, confidence: 0.92}
    ↓
Confidence < 0.7? → Show disambiguation list (3 options)
Confidence ≥ 0.7? → Direct execute
    ↓
Tier check (xem §7):
  Tier 1 → execute ngay
  Tier 2 → mở Approval Card
  Tier 3 → schedule + confirm
    ↓
Streaming response trong palette (không cần navigate đi)
```

### 5.2 Catalog 30 intents Sprint 1

```yaml
# config/intents.yaml — registry-driven, dễ thêm
- name: navigate.orders
  examples: ["mở đơn", "danh sách đơn", "đơn của HD-53"]
  handler: nav_handler
  tier: 1

- name: query.daily_kpi
  examples: ["KPI hôm nay", "doanh thu hôm nay", "tỷ lệ on-time"]
  handler: kpi_handler
  tier: 1

- name: execute.create_order_from_template
  examples: ["tạo đơn giống {date}", "lặp đơn cho {npp}"]
  handler: order_template_handler
  tier: 2  # tạo draft, không gửi

- name: simulate.vrp_what_if
  examples: ["nếu thêm {n} xe", "nếu giảm khung giờ", "thử với 10 xe"]
  handler: simulation_vrp_handler
  tier: 1  # simulation không tác động prod

- name: query.why_late
  examples: ["vì sao trip {id} trễ", "lý do chuyến {id} chậm"]
  handler: copilot_function_call
  tier: 1
# ... 25 intents khác
```

### 5.3 Acceptance criteria
- P50 intent parse latency < 400ms; P99 < 800ms
- Top-1 accuracy ≥ 85% trên test set 200 câu thực
- Disambiguation flow khi confidence < 0.7 (max 3 options)
- Mọi intent execution có `intent_id` trace trong `ai_audit_log`

---

## 6. SIMULATION LAYER — "Show me trade-offs trước khi tôi bấm"

Đây là điểm v1.0 nói tới mơ hồ; v2.0 specify đủ để build.

### 6.1 5 simulation types triển khai

| Loại | Trigger | Input | Output |
|---|---|---|---|
| **VRP What-If** | Dispatcher trước khi approve plan | `{vehicles_delta, time_window_change, priority}` | 3 phương án: xe count, OTD%, total cost, late risk |
| **Stock Transfer** | Warehouse khi dự báo thiếu | `{from_wh, to_wh, sku, qty, deadline}` | Impact: tồn 2 kho sau transfer, đơn nào cứu được |
| **Credit Override** | KT khi NPP vượt hạn mức | `{npp_id, order_value}` | Risk score: payment history, AR aging, recommend approve/reject |
| **Re-route Trip** | Dispatcher khi xe trễ | `{trip_id, reason}` | 2 reroute options: ETA mới, fuel cost, NPP impacted |
| **Cutoff Change** | Admin trước khi sửa rule R08 | `{new_cutoff_hour, effective_date}` | Mô phỏng 30 ngày qua: bao nhiêu đơn chuyển nhóm, OTD shift |

### 6.2 UI pattern dùng chung — `<SimulationCard>`

```
┌─────────────────────────────────────────────────────────────┐
│  🧪 Mô phỏng — Tái tối ưu VRP                              │
│  ─────────────────────────────────────────────────────────  │
│                                                             │
│       Hiện tại     │  Phương án A   │  Phương án B  │ C   │
│  ─────────────────┼────────────────┼───────────────┼─────  │
│  Số xe       12   │     11 ✓        │    10         │ 13  │
│  OTD%        96%  │     95% ✓       │    91% ⚠      │ 97% │
│  Chi phí     18M  │     16.8M ✓     │    15.7M      │ 19M │
│  Late risk   0    │     1 stop      │    3 stops ⚠  │ 0   │
│                                                             │
│  💡 Đề xuất: Phương án A — tiết kiệm 1.2M, OTD ổn định.    │
│  ⓘ Vì sao? [Mở giải thích]                                 │
│                                                             │
│  [Áp dụng A]  [Áp dụng B]  [Áp dụng C]  [Hủy]              │
│  ⏱ Phương án này expire sau 5 phút (snapshot data)          │
└─────────────────────────────────────────────────────────────┘
```

**Quy tắc:**
- Simulation KHÔNG ghi DB chính, chỉ tạo `simulations` row TTL 5 phút
- Apply → tạo Approval Card Tier 2 với undo 30s
- Reject/Expire → audit log, không tác động
- Mọi simulation chạy async qua pgboss để không block UI

### 6.3 Backend API

```go
// POST /api/v1/simulations
type SimulationRequest struct {
  Type    string                 `json:"type"` // "vrp_what_if", "stock_transfer", ...
  Context map[string]interface{} `json:"context"`
  UserID  string                 `json:"user_id"`
}

type SimulationResponse struct {
  SimulationID string                   `json:"simulation_id"`
  Options      []SimulationOption       `json:"options"`
  Recommended  string                   `json:"recommended_option_id"`
  Explanation  string                   `json:"explanation"`
  ExpiresAt    time.Time                `json:"expires_at"`
}

// POST /api/v1/simulations/:id/apply
// Body: {option_id: "A"}
// → Creates Approval Card Tier 2 với 30s undo window
```

---

## 7. TIERED AUTOMATION — chốt boundary và promotion rule

Blueprint §4 Paradigm 3 đã có 3 tier. v2.0 thêm **decision matrix** ai/việc gì thuộc tier nào, và **Trust Escalator** rule cụ thể.

### 7.1 Decision matrix (24 use case BHL)

| Use case | Tier mặc định | Lý do |
|---|---|---|
| Tạo briefing 5:45 sáng | 3 | Read-only, không tác động vận hành |
| Gửi nhắc Zalo NPP chưa xác nhận | 3 | Idempotent, đã có rule cứng |
| Đối soát auto-close lệch < 50K | 3 | Threshold đã defined trong policy |
| Re-train ML model thứ 2 hàng tuần | 3 | Offline, có A/B trước khi promote |
| VRP nightly run 22:00 | 3 | Plan, chưa ai xuất kho |
| Suggest re-route khi xe trễ > 15p | 2 | Có impact NPP, cần dispatcher OK |
| Suggest credit override < 10% over | 2 | KT duyệt 1-click |
| Suggest stock transfer NMSX↔Kho | 2 | Có impact production |
| Suggest demote driver lương | ❌ NEVER | Không AI quyết định lương |
| Suggest fire NPP / blacklist | ❌ NEVER | Quyết định kinh doanh |
| Auto-approve đơn vượt hạn mức | ❌ NEVER | Vi phạm R15 |
| Auto-close discrepancy bất kỳ | ❌ NEVER | Phải có human cho > 50K |

### 7.2 Trust Escalator — promote/demote tự động

```go
// internal/ai/trust_loop.go

type EscalationRule struct {
  ActionType         string
  CurrentTier        int
  ConsecutiveApprove int  // Threshold để suggest promote
  RollbackRate30d    float64 // Threshold để suggest demote
}

var Rules = []EscalationRule{
  {"reroute_trip",       2, 30, 0.05}, // 30/30 approve → suggest auto. >5% rollback → demote
  {"credit_override",    2, 50, 0.02}, // KT cẩn thận hơn → 50/50 + 2% rollback
  {"stock_transfer",     2, 40, 0.05},
}

// Gửi suggestion lên Inbox của Admin/BGĐ, KHÔNG tự promote
func CheckPromotionEligibility() []PromotionSuggestion {
  // Query ai_audit_log
  // Trả về list suggest cho Admin review
}
```

**Quan trọng:** Promotion KHÔNG tự động. AI chỉ **suggest** lên Admin Inbox; con người approve cuối cùng. Đây là điểm phân biệt với "AI tự nâng quyền" — vốn là anti-pattern bảo mật.

---

## 8. AI INBOX + TODAY'S FOCUS — re-use, không re-design

`UX_AUDIT_AND_REDESIGN.md` U4 đã có Inbox pattern; D-1/D-2 đã có Today's Focus wireframe. v2.0 KHÔNG vẽ lại — chỉ bổ sung 3 enhancement AI:

1. **Smart grouping** — Inbox tự gom các item cùng root cause (ví dụ 5 trip late vì cùng tắc đường QL5 → 1 card "Sự cố QL5: 5 trip ảnh hưởng [Xem all]")
2. **Suggested action** — mỗi item có "Đề xuất AI" với ⓘ explainability
3. **Snooze with reason** — chọn snooze 15p phải chọn lý do (1 click options) → feed vào trust loop để AI học pattern bỏ qua

### Schema bổ sung

```sql
-- Migration 047: inbox_items
CREATE TABLE inbox_items (
  id              UUID PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id),
  type            TEXT NOT NULL,            -- 'trip_late', 'credit_alert', ...
  priority        TEXT NOT NULL,            -- 'P0','P1','P2','P3'
  title           TEXT NOT NULL,
  detail          TEXT,
  ai_suggestion   JSONB,                    -- {action, explanation, confidence}
  group_key       TEXT,                     -- để smart grouping
  status          TEXT DEFAULT 'open',      -- open|snoozed|done|dismissed
  snoozed_until   TIMESTAMPTZ,
  snooze_reason   TEXT,
  resolved_at     TIMESTAMPTZ,
  resolved_by     UUID,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inbox_user_status ON inbox_items(user_id, status, priority);
CREATE INDEX idx_inbox_group ON inbox_items(group_key) WHERE group_key IS NOT NULL;
```

---

## 9. EXPLAINABILITY — component dùng chung, bắt buộc

Blueprint nhắc, UX Audit F15 vẽ. v2.0 chốt **API contract** để mọi feature dùng chung.

### 9.1 Component contract

```typescript
// components/ai/ExplainabilityPopover.tsx

interface ExplainabilityProps {
  source_id: string          // ID của suggestion
  source_type: string        // 'forecast' | 'reroute' | 'credit' | ...
  // Dữ liệu lazy load qua API khi user click
}

// Render:
// <ExplainabilityPopover source_id="fcst_123" source_type="forecast">
//   <Icon name="info" />  {/* trigger */}
// </ExplainabilityPopover>
```

### 9.2 Backend response contract

```json
GET /api/v1/ai/explain/:source_type/:source_id

{
  "model": "Prophet v1.2",
  "trained_at": "2026-04-20T02:00:00Z",
  "confidence": 0.87,
  "data_points_used": 28,
  "reasoning": [
    "Trend +5%/tuần trong 4 tuần qua",
    "Tuần 3 trong tháng = peak +8% lịch sử",
    "Không phát hiện anomaly gần đây"
  ],
  "metrics": {
    "mape_30d": 0.12,
    "rank_in_user_feedback": "top 25%"
  },
  "feedback_endpoint": "/api/v1/ai/feedback",
  "feedback_options": ["correct", "wrong", "not_useful", "other"]
}
```

### 9.3 Mọi card AI phải pass test này
```
ESLint custom rule: any component name matching /^Ai[A-Z]/ MUST include
<ExplainabilityPopover> as child OR explicit prop `noExplain={true}` with comment.
```

Đây là rule cứng — không có nút "Vì sao?" thì không merge được.

---

## 10. VOICE & CAMERA cho Driver — chốt UX an toàn

Blueprint §4 Paradigm 4-5 đã có. v2.0 thêm 2 safety guard:

### 10.1 Voice safety

- **Confirmation modal bắt buộc** cho mọi command có write impact (complete_stop, mark_failed)
- Không bao giờ auto-execute không có visual + haptic confirm
- Modal hiển thị parsed text → driver tap "Đúng" hoặc "Sửa"
- Timeout 5s không tap → auto-cancel (an toàn hơn auto-confirm)

### 10.2 Camera safety

- Vision extract → pre-fill form, KHÔNG auto-submit
- Confidence < 0.6 → hide pre-fill, chỉ giữ ảnh đã chụp
- Driver luôn phải tap "Xác nhận" cuối cùng
- Audit log lưu cả raw extract + final value driver chọn → train model

---

## 11. CHI PHÍ & RAM — số cụ thể (chốt từ Blueprint)

### 11.1 Cost forecast 12 tháng

| Tháng | Users | Req/day | Gemini | Groq | Maps | Total $/tháng |
|---|---|---|---|---|---|---|
| 1-3 | 20 | ~300 | $0 (free) | $0 | $0 | **$0** |
| 4-6 | 40 | ~600 | $0 (free) | $0 | ~$5 | **$5** |
| 7-9 | 80 | ~1,200 | $0 (free) | $0 | ~$10 | **$10** |
| 10-12 | 150 | ~2,500 | ~$15 | $0 | ~$20 | **$35** |
| Tết peak | 200 | ~4,000 | ~$30 | $0 | ~$30 | **$60** |

Cộng tiền điện M1 (~3tr VND/tháng = ~$120) → tổng vẫn < $200/tháng đến 12 tháng.

### 11.2 RAM safeguard

Blueprint §1.4 đã có. v2.0 thêm **monitoring alert**:

```yaml
# prometheus/alerts.yml
- alert: M1RAMPressureHigh
  expr: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes) / node_memory_MemTotal_bytes > 0.85
  for: 10m
  labels: {severity: warning}
  annotations:
    summary: "M1 RAM > 85% trong 10 phút — cân nhắc unload Ollama hoặc scale up"

- alert: OllamaSwapping
  expr: rate(node_vmstat_pswpout[5m]) > 100
  for: 5m
  labels: {severity: critical}
```

---

## 12. SPRINT PLAN — effort estimate cụ thể (mở rộng từ Blueprint §7)

Blueprint đã có. v2.0 bổ sung 3 sprint mới cho Intent + Simulation + Trust Loop.

### Phase 0 — Foundation (Tuần 1-2) — giữ nguyên Blueprint
**Bổ sung:** Migration 047 inbox_items, 048 simulations, 049 ai_intent_log

### Sprint 1 (Tuần 3-4) — P0 — giữ Blueprint + Privacy Router e2e test

### Sprint 2 (Tuần 5-6) — Copilot MVP — giữ Blueprint

### Sprint 3 (Tuần 7-8) — Intent Layer + Simulation Layer (NEW v2.0)

```
Feature                                   Role        Effort
──────────────────────────────────────────────────────────────
Intent Parser (Groq 8B integration)       BE+ML       3 ngày
Intent Registry + 30 intents config       BE          2 ngày
Cmdk UI nâng cấp (streaming response)     FE          3 ngày
Simulation API skeleton (5 types)         BE          3 ngày
SimulationCard component dùng chung       FE          2 ngày
VRP What-If (kết nối OR-Tools dry-run)    BE+ML       2 ngày
──────────────────────────────────────────────────────────────
Total: ~15 ngày engineering
```

### Sprint 4 (Tuần 9-10) — Approval/Undo + Trust Loop (NEW v2.0)

```
Feature                                   Role        Effort
──────────────────────────────────────────────────────────────
Approval Card Tier 2 (4 use cases đầu)    FE+BE       3 ngày
Undo banner + 30s TTL mechanism           FE+BE       2 ngày
ai_audit_log unified schema + writes      BE          2 ngày
Trust Escalator daily job (suggestions)   BE          2 ngày
Stock transfer simulation                 BE+ML       2 ngày
Credit override simulation                BE+ML       2 ngày
Re-route simulation                       BE+ML       2 ngày
──────────────────────────────────────────────────────────────
Total: ~15 ngày engineering
```

### Sprint 5-6 — Adaptive UI + Transparency Center (giữ Blueprint Sprint 4)

### Sprint 7 — Camera Vision + Voice driver (giữ Blueprint Sprint 3)

### Phase 2 (Tháng 4-6) — giữ Blueprint

---

## 13. RỦI RO — 5 rủi ro Blueprint + 3 mới

Blueprint R1-R5 giữ nguyên. v2.0 thêm:

### R6: Intent parser hallucinate → execute sai action

| | |
|---|---|
| **Xác suất** | Trung bình — LLM 8B có thể parse sai |
| **Tác động** | Cao nếu auto-execute |
| **Giảm thiểu** | 1. Whitelist intent (registry-driven, không free-form) 2. Confidence < 0.7 → disambiguation 3. Tier 2/3 luôn cần approve 4. Test set 500 câu, regression CI |
| **Metric** | Wrong-intent rate < 1% trên test set, < 3% production |

### R7: Simulation snapshot stale → user apply phương án không còn đúng

| | |
|---|---|
| **Xác suất** | Trung bình |
| **Tác động** | Trung bình — phương án sai lệch nhỏ |
| **Giảm thiểu** | 1. Simulation TTL 5 phút 2. Apply → re-validate trước khi tạo Approval Card 3. Hiển thị rõ "snapshot lúc HH:MM" 4. Refresh button trong card |

### R8: Trust Escalator promote sai → AI auto thay vì human approve

| | |
|---|---|
| **Xác suất** | Thấp — đã có safeguard |
| **Tác động** | Cao nếu xảy ra |
| **Giảm thiểu** | 1. Promotion KHÔNG tự động — chỉ suggest 2. Admin/BGĐ approve cuối cùng 3. Demote tự động khi rollback > 5% (an toàn hơn promote) 4. Quarterly audit toàn bộ Tier 3 actions |

---

## 14. ACCEPTANCE CRITERIA — system-level

Blueprint §9 giữ. v2.0 thêm 5 metric cho 3 layer mới:

| Metric | Target Q3/2026 |
|---|---|
| Intent parser top-1 accuracy | > 85% |
| Intent disambiguation rate | < 15% |
| Simulation usage rate (dispatcher) | > 50% trip approvals |
| Trust Escalator promotion suggestion accuracy | > 90% (admin agree) |
| AI suggestion → action conversion rate | > 35% (cao hơn baseline 40% vì có simulation tăng trust) |

---

## 15. ANTI-PATTERN — DANH SÁCH KHÔNG LÀM

Tài liệu world-class không chỉ nói nên làm gì — phải nói rõ KHÔNG làm gì.

| ❌ Anti-pattern | Lý do |
|---|---|
| Chatbot generic ngang qua mọi role | Mơ hồ, không actionable. Dùng role copilot + intent execution |
| AI tự execute action có write impact mà không approve | Vi phạm Axiom 1 |
| Gửi raw NPP/giá/tồn lên cloud | Vi phạm Axiom 2 |
| Card AI không có "Vì sao?" | Vi phạm Axiom 3 |
| Auto-promote Tier 2→3 không qua human | Vi phạm Axiom 1 |
| Voice command auto-execute không confirm | Risk cao, sai 1 lần mất trust mãi |
| Vision auto-submit form từ ảnh | Tương tự voice |
| Hide AI confidence khỏi user | User không thể calibrate trust |
| AI quyết định lương/HR/blacklist NPP | Quyết định kinh doanh phải human |
| Embedding model không A/B test trước khi commit | Technical debt ẩn |
| Free-form intent parsing (không whitelist) | R6 risk |
| Simulation không có TTL | R7 risk |

---

## 16. KẾT LUẬN

**v2.0 = Blueprint Hybrid-Edge (depth) + Intent/Simulation/Trust Loop (UX paradigm v1.0 còn thiếu) + Anti-pattern + 7 axiom.**

Engineering team có thể bắt tay build từ Sprint 1 dựa trên tài liệu này:
- ✅ Model name + version cụ thể
- ✅ RAM allocation + lazy loading + monitoring alert
- ✅ Privacy Router với decision flowchart + test plan
- ✅ Cost forecast 12 tháng
- ✅ Sprint effort theo person-day
- ✅ Graceful degradation chain
- ✅ 8 risks với mitigation
- ✅ Component contract (Explainability)
- ✅ Schema bổ sung (inbox_items, simulations, ai_audit_log)
- ✅ Anti-pattern explicit

3 đóng góp v2.0 vượt Blueprint:
1. **Intent Layer** — Cmd+K không chỉ navigate mà execute/simulate
2. **Simulation Layer** — preview trade-off với 5 use case cụ thể
3. **Trust Loop** — promotion/demotion suggestion với safeguard human-final

Đây là điểm BHL có thể vượt mặt bằng SaaS thông thường, vì vận hành B2B logistics có ngữ cảnh quyết định rõ ràng — AI có dữ liệu để đề xuất chất lượng cao, và UX có thể dày hơn vì user là power user trong domain.

---

*v2.0 — 26/04/2026. Living document. Cập nhật mỗi sprint dựa trên telemetry + UAT.*
