# AQF 4.2 — QA Portal mới cho BHL OMS-TMS-WMS
> **Cập nhật:** 2026-04-27  
> **Go-live:** 15/05/2026
> **Người đọc:** Solo founder / vibe coding  
> **Mục tiêu:** Mở một màn hình là nhìn được hệ thống có ship được không, test đang chạy tới đâu, lỗi nằm ở gate nào, và tuyệt đối không xóa dữ liệu lịch sử.

> **Blueprint bổ sung:** `docs/BHL_TEST_DEMO_BLUEPRINT_2026-04-27.md` là nguồn bắt buộc cho GPS route-real, AI actionability, report scope và demo/test matrix đầy đủ theo BRD.

---

## 1. Quyết định mới: bỏ Test Portal cũ

**Test Portal cũ bị loại bỏ khỏi trải nghiệm chính.** Nó từng hữu ích cho UAT thủ công, nhưng không còn phù hợp khi DB đã có dữ liệu lịch sử và dự án cần AQF có evidence, automation, monitoring.

Từ 26/04/2026:

| Thành phần | Trạng thái mới | Lý do |
|---|---|---|
| UI 10 tab cũ ở `/test-portal` | **Đã bỏ khỏi frontend** | Quá giống tool thao tác dữ liệu, không phải QA command center |
| `POST /v1/test-portal/reset-data` | **Đã tắt** | Delete rộng transactional data, nguy hiểm với DB có history |
| `POST /v1/test-portal/load-scenario` | **Đã tắt** | Đang reset toàn bộ rồi seed lại, không có scenario ownership |
| `POST /v1/test-portal/run-scenario` | **Đã tắt** | Tạo dữ liệu không gắn run scope rõ ràng |
| `POST /v1/test-portal/run-all-smoke` | **Đã tắt** | Chạy tuần tự bằng reset rộng |
| AQF Command Center | **Giữ và nâng cấp thành QA Portal v2** | Có Decision Brief, Golden, Health, Evidence, Open Questions |
| Demo Scenario Panel | **Đã thêm bản scoped** | 4 kịch bản demo khách hàng, có load/cleanup theo ownership |
| `/v1/test-portal/*` | **Đã khóa login** | JWT + role `admin`/`management`, user demo `qa.demo` |

Các endpoint đọc dữ liệu cũ có thể tạm tồn tại để debug, nhưng không còn là UX chính. Mọi luồng tạo/nạp/xóa dữ liệu test mới phải đi qua **scenario ownership model** ở mục 3.

---

## 2. QA Portal v2 — tư duy tổng thể

QA Portal mới không phải nơi “bấm tạo dữ liệu test cho vui”. Nó là **decision interface** của AQF:

```
QA Portal v2
├── Decision Brief        → SHIP / CAUTION / HOLD + confidence
├── Gate Timeline         → G0/G1/G2/G3/G4 đang chạy, pass/fail ở đâu
├── Scenario Runs         → mỗi kịch bản có run_id, progress, evidence
├── Data Safety Panel     → xác nhận không đụng dữ liệu lịch sử
├── Golden & Property     → credit, FEFO, state machine, RBAC, VRP, recon
├── Playwright Journeys   → login, order lifecycle, credit, gate check
├── API/RBAC Matrix       → Bruno collections
├── Observability         → Sentry, Clarity, health, logs
├── Alerts                → Telegram summary + blocker
└── Evidence Log          → lịch sử chạy, artifacts, link report
```

### Màn hình chính cần đạt

```
┌────────────────────────────────────────────────────────────────────┐
│ BHL QA PORTAL                                    26/04/2026 14:30   │
├────────────────────────────────────────────────────────────────────┤
│ DECISION BRIEF                                                      │
│ SHIP / CAUTION / HOLD     Confidence 0-100     Evidence ID          │
│ G0 Build  G1 Fast  G2 Domain  G3 E2E  G4 Production                 │
├────────────────────────────────────────────────────────────────────┤
│ RUN PROGRESS                                                        │
│ 1. Golden datasets      PASS 6/6                                    │
│ 2. Scenario SC-01       running step 4/8                            │
│ 3. Playwright journeys  queued                                      │
│ 4. Bruno RBAC           pass 36/36                                  │
├───────────────────────────────┬────────────────────────────────────┤
│ DATA SAFETY                   │ OBSERVABILITY                      │
│ Last purge scope: SC-01 run42 │ Sentry errors 24h: 0               │
│ Historical rows touched: 0    │ Clarity sessions: link/manual      │
│ Owned rows deleted: 128       │ Telegram: last sent 07:00          │
├───────────────────────────────┴────────────────────────────────────┤
│ BLOCKERS / OPEN QUESTIONS                                           │
│ Q-BHL-002 Offline queue strategy unresolved → HOLD if go-live       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 3. Data safety: không xóa dữ liệu lịch sử

### Nguyên tắc bất biến

1. **Không được `TRUNCATE` bảng nghiệp vụ** trong QA Portal.
2. **Không được `DELETE FROM sales_orders` hoặc bảng transactional mà không có scenario ownership filter.**
3. Mọi dữ liệu do test tạo phải có `scenario_run_id` hoặc được ghi vào registry `qa_owned_entities`.
4. Cleanup chỉ được xóa dữ liệu thuộc run cũ của chính scenario đó.
5. Master/historical data thật là read-only fixture: customers, products, warehouses, vehicles, historical orders, historical trips.

### Mô hình ownership bắt buộc

Thêm layer QA metadata, không refactor bảng nghiệp vụ cũ ngay:

```sql
qa_scenario_runs(
  id uuid primary key,
  scenario_id text not null,
  status text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  evidence_id text,
  created_by text default 'qa-portal'
)

qa_owned_entities(
  run_id uuid references qa_scenario_runs(id),
  entity_type text not null,
  entity_id uuid not null,
  created_at timestamptz not null default now(),
  primary key(run_id, entity_type, entity_id)
)
```

Nếu bảng có `notes`, `metadata`, `external_ref`, hoặc `order_number/trip_number`, vẫn phải ghi vào registry. Prefix naming chỉ là phụ trợ, ví dụ `QA-SC01-20260426-001`, không phải cơ chế an toàn chính.

### Cleanup algorithm mới

```
LoadScenario(SC-01):
  1. tạo qa_scenario_runs run mới
  2. tìm các run cũ của SC-01 ở trạng thái completed/failed
  3. lấy qa_owned_entities của các run đó
  4. delete theo graph phụ thuộc, chỉ entity_id trong registry
  5. seed dữ liệu mới
  6. mỗi insert ghi registry ngay trong transaction
  7. chạy assertions
  8. lưu evidence
```

### Kiểm soát chống xóa nhầm

Trước khi commit transaction cleanup, QA runner phải tính:

| Check | Điều kiện pass |
|---|---|
| Historical rows touched | `0` |
| Delete without registry | `0` |
| Master tables modified | `0` |
| Rows deleted by scenario | Có số lượng cụ thể, hiển thị trong portal |
| Stock mutation | Chỉ qua stock_moves owned hoặc snapshot/restore scoped |

Nếu bất kỳ check nào fail → transaction rollback và Decision Brief chuyển `HOLD`.

---

## 4. Kịch bản test mới theo AQF

Kịch bản mới chia thành 4 nhóm, không còn thiết kế kiểu “load data rồi tự nhìn tab”.

### Nhóm A — Domain invariants không cần seed lớn

| ID | Tên | Mục tiêu | Data strategy |
|---|---|---|---|
| G-CREDIT | Credit limit | Vượt hạn mức phải pending approval | Golden JSON + unit/property test |
| G-FEFO | FEFO allocation | Lô hết hạn sớm xuất trước | Golden JSON + isolated stock fixture |
| G-STATE | Order/trip state | Cấm transition sai | Golden JSON, không cần DB thật |
| G-RBAC | 9 roles | Không role nào vượt quyền | Permissions matrix + Bruno |
| G-COST | Cost engine | Fuel/toll/base cost đúng | Golden JSON + Go tests |
| G-RECON | Reconciliation | Idempotent, không duplicate | Golden JSON + scoped DB run |

### Nhóm B — Scenario DB có seed nhưng phải scoped

| ID | Tên | Seed tối thiểu | Assertions chính |
|---|---|---|---|
| SC-01 | Happy Path OMS→TMS→WMS→Recon | 2-3 orders, 1 trip, 2 stops | order created, shipment, trip, recon |
| SC-02 | Credit exceed | 1 NPP test-owned ledger entry | pending_approval, event recorded |
| SC-03 | ATP fail | 1 stock snapshot owned | insufficient, reserved không vượt quantity |
| SC-04 | Customer reject | 1 order confirmation token | cancelled/rejected chain đầy đủ |
| SC-05 | Dispatch/VRP | 8-12 shipments, 2-3 vehicles | all assigned or explicit unassigned |
| SC-06 | Driver flow | 1 trip, 3 stops | arrived→delivering→delivered/failed |
| SC-07 | Gate check fail | 1 picking/gate fixture | variance creates blocker |
| SC-08 | Reconciliation discrepancy | 1 completed trip | discrepancy + T+1 deadline |
| SC-09 | VRP stress | synthetic orders owned by run | capacity, route time, unassigned correctness |
| SC-10 | Historical read-only day | dùng data lịch sử thật | chỉ đọc, không mutate |
| SC-11 | Control Tower GPS | trips active thật hoặc owned | Redis GPS only, cleanup Redis keys scoped |
| SC-12 | Ops & Audit regression | scoped DLQ/KPI/recon rows | timeline, notes, DLQ, KPI visible |
| SC-18 | GPS route-real/anomaly | active trips owned + OSRM geometry | route geometry source không phải đường chim bay, anomaly mở đúng |
| SC-19 | AI actionability | AI inbox/brief/outreach owned | CTA route/draft/ack hoạt động, explainability rõ |
| SC-20 | Report scope | snapshots + historical read-only | date scope/data-as-of đúng, historical mode explicit |

**Demo scenario update 27/04/2026:** QA Portal scoped runner có thêm `DEMO-HIST-01` (historical read-only replay, chỉ ghi owned evidence event, không mutate business history), nâng `DEMO-03` từ 3 đơn lên historical-calibrated dispatch data (tối thiểu 24 orders, nhiều trips/stops), `DEMO-DISPATCH-01` (owned live ops theo busiest historical day, ~80% xe/lái xe active, cap 40 trips, driver check-ins scoped, NPP có tọa độ) và `DEMO-AI-DISPATCH-01` (live ops + AI Inbox/Brief/Simulation cho điều phối viên). Cleanup vẫn đi qua `qa_owned_entities`; invariant `historical_rows_touched = 0` giữ nguyên.

**Audit note 27/04/2026:** SC-13..17 hiện cần rà lại data safety trước khi xem là go-live-ready. Mọi scenario cập nhật master/historical rows trực tiếp phải chuyển sang fixture owned hoặc read-only assertion; không được update xe/đơn/lô thật để tạo trạng thái test.

### Nhóm C — Product experience

| ID | Tool | Đang có | Theo dõi ở đâu |
|---|---|---|---|
| PW-01 | Playwright | `tests/e2e/login.spec.ts` | GitHub Actions G3 artifact |
| PW-02 | Playwright | `tests/e2e/order-lifecycle.spec.ts` | report + trace on fail |
| PW-03 | Playwright | `tests/e2e/credit-check.spec.ts` | report + screenshot |
| PW-04 | Playwright | `tests/e2e/gate-check.spec.ts` | report + AQF evidence |

### Nhóm D — Production watch

| ID | Tool | Mục tiêu | Theo dõi |
|---|---|---|---|
| G4-HEALTH | GitHub Actions/curl | `/v1/health` HTTP 200 | `.github/workflows/aqf-g4.yml` |
| G4-AQF | GitHub Actions/curl | AQF status đọc được | workflow summary |
| G4-SENTRY | Sentry | error rate, panic, replay | sentry.io project |
| G4-CLARITY | Microsoft Clarity | session recording UX thật | clarity.ms project |
| G4-TELEGRAM | Bot alert | daily smoke/blocker | Telegram chat |

---

## 5. Hệ thống theo dõi QA hiện có ở đâu

### Playwright

| Thành phần | File / vị trí | Cách theo dõi |
|---|---|---|
| Dependency | `bhl-oms/web/package.json` (`@playwright/test`) | `npm run test:e2e` |
| Config | `bhl-oms/tests/e2e/playwright.config.ts` | Chromium, trace on retry, screenshot on failure |
| Test files | `bhl-oms/tests/e2e/*.spec.ts` | login, order lifecycle, credit, gate check |
| CI gate | `bhl-oms/.github/workflows/aqf-g3.yml` | upload `playwright-report`, `test-results` traces |

Điểm còn thiếu: QA Portal chưa ingest trực tiếp Playwright artifact về Evidence Log. Cần thêm bước CI ghi summary JSON vào `aqf/evidence/` hoặc endpoint `/v1/test-portal/aqf/evidence/import`.

### Microsoft Clarity

| Thành phần | File / vị trí | Cách theo dõi |
|---|---|---|
| Client component | `bhl-oms/web/src/components/ClarityClient.tsx` | Chỉ load khi user consent và hostname là `bhl.symper.us` |
| Layout hook | `bhl-oms/web/src/app/layout.tsx` | Component được mount global |
| Project ID | `NEXT_PUBLIC_CLARITY_ID`, fallback hiện có | Xem session tại clarity.ms |

Clarity là UX/session recording, không phải test runner. QA Portal chỉ nên hiển thị trạng thái “đã gắn/chưa gắn” và link mở dashboard, không kéo raw recording về DB.

### Sentry

| Thành phần | File / vị trí | Cách theo dõi |
|---|---|---|
| Backend Go | `bhl-oms/cmd/server/main.go` + `internal/config/config.go` | `SENTRY_DSN`, sentrygin captures panic |
| Frontend Next.js | `bhl-oms/web/sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` | errors, traces, replay |
| Deploy env | `bhl-oms/docker-compose.prod.yml`, `deploy-mac.sh` | DSN truyền vào runtime |

Điểm cần sửa sau: DSN frontend đang hardcode trong config. Nên đổi sang env var trước go-live để tránh leak và dễ đổi project.

### Telegram

| Thành phần | File / vị trí | Cách theo dõi |
|---|---|---|
| AQF config | `bhl-oms/aqf/aqf.config.yml` | `decision_brief.delivery: [qa_portal, telegram]` |
| Env cần có | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Secret trên server/GitHub Actions |
| Hiện trạng workflow | Chưa thấy job workflow gửi Telegram thật | Cần thêm notify step vào G3/G4 |

Telegram nên nhận bản tóm tắt, không nhận log dài:

```
BHL AQF 07:00
Verdict: CAUTION 80/100
G0 PASS · G1 PASS · G2 PASS · G3 SKIP · G4 PASS
Blocker: Q-BHL-002 Offline queue unresolved
Evidence: 20260426-070000-a1b2c3d4
```

### GitHub Actions AQF

| Gate | Workflow | Vai trò |
|---|---|---|
| G1 | `bhl-oms/.github/workflows/aqf-g1.yml` | fast confidence, lint/test/security |
| G2 | `bhl-oms/.github/workflows/aqf-g2.yml` | domain/golden/business rules |
| G3 | `bhl-oms/.github/workflows/aqf-g3.yml` | Playwright E2E, mobile, accessibility |
| G4 | `bhl-oms/.github/workflows/aqf-g4.yml` | daily/post-deploy health + golden drift |
| Weekly | `bhl-oms/.github/workflows/aqf-weekly.yml` | coverage/KPI cadence |

---

## 6. API mới cần hướng tới

Các API hiện có `/v1/test-portal/aqf/*` là nền. API mới nên đổi tên tư duy sang QA Portal nhưng có thể giữ path để tránh vỡ frontend:

| Endpoint | Mục tiêu |
|---|---|
| `GET /v1/test-portal/aqf/status` | Full snapshot: brief, gates, golden, health, evidence, questions |
| `POST /v1/test-portal/aqf/run` | Chạy AQF không seed dữ liệu nguy hiểm |
| `GET /v1/test-portal/aqf/evidence` | Lịch sử evidence |
| `GET /v1/test-portal/aqf/health` | Business health |
| `GET /v1/test-portal/aqf/questions` | Open questions |
| `POST /v1/test-portal/aqf/answer` | Trả lời open question |
| `GET /v1/test-portal/demo-scenarios` | Danh sách kịch bản demo scoped |
| `GET /v1/test-portal/demo-runs` | Run history + data safety counters |
| `POST /v1/test-portal/demo-scenarios/:id/load` | Cleanup run cũ cùng scenario + seed data mới trong transaction |
| `POST /v1/test-portal/demo-scenarios/:id/cleanup` | Cleanup scoped, không đụng history |
| `POST /v1/test-portal/qa/evidence/import` | CI upload Playwright/Bruno/Sentry summary |

---

## 7. Thứ tự triển khai tiếp theo

### P0 — Data safety trước mọi scenario DB

1. ✅ Thêm migration `qa_scenario_runs`, `qa_owned_entities` (`041_qa_demo_portal`).
2. ✅ Viết scoped runner dùng transaction + registry (`demo_service.go`, `demo_repository.go`).
3. ✅ Thêm 4 demo scenario scoped: DEMO-01..04.
4. ✅ Giữ disabled các legacy destructive endpoints.
5. ✅ Thêm Data Safety Panel vào QA Portal.

### P1 — Nhìn thấy quá trình chạy

1. Thêm run progress state: queued/running/asserting/saving_evidence/completed/failed.
2. Stream progress qua polling hoặc WebSocket nhẹ.
3. Evidence log lưu artifact pointers: Playwright report, Bruno JSON, GitHub run URL.
4. Gate Timeline hiển thị G0-G4 theo thời gian.

### P2 — Monitoring wiring

1. G3/G4 gửi Telegram khi fail hoặc daily 07:00.
2. G4 query Sentry API để lấy error count 24h nếu có token.
3. QA Portal hiển thị Clarity/Sentry configured status.
4. Đổi frontend Sentry DSN hardcode sang env var.

---

## 8. Checklist go-live QA

- [ ] Legacy reset/load/run endpoints không còn xóa rộng.
- [ ] Scenario DB runner chỉ cleanup `qa_owned_entities`.
- [ ] Historical rows touched = 0 được hiển thị trong mỗi run.
- [ ] Playwright 4 journeys chạy qua G3 và artifact xem được.
- [ ] Bruno RBAC/API matrix chạy qua G2/G3.
- [ ] Sentry backend/frontend nhận lỗi test thật.
- [ ] Clarity chỉ load trên production domain sau consent.
- [ ] Telegram gửi Daily Smoke 07:00 và fail alert.
- [ ] Decision Brief đạt `SHIP >= 85` hoặc blocker được chấp nhận bằng quyết định rõ ràng.

---

## 9. Quy tắc AQF bắt buộc cho vibe code

Mục này là guardrail cho mọi phiên AI/vibe coding. Nếu code thay đổi mà không đi qua checklist này thì chưa được coi là xong.

### 9.1 Trước khi code

1. Xác định thay đổi thuộc gate nào:
  - **G0:** compile/lint/typecheck/smoke nhanh.
  - **G1:** fast tests cho module liên quan.
  - **G2:** domain/golden/API/RBAC/data safety.
  - **G3:** Playwright/E2E/customer journey.
  - **G4:** production health, monitoring, alert.
2. Nếu task đụng test/demo/scenario data, phải thiết kế ownership trước khi viết code: `qa_scenario_runs` + `qa_owned_entities` hoặc cơ chế tương đương được document.
3. Nếu task đụng business rule, state machine, tiền, tồn kho, công nợ, reconciliation, RBAC hoặc integration, phải xác định test/evidence đi kèm ngay từ đầu.
4. Nếu task chỉ sửa docs, vẫn phải kiểm tra docs không mâu thuẫn với AQF hiện tại.

### 9.2 Trong khi code

1. Một feature nhỏ → code → verify ngay → rồi mới chuyển feature tiếp theo.
2. Không batch nhiều endpoint/page rồi test cuối phiên.
3. Không phục hồi hoặc gọi lại flow legacy destructive:
  - `POST /v1/test-portal/reset-data`
  - `POST /v1/test-portal/load-scenario`
  - `POST /v1/test-portal/run-scenario`
  - `POST /v1/test-portal/run-all-smoke`
4. Không thêm SQL test data dùng `TRUNCATE` hoặc unscoped `DELETE` trên bảng nghiệp vụ.
5. Nếu thêm scenario DB, seed và registry phải nằm trong cùng transaction; cleanup run cũ phải chạy theo entity registry.

### 9.3 Sau khi code

AI phải báo rõ:

| Nội dung | Bắt buộc báo |
|---|---|
| Gate đã chạy | G0/G1/G2/G3/G4 pass/skip |
| Test cụ thể | command, endpoint, page URL, hoặc artifact |
| Data safety | `historical_rows_touched = 0` nếu có scenario/test data mutation |
| Evidence | evidence_id/artifact path/GitHub run URL nếu có |
| Docs sync | files đã cập nhật hoặc lý do không cần |
| Residual risk | blocker/open question còn lại |

### 9.4 Definition of Done cho AQF-sensitive task

Một task được xem là xong khi thỏa tất cả điều kiện áp dụng:

- Code compile/build/lint/typecheck phù hợp phạm vi.
- Endpoint/page/flow đã được gọi hoặc load thực tế.
- Business invariant có test/golden/API assertion.
- QA/test data có ownership registry và cleanup scoped.
- Data Safety Panel hoặc API counters xác nhận không chạm history.
- `CURRENT_STATE.md`, `TASK_TRACKER.md`, `CHANGELOG.md`, `TST_BHL_OMS_TMS_WMS.md`, `AQF_BHL_SETUP.md` được cập nhật nếu behavior/test/AQF thay đổi.
- Nếu gate skip, báo rõ vì sao và còn rủi ro gì.
