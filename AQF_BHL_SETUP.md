# AQF 4.0 — Triển khai cho BHL OMS-TMS-WMS
> **Cập nhật:** 2026-04-26  
> **Go-live:** 15/05/2026 (còn 19 ngày)  
> **Người đọc:** Solo founder / vibe coding  
> **Mục tiêu:** Kiểm soát chất lượng tự động cao nhất, có thể nhìn và cảm nhận được

---

## 1. Đánh giá ý tưởng Test Portal

### Verdict: ✅ ĐÚNG HƯỚNG — và bạn đã có nền tảng rồi

Với dự án BHL cụ thể:
- 190+ endpoints, 9 roles, 3 module phức tạp (OMS/TMS/WMS)
- Solo coder, không đội QA
- Go-live trong 19 ngày
- Đã có `internal/testportal/` với 12 scenarios + 7 GPS profiles

**Test Portal KHÔNG phải thêm complexity** — nó là **AQF Component #8 (Decision Interface)** đã được bạn vô tình xây đúng hướng từ trước. Đây là điểm mạnh lớn nhất của setup BHL.

### Tại sao Test Portal phù hợp với BHL hơn các lựa chọn khác

| Lựa chọn | Phù hợp BHL? | Lý do |
|---|---|---|
| **Test Portal** (hiện tại) | ✅ TỐT NHẤT | Thấy được, tương tác được, không cần đọc log |
| GitHub PR comment | ⚠️ Tốt nhưng không đủ | Bạn code trên nhánh main, ít PR format |
| Slack/Telegram only | ⚠️ Bổ sung | Tốt cho alert, không tốt cho trace/debug |
| Grafana dashboard | ❌ Over-engineer | Quá nặng cho solo dev, thêm 1 service phải maintain |
| Allure Report HTML | ❌ Passive | Phải mở file, không real-time |

**Kết luận:** Test Portal = Decision Interface real-time. Mọi thứ khác là kênh phụ.

---

## 2. Test Portal v2 — Kiến trúc đề xuất

### 2.1 Màn hình chính (1 trang, không scroll nhiều)

```
╔══════════════════════════════════════════════════════════════════════╗
║  🍺 BHL QA PORTAL                           26/04/2026 14:30        ║
╠══════════════════════════════════════════════════════════════════════╣
║                                                                      ║
║  DECISION BRIEF (AQF)                                               ║
║  ┌─────────────────────────────────────────────────────────────┐    ║
║  │  ✅ SHIP  │  Confidence: 88/100  │  Lần chạy: 14:28        │    ║
║  │  G0 ✅  G1 ✅  G2 ✅  G3 ✅  G4 ─                         │    ║
║  └─────────────────────────────────────────────────────────────┘    ║
║                                                                      ║
║  SMOKE TESTS  [▶ Chạy tất cả]  [⟳ Auto-run 07:00]                 ║
║  ┌──────────────────────────────────────────────────────────────┐   ║
║  │ ✅ SC-01 Happy Path 8/8  ✅ SC-02 Credit 3/3  ❌ SC-07 2/3  │   ║
║  │ ✅ SC-08 Recon 4/4       ✅ SC-13 Doc Expiry 2/2             │   ║
║  └──────────────────────────────────────────────────────────────┘   ║
║                                                                      ║
║  RISK RADAR (từ git diff)        OPEN QUESTIONS                     ║
║  🔴 migrations/036 → G2 CRIT    ❓ Q-BHL-002: Offline queue        ║
║  🟡 internal/oms/service.go     → [YES] [NO] [ASK]                 ║
║  🟢 web/src/app/dashboard/      ❓ Q-BHL-003: FEFO tiebreak        ║
║                                  → [YES] [NO] [ASK]                 ║
║                                                                      ║
║  BUSINESS HEALTH (live)                                              ║
║  Orders hôm nay: 42  │  Trips running: 3  │  Recon pending: 0     ║
║  Last deploy: 26/04 09:15  │  Errors (Sentry 24h): 2               ║
╚══════════════════════════════════════════════════════════════════════╝
```

### 2.2 Cấu trúc component cần thêm

```
internal/testportal/
  handler.go          ← đã có (24 endpoints)
  scenarios.go        ← đã có (12 scenarios)
  gps_routes.go       ← đã có
  assertions.go       ← MỚI: assertion engine
  decision_brief.go   ← MỚI: tính confidence + verdict
  risk_monitor.go     ← MỚI: đọc git diff → risk classification
  evidence_store.go   ← MỚI: lưu kết quả test có timestamp
  open_questions.go   ← MỚI: Human-in-the-Loop questions
  golden_runner.go    ← MỚI: chạy aqf/golden/*.json cases

web/src/app/test-portal/
  page.tsx            ← đã có (cần redesign theo layout trên)
  components/
    DecisionBrief.tsx ← MỚI
    SmokeTestGrid.tsx ← MỚI (cải tiến từ hiện tại)
    RiskRadar.tsx     ← MỚI
    OpenQuestions.tsx ← MỚI
    BusinessHealth.tsx← MỚI
    EvidenceLog.tsx   ← MỚI
```

---

## 3. AQF Profile: `oms-tms-wms` cho BHL

Config file đã được tạo tại: `bhl-oms/aqf/aqf.config.yml`

### 3.1 Mapping component AQF → BHL thực tế

| AQF Component | BHL Hiện tại | BHL Cần thêm |
|---|---|---|
| **Project Profiler** | `qa-config.yml` | Cập nhật tự động từ code |
| **Risk Engine** | Manual (bạn nhìn diff) | `aqf/risk-rules.yml` → auto scan |
| **Test Planner** | Manual | Logic chọn gate theo risk |
| **Oracle Engine** | Rải rác trong service_test.go | `aqf/golden/` + assertions.go |
| **Runner Orchestrator** | `go test + Bruno + Test Portal` | Unified runner trong Test Portal |
| **Evidence Store** | Không có | `aqf/evidence/` + timestamps |
| **AI Triage** | Claude/Copilot ad-hoc | AI_LESSONS.md (đã có) |
| **Decision Interface** | Test Portal (không có verdict) | **Test Portal v2 với Decision Brief** |

### 3.2 Files đã tạo

> **Cập nhật 2026-04-26:** Toàn bộ nền tảng AQF đã được cài đặt.

```
bhl-oms/
├── aqf/
│   ├── aqf.config.yml                    ✅ Master config
│   ├── risk-rules.yml                    ✅ BHL-specific risk rules
│   ├── golden/
│   │   ├── credit.cases.json             ✅ Credit limit cases (BR-CRD-01/02)
│   │   ├── inventory-fefo.cases.json     ✅ FEFO allocation cases (INV-FEFO-01)
│   │   ├── permissions.matrix.yml        ✅ 9 roles × endpoints (INV-RBAC-01)
│   │   ├── order-state-machine.cases.json✅ Order state transitions (INV-STATE-01)
│   │   ├── trip-state-machine.cases.json ✅ Trip state machine (8 cases)
│   │   └── cost-engine.cases.json        ✅ VRP cost engine (5 cases)
│   ├── schemas/
│   │   └── evidence.v4.json              ✅ JSON Schema cho CI evidence artifacts
│   └── traceability/
│       └── requirements.yml              ✅ REQ → Test → Golden traceability map
│
├── internal/aqf/                         ✅ NEW Go test package (oracle-first)
│   ├── golden_test.go                    ✅ Golden dataset validation (3 test groups)
│   ├── property_test.go                  ✅ Property-based invariants (10 tests)
│   └── auth_matrix_test.go              ✅ RBAC matrix tests (5 tests)
│
├── .github/
│   ├── workflows/
│   │   ├── aqf-g1.yml                    ✅ G1 PR Fast Confidence (<5 min)
│   │   ├── aqf-g2.yml                    ✅ G2 Domain Gate (critical paths)
│   │   ├── aqf-g3.yml                    ✅ G3 Product Experience (E2E/a11y)
│   │   └── aqf-weekly.yml               ✅ Weekly full scan + KPI
│   ├── CODEOWNERS                        ✅ Protect critical paths
│   └── labeler.yml                       ✅ Auto-label PRs by risk
│
├── scripts/
│   ├── aqf-g0-precommit.sh              ✅ Pre-commit hook (Linux/Mac/Git Bash)
│   ├── install-qa-tools.bat             ✅ Windows QA tools installer
│   └── AQF_G0_CHECK.bat                 ✅ Windows G0 gate check
│
└── web/
    ├── .eslintrc.json                    ✅ ESLint config (Next.js + TypeScript)
    └── package.json                      ✅ Updated: Playwright + ESLint devDeps

⬜ PENDING (priority order):
  aqf/golden/vrp-property.cases.json     — VRP route optimization invariants
  aqf/golden/reconciliation.cases.json   — Reconciliation idempotency cases
  internal/tms/cost_test.go              — Validate cost-engine.cases.json
```

---

## 4. Lộ trình 19 ngày đến Go-live

### 🟥 Tuần 1 (27/04 — 03/05): Nền móng tự động
**Mục tiêu:** Smoke tests tự động assert được, không cần nhìn màn hình

| # | Task | Output | Effort |
|---|---|---|---|
| 1.1 | Thêm `assertions.go` vào testportal: mỗi scenario có assert list | SC-01..SC-12 tự PASS/FAIL | 3h |
| 1.2 | Thêm 5 scenarios còn thiếu (SC-13..SC-17) | 17 scenarios total | 2h |
| 1.3 | Thêm `golden_runner.go`: chạy `aqf/golden/*.json` cases qua DB | Pass/fail cho credit, FEFO, states | 4h |
| 1.4 | Setup Playwright: ghi 4 critical user journeys | `tests/e2e/` folder | 3h |
| 1.5 | Setup Bruno CLI: 190+ endpoints từ handler.go | `tests/api/` folder | 4h |

**Checkpoint tuần 1:** `go test ./...` + Test Portal smoke = đều tự PASS/FAIL, không cần nhìn từng màn hình

---

### 🟧 Tuần 2 (04/05 — 10/05): Test Portal v2 + CI
**Mục tiêu:** Mở Test Portal = nhìn 1 trang biết ngay Ship hay Hold

| # | Task | Output | Effort |
|---|---|---|---|
| 2.1 | Redesign Test Portal frontend: Decision Brief panel | Confidence score visible | 4h |
| 2.2 | Thêm Risk Monitor: đọc git log → map risk rules | "Migration mới → G2 CRITICAL" | 2h |
| 2.3 | Thêm Business Health panel: live metrics từ DB | Orders/trips/recon counts | 2h |
| 2.4 | Thêm Open Questions panel: Q-BHL-001/002/003 | Human trả lời trong UI | 2h |
| 2.5 | GitHub Actions: G0 pre-commit hook | Block commit nếu `go build` fail | 1h |
| 2.6 | GitHub Actions: G1 on push | Auto run `go test` + lint + govulncheck | 2h |
| 2.7 | RBAC matrix test: 9 roles × top 30 endpoints | `tests/api/rbac/` | 3h |

**Checkpoint tuần 2:** Mở `localhost:3001` = thấy ngay "✅ SHIP 88/100" hoặc "⛔ HOLD — xem lý do"

---

### 🟨 Tuần 3 (11/05 — 14/05): Pre-Go-Live Verification
**Mục tiêu:** Tất cả tests xanh trước 15/05

| # | Task | Output | Effort |
|---|---|---|---|
| 3.1 | Full smoke run: 17 scenarios, 0 fail | Go-live clearance | 1h |
| 3.2 | Golden dataset: tất cả cases pass | INV-CREDIT, INV-FEFO, INV-STATE | 2h |
| 3.3 | RBAC matrix: 9 roles × 30 endpoints, 0 wrong permission | Security clearance | 1h |
| 3.4 | Playwright: 4 user journeys pass trên staging | UX clearance | 2h |
| 3.5 | Resolve Open Questions Q-BHL-001/002/003 | Human sign-off | 30min |
| 3.6 | Final Decision Brief: SHIP với confidence ≥ 85 | Green light | 30min |

---

## 5. Test Portal — Kế hoạch implementation cụ thể

### 5.1 Assertion Engine (assertions.go)

```go
// Pattern chuẩn cho mỗi assertion trong Test Portal
type AssertionResult struct {
    ID          string      `json:"id"`
    Description string      `json:"description"`
    Query       string      `json:"query,omitempty"`  // SQL nếu là DB check
    Expected    interface{} `json:"expected"`
    Actual      interface{} `json:"actual"`
    Pass        bool        `json:"pass"`
    Error       string      `json:"error,omitempty"`
}

// Ví dụ assertions cho SC-01 (Happy Path)
var SC01Assertions = []AssertionDef{
    {
        ID:    "SC01-A1",
        Desc:  "8 orders delivered",
        Query: "SELECT COUNT(*) FROM sales_orders WHERE status = 'delivered'",
        ExpectedFn: func(data ScenarioData) interface{} { return 8 },
    },
    {
        ID:    "SC01-A2",
        Desc:  "Reconciliation record tồn tại",
        Query: "SELECT COUNT(*) FROM reconciliation_records WHERE trip_id = $1",
        ExpectedFn: func(data ScenarioData) interface{} { return 1 },
    },
    {
        ID:    "SC01-A3",
        Desc:  "entity_events có order.delivered",
        Query: "SELECT COUNT(*) FROM entity_events WHERE event_type='order.delivered'",
        ExpectedFn: func(data ScenarioData) interface{} { return 8 },
    },
}
```

### 5.2 Decision Brief Engine (decision_brief.go)

```go
// Tính confidence score từ kết quả các gates
type DecisionBrief struct {
    Verdict        string    // "SHIP" | "HOLD" | "SHIP_WITH_WARNING"
    Confidence     int       // 0-100
    BlockingIssues []string  // lý do HOLD
    Warnings       []string  // không block nhưng cần chú ý
    OpenQuestions  []string  // Q-BHL-xxx chưa trả lời
    RunAt          time.Time
}

func calculateConfidence(results []GateResult, openQs []OpenQuestion) DecisionBrief {
    score := 100
    // G2 fail → -30 (critical domain)
    // G1 fail → -20
    // G3 fail → -15
    // Open critical question → -20
    // Warning → -5
    // ...
    if score >= 85 { verdict = "SHIP" }
    else if score >= 60 { verdict = "SHIP_WITH_WARNING" }
    else { verdict = "HOLD" }
}
```

### 5.3 New API endpoints cần thêm vào handler.go

```go
// Thêm vào RegisterRoutes()
tp.GET("/decision-brief", h.GetDecisionBrief)      // Verdict + confidence
tp.POST("/run-all-smoke", h.RunAllSmoke)            // Chạy tất cả 17 scenarios
tp.GET("/risk-monitor", h.GetRiskMonitor)           // Git diff → risk map
tp.GET("/golden-results", h.GetGoldenResults)       // Kết quả golden cases
tp.GET("/open-questions", h.GetOpenQuestions)       // Q-BHL-xxx list
tp.POST("/answer-question", h.AnswerQuestion)       // YES/NO/ASK
tp.GET("/evidence-log", h.GetEvidenceLog)           // Lịch sử test runs
tp.GET("/business-health", h.GetBusinessHealth)     // Live DB metrics
```

---

## 6. Phân tầng kiểm soát chất lượng

### Cái bạn sẽ "nhìn và cảm nhận được"

```
LEVEL 1 — Mỗi khi code (< 60 giây)
  G0: go build + go vet + unit tests của file đang sửa
  → Terminal hiện màu xanh/đỏ ngay

LEVEL 2 — Mỗi khi push (< 5 phút)
  G1: GitHub Actions → lint + test + govulncheck
  → Email/Telegram: ✅ G1 passed hoặc ❌ G1 failed + link

LEVEL 3 — Khi sửa logic nghiệp vụ quan trọng (< 10 phút)
  G2: Golden cases + property tests + state machine tests
  → Test Portal: block "⛔ G2 FAIL — credit test failed"

LEVEL 4 — Trước mỗi deploy (< 15 phút, bấm 1 nút)
  G3: Tất cả 17 scenarios + Playwright 4 journeys + RBAC matrix
  → Test Portal Decision Brief: SHIP ✅ 88/100

LEVEL 5 — Sau deploy (tự động, nền)
  G4: Health endpoint + Sentry error rate + daily smoke 07:00
  → Telegram alert nếu có vấn đề
```

### Điều gì được tự động hoàn toàn vs. cần bạn 30 giây

| Hoàn toàn tự động | Cần bạn 30 giây |
|---|---|
| Unit tests khi code | Đọc Decision Brief trước deploy |
| Lint/typecheck khi push | Trả lời Open Questions (YES/NO) |
| Golden cases sau mỗi G2 trigger | Review Playwright screenshot diff |
| RBAC matrix check | Sign-off go-live |
| Daily smoke 07:00 sáng | Exploratory test feature mới |
| Sentry error rate monitoring | Phán đoán UX/brand |

---

## 7. Telegram Integration (kênh phụ)

Bạn đã có Telegram setup trong dự án. Thêm notification cho AQF:

```
📊 BHL AQF — Daily Smoke 07:00
━━━━━━━━━━━━━━━━━━━━━━━
✅ 16/17 scenarios pass
❌ SC-07 Gate Check: 2/3 assertions
   └ gate_check_result != 'fail' (actual: 'pending')

⚠️ SHIP WITH WARNING (confidence: 72/100)
🔗 localhost:3001/test-portal
```

---

## 8. Thứ tự ưu tiên tuyệt đối (theo go-live deadline)

```
NGAY HÔM NAY:
  1. Fix LH-03 (silent fail ATP/credit) — CRITICAL
  2. Fix LH-04 (offline queue không wire) — CRITICAL
  3. Thêm assertions vào 12 scenarios hiện có

TUẦN NÀY:
  4. Golden cases runner (credit + FEFO + state machine)
  5. Test Portal Decision Brief panel
  6. GitHub Actions G0/G1

2 TUẦN TIẾP:
  7. Playwright 4 critical journeys
  8. Bruno RBAC matrix 9 roles × 30 endpoints
  9. Test Portal v2 hoàn chỉnh

PRE-GO-LIVE CHECK (14/05):
  10. Decision Brief: confidence ≥ 85 = SHIP ✅
```

---

## 9. Files đã tạo trong session này

```
bhl-oms/aqf/
  aqf.config.yml                    AQF master config cho BHL
  risk-rules.yml                    Risk rules BHL-specific (9 rules)
  golden/
    credit.cases.json               6 credit limit test cases
    inventory-fefo.cases.json       5 FEFO allocation test cases
    permissions.matrix.yml          RBAC matrix 9 roles × 9 endpoints
    order-state-machine.cases.json  6 order state transition cases
```

**Bước tiếp theo:** Mở `bhl-oms/aqf/aqf.config.yml` và confirm `TELEGRAM_CHAT_ID` trong `.env` để enable dual-delivery Decision Brief.
