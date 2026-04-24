---
description: "MUST run after EVERY code change. AI must test/verify every piece of code it writes before reporting completion. No exceptions. Prevents shipping broken code."
applyTo: "**/*.{go,ts,tsx,sql,py}"
---

# Quy tắc BẮT BUỘC: Test sau mỗi thay đổi code

## Nguyên tắc tối thượng

**KHÔNG BAO GIỜ nói "xong" mà chưa test.** Mỗi thay đổi code — dù nhỏ — PHẢI được verify hoạt động trước khi chuyển sang task tiếp theo.

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

## Anti-patterns (KHÔNG ĐƯỢC LÀM)

- ❌ Viết 10 files → "đã hoàn thành tất cả" → không test file nào
- ❌ `go build` pass → "backend ok" (chưa chạy server, chưa gọi API)
- ❌ Tạo page.tsx → "frontend done" (chưa load page, chưa biết có render không)
- ❌ Viết migration → "DB updated" (chưa chạy migration, chưa verify table)
- ❌ Sửa bug → "fixed" (chưa reproduce lại để confirm fix)
- ❌ Test 1 endpoint → claim "tất cả endpoints ok"

## Checklist mỗi feature (copy-paste vào đầu task)

```
- [ ] Code viết xong
- [ ] Backend compile thành công
- [ ] Server restart thành công
- [ ] Endpoint mới đã gọi thử, response đúng
- [ ] Frontend page đã load, render đúng
- [ ] Migration đã chạy (nếu có)
- [ ] Báo kết quả test cụ thể cho user
```
