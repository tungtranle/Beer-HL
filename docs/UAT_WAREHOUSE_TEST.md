# UAT Test Script — Thủ kho / PDA (Warehouse Staff)

> **Task 4.10** | Thủ kho test kiểm tra xuất kho + PDA barcode  
> **Phiên bản:** 1.0 | **Ngày:** 15/03/2026

---

## 📱 Thông tin Test

| Hạng mục | Chi tiết |
|----------|---------|
| URL | `http://localhost:3000/login` |
| TK Trưởng kho HL | `truongkho_hl` / `demo123` (Nguyễn Xuân Trường) |
| TK Thủ kho HL | `thukho_hl01`..`thukho_hl03` / `demo123` |
| TK Soạn hàng HL | `soanhang_hl01`..`soanhang_hl02` / `demo123` |
| TK Bảo vệ HL | `baove_hl01`..`baove_hl03` / `demo123` |
| TK Trưởng kho HP | `truongkho_hp` / `demo123` (Vũ Quang Minh) |
| Thiết bị PDA | Tablet/điện thoại Android + Chrome |

---

## 🧪 Test Cases (8 cases)

### TC-W01: Đăng nhập Thủ kho / Bảo vệ

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Đăng nhập `admin` / `demo123` | Dashboard admin hiển thị |
| 2 | Kiểm tra menu WMS: Tồn kho, Picking, Gate Check | Menu items hiện |
| 3 | Đăng nhập `baove01` / `demo123` | Giao diện bảo vệ hiện |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-W02: Xem tồn kho (Stock Quants)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Vào "Tồn kho" / "Stock" | Danh sách stock quants hiện |
| 2 | Lọc theo kho: Kho Hạ Long | Chỉ hiện hàng WH-HL |
| 3 | Lọc theo sản phẩm: "Bia Hạ Long Lon 330ml" | Filter hoạt động |
| 4 | Kiểm tra: Số lượng, Đã đặt (reserved), Khả dụng | ATP calculated |
| 5 | Kiểm tra lô hàng (batch), HSD (expiry_date) | FEFO information |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-W03: Tạo phiếu Picking (Picking Order)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Xem danh sách shipments "pending" | Shipments cần picking |
| 2 | Tạo picking order cho 1 shipment | Pick number generated |
| 3 | Kiểm tra danh sách hàng cần lấy | Products + quantities |
| 4 | Kiểm tra vị trí kho (location) | Khu A/B hiện đúng |
| 5 | Xác nhận FEFO: hàng hết HSD sớm lấy trước | Sorting by expiry_date ASC |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-W04: Hoàn thành Picking (PDA Barcode Scan)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Mở picking order trên PDA/tablet | Danh sách items cần scan |
| 2 | Scan barcode (hoặc nhập thủ công) SKU sản phẩm | SKU match, quantity input |
| 3 | Nhập số lượng đã lấy cho từng item | Input hoạt động |
| 4 | Nhấn "Hoàn thành picking" | Pick order → completed |
| 5 | Kiểm tra shipment status → "picked" | Auto-update |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-W05: Gate Check — Kiểm tra xuất kho (Bảo vệ)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Đăng nhập `baove01` trên thiết bị cổng | Giao diện gate check |
| 2 | Chọn Trip / xe cần kiểm tra | Hiện danh sách hàng trên xe |
| 3 | Đối chiếu: expected_items vs actual_items | Bảng so sánh hiển thị |
| 4 | Scan barcode từng sản phẩm trên xe | Quantity scanned tracked |
| 5 | Tất cả khớp → "PASS" | Result = pass, cho xe xuất |
| 6 | Kiểm tra: qty_loaded = qty_ordered (100%) | BR-TMS-04 rule |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-W06: Gate Check — Sai lệch (FAIL)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tại gate check, scan thiếu 1 item | Mismatch detected |
| 2 | Hệ thống hiện warning "Thiếu hàng" | Alert/highlight |
| 3 | Result → "FAIL" | Không cho xe xuất |
| 4 | Ghi chú lý do | Notes field hoạt động |
| 5 | Bổ sung hàng → Re-check → PASS | Allow retry |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-W07: Nhập kho trả hàng (Return Inbound)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Xe trả hàng về kho | Danh sách returns hiện |
| 2 | Kiểm tra hàng trả: sản phẩm, số lượng, lý do | Đúng với driver ePOD |
| 3 | Scan xác nhận nhận hàng trả | Stock_moves.type = "inbound" |
| 4 | Kiểm tra tồn kho tăng lên | Stock quant updated |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-W08: Kiểm tra vỏ thu hồi (Asset Returns)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Xe về kho → Kiểm tra vỏ chai/két/keg | Asset list hiện |
| 2 | Đối chiếu: vỏ phát ra vs vỏ thu về | Bảng so sánh |
| 3 | Ghi nhận vỏ tốt / hỏng / mất | Condition tracking |
| 4 | Xác nhận nhập kho vỏ | Asset_ledger.direction = "in" |
| 5 | Kiểm tra tồn vỏ NPP có cập nhật | Balance per customer |

**Kết quả:** ☐ Pass ☐ Fail

---

## 📊 Bảng tổng hợp

| Test Case | Mô tả | Kết quả | Tester | Ngày |
|-----------|-------|---------|--------|------|
| TC-W01 | Đăng nhập | ☐ | | |
| TC-W02 | Tồn kho | ☐ | | |
| TC-W03 | Picking order | ☐ | | |
| TC-W04 | PDA scan | ☐ | | |
| TC-W05 | Gate check PASS | ☐ | | |
| TC-W06 | Gate check FAIL | ☐ | | |
| TC-W07 | Nhập kho trả hàng | ☐ | | |
| TC-W08 | Vỏ thu hồi | ☐ | | |

**Criteria:** 8/8 Pass = UAT Thủ kho OK

---

## 🛡️ Tài khoản Bảo vệ

| Username | Password | Kho | Họ tên |
|----------|----------|-----|--------|
| baove01 | demo123 | Hạ Long | Nguyễn Văn Bảo |
| baove02 | demo123 | Hạ Long | Trần Văn Cường |
| baove03 | demo123 | Hạ Long | Lê Đình Dũng |
| baove04 | demo123 | Hải Phòng | Phạm Văn Thắng |
| baove05 | demo123 | Hải Phòng | Hoàng Văn Trung |
