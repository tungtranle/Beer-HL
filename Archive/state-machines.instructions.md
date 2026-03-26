---
description: "Enforce state machine transitions when modifying status-related code. Must read STATE_MACHINES.md before implementing any status update logic."
applyTo: "**/{service,handler}.go"
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

## Logging Bắt buộc cho mọi Transition

**Mọi state transition phải log** — đây là audit trail quan trọng nhất.

### Transition thành công → log INFO

```go
s.log.Info(ctx, "state_transition",
    logger.F("entity",     "order"),
    logger.F("entity_id",  entity.ID),
    logger.F("from",       string(oldStatus)),
    logger.F("to",         string(newStatus)),
    logger.F("actor_id",   logger.UserIDFromCtx(ctx)),
    logger.F("actor_role", actorRole),
)
```

### Transition bị từ chối → log WARN

```go
s.log.Warn(ctx, "state_transition_rejected",
    logger.F("entity",          "order"),
    logger.F("entity_id",       entity.ID),
    logger.F("current_status",  string(entity.Status)),
    logger.F("attempted_status", string(targetStatus)),
    logger.F("actor_id",        logger.UserIDFromCtx(ctx)),
    logger.F("reason",          "invalid_transition"),
)
```

### Side effects thất bại → log ERROR (không rollback transition)

```go
if err := s.zalo.Notify(ctx, order); err != nil {
    s.log.Error(ctx, "side_effect_failed", err,
        logger.F("entity",      "order"),
        logger.F("entity_id",   order.ID),
        logger.F("transition",  "confirmed"),
        logger.F("side_effect", "zalo_notify"),
    )
    // KHÔNG return error — transition đã thành công, side effect là best-effort
}
```

## Quy tắc Log cho State Machine

1. Log TRƯỚC khi persist (để nếu DB fail, vẫn có trace trong log)
2. `entity` field phải nhất quán: `order` / `trip` / `stop` / `shipment` / `discrepancy` / `payment`
3. Log `actor_id` từ context — không tự lấy từ request body
4. Transition do system tự động (cron, timeout): `actor_id = "system"`, ghi rõ `trigger`
