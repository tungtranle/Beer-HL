# BHL OMS-TMS-WMS — Hướng Dẫn Sản Phẩm Toàn Diện

> **Phiên bản:** 1.0 | **Ngày:** 01/05/2026 | **Trạng thái:** Production-ready
>
> Tài liệu này dành cho **tất cả người dùng** — từ quản lý cấp cao đến nhân viên vận hành hàng ngày.
> Được thiết kế theo chuẩn world-class: tìm thấy câu trả lời trong **< 30 giây**.

---

## Mục Lục Nhanh

| Tôi là... | Đọc phần... |
|-----------|-------------|
| Lần đầu nghe về sản phẩm | [Phần 1: Giới Thiệu Sản Phẩm](#phan-1) |
| DVKH — cần tiếp nhận đơn | [Hướng Dẫn DVKH](#role-dvkh) |
| Điều phối — lập kế hoạch xe | [Hướng Dẫn Điều Phối](#role-dispatcher) |
| Tài xế — dùng app giao hàng | [Hướng Dẫn Tài Xế](#role-driver) |
| Thủ kho — xuất/nhập hàng | [Hướng Dẫn Thủ Kho](#role-warehouse) |
| Kế toán — đối soát | [Hướng Dẫn Kế Toán](#role-accountant) |
| Quản lý — xem báo cáo | [Hướng Dẫn Quản Lý](#role-management) |
| Admin — cấu hình hệ thống | [Hướng Dẫn Admin](#role-admin) |
| Muốn dùng tính năng AI | [Hướng Dẫn AI](#ai-guide) |
| Gặp lỗi / cần tra cứu nhanh | [FAQ & Xử Lý Sự Cố](#faq) |

---

<a name="phan-1"></a>
# Phần 1: Giới Thiệu Sản Phẩm

## Đây Là Gì?

**BHL OMS-TMS-WMS** là hệ thống vận hành tích hợp của **Công ty Cổ phần Bia và Nước giải khát Hạ Long (BHL)** — thay thế toàn bộ quy trình thủ công trên Excel và Zalo từng chiếm 1–3 giờ mỗi ngày của đội ngũ vận hành.

Hệ thống bao gồm **3 phân hệ liên kết chặt chẽ**:

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   OMS (Quản lý Đơn hàng)   →   TMS (Quản lý Vận tải)          │
│   Tiếp nhận, xác nhận,         Lập tuyến tự động (AI/VRP),     │
│   ATP, hạn mức công nợ         Phân công xe/tài xế, Giám sát   │
│             ↓                              ↓                   │
│             └──────────────────────────────┘                   │
│                              ↓                                 │
│                   WMS (Quản lý Kho)                            │
│                   Xuất hàng FEFO, Kiểm cổng,                   │
│                   Nhập vỏ, Đối soát, Pallet/Bin                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Tại Sao Được Xây Dựng?

Trước đây, BHL phải đối mặt với 5 điểm nghẽn lớn:

| Vấn đề cũ (Excel/Zalo) | Giải pháp mới |
|------------------------|---------------|
| Lập kế hoạch xe mất 1–3 giờ/ngày | AI tự tính tuyến tối ưu trong **< 20 phút** |
| Xe chạy rỗng chiều về | Ghép đơn thông minh, tỷ lệ xe rỗng < 5% |
| Không biết xe đang ở đâu | GPS real-time, bản đồ live |
| Sai lệch hàng/vỏ không kiểm soát được | Kiểm cổng số hóa, sai lệch = 0 |
| Công nợ không rõ ràng | Công nợ NPP real-time, cảnh báo tự động |

## Quy Mô Hệ Thống

| Thông số | Giá trị |
|----------|---------|
| Nhà máy | 2 (Hạ Long + Đông Mai) |
| Đơn hàng xử lý/ngày | ~1.000 đơn |
| Khách hàng/NPP | ~800 |
| Đội xe | ~70 đầu (2.5T – 16T) |
| Sản lượng | 10–15 triệu lít/tháng |
| Người dùng đồng thời (peak) | ~180 người |

## Điểm Nổi Bật

### Tự Động Hóa Bằng AI (VRP Solver)
Hệ thống sử dụng thuật toán **Vehicle Routing Problem (OR-Tools của Google)** để tự động:
- Phân bổ đơn hàng vào chuyến xe tối ưu
- Chọn tuyến ngắn nhất theo bản đồ thực tế (OSRM)
- So sánh phương án tối ưu chi phí vs tối ưu thời gian
- Ước tính phí BOT, phí nhiên liệu trước khi duyệt

### Minh Bạch Từ Kho Đến Khách
Mọi hành động đều được ghi lại với timestamp, actor, và lý do. Từ khi đơn được tạo đến khi tiền được nộp về kho, không có "khoảng chết" thông tin.

### Không Chấp Nhận Sai Lệch
- **R01**: Sai lệch hàng tại cổng = 0 (bắt buộc khớp 100%)
- **R02**: Sai lệch vỏ theo chuyến = 0 (tài xế chịu trách nhiệm)

### Bằng Chứng Giao Hàng Điện Tử (ePOD)
Tài xế chụp ảnh, ký số, ghi nhận thanh toán trực tiếp trên app — không cần giấy tờ.

---

<a name="phan-2"></a>
# Phần 2: Bắt Đầu Nhanh (5 Phút)

## Truy Cập Hệ Thống

| Môi trường | URL | Dành cho |
|------------|-----|----------|
| Production (Internet) | https://bhl.symper.us | Tất cả người dùng |
| Nội bộ (LAN) | http://[IP]:3000 | Khi cần truy cập offline |

## Đăng Nhập

1. Mở trình duyệt, vào **https://bhl.symper.us**
2. Nhập **Tên đăng nhập** và **Mật khẩu** do Admin cấp
3. Bấm **Đăng nhập**

> **Mật khẩu mặc định lần đầu:** `demo123`
> Admin có thể reset mật khẩu tại Settings > Users.

> **Quên mật khẩu?** Liên hệ Admin hệ thống.

## Giao Diện Chính

```
┌────────────────────────────────────────────────────┐
│  [Logo BHL]   BHL OMS-TMS-WMS     [Chuông] [Tên]  │  ← Header
├────┬───────────────────────────────────────────────┤
│    │                                               │
│ S  │  Dashboard / Trang hiện tại                  │
│ i  │                                               │
│ d  │  ┌─ Breadcrumb ──────────────────────────┐   │
│ e  │  │  Dashboard > Đơn hàng > ĐH-00123      │   │
│ b  │  └───────────────────────────────────────┘   │
│ a  │                                               │
│ r  │  [Nội dung chính]                            │
└────┴───────────────────────────────────────────────┘
```

**Menu sidebar** hiển thị theo quyền của bạn — bạn chỉ thấy những gì mình có quyền dùng.

---

<a name="role-dvkh"></a>
# Hướng Dẫn DVKH (Dịch Vụ Khách Hàng)

## Công Việc Hàng Ngày

Bạn là người **tiếp nhận đơn hàng từ khách/NPP** và đảm bảo đơn đi đúng luồng trước khi chuyển cho điều phối.

### Luồng Cơ Bản

```
Khách gọi/nhắn →  Tạo đơn  →  Hệ thống kiểm tra ATP + Công nợ
                               ↓
              Đơn "Đã xác nhận" ← Ổn ─── hoặc ─── Cần duyệt (vượt hạn mức)
```

---

## Tạo Đơn Hàng Mới

**Điều kiện:** Khách hàng gọi đặt hàng trước **16:00** hôm nay.

**Các bước:**

1. Vào menu **Đơn hàng** > **Tạo đơn mới**
2. Chọn **Khách hàng** — gõ tên/mã để tìm kiếm
3. Chọn **Ngày giao hàng** (mặc định: ngày mai)
4. Thêm **Sản phẩm**:
   - Gõ tên/SKU → chọn sản phẩm
   - Nhập số lượng
   - Bấm "Thêm dòng" nếu cần nhiều sản phẩm
5. Kiểm tra **Tổng tiền** và **Ghi chú** nếu có
6. Bấm **Lưu đơn**

> **Hệ thống tự động kiểm tra:**
> - **ATP (Available to Promise):** Có đủ hàng trong kho không?
> - **Hạn mức công nợ:** Khách có đang nợ quá hạn mức không?
>
> Nếu một trong hai vượt ngưỡng → Đơn chuyển sang **"Chờ duyệt"**, cần Dispatcher/Quản lý phê duyệt.

---

## Theo Dõi Đơn Hàng

### Tìm Kiếm Đơn

| Trường tìm | Cách dùng |
|------------|-----------|
| Mã đơn | Nhập trực tiếp (ĐH-00123) |
| Tên khách hàng | Gõ vài ký tự |
| Ngày | Chọn khoảng: Hôm nay / 7 ngày / Tháng này |
| Trạng thái | Lọc theo: Chờ xác nhận / Đã xác nhận / Đang giao / ... |

### Trạng Thái Đơn Hàng

```
Nháp → Chờ xác nhận KH → Đã xác nhận → Đang vận chuyển → Đã giao
                                ↓
                       [Chờ duyệt nếu vượt hạn mức]
                                ↓
                     Giao thất bại → Giao bổ sung (không giới hạn lần)
```

| Trạng thái | Ý nghĩa | Việc cần làm |
|------------|---------|--------------|
| Nháp | Mới tạo, chưa gửi | Kiểm tra lại rồi xác nhận |
| Chờ xác nhận KH | Đã gửi Zalo cho khách | Chờ khách bấm xác nhận (≤2 giờ) |
| Đã xác nhận | Sẵn sàng đưa vào kế hoạch | Không cần làm gì |
| Chờ duyệt | Vượt ATP hoặc hạn mức | Báo Dispatcher/Quản lý duyệt |
| Đang vận chuyển | Xe đã xuất cổng | Theo dõi trên bản đồ |
| Đã giao | Hoàn tất | Lưu chứng từ |
| Giao thất bại | Xe không giao được | Tạo "Giao bổ sung" nếu cần |

---

## Giao Bổ Sung (Khi Giao Thất Bại)

Khi đơn ở trạng thái **"Giao thất bại"** hoặc **"Giao một phần"**:

1. Mở chi tiết đơn hàng
2. Bấm nút **"Giao bổ sung"**
3. Xác nhận số lượng cần giao lại
4. Hệ thống tự tạo chuyến mới, đơn quay về **"Đã xác nhận"**

> Có thể giao bổ sung **không giới hạn số lần**. Mỗi lần đều được ghi lịch sử đầy đủ.

---

## Xuất Danh Sách Đơn Hàng

1. Vào **Đơn hàng** > chọn bộ lọc thời gian mong muốn
2. Bấm **Xuất Excel** (góc trên phải)
3. File Excel tải về với đầy đủ thông tin

---

<a name="role-dispatcher"></a>
# Hướng Dẫn Điều Phối (Dispatcher)

## Công Việc Hàng Ngày

Bạn là người **lập kế hoạch vận chuyển** — phân công xe, tài xế, tuyến đường cho từng ngày. Đây là vai trò được AI hỗ trợ nhiều nhất.

### Luồng Hàng Ngày

```
8:00 — Kiểm tra đơn đã xác nhận ngày mai
  ↓
8:10 — Bấm "Tạo kế hoạch VRP" → AI tính tuyến (~2 phút)
  ↓
8:15 — Xem phương án AI đề xuất: So sánh Chi phí vs Thời gian
  ↓
8:20 — Điều chỉnh nếu cần → Phê duyệt kế hoạch
  ↓
Kho nhận lệnh xuất hàng | Tài xế nhận chuyến trên app
```

---

## Lập Kế Hoạch VRP (Tự Động Bằng AI)

> **VRP = Vehicle Routing Problem** — Thuật toán Google OR-Tools tính tuyến tối ưu cho toàn bộ đội xe.

**Các bước:**

1. Vào **Vận chuyển** > **Kế hoạch VRP**
2. Chọn **Ngày giao** (thường là ngày mai)
3. Chọn **Kho xuất hàng** (Hạ Long / Đông Mai)
4. Chọn mục tiêu tối ưu:
   - **Tối ưu chi phí** — ít km nhất, ít nhiên liệu nhất
   - **Tối ưu thời gian** — giao nhanh nhất, khung giờ tốt nhất
5. Bấm **Tạo kế hoạch**
6. Chờ khoảng **1–3 phút** (AI đang tính)

### Đọc Kết Quả VRP

Sau khi AI tính xong, bạn thấy:

```
┌─────────────────────────────────────────────────────┐
│  Phương án A (Chi phí tối ưu)  │  Phương án B (Thời gian tối ưu)  │
├─────────────────────────────────────────────────────┤
│  12 chuyến xe                   │  14 chuyến xe                   │
│  Tổng km: 1.240 km              │  Tổng km: 1.350 km              │
│  Chi phí ước tính: 8.5 triệu   │  Chi phí ước tính: 9.2 triệu   │
│  Phí BOT: 1.2 triệu             │  Phí BOT: 1.4 triệu             │
│  OTD rate dự kiến: 94%          │  OTD rate dự kiến: 97%          │
└─────────────────────────────────────────────────────┘
```

> **Mẹo AI:** Nếu ngày hôm đó có nhiều đơn gấp, chọn phương án Thời gian tối ưu. Ngày thường chọn Chi phí để tiết kiệm.

### Điều Chỉnh Kế Hoạch

Nếu AI phân công sai (ví dụ: xe quá tải, tài xế nghỉ phép):
1. Bấm vào chuyến cần chỉnh
2. Kéo-thả đơn hàng sang chuyến khác
3. Thay đổi xe/tài xế bằng dropdown
4. AI tự cập nhật lại tổng chi phí + OTD dự kiến

### Phê Duyệt Kế Hoạch

Khi đã hài lòng:
1. Bấm **Phê duyệt kế hoạch**
2. Hệ thống tự gửi lệnh cho kho và tài xế
3. Bạn thấy màn hình xác nhận "Kế hoạch đã được gửi"

---

## Giám Sát Real-Time (Control Tower)

Vào **Vận chuyển** > **Bản đồ** để xem:
- Vị trí GPS của tất cả xe đang chạy
- Màu sắc điểm giao: Xanh = đã giao, Vàng = đang giao, Đỏ = thất bại
- Cảnh báo xe trễ giờ cam kết

### Xem Chi Tiết Chuyến

Bấm vào biểu tượng xe trên bản đồ → Xem:
- Tài xế: tên, số điện thoại
- Các điểm đã giao / còn lại
- Thời gian ước tính đến điểm tiếp theo

---

## Quản Lý Xe và Tài Xế

### Kiểm Tra Trạng Thái Xe

Vào **Vận chuyển** > **Đội xe**:
- Xe sẵn sàng: Màu xanh
- Đang chạy: Màu vàng
- Bảo dưỡng / Hỏng: Màu đỏ
- Hết hạn giấy tờ (đăng kiểm, bảo hiểm): Cảnh báo cam

### Giấy Tờ Xe Sắp Hết Hạn

Hệ thống tự động cảnh báo khi:
- Đăng kiểm còn < 30 ngày
- Bảo hiểm còn < 30 ngày
- Giấy phép lái xe của tài xế còn < 60 ngày

Vào **Xe** > **Giấy tờ hết hạn** để xem danh sách cần gia hạn.

---

<a name="role-driver"></a>
# Hướng Dẫn Tài Xế (Driver App)

## Cài Đặt App

> App tài xế là **Progressive Web App (PWA)** — không cần cài từ App Store.
>
> Trên điện thoại, mở Chrome/Safari → vào https://bhl.symper.us/driver → bấm "Thêm vào màn hình chính"

## Luồng Làm Việc Hàng Ngày

```
[Buổi sáng]
1. Mở app → Đăng nhập
2. Check-in tại kho (bấm "Check-in" khi đến kho)
3. Xem chuyến được phân công
4. Làm checklist kiểm tra xe (phanh, đèn, lốp...)

[Trước khi chạy]
5. Ký biên bản bàn giao hàng (cùng thủ kho)
6. Qua kiểm tra cổng (bảo vệ xác nhận hàng khớp)
7. Bấm "Bắt đầu chuyến"

[Tại điểm giao]
8. Bấm "Đến nơi" khi tới địa chỉ
9. Bấm "Đang giao" khi bắt đầu hạ hàng
10. HẠ HÀNG TRƯỚC
11. Chụp ảnh ePOD (bắt buộc ≥ 1 ảnh)
12. Bấm "Giao thành công" hoặc "Giao thất bại"
13. Thu tiền mặt (nếu đơn thanh toán ngay)
14. Thu vỏ từ khách

[Cuối chuyến]
15. Về kho: Bàn giao vỏ (ký Bàn giao B)
16. Nộp tiền mặt (ký Bàn giao C)
17. Bấm "Hoàn thành chuyến"
18. Check-out
```

---

## Các Tình Huống Thường Gặp

### Giao Thành Công

1. Bấm **"Đang giao"** khi bắt đầu hạ hàng
2. Chụp **ít nhất 1 ảnh** hàng đã hạ (bắt buộc)
3. Nhập số tiền thu được (nếu có)
4. Nhập số vỏ thu lại (thùng, keg, két...)
5. Bấm **"Xác nhận giao thành công"**

### Giao Thất Bại

Khi không giao được (khách vắng, địa chỉ sai, từ chối nhận...):

1. Bấm **"Giao thất bại"**
2. Chọn lý do:
   - Khách vắng / đóng cửa
   - Khách từ chối nhận
   - Địa chỉ không tìm được
   - Xe hỏng giữa đường
   - Lý do khác (nhập thêm ghi chú)
3. Bấm **Xác nhận**
4. Hệ thống ghi lại — DVKH sẽ liên hệ sắp xếp giao lại

### Bỏ Qua Điểm (Skip)

Nếu cần đổi thứ tự giao (điều kiện thực tế):
1. Bấm **"Bỏ qua"** tại điểm đó
2. Nhập lý do
3. Điểm đó sẽ quay về cuối danh sách chuyến

### Báo Sự Cố Xe

1. Bấm **menu "..."** > **"Báo sự cố"**
2. Chọn loại sự cố (hết xăng, nổ lốp, tai nạn...)
3. Gửi vị trí GPS hiện tại
4. Điều phối sẽ liên hệ ngay

---

## Lưu Ý Quan Trọng

> **HẠ HÀNG TRƯỚC — Xác nhận thanh toán/nợ SAU**
> Không được giữ hàng trên xe vì lý do công nợ.

> **Ảnh ePOD là bắt buộc** — Không có ảnh = hệ thống không cho phép xác nhận giao thành công.

> **Vỏ:** Đếm kỹ khi nhận và khi trả. Sai lệch vỏ = trách nhiệm tài xế.

---

<a name="role-warehouse"></a>
# Hướng Dẫn Thủ Kho (Warehouse Handler)

## Công Việc Hàng Ngày

Bạn quản lý **xuất hàng cho từng chuyến xe**, **nhận vỏ về**, và **kiểm tra cổng** để đảm bảo sai lệch = 0.

### Luồng Xuất Hàng

```
Nhận kế hoạch từ Dispatcher
         ↓
Soạn hàng theo xe (Picking-by-Vehicle)
         ↓
Kiểm đếm với Tài xế + Bảo vệ tại cổng
         ↓
Ký Bàn giao A (sai lệch = 0 → mới cho xe xuất)
         ↓
Xe xuất cổng
```

---

## Soạn Hàng Theo Xe

1. Vào **Kho** > **Soạn hàng theo xe**
2. Chọn ngày giao
3. Thấy danh sách xe + hàng cần xuất cho từng xe
4. Với mỗi xe:
   - Xem danh sách sản phẩm + số lượng
   - Xem gợi ý lô hàng theo **FEFO** (First Expired First Out — hết hạn trước xuất trước)
   - Xác nhận đã soạn xong từng xe
5. Cập nhật **tiến độ soạn** (%) khi hoàn thành

> **FEFO là bắt buộc** — Hàng gần hết hạn phải xuất trước. Hệ thống tự gợi ý lô phù hợp.

---

## Kiểm Tra Cổng (Gate Check)

Khi xe chuẩn bị xuất:

1. Vào **Kho** > **Hàng chờ kiểm cổng** hoặc quét mã QR trên xe
2. Xem danh sách hàng **"Dự kiến trên xe"**
3. Đếm thực tế từng sản phẩm
4. Nhập số lượng **thực tế** vào hệ thống
5. Hệ thống so sánh ngay:
   - **Khớp 100%** → Màu xanh → Cho phép ký bàn giao
   - **Lệch** → Màu đỏ → KHÔNG cho xe xuất, phải điều chỉnh

> **Quy tắc cứng R01:** Sai lệch hàng tại cổng = 0. Không ngoại lệ.

---

## Nhập Vỏ Về (Return Inbound)

Khi xe về kho:

1. Vào **Kho** > **Nhận vỏ về**
2. Chọn chuyến xe vừa về
3. Nhập số lượng từng loại vỏ (thùng 24, két 12, keg...)
4. Phân loại: **Tốt / Hỏng / Mất**
5. Ký **Bàn giao B** cùng tài xế
6. Hệ thống tự tính sai lệch vỏ và ghi vào đối soát

---

## WMS Nâng Cao (Phase 9 — Pallet & Bin)

### Quét QR / Barcode

Dùng tính năng này trên thiết bị PDA hoặc điện thoại:

1. Vào **Kho** > **Quét mã**
2. Hướng camera vào mã QR/barcode của pallet/bin
3. Hệ thống đọc mã GS1, hiển thị thông tin lô hàng

### Nhập Hàng Vào Kho (Inbound)

1. **Nhận hàng:** Quét barcode → Hệ thống sinh mã LPN (License Plate Number) + QR
2. **Gợi ý vị trí:** Hệ thống gợi ý 3 vị trí bin tốt nhất
3. **Xác nhận cất vào bin:** Quét bin → xác nhận

### Kiểm Kê (Cycle Count)

1. Vào **Kho** > **Kiểm kê**
2. Hệ thống tự tạo danh sách kiểm kê theo độ ưu tiên A/B/C:
   - **A**: Hàng giá trị cao/nhanh hỏng → kiểm hàng tuần
   - **B**: Hàng bình thường → kiểm hàng tháng
   - **C**: Hàng ít dùng → kiểm hàng quý
3. Đếm thực tế → nhập vào app
4. Hệ thống tự tính chênh lệch → tạo discrepancy nếu cần

---

## Dashboard Cảnh Báo Kho

Vào **Kho** > **Dashboard** — cập nhật mỗi 10 giây:

| Cảnh báo | Ý nghĩa | Hành động |
|----------|---------|-----------|
| Tồn kho thấp | Hàng dưới ngưỡng an toàn | Báo mua hàng |
| Gần hết hạn | Lô sắp hết hạn mà số lượng còn nhiều | Ưu tiên xuất ngay |
| Bin quá tải > 90% | Vị trí bin gần đầy | Điều chuyển sang bin khác |
| Pallet mồ côi | Pallet chưa có bin location | Cất vào vị trí |

---

<a name="role-accountant"></a>
# Hướng Dẫn Kế Toán (Accountant)

## Công Việc Hàng Ngày

Bạn kiểm soát **tiền thu, công nợ, đối soát chuyến** và đảm bảo mọi sai lệch được xử lý trong T+1.

### Luồng Đối Soát

```
Xe về kho → Tài xế nộp tiền (Bàn giao C)
                ↓
Kế toán kiểm đếm tiền thực tế vs hệ thống
                ↓
Đối soát chuyến: khớp → Đóng chuyến
              sai lệch → Tạo Discrepancy → Xử lý T+1
                ↓
Đối soát cuối ngày: tổng hợp toàn bộ
                ↓
Đẩy Bravo (kế toán hạch toán)
```

---

## Đối Soát Chuyến Xe

1. Vào **Đối soát** > **Theo chuyến**
2. Chọn chuyến vừa hoàn thành
3. Xem bảng so sánh:

| Mục | Dự kiến | Thực tế | Chênh lệch |
|-----|---------|---------|------------|
| Tiền thu mặt | 15.200.000 | 15.200.000 | 0 |
| Công nợ | 8.500.000 | 8.500.000 | 0 |
| Vỏ thu về | 250 thùng | 248 thùng | **-2 thùng** |

4. Nếu có sai lệch → Bấm **Tạo Discrepancy**:
   - Chọn loại: Tiền / Hàng / Vỏ
   - Nhập lý do
   - Gán trách nhiệm (tài xế / khách / hệ thống)
5. Đặt deadline xử lý (mặc định T+1)
6. Ký xác nhận đối soát

---

## Xử Lý Sai Lệch (Discrepancy)

Vào **Đối soát** > **Sai lệch**:

| Trạng thái | Ý nghĩa |
|------------|---------|
| Mở | Chưa xử lý |
| Đang xử lý | Đã giao trách nhiệm, chờ kết quả |
| Đã giải quyết | Đã xử lý xong |
| Chuyển cấp | Cần Trưởng kế toán duyệt |

> **Lưu ý:** Chỉ **Trưởng kế toán** (`is_chief_accountant = true`) mới có quyền đóng sai lệch lớn.

---

## Đối Soát Cuối Ngày

1. Vào **Đối soát** > **Đóng ngày**
2. Chọn ngày cần đóng
3. Xem tổng hợp:
   - Tổng đơn: X đơn
   - Tổng tiền thu: Y đồng
   - Sai lệch còn mở: Z items
4. Nếu còn sai lệch → Phải xử lý hoặc chuyển cấp trước khi đóng
5. Bấm **Đóng ngày** → Dữ liệu được khóa, gửi sang Bravo

---

## Theo Dõi Công Nợ NPP

1. Vào **Đơn hàng** > **Công nợ**
2. Xem theo từng NPP:
   - Dư nợ hiện tại
   - Hạn mức tín dụng
   - % đã dùng
   - Ngày hết hạn hạn mức
3. Cảnh báo khi NPP sắp vượt hạn mức hoặc hết hạn

---

<a name="role-management"></a>
# Hướng Dẫn Quản Lý (Management)

## Dashboard Tổng Quan

Vào **Trang chủ** → Xem ngay 5 chỉ số quan trọng:

| KPI | Ý nghĩa | Mục tiêu |
|-----|---------|----------|
| Đơn hàng hôm nay | Tổng số đơn đang xử lý | — |
| OTD Rate | % giao đúng giờ | > 95% |
| Tải xe trung bình | % tải trọng đội xe | > 80% |
| Sai lệch chưa xử lý | Số discrepancy đang mở | = 0 |
| Xe đang hoạt động | Số xe đang trên đường | — |

---

## Phê Duyệt Đơn Vượt Hạn Mức

Khi có thông báo "Đơn chờ duyệt":

1. Vào **Đơn hàng** > **Chờ phê duyệt**
2. Xem lý do: Vượt hạn mức tín dụng bao nhiêu? ATP thiếu bao nhiêu?
3. Xem lịch sử thanh toán của NPP
4. Quyết định: **Duyệt** / **Từ chối** / **Duyệt một phần**
5. Nhập ghi chú lý do quyết định (bắt buộc)

---

## Báo Cáo

| Báo cáo | Vào đâu | Tần suất |
|---------|---------|---------|
| KPI vận hành | Báo cáo > KPI | Hàng ngày |
| Hiệu suất đội xe | Báo cáo > Đội xe | Hàng tuần |
| Công nợ NPP | Báo cáo > Công nợ | Hàng ngày |
| Xuất nhập tồn | Báo cáo > Kho | Hàng ngày |

> Tất cả báo cáo đều có nút **Xuất Excel** ở góc trên phải.

---

<a name="role-admin"></a>
# Hướng Dẫn Admin

## Quản Lý Người Dùng

1. Vào **Cài đặt** > **Người dùng**
2. **Tạo tài khoản mới:**
   - Bấm **Thêm người dùng**
   - Nhập tên đăng nhập, họ tên, email, số điện thoại
   - Chọn **vai trò** (role)
   - Mật khẩu tạm thời: `demo123`
   - Bấm **Lưu**
3. **Reset mật khẩu:** Tìm user → bấm **Reset mật khẩu**
4. **Vô hiệu hóa:** Tìm user → bấm **Vô hiệu hóa** (không xóa dữ liệu)

### Bảng Vai Trò

| Vai trò (Role) | Tiếng Việt | Quyền chính |
|----------------|------------|-------------|
| `admin` | Quản trị viên | Toàn quyền |
| `dispatcher` | Điều phối | OMS + TMS |
| `dvkh` | DVKH | Tạo/xem đơn |
| `driver` | Tài xế | Driver App |
| `warehouse_handler` | Thủ kho | WMS |
| `accountant` | Kế toán | Đối soát |
| `management` | Quản lý | Dashboard + báo cáo |
| `security` | Bảo vệ | Kiểm tra cổng |
| `workshop` | Phân xưởng | Nhận vỏ, bảo dưỡng |

---

## Cấu Hình Hệ Thống

Vào **Cài đặt** > **Cấu hình**:

| Cấu hình | Ý nghĩa | Mặc định |
|----------|---------|---------|
| Giờ chốt đơn | Sau giờ này đơn sang ngày mai | 16:00 |
| Thời gian tự động xác nhận đơn KH | Nếu KH không bấm Zalo | 2 giờ |
| Ngưỡng cảnh báo giấy tờ xe | Cảnh báo trước bao nhiêu ngày | 30 ngày |
| Ngưỡng tồn kho tối thiểu | Cảnh báo kho thấp | Theo SKU |

---

## Giám Sát Sức Khỏe Hệ Thống

Vào **Cài đặt** > **Sức khỏe hệ thống**:

| Dịch vụ | Trạng thái bình thường |
|---------|------------------------|
| Backend API | Xanh — Response < 200ms |
| Database | Xanh — Kết nối ổn định |
| Redis Cache | Xanh — Hit rate > 80% |
| VRP Solver | Xanh — Sẵn sàng |
| OSRM Routing | Xanh — Online |

> Nếu thấy dịch vụ **đỏ** → Báo ngay IT support.

---

## Phân Quyền Nâng Cao (RBAC)

Vào **Cài đặt** > **Phân quyền**:
- Xem ma trận quyền theo vai trò
- Tùy chỉnh quyền riêng cho từng user (override)
- Mọi thay đổi được ghi vào Audit Log

---

## Audit Log

Vào **Cài đặt** > **Audit Log**:
- Xem toàn bộ hành động quan trọng trong hệ thống
- Lọc theo: người dùng, thời gian, loại hành động
- Xem **Diff** (thay đổi trước/sau) cho từng hành động

---

<a name="ai-guide"></a>
# Hướng Dẫn Tính Năng AI

## AI Trong BHL OMS-TMS-WMS

Hệ thống tích hợp AI theo nguyên tắc **"AI đề xuất, người quyết định"** — AI không bao giờ tự thực hiện hành động quan trọng mà không có người duyệt.

> **Nguyên tắc an toàn:** Mọi tính năng cốt lõi vẫn hoạt động hoàn toàn khi AI bị tắt. AI là tăng cường, không phải thay thế.

---

## 1. VRP — Lập Kế Hoạch Xe Tự Động

**Dành cho:** Dispatcher

AI sử dụng thuật toán Google OR-Tools kết hợp bản đồ đường thực tế (OSRM/Vietnam data) để:
- Gom đơn hàng vào chuyến tối ưu
- Phân bổ xe theo tải trọng thực tế
- Tính tuyến đường tránh tắc đường
- Ước tính phí BOT chính xác

**Cách xem AI giải thích:**
- Hover vào từng chuyến → Xem "Vì sao chuyến này?"
- AI giải thích: số đơn, tải trọng %, km dự kiến, cost reason

---

## 2. AI Copilot — Hỏi Đáp Bằng Ngôn Ngữ Tự Nhiên

**Dành cho:** Tất cả vai trò

Bấm biểu tượng **AI** (hoặc phím tắt `Ctrl+K`) → Gõ câu hỏi:

**Ví dụ câu hỏi:**
```
"Tìm đơn hàng của NPP Minh Phát tuần này"
"Xe nào đang có tải trọng thấp nhất hôm nay?"
"Tổng tiền thu hôm qua bao nhiêu?"
"Đơn nào sắp trễ giờ giao?"
"Tài xế Nguyễn Văn A có bao nhiêu chuyến tháng này?"
```

AI sẽ:
1. Hiểu ý định của bạn
2. Tìm dữ liệu trong hệ thống
3. Trả lời + đưa link đến trang liên quan

---

## 3. Simulation — Xem Trước Kết Quả Trước Khi Quyết Định

**Dành cho:** Dispatcher, Quản lý

Khi cần ra quyết định quan trọng, AI cho bạn **xem trước** kết quả mà không thay đổi dữ liệu thật:

**Ví dụ: Thêm đơn khẩn vào kế hoạch đã duyệt**
1. Bấm **"Mô phỏng"** trên màn hình kế hoạch
2. Thêm đơn vào
3. AI tính và hiển thị:
   ```
   Phương án hiện tại:  12 chuyến, 8.5 triệu, OTD 94%
   Sau khi thêm đơn:    12 chuyến, 8.7 triệu, OTD 91%
                         ↑ Chi phí +200k, OTD -3%
   ```
4. Bạn quyết định: **Áp dụng** hoặc **Bỏ qua**

---

## 4. Cảnh Báo Thông Minh (AI Anomaly Detection)

Hệ thống tự phát hiện và cảnh báo:

| Loại bất thường | Ví dụ | Nơi xem |
|-----------------|-------|---------|
| Xe trễ giờ | Xe 51B-23456 trễ 45 phút | Bản đồ / Control Tower |
| Đơn rủi ro cao | NPP X nợ 95% hạn mức | Dashboard |
| Tồn kho bất thường | SKU A giảm đột ngột | Dashboard Kho |
| Giấy tờ hết hạn | Xe Y đăng kiểm còn 5 ngày | Cảnh báo header |

---

## 5. Trust Loop — Cải Thiện AI Theo Thời Gian

Mỗi khi bạn:
- **Chấp nhận đề xuất AI** → AI học thêm pattern này là đúng
- **Sửa đề xuất AI** → AI học thêm exception
- **Từ chối đề xuất AI** + nhập lý do → AI học pattern này là sai trong context này

Theo thời gian, AI sẽ đề xuất chính xác hơn cho hoàn cảnh cụ thể của BHL.

---

<a name="faq"></a>
# FAQ & Xử Lý Sự Cố

## Câu Hỏi Thường Gặp

### "Tôi không thấy menu [X] trên sidebar"
→ Menu hiển thị theo **quyền** của bạn. Liên hệ Admin để được cấp quyền phù hợp.

### "Tôi đăng nhập được nhưng bị đăng xuất liên tục"
→ Có thể access token hết hạn. Hệ thống tự làm mới token nếu bạn đang dùng. Nếu vẫn xảy ra, hãy:
1. Đăng xuất hoàn toàn
2. Xóa cache trình duyệt (`Ctrl+Shift+Delete`)
3. Đăng nhập lại

### "Đơn hàng ở đâu? Tôi tìm không thấy"
→ Mặc định hệ thống chỉ hiển thị **tháng hiện tại**. Để xem cũ hơn:
- Chọn bộ lọc **"Tất cả"** hoặc **"Lịch sử"**
- Hoặc chỉnh **khoảng thời gian** về ngày cần tìm

### "VRP báo lỗi / không tính được"
→ Kiểm tra:
1. Có đơn hàng được xác nhận cho ngày đó chưa?
2. Có xe sẵn sàng (không phải đang sửa/hết đăng kiểm) chưa?
3. Nếu vẫn lỗi: bấm **"Tính lại"** một lần. Nếu vẫn không được → báo IT

### "Tôi quên ký bàn giao, hệ thống khóa rồi"
→ Liên hệ **Quản lý** hoặc **Admin** để unlock. Mọi trường hợp unlock đều được ghi vào Audit Log.

### "Tôi muốn xuất báo cáo theo định dạng khác"
→ Hiện tại hệ thống xuất **Excel (.xlsx)**. Từ Excel có thể chuyển sang PDF hoặc import vào Bravo.

### "Số liệu dashboard có bị trễ không?"
→ Dashboard stats được **cache 30 giây**. Tức là số liệu tối đa trễ 30 giây so với thực tế. Kho dashboard cập nhật mỗi 10 giây (không cache).

---

## Mã Lỗi Thường Gặp

| Mã lỗi | Ý nghĩa | Xử lý |
|--------|---------|-------|
| 401 | Chưa đăng nhập / Token hết hạn | Đăng nhập lại |
| 403 | Không có quyền | Liên hệ Admin |
| 404 | Không tìm thấy bản ghi | Kiểm tra lại ID/mã |
| 409 | Xung đột dữ liệu | Ví dụ: đã có bản ghi này rồi |
| 422 | Dữ liệu nhập không hợp lệ | Kiểm tra lại các trường bắt buộc |
| 503 | Dịch vụ tạm thời không khả dụng | Chờ 1-2 phút rồi thử lại |

---

## Phím Tắt Hữu Ích

| Phím tắt | Chức năng |
|----------|-----------|
| `Ctrl + K` | Mở AI Copilot / Tìm kiếm nhanh |
| `Esc` | Đóng popup/modal |
| `Ctrl + Enter` | Xác nhận form (thay vì click nút) |
| `F5` | Làm mới dữ liệu trang hiện tại |

---

## Liên Hệ Hỗ Trợ

| Kênh | Dùng khi |
|------|---------|
| Admin hệ thống nội bộ | Hỏi về quyền, tài khoản, cấu hình |
| Nhóm Zalo IT BHL | Báo lỗi kỹ thuật, sự cố cần fix nhanh |
| Email IT | Yêu cầu tính năng mới, báo cáo lỗi không khẩn |

---

# Phụ Lục: Sơ Đồ Luồng Tổng Thể

## Luồng Đơn Hàng Đầu-Cuối

```
[DVKH] Tạo đơn
    │
    ▼
[Hệ thống] Kiểm tra ATP + Công nợ
    │
    ├── Vượt ngưỡng ──► [Quản lý] Phê duyệt ──► Tiếp tục
    │
    ├── Ổn ──► Gửi Zalo cho KH
    │              │
    │              ├── KH xác nhận (< 2h)
    │              └── Tự xác nhận sau 2h
    │
    ▼
[Dispatcher] Lập kế hoạch VRP (AI)
    │
    ▼
[Thủ kho] Soạn hàng theo FEFO
    │
    ▼
[Thủ kho + Bảo vệ + Tài xế] Kiểm cổng (sai lệch = 0)
    │
    ▼
[Tài xế] Bắt đầu chuyến (app)
    │
    ▼
[Tài xế] Giao từng điểm: HẠ HÀNG → ePOD → Thu tiền → Thu vỏ
    │
    ├── Thất bại ──► [DVKH] Tạo "Giao bổ sung"
    │
    ▼
[Tài xế] Về kho: Bàn giao B (vỏ) + Bàn giao C (tiền)
    │
    ▼
[Kế toán] Đối soát chuyến → Xử lý sai lệch → Đóng ngày
    │
    ▼
[Hệ thống] Đẩy dữ liệu sang Bravo (kế toán hạch toán)
```

---

## Bảng Màu Trạng Thái

| Màu | Ý nghĩa | Xuất hiện ở |
|-----|---------|-------------|
| Xanh lá | Hoàn thành / Ổn | Đơn đã giao, xe sẵn sàng |
| Xanh dương | Đang xử lý | Đang vận chuyển, đang giao |
| Vàng / Cam | Cần chú ý | Chờ duyệt, sắp trễ hạn |
| Đỏ | Lỗi / Cần xử lý ngay | Giao thất bại, sai lệch |
| Xám | Đã hủy / Không hoạt động | Đơn hủy, xe bảo dưỡng |

---

*Tài liệu này được cập nhật cùng phiên bản hệ thống. Phiên bản hiện tại: BHL OMS-TMS-WMS v1.0 (01/05/2026)*

*Để đề xuất bổ sung hoặc báo lỗi trong tài liệu: liên hệ IT BHL.*
