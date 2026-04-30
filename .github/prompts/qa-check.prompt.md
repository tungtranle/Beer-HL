---
description: "QA Check: Run quality gates for BHL project before commit, merge, or deploy. Use when checking if code is ready for next stage."
name: "QA Check"
argument-hint: "Gate level: --pre-commit | --pre-merge | --pre-deploy"
agent: "agent"
tools: [execute, read, search]
---

# BHL QA Check — Quality Gates

Chạy quality gates cho BHL OMS-TMS-WMS. Báo cáo bằng tiếng Việt với ✅/❌.

Gate level từ argument: **$ARGUMENTS**

Luôn đọc `AQF_BHL_SETUP.md` trước khi kết luận. QA Check phải báo rõ gate AQF G0/G1/G2/G3/G4 pass/skip và không được gọi legacy destructive endpoints của Test Portal.

---

## Nếu argument = `--pre-commit` (< 30 giây)

Chạy nhanh trước mỗi lần commit code mới. Chỉ check những thứ chạy instant.

**Gate 1: Không có silent error mới**
```powershell
$silentCatch = Select-String -Path "bhl-oms/web/src/**/*.ts","bhl-oms/web/src/**/*.tsx" -Pattern "\.catch\(console\.error\)" -Recurse
if ($silentCatch) { 
    Write-Host "❌ FAIL: Tìm thấy .catch(console.error)" 
    $silentCatch | Select-Object Filename, LineNumber, Line
} else { 
    Write-Host "✅ PASS: Không có silent error" 
}
```

**Gate 2: Không có parseFloat/parseInt cho tiền**
```powershell
$floatMoney = Select-String -Path "bhl-oms/web/src/**/*.tsx" -Pattern "parseFloat|parseInt" -Recurse | 
    Where-Object { $_.Line -match "price|amount|total|payment" }
if ($floatMoney) {
    Write-Host "❌ FAIL: Tìm thấy parseFloat/parseInt cho tiền"
    $floatMoney | Select-Object Filename, LineNumber, Line
} else {
    Write-Host "✅ PASS: Tiền dùng safeParseVND"
}
```

**Gate 3: safeParseVND tồn tại (nếu đang dùng tiền)**
```powershell
if (Test-Path "bhl-oms/web/src/lib/safeParseVND.ts") {
    Write-Host "✅ PASS: safeParseVND.ts tồn tại"
} else {
    Write-Host "⚠️  WARN: safeParseVND.ts chưa có — cần tạo trước khi xử lý tiền"
}
```

Báo cáo: "X/3 gates pass. [Action nếu có fail]"

**Gate 3b: AQF data safety guardrail**
```powershell
$unsafeSql = Select-String -Path "bhl-oms/internal/**/*.go","bhl-oms/migrations/*.sql" -Pattern "TRUNCATE|DELETE FROM sales_orders|DELETE FROM trips|DELETE FROM shipments|DELETE FROM stock_moves" -Recurse
if ($unsafeSql) {
    Write-Host "⚠️  REVIEW: Có SQL xóa dữ liệu nghiệp vụ. Phải xác nhận có ownership filter qa_owned_entities trước khi pass."
    $unsafeSql | Select-Object Filename, LineNumber, Line
} else {
    Write-Host "✅ PASS: Không thấy destructive SQL phổ biến"
}
```

---

## Nếu argument = `--pre-merge` (< 5 phút)

Chạy trước khi merge PR hoặc sau khi hoàn thành 1 feature lớn.

**Bao gồm tất cả pre-commit gates, plus:**

**Gate 4A: AQF scoped scenario safety**
- Nếu thay đổi đụng QA Portal/scenario/test data: gọi scoped endpoint `POST /v1/test-portal/demo-scenarios/:id/load` và cleanup tương ứng.
- Pass criteria: response có `historical_rows_touched = 0`; không dùng `reset-data`, `load-scenario`, `run-scenario`, `run-all-smoke` legacy.

**Gate 4: Go unit tests**
```powershell
Set-Location bhl-oms
$env:DB_URL = "postgres://bhl:bhl_dev@localhost:5434/bhl_dev?sslmode=disable"
$env:REDIS_URL = "redis://localhost:6379/0"
go test ./internal/... -timeout 60s 2>&1
```
Báo: bao nhiêu tests pass, fail nào.

**Gate 5: Business rules 5/5**
```powershell
# Chỉ chạy nếu Bruno CLI đã cài (bru command available)
if (Get-Command bru -ErrorAction SilentlyContinue) {
    bru run bhl-oms/tests/api/business-rules/ --env local 2>&1
} else {
    Write-Host "⚠️  WARN: Bruno CLI chưa cài. Chạy: npm i -g @usebruno/cli"
}
```

**Gate 6: Không có TODO/FIXME critical còn sót**
```powershell
$criticalTodos = Select-String -Path "bhl-oms/internal/**/*.go" -Pattern "TODO.*CRITICAL|FIXME.*CRITICAL|HACK.*" -Recurse
if ($criticalTodos) { Write-Host "⚠️  WARN: $($criticalTodos.Count) critical TODO còn lại" }
```

Báo cáo tổng: "X/6 gates pass."

---

## Nếu argument = `--pre-deploy` (< 20 phút)

Chạy trước khi go-live hoặc deploy production. **Đây là check nghiêm ngặt nhất.**

### GATE A — Critical gaps đã fix

Chạy lại tất cả pre-commit + pre-merge gates.

Kiểm tra thêm:
- LH-03: `grep ".catch(console.error)" web/src/app/dashboard/orders/new/page.tsx` → phải = 0
- LH-04: `grep "queueOfflineRequest" web/src/app/dashboard/driver/[id]/page.tsx` → phải ≥ 3 kết quả (3 hàm)
- LH-02: `safeParseVND.ts` tồn tại + được import trong orders/new, products, driver/[id]

Kết quả GATE A: ✅ hoặc ❌ (nếu ❌ → STOP, không làm tiếp)

### GATE B — E2E 3 luồng chính

```powershell
if (Get-Command npx -ErrorAction SilentlyContinue) {
    Set-Location bhl-oms
    npx playwright test tests/e2e/e2e-1-dispatcher-create-order.spec.ts `
                        tests/e2e/e2e-2-warehouse-gate-check.spec.ts `
                        tests/e2e/e2e-3-driver-complete-trip.spec.ts `
                        --reporter=list 2>&1
} else {
    Write-Host "⚠️  WARN: Playwright chưa cài. Skip E2E gate."
}
```

Nếu Playwright chưa setup: báo "GATE B SKIP — cần setup Playwright trước go-live".

Nhắc nhở test thủ công bắt buộc:
```
👤 CẦN NGƯỜI LÀM (không thể tự động):
□ Offline driver test: tắt 4G → bấm arrived → bật lại → verify DB
□ ePOD photo upload trên điện thoại Android thật
□ Số tiền FE hiển thị khớp BE trong 3 đơn random
```

### GATE C — Production readiness

**Security scan:**
```powershell
if (Get-Command gosec -ErrorAction SilentlyContinue) {
    gosec -severity high -confidence medium ./bhl-oms/... 2>&1
}
# npm audit
Set-Location bhl-oms/web
npm audit --audit-level=high 2>&1
```

**Test Portal phải tắt trên production:**
```powershell
$prodEnv = Get-Content "bhl-oms/.env.production" -ErrorAction SilentlyContinue
if ($prodEnv -match "ENABLE_TEST_PORTAL=true") {
    Write-Host "❌ CRITICAL: ENABLE_TEST_PORTAL=true trong .env.production — KHÔNG được deploy!"
} else {
    Write-Host "✅ PASS: Test portal tắt trên production"
}
```

**AQF status production watch:**
```powershell
# Nếu có token/admin session hợp lệ, gọi AQF status và kiểm tra verdict/confidence/blockers.
# Nếu không có token, báo SKIP kèm lý do, không được coi là PASS.
```

**Microsoft Clarity đã gắn:**
```powershell
$clarity = Select-String -Path "bhl-oms/web/src/app/layout.tsx" -Pattern "clarity"
if ($clarity) { Write-Host "✅ PASS: Clarity script có trong layout" }
else { Write-Host "⚠️  WARN: Clarity chưa gắn — mất session recording sau go-live" }
```

**Telegram synthetic monitoring:**
```powershell
if ($env:TELEGRAM_BOT_TOKEN) { Write-Host "✅ PASS: Telegram bot token có" }
else { Write-Host "⚠️  WARN: TELEGRAM_BOT_TOKEN chưa set — không có alert khi lỗi" }
```

---

## Báo cáo cuối --pre-deploy

```
╔════════════════════════════════════════════════════════╗
║  BHL PRE-DEPLOY GATE REPORT — [ngày giờ]               ║
╠════════════════════════════════════════════════════════╣
║  GATE A (Critical Fixes):    [✅ PASS / ❌ FAIL]        ║
║  GATE B (E2E 3 journeys):    [✅ PASS / ⚠️ SKIP]        ║
║  GATE C (Production Ready):  [✅ PASS / ❌ FAIL]        ║
╠════════════════════════════════════════════════════════╣
║  VERDICT:                                              ║
║  [✅ SẴN SÀNG GO-LIVE] hoặc                            ║
║  [❌ CHƯA SẴN SÀNG — X vấn đề cần fix trước]           ║
╚════════════════════════════════════════════════════════╝
```

Nếu có fail: liệt kê cụ thể từng vấn đề và đề xuất fix.

Luôn thêm dòng cuối:
`AQF Evidence: [evidence_id/artifact path/GitHub run URL hoặc SKIP + lý do]`
