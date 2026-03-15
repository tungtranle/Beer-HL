---
description: "Enforce state machine transitions when modifying status-related code. Must read STATE_MACHINES.md before implementing any status update logic."
applyTo: ["**/service.go", "**/handler.go"]
---

# State Machine Rules

## Bắt buộc

Trước khi implement bất kỳ status transition nào, ĐỌC file `docs/specs/STATE_MACHINES.md`.

## Quy tắc

1. **KHÔNG được tự ý thêm/bỏ transition** ngoài danh sách đã định nghĩa trong SM-01 đến SM-07.
2. **Mỗi transition phải kiểm tra:** actor (ai thực hiện), điều kiện, side effects.
3. **Code hiện tại là source of truth** — KHÔNG refactor code đã hoàn thành cho khớp spec trừ khi được yêu cầu.
4. Chỉ áp dụng spec cho **code mới**.

## State Machines chính

- **SM-01: Order** — 13 trạng thái, terminal: delivered, cancelled, rejected, on_credit
- **SM-02: Trip** — 13 trạng thái, terminal: completed, cancelled
- **SM-03: Stop** — pending → arrived → delivering → delivered/partial/rejected/re_delivery
- **SM-04: Shipment** — pending → assigned → in_transit → delivered/partial/re_delivery/cancelled
- **SM-05: Discrepancy** — open → in_progress → closed (T+1 deadline)
- **SM-06: Zalo Confirmation** — sent → confirmed/disputed/auto_confirmed/expired
- **SM-07: Payment** — pending → confirmed/rejected/timeout

## Validation Pattern

```go
// Dùng cho tất cả status transitions
if !entity.CanTransitionTo(newStatus) {
    return apperror.InvalidTransition("order", string(entity.Status), string(newStatus), allowedList)
}
```
