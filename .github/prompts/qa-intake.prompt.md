---
description: "QA Intake: Scan BHL project, verify known gaps (LH-01~04), audit test coverage, report current state. Use when starting a QA session or checking project health."
name: "QA Intake"
argument-hint: "Optional: focus area (e.g. 'gaps', 'coverage', 'endpoints')"
agent: "agent"
tools: [search, read, execute]
---

# BHL QA Intake — Project Health Scan

Thực hiện audit toàn diện project BHL OMS-TMS-WMS. Báo cáo bằng tiếng Việt.

## Bước 1 — Verify 4 lỗ hổng đã biết

Kiểm tra từng lỗ hổng còn tồn tại không bằng cách đọc code thực tế:

### LH-03 (CRITICAL): Silent catch ở ATP + credit
Tìm pattern `.catch(console.error)` trong file tạo đơn:
- `bhl-oms/web/src/app/dashboard/orders/new/page.tsx` dòng ~95, ~144
- Nếu còn: báo "🔴 LH-03 CHƯA FIX"
- Nếu đã fix: xác nhận `handleError` + state `atpStatus/creditStatus` đã có

### LH-04 (CRITICAL): Offline sync vỏ rỗng
Tìm xem `queueOfflineRequest` có được gọi trong driver page không:
- `bhl-oms/web/src/app/dashboard/driver/[id]/page.tsx`
- Tìm: `handleUpdateStop`, `handleSubmitEPOD`, `handlePayment`
- Nếu không có `queueOfflineRequest` trong 3 hàm này: báo "🔴 LH-04 CHƯA FIX"

### LH-02 (HIGH): parseFloat cho tiền
```
grep -n "parseFloat\|parseInt" bhl-oms/web/src/app/dashboard/orders/new/page.tsx
grep -n "parseFloat\|parseInt" bhl-oms/web/src/app/dashboard/products/page.tsx  
grep -n "parseFloat\|parseInt" bhl-oms/web/src/app/dashboard/driver/[id]/page.tsx
```
Kiểm tra `safeParseVND.ts` có tồn tại không: `bhl-oms/web/src/lib/safeParseVND.ts`

### LH-01 (MEDIUM): Form validation
```
grep -rn "zod\|yup\|react-hook-form" bhl-oms/web/src/
```
Nếu 0 kết quả: báo "🟡 LH-01 CHƯA FIX (form chỉ dùng disabled button)"

---

## Bước 2 — Đếm endpoints thực tế

Đọc các file handler và đếm số routes registered:
- `bhl-oms/internal/oms/handler.go`
- `bhl-oms/internal/tms/handler.go`
- `bhl-oms/internal/wms/handler.go`
- `bhl-oms/internal/integration/handler.go`
- `bhl-oms/internal/reconciliation/handler.go`
- `bhl-oms/internal/admin/handler.go`
- `bhl-oms/internal/testportal/handler.go`

Tổng cộng bao nhiêu endpoints? (so sánh với con số 190+ trong AI_TEST_STRATEGY.md)

---

## Bước 3 — Kiểm tra test coverage hiện tại

```
# Đếm file test Go hiện có
Get-ChildItem -Recurse -Filter "*_test.go" bhl-oms/internal/ | Select-Object Name, Directory

# Đếm file Bruno test hiện có  
Get-ChildItem -Recurse -Filter "*.bru" bhl-oms/tests/ 2>$null

# Đếm file Playwright test hiện có
Get-ChildItem -Recurse -Filter "*.spec.ts" bhl-oms/tests/ 2>$null
```

---

## Bước 4 — Kiểm tra 5 business rule tests bắt buộc

Xác nhận các file sau tồn tại trong `bhl-oms/tests/api/business-rules/`:
- `R01-gate-check-zero-tolerance.bru`
- `R08-cutoff-16h.bru`
- `R15-credit-limit-block.bru`
- `R18-handover-c-immutable.bru`
- `C08-duplicate-submit.bru`

---

## Báo cáo cuối

Xuất bảng tóm tắt:

```
╔══════════════════════════════════════════════════════╗
║  BHL QA HEALTH REPORT — [ngày hôm nay]               ║
╠══════════════════════════════════════════════════════╣
║  LỖ HỔNG:                                            ║
║  🔴 LH-03: [ĐÃ FIX / CHƯA FIX]                      ║
║  🔴 LH-04: [ĐÃ FIX / CHƯA FIX]                      ║
║  🟠 LH-02: [ĐÃ FIX / CHƯA FIX]                      ║
║  🟡 LH-01: [ĐÃ FIX / CHƯA FIX]                      ║
╠══════════════════════════════════════════════════════╣
║  ENDPOINTS: [X] thực tế (mục tiêu: 190+)             ║
╠══════════════════════════════════════════════════════╣
║  TEST FILES:                                          ║
║  Go unit tests: [X] files                            ║
║  Bruno tests: [X] files ([Y]/5 business rules)       ║
║  Playwright E2E: [X] files                           ║
╠══════════════════════════════════════════════════════╣
║  VIỆC CẦN LÀM TIẾP THEO (theo priority):             ║
║  1. [task quan trọng nhất]                           ║
║  2. [task tiếp theo]                                 ║
║  3. [task tiếp theo]                                 ║
╚══════════════════════════════════════════════════════╝
```

Kết thúc bằng: "Bạn muốn tôi fix [vấn đề cao nhất] ngay không?"
