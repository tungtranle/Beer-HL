---
description: "Frontend patterns and conventions for Next.js pages. Ensures consistent UI code, API calling, and component structure."
applyTo: ["**/*.tsx", "**/*.ts"]
---

# Frontend Patterns — BHL OMS-TMS-WMS

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

// 1. Interface ở đầu file
interface Order { id: string; status: string; ... }

// 2. Constants (statusColors, statusLabels) trước component
const statusColors: Record<string, string> = { ... }

// 3. Component function
export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/orders')
      setData(res.data || [])
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { loadData() }, [])
}
```

## Quy tắc

1. **Luôn dùng `apiFetch`** — KHÔNG gọi `fetch` trực tiếp
2. **Handle null data** — `res.data || []`
3. **Loading trong finally** — `setLoading(false)` luôn chạy
4. **Derived state = tính trực tiếp** — KHÔNG dùng useState cho computed values
5. **Status colors/labels** — `Record<string, string>` constants
6. **Tiền:** `new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })`
7. **Conditional classes:** `${statusColors[status] || 'bg-gray-100'}`
8. **Auth tokens:** localStorage keys `bhl_token`, `bhl_user`, `bhl_refresh_token`
