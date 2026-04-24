# TEST CASES — BHL OMS-TMS-WMS

> **Tổng hợp test cases cho UAT / Demo / QA**
> Sử dụng Test Portal: http://localhost:3001/test-portal (launcher) hoặc http://localhost:3000/test-portal (flow dev cũ)
> Hoặc API trực tiếp: http://localhost:8080/v1/test-portal/...

---

## 0. Gap Analysis Test Portal

Test Portal hiện có 12 scenario backend, 7 profile GPS và tab Ops & Audit mới. Tuy vậy vẫn chưa bao phủ toàn bộ app từ đầu đến cuối. Khi test thật, ưu tiên bổ sung hoặc dùng đúng nhóm case sau:

| Mã | Module | Cần thêm gì | Trạng thái hiện tại | Ghi chú dữ liệu |
|----|--------|-------------|---------------------|-----------------|
| TP-AUTH-01 | Auth | Login, refresh token, logout, session expiry | Chưa có tab riêng | Dùng tài khoản thật theo role |
| TP-AUTH-02 | RBAC | Role/permission matrix, session revoke | Chưa có tab riêng | Test admin + dispatcher + accountant |
| TP-OMS-01 | OMS | Split, consolidate, cancel, redelivery | Mới có tạo/xác nhận đơn | Dùng đơn có 2+ item và đơn vượt credit |
| TP-OMS-02 | OMS | Timeline & notes trên đơn | Đã có tab Ops & Audit + SC-12 | Kiểm tra `order.created`, `status_changed`, pinned note |
| TP-TMS-01 | TMS | Lập chuyến, assign xe/tài xế, VRP approve | Có scenario trip/VRP | Dùng đơn thật theo cụm tỉnh |
| TP-TMS-02 | Driver | Check-in, checklist, ePOD, payment, returns, complete | Có flow rời rạc | Nên test đủ 1 chuyến end-to-end |
| TP-WMS-01 | WMS | Picking FEFO, gate check, barcode scan | Có case gate check | Cần thêm barcode + picking by vehicle |
| TP-WMS-02 | WMS | Handover A/B/C, bottle classification, asset compensation | Chưa có scenario riêng | Dùng chuyến có vỏ/asset |
| TP-INT-01 | Integration | Bravo/DMS/Zalo/NPP portal/DLQ | Đã có tab Ops & Audit cho DLQ | Vẫn cần test thêm retry/resolve ngoài portal |
| TP-REC-01 | Reconciliation | Trip reconcile, discrepancy, daily close, export | Đã có tab Ops & Audit cho discrepancy + daily close | Export Excel vẫn test ở app chính |
| TP-KPI-01 | KPI | Issues, cancellations, redeliveries | Đã có tab Ops & Audit cho snapshot + counters | Nên test thêm lọc theo ngày/kho ở dashboard KPI |
| TP-ADMIN-01 | Admin | Health, sessions, permissions, routes, configs, credit limits | Đã có tab Ops & Audit cho smoke counters | Session revoke/permission edit vẫn test ở trang admin |
| TP-GPS-01 | GPS | Route thật từ kho + NPP, follow OSRM geometry | Có GPS sim nhưng phải dùng data thực | Cần actual warehouse/customer coords |
| TP-GPS-02 | GPS | Lost signal / idle / speed violation | Có profile | Dùng cùng route thật, đổi hành vi |

---

## 1. Dữ liệu test thực tế cần dùng

| Loại | Dữ liệu khuyến nghị | Mục đích |
|------|---------------------|----------|
| Kho | WH-HL: 20.9639000, 107.0895000 | KCN Cái Lân, Hạ Long |
| Kho | WH-HP: 20.8449000, 106.6881000 | KCN Đình Vũ, Hải Phòng |
| NPP khu gần kho | HP-38, HP-4745, HP-4747 | Route Hải Phòng thực tế |
| NPP khu QN | QY-120, QY-121, UB-90, HB-73 | Route Hạ Long / Quảng Yên / Uông Bí |
| NPP khu trung gian | HD-53, HD-74, BN-23, BN-27, HY-4752 | Route Hải Dương / Bắc Ninh / Hưng Yên |
| NPP xa hơn | TB-127, ND-109, LS-103 | Route dài và tải cao điểm |

Quy tắc test GPS: luôn lấy kho + NPP thực từ DB, dựng chuỗi điểm dừng theo cụm tỉnh, sau đó để OSRM sinh geometry đường đi. Không dùng toạ độ mẫu hard-code nếu DB đã có dữ liệu thật.

### Coverage update 21/04

| Kịch bản | Mục đích chính | Tab/Test Portal dùng kèm |
|----------|----------------|---------------------------|
| SC-10 | Tuyến giao thực theo dữ liệu ngày 13/06 | Kịch bản test + Giả lập GPS (`from_active_trips`) |
| SC-11 | Control Tower + GPS active trips | Kịch bản test + Giả lập GPS + Control Tower |
| SC-12 | Regression cho timeline, notes, DLQ, discrepancy, KPI | Kịch bản test + Ops & Audit |

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
