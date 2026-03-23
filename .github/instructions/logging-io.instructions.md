---
description: "I/O boundary logging: DB queries, external API calls, Redis cache. MUST follow for repository and integration code."
applyTo: "**/repository.go"
---

# Logging I/O Boundaries — BHL OMS-TMS-WMS

## Nguyên tắc: Mọi I/O phải log duration_ms

## 1. DB Queries (Repository layer)

```go
func (r *Repository) CreateOrder(ctx context.Context, req domain.CreateOrderRequest) (*domain.SalesOrder, error) {
    start := time.Now()
    
    row := r.db.QueryRow(ctx, `INSERT INTO sales_orders (...) VALUES (...) RETURNING id`, ...)
    
    if err := row.Scan(&order.ID, ...); err != nil {
        r.log.Error(ctx, "db_query_failed", err,
            logger.F("op", "CreateOrder"),
            logger.F("table", "sales_orders"),
            logger.Duration(time.Since(start)),
        )
        return nil, fmt.Errorf("create order: %w", err)
    }
    
    r.log.Info(ctx, "db_query",
        logger.F("op", "CreateOrder"),
        logger.F("table", "sales_orders"),
        logger.F("id", order.ID),
        logger.Duration(time.Since(start)),
    )
    return &order, nil
}
```

## 2. External API Calls (Integration layer)

```go
func (c *BravoClient) SyncOrder(ctx context.Context, order *domain.SalesOrder) error {
    start := time.Now()
    
    resp, err := c.httpClient.Post(c.baseURL+"/orders", ...)
    if err != nil {
        c.log.Error(ctx, "integration_call_failed", err,
            logger.F("target", "bravo"),
            logger.F("op", "SyncOrder"),
            logger.F("order_id", order.ID),
            logger.Duration(time.Since(start)),
        )
        return fmt.Errorf("bravo sync order: %w", err)
    }
    
    c.log.Info(ctx, "integration_call",
        logger.F("target", "bravo"),
        logger.F("op", "SyncOrder"),
        logger.F("http_status", resp.StatusCode),
        logger.Duration(time.Since(start)),
    )
    return nil
}
```

## 3. Redis / Cache

```go
if err == redis.Nil {
    r.log.Debug(ctx, "cache_miss", logger.F("key_prefix", "session"), logger.Duration(time.Since(start)))
    return nil, ErrNotFound
}
r.log.Debug(ctx, "cache_hit", logger.F("key_prefix", "session"), logger.Duration(time.Since(start)))
```

## 4. Slow Threshold — Auto WARN

| I/O Type | Ngưỡng |
|----------|--------|
| DB query | > 200ms |
| Redis | > 50ms |
| External API | > 1000ms |
| HTTP request (toàn bộ) | > 2000ms |

```go
// Tự động WARN khi vượt ngưỡng — dùng LogIO helper
func LogIO(ctx context.Context, log Logger, op string, fields []Field, duration time.Duration, threshold time.Duration, err error) {
    fields = append(fields, Duration(duration))
    if err != nil {
        log.Error(ctx, op+"_failed", err, fields...)
        return
    }
    if duration > threshold {
        log.Warn(ctx, op+"_slow", fields...)
        return
    }
    log.Info(ctx, op, fields...)
}
```

## 5. Async Task / Fire-and-Forget Goroutines

> **Blind spot lớn nhất**: goroutine lỗi → không ai biết, không retry, data mất.

### 5.1 Goroutine Wrapper bắt buộc

```go
// LUÔN dùng SafeGo cho mọi goroutine — tuyệt đối KHÔNG dùng `go func()` trực tiếp
func SafeGo(ctx context.Context, log logger.Logger, taskName string, fn func(ctx context.Context) error) {
    go func() {
        start := time.Now()
        taskCtx := context.WithoutCancel(ctx) // giữ trace_id, tách cancel
        log.Info(taskCtx, "async_task_start", logger.F("task", taskName))
        
        defer func() {
            if r := recover(); r != nil {
                log.Error(taskCtx, "async_task_panic", fmt.Errorf("panic: %v", r),
                    logger.F("task", taskName),
                    logger.F("stack", string(debug.Stack())),
                    logger.Duration(time.Since(start)),
                )
            }
        }()
        
        if err := fn(taskCtx); err != nil {
            log.Error(taskCtx, "async_task_failed", err,
                logger.F("task", taskName),
                logger.Duration(time.Since(start)),
            )
            return
        }
        log.Info(taskCtx, "async_task_done",
            logger.F("task", taskName),
            logger.Duration(time.Since(start)),
        )
    }()
}
```

### 5.2 Dùng trong hooks

```go
// ✅ ĐÚNG
SafeGo(ctx, s.log, "SendZaloConfirmation", func(ctx context.Context) error {
    return s.confirmSvc.SendOrderConfirmation(ctx, order.ID, order.CustomerPhone)
})

SafeGo(ctx, s.log, "SyncBravo", func(ctx context.Context) error {
    return s.bravoClient.SyncOrder(ctx, order)
})

// ❌ SAI — panic = crash, lỗi = silent
go func() {
    s.confirmSvc.SendOrderConfirmation(ctx, order.ID, order.CustomerPhone)
}()
```

### 5.3 Quy tắc

| Scenario | Log event | Level |
|---|---|---|
| Task bắt đầu | `async_task_start` | INFO |
| Task thành công | `async_task_done` + `duration_ms` | INFO |
| Task lỗi | `async_task_failed` + `error` | ERROR |
| Task panic | `async_task_panic` + `stack` | ERROR |

## 6. Integration Health — 3-Tier Delivery Semantics

> Phân biệt: **HTTP OK** ≠ **Business accepted** ≠ **Confirmed delivered**.

### 6.1 Ba tầng trạng thái

| Tier | Ý nghĩa | Log event | Ví dụ |
|---|---|---|---|
| L1: Connectivity | HTTP call thành công (2xx) | `integration_call` | Bravo API trả 200 |
| L2: Acceptance | Target xác nhận nhận được | `integration_accepted` | Bravo webhook callback |
| L3: Confirmation | Kết quả cuối cùng | `integration_confirmed` | Zalo read receipt |

### 6.2 Pattern

```go
// L1: Log ngay sau HTTP call
c.log.Info(ctx, "integration_call",
    logger.F("target", "bravo"), logger.F("op", "SyncOrder"),
    logger.F("tier", "L1_connectivity"), logger.F("http_status", 200),
    logger.Duration(time.Since(start)),
)

// L2: Log khi nhận webhook callback
c.log.Info(ctx, "integration_accepted",
    logger.F("target", "bravo"), logger.F("op", "SyncOrder"),
    logger.F("tier", "L2_acceptance"), logger.F("external_ref", bravoRef),
    logger.F("latency_since_send_ms", timeSinceL1.Milliseconds()),
)

// L3: Log khi có kết quả cuối cùng
c.log.Info(ctx, "integration_confirmed",
    logger.F("target", "zalo"), logger.F("op", "SendConfirmation"),
    logger.F("tier", "L3_confirmation"), logger.F("customer_action", "confirmed"),
    logger.F("latency_since_send_ms", timeSinceL1.Milliseconds()),
)
```

### 6.3 Cảnh báo bất thường

```go
// Nếu L1 thành công nhưng L2 không đến sau X phút → log WARN
func (s *HealthChecker) CheckPendingIntegrations(ctx context.Context) {
    // Query: integration_logs WHERE tier='L1' AND NOT EXISTS tier='L2' AND age > 10min
    for _, pending := range stuckIntegrations {
        s.log.Warn(ctx, "integration_stuck_at_l1",
            logger.F("target", pending.Target),
            logger.F("op", pending.Op),
            logger.F("entity_id", pending.EntityID),
            logger.F("minutes_since_send", pending.MinutesSince),
        )
    }
}
```

## 7. Checklist I/O

- [ ] Repository method có log `db_query` với `duration_ms`?
- [ ] External API call có log `integration_call` + `http_status`?
- [ ] Redis get/set có log `cache_hit` / `cache_miss`?
- [ ] ERROR log có `error` field + `stack`?
- [ ] DB query > 200ms đã log WARN chưa?
- [ ] Mọi `go func()` đã đổi thành `SafeGo()` chưa?
- [ ] Fire-and-forget task có `async_task_start` + `async_task_done`/`_failed`?
- [ ] Integration call có phân biệt L1/L2/L3 chưa?
- [ ] Có health check cho integration stuck ở L1 không?
