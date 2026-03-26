# RULES — Business Rules, State Machines & Error Codes

> Merge từ: BUSINESS_RULES.md + STATE_MACHINES.md + ERROR_CATALOGUE.md + instruction files
> AI đọc file này khi code business logic, status transitions, hoặc error handling.
> **Code hiện tại = source of truth. File này = target cho code MỚI. KHÔNG refactor code cũ.**

---

## §1 Business Rules

### BR-OMS-01: ATP (Available-To-Promise)
- ATP = on_hand - reserved (confirmed/pending_approval/planned/picking/loaded) - in_transit
- Per `(product_id, warehouse_id)`, tính realtime (không cache > 30s)
- Draft KHÔNG trừ ATP. Cancelled/rejected ĐÃ restore ATP
- ATP < 0 → alert kế toán. ATP = 0 → block input (đỏ). ATP < 10% → cảnh báo (cam)

### BR-OMS-02: Credit Limit
- `available_credit = limit_amount - current_balance`
- Vượt → `pending_approval` (vẫn trừ credit), notify kế toán
- Cancelled → restore credit ngay. Credit limit có thể âm nếu KT duyệt

### BR-OMS-03: Order Number
- Format: `SO-{YYYYMMDD}-{NNNN}` — timezone Asia/Ho_Chi_Minh
- Dùng PostgreSQL sequence `order_number_seq` (không dùng code gen)

### BR-OMS-04: Cutoff 16h
- Trước 16h VN → giao trong ngày. Sau 16h → T+1
- Cutoff configurable qua `system_settings`

### BR-OMS-05: Vỏ cược
- Bia chai/két/keg → tự động tính vỏ. Đơn giá từ `system_configs`

### BR-OMS-AUTO: Auto-confirm đơn hàng 2h
- `pending_customer_confirm` + đã gửi Zalo > 2h → auto-confirm
- Cron 15 phút. Actor: `system`, trigger: `auto_confirm_2h`

### BR-TMS-01: VRP Constraints
- Capacity kg, route ≤ 480 phút (8h), round-trip depot, ưu tiên xe nhỏ

### BR-TMS-04: Gate Check (R01)
- `qty_loaded = qty_ordered` → PASS. Sai lệch → FAIL, alert dispatcher

### BR-TMS-05: Failed Delivery
- Giao lại KHÔNG GIỚI HẠN. Bắt buộc reason từ preset list

### BR-WMS-01: FEFO Picking
- `ORDER BY expiry_date ASC, lot_number ASC`. Lot hết hạn → skip
- ≤ 7 ngày → Critical 🔴. ≤ 30 ngày → Warning 🟠

### BR-REC-01: Đối soát cuối chuyến
- 3 loại: HÀNG, TIỀN, VỎ. ALL khớp → reconciled. Sai lệch → discrepancy, deadline T+1

### BR-REC-02: Auto-confirm giao hàng 24h
- NPP im lặng 24h sau Zalo → auto-confirm. Cron 1 giờ

### Quan trọng
- **Tiền:** `decimal.Decimal` / `NUMERIC(15,2)` — KHÔNG float64
- **Timezone:** UTC trong DB, convert `Asia/Ho_Chi_Minh` ở app layer

---

## §2 State Machines

### SM-01: Order (13 states)
```
draft → confirmed → planned → picking → loaded → in_transit → delivered ✓
draft → confirmed → pending_customer_confirm → confirmed (hoặc cancelled)
confirmed → pending_approval → confirmed (hoặc rejected ✓)
in_transit → partially_delivered → re_delivery → confirmed
in_transit → failed → re_delivery → confirmed
in_transit → rejected ✓
delivered → on_credit ✓
* → cancelled ✓ (trừ delivered/rejected)
```
Terminal: `delivered`, `cancelled`, `rejected`, `on_credit`

### SM-02: Trip (13 states)
```
planned → checked → loading → loaded → gate_checked → departed → 
in_transit → at_stop → returning → unloading_returns → settling → 
reconciled → completed ✓
* → cancelled ✓
```
Terminal: `completed`, `cancelled`
**Lưu ý:** Code dùng ~8 statuses (KI-003), bổ sung dần theo feature.

### SM-03: Stop (7 states)
```
pending → arrived → delivering → delivered ✓ / partial ✓ / rejected ✓
delivering → failed → re_delivery
```

### SM-04–07: Shipment, Discrepancy, Zalo, Payment
- Chi tiết: xem `docs/specs/STATE_MACHINES.md` (Tầng 3)

### Validation Pattern (bắt buộc)
```go
if !entity.CanTransitionTo(newStatus) {
    return apperror.InvalidTransition("order", string(entity.Status), string(newStatus), allowedList)
}
```

### Logging cho Transitions
- Thành công → `INFO` msg `state_transition` (entity, from, to, actor_id)
- Bị từ chối → `WARN` msg `state_transition_rejected`
- Side effect fail → `ERROR` msg `side_effect_failed` (KHÔNG rollback transition)

---

## §3 Error Codes

### Format response
```json
{"success": false, "error": {"code": "ERROR_CODE", "message": "Tiếng Việt", "details": {}}}
```

### Bảng error codes chính

| Prefix | Module | Log Level |
|--------|--------|-----------|
| `AUTH_` | Authentication | WARN |
| `ORDER_`, `ATP_`, `CREDIT_` | OMS | WARN |
| `TRIP_`, `VRP_`, `GATE_`, `STOP_` | TMS | ERROR (gate/vrp), WARN (others) |
| `STOCK_`, `LOT_`, `PICKING_` | WMS | WARN |
| `RECONCILIATION_`, `DISCREPANCY_` | Reconciliation | WARN |
| `BRAVO_`, `DMS_`, `ZALO_` | Integration (trả 202) | WARN |
| `VALIDATION_` | Input | INFO |
| `INTERNAL_` | System | ERROR |

Danh sách đầy đủ: xem `docs/specs/ERROR_CATALOGUE.md` (Tầng 3). KHÔNG tự tạo code mới — thêm vào ERROR_CATALOGUE trước.

### Log cho Business Rule violations

| Loại | Log Level | Ví dụ |
|------|-----------|-------|
| BR violation không block | `WARN` | ATP thấp, credit vượt |
| BR áp dụng bình thường | `INFO` | Cutoff T+1, FEFO pick |
| BR block hoạt động | `ERROR` | Gate check fail |
| BR check pass | Không log | Tránh noise |

Field `rule` phải dùng đúng mã: `BR-OMS-01`, `BR-TMS-04`...
