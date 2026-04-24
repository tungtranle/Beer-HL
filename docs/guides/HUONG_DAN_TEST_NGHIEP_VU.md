# HƯỚNG DẪN TEST NGHIỆP VỤ — BHL OMS

> **Mục đích:** Hướng dẫn từng bước test các luồng nghiệp vụ chính.
> Tạo đơn trên app chính (localhost:3000/dashboard), quan sát kết quả trên Test Portal (localhost:3001/test-portal với launcher, hoặc localhost:3000/test-portal trong flow dev cũ).

---

## Mục lục

1. [Chuẩn bị môi trường](#1-chuẩn-bị-môi-trường)
2. [Kịch bản 1: Tạo đơn → KH xác nhận (Happy Path)](#2-kịch-bản-1-tạo-đơn--kh-xác-nhận-happy-path)
3. [Kịch bản 2: Tạo đơn → KH từ chối](#3-kịch-bản-2-tạo-đơn--kh-từ-chối)
4. [Kịch bản 3: Đơn vượt hạn mức tín dụng](#4-kịch-bản-3-đơn-vượt-hạn-mức-tín-dụng)
5. [Kịch bản 4: Kiểm tra tồn kho ATP](#5-kịch-bản-4-kiểm-tra-tồn-kho-atp)
6. [Giải thích dữ liệu test](#6-giải-thích-dữ-liệu-test)

---

## 1. Chuẩn bị môi trường

### Bước 1.1 — Khởi động hệ thống

Đảm bảo các service đang chạy:
- PostgreSQL: port 5434 đã LISTEN
- Redis: port 6379 đã LISTEN
- VRP Solver: port 8090 đã LISTEN
- Cách an toàn cho máy này: double-click `bhl-oms/START_TEST_PORTAL.bat` từ File Explorer để bật backend `:8080` và frontend `:3001`
- Nếu chạy thủ công, chỉ bật Go backend và Next.js frontend; tránh chạy lệnh Docker lifecycle trong terminal VS Code của máy này

### Bước 1.2 — Reset & seed dữ liệu sạch

**Bắt buộc chạy trước khi test lần đầu.** Script này sẽ:
- Xóa TOÀN BỘ dữ liệu giao dịch cũ (đơn hàng, trips, xác nhận...)
- Giữ nguyên master data (NPP, sản phẩm, kho, xe, tài xế)
- Tạo tồn kho mới cho TẤT CẢ 30 sản phẩm tại cả 2 kho (WH-HL + WH-HP)
- Tạo dư nợ thực tế cho 6 NPP test chính

```powershell
cd bhl-oms
docker cp ./migrations/seed_test_ready.sql bhl-oms-postgres-1:/tmp/
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/seed_test_ready.sql
```

**Kết quả mong đợi:** Bảng kiểm tra hiển thị:
- products: 30
- customers: **218** (dữ liệu thực)
- lots: 35 (30 lô chính + 5 lô gần hạn)
- stock_quants (WH-HL): ~35 records
- stock_quants (WH-HP): ~12 records
- receivable_ledger: 6 (dư nợ ban đầu)
- sales_orders: 0 (sạch, chưa có đơn)

### Bước 1.3 — Mở 2 tab trình duyệt

| Tab | URL | Mục đích |
|-----|-----|----------|
| **Tab 1** | http://localhost:3000/dashboard | App chính — đăng nhập user, tạo đơn |
| **Tab 2** | http://localhost:3001/test-portal | Test Portal — quan sát kết quả |

### Bước 1.4 — Kiểm tra dữ liệu trên Test Portal

Trước khi test, mở Test Portal và kiểm tra:

1. **Tab "Tồn kho / ATP"** → Phải thấy kho Hạ Long ~35 dòng, kho Hải Phòng ~12 dòng, và **Khách hàng (NPP): 218** (15 tỉnh thành, dữ liệu thực từ file danh sách NPP).
2. **Cột "Đã đặt"** phải bằng 0 ở toàn bộ dòng tồn kho.
3. **GPS simulator** → Khi test ở tab Giả lập GPS hoặc Control Tower, luôn chọn route sinh từ kho/NPP thực trong DB. Tuyến chuẩn phải đi qua toạ độ thật của WH-HL / WH-HP và cụm NPP theo tỉnh, không dùng waypoint mẫu nếu dữ liệu DB đã có.
4. **Ops & Audit** → Nếu cần kiểm tra timeline, note ghim, DLQ, discrepancy, daily close hoặc KPI snapshot, dùng tab **Ops & Audit** thay vì đi từng màn hình rời.
5. **Tab "Dư nợ / Tín dụng"** → Phải thấy NPP-003 khả dụng ~20,000,000đ, NPP-009 khả dụng ~10,000,000đ, NPP-001 khả dụng ~150,000,000đ.
6. **Tab "Đơn hàng"** → Phải trống (chưa có đơn).

---

## 2. Kịch bản 1: Tạo đơn → KH xác nhận (Happy Path)

> **Mục tiêu:** Tạo đơn hàng qua app chính, KH xác nhận qua Test Portal, kiểm tra tồn kho & dư nợ thay đổi.

### Bước 2.1 — Đăng nhập ĐVKH trên app chính

1. Mở **Tab 1** (http://localhost:3000/dashboard)
2. Đăng nhập: `dvkh01` / `demo123`
3. Sidebar trái → **Tạo đơn hàng**

### Bước 2.2 — Tạo đơn hàng

1. Chọn khách hàng: **NPP-001 (NGUYỄN DUY ANH, Quảng Ninh)**
   - Hệ thống hiển thị: Hạn mức 584,000,000đ, Khả dụng ~150,000,000đ
2. Chọn kho: **Kho Hạ Long (WH-HL)**
3. Thêm sản phẩm:
   - **BHL-LON-330** (Bia Hạ Long Lon 330ml) × **20 thùng** = 3,700,000đ
   - **BHL-GOLD-330** (Bia HĐ Long Gold 330ml) × **10 thùng** = 2,250,000đ
4. Tổng cộng: **~5,950,000đ** (trong hạn mức → OK)
5. Nhấn **Tạo đơn**

**Kết quả:** Đơn SO-{ngày}-XXXX được tạo, status = `pending_customer_confirm`

### Bước 2.3 — Quan sát trên Test Portal

Chuyển sang **Tab 2** (Test Portal), nhấn **🔄 Refresh**:

1. **Tab "Đơn hàng":**
   - Đơn mới xuất hiện, trạng thái **"Chờ KH xác nhận"** (vàng)
   - Cột "Xác nhận KH" = **"Chờ xác nhận"** (vàng)

2. **Tab "Xác nhận đơn Zalo":**
   - 1 record mới, status = **sent**
   - Hiện SĐT khách hàng, thời gian hết hạn (2 giờ)
   - Có 2 nút: **✅ Xác nhận** và **❌ Từ chối**

3. **Tab "Tồn kho / ATP":**
   - BHL-LON-330: cột "Đã đặt" = **20** (từ 0 → 20)
   - BHL-GOLD-330: cột "Đã đặt" = **10** (từ 0 → 10)
   - "Khả dụng" giảm tương ứng

4. **Tab "Dư nợ":**
   - NPP-001 chưa thay đổi (debit chưa tạo, chờ xác nhận)

### Bước 2.4 — Xác nhận đơn hàng (vai khách hàng)

Trên Test Portal → **Tab "Xác nhận đơn Zalo":**

1. Nhấn nút **"✅ Xác nhận đơn hàng (vai KH)"**
2. Toast hiện: **"Đơn hàng đã xác nhận!"**

### Bước 2.5 — Kiểm tra kết quả

Nhấn **🔄 Refresh** và kiểm tra:

1. **Tab "Đơn hàng":**
   - Status → **"Đã xác nhận"** (xanh)

2. **Tab "Xác nhận đơn Zalo":**
   - Status = **confirmed**, có confirmed_at

3. **Tab "Dư nợ":**
   - NPP-001: Dư nợ **tăng** ~5,950,000đ (debit entry đã tạo)
   - Khả dụng **giảm** tương ứng

4. **Tab "Tồn kho":**
   - Reserved vẫn = 20/10 (hàng chưa xuất đi)

---

## 3. Kịch bản 2: Tạo đơn → KH từ chối

> **Mục tiêu:** Tạo đơn → KH từ chối qua Zalo → stock được hoàn lại, không tạo nợ.

### Bước 3.1 — Tạo đơn hàng mới

1. **Tab 1** (App chính) → Tạo đơn hàng:
   - Khách: **HP-4745 (Hoàng Sĩ Hậu, Hải Phòng)**
   - Kho: **WH-HL**
   - SP: **BHL-LON-500** × **15 thùng** = 3,675,000đ
2. Tạo đơn → status = `pending_customer_confirm`

### Bước 3.2 — Ghi nhận tồn kho trước từ chối

Test Portal → **Tab "Tồn kho":**
- BHL-LON-500: "Đã đặt" = **15** (hoặc +15 so với trước)

### Bước 3.3 — KH từ chối đơn

Test Portal → **Tab "Xác nhận đơn Zalo":**
2. Tìm đơn của HP-4745
2. Nhấn **"❌ Từ chối đơn hàng (vai KH)"**
3. Nhập lý do: **"Giá cao quá, đợi đợt khuyến mãi"**
4. Confirm

### Bước 3.4 — Kiểm tra kết quả

1. **Tab "Đơn hàng":** Status → **"Đã hủy"** (đỏ)
2. **Tab "Xác nhận đơn Zalo":** Status = **rejected**, lý do hiển thị
3. **Tab "Tồn kho":** BHL-LON-500 "Đã đặt" → **giảm 15** (stock hoàn lại)
4. **Tab "Dư nợ":** HP-4745 **không thay đổi** (không tạo debit)

---

## 4. Kịch bản 3: Đơn vượt hạn mức tín dụng

> **Mục tiêu:** Tạo đơn lớn vượt hạn mức → đơn chuyển pending_approval → Kế toán duyệt.

### Bước 4.1 — Kiểm tra credit NPP-003

Test Portal → **Tab "Dư nợ":**
- TB-127 (Nguyễn Quốc Trình, Thái Bình): Hạn mức 434tr, Dư nợ 414tr → **Khả dụng chỉ ~20tr**

### Bước 4.2 — Tạo đơn vượt hạn mức

1. **Tab 1** (App chính) → Tạo đơn:
   - Khách: **TB-127 (Nguyễn Quốc Trình, Thái Bình)**
   - Kho: **WH-HL**
   - SP: **BHL-LON-330** × **200 thùng** = ~37,000,000đ (vượt khả dụng 20tr)
2. Tạo đơn → status = **`pending_approval`** (chờ kế toán duyệt)

### Bước 4.3 — Kiểm tra

Test Portal → Refresh:

1. **Tab "Đơn hàng":** Status = **"Chờ duyệt credit"** (cam)
2. **Tab "Xác nhận đơn Zalo":** **KHÔNG có record** mới (chưa gửi Zalo vì chờ duyệt)
3. **Tab "Tồn kho":** "Đã đặt" vẫn tăng 200 (stock đã reserve)

### Bước 4.4 — Kế toán duyệt đơn

1. **Tab 1** — Logout ĐVKH, đăng nhập lại: `accountant01` / `demo123`
2. Sidebar → **Duyệt đơn hàng** (hoặc Đơn hàng → lọc "Chờ duyệt")
3. Tìm đơn TB-127 → **Duyệt**

### Bước 4.5 — Kiểm tra sau duyệt

Test Portal → Refresh:

1. **Tab "Đơn hàng":** Status → **"Chờ KH xác nhận"** (vàng)
   - Lý do: Kế toán duyệt → hệ thống gửi Zalo cho KH xác nhận
2. **Tab "Xác nhận đơn Zalo":** **Xuất hiện record mới** (status = sent)
3. Tiếp tục xác nhận như Kịch bản 1

---

## 5. Kịch bản 4: Kiểm tra tồn kho ATP

> **Mục tiêu:** Xem ATP thay đổi realtime khi tạo/hủy đơn. Kiểm tra FEFO.

### Bước 5.1 — Xem tồn kho ban đầu

Test Portal → **Tab "Tồn kho / ATP":**
- Chú ý BHL-LON-330 có **2 lô**:
  - Lô L20260215-001: HSD 15/04/2026 (**sắp hết hạn** → FEFO pick trước)
  - Lô L20260301-001: HSD 01/03/2027 (còn dài hạn)
- Tổng available = cộng cả 2 lô

### Bước 5.2 — Tạo đơn, quan sát reserved tăng

1. Tạo 1 đơn BHL-LON-330 × 50 thùng
2. Test Portal → "Tồn kho": "Đã đặt" tăng 50, "Khả dụng" giảm 50

### Bước 5.3 — Từ chối đơn, quan sát reserved giảm

1. Tab "Xác nhận đơn Zalo" → Từ chối đơn vừa tạo
2. Test Portal → "Tồn kho": "Đã đặt" giảm 50, "Khả dụng" tăng 50

---

## 6. Giải thích dữ liệu test

### NPP được chuẩn bị sẵn cho test

| NPP | Hạn mức | Dư nợ | Khả dụng | Dùng để test |
|-----|---------|-------|----------|--------------|
| **NPP-001** (NGUYỄN DUY ANH) | 584tr | 434tr | 150tr | Happy path — đủ credit |
| **HP-4745** (Hoàng Sĩ Hậu) | 634tr | 434tr | 200tr | Happy path — đủ credit |
| **TB-127** (Nguyễn Quốc Trình) | 434tr | 414tr | **20tr** | Test vượt credit |
| **HD-59** (Phạm Văn Đức) | 384tr | 374tr | **10tr** | Test vượt credit nhanh |
| **BG-1** (Hải Hồng) | 584tr | 84tr | 500tr | Nhiều credit |
| **NPP-063** (Nguyễn Ngọc Lâm) | 584tr | 284tr | 300tr | NPP lớn |

### Sản phẩm bán chạy (dùng cho test)

| SKU | Tên | Giá/thùng | Tồn WH-HL | Tồn WH-HP |
|-----|-----|-----------|-----------|-----------|
| BHL-LON-330 | Bia HĐ Lon 330ml (24 lon) | 185,000đ | 3,200 | 1,500 |
| BHL-LON-500 | Bia HĐ Lon 500ml (24 lon) | 245,000đ | 2,100 | 800 |
| BHL-GOLD-330 | Bia HĐ Gold 330ml (24 lon) | 225,000đ | 1,250 | 500 |
| BHL-CHAI-450 | Bia HĐ Chai 450ml (két 20) | 195,000đ | 1,580 | 800 |
| NGK-CHANH-330 | Nước Chanh 330ml (24 lon) | 125,000đ | 1,350 | 500 |

### Tài khoản đăng nhập

| User | Pass | Vai trò | Dùng khi nào |
|------|------|---------|--------------|
| dvkh01 | demo123 | ĐVKH (Sales) | Tạo đơn hàng |
| accountant01 | demo123 | Kế toán | Duyệt đơn vượt credit |
| dispatcher01 | demo123 | Điều phối | Lập kế hoạch giao hàng |
| driver01 | demo123 | Tài xế | Giao hàng, ePOD |
| admin | demo123 | Admin | Xem tất cả |

### Reset giữa các kịch bản (nếu cần)

Nếu muốn test sạch từ đầu giữa các kịch bản:

**Cách 1 — Quick reset (trên Test Portal):**
- Nhấn nút **🗑️ Reset Data** trên Test Portal
- Xóa đơn hàng + dư nợ, giữ tồn kho
- ⚠️ reserved_qty sẽ reset về 0 nhưng dư nợ cũng bị xóa

**Cách 2 — Full reset (SQL):**
```powershell
docker cp ./migrations/seed_test_ready.sql bhl-oms-postgres-1:/tmp/
docker exec bhl-oms-postgres-1 psql -U bhl -d bhl_dev -f /tmp/seed_test_ready.sql
```
- Xóa sạch + seed lại: tồn kho đầy đủ, dư nợ ban đầu, stock reserved = 0

---

*Cập nhật: Session 16*
