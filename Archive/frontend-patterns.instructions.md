---
description: "Frontend patterns, UX/UI standards, and role-specific design. MUST read UXUI_SPEC.md before implementing any dashboard page."
applyTo: "**/*.{tsx,ts}"
---

# Frontend Patterns — BHL OMS-TMS-WMS

## Bắt buộc đọc trước khi code bất kỳ page nào

Trước khi implement bất kỳ `.tsx` nào trong `dashboard/`:
1. ĐỌC `docs/specs/UXUI_SPEC.md` — section tương ứng với user role của page đó
2. Xác định user role: `dispatcher / dvkh / driver / accountant / warehouse_handler / management / security / admin`
3. Áp dụng đúng layout pattern và component rules cho role đó

## Tech Stack

- Next.js 14 (App Router) + TypeScript
- Tailwind CSS (trực tiếp, không CSS modules)
- `apiFetch` wrapper từ `@/lib/api` (auto auth + refresh)

## File Structure

```
web/src/app/dashboard/
├── {module}/
│   ├── page.tsx         ← List view
│   ├── new/page.tsx     ← Create form
│   └── [id]/
│       ├── page.tsx     ← Detail view
│       └── edit/page.tsx← Edit form
```

## Component Pattern

```typescript
'use client'

interface Order { id: string; status: string; ... }

const statusColors: Record<string, string> = { ... }

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

## Quy tắc UX bắt buộc (5 rules)

### UX-01: Zero dead ends
```typescript
// ✅ Mọi error phải có action
setError(`${err.message} (Ref: ${traceRef})`)
// ❌ Không được
setError('Lỗi hệ thống')
```

### UX-02: Business rule feedback tức thì
```typescript
// Input vượt ATP → màu input đổi NGAY, không cần submit
const handleQtyChange = (val: number) => {
  if (val > atpQty) setBorderColor('border-amber-400')
  else setBorderColor('border-gray-200')
}
```

### UX-03: Role-aware empty states
```typescript
const emptyMessages: Record<string, string> = {
  dispatcher: 'Không có shipment nào chưa xếp — tốt lắm!',
  driver: 'Chưa có chuyến hôm nay — liên hệ điều phối',
  warehouse_handler: 'Không có picking task — liên hệ dispatcher',
  accountant: 'Tất cả đối soát đã hoàn tất hôm nay',
}
```

### UX-04: Trace ID luôn có khi lỗi
```typescript
} catch (err: any) {
  const traceRef = err.serverTraceId || err.traceId || 'unknown'
  setError(`${err.message} (Ref: ${traceRef})`)
}
```

### UX-05: Driver tap targets tối thiểu 48px
```typescript
// Tất cả buttons trong /dashboard/driver/* phải có h-12 trở lên
// Action buttons chính: h-14
<button className="w-full h-14 bg-green-600 text-white rounded-xl font-medium">
  Xác nhận đã hạ hàng
</button>
```

## Color semantic chuẩn

```typescript
// Dùng nhất quán — KHÔNG tự đặt màu mới
const semanticColors = {
  success:  'text-green-700 bg-green-50 border-green-200',
  warning:  'text-amber-700 bg-amber-50 border-amber-200',
  danger:   'text-red-700 bg-red-50 border-red-200',
  primary:  'bg-brand text-white hover:bg-brand-500',
  info:     'text-blue-700 bg-blue-50 border-blue-200',
}
```

## formatVND — dùng nhất quán

```typescript
export const formatVND = (amount: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)

export const formatVNDCompact = (amount: number) => {
  if (amount >= 1_000_000_000) return `${(amount/1e9).toFixed(1)}T`
  if (amount >= 1_000_000) return `${(amount/1e6).toFixed(0)}M`
  return formatVND(amount)
}
```

## Notification priority mapping

```typescript
// P0 Critical: modal fullscreen, không dismiss cho đến khi confirm
// P1 Urgent: toast persistent với inline CTA
// P2 Important: bell badge
// P3 Digest: bell badge gộp

const notificationConfig = {
  urgent:  { display: 'persistent-toast', dismissable: false },
  high:    { display: 'toast', dismissable: true, timeout: 0 },
  normal:  { display: 'bell', dismissable: true },
  low:     { display: 'digest', dismissable: true },
}
```

## Quy tắc

1. **Luôn dùng `apiFetch`** — KHÔNG gọi `fetch` trực tiếp
2. **Handle null data** — `res.data || []`
3. **Loading trong finally** — `setLoading(false)` luôn chạy
4. **Tiền:** `formatVND()` hoặc `formatVNDCompact()` — KHÔNG tự format
5. **Auth tokens:** localStorage keys `bhl_token`, `bhl_user`, `bhl_refresh_token`
6. **Đọc UXUI_SPEC.md** trước khi code page mới — đặc biệt section của role đó
