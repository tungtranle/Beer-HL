---
description: "QA Generator: Generate test files for BHL project. Supports: business-rules, api-inventory, api-contract, rbac-matrix, e2e-journeys, chaos, synthetic. Use when you need to create test files automatically from code."
name: "QA Generate"
argument-hint: "What to generate: business-rules | api-inventory | api-contract | rbac-matrix | e2e-journeys | chaos | synthetic"
agent: "agent"
tools: [read, edit, search, execute]
---

# BHL QA Generator

Tạo test files tự động cho BHL OMS-TMS-WMS. Báo cáo bằng tiếng Việt.

Đọc argument để biết cần tạo gì: **$ARGUMENTS**

---

## Nếu argument = `business-rules`

Tạo 5 file Bruno test bắt buộc. Đọc `bhl-oms/qa-config.yml` để biết expected values.

### R01 — Gate check zero tolerance
Tạo `bhl-oms/tests/api/business-rules/R01-gate-check-zero-tolerance.bru`:
- Endpoint: `POST /v1/gate-check` (đọc handler để xác nhận path chính xác)
- Scenario: submit với số thực ≠ số lệnh
- **Assert bắt buộc**: `status_code == 400` VÀ response body có error message liên quan "zero_tolerance" hoặc "mismatch"
- Thêm pre-request: login lấy token với `thukho_hl01/demo123`

### R08 — Cutoff 16h
Tạo `bhl-oms/tests/api/business-rules/R08-cutoff-16h.bru`:
- Endpoint: `POST /v1/orders`
- Scenario: `delivery_date = ngày hôm nay`, nhưng đọc code để xác nhận hệ thống check timezone nào (`internal/oms/service.go` — tìm hàm cutoff)
- **Assert bắt buộc**: `status_code == 400` VÀ `body.error` chứa "cutoff"
- Ghi comment: "Timezone: xem `oms/service.go` — UTC hay Asia/Ho_Chi_Minh?"

### R15 — Credit limit block
Tạo `bhl-oms/tests/api/business-rules/R15-credit-limit-block.bru`:
- Pre-request: seed NPP với `credit_limit=500000000`, `outstanding=490000000` (gọi test-portal API nếu có)
- Request: `POST /v1/orders` với đơn trị giá 15,000,000
- **⚠️ Assert KHÔNG ĐƯỢC chỉ check status code 201**
- **Assert bắt buộc**: `res.body.data.status == "pending_approval"`

### R18 — Bàn giao C immutable
Tạo `bhl-oms/tests/api/business-rules/R18-handover-c-immutable.bru`:
- Đọc `internal/wms/handler.go` để tìm endpoint sign handover C
- Sequence: GET handover C đã ký → thử PATCH hoặc PUT
- **Assert bắt buộc**: `status_code in [403, 405]`

### C-08 — Duplicate submit prevention
Tạo `bhl-oms/tests/api/business-rules/C08-duplicate-submit.bru`:
- Gửi cùng POST /v1/orders 2 lần gần nhau (dùng Bruno pre-request script)
- **Assert bắt buộc**: response thứ 2 nhận `409` HOẶC cả 2 trả cùng `order_id`
- Note: Bruno không chạy concurrent natively — cần ghi comment "verify manually với k6"

Sau khi tạo xong 5 file, chạy:
```
bru run bhl-oms/tests/api/business-rules/ --env local 2>&1
```
Báo cáo kết quả.

---

## Nếu argument = `api-inventory`

Đọc tất cả handler files, liệt kê endpoints thực tế:

```
bhl-oms/internal/oms/handler.go
bhl-oms/internal/tms/handler.go  
bhl-oms/internal/wms/handler.go
bhl-oms/internal/integration/handler.go
bhl-oms/internal/reconciliation/handler.go
bhl-oms/internal/notification/handler.go
bhl-oms/internal/kpi/handler.go
bhl-oms/internal/gps/handler.go
bhl-oms/internal/admin/handler.go
bhl-oms/internal/auth/handler.go
bhl-oms/internal/testportal/handler.go
```

Tạo file `bhl-oms/tests/api/inventory.json` với format:
```json
{
  "generated": "[ngày hôm nay]",
  "total": 0,
  "endpoints": [
    { "method": "POST", "path": "/v1/orders", "handler": "oms.CreateOrder", "roles": ["dispatcher","admin","dvkh"] }
  ]
}
```

Đọc `middleware.RequireRole(...)` trong từng route để lấy roles.

---

## Nếu argument = `api-contract`

**Chỉ làm 30 critical endpoints** (không phải tất cả — tránh over-engineering).

Đọc `bhl-oms/qa-config.yml` section `critical_endpoints`. Nếu chưa có file này, đọc inventory.json đã tạo ở bước trước và chọn 30 endpoint quan trọng nhất (ưu tiên: POST/PUT/DELETE, financial_impact=true, offline_critical=true).

Với mỗi endpoint, tạo file `.bru` với **4 test case**:
1. Happy path (200/201) — check body value, không chỉ status
2. Missing required field (400)
3. Wrong role (403) — dùng account sai role
4. Not found (404) — nếu có path param `:id`

Lưu vào `bhl-oms/tests/api/contract/[module]/[endpoint-name].bru`

---

## Nếu argument = `rbac-matrix`

Đọc `bhl-oms/internal/middleware/` để tìm permission guard logic.

Tạo `bhl-oms/tests/api/rbac-matrix.csv` với format:
```
endpoint,method,admin,dispatcher,driver,warehouse,accountant,dvkh,security,management,note
/v1/orders,POST,ALLOW,ALLOW,DENY,DENY,DENY,ALLOW,DENY,DENY,
/v1/admin/users/:id,DELETE,ALLOW,DENY,DENY,DENY,DENY,DENY,DENY,DENY,
```

Sau đó tạo Bruno test cho mỗi cell DENY quan trọng (đặc biệt: các endpoint financial_impact=true).

---

## Nếu argument = `e2e-journeys`

Tạo 3 Playwright E2E scripts (chỉ 3 luồng sinh tiền/hàng — không phải 9):

### E2E-1: Dispatcher tạo đơn
Tạo `bhl-oms/tests/e2e/e2e-1-dispatcher-create-order.spec.ts`:
- Login `dispatcher01/demo123`
- Navigate `/dashboard/orders/new`
- Fill form (customer, product, quantity)
- Wait for ATP check to load (không dùng `waitForTimeout`)
- Submit
- **Assert**: URL chuyển sang `/dashboard/orders`, order number xuất hiện, verify DB bằng GET API

### E2E-2: Warehouse gate check
Tạo `bhl-oms/tests/e2e/e2e-2-warehouse-gate-check.spec.ts`:
- Login `thukho_hl01/demo123`
- Navigate gate check page
- Submit gate check pass scenario
- **Assert**: `gate_check_result = 'pass'` trong DB (verify bằng GET API)

### E2E-3: Driver complete trip
Tạo `bhl-oms/tests/e2e/e2e-3-driver-complete-trip.spec.ts`:
- Login `driver70/demo123` — viewport 390×844 (iPhone)
- Navigate trip detail
- Update stop: arrived → delivering → delivered
- Submit ePOD (mock photo upload)
- Submit payment amount
- **Assert**: `stop.status = 'delivered'`, `trip.status = 'completed'`

Quy tắc bắt buộc khi tạo:
- Dùng `data-testid` nếu có, fallback sang `role` selector
- Không bao giờ dùng `waitForTimeout()`
- `retries: 2` trong playwright.config.ts
- Mỗi test phải `beforeEach` gọi test-portal reset

---

## Nếu argument = `chaos`

Tạo 4 chaos test scripts (không cần toxiproxy):

### C-chaos-1: Duplicate submit (Playwright)
File: `bhl-oms/tests/chaos/c1-duplicate-submit.spec.ts`
- Click submit button 2 lần trong 100ms
- Assert: DB chỉ có 1 order

### C-chaos-2: JWT expire mid-submit (Playwright)
File: `bhl-oms/tests/chaos/c2-jwt-expire.spec.ts`  
- `localStorage.removeItem('access_token')` trước khi submit
- Assert: apiFetch tự refresh + submit thành công (không mất form data)

### C-chaos-3: Reload during submit (Playwright)
File: `bhl-oms/tests/chaos/c3-reload-during-submit.spec.ts`
- `page.reload()` ngay sau khi click submit
- Assert: DB không có order rác

### C-chaos-4: Backend down (PowerShell + Playwright)
File: `bhl-oms/tests/chaos/c4-backend-down.ps1` + `c4-verify.spec.ts`
- Script: stop Go server → submit → verify FE hiện error có trace_ref → restart server
- Assert: FE không hiện blank page, error message có trace_id

---

## Nếu argument = `synthetic`

Tạo `bhl-oms/tests/synthetic/synthetic-flows.spec.ts` với 4 flows:

```typescript
// Flow 1: API Health
test('synthetic: api health check', async ({ request }) => {
  const res = await request.get('/v1/health')
  expect(res.status()).toBe(200)
})

// Flow 2: Dispatcher create order  
test('synthetic: dispatcher create order', async ({ page }) => {
  await loginAs(page, 'synthetic_dispatcher', 'demo123')
  // ... minimal happy path
  await expect(page.locator('[data-testid="order-number"]')).toBeVisible({ timeout: 10000 })
})

// Flow 3: Driver update stop
test('synthetic: driver update stop arrived', async ({ page }) => {
  await loginAs(page, 'synthetic_driver', 'demo123')
  // ... find active trip, click arrived
  await expect(page.locator('[data-testid="stop-status"]')).toContainText('arrived')
})

// Flow 4: Warehouse gate check
test('synthetic: warehouse gate check', async ({ page }) => {
  await loginAs(page, 'synthetic_warehouse', 'demo123')
  // ... gate check flow
  await expect(page.locator('[data-testid="gate-result"]')).toBeVisible()
})
```

Tạo kèm `bhl-oms/tests/synthetic/run-synthetic.ps1`:
```powershell
# Chạy mỗi 15 phút bằng Windows Task Scheduler
$result = npx playwright test tests/synthetic/ --reporter=json 2>&1
$failed = ($result | ConvertFrom-Json).stats.unexpected
if ($failed -gt 0) {
    # Telegram alert
    $msg = "⚠️ BHL Synthetic FAIL: $failed flows. Kiểm tra ngay!"
    Invoke-RestMethod -Uri "https://api.telegram.org/bot$env:TELEGRAM_BOT_TOKEN/sendMessage" `
        -Body @{ chat_id=$env:TELEGRAM_CHAT_ID; text=$msg }
}
```

---

## Sau khi tạo file

Luôn kết thúc bằng:
1. Danh sách file đã tạo
2. Lệnh chạy test ngay (nếu môi trường đang up)
3. Câu hỏi nghiệp vụ cần người xác nhận (nếu có assertion không chắc chắn)
