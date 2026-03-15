# UAT Test Script — Dispatcher Role (Task 4.7)

**Tài khoản:** dispatcher01 / demo123
**URL:** http://localhost:3000/login

---

## TC-01: Đăng nhập & Dashboard

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Mở trình duyệt → http://localhost:3000/login | Trang đăng nhập hiển thị |
| 2 | Nhập username: `dispatcher01`, password: `demo123` → Đăng nhập | Chuyển đến Dashboard |
| 3 | Kiểm tra Dashboard hiển thị 5 widget | Đơn hôm nay, Chuyến xe, Tỉ lệ giao, Doanh thu, Sai lệch |
| 4 | Kiểm tra sidebar hiển thị đúng menu cho Dispatcher | Dashboard, Đơn hàng, Tạo đơn, Lập kế hoạch, Chuyến xe, Bản đồ GPS, Sản phẩm, Khách hàng, Phương tiện, Tài xế, Quét barcode |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-02: Tạo Đơn Hàng

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Dashboard → Tạo đơn hàng mới | Form tạo đơn hiển thị |
| 2 | Chọn khách hàng: NPP-001 | Tên, địa chỉ auto-fill |
| 3 | Chọn ngày giao: ngày mai | Ngày được chọn |
| 4 | Thêm SP: BHL-LON-330 × 50, BHL-CHAI-450 × 30 | Tổng tiền được tính tự động |
| 5 | Kiểm tra ATP status | Hiển thị sufficient/insufficient |
| 6 | Kiểm tra Credit status | Hiển thị within_limit/over_limit |
| 7 | Nhấn "Tạo đơn hàng" | Đơn được tạo, chuyển về danh sách |
| 8 | Kiểm tra đơn trong danh sách | Trạng thái: Đã xác nhận (confirmed) |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-03: Duyệt Đơn Hàng

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Dashboard → Đơn hàng | Danh sách hiển thị |
| 2 | Lọc "Chờ duyệt" | Chỉ hiện đơn pending_approval |
| 3 | Nhấn "Duyệt" trên 1 đơn | Trạng thái chuyển thành "Đã duyệt" |
| 4 | Nhấn "Hủy" trên 1 đơn (nếu có) → Xác nhận | Trạng thái chuyển thành "Đã hủy" |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-04: Lập Kế Hoạch (VRP)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Dashboard → Lập kế hoạch | Trang planning hiển thị |
| 2 | Chọn ngày giao: ngày mai | Danh sách đơn hàng cần giao hiển thị |
| 3 | Nhấn "Tối ưu tuyến" | VRP solver chạy, trả về kết quả tuyến |
| 4 | Xem bản đồ tuyến | Các điểm giao hiển thị trên bản đồ |
| 5 | Kiểm tra phân bổ xe + tải xế | Xe được phân bổ, tải trọng hợp lệ |
| 6 | Nhấn "Xác nhận kế hoạch" | Trips được tạo, trạng thái "planned" |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-05: Quản Lý Chuyến Xe

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Dashboard → Chuyến xe | Danh sách trips hiển thị |
| 2 | Lọc theo trạng thái "Đã lên KH" | Chỉ hiện trip planned |
| 3 | Xem chi tiết 1 trip | Thông tin xe, tài xế, danh sách điểm giao |
| 4 | Lọc "Đang giao" | Hiện trip in_transit |
| 5 | Lọc "Hoàn thành" | Hiện trip completed |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-06: Theo Dõi GPS

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Dashboard → Bản đồ GPS | Bản đồ Leaflet hiển thị |
| 2 | Các xe đang giao hiển thị trên bản đồ | Marker xe với thông tin tooltip |
| 3 | Nhấn vào 1 marker | Popup: biển số, tài xế, T/G cập nhật |
| 4 | Đợi 5-10 giây | Vị trí cập nhật real-time qua WebSocket |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-07: Quản Lý Master Data

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Dashboard → Sản phẩm | Danh sách 30 SP hiển thị |
| 2 | Tìm kiếm "Lon 330" | Kết quả lọc đúng |
| 3 | Dashboard → Khách hàng | Danh sách 800 NPP hiển thị (pagination) |
| 4 | Tìm kiếm NPP theo tên/code | Kết quả lọc đúng |
| 5 | Dashboard → Phương tiện | Danh sách 70+ xe hiển thị |
| 6 | Dashboard → Tài xế | Danh sách 70+ tài xế hiển thị |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-08: Reconciliation (Đối soát)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Đăng nhập accountant01 / demo123 | Dashboard kế toán |
| 2 | Sidebar → Đối soát | Trang đối soát 3 tabs |
| 3 | Tab "Đối soát" → Lọc "Sai lệch" | Hiện danh sách reconciliation discrepancy |
| 4 | Tab "Sai lệch" | Danh sách discrepancy tickets |
| 5 | Nhấn "Xử lý" → Nhập nội dung → Lưu | Trạng thái chuyển resolved |
| 6 | Tab "Chốt ngày" → "Chốt sổ hôm nay" | Daily close summary được tạo |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-09: API Version Check

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | GET http://localhost:8080/v1/app/version | JSON: current_version, minimum_version, force_update |
| 2 | Kiểm tra force_update = false | Client không bắt buộc cập nhật |

**Pass:** ☐  **Ghi chú:** _______________

---

## TC-10: Audit Log

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Thực hiện 1 POST request (tạo đơn) | Request hoàn tất |
| 2 | Kiểm tra DB: `SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5;` | Có record ghi lại method, path, user_id, duration_ms |

**Pass:** ☐  **Ghi chú:** _______________

---

## Tổng kết UAT

| Test Case | Kết quả | Người test | Ngày |
|-----------|---------|------------|------|
| TC-01 Dashboard | ☐ Pass / ☐ Fail | | |
| TC-02 Tạo đơn | ☐ Pass / ☐ Fail | | |
| TC-03 Duyệt đơn | ☐ Pass / ☐ Fail | | |
| TC-04 VRP | ☐ Pass / ☐ Fail | | |
| TC-05 Chuyến xe | ☐ Pass / ☐ Fail | | |
| TC-06 GPS | ☐ Pass / ☐ Fail | | |
| TC-07 Master data | ☐ Pass / ☐ Fail | | |
| TC-08 Đối soát | ☐ Pass / ☐ Fail | | |
| TC-09 Version | ☐ Pass / ☐ Fail | | |
| TC-10 Audit | ☐ Pass / ☐ Fail | | |

**Tiêu chí Pass:** 8/10 test cases pass, 0 critical bugs
