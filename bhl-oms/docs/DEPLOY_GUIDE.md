# Hướng dẫn Deploy & Sửa Bug trên bhl.symper.us

> **Dành cho:** Người quản lý server (non-tech friendly)  
> **Server:** bhl.symper.us  
> **Cập nhật:** 23/03/2026

---

## 1. Tại sao không login được?

Database trên server production **chưa có data tài khoản**. Cần chạy migration + seed data.

### Cách fix — SSH vào server rồi chạy:

```bash
# 1. SSH vào server
ssh user@bhl.symper.us

# 2. Vào thư mục deploy
cd /opt/bhl-oms

# 3. Chạy migration (tạo bảng)
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/001_init.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/002_checklist.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/003_cutoff_consolidation.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/004_wms.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/005_epod_payment.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/006_zalo_confirm.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/007_recon_dlq_kpi.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/008_audit_log.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/009_driver_checkin.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/009_urgent_priority.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/010_order_confirmation.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/010_order_number_seq.up.sql
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/010_workshop_phase6.up.sql

# 4. Seed data (tài khoản + sản phẩm + NPP + kho + xe)
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/seed.sql

# 5. (Tùy chọn) Seed data đầy đủ 800 NPP + 70 xe
docker compose -f docker-compose.prod.yml exec -T postgres psql -U bhl -d bhl_prod -f /migrations/seed_production.sql
```

### Tài khoản đăng nhập (sau khi seed):

| Username | Mật khẩu | Vai trò | Ghi chú |
|----------|---------|---------|---------|
| admin | demo123 | Admin | Quản trị toàn hệ thống |
| dvkh01 | demo123 | ĐVKH | Dịch vụ khách hàng |
| dispatcher01 | demo123 | Điều phối | Điều phối vận tải |
| accountant01 | demo123 | Kế toán | Kế toán đối soát |
| driver01-08 | demo123 | Lái xe | 8 tài xế demo |
| manager01 | demo123 | Quản lý | Trưởng phòng |

---

## 2. Quy trình sửa bug từ giờ

### Cách A: Sửa code trên máy → Deploy lại (khuyên dùng)

```
[1] Sửa code trên máy local (VS Code + AI)
      ↓
[2] Test trên localhost (http://localhost:3000)
      ↓
[3] Push code lên server
      ↓
[4] Build lại trên server
      ↓
[5] Kiểm tra trên bhl.symper.us
```

**Chi tiết bước 3-4:**
```bash
# Trên máy local — đẩy code lên server
scp -r ./bhl-oms/ user@bhl.symper.us:/opt/bhl-oms/

# HOẶC dùng git (nếu đã setup):
# Trên máy local
git add . && git commit -m "fix: mô tả bug" && git push

# Trên server
cd /opt/bhl-oms && git pull

# Build lại
docker compose -f docker-compose.prod.yml build --no-cache api web
docker compose -f docker-compose.prod.yml up -d

# Kiểm tra
docker compose -f docker-compose.prod.yml logs -f api --tail=50
```

### Cách B: Hot-fix nhanh trên server (trường hợp khẩn cấp)

```bash
# SSH vào server
ssh user@bhl.symper.us
cd /opt/bhl-oms

# Sửa file trực tiếp (nano/vim)
nano internal/oms/handler.go

# Build lại chỉ backend
docker compose -f docker-compose.prod.yml build --no-cache api
docker compose -f docker-compose.prod.yml up -d api

# Xem log
docker compose -f docker-compose.prod.yml logs -f api --tail=50
```

---

## 3. Bật Test Portal trên production

### File .env trên server — thêm dòng:

```env
# Test Portal — bật để tạo data test
ENABLE_TEST_PORTAL=true

# Sentry — theo dõi lỗi
SENTRY_DSN=https://bef6b6bd4de51ed9d7ed78047b61298a@o4511092744454144.ingest.us.sentry.io/4511092773486592
```

### Sau đó restart:
```bash
docker compose -f docker-compose.prod.yml up -d api
```

### Truy cập Test Portal:
- **URL:** `https://bhl.symper.us/test-portal`
- **Không cần login** — ai có link đều truy cập được
- **⚠️ Lưu ý:** Khi demo xong, NÊN tắt lại (`ENABLE_TEST_PORTAL=false`) để bảo mật

### Các chức năng Test Portal:
| Tab | Mô tả |
|-----|-------|
| Kịch bản test | 8 kịch bản tự động (Happy Path, Credit Fail, ATP Fail...) |
| Đơn hàng | Xem tất cả đơn hàng trong hệ thống |
| Xác nhận Zalo | Xem trạng thái xác nhận đơn qua Zalo |
| Tồn kho/ATP | Kiểm tra tồn kho + Available-To-Promise |
| Dư nợ | Xem công nợ NPP |
| Tạo đơn test | Tạo đơn hàng nhanh để test |
| Giả lập GPS | Mô phỏng vị trí xe trên bản đồ |
| Reset Data | Xóa data test, giữ nguyên master data |

---

## 4. Xem lỗi trên Sentry

- **URL:** https://sentry.io → đăng nhập tài khoản đã tạo
- Mọi lỗi từ `bhl.symper.us` sẽ tự động gửi về Sentry
- Session Replay: xem lại thao tác của user khi gặp lỗi
- Không cần SSH vào server để xem log

---

## 5. Các lệnh hữu ích trên server

```bash
# Xem log backend (realtime)
docker compose -f docker-compose.prod.yml logs -f api --tail=100

# Xem log frontend
docker compose -f docker-compose.prod.yml logs -f web --tail=100

# Kiểm tra tất cả container có chạy không
docker compose -f docker-compose.prod.yml ps

# Restart toàn bộ
docker compose -f docker-compose.prod.yml restart

# Restart chỉ backend (sau khi sửa code)
docker compose -f docker-compose.prod.yml up -d --build api

# Xem database (chạy SQL trực tiếp)
docker compose -f docker-compose.prod.yml exec postgres psql -U bhl -d bhl_prod

# Backup database
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U bhl bhl_prod > backup_$(date +%Y%m%d).sql
```

---

## 6. Checklist khi deploy lần đầu

- [ ] Copy code lên server `/opt/bhl-oms/`
- [ ] Tạo file `.env` (xem mẫu bên dưới)
- [ ] Tạo JWT keys: `make keys` hoặc `openssl genrsa -out keys/private.pem 2048 && openssl rsa -in keys/private.pem -pubout -out keys/public.pem`
- [ ] Chạy `docker compose -f docker-compose.prod.yml up -d` 
- [ ] Chờ 10s → chạy migration (xem mục 1)
- [ ] Chạy seed data
- [ ] Truy cập `https://bhl.symper.us/login` → đăng nhập `admin / demo123`

### Mẫu file .env cho production:
```env
# Database
DB_PASSWORD=matkhau_manh_o_day

# Monitoring
GRAFANA_PASSWORD=grafana_manh

# Sentry
SENTRY_DSN=https://bef6b6bd4de51ed9d7ed78047b61298a@o4511092744454144.ingest.us.sentry.io/4511092773486592

# Test Portal (bật khi cần test, tắt khi demo chính thức)
ENABLE_TEST_PORTAL=true

# Integration (để mock khi chưa có hệ thống thật)
INTEGRATION_MOCK=true
BRAVO_URL=
BRAVO_API_KEY=
DMS_URL=
DMS_API_KEY=
ZALO_BASE_URL=
ZALO_OA_TOKEN=
ZALO_OA_ID=
```
