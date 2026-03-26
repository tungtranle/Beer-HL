# BACKEND_GUIDE — Go Backend Patterns & Standards

> Merge từ: coding-standards + logging-core/io/security + observability instructions
> AI đọc file này khi code backend Go.
> **Code hiện tại = source of truth. Chỉ áp dụng cho code MỚI.**

---

## §1 Three-Layer Architecture

```
Handler (handler.go)  → Parse request, validate input, trả HTTP response
Service (service.go)  → Business logic, validation nghiệp vụ, transaction
Repository (repo.go)  → SQL queries, data access
Domain (models.go)    → Structs dùng chung (40+ structs, 1 file duy nhất — DEC-002)
```

**KHÔNG BAO GIỜ:** business logic trong handler, SQL trong service, HTTP response trong repository.

### Constructor pattern
```go
type Handler struct { svc *Service; log logger.Logger }
func NewHandler(svc *Service, log logger.Logger) *Handler { ... }

type Service struct { repo *Repository; log logger.Logger }
type Repository struct { db *pgxpool.Pool; log logger.Logger }
```

### Wiring (main.go)
```go
log := logger.New(os.Stdout, logger.INFO)
repo := oms.NewRepository(db, log)
svc  := oms.NewService(repo, log)
hdl  := oms.NewHandler(svc, log)
```

---

## §2 Logging

### Logger Interface — DI, KHÔNG global
```go
// ✅ Inject qua constructor
s.log.Info(ctx, "event_name", logger.F("key", "value"))
s.log.Error(ctx, "event_name", err, logger.F("key", "value"))

// ❌ KHÔNG dùng log.Printf, fmt.Println
```

### Log Levels
| Level | Dùng khi |
|-------|----------|
| DEBUG | Development, cache hit/miss |
| INFO | Flow bình thường, I/O thành công |
| WARN | Business rule violation, retry, slow query |
| ERROR | I/O failure, unexpected error |
| FATAL | Không thể khởi động |

### Error log — chỉ 1 lần tại gốc
```
Repository: log + return err       ← LOG TẠI ĐÂY
Service: return fmt.Errorf(... %w) ← KHÔNG log lại
Handler: trả HTTP error            ← KHÔNG log lại
```

### I/O Boundary — LUÔN log duration_ms
```go
// DB queries
start := time.Now()
row := r.db.QueryRow(ctx, sql, args...)
r.log.Info(ctx, "db_query", logger.F("op", "CreateOrder"), logger.F("table", "sales_orders"), logger.Duration(time.Since(start)))

// External APIs
c.log.Info(ctx, "integration_call", logger.F("target", "bravo"), logger.F("http_status", 200), logger.Duration(time.Since(start)))
```

### Slow Thresholds → auto WARN
| I/O Type | Ngưỡng |
|----------|--------|
| DB query | > 200ms |
| Redis | > 50ms |
| External API | > 1000ms |

---

## §3 Error Handling

### Response helpers (pkg/response/)
```go
response.OK(c, data)
response.OKWithMeta(c, data, meta)
response.BadRequest(c, "message")
response.NotFound(c, "message")
response.Err(c, statusCode, "ERROR_CODE", "message")
response.InternalError(c)
```

### Error code trong log — bắt buộc
```go
s.log.Warn(ctx, "business_error",
    logger.F("error_code", "ATP_INSUFFICIENT"),
    logger.F("product_id", productID),
)
return response.Error(c, 422, "ATP_INSUFFICIENT", "Không đủ tồn kho", nil)
```

### Integration errors → 202, KHÔNG block
```go
// Bravo/DMS/Zalo fail → user vẫn thành công
return response.Err(c, 202, "BRAVO_SYNC_FAILED", "Chưa đồng bộ Bravo, sẽ retry")
```

---

## §4 Security & Tracing

### Trace ID — xuyên suốt mọi tầng
```go
// Middleware inject tự động
ctx := logger.WithTraceID(c.Request.Context(), traceID)
// Outbound: forward X-Trace-ID header
req.Header.Set("X-Trace-ID", logger.TraceIDFromCtx(ctx))
```

### PII Masking — KHÔNG log
| Field nhạy cảm | Thay bằng |
|---|---|
| customer_name | customer_id |
| phone | masked_phone (090***567) |
| address | district, province |
| JWT, password, API key | Không log |

---

## §5 Async — SafeGo Pattern

```go
// ✅ LUÔN dùng SafeGo — KHÔNG go func() trực tiếp
SafeGo(ctx, s.log, "SendZaloConfirmation", func(ctx context.Context) error {
    return s.confirmSvc.SendOrderConfirmation(ctx, order.ID, order.CustomerPhone)
})

// ❌ SAI — panic = crash, lỗi = silent
go func() { s.confirmSvc.Send(...) }()
```

SafeGo tự log: `async_task_start` → `async_task_done` / `async_task_failed` / `async_task_panic`

---

## §6 SQL & Database

### pgx v5 — LUÔN cast
```sql
SELECT status::text, delivery_date::text FROM sales_orders
```

### Parameterized queries — KHÔNG string concat
```go
rows, err := r.db.Query(ctx, `SELECT id FROM products WHERE id = ANY($1)`, ids)
```

### Transaction pattern
```go
tx, err := r.db.Begin(ctx)
if err != nil { return fmt.Errorf("begin tx: %w", err) }
defer tx.Rollback(ctx)
// ... operations ...
return tx.Commit(ctx)
```

### Tiền: NUMERIC(15,2), KHÔNG FLOAT
```sql
total_amount NUMERIC(15,2) NOT NULL DEFAULT 0
```

---

## §7 Code Style Quick Reference

| Quy tắc | Pattern |
|---------|---------|
| Receiver | `h *Handler`, `s *Service`, `r *Repository` |
| Function | PascalCase verb: `CreateOrder`, `ListProducts` |
| Import | 3 groups: stdlib / internal / third-party |
| Error wrap | `fmt.Errorf("create order: %w", err)` |
| File structure | 3 files per module: handler + service + repository |
| Models | All in `internal/domain/models.go` (DEC-002) |
| Response | Use `pkg/response/` helpers (DEC-003) |
| DB access | Raw pgx queries (DEC-004) |
