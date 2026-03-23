# HƯỚNG DẪN CHẠY HỆ THỐNG BHL OMS-TMS-WMS

> Dành cho người không phải lập trình viên. Chỉ cần Windows, Docker Desktop, và kết nối Internet.

---

## MỤC LỤC

1. [Cài đặt phần mềm cần thiết](#1-cài-đặt-phần-mềm-cần-thiết)
2. [Chạy hệ thống lần đầu](#2-chạy-hệ-thống-lần-đầu)
3. [Chạy hệ thống các lần sau](#3-chạy-hệ-thống-các-lần-sau)
4. [Hướng dẫn chạy Mock Server (Bravo, DMS, Zalo)](#4-hướng-dẫn-chạy-mock-server)
5. [Kịch bản test tương tác Zalo](#5-kịch-bản-test-zalo)
6. [Kịch bản test tồn kho Bravo](#6-kịch-bản-test-tồn-kho-bravo)
7. [Tài khoản test](#7-tài-khoản-test)
8. [Xử lý lỗi thường gặp](#8-xử-lý-lỗi-thường-gặp)

---

## 1. CÀI ĐẶT PHẦN MỀM CẦN THIẾT

Bạn cần cài 3 phần mềm (chỉ 1 lần duy nhất):

| Phần mềm | Link tải | Ghi chú |
|-----------|----------|---------|
| **Docker Desktop** | https://www.docker.com/products/docker-desktop/ | Chọn "Windows (AMD64)" |
| **Go** | https://go.dev/dl/ | Chọn file `.msi` cho Windows |
| **Node.js** | https://nodejs.org/ | Chọn phiên bản LTS (khuyên dùng) |

**Sau khi cài:**
- Khởi động lại máy tính
- Mở **Docker Desktop** và đợi nó hiện biểu tượng xanh ở thanh taskbar

---

## 2. CHẠY HỆ THỐNG LẦN ĐẦU

### Cách 1: Double-click (đơn giản nhất)

1. Mở thư mục `D:\Beer HL\bhl-oms\`
2. **Double-click** vào file `START_HERE.bat`
3. Đợi khoảng 2-3 phút cho hệ thống khởi động
4. Khi thấy dòng **"Demo is running!"** → mở trình duyệt vào http://localhost:3000

### Cách 2: Chạy từ PowerShell (chi tiết hơn)

1. Mở **PowerShell** (nhấn phím Windows → gõ "PowerShell" → Enter)
2. Gõ các lệnh sau:

```powershell
cd "D:\Beer HL\bhl-oms"
.\start-demo.ps1
```

3. Đợi đến khi thấy:
```
=========================================
  Demo is running!
=========================================

  Frontend:  http://localhost:3000
  API:       http://localhost:8080/health
```

4. Mở trình duyệt → vào **http://localhost:3000**
5. Đăng nhập: **admin** / **demo123**

### Nếu bị lỗi "execution policy"

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass
```

Sau đó chạy lại `.\start-demo.ps1`

---

## 3. CHẠY HỆ THỐNG CÁC LẦN SAU

Sau lần đầu, không cần setup lại, chỉ cần:

1. **Bật Docker Desktop** (đợi biểu tượng xanh)
2. Mở PowerShell:

```powershell
cd "D:\Beer HL\bhl-oms"
.\start.ps1
```

3. Đợi 30 giây → mở http://localhost:3000

### Tùy chọn:
```powershell
# Chạy kèm Mock Server (test Bravo/DMS/Zalo)
.\start.ps1 -MockServer

# Chỉ chạy API, không chạy frontend
.\start.ps1 -NoFrontend
```

---

## 4. HƯỚNG DẪN CHẠY MOCK SERVER

Mock Server giả lập 3 hệ thống bên ngoài để test mà không cần kết nối thật:

| Hệ thống | Mock Port | Chức năng |
|-----------|-----------|-----------|
| **Bravo ERP** | http://localhost:9001 | Đẩy chứng từ, kiểm tra dư nợ |
| **DMS** | http://localhost:9002 | Đồng bộ trạng thái đơn hàng |
| **Zalo OA** | http://localhost:9003 | Gửi tin nhắn ZNS (xác nhận đơn/giao hàng) |

### Cách 1: Tự động (khuyên dùng)

```powershell
cd "D:\Beer HL\bhl-oms"
.\start.ps1 -MockServer
```

Script tự chạy Mock Server + chuyển INTEGRATION_MOCK=false để API gọi qua mock.

### Cách 2: Chạy riêng Mock Server

Mở **2 cửa sổ PowerShell**:

**Cửa sổ 1 — Mock Server:**
```powershell
cd "D:\Beer HL\bhl-oms"
go run cmd/mock_server/main.go
```

Bạn sẽ thấy:
```
========================================
  BHL Mock Server — External APIs
========================================
Mock servers ready:
  Bravo ERP:  http://localhost:9001
  DMS:        http://localhost:9002
  Zalo OA:    http://localhost:9003
```

**Cửa sổ 2 — API Server:**
```powershell
cd "D:\Beer HL\bhl-oms"
$env:INTEGRATION_MOCK = "false"
$env:BRAVO_URL = "http://localhost:9001"
$env:DMS_URL = "http://localhost:9002"
$env:ZALO_BASE_URL = "http://localhost:9003"
go run cmd/server/main.go
```

### Kiểm tra Mock Server hoạt động

Mở trình duyệt:
- http://localhost:9001/health → `{"service":"bravo-mock","status":"ok"}`
- http://localhost:9002/health → `{"service":"dms-mock","status":"ok"}`
- http://localhost:9003/health → `{"service":"zalo-mock","status":"ok"}`

### Xem log tương tác

Khi test trên frontend, cửa sổ Mock Server sẽ hiện log chi tiết:

```
[ZALO] 📋 ORDER CONFIRMATION to 0912345678 — Order: SO-20260320-0001
[ZALO]   → Customer confirm URL: http://localhost:8080/v1/order-confirm/abc123...
[DMS] Order sync: SO-20260320-0001 → pending_customer_confirm
[BRAVO] Received delivery document: SO-20260320-0001
```

---

## 5. KỊCH BẢN TEST ZALO — LUỒNG NGHIỆP VỤ ĐẦY ĐỦ

### 5.1 Luồng xác nhận đơn hàng (MỚI)

```
DVKH lập đơn ──► Zalo gửi KH ──► KH xem PDF + Xác nhận ──► Đơn confirmed
         │                              │
         │                              └── KH từ chối → Đơn cancelled, hoàn kho
         │
         └── (2h không xác nhận) ──► Tự động xác nhận
```

**Bước 1: DVKH tạo đơn hàng**
- Đăng nhập: **dvkh01** / demo123
- Vào Quản lý đơn hàng → Tạo đơn mới
- Chọn NPP, thêm sản phẩm, nhấn "Tạo đơn"
- Đơn hàng tạo với trạng thái **pending_customer_confirm**
- **Mock Server log**: `[ZALO] 📋 ORDER CONFIRMATION to <phone> — Order: SO-xxx`

**Bước 2: Khách hàng xác nhận (mô phỏng)**

Dùng PowerShell hoặc trình duyệt để gọi API:

```powershell
# Lấy thông tin đơn từ token (token sẽ hiện trong Mock Server log)
$token = "abc123..."  # Lấy từ log mock server
Invoke-RestMethod -Uri "http://localhost:8080/v1/order-confirm/$token" -Method GET

# Xem PDF đơn hàng
# Mở trình duyệt: http://localhost:8080/v1/order-confirm/<token>/pdf

# Khách hàng XÁC NHẬN
Invoke-RestMethod -Uri "http://localhost:8080/v1/order-confirm/$token/confirm" -Method POST

# HOẶC khách hàng TỪ CHỐI
Invoke-RestMethod -Uri "http://localhost:8080/v1/order-confirm/$token/reject" -Method POST -Body '{"reason":"Sai số lượng"}' -ContentType "application/json"
```

**Bước 3: Tự động xác nhận (nếu KH không phản hồi)**
- Hệ thống chạy cron mỗi 5 phút
- Sau 2 giờ, đơn tự động chuyển sang **confirmed**
- Mock Server log: `[cron] order_auto_confirm processed: 1`

### 5.2 Luồng xác nhận giao hàng (đã có)

```
Tài xế giao hàng ──► ePOD ──► Zalo gửi NPP ──► NPP xác nhận (hoặc 24h auto)
```

**Bước 1:** Đăng nhập **driver01** / demo123 → Cập nhật giao hàng → ePOD
**Bước 2:** Hệ thống gửi Zalo ZNS cho NPP
**Bước 3:** NPP xác nhận qua link Zalo (hoặc 24h tự động)

### 5.3 Test sequence đầy đủ bằng API

```powershell
# 1. Đăng nhập DVKH
$login = Invoke-RestMethod -Uri "http://localhost:8080/v1/auth/login" -Method POST -Body '{"username":"dvkh01","password":"demo123"}' -ContentType "application/json"
$token = $login.data.access_token
$headers = @{ "Authorization" = "Bearer $token" }

# 2. Xem danh sách khách hàng
Invoke-RestMethod -Uri "http://localhost:8080/v1/customers" -Headers $headers

# 3. Xem sản phẩm
Invoke-RestMethod -Uri "http://localhost:8080/v1/products" -Headers $headers

# 4. Tạo đơn hàng (thay customer_id, warehouse_id, product_id bằng ID thực)
$orderBody = @{
    customer_id = "UUID_KHACH_HANG"
    warehouse_id = "UUID_KHO"
    delivery_date = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
    time_window = "08:00-12:00"
    notes = "Test order"
    items = @(
        @{ product_id = "UUID_SAN_PHAM"; quantity = 10 }
    )
} | ConvertTo-Json -Depth 3
$order = Invoke-RestMethod -Uri "http://localhost:8080/v1/orders" -Method POST -Body $orderBody -ContentType "application/json" -Headers $headers
Write-Host "Order created: $($order.data.order_number) - Status: $($order.data.status)"
# Kết quả: Status = "pending_customer_confirm"

# 5. Xem log mock server → lấy confirm token
# Mock server sẽ in: [ZALO] 📋 ORDER CONFIRMATION ... → Customer confirm URL: .../order-confirm/<TOKEN>
```

---

## 6. KỊCH BẢN TEST TỒN KHO BRAVO

### 6.1 Tương tác Bravo khi vận hành

| Sự kiện | API Bravo | Ý nghĩa |
|---------|-----------|----------|
| Giao hàng xong | `POST /api/documents/delivery` | Đẩy chứng từ giao hàng sang Bravo |
| Thanh toán COD | `POST /api/payment-receipt` | Ghi nhận thu tiền |
| Đối soát đêm | `GET /api/credit-balance` | So sánh dư nợ Bravo vs OMS |

### 6.2 Kịch bản test tồn kho

Dưới đây là các kịch bản test với mock server:

#### Kịch bản 1: Đủ tồn kho — Đặt hàng thành công
```
Sản phẩm: Bia Heineken thùng (SKU: BIA-HNK-24)
Tồn kho hiện tại: 500 thùng (kho Phú Giàng)
Đơn hàng: 100 thùng
→ Kết quả: Đặt thành công, ATP giảm còn 400
```

#### Kịch bản 2: Không đủ tồn kho — Từ chối
```
Sản phẩm: Bia Tiger thùng (SKU: BIA-TGR-24)
Tồn kho hiện tại: 50 thùng
Đơn hàng: 100 thùng
→ Kết quả: Lỗi ATP_INSUFFICIENT
```

#### Kịch bản 3: Nhiều kho — ATP theo warehouse
```
Kho Phú Giàng: 200 thùng Heineken
Kho Long Thành: 150 thùng Heineken
Đơn hàng từ kho Phú Giàng: 180 thùng
→ Kết quả: Thành công (200 ≥ 180)
```

#### Kịch bản 4: Hủy đơn — Hoàn tồn kho
```
1. Đặt 100 thùng → ATP: 500 → 400
2. Hủy đơn → ATP: 400 → 500 (hoàn lại)
```

#### Kịch bản 5: Vượt hạn mức tín dụng
```
NPP: NPP001 — Hạn mức: 200,000,000đ — Dư nợ: 180,000,000đ
Đơn hàng: 50,000,000đ (vượt hạn mức)
→ Kết quả: Status = "pending_approval", cần kế toán duyệt
```

#### Kịch bản 6: Đối soát dư nợ Bravo
```powershell
# Chạy đối soát thủ công (khi mock server đang chạy)
$login = Invoke-RestMethod -Uri "http://localhost:8080/v1/auth/login" -Method POST -Body '{"username":"admin","password":"demo123"}' -ContentType "application/json"
$headers = @{ "Authorization" = "Bearer $($login.data.access_token)" }

Invoke-RestMethod -Uri "http://localhost:8080/v1/integration/bravo/reconcile" -Method POST -Body '{"customer_codes":["NPP001","NPP002","NPP003"]}' -ContentType "application/json" -Headers $headers
```

Mock server trả về dư nợ ngẫu nhiên → hệ thống so sánh → báo sai lệch nếu có.

### 6.3 Seed data tồn kho cho test

Để tạo data tồn kho đa dạng cho test, chạy SQL sau:

```powershell
# Chạy migration tồn kho test
docker cp "migrations/seed_comprehensive_test.sql" bhl-oms-postgres-1:/tmp/
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/seed_comprehensive_test.sql
```

File `seed_comprehensive_test.sql` đã tạo sẵn:
- Lots (lô hàng) với các ngày hết hạn khác nhau
- Warehouse stock levels cho nhiều sản phẩm/kho
- ATP (Available-To-Promise) đã trừ reserved

---

## 7. TÀI KHOẢN TEST

| Username | Mật khẩu | Vai trò | Quyền |
|----------|-----------|---------|-------|
| admin | demo123 | Admin | Full access |
| dvkh01 | demo123 | DVKH | Tạo/sửa đơn hàng |
| dispatcher01 | demo123 | Điều phối | Lập tuyến, phân xe |
| accountant01 | demo123 | Kế toán | Duyệt credit, đối soát |
| driver01–driver70 | demo123 | Tài xế | Giao hàng, ePOD |
| truongkho_hl | demo123 | Trưởng kho | Picking, xuất kho |

---

## 8. XỬ LÝ LỖI THƯỜNG GẶP

### "Port 3000 is already in use"
```powershell
# Tắt process cũ
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
```

### "Port 8080 is already in use"
```powershell
Get-Process -Name "go" -ErrorAction SilentlyContinue | Stop-Process -Force
```

### Docker không chạy
- Mở Docker Desktop
- Đợi biểu tượng xanh ở taskbar
- Nếu vẫn lỗi → khởi động lại máy

### "execution policy" error
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy Bypass
```

### Frontend trang trắng
- Kiểm tra API: mở http://localhost:8080/health
- Nếu API không chạy → khởi động lại: `.\start.ps1`

### "ECONNREFUSED localhost:5434"
- PostgreSQL chưa chạy
- Kiểm tra: `docker ps` — cần thấy container `bhl-oms-postgres-1`
- Fix: `docker compose up -d postgres`

---

*Cập nhật: Session 15 — Thêm luồng Zalo xác nhận đơn hàng + hướng dẫn mock server*
