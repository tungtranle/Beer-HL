---
description: "Security logging: PII masking, trace ID propagation, frontend tracing. MUST follow for handlers, middleware, and frontend code."
applyTo: "**/{handler,middleware}*.{go,tsx,ts}"
---

# Logging Security & Tracing — BHL OMS-TMS-WMS

## 1. PII Masking — KHÔNG Log Dữ Liệu Nhạy Cảm

| Field nhạy cảm | Thay bằng |
|---|---|
| `customer_name`, `contact_name` | `customer_id` |
| `phone`, `mobile` | `masked_phone` (090***567) |
| `address`, `delivery_address` | `district`, `province` |
| `id_card`, `tax_code` | Không log |
| JWT token, password, API key | Không log |

```go
// pkg/logger/mask.go
func MaskPhone(phone string) string {
    if len(phone) < 6 { return "***" }
    return phone[:3] + "***" + phone[len(phone)-3:]
}
```

```go
// ❌ KHÔNG: logger.F("customer_name", order.CustomerName)
// ✅ ĐÚNG: logger.F("customer_id", order.CustomerID)
```

## 2. Trace ID Propagation

### Inbound (TracingMiddleware — đã có)

```go
traceID := c.GetHeader("X-Trace-ID")
if traceID == "" {
    traceID = uuid.New().String()
}
ctx := logger.WithTraceID(c.Request.Context(), traceID)
```

### Outbound (khi gọi service khác)

```go
// Mọi HTTP client internal phải forward X-Trace-ID
req.Header.Set("X-Trace-ID", logger.TraceIDFromCtx(ctx))
```

**Quy tắc:**
1. **KHÔNG tạo Trace ID mới** khi đã có trong header
2. Mọi HTTP client internal dùng `InternalClient`, không `http.DefaultClient`
3. Queue message: đưa `trace_id` vào message header (không phải body)

## 3. Frontend Tracing

### apiFetch gửi X-Trace-ID

```typescript
const traceId = `fe-${Date.now()}-${++requestCounter}`
headers['X-Trace-ID'] = traceId
```

### Hiển thị Trace ID khi lỗi

```typescript
} catch (err: any) {
    const traceRef = err.serverTraceId || err.traceId || 'unknown'
    setError(`${err.message} (Ref: ${traceRef})`)
}
```

### FE structured log

```typescript
// ✅ JSON structured — tooling có thể parse
console.info(JSON.stringify({ level: 'INFO', msg: 'api_call', trace_id: traceId, status: res.status }))

// ❌ KHÔNG: console.log('Loading orders for user ' + userId)
```

## 4. Checklist Security

- [ ] Không có PII (phone, address, tên khách) trong log?
- [ ] Trace ID truyền qua `ctx` xuyên Handler → Service → Repository?
- [ ] FE `apiFetch` gửi `X-Trace-ID` header?
- [ ] Khi gọi service khác, đã forward `X-Trace-ID`?
- [ ] Log có `error_code` field khớp với error code trả về client?
