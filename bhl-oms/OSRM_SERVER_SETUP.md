# 🚀 BHL OMS Server Setup — OSRM & Production Deployment

## Tình huống
- OSRM tắt trên server → Cần nó luôn chạy
- Công cụ monitoring trỏ localhost → Cần trỏ production domain

## Giải pháp

### 1️⃣ OSRM Luôn Hoạt Động

#### Vấn đề gốc
- OSRM service có `restart: unless-stopped` trong docker-compose
- Nhưng nếu data file không tồn tại hoặc OSRM crash, nó sẽ down

#### Giải pháp
- **Health check tự động:** Docker sẽ tự restart OSRM nếu health check fail
- **Cron monitor:** Kiểm tra OSRM mỗi 5 phút, tự động restart nếu down

**Cách setup:**

```bash
# 1. SSH vào Mac Mini (production server)
ssh user@bhl.symper.us

# 2. Vào thư mục BHL
cd /opt/bhl

# 3. Chạy health check từng lần
bash scripts/osrm-monitor.sh

# 4. Setup cron job để chạy tự động mỗi 5 phút
# Mở crontab
crontab -e

# Thêm dòng này
*/5 * * * * /opt/bhl/scripts/osrm-monitor.sh >> /var/log/osrm-monitor-cron.log 2>&1

# Lưu & thoát (Ctrl+X, Y, Enter nếu dùng nano)
```

**Kết quả:**
- OSRM sẽ tự động restart nếu lỗi
- Log tại `/var/log/osrm-monitor.log`
- Kiểm tra: `tail -f /var/log/osrm-monitor.log`

---

### 2️⃣ Công Cụ Trỏ Đúng Domain

#### Vấn đề
- Frontend được build với `NEXT_PUBLIC_API_URL=http://api:8080` (Docker internal)
- Client browser cần truy cập `https://bhl.symper.us`

#### Giải pháp
- Update docker-compose.prod.yml với `PUBLIC_API_URL` env variable
- Khi rebuild, frontend sẽ dùng đúng domain

**Cách setup:**

```bash
# 1. SSH vào server
ssh user@bhl.symper.us

# 2. Update .env.prod để set PUBLIC_API_URL
cd /opt/bhl
cat >> .env.prod << 'EOF'

# Public API URL cho client browser
PUBLIC_API_URL=https://bhl.symper.us
EOF

# 3. Rebuild & restart frontend
docker compose -f docker-compose.prod.yml --env-file .env.prod build web
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d web

# 4. Verify
curl https://bhl.symper.us/ | grep -i "api\|localhost"  # Should NOT see localhost
```

---

### 3️⃣ Xác Minh OSRM Data Tồn Tại

#### Health Check Trước Khởi Động

```bash
# SSH vào server
cd /opt/bhl

# Chạy preflight check
bash scripts/preflight-check.sh

# Kết quả mong đợi:
# ✓ Docker is running
# ✓ OSRM data exists (120M)
# ✓ All checks passed! Ready to start services.
```

#### Nếu OSRM Data Chưa Có

```bash
# Setup OSRM data (chỉ cần 1 lần, mất ~15 phút)
# Windows PowerShell (chạy từ máy dev):
cd d:\Beer HL\bhl-oms
bash scripts/setup-osrm.ps1

# Sau đó upload lên server
pscp -r osrm-data user@bhl.symper.us:/opt/bhl/

# Hoặc nếu trên Mac:
bash scripts/setup-osrm.sh
```

---

### 4️⃣ Toàn Bộ Startup Script (Được Đề Xuất)

**Tạo file `/opt/bhl/scripts/full-startup.sh` trên server:**

```bash
#!/bin/bash
set -e

echo "🔍 BHL OMS Full Startup..."

cd /opt/bhl

# 1. Preflight check
echo "[1/4] Preflight checks..."
bash scripts/preflight-check.sh || exit 1

# 2. Start services
echo "[2/4] Starting Docker services..."
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d 2>&1 | tail -5

# 3. Wait for OSRM to be ready
echo "[3/4] Waiting for OSRM to be ready (30s)..."
sleep 30
bash scripts/osrm-monitor.sh || echo "⚠️ OSRM health check failed, but services may still be starting..."

# 4. Health check
echo "[4/4] Final health check..."
for i in {1..5}; do
    if curl -sf https://bhl.symper.us/health > /dev/null 2>&1; then
        echo "✅ System is healthy!"
        break
    fi
    echo "  Waiting... ($i/5)"
    sleep 5
done

echo ""
echo "🎉 Startup complete!"
echo "📍 Dashboard: https://bhl.symper.us"
echo "📊 Monitoring: https://bhl.symper.us/monitoring"
echo "📋 OSRM Status: bash scripts/osrm-monitor.sh"
```

**Chạy trên Mac Mini:**
```bash
bash /opt/bhl/scripts/full-startup.sh
```

---

### 5️⃣ Monitoring & Troubleshooting

#### Xem OSRM Health Realtime
```bash
ssh user@bhl.symper.us
tail -f /var/log/osrm-monitor.log
```

#### Xem Docker Logs
```bash
# API
docker compose -f docker-compose.prod.yml logs -f api --tail 50

# Frontend
docker compose -f docker-compose.prod.yml logs -f web --tail 50

# OSRM
docker compose -f docker-compose.prod.yml logs -f osrm --tail 50
```

#### Restart OSRM Thủ Công
```bash
docker compose -f docker-compose.prod.yml restart osrm
sleep 15
bash scripts/osrm-monitor.sh
```

#### Kiểm Tra Ports
```bash
# Trên Mac Mini
lsof -i :5000  # OSRM
lsof -i :8090  # VRP
lsof -i :8080  # API
lsof -i :3000  # Web
```

---

### 6️⃣ Tổng Kết Config Files (Thay Đổi)

| File | Thay Đổi | Mục Đích |
|------|---------|---------|
| `docker-compose.prod.yml` | +OSRM health check; +PUBLIC_API_URL env | OSRM auto-restart; Frontend dùng domain đúng |
| `.env.prod` | +PUBLIC_API_URL=https://bhl.symper.us | Build frontend với domain production |
| `scripts/osrm-monitor.sh` | (NEW) | Monitor OSRM mỗi 5 phút |
| `scripts/preflight-check.sh` | (NEW) | Verify trước startup |
| Crontab | +*/5 * * * * ... osrm-monitor.sh | Auto-restart OSRM nếu down |

---

### 7️⃣ Kiểm Tra Lần Cuối

```bash
# 1. OSRM Health
curl http://localhost:5000/status

# 2. Frontend API URL
curl https://bhl.symper.us/
# Inspect: Should request API to https://bhl.symper.us/v1/*, NOT localhost

# 3. VRP Solver
curl -X POST http://localhost:8090/solve -H "Content-Type: application/json" -d '{}'

# 4. Monitoring
# Prometheus: https://bhl.symper.us/prometheus
# Grafana: https://bhl.symper.us/grafana
```

---

## 📝 Checklist Deployment

- [ ] OSRM data downloaded & placed in `./osrm-data/`
- [ ] `.env.prod` có `PUBLIC_API_URL=https://bhl.symper.us`
- [ ] SSL certificates ready tại `./nginx/ssl/`
- [ ] Database password set trong `.env.prod`
- [ ] Run `bash scripts/preflight-check.sh` → All passed
- [ ] Run `docker compose -f docker-compose.prod.yml --env-file .env.prod up -d`
- [ ] Wait 30s, run `bash scripts/osrm-monitor.sh` → OSRM healthy
- [ ] Add cron: `*/5 * * * * /opt/bhl/scripts/osrm-monitor.sh`
- [ ] Test API & Web: https://bhl.symper.us ✅
- [ ] Test OSRM: curl http://localhost:5000/status ✅

---

## ⏱️ Thời Gian Thực Hiện

- Preflight check: **2 phút**
- Services startup: **3 phút**
- OSRM ready: **1-2 phút** (nếu data tồn tại)
- Frontend rebuild: **5 phút** (do đó nên để PUBLIC_API_URL trong .env)

**Tổng cộng: ~15 phút lần đầu tiên**

---

## 🆘 Nếu Vẫn Có Vấn Đề

| Vấn đề | Giải pháp |
|--------|----------|
| OSRM vẫn không start | Check `/var/log/osrm-monitor.log`; verify `osrm-data/` tồn tại |
| Frontend still shows localhost | Rebuild web service; check `.env.prod` có PUBLIC_API_URL |
| Ports already in use | `docker compose down --volumes`; `docker system prune` |
| Certificate error | Verify `nginx/ssl/fullchain.pem` & `privkey.pem` tồn tại |
| VRP solver not available | OSRM service down → auto-restart via cron; check VRP logs |

---

Được tạo: 2026-04-30  
Phiên bản: v1.0  
Liên hệ: AI Support
