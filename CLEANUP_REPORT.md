# CLEANUP REPORT — bhl-oms/ (30/04/2026)

> **Mục tiêu:** dọn root `bhl-oms/` để dự án sạch sẽ, người tiếp nhận/bảo trì sau không bị rối, đặc biệt là phần "khởi động localhost".
> **Nguyên tắc:** **CONSERVATIVE** — KHÔNG xóa file nào trừ một binary tạm `bhl-oms-qw.exe` mà tôi vừa build để verify. Mọi file khác được **MOVE** sang `bhl-oms/Archive/` theo nhóm. Nếu cần rollback, chỉ việc move ngược lại.

## TRƯỚC vs SAU

| Chỉ số | Trước | Sau |
|--------|------:|----:|
| File ở root `bhl-oms/` | 80 | 47 |
| File `start*.bat` / `start*.ps1` ở root | 13 | **2** (`START_LOCAL.bat`, `START_DOCKER.bat`) |
| File `restart*.bat` / `REBUILD*.bat` | 6 | 0 |
| Binary `.exe` rác (`server.exe`, `bhl-oms.exe~`, `bhl-server.exe`, ...) | 10 | 0 (giữ duy nhất `bhl-oms.exe` chính) |
| One-off helper (`fix-encoding*.js`, `inject-gps.ps1`, `gps_commands.txt`, `Brief`) | 6 | 0 |

---

## 2 SCRIPT KHỞI ĐỘNG MỚI

### `START_LOCAL.bat` (khuyến nghị)
- **Khi dùng:** sau khi tắt Docker / VS Code / restart laptop, chỉ muốn chạy nhanh.
- **Stack:** PostgreSQL Windows native (:5433) + Redis Windows (:6379) + Docker (VRP :8090, OSRM :5000) + Go backend native (:8080) + Next.js native (:3000).
- **Hành vi:**
  1. Kill tiến trình cũ chiếm :8080 / :3000.
  2. Auto-start dịch vụ Windows: `postgresql-x64-16`, `Redis`.
  3. Verify DB reachable trên :5433.
  4. Auto-start Docker Desktop nếu chưa chạy.
  5. `docker compose up -d vrp osrm` (idempotent — bỏ qua nếu đã chạy).
  6. Wait health của VRP + OSRM (best-effort, có WARN nhưng không block).
  7. `go build` backend, set env, start `bhl-oms.exe` trong cửa sổ riêng.
  8. `npm install` (lần đầu) rồi `npm run dev` trong cửa sổ riêng.
  9. Health check `GET /v1/app/version` và in URL truy cập.

### `START_DOCKER.bat`
- **Khi dùng:** muốn full Docker (DB Docker :5434, không cần PostgreSQL Windows). Dùng cho máy mới hoặc khi data layer Windows bị hỏng.
- **Stack:** Docker (postgres :5434 + redis :6379 + vrp :8090 + osrm :5000) + Go backend native (:8080) + Next.js native (:3000).
- **Lưu ý quan trọng:** nếu Windows Redis service đang chạy, script tự `net stop Redis` để tránh xung đột port với Docker Redis.
- **CẢNH BÁO:** không double-click từ VS Code terminal — Docker lifecycle command có thể freeze VS Code (đã ghi trong user-env memory). Double-click từ File Explorer.

---

## FILE ĐÃ MOVE

### `Archive/_legacy_startup/` (19 files — script khởi động cũ)
| File | Lý do archive |
|------|---------------|
| `start.ps1` | thay bằng START_LOCAL.bat (đầy đủ + không gây freeze do `Wait-Process`) |
| `START_HERE.bat` | 193 bytes, chỉ gọi script khác — vô dụng |
| `START_BACKEND_LOCAL.bat` | tính năng đã gộp vào START_LOCAL.bat |
| `START_BACKEND_MINIMAL.bat` | dev convenience cũ, không còn dùng |
| `START_FRONTEND_LOCAL.bat` | gộp vào START_LOCAL.bat |
| `START_OSRM_ONLY.bat` | gộp vào START_LOCAL/DOCKER (OSRM có healthcheck) |
| `START_TEST_PORTAL.bat` | wrapper 103 bytes — bỏ |
| `start-ai-full.bat` | thử nghiệm AI Sprint, không còn cần |
| `start-backend-detached.ps1` | cũ — START_LOCAL đã start `cmd /k` detached |
| `start-demo.ps1` | first-time setup script — chỉ dùng 1 lần khi seed; chuyển sang Archive để tham khảo |
| `start-share.ps1` | share LAN không còn dùng |
| `start-test-portal.ps1` | wrapper cũ |
| `start-web-detached.ps1` | gộp vào START_LOCAL |
| `restart-services.bat` | thay bằng START_DOCKER.bat (clean hơn) |
| `RESTART_BACKEND_MORNING.bat` | wrapper morning routine, không còn cần |
| `RESTART_BACKEND_ONLY.bat` | hành vi nằm trong START_LOCAL bước [1+7] |
| `RESTART_VRP_SOLVER.bat` | dùng `docker restart bhl-oms-vrp-1` từ File Explorer khi cần |
| `REBUILD-DOCKER-WEB.bat` | rebuild image Docker, không cần khi web chạy local `npm run dev` |
| `REBUILD-FRONTEND.bat` | gộp vào START_LOCAL/DOCKER |

### `Archive/_dev_binaries/` (10 files — binary tạm/test)
| File | Size | Lý do archive |
|------|-----:|---------------|
| `audit_data_completeness.exe` | 13 MB | tool ad-hoc 1 lần (28/04), source trong `cmd/audit_data_completeness/` |
| `bhl-oms.exe~` | 40 MB | backup tự động cũ ngày 30/04 sáng — đã có `bhl-oms.exe` mới |
| `bhl-oms-test.exe` | 38 MB | binary test 17/04 cũ |
| `bhl-server.exe` | 21 MB | binary cũ 20/03 (kiến trúc cũ) |
| `gps_simulator.exe` | 14 MB | tool inject GPS, source trong `cmd/inject_gps/` |
| `import_npp.exe` | 3 MB | one-off NPP import 20/03, source trong `cmd/` |
| `load_test_orders.exe` | 9 MB | k6-style load test, source trong `cmd/` |
| `load_test_vrp.exe` | 9 MB | tương tự |
| `server.exe` | 40 MB | binary 29/04 đã cũ |
| `server_new.exe` | 34 MB | binary thử nghiệm 21/03 |

> Tổng dung lượng dev binaries archive: **~221 MB**. Không xóa — vẫn dùng được nếu cần chạy lại tool ad-hoc, chỉ chạy `Move-Item Archive\_dev_binaries\<file> .` để khôi phục.

### `Archive/_legacy_misc/` (6 files — helper / log / notes)
| File | Lý do archive |
|------|---------------|
| `debug_stderr.log` | 0 bytes — empty log từ 20/03 |
| `gps_commands.txt` | 567 bytes ghi chú GPS commands cũ |
| `Brief` | 67 bytes file lạ (không extension) |
| `fix-encoding.js` | sửa encoding 1 lần 22/03 |
| `fix-encoding2.js` | tương tự |
| `inject-gps.ps1` | đã ghi trong `KNOWN_ISSUES KI-006` là KHÔNG dùng (PowerShell mangle UTF-8) — thay bằng `cmd/inject_gps/main.go` |

---

## FILE ĐÃ XÓA

| File | Lý do |
|------|-------|
| `bhl-oms-qw.exe` | binary tạm tôi build trong session để verify Quick Wins compile — không cần giữ; binary chính `bhl-oms.exe` đã rebuild bao gồm cả QW. |

---

## FILE GIỮ LẠI Ở ROOT (47 file — đều có mục đích rõ)

### Config & metadata (10)
`.copilot-instructions.md`, `.deploy-config.json`, `.dockerignore`, `.env`, `.env.example`, `.gitignore`, `go.mod`, `go.sum`, `Makefile`, `README.md`

### Docker & build (4)
`docker-compose.yml`, `docker-compose.prod.yml`, `docker-compose.simple.yml`, `Dockerfile`

### Khởi động (2 — MỚI)
**`START_LOCAL.bat`**, **`START_DOCKER.bat`**

### Setup ban đầu (6)
`SETUP_LOCAL_DB.bat`, `SETUP_LOCAL_DB_AUTO.bat`, `setup-db-elevated.ps1`, `restore-pg-hba.ps1`, `setup-osrm.ps1`, `SETUP_TASK_SCHEDULER.ps1`

### Health & QA (5)
`AQF_G0_CHECK.bat`, `CHECK_CODE.bat`, `RUN_HEALTH_CHECK.bat`, `check-code-quality.ps1`, `qa-config.yml`

### Deploy lên Mac mini (5)
`deploy.ps1`, `DEPLOY_CODE_ONLY.bat`, `deploy-mac.sh`, `update-server.sh`, `SETUP_SERVER_CONNECTION.bat`

### Backup / Restore / Sync data (10)
`apply_ai_demo_seed.bat`, `seed-data-and-ai.ps1`, `EXPORT_DATA_TO_USB.bat`, `export-full-data-to-usb.ps1`, `IMPORT_HISTORY_DUMP_TO_SERVER.bat`, `import-data-to-server.ps1`, `IMPORT_ON_MAC.command`, `import-full-data-from-usb.sh`, `restore-full-data-once.sh`, `RESTORE_FROM_BACKUP.bat`, `RESTORE_FROM_BACKUP.ps1`, `SYNC_FULL_DATA_TO_SERVER_ONCE.bat`, `sync-full-data-once.ps1`, `SERVER_TOOLS.bat`

### Binary chính (1)
`bhl-oms.exe` — refresh 30/04 11:51, 38.35 MB, đã bao gồm 10 Quick Wins RBAC.

> **Đề xuất tiếp theo (tùy bạn):** nhóm Backup/Restore/Sync (10 file) có thể gom vào `bhl-oms/scripts/data/` cho gọn — nhưng chưa làm vì sợ ảnh hưởng workflow deploy hiện tại. Khi rảnh, làm 1 PR riêng.

---

## CÁCH ROLLBACK (nếu cần)

```powershell
cd "d:\Beer HL\bhl-oms"

# Khôi phục toàn bộ
Move-Item Archive\_legacy_startup\* .
Move-Item Archive\_dev_binaries\* .
Move-Item Archive\_legacy_misc\* .

# Hoặc 1 file cụ thể
Move-Item Archive\_legacy_startup\restart-services.bat .
```

---

*Cleanup hoàn tất. Root `bhl-oms/` từ 80 file → 47 file (-41%). Mọi file ad-hoc/legacy được giữ trong `Archive/` để tham khảo. Workflow khởi động giảm từ 13 script → **2 script duy nhất**.*
