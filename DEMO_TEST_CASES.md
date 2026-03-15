# TEST CASES — DEMO BHL OMS-TMS-WMS

| Thông tin | Giá trị |
|-----------|---------|
| Phiên bản | **v1.0** |
| Ngày | 14/03/2026 |
| Mục đích | Kiểm thử toàn bộ tính năng demo trước khi trình bày khách hàng |
| Môi trường | Local Docker (postgres:5434, redis:6379, vrp:8090) + Go:8080 + Next.js:3000 |

---

## DỮ LIỆU DEMO

| Loại | Chi tiết |
|------|----------|
| **Mật khẩu chung** | `demo123` (áp dụng cho tất cả tài khoản) |
| **Kho** | Kho Hạ Long (WH-HL), Kho Hải Phòng (WH-HP) |
| **Khách hàng** | 20 NPP (NPP-001 → NPP-020) khu vực Quảng Ninh & Hải Phòng |
| **Sản phẩm** | 15 SKU (bia lon, bia chai, nước giải khát) |
| **Đơn hàng** | 50 đơn (đa trạng thái: draft, confirmed, shipped, delivered, closed) |
| **Xe** | 12 xe (3.5T, 5T, 8T, 15T) |
| **Tài xế** | 12 tài xế |
| **Ngày giao planning** | 15/03/2026 (shipments pending) |

### Tài khoản test

| Username | Role | Vai trò nghiệp vụ |
|----------|------|--------------------|
| `admin` | admin | Quản trị hệ thống — full quyền |
| `dvkh01` | dvkh | Dịch vụ khách hàng — tạo/xem đơn |
| `dispatcher01` | dispatcher | Điều phối viên — tạo đơn, lập kế hoạch VRP, duyệt |
| `accountant01` | accountant | Kế toán — xem/duyệt đơn vượt hạn mức |
| `driver01` | driver | Tài xế — xem chuyến |

---

## MODULE 1: ĐĂNG NHẬP & PHÂN QUYỀN

### TC-AUTH-01: Đăng nhập thành công
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Truy cập `http://localhost:3000/login` |
| **Bước thực hiện** | 1. Nhập username: `dispatcher01`, password: `demo123` → Bấm "Đăng nhập" |
| **Kết quả mong đợi** | Chuyển đến `/dashboard`, hiện tên "Trần Văn Minh", sidebar hiện đầy đủ menu |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-AUTH-02: Đăng nhập sai mật khẩu
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đang ở trang login |
| **Bước thực hiện** | 1. Nhập username: `dispatcher01`, password: `wrongpass` → Bấm "Đăng nhập" |
| **Kết quả mong đợi** | Hiện thông báo lỗi "Sai tên đăng nhập hoặc mật khẩu", không chuyển trang |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-AUTH-03: Phân quyền — Driver không truy cập được Planning
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập với `driver01` / `demo123` |
| **Bước thực hiện** | 1. Truy cập trực tiếp URL `/dashboard/planning` |
| **Kết quả mong đợi** | Không có menu "Lập kế hoạch" trên sidebar, hoặc hiện thông báo không có quyền |
| **Mức ưu tiên** | 🟡 Quan trọng |

### TC-AUTH-04: Token tự động làm mới (auto-refresh)
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đã đăng nhập, thực hiện thao tác liên tục > 15 phút |
| **Bước thực hiện** | 1. Đăng nhập → 2. Thao tác bình thường trên hệ thống trong thời gian dài |
| **Kết quả mong đợi** | Không bị đá ra trang login, session được duy trì (access token TTL = 4h, auto-refresh) |
| **Mức ưu tiên** | 🟡 Quan trọng |

---

## MODULE 2: DASHBOARD TỔNG QUAN

### TC-DASH-01: Hiển thị thống kê dashboard
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập `dispatcher01` → vào `/dashboard` |
| **Bước thực hiện** | 1. Quan sát các card thống kê |
| **Kết quả mong đợi** | Hiện các card: Tổng đơn hàng, Doanh thu, Chuyến xe hôm nay, Đơn chờ duyệt — số liệu khớp với DB |
| **Mức ưu tiên** | 🟡 Quan trọng |

---

## MODULE 3: QUẢN LÝ ĐƠN HÀNG (OMS)

### TC-OMS-01: Xem danh sách đơn hàng
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập `dispatcher01` |
| **Bước thực hiện** | 1. Vào menu "Đơn hàng" |
| **Kết quả mong đợi** | Hiển thị danh sách đơn hàng, cột: Mã đơn, Khách hàng, Trạng thái, Ngày, Tổng tiền. Mặc định hiện 20 đơn |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-OMS-02: Lọc đơn hàng theo trạng thái
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đang ở trang danh sách đơn hàng |
| **Bước thực hiện** | 1. Chọn filter trạng thái "confirmed" → 2. Bấm lọc |
| **Kết quả mong đợi** | Chỉ hiện các đơn có trạng thái "Đã xác nhận" (10 đơn trong demo data) |
| **Mức ưu tiên** | 🟡 Quan trọng |

### TC-OMS-03: Xem chi tiết đơn hàng
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đang ở danh sách đơn hàng |
| **Bước thực hiện** | 1. Click vào 1 đơn hàng bất kỳ |
| **Kết quả mong đợi** | Chuyển sang trang chi tiết: Thông tin khách hàng, Danh sách sản phẩm (tên, SL, đơn giá, thành tiền), Trạng thái, Lịch sử đơn |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-OMS-04: Tạo đơn hàng mới — Happy path
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập `dvkh01` |
| **Bước thực hiện** | 1. Bấm "Tạo đơn mới" → 2. Chọn khách hàng "NPP Bãi Cháy - Anh Tuấn" → 3. Thêm sản phẩm: BHL Lon 330ml × 100 thùng → 4. Kiểm tra ATP hiện xanh (đủ hàng) → 5. Bấm "Tạo đơn" |
| **Kết quả mong đợi** | Đơn tạo thành công, trạng thái "confirmed", hiện trong danh sách đơn |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-OMS-05: Tạo đơn hàng — Kiểm tra ATP real-time
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đang ở form tạo đơn mới |
| **Bước thực hiện** | 1. Chọn sản phẩm bất kỳ → 2. Thay đổi số lượng lên/xuống |
| **Kết quả mong đợi** | Mỗi khi thay đổi SL, cột ATP cập nhật real-time. Nếu SL > tồn kho → hiện cảnh báo đỏ "Vượt tồn kho" |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-OMS-06: Tạo đơn vượt hạn mức tín dụng → Auto pending
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập `dvkh01`, chọn 1 NPP có credit limit thấp |
| **Bước thực hiện** | 1. Tạo đơn có giá trị lớn vượt hạn mức tín dụng khách hàng → 2. Bấm "Tạo đơn" |
| **Kết quả mong đợi** | Đơn tạo thành công nhưng trạng thái tự động = `pending_approval`, hiện badge "Chờ duyệt" |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-OMS-07: Kế toán duyệt đơn vượt hạn mức
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập `accountant01`, có đơn `pending_approval` |
| **Bước thực hiện** | 1. Vào danh sách đơn → lọc "pending_approval" → 2. Click đơn cần duyệt → 3. Bấm "Duyệt đơn" |
| **Kết quả mong đợi** | Trạng thái đơn chuyển thành `confirmed`. Đơn sẵn sàng để lập kế hoạch giao |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-OMS-08: Hủy đơn hàng
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Có đơn trạng thái `draft` hoặc `confirmed` |
| **Bước thực hiện** | 1. Vào chi tiết đơn → 2. Bấm "Hủy đơn" → 3. Xác nhận |
| **Kết quả mong đợi** | Trạng thái đơn = `cancelled`, không thể thao tác tiếp |
| **Mức ưu tiên** | 🟡 Quan trọng |

---

## MODULE 4: LẬP KẾ HOẠCH VRP (TMS — Planning)

### TC-TMS-01: Tải dữ liệu Shipments / Xe / Tài xế
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập `dispatcher01` → vào "Lập kế hoạch" |
| **Bước thực hiện** | 1. Chọn Kho: "Kho Hạ Long" → 2. Chọn ngày giao: `15/03/2026` → 3. Bấm "Tải lại" |
| **Kết quả mong đợi** | Hiển thị: Số shipment chờ (≥10), Số xe khả dụng (≥8), Số tài xế (≥6). Bảng shipments pending hiện đầy đủ: Mã, Khách hàng, Trạng thái, Trọng lượng |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TMS-02: Chạy VRP Solver
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đã load shipments thành công (TC-TMS-01) |
| **Bước thực hiện** | 1. Bấm "🧠 Chạy tối ưu VRP (AI)" → 2. Chờ spinner "Đang tối ưu tuyến đường..." (~30 giây) |
| **Kết quả mong đợi** | Kết quả hiện ra với: KPI cards (Số chuyến, Điểm giao, Tổng km, Tổng phút, % Sử dụng tải TB, Điểm/chuyến TB), biểu đồ tải trọng từng xe, danh sách chuyến + stops |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TMS-03: Dashboard đánh giá tối ưu — KPI hiển thị đúng
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP đã chạy xong (TC-TMS-02) |
| **Bước thực hiện** | 1. Kiểm tra 6 KPI cards: Chuyến xe, Điểm giao, Tổng km, Tổng phút, % Tải TB, Điểm/chuyến TB |
| **Kết quả mong đợi** | Tất cả giá trị > 0 và hợp lý. Ví dụ: 1-3 chuyến, 8-11 điểm, 100-300 km, % tải 20-80% |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TMS-04: Biểu đồ tải trọng từng xe
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP đã chạy xong |
| **Bước thực hiện** | 1. Xem phần "Tải trọng từng xe" bên dưới KPI cards |
| **Kết quả mong đợi** | Mỗi xe hiển thị bar chart: biển số, trọng lượng/tải trọng tối đa (kg), phần trăm (%). Màu: xanh (<70%), vàng (70-90%), đỏ (>90%) |
| **Mức ưu tiên** | 🟡 Quan trọng |

### TC-TMS-05: Cảnh báo shipment không xếp được
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP kết quả có unassigned > 0 |
| **Bước thực hiện** | 1. Xem phần cảnh báo đỏ bên dưới biểu đồ tải trọng |
| **Kết quả mong đợi** | Hiện: "⚠️ Không xếp được: N shipment" + gợi ý "Thêm xe hoặc tăng ngày giao" |
| **Mức ưu tiên** | 🟡 Quan trọng |

### TC-TMS-06: Chi tiết chuyến xe — Stops + Địa chỉ
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP đã chạy xong |
| **Bước thực hiện** | 1. Xem bảng stops của từng chuyến |
| **Kết quả mong đợi** | Mỗi stop hiện: #, Khách hàng (tên NPP), Địa chỉ (địa chỉ thực tiếng Việt), Tải tích lũy (kg). Địa chỉ KHÔNG phải mã UUID |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TMS-07: Điều chỉnh — Kéo thả stop giữa hai chuyến
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP kết quả có ≥ 2 chuyến |
| **Bước thực hiện** | 1. Kéo (drag) 1 dòng stop từ Chuyến 1 → 2. Thả (drop) vào Chuyến 2 |
| **Kết quả mong đợi** | Stop chuyển sang chuyến mới, cột "Tải tích lũy" tự tính lại ở cả hai chuyến. Nếu chuyến cũ trống → tự xóa |
| **Mức ưu tiên** | 🟡 Quan trọng |

### TC-TMS-08: Điều chỉnh — Sắp xếp lại thứ tự stop
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP kết quả có chuyến ≥ 2 stops |
| **Bước thực hiện** | 1. Hover vào dòng stop → hiện nút ↑ ↓ → 2. Bấm ↑ để đẩy stop lên trước |
| **Kết quả mong đợi** | Stop đổi vị trí, cột # (thứ tự) cập nhật lại, tải tích lũy tính lại đúng |
| **Mức ưu tiên** | 🟡 Quan trọng |

### TC-TMS-09: Gán tài xế cho chuyến
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP kết quả đã hiển thị |
| **Bước thực hiện** | 1. Ở dropdown tài xế bên phải tiêu đề chuyến → 2. Chọn "Hoàng Văn Thắng" |
| **Kết quả mong đợi** | Dropdown hiện tên tài xế đã chọn. Khi duyệt, tài xế được gán vào trip |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TMS-10: Chạy lại VRP
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP đã chạy xong, kết quả đang hiển thị |
| **Bước thực hiện** | 1. Bấm "🔄 Chạy lại VRP" |
| **Kết quả mong đợi** | Kết quả cũ bị xóa, spinner chạy lại, sau ~30s hiện kết quả mới |
| **Mức ưu tiên** | 🟡 Quan trọng |

### TC-TMS-11: Duyệt kế hoạch & Tạo chuyến xe
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | VRP đã chạy xong, đã gán tài xế |
| **Bước thực hiện** | 1. Bấm "✅ Duyệt kế hoạch & Tạo chuyến xe" |
| **Kết quả mong đợi** | Thông báo "Kế hoạch đã được duyệt!", hiện link "Xem các chuyến xe". Trips được tạo trong DB với trip_number duy nhất (VD: TR-20260314-003) |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TMS-12: Duyệt kế hoạch — Không bị trùng trip_number
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đã duyệt kế hoạch 1 lần trong ngày, chạy VRP lần 2 và duyệt lại |
| **Bước thực hiện** | 1. Reset shipments về pending → 2. Chạy VRP lại → 3. Duyệt lần 2 |
| **Kết quả mong đợi** | Không lỗi "duplicate key unq_trips_number". Trip_number tự tăng (VD: TR-20260314-004 nếu đã có 003) |
| **Mức ưu tiên** | 🔴 Bắt buộc |

---

## MODULE 5: CHUYẾN XE (TMS — Trips)

### TC-TRIP-01: Xem danh sách chuyến xe
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đăng nhập `dispatcher01` → vào "Chuyến xe" |
| **Bước thực hiện** | 1. Xem danh sách → 2. Lọc theo ngày hoặc trạng thái |
| **Kết quả mong đợi** | Hiển thị bảng: Mã chuyến, Xe, Tài xế, Ngày, Trạng thái, Số điểm, Quãng đường. Lọc hoạt động đúng |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TRIP-02: Xem chi tiết chuyến xe
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đang ở danh sách chuyến xe |
| **Bước thực hiện** | 1. Click vào 1 chuyến xe (VD: TR-20260314-001) |
| **Kết quả mong đợi** | Hiện: Thông tin chuyến (Xe, Tài xế, SĐT, Kho xuất, Ngày giao), Tổng quan (Điểm giao, km, kg), Bản đồ, Bảng stops |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TRIP-03: Bản đồ tuyến đường — Đường bộ thực tế
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đang ở trang chi tiết chuyến xe |
| **Bước thực hiện** | 1. Xem phần "Bản đồ tuyến đường" |
| **Kết quả mong đợi** | ✅ Hiển thị map (OpenStreetMap), icon kho 🏭 + icon số thứ tự tại mỗi điểm giao. Tuyến đường vẽ theo **đường bộ** (uốn theo QL18, đường nội thị) — KHÔNG phải đường thẳng. Click popup hiện thông tin điểm giao |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TRIP-04: Bản đồ — Không lỗi "Map container already initialized"
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Truy cập trang chi tiết chuyến xe |
| **Bước thực hiện** | 1. Mở chi tiết trip → 2. Quay lại danh sách → 3. Mở lại cùng trip |
| **Kết quả mong đợi** | Map hiển thị bình thường, KHÔNG hiện lỗi đỏ "Map container is already initialized" |
| **Mức ưu tiên** | 🔴 Bắt buộc |

### TC-TRIP-05: Bảng điểm giao trong trip
| Mục | Nội dung |
|-----|----------|
| **Điều kiện** | Đang ở chi tiết chuyến xe |
| **Bước thực hiện** | 1. Cuộn xuống bảng "Danh sách điểm giao" |
| **Kết quả mong đợi** | Bảng hiện: #, Khách hàng, Địa chỉ, Trạng thái (badge màu), Thời gian dự kiến, Trọng lượng |
| **Mức ưu tiên** | 🟡 Quan trọng |

---

## MODULE 6: API BACKEND (kiểm tra bằng cURL / Postman)

### TC-API-01: Health check
| Mục | Nội dung |
|-----|----------|
| **Request** | `GET http://localhost:8080/health` |
| **Kết quả mong đợi** | `{"success": true, "data": {"service": "bhl-oms-tms-wms", "status": "ok"}}` |

### TC-API-02: Login → Lấy token
| Mục | Nội dung |
|-----|----------|
| **Request** | `POST /v1/auth/login` body: `{"username":"admin","password":"demo123"}` |
| **Kết quả mong đợi** | `success: true`, `data.tokens.access_token` khác null, `data.tokens.refresh_token` khác null |

### TC-API-03: Lấy danh sách đơn hàng
| Mục | Nội dung |
|-----|----------|
| **Request** | `GET /v1/orders?limit=100` (header: Bearer token) |
| **Kết quả mong đợi** | Trả về 50 đơn hàng, đủ các trạng thái (confirmed, delivered, shipped, closed...) |

### TC-API-04: Lấy danh sách sản phẩm
| Mục | Nội dung |
|-----|----------|
| **Request** | `GET /v1/products` (header: Bearer token) |
| **Kết quả mong đợi** | Trả về 15 sản phẩm, mỗi SP có: id, sku, name, unit, price |

### TC-API-05: Kiểm tra ATP
| Mục | Nội dung |
|-----|----------|
| **Request** | `GET /v1/atp?product_id={id}&warehouse_id=a0...001` |
| **Kết quả mong đợi** | Trả về `available_qty` ≥ 0 |

### TC-API-06: Chạy VRP → Poll kết quả
| Mục | Nội dung |
|-----|----------|
| **Request** | 1. `POST /v1/planning/run-vrp` body: `{"warehouse_id":"a0...001","delivery_date":"2026-03-15"}` → 2. Poll `GET /v1/planning/jobs/{job_id}` mỗi 2s |
| **Kết quả mong đợi** | Bước 1: trả về `job_id` + status `processing`. Bước 2: sau ~30s, status = `completed`, `trips` không null, `summary` có đủ fields mới (total_duration_min, avg_capacity_util_pct...) |

### TC-API-07: Duyệt kế hoạch
| Mục | Nội dung |
|-----|----------|
| **Request** | `POST /v1/planning/approve` body: `{"job_id":"...","warehouse_id":"a0...001","delivery_date":"2026-03-15","assignments":[...]}` |
| **Kết quả mong đợi** | `success: true`, trips được tạo trong DB, shipment status → `loaded` |

---

## CHÚ THÍCH

### Mức ưu tiên
| Icon | Ý nghĩa |
|------|---------|
| 🔴 Bắt buộc | Phải pass trước khi demo — nếu fail thì STOP |
| 🟡 Quan trọng | Nên pass, nhưng không block demo nếu fail |
| 🟢 Tốt nếu có | Nice-to-have, kiểm tra nếu còn thời gian |

### Cách đọc lỗi khi gặp vấn đề

| Vị trí | Cách kiểm tra |
|--------|---------------|
| **Lỗi trên trình duyệt** (overlay đỏ Next.js) | Đọc: tên lỗi + file + dòng số. VD: `Error: Map container is already initialized` tại `trips/[id]/page.tsx (62:21)` → file `page.tsx`, dòng 62 |
| **Lỗi console trình duyệt** | Bấm F12 → tab Console → lỗi đỏ. Thường là lỗi JS/API |
| **Lỗi API** | F12 → tab Network → tìm request đỏ → xem Response body (có `error.code` + `error.message`) |
| **Lỗi backend** | Xem terminal chạy Go server → log `[GIN]` hiện status code + route |
| **Lỗi DB** | `docker logs bhl-oms-postgres-1 --tail 20` |
| **Lỗi VRP solver** | `docker logs bhl-oms-vrp-1 --tail 20` |

---

## CHECKLIST TRƯỚC KHI DEMO

- [ ] Docker containers đang chạy: `docker ps` → thấy postgres, redis, vrp
- [ ] Backend Go đang chạy: `GET http://localhost:8080/health` → OK  
- [ ] Frontend Next.js đang chạy: truy cập `http://localhost:3000` → trang login
- [ ] Dữ liệu demo đã load: `seed_full.sql` → 50 đơn, 20 khách, 12 xe, 12 tài xế
- [ ] Shipments ngày 15/03 ở trạng thái `pending` (nếu đã test approve trước đó → reset lại)
- [ ] Tất cả TC mức 🔴 đã PASS

### Lệnh reset shipments nếu cần
```sql
-- Chạy trong psql hoặc docker exec
UPDATE shipments SET status = 'pending' WHERE delivery_date = '2026-03-15' AND status = 'loaded';
DELETE FROM trip_stops WHERE trip_id IN (SELECT id FROM trips WHERE planned_date = '2026-03-15' AND trip_number LIKE 'TR-20260314-%');
DELETE FROM trips WHERE planned_date = '2026-03-15' AND trip_number LIKE 'TR-20260314-%';
```
