# TEST CASES — BHL OMS-TMS-WMS

> **Tổng hợp test cases cho UAT / Demo / QA**
> Sử dụng Test Portal: http://localhost:3000/test-portal
> Hoặc API trực tiếp: http://localhost:8080/v1/test-portal/...

---

## Mục lục

1. [Chuẩn bị môi trường](#chuẩn-bị-môi-trường)
2. [TC-OMS: Đơn hàng](#tc-oms-đơn-hàng)
3. [TC-CREDIT: Tín dụng / Dư nợ](#tc-credit-tín-dụng--dư-nợ)
4. [TC-CONFIRM: Xác nhận đơn hàng Zalo](#tc-confirm-xác-nhận-đơn-hàng-zalo)
5. [TC-ATP: Tồn kho / Available-To-Promise](#tc-atp-tồn-kho--available-to-promise)
6. [TC-DELIVERY: Giao hàng & ePOD](#tc-delivery-giao-hàng--epod)
7. [TC-ZALO: Xác nhận giao hàng Zalo](#tc-zalo-xác-nhận-giao-hàng-zalo)
8. [TC-E2E: Kịch bản End-to-End](#tc-e2e-kịch-bản-end-to-end)

---

## Chuẩn bị môi trường

### Reset dữ liệu

**Cách 1 — Qua Test Portal UI:**
1. Mở http://localhost:3000/test-portal
2. Nhấn nút **🗑️ Reset Data** (góc trên phải)
3. Confirm → Xóa toàn bộ data test, giữ NPP + sản phẩm + kho + tồn kho

**Cách 2 — Qua SQL:**
```bash
docker cp ./migrations/reset_test_data.sql bhl-oms-postgres-1:/tmp/
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/reset_test_data.sql
```

**Cách 3 — Qua API:**
```bash
curl -X POST http://localhost:8080/v1/test-portal/reset-data
```

### Dữ liệu master (không bị xóa khi reset)

| Loại | Số lượng | Ghi chú |
|------|----------|---------|
| NPP (customers) | 218 | 15 tỉnh: QN(40), HD(33), HP(26), BG(22), TB(22), HY(16)... |
| Sản phẩm (products) | 30 | Bia + Nước giải khát + Vỏ cược |
| Kho (warehouses) | 2 | WH-HL (Hạ Long), WH-HP (Hải Phòng) |
| Tồn kho (stock_quants) | 47 records | Mỗi SP × mỗi kho |
| Vehicles | 70 | 50 WH-HL + 20 WH-HP (3t5/5t/8t/15t) |
| Drivers | 70 | 50 WH-HL + 20 WH-HP |
| Users | 80+ | admin, dvkh01, dispatcher01, driver01-70... |

### NPP mẫu thường dùng trong test

| Code | Tên | Tỉnh | Hạn mức (VNĐ) |
|------|-----|-------|---------------|
| BG-1 | Hải Hồng (Tống Khắc Khoan) | Bắc Giang | 434,000,000 |
| HD-59 | Phạm Văn Đức | Hải Dương | 384,000,000 |
| HP-38 | Đỗ Văn Nam | Hải Phòng | 634,000,000 |
| TB-127 | (NPP Thái Bình) | Thái Bình | 584,000,000 |

**Phân bổ hạn mức tín dụng:**
| Hạn mức | Số NPP |
|---------|--------|
| 384,000,000 | 45 NPP |
| 434,000,000 | 85 NPP |
| 584,000,000 | 62 NPP |
| 634,000,000 | 26 NPP |

### Tài khoản đăng nhập

| Username | Password | Vai trò | Kho |
|----------|----------|---------|-----|
| admin | demo123 | Admin | WH-HL + WH-HP |
| dvkh01 | demo123 | ĐVKH (Sales/OMS) | WH-HL |
| dispatcher01 | demo123 | Điều phối (TMS) | WH-HL |
| accountant01 | demo123 | Kế toán | WH-HL |
| driver01 | demo123 | Tài xế | WH-HL |

---

## TC-OMS: Đơn hàng

### TC-OMS-01: Tạo đơn hàng thành công (Happy Path)

**Tiên quyết:** Reset data, đăng nhập dvkh01

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Test Portal → Tab "Tạo đơn test" | Hiện form chọn NPP, kho, sản phẩm |
| 2 | Chọn NPP: **BG-1 (Hải Hồng - Tống Khắc Khoan)** | Hiện thông tin NPP, hạn mức credit |
| 3 | Chọn kho: **WH-HL** | |
| 4 | Chọn SP: BHL-LON-330 × 10 thùng | Tổng tiền: 1,850,000đ |
| 5 | Nhấn "Tạo đơn hàng test" | ✅ Đơn tạo thành công |
| 6 | Kiểm tra tab "Đơn hàng" | Đơn SO-{date}-0001 ở trạng thái **Chờ KH xác nhận** |
| 7 | Kiểm tra tab "Xác nhận đơn Zalo" | Xuất hiện 1 record status=**sent**, có token |
| 8 | Kiểm tra tab "Tồn kho" | reserved_qty tăng thêm 10 cho BHL-LON-330 |

**Business Rules kiểm tra:** BR-OMS-01 (ATP), BR-OMS-02 (Credit), BR-OMS-03 (Order number)

---

### TC-OMS-02: Tạo đơn nhiều sản phẩm

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tab "Tạo đơn test" → Chọn HD-59 (Phạm Văn Đức) | |
| 2 | Thêm 3 sản phẩm: BHL-LON-330 × 20, BHL-GOLD-330 × 10, NGK-CHANH-330 × 15 | Tổng: 20×185k + 10×225k + 15×125k = 7,825,000đ |
| 3 | Tạo đơn | ✅ Thành công, status = pending_customer_confirm |
| 4 | Tab "Tồn kho" | reserved_qty tăng cho cả 3 SP tại WH-HL |

---

### TC-OMS-03: Tạo đơn — ATP không đủ

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tab "Tồn kho" → Ghi nhận available của BHL-LON-330 | VD: available = 500 |
| 2 | Tạo đơn BHL-LON-330 × **99999** thùng | ❌ Lỗi: ATP_INSUFFICIENT |
| 3 | Tab "Tồn kho" | reserved_qty **không thay đổi** (rollback) |

**Business Rules:** BR-OMS-01 — Draft không trừ ATP, đơn bị reject không reserve

---

### TC-OMS-04: Tạo đơn — Vượt hạn mức tín dụng

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tab "Dư nợ" → Ghi nhận available_limit của BG-1 | |
| 2 | Tạo nhiều đơn liên tiếp cho BG-1 cho đến khi vượt | |
| 3 | Khi tổng > available_limit | Đơn tạo thành công nhưng status = **pending_approval** |
| 4 | Tab "Đơn hàng" | Đơn hiện trạng thái **Chờ duyệt credit** |
| 5 | Tab "Xác nhận đơn Zalo" | **Không** có record (chưa gửi Zalo cho pending_approval) |

**Business Rules:** BR-OMS-02 — Vượt credit → pending_approval → Kế toán duyệt

---

## TC-CREDIT: Tín dụng / Dư nợ

### TC-CREDIT-01: Kiểm tra dư nợ trước và sau tạo đơn

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tab "Dư nợ" → Ghi nhận BG-1 available_limit = X | |
| 2 | Tạo 1 đơn cho BG-1, tổng tiền = Y | |
| 3 | Tab "Dư nợ" → BG-1 available_limit | Không thay đổi ngay (chưa confirm) |
| 4 | Tab "Xác nhận đơn Zalo" → Xác nhận đơn | |
| 5 | Tab "Dư nợ" → BG-1 | available_limit giảm Y (debit entry created) |

---

### TC-CREDIT-02: Hủy đơn → hoàn trả credit

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tạo đơn cho BG-1 → Xác nhận qua Zalo | available_limit giảm |
| 2 | Dashboard → Hủy đơn | API: DELETE /v1/orders/:id hoặc cancel |
| 3 | Tab "Dư nợ" | available_limit phục hồi |

---

## TC-CONFIRM: Xác nhận đơn hàng Zalo

### TC-CONFIRM-01: Khách hàng xác nhận đơn (Happy Path)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tạo đơn cho BG-1 (credit OK) | Status = pending_customer_confirm |
| 2 | Tab "Xác nhận đơn Zalo" | 1 record, status = **sent** |
| 3 | Nhấn **"✅ Xác nhận đơn hàng (vai KH)"** | Toast: "Đơn hàng đã xác nhận!" |
| 4 | Tab "Đơn hàng" | Status chuyển → **confirmed** |
| 5 | Tab "Xác nhận đơn Zalo" | Status = **confirmed**, có confirmed_at |
| 6 | Tab "Tồn kho" | reserved_qty giữ nguyên (đã reserve từ lúc tạo) |
| 7 | Tab "Dư nợ" | Debit entry tạo → available_limit giảm |

---

### TC-CONFIRM-02: Khách hàng từ chối đơn

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tạo đơn cho HD-59 (Phạm Văn Đức) | Status = pending_customer_confirm |
| 2 | Tab "Xác nhận đơn Zalo" → Nhấn **"❌ Từ chối"** | Nhập lý do: "Giá cao quá" |
| 3 | Tab "Đơn hàng" | Status → **cancelled** |
| 4 | Tab "Xác nhận đơn Zalo" | Status = **rejected**, reject_reason = "Giá cao quá" |
| 5 | Tab "Tồn kho" | reserved_qty **giảm** (stock released) |
| 6 | Tab "Dư nợ" | available_limit **không thay đổi** (no debit) |

---

### TC-CONFIRM-03: Tự động xác nhận sau 2 giờ

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tạo đơn cho HP-38 (Đỗ Văn Nam) | Status = pending_customer_confirm |
| 2 | Tab "Xác nhận đơn Zalo" → Ghi nhận expires_at | = created + 2h |
| 3 | Đợi cron chạy (mỗi 5 phút) hoặc gọi manual | |
| 4 | Sau expires_at, kiểm tra lại | Status = **auto_confirmed** |
| 5 | Tab "Đơn hàng" | Status → **confirmed** |

**Lưu ý:** Trong test có thể phải chờ hoặc update DB thủ công để test auto-confirm.

---

### TC-CONFIRM-04: Xác nhận đơn đã hết hạn

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Sau TC-CONFIRM-03, thử nhấn xác nhận lại | ❌ Lỗi: Token đã hết hạn/đã xử lý |

---

## TC-ATP: Tồn kho / Available-To-Promise

### TC-ATP-01: Xem tồn kho theo kho

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tab "Tồn kho" | Hiện tất cả stock grouped by warehouse |
| 2 | Kiểm tra cột | Tổng, Đã đặt (reserved), Khả dụng (ATP) |
| 3 | Khả dụng = Tổng - Đã đặt | Đúng với mọi dòng |

---

### TC-ATP-02: Reserved tăng khi tạo đơn

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tab "Tồn kho" → BHL-LON-330 at WH-HL, ghi reserved = R₀ | |
| 2 | Tạo đơn BHL-LON-330 × 20 thùng | |
| 3 | Tab "Tồn kho" → BHL-LON-330 at WH-HL | reserved = R₀ + 20 |
| 4 | Hủy đơn (từ chối qua Zalo) | |
| 5 | Tab "Tồn kho" → BHL-LON-330 at WH-HL | reserved = R₀ (phục hồi) |

---

### TC-ATP-03: FEFO hiển thị (Lot + Expiry)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tab "Tồn kho" | Cột "Lô" và "Hạn sử dụng" có dữ liệu |
| 2 | Trong cùng SP cùng kho → nhiều dòng | Sắp xếp expiry_date ASC (FEFO) |

**Business Rules:** BR-WMS-01 — First Expired, First Out

---

## TC-DELIVERY: Giao hàng & ePOD

### TC-DELIVERY-01: Simulate delivery

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tạo đơn → Xác nhận qua Zalo | Status = confirmed |
| 2 | API: `POST /v1/test-portal/simulate-delivery` body: `{"order_id": "..."}` | |
| 3 | Tab "Đơn hàng" | Status → **delivered** |
| 4 | Tab "Xác nhận giao hàng" | Xuất hiện record ZaloConfirmation |

---

## TC-ZALO: Xác nhận giao hàng Zalo

### TC-ZALO-01: NPP xác nhận giao hàng OK

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Sau TC-DELIVERY-01 | Có 1 delivery confirmation, status = sent |
| 2 | Tab "Xác nhận giao hàng" | Hiện record với token, SĐT |
| 3 | Mở link: http://localhost:3000/confirm/{token} | Trang xác nhận giao hàng NPP |
| 4 | Nhấn "Xác nhận đã nhận hàng" | Toast: Xác nhận thành công |
| 5 | Tab "Xác nhận giao hàng" | Status → **confirmed** |

---

### TC-ZALO-02: NPP khiếu nại giao hàng

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tạo đơn → Xác nhận → Simulate delivery | delivery confirmation created |
| 2 | Mở link confirm/{token} | Trang xác nhận |
| 3 | Nhấn "Khiếu nại" → nhập "Thiếu 2 thùng" | |
| 4 | Tab "Xác nhận giao hàng" | Status = **disputed**, có dispute_reason |

---

### TC-ZALO-03: Auto-confirm giao hàng sau 24h

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Simulate delivery cho 1 đơn | delivery confirmation status = sent |
| 2 | Đợi 24h hoặc cron chạy | |
| 3 | Tab "Xác nhận giao hàng" | Status → **auto_confirmed** |

**Business Rules:** BR-REC-02 — 24h auto-confirm

---

## TC-E2E: Kịch bản End-to-End

### TC-E2E-01: Luồng đầy đủ — Đơn hàng → Giao hàng → Xác nhận

**Thời gian ước tính: 15 phút**

| Bước | Vai trò | Hành động | Kết quả |
|------|---------|-----------|---------|
| 1 | Reset | Nhấn "Reset Data" trên Test Portal | Clean state |
| 2 | ĐVKH | Test Portal → Tạo đơn: BG-1, WH-HL, BHL-LON-330 × 10 | Đơn SO-xxx pending_customer_confirm |
| 3 | NPP (KH) | Tab "Xác nhận đơn Zalo" → Nhấn ✅ Xác nhận | Đơn → confirmed |
| 4 | Kiểm tra | Tab "Dư nợ" | BG-1 available_limit giảm |
| 5 | Kiểm tra | Tab "Tồn kho" | reserved_qty = 10 cho BHL-LON-330 |
| 6 | Test | Simulate delivery cho đơn vừa tạo | Đơn → delivered |
| 7 | Kiểm tra | Tab "Xác nhận giao hàng" | Xuất hiện record sent |
| 8 | NPP | Mở link confirm/{token} → Xác nhận | Status → confirmed |

---

### TC-E2E-02: Luồng vượt credit → Kế toán duyệt → Xác nhận

| Bước | Vai trò | Hành động | Kết quả |
|------|---------|-----------|---------|
| 1 | Reset | Reset Data | |
| 2 | ĐVKH | Tạo nhiều đơn lớn cho NPP hạn mức thấp (HD-53, credit 384M) | Đơn cuối → pending_approval |
| 3 | Kiểm tra | Tab "Đơn hàng" | Đơn pending_approval, không có Zalo confirm |
| 4 | Kế toán | Dashboard → Login accountant01 → Approve | Đơn → pending_customer_confirm |
| 5 | NPP | Tab "Xác nhận đơn Zalo" → Xác nhận | Đơn → confirmed |

---

### TC-E2E-03: Luồng từ chối — KH reject qua Zalo

| Bước | Vai trò | Hành động | Kết quả |
|------|---------|-----------|---------|
| 1 | ĐVKH | Tạo đơn cho HD-59 (Phạm Văn Đức) | pending_customer_confirm |
| 2 | NPP | Tab "Xác nhận đơn Zalo" → ❌ Từ chối, lý do: "Đổi ý" | |
| 3 | Kiểm tra | Tab "Đơn hàng" → Đơn = cancelled | ✅ |
| 4 | Kiểm tra | Tab "Tồn kho" → reserved giảm | ✅ Stock released |
| 5 | Kiểm tra | Tab "Dư nợ" → không thay đổi | ✅ No debit |

---

## Bảng tóm tắt Business Rules được kiểm tra

| Test Case | Business Rules |
|-----------|----------------|
| TC-OMS-01 | BR-OMS-01, BR-OMS-02, BR-OMS-03 |
| TC-OMS-03 | BR-OMS-01 (ATP block) |
| TC-OMS-04 | BR-OMS-02 (Credit exceed) |
| TC-CONFIRM-01 | SM-01 (Customer confirm → confirmed) |
| TC-CONFIRM-02 | SM-01 (Customer reject → cancelled) |
| TC-CONFIRM-03 | SM-01 (Auto-confirm 2h) |
| TC-ATP-02 | BR-OMS-01 (Reserve/Release) |
| TC-ATP-03 | BR-WMS-01 (FEFO) |
| TC-ZALO-01 | BR-REC-02 (Delivery confirm) |
| TC-ZALO-03 | BR-REC-02 (24h auto-confirm) |
| TC-E2E-01 | Full OMS → TMS → Confirm flow |
| TC-E2E-02 | BR-OMS-02 + SM-01 (Credit path) |

---

*Cập nhật: Session 17 — Cập nhật NPP thực tế (218 NPP, 70 xe, 70 tài xế)*
