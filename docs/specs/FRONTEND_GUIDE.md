# FRONTEND_GUIDE — UX/UI & Frontend Patterns (SINGLE SOURCE)

> Merge TẤT CẢ từ: UXUI.md + UXUI_SPEC.md + BHL_UX_VIBE_CODING_SPEC v4+v5 + frontend-patterns.instructions.md
> AI đọc file này TRƯỚC khi code bất kỳ `.tsx` nào.
> **Xác định role → đọc section role đó → code.**

---

## §1 Design System

### 1.1 Brand Color — BẮT BUỘC
```
Brand Primary: #F68634 (cam BHL)
Tailwind: bg-brand, text-brand, hover:bg-brand-500
```
- Primary buttons, active tabs, FEFO badge, current stop
- KHÔNG vượt quá 10% diện tích visual
- **KHÔNG lẫn với amber/warning** (#D97706) — brand ≠ warning

```js
// tailwind.config.js
brand: { DEFAULT: '#F68634', 50: '#FEF3E8', 100: '#FDE0C4', 200: '#FBBB7C',
         300: '#F99B3F', 400: '#F68634', 500: '#E8720A', 600: '#C45E07',
         700: '#9A4905', 800: '#703404', 900: '#4A2203' }
```

### 1.2 Color Quick Reference (copy-paste)
```tsx
// PRIMARY ACTION (brand cam BHL)
"bg-brand text-white hover:bg-brand-500"           // button chính
"border-b-2 border-brand text-brand-600"           // active tab
"bg-brand-50 text-brand-700 border-brand-200"      // light badge

// SEMANTIC (KHÔNG lẫn với brand)
"text-green-700 bg-green-50 border-green-200"      // success/delivered
"text-amber-700 bg-amber-50 border-amber-200"      // warning/ATP thấp
"text-red-700   bg-red-50   border-red-200"        // error/fail
"text-blue-700  bg-blue-50  border-blue-200"       // info/in-transit

// NEUTRAL
"bg-white"              // card bg
"bg-gray-50"            // secondary bg
"border-gray-200"       // default border
"text-gray-900"         // text primary
"text-gray-500"         // text secondary
```

### 1.3 Typography
- Font: **Roboto** (300/400/500/700). Monospace: **JetBrains Mono** (số tiền, mã đơn)
- Page title: text-2xl font-medium | Section: text-lg font-medium | Body: text-sm | Small: text-xs
- Driver app: minimum 18sp (text-lg)

### 1.4 Icons & Style
- **Heroicons** (`@heroicons/react`) — KHÔNG mix icon libraries, KHÔNG Ant Design
- Cards: `rounded-xl border border-gray-200 bg-white`
- Buttons: `rounded-lg`. Spacing: `gap-4` (default), `gap-6` (sections)
- Loading: skeleton shimmer (`animate-pulse`), KHÔNG full-page spinner

---

## §2 Per-Role Layouts

### DISPATCHER — 3-column cockpit (Desktop 1920px+)
```
[LEFT 25%] Metrics + Trip list + VRP bar
[CENTER 50%] GPS Map + filter chips
[RIGHT 25%] Alerts + inline CTA + Check-in + Expiry
```
- VRP button: `bg-brand text-white` | Alert P0: `border-l-2 border-red-500 bg-red-50`
- Alert P1: `border-l-2 border-amber-500 bg-amber-50`
- **Mọi alert phải có inline CTA — KHÔNG navigate đi đâu**
- Trip dots: in_transit=green-500, loading=amber-500, anomaly=red-500 animate-ping

### DVKH — 2-column form/preview
```
[LEFT 60%] Form tạo đơn (customer + items + ATP inline)
[RIGHT 40%] Zalo preview panel + credit badge
```
- Submit: `bg-brand text-white` | Credit badge: green(<80%), amber(<100%), red(over)
- ATP bar: green(>50%), amber(20-50%), red(<20%). Input vượt ATP: `border-amber-400 bg-amber-50` NGAY khi gõ
- Zalo preview: `bg-green-50 border border-green-200 rounded-xl`

### DRIVER — Mobile full-width (5-6", một tay, ngoài trời)
- Bottom tabs: Chuyến / Bản đồ / Hàng / Tiền
- **BẮT BUỘC:** h-12 min tất cả buttons, h-14 action chính
- Stop header: `bg-brand text-white` | Confirm: `bg-green-600 text-white h-14`
- Payment selected: `border-2 border-brand bg-brand-50` | Offline: `bg-amber-500 text-white`
- Stop circles: done=green-500, current=brand, next=gray-100

### ACCOUNTANT — 2-column table/actions (Desktop)
- T+1 countdown: >4h=gray, 2-4h=amber, <2h=red (border-l-4 + bg)
- Discrepancy row: `bg-red-50` | Approve: `bg-green-600 text-white`
- "Chốt ngày" button: `bg-brand text-white`

### WAREHOUSE_HANDLER — PDA scan-first
- `text-base` minimum, buttons h-14 minimum
- FEFO badge "Pick trước": `bg-brand text-white` (quan trọng NHẤT trên màn picking)
- Gate PASS: `min-h-screen bg-green-600` (full screen xanh)
- Gate FAIL: `min-h-screen bg-red-600` (full screen đỏ, KHÔNG override)

### MANAGEMENT — 5 KPI cards + 3-col (5-second scan)
- KPI on target: `text-green-600` | Off target: `text-red-600 ring-1 ring-red-300`
- Bar chart today: `fill-brand` | Drill-down: `bg-brand text-white text-xs`

### SECURITY — Scan → Checklist → Green/Red
- Buttons h-14. Cho xe đi: `bg-green-600 text-white h-14 font-bold`
- Chặn xe: `bg-red-600 text-white h-14 font-bold`
- Full green/red screen cho verdict — KHÔNG có UI phức tạp

### ADMIN — Settings table + toggles
- Toggle ON: `bg-brand` | Mock mode warning: `bg-amber-50 border border-amber-300`

### WORKSHOP — 2-column (vỏ trả về / panel phân loại)
- Vỏ tốt: `bg-green-100 text-green-700` | Hỏng: `bg-amber-100` | Mất: `bg-red-100`
- Bắt buộc reason khi "hỏng" hoặc "mất"

### Touch Targets
| Context | Min Height | Tailwind |
|---------|-----------|----------|
| Web desktop | 36px | h-9 |
| Driver actions | 48px | h-12 |
| Driver CTA | 56px | h-14 |
| PDA (đeo găng) | 72px | h-[72px] |

---

## §3 Component Patterns

### Page pattern
```typescript
'use client'
import { apiFetch } from '@/lib/api'

interface Order { id: string; status: string; total_amount: number }

export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/orders')
      setData(res.data || [])
    } catch (err: any) {
      const traceRef = err.serverTraceId || err.traceId || 'unknown'
      setError(`${err.message} (Ref: ${traceRef})`)
    } finally { setLoading(false) }
  }
  useEffect(() => { loadData() }, [])
}
```

### File structure
```
web/src/app/dashboard/{module}/page.tsx        ← List
web/src/app/dashboard/{module}/new/page.tsx    ← Create
web/src/app/dashboard/{module}/[id]/page.tsx   ← Detail
```

### Status config — SINGLE SOURCE
Import từ `web/src/lib/status-config.ts`. KHÔNG hardcode status text trong page.
```tsx
import { orderStatusLabels, orderStatusColors } from '@/lib/status-config'
```

---

## §4 Năm UX Rules BẮT BUỘC

**UX-01: Zero dead ends** — mọi error có action + trace ID
```tsx
setError(`${err.message} (Ref: ${traceRef})`)
```

**UX-02: Instant feedback** — vượt ATP → border đổi màu NGAY khi gõ
```tsx
if (val > atpQty) setBorderColor('border-amber-400')
```

**UX-03: Role-aware empty states** — text khác nhau cho từng role
```tsx
{ dispatcher: 'Không có shipment chưa xếp — tốt lắm!',
  driver: 'Chưa có chuyến — liên hệ điều phối',
  accountant: 'Tất cả đối soát đã hoàn tất',
  warehouse_handler: 'Không có picking task — liên hệ dispatcher' }
```

**UX-04: Trace ID** — `(Ref: ${traceRef})` trong mọi error message

**UX-05: Driver tap** — h-12 min, h-14 action chính

---

## §5 Frontend Rules

1. **Luôn `apiFetch`** — KHÔNG `fetch()` trực tiếp (mất auto-refresh token)
2. **Handle null:** `res.data || []`
3. **Loading trong finally:** `setLoading(false)` luôn chạy
4. **Tiền:** `formatVND()` / `formatVNDCompact()` — KHÔNG tự format
5. **Auth tokens:** localStorage `bhl_token`, `bhl_user`, `bhl_refresh_token`
6. **Headless UI** cho Dialog, Menu, Listbox. **KHÔNG Ant Design**
7. **Tailwind CSS** trực tiếp — KHÔNG CSS modules

---

## §6 StatusChip — 16 Configs

| Status | Dot | BG | Text | Label |
|--------|-----|-----|------|-------|
| draft | stone-400 | stone-100 | stone-600 | Nháp |
| pending_customer_confirm | blue-500 | blue-50 | blue-700 | Chờ NPP xác nhận |
| pending_approval | amber-500 | amber-50 | amber-700 | Chờ duyệt hạn mức |
| confirmed | teal-500 | teal-50 | teal-700 | Đã xác nhận |
| planned | violet-500 | violet-50 | violet-700 | Đã xếp xe |
| picking | orange-500 | orange-50 | orange-700 | Đang đóng hàng |
| loaded | purple-500 | purple-50 | purple-700 | Đã lên xe |
| in_transit | sky-500 | sky-50 | sky-700 | Đang giao |
| delivered | green-600 | green-50 | green-700 | Đã giao |
| partial_delivered | amber-400 | amber-50 | amber-700 | Giao thiếu |
| rejected | red-500 | red-50 | red-700 | Khách từ chối |
| re_delivery | orange-600 | orange-50 | orange-700 | Giao lại |
| on_credit | pink-500 | pink-50 | pink-700 | Công nợ |
| disputed | red-600 | red-50 | red-700 | Tranh chấp |
| cancelled | stone-300 | stone-100 | stone-500 | Đã hủy |
| completed | green-800 | green-50 | green-800 | Hoàn tất |

**CountdownDisplay:** pending_customer_confirm → 2h (BR-OMS-AUTO) | delivered → 24h (BR-REC-02)

---

## §7 Interaction Modals — 7 loại

| Modal | Actor | CTA color | Photo | Reason codes |
|-------|-------|-----------|-------|--------------|
| delivery_success | Tài xế | Xanh lá | ❌ | — |
| delivery_partial | Tài xế | Cam | ✅ bắt buộc | Hàng vỡ, Pick thiếu, NPP lấy 1 phần |
| delivery_reject | Tài xế | Đỏ | ✅ bắt buộc | Không người, Kho đầy, Sai ĐC, Hủy |
| kt_approve_credit | Kế toán | — | ❌ | NPP nợ quá hạn, Rủi ro, Vi phạm |
| record_npp_rejection | DVKH | — | ❌ | SL sai, Giá sai, Ngày sai |
| record_npp_dispute | DVKH | — | ❌ | Thiếu hàng, Sai SP, Hàng hỏng |
| gate_fail | Bảo vệ | Đỏ fullscreen | ❌ | SL thiếu, Sai SP, Niêm phong |

Pattern: Context box → Reason chips → Free text → Photo
Anti double-submit: `const submitted = useRef(false)`

---

## §8 Shared Components

### OrderStatusStepper — 5 bước
1. Đã tạo đơn → 2. KH xác nhận → 3. Kho xử lý → 4. Đang vận chuyển → 5. Hoàn thành
- Completed: `bg-green-500 text-white` | Current: `bg-[#F68634] text-white ring-4 ring-orange-100` | Pending: `bg-gray-200`

### OrderTimeline — World-class audit trail
- Nhóm theo ngày, filter tabs (Tất cả/Trạng thái/Giao hàng/Ghi chú), summary banner
- Duration chips: <30m gray, 30m-2h amber, >2h red
- Notes inline trong timeline (không tab riêng)

### WaitingForBanner — "Đang chờ ai"
```tsx
const WAITING_FOR = {
  pending_customer_confirm: { label: 'Chờ NPP xác nhận (tự động sau 2h)', color: 'bg-blue-50 text-blue-700' },
  pending_approval: { label: 'Chờ Kế toán duyệt hạn mức', color: 'bg-amber-50 text-amber-700' },
  confirmed: { label: 'Chờ Điều phối xếp xe', color: 'bg-teal-50 text-teal-700' },
  in_transit: { label: 'Tài xế đang giao', color: 'bg-sky-50 text-sky-700' },
  delivered: { label: 'Chờ NPP xác nhận nhận hàng (24h)', color: 'bg-green-50 text-green-700' },
  // ... terminal states → KHÔNG hiện banner
}
```

### CreditAgingChip — Công nợ quá hạn
- ≥30 ngày: `bg-red-600 text-white` (P0) | ≥14: `bg-red-100 text-red-700` | ≥7: `bg-amber-100 text-amber-700`

### PinnedNotesBar — max 3 ghi chú ghim
- `border-l-4 border-amber-400 bg-amber-50` | API: PUT/DELETE `/orders/:id/notes/:noteId/pin`

### Picking by Vehicle — Thủ kho soạn gom theo xe
- Route: `/dashboard/warehouse/picking-by-vehicle`
- KPI cards (tổng xe, tổng đơn, sẵn sàng gate, tiến độ %), filter tabs, expandable vehicle cards
- FEFO badge `🔥 Pick trước!` dùng brand color cho lô ≤7 ngày
- Progress: ≥100% xanh lá, ≥50% xanh dương, <50% vàng

### TimelineKPIBar — 4 thẻ KPI đầu timeline
- Thời gian xử lý | Cutoff (trước 16h ✓ / T+1) | Chuyến xe | Đối soát

---

## §9 Brand Color Mapping — Dùng / Không dùng

| Component | Brand? | Class |
|-----------|--------|-------|
| PrimaryButton | ✅ | `bg-brand text-white hover:bg-brand-500` |
| ActiveTab | ✅ | `border-b-2 border-brand text-brand-600` |
| StopCircle current | ✅ | `bg-brand text-white` |
| FEFO Badge | ✅ | `bg-brand text-white` |
| PaymentOption selected | ✅ | `border-brand bg-brand-50 text-brand-700` |
| Toggle ON | ✅ | `bg-brand` |
| MetricCard | ❌ | green/amber/red semantic |
| StatusBadge | ❌ | green/amber/red semantic |
| ATPBar | ❌ | green/amber/red by level |
| T1Countdown | ❌ | gray/amber/red by time |
| AlertItem | ❌ | red/amber border-left |
| GateCheckResult | ❌ | full green/red screen |

---

## §10 Helpers bắt buộc

```typescript
export const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

export const formatVNDCompact = (amount: number) => {
  if (amount >= 1_000_000_000) return `${(amount / 1e9).toFixed(1)}T`
  if (amount >= 1_000_000)     return `${(amount / 1e6).toFixed(0)}M`
  return formatVND(amount)
}

// Notification priority
const notificationConfig = {
  urgent:  { display: 'persistent-toast', dismissable: false },
  high:    { display: 'toast', dismissable: true, timeout: 0 },
  normal:  { display: 'bell', dismissable: true },
  low:     { display: 'digest', dismissable: true },
}
```

---

*Merge hoàn chỉnh từ: UXUI.md + UXUI_SPEC.md + BHL_UX_VIBE_CODING_SPEC v4+v5 + frontend-patterns.instructions.md*
*Cập nhật: 24/03/2026*
