# UXUI_SPEC.md — BHL OMS-TMS-WMS
## UX/UI Specification by User Role

> **Mục đích:** Source of truth cho AI khi implement UI. Đọc file này TRƯỚC khi viết bất kỳ `.tsx` nào.
> **Cập nhật:** 21/03/2026
> **Nguồn màu sắc:** UXUI.md (file gốc từ khách hàng BHL)
> **Lưu ý DEC-005:** Dự án dùng Tailwind CSS — KHÔNG dùng Ant Design components.
>   UXUI.md đề cập Ant Design Grid/Icons nhưng đã được thay thế bằng Tailwind (xem DEC-005).
>   Chỉ giữ lại từ UXUI.md: màu sắc, typography, spacing.

---

## 0. Design System — Nguồn gốc từ UXUI.md

### 0.1 Brand Color — BẮT BUỘC

```
Brand Primary: rgb(246, 134, 52)   ← Màu cam đặc trưng BHL
Hex tương đương: #F68634
```

**Quy tắc dùng brand color (từ UXUI.md §5):**
- Dùng cho **primary action buttons** — nút submit chính, CTA quan trọng nhất
- Dùng cho **active states** — tab đang chọn, item đang active
- Dùng cho **highlighting** — badge quan trọng, số liệu nổi bật
- **KHÔNG vượt quá 10%** diện tích visual mỗi màn hình

**Thêm vào `tailwind.config.js`:**
```js
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F68634',
          50:  '#FEF3E8',
          100: '#FDE0C4',
          200: '#FBBB7C',
          300: '#F99B3F',
          400: '#F68634',  // ← primary
          500: '#E8720A',
          600: '#C45E07',
          700: '#9A4905',
          800: '#703404',
          900: '#4A2203',
        }
      }
    }
  }
}
```

**Dùng trong Tailwind:**
```tsx
// Primary button
<button className="bg-brand text-white hover:bg-brand-500 px-4 py-2 rounded-lg font-medium">
  Tạo đơn hàng
</button>

// Active tab
<span className="border-b-2 border-brand text-brand-600 font-medium">Tab đang chọn</span>

// Highlight badge nhẹ
<span className="bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full text-xs font-medium">
  Mới
</span>
```

**QUAN TRỌNG — Phân biệt brand color vs semantic warning:**
```
Brand cam rgb(246,134,52) = màu CAM ĐẶC TRƯNG BHL → PRIMARY ACTION, ACTIVE STATE
Amber/yellow               = màu CẢNH BÁO NGHIỆP VỤ → alerts, ATP thấp, deadline sắp tới

Không được dùng lẫn. Brand color ≠ warning color.
```

### 0.2 Neutral Colors — từ UXUI.md §6

```
Background:           #FFFFFF   → bg-white
Secondary Background: #F7F8FA   → bg-gray-50
Border:               #E5E6EB   → border-gray-200
Text Primary:         #1F1F1F   → text-gray-900
Text Secondary:       #595959   → text-gray-500
Disabled:             #BFBFBF   → text-gray-300 / border-gray-300
```

### 0.3 Semantic Colors — từ UXUI.md §6

```
Success: Green  → text-green-700  bg-green-50  border-green-200
Warning: Amber  → text-amber-700  bg-amber-50  border-amber-200
Error:   Red    → text-red-700    bg-red-50    border-red-200
Info:    Blue   → text-blue-700   bg-blue-50   border-blue-200
```

### 0.4 Typography — từ UXUI.md §8

Font: **Roboto** (300 / 400 / 500 / 700) — load từ Google Fonts

```css
/* globals.css */
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap');
body { font-family: 'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
```

```
Page Title:     text-2xl font-medium   (24–28px, weight 500)
Section Title:  text-lg font-medium    (18–20px, weight 500)
Subsection:     text-base              (16px, weight 400)
Body:           text-sm                (14px, weight 400)
Caption/Meta:   text-xs text-gray-500  (12px, weight 400)
```

### 0.5 Spacing — từ UXUI.md §7

```
4px  → p-1 / gap-1
8px  → p-2 / gap-2
12px → p-3 / gap-3
16px → p-4 / gap-4   ← default component gap
24px → p-6 / gap-6   ← default section padding
32px → p-8 / gap-8
48px → p-12 / gap-12
```

### 0.6 Visual Style — từ UXUI.md §12

- Clean và minimal — whitespace là thiết kế
- KHÔNG gradients nặng, KHÔNG drop shadows phức tạp
- Borders: `border border-gray-200` (subtle)
- Cards: `rounded-xl border border-gray-200 bg-white`
- Buttons: `rounded-lg`

---

## 0.7 Color Quick Reference — copy-paste hàng ngày

```tsx
// ── PRIMARY ACTION (brand cam BHL) ──────────────────
"bg-brand text-white hover:bg-brand-500"           // button submit chính
"border-b-2 border-brand text-brand-600"           // active tab
"bg-brand-50 text-brand-700 border-brand-200"      // light badge

// ── SUCCESS / GIAO THÀNH CÔNG ───────────────────────
"text-green-700 bg-green-50 border-green-200"

// ── WARNING / CẢNH BÁO ──────────────────────────────
"text-amber-700 bg-amber-50 border-amber-200"

// ── ERROR / BLOCK / FAIL ────────────────────────────
"text-red-700 bg-red-50 border-red-200"

// ── INFO ────────────────────────────────────────────
"text-blue-700 bg-blue-50 border-blue-200"

// ── NEUTRAL ─────────────────────────────────────────
"bg-white"                         // card background
"bg-gray-50"                       // secondary background
"border-gray-200"                  // default border
"text-gray-900"                    // text primary
"text-gray-500"                    // text secondary
"text-gray-300 border-gray-300"    // disabled
```

---

## 1. DISPATCHER — Dashboard "Cockpit"

**Context:** Desktop 1920px+, quản lý 70 xe, 90% công việc trong 1 màn hình.

**Layout: 3-column**
```
[LEFT 25%] Metrics · Trip list · VRP bar
[CENTER 50%] GPS Map + filter chips
[RIGHT 25%] Alerts + inline CTA · Check-in · Expiry
```

**Color rules:**
```tsx
// Metric cards
ok:      "bg-green-50 text-green-700"
warn:    "bg-amber-50 text-amber-700"
err:     "bg-red-50 text-red-700"
default: "bg-gray-50 text-gray-900"

// VRP button — primary action → brand
"bg-brand text-white hover:bg-brand-500 rounded-lg"

// Trip status dots
in_transit: "bg-green-500"
loading:    "bg-amber-500"
planned:    "bg-gray-400"
anomaly:    "bg-red-500 animate-ping"

// Alert items (border-left accent, KHÔNG dùng brand)
P0: "border-l-2 border-red-500 bg-red-50"
P1: "border-l-2 border-amber-500 bg-amber-50"

// Inline CTA trong alert
emergency:  "bg-red-600 text-white text-xs px-3 py-1.5 rounded"
normal:     "border border-gray-200 text-xs px-3 py-1.5 rounded hover:bg-gray-50"
```

**Key components:**
```tsx
// VRP action bar
<div className="flex gap-2 px-3 pb-3">
  <button className="flex-1 bg-brand text-white text-xs py-2 rounded-lg font-medium hover:bg-brand-500">
    Chạy VRP
  </button>
  <button className="text-xs border border-gray-200 py-2 px-3 rounded-lg hover:bg-gray-50">
    Xem kết quả
  </button>
  <button className="text-xs border border-gray-200 py-2 px-3 rounded-lg hover:bg-gray-50">
    Duyệt kế hoạch
  </button>
</div>

// Alert với inline CTA — không navigate đi đâu
<div className="border-l-2 border-red-500 bg-red-50 p-3 rounded-r-lg">
  <p className="text-sm font-medium text-red-700">{title}</p>
  <p className="text-xs text-red-600 mt-0.5">{subtitle}</p>
  <div className="flex gap-2 mt-2">
    <button className="text-xs bg-red-600 text-white px-3 py-1.5 rounded font-medium">{cta1}</button>
    <button className="text-xs border border-gray-200 px-3 py-1.5 rounded hover:bg-white">{cta2}</button>
  </div>
</div>
```

---

## 2. DVKH — Order Entry "Zero Friction"

**Context:** Nhập đơn điện thoại, ATP phản hồi tức thì, preview Zalo trước khi submit.

**Layout: 2-column** — `[LEFT 60%]` form · `[RIGHT 40%]` preview

**Color rules:**
```tsx
// Submit button chính → brand
"bg-brand text-white hover:bg-brand-500 rounded-xl font-medium"

// Customer credit badge
pct < 80:  "bg-green-50 text-green-700"
pct < 100: "bg-amber-50 text-amber-700"
over:      "bg-red-50 text-red-700"

// ATP bar fill
good:  "bg-green-500"   // > 50% relative
low:   "bg-amber-500"   // 20–50%
empty: "bg-red-500"     // < 20% or 0

// ATP text
good:  "text-green-600 font-medium"
low:   "text-amber-600 font-medium"
empty: "text-red-600 font-medium"

// Qty input khi vượt ATP
normal:  "border border-gray-200"
warning: "border border-amber-400 bg-amber-50"  // đổi NGAY khi gõ

// Flow step active
"bg-brand text-white"   // brand cho step hiện tại
// Flow step pending
"bg-gray-100 text-gray-400 border border-gray-200"
```

**Key components:**
```tsx
// Customer credit card
<div className="bg-white border border-gray-200 rounded-xl p-3 flex justify-between">
  <div>
    <p className="text-sm font-medium text-gray-900">{name}</p>
    <p className="text-xs text-gray-500">{phone}</p>
  </div>
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${creditBadgeColor}`}>
    Dư nợ: {formatVND(debt)} / {formatVND(limit)}
  </span>
</div>

// Submit — text thay đổi theo trạng thái credit
<button className="w-full bg-brand text-white py-3 rounded-xl font-medium hover:bg-brand-500">
  {creditExceeded ? 'Tạo đơn → Chờ duyệt KT' : 'Tạo đơn & gửi Zalo cho NPP'}
</button>

// Zalo preview panel
<div className="bg-green-50 border border-green-200 rounded-xl p-3">
  <div className="flex items-center gap-1.5 mb-2">
    <span className="font-bold text-green-800 text-sm">Z</span>
    <span className="text-xs font-medium text-green-700">Zalo ZNS sẽ gửi</span>
  </div>
  <p className="text-xs text-gray-600">{previewText}</p>
</div>
```

---

## 3. DRIVER — Mobile "Thumb-zone First"

**Context:** Điện thoại 5-6", một tay, ngoài trời, offline thường xuyên.

**Layout:** Mobile full-width, bottom tabs (Chuyến / Bản đồ / Hàng / Tiền)

**BẮT BUỘC:** Tất cả tap targets tối thiểu `h-12` (48px). Action chính `h-14` (56px).

**Color rules:**
```tsx
// Stop header → brand (active, đang thực hiện)
"bg-brand text-white"

// Action chính (Xác nhận hạ hàng) → GREEN
// Xanh = go = an toàn — quen thuộc với tài xế
"bg-green-600 text-white hover:bg-green-700 h-14"

// Secondary actions
"border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 h-10"

// Payment option — selected
"border-2 border-brand bg-brand-50 text-brand-700"
// Payment option — unselected
"border-2 border-gray-200 bg-white text-gray-700"

// Progress bar
"bg-green-500"  // completed stops

// Stop circles
done:    "bg-green-500 text-white"
current: "bg-brand text-white"      // brand cho current stop
next:    "bg-gray-100 text-gray-500 border border-gray-200"

// Offline banner → amber (warning, KHÔNG phải brand)
"bg-amber-500 text-white"
```

**Key components:**
```tsx
// Stop header
<div className="bg-brand text-white p-4">
  <div className="flex justify-between items-start">
    <div>
      <span className="text-4xl font-medium">{stopNumber}</span>
      <p className="font-medium mt-1">{stopName}</p>
    </div>
    <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{n}/{total}</span>
  </div>
  <p className="text-sm text-orange-100 mt-1">{address}</p>
</div>

// Big action button — BẮT BUỘC h-14
<button className="w-full h-14 bg-green-600 text-white text-base font-medium rounded-xl mx-4 mb-3">
  Xác nhận đã hạ hàng
</button>

// Payment option cards
<button className={`p-4 rounded-xl border-2 text-sm font-medium ${
  selected ? 'border-brand bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-700'
}`}>{label}</button>

// Offline banner
{!isOnline && (
  <div className="bg-amber-500 text-white text-center py-2 text-xs font-medium">
    Đang offline — thao tác sẽ đồng bộ khi có mạng
  </div>
)}
```

---

## 4. ACCOUNTANT — Reconciliation "Zero Ambiguity"

**Context:** Desktop cuối ngày, deadline T+1 áp lực.

**Layout: 2-column** — `[LEFT 65%]` table · `[RIGHT 35%]` actions

**Color rules:**
```tsx
// T+1 countdown
> 4h:  "border-gray-300 bg-gray-50 text-gray-700"
2–4h:  "border-amber-500 bg-amber-50 text-amber-700"
< 2h:  "border-red-500 bg-red-50 text-red-700"

// Recon table row — nền đỏ nhạt khi có discrepancy
"bg-red-50"   // row nổi bật ngay

// Column values
matched:     "text-green-600"
discrepancy: "text-red-600 font-medium"
pending_ck:  "text-amber-600 font-medium"

// Approve button
"bg-green-600 text-white text-xs rounded-lg font-medium"

// "Chốt ngày" button (primary action) → brand
"bg-brand text-white rounded-lg font-medium hover:bg-brand-500"
```

**T+1 countdown component:**
```tsx
const T1Countdown = ({ hoursLeft, openCount }: { hoursLeft: number; openCount: number }) => (
  <div className={`border-l-4 rounded-r-lg p-3 mb-3 ${
    hoursLeft < 2 ? 'border-red-500 bg-red-50' :
    hoursLeft < 4 ? 'border-amber-500 bg-amber-50' : 'border-gray-300 bg-gray-50'
  }`}>
    <div className="flex justify-between items-center">
      <div>
        <p className={`text-sm font-medium ${hoursLeft < 2 ? 'text-red-700' : 'text-gray-700'}`}>
          Deadline T+1 hôm nay
        </p>
        <p className="text-xs text-gray-500">{openCount} sai lệch phải đóng</p>
      </div>
      <span className={`text-2xl font-medium tabular-nums ${hoursLeft < 2 ? 'text-red-600' : 'text-gray-700'}`}>
        {Math.floor(hoursLeft)}:{String(Math.round((hoursLeft % 1) * 60)).padStart(2, '0')}
      </span>
    </div>
  </div>
)
```

---

## 5. WAREHOUSE HANDLER — PDA "Scan-First"

**Context:** PDA scanner, kho tối, nhầm FEFO = bug nghiêm trọng, gate check fail = chặn xe ngay.

**PDA rules:** `text-base` minimum, buttons `h-14` minimum, gate fail = full red screen.

**Color rules:**
```tsx
// FEFO "Pick trước" badge → brand color
// Lý do: đây là thông tin QUAN TRỌNG NHẤT trên màn hình picking
"bg-brand text-white px-2.5 py-0.5 rounded-full font-medium text-xs"

// Lot card thông thường
"bg-gray-50 rounded-xl border border-gray-200"

// Lot gần hết hạn (< 7 ngày)
"text-amber-600 font-medium"

// Confirm pick button → brand
"bg-brand text-white w-full h-14 rounded-xl font-medium"

// Gate check PASS → full screen green
"min-h-screen bg-green-600"

// Gate check FAIL → full screen red
"min-h-screen bg-red-600"

// Scan area
"border-2 border-dashed border-green-400 rounded-xl"
```

**Key components:**
```tsx
// FEFO lot card
<div className="bg-gray-50 rounded-xl p-3 mb-3 border border-gray-200">
  <div className="flex justify-between items-center mb-2">
    <span className="font-medium text-sm">{lot.lotNumber}</span>
    {/* Badge quan trọng nhất → brand */}
    <span className="text-xs bg-brand text-white px-2.5 py-0.5 rounded-full font-medium">
      Pick trước (FEFO)
    </span>
  </div>
  {daysLeft < 7 && (
    <p className="text-xs text-amber-600 font-medium mb-2">
      Gần hết hạn ({daysLeft} ngày) — đã ghi audit log
    </p>
  )}
</div>

// Gate check FAIL
if (gateResult === 'fail') return (
  <div className="min-h-screen bg-red-600 flex flex-col items-center justify-center p-6">
    <p className="text-white text-6xl mb-4">✗</p>
    <h1 className="text-2xl font-bold text-white mb-2">Không được xuất cổng</h1>
    <p className="text-red-200 mb-6">Sai lệch {discrepancy} — vi phạm R01</p>
    <button className="w-full py-4 bg-white text-red-600 font-bold rounded-xl text-lg mb-3">
      Gọi điều phối ngay
    </button>
  </div>
)

// Gate check PASS
if (gateResult === 'pass') return (
  <div className="min-h-screen bg-green-600 flex flex-col items-center justify-center p-6">
    <p className="text-white text-6xl mb-4">✓</p>
    <h1 className="text-2xl font-bold text-white mb-2">Cho xe xuất cổng</h1>
    <p className="text-green-100">Kiểm đếm khớp 100% — R01 passed</p>
  </div>
)
```

---

## 6. MANAGEMENT — Executive "5-second View"

**Context:** Không có thời gian đọc dài, cần biết ngay có vấn đề gì không.

**Layout:** 5 KPI cards + 3-column body

**Color rules:**
```tsx
// KPI value — on target
"text-green-600 text-2xl font-medium"
// KPI value — off target
"text-red-600 text-2xl font-medium"
// KPI card ring khi off target
"ring-1 ring-red-300"

// Bar chart — ngày đã hoàn thành
"fill-green-500"
// Bar chart — hôm nay (in progress) → brand color
"fill-brand"

// "Vận hành bình thường" status
"bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm"
// "Có vấn đề" status
"bg-red-50 text-red-700 px-3 py-1 rounded-full text-sm"

// Drill-down / action button → brand
"bg-brand text-white text-xs px-3 py-1.5 rounded-lg hover:bg-brand-500"
```

---

## 7. SECURITY GATE — Decision "Green/Red"

**Context:** 30 giây/quyết định, cần đủ thông tin ngay.

**Color rules:**
```tsx
// Checklist passed
"text-green-600"
// Checklist failed
"text-red-600 font-medium"
// Checklist warning (sắp hết hạn nhưng còn hiệu lực)
"text-amber-600"

// Cho xe đi — GREEN (safety cue, KHÔNG dùng brand)
"bg-green-600 text-white h-14 w-full rounded-xl font-bold text-lg"
// Chặn xe — RED
"bg-red-600 text-white h-14 w-full rounded-xl font-bold text-lg"
```

---

## 8. ADMIN — Configuration Panel

**Color rules:**
```tsx
// Mock mode warning banner — BẮT BUỘC hiển thị nổi bật
"bg-amber-50 border border-amber-300 rounded-xl p-4"

// Toggle ON → brand
"bg-brand"
// Toggle OFF
"bg-gray-300"

// "Lưu cài đặt" button → brand
"bg-brand text-white rounded-lg font-medium hover:bg-brand-500"
```

```tsx
// Mock mode warning
{integrationMockMode && (
  <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
    <p className="text-sm font-medium text-amber-700">Integration Mock Mode đang BẬT</p>
    <p className="text-xs text-amber-600 mt-1">
      Bravo / DMS / Zalo đang dùng mock responses. TẮT trước khi demo với BHL hoặc go-live.
    </p>
  </div>
)}
```

---

## 9b. WORKSHOP (Phân xưởng) — Returnable Assets Classification

**Context:** Nhân viên phân xưởng nhận vỏ trả về từ trips, phân loại tốt/hỏng/mất, đối chiếu với phiếu xuất.  
**Role code:** `workshop` (sub-set quyền warehouse_handler — chỉ thấy returns + asset classification).  
**Layout:** 2-column: bảng vỏ trả về (left 65%) / panel phân loại (right 35%).

**Color rules:**
```tsx
// Vỏ tốt (tái sử dụng)
"bg-green-100 text-green-700"
// Vỏ hỏng (cần sửa)
"bg-amber-100 text-amber-700"
// Vỏ mất/hủy
"bg-red-100 text-red-700"
// Chênh lệch âm (vỏ thiếu)
"text-red-600 font-bold"
// Khớp 100%
"text-green-600 font-bold"

// Nút "Lưu phân loại" → brand
"bg-brand text-white rounded-lg font-medium hover:bg-brand-500"
// Nút "Xác nhận đối chiếu" → brand
"bg-brand text-white h-12 rounded-lg font-medium"
```

**Key components:**
```tsx
// Bảng vỏ trả về — group by trip
<div className="border rounded-xl p-4 mb-3">
  <div className="flex items-center justify-between mb-2">
    <span className="font-semibold">Trip: {trip.code} — {trip.vehicle_plate}</span>
    <span className={trip.variance === 0 ? "text-green-600" : "text-red-600"}>
      {trip.variance === 0 ? "✓ Khớp" : `⚠ Lệch ${trip.variance}`}
    </span>
  </div>
  {/* items table: product, xuất, thu, tốt, hỏng, mất */}
</div>

// Panel phân loại nhanh (right side)
<div className="border rounded-xl p-4 space-y-3">
  <h3 className="font-semibold text-lg">Phân loại vỏ</h3>
  <div className="grid grid-cols-3 gap-2">
    <button className="bg-green-100 text-green-700 h-12 rounded-lg font-medium">Tốt</button>
    <button className="bg-amber-100 text-amber-700 h-12 rounded-lg font-medium">Hỏng</button>
    <button className="bg-red-100 text-red-700 h-12 rounded-lg font-medium">Mất</button>
  </div>
</div>
```

**UX rules:**
- Hiện số vỏ chờ phân loại ở dashboard badge
- Auto-highlight trips có chênh lệch (variance ≠ 0)
- Bắt buộc reason khi phân loại "hỏng" hoặc "mất"
- Empty state: "Không có vỏ chờ phân loại. Kiểm tra lại khi có xe về kho."

---

## 9. Shared Components — Brand color mapping

| Component | Brand dùng không? | Class |
|-----------|-------------------|-------|
| `<PrimaryButton>` | **Có** | `bg-brand text-white hover:bg-brand-500` |
| `<ActiveTab>` | **Có** | `border-b-2 border-brand text-brand-600` |
| `<StopCircle current>` | **Có** | `bg-brand text-white` |
| `<FEFOBadge>` | **Có** | `bg-brand text-white` |
| `<PaymentOption selected>` | **Có** | `border-brand bg-brand-50 text-brand-700` |
| `<Toggle on>` | **Có** | `bg-brand` |
| `<MetricCard>` | Không | green/amber/red semantic only |
| `<StatusBadge>` | Không | green/amber/red semantic only |
| `<ATPBar>` | Không | green/amber/red by level |
| `<T1Countdown>` | Không | gray/amber/red by time |
| `<AlertItem>` | Không | red/amber border-left |
| `<GateCheckResult>` | Không | full green/red screen |

---

## 10. Cross-cutting UX Rules — BẮT BUỘC mọi page

**UX-01: Zero dead ends**
```tsx
// ✅
setError(`${err.message} (Ref: ${traceRef})`)
// ❌
setError('Lỗi hệ thống')
```

**UX-02: Business rule feedback tức thì — KHÔNG cần submit**
```tsx
const handleQtyChange = (val: number) => {
  setInputClass(val > atpQty ? 'border-amber-400 bg-amber-50' : 'border-gray-200')
}
```

**UX-03: Role-aware empty states**
```tsx
const emptyStateText: Record<string, string> = {
  dispatcher:        'Không có shipment chưa xếp — tốt lắm!',
  dvkh:              'Chưa có đơn hàng nào hôm nay',
  driver:            'Chưa có chuyến — liên hệ điều phối',
  warehouse_handler: 'Không có picking task — liên hệ dispatcher',
  accountant:        'Tất cả đối soát đã hoàn tất',
  management:        'Không có cảnh báo — vận hành bình thường',
  security:          'Không có xe đăng ký xuất hôm nay',
}
```

**UX-04: Trace ID luôn có khi lỗi**
```tsx
} catch (err: any) {
  const traceRef = err.serverTraceId || err.traceId || 'unknown'
  setError(`${err.message} (Ref: ${traceRef})`)
}
```

**UX-05: Driver tap targets**
```
Tất cả buttons trong /dashboard/driver/*: tối thiểu h-12
Action chính: h-14 — không được nhỏ hơn
```

---

## 11. Helpers bắt buộc

```typescript
export const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

export const formatVNDCompact = (amount: number) => {
  if (amount >= 1_000_000_000) return `${(amount / 1e9).toFixed(1)}T`
  if (amount >= 1_000_000)     return `${(amount / 1e6).toFixed(0)}M`
  return formatVND(amount)
}

export const formatDate = (date: string | Date) =>
  new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short' }).format(new Date(date))

export const formatDateTime = (date: string | Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeStyle: 'short'
  }).format(new Date(date))
```

---

## 10. Shared Components — Order Detail UX *(MỚI Session 22/03)*

### 10.1 OrderStatusStepper — 5-step progress bar

**Mục đích:** Hiển thị vị trí đơn hàng trong E2E flow. Người dùng nhìn 1 lần là biết đơn đang ở đâu.

**5 bước chính:**
1. Đã tạo đơn (draft, pending_approval, pending_customer_confirm)
2. KH xác nhận (confirmed)
3. Kho xử lý (planned, picking, processing)
4. Đang vận chuyển (loaded, in_transit, gate_checked)
5. Hoàn thành (delivered, partially_delivered, on_credit)

**Color rules:**
```tsx
// Step completed
"bg-green-500 text-white"
// Step current — brand color
"bg-[#F68634] text-white ring-4 ring-orange-100"
// Step pending
"bg-gray-200 text-gray-400"
// Special banners cho trạng thái đặc biệt:
// rejected → "bg-red-50 border-red-200 text-red-700"
// cancelled → "bg-gray-50 border-gray-200 text-gray-700"
// partially_delivered → "bg-amber-50 border-amber-200 text-amber-700"
```

**File:** `web/src/components/OrderStatusStepper.tsx`

### 10.2 OrderTimeline — Lịch sử đơn hàng world-class

**Mục đích:** Audit trail dạng timeline — ai làm gì, lúc nào, chi tiết gì.

**Tính năng:**
- **Nhóm theo ngày:** "Hôm nay", "Hôm qua", dd/mm/yyyy
- **Filter tabs:** Tất cả / Trạng thái / Giao hàng / Ghi chú (có badge count)
- **Summary banner:** Tổng events + khoảng thời gian + duration
- **Duration chips:** "⏱ 15 phút sau" giữa các events
- **Rich detail cards:** Actor role badges, status transition pills (old → new), financial info, redelivery indicators
- **Absolute + relative timestamps:** "15:30:45 22/03/2026" + "5 phút trước"

**Color rules:**
```tsx
// Event category colors
const eventConfig = {
  'order.created': { bg: 'bg-blue-50', ring: 'ring-blue-300', icon: '📝' },
  'order.confirmed_by_customer': { bg: 'bg-green-50', ring: 'ring-green-300', icon: '✅' },
  'order.in_transit': { bg: 'bg-blue-50', ring: 'ring-blue-300', icon: '🚛' },
  'order.status_changed': { bg: 'bg-purple-50', ring: 'ring-purple-300', icon: '🔄' },
  'order.redelivery_created': { bg: 'bg-amber-50', ring: 'ring-amber-300', icon: '📦' },
}
// Actor type badges
"system" → "bg-gray-100 text-gray-600"
"user" → "bg-blue-100 text-blue-600"
"customer" → "bg-green-100 text-green-600"
"driver" → "bg-purple-100 text-purple-600"
```

**File:** `web/src/components/OrderTimeline.tsx`

### 10.3 Giao bổ sung — Button UX

**Điều kiện hiển thị:** Chỉ khi `order.status` = `partially_delivered` hoặc `failed`
**KHÔNG hiển thị cho:** `rejected` (hủy đơn + tạo mới), `delivered` (đã giao xong)

```tsx
// Button — brand color, KHÔNG dùng rose/red
"bg-[#F68634] text-white rounded-lg hover:bg-[#e5752a]"
// Modal message thay đổi theo trạng thái:
// partially_delivered → "Hàng đã giao thiếu sẽ được giao bổ sung."
// failed → "Đơn hàng giao thất bại sẽ được giao lại."
```

### 10.4 Centralized Status Config

**File:** `web/src/lib/status-config.ts` — SINGLE SOURCE OF TRUTH

Mọi page phải import labels/colors từ đây. KHÔNG hardcode status text trong page.

```tsx
import { orderStatusLabels, orderStatusColors } from '@/lib/status-config'
// orderStatusLabels['in_transit'] → 'Đang vận chuyển'
// orderStatusColors['in_transit'] → 'bg-blue-100 text-blue-800'
```

---

## 11. StatusChip — 16 Status Config *(v4 spec §2.1)*

> **SINGLE SOURCE OF TRUTH cho trạng thái đơn hàng.**
> File: `web/src/lib/order-status.ts` + `web/src/components/ui/StatusChip.tsx`
> KHÔNG tự đặt màu trong component. KHÔNG interpolate class Tailwind. Dùng full class string.

| Status | Dot | BG | Text | Label (default) | Countdown | Terminal |
|--------|-----|-----|------|-----------------|-----------|----------|
| `draft` | stone-400 | stone-100 | stone-600 | Nháp | — | ❌ |
| `pending_customer_confirm` | blue-500 | blue-50 | blue-700 | Chờ NPP xác nhận | **2h** (order) | ❌ |
| `pending_approval` | amber-500 | amber-50 | amber-700 | Chờ duyệt hạn mức | — | ❌ |
| `confirmed` | teal-500 | teal-50 | teal-700 | Đã xác nhận | — | ❌ |
| `planned` | violet-500 | violet-50 | violet-700 | Đã xếp xe | — | ❌ |
| `picking` | orange-500 | orange-50 | orange-700 | Đang đóng hàng | — | ❌ |
| `loaded` | purple-500 | purple-50 | purple-700 | Đã lên xe | — | ❌ |
| `in_transit` | sky-500 | sky-50 | sky-700 | Đang giao | — | ❌ |
| `delivered` | green-600 | green-50 | green-700 | Đã giao | **24h** (delivery) | ❌ |
| `partial_delivered` | amber-400 | amber-50 | amber-700 | Giao thiếu | — | ❌ |
| `rejected` | red-500 | red-50 | red-700 | Khách từ chối | — | ❌ |
| `re_delivery` | orange-600 | orange-50 | orange-700 | Giao lại | — | ❌ |
| `on_credit` | pink-500 | pink-50 | pink-700 | Công nợ | — | ❌ |
| `disputed` | red-600 | red-50 | red-700 | Tranh chấp | — | ❌ |
| `cancelled` | stone-300 | stone-100 | stone-500 | Đã hủy | — | ✅ |
| `completed` | green-800 | green-50 | green-800 | Hoàn tất | — | ✅ |

**Role-specific labels (ví dụ):**
- `pending_customer_confirm` → dispatcher: "Chờ NPP" · management: "Chờ NPP"
- `picking` → warehouse_handler: "Đang picking" · dvkh: "Kho đang chuẩn bị"
- `loaded` → dispatcher: "Sẵn sàng xuất" · security: "Gate pass"
- `in_transit` → driver: "Đang chạy" · management: "In Transit"
- `delivered` → dvkh: "Giao thành công"
- `rejected` → dvkh: "Khách từ chối — cần xử lý"
- `on_credit` → accountant: "Công nợ — chưa thu"
- `disputed` → accountant: "Sai lệch cần xử lý" · dvkh: "NPP báo sai lệch"

---

## 12. CountdownDisplay — Auto-confirm Timer *(v4 spec §2.2)*

> **CRITICAL:** Có 2 loại auto-confirm với thời gian KHÁC NHAU.

| Sự kiện | Thời gian | Business rule | Trạng thái kích hoạt |
|---------|-----------|---------------|---------------------|
| NPP xác nhận **đơn hàng** | **2 giờ** | BR-OMS-AUTO | `pending_customer_confirm` |
| NPP xác nhận **giao hàng** | **24 giờ** | BR-REC-02 | `delivered` |

```tsx
// CountdownDisplay component — logic
function CountdownDisplay({ expiresAt, type }: { expiresAt: string; type: 'order' | 'delivery' }) {
  // type='order' → auto-confirm sau 2h  
  // type='delivery' → auto-confirm sau 24h
  // Urgent class: order (<30 min) hoặc delivery (<2h) → text-red-500
  // Khi hết giờ → hiện "tự xác nhận"
}
```

---

## 13. Interaction Modals — 7 loại *(v4 spec §4)*

> Pattern bắt buộc (4 lớp theo thứ tự): Context box → Reason chips → Free text → Photo

| Modal | Actor | CTA color | Photo | Reason codes |
|-------|-------|-----------|-------|-------------|
| `delivery_success` | Tài xế | Xanh lá | ❌ | — |
| `delivery_partial` | Tài xế | Cam | ✅ bắt buộc | Hàng vỡ, Pick thiếu, NPP lấy 1 phần, Khác |
| `delivery_reject` | Tài xế | Đỏ | ✅ bắt buộc | Không có người, Kho đầy, Sai ĐC, Khách hủy, Khác |
| `kt_approve_credit` | Kế toán | — | ❌ | NPP nợ quá hạn, Rủi ro, Vi phạm, Khác |
| `record_npp_rejection` | DVKH | — | ❌ | SL sai, Giá sai, Ngày sai, Không phải đơn tôi, Khác |
| `record_npp_dispute` | DVKH | — | ❌ | Thiếu hàng, Sai SP, Hàng hỏng, SL sai |
| `gate_fail` | Bảo vệ | Đỏ fullscreen | ❌ | SL thiếu, Sai SP, Niêm phong, Biển số |

**KHÔNG CÓ:** `confirm_order`, `reject_order` → Defer sang NPP App (Phase 2, DEC-012)

**Anti double-submit (mobile critical):**
```tsx
const submitted = useRef(false)
// Set true trước khi gọi API, reset nếu lỗi
```

---

## 14. Role Flows — Luồng thao tác từng role *(v4 spec §5-12)*

> Chi tiết đầy đủ: xem `docs/specs/BHL_UX_VIBE_CODING_SPEC_v4.md`

### 14.1 DVKH (§5)
- **Layout:** 2 cột (Queue xử lý + Form tạo đơn / Preview Zalo)
- **Bước 1:** Dashboard → 3 KPI cần xử lý (pending_approval, rejected, re_delivery, ATP cảnh báo)
- **Bước 2:** Tạo đơn → ATP check inline (UX-02: đổi màu NGAY khi gõ)
- **Bước 3:** Credit check tự động (progress bar trực quan)
- **Bước 4:** Xác nhận = 3 việc đồng thời (tạo đơn + gửi Zalo OA + push notification)
- **Bước 5:** Auto-confirm sau 2h (BR-OMS-AUTO) → cron 15 phút check
- **Bước 6:** NPP từ chối → modal `record_npp_rejection` → cancelled + ATP release

### 14.2 Điều phối viên (§6)
- **Layout:** 3-column cockpit (alert queue 240px / map flex / chuyến 280px)
- **Nguyên tắc:** Mọi alert phải có inline CTA — KHÔNG navigate ra trang khác
- **VRP Optimize:** POST /v1/vrp/optimize → trips output
- **Duyệt kế hoạch:** 1 bấm = 4 việc (trips + manifest + notify thủ kho + notify tài xế) — SafeGo
- **Sự cố realtime:** Kéo-thả stops sang xe khác, thêm đơn khẩn

### 14.3 Thủ kho (§7)
- **Layout:** PDA-optimized, tab đầu tiên = Phiếu xuất theo chuyến
- **6 bước:** Nhận lệnh → Manifest (tab hàng + tab xếp đảo ngược) → FEFO picking → Scan barcode → Xếp hàng lên xe → Bàn giao Bảo vệ
- **Critical:** Stop N → đáy xe trước, Stop 1 → cạnh cửa sau cùng

### 14.4 Bảo vệ (§8)
- **Layout:** Ultra simple, button h-14 (56px)
- **Queue xe chờ:** Alert đỏ khi < 30 phút
- **Checklist 4 hạng mục (R01):** Biển số, CCCD tài xế, niêm phong, số lượng 100%
- **PASS → full green screen, FAIL → full red screen (NO override)**
- **Nhập kho cuối ngày:** Hàng trả + vỏ cược + tiền mặt

### 14.5 Lái xe (§9)
- **Layout:** Mobile full-width, offline-first, bottom tabs
- **Buttons:** h-12 min, action chính h-14
- **GPS auto-detect 200m** → popup "Đã đến nơi?"
- **3 kết quả:** Giao thành công / Giao thiếu (photo bắt buộc) / Từ chối (photo bắt buộc)
- **Offline:** Queue local → sync khi có mạng → user không biết
- **Kết ca:** Tổng stops + tiền + hàng trả + vỏ cược → nộp kho

### 14.6 Kế toán (§10)
- **Layout:** Priority queue P0 → P1 → P2
- **P0 (block):** Đơn chờ duyệt hạn mức
- **P1 (T+1):** Discrepancies open — countdown đến 16h T+1, đỏ khi < 2h
- **Duyệt hạn mức:** Hồ sơ NPP + progress bar + lịch sử 30 ngày + ghi chú bắt buộc
- **Đối soát 3 chiều:** Hàng vs Tiền vs Vỏ
- **Auto-confirm giao hàng 24h (BR-REC-02)**
- **Nhắc thanh toán:** 1-click Zalo OA

### 14.7 BGĐ (§11)
- **Layout:** 3 khung giờ, 5-second scan
- **08:00 Sáng:** 5 KPI kế hoạch + ngưỡng cảnh báo
- **12:00 Trưa:** Live vận hành, chỉ alert khi cần BGĐ
- **17:00 Chiều:** Tổng kết + xu hướng + gợi ý hành động
- **Alert tiers:** P0 (phải hành động) / P1 (được biết) / P2-P3 (tự xử lý)

### 14.8 NPP — Phân loại theo giai đoạn (§12)
- **Phase 1 (Go-live):** Zalo OA + DVKH ghi thay → auto-confirm 2h đơn / 24h giao
- **Phase 2 (sau 3-6 tháng):** NPP App unlock confirm/reject, báo sai lệch, xem công nợ, note shared
- **Schema DB đã sẵn sàng:** `reject_reason_code`, `dispute_reason_code`, `visibility` — chỉ cần unlock

---

## 15. Vehicle Loading Manifest *(v4 spec §13)*

- **Trigger:** Auto khi Điều phối duyệt → `SafeGo GenerateManifest`
- **Logic đảo ngược:** VRP stop 1→N, manifest xếp xe N→1 (stop cuối = đáy, stop 1 = cạnh cửa)
- **ThPick xong:** PUT /v1/warehouse/loading-manifests/:tripId/status → 'done' → notify Bảo vệ

---

## 16. UX Rules — 5 điều bắt buộc *(v4 spec §14)*

| Rule | Chi tiết |
|------|---------|
| UX-01 Zero dead ends | `setError(\`${err.message} (Ref: ${traceRef})\`)` — mọi error có action |
| UX-02 Instant feedback | ATP/Credit → đổi màu input NGAY khi gõ |
| UX-03 Role-aware empty | Text empty state khác nhau cho từng role |
| UX-04 Trace ID | `(Ref: ${traceRef})` trong mọi error message |
| UX-05 Driver tap | h-12 min buttons · h-14 action chính |

---

## 17. Checklist triển khai *(v4 spec §15)*

### P0 — Trước go-live
- [ ] StatusChip 16 statuses + countdownType: 'order'(2h) | 'delivery'(24h)
- [ ] OrderTimeline — KPI bar + 5 lớp + note composer
- [ ] VehicleManifestCard — tab hàng + tab xếp xe đảo ngược + scan
- [ ] FEFO picking — vị trí kho + gợi ý lô + near-expiry + scan
- [ ] InteractionModal 7 types (KHÔNG confirm_order, reject_order)
- [ ] Dashboard DVKH — ATP inline + Zalo preview + auto-confirm 2h
- [ ] Dashboard Điều phối — 3-column cockpit + VRP + kéo-thả
- [ ] Dashboard Thủ kho — phiếu xuất theo chuyến tab đầu tiên
- [ ] Dashboard Bảo vệ — fullscreen green/red + nhập kho cuối ngày
- [ ] Dashboard Lái xe — GPS 200m + offline + kết ca
- [ ] Dashboard Kế toán — P0/P1/P2 queue + T+1 countdown + đối soát 3 chiều
- [ ] Dashboard BGĐ — 3 khung giờ + alert P0/P1
- [ ] Auto-confirm job: 2h đơn hàng, 24h giao hàng

### P1 — Sprint 1 sau go-live
- [ ] Notification system P0/P1/P2/P3
- [ ] Clone đơn tuần trước (DVKH)
- [ ] Nhắc thanh toán công nợ 1-click Zalo (Kế toán)
- [ ] BGĐ báo cáo tuần/tháng

### P2 — Đánh giá sau 3 tháng
- [ ] NPP App (React Native Expo)
- [ ] Unlock token-based confirm/reject
- [ ] Unlock note visibility = 'shared'

---

*Cập nhật: 22/03/2026 — Tích hợp BHL_UX_VIBE_CODING_SPEC_v4.md*
*Nguồn màu: UXUI.md — BHL brand guidelines*
*DEC-005: Tailwind CSS, không dùng Ant Design components*
