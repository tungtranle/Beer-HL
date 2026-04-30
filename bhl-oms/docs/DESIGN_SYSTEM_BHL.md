# BHL OMS-TMS-WMS — Tài liệu Thiết kế Hệ thống (Design System & UX Guide)

> **Phiên bản:** 1.0  
> **Ngày:** 27/04/2026  
> **Trạng thái:** Thực tế (phản ánh code đang chạy)  
> **Đối tượng:** Khách hàng, chuyên gia UX, nhà thiết kế, đội phát triển mới  
> **Nền tảng:** Next.js 14 + Tailwind CSS + TypeScript

---

## Mục lục

1. [Giới thiệu sản phẩm](#1-giới-thiệu-sản-phẩm)
2. [Kiến trúc trải nghiệm người dùng](#2-kiến-trúc-trải-nghiệm-người-dùng)
3. [Design Tokens — Nền tảng thiết kế](#3-design-tokens--nền-tảng-thiết-kế)
4. [Component Library](#4-component-library)
5. [Màn hình theo từng vai trò](#5-màn-hình-theo-từng-vai-trò)
6. [Luồng nghiệp vụ chính](#6-luồng-nghiệp-vụ-chính)
7. [Hệ thống trạng thái & màu sắc](#7-hệ-thống-trạng-thái--màu-sắc)
8. [Navigation & Layout](#8-navigation--layout)
9. [AI-native UX](#9-ai-native-ux)
10. [Responsive & Multi-platform](#10-responsive--multi-platform)
11. [Accessibility & Performance](#11-accessibility--performance)
12. [Nguyên tắc UX bắt buộc](#12-nguyên-tắc-ux-bắt-buộc)

---

## 1. Giới thiệu sản phẩm

**BHL OMS-TMS-WMS** là nền tảng quản lý vận hành phân phối tích hợp cho doanh nghiệp ngành bia, được xây dựng theo tiêu chuẩn thế giới (tham chiếu: Linear, Stripe Dashboard, Shopify Polaris, Uber Freight Operations Console).

### 1.1 Phạm vi sản phẩm

| Module | Mô tả | Nền tảng |
|--------|-------|----------|
| **OMS** — Order Management System | Tạo, duyệt, theo dõi đơn hàng NPP; credit limit; Zalo xác nhận | Web |
| **TMS** — Transport Management System | Lập kế hoạch VRP tối ưu chi phí, giám sát GPS thời gian thực, quản lý tài xế | Web + Mobile PWA |
| **WMS** — Warehouse Management System | Picking FEFO, quét barcode QR/GS1, pallet/bin location, cycle count | Web + PDA PWA |
| **Điều phối (Control Tower)** | Theo dõi đội xe trực tiếp, cảnh báo lệch tuyến, cụm điều phối | Web |
| **Tài chính** | Đối soát chuyến, duyệt công nợ, báo cáo ngày cuối ca | Web |
| **AI Insights** | Dự báo nhu cầu, điểm rủi ro NPP, brief điều phối sáng, outreach queue | Web (progressive enhancement) |

### 1.2 Số liệu quy mô thiết kế

| Chỉ số | Giá trị |
|--------|---------|
| Tổng màn hình (pages) | **60+** (57 routes Next.js) |
| Số vai trò người dùng | **9 roles** |
| Nền tảng hỗ trợ | Web desktop, Driver PWA mobile, PDA scanner, NPP portal |
| Ngôn ngữ giao diện | Tiếng Việt toàn phần |
| Hỗ trợ offline | PWA cache cho driver + PDA |

---

## 2. Kiến trúc trải nghiệm người dùng

### 2.1 Mô hình thiết kế cốt lõi

Hệ thống áp dụng **Role-First Design**: mỗi vai trò có layout, navigation và empty state riêng biệt, được tối ưu cho công việc thực tế của người đó.

```
Người dùng đăng nhập
       │
       ▼
  Role detection
       │
  ┌────┴────────────────────────────────┐
  │                                     │
  ▼                                     ▼
Desktop layout                   Mobile PWA layout
(Dispatcher/Accountant/Admin)    (Driver/PDA Scanner)
       │
  ┌────┴─────────────────────────────────┐
  │ Sidebar nav theo role                │
  │ + Top bar (greeting + thông báo)     │
  │ + Main content area                  │
  └──────────────────────────────────────┘
```

### 2.2 Nguyên tắc thiết kế

**5 quy tắc UX bắt buộc:**

1. **Zero dead ends** — Mọi trang trống (empty state) đều có call-to-action rõ ràng
2. **Instant business feedback** — Mọi thao tác nghiệp vụ (duyệt/từ chối/cập nhật) hiện toast ngay lập tức, không reload page
3. **Role-aware empty states** — Màn hình trống khác nhau theo vai trò (kế toán thấy "Chưa có đơn chờ duyệt" khác với dispatcher)
4. **Trace ID in errors** — Mọi lỗi hiển thị mã lỗi kỹ thuật để hỗ trợ debug (không chỉ "Có lỗi xảy ra")
5. **Driver tap targets** — Nút bấm cho tài xế mobile tối thiểu `h-12` (48px) hoặc `h-14` (56px)

---

## 3. Design Tokens — Nền tảng thiết kế

### 3.1 Màu sắc thương hiệu (Brand Colors)

| Token | Hex | Mô tả | Quy tắc sử dụng |
|-------|-----|-------|-----------------|
| `brand-500` | **#F68634** | BHL Orange — màu chủ đạo | Nút primary, icon accent. Tối đa **10% diện tích visual** |
| `brand-50` | `#fff7ed` | Nền brand nhạt | Background highlight nhẹ |
| `brand-100` | `#ffedd5` | Nền brand | Badge, subtle highlight |
| `brand-600` | `#ea580c` | Hover/pressed | Nút hover state |
| `brand-700` | `#c2410c` | Đậm | Text accent |

> ⚠️ **Cấm nhầm lẫn:** `#F68634` (brand cam) ≠ `#D97706` (amber warning). Không dùng lẫn.

### 3.2 Bảng màu ngữ nghĩa (Semantic Colors)

| Ngữ nghĩa | Màu chính | Nền | Viền | Ứng dụng |
|-----------|-----------|-----|------|-----------|
| **Brand/Primary** | `brand-500` #F68634 | `brand-50` | `brand-200` | CTA chính, link active |
| **Success** | `emerald-600` | `emerald-50` | `emerald-200` | Giao thành công, PASS |
| **Warning** | `amber-500` | `amber-50` | `amber-200` | Chờ xử lý, sắp hết hạn |
| **Danger/Error** | `rose-500` | `rose-50` | `rose-200` | Lỗi, từ chối, thất bại |
| **Info** | `sky-500` | `sky-50` | `sky-200` | Đang vận chuyển, thông tin |
| **Neutral** | `slate-600` | `slate-100` | `slate-200` | Trạng thái nháp, ẩn |
| **Indigo** | `indigo-500` | `indigo-50` | `indigo-200` | Đang xử lý, loading |
| **Violet** | `violet-500` | `violet-50` | `violet-200` | Đã lên kế hoạch |

### 3.3 Typography Scale

```
text-xs   (12px) — Caption, badge label, hint
text-sm   (14px) — Body text, table cell, form label  ← Mặc định
text-base (16px) — Form input, description
text-lg   (18px) — Section title, card heading
text-xl   (20px) — Page sub-heading
text-2xl  (24px) — Page title (dùng PageHeader component, không dùng trực tiếp)
text-3xl  (30px) — Hero metric (KPI dashboard)
```

**Font stack:** `Inter, system-ui, -apple-system, sans-serif` (tự động qua Tailwind)

### 3.4 Spacing & Layout

| Token | Value | Ứng dụng |
|-------|-------|----------|
| `p-3` | 12px | Card padding nhỏ |
| `p-4` | 16px | Card padding chuẩn |
| `p-5` | 20px | Card padding rộng |
| `gap-3` | 12px | Grid gap nhỏ |
| `gap-4` | 16px | Grid gap chuẩn |
| `rounded-lg` | 8px | Card, button chuẩn |
| `rounded-xl` | 12px | Card lớn, modal |
| `shadow-sm` | — | Card elevation mặc định |

### 3.5 Border Radius

| Component | Radius |
|-----------|--------|
| Button | `rounded-lg` (8px) |
| Card | `rounded-xl` (12px) |
| Badge/Chip | `rounded-full` |
| Input | `rounded-lg` (8px) |
| Modal | `rounded-2xl` (16px) |

---

## 4. Component Library

Tất cả component nằm tại `web/src/components/ui/` và `web/src/components/`. Đây là **single source of truth** — các page không tự định nghĩa style lại.

### 4.1 Primitive Components

#### `Button` — Nút bấm thống nhất

**Variants:**
| Variant | Style | Dùng khi |
|---------|-------|----------|
| `primary` | Nền cam BHL + chữ trắng + shadow cam nhẹ | CTA chính (Tạo đơn, Duyệt, Lưu) |
| `secondary` | Nền trắng + viền slate + chữ đậm | Hành động phụ (Hủy, Quay lại) |
| `ghost` | Nền trong suốt + chữ slate | Nút trong toolbar, trong menu |
| `subtle` | Nền cam nhạt + chữ cam đậm | CTA nhẹ, không muốn quá nổi bật |
| `danger` | Nền đỏ + chữ trắng | Xóa, từ chối, thao tác không thể hoàn tác |
| `success` | Nền xanh + chữ trắng | Xác nhận giao hàng, hoàn thành chuyến |

**Sizes:** `sm` (32px), `md` (40px — mặc định), `lg` (48px — driver mobile)

**States:** `loading` (spinner + disabled), `disabled`

```tsx
<Button variant="primary" size="md" leftIcon={PlusCircle}>Tạo đơn hàng</Button>
<Button variant="danger" loading={isDeleting}>Xóa</Button>
<Button variant="secondary" size="lg">Hủy bỏ</Button>
```

---

#### `KpiCard` — Tile chỉ số KPI

Hiển thị một chỉ số nghiệp vụ với icon, nhãn, giá trị, delta và click-through.

```tsx
<KpiCard
  label="Đơn chờ duyệt"
  value={12}
  icon={ClipboardList}
  tone="warning"
  delta={{ value: +3, suffix: " vs hôm qua", goodWhen: "down" }}
  href="/dashboard/approvals"
  pulse={true}
/>
```

**Tones:** `brand`, `info`, `success`, `warning`, `danger`, `neutral`

---

#### `StatusChip` — Badge trạng thái

Hiển thị trạng thái với dot màu + label theo vai trò + countdown timer nếu applicable.

```tsx
<StatusChip status="pending_approval" role="accountant" />
// Hiện: 🟡 Cần duyệt ngay

<StatusChip status="pending_customer_confirm" confirmDeadline="2026-04-27T10:00:00Z" />
// Hiện: 🔵 Chờ NPP xác nhận  ⏱ còn 1:45:30
```

---

#### `PageHeader` — Tiêu đề trang chuẩn

Thay thế các `<h1>` thủ công với cấu trúc: Breadcrumb + Tiêu đề + Actions bar.

---

#### `Card` — Thẻ nội dung

```tsx
<Card>
  <CardHeader title="Thông tin đơn hàng" actions={<Button size="sm">Chỉnh sửa</Button>} />
  {/* content */}
</Card>
```

---

#### `EmptyState` — Màn hình trống

```tsx
<EmptyState
  icon={FileText}
  title="Chưa có đơn hàng nào"
  description="Tạo đơn hàng đầu tiên để bắt đầu theo dõi vận chuyển"
  action={{ label: "Tạo đơn hàng", href: "/dashboard/orders/new" }}
/>
```

---

#### `Skeleton` — Loading placeholder

Thay thế spinner xám — hiển thị skeleton layout trước khi dữ liệu load xong.

```tsx
<SkeletonGrid cols={4} />     // 4 KPI tile skeleton
<SkeletonTable rows={5} />   // Bảng 5 dòng skeleton
```

---

#### `NotificationBell` + `NotificationPanel`

- **Bell**: icon chuông ở topbar, badge đỏ hiện số chưa đọc
- **Panel**: slide-in từ phải (full-height), backdrop overlay, đóng bằng ESC hoặc click ngoài
- **Toast**: popup slide-in khi có thông báo mới qua WebSocket, auto-dismiss 6 giây

---

#### `OrderTimeline` — Dòng thời gian đơn hàng

Timeline world-class: nhóm theo ngày, filter tabs, duration chips màu theo thời gian xử lý, inline note composer.

**Duration chip color coding:**
- `< 30 phút` → xám (bình thường)
- `30 phút – 2 giờ` → amber (cần chú ý)
- `> 2 giờ` → đỏ (quá lâu)

---

#### `OrderStatusStepper` — Thanh tiến trình đơn hàng

5 bước trực quan:
```
[1] Đã tạo đơn → [2] KH xác nhận → [3] Kho xử lý → [4] Đang vận chuyển → [5] Hoàn thành
```
Với banner đặc biệt cho trạng thái phân kỳ: `rejected`, `partially_delivered`, `cancelled`.

---

#### `CommandPalette` — Tìm kiếm nhanh (Cmd+K)

Tìm kiếm global: đơn hàng, khách hàng, chuyến xe, menu items. Hỗ trợ keyboard shortcut `Cmd+K` / `Ctrl+K`.

---

### 4.2 AI Components (`components/ai/`)

Tất cả AI components tuân thủ **progressive enhancement**: chỉ render khi AI feature flag được bật; UI cơ bản vẫn hiển thị đầy đủ khi AI tắt.

| Component | Mô tả |
|-----------|-------|
| `AIInboxPanel` | Panel inbox gợi ý hành động từ AI (dashboard) |
| `DispatchBriefCard` | Brief điều phối buổi sáng tự động (07:00 ICT) |
| `OutreachQueueWidget` | Danh sách NPP cần liên hệ hôm nay (DVKH/management) |
| `DemandIntelligencePanel` | Dự báo nhu cầu NPP×SKU khi tạo đơn |
| `SeasonalDemandAlert` | Cảnh báo biến động mùa vụ inline trong form đơn hàng |
| `CreditRiskChip` | Badge điểm rủi ro tín dụng NPP trong approvals |
| `ExplainabilityPopover` | Giải thích tại sao AI đưa ra gợi ý cụ thể |
| `SimulationCard` | Card kịch bản giả lập "what-if" (chỉ đọc, không mutate) |
| `AIStatusBadge` | Badge trạng thái AI: đang chạy / fallback / tắt |
| `UndoBanner` | Banner hoàn tác (kiểu Gmail) sau hành động có thể rollback |

---

## 5. Màn hình theo từng vai trò

### 5.1 Ma trận quyền truy cập

| Nhóm màn hình | Admin | Giám đốc | Dispatcher | DVKH | Kế toán | Thủ kho | Tài xế | Bảo vệ | Phân xưởng |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| Dashboard (role-specific) | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅(mobile) | — | — |
| Đơn hàng | ✅ | 👁 | ✅ | ✅ | 👁 | — | — | — | — |
| Lập kế hoạch VRP | ✅ | 👁 | ✅ | — | — | — | — | — | — |
| Control Tower | ✅ | ✅ | ✅ | — | — | — | — | — | — |
| Bản đồ GPS | ✅ | — | ✅ | — | — | — | — | — | — |
| WMS (kho) | ✅ | — | — | — | — | ✅ | — | — | — |
| Bàn giao xuất kho | ✅ | — | — | — | — | ✅ | — | — | — |
| Gate check | ✅ | — | — | — | — | — | — | ✅ | — |
| Phân xưởng vỏ | ✅ | — | — | — | — | ✅ | — | — | ✅ |
| Duyệt đơn hàng | ✅ | — | — | — | ✅ | — | — | — | — |
| Đối soát | ✅ | 👁 | — | — | ✅ | — | — | — | — |
| KPI / Báo cáo | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — | — | — |
| Cài đặt hệ thống | ✅ | — | — | — | — | — | — | — | — |
| AI Settings | ✅ | — | — | — | — | — | — | — | — |
| Trip detail (mobile) | — | — | — | — | — | — | ✅ | — | — |

*(👁 = chỉ xem, không sửa)*

---

### 5.2 Dashboard — Tổng quan vai trò

Dashboard root (`/dashboard`) tùy biến theo vai trò:

#### Dispatcher (Điều phối viên)
```
┌─────────────────────────────────────────────────────────┐
│ Chào buổi sáng, Văn Hải ☀️          🔔(3)             │
├─────────────────────────────────────────────────────────┤
│ [Đơn chờ xếp xe: 8] [Xe đang chạy: 5] [ETA trễ: 1]   │
│ [Lái xe online: 7 ] [Chuyến hôm nay: 12]               │
├─────────────────────────────────────────────────────────┤
│ AI Brief sáng: "Hôm nay 12 chuyến, 1 NPP Hạ Long có   │
│ đơn ưu tiên. Gợi ý bắt đầu lập kế hoạch từ bây giờ." │
├─────────────────────────────────────────────────────────┤
│ Việc cần làm:                                           │
│ → [Lập kế hoạch VRP] 8 đơn chờ                        │
│ → [Xem Control Tower] 1 xe báo trễ ETA                │
└─────────────────────────────────────────────────────────┘
```

#### Kế toán (Accountant)
```
[Chờ duyệt: 5] [Nợ quá hạn: 2] [Đối soát hôm nay: 12]
→ Approvals inbox (highlight đơn quá 2h chờ)
→ Credit risk chips
→ Daily close reminder (T+1)
```

#### DVKH (Customer Service)
```
[Đơn hôm nay: 25] [Chờ NPP xác nhận: 3] [Đơn mới: 8]
→ Outreach queue AI (NPP cần liên hệ)
→ Demand intelligence gợi ý
```

#### Quản lý / Ban giám đốc
```
[Doanh thu hôm nay: 1.2 tỷ] [OTD: 94.2%]
→ KPI charts với delta vs hôm qua
→ Top NPP theo doanh thu
→ Fleet utilization summary
```

#### Thủ kho
```
[Phiếu picking hôm nay: 12] [Tồn thấp: 3 SKU]
[Pallet cần putaway: 5] [Cycle count pending: 2]
```

---

### 5.3 Màn hình OMS

#### Danh sách đơn hàng (`/dashboard/orders`)
- **Layout:** Search bar + Filter chips (trạng thái, kho, ngày, NPP) — sticky header
- **Table:** Responsive với expand row, quick actions hover (view / approve / giao bổ sung)
- **URL params:** `?status=pending_approval` → pre-filter tự động
- **Control desk stats:** 6 chỉ số KPI top (gom từ 12 raw metrics)
- **Pagination:** Chuẩn, hiển thị tổng số

#### Chi tiết đơn hàng (`/dashboard/orders/[id]`)
- **Header:** Mã đơn + `OrderStatusStepper` (5 bước)
- **`WaitingForBanner`:** Banner sticky "Đang chờ..." theo trạng thái hiện tại (10 statuses)
- **`PinnedNotesBar`:** Top-3 ghi chú ghim, màu amber
- **Tabs:** `📦 Sản phẩm` / `📜 Lịch sử & Ghi chú` / `💷 ePOD`
- **Timeline:** World-class — nhóm ngày, filter tabs, duration chips, inline note composer, pin/unpin
- **`CreditAgingChip`:** Chỉ số công nợ (>7d amber, >14d đỏ, >30d solid đỏ)

#### Tạo đơn hàng (`/dashboard/orders/new`)
- **Form:** Chọn NPP → Chọn kho → Thêm sản phẩm → ATP check → Xác nhận
- **`DemandIntelligencePanel`:** AI gợi ý số lượng dự kiến theo lịch sử (khi AI flag ON)
- **`SeasonalDemandAlert`:** Cảnh báo biến động mùa vụ inline
- **Credit check:** Tự động khi tổng tiền vượt hạn mức → hiển thị warning rõ ràng

---

### 5.4 Màn hình TMS

#### Lập kế hoạch VRP (`/dashboard/planning`)
**Đây là màn hình phức tạp nhất** — 3 giai đoạn trong cùng một page:

1. **Chọn ngày + đơn hàng chờ** — Filter theo kho, ngày
2. **Thiết lập ràng buộc** — Số xe, trọng tải, thời gian
3. **Chạy VRP + Kết quả**:
   - **Cost Readiness Status** box: ✅ xanh (đủ dữ liệu) / ⚠️ amber (thiếu)
   - **KPI Results:** 2 hàng — hàng 1: chi phí (8 card) + hàng 2: vận hành (6 card)
   - **Per-trip cost badge:** ⛽ nhiên liệu + 🚏 phí cầu đường
   - **Toll visualization:** 🟠 trạm hở / 🔵 cao tốc trên bản đồ
   - **Progress bar real-time** (WebSocket + polling fallback)
   - **Scenario management:** Lưu/Tải kịch bản

#### Control Tower (`/dashboard/control-tower`)
**Trung tâm giám sát thời gian thực:**

```
┌─────────────────────────────────────────────────────────────┐
│ KPI bar (sticky): [12 xe online] [3 ETA trễ] [1 lệch tuyến]│
├────────────────────┬────────────────────────────────────────┤
│ Danh sách chuyến   │           BẢN ĐỒ GPS (full-bleed)     │
│ (virtualized list) │                                        │
│                    │  • SVG truck markers (rotation+badge)  │
│ • Progress bar     │  • Route polyline cam đứt nét          │
│ • ETA countdown    │  • Stop markers màu theo status        │
│ • Lệch tuyến Xkm   │  • Off-route detection ~1.2km          │
│                    │                                        │
│                    │  Controls: [Toàn màn hình][Mở rộng map]│
│                    │  [Tile: OSM ↔ Vệ tinh Esri]            │
├────────────────────┴────────────────────────────────────────┤
│ Drawer cảnh báo: Exceptions (failed_stop / late_eta / idle) │
└─────────────────────────────────────────────────────────────┘
```

**Tính năng map:**
- Marker xe: SVG với hướng xoay, biển số, glow animation
- Click marker → Vehicle Focus Panel cố định (không modal)
- Click polyline → chọn chuyến tương ứng + flyTo
- Toggle `Mở rộng bản đồ` / `Toàn màn hình`
- GPS Simulator button (chỉ dùng data từ DB)
- Quick actions: `Theo dõi xe` / `Mở Google Maps`

**WS flow:** Frontend kết nối trực tiếp `/ws/gps` backend (không qua Next.js proxy)

---

### 5.5 Màn hình WMS (Kho)

#### Dashboard kho (`/dashboard/warehouse`)
- 4 KPI tiles: Phiếu picking hôm nay / Tồn thấp / Pallet cần putaway / Cycle count
- Quick links nhóm: "Quy trình chính" (5 nút lớn) + "Tham khảo" (link nhỏ)

#### Picking by Vehicle (`/dashboard/warehouse/picking-by-vehicle`)
- KPI cards + Filter tabs (Tất cả / Đang soạn / Chờ)
- Vehicle cards expandable với FEFO badges, progress bars, per-stop orders
- Badge "Soạn trước" cho item đầu tiên trong queue

#### Scan (`/dashboard/warehouse/scan`) — PWA PDA
- **Dual-input:** Keyboard (PDA hardware scanner) + Camera (BarcodeDetector API)
- Parser GS1-128: hỗ trợ QR / Data Matrix / Code 128
- Full-screen scan UI, minimal UI → tối ưu cho màn hình nhỏ PDA

#### Inbound (`/dashboard/warehouse/inbound`)
- Form nhận hàng → sinh SSCC GS1 tự động → in nhãn ZPL
- Suggest bin: 3 gợi ý slot tốt nhất theo velocity class

#### Putaway (`/dashboard/warehouse/putaway`)
- Lookup LPN → 3 bin suggestions → confirm / override + lý do

#### Loading (`/dashboard/warehouse/loading`)
- Gắn chuyến + biển số xe → loop scan pallet → complete
- Validate biển số vs vehicles DB

#### Cycle Count (`/dashboard/warehouse/cycle-count`)
- Generate tasks theo velocity class A/B/C
- Modal scan submit + variance auto → discrepancy

#### Bin Map (`/dashboard/warehouse/bin-map`)
- Canvas heatmap occupancy 5 mức màu
- Click drill-down chi tiết bin

#### Realtime Dashboard (`/dashboard/warehouse/dashboard`)
- 4 alert widgets, polling 10 giây:
  - 🔴 Tồn dưới safety stock
  - 🟠 Lô sắp hết hạn (> 100 thùng)
  - 🟡 Bins > 90% đầy
  - ⚠️ Orphan pallets (pallet không có bin assignment)

---

### 5.6 Tài xế — Mobile PWA

Giao diện mobile-first, thiết kế cho **ngón cái** (thumb-zone), không có sidebar desktop.

**Bottom navigation (4 tab):**
```
[🏠 Tổng quan] [📍 Chuyến xe] [📦 Giao hàng] [👤 Hồ sơ]
```

**Dashboard tài xế:**
- Hero gradient
- 3 KPI tiles (Chuyến hôm nay, Điểm giao, Tiến độ %)
- Progress ring cho chuyến đang chạy
- Large CTA nút "Bắt đầu chuyến" / "Báo cáo"

**Trip detail flow (state machine):**
```
Chờ khởi hành
    → [Bắt đầu chuyến]
        → Điểm giao: Đang đến → Đã đến → Đang giao
            → ePOD (≥1 ảnh bắt buộc) → Đã giao
            → Thất bại (chọn lý do)
        → [Hoàn thành checklist 6 mục]
    → Kết thúc chuyến
```

**Tap targets:** Tất cả nút action `min-h-12` (48px), nút chính trip `min-h-14` (56px)

**Google Maps navigation:** Deep-link tự động từ stop detail.

---

### 5.7 Màn hình Bảo vệ (Gate Check)

```
/dashboard/gate-check
```

Đây là một trong những màn hình UX tốt nhất hệ thống:
- Full-screen PASS state (nền xanh) / FAIL state (nền đỏ)
- Queue chuyến chờ kiểm hóa ngày hôm nay với count badge
- Dropdown lý do FAIL bắt buộc (6 lý do)
- Sound feedback ngay khi scan

---

### 5.8 Màn hình Kế toán

#### Duyệt đơn (`/dashboard/approvals`)
- Queue đơn chờ duyệt với `CreditRiskChip` AI
- `CreditAgingChip` — aging công nợ
- Thông tin đầy đủ: đơn hàng + items + lịch sử credit NPP
- **Approve/Reject** với dialog xác nhận lý do

#### Đối soát (`/dashboard/reconciliation`)
- Tabs: Tất cả / Tiền / Hàng / Vỏ
- T+1 countdown badges (deadline giải quyết)
- Action history modal — timeline giải quyết sự cố
- Sub-tabs `Chênh lệch` với resolve + notes
- **Excel export** (tiếng Việt)

#### Daily Close (`/dashboard/eod`)
- Nhận kết ca kho — checklist xác nhận cuối ngày
- Báo cáo tóm tắt trước khi khóa sổ

---

### 5.9 Màn hình Admin

#### Settings hub (`/dashboard/settings`)
- **Users** — CRUD + reset password + soft delete
- **Sessions** — Xem + terminate sessions
- **Permissions** — Permission Matrix Editor: toggle quyền theo role
- **Credit Limits** — Quản lý hạn mức công nợ NPP + audit trail
- **Transport Costs** — 4 tabs: Trạm thu phí / Cao tốc / Phương tiện / Tài xế
- **System Configs** — Cấu hình hệ thống (cutoff giờ, etc.)
- **Routes** — Quản lý tuyến giao hàng
- **Audit Logs** — Log thay đổi hệ thống với diff view
- **Health Monitor** (`/dashboard/settings/health`) — Status PostgreSQL / Redis / VRP solver + Build info (commit SHA, branch, deploy time)
- **AI Settings** (`/dashboard/settings/ai`) — Master AI switch + feature flags per role

---

### 5.10 Màn hình AI

#### AI Transparency (`/dashboard/ai/transparency`)
- Lịch sử quyết định AI — khi nào AI đề xuất gì, với dữ liệu nào
- Privacy Router status — phân loại dữ liệu local/cloud

#### AI Simulations (`/dashboard/ai/simulations`)
- "What-if" scenarios (chỉ đọc, không mutate business data)
- `approval_required=true` cho mọi kịch bản apply

---

## 6. Luồng nghiệp vụ chính

### 6.1 Quy trình đặt hàng và giao hàng (End-to-End)

```
DVKH tạo đơn
     │
     ▼
Hệ thống kiểm tra ATP + Credit
     │
     ├─── Vượt hạn mức ──► [Chờ kế toán duyệt]
     │                          │
     │                     Kế toán approve
     │                          │
     └────────────────────────────────►
                    │
                    ▼
         NPP nhận Zalo ZNS (link xác nhận)
                    │
             ┌──────┴──────┐
             │             │
          Xác nhận      Từ chối
             │             │
             ▼             ▼
       Tạo shipment   Hủy đơn + hoàn tồn kho
             │
             ▼
    Dispatcher lập kế hoạch VRP
             │
             ▼
    Thủ kho picking + bàn giao
             │
             ▼
    Tài xế chạy + ePOD
             │
     ┌───────┴────────┐
     │                │
  Giao đủ         Giao thiếu / Thất bại
     │                │
     ▼                ▼
  Reconcile      Giao bổ sung hoặc Hủy đơn
     │
     ▼
  Kế toán daily close
```

### 6.2 Quy trình VRP (Vehicle Routing Problem)

```
Chọn ngày + đơn hàng chờ
     │
     ▼
Kiểm tra Cost Readiness (toll stations, vehicle profiles)
     │
     ▼
Thiết lập ràng buộc (max vehicles, time limit)
     │
     ▼
Python OR-Tools solver (port :8090)
     ├── OSRM route geometry → toll detection trên đường thực
     ├── Cost optimization: fuel (24,500đ/L) + toll
     └── Progress real-time qua WebSocket
     │
     ▼
Kết quả: N chuyến + breakdown chi phí
     │
     ▼
Dispatcher review + approve plan
     │
     ▼
Tự động tạo Trips + Stops trong DB
```

### 6.3 Quy trình WMS Phase 9 (Pallet/LPN)

```
Nhận hàng (Inbound)
     │ Sinh SSCC GS1, in nhãn ZPL
     ▼
Putaway (gán bin)
     │ 3 gợi ý theo velocity class A/B/C
     ▼
Picking (soạn hàng)
     │ FEFO ASC + override + lý do
     ▼
Loading (xếp xe)
     │ Validate biển số xe
     ▼
Gate Check (bảo vệ)
     │ Kiểm hóa, ký bàn giao
     ▼
Cycle Count (định kỳ)
     │ Generate A/B/C, variance → discrepancy
     ▼
Bin Map (giám sát)
     │ Canvas heatmap, click drill-down
```

---

## 7. Hệ thống trạng thái & màu sắc

### 7.1 Trạng thái đơn hàng (18 states)

| Trạng thái | Màu | Label mặc định | Label DVKH | Label Kế toán |
|---|---|---|---|---|
| `draft` | ⚪ Stone | Nháp | Nháp | Nháp |
| `pending_customer_confirm` | 🔵 Blue | Chờ NPP xác nhận | Chờ NPP xác nhận | Chờ NPP |
| `pending_approval` | 🟡 Amber | Chờ duyệt hạn mức | Chờ Kế toán duyệt | **Cần duyệt ngay** |
| `confirmed` | 🟢 Teal | Đã xác nhận | Đã xác nhận | Đã xác nhận |
| `processing` | 🔷 Indigo | Đang soạn hàng | Kho đang xử lý | — |
| `planned` | 🟣 Violet | Đã xếp xe | — | — |
| `picking` | 🟠 Orange | Đang đóng hàng | Kho đang chuẩn bị | — |
| `loaded` | 💜 Purple | Đã lên xe | — | — |
| `in_transit` | 🔵 Sky | Đang giao | Đang giao | — |
| `delivered` | 🟢 Green | Đã giao | Giao thành công | — |
| `partially_delivered` | 🟡 Amber | Giao thiếu | **Giao thiếu — cần xử lý** | — |
| `rejected` | 🔴 Red | Khách từ chối | **Khách từ chối — cần xử lý** | — |
| `re_delivery` | 🟠 Orange | Giao lại | Đang giao lại | — |
| `on_credit` | 🩷 Pink | Công nợ | — | **Công nợ — chưa thu** |
| `cancelled` | ⚫ Gray | Đã hủy | — | — |
| `completed` | 🟢 Emerald | Hoàn thành | — | — |

> **Nguyên tắc:** Label thay đổi theo vai trò để phản ánh hành động cần thiết của người đó. Màu không đổi.

### 7.2 Trạng thái chuyến xe (17 states)

| Nhóm | Các state | Màu |
|------|-----------|-----|
| Khởi đầu | `pending`, `assigned`, `ready` | Gray → Blue |
| Đang chạy | `in_transit`, `delivering` | Sky blue (đậm) |
| Giao hàng | `partially_completed`, `completed_stops` | Teal |
| Kết thúc | `handover_a_signed`, `unloading_returns`, `settling` | Purple/Violet |
| Hoàn thành | `completed`, `reconciled` | Emerald |
| Sự cố | `vehicle_breakdown`, `cancelled` | Red/Gray |

### 7.3 Màu trạng thái đối soát

| State | Màu | Ý nghĩa |
|-------|-----|---------|
| `pending` | 🟡 Amber | Chưa xử lý |
| `matched` | 🟢 Green | Khớp số liệu |
| `discrepancy` | 🔴 Red | Có chênh lệch |
| `resolved` | 🔵 Blue | Đã giải quyết |
| `closed` | ⚫ Gray | Đã đóng |

---

## 8. Navigation & Layout

### 8.1 Layout Web Desktop

```
┌─────────────────────────────────────────────────────────┐
│ [≡] BHL Logo    Tổng quan / Đơn hàng      🔔(3) Văn Hải│ ← Topbar (h-14)
├──────────┬──────────────────────────────────────────────┤
│          │                                              │
│ SIDEBAR  │             MAIN CONTENT                    │
│  w-64    │                                              │
│ (col-    │  PageHeader (breadcrumb + title + actions)  │
│  lapsible│  ─────────────────────────────────────────  │
│  w-16)   │  Content area (max-w-7xl mx-auto px-4)      │
│          │                                              │
│  Grouped │                                              │
│  nav     │                                              │
│          │                                              │
└──────────┴──────────────────────────────────────────────┘
```

**Sidebar groups:**
1. `null` (ungrouped): Dashboard, Đơn hàng, Tạo đơn, Chuyến xe
2. `Điều phối`: Lập kế hoạch, Control Tower, Bản đồ GPS
3. `Danh mục`: Sản phẩm, Khách hàng, Phương tiện, Tài xế
4. `Kho & Bàn giao`: Kho, Quét barcode, Bàn giao, Gate check, Workshop, EOD
5. `Tài chính`: Duyệt đơn, Đối soát, Báo cáo
6. `Hệ thống`: Thông báo, Cài đặt

**Sidebar collapse:** Toggle `PanelLeftClose` / `PanelLeft` — thu gọn về `w-16` chỉ hiện icon.

### 8.2 Layout Mobile PWA (Driver)

```
┌─────────────────────────┐
│ [←] Trip #CT-001        │ ← Native-style header
├─────────────────────────┤
│                         │
│     MAIN CONTENT        │
│     (full-bleed)        │
│                         │
│                         │
│                         │
├─────────────────────────┤
│ 🏠 | 📍 | 📦 | 👤      │ ← Bottom nav (h-16 safe-area)
└─────────────────────────┘
```

### 8.3 Notification System

**4-layer delivery:**
1. **In-app** — Bell icon + slide-in panel
2. **Toast** — Slide-in popup 6s (high) / persistent (urgent)
3. **Sound/Vibration** — Theo priority level
4. **Zalo ZNS** — External (mock mode hiện tại)

**Priority levels:** `urgent` (đỏ) / `high` (cam) / `normal` (xanh) / `low` (xám)

---

## 9. AI-native UX

### 9.1 Nguyên tắc AI Progressive Enhancement

> **Quy tắc bắt buộc:** AI là **progressive enhancement**. Core workflow phải hoạt động hoàn toàn khi AI tắt. Không có AI nào block page render.

```
Baseline UI luôn render đầu tiên
           │
           ▼
   Kiểm tra AI feature flag
           │
     ┌─────┴─────┐
  AI OFF       AI ON
     │             │
  Render         Thêm AI
  baseline      component
  (không         lên trên
  thay đổi)      baseline
```

### 9.2 Feature Flags hệ thống

| Flag | Mô tả | Default |
|------|-------|---------|
| `ai.master` | Master switch — tắt tất cả AI | OFF |
| `ai.briefing` | Brief điều phối sáng | OFF |
| `ai.forecast` | Dự báo nhu cầu + cảnh báo mùa vụ trong form đơn | OFF |
| `ai.credit_score` | Điểm rủi ro tín dụng NPP | OFF |
| `ai.gps_anomaly` | Điểm bất thường xe/tuyến | OFF |
| `ai.voice` | Lệnh thoại tài xế có xác nhận | OFF |
| `ai.intent` | Intent layer trong command palette | OFF |
| `ai.simulation` | Kịch bản giả lập what-if | OFF |
| `ai.explainability` | Nút “Vì sao?” / trust metadata | OFF |
| `ai.feedback` | Feedback correct/wrong/not useful | OFF |

### 9.2b Decision Intelligence UX

AI surface dùng theo attention budget, không dùng một kiểu card lớn cho mọi insight:

| Loại AI | UI chuẩn | Khi dùng |
|---|---|---|
| Passive hint | Chip nhỏ | Insight phụ trong bảng/form |
| Context warning | `AIContextStrip` inline | Rủi ro NPP, VRP review, anomaly cần chú ý |
| Decision support | Drawer/popover “Vì sao?” | Cần xem factors/source/data freshness |
| High-stakes action | Confirmation flow | Approval, voice write action, apply simulation |
| Governance | Trang AI riêng | Settings, transparency, simulation lab |

Brand orange `#F68634` là AI accent/dot, không dùng thay amber/rose warning. Confidence phải đi kèm nguồn/dữ liệu mới đến đâu khi có thể.

### 9.3 Privacy Router

AI không bao giờ gửi dữ liệu nhạy cảm ra ngoài:

| Loại dữ liệu | Xử lý |
|---|---|
| SĐT, email, CCCD, địa chỉ cụ thể | **Local-only** — không ra cloud |
| Dữ liệu kinh doanh nhạy cảm (doanh thu, hạn mức) | **Redacted** — mã hóa trước khi gửi |
| Dữ liệu tổng hợp, không nhận dạng được | **Cloud-safe** — gửi được |
| Input rỗng | **Blocked** — không gửi |

Raw prompt không lưu vào DB; chỉ lưu `request_hash`.

### 9.4 Fallback Chain

```
Gemini (primary)
    │ fail / timeout
    ▼
Groq (secondary)
    │ fail / timeout
    ▼
Rules Engine (local, luôn available)
```

---

## 10. Responsive & Multi-platform

### 10.1 Breakpoints

| Breakpoint | Viewport | Target |
|------------|----------|--------|
| `sm` | ≥ 640px | Tablet portrait |
| `md` | ≥ 768px | Tablet landscape |
| `lg` | ≥ 1024px | Desktop (mặc định cho dispatcher/accountant) |
| `xl` | ≥ 1280px | Wide desktop |

### 10.2 Platform-specific

| Platform | Tối ưu cho | Screen size | Input |
|----------|-----------|-------------|-------|
| **Web Desktop** | Dispatcher, Kế toán, Admin | 1280px+ | Mouse + keyboard |
| **Driver PWA** | Tài xế | 390px (iPhone) | Touch, ngón cái |
| **PDA Scanner** | Thủ kho | 480px | Hardware scanner + touch |
| **NPP Portal** | Nhà phân phối | Any | Touch + mouse |

### 10.3 PWA Features (Driver + PDA)

- Service Worker cache (offline read của trips và orders)
- Camera API (`BarcodeDetector`) cho quét barcode
- Vibration API khi quét thành công / thất bại
- `prefers-color-scheme` (dark mode ready — Sprint UX-3)
- `viewport-fit=cover` cho iPhone notch

---

## 11. Accessibility & Performance

### 11.1 Accessibility (WCAG 2.1 AA — đang cải thiện)

**Đã thực hiện:**
- `focus-visible:ring-2` trên tất cả interactive elements
- `aria-label` cho icon buttons
- Contrast đủ cho text trên nền trắng
- Keyboard navigation: Tab, Shift+Tab, Enter, Esc

**Sprint UX-3 (planned):**
- `aria-live` cho real-time updates (GPS, notifications)
- Screen reader labels cho biểu đồ
- Focus trap trong modals
- Skip-to-content link

### 11.2 Performance

**Hiện trạng (AQF G2):**
- `next build` — PASS (57 static/dynamic routes)
- `tsc --noEmit` — 0 TypeScript errors
- ESLint — 0 errors (465 intentional warnings)

**Tối ưu đã áp dụng:**
- `loading.tsx` per-route cho Suspense boundary
- WebSocket chỉ kết nối khi cần (lazy init)
- GPS polling fallback khi WS fail
- Real-time planning progress: WebSocket + polling fallback (tránh stuck 0%)
- Next.js Image optimization cho ePOD photos
- Standalone output (Docker production)

**Target (Sprint UX-3):**

| Metric | Hiện tại | Target |
|--------|----------|--------|
| Lighthouse Performance | ~75 | > 90 |
| Lighthouse Accessibility | ~78 | 100 |
| FCP (First Contentful Paint) | ~2.1s | < 1.2s |
| TTI (Time to Interactive) | ~3.5s | < 2.5s |

---

## 12. Nguyên tắc UX bắt buộc

### 12.1 Checklist trước khi release page mới

- [ ] Có `EmptyState` component (không dùng text raw)
- [ ] Có `Skeleton` loading (không dùng spinner đơn thuần)
- [ ] Dùng `Button` primitive (không ad-hoc)
- [ ] Dùng `KpiCard` cho metric tile
- [ ] Dùng `StatusChip` cho status badge
- [ ] Dùng `PageHeader` cho tiêu đề trang
- [ ] Toast cho mọi action thành công/thất bại
- [ ] `ErrorBoundary` hoặc try-catch với toast lỗi có trace ID
- [ ] Role-aware: chỉ hiện menu item / nút phù hợp vai trò
- [ ] AI components gated bằng `useAIFeature` hook

### 12.2 Anti-patterns bị cấm

| Anti-pattern | Lý do | Thay bằng |
|---|---|---|
| `<h1 className="text-2xl font-bold text-gray-800 mb-2">` | Không hierarchy | `PageHeader` component |
| Spinner `border-brand border-t-transparent` duy nhất | UX nghèo nàn | `Skeleton` + `LoadingState` |
| Empty state text 1 dòng | Không hướng dẫn | `EmptyState` component |
| `console.error` thay toast | Silent fail | `toast.error()` + trace ID |
| `float64` cho tiền | Sai số tính toán | `decimal.Decimal` / `NUMERIC(15,2)` |
| Màu amber/warning thay brand | Nhầm lẫn brand identity | `#F68634` chỉ là brand cam |
| Modal full-screen cho task ngắn | Overwhelm mobile | Bottom sheet / drawer |
| Hardcode màu hex | Không nhất quán | Design tokens `brand-500`, etc. |

### 12.3 Quy tắc màu sắc

```
Brand #F68634  ──── CTA chính, icon accent (≤10% visual area)
Emerald       ──── Thành công, PASS gate, hoàn thành
Amber         ──── Cảnh báo, chờ xử lý, sắp hết hạn
Rose/Red      ──── Lỗi, từ chối, thất bại, xóa
Sky/Blue      ──── Đang xử lý, in transit, thông tin
Slate         ──── Text chính, nền neutral, disabled
```

### 12.4 Quy tắc responsive

- **Desktop (≥1024px):** Sidebar 256px + main content `max-w-7xl mx-auto`
- **Mobile (Driver/PDA):** Full-bleed layout + bottom navigation
- **Bảng (table):** `overflow-x-auto` wrapper bắt buộc, tránh vỡ layout
- **Cards grid:** `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` pattern

---

## Phụ lục A — Inventory màn hình (thực tế)

| Route | Module | Vai trò | Loại |
|-------|--------|---------|------|
| `/login` | Auth | Tất cả | Static |
| `/dashboard` | Home | Tất cả (role-specific) | Dynamic |
| `/dashboard/orders` | OMS | Dispatcher, DVKH, Admin | Dynamic |
| `/dashboard/orders/new` | OMS | Dispatcher, DVKH, Admin | Interactive |
| `/dashboard/orders/[id]` | OMS | Tất cả | Dynamic |
| `/dashboard/planning` | TMS | Dispatcher, Admin | Complex |
| `/dashboard/control-tower` | TMS | Dispatcher, Admin, Management | Real-time |
| `/dashboard/map` | TMS | Dispatcher, Admin | Real-time map |
| `/dashboard/trips` | TMS | Dispatcher, Admin | Dynamic |
| `/dashboard/vehicles` | TMS | Dispatcher, Admin | CRUD |
| `/dashboard/vehicles/[id]/documents` | TMS | Dispatcher, Admin | CRUD |
| `/dashboard/drivers-list` | TMS | Dispatcher, Admin | CRUD |
| `/dashboard/drivers-list/[id]/documents` | TMS | Dispatcher, Admin | CRUD |
| `/dashboard/warehouse` | WMS | Warehouse, Admin | Dashboard |
| `/dashboard/warehouse/scan` | WMS | Warehouse | PWA Scanner |
| `/dashboard/warehouse/inbound` | WMS | Warehouse | Form |
| `/dashboard/warehouse/putaway` | WMS | Warehouse | Interactive |
| `/dashboard/warehouse/loading` | WMS | Warehouse | Interactive |
| `/dashboard/warehouse/picking` | WMS | Warehouse | List |
| `/dashboard/warehouse/picking-by-vehicle` | WMS | Warehouse | Complex |
| `/dashboard/warehouse/cycle-count` | WMS | Warehouse | Interactive |
| `/dashboard/warehouse/dashboard` | WMS | Warehouse | Realtime |
| `/dashboard/warehouse/bin-map` | WMS | Warehouse | Canvas viz |
| `/dashboard/handover-a` | WMS | Warehouse | Form |
| `/dashboard/gate-check` | Security | Security, Admin | Real-time |
| `/dashboard/workshop` | Workshop | Workshop | Form |
| `/dashboard/approvals` | Finance | Accountant, Admin | Queue |
| `/dashboard/reconciliation` | Finance | Accountant, Admin | Complex |
| `/dashboard/eod` | Finance | Accountant, Warehouse, Dispatcher | Checklist |
| `/dashboard/kpi` | Reports | Management, Admin | Charts |
| `/dashboard/customers` | OMS | DVKH, Dispatcher, Admin | CRUD |
| `/dashboard/products` | OMS | DVKH, Dispatcher, Admin | CRUD |
| `/dashboard/notifications` | Notify | Tất cả | List |
| `/dashboard/anomalies` | AI | Admin, Management | AI panel |
| `/dashboard/ai/transparency` | AI | Admin | Dashboard |
| `/dashboard/ai/simulations` | AI | Admin, Dispatcher | Interactive |
| `/dashboard/settings` | Admin | Admin | Hub |
| `/dashboard/settings/health` | Admin | Admin | Dashboard |
| `/dashboard/settings/permissions` | Admin | Admin | Matrix |
| `/dashboard/settings/audit-logs` | Admin | Admin | List |
| `/dashboard/settings/credit-limits` | Admin | Admin | CRUD |
| `/dashboard/settings/transport-costs` | Admin | Admin | CRUD (4 tabs) |
| `/dashboard/settings/ai` | Admin | Admin | Toggle |
| `/dashboard/settings/routes` | Admin | Admin | CRUD |
| `/dashboard/driver` | Driver | Driver | PWA mobile |
| `/dashboard/driver/[id]` | Driver | Driver | PWA mobile |
| `/dashboard/pda-scanner` | WMS | Warehouse | PWA PDA |
| `/test-portal` | QA | Admin, Management | AQF Command Center |
| `/v1/confirm/:token` (public) | NPP Portal | NPP | Public page |
| `/v1/order-confirm/:token` (public) | Order Portal | NPP | Public page |

**Tổng: 50+ routes (57 theo Next.js build)**

---

## Phụ lục B — Tech Stack Frontend

| Layer | Tech | Phiên bản |
|-------|------|-----------|
| Framework | Next.js | 14.x (App Router) |
| Language | TypeScript | 5.x |
| Styling | Tailwind CSS | 3.x |
| Icons | Lucide React | — |
| HTTP | Native `fetch` qua `apiFetch` wrapper | — |
| WebSocket | Native browser WS API | — |
| Charts | Recharts | — |
| Maps | Leaflet + React Leaflet | — |
| Map tiles | CARTO Light (default) / Esri Satellite (toggle) | — |
| Routing (car) | OSRM local `:5000` (Vietnam data) | — |
| Barcode | BarcodeDetector API (PWA) | — |
| Monitoring | Sentry (frontend + backend) | — |
| Analytics | Microsoft Clarity | — |
| Testing | Playwright (E2E) | — |
| Build output | Next.js standalone (Docker/Linux production) | — |

---

*Tài liệu này phản ánh trạng thái code thực tế tính đến ngày 27/04/2026.*  
*Cập nhật theo: CURRENT_STATE.md + code `web/src/`*
