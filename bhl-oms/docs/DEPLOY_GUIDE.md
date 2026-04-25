# Hướng dẫn Deploy & Sửa Bug trên bhl.symper.us

> **Dành cho:** Người quản lý server (non-tech friendly)  
> **Server:** bhl.symper.us  
> **Cập nhật:** 25/04/2026


## 0. Auto-deploy hiện tại

- Repo production hiện dùng GitHub Actions workflow `.github/workflows/deploy.yml` chạy trên self-hosted runner `mac-mini-prod` với labels `self-hosted`, `macOS`, `production`.
- Từ repo root trên Mac mini có thể chạy **một lệnh** để bật/cập nhật auto-deploy theo repo hiện tại:

```bash
cd /Users/tungtranle/Projects/Beer-HL
bash enable-auto-deploy.sh https://github.com/tungtranle/Beer-HL
```

- Script này sẽ gọi `setup-runner.sh`, kiểm tra nhanh file `.env` và `keys`, rồi nhắc cách test workflow. Sau khi làm xong, chỉ cần push `master` là server tự deploy.
- Nếu đổi tài khoản GitHub hoặc đổi repo, **runner cũ không tự chuyển theo**. Cần chạy lại:

```bash
cd /Users/tungtranle/Projects/Beer-HL
bash setup-runner.sh https://github.com/tungtranle/Beer-HL
```

- Script trên sẽ tự lấy registration token qua `gh` nếu máy đã `gh auth login`, và tự re-register runner nếu file `.runner` còn trỏ tới repo cũ.
- Workflow hiện hỗ trợ cả nút `Run workflow` trong GitHub Actions để test manual nếu vừa setup runner xong mà chưa muốn tạo commit mới.

## 0.1 Ổn định Mac mini để bhl.symper.us không bị chết khi ngủ máy

Hiện production đang chạy trực tiếp trên Mac mini, nên ngoài code còn phụ thuộc cấu hình nguồn điện của macOS.

### Bắt buộc làm trên máy server

```bash
sudo pmset -a sleep 0 displaysleep 30 disksleep 0 autorestart 1 powernap 0
```

Ý nghĩa:
- `sleep 0`: không cho Mac sleep khi cắm điện
- `autorestart 1`: tự bật lại sau mất điện
- `powernap 0`: tránh trạng thái sleep nửa vời

### Bắt buộc kiểm tra thêm trong macOS GUI

1. System Settings → Lock Screen → Turn display off: chọn thời gian dài hoặc Never.
2. System Settings → Energy / Battery → bật wake for network access nếu có.
3. System Settings → Users & Groups → Login Options → bật auto-login cho user chạy Docker Desktop.

> Nếu FileVault đang bật, macOS có thể không cho auto-login. Trong trường hợp đó, giải pháp ổn định hơn là chuyển production sang Linux server hoặc thêm máy dự phòng/UPS.

---

## 1. Tại sao không login được?

Database trên server production có thể thiếu migration mới hoặc thiếu danh sách users master mới nhất. Từ giờ ưu tiên chạy **một script duy nhất** thay vì chạy từng file SQL thủ công.

### Cách fix — SSH vào server rồi chạy:

```bash
# 1. SSH vào server
ssh user@bhl.symper.us

# 2. Vào thư mục deploy
cd /opt/bhl-oms

# 3. Chạy script đồng bộ
bash bhl-oms/scripts/db-sync.sh
```

Script này sẽ:
- tạo bảng `schema_migrations` nếu chưa có,
- tự chạy migration `.up.sql` còn thiếu,
- tự đồng bộ `seed_master.sql` để users trên server khớp với danh sách chuẩn trong repo,
- không xóa orders/trips/payments đang có trên production,
- không ghi đè mật khẩu nếu user đã đổi mật khẩu trên server.

## 1.1 Nếu tôi sửa users trên máy local thì làm sao server biết?

GitHub **không đọc được database** trên máy local. Muốn server biết thay đổi users/master data, cần export dữ liệu đó thành file trong repo trước:

```bash
cd /Users/tungtranle/Projects/Beer-HL
bash bhl-oms/scripts/export-users-seed.sh
git add bhl-oms/migrations/seed_master.sql
git commit -m "chore: sync users seed from local db"
git push
```

Khi đó workflow deploy mới kéo được file mới và `db-sync.sh` mới apply được xuống server.

## 1.2 Nếu tôi muốn mang TOÀN BỘ data từ máy code sang server thì sao?

Khi cần server có data giống hệt máy code, không dùng GitHub để sync DB trực tiếp. Thay vào đó:

### Trên máy code

```bash
cd /duong-dan/Beer-HL
bash bhl-oms/scripts/export-full-data-package.sh
```

Script sẽ tạo folder `usb-sync-YYYYMMDDTHHMMSS/` chứa:
- `full-sync.dump`
- `import-full-data-from-usb.sh`
- `IMPORT_ON_MAC.command`
- `README.txt`

### Trên Mac mini/server

1. Copy nguyên folder `usb-sync-...` vào project `Beer-HL`
2. Chạy `IMPORT_ON_MAC.command` hoặc `bash import-full-data-from-usb.sh`

Lưu ý: cách này sẽ **restore toàn bộ DB `bhl_prod`**, phù hợp khi muốn môi trường server giống hệt máy code. Script import có backup DB hiện tại trước khi restore.

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

# Đồng bộ schema + users master
bash bhl-oms/scripts/db-sync.sh

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
