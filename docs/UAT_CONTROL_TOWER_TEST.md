# UAT — Trung tâm Điều phối (Control Tower)

> **Phiên bản:** 1.0  
> **Ngày:** 2025-01-18  
> **Người dùng chính:** Dispatcher, Admin, Management  
> **URL:** `http://localhost:3000/dashboard/control-tower`

---

## 1. Điều kiện tiên quyết (Prerequisites)

| # | Điều kiện | Cách chuẩn bị |
|---|-----------|---------------|
| P1 | Có ít nhất 1 user với role `dispatcher` | Test Portal có sẵn `dispatcher01/demo123` |
| P2 | Có ít nhất 4 chuyến xe status `in_transit`, `assigned`, hoặc `ready` | Load scenario SC-05 hoặc SC-11 |
| P3 | GPS simulator đang chạy | Test Portal → GPS tab → Bật GPS giả lập |
| P4 | Các điểm giao có tọa độ lat/lng | Customer master data có sẵn tọa độ |
| P5 | Backend + Frontend đang chạy | `localhost:8080/api/health` OK, `localhost:3000` load OK |

---

## 2. Kịch bản Test

### TC-CT-01: Tải trang — Layout 3 cột

**Mục tiêu:** Verify trang Control Tower load đúng layout cockpit 3 cột.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Login `dispatcher01/demo123` | Dashboard hiện menu |
| 2 | Vào `/dashboard/control-tower` | Trang load, không lỗi console |
| 3 | Kiểm tra cột trái (25%) | Thấy 8 metric cards + Trip list + VRP button |
| 4 | Kiểm tra cột giữa (50%) | Thấy filter chips + bản đồ Leaflet OSM |
| 5 | Kiểm tra cột phải (25%) | Thấy panel Cảnh báo + Quick Stats footer |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-02: Metric Cards — Hiển thị đúng thống kê

**Mục tiêu:** Các metric card hiện đúng số liệu từ API.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Load SC-05 (12 đơn → 4 chuyến) | Scenario loaded thành công |
| 2 | Vào Control Tower | Metric cards load |
| 3 | Kiểm tra "Chuyến" | = tổng chuyến hôm nay (≥ 4) |
| 4 | Kiểm tra "Đang giao" | = số chuyến status `in_transit` |
| 5 | Kiểm tra "Điểm giao" | Format `delivered/total` (VD: `0/12`) |
| 6 | Kiểm tra "Thất bại" | Badge đỏ nếu > 0, xanh nếu = 0 |
| 7 | Kiểm tra "Xe đang chạy" | = số xe có GPS position |
| 8 | Kiểm tra "Cảnh báo" | = đếm exceptions |

**Verify API:** `GET /api/trips/control-tower/stats` trả về JSON match với UI.

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-03: Trip List — Hiển thị danh sách chuyến active

**Mục tiêu:** Trip list hiện đúng chuyến đang active và progress bars.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Load SC-05 | 4 chuyến tạo thành công |
| 2 | Vào Control Tower, tab "🚛 Chuyến" | Thấy ≥ 4 chuyến trong list |
| 3 | Mỗi chuyến hiện | Trip number, biển số, tài xế, số stops |
| 4 | Chuyến `in_transit` | Có progress bar (xanh nếu đúng ETA, đỏ nếu trễ) |
| 5 | Chuyến `assigned`/`ready` | Có progress bar 0% |
| 6 | Kiểm tra ETA badge | Hiện "Đúng tiến độ" hoặc "Lệch ETA -Xm" |
| 7 | Kiểm tra ETA text | Hiện "ETA [tên KH]: còn X phút" |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-04: Trip Detail Panel — Xem chi tiết + hành động

**Mục tiêu:** Click chuyến → hiện panel chi tiết với stops và actions.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Click vào 1 chuyến trong trip list | Panel chi tiết xuất hiện ở dưới trip list |
| 2 | Kiểm tra header | Trip number + "✕" close button |
| 3 | Kiểm tra info | Biển số · Tên TX · Số điểm giao |
| 4 | Kiểm tra stops list | Hiện danh sách điểm giao status `pending` |
| 5 | Mỗi stop hiện | Checkbox + #order + Tên KH + nút "↗" |
| 6 | Kiểm tra nút "Chi tiết" | Navigate sang `/dashboard/trips` |
| 7 | Click "✕" | Panel đóng, trip unselect |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-05: GPS Map — Vehicle Markers

**Mục tiêu:** Xe hiện trên bản đồ khi GPS WebSocket push data.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Load SC-05 | 4 chuyến với GPS giả lập |
| 2 | Bật GPS simulator (Test Portal → GPS tab) | GPS bắt đầu push positions |
| 3 | Vào Control Tower | Bản đồ hiện ≥ 1 vehicle markers |
| 4 | Xe đang chạy (speed > 5) | Marker màu xanh lá (#22c55e) |
| 5 | Xe đang chờ (speed ≤ 5) | Marker màu vàng (#f59e0b) |
| 6 | Xe có cảnh báo | Marker màu đỏ + ring pulse animation |
| 7 | Click vào marker | Popup hiện: biển số, tài xế, tốc độ |
| 8 | Click marker lần nữa | Mở Driver Modal |
| 9 | Kiểm tra auto-update | Marker di chuyển mỗi 3s (GPS interval) |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-06: Map Filter Chips

**Mục tiêu:** Filter chips lọc đúng xe trên bản đồ.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Bật GPS simulator, vào CT | Thấy xe trên map |
| 2 | Click "Tất cả" | Hiện tất cả xe (active chip highlight) |
| 3 | Click "🟢 Đang chạy" | Chỉ hiện xe `in_transit` |
| 4 | Click "🟡 Chờ" | Chỉ hiện xe `assigned` |
| 5 | Click "⚫ Offline" | Chỉ hiện xe `offline` (nếu có) |
| 6 | Kiểm tra counter | "X xe online" cập nhật đúng |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-07: Driver/Vehicle Info Modal

**Mục tiêu:** Modal hiện đầy đủ thông tin xe và tài xế.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Click marker xe trên map | Driver Modal mở |
| 2 | Kiểm tra tiêu đề | "🚛 [biển số]" |
| 3 | Kiểm tra thông tin | Tài xế, Trạng thái, Tốc độ, Cập nhật, Tọa độ |
| 4 | Trạng thái xe `in_transit` | Hiện "Đang giao" (text xanh) |
| 5 | Trạng thái xe `assigned` | Hiện "Phân công" (text vàng) |
| 6 | Tọa độ | Format 5 chữ số thập phân |
| 7 | Click backdrop hoặc "✕" | Modal đóng |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-08: Fleet View — Đội xe

**Mục tiêu:** Tab Fleet hiện danh sách xe online.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Bật GPS simulator, vào CT | Xe bắt đầu push GPS |
| 2 | Click tab "🚚 Đội xe" | Chuyển sang fleet view |
| 3 | Counter trên tab | Hiện "(X)" = số xe online |
| 4 | Mỗi xe hiện | Dot status + Biển số + TX + Tốc độ + Trạng thái |
| 5 | Xe đang chạy | Dot xanh, speed > 0 |
| 6 | Xe đang chờ | Dot vàng, speed = 0 |
| 7 | Nếu không có xe | Hiện "Chưa có xe nào online" |
| 8 | Click vào xe | Mở Driver Modal |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-09: Exception/Alert Panel

**Mục tiêu:** Panel cảnh báo hiện đúng exceptions với priority.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tạo tình huống có exception (trễ ETA, xe chưa xuất bến) | Exceptions tồn tại trong DB |
| 2 | Vào Control Tower | Panel phải hiện danh sách cảnh báo |
| 3 | Exception P0 | Border đỏ bên trái, nền đỏ nhạt |
| 4 | Exception P1 | Border vàng bên trái, nền vàng nhạt |
| 5 | Mỗi alert hiện | Priority badge + Title + Description + Mô tả loại |
| 6 | Alert `failed_stop` | Có nút "Giao lại" |
| 7 | Alert `idle_vehicle` | Có nút "Liên hệ TX" |
| 8 | Click "Giao lại" | Gọi API `PUT /stops/:id/status` → `re_delivery`, alert refresh |
| 9 | Nếu không có alerts | Hiện "Không có cảnh báo — tốt lắm! 🎉" |

**Verify API:** `GET /api/trips/exceptions` trả về danh sách exceptions.

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-10: Move Stop — Chuyển điểm giao

**Mục tiêu:** Chuyển 1 điểm giao từ chuyến A sang chuyến B.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Load SC-05, tạo ≥ 2 chuyến | 2+ chuyến active |
| 2 | Click chuyến A → trip detail panel | Thấy stops list |
| 3 | Click "↗" trên 1 stop pending | Mở Move Stop Modal |
| 4 | Modal hiện | Tiêu đề, dropdown chuyến đích (trừ chuyến A) |
| 5 | Chọn chuyến B, click "Chuyển" | API `POST /trips/:id/stops/:stopId/move` gọi |
| 6 | Sau thành công | Modal đóng, trip list refresh, stop chuyển sang chuyến B |
| 7 | Click "Hủy" trên modal | Modal đóng, không gọi API |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-11: Bulk Move Stops — Chuyển nhiều điểm

**Mục tiêu:** Chọn nhiều stops và chuyển cùng lúc.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Click chuyến có ≥ 3 stops pending | Trip detail panel mở |
| 2 | Check checkbox 2-3 stops | Nút "Chuyển X điểm →" xuất hiện |
| 3 | Click "Chuyển X điểm →" | Bulk Move Modal mở |
| 4 | Chọn chuyến đích, click "Chuyển X điểm" | API call cho mỗi stop, tuần tự |
| 5 | Sau thành công | Modal đóng, checkboxes clear, trip refresh |
| 6 | Verify chuyến B | Các stops đã chuyển xuất hiện trong chuyến B |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-12: Cancel Trip — Hủy chuyến

**Mục tiêu:** Hủy chuyến từ Control Tower.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Click chuyến status `planned`/`assigned`/`ready` | Trip detail panel |
| 2 | Click "Hủy chuyến" (nút đỏ) | Cancel Confirm Modal mở |
| 3 | Modal hiện | "🚫 Hủy chuyến [trip_number]?" + textarea lý do |
| 4 | Nhập lý do, click "Xác nhận hủy" | API `POST /trips/:id/cancel` gọi |
| 5 | Sau thành công | Modal đóng, chuyến mất khỏi active list |
| 6 | Không nhập lý do | Vẫn hủy được (lý do default) |
| 7 | Chuyến `in_transit` | Nút "Hủy chuyến" KHÔNG hiện |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-13: Quick Stats Footer

**Mục tiêu:** Footer cột phải hiện 3 metrics đúng.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Vào CT có dữ liệu | Footer visible |
| 2 | OTD Rate | Format "XX.X%", xanh nếu ≥ 90%, vàng nếu < 90% |
| 3 | Tổng tải | Format "X.XT" (chia 1000 từ kg) |
| 4 | Tổng quãng đường | Format "X km" (số nguyên) |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-14: GPS WebSocket — Real-time Updates

**Mục tiêu:** Verify GPS data stream real-time qua WebSocket.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Mở DevTools → Network → WS tab | Thấy WS connection |
| 2 | Bật GPS simulator | WS nhận messages `type: "position"` |
| 3 | Kiểm tra message format | `{vehicle_id, vehicle_plate, driver_name, trip_status, lat, lng, speed, heading, timestamp}` |
| 4 | Mỗi 3s | Marker trên map cập nhật vị trí |
| 5 | Tắt GPS simulator | Xe dừng di chuyển (marker ở vị trí cuối) |
| 6 | Đóng tab, mở lại | WS reconnect tự động |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-15: Auto Refresh — Polling 30s

**Mục tiêu:** Data refresh tự động mỗi 30 giây.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Mở DevTools → Network | Monitor API calls |
| 2 | Chờ 30 giây | 3 API calls: `/stats`, `/exceptions`, `/trips?limit=50` |
| 3 | Thay đổi data ở backend (VD: complete 1 stop) | Sau ≤ 30s, metric cards cập nhật |
| 4 | WebSocket push trip event | `loadAll()` gọi ngay (không chờ 30s) |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-16: Empty State — Không có dữ liệu

**Mục tiêu:** Verify UI hiện đúng khi không có data.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Reset data (Test Portal → Reset) | Xóa hết dữ liệu transactional |
| 2 | Vào CT | Trang load không lỗi |
| 3 | Metric cards | Tất cả = 0 |
| 4 | Trip list | "Không có cảnh báo — tốt lắm! 🎉" |
| 5 | Map | Bản đồ trống, 0 markers |
| 6 | Alert panel | "Không có cảnh báo — tốt lắm! 🎉" |
| 7 | Fleet tab | "Chưa có xe nào online" |
| 8 | Counter trên filter | "0 xe online" |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-17: Role-based Access Control

**Mục tiêu:** Chỉ dispatcher/admin/management truy cập được.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Login `dispatcher01` → vào CT | Trang load OK |
| 2 | Login `admin01` → vào CT | Trang load OK |
| 3 | Login `driver01` → vào CT | Redirect về `/dashboard` |
| 4 | Login `warehouse01` → vào CT | Redirect về `/dashboard` |
| 5 | Login `accountant01` → vào CT | Redirect về `/dashboard` |
| 6 | Không login → vào CT URL trực tiếp | Redirect về login page |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-18: VRP Action Bar

**Mục tiêu:** Nút VRP và DS Chuyến navigate đúng.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Click "Chạy VRP" | Navigate sang `/dashboard/planning` |
| 2 | Quay lại CT, click "DS Chuyến" | Navigate sang `/dashboard/trips` |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-19: GPS Simulator Integration — End-to-End

**Mục tiêu:** Full flow từ load scenario → GPS tracking → complete delivery.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Load SC-05 | 12 đơn confirmed |
| 2 | Vào Planning → VRP hoặc Thủ công → Tạo chuyến | ≥ 2 chuyến tạo |
| 3 | Approve chuyến | Trips status = `planned` → `assigned` |
| 4 | Vào CT | Chuyến hiện trong trip list |
| 5 | Bật GPS simulator (Test Portal → GPS) | Backend `POST /gps/simulate/start` |
| 6 | Quay lại CT | Xe hiện trên bản đồ, di chuyển real-time |
| 7 | Click 1 chuyến | Trip detail mở, stops list hiện |
| 8 | Chờ 30s | Position markers di chuyển trên map |
| 9 | Chờ vài phút | Xe "đến" stop, progress bar tăng |
| 10 | Tắt GPS simulator | Xe dừng di chuyển |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

### TC-CT-20: Responsive & Performance

**Mục tiêu:** UI phản hồi nhanh và không lag.

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Trang load | < 2 giây (sau khi API respond) |
| 2 | Click filter chip | Map update < 200ms |
| 3 | GPS push 5 xe mỗi 3s | Markers update mượt, không lag |
| 4 | Mở/đóng modal | Transition smooth |
| 5 | Scroll trip list (nhiều chuyến) | Không giật |
| 6 | Console errors | Không có React warnings hay runtime errors |

**Kết quả:**  
- [ ] PASS  
- [ ] FAIL — Ghi chú: ___________

---

## 3. Ma trận Test Coverage

| Feature | Test Case | Priority |
|---------|-----------|----------|
| Layout 3 cột | TC-CT-01 | P0 |
| Metric cards | TC-CT-02 | P0 |
| Trip list + progress | TC-CT-03 | P0 |
| Trip detail panel | TC-CT-04 | P0 |
| GPS map markers | TC-CT-05 | P0 |
| Map filter chips | TC-CT-06 | P1 |
| Driver modal | TC-CT-07 | P1 |
| Fleet view | TC-CT-08 | P1 |
| Exception alerts | TC-CT-09 | P0 |
| Move stop | TC-CT-10 | P0 |
| Bulk move stops | TC-CT-11 | P1 |
| Cancel trip | TC-CT-12 | P0 |
| Quick stats | TC-CT-13 | P2 |
| GPS WebSocket | TC-CT-14 | P0 |
| Auto refresh | TC-CT-15 | P1 |
| Empty state | TC-CT-16 | P1 |
| RBAC | TC-CT-17 | P0 |
| Navigation buttons | TC-CT-18 | P2 |
| E2E GPS flow | TC-CT-19 | P0 |
| Performance | TC-CT-20 | P1 |

**P0 (Must test):** 10 cases  
**P1 (Should test):** 7 cases  
**P2 (Nice to have):** 3 cases  

---

## 4. Edge Cases & Negative Tests

| # | Tình huống | Kết quả mong đợi |
|---|-----------|-------------------|
| E1 | GPS WebSocket disconnect → reconnect | Map vẫn hiện xe cuối cùng, WS tự reconnect |
| E2 | API stats trả lỗi 500 | Trang vẫn load, metric cards giữ giá trị cũ hoặc 0 |
| E3 | Move stop đến chuyến đầy (> capacity) | API trả lỗi, toast hiện message |
| E4 | Cancel chuyến đã in_transit | Nút Hủy không hiện (chỉ planned/assigned/ready) |
| E5 | 2 dispatcher mở CT cùng lúc | Cả 2 thấy cùng data, actions không conflict |
| E6 | Xe GPS ngoài viewport bản đồ | Marker vẫn tồn tại, user zoom out sẽ thấy |
| E7 | Timestamp GPS quá cũ (> 5 phút) | Xe vẫn hiện nhưng có thể classified "offline" |
| E8 | Trip không có stops | Trip detail panel hiện nhưng stops list trống |
| E9 | Token hết hạn → WS reject | Redirect sang login |
| E10 | Network offline | Toast lỗi khi poll 30s fail, map giữ markers cũ |

---

## 5. Test Data Scenarios

### Scenario SC-11: Control Tower Comprehensive Test

**Mục đích:** Scenario chuyên dụng cho testing Control Tower với đầy đủ dữ liệu.

**Data cần:**
- 8 chuyến xe (mix status: 3 in_transit, 2 assigned, 2 ready, 1 completed)
- Mỗi chuyến 3-5 stops (mix status: pending, arrived, delivered, failed)
- 5 xe có GPS position (3 đang chạy, 2 idle)
- 3 exceptions (1 P0 failed_stop, 1 P0 late_eta, 1 P1 idle_vehicle)
- GPS simulator route: Hải Phòng → Quảng Ninh area

**Cách load:**
```
Test Portal → Load Scenario → SC-11: Control Tower Comprehensive
```

---

## 6. Checklist Tóm tắt

- [ ] TC-CT-01 → TC-CT-04: Layout + Data display (4 cases)
- [ ] TC-CT-05 → TC-CT-08: GPS + Map + Fleet (4 cases)
- [ ] TC-CT-09: Exception alerts
- [ ] TC-CT-10 → TC-CT-12: Actions (Move, Bulk Move, Cancel)
- [ ] TC-CT-13 → TC-CT-15: Stats + WebSocket + Refresh
- [ ] TC-CT-16 → TC-CT-18: Empty state + RBAC + Navigation
- [ ] TC-CT-19 → TC-CT-20: E2E + Performance
- [ ] Edge cases E1-E10 (spot check)
