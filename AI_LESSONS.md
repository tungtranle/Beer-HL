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
| L-22 | `vehicles` table dùng column `plate_number` KHÔNG phải `plate`. Luôn check schema trước khi viết SQL | SC-11 crash column "plate" does not exist |
| L-23 | `trip_stops` KHÔNG có `customer_name`. Phải JOIN `customers c ON c.id = ts.customer_id` rồi dùng `c.name` | ListExceptions 500 error |
| L-24 | WebSocket `type` phải MATCH giữa backend (`GPSUpdate.Type`) và frontend (`data.type === '...'`). Kiểm tra cả 2 phía trước khi debug | GPS vehicles không hiện trên map vì `gps_update` ≠ `position` |
| L-25 | GPS simulator status filter phải match trip statuses thực tế trong DB. SC-11 dùng `in_transit/assigned/ready`, simulator cũ filter `planned/in_progress` | Simulator fallback demo routes thay vì dùng trip data |
| L-26 | `customers` table columns = `latitude/longitude` (NUMERIC), KHÔNG phải `lat/lng`. `trip_stops` columns = `stop_order`, KHÔNG phải `sequence_order` | Simulator query crash |
| L-27 | Với page có nhánh `loading`, KHÔNG khởi tạo Leaflet/map trong `useEffect([])` nếu `ref` chỉ render sau loading. Effect phải phụ thuộc trạng thái đã mount map container, rồi gọi `invalidateSize()` sau init | Control Tower panel giữa trắng dù đã có code map |
| L-28 | Next.js `rewrites()` cho `/api/*` KHÔNG tự cứu WebSocket path sai. Trước khi debug GPS live, phải đối chiếu chính xác frontend WS URL với backend route thực (`/ws/gps`) | Control Tower nối `/api/gps/ws` nên luôn 0 xe online trong local dev |
| L-29 | Test scenario có GPS/route KHÔNG được phụ thuộc tọa độ customer master data mặc định. Phải re-anchor explicit các customer dùng trong scenario về cụm tuyến test, nếu không simulator sẽ tạo đường chạy nhìn như tọa độ vu vơ | SC-11 Control Tower cần tuyến thực tế để soi lệch tuyến |
| L-30 | Nếu cần soi lệch tuyến, KHÔNG dùng polyline nối waypoint thẳng để làm chuẩn. Phải dùng road geometry từ OSRM hoặc route engine tương đương, nếu không sẽ vừa nhìn giả vừa báo lệch tuyến sai | Control Tower route overview |
| L-31 | Counter `xe online` phải bám theo số chuyến active đang được giả lập; `completed` chỉ để test history, không nên auto tính vào fleet online mặc định | SC-11 thực tế cần 7 route active từ WH-HL, không phải ép đủ 8 xe online |
| L-32 | **PHẢI test TỪNG feature ngay sau khi code.** Viết xong → compile → chạy server → gọi API/load page → confirm OK → rồi mới làm tiếp. KHÔNG batch nhiều features rồi test 1 lần. KHÔNG nói "xong" khi chưa test. Xem `.github/instructions/test-after-code.instructions.md` | Phase 8: viết 30 tasks, nhiều file có lỗi nhưng không phát hiện vì không test từng phần |

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
