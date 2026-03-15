---
description: "Use when writing, reviewing, or modifying any source code in the project. Covers Go backend, Next.js frontend, SQL migrations, Python services, and Docker configs. Ensures consistent code style, maintainability, and ease of future debugging."
applyTo: ["**/*.go", "**/*.ts", "**/*.tsx", "**/*.sql", "**/*.py", "**/Dockerfile*", "**/docker-compose*.yml"]
---

# Quy chuẩn Code — BHL OMS-TMS-WMS

> Mục tiêu: Code dễ đọc, dễ sửa, dễ bảo trì. Người mới vào dự án có thể hiểu và chỉnh sửa nhanh.

---

## 1. Kiến trúc tổng quan

```
bhl-oms/
├── cmd/server/main.go        ← Entry point, DI, route registration
├── internal/                  ← Business logic (KHÔNG expose ra ngoài)
│   ├── auth/                  ← Xác thực (handler + service)
│   ├── config/                ← Đọc env vars
│   ├── domain/models.go       ← Tất cả struct/model dùng chung
│   ├── middleware/             ← JWT auth, RBAC
│   ├── oms/                   ← Order Management
│   │   ├── handler.go         ← HTTP layer (parse request, gọi service, trả response)
│   │   ├── service.go         ← Business logic (validate, tính toán, transaction)
│   │   └── repository.go      ← Data access (SQL queries)
│   └── tms/                   ← Transport Management (cùng pattern)
├── pkg/                       ← Shared utilities (dùng được từ bên ngoài)
│   ├── db/                    ← Database connection pool
│   └── response/              ← Chuẩn API response format
├── migrations/                ← SQL migrations + seed data
├── vrp-solver/                ← Python VRP service (OR-Tools)
└── web/                       ← Next.js frontend
    └── src/app/dashboard/     ← Các trang UI theo route
```

### Nguyên tắc phân tầng

| Tầng | File | Trách nhiệm | KHÔNG được làm |
|------|------|-------------|----------------|
| **Handler** | `handler.go` | Parse request, validate input, gọi service, trả response | Viết SQL, business logic |
| **Service** | `service.go` | Business logic, validation nghiệp vụ, quản lý transaction | Truy cập DB trực tiếp, trả HTTP response |
| **Repository** | `repository.go` | Viết SQL, đọc/ghi DB | Business logic, trả HTTP response |
| **Domain** | `models.go` | Định nghĩa struct/model dùng chung | Logic, SQL, HTTP |

**Luồng gọi bắt buộc:** `Handler → Service → Repository` (KHÔNG bao giờ ngược lại hoặc bỏ tầng)

---

## 2. Go Backend

### 2.1 Cấu trúc file

Mỗi module (`oms`, `tms`, ...) gồm đúng 3 file:

```go
// handler.go — Constructor + Route registration + HTTP handlers
type Handler struct { svc *Service }
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) { ... }

// service.go — Constructor + Business methods
type Service struct { repo *Repository }
func NewService(repo *Repository) *Service { return &Service{repo: repo} }

// repository.go — Constructor + Data access methods
type Repository struct { db *pgxpool.Pool }
func NewRepository(db *pgxpool.Pool) *Repository { return &Repository{db: db} }
```

### 2.2 Receiver names

Luôn dùng chữ cái đầu của struct, nhất quán trong toàn bộ file:

```go
func (h *Handler) CreateOrder(...)   // h = Handler
func (s *Service) CreateOrder(...)   // s = Service
func (r *Repository) CreateOrder(...)// r = Repository
```

### 2.3 Import ordering

3 nhóm, cách nhau bằng dòng trống:

```go
import (
    // 1. Standard library
    "context"
    "fmt"
    "net/http"

    // 2. Internal packages
    "bhl-oms/internal/domain"
    "bhl-oms/internal/middleware"
    "bhl-oms/pkg/response"

    // 3. Third-party
    "github.com/gin-gonic/gin"
    "github.com/google/uuid"
    "github.com/jackc/pgx/v5"
)
```

### 2.4 Error handling

```go
// ✅ Luôn wrap error với context rõ ràng
if err != nil {
    return nil, fmt.Errorf("create order: %w", err)
}

// ✅ Transaction pattern — defer Rollback ngay sau BeginTx
tx, err := s.repo.BeginTx(ctx)
if err != nil {
    return nil, fmt.Errorf("begin tx: %w", err)
}
defer tx.Rollback(ctx)
// ... các thao tác ...
if err := tx.Commit(ctx); err != nil {
    return nil, fmt.Errorf("commit: %w", err)
}

// ✅ Handler: phân biệt lỗi business vs lỗi hệ thống
if err.Error() == "ATP_INSUFFICIENT: ..." {
    response.ErrWithDetails(c, http.StatusUnprocessableEntity, "ATP_INSUFFICIENT", err.Error(), nil)
    return
}
response.Err(c, http.StatusBadRequest, "ORDER_FAILED", err.Error())

// ❌ KHÔNG bỏ qua error
result, _ := someFunction()  // SAI — phải handle error
```

### 2.5 Request/Response struct

```go
// Request struct đặt trong service.go (gần logic xử lý)
type CreateOrderRequest struct {
    CustomerID   uuid.UUID        `json:"customer_id"`
    WarehouseID  uuid.UUID        `json:"warehouse_id"`
    DeliveryDate string           `json:"delivery_date"`
    Items        []OrderItemInput `json:"items"`
}

// Response = domain struct (models.go), KHÔNG tạo response struct riêng
```

### 2.6 Naming conventions

| Loại | Quy tắc | Ví dụ |
|------|---------|-------|
| Function | PascalCase, bắt đầu bằng động từ | `CreateOrder`, `ListProducts`, `GetATP` |
| Biến | camelCase | `orderStatus`, `totalAmount` |
| Const | camelCase hoặc PascalCase | `defaultLimit`, `MaxRetries` |
| File | snake_case | `handler.go`, `models.go` |
| Package | lowercase, 1 từ | `oms`, `tms`, `auth`, `domain` |

### 2.7 SQL trong Repository

```go
// ✅ pgx v5: LUÔN cast ::text cho enum và date khi scan
query := `SELECT so.status::text, so.delivery_date::text FROM sales_orders so`

// ✅ Dùng $1, $2 parameterized queries (KHÔNG string concat)
rows, err := r.db.Query(ctx, `
    SELECT id, name FROM products WHERE id = ANY($1)
`, productIDs)

// ✅ Dùng COALESCE cho nullable joins
query := `SELECT COALESCE(w.name, '') as warehouse_name FROM ...`

// ✅ Dynamic query builder cho filters
args := []interface{}{}
argIdx := 1
if status != "" {
    query += fmt.Sprintf(" AND so.status = $%d", argIdx)
    args = append(args, status)
    argIdx++
}

// ❌ KHÔNG dùng string format cho giá trị (SQL injection)
query := fmt.Sprintf("WHERE status = '%s'", status) // SAI
```

---

## 3. Frontend (Next.js + TypeScript)

### 3.1 Cấu trúc trang

```
web/src/app/dashboard/
├── layout.tsx              ← Sidebar + auth guard
├── page.tsx                ← Dashboard chính
├── {module}/
│   ├── page.tsx            ← Danh sách (list)
│   ├── new/page.tsx        ← Form tạo mới
│   └── [id]/
│       ├── page.tsx        ← Chi tiết (detail)
│       └── edit/page.tsx   ← Form sửa
```

### 3.2 Component pattern

Mỗi page là 1 file, dùng `'use client'` cho trang tương tác:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api'

// 1. Interface ngay đầu file
interface Order {
  id: string
  order_number: string
  status: string
  total_amount: number
}

// 2. Constants (status colors, labels) ngay trước component
const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
}

const statusLabels: Record<string, string> = {
  confirmed: 'Đã xác nhận',
  pending_approval: 'Chờ duyệt',
}

// 3. Component function
export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  // 4. Data loading function (tách ra để gọi lại được)
  const loadOrders = async () => {
    setLoading(true)
    try {
      const res: any = await apiFetch('/orders?limit=50')
      setOrders(res.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)  // Luôn tắt loading trong finally
    }
  }

  useEffect(() => { loadOrders() }, [])

  // 5. Helper functions
  const formatMoney = (n: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n)

  // 6. Render
  return (...)
}
```

### 3.3 API calling

```typescript
// ✅ Luôn dùng apiFetch từ @/lib/api (auto auth + refresh)
const res: any = await apiFetch('/orders', {
  method: 'POST',
  body: { customer_id: '...', items: [...] },
})

// ✅ Handle null data
setOrders(res.data || [])

// ✅ Error handling với try/catch
try {
  await apiFetch(`/orders/${id}/cancel`, { method: 'POST' })
  loadOrders()  // Reload sau khi thành công
} catch (err: any) {
  alert(err.message)
}

// ❌ KHÔNG gọi fetch trực tiếp (mất auto-refresh token)
const res = await fetch('/api/orders') // SAI
```

### 3.4 State management

```typescript
// ✅ useState cho state cục bộ của page
const [data, setData] = useState<Type[]>([])
const [loading, setLoading] = useState(true)
const [error, setError] = useState('')

// ✅ Derived state = tính trực tiếp, KHÔNG dùng useState
const totalAmount = items.reduce((sum, i) => sum + (i.amount || 0), 0)

// ✅ Lookup maps cho O(1) access
const productMap = new Map(products.map(p => [p.id, p]))
```

### 3.5 Styling

```typescript
// ✅ Tailwind CSS trực tiếp, KHÔNG dùng CSS modules
<div className="bg-white rounded-xl shadow-sm p-6 mb-6">

// ✅ Conditional classes
<span className={`px-2 py-1 rounded-full text-xs ${statusColors[status] || 'bg-gray-100'}`}>

// ✅ Status colors + labels = Record<string, string> constants
// (tái sử dụng giữa các trang, giữ nhất quán)
```

### 3.6 TypeScript

```typescript
// ✅ Interface cho data từ API (đặt đầu file)
interface Order { id: string; status: string; ... }

// ✅ Dùng Record cho maps
const colors: Record<string, string> = { ... }

// ❌ KHÔNG dùng `any` trừ khi thật sự cần (API response tạm)
const data: any = res.data  // Chấp nhận cho API response chưa type đầy đủ
```

---

## 4. Database & Migrations

### 4.1 Naming

| Đối tượng | Quy tắc | Ví dụ |
|-----------|---------|-------|
| Table | `snake_case`, số nhiều | `sales_orders`, `order_items`, `stock_quants` |
| Column | `snake_case` | `customer_id`, `total_amount`, `created_at` |
| Primary key | Luôn `id UUID DEFAULT gen_random_uuid()` | |
| Foreign key | `{bảng_số_ít}_id` | `customer_id`, `order_id`, `warehouse_id` |
| Enum type | `snake_case` | `order_status`, `shipment_status` |
| Enum values | `lowercase` | `'draft'`, `'confirmed'`, `'pending_approval'` |
| Index | `idx_{table}_{columns}` | `idx_sales_orders_customer`, `idx_sales_orders_status` |
| Unique constraint | `unq_{table}_{column}` | `unq_sales_orders_number` |
| Check constraint | `chk_{table}_{rule}` | `chk_stock_quants_qty` |

### 4.2 Mỗi bảng bắt buộc có

```sql
CREATE TABLE {table_name} (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- ... columns ...
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.2a Kiểu dữ liệu bắt buộc

```sql
-- Tiền VND: LUÔN dùng NUMERIC(15,2) — KHÔNG dùng FLOAT hoặc MONEY
total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
credit_limit NUMERIC(15,2) NOT NULL,

-- Timestamps: LUÔN dùng TIMESTAMPTZ (lưu UTC, convert ở app layer)
created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
-- KHÔNG dùng TIMESTAMP (thiếu timezone)
```

### 4.3 Enum definition pattern

```sql
-- Luôn dùng DO $$ ... EXCEPTION để idempotent
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'pending_approval', ...);
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

### 4.4 Migration files

```
migrations/
├── 001_init.up.sql       ← Tạo schema (idempotent)
├── 001_init.down.sql     ← Rollback
├── seed.sql              ← Dữ liệu cơ bản
└── seed_full.sql         ← Dữ liệu demo (50 đơn, 20 NPP, ...)
```

### 4.5 Lưu ý PostgreSQL + pgx v5

```sql
-- ✅ Enum columns: luôn cast ::text khi SELECT trong Go
SELECT status::text, delivery_date::text FROM sales_orders

-- ✅ UUID array: dùng ANY($1) thay vì IN
WHERE product_id = ANY($1)

-- ✅ JSONB cho dữ liệu linh hoạt
items JSONB DEFAULT '[]'
```

---

## 5. API Response Format

Mọi API response PHẢI tuân theo format:

```json
// Thành công
{
  "success": true,
  "data": { ... },
  "meta": { "page": 1, "limit": 20, "total": 50, "total_pages": 3 }
}

// Lỗi
{
  "success": false,
  "error": {
    "code": "ATP_INSUFFICIENT",
    "message": "không đủ tồn kho cho một hoặc nhiều sản phẩm",
    "details": null
  }
}
```

**Dùng helper functions từ `pkg/response/`:**

```go
response.OK(c, data)                                    // 200 + data
response.OKWithMeta(c, data, paginationMeta)            // 200 + data + meta
response.BadRequest(c, "message")                       // 400
response.NotFound(c, "message")                         // 404
response.InternalError(c)                               // 500
response.Err(c, statusCode, "ERROR_CODE", "message")    // Custom error
response.ErrWithDetails(c, statusCode, "CODE", "msg", details) // Error + details
```

---

## 6. Docker & Infrastructure

### 6.1 Docker Compose services

| Service | Port (host) | Port (container) | Dùng cho |
|---------|-------------|-------------------|----------|
| postgres | 5434 | 5432 | PostgreSQL 16 |
| redis | 6379 | 6379 | Cache/session |
| vrp | 8090 | 8090 | Python VRP solver |

### 6.2 Env vars (backend Go)

```bash
DB_URL=postgres://bhl:bhl_dev@127.0.0.1:5434/bhl_dev?sslmode=disable
JWT_PRIVATE_KEY_PATH=./keys/private.pem
JWT_PUBLIC_KEY_PATH=./keys/public.pem
REDIS_URL=localhost:6379
VRP_SOLVER_URL=http://localhost:8090
SERVER_PORT=8080           # Mặc định 8080
JWT_ACCESS_TTL=4h          # Mặc định 4 giờ
JWT_REFRESH_TTL=7d         # Mặc định 7 ngày
```

### 6.3 UTF-8 và PostgreSQL

```powershell
# ✅ Dùng docker cp + exec psql -f (giữ đúng encoding)
docker cp ./migrations/seed.sql bhl-oms-postgres-1:/tmp/
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/seed.sql

# ❌ KHÔNG pipe qua PowerShell (hỏng tiếng Việt)
Get-Content seed.sql | docker exec -T postgres psql  # SAI
```

---

## 7. Quy tắc Git & Tổ chức code

### 7.1 Khi thêm tính năng mới

1. **Backend**: Thêm method vào handler → service → repository (đúng thứ tự tầng)
2. **Domain model**: Nếu cần struct mới → thêm vào `internal/domain/models.go`
3. **Frontend**: Tạo page mới theo đúng cấu trúc thư mục
4. **Docs**: Cập nhật BRD + API doc (theo instruction `sync-brd-docs`)

### 7.2 Khi sửa bug

1. Xác định bug ở tầng nào (handler/service/repository/frontend)
2. Sửa đúng tầng đó — KHÔNG sửa ở tầng khác để "workaround"
3. Kiểm tra xem bug có ảnh hưởng test case không → cập nhật TST

### 7.3 Checklist review code

- [ ] Không có SQL injection (dùng parameterized queries)
- [ ] Error được wrap với context rõ ràng
- [ ] Transaction có `defer tx.Rollback(ctx)` 
- [ ] Enum/date columns có `::text` khi scan trong pgx
- [ ] Frontend dùng `apiFetch` (không dùng `fetch` trực tiếp)
- [ ] Loading state được set `false` trong `finally`
- [ ] Null data được handle: `res.data || []`
- [ ] Thay đổi đã được phản ánh trong BRD/API doc nếu cần

---

## 8. Git Conventions

### 8.1 Branch Naming

```
main                          # Production-ready
develop                       # Integration branch
feature/oms-create-order      # Feature branches
fix/pgx-enum-scan-error       # Bug fixes
chore/update-dependencies     # Maintenance
docs/api-contract-v2          # Documentation
```

### 8.2 Commit Messages (Conventional Commits)

```
feat(oms): add ATP check on order creation
fix(tms): resolve pgx enum scan error for trip_status
chore(deps): upgrade pgx to v5.6.0
docs(api): add VRP solver endpoint documentation
refactor(wms): extract picking logic to separate service
```

Format: `type(scope): description`
- **type:** feat | fix | chore | docs | test | refactor | perf
- **scope:** oms | tms | wms | auth | rec | integration | infra
- **description:** lowercase, imperative mood, tiếng Anh

---

## 9. Anti-Patterns — TUYỆT ĐỐI KHÔNG LÀM

```go
// ❌ Business logic trong handler
func (h *Handler) CreateOrder(c *gin.Context) {
    if balance > creditLimit { ... }  // SAI — phải ở service
}

// ❌ Raw SQL trong handler hoặc service (phải qua repository)
func (s *Service) GetOrders() {
    rows, _ := db.Query("SELECT * FROM orders")  // SAI
}

// ❌ SELECT * trong queries
SELECT * FROM sales_orders;  // SAI — liệt kê column

// ❌ Bỏ qua error
result, _ := s.repo.Create(ctx, order)  // SAI — luôn check error
```

```typescript
// ❌ Gọi fetch trực tiếp trong component (phải dùng apiFetch)
fetch('/api/orders')  // SAI

// ❌ any type (dùng interface thay thế)
const order: any = {}  // SAI

// ❌ Format tiền/ngày inline
{amount.toLocaleString()} đồng  // SAI — dùng Intl.NumberFormat wrapper
{new Date(date).toLocaleDateString()}  // SAI — dùng format helper
```
