# BHL OMS-TMS-WMS — UX VIBE CODING SPEC v5.0
## Delta từ v4: 8 tính năng MỚI trích xuất từ UX Analysis

> **ĐỌC v4 TRƯỚC** — file này chỉ chứa delta (phần thêm mới).
> v4 vẫn là master — v5 bổ sung, KHÔNG thay thế.

---

## CHANGE LOG v4 → v5

| # | Tính năng mới | Section | Status | Ghi chú |
|---|--------------|---------|--------|---------|
| 1 | **Picking by Vehicle** — soạn hàng gom theo xe | §16 | ✅ Implemented | Backend + Frontend done |
| 2 | **PinnedNotes** — ghi chú ghim đầu order detail | §17 | 🔲 Spec only | P1 |
| 3 | **Notes inline Timeline** — note hiện trong timeline thay vì tab riêng | §18 | 🔲 Spec only | P1 |
| 4 | **"Đang chờ ai" sticky banner** — hiện rõ ai cần hành động | §19 | 🔲 Spec only | P1 |
| 5 | **Credit Aging Chip** — công nợ quá T+7 hiện chip cảnh báo | §20 | 🔲 Spec only | P1 |
| 6 | **Duration Chips enhanced** — hiện thời gian chờ tại mỗi trạng thái | §21 | 🔲 Spec only | P2 |
| 7 | **note_type fix** — backend + DB thiếu column | §22 | 🔲 Spec only | P0 Bug |
| 8 | **Timeline KPI Bar** — 4 thẻ KPI đầu timeline | §23 | 🔲 Spec only | P1 |

---

## §16. PICKING BY VEHICLE (✅ IMPLEMENTED)

### Mục đích
Thủ kho nhìn tổng hợp hàng cần soạn **gom theo xe** thay vì theo từng shipment rời rạc.
Giảm sai sót khi có nhiều đơn trên cùng xe, tránh lẫn lộn giữa các chuyến.

### Backend API

```
GET /v1/warehouse/picking-by-vehicle?date=YYYY-MM-DD
Authorization: Bearer <token> (role: warehouse_handler, admin)
```

**Response shape:**
```typescript
interface VehiclePickingWorkbench {
  trip_id: string
  trip_number: string
  vehicle_plate: string
  driver_name: string
  departure_time: string   // ISO 8601
  total_stops: number
  status: string           // trip status
  picking_items: {         // aggregated across all stops
    product_id: string
    product_name: string
    product_sku: string
    total_qty: number      // cần soạn
    picked_qty: number     // đã soạn
    fefo_lot: string       // lô gợi ý (FEFO: expiry ASC)
    expiry_date: string
  }[]
  orders: {                // per-stop breakdown
    order_number: string
    customer_name: string
    stop_order: number
    amount: number
    pick_status: string    // pending | in_progress | completed
  }[]
  progress: {
    total_items: number
    picked_items: number
    percentage: number     // 0-100
  }
}
```

### Frontend Page

**Route:** `/dashboard/warehouse/picking-by-vehicle`

**Layout:**
```
┌──────────────────────────────────────────────────────────────┐
│ 📦 Chuẩn bị xuất theo xe                    [date] [🔄]    │
├────────┬──────────┬──────────────┬───────────────────────────┤
│ Tổng xe│ Tổng đơn │ Sẵn sàng Gate│ Tiến độ chung            │
│   5    │   23     │     2        │  68% ████████░░           │
├────────┴──────────┴──────────────┴───────────────────────────┤
│ [Tất cả(5)] [Chưa soạn(1)] [Đang soạn(2)] [Đã xong(2)]    │
├──────────────────────────────────────────────────────────────┤
│ 🚛 29B-12345 · T-027 · Nguyễn Văn A · 5 điểm    85% ██▓░  │
│ ┌ expand ─────────────────────────────────────────────────┐  │
│ │ Tab: Hàng cần soạn (tổng hợp 5 đơn)                    │  │
│ │ Heineken 330ml | 120 | 95 đã soạn | L2603 🔥 Pick trước│  │
│ │ Tiger 330ml    | 80  | 80 đã soạn | L2604              │  │
│ │                                                         │  │
│ │ Chi tiết 5 đơn hàng:                                    │  │
│ │ ① SO-20260322-0001 · NPP Phước Lộc · 16.6M · ✅ Đã soạn│  │
│ │ ② SO-20260322-0003 · NPP Hưng Phát · 12.2M · 🔄 Đang  │  │
│ └─────────────────────────────────────────────────────────┘  │
│                                                              │
│ 🚛 51D-67890 · T-028 · Trần Văn B · 3 điểm    100% ██████ │
│   ✅ SẴN SÀNG GATE CHECK → [Chuyển sang Gate Check]        │
└──────────────────────────────────────────────────────────────┘
```

**UX rules:**
- FEFO badge `🔥 Pick trước!` dùng brand color `#F68634` cho lô ≤7 ngày
- Progress bar: xanh lá ≥100%, xanh dương ≥50%, vàng <50%
- Vehicle card có border-green khi đã soạn xong (ready for gate)
- Empty state: "Không có xe nào cần soạn hàng hôm nay — Chuyến xe sẽ xuất hiện sau khi điều phối duyệt kế hoạch VRP"

### Files đã tạo/sửa:
- `internal/wms/handler.go` — route `GET /picking-by-vehicle` + handler
- `internal/wms/service.go` — `GetPickingByVehicle()` + 4 types
- `web/src/app/dashboard/warehouse/picking-by-vehicle/page.tsx` — full page
- `web/src/app/dashboard/warehouse/page.tsx` — added nav link "Soạn theo xe"

---

## §17. PINNED NOTES (🔲 P1)

### Mục đích
Ghi chú quan trọng được ghim lên đầu order detail — không bị chìm trong timeline.
VD: "NPP yêu cầu giao trước 10h sáng", "Đã nói chuyện X — chờ email xác nhận".

### Spec

```typescript
// API
PUT /v1/orders/:id/notes/:noteId/pin     // ghim
DELETE /v1/orders/:id/notes/:noteId/pin   // bỏ ghim

// DB: thêm column
ALTER TABLE order_notes ADD COLUMN is_pinned BOOLEAN DEFAULT false;

// Component
<PinnedNotesBar orderId={orderId} />
// Hiển thị max 3 ghi chú ghim, nền vàng nhạt bg-amber-50
// border-l-4 border-amber-400
// Timestamp + author + "📌 Ghim"
// Click "Bỏ ghim" → confirm → remove
```

### Layout position
```
┌─ Order Detail ────────────────────────┐
│ [Header: SO-xxx · Status · Amount]    │
│ [📌 PinnedNotesBar — max 3 notes]    │  ← NEW
│ [KPI Bar — 4 thẻ]                    │
│ [Timeline + Notes inline]            │
└───────────────────────────────────────┘
```

---

## §18. NOTES INLINE TRONG TIMELINE (🔲 P1)

### Mục đích
Ghi chú hiện xen kẽ trong timeline theo thời gian thay vì tab riêng.
Context liền mạch — đọc timeline = thấy cả event + note.

### Spec

```typescript
// Merge notes vào timeline entries
// Event: { type: 'event', timestamp, event_type, ... }
// Note:  { type: 'note', timestamp, note_type, content, author, is_pinned }

const merged = [...events, ...notes].sort((a,b) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
)

// Note card trong timeline — border trái theo note_type
// internal:     border-l-4 border-amber-400 bg-amber-50
// npp_feedback: border-l-4 border-blue-400 bg-blue-50
// driver_note:  border-l-4 border-green-400 bg-green-50
// system:       border-l-4 border-stone-300 bg-stone-50
```

### Tab structure thay đổi
```
Trước (v4): [Dòng thời gian] [Ghi chú (N)] [Đối soát] [Tài liệu]
Sau (v5):   [Dòng thời gian + Ghi chú] [Đối soát] [Tài liệu]
                                         ↑ Notes xen kẽ trong timeline
```

### Note Composer
Vẫn giữ ở cuối timeline (không đổi so với v4 §3.5).
Khi lưu note → note xuất hiện ngay trong timeline tại vị trí timestamp.

---

## §19. "ĐANG CHỜ AI" STICKY BANNER (🔲 P1)

### Mục đích
Mọi người đều rõ đơn hàng đang bị block ở đâu, ai cần hành động.
Banner dính ở đầu order detail — không cần scroll timeline để đoán.

### Spec

```typescript
// Logic: mapping status → waiting_for
const WAITING_FOR: Record<string, { label: string; role: string; color: string }> = {
  pending_customer_confirm: { label: 'Chờ NPP xác nhận (tự động sau 2h)', role: 'npp', color: 'bg-blue-50 text-blue-700' },
  pending_approval:         { label: 'Chờ Kế toán duyệt hạn mức', role: 'accountant', color: 'bg-amber-50 text-amber-700' },
  confirmed:                { label: 'Chờ Điều phối xếp xe', role: 'dispatcher', color: 'bg-teal-50 text-teal-700' },
  planned:                  { label: 'Chờ Thủ kho soạn hàng', role: 'warehouse_handler', color: 'bg-violet-50 text-violet-700' },
  picking:                  { label: 'Đang soạn hàng', role: 'warehouse_handler', color: 'bg-orange-50 text-orange-700' },
  loaded:                   { label: 'Chờ Bảo vệ gate check', role: 'security', color: 'bg-purple-50 text-purple-700' },
  in_transit:               { label: 'Tài xế đang giao', role: 'driver', color: 'bg-sky-50 text-sky-700' },
  delivered:                { label: 'Chờ NPP xác nhận nhận hàng (tự động sau 24h)', role: 'npp', color: 'bg-green-50 text-green-700' },
  disputed:                 { label: 'Chờ Kế toán xử lý sai lệch', role: 'accountant', color: 'bg-red-50 text-red-700' },
  on_credit:                { label: 'Chờ NPP thanh toán', role: 'npp', color: 'bg-pink-50 text-pink-700' },
}
// Terminal states (completed, cancelled, rejected) → KHÔNG hiện banner
```

### Component

```tsx
function WaitingForBanner({ status }: { status: string }) {
  const cfg = WAITING_FOR[status]
  if (!cfg) return null
  return (
    <div className={`px-4 py-3 rounded-lg mb-4 flex items-center gap-2 ${cfg.color}`}>
      <span className="animate-pulse">⏳</span>
      <span className="font-medium">{cfg.label}</span>
    </div>
  )
}
```

### Layout position
```
┌─ Order Detail ────────────────────────┐
│ [Header: SO-xxx · Status · Amount]    │
│ [⏳ WaitingForBanner]                 │  ← NEW
│ [📌 PinnedNotesBar]                   │
│ [KPI Bar · Timeline]                  │
└───────────────────────────────────────┘
```

---

## §20. CREDIT AGING CHIP (🔲 P1)

### Mục đích
Đơn `on_credit` quá T+7 ngày chưa thanh toán → hiện chip đỏ bên cạnh status.
Kế toán + DVKH nhìn thấy ngay risk level.

### Spec

```typescript
// Logic
const daysSinceDelivered = Math.floor(
  (Date.now() - new Date(order.delivered_at).getTime()) / (86400 * 1000)
)

// Tiers
const AGING_TIERS = [
  { min: 30, label: '> 30 ngày', color: 'bg-red-600 text-white', priority: 'P0' },
  { min: 14, label: '> 14 ngày', color: 'bg-red-100 text-red-700', priority: 'P1' },
  { min: 7,  label: '> 7 ngày',  color: 'bg-amber-100 text-amber-700', priority: 'P2' },
]

// Component — hiện cạnh StatusChip
function CreditAgingChip({ deliveredAt }: { deliveredAt: string }) {
  const days = daysSinceDelivered(deliveredAt)
  if (days < 7) return null
  const tier = AGING_TIERS.find(t => days >= t.min)!
  return <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${tier.color}`}>{tier.label}</span>
}
```

---

## §21. DURATION CHIPS ENHANCED (🔲 P2)

### Mục đích
Hiện thời gian chờ tại mỗi status transition trong timeline.
VD: "Chờ Kế toán duyệt: 45 phút" — giúp phát hiện bottleneck.

### Spec

```typescript
// Tính duration giữa 2 events liên tiếp
function getDuration(prevEvent: TimelineEntry, currentEvent: TimelineEntry): string {
  const ms = new Date(currentEvent.timestamp).getTime() - new Date(prevEvent.timestamp).getTime()
  if (ms < 60000) return `${Math.floor(ms/1000)}s`
  if (ms < 3600000) return `${Math.floor(ms/60000)} phút`
  return `${Math.floor(ms/3600000)}h ${Math.floor((ms%3600000)/60000)}m`
}

// Color coding
// < 30 phút: text-gray-400 (bình thường)
// 30m-2h:    text-amber-500 (chậm)
// > 2h:      text-red-500 font-bold (bottleneck)
```

### Hiển thị trong timeline
```
● 14:20 — Kế toán duyệt hạn mức                    ← event
  └ Chờ 45 phút                                      ← duration chip (amber)
● 13:35 — Gửi yêu cầu duyệt hạn mức               ← event
  └ Xử lý 12 phút                                    ← duration chip (gray)
● 13:23 — NPP xác nhận đơn hàng                     ← event
```

---

## §22. note_type FIX (🔲 P0 Bug)

### Vấn đề
Frontend gửi `note_type` (internal/npp_feedback/driver_note/system) nhưng:
1. Backend handler chỉ đọc `content`, bỏ qua `note_type`
2. DB table `order_notes` thiếu column `note_type`

### Fix plan

**DB Migration:**
```sql
-- 011_note_type.up.sql
ALTER TABLE order_notes ADD COLUMN note_type VARCHAR(20) DEFAULT 'internal';
CREATE INDEX idx_order_notes_type ON order_notes(note_type);
```

**Backend handler (internal/oms/handler.go):**
```go
// Trong CreateOrderNote handler
type createNoteReq struct {
    Content  string `json:"content" binding:"required"`
    NoteType string `json:"note_type"`  // ← THÊM field này
}

// Validate note_type
validTypes := map[string]bool{"internal": true, "npp_feedback": true, "driver_note": true, "system": true}
if req.NoteType == "" { req.NoteType = "internal" }
if !validTypes[req.NoteType] { /* return 400 */ }

// Pass to service + repository
```

**Backend repository:**
```go
// INSERT thêm note_type
INSERT INTO order_notes (id, order_id, content, note_type, created_by, created_at)
VALUES ($1, $2, $3, $4, $5, $6)

// SELECT thêm note_type
SELECT id, order_id, content, note_type, ...
```

---

## §23. TIMELINE KPI BAR (🔲 P1)

### Mục đích
4 thẻ KPI ở đầu OrderTimeline, đọc trong 3 giây — tóm tắt tình trạng đơn.

### Spec (đã mô tả trong v4 §3.2 nhưng chưa implement)

```typescript
interface TimelineKPI {
  processingTime: string    // "4h 22m" — delivered_at - created_at
  isOnTime: boolean         // so với cutoff 16h
  tripInfo: string          // "T-027 · 29B-88423 · Nguyễn Văn A"
  reconStatus: string       // "Khớp 100%" | "Lệch 2 SP"
}
```

### Component

```tsx
function TimelineKPIBar({ order }: { order: OrderDetail }) {
  const processingTime = order.delivered_at
    ? formatDuration(new Date(order.delivered_at).getTime() - new Date(order.created_at).getTime())
    : 'Chưa giao'

  return (
    <div className="grid grid-cols-4 gap-3 mb-4">
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-500">Thời gian xử lý</div>
        <div className="font-bold">{processingTime}</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-500">Cutoff</div>
        <div className={`font-bold ${order.isOnTime ? 'text-green-600' : 'text-gray-500'}`}>
          {order.isOnTime ? 'Trước 16h ✓' : 'T+1'}
        </div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-500">Chuyến xe</div>
        <div className="font-medium text-sm">{order.tripInfo || 'Chưa xếp'}</div>
      </div>
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="text-xs text-gray-500">Đối soát</div>
        <div className="font-bold">{order.reconStatus || 'Chưa đối soát'}</div>
      </div>
    </div>
  )
}
```

---

## IMPLEMENTATION PRIORITY

### P0 — Immediate (blocking)
- [x] §16 Picking by Vehicle — ✅ Done
- [ ] §22 note_type fix — DB migration + backend handler

### P1 — Sprint 1 after go-live
- [ ] §17 PinnedNotes
- [ ] §18 Notes inline Timeline
- [ ] §19 "Đang chờ ai" banner
- [ ] §20 Credit Aging Chip
- [ ] §23 Timeline KPI Bar

### P2 — Sprint 2+
- [ ] §21 Duration Chips Enhanced

---

## KHÔNG THÊM (đã reject từ phân tích)

Các tính năng sau đã có trong 2 bản UX Analysis nhưng **KHÔNG THÊM** vì:

| Tính năng đề xuất | Lý do reject |
|-------------------|------|
| What-if analysis (Điều phối) | Enterprise-grade, fleet ~70 xe không cần |
| 4-eye approval (Kế toán) | Over-engineering cho quy mô hiện tại |
| AI predictive analytics (BGĐ) | Yêu cầu ≥3 tháng data, defer P3 |
| Native mobile app (Tài xế) | PWA đủ cho go-live, eval sau 3 tháng |
| Full WMS with bin management | Kho bia không cần bin-level tracking |
| Real-time chat module | Zalo OA + phone đã đủ |
| Multi-warehouse routing | Hiện chỉ 1 kho chính |
| Dynamic pricing engine | Giá cố định theo chính sách BHL |

---

*BHL OMS-TMS-WMS · UX Vibe Coding Spec v5.0 · Delta từ v4*
*Cập nhật: Session hiện tại*
*Tuân thủ: v4 vẫn là master, v5 chỉ bổ sung tính năng mới*
