# UAT Test Script — Tài xế (Driver Mobile App)

> **Task 4.8** | 5-10 tài xế test trên điện thoại  
> **Phiên bản:** 1.0 | **Ngày:** 15/03/2026

---

## 📱 Thông tin Test

| Hạng mục | Chi tiết |
|----------|---------|
| URL | `http://<SERVER_IP>:3000/login` |
| Tài khoản | `driver01` → `driver70` |
| Mật khẩu | `demo123` |
| Trình duyệt | Chrome Mobile (Android/iOS) |
| PWA | Menu ⋮ → "Thêm vào Màn hình chính" |

---

## 🧪 Test Cases (12 cases)

### TC-D01: Đăng nhập tài khoản tài xế

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Mở `http://<IP>:3000/login` trên điện thoại | Trang đăng nhập hiển thị |
| 2 | Nhập `driver01` / `demo123` → Nhấn "Đăng nhập" | Chuyển đến dashboard tài xế |
| 3 | Kiểm tra header hiện tên tài xế | "Phạm Văn Đức" hoặc tên tương ứng |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D02: Xem danh sách chuyến xe

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tại dashboard tài xế | Danh sách "Chuyến xe" hiển thị |
| 2 | Kiểm tra có chuyến "assigned" | Hiện chuyến TR-20260315-xxxx |
| 3 | Kiểm tra thông tin chuyến: biển số, ngày, số điểm giao, km | Tất cả hiển thị đúng |
| 4 | Xác nhận mỗi tài xế có đúng 1 chuyến, 10 điểm giao | 10 stops per trip |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D03: Pre-departure Checklist (Kiểm tra xe trước khi xuất phát)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Nhấn vào chuyến xe → Xem chi tiết | Trang chi tiết chuyến xe |
| 2 | Nhấn "Kiểm tra xe" / "Checklist" | Form checklist hiển thị |
| 3 | Đánh dấu: lốp xe ✓, phanh ✓, đèn ✓, gương ✓, còi ✓, nước làm mát ✓, dầu ✓, bình cứu hỏa ✓, y tế ✓, giấy tờ ✓, hàng hóa ✓ | Tất cả checkbox hoạt động |
| 4 | Chọn mức nhiên liệu (0-100%) | Slider/input hoạt động |
| 5 | Nhấn "Hoàn thành kiểm tra" | Checklist lưu thành công, nút "Bắt đầu chuyến" hiện |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D04: Bắt đầu chuyến xe (Start Trip)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Nhấn "Bắt đầu chuyến xe" | Xác nhận dialog hiện |
| 2 | Xác nhận bắt đầu | Trạng thái → "Đang giao hàng" (in_transit) |
| 3 | Kiểm tra GPS bắt đầu ghi nhận | Icon GPS hoạt động (nhấp nháy) |
| 4 | Kiểm tra danh sách 10 điểm giao hiển thị | Tất cả stops hiện, trạng thái "Chờ" |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D05: Đến điểm giao hàng (Arrive at Stop)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Nhấn vào điểm giao #1 | Chi tiết điểm giao hiển thị |
| 2 | Xem thông tin: tên NPP, địa chỉ, danh sách hàng | Đúng thông tin đơn hàng |
| 3 | Nhấn "Đã đến" | Trạng thái stop → "arrived" |
| 4 | Kiểm tra thời gian đến được ghi nhận | Timestamp hiển thị |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D06: Giao hàng thành công — ePOD (Electronic Proof of Delivery)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Nhấn "Giao hàng" / "ePOD" tại điểm giao | Modal ePOD hiện |
| 2 | Nhập số lượng giao cho từng sản phẩm | Số lượng match đơn hàng |
| 3 | Nhập tên người nhận: "Anh Tuấn" | Input hoạt động |
| 4 | Nhập SĐT người nhận: "0912345001" | Input hoạt động |
| 5 | Ký tên (signature pad) | Canvas ký hoạt động |
| 6 | Chụp ảnh biên nhận (camera) | Camera mở, ảnh được chọn |
| 7 | Nhấn "Xác nhận giao hàng" | ePOD lưu thành công |
| 8 | Kiểm tra stop status → "delivered" | Trạng thái cập nhật |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D07: Thu tiền tại điểm giao (Payment Collection)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Nhấn "Thu tiền" tại điểm giao | Modal thu tiền hiện |
| 2 | Chọn phương thức: Tiền mặt (cash) | Radio button hoạt động |
| 3 | Nhập số tiền thu | Hiện số tiền theo đơn hàng |
| 4 | Nhấn "Ghi nhận" | Payment lưu thành công |
| 5 | Thử phương thức "Chuyển khoản" (transfer) | Hiện input mã tham chiếu |
| 6 | Nhập mã CK + xác nhận | Lưu thành công với ref number |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D08: Trả hàng + Thu hồi vỏ (Returns)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Nhấn "Trả hàng" tại điểm giao | Modal trả hàng hiện |
| 2 | Nhập sản phẩm trả + số lượng | Input hoạt động |
| 3 | Chọn lý do: hàng hỏng / hết hạn / khách trả | Dropdown hoạt động |
| 4 | Nhập số lượng vỏ thu hồi (chai/két/keg) | Input hoạt động |
| 5 | Nhấn "Ghi nhận trả hàng" | Return lưu thành công |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D09: Giao hàng thất bại (Failed Delivery)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tại điểm giao #2, nhấn "Không giao được" | Dialog lý do hiện |
| 2 | Chọn lý do: "Khách vắng" / "Đường tắc" / "Khác" | Options hiển thị |
| 3 | Nhập ghi chú: "Khách không có người nhận" | Input hoạt động |
| 4 | Xác nhận | Stop status → "failed", có ghi chú |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D10: Hoàn thành chuyến xe (Complete Trip)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Giao hàng tại tất cả 10 điểm (mix delivered + failed) | Tất cả stops có trạng thái cuối |
| 2 | Nhấn "Hoàn thành chuyến xe" | Dialog xác nhận |
| 3 | Xác nhận hoàn thành | Trip status → "completed" |
| 4 | Kiểm tra chuyến chuyển sang tab "Đã hoàn thành" | UI cập nhật đúng |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D11: GPS Tracking (Theo dõi vị trí)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Bắt đầu chuyến xe → Cho phép GPS access | Browser xin quyền GPS |
| 2 | Chấp nhận quyền GPS | GPS tracking bắt đầu |
| 3 | Di chuyển thực tế (hoặc giả lập GPS) | Vị trí được cập nhật mỗi 15s |
| 4 | Kiểm tra trên dispatcher dashboard (admin account) | Vị trí xe hiển thị trên bản đồ |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

### TC-D12: Offline Mode (Chế độ ngoại tuyến)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Đang ở màn hình chuyến xe → Tắt Wi-Fi/4G | App vẫn hiển thị (cached) |
| 2 | Thực hiện ePOD tại 1 điểm giao (offline) | Lưu local (IndexedDB) |
| 3 | Thực hiện thu tiền (offline) | Lưu local |
| 4 | Bật lại Wi-Fi/4G | Auto sync bắt đầu |
| 5 | Chờ 30 giây | Dữ liệu offline sync lên server |
| 6 | Kiểm tra trên admin dashboard | Dữ liệu xuất hiện đúng |

**Kết quả:** ☐ Pass ☐ Fail  
**Ghi chú:** _______________

---

## 📊 Bảng tổng hợp kết quả

| Test Case | Mô tả | Kết quả | Tester | Ngày |
|-----------|-------|---------|--------|------|
| TC-D01 | Đăng nhập | ☐ | | |
| TC-D02 | Danh sách chuyến | ☐ | | |
| TC-D03 | Checklist xe | ☐ | | |
| TC-D04 | Bắt đầu chuyến | ☐ | | |
| TC-D05 | Đến điểm giao | ☐ | | |
| TC-D06 | ePOD giao hàng | ☐ | | |
| TC-D07 | Thu tiền | ☐ | | |
| TC-D08 | Trả hàng / vỏ | ☐ | | |
| TC-D09 | Giao thất bại | ☐ | | |
| TC-D10 | Hoàn thành chuyến | ☐ | | |
| TC-D11 | GPS tracking | ☐ | | |
| TC-D12 | Offline mode | ☐ | | |

**Criteria:** 12/12 Pass = UAT Driver OK  
**Tester gợi ý:** driver01 (Phạm Văn Đức), driver02 (Nguyễn Văn Hùng), driver03, driver04, driver05

---

## ⚙️ Hướng dẫn setup test

```bash
# 1. Start services
cd bhl-oms
docker compose up -d
go run cmd/server/main.go

# 2. Start frontend  
cd web && npm run dev

# 3. Trên điện thoại:
# Mở Chrome → http://<PC_IP>:3000/login
# Đăng nhập driver01 / demo123
# Menu ⋮ → Thêm vào Màn hình chính (PWA)
```

**Lưu ý:**
- PC và điện thoại phải cùng mạng Wi-Fi
- Cho phép truy cập GPS khi được hỏi
- Test offline: tắt Wi-Fi trên điện thoại, KHÔNG tắt server
