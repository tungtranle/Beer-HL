---
description: "MUST run after EVERY code change. AI must test/verify every piece of code it writes before reporting completion. No exceptions. Prevents shipping broken code."
applyTo: "**/*.{go,ts,tsx,sql,py}"
---

# Quy tắc BẮT BUỘC: Test sau mỗi thay đổi code + AQF gate

## Nguyên tắc tối thượng

**KHÔNG BAO GIỜ nói "xong" mà chưa test.** Mỗi thay đổi code — dù nhỏ — PHẢI được verify hoạt động trước khi chuyển sang task tiếp theo.

Với BHL, test sau code còn phải trả lời câu hỏi AQF: thay đổi này có làm hệ thống đủ an toàn để ship không? Nếu có ảnh hưởng business flow, dữ liệu thật, QA Portal, scenario, automation, monitoring hoặc go-live readiness, phải gắn kết quả verify vào gate AQF phù hợp.

## Mapping AQF bắt buộc

| Phạm vi thay đổi | Gate tối thiểu | Evidence phải báo cuối task |
|------------------|----------------|------------------------------|
| Sửa nhỏ FE/BE không đổi nghiệp vụ | G0 | build/lint/typecheck hoặc page/endpoint smoke liên quan |
| Business rule/state machine/credit/ATP/FEFO/recon/RBAC | G1 + G2 | unit/golden/API assertion cụ thể, không chỉ compile |
| API endpoint hoặc handler/service/repository mới | G0 + endpoint smoke | HTTP status + response body happy/error case |
| Frontend page/workflow quan trọng | G0 + page smoke | URL đã load, auth/role/empty/error state nếu có |
| QA Portal, demo scenario, seed/test data | G2 data safety | `historical_rows_touched = 0`, cleanup scoped, không destructive SQL |
| Playwright/Bruno/GitHub Actions/monitoring | G3/G4 | workflow/test command, artifact/evidence path hoặc lý do skip |
| Production deploy/go-live check | G4 | `/v1/health`, AQF status, monitoring/alert status |

Nếu gate hợp lý không thể chạy vì thiếu service/credential/tool, phải ghi rõ `SKIP` + lý do + kiểm chứng thay thế đã làm. Không được im lặng bỏ qua.

> Lý do: AI có xu hướng viết code hàng loạt rồi "báo xong" mà không test. Kết quả: lỗi chồng lỗi, user mất thời gian debug lại.

## Quy trình bắt buộc cho TỪNG loại thay đổi

### 1. Backend Go code

| Bước | Lệnh | Pass criteria |
|------|-------|---------------|
| Compile | `go build ./cmd/server/` | Exit code 0, không error |
| Start server | `go run ./cmd/server/` | Server khởi động, log "Listening on :8080" |
| Test endpoint | `Invoke-WebRequest` hoặc `curl` tới endpoint mới | HTTP 200/201, response body đúng format |
| Test error case | Gửi request sai/thiếu field | HTTP 400/422, error message rõ ràng |

**SAU KHI thêm/sửa endpoint → PHẢI gọi thử endpoint đó ít nhất 1 lần.**

### 2. Frontend Next.js code

| Bước | Lệnh | Pass criteria |
|------|-------|---------------|
| Dev server chạy | `npm run dev` không crash | Compiled successfully |
| Load page | Mở URL page mới trong browser hoặc fetch | HTTP 200, không blank page |
| Check console | Kiểm tra browser console (nếu có thể) | Không có JS error blocking render |
| Verify data | Page hiển thị data hoặc "không có dữ liệu" đúng | Không crash, không infinite loading |

**SAU KHI thêm/sửa page → PHẢI load page đó và xác nhận nó render được.**

### 3. SQL Migration

| Bước | Lệnh | Pass criteria |
|------|-------|---------------|
| Run migration | `docker exec` psql chạy migration file | Không error |
| Verify schema | Query `\dt` hoặc `SELECT` test | Table/column tồn tại |
| Test với code | Backend đọc/ghi được vào table mới | Không runtime error |

**SAU KHI viết migration → PHẢI chạy migration và verify table tồn tại.**

### 3b. QA Portal / AQF scenario / test data

| Bước | Lệnh / cách kiểm | Pass criteria |
|------|------------------|---------------|
| Kiểm tra destructive SQL | search migration/service/handler | Không có `TRUNCATE`; không có `DELETE FROM` transactional table thiếu ownership filter |
| Verify ownership | đọc code hoặc gọi API scenario | Insert test/demo ghi `qa_owned_entities` cùng transaction |
| Load scenario | gọi endpoint scoped | Response có run_id, created/cleaned counters hợp lệ |
| Cleanup scenario | gọi endpoint scoped | Chỉ xóa entity owned; `historical_rows_touched = 0` |
| Portal render | load `/test-portal` | Auth gate + Data Safety Panel hiển thị đúng |

**SAU KHI sửa QA Portal/scenario/test data → PHẢI chứng minh không đụng dữ liệu lịch sử.**

### 4. Sửa bug

| Bước | Lệnh | Pass criteria |
|------|-------|---------------|
| Reproduce bug trước | Xác nhận bug còn tồn tại | Bug xảy ra |
| Apply fix | Sửa code | — |
| Verify fix | Lặp lại bước reproduce | Bug KHÔNG còn xảy ra |
| Regression check | Test các flow liên quan | Không break thêm gì |

## Quy tắc cứng

1. **Một feature → test ngay → rồi mới làm feature tiếp.** KHÔNG batch 5-10 features rồi test một lần.
2. **Backend thay đổi → restart server → test endpoint.** KHÔNG giả định "compile ok = chạy ok".
3. **Frontend thay đổi → load page thực tế.** KHÔNG chỉ check "dev server chạy" mà phải load đúng page đã sửa.
4. **Migration → chạy migration → verify schema.** KHÔNG viết SQL rồi "để đó chạy sau".
5. **Nếu test fail → fix ngay.** KHÔNG tiếp tục task khác khi code hiện tại đang broken.
6. **Report kết quả test cho user.** Ghi rõ: endpoint nào đã test, response gì, page nào đã load, kết quả ra sao.
7. **Report AQF gate.** Ghi rõ gate nào đã pass/skip: G0 build, G1 fast, G2 domain/golden/data safety, G3 E2E, G4 production watch.
8. **Không dùng legacy destructive test flow.** Không gọi hoặc phục hồi `reset-data`, `load-scenario`, `run-scenario`, `run-all-smoke` kiểu cũ nếu không có ownership registry.

## Anti-patterns (KHÔNG ĐƯỢC LÀM)

- ❌ Viết 10 files → "đã hoàn thành tất cả" → không test file nào
- ❌ `go build` pass → "backend ok" (chưa chạy server, chưa gọi API)
- ❌ Tạo page.tsx → "frontend done" (chưa load page, chưa biết có render không)
- ❌ Viết migration → "DB updated" (chưa chạy migration, chưa verify table)
- ❌ Sửa bug → "fixed" (chưa reproduce lại để confirm fix)
- ❌ Test 1 endpoint → claim "tất cả endpoints ok"
- ❌ Nạp scenario bằng cách xóa rộng DB → claim "QA pass"
- ❌ AQF/monitoring workflow fail/skip → không nhắc trong báo cáo cuối

## Checklist mỗi feature (copy-paste vào đầu task)

```
- [ ] Code viết xong
- [ ] Backend compile thành công
- [ ] Server restart thành công
- [ ] Endpoint mới đã gọi thử, response đúng
- [ ] Frontend page đã load, render đúng
- [ ] Migration đã chạy (nếu có)
- [ ] AQF gate phù hợp đã pass/skip có lý do
- [ ] Nếu có test/demo data: historical_rows_touched = 0
- [ ] Báo kết quả test cụ thể cho user
```
