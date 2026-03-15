# 🍺 KỊCH BẢN DEMO BHL OMS-TMS-WMS

> **Ngày demo:** 14/03/2026  
> **URL:** http://localhost:3000  
> **Thời lượng:** ~30 phút  

---

## 📋 TỔNG QUAN DỮ LIỆU ĐÃ CÓ SẴN

Hệ thống đã có dữ liệu giả lập **1 tuần vận hành** (07/03 → 14/03):

| Loại | Số lượng | Chi tiết |
|------|----------|----------|
| Đơn hàng | 18 | 6 đã giao, 3 đang giao, 6 chờ lập KH, 2 chờ duyệt, 1 đã hủy |
| Shipments | 15 | 6 đã giao, 3 đang vận chuyển, 6 chờ xử lý |
| Chuyến xe | 4 | 3 hoàn thành, 1 đang giao |
| Sản phẩm | 15 | Bia lon/chai/két/thùng các loại |
| Khách hàng (NPP) | 15 | Quảng Ninh + Hải Phòng |
| Xe tải | 8 | 3.5T đến 15T |
| Tài xế | 8 | |

---

## 🔐 PHẦN 1: ĐĂNG NHẬP (2 phút)

### Bước 1.1: Mở trình duyệt
- Truy cập **http://localhost:3000**
- Hệ thống tự chuyển đến trang đăng nhập

### Bước 1.2: Đăng nhập với tài khoản Điều phối viên
- **Tên đăng nhập:** `dispatcher01`
- **Mật khẩu:** `demo123`
- Nhấn **"Đăng nhập"**

### ✅ Kết quả mong đợi:
- Chuyển đến trang Dashboard
- Sidebar hiển thị: **"Trần Văn Minh"** — Điều phối viên
- Có đầy đủ menu: Dashboard, Đơn hàng, Tạo đơn hàng, Lập kế hoạch, Chuyến xe

---

## 📊 PHẦN 2: XEM DASHBOARD (2 phút)

### Bước 2.1: Xem tổng quan
- Đang ở trang **Dashboard** (mặc định sau đăng nhập)

### ✅ Kết quả mong đợi:
- **Tổng đơn hàng:** 18
- **Shipments chờ:** 6 (đơn ngày 15/03 chờ lập kế hoạch)
- **Trips đang chạy:** 1 (chuyến TR-20260314-001 đang giao)
- **Sản phẩm:** 15
- **Khách hàng (NPP):** 15
- Có hướng dẫn Demo Flow bên dưới

### 💬 Giới thiệu cho khách:
> "Đây là tổng quan hệ thống. Có thể thấy chúng ta đang có 18 đơn hàng, 6 shipments đang chờ lập kế hoạch giao cho ngày mai, và 1 chuyến xe đang giao trên đường."

---

## 📋 PHẦN 3: QUẢN LÝ ĐƠN HÀNG (5 phút)

### Bước 3.1: Xem danh sách đơn hàng
- Nhấn menu **"Đơn hàng"** ở sidebar
- Mặc định hiển thị **tất cả** đơn hàng

### ✅ Kết quả mong đợi:
- Bảng hiển thị 18 đơn hàng
- Các trạng thái khác nhau: *Đã xác nhận* (xanh), *Chờ duyệt* (vàng), *Đã hủy* (đỏ)
- Cột: Số đơn, Khách hàng, Ngày giao, Tổng tiền, Trạng thái, Hành động

### Bước 3.2: Filter theo trạng thái
- Nhấn filter **"Chờ duyệt"**

### ✅ Kết quả mong đợi:
- Hiển thị 2 đơn chờ duyệt:
  - **SO-20260314-0002** — NPP Uông Bí - CTY Hoàng Long — 35.750.000đ
  - **SO-20260314-0003** — NPP Kiến An - Chị Thảo — 15.650.000đ

### 💬 Giới thiệu cho khách:
> "Hai đơn này vượt hạn mức công nợ, hệ thống tự động chuyển sang trạng thái 'Chờ duyệt' để kế toán xác nhận trước khi xử lý."

### Bước 3.3: Xem chi tiết đơn chờ duyệt
- Nhấn **"Chi tiết"** của đơn **SO-20260314-0002** (NPP Uông Bí)

### ✅ Kết quả mong đợi:
- Thông tin đơn hàng đầy đủ
- Danh sách 5 sản phẩm:
  - Bia Hạ Long Lon 330ml: 100 thùng × 185.000 = 18.500.000
  - Bia Hạ Long Gold Lon 330ml: 50 thùng × 225.000 = 11.250.000
  - Bia Hạ Long Premium Chai 330ml: 3 chai × 650.000 = 1.950.000
  - Bia Hạ Long Chai 330ml: 15 két × 205.000 = 3.075.000
  - Bia Hạ Long Fresh Lon 330ml: 8 thùng × 125.000 = 1.000.000
- Ghi chú: "Đơn hàng bổ sung cho event khai trương - cần duyệt công nợ"
- Nút **"✅ Duyệt đơn hàng"** và **"❌ Hủy đơn hàng"**

### Bước 3.4: Duyệt đơn hàng
- Nhấn nút **"✅ Duyệt đơn hàng"**

### ✅ Kết quả mong đợi:
- Trạng thái đổi thành **"confirmed"** (Đã xác nhận)
- Nút Duyệt biến mất

### 💬 Giới thiệu cho khách:
> "Kế toán có thể duyệt hoặc từ chối đơn vượt hạn mức. Sau khi duyệt, đơn chuyển sang trạng thái 'Đã xác nhận' và sẵn sàng cho bước lập kế hoạch giao hàng."

### Bước 3.5: Quay lại, xem đơn đã giao
- Nhấn **"← Quay lại"**
- Filter **"Tất cả"**
- Cuộn xuống xem các đơn trạng thái **delivered**

### 💬 Giới thiệu cho khách:
> "Hệ thống lưu trữ toàn bộ lịch sử đơn hàng. Tuần trước từ 07-12/03 đã giao thành công 6 đơn hàng với tổng trị giá hơn 176 triệu đồng."

---

## ➕ PHẦN 4: TẠO ĐƠN HÀNG MỚI + KIỂM TRA ATP (5 phút)

### Bước 4.1: Mở form tạo đơn
- Nhấn menu **"Tạo đơn hàng"** ở sidebar (hoặc nút "➕ Tạo đơn hàng mới" trên trang đơn hàng)

### Bước 4.2: Chọn thông tin cơ bản
- **Khách hàng:** Chọn **"NPP Bãi Cháy - Anh Tuấn"**
- **Kho xuất:** Mặc định là **"Kho Hạ Long"** (hoặc chọn nếu chưa chọn)
- **Ngày giao:** Để ngày mai **15/03/2026** (mặc định)

### ✅ Kết quả mong đợi khi chọn khách hàng:
- Hiển thị thông tin **Công nợ**:
  - Hạn mức: 300.000.000đ
  - Đang nợ: ~178.750.000đ (150tr cũ + 28.75tr đơn 10/03)
  - Còn lại: ~121.250.000đ

### 💬 Giới thiệu cho khách:
> "Ngay khi chọn khách hàng, hệ thống tự động hiển thị hạn mức công nợ và số dư hiện tại. Nếu đơn hàng mới vượt hạn mức, sẽ có cảnh báo."

### Bước 4.3: Thêm sản phẩm
- Nhấn **"➕ Thêm sản phẩm"**
- **Sản phẩm 1:** Chọn **"Bia Hạ Long Lon 330ml (thùng 24)"** → Số lượng: **50**
  - Đơn giá tự fill: 185.000đ → Thành tiền: 9.250.000đ
  - ATP hiển thị: ✅ Đủ hàng (tồn kho còn nhiều)
  
- Nhấn **"➕ Thêm sản phẩm"** thêm lần nữa
- **Sản phẩm 2:** Chọn **"Bia Hạ Long Gold Lon 330ml (thùng 24)"** → Số lượng: **20**
  - Đơn giá: 225.000đ → Thành tiền: 4.500.000đ

- Nhấn **"➕ Thêm sản phẩm"** thêm lần nữa  
- **Sản phẩm 3:** Chọn **"Bia Hạ Long Chai 330ml (két 20)"** → Số lượng: **10**
  - Đơn giá: 205.000đ → Thành tiền: 2.050.000đ

### ✅ Kết quả mong đợi:
- **Tổng cộng:** 15.800.000đ
- ATP tất cả sản phẩm: ✅ Đủ hàng
- Không có cảnh báo vượt hạn mức (15.8tr < 121tr còn lại)

### 💬 Giới thiệu cho khách:
> "Hệ thống kiểm tra ATP (Available-To-Promise) realtime. Mỗi khi chọn sản phẩm, hệ thống kiểm tra tồn kho có đủ cung cấp không, bao gồm cả số lượng đã reserve cho các đơn khác."

### Bước 4.4: Tạo đơn hàng
- Nhấn **"✅ Tạo đơn hàng"**

### ✅ Kết quả mong đợi:
- Thông báo thành công
- Chuyển sang trang chi tiết đơn vừa tạo
- Trạng thái: **"confirmed"** (Đã xác nhận) — vì không vượt hạn mức

### 💬 Giới thiệu cho khách:
> "Đơn hàng trong hạn mức được tự động confirm. Đơn vượt hạn mức sẽ chuyển 'Chờ duyệt' để kế toán kiểm tra — đảm bảo kiểm soát rủi ro."

---

## 🗺️ PHẦN 5: LẬP KẾ HOẠCH GIAO HÀNG VRP (8 phút) ⭐ HIGHLIGHT

### Bước 5.1: Mở trang lập kế hoạch
- Nhấn menu **"Lập kế hoạch"** ở sidebar

### Bước 5.2: Chọn tham số
- **Kho xuất:** Chọn **"Kho Hạ Long"** (hoặc đã mặc định)
- **Ngày giao:** **15/03/2026** (ngày mai, mặc định)
- Nhấn **"🔄 Tải lại"** nếu dữ liệu chưa hiện

### ✅ Kết quả mong đợi:
- **Shipments chờ:** 6-7 (6 đã có + 1 vừa tạo ở Bước 4)
- **Xe khả dụng:** 8
- **Tài xế:** 8
- Bảng **"Shipments chờ giao"** hiển thị danh sách shipments

### 💬 Giới thiệu cho khách:
> "Trang này tổng hợp tất cả shipments đang chờ giao cho ngày mai. Điều phối viên sẽ chạy thuật toán VRP để tối ưu tuyến đường giao hàng."

### Bước 5.3: Chạy VRP
- Nhấn nút **"🧠 Chạy tối ưu VRP (AI)"**
- Đợi 2-5 giây

### ✅ Kết quả mong đợi:
- Hiển thị kết quả VRP:
  - **Số chuyến:** 2-3 chuyến (tuỳ thuật toán)
  - **Tổng quãng đường** 
  - **Đã xếp:** 6-7 điểm
- Mỗi chuyến hiển thị:
  - Biển số xe, loại xe
  - Tổng km, tổng kg, số điểm giao
  - Danh sách điểm dừng theo thứ tự tối ưu
  - Dropdown **chọn tài xế** cho mỗi chuyến

### 💬 Giới thiệu cho khách:
> "Thuật toán VRP (Vehicle Routing Problem) tự động phân bổ các đơn hàng vào các xe, tối ưu tuyến đường sao cho tiết kiệm quãng đường nhất. Kết quả cho thấy chỉ cần 2-3 chuyến xe thay vì giao riêng lẻ."

### Bước 5.4: Phân công tài xế
- Chuyến 1: Chọn tài xế **"Phạm Văn Đức"** 
- Chuyến 2: Chọn tài xế **"Nguyễn Văn Hùng"**
- (Chuyến 3 nếu có: Chọn tài xế khác)

### Bước 5.5: Duyệt kế hoạch
- Nhấn nút **"✅ Duyệt kế hoạch & Tạo chuyến xe"**

### ✅ Kết quả mong đợi:
- Thông báo: "✅ Kế hoạch đã được duyệt! Các chuyến xe đã tạo thành công."
- Các trip mới được tạo trong hệ thống

### 💬 Giới thiệu cho khách:
> "Sau khi duyệt, hệ thống tự động tạo chuyến xe với lịch trình chi tiết. Tài xế sẽ nhận được thông tin chuyến ngay trên ứng dụng."

---

## 🚛 PHẦN 6: QUẢN LÝ CHUYẾN XE (5 phút)

### Bước 6.1: Xem danh sách chuyến xe
- Nhấn menu **"Chuyến xe"** ở sidebar

### ✅ Kết quả mong đợi:
- Hiển thị ~6-7 chuyến xe:
  - **TR-20260310-001** — completed — 2 điểm — 18.5 km
  - **TR-20260311-001** — completed — 2 điểm — 85.6 km  
  - **TR-20260312-001** — completed — 2 điểm — 45.2 km
  - **TR-20260314-001** — in_transit — 3 điểm — 22.5 km (đang giao hôm nay)
  - Các chuyến mới vừa tạo từ VRP — planned

### Bước 6.2: Filter chuyến đang giao
- Nhấn filter **"Đang giao"**

### ✅ Kết quả mong đợi:
- Hiển thị 1 chuyến: **TR-20260314-001**
  - Xe: 14C-34567
  - Tài xế: Phạm Văn Đức
  - 3 điểm giao, 22.5 km, 3094 kg

### 💬 Giới thiệu cho khách:
> "Chuyến xe đang giao hôm nay đi tuyến Hạ Long, giao cho 3 NPP: Bãi Cháy (đã giao xong), Hòn Gai (đang đến), và Hạ Long Center (chờ giao)."

### Bước 6.3: Xem chi tiết chuyến (với bản đồ)
- Nhấn **"Chi tiết →"** của chuyến **TR-20260314-001**

### ✅ Kết quả mong đợi:
- Thông tin chuyến: Xe 14C-34567, Tài xế Phạm Văn Đức, Kho Hạ Long
- **Bản đồ Leaflet** với:
  - 🏭 Marker kho xuất (Hạ Long)
  - 🔵 Marker 3 điểm giao theo thứ tự
  - Đường nối tuyến từ kho → điểm 1 → điểm 2 → điểm 3
- Bảng **Lịch trình điểm giao**:
  - Điểm 1: NPP Bãi Cháy — 870 kg — ✅ **delivered** 
  - Điểm 2: NPP Hòn Gai — 1564 kg — ⏳ **pending**
  - Điểm 3: NPP Hạ Long Center — 3094 kg — ⏳ **pending**

### 💬 Giới thiệu cho khách:
> "Chi tiết chuyến xe hiển thị bản đồ tuyến đường và trạng thái từng điểm giao. Điều phối viên có thể theo dõi realtime chuyến xe đang giao đến đâu."

### Bước 6.4: Xem chuyến đã hoàn thành
- Nhấn **"← Quay lại"**
- Filter **"Hoàn thành"**
- Nhấn chi tiết chuyến **TR-20260312-001** (Đông Triều – Quảng Yên)

### ✅ Kết quả mong đợi:
- 2 điểm giao, cả hai **delivered**
- Bản đồ hiển thị tuyến Đông Triều → Quảng Yên
- Tổng 45.2 km, 754 kg

---

## ➕ PHẦN 7 (TÙY CHỌN): DEMO KIỂM SOÁT CÔNG NỢ (3 phút)

### Bước 7.1: Tạo đơn vượt hạn mức
- Nhấn **"Tạo đơn hàng"**
- **Khách hàng:** Chọn **"NPP Uông Bí - CTY Hoàng Long"**
- Lưu ý: Khách hàng này đang nợ ~480/500 triệu (gần sát hạn mức)

### ✅ Kết quả mong đợi:
- Thông tin công nợ:
  - Hạn mức: 500.000.000đ
  - Đang nợ: ~532.000.000đ (đã vượt do đơn mới duyệt)
  - Còn lại: Âm → ⚠️ **Cảnh báo vượt hạn mức**

### Bước 7.2: Thêm sản phẩm
- Thêm **Bia Hạ Long Lon 330ml** × **50 thùng** (9.250.000đ)

### Bước 7.3: Tạo đơn
- Nhấn **"✅ Tạo đơn hàng"**

### ✅ Kết quả mong đợi:
- Đơn được tạo nhưng trạng thái **"pending_approval"** (Chờ duyệt)
- Hệ thống tự động gắn cờ vượt hạn mức

### 💬 Giới thiệu cho khách:
> "Khi NPP vượt hạn mức công nợ, hệ thống tự động chặn và yêu cầu kế toán duyệt. Điều này giúp kiểm soát rủi ro tài chính."

---

## 📌 TÀI KHOẢN DEMO

| Tài khoản | Mật khẩu | Vai trò | Quyền |
|-----------|----------|---------|-------|
| `admin` | `demo123` | Quản trị viên | Full access |
| `dispatcher01` | `demo123` | Điều phối viên | Tạo đơn, VRP, Trips |
| `dvkh01` | `demo123` | Dịch vụ KH | Tạo đơn, xem đơn |
| `accountant01` | `demo123` | Kế toán | Duyệt đơn, báo cáo |
| `driver01` | `demo123` | Tài xế | Xem trips |

---

## ⚠️ LƯU Ý KHI DEMO

1. **Token hết hạn sau 4 giờ.** Nếu bị lỗi "Token không hợp lệ", hệ thống sẽ tự refresh. Nếu vẫn lỗi, đăng nhập lại.

2. **Luôn chọn Kho ở trang VRP.** Trang lập kế hoạch cần chọn kho trước khi hiển thị dữ liệu.

3. **Ngày giao VRP = ngày mai (15/03).** Các shipments pending đã được gán ngày 15/03. Nếu đổi ngày, sẽ không thấy dữ liệu.

4. **Thứ tự demo khuyến nghị:** Dashboard → Đơn hàng (xem/duyệt) → Tạo đơn mới → VRP → Chuyến xe

5. **Nếu VRP không có shipments:** Kiểm tra lại đã chọn đúng kho "Kho Hạ Long" và ngày 15/03/2026.
