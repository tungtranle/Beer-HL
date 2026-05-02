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
| L-33 | GitHub Actions self-hosted trên macOS chạy qua LaunchAgent có thể không truy cập được Docker credential helper trong Keychain. Nếu build Docker fail rất nhanh ở bước pull metadata, phải kiểm tra `credsStore`/Keychain trước khi debug code build | Runner production trên Mac mini |
| L-34 | GitHub/repo không tự biết dữ liệu đang nằm trong DB local. Nếu master data chỉnh trực tiếp trong DB, phải có script export DB -> file seed trong repo rồi mới push/deploy được | DB sync users/master data |
| L-35 | Next.js `rewrites()` cho `/api/*` là build-time, không phải chỉ runtime env. Nếu Docker build của web không truyền `INTERNAL_API_ORIGIN`/`NEXT_PUBLIC_API_URL`, image sẽ bake `localhost` và `/api/auth/login` sẽ 500 dù `/v1/auth/login` vẫn 200 | Production login proxy fix 25/04 |
| L-36 | Self-hosted runner GitHub bị khóa theo repo lúc đăng ký. Đổi account/remote KHÔNG tự chuyển runner; phải kiểm tra `.runner`/`gitHubUrl`, re-register runner, rồi xác nhận repo mới thấy runner `online` trước khi tin vào workflow `queued` | Migration từ `tungtl/Beer-HL` sang `tungtranle/Beer-HL` |
| L-37 | Khi đổi key localStorage cho auth frontend, PHẢI giữ backward compatibility hoặc auto-migrate key cũ (`access_token`/`refresh_token`/`user`) và refresh token trước WS connect. Nếu không dashboard có thể bắn 401 hàng loạt dù user tưởng vẫn còn đăng nhập | Dashboard 401 + notifications WS fail 25/04 |
| L-38 | **WebSocket trong dev** (port 3000): KHÔNG dùng `window.location.host` vì Next.js dev server KHÔNG proxy WS. PHẢI dùng pattern: `const wsHost = window.location.port === '3000' ? hostname:8080 : window.location.host`. KHÔNG hardcode `hostname:8080` vì vỡ production. Chuẩn duy nhất là detect port. | notifications.tsx + map/page.tsx fail WS dev |
| L-39 | QA Portal cleanup: `ListOwnedForScenario()` WHERE status phải include `'cleaned'` ngoài `'completed'/'failed'`. Sau cleanup lần 1, run status='cleaned', lần 2 cleanup KHÔNG tìm được vì filter status khác. → Add 'cleaned' vào WHERE để scenario có thể cleanup lại từ lần trước | demo_repository.go cleanup không xóa được |
| L-40 | **LUÔN inspect `information_schema.columns` TRƯỚC khi viết SQL** cho table chưa familiar. Đoán cột (`wo_type`, `total_cost_vnd`, `completed_at`, `liters`, `cost_vnd`, `odometer_km`, `score`, `notes`, `driver_leaves`, `driver_badges`) → 9/10 lần SAI. Tên thật: `category`, `actual_amount`, `actual_completion`, `liters_filled`, `amount_vnd`, `km_odometer`, `total_score`, không có notes, `leave_requests`, `badge_awards JOIN gamification_badges`. | Phase C Asset Passport viết 4 endpoints sai SQL ban đầu, phải sửa ~10 lần |
| L-41 | Conversation summary có thể carry **stale facts** sau compaction (vd: DB credentials sai `bhl_dev/bhl_oms` thay vì đúng `bhl/bhl_dev/bhl_dev`). Khi gặp permission error → đọc `.env` thực tế hoặc `docker inspect`, KHÔNG tin summary | Session 28/04 mất 5 lần thử psql vì sai password |
| L-42 | OR-Tools Python: muốn restrict allowed vehicles per node → KHÔNG có `SetAllowedVehiclesForIndex` trong python binding. Phải dùng `routing.VehicleVar(index).SetValues([-1] + allowed_indices)`. `-1` là sentinel cho "không visit". | vrp-solver vehicle-weight constraint |
| L-43 | **pgx v5 nullable UUID→text scan**: Nếu SQL SELECT có `col::text` và col nullable, scan target PHẢI là `string` (không phải `*string`) và SQL phải dùng `COALESCE(col::text, '')`. Nếu không → runtime scan error. KPI endpoint dùng `err != nil { count = 0 }` che lỗi; exceptions endpoint trả INTERNAL_ERROR lộ rõ. | Phase D wms_exceptions GetExceptions |
| L-44 | **Migration chạy trong Docker ≠ chạy local PG**. Khi có 2 DB (Docker + local PG port 5433), PHẢI apply migration vào cả 2 hoặc verify server connect tới DB nào. KPIs endpoint ẩn lỗi (trả 0 không lỗi), exceptions endpoint lộ lỗi → dễ nhầm là bug code. | Phase D wms_exceptions migration |
| L-45 | Khi sửa lỗi frontend local mà DOM vẫn là code cũ dù file đã đổi, PHẢI kiểm tra service worker/PWA cache, browser memory cache và `.next` cache trước khi tiếp tục vá UI. Dev localhost không được để SW cache `/_next/static` vì sẽ làm bug lặp mãi. | Control Tower map width 0 sau Performance Sprint 01/05 |

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
