# BHL OMS-TMS-WMS Demo

## Hệ thống Quản lý Đơn hàng - Vận tải - Kho vận | Bia Hạ Long

### Yêu cầu hệ thống

- **Docker Desktop** (chạy PostgreSQL, Redis, VRP Solver)
- **Go 1.22+** (backend API)
- **Node.js 18+** (frontend Next.js)

### Khởi chạy nhanh (Windows PowerShell)

```powershell
cd "d:\Beer HL\bhl-oms"
.\start-demo.ps1
```

Script sẽ tự động:
1. Tạo JWT RS256 keys (dùng Go, không cần openssl)
2. Khởi động Docker containers (PG, Redis, VRP)
3. Chạy migration tạo 16 bảng
4. Seed dữ liệu demo (5 users, 15 sản phẩm, 15 NPP)
5. Cài đặt npm dependencies
6. Khởi động Go API (:8080) + Next.js (:3000)

### Khởi chạy thủ công (từng bước)

```powershell
# 1. Tạo JWT keys
mkdir keys
go run _keygen.go  # hoặc dùng start-demo.ps1 để tự tạo

# 2. Docker services
docker compose up -d postgres redis vrp

# 3. Chờ PG sẵn sàng, chạy migration
Get-Content migrations\001_init.up.sql -Raw | docker compose exec -T postgres psql -U bhl -d bhl_dev

# 4. Seed data
Get-Content migrations\seed.sql -Raw | docker compose exec -T postgres psql -U bhl -d bhl_dev

# 5. Backend
$env:DB_URL = "postgres://bhl:bhl_dev@localhost:5432/bhl_dev?sslmode=disable"
$env:JWT_PRIVATE_KEY_PATH = "./keys/private.pem"
$env:JWT_PUBLIC_KEY_PATH = "./keys/public.pem"
$env:VRP_SOLVER_URL = "http://localhost:8090"
$env:SERVER_PORT = "8080"
go run cmd/server/main.go

# 6. Frontend (terminal mới)
cd web
npm install
npm run dev
```

### Truy cập

| Service  | URL                          |
|----------|------------------------------|
| Frontend | http://localhost:3000         |
| API      | http://localhost:8080/health  |
| VRP      | http://localhost:8090/health  |

### Tài khoản demo

| Username       | Password | Vai trò          | Quyền                      |
|----------------|----------|------------------|-----------------------------|
| admin          | demo123  | Quản trị viên    | Full access                 |
| dvkh01         | demo123  | Dịch vụ KH       | Tạo đơn, xem đơn           |
| dispatcher01   | demo123  | Điều phối viên   | Tạo đơn, VRP, trips        |
| accountant01   | demo123  | Kế toán          | Duyệt đơn, xem báo cáo    |
| driver01       | demo123  | Tài xế           | Xem trips                  |

### Demo Flow

#### 1. Quản lý Đơn hàng (OMS + ATP)

1. Đăng nhập `admin / demo123`
2. Vào **Tạo đơn hàng**
3. Chọn NPP (ví dụ: NPP-001 Bãi Cháy)
4. Kho xuất: Kho Hạ Long
5. Thêm sản phẩm → ATP hiển thị số lượng khả dụng realtime
6. **Test vượt hạn mức**: Chọn NPP-003 (Uông Bí) hoặc NPP-009 (Kiến An) — nợ gần hạn mức
   - Tạo đơn lớn → đơn sẽ có status `pending_approval`
   - Dùng tài khoản `accountant01` để duyệt

#### 2. Lập kế hoạch VRP + Chuyến xe (TMS)

1. Trước tiên, tạo vài đơn hàng (status `confirmed`) để có shipments
2. Vào **Lập kế hoạch** → chọn Kho Hạ Long, ngày giao = ngày mai
3. Xem danh sách shipments chờ, xe và tài xế khả dụng
4. Nhấn **🧠 Chạy tối ưu VRP (AI)** → hệ thống gọi OR-Tools solver
5. Xem kết quả phân bổ: chuyến xe, điểm giao, tải trọng
6. Gán tài xế cho từng chuyến
7. Nhấn **✅ Duyệt kế hoạch** → tạo chuyến xe
8. Vào **Chuyến xe** → xem danh sách, click **Chi tiết** → bản đồ Leaflet

### Kiến trúc

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│  Next.js 14  │────▶│  Go/Gin API   │────▶│ PostgreSQL 16│
│  :3000       │     │  :8080        │     │  :5432       │
└──────────────┘     └───────┬───────┘     └──────────────┘
                             │
                     ┌───────▼───────┐     ┌──────────────┐
                     │  VRP Solver   │     │  Redis 7     │
                     │  Python :8090 │     │  :6379       │
                     └───────────────┘     └──────────────┘
```

### Tùy chọn khởi chạy

```powershell
# Reset toàn bộ DB và seed lại
.\start-demo.ps1 -ResetDB

# Bỏ qua Docker (đã chạy sẵn)
.\start-demo.ps1 -SkipDocker

# Chỉ backend, không frontend
.\start-demo.ps1 -SkipFrontend
```

### Troubleshooting

- **Port 5432 đã dùng**: Tắt PostgreSQL local hoặc đổi port trong `docker-compose.yml`
- **Port 8080 đã dùng**: Đổi `SERVER_PORT` trong `.env`
- **Docker not running**: Khởi động Docker Desktop trước
- **npm install lỗi**: Xóa `web/node_modules` và chạy lại
- **Migration lỗi**: Chạy `.\start-demo.ps1 -ResetDB` để reset toàn bộ
