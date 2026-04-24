# CHIẾN LƯỢC TEST BẰNG AI — BHL OMS-TMS-WMS

> **Phiên bản:** v1.0 — 23/04/2026  
> **Đối tượng:** Người không có kỹ thuật, dùng AI làm công cụ test chính  
> **Mục tiêu:** Đảm bảo chất lượng go-live mà không cần đội QA chuyên nghiệp

---

## TẠI SAO TEST CHỈ DỰA VÀO TÀI LIỆU LÀ KHÔNG ĐỦ

### Bằng chứng từ dự án này

| | TST Document (v1.0) | Code thực tế hôm nay |
|---|---|---|
| Cơ sở | BRD v2.0 | BRD v3.2 |
| Endpoints | ~50 ước tính | 160+ thực tế |
| Frontend pages | ~20 | 44 |
| UAT items | 13 | 25+ |
| **Tính năng thiếu trong TST** | Cost Engine, Bàn giao A/B/C, Dynamic RBAC, Document Expiry, 4-Layer Notification, Redelivery flow, Control Tower, Ops & Audit | — |

**Kết luận:** ~40% tính năng đã code KHÔNG có trong TST. Test theo tài liệu sẽ bỏ qua phần lớn code thực tế.

### Nguyên tắc vàng

> **"Test case phải đọc từ CODE — không phải từ spec."**
> Code là sự thật duy nhất. Spec là mô tả ý định, không phải thực tế.

---

## CHIẾN LƯỢC 5 TẦNG (AI-FIRST)

```
╔═══════════════════════════════════════════════════╗
║  Tầng 5: UX/UI Visual AI      Playwright + AI     ║  ← Nhìn như người dùng
║  Tầng 4: E2E Scenarios        Test Portal + AI     ║  ← Luồng nghiệp vụ
║  Tầng 3: API Contract         Bruno/Postman + AI   ║  ← Đọc từ code
║  Tầng 2: Business Rules       Go test + AI         ║  ← State machines
║  Tầng 1: Unit Logic           Go test hiện có      ║  ← Hàm tính toán
╚═══════════════════════════════════════════════════╝
```

**Quan trọng:** Với người non-tech, ưu tiên **Tầng 4 và Tầng 5** trước — đây là những gì user nhìn thấy. Tầng 1-3 là "lưới an toàn phía sau" để AI tự kiểm tra.

---

## TẦNG 1 — UNIT TESTS (Hiện có nhưng thiếu)

### Trạng thái hiện tại
- `oms/service_test.go`: Order number format, cutoff time logic ✅
- `tms/service_test.go`: Trip state machine transitions ✅
- `wms/service_test.go`: Gate check pass/fail ✅
- **Thiếu:** Reconciliation, Cost Engine, Credit calculation, FEFO sort, RBAC permission guard

### AI làm gì ở tầng này

Khi AI được yêu cầu code feature mới → **ngay sau đó** AI tự generate và chạy unit test cho hàm business logic:

```
Ví dụ: Sau khi viết hàm calculateTollCost() trong VRP solver
→ AI tạo test: toll = 0 khi avoid_toll=true, toll > 0 khi có trạm trên tuyến
→ Chạy: go test ./... (< 30 giây)
→ Confirm pass trước khi báo "xong"
```

### Bổ sung cần làm (theo code thực tế)

| File cần thêm test | Hàm cần test | Business rule |
|---|---|---|
| `reconciliation/service_test.go` | `autoReconcile()` — 3 loại | BR-REC-01: goods/payment/asset |
| `oms/credit_test.go` | Credit threshold check | R03: pending_approval khi vượt limit |
| `wms/fefo_test.go` | FEFO sort by expiry | R09: oldest lot first |
| `tms/cost_test.go` | Haversine toll proximity | Cost Engine: 500m threshold |
| `auth/permission_test.go` | PermissionGuard cache | Dynamic RBAC: Redis TTL 300s |

---

## TẦNG 2 — BUSINESS RULE TESTS (State Machine)

### State machines trong CODE (không phải spec)

**Order Status Flow (thực tế):**
```
new → pending_customer_confirm → confirmed → in_transit → 
    delivered / partially_delivered / failed
              ↓
         pending_approval (khi vượt credit limit)
              ↓
         approved → confirmed
```

**Trip Stop Flow (thực tế — TST thiếu bước "delivering"):**
```
pending → arrived → delivering → delivered
                             ↘ failed / skip
```

**Redelivery Flow (MỚI Session 22/03 — TST không có):**
```
partially_delivered → [tạo shipment mới] → confirmed → in_transit → ...
failed → [tạo shipment mới] → confirmed → in_transit → ...
```

### Test cases từ code (không phải từ spec)

| Test | Đọc từ | Assert |
|---|---|---|
| Order: Zalo flow pending_customer_confirm → confirmed | `oms/service.go` CreateOrder | status=pending_customer_confirm khi Zalo enabled |
| Order: Auto-confirm sau 2h nếu KH không phản hồi | `oms/service.go` cron | status=confirmed, event=auto_confirmed |
| Stop: "delivering" là trạng thái bắt buộc trước delivered | `tms/service.go` UpdateStop | 400 nếu skip arrived→delivering→delivered |
| Redelivery: chỉ allowed từ partially_delivered/failed | `oms/service.go` CreateRedelivery | 400 nếu từ delivered hoặc cancelled |
| ePOD: server enforce ≥ 1 photo | `tms/handler.go` SubmitEPOD | 400 nếu no photos |
| Trip complete: partially_delivered stop được chấp nhận | `tms/service.go` CompleteTrip | trip → completed dù có stop partially_delivered |

---

## TẦNG 3 — API CONTRACT TESTS (AI đọc từ code)

### Phương pháp: AI audit tự động

Thay vì viết test case bằng tay, dùng quy trình sau:

**Bước 1:** AI đọc tất cả handler files → liệt kê endpoint thực tế
```
internal/oms/handler.go      → 18 endpoints
internal/tms/handler.go      → 50+ endpoints
internal/wms/handler.go      → 24 endpoints
internal/integration/handler.go → 19 endpoints
internal/reconciliation/handler.go → 11 endpoints
internal/notification/handler.go → 6 endpoints
internal/kpi/handler.go      → 5 endpoints
internal/gps/handler.go      → 3 endpoints + WS
internal/admin/handler.go    → 30 endpoints
internal/testportal/handler.go → 24 endpoints
```
**Tổng: 190+ endpoints cần test**

**Bước 2:** AI sinh Bruno collection (hoặc Postman) tự động, 1 request per endpoint với:
- Happy path (200/201)
- Missing required fields (400)
- Wrong role (403)
- Not found (404)

**Bước 3:** Chạy collection qua CI (Bruno CLI: `bru run ./api-tests/`)

### Tại sao Bruno, không phải Postman

| | Bruno | Postman |
|---|---|---|
| Storage | File .bru trong git | Cloud/proprietary |
| AI-friendly | AI có thể đọc/viết .bru file | Khó |
| Offline | Luôn offline | Cần cloud sync |
| Chi phí | Miễn phí | Có gói trả phí |

### RBAC test matrix (AI sinh từ code)

AI đọc `internal/middleware/permission_guard.go` → sinh matrix test:

| Endpoint | admin | dispatcher | driver | warehouse | accountant | dvkh | security | management |
|---|---|---|---|---|---|---|---|---|
| POST /orders | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| GET /planning/vrp | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| POST /reconciliation/:id/resolve | ✅ | ❌ | ❌ | ❌ | ✅* | ❌ | ❌ | ❌ |
| DELETE /admin/users/:id | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

> *is_chief_accountant flag required

---

## TẦNG 4 — E2E SCENARIOS (Test Portal mở rộng)

### Hiện có: 12 scenarios + 7 GPS profiles

Test Portal ở `http://localhost:3001/test-portal` đã có 12 kịch bản. Đây là tài sản quan trọng nhất dự án.

### Vấn đề hiện tại

Test Portal **chạy kịch bản** nhưng **không tự assert kết quả**. Người test phải nhìn màn hình và tự phán đoán "đúng/sai". Với AI-first testing, cần thêm **auto-assertion**.

### Kế hoạch mở rộng Test Portal

#### Thêm "Assertion Layer" vào mỗi scenario

```go
// Hiện tại: chạy xong, không kiểm tra
func (h *Handler) RunScenario(c *gin.Context) {
    // ... seed data, run actions
    c.JSON(200, gin.H{"status": "ok"})
}

// Cần: sau khi chạy, verify expected state
type ScenarioAssert struct {
    Description string
    Query       string  // SQL query
    Expected    interface{}
    Pass        bool
    Actual      interface{}
}

// SC-01 assertions:
assert: orders WHERE status='delivered' COUNT = 8  → PASS/FAIL
assert: reconciliation_records COUNT >= 1          → PASS/FAIL
assert: entity_events WHERE event_type='order.delivered' COUNT = 8 → PASS/FAIL
```

#### 5 scenarios cần bổ sung (chưa có)

| SC | Tên | Mô tả | Assertion chính |
|---|---|---|---|
| SC-13 | Document Expiry Flow | Tạo vehicle/driver doc hết hạn trong 3 ngày → cron chạy → notification | Notification exists với category=document_expiry |
| SC-14 | Bàn giao A/B/C | WMS handover create → sign A → sign B → sign C | handovers.status = 'signed_c' |
| SC-15 | Dynamic RBAC | Admin revoke permission → user gọi API → 403 → admin restore → 200 | HTTP status sequence = 200, 403, 200 |
| SC-16 | Cost Engine VRP | Chạy VRP với toll stations → check cost breakdown | cost_breakdown.toll_cost_vnd > 0 |
| SC-17 | Redelivery Chain | Giao hàng thiếu → tạo redelivery → giao đủ | order.re_delivery_count = 1, final status = delivered |

#### Smoke Test Button (quan trọng nhất cho non-tech)

Thêm button **"Chạy tất cả smoke tests"** ở đầu Test Portal:

```
┌─────────────────────────────────────────────────────┐
│  🤖 SMOKE TEST  [▶ Chạy tất cả]  Lần chạy cuối: 22/04 14:30  │
├─────────────────────────────────────────────────────┤
│  ✅ SC-01 Happy Path          8/8 assertions pass    │
│  ✅ SC-02 Credit Exceed       3/3 assertions pass    │
│  ❌ SC-07 Gate Check Fail     2/3 assertions (FAIL: gate_check_result != 'fail') │
│  ✅ SC-08 Reconciliation      4/4 assertions pass    │
│  ...                                                  │
├─────────────────────────────────────────────────────┤
│  TỔNG KẾT: 11/17 scenarios pass  ⚠️ 1 FAIL cần fix  │
└─────────────────────────────────────────────────────╝
```

Khi nào dùng:
- **Trước mỗi go-live:** Chạy smoke test, tất cả xanh mới deploy
- **Sau mỗi code change lớn:** Chạy trong 5 phút để kiểm tra regression
- **Hàng ngày trên staging:** Tự động chạy lúc 7:00 sáng

---

## TẦNG 5 — UX/UI TESTING (AI Visual Testing)

> Đây là tầng khó nhất và lo lắng nhất của người non-tech. Không thể chỉ test API — user experience là điều user cảm nhận.

### Cách tiếp cận: Playwright + AI Screenshot

#### Công cụ: Playwright (Microsoft, miễn phí)

```
Playwright là gì?
→ Bot dùng trình duyệt Chrome/Firefox như người dùng thật
→ Click nút, nhập form, chụp screenshot
→ AI so sánh screenshot "trước" vs "sau" để phát hiện UI break
→ Không cần code — có thể record bằng cách click thật, Playwright tự ghi lại script
```

#### Test UX theo từng ROLE (quan trọng nhất)

Hệ thống có **9 roles** → mỗi role có UX riêng biệt → test từng role:

**Role 1: Dispatcher (dispatcher01)**
```
Test path: Login → Dashboard → Tạo đơn → Chạy VRP → Duyệt kế hoạch → Control Tower
Assertions:
  - Dashboard: 5 widget hiển thị (orders today, trips, delivery rate, revenue, discrepancies)
  - VRP: kết quả hiện trong < 60s, có bản đồ + chuyến xe
  - Control Tower: ít nhất 1 xe marker trên bản đồ khi GPS đang chạy
Screenshots so sánh: Lưu lần đầu làm "baseline", mỗi lần sau diff vs baseline
```

**Role 2: Driver (driver01) — Mobile UX**
```
Test path: Login → My Trips → Start Trip → Update Stop (arrived/delivering/delivered) → ePOD photo → Payment → Complete
Assertions:
  - Progress bar hiển thị đúng % (1/3 = 33%)
  - ePOD: yêu cầu photo, không submit được khi thiếu
  - Payment: total amount đúng
  - Nút "Google Maps" navigation hoạt động
```

**Role 3: Warehouse Handler (thukho_hl01)**
```
Test path: Login → Picking by Vehicle → Gate Check → Scan barcode
Assertions:
  - Picking by Vehicle: hiện đúng danh sách xe theo ngày
  - Gate check: scan đúng → màu xanh, sai → màu đỏ + cảnh báo
```

**Role 4: Accountant (accountant01)**
```
Test path: Login → Pending Approvals → Duyệt đơn vượt credit → Daily Close
Assertions:
  - Pending approvals: hiện đúng số đơn chờ duyệt
  - Sau duyệt: đơn biến mất khỏi queue
  - Daily close: sum đúng số tiền
```

#### Visual Regression Testing — Phát hiện UI break

Playwright chụp screenshot của mỗi page, so sánh với baseline:

```
Baseline (lần đầu): lưu vào ./tests/screenshots/baseline/
Mỗi lần test sau: chụp mới → diff pixel với baseline
Nếu diff > 5%: FAIL — có gì đó thay đổi trong UI
```

Đặc biệt hữu ích để phát hiện:
- Responsive break: trang bị vỡ layout trên màn hình nhỏ
- CSS conflict: cập nhật Tailwind làm hỏng style cũ
- Text overflow: text tiếng Việt dài không wrap đúng
- Color mismatch: dùng màu sai (brand #F68634 vs warning #D97706)

#### Checklist UX không cần automation

Một số UX cần mắt người (hoặc AI multimodal) để phán đoán:

| Check | Cách test | Người/AI |
|---|---|---|
| Màu sắc đúng brand (#F68634 cho BHL, không dùng lẫn amber warning) | Screenshot + AI nhận diện màu | AI |
| Text tiếng Việt đọc được, không bị cắt | Screenshot + review | AI |
| Loading state không bị trắng màn hình | Throttle network 3G, chụp screenshot | AI |
| Toast notification đủ thời gian đọc (6s) | Video record | Người |
| Notification dropdown không tràn sang màn hình khác | Resize browser | Playwright |
| Mobile: nút đủ lớn để chạm (≥ 44px) | Playwright `evaluate` check kích thước | Playwright + AI |

---

## KẾ HOẠCH TRIỂN KHAI (Trước Go-live 15/05/2026)

### Tuần 1 (23/04 - 30/04): Nền móng

| Task | Ai làm | Output |
|---|---|---|
| AI đọc tất cả handler files → tạo Bruno API collection | AI | `tests/api/` folder với 190+ test files |
| Thêm assertion layer vào SC-01..SC-12 trong Test Portal | AI code, non-tech verify | Smoke test button hoạt động |
| Setup Playwright + ghi lại 4 critical user journeys | AI setup, non-tech record flows | `tests/e2e/` folder |
| Chạy `go test ./...` → xác định test nào đang fail | AI + non-tech chạy | Test report baseline |

### Tuần 2 (01/05 - 07/05): Bổ sung coverage

| Task | Ai làm | Output |
|---|---|---|
| Viết unit tests cho Reconciliation, Cost Engine, FEFO | AI | 5 file *_test.go mới |
| Thêm SC-13..SC-17 vào Test Portal | AI | 5 scenarios mới với assertions |
| Playwright: visual baseline screenshots cho 9 roles | AI + non-tech verify | `screenshots/baseline/` |
| API RBAC test matrix — test 9 roles × top 20 endpoints | AI | `tests/api/rbac/` |

### Tuần 3 (08/05 - 14/05): Go-live Verification

| Task | Ai làm | Output |
|---|---|---|
| Chạy full smoke test suite → tất cả xanh | AI + non-tech | ✅ hoặc danh sách lỗi cần fix |
| Playwright E2E: 9 role flows pass | Playwright CI | Tất cả screenshots match baseline |
| Load test: k6 với 30 concurrent users | AI + terminal | P95 < 2s |
| Security: gosec scan Go code | AI | 0 critical/high issues |
| UAT checklist 13 items: non-tech click-through | Non-tech với hướng dẫn bước | 13/13 ✅ |

### Go-live Gate (15/05/2026)

```
CHỈ go-live khi tất cả:
□ Smoke test: 17/17 scenarios PASS
□ Playwright E2E: 9/9 role flows PASS
□ API RBAC: 0 escalation vulnerabilities
□ Performance: P95 < 2s với 30 VUs
□ UAT: 13/13 items signed off
□ ENABLE_TEST_PORTAL=false trên production
□ go test ./... có 0 failures
```

---

## CÔNG CỤ AI DÙNG ĐỂ TEST (Thực tế)

### 1. AI đọc code → sinh test cases

**Workflow:** Mỗi khi thêm tính năng mới:
```
Non-tech: "AI ơi, vừa code xong feature X, hãy đọc code và tạo test"
AI: Đọc service.go + handler.go → viết test cases + chạy
Không cần non-tech hiểu code
```

### 2. AI review screenshot UX

**Workflow:** Playwright chụp screenshot → AI review:
```
Non-tech: [upload screenshot] "AI ơi, màn hình này có vấn đề gì không?"
AI: Phân tích layout, màu sắc, text, button sizes
Phát hiện: "Cột 'Tổng tiền' bị truncate trên mobile"
```

### 3. AI làm "adversarial tester"

**Workflow:** AI cố tình làm những việc user không nên làm:
```
AI test: Gọi API giao hàng cho trip chưa start → expect 400
AI test: Tạo đơn với credit_limit=0 → expect pending_approval
AI test: Driver gọi endpoint của dispatcher → expect 403
AI test: Duplicate order submission (race condition) → expect 1 order, not 2
```

### 4. Claude/ChatGPT đọc code → tìm bugs

**Workflow:** Upload file service.go → yêu cầu AI phân tích:
```
Prompt: "Đây là code service OMS của tôi. Hãy tìm:
1. Race conditions (concurrent order creation)
2. Logic lỗi trong credit check
3. Edge cases chưa handle
4. Security issues (OWASP Top 10)"
```

### 5. AI chạy UAT scenarios theo script

**Workflow:** AI được cấp test account → tự click theo kịch bản:
```
AI dùng Playwright → login → thực hiện 13 UAT scenarios
→ Tự báo cáo: SC-07 Gate Check FAIL, screenshot đính kèm
Non-tech: chỉ cần đọc báo cáo, không cần tự test
```

---

## ĐẶC BIỆT: TEST UX/UI CHO NGƯỜI NON-TECH

### Checklist UX nhanh (30 phút/lần, không cần technical)

Trước mỗi release, non-tech chạy checklist này bằng cách click thật:

**Màn hình Dispatcher (10 phút):**
- [ ] Login với dispatcher01/demo123 → thấy dashboard đầy đủ?
- [ ] Tạo 1 đơn hàng test → đơn xuất hiện trong list?
- [ ] Chạy VRP → kết quả hiện bản đồ có các chuyến?
- [ ] Mở Control Tower → bản đồ load được?
- [ ] Notification bell → có icon số chưa đọc?

**Màn hình Driver mobile (10 phút, dùng điện thoại):**
- [ ] Login với driver01/demo123 → thấy chuyến xe?
- [ ] Bấm "Bắt đầu chuyến" → status thay đổi?
- [ ] Bấm vào điểm giao → thấy thông tin NPP?
- [ ] Chụp ảnh ePOD → ảnh upload được?
- [ ] Nhập tiền thu → số tiền đúng định dạng?

**Màn hình Warehouse (10 phút):**
- [ ] Login với thukho_hl01/demo123 → thấy picking list?
- [ ] Mở Gate Check → camera scan được barcode?
- [ ] Phân loại vỏ → nút submit hoạt động?

**Nếu bất kỳ bước nào FAIL → chụp screenshot → gửi cho AI fix**

### AI phân tích UX từ screenshot

Công cụ: Upload screenshot vào Claude/ChatGPT, hỏi:
1. "Layout trang này có chuẩn không? Có gì lệch không?"
2. "Text có bị cắt hoặc overflow không?"
3. "Màu sắc có nhất quán không? Brand color #F68634 có đúng không?"
4. "Trên mobile, các nút có đủ lớn không? (phải ≥ 44px)"
5. "Thông tin quan trọng nhất có nằm ở vị trí dễ nhìn không?"

---

## PHÂN LOẠI LỖI (Để ưu tiên fix)

| Mức | Định nghĩa | Ví dụ | Hành động |
|---|---|---|---|
| **P0 — Blocker** | Mất data, crash, security breach | Credit tính sai số tiền, float64 thay vì Decimal | Fix ngay, không go-live |
| **P1 — Critical** | Luồng chính không chạy được | Không tạo được đơn hàng, VRP không chạy | Fix trước go-live |
| **P2 — Major** | Feature quan trọng bị hỏng | Gate check không scan được, ePOD không upload | Fix trước go-live |
| **P3 — Minor** | UX xấu, không tiện nhưng vẫn dùng được | Tooltip sai text, icon lệch vài px | Fix trong sprint tiếp theo |
| **P4 — Cosmetic** | Chỉ ảnh hưởng thẩm mỹ | Màu sắc hơi khác, font không chuẩn | Backlog |

---

## CẬP NHẬT TST_BHL_OMS_TMS_WMS.md

File TST hiện tại (v1.0 dựa vào BRD v2.0) cần cập nhật toàn bộ. Xem mục riêng trong TST_UPDATES.md.

**Các section cần bổ sung vào TST:**

1. **Unit Tests** — Thêm 5 module mới: Reconciliation, Cost Engine, FEFO, RBAC, Redelivery
2. **E2E Tests** — Cập nhật: SC-01..SC-17 (thêm SC-13..SC-17)
3. **State Machine Tests** — Cập nhật đúng flow: Zalo confirm, delivering intermediate step
4. **UAT Checklist** — Bổ sung: UAT-14 (Cost Engine), UAT-15 (Bàn giao A/B/C), UAT-16 (Dynamic RBAC)
5. **UX Test Checklist** — 9 role flows, mobile checklist

---

## TÓM TẮT CHO NON-TECH

### Bạn cần làm gì?

1. **Hàng ngày:** Double-click `START_TEST_PORTAL.bat` → bấm "Chạy smoke tests" → xem kết quả
2. **Trước mỗi release:** Chạy UX checklist 30 phút (click thật)
3. **Khi AI code xong feature:** Nhắc AI "hãy test ngay feature này" → xem AI tự test
4. **Khi có vấn đề:** Chụp screenshot → hỏi AI "cái này có bình thường không?"

### AI làm gì?

1. Đọc code → sinh test cases tự động
2. Chạy unit tests sau mỗi thay đổi
3. Kiểm tra API đúng status code, đúng RBAC
4. Phân tích UX từ screenshot
5. Báo cáo P0/P1 issues trước khi bạn nhìn thấy

### Không cần lo lắng về điều gì?

- Bạn **không cần biết code** để test — AI làm thay
- Bạn **không cần Postman/Bruno** để test API — AI tự gọi
- Bạn **không cần đọc logs** để tìm lỗi — AI đọc và tóm tắt
- Bạn **không cần thuê QA team** cho coverage cơ bản — Test Portal + Playwright đủ

---

*Tài liệu này được tạo bởi AI dựa trên phân tích code thực tế ngày 23/04/2026*
