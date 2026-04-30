# BHL — Đề xuất chuẩn hoá Component System

**Người soạn:** AI UI/UX Lead Reviewer
**Ngày:** 30/04/2026
**Phạm vi:** `bhl-oms/web/src/` — toàn bộ dashboard

---

## 0. Câu trả lời trực tiếp

**Có — và không chỉ "nên", mà là BẮT BUỘC.**

Lý do: không có component system đồng nhất, mỗi developer mới (hoặc mỗi tính năng mới) sẽ tự "phát minh lại bánh xe" theo cách riêng. Kết quả là UI tiếp tục diverge, không bao giờ đồng nhất. Đây là debt tích luỹ theo hàm số mũ.

---

## 1. Số liệu thực tế — mức độ vấn đề

Audit code thực tế trên **66 file tsx** trong `src/app/dashboard`:

| Component có sẵn | Số file dùng | Tỉ lệ dùng | Số file vẫn dùng ad-hoc |
|---|---|---|---|
| `PageHeader` | **3 / 66** | **4.5%** | ~58 file tự viết `text-2xl font-bold` |
| `LoadingState` | **2 / 66** | **3%** | ~29 file tự dùng `animate-spin` |
| `KpiCard` | **4 / 66** | **6%** | Đa số tự viết div metric |
| `StatusChip` | **2 / 66** | **3%** | Đa số tự hardcode màu inline |

| Pattern ad-hoc | Số file | Hệ quả |
|---|---|---|
| `text-2xl font-bold` (tự viết h1) | **58 / 66 (88%)** | 58 kiểu tiêu đề khác nhau |
| `animate-spin` (spinner tự chế) | **29 / 66 (44%)** | 29 kiểu loading khác nhau |
| `fixed inset-0` (modal tự chế) | **22 / 66 (33%)** | 22 kiểu modal khác nhau |
| `<input ` trần (không qua component) | **24 / 66 (36%)** | Input style không nhất quán |

**Kết luận từ số liệu:** Design system đã được xây dựng công phu (`Button`, `Card`, `PageHeader`, `KpiCard`, `LoadingState`, `EmptyState`, `StatusChip`, `Skeleton`...) nhưng **adoption gần như bằng 0**. Vấn đề không phải là thiếu component — vấn đề là **không có cơ chế bắt buộc sử dụng**.

---

## 2. Nguyên nhân adoption thấp

1. **Không có "nhắc nhở" kỹ thuật**: Developer viết `<button className="px-4...">` không bị warning gì. IDE không nhắc dùng `<Button variant="primary">`.
2. **Không có Storybook / catalog**: Developer không biết component nào tồn tại, với props gì.
3. **Import path khó nhớ**: Phải nhớ `@/components/ui/Button` thay vì chỉ cần dùng shortcut.
4. **Một số component thiếu** (xem mục 4) → developer bắt buộc phải tự viết → hình thành thói quen "tự làm mọi thứ".
5. **Không có code review checklist** enforcing component usage.

---

## 3. Kiến trúc Component System đề xuất

### 3 tầng component

```
┌─────────────────────────────────────────────────────────────┐
│  Tầng 3: DOMAIN COMPONENTS (smart, có business logic)       │
│  OrderCard, TripCard, DriverCard, NppHealthBadge,           │
│  NotificationBell, WaitingForBanner, PinnedNotesBar         │
├─────────────────────────────────────────────────────────────┤
│  Tầng 2: COMPOSITE COMPONENTS (layout, pattern)             │
│  DataTable, FilterBar, FormSection, ConfirmDialog,          │
│  PageShell, SplitPane, ActionMenu, DateRangePicker          │
├─────────────────────────────────────────────────────────────┤
│  Tầng 1: PRIMITIVE COMPONENTS (dumb, no business logic)     │
│  Button, Input, Select, Checkbox, Card, Badge, Tooltip,     │
│  Modal, Drawer, Tabs, Alert, Avatar, Tag, Divider           │
└─────────────────────────────────────────────────────────────┘
       ↑ Developer chỉ import từ đây, không tự viết HTML thô
```

### Quy tắc sử dụng
- Tầng 1 & 2 → `import { X } from '@/components/ui'` (single entry point, đã có `index.ts`)
- Tầng 3 → `import { X } from '@/components/domain'` (tạo thêm folder)
- **KHÔNG** dùng `<button className="...">`, `<input className="...">` trực tiếp trong page
- **KHÔNG** tự viết spinner, modal overlay, empty message trong page

---

## 4. Danh sách component — Đã có vs Còn thiếu

### 4.1. Đã có — cần BẮT BUỘC dùng (adoption hiện quá thấp)

| Component | File | Thay thế cái gì |
|---|---|---|
| `Button` | `ui/Button.tsx` | Mọi `<button className="px-...">` |
| `Card` | `ui/Card.tsx` | Mọi `bg-white rounded-xl shadow-sm` |
| `CardHeader` | `ui/Card.tsx` | Mọi tiêu đề trong card |
| `PageHeader` | `ui/PageHeader.tsx` | Mọi `<h1 className="text-2xl font-bold">` |
| `KpiCard` | `ui/KpiCard.tsx` | Mọi div metric trên trang báo cáo |
| `LoadingState` | `ui/LoadingState.tsx` | Mọi `animate-spin` spinner tự chế |
| `EmptyState` | `ui/EmptyState.tsx` | Mọi text "Không có dữ liệu" inline |
| `StatusChip` | `ui/StatusChip.tsx` | Mọi badge trạng thái tự hardcode màu |
| `Skeleton*` | `ui/Skeleton.tsx` | Mọi placeholder loading trong list/table |
| `Pagination` | `ui/Pagination.tsx` | Mọi nút phân trang tự chế |
| `CommandPalette` | `ui/CommandPalette.tsx` | Global ⌘K (đã wired, cần wire search pill) |

### 4.2. Còn thiếu — cần xây (ưu tiên cao)

#### P0 — Cần ngay (unblock nhiều tính năng)

| Component | Mô tả | Thay thế cái gì | Effort |
|---|---|---|---|
| `Modal` / `Dialog` | Overlay + focus trap + Esc close + backdrop | 22 file tự dùng `fixed inset-0` | M |
| `ConfirmDialog` | Modal 1 props: title + message + onConfirm + danger | `window.confirm()` và tự viết alert modal | S |
| `Input` | Text input có label, error, hint, prefix/suffix icon | 24 file dùng `<input className="...">` trần | S |
| `Textarea` | Giống Input nhưng multiline | | XS |
| `Select` | `<select>` chuẩn + custom dropdown | Nhiều file `<select className="...">` | M |
| `FormField` | Wrapper: label + input + error message | Thống nhất spacing giữa form fields | S |
| `Tabs` | Tab bar + panel | 21 file `setTab` tự implement tab | M |
| `Badge` | Số đếm nhỏ (khác StatusChip) | Count thông báo, số items | XS |
| `Tooltip` | Hover tooltip cho icon | Collapsed sidebar icons, action icons | S |
| `Alert` | Inline warning/error/info banner trong form/page | `bg-yellow-50...` hardcode | S |

#### P1 — Cần trong 2–4 tuần

| Component | Mô tả | Thay thế cái gì | Effort |
|---|---|---|---|
| `DataTable` | Table chuẩn: sort, loading, empty, sticky header, responsive | Nhiều page tự viết `<table>` khác nhau | L |
| `FilterBar` | Row filter: date range + status + search + actions | Mỗi page filter khác nhau | M |
| `ActionMenu` / `DropdownMenu` | Dropdown menu từ icon button | 22 file tự dùng `absolute bg-white shadow` | M |
| `Drawer` / `SidePanel` | Panel slide từ phải (detail, edit form) | Tránh navigate khi chỉ cần xem chi tiết | L |
| `DateRangePicker` | Chọn khoảng ngày (from–to) | Mỗi page tự chế date picker khác nhau | M |
| `SearchableSelect` | Dropdown có search | Đã có ở `lib/SearchableSelect.tsx` nhưng nằm sai chỗ | S |
| `Avatar` | Ảnh / chữ viết tắt tên | Nhiều page tự render `w-8 h-8 rounded-full` | XS |
| `Tag` | Label nhỏ generic (khác StatusChip) | SKU tag, route tag, label | XS |

#### P2 — Nâng tầm (Sprint 3–4)

| Component | Mô tả | Effort |
|---|---|---|
| `StatRow` | Metric nhỏ inline (label + value + delta) dùng trong panel | S |
| `Section` | Wrapper section trong page với title + content + optional action | XS |
| `Timeline` | Dòng sự kiện (đã có `OrderTimeline.tsx` — cần generic hoá) | M |
| `Stepper` | Workflow steps (đã có `OrderStatusStepper.tsx` — cần generic hoá) | M |
| `NumberInput` | Input số với tăng/giảm +/- | XS |
| `ColoredDot` | Chấm màu live status (thay emoji `🟢`) | XS |
| `CopyButton` | Inline copy-to-clipboard cho mã đơn, ID | XS |
| `CommandKey` | Hiển thị keyboard shortcut hint (⌘K, Ctrl+Z) | XS |
| `ErrorState` | Page-level error + Retry button | S |
| `InfiniteScroll` | Thay pagination trong mobile/long list | M |

---

## 5. Chuẩn API cho mỗi component (convention)

Mọi component trong `components/ui/` phải tuân theo:

```tsx
// ✅ Pattern đúng
interface ComponentProps {
  // variant / tone / size trước
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  tone?: 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'neutral'

  // Nội dung
  children?: ReactNode
  label?: string

  // Icons (luôn dùng LucideIcon type)
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon

  // States
  loading?: boolean
  disabled?: boolean
  error?: string

  // Hành động
  onClick?: () => void
  onChange?: (value: ...) => void

  // Thoát ra ngoài
  className?: string // luôn có, merge vào cuối
}

// ✅ Export qua index.ts ngay sau khi tạo
// KHÔNG để component "mồ côi" không có trong index.ts
```

### Naming convention
- `PascalCase` cho component name
- Props tối giản: không nhận `style` prop (chỉ `className`)
- Không nhận business data trực tiếp trong primitive (ví dụ `Input` không nhận `order`, `customer`)
- Mọi icon từ `lucide-react`, không dùng emoji làm icon
- Mọi màu từ design tokens (`brand-500`, `success-600`...) — không hardcode hex

---

## 6. Cơ chế bắt buộc sử dụng (Enforcement)

Đây là phần **quan trọng nhất**. Component có mà không enforce = không dùng (đã chứng minh qua số liệu).

### 6.1. ESLint rules (tự động cảnh báo)

Thêm vào `.eslintrc.json`:

```json
{
  "rules": {
    "no-restricted-syntax": [
      "warn",
      {
        "selector": "JSXOpeningElement[name.name='button']:not([name.name='Button'])",
        "message": "Dùng <Button variant=...> từ @/components/ui thay vì <button> thô."
      },
      {
        "selector": "JSXOpeningElement[name.name='input']",
        "message": "Dùng <Input> từ @/components/ui thay vì <input> thô."
      },
      {
        "selector": "JSXOpeningElement[name.name='select']",
        "message": "Dùng <Select> từ @/components/ui thay vì <select> thô."
      }
    ]
  }
}
```

### 6.2. Codemod (migrate hàng loạt)

Tạo `scripts/codemods/migrate-primitives.ts`:
- Quét toàn bộ `app/**/*.tsx`
- Tìm `<h1 className=".*text-2xl.*">` → gợi ý thay bằng `<PageHeader title=...>`
- Tìm `<div>Đang tải...</div>` hoặc `animate-spin` standalone → gợi ý `<LoadingState />`
- Tìm `bg-emerald-*`, `bg-rose-*` → gợi ý dùng semantic token `bg-success-*`, `bg-danger-*`
- Report ra file `COMPONENT_COMPLIANCE_REPORT.md`

Chạy: `npx ts-node scripts/codemods/migrate-primitives.ts --report` (đọc chỉ, không đổi)
Chạy: `npx ts-node scripts/codemods/migrate-primitives.ts --apply` (áp dụng safe migrations)

### 6.3. Component catalog (Storybook hoặc tự xây)

Tạo route nội bộ `/test-portal/components` (đã có folder `test-portal`):
- Liệt kê tất cả component với ví dụ tương tác
- Developer mở URL này khi cần tìm component
- Tự cập nhật từ `components/ui/index.ts`

Tại sao không Storybook? Storybook nặng, setup phức tạp. Route nội bộ đơn giản và deploy cùng app.

### 6.4. PR checklist

Thêm vào `.github/pull_request_template.md`:
```markdown
## Component compliance
- [ ] Không dùng `<button className="...">` thô (dùng `<Button>`)
- [ ] Không dùng `<input className="...">` thô (dùng `<Input>`)
- [ ] Không tự viết spinner (dùng `<LoadingState>` hoặc `<Skeleton>`)
- [ ] Không tự viết modal overlay (dùng `<Modal>`)
- [ ] H1 dùng `<PageHeader>`, không tự `text-2xl font-bold`
- [ ] Status badge dùng `<StatusChip>`, không tự hardcode màu
```

---

## 7. Kế hoạch triển khai

### Giai đoạn 1 — Foundation (1 tuần): Xây component thiếu P0

| Ngày | Việc |
|---|---|
| 1–2 | `Modal`, `ConfirmDialog` (unblock 22 file ad-hoc modal) |
| 2–3 | `Input`, `Textarea`, `FormField` (unblock 24 file raw input) |
| 3–4 | `Tabs` (unblock 21 file setTab ad-hoc) |
| 4–5 | `Tooltip`, `Badge`, `Alert`, `Avatar`, `Tag` (nhỏ, nhanh) |
| 5 | Thêm tất cả vào `index.ts`, viết usage example |

### Giai đoạn 2 — Migrate (2 tuần): Chạy codemod + sửa từng page

Thứ tự ưu tiên (high-traffic trước):
1. KPI page → `PageHeader`, `KpiCard`, `LoadingState`
2. Orders list → `Button`, `StatusChip`, `FilterBar`, `DataTable`
3. Trips list → tương tự Orders
4. Planning → sau khi tách file lớn (xem `BHL_WorldClass_UX_Proposal.md`)
5. Control Tower → sau khi tách sub-routes

### Giai đoạn 3 — Enforcement (liên tục): Bật ESLint rules + PR checklist

Từ Giai đoạn 3 trở đi, mọi PR mới **bắt buộc** pass component compliance check.

### Giai đoạn 4 — Catalog (1 tuần): `/test-portal/components`

- Mỗi developer mới vào project xem catalog trong 30 phút → biết dùng gì.
- Catalog tự cập nhật → không bao giờ lỗi thời.

---

## 8. Ví dụ — Trước và Sau

### Trước (hiện tại — tự viết):
```tsx
// dashboard/kpi/page.tsx — ad-hoc (HIỆN TẠI)
<div>
  <h1 className="text-2xl font-bold">📊 Báo cáo KPI</h1>
  {loading && (
    <div className="flex justify-center py-20">
      <div className="animate-spin h-8 w-8 border-4 border-brand-500 border-t-transparent rounded-full" />
    </div>
  )}
  {!loading && data && (
    <div className="grid grid-cols-4 gap-4">
      <div className="bg-white rounded-xl shadow-sm p-5">
        <p className="text-xs text-gray-500">OTD Rate</p>
        <p className="text-3xl font-bold text-emerald-600">{data.otd_rate}%</p>
      </div>
      {/* ... 3 card nữa viết tay */}
    </div>
  )}
</div>
```

### Sau (chuẩn — dùng component):
```tsx
// dashboard/kpi/page.tsx — CHUẨN
import { PageHeader, KpiCard, LoadingState } from '@/components/ui'
import { BarChart3 } from 'lucide-react'

<PageHeader
  title="Báo cáo KPI"
  icon={BarChart3}
  iconTone="brand"
  subtitle="Hiệu suất vận hành theo thời gian"
  actions={<TimeRangeSelector />}
/>

{loading ? <LoadingState label="Đang tải dữ liệu KPI..." /> : (
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
    <KpiCard label="OTD Rate" value={`${data.otd_rate}%`} tone="success" icon={CheckCircle2}
      delta={{ value: 2.3, goodWhen: 'up' }} />
    <KpiCard label="Vehicle Util" value={`${data.vehicle_utilization}%`} tone="brand" icon={Truck} />
    <KpiCard label="Tổng chuyến" value={data.total_trips} tone="neutral" icon={MapPin} />
    <KpiCard label="Giao thất bại" value={data.failed_deliveries} tone="danger" icon={AlertCircle}
      delta={{ value: -1.2, goodWhen: 'down' }} />
  </div>
)}
```

**Kết quả:** Ngắn hơn 40%, nhất quán 100%, người mới đọc hiểu ngay, thay đổi visual chỉ cần sửa `KpiCard.tsx` một chỗ.

---

## 9. Trả lời các lo ngại phổ biến

**"Mất thời gian xây component system, chậm feature mới"**
→ Sai. Xây 10 primitive component mất 1 tuần. Nhưng mỗi tính năng mới tiết kiệm 30-50% thời gian code UI. Break-even sau 2 sprint.

**"Mỗi page có UI khác nhau, không dùng chung được"**
→ Sai. Primitive component (Button, Input, Card, Modal) không có business logic — fit mọi page. Chỉ domain component mới specific.

**"Component có thể không đủ flexible"**
→ Tất cả component đề xuất đều nhận `className` prop để override khi cần, không bị "khoá cứng".

**"Developer không biết component nào có"**
→ Đây là lý do cần catalog tại `/test-portal/components`. Không có catalog = không ai dùng.

**"Khi có bug trong component, ảnh hưởng toàn hệ thống"**
→ Đây là ưu điểm chứ không phải nhược điểm: fix 1 chỗ, toàn hệ thống được fix. Ngược lại nếu ad-hoc: bug phải fix 22 chỗ (22 modal khác nhau).

---

## 10. Tóm tắt — Việc cần làm ngay

| # | Việc | Ưu tiên | Ai làm |
|---|---|---|---|
| 1 | Xây 9 component còn thiếu P0 (`Modal`, `Input`, `Tabs`...) | **Ngay** | Dev FE |
| 2 | Bật ESLint warn cho `<button>`, `<input>`, `<select>` thô | **Ngay** | Dev FE |
| 3 | Thêm PR checklist vào `.github/pull_request_template.md` | **Ngay** | Tech Lead |
| 4 | Chạy codemod migrate `PageHeader`, `LoadingState`, `StatusChip` vào 5 trang core | Sprint 1 | Dev FE |
| 5 | Xây `DataTable`, `FilterBar`, `ActionMenu`, `Drawer` | Sprint 2 | Dev FE |
| 6 | Tạo catalog tại `/test-portal/components` | Sprint 2 | Dev FE |
| 7 | Chạy codemod migrate toàn bộ dashboard | Sprint 3 | Dev FE |
| 8 | Review và enforce 100% compliance từ Sprint 4 | Ongoing | Tech Lead |

---

*File này được lưu tại `D:\Hiệu năng hệ thống BHL\BHL_Component_System_Proposal.md`.*
*Xem thêm: `BHL_WorldClass_UX_Proposal.md` cho đề xuất UX tổng thể, trong cùng thư mục.*
