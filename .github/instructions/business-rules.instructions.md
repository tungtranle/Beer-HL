---
description: "Apply business rules from spec when implementing business logic, validation, or calculation. Must read BUSINESS_RULES.md before implementing service methods."
applyTo: "**/{service,repository}.go"
---

# Business Rules

## Bắt buộc

Trước khi implement validation, calculation, hoặc business condition, ĐỌC file `docs/specs/BUSINESS_RULES.md`.

## Quy tắc

1. **Đây là source of truth cho nghiệp vụ** — không đoán, không suy luận.
2. **Code hiện tại là source of truth cho implementation** — KHÔNG refactor code cũ.
3. Chỉ áp dụng business rules cho **code mới**.
4. Khi business rule conflict với code hiện tại → giữ code hiện tại, note lại.

## Business Rules chính

- **BR-OMS-01:** ATP formula — per (product_id, warehouse_id), draft không trừ
- **BR-OMS-02:** Credit limit check — per customer, vượt → pending_approval (không block)
- **BR-OMS-03:** Order number — SO-{YYYYMMDD}-{NNNN}, Asia/Ho_Chi_Minh
- **BR-OMS-04:** Cutoff 16h — trước = giao trong ngày, sau = T+1
- **BR-OMS-05:** Vỏ cược tự động khi có bia chai/két/keg
- **BR-TMS-01:** VRP constraints — capacity, 8h, depot round-trip
- **BR-TMS-04:** Gate check R01 — qty_loaded = qty_ordered (100%)
- **BR-TMS-05:** Failed delivery R05 — giao lại KHÔNG GIỚI HẠN
- **BR-WMS-01:** FEFO picking — expiry_date ASC, lot_number ASC
- **BR-REC-01:** Đối soát 3 loại: hàng, tiền, vỏ
- **BR-REC-02:** Zalo auto-confirm 24h (R13)

## Quan trọng

- Tiền: dùng `decimal.Decimal` hoặc `NUMERIC(15,2)`, KHÔNG float64
- Timezone: UTC trong DB, convert `Asia/Ho_Chi_Minh` ở app
- ATP: không cache quá 30 giây

## Logging Bắt buộc khi Business Rule bị vi phạm

Mọi trường hợp BR violation phải log — đây là audit trail cho nghiệp vụ.

### BR-OMS-01: ATP không đủ → log WARN

```go
s.log.Warn(ctx, "business_rule_violation",
    logger.F("rule",         "BR-OMS-01"),
    logger.F("product_id",   productID),
    logger.F("warehouse_id", warehouseID),
    logger.F("requested",    qty),
    logger.F("available",    atp),
    logger.F("action",       "reject_order"),
)
```

### BR-OMS-02: Credit limit vượt ngưỡng → log WARN (không block)

```go
if creditExceeded {
    s.log.Warn(ctx, "business_rule_violation",
        logger.F("rule",          "BR-OMS-02"),
        logger.F("customer_id",   req.CustomerID),
        logger.F("credit_limit",  limit),
        logger.F("order_amount",  amount),
        logger.F("exceeded_by",   amount-limit),
        logger.F("action",        "pending_approval"),
    )
}
```

### BR-OMS-04: Order sau cutoff 16h → log INFO

```go
s.log.Info(ctx, "business_rule_applied",
    logger.F("rule",       "BR-OMS-04"),
    logger.F("order_id",   order.ID),
    logger.F("order_time", orderTime.Format(time.RFC3339)),
    logger.F("delivery",   "T+1"),
    logger.F("cutoff",     "16:00"),
)
```

### BR-TMS-04: Gate check thất bại → log ERROR (chặn xuất hàng)

```go
s.log.Error(ctx, "business_rule_violation", err,
    logger.F("rule",         "BR-TMS-04"),
    logger.F("trip_id",      tripID),
    logger.F("qty_ordered",  qtyOrdered),
    logger.F("qty_loaded",   qtyLoaded),
    logger.F("discrepancy",  qtyOrdered-qtyLoaded),
    logger.F("action",       "block_departure"),
)
```

## Quy tắc Log cho Business Rules

| Loại vi phạm | Log Level | Lý do |
|---|---|---|
| BR vi phạm nhưng không block (credit, ATP thấp) | `WARN` | Cần alert, không phải lỗi |
| BR áp dụng bình thường (cutoff, FEFO) | `INFO` | Audit trail |
| BR block hoạt động (gate check, duplicate) | `ERROR` | Cần investigate |
| BR check pass không có gì đặc biệt | Không log | Tránh noise |

Field `rule` phải dùng đúng mã BR (BR-OMS-01, BR-TMS-04...) để có thể filter theo rule.

### BR-WMS-01: FEFO Picking — Audit Trail bắt buộc

> Mỗi lần pick lot phải log để audit: QC, traceability, compliance.

```go
// Log TỪNG lot được pick — không gộp
for _, pick := range pickedLots {
    s.log.Info(ctx, "business_rule_applied",
        logger.F("rule",          "BR-WMS-01"),
        logger.F("op",            "fefo_pick"),
        logger.F("order_id",      orderID),
        logger.F("product_id",    pick.ProductID),
        logger.F("lot_number",    pick.LotNumber),
        logger.F("expiry_date",   pick.ExpiryDate.Format("2006-01-02")),
        logger.F("qty_picked",    pick.Quantity),
        logger.F("warehouse_id",  warehouseID),
    )
}

// WARN nếu lot gần hết hạn (< 7 ngày)
if pick.ExpiryDate.Before(time.Now().AddDate(0, 0, 7)) {
    s.log.Warn(ctx, "business_rule_violation",
        logger.F("rule",        "BR-WMS-01"),
        logger.F("op",          "fefo_near_expiry"),
        logger.F("lot_number",  pick.LotNumber),
        logger.F("expiry_date", pick.ExpiryDate.Format("2006-01-02")),
        logger.F("days_left",   int(time.Until(pick.ExpiryDate).Hours()/24)),
    )
}
```

### BR-REC-01 / BR-REC-02: Đối soát + Auto-confirm

```go
// BR-REC-01: Kết quả đối soát — log MỌI discrepancy
s.log.Info(ctx, "business_rule_applied",
    logger.F("rule",         "BR-REC-01"),
    logger.F("op",           "reconciliation_result"),
    logger.F("recon_type",   reconType),   // "goods" | "payment" | "container"
    logger.F("order_id",     orderID),
    logger.F("expected",     expected),
    logger.F("actual",       actual),
    logger.F("discrepancy",  expected-actual),
    logger.F("match",        expected == actual),
)

// BR-REC-02: Zalo auto-confirm 24h — log khi auto-confirm xảy ra
s.log.Info(ctx, "business_rule_applied",
    logger.F("rule",              "BR-REC-02"),
    logger.F("op",                "zalo_auto_confirm"),
    logger.F("order_id",          orderID),
    logger.F("sent_at",           sentAt.Format(time.RFC3339)),
    logger.F("auto_confirmed_at", time.Now().Format(time.RFC3339)),
    logger.F("hours_elapsed",     time.Since(sentAt).Hours()),
    logger.F("customer_responded", false),
)
```

## Invariant Assertions — Post-Operation Data Checks

> **Phòng thủ cuối cùng**: không tin code đúng → kiểm tra kết quả sau khi ghi.
> Nếu assertion fail → hệ thống có bug NHƯNG data đã corrupt → log ERROR ngay.

### Pattern

```go
// Chạy NGAY SAU write operation, TRƯỚC khi return
func (s *Service) assertOrderInvariant(ctx context.Context, orderID int64) {
    order, err := s.repo.GetOrder(ctx, orderID)
    if err != nil {
        return // DB error đã log ở repo layer
    }
    
    // Invariant 1: total_amount >= 0
    if order.TotalAmount.LessThan(decimal.Zero) {
        s.log.Error(ctx, "invariant_violated", fmt.Errorf("negative total_amount"),
            logger.F("invariant", "order_amount_non_negative"),
            logger.F("order_id", orderID),
            logger.F("total_amount", order.TotalAmount.String()),
        )
    }
    
    // Invariant 2: confirmed order phải có ít nhất 1 line item
    if order.Status == "confirmed" {
        lines, _ := s.repo.GetOrderLines(ctx, orderID)
        if len(lines) == 0 {
            s.log.Error(ctx, "invariant_violated", fmt.Errorf("confirmed order has no lines"),
                logger.F("invariant", "confirmed_order_has_lines"),
                logger.F("order_id", orderID),
            )
        }
    }
    
    // Invariant 3: mọi line item qty > 0
    lines, _ := s.repo.GetOrderLines(ctx, orderID)
    for _, line := range lines {
        if line.Quantity <= 0 {
            s.log.Error(ctx, "invariant_violated", fmt.Errorf("zero or negative quantity"),
                logger.F("invariant", "line_qty_positive"),
                logger.F("order_id", orderID),
                logger.F("line_id", line.ID),
                logger.F("quantity", line.Quantity),
            )
        }
    }
}
```

### Quy tắc Invariant

| Invariant | Khi kiểm | Mô tả |
|---|---|---|
| `order_amount_non_negative` | Sau CreateOrder, UpdateOrder | total >= 0 |
| `confirmed_order_has_lines` | Sau ConfirmOrder | Phải có ít nhất 1 line |
| `line_qty_positive` | Sau AddLine, UpdateLine | qty > 0 |
| `atp_non_negative` | Sau Reserve/Release | ATP >= 0, nếu âm → phantom reservation |
| `trip_has_stops` | Sau CreateTrip, Optimize | Trip phải có >= 1 stop |
| `fefo_order_correct` | Sau PickLot | Lot được pick phải có expiry <= lot tiếp theo |
| `reconciliation_balanced` | Sau AutoConfirm | Tổng qty_delivered = qty_confirmed |

> **Lưu ý**: Invariant assertion chạy ở `INFO`/`DEBUG` mode trong prod (có thể disable).
> Khi fail → log `ERROR` luôn — đây là dấu hiệu BUG, không phải business rule.
