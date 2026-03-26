# AI_LESSONS — Bài học AI đã mắc (KHÔNG được lặp lại)

> **Compounding Engineering**: Mỗi lần AI làm sai → ghi vào đây → lần sau không lặp.
> Kết thúc mỗi task: *"Cập nhật AI_LESSONS.md nếu bạn học được điều gì mới."*
> File này LUÔN load cùng CLAUDE.md mọi session.

---

## 🔴 Crash / Data Loss (luôn nhớ)

| # | Bài học | Context |
|---|--------|---------|
| L-01 | pgx v5: LUÔN cast `::text` cho enum + date trong SELECT | KI-001, KI-002 — crash runtime |
| L-02 | DB port = **5434** (Docker map), KHÔNG phải 5432 | Config.go default |
| L-03 | PowerShell + tiếng Việt = hỏng UTF-8 → dùng `docker cp` + `psql -f` | KI-006 |
| L-04 | Redis: Go server kết nối **local Windows Redis**, không phải Docker | Dùng Go tools, KHÔNG PowerShell HSET |
| L-05 | `next.config.js` proxy port PHẢI = backend port (8080). Sai → mọi API call fail âm thầm | Từng sai thành 8083 |
| L-06 | float64 cho tiền → sai số tính toán. Phải dùng `decimal.Decimal` | TD-018 |

## 🟡 Logic / UX (dễ lặp)

| # | Bài học | Context |
|---|--------|---------|
| L-07 | KHÔNG nói "đã xong" mà chưa verify localhost (backend health + frontend load) | User không test được |
| L-08 | API spec drift: check **CURRENT_STATE** cho endpoint paths thực tế, KHÔNG dùng API spec cũ | TD-012 |
| L-09 | `reject_reason` phải truyền qua CẢ chain: handler → service → event recorder | Từng chỉ lưu DB, timeline không hiện |
| L-10 | Brand color #F68634 ≠ amber warning #D97706 → KHÔNG dùng lẫn | DEC-009 |
| L-11 | Đọc FRONTEND_GUIDE.md section của role TRƯỚC khi code `.tsx` | Từng code xong phải sửa layout |
| L-12 | WMS picking: KHÔNG default ngày hôm nay → bỏ date filter, hiện ALL active trips | User không tìm thấy data |
| L-13 | Notification dropdown trong sidebar w-64 bị tràn → dùng slide-in panel | DEC-007 |
| L-14 | `create_file` tool KHÔNG dùng cho file đã tồn tại → phải dùng `str_replace` | Tool limitation |
| L-19 | `buildMockResult` (VRP fallback khi Python solver tắt): KHÔNG ép hàng quá tải vehicle → excess phải sang unassigned | Xe 5T hiện 13T hàng |
| L-20 | Test data tổng weight PHẢI nhỏ hơn fleet capacity. WH-HL = 50 xe/284T, KHÔNG phải 70 xe | SC-09 tạo 695T vs 284T fleet |
| L-21 | VRP mock PHẢI gom theo vùng địa lý (angular sweep) + giới hạn 8h/chuyến. Bin-pack thuần weight → chuyến 1000+km | Chuyến 14C-00113 có 1178km |

## 🟢 Đánh giá / Scope (khi plan)

| # | Bài học | Context |
|---|--------|---------|
| L-15 | Gap analysis: KHÔNG đánh P0 cho features enterprise-grade (what-if, 4-eye) khi business ~70 xe | DEC-010 |
| L-16 | Native mobile luôn bị đề xuất P0 nhưng PWA đủ cho go-live → đánh giá lại sau 3 tháng | DEC-012 |
| L-17 | BRD định nghĩa 11 roles nhưng code chỉ 9 → đọc CURRENT_STATE "Khác với spec" trước khi code role | Tránh code role không tồn tại |
| L-18 | Phân xưởng (workshop) = gap lớn nhất → BRD có nhưng code thiếu → đã xử lý Phase 6 | DEC-011 |

---

## Quy tắc ghi bài học mới

Khi AI mắc lỗi, thêm vào đúng nhóm:
- 🔴 **Crash/Data loss**: lỗi gây crash, mất data, hỏng hệ thống
- 🟡 **Logic/UX**: lỗi không crash nhưng sai behavior, user thấy lỗi
- 🟢 **Đánh giá/Scope**: lỗi plan sai, ưu tiên sai, scope sai

Format: `| L-{số tiếp} | Bài học ngắn gọn | Context/reference |`

> Mỗi lần AI sửa xong lỗi, kết thúc bằng:
> *"Hãy cập nhật AI_LESSONS.md để lần sau không lặp lại lỗi này."*
