---
description: "Observability: anomaly detection, business metrics, reconciliation health checks. Use when implementing monitoring, cron jobs, or health endpoints."
applyTo: "**/*.{go,sql}"
---

# Observability & Anomaly Detection — BHL OMS-TMS-WMS

> **Triết lý**: Log ghi nhận SỰ KIỆN. Observability phát hiện SỰ VẮNG MẶT + XU HƯỚNG BẤT THƯỜNG.
> Log-based alerts bắt lỗi đã xảy ra. Anomaly detection bắt lỗi ĐANG xảy ra.

## 1. Log Event Taxonomy — Tổng hợp tất cả events

### 1.1 Bảng ánh xạ: Error type → Detection method

| Loại lỗi | Ví dụ | Phát hiện bằng | Log event |
|---|---|---|---|
| **I/O error** | DB down, API timeout | Log ERROR | `db_query_failed`, `integration_call_failed` |
| **Business rule violation** | ATP âm, gate check fail | Log WARN/ERROR | `business_rule_violation` |
| **Logic error (silent)** | Wrong calc, missing step | Invariant assertion | `invariant_violated` |
| **UX error** | Empty dropdown, broken flow | Frontend error boundary | `fe_error`, `fe_api_error` |
| **Absent event** | Order stuck, no confirmation | Scheduled healthcheck | `absent_event_detected` |
| **Data drift** | ATP mismatch vs actual stock | Reconciliation job | `reconciliation_discrepancy` |
| **Performance degradation** | Slow queries, high latency | Slow threshold WARN | `db_query_slow`, `integration_call_slow` |
| **Integration stuck** | L1 sent, L2 never arrived | Health checker | `integration_stuck_at_l1` |
| **Async task failure** | Goroutine panic, timeout | SafeGo wrapper | `async_task_failed`, `async_task_panic` |
| **Security anomaly** | Brute force, unusual pattern | Auth middleware | `auth_failed` (multiple from same IP) |

### 1.2 Quy tắc đặt tên event

```
{domain}_{operation}_{result}

Ví dụ:
  db_query_failed          ← I/O
  business_rule_violation  ← BR
  invariant_violated       ← Logic
  async_task_panic         ← Async
  integration_stuck_at_l1  ← Integration
  absent_event_detected    ← Healthcheck
  fe_api_error             ← Frontend
```

## 2. Healthcheck Endpoints — Phát hiện "Absent Events"

> Lỗi nguy hiểm nhất: hệ thống KHÔNG lỗi nhưng KHÔNG hoạt động (order không được process, trip không dispatched).

### 2.1 Pattern: Periodic Healthcheck

```go
// internal/healthcheck/checker.go
type HealthChecker struct {
    db  *pgxpool.Pool
    log logger.Logger
}

func (h *HealthChecker) RunAll(ctx context.Context) []HealthResult {
    checks := []struct {
        Name string
        Fn   func(ctx context.Context) *HealthResult
    }{
        {"orders_stuck_in_confirmed", h.checkOrdersStuck},
        {"trips_not_dispatched", h.checkTripsNotDispatched},
        {"atp_negative", h.checkNegativeATP},
        {"integration_stuck", h.checkIntegrationStuck},
        {"zalo_confirmation_pending", h.checkZaloPending},
    }
    
    var results []HealthResult
    for _, c := range checks {
        result := c.Fn(ctx)
        result.Name = c.Name
        results = append(results, *result)
        
        if result.Status == "unhealthy" {
            h.log.Warn(ctx, "absent_event_detected",
                logger.F("check", c.Name),
                logger.F("count", result.Count),
                logger.F("detail", result.Detail),
            )
        }
    }
    return results
}
```

### 2.2 Các checks bắt buộc

| Check | Query logic | Ngưỡng WARN |
|---|---|---|
| `orders_stuck_in_confirmed` | `status='confirmed' AND updated_at < NOW()-2h` | count > 0 |
| `trips_not_dispatched` | `status='planned' AND planned_date = TODAY AND NOW() > 08:00` | count > 0 |
| `atp_negative` | `SELECT ... WHERE available_qty < 0` | count > 0 |
| `integration_stuck` | L1 sent > 10min, no L2 | count > 0 |
| `zalo_pending_expired` | `sent_at < NOW()-24h AND status='pending'` | count > 0 |
| `orphan_reservations` | ATP reserved for cancelled/delivered orders | count > 0 |

### 2.3 Health API endpoint

```go
// GET /api/v1/health/business
// Trả về danh sách checks + status
// Gọi mỗi 5 phút từ cron hoặc monitoring
r.GET("/api/v1/health/business", func(c *gin.Context) {
    results := healthChecker.RunAll(c.Request.Context())
    healthy := true
    for _, r := range results {
        if r.Status == "unhealthy" {
            healthy = false
        }
    }
    status := http.StatusOK
    if !healthy {
        status = http.StatusServiceUnavailable
    }
    c.JSON(status, gin.H{"checks": results, "healthy": healthy})
})
```

## 3. Anomaly Detection Queries — SQL-based

> Prometheus chưa có trong stack → dùng SQL queries chạy periodic. Khi thêm Prometheus, migrate thành metrics.

### 3.1 Order Anomalies

```sql
-- NPP hủy đơn bất thường (> 3 lần/ngày)
SELECT customer_id, customer_name, COUNT(*) as cancel_count
FROM sales_orders
WHERE status = 'cancelled'
  AND updated_at >= CURRENT_DATE
GROUP BY customer_id, customer_name
HAVING COUNT(*) > 3
ORDER BY cancel_count DESC;

-- Đơn hàng có total_amount = 0 hoặc âm
SELECT id, order_number, total_amount::text, status
FROM sales_orders
WHERE total_amount <= 0 AND status NOT IN ('draft', 'cancelled');

-- Đơn confirmed nhưng không có line items
SELECT so.id, so.order_number
FROM sales_orders so
LEFT JOIN sales_order_lines sol ON sol.sales_order_id = so.id
WHERE so.status = 'confirmed'
  AND sol.id IS NULL;
```

### 3.2 ATP / Inventory Anomalies

```sql
-- ATP âm (phantom reservation)
SELECT product_id, warehouse_id, 
       on_hand_qty, reserved_qty, 
       (on_hand_qty - reserved_qty) as available
FROM inventory
WHERE on_hand_qty - reserved_qty < 0;

-- Reservations cho orders đã cancelled (orphan)
SELECT ir.id, ir.product_id, ir.quantity, so.status
FROM inventory_reservations ir
JOIN sales_orders so ON so.id = ir.order_id
WHERE so.status IN ('cancelled', 'delivered', 'rejected')
  AND ir.status = 'active';
```

### 3.3 Delivery / Trip Anomalies

```sql
-- Routes có thời gian giao > 12h (bất thường)
SELECT t.id, t.trip_number, 
       EXTRACT(EPOCH FROM (t.completed_at - t.departed_at))/3600 as hours
FROM trips t
WHERE t.status = 'completed'
  AND t.completed_at - t.departed_at > INTERVAL '12 hours';

-- Stops giao lại > 2 lần (delivery issue pattern)
SELECT stop_id, order_id, COUNT(*) as attempt_count
FROM delivery_attempts
GROUP BY stop_id, order_id
HAVING COUNT(*) > 2;
```

### 3.4 Integration / Confirmation Anomalies

```sql
-- Zalo confirmations gửi nhưng không phản hồi > 24h
SELECT oc.id, oc.order_id, oc.sent_at,
       EXTRACT(EPOCH FROM (NOW() - oc.sent_at))/3600 as hours_pending
FROM order_confirmations oc
WHERE oc.status = 'pending'
  AND oc.sent_at < NOW() - INTERVAL '24 hours';

-- Tỷ lệ confirm thấp (dưới 50% trong 7 ngày)
SELECT 
    COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
    COUNT(*) FILTER (WHERE status = 'pending') as pending,
    COUNT(*) as total,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'confirmed') / NULLIF(COUNT(*), 0), 1) as rate_pct
FROM order_confirmations
WHERE sent_at >= NOW() - INTERVAL '7 days';
```

## 4. Business Metrics — Đo lường health qua số liệu

> Khi thêm Prometheus, expose qua `/metrics`. Hiện tại: log periodic + health endpoint.

### 4.1 Metrics Key

| Metric | Cách tính | Ngưỡng cảnh báo |
|---|---|---|
| `orders_per_hour` | COUNT orders created in last hour | < 1 trong giờ làm việc (8-17h) |
| `delivery_success_rate` | delivered / (delivered + failed + rejected) | < 90% |
| `atp_accuracy` | Matches between ATP calc and actual stock | Discrepancy > 5% |
| `avg_order_to_delivery_hours` | AVG time from confirmed → delivered | > 48h |
| `zalo_confirmation_rate` | confirmed / total sent (7 days) | < 50% |
| `gate_check_fail_rate` | failed / total gate checks | > 5% |
| `integration_l1_to_l2_p95_minutes` | P95 latency L1→L2 | > 30min |

### 4.2 Periodic Metrics Logger

```go
// Chạy mỗi 15 phút — log business metrics dưới dạng structured log
func (m *MetricsCollector) LogBusinessMetrics(ctx context.Context) {
    metrics := m.collectAll(ctx)
    for _, metric := range metrics {
        level := "info"
        if metric.IsAnomalous {
            level = "warn"
        }
        if level == "warn" {
            m.log.Warn(ctx, "business_metric_anomaly",
                logger.F("metric", metric.Name),
                logger.F("value", metric.Value),
                logger.F("threshold", metric.Threshold),
                logger.F("window", metric.Window),
            )
        } else {
            m.log.Info(ctx, "business_metric",
                logger.F("metric", metric.Name),
                logger.F("value", metric.Value),
                logger.F("window", metric.Window),
            )
        }
    }
}
```

## 5. Frontend Error Detection

> Backend log không bắt được: JS crash, empty state do API trả data sai, UX flow broken.

### 5.1 Error Boundary + API error tracking (đã có trong logging-security)

Bổ sung:

```typescript
// Detect "empty state" bất thường — dropdown/list SẼ PHẢI có data
export function logEmptyState(componentName: string, dataType: string) {
  if (process.env.NODE_ENV === 'production') return; // chỉ dev/staging
  console.warn(JSON.stringify({
    event: 'fe_empty_state_warning',
    component: componentName,
    data_type: dataType,
    url: window.location.pathname,
    timestamp: new Date().toISOString(),
    trace_id: sessionStorage.getItem('trace_id'),
  }));
}

// Dùng trong component
useEffect(() => {
  if (data && data.length === 0) {
    logEmptyState('ProductDropdown', 'products');
  }
}, [data]);
```

### 5.2 API Response Validation

```typescript
// Validate response shape — bắt lỗi API trả sai format ngay
function validateResponse<T>(data: unknown, schema: { required: string[] }, context: string): T {
  if (!data || typeof data !== 'object') {
    console.error(JSON.stringify({
      event: 'fe_invalid_response',
      context,
      received_type: typeof data,
      trace_id: sessionStorage.getItem('trace_id'),
    }));
    throw new Error(`Invalid response for ${context}`);
  }
  for (const field of schema.required) {
    if (!(field in (data as Record<string, unknown>))) {
      console.error(JSON.stringify({
        event: 'fe_missing_field',
        context,
        field,
        trace_id: sessionStorage.getItem('trace_id'),
      }));
    }
  }
  return data as T;
}
```

## 6. Detection Coverage Matrix

| Layer | Phát hiện cái gì | Tool/Pattern | File hướng dẫn |
|---|---|---|---|
| Handler | Input validation, auth | Error codes + response | error-codes.instructions |
| Service | Business logic errors | Domain errors + invariant assertions | logging-core, business-rules |
| Repository | I/O errors, slow queries | LogIO + slow threshold | logging-io |
| Integration | External API, L1/L2/L3 | 3-tier health tracking | logging-io |
| Async | Goroutine failures | SafeGo wrapper | logging-io |
| Frontend | JS errors, empty states | Error boundary + logEmptyState | logging-security, frontend-patterns |
| Business health | Absent events, drift | Healthcheck periodic | **this file** |
| Data integrity | Phantom reservations | Anomaly SQL queries | **this file** |
| Cross-system | End-to-end flow broken | Operation bookend (start/end) | logging-core |

## 7. Implementation Priority

| Phase | Làm gì | Impact |
|---|---|---|
| **Phase 1** (now) | SafeGo wrapper, Domain errors, Invariant assertions | Bắt 80% silent failures |
| **Phase 2** | Healthcheck endpoints, Anomaly SQL queries | Bắt absent events + data drift |
| **Phase 3** | Frontend empty-state detection, API response validation | Bắt UX errors |
| **Phase 4** | Prometheus metrics, Grafana dashboards | Real-time visibility |
