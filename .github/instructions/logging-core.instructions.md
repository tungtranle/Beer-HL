---
description: "Core logging standards: Logger interface, log levels, DI pattern, structured JSON format. MUST follow for ALL Go code."
applyTo: "**/*.go"
---

# Logging Core — BHL OMS-TMS-WMS

> Mọi lỗi có thể trace từ FE → BE → DB → Integration bằng duy nhất **1 Trace ID**.

## 1. Logger Interface (`pkg/logger/logger.go`)

```go
type Logger interface {
    Debug(ctx context.Context, msg string, fields ...Field)
    Info(ctx context.Context, msg string, fields ...Field)
    Warn(ctx context.Context, msg string, fields ...Field)
    Error(ctx context.Context, msg string, err error, fields ...Field)
    Fatal(ctx context.Context, msg string, err error, fields ...Field)
}

func F(key string, value any) Field { return Field{Key: key, Value: value} }
```

## 2. Dependency Injection — KHÔNG dùng global logger

```go
// ✅ Logger inject qua constructor
type Handler struct { svc *Service; log logger.Logger }
func NewHandler(svc *Service, log logger.Logger) *Handler { ... }

// ❌ KHÔNG dùng log.Printf, fmt.Println
```

## 3. Trace ID & Context

```go
// Middleware inject tự động — code business chỉ cần truyền ctx
ctx := logger.WithTraceID(c.Request.Context(), traceID)
ctx = logger.WithUserID(ctx, claims.UserID.String())
// Logger tự lấy trace_id, user_id từ ctx
```

## 4. Log Levels

| Level | Dùng khi | Ví dụ |
|-------|----------|-------|
| `DEBUG` | Development, cache hit/miss | `cache_hit`, `query_built` |
| `INFO`  | Flow bình thường, I/O thành công | `http_request`, `db_query`, `order_confirmed` |
| `WARN`  | Business rule violation, retry | `invalid_transition`, `atp_low` |
| `ERROR` | I/O failure, unexpected error | `db_query_failed`, `integration_call_failed` |
| `FATAL` | Không thể khởi động | `db_connect_failed`, `key_load_failed` |

## 5. Log JSON Format — Field bắt buộc

```json
{
  "ts": "2026-03-17T10:30:00.123Z",
  "level": "INFO",
  "msg": "db_query",
  "service": "bhl-oms",
  "trace_id": "b3a1f9c2-...",
  "user_id": "uuid",
  "duration_ms": 12
}
```

**Bắt buộc:** `ts`, `level`, `msg`, `service`, `trace_id`
**Tuỳ context:** `user_id`, `op`, `table`, `target`, `duration_ms`, `error`, `stack`

## 6. Error Log — Chỉ log 1 lần tại gốc

```go
// Repository: log + return err       ← LOG TẠI ĐÂY
// Service: return fmt.Errorf(... %w) ← KHÔNG log lại
// Handler: trả HTTP error            ← KHÔNG log lại
```

## 7. Wiring tại main.go

```go
log := logger.New(os.Stdout, logger.INFO)
omsRepo    := oms.NewRepository(db, log)
omsSvc     := oms.NewService(omsRepo, log)
omsHandler := oms.NewHandler(omsSvc, log)
r.Use(middleware.TracingMiddleware(log))
```

## 8. Logic Error Detection — Domain-Typed Errors

> **Vấn đề**: Log chỉ bắt I/O errors. Logic errors (sai status, sai tính toán, missing data) trôi qua silent.  
> **Giải pháp**: Domain errors bắt buộc mang `error_code` + business context. Log tự động tại handler boundary.

### 8.1 Domain Error Pattern

```go
// pkg/apperror/domain.go — domain error tự mang context
type DomainError struct {
    Code    string         // "ATP_INSUFFICIENT", "INVALID_TRANSITION"
    Message string         // user-facing message
    Fields  []logger.Field // structured context cho log
    Inner   error          // wrapped error (optional)
}

func (e *DomainError) Error() string { return e.Message }
func (e *DomainError) Unwrap() error { return e.Inner }

// Constructor buộc caller cung cấp context
func NewDomainError(code, message string, fields ...logger.Field) *DomainError {
    return &DomainError{Code: code, Message: message, Fields: fields}
}
```

### 8.2 Service trả Domain Error thay vì generic error

```go
// ✅ ĐÚNG — error mang đủ context để handler auto-log
func (s *Service) CreateOrder(ctx context.Context, req CreateOrderRequest) (*domain.SalesOrder, error) {
    if atp < req.Quantity {
        return nil, apperror.NewDomainError("ATP_INSUFFICIENT",
            "Không đủ hàng tồn kho",
            logger.F("rule", "BR-OMS-01"),
            logger.F("product_id", req.ProductID),
            logger.F("requested", req.Quantity),
            logger.F("available", atp),
        )
    }
    // ...
}

// ❌ SAI — error không có context, handler không biết log gì
return nil, fmt.Errorf("not enough stock")
```

### 8.3 Handler Boundary — Auto-log mọi error

```go
// Handler dùng helper: log tự động, caller KHÔNG CẦN nhớ log
func (h *Handler) handleResult(c *gin.Context, err error, successCode int, data any) {
    if err == nil {
        response.JSON(c, successCode, data)
        return
    }
    var domErr *apperror.DomainError
    if errors.As(err, &domErr) {
        // Domain error: log WARN + trả business error
        h.log.Warn(c.Request.Context(), "business_error",
            append(domErr.Fields, logger.F("error_code", domErr.Code))...,
        )
        response.Error(c, http.StatusUnprocessableEntity, domErr.Code, domErr.Message, nil)
    } else {
        // System error: log ERROR + trả 500
        h.log.Error(c.Request.Context(), "system_error", err,
            logger.F("error_code", "INTERNAL_ERROR"),
        )
        response.InternalError(c)
    }
}
```

> **Lý do không dùng Result[T]:** Go idiom là `(T, error)`. Result struct ép caller unwrap → friction.
> Domain-typed error đạt cùng mục đích (context tự động, log không quên) mà giữ Go convention.

### 8.4 Quy tắc

| Loại error | Ai tạo | Ai log | Pattern |
|---|---|---|---|
| Business rule violation | Service → `DomainError` | Handler (auto) | `business_error` + `error_code` |
| I/O failure | Repository → `fmt.Errorf` | Repository (tại chỗ) | `db_query_failed` |
| Validation input | Handler → `BadRequest` | Handler (tại chỗ) | `validation_error` |
| Integration failure | Integration → `DomainError` | Handler hoặc hook | `integration_error` |

## 9. Silent Failure Detection — "Absent Event" Monitoring

> Lỗi nguy hiểm nhất: code chạy KHÔNG lỗi nhưng kết quả SAI (missing data, wrong calc, skipped step).

### 9.1 Operation Bookend Pattern

```go
// Mọi business operation quan trọng phải log CẢ bắt đầu VÀ kết thúc
func (s *Service) CreateOrder(ctx context.Context, req CreateOrderRequest) (*domain.SalesOrder, error) {
    s.log.Info(ctx, "op_start", logger.F("op", "CreateOrder"), logger.F("customer_id", req.CustomerID))
    defer func(start time.Time) {
        s.log.Info(ctx, "op_end", logger.F("op", "CreateOrder"), logger.F("duration_ms", time.Since(start).Milliseconds()))
    }(time.Now())
    // ... logic ...
}
```

### 9.2 Khi nào bắt buộc dùng Bookend

| Operation | Bookend? | Lý do |
|---|---|---|
| CreateOrder, ConfirmOrder, CancelOrder | **Bắt buộc** | Nếu thiếu `op_end` → order bị treo |
| Reserve/Release ATP | **Bắt buộc** | ATP leak = phantom stock |
| SendZaloConfirmation | **Bắt buộc** | Async → dễ mất |
| FEFO picking | **Bắt buộc** | Audit compliance |
| ListOrders, GetStock | Không cần | Read-only, không side-effect |
