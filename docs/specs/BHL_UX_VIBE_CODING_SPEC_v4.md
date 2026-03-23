# BHL OMS-TMS-WMS — UX VIBE CODING SPEC v4.0
## Tài liệu triển khai UX World-class cho AI Coding Agent

> **ĐỌC FILE NÀY TRƯỚC KHI CODE BẤT KỲ DÒNG NÀO.**
> Mỗi section có đủ: nguyên tắc → component → data → UX rule → edge case.

---

## 0. CONTEXT & STACK

| | |
|---|---|
| Backend | Go 1.22 + Gin · port **8082** |
| Frontend | Next.js 14 + Tailwind · port **3004** |
| Database | PostgreSQL 16 · port **5434** (Docker) |
| Cache | Redis · port **6379** (Windows local) |
| Brand color | **#F68634** — KHÔNG nhầm với amber-500 (#f59e0b) |
| Roles | admin · dispatcher · driver · warehouse_handler · management · accountant · dvkh · security · workshop |

### Rules bắt buộc (vi phạm = bug)

```go
// Go
SELECT status::text, delivery_date::text FROM ... // ::text cho enum + date
loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")   // timezone
// NUMERIC(15,2) cho tiền — KHÔNG float64
// SafeGo() cho goroutine — KHÔNG go func() trực tiếp
// Handler → Service → Repository — không bỏ tầng
```

```typescript
// TypeScript
apiFetch()          // LUÔN dùng, KHÔNG fetch() trực tiếp
res.data || []      // handle null
setLoading(false)   // trong finally
formatVND()         // cho tiền — KHÔNG tự format
`${err.message} (Ref: ${traceRef})` // mọi error message
```

---

## 1. TIMING RULES — AUTO-CONFIRM

> **CRITICAL — ĐỌC KỸ:** Có 2 loại auto-confirm với thời gian KHÁC NHAU.

| Sự kiện | Thời gian | Business rule | Mô tả |
|---------|-----------|---------------|-------|
| **NPP xác nhận đơn hàng** | **2 giờ** | BR-OMS-AUTO | Sau khi DVKH gửi Zalo OA xác nhận đơn → nếu NPP im lặng 2h → tự động chuyển sang `confirmed` |
| **NPP xác nhận giao hàng** | **24 giờ** | BR-REC-02 | Sau khi tài xế giao xong, gửi Zalo OA cho NPP ký nhận → nếu im lặng 24h → auto-confirm delivery |

```typescript
// CountdownDisplay component — dùng chung cho cả 2 loại
// PHẢI truyền đúng expiresAt để hiện đúng thời gian còn lại
<CountdownDisplay expiresAt={order.confirmDeadline} />  // 2h từ lúc gửi Zalo đơn
<CountdownDisplay expiresAt={delivery.confirmDeadline} /> // 24h từ lúc tài xế giao xong
```

---

## 2. HỆ THỐNG TRẠNG THÁI — 16 STATUS

### 2.1 StatusChip — Single Source of Truth

**File:** `web/src/lib/order-status.ts` + `web/src/components/ui/StatusChip.tsx`

> KHÔNG tự đặt màu trong component. KHÔNG interpolate class Tailwind.
> Dùng full class string — Tailwind không scan dynamic class.

```typescript
export const STATUS_CONFIG: Record<OrderStatus, StatusConfig> = {
  draft: {
    dotClass: 'bg-stone-400', bgClass: 'bg-stone-100',
    textClass: 'text-stone-600', borderClass: 'border-stone-300',
    labels: { default: 'Nháp' },
    isTerminal: false,
  },
  pending_customer_confirm: {
    dotClass: 'bg-blue-500', bgClass: 'bg-blue-50',
    textClass: 'text-blue-700', borderClass: 'border-blue-300',
    labels: { default: 'Chờ NPP xác nhận', dispatcher: 'Chờ NPP', management: 'Chờ NPP' },
    isTerminal: false,
    showCountdown: true,      // ← Hiện countdown 2h
    countdownType: 'order',   // ← 'order' = 2h | 'delivery' = 24h
  },
  pending_approval: {
    dotClass: 'bg-amber-500', bgClass: 'bg-amber-50',
    textClass: 'text-amber-700', borderClass: 'border-amber-300',
    labels: { default: 'Chờ duyệt hạn mức', accountant: 'Cần duyệt ngay', dvkh: 'Chờ Kế toán duyệt' },
    isTerminal: false,
  },
  confirmed: {
    dotClass: 'bg-teal-500', bgClass: 'bg-teal-50',
    textClass: 'text-teal-700', borderClass: 'border-teal-300',
    labels: { default: 'Đã xác nhận', dispatcher: 'Sẵn sàng xếp xe' },
    isTerminal: false,
  },
  planned: {
    dotClass: 'bg-violet-500', bgClass: 'bg-violet-50',
    textClass: 'text-violet-700', borderClass: 'border-violet-300',
    labels: { default: 'Đã xếp xe', warehouse_handler: 'Chờ picking' },
    isTerminal: false,
  },
  picking: {
    dotClass: 'bg-orange-500', bgClass: 'bg-orange-50',
    textClass: 'text-orange-700', borderClass: 'border-orange-300',
    labels: { default: 'Đang đóng hàng', warehouse_handler: 'Đang picking', dvkh: 'Kho đang chuẩn bị' },
    isTerminal: false,
  },
  loaded: {
    dotClass: 'bg-purple-500', bgClass: 'bg-purple-50',
    textClass: 'text-purple-700', borderClass: 'border-purple-300',
    labels: { default: 'Đã lên xe', dispatcher: 'Sẵn sàng xuất', security: 'Gate pass' },
    isTerminal: false,
  },
  in_transit: {
    dotClass: 'bg-sky-500', bgClass: 'bg-sky-50',
    textClass: 'text-sky-700', borderClass: 'border-sky-300',
    labels: { default: 'Đang giao', driver: 'Đang chạy', management: 'In Transit' },
    isTerminal: false,
  },
  delivered: {
    dotClass: 'bg-green-600', bgClass: 'bg-green-50',
    textClass: 'text-green-700', borderClass: 'border-green-300',
    labels: { default: 'Đã giao', dvkh: 'Giao thành công' },
    isTerminal: false,
    showCountdown: true,      // ← Hiện countdown 24h chờ NPP xác nhận nhận hàng
    countdownType: 'delivery',// ← 'delivery' = 24h
  },
  partial_delivered: {
    dotClass: 'bg-amber-400', bgClass: 'bg-amber-50',
    textClass: 'text-amber-700', borderClass: 'border-amber-300',
    labels: { default: 'Giao thiếu', dvkh: 'Giao thiếu — cần xử lý' },
    isTerminal: false,
  },
  rejected: {
    dotClass: 'bg-red-500', bgClass: 'bg-red-50',
    textClass: 'text-red-700', borderClass: 'border-red-300',
    labels: { default: 'Khách từ chối', dvkh: 'Khách từ chối — cần xử lý' },
    isTerminal: false,
  },
  re_delivery: {
    dotClass: 'bg-orange-600', bgClass: 'bg-orange-50',
    textClass: 'text-orange-700', borderClass: 'border-orange-300',
    labels: { default: 'Giao lại', dvkh: 'Đang giao lại' },
    isTerminal: false,
    showAttemptCount: true,
  },
  on_credit: {
    dotClass: 'bg-pink-500', bgClass: 'bg-pink-50',
    textClass: 'text-pink-700', borderClass: 'border-pink-300',
    labels: { default: 'Công nợ', accountant: 'Công nợ — chưa thu' },
    isTerminal: false,
  },
  disputed: {
    dotClass: 'bg-red-600', bgClass: 'bg-red-50',
    textClass: 'text-red-700', borderClass: 'border-red-400',
    labels: { default: 'Tranh chấp', accountant: 'Sai lệch cần xử lý', dvkh: 'NPP báo sai lệch' },
    isTerminal: false,
  },
  cancelled: {
    dotClass: 'bg-stone-300', bgClass: 'bg-stone-100',
    textClass: 'text-stone-500', borderClass: 'border-stone-200',
    labels: { default: 'Đã hủy' },
    isTerminal: true,
  },
  completed: {
    dotClass: 'bg-green-800', bgClass: 'bg-green-50',
    textClass: 'text-green-800', borderClass: 'border-green-400',
    labels: { default: 'Hoàn tất' },
    isTerminal: true,
  },
}
```

### 2.2 CountdownDisplay component

```typescript
// Dùng countdownType để tính đúng deadline
function CountdownDisplay({ expiresAt, type }: { expiresAt: string; type: 'order' | 'delivery' }) {
  // type='order'    → auto-confirm sau 2h  (pending_customer_confirm)
  // type='delivery' → auto-confirm sau 24h (delivered, chờ NPP ký nhận)
  const [ms, setMs] = useState(() => new Date(expiresAt).getTime() - Date.now())
  useEffect(() => {
    const id = setInterval(() => setMs(new Date(expiresAt).getTime() - Date.now()), 1000)
    return () => clearInterval(id)
  }, [expiresAt])
  if (ms <= 0) return <span className="ml-1 opacity-70 text-[10px]">tự xác nhận</span>
  const hours = Math.floor(ms / 3600000)
  const mins  = Math.floor((ms % 3600000) / 60000)
  const secs  = Math.floor((ms % 60000) / 1000)
  const urgentClass = (type === 'order' && mins < 30) || (type === 'delivery' && hours < 2)
    ? 'text-red-500' : ''
  const display = hours > 0
    ? `${hours}h ${mins.toString().padStart(2,'0')}m`
    : `${mins}:${secs.toString().padStart(2,'0')}`
  return <span className={`ml-1 font-mono text-[10px] opacity-80 ${urgentClass}`}>{display}</span>
}
```

---

## 3. ORDER TIMELINE — 5 LỚP THÔNG TIN

### 3.1 Cấu trúc

```
[KPI Bar: 4 thẻ] ← Luôn hiển thị, đọc trong 3 giây
[Progress Bar màu #F68634]
[Tabs: Dòng thời gian | Ghi chú (N) | Đối soát | Tài liệu]
[Bộ lọc: Tất cả | 1 Đơn | 2 Hạn mức | 3+9 Zalo | 4 Điều vận | 5+6 Kho | 7 Giao | 8 Tiền | 10 Đối soát | Ghi chú]
[Timeline entries với dot màu + inline chips]
[Note Composer] ← Luôn ở cuối, không phải tab riêng
```

### 3.2 KPI Bar — 4 thẻ

| Thẻ | Query | Hiển thị |
|-----|-------|---------|
| Thời gian xử lý | `delivered_at - created_at` | "4h 22m" · xanh nếu đúng hạn |
| Đúng hạn | so với cutoff 16h | "Trước 16h" (xanh) / "T+1" (xám) |
| Chuyến xe | trip_number + plate + driver | "T-027 · 29B-88423 · Nguyễn Văn A" |
| Đối soát | reconciliation status | "Khớp 100%" (xanh) / "Lệch X SP" (đỏ) |

### 3.3 Màu dot timeline (cố định — không đổi theo status)

```typescript
const CATEGORY_DOT: Record<string, string> = {
  order:       'bg-blue-500',
  credit:      'bg-amber-500',
  zalo:        'bg-blue-600',
  vrp:         'bg-violet-500',
  wms:         'bg-orange-500',
  delivery:    'bg-green-500',
  payment:     'bg-rose-500',
  recon:       'bg-purple-600',
  integration: 'bg-stone-400',
  note:        'bg-amber-400',
  system:      'bg-stone-300',
}
```

### 3.4 Ba loại ghi chú (border trái màu, trong timeline)

```typescript
// note_type → border color + background + label
const NOTE_STYLE = {
  internal:     { border: 'border-l-4 border-amber-400 bg-amber-50',  label: '🔒 Nội bộ',                        opacity: 'opacity-80' },
  npp_feedback: { border: 'border-l-4 border-blue-400 bg-blue-50',    label: 'Phản hồi NPP (qua Zalo/ĐT)',       opacity: '' },
  driver_note:  { border: 'border-l-4 border-green-400 bg-green-50',  label: 'Tài xế ghi',                       opacity: '' },
  system:       { border: 'border-l-4 border-stone-300 bg-stone-50',  label: 'Hệ thống',                         opacity: 'opacity-70' },
}
// KHÔNG có note_type 'npp_facing' — đã đổi thành 'npp_feedback'
```

### 3.5 Note Composer

```tsx
// Luôn hiển thị cuối timeline — KHÔNG phải tab riêng
<div className="mt-4 pt-4 border-t border-stone-100">
  <div className="flex gap-2 mb-2">
    <button // toggle: internal | npp_feedback
    <textarea placeholder={noteType === 'internal' ? 'Ghi chú nội bộ...' : 'Phản hồi NPP (từ Zalo/ĐT)...'} />
    <button onClick={saveNote}>Lưu ghi chú</button>
  </div>
</div>
```

---

## 4. INTERACTION MODALS — 7 LOẠI

### 4.1 Pattern bắt buộc (4 lớp theo thứ tự)

```
[1] Context box   — đang xử lý đơn nào, số tiền bao nhiêu
[2] Reason chips  — chọn structured reason (bắt buộc cho từ chối/lệch)
[3] Free text     — ghi chú bổ sung (optional trừ kt_approve_credit)
[4] Photo         — bắt buộc khi từ chối hoặc lệch
```

### 4.2 7 loại modal

```typescript
type ModalType =
  | 'delivery_success'      // Tài xế · Giao xong · CTA xanh lá
  | 'delivery_partial'      // Tài xế · Giao thiếu · CTA cam · Photo bắt buộc
  | 'delivery_reject'       // Tài xế · NPP từ chối · CTA đỏ · Photo bắt buộc
  | 'kt_approve_credit'     // Kế toán · Duyệt/từ chối hạn mức · Ghi chú bắt buộc
  | 'record_npp_rejection'  // DVKH · NPP từ chối qua Zalo/ĐT (ghi thay NPP)
  | 'record_npp_dispute'    // DVKH · NPP báo sai lệch qua Zalo/ĐT (ghi thay NPP)
  | 'gate_fail'             // Bảo vệ · Gate check FAIL · Fullscreen đỏ
  // KHÔNG CÓ: confirm_order, reject_order (token-based) → Defer sang NPP App
```

### 4.3 Reason codes

```typescript
export const REASONS = {
  delivery_reject:        ['Không có người nhận', 'Kho đầy', 'Sai địa chỉ', 'Khách hủy không báo', 'Lý do khác'],
  record_npp_rejection:   ['Số lượng không đúng', 'Giá không đúng', 'Ngày giao không phù hợp', 'Không phải đơn tôi', 'Lý do khác'],
  delivery_partial:       ['Hàng vỡ trên xe', 'Pick thiếu từ kho', 'NPP chỉ lấy một phần', 'Lý do khác'],
  record_npp_dispute:     ['Thiếu hàng', 'Sai sản phẩm', 'Hàng hỏng khi nhận', 'Số lượng không đúng'],
  kt_approve_credit_reject: ['NPP có nợ quá hạn', 'Rủi ro tín dụng', 'Vi phạm chính sách công nợ', 'Lý do khác'],
  gate_fail:              ['Số lượng thiếu', 'Sai sản phẩm', 'Niêm phong bị phá', 'Biển số không khớp'],
}
```

### 4.4 Anti double-submit (mobile critical)

```typescript
const submitted = useRef(false)
const submit = async () => {
  if (submitted.current) return
  submitted.current = true
  setSubmitting(true)
  try { /* ... */ }
  catch (err: any) {
    submitted.current = false  // Reset để user có thể thử lại
    setError(`${err.message} (Ref: ${err.serverTraceId || 'unknown'})`)
  }
  finally { setSubmitting(false) }
}
```

---

## 5. DVKH — LUỒNG THAO TÁC

### Layout: 2 cột (Form + Preview realtime)
- **Trái:** Queue xử lý (pending_approval · rejected · re_delivery) + Pipeline + ATP cảnh báo
- **Phải:** Form tạo đơn + Preview Zalo realtime

### Bước 1 — Dashboard mở ra thấy ngay

```typescript
// 3 KPI cần xử lý ngay
GET /v1/orders?status=pending_approval   // Đơn chờ duyệt hạn mức
GET /v1/orders?status=rejected,re_delivery // Đơn cần xử lý
GET /v1/atp?low_stock=true               // ATP cảnh báo
```

### Bước 2 — Tạo đơn: ATP check inline

```typescript
// UX-02: ATP đổi màu NGAY KHI GÕ, không cần submit
const handleQtyChange = (productId: string, qty: number) => {
  const atp = atpMap[productId]
  if (qty > atp) {
    setFieldBorder(productId, 'border-amber-400 bg-amber-50')
    setWarning(productId, `ATP chỉ còn ${atp} — đề xuất giảm xuống ${atp}`)
  } else {
    setFieldBorder(productId, 'border-gray-200')
    setWarning(productId, null)
  }
}
```

### Bước 3 — Credit check (tự động khi confirm)

```
Hạn mức tín dụng: 80,000,000 ₫
Dư nợ hiện tại:   42,000,000 ₫  ← progress bar trực quan
Đơn này:          17,040,000 ₫
Sau đơn:          59,040,000 ₫ · còn 20,960,000 ₫ · OK ✓
```

### Bước 4 — Xác nhận + gửi Zalo (1 bấm = 3 việc)

```
→ Tạo đơn (status: pending_customer_confirm)
→ Gửi Zalo OA cho NPP
→ Push notification cho Điều phối
```

### Bước 5 — Auto-confirm sau 2 giờ (BR-OMS-AUTO)

```go
// Backend cron job — kiểm tra mỗi 15 phút
// Order status = pending_customer_confirm AND sent_at < NOW() - INTERVAL '2 hours'
// → Chuyển sang confirmed, ghi log: actor_id = 'system', trigger = 'auto_confirm_2h'
```

### Bước 6 — Xử lý NPP từ chối

```
NPP reply Zalo "Không lấy" → DVKH mở modal record_npp_rejection
→ Chọn reason code → Ghi chú → Lưu
→ Status → cancelled · ATP tự release
```

---

## 6. ĐIỀU PHỐI VIÊN — LUỒNG THAO TÁC

### Layout: 3-column cockpit (cố định, không collapse)
- **Cột trái (240px):** Alert queue + Đơn chờ xếp
- **Cột giữa (flex):** Map xe realtime
- **Cột phải (280px):** Danh sách chuyến

### Nguyên tắc: Mọi alert phải có inline CTA

```tsx
// ✅ Đúng — xử lý ngay tại chỗ
<AlertCard>
  <p>5 đơn chờ xếp xe quá 2 giờ</p>
  <button onClick={openAssignPanel}>Xếp xe ngay →</button>  // Panel slide-in
</AlertCard>

// ❌ Sai — navigate ra trang khác
<button onClick={() => router.push('/orders?status=unassigned')}>Xem đơn →</button>
```

### Bước 1 — VRP Optimize

```typescript
// Input cho VRP
POST /v1/vrp/optimize {
  orders: string[]        // Danh sách order IDs chưa xếp
  vehicles: string[]      // Xe sẵn sàng
  warehouse_id: string
  date: string            // YYYY-MM-DD
}

// Output
{
  trips: [{
    vehicle_id, driver_id, stops: [{ order_id, stop_order, eta }],
    total_weight_kg, load_percent, estimated_duration_h
  }]
}
```

### Bước 2 — Duyệt kế hoạch (1 bấm làm 4 việc đồng thời)

```go
// TMS.ApprovePlan() — fire-and-forget cho notification
// 1. Tạo trips + cập nhật order status → planned
// 2. GenerateManifest cho từng xe (SafeGo)
// 3. Push notification đến Thủ kho (SafeGo)
// 4. Push notification đến Tài xế (SafeGo)
// Integration errors → log ERROR nhưng KHÔNG rollback trip
```

### Bước 3 — Xử lý sự cố realtime

```typescript
// Xe hỏng giữa đường
// 1. Tách stops chưa giao sang xe khác (kéo-thả)
// 2. Hệ thống tính lại ETA
// 3. Gửi Zalo tự động cho NPP bị ảnh hưởng (fire-and-forget)

// Thêm đơn khẩn sau khi đã duyệt
// → Kiểm tra xe đang chạy qua vùng đó còn tải không
// → Nếu có: thêm stop → push cho tài xế
// → Nếu không: xe buổi chiều hoặc T+1
```

---

## 7. THỦ KHO — LUỒNG THAO TÁC (6 bước)

### Layout: PDA-optimized, tab đầu tiên = Phiếu xuất theo chuyến

### Bước 1 — Nhận lệnh picking

```typescript
// Notification push khi Điều phối duyệt
// Dashboard thủ kho hiện:
GET /v1/warehouse/loading-manifests?date=today&warehouse_id=...
// Sắp theo giờ xuất phát gần nhất
// Border đỏ khi departure_time < NOW() + 30 phút
```

### Bước 2 — Xem manifest xe

```
Tab 1 — Hàng tổng hợp:
  Tên SP | Vị trí kho (A3-12) | Lô gợi ý (L2603) | Số lượng | Trọng lượng

Tab 2 — Thứ tự xếp xe:
  ĐẢOQUY TRÌNH: Stop N → xếp đáy xe trước | Stop 1 → cạnh cửa sau cùng
  [Lý do: Stop 1 dỡ trước → phải cạnh cửa. Stop N dỡ cuối → để đáy]
```

### Bước 3 — Picking theo FEFO (BR-WMS-01)

```go
// Query gợi ý lô — expiry_date ASC, lot_number ASC
SELECT lot_number, expiry_date, location_code, available_qty
FROM inventory_lots
WHERE product_id = $1 AND warehouse_id = $2 AND available_qty > 0
ORDER BY expiry_date ASC, lot_number ASC

// Alert khi lô gần hết hạn
if expiryDate.Before(time.Now().AddDate(0, 0, 15)) {
    // Hiện warning badge vàng: "Hết hạn trong X ngày"
}
```

### Bước 4 — Scan barcode realtime

```typescript
// Mỗi scan → đối chiếu với manifest ngay lập tức
const handleScan = (barcode: string) => {
  const item = manifest.items.find(i => i.barcode === barcode)
  if (!item) return setError('Barcode không có trong manifest')
  if (item.lot !== expectedLot) return setError(`Sai lô! Cần ${expectedLot}, scan ra ${item.lot}`)
  // Cộng dồn progress
  setScanProgress(prev => ({ ...prev, [item.productId]: prev[item.productId] + 1 }))
}

// Khi 100% scan xong → nút "Picking xong" sáng lên
const isPickingDone = Object.entries(scanProgress).every(
  ([id, count]) => count >= manifest.items.find(i => i.productId === id)!.totalQty
)
```

### Bước 5 — Xếp hàng lên xe (UI gợi ý thứ tự)

```typescript
// Hiển thị sơ đồ xe với thứ tự xếp đảo ngược
// manifest.stopSequence đã được đảo ngược từ backend (GenerateForTrip)
// Stop cuối → index 0 trong mảng (xếp trước = đáy xe)
// Stop 1 → index cuối (xếp sau = cạnh cửa)
```

### Bước 6 — Bàn giao Bảo vệ

```typescript
PUT /v1/warehouse/loading-manifests/:tripId/status
{ status: 'done' }
// → Bảo vệ nhận notification gate check
// → Status trip chuyển sang 'loaded'
```

---

## 8. BẢO VỆ — LUỒNG THAO TÁC

### Layout: Ultra simple — button h-14 (56px) tối thiểu

### Bước 1 — Queue xe chờ cổng

```typescript
GET /v1/warehouse/gate-check-queue
// Sắp theo giờ xuất phát · Alert đỏ khi < 30 phút
```

### Bước 2 — Checklist 4 hạng mục (R01 — BR-TMS-04)

```
[1] Biển số xe khớp lệnh → QR scan hoặc nhập thủ công
[2] CCCD tài xế khớp → chụp ảnh xác nhận
[3] Niêm phong nguyên vẹn → chụp ảnh tem
[4] Số lượng hàng 100% khớp manifest → tự động từ scan thủ kho
```

### Kết quả

```tsx
// PASS → Màn hình xanh toàn phần
// FAIL → Màn hình đỏ toàn phần — KHÔNG CÓ nút override
// Gọi Thủ kho → Thủ kho xử lý → Bảo vệ scan lại

// Nhập kho cuối ngày (xe quay về)
// Kiểm tra: hàng trả về + vỏ cược + tiền mặt tài xế nộp
```

---

## 9. LÁI XE — LUỒNG THAO TÁC

### Layout: Mobile full-width, offline-first, bottom tabs

**Rules:**
- Tất cả buttons: `min-height: 48px` (h-12)
- Action button chính: `min-height: 56px` (h-14)
- Offline: lưu local → sync khi có mạng → user không biết sự khác biệt

### Bước 1 — Nhận chuyến

```
Dashboard: Số stops · Tổng tải · Thời gian ước tính · Offline indicator ✓
```

### Bước 2 — GPS auto-detect 200m

```typescript
// Khi tài xế trong vùng 200m của điểm giao → auto popup "Đã đến nơi?"
const watchId = navigator.geolocation.watchPosition(pos => {
  const dist = getDistanceMeters(pos.coords, currentStop.coordinates)
  if (dist < 200 && !arrived) {
    setShowArrivalPrompt(true)
    setArrived(true)
  }
})
```

### Bước 3 — Thông tin điểm giao

```
Tên NPP · Địa chỉ · SĐT (tap-to-call) · Hàng cần giao · Số tiền thu
```

### Bước 4 — 3 kết quả giao hàng

```typescript
// Giao thành công
{ recipient_name, gps_lat, gps_lng, timestamp }  // GPS tự gắn

// Giao thiếu — reason chips + photo bắt buộc
{ reason_code: 'broken_on_truck' | 'short_picked' | 'partial_accept' | 'other',
  note, photos: string[], partial_items: [{product_id, qty_delivered}] }

// Khách từ chối — reason chips + photo bắt buộc
{ reason_code: 'no_one' | 'warehouse_full' | 'wrong_address' | 'cancelled' | 'other',
  note, photos: string[] }
```

### Bước 5 — Offline handling

```typescript
// Tất cả action queue local trước
const offlineQueue: Action[] = []
// Khi online → flush queue → server
// User không thấy sự khác biệt
```

### Bước 6 — Kết ca

```
Tổng kết: Số stops hoàn thành · Tiền mặt thu · Hàng trả về · Vỏ cược
→ Nộp tại kho → Bảo vệ xác nhận nhập → Status trip → completed
```

---

## 10. KẾ TOÁN — LUỒNG THAO TÁC

### Layout: Priority queue P0 → P1 → P2

### Bước 1 — Dashboard Priority Queue

```typescript
// P0 (không thể bỏ qua — block giao hàng)
GET /v1/orders/pending-approvals  // Đơn chờ duyệt hạn mức

// P1 (deadline hôm nay — T+1 countdown)
GET /v1/reconciliation/discrepancies?status=open
// Mỗi ticket: hiện countdown đến 16h ngày mai
// < 2h → màu đỏ, CSS animation pulse nhẹ

// P2 (tổng kết)
GET /v1/reconciliation/summary?date=today
```

### Bước 2 — Duyệt hạn mức: Hồ sơ NPP đầy đủ trước khi bấm

```
Hạn mức:          100,000,000 ₫
Dư nợ hiện tại:    92,000,000 ₫ (progress bar đỏ)
Đơn đang duyệt:    14,400,000 ₫
Sau khi duyệt:    106,400,000 ₫ → VỰT HẠN MỨC (cảnh báo)
Lịch sử 30 ngày:  [21/03: 45M ✓] [14/03: 38M ✓] [07/03: trễ 3 ngày ⚠]

Ghi chú: [bắt buộc — cả Duyệt lẫn Từ chối]
[Từ chối] [Duyệt đặc biệt]
```

### Bước 3 — Đối soát T+1 (BR-REC-01: 3 chiều)

```
Hàng:  Số SP thực giao vs đặt     ← Nguồn: ePOD tài xế + scan khi giao
Tiền:  Tiền mặt nộp + CK từ NPP  ← So với tổng đơn
Vỏ:    Két empty thu về            ← Bảo vệ ghi khi nhập kho
```

### Bước 4 — Xử lý discrepancy

```typescript
// Quy trình 3 bước
// 1. Xác nhận với Thủ kho (kiểm tra picking slip)
// 2. Chọn hướng xử lý: giao bù | trừ hóa đơn | ghi nợ
// 3. Đóng ticket — escalate Kế toán trưởng nếu > 5,000,000 ₫

// Auto-confirm giao hàng sau 24h (BR-REC-02)
// Nếu NPP chưa ký nhận sau 24h từ lúc tài xế giao xong
// → Tự động confirm, ghi: actor='system', trigger='auto_confirm_24h'
```

### Bước 5 — Nhắc thanh toán công nợ

```typescript
// 1-click gửi Zalo OA cho NPP với nội dung chuẩn hóa
// Lịch sử gửi nhắc tự lưu vào order timeline
POST /v1/notifications/send-payment-reminder
{ customer_id, amount_due, due_date }
```

---

## 11. BGĐ — LUỒNG THAO TÁC

### Layout: Phân theo giờ trong ngày · 5-second scan

### Nguyên tắc: Chỉ nhận alert khi vượt ngưỡng

```typescript
// P0 → BGĐ phải hành động
const P0_ALERTS = [
  'discrepancy > 50M chưa xử lý 48h',
  'NPP lớn (>100M/tháng) hủy đơn 3 ngày liên tiếp',
  'tỷ lệ đúng hạn < 85% trong ngày',
]

// P1 → BGĐ được biết, không cần làm gì
const P1_ALERTS = [
  'tỷ lệ đúng hạn tuần < 94%',
  'ATP sản phẩm chủ lực < 50 két',
]

// P2/P3 → Điều phối/DVKH tự xử lý, BGĐ chỉ thấy trong báo cáo cuối ngày
```

### 3 khung giờ trong ngày

**08:00 — Sáng: Kế hoạch**
```
5 KPI: Đơn kế hoạch | Doanh thu dự kiến | Xe sẵn sàng | ATP cảnh báo | Chờ duyệt hạn mức
Alert ngưỡng: Đơn < 80% avg 7 ngày | Xe < 60% fleet | ATP cảnh báo > 0
```

**12:00 — Trưa: Vận hành**
```
Live: Xe đang giao | Đơn xong | % đúng hạn | Xe trễ ETA
Chỉ hiện alert khi thực sự cần BGĐ can thiệp
```

**17:00 — Chiều: Kết quả**
```
Tổng kết: Đơn hoàn thành/kế hoạch | Doanh thu | % đúng hạn
Top NPP theo doanh thu + xu hướng ↑↓
Xu hướng đáng chú ý + gợi ý hành động
```

---

## 12. NPP — PHÂN LOẠI THEO GIAI ĐOẠN

### Giai đoạn 1 — Go-live (Zalo OA + DVKH ghi thay)

```
Luồng xác nhận đơn:
  BHL tạo đơn → Gửi Zalo OA → NPP reply
  → DVKH ghi nhận vào hệ thống
  → Im lặng 2h → Auto-confirm đơn hàng (BR-OMS-AUTO)

Luồng xác nhận giao hàng:
  Tài xế giao xong → Gửi Zalo OA → NPP reply
  → Im lặng 24h → Auto-confirm giao hàng (BR-REC-02)
```

### Giai đoạn 2 — NPP App (sau 3–6 tháng)

```
Unlock: confirm_order / reject_order modal (token-based)
Unlock: NPP tự báo sai lệch (ảnh + reason code)
Unlock: NPP xem lịch sử đơn + công nợ
Unlock: note visibility = 'shared' (NPP đọc được ghi chú DVKH)
```

### Schema DB đã sẵn sàng (không cần migration khi Phase 2)

```sql
-- Đã có sẵn, chỉ cần unlock
order_confirmations.reject_reason_code VARCHAR(50)
zalo_confirmations.dispute_reason_code VARCHAR(50)
order_notes.visibility VARCHAR(20)  -- 'internal' | 'shared'
```

---

## 13. VEHICLE LOADING MANIFEST

### Trigger: Tự động khi Điều phối duyệt kế hoạch

```go
// Sau ApprovePlan() — fire-and-forget
SafeGo(ctx, log, "GenerateManifest", func(ctx context.Context) error {
    return manifestSvc.GenerateForTrip(ctx, tripID, warehouseID, planDate)
})
```

### Logic đảo ngược thứ tự (quan trọng)

```go
// VRP trả về stop_order 1 → N (1 = giao trước nhất)
// Manifest xếp xe: stop N trước (đáy) → stop 1 sau (cạnh cửa)
reversed := make([]domain.ManifestStop, len(stops))
for i, stop := range stops {
    reversed[len(stops)-1-i] = domain.ManifestStop{
        StopOrder: stop.StopOrder,
        // ...
    }
}
```

---

## 14. UX RULES — BẮT BUỘC TOÀN HỆ THỐNG

| Rule | Implementation |
|------|---------------|
| UX-01 Zero dead ends | `setError(\`${err.message} (Ref: ${traceRef})\`)` — mọi error có action |
| UX-02 Instant feedback | ATP/Credit → đổi màu input NGAY khi gõ, không cần submit |
| UX-03 Role-aware empty | Text empty state khác nhau cho từng role |
| UX-04 Trace ID | `(Ref: ${traceRef})` trong mọi error message hiển thị |
| UX-05 Driver tap | h-12 min cho tất cả buttons · h-14 cho action chính trong driver |

---

## 15. CHECKLIST TRIỂN KHAI

### P0 — Trước go-live

```
☐ StatusChip — 16 statuses, countdownType: 'order'(2h) | 'delivery'(24h)
☐ OrderTimeline — KPI bar + 5 lớp + note composer cuối
☐ VehicleManifestCard — tab hàng + tab xếp xe đảo ngược + scan progress
☐ FEFO picking screen — vị trí kho + gợi ý lô + near-expiry alert + scan realtime
☐ InteractionModal — 7 types (KHÔNG có confirm_order, reject_order)
☐ Migration 014 — vehicle_loading_manifests + note_type column
☐ Migration 015 — notification tiers + notification_logs
☐ Dashboard DVKH — ATP inline check + Zalo preview + auto-confirm 2h
☐ Dashboard Điều phối — 3-column cockpit + VRP flow + kéo-thả
☐ Dashboard Thủ kho — phiếu xuất theo chuyến là tab đầu tiên
☐ Dashboard Bảo vệ — fullscreen green/red + nhập kho cuối ngày
☐ Dashboard Lái xe — GPS 200m + tap-to-call + offline + kết ca
☐ Dashboard Kế toán — P0/P1/P2 queue + T+1 countdown + đối soát 3 chiều
☐ Dashboard BGĐ — 3 khung giờ + alert leo thang P0/P1
☐ Auto-confirm job: 2h cho đơn hàng, 24h cho giao hàng
```

### P1 — Sprint 1 sau go-live

```
☐ Notification system — P0/P1/P2/P3 priority tiers
☐ Clone đơn tuần trước (DVKH)
☐ Nhắc thanh toán công nợ 1-click Zalo (Kế toán)
☐ BGĐ báo cáo tuần/tháng với xu hướng + gợi ý hành động
```

### P2 — Đánh giá sau 3 tháng

```
☐ NPP App (React Native Expo)
☐ Unlock token-based confirm/reject endpoints
☐ Unlock note visibility = 'shared'
```

### Docs cần cập nhật sau khi code

```
CURRENT_STATE.md  — migration 014/015, note_type 'npp_feedback', 7 modal types,
                    auto-confirm: 2h đơn hàng | 24h giao hàng
DECISIONS.md      — DEC-012: NPP App defer · DEC-013: DVKH ghi thay
TECH_DEBT.md      — TD-026: token endpoint defer · TD-027: visibility locked
TASK_TRACKER.md   — đánh ☑ tasks Phase UX
```

---

*BHL OMS-TMS-WMS · UX Vibe Coding Spec v4.0 · 22/03/2026*
*Stack: Go 1.22 :8082 · Next.js 14 :3004 · PostgreSQL 16 :5434 · Redis :6379*
*Tuân thủ: coding-standards · business-rules · logging-core · logging-io · state-machines · frontend-patterns · doc-update-rules*
