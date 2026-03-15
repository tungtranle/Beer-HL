# STATE MACHINES — BHL OMS-TMS-WMS

> **Mục đích:** Định nghĩa đầy đủ tất cả trạng thái và điều kiện chuyển trạng thái (transitions).
> AI phải đọc file này trước khi implement bất kỳ logic liên quan đến status update.
> Mỗi transition đều phải kiểm tra: ai được thực hiện, điều kiện gì, side effects gì.
>
> **⚠ LƯU Ý QUAN TRỌNG:** Code hiện tại (đã implement) là SOURCE OF TRUTH.
> File này là TARGET cho code MỚI. KHÔNG refactor code cũ cho khớp spec trừ khi được yêu cầu rõ ràng.

---

## SM-01: ORDER STATUS

### Sơ đồ trạng thái

```
                    ┌─────────────────────────────────────────┐
                    │          VÒNG ĐỜI ĐƠN HÀNG              │
                    └─────────────────────────────────────────┘

[Tạo đơn bình thường]              [Tạo đơn vượt hạn mức]
        │                                     │
        ▼                                     ▼
   ┌─────────┐                       ┌─────────────────┐
   │  DRAFT  │                       │ PENDING_APPROVAL│ ◄── Kế toán nhận alert
   └────┬────┘                       └────────┬────────┘
        │ Auto confirm                         │         │
        │ (ATP OK + credit OK)            Duyệt │    Từ chối │
        ▼                                    ▼         ▼
   ┌───────────┐                      ┌──────────┐ ┌──────────┐
   │ CONFIRMED │◄─────────────────────┤ CONFIRMED│ │CANCELLED │
   └─────┬─────┘                      └──────────┘ └──────────┘
         │
         │ [Dispatcher lập KH + VRP approve]
         ▼
   ┌──────────┐
   │  PLANNED │ ← Shipment được gán vào trip
   └─────┬────┘
         │ [WMS bắt đầu picking]
         ▼
   ┌─────────┐
   │ PICKING │
   └─────┬───┘
         │ [Picking hoàn thành, hàng lên xe]
         ▼
   ┌────────┐
   │ LOADED │
   └────┬───┘
         │ [Xe qua gate check thành công]
         ▼
   ┌────────────┐
   │ IN_TRANSIT │◄──────────────────────────────────┐
   └──────┬─────┘                                   │
          │                         [Re-delivery]   │
   ┌──────┴──────────────────────────────┐          │
   │                                     │          │
   ▼ [Giao thành công]        ▼ [Giao thất bại]    │
┌───────────┐            ┌───────────────┐          │
│ DELIVERED │            │  RE_DELIVERY  │──────────┘
└───────────┘            └───────────────┘
       │
       │ [Giao một phần]
┌──────────────────┐
│ PARTIAL_DELIVERED│
└──────────────────┘

[Hủy đơn] → CANCELLED (từ: draft, pending_approval, confirmed, planned)
[Từ chối delivery] → REJECTED (từ: in_transit — NPP từ chối nhận hàng)
[Credit công nợ] → ON_CREDIT (giao nhưng chưa thu tiền, ghi nợ)
```

### Transition Table — Chi tiết

| From | To | Actor | Điều kiện | Side Effects |
|------|----|-------|-----------|--------------|
| *(new)* | `draft` | dvkh | Điền đủ thông tin bắt buộc | Tạo order_number, reserve ATP |
| `draft` | `confirmed` | system | ATP đủ AND credit không vượt | Trừ ATP, tạo shipment |
| `draft` | `pending_approval` | system | Credit vượt hạn mức | Trừ ATP, NOT tạo shipment, notify accountant |
| `pending_approval` | `confirmed` | accountant | Kế toán duyệt | Tạo shipment, record approval_log |
| `pending_approval` | `cancelled` | accountant | Kế toán từ chối | Restore ATP, clear credit reserve |
| `confirmed` | `planned` | system | VRP plan approved + shipment assigned to trip | — |
| `confirmed` | `cancelled` | dvkh, admin | Trước khi planned | Restore ATP, restore credit reserve |
| `planned` | `picking` | warehouse | WMS tạo picking task | — |
| `picking` | `loaded` | warehouse | Picking complete, hàng lên xe | — |
| `loaded` | `in_transit` | system | Gate check PASS | Record gate_out_time |
| `in_transit` | `delivered` | driver | Driver confirm delivery + ePOD | Trigger Zalo ZNS, trigger Bravo push |
| `in_transit` | `partial_delivered` | driver | Giao một phần (thiếu hàng) | Tạo discrepancy record |
| `in_transit` | `re_delivery` | driver | NPP từ chối / không có người | Record fail reason, alert dispatcher |
| `in_transit` | `rejected` | driver | NPP từ chối vĩnh viễn | Hàng quay về kho, restore stock |
| `re_delivery` | `in_transit` | system | Dispatcher lập kế hoạch giao lại | — |
| `delivered` | `on_credit` | system | payment_type = 'credit' | Record receivable_ledger debit |

### Code Implementation

```go
// internal/domain/order.go

type OrderStatus string

const (
    OrderStatusDraft           OrderStatus = "draft"
    OrderStatusPendingApproval OrderStatus = "pending_approval"
    OrderStatusConfirmed       OrderStatus = "confirmed"
    OrderStatusPlanned         OrderStatus = "planned"
    OrderStatusPicking         OrderStatus = "picking"
    OrderStatusLoaded          OrderStatus = "loaded"
    OrderStatusInTransit       OrderStatus = "in_transit"
    OrderStatusDelivered       OrderStatus = "delivered"
    OrderStatusPartialDelivered OrderStatus = "partial_delivered"
    OrderStatusRejected        OrderStatus = "rejected"
    OrderStatusReDelivery      OrderStatus = "re_delivery"
    OrderStatusOnCredit        OrderStatus = "on_credit"
    OrderStatusCancelled       OrderStatus = "cancelled"
)

var AllowedOrderTransitions = map[OrderStatus][]OrderStatus{
    OrderStatusDraft:           {OrderStatusConfirmed, OrderStatusPendingApproval, OrderStatusCancelled},
    OrderStatusPendingApproval: {OrderStatusConfirmed, OrderStatusCancelled},
    OrderStatusConfirmed:       {OrderStatusPlanned, OrderStatusCancelled},
    OrderStatusPlanned:         {OrderStatusPicking},
    OrderStatusPicking:         {OrderStatusLoaded},
    OrderStatusLoaded:          {OrderStatusInTransit},
    OrderStatusInTransit:       {OrderStatusDelivered, OrderStatusPartialDelivered, OrderStatusReDelivery, OrderStatusRejected},
    OrderStatusReDelivery:      {OrderStatusInTransit, OrderStatusCancelled},
    OrderStatusDelivered:       {OrderStatusOnCredit},
}

func (o *Order) CanTransitionTo(next OrderStatus) bool {
    allowed, ok := AllowedOrderTransitions[o.Status]
    if !ok { return false }
    for _, s := range allowed { if s == next { return true } }
    return false
}
```

---

## SM-02: TRIP STATUS

### Sơ đồ trạng thái

```
[VRP Approve]
    │
    ▼
┌─────────┐
│ CREATED │ ← Trip được tạo từ VRP plan
└────┬────┘
     │ [Dispatcher gán xe + tài xế]
     ▼
┌──────────┐
│ ASSIGNED │
└─────┬────┘
     │ [Driver hoàn thành vehicle checklist]
     ▼
┌─────────┐
│ CHECKED │
└─────┬───┘
     │ [WMS bắt đầu xếp hàng]
     ▼
┌─────────┐
│ LOADING │
└─────┬───┘
     │ [Gate check PASS]
     ▼
┌──────────────┐
│ GATE_CHECKED │
└──────┬───────┘
     │ [Xe rời cổng]
     ▼
┌────────────┐
│ IN_TRANSIT │
└──────┬─────┘
     │ [Đến điểm giao đầu tiên]
     ▼
┌─────────┐     ┌────────────────────┐
│ AT_STOP │ ←──→│ IN_TRANSIT (next)  │  (lặp lại cho mỗi stop)
└─────────┘     └────────────────────┘
     │ [Tất cả stops done, xe về kho]
     ▼
┌───────────┐
│ RETURNING │
└─────┬─────┘
     │ [Dỡ vỏ tại phân xưởng]
     ▼
┌──────────────────┐
│ UNLOADING_RETURNS│
└──────────┬───────┘
     │ [Nộp tiền, hoàn chứng từ]
     ▼
┌──────────┐
│ SETTLING │
└─────┬────┘
     │ [Kế toán đối soát xong]
     ▼
┌────────────┐
│ RECONCILED │
└──────┬─────┘
     │ [Không có sai lệch hoặc sai lệch đã đóng]
     ▼
┌───────────┐
│ COMPLETED │ ← Terminal state
└───────────┘

[Hủy] → CANCELLED (từ: created, assigned, checked)
```

### Transition Table — Trip

| From | To | Actor | Điều kiện | Side Effects |
|------|----|-------|-----------|--------------|
| *(new)* | `created` | system | VRP plan approved | Tạo trip_stops từ route |
| `created` | `assigned` | dispatcher | Gán vehicle_id + driver_id | Notify driver qua FCM |
| `created` | `cancelled` | dispatcher | Trước khi assigned | — |
| `assigned` | `checked` | driver | Vehicle checklist hoàn thành | — |
| `assigned` | `cancelled` | dispatcher | Xe hỏng / tài xế nghỉ | Alert dispatcher |
| `checked` | `loading` | warehouse | WMS bắt đầu picking | — |
| `loading` | `gate_checked` | guard/accountant | Gate check PASS, sai lệch = 0 | Record gate_out_time |
| `gate_checked` | `in_transit` | system | Xe rời GPS khỏi depot radius | — |
| `in_transit` | `at_stop` | driver | Driver report "arrived" tại stop | Record arrival_time |
| `at_stop` | `in_transit` | driver | Rời stop (delivered/failed) | Record departure_time |
| `in_transit` | `returning` | driver | Tất cả stops completed | — |
| `returning` | `unloading_returns` | workshop | Bắt đầu nhập vỏ | — |
| `unloading_returns` | `settling` | driver | Hoàn tất nộp tiền + chứng từ | — |
| `settling` | `reconciled` | accountant | Đối soát xong | Push to Bravo |
| `reconciled` | `completed` | system | Không có discrepancy open | KPI snapshot update |

---

## SM-03: STOP STATUS (TripStop)

```
PENDING → ARRIVED → DELIVERING → DELIVERED  (thành công)
                              ↘ PARTIAL      (giao thiếu)
                              ↘ REJECTED     (NPP từ chối)
                              ↘ RE_DELIVERY  (hoãn giao lại)

PENDING → SKIPPED  (skip điểm này, giao lại sau)
```

| From | To | Actor | Điều kiện | Side Effects |
|------|----|-------|-----------|--------------|
| `pending` | `arrived` | driver | GPS trong radius 200m của điểm | Record actual_arrival |
| `arrived` | `delivering` | driver | Driver bắt đầu dỡ hàng | — |
| `delivering` | `delivered` | driver | Xác nhận giao đủ | Record payment, create ePOD, trigger Zalo ZNS |
| `delivering` | `partial` | driver | Giao không đủ (thiếu hàng trên xe) | Tạo discrepancy goods |
| `delivering` | `rejected` | driver | NPP từ chối nhận | Record reason |
| `delivering` | `re_delivery` | driver | Hoãn lại, sẽ giao sau | Record reason, alert dispatcher |
| `pending` | `skipped` | dispatcher | Dispatcher quyết định skip | Record reason |

---

## SM-04: SHIPMENT STATUS

```
PENDING → ASSIGNED (assigned to trip)
        → IN_TRANSIT (trip gate_checked)
        → DELIVERED
        → PARTIAL_DELIVERED
        → RE_DELIVERY
        → CANCELLED
```

---

## SM-05: DISCREPANCY STATUS

```
OPEN → IN_PROGRESS (kế toán bắt đầu xử lý)
     → CLOSED (sai lệch đã giải quyết, T+1 deadline)

Escalation:
IF status = 'open' AND created_at < NOW() - INTERVAL '1 day':
    → Notify manager (escalation)
    → Flag as overdue
```

---

## SM-06: ZALO CONFIRMATION STATUS

```
(trigger: delivery confirmed)
    │
    ▼
  SENT → NPP bấm "Đúng" → CONFIRMED
       → NPP bấm "Sai lệch" → DISPUTED
       → Sau 24h không phản hồi → AUTO_CONFIRMED (cron)
       → Số Zalo sai / OA bị block → EXPIRED
```

---

## SM-07: PAYMENT STATUS

```
PENDING (khi giao hàng)
    → CONFIRMED (kế toán xác nhận tiền đã nhận/chuyển khoản verified)
    → REJECTED (chuyển khoản thất bại / tiền âm)
    → TIMEOUT (sau X ngày không xác nhận)
```

---

## Validation Pattern (Go)

```go
func validateTransition(entity string, from, to interface{}, allowed map[interface{}][]interface{}) error {
    allowedNext, ok := allowed[from]
    if !ok {
        return apperror.BusinessError(
            "INVALID_STATUS",
            fmt.Sprintf("%s: trạng thái hiện tại '%v' không thể chuyển", entity, from),
            nil,
        )
    }
    for _, a := range allowedNext {
        if a == to { return nil }
    }
    return apperror.BusinessError(
        "INVALID_TRANSITION",
        fmt.Sprintf("%s: không thể chuyển từ '%v' sang '%v'", entity, from, to),
        map[string]interface{}{"allowed": allowedNext},
    )
}
```

---

*STATE MACHINES v1.0 — 15/03/2026. Mọi thêm trạng thái mới phải cập nhật file này + migration enum.*
