# BRD — HỆ THỐNG QUẢN LÝ VẬN HÀNH BHL
## (OMS – TMS – WMS)

**Phiên bản:** 3.8  
**Ngày:** 26/04/2026  
**Khách hàng:** Công ty Cổ phần Bia và Nước giải khát Hạ Long (BHL)  
**Trạng thái:** Đã rà soát lại theo code thực tế  
**Thay đổi v3.8:** Nâng Section 14D thành AI-Native Progressive Enhancement theo `docs/specs/AI_NATIVE_BLUEPRINT_v3.md`: AI Toggle Architecture, Privacy Router, Copilot, Voice/Camera safety, Simulation, Explainability, Trust Loop, Transparency Center. Core UX phải chạy 100% khi AI OFF. DEC-AI-02.

---

# MỤC LỤC

1. [TỔNG QUAN DỰ ÁN](#1-tổng-quan-dự-án)
2. [BỐI CẢNH & HIỆN TRẠNG (AS-IS)](#2-bối-cảnh--hiện-trạng-as-is)
3. [QUY TẮC NGHIỆP VỤ BẮT BUỘC](#3-quy-tắc-nghiệp-vụ-bắt-buộc)
4. [PHÂN HỆ OMS — QUẢN LÝ ĐƠN HÀNG](#4-phân-hệ-oms--quản-lý-đơn-hàng)
5. [PHÂN HỆ TMS — QUẢN LÝ VẬN TẢI](#5-phân-hệ-tms--quản-lý-vận-tải)
6. [PHÂN HỆ WMS — QUẢN LÝ KHO](#6-phân-hệ-wms--quản-lý-kho)
7. [MODULE ĐỐI SOÁT](#7-module-đối-soát)
8. [TÍCH HỢP HỆ THỐNG](#8-tích-hợp-hệ-thống)
9. [PHÂN QUYỀN 3 LỚP & APPROVAL FLOW](#9-phân-quyền-3-lớp--approval-flow)
10. [BÁO CÁO & DASHBOARD](#10-báo-cáo--dashboard)
11. [THÔNG BÁO & CẢNH BÁO (33 EVENTS)](#11-thông-báo--cảnh-báo-33-events)
12. [TIMELINE ĐƠN HÀNG 10 LỚP](#12-timeline-đơn-hàng-10-lớp)
13. [QUY MÔ & SIZING](#13-quy-mô--sizing)
14. [PHỤ LỤC — DATA ENTITIES](#14-phụ-lục--data-entities)
14B. [TÍNH NĂNG BỔ SUNG (PHÁT SINH TỪ PHÁT TRIỂN)](#14b-tính-năng-bổ-sung-phát-sinh-từ-phát-triển)
14C. [QUẢN LÝ ĐỘI XE & TÀI XẾ NÂNG CAO (FMS+/DMS+)](#14c-quản-lý-đội-xe--tài-xế-nâng-cao-fms--dms)
14D. [AI-NATIVE PROGRESSIVE ENHANCEMENT LAYER](#14d-ai-native-progressive-enhancement-layer)
15. [TIÊU CHÍ NGHIỆM THU (UAT)](#15-tiêu-chí-nghiệm-thu-uat)

---

# 1. TỔNG QUAN DỰ ÁN

## 1.1 Mục tiêu
Xây dựng hệ thống vận hành chính (Primary Operations System) quản lý toàn bộ chuỗi khép kín: Đặt hàng → Điều vận → Xuất kho → Giao hàng → Thu tiền/Công nợ → Thu vỏ → Đối soát → Hoàn chứng từ, thay thế quy trình thủ công (Excel/Zalo) hiện tại.

**Mục tiêu cụ thể:**

| Mục tiêu | Chỉ số đo lường |
|----------|----------------|
| Rút ngắn thời gian lập kế hoạch điều vận | Từ 1–3 giờ/ngày xuống < 20 phút (tự động VRP) |
| Tăng hiệu suất sử dụng xe, giảm chuyến rỗng | Tỷ lệ xe rỗng < 5%, tải trọng trung bình > 80% |
| Nâng tỷ lệ giao đúng khung giờ cam kết | OTD rate (1 giờ) > 95% |
| Kiểm soát tuyệt đối sai lệch hàng và vỏ | Sai lệch tại cổng = 0, sai lệch vỏ = 0 |
| Minh bạch công nợ hàng hóa và vỏ cược | Công nợ NPP real-time, sai lệch đóng trong T+1 |

## 1.2 Vai trò hệ thống & Luồng dữ liệu

| Hệ thống | Vai trò | Luồng dữ liệu |
|-----------|---------|----------------|
| **Hệ thống mới (OMS-TMS-WMS)** | Primary Operations — Source of Truth | Nhập đơn gốc, quản lý kho, điều vận → DMS (push) \| ↔ Bravo (2 chiều) \| → Zalo OA |
| **Bravo** | Kế toán — Hạch toán, hóa đơn điện tử | ← Nhận: giao hàng, tiền thu, công nợ vỏ → Gửi: số dư công nợ, xác nhận hạch toán |
| **DMS** | Sales — Theo dõi đơn hàng từ sale | ← Nhận: đơn confirmed, cập nhật trạng thái |
| **Zalo OA** | Kênh xác nhận với NPP | ← Gửi: link xác nhận đơn, link xác nhận nhận hàng |

> **LƯU Ý QUAN TRỌNG:** Luồng dữ liệu là **Hệ thống mới → DMS** (không phải DMS → OMS). Hệ thống mới là nguồn sự thật (Source of Truth). Hóa đơn điện tử được quản lý và phát hành trên Bravo — hệ thống mới CHỈ gửi dữ liệu kết quả giao hàng/thanh toán sang Bravo.

## 1.3 Các điểm nghẽn cần giải quyết
| # | Điểm nghẽn (AS-IS) | Giải pháp (TO-BE) |
|---|--------------------|--------------------|
| 1 | Lập kế hoạch vận tải thủ công (Excel/Zalo), mất 1-3h/ngày | Auto-planning bằng thuật toán VRP (Google OR-Tools) |
| 2 | Xe chạy rỗng chiều về, đặc biệt tuyến shuttle HL ↔ Đông Mai | Tối ưu shuttle + ghép đơn chiều về |
| 3 | Không kiểm soát được vòng đời tài sản quay vòng (vỏ, két, keg, pallet) | Module quản lý Returnable Assets + đối trừ công nợ tự động |
| 4 | "Khoảng chết" thông tin từ xe ra cổng đến hoàn chứng từ | Driver App (GPS + ePOD + thu tiền real-time) |
| 5 | Công nợ tiền hàng và công nợ vỏ chưa minh bạch theo thời gian thực | Theo dõi công nợ NPP real-time, hạn mức theo thời kỳ |

## 1.4 Quy mô vận hành
| Thông số | Giá trị |
|----------|---------|
| Nhà máy | 2 (Hạ Long và Đông Mai, cách ~35km) |
| Kho | 2 hiện tại, scale tới 8 (bao gồm kho thuê ngoài theo mùa) |
| Đội xe nội bộ | ~70 đầu (2.5T – 16T) + xe thuê ngoài mùa cao điểm |
| Sản lượng | 10–15 triệu lít/tháng |
| Đơn hàng | ~1,000 đơn/ngày |
| NPP/Khách hàng hiện tại | ~800 |
| SKU | ~30 |
| Tuyến đường | ~500 |
| Internal users (bắt buộc) | 80 người: 70 tài xế (Driver App) + 10 nhân viên nội bộ (Web) |
| NPP Portal users (tương lai) | Tối đa 800 NPP — phát triển sau khi hệ thống lõi ổn định |
| Concurrent users (peak) | ~80 internal + ~100 NPP portal = ~180 đồng thời |
| Tính chất mùa vụ | Tết, Hè tăng đột biến — KHÔNG thay đổi chính sách vận hành lõi |

## 1.5 Các bên liên quan

| Vai trò | Trách nhiệm chính |
|---------|-------------------|
| Khách hàng / NPP | Đặt đơn, nhận hàng, thanh toán (hoặc nợ), hoàn trả vỏ |
| Bộ phận DVKH và QL CCDC | Tiếp nhận đơn, theo dõi đơn, xử lý giao thất bại, nhận chứng từ |
| Đội xe vận tải / Điều phối | Lập và giám sát kế hoạch giao, phân công xe và lái xe |
| Lái xe | Kiểm tra xe, giao hàng, thu tiền, thu vỏ, hoàn chứng từ |
| Kho bãi bốc xếp | Xuất hàng, bàn giao hàng, nhập và phân loại vỏ |
| Kế toán / Thủ quỹ | Kiểm soát cổng, nhận tiền, ghi nhận công nợ, đối soát, mở/đóng sai lệch |
| Bảo vệ cổng | Phối hợp kiểm đếm hàng trước khi xe xuất cổng |
| Quản lý vận hành / BGĐ | Phê duyệt ngoại lệ, theo dõi KPI, xử lý sai lệch |

---

# 2. BỐI CẢNH & HIỆN TRẠNG (AS-IS)

## 2.1 Quy trình Điều vận (AS-IS) — 9 bước

```
Khách hàng đặt đơn (Tổng đài)
    → [1] DVKH ghi nhận đơn, kiểm tra tồn kho
    → Chuyển "File nhu cầu vận tải" cho Đội xe
    → [2] Đội xe xếp tuyến (xe + lái xe + kiểm tra kỹ thuật)
    → [3] DVKH làm lệnh đóng hàng → chuyển cho Kho
    → [4] Kho xuất hàng lên xe, bàn giao cho lái xe
    → [5] Kế toán/Thủ quỹ kiểm đếm tại cổng (nếu thiếu → quay lại)
    → [6] Lái xe di chuyển đến điểm trả hàng
    → [7] Giao hàng + Thu tiền (hoặc ghi nợ) + Thu vỏ
    → [8] Về công ty: Nộp tiền, hoàn chứng từ, bàn giao vỏ
    → [9] Bàn giao xe, kiểm tra kỹ thuật cuối ca
```

## 2.2 Luồng To-Be (chuẩn hóa từ BRD V1.2)

```
1. Khách hàng đặt đơn
2. DVKH ghi nhận đơn và xác nhận điều kiện xử lý (ATP, hạn mức công nợ)
3. Gom/tách đơn thành lệnh giao theo nguyên tắc tối ưu vận tải
4. Điều phối phân công xe, lái xe và lộ trình (auto-planning + duyệt)
5. Lái xe hoàn tất kiểm tra đầu chuyến (checklist trên app)
6. Kho xuất hàng theo FEFO; Thủ kho + Bảo vệ + Lái xe cùng kiểm đếm tại khu vực xếp hàng → ký Bàn giao A (biên bản số — sai lệch = 0 tuyệt đối, R01)
7. Giao hàng tại điểm nhận — HẠ HÀNG TRƯỚC, xác nhận thanh toán/nợ sau
8. Thu tiền (nếu có) và thu vỏ sau giao
9. Giao thất bại → giao lại KHÔNG GIỚI HẠN số lần, bắt buộc thống kê
10. Xe quay về: Bàn giao B (vỏ → Phân xưởng, ký số), Bàn giao C (tiền → KT, ký số)
11. Đối soát cuối chuyến + cuối ngày, sai lệch xử lý đến T+1
```

## 2.3 Ràng buộc thời gian
| Bước | Thời hạn |
|------|----------|
| Mốc chốt đơn | Trước 16h và sau 16h (giữ quy định hiện hành) |
| Xếp tuyến → Lệnh đóng hàng (trước 16h) | Tối đa 20 phút |
| Xếp tuyến → Lệnh đóng hàng (sau 16h) | Tối đa 1.5 giờ |
| Khung giờ giao chuẩn | **1 giờ** (có thể điều chỉnh theo từng thời kỳ) |

---

# 3. QUY TẮC NGHIỆP VỤ BẮT BUỘC

| # | Quy tắc | Ghi chú |
|---|---------|---------|
| R01 | **Không chấp nhận sai lệch hàng tại cổng** (WMS-04: sai lệch = 0) | Gate Check phải khớp 100% |
| R02 | **Không chấp nhận sai lệch vỏ theo chuyến** (RA-04: sai lệch = 0). Nếu chênh lệch, **lái xe chịu trách nhiệm** | Phân xưởng đếm thực tế là chuẩn |
| R03 | **Được phép hạ hàng TRƯỚC khi xác nhận thanh toán** | Hàng và tiền tách rời |
| R04 | **Được phép công nợ, KHÔNG bắt buộc thu tiền ngay** — áp dụng cho NPP **có hạn mức nợ**. NPP không có hạn mức nợ phải thu tiền ngay hoặc được ghi nợ theo thoả thuận riêng. | |
| R05 | **Giao thất bại → giao lại KHÔNG GIỚI HẠN số lần** | Bắt buộc thống kê số lần + lý do |
| R06 | **Đối soát sai lệch được xử lý đến T+1** (T = ngày giao). Kế toán có quyền mở/đóng hồ sơ | Escalation nếu chưa đóng |
| R07 | **Khung giờ giao chuẩn: 1 giờ**, điều chỉnh được theo từng thời kỳ (Admin cấu hình) | Lưu lịch sử hiệu lực |
| R08 | **Mốc chốt đơn: trước 16h / sau 16h** giữ nguyên quy định hiện hành | Enforce trên hệ thống |
| R09 | **Mùa cao điểm = chính sách vận hành cốt lõi KHÔNG ĐỔI** | Scale lên chỉ về lượng |
| R10 | **Vỏ hỏng/sứt/mất → bồi hoàn theo đơn giá hiệu lực từng thời kỳ** | Bảng đơn giá riêng, Admin cập nhật |
| R11 | **Biểu mẫu vận hành số hóa** theo thiết kế mới (không clone biểu mẫu cũ) | |
| R12 | **Ưu tiên điều phối khi thiếu xe**: Thứ tự ưu tiên **cấu hình được** (Admin setting) | Không hardcode |
| R13 | **Tài xế thông báo miệng cho NPP trước khi hạ hàng**. Sau giao hàng, hệ thống gửi Zalo kèm **link xác nhận** (NPP bấm link → xem chủng loại & số lượng → xác nhận hoặc báo sai lệch). Không phản hồi trong 24h = đúng (Silent Consent) | Nếu NPP phản hồi "sai" → tra soát, ai sai người đó chịu |
| R14 | **Quy đổi vỏ**: Vỏ bia hơi theo **CÁI**, Vỏ bia chai theo **KEG** | |
| R15 | **Hạn mức công nợ NPP** (không phải hạn mức tín dụng) — NPP **có thể có hoặc không có** hạn mức. Nếu có và vượt → **chặn đơn mới**, yêu cầu phê duyệt Kế toán. NPP không có hạn mức → không check. | |
| R16 | **Bàn giao A** (Xuất kho): Thủ kho + Bảo vệ + Lái xe cùng kiểm đếm tại khu vực xếp hàng. Cả 3 ký số trên hệ thống → biên bản số tạo tự động. Sai lệch = 0 (R01). Không có bước kiểm đếm riêng tại cổng. | Bảo vệ cổng chỉ mở barrier sau khi Bàn giao A đã hoàn tất |
| R17 | **Bàn giao B** (Nhập vỏ): Lái xe khai số vỏ → Phân xưởng đếm độc lập → cả 2 ký số. Chênh lệch → lái xe chịu (R02). | Phân xưởng đếm là chuẩn |
| R18 | **Bàn giao C** (Nộp tiền): KT đếm thực tế cùng lái xe → cả 2 ký số. Chênh lệch ghi nhận ngay. Biên bản C là bằng chứng pháp lý nội bộ, không thể sửa sau khi ký. | |

---

# 4. PHÂN HỆ OMS — QUẢN LÝ ĐƠN HÀNG

## 4.1 Tổng quan
OMS là **điểm vào duy nhất** của đơn hàng. DVKH nhập đơn trực tiếp trên hệ thống → hệ thống xử lý → đẩy sang DMS + chuyển nhu cầu cho TMS + tạo lệnh đóng hàng cho WMS.

**Quy tắc bắt buộc:**
- OMS-01: Đơn phải có đầy đủ thông tin bắt buộc trước khi chuyển bước
- OMS-02: Kiểm tra khả năng đáp ứng theo tồn kho thực tế
- OMS-03: Gom đơn cùng tuyến/cùng khách để tối ưu chuyến
- OMS-04: Tách đơn khi vượt điều kiện giao hoặc thiếu hàng
- OMS-05: Giữ mốc chốt đơn trước/sau 16h theo quy định

## 4.2 User Stories & Acceptance Criteria

### US-OMS-01: Nhập đơn hàng
**As a** nhân viên DVKH  
**I want to** nhập đơn hàng khi khách gọi tổng đài  
**So that** đơn hàng được ghi nhận chính xác trong hệ thống

**Acceptance Criteria:**
- [x] Chọn NPP/Khách hàng từ danh mục (tìm kiếm theo tên, mã, SĐT)
- [x] Chọn sản phẩm (SKU), nhập số lượng
- [x] Hiển thị **tồn kho khả dụng (ATP)** real-time tại thời điểm nhập đơn
- [ ] Nếu tồn kho không đủ → cảnh báo và cho phép: (a) đặt partial, (b) chuyển kho khác, (c) hủy dòng — đơn thiếu hàng có **trạng thái xử lý riêng**
- [x] Chọn ngày giờ giao hàng mong muốn
- [x] Chọn địa chỉ giao (từ danh sách địa chỉ đã lưu của NPP hoặc nhập mới)
- [ ] Hiển thị chính sách vỏ cược áp dụng cho đơn này (tự động tính)
- [x] **Validate đầy đủ thông tin bắt buộc** — không cho chuyển bước nếu thiếu
- [x] Lưu đơn → hệ thống check ATP + hạn mức công nợ:
  - ATP đủ + hạn mức OK → trạng thái **"Chờ NPP xác nhận" (Pending Customer Confirm)** → gửi Zalo cho NPP kèm link xác nhận đơn hàng
  - ATP đủ + vượt hạn mức → trạng thái **"Chờ duyệt" (Pending Approval)** → Kế toán duyệt → gửi Zalo cho NPP
  - ATP không đủ → cảnh báo DVKH
- [x] NPP bấm link Zalo → xem chi tiết đơn (sản phẩm, số lượng, giá, ngày giao) → **"Xác nhận đặt hàng"** hoặc **"Từ chối"** *(Impl: /order-confirm/:token public page)*
- [x] NPP xác nhận → đơn chuyển **"Confirmed"**, tạo shipment, ghi nợ
- [x] NPP từ chối → đơn **"Cancelled"**, hoàn ATP
- [x] Không phản hồi trong **2 giờ** → tự động xác nhận (Silent Consent) *(Impl: cron mỗi 5 phút check expired)*
- [x] Đơn tự động **phân luồng trước 16h / sau 16h** theo mốc chốt *(Impl: cutoff_hour configurable qua system_settings)*

### US-OMS-02: Kiểm tra tồn kho khả dụng (ATP)
**As a** hệ thống  
**I want to** tính toán ATP real-time  
**So that** không bán vượt tồn kho

**Acceptance Criteria:**
- [x] ATP = Tồn kho thực tế - Đã cam kết (cho đơn khác chưa xuất) - Đang giữ (reserved) *(Impl: tính từ stock_quants)*
- [x] ATP tính theo từng kho, từng SKU *(Impl: GET /v1/atp + POST /v1/atp/batch)*
- [x] Khi đơn được xác nhận → trừ ATP ngay (reserved)
- [x] Khi đơn bị hủy → hoàn lại ATP

### US-OMS-02a: Sửa đơn hàng (Edit Order)
**As a** nhân viên DVKH / Điều phối viên  
**I want to** chỉnh sửa đơn hàng đã tạo (khi chưa giao)  
**So that** cập nhật sản phẩm, số lượng, thông tin giao hàng mà không cần hủy rồi tạo lại

**Acceptance Criteria:**
- [x] Chỉ cho phép sửa đơn ở trạng thái: `draft`, `confirmed`, `pending_approval`
- [x] Không cho sửa đơn đã giao (`shipped`, `delivered`, `completed`, `cancelled`)
- [x] Khi sửa: giải phóng tồn kho reserved cũ → kiểm tra ATP mới → reserve lại
- [x] Tự động tính lại: tổng tiền, trọng lượng, thể tích, phí vỏ cược
- [x] Re-check hạn mức công nợ: nếu NPP có hạn mức và đơn mới vượt → chuyển `pending_approval`
- [x] Nếu đơn cũ đã có Shipment (status=pending) → xóa Shipment cũ và tạo lại
- [x] Giao diện sửa đơn tái sử dụng form tạo đơn, pre-fill dữ liệu hiện tại
- [x] Hiển thị nút "Sửa" trên trang chi tiết đơn và danh sách đơn (chỉ khi trạng thái cho phép)
**As a** hệ thống  
**I want to** gom nhiều đơn lẻ thành một lệnh vận chuyển  
**So that** tối ưu tải trọng xe — nhiều đơn đi chung một chuyến giao

**Acceptance Criteria:**
- [x] Tự động gom các đơn có cùng: (a) khu vực giao/tuyến, (b) khung giờ giao tương thích, (c) cùng NPP
- [x] Kết quả gom hiển thị cho điều phối viên review
- [ ] Điều phối viên có quyền **override**: tách/gom lại thủ công
- [x] Mỗi lệnh vận chuyển (Shipment) ghi rõ nguồn gốc từ các Sales Order nào
- [x] Tổng trọng lượng/thể tích sau gom không vượt tải trọng xe dự kiến

### US-OMS-04: Tách đơn (Order Split)
**As a** nhân viên DVKH  
**I want to** tách đơn lớn thành nhiều lệnh vận chuyển  
**So that** phân bổ cho nhiều xe khi 1 xe không chở hết, hoặc tách phần giao ngay / giao lại

**Acceptance Criteria:**
- [x] Tách theo số lượng (ví dụ: 500 thùng → 300 + 200)
- [x] Tách theo SKU (ví dụ: bia chai xe A, bia hơi xe B)
- [x] Tách khi thiếu hàng: phần đủ giao ngay, phần thiếu giao sau
- [x] Mỗi phần tách có trạng thái giao hàng độc lập
- [x] Tổng các phần tách = đơn gốc (không thừa, không thiếu)

### US-OMS-05: Chính sách vỏ cược
**As a** hệ thống  
**I want to** tự động tính tiền cược vỏ khi xử lý đơn  
**So that** kiểm soát được công nợ vỏ

**Acceptance Criteria:**
- [ ] Chính sách cược áp dụng cho **tất cả NPP** (không có miễn cược)
- [ ] Loại tài sản tính cược: **Chai, Két (vỏ), Keg**
- [ ] Quy đổi: Vỏ bia hơi theo **CÁI**, Vỏ bia chai theo **KEG** (R14)
- [ ] Mỗi loại tài sản có đơn giá cược riêng (quản lý trong master data)
- [ ] Khi tạo đơn → tự động tính số lượng vỏ cược dựa trên sản phẩm đặt
- [ ] Hiển thị tổng tiền cược trên đơn hàng
- [ ] Công nợ vỏ tích lũy theo NPP

### US-OMS-06: Đẩy đơn hàng sang DMS
**As a** hệ thống  
**I want to** đồng bộ đơn hàng đã xác nhận sang DMS  
**So that** Sale theo dõi được trạng thái đơn

**Acceptance Criteria:**
- [x] Khi đơn hàng chuyển trạng thái "Confirmed" → gọi API đẩy sang DMS *(Impl: integration mock mode, async fire-and-forget)*
- [x] Dữ liệu đẩy: Mã đơn, NPP, Sản phẩm, Số lượng, Trạng thái
- [x] Cập nhật trạng thái ngược về DMS khi: Đang giao / Đã giao / Hoãn / Hủy *(Impl: DMS sync endpoint)*
- [x] Nếu API DMS lỗi → retry + ghi log + cảnh báo admin *(Impl: DLQ dead letter queue với retry/resolve)*

### US-OMS-07: Hạn mức công nợ NPP
**As a** hệ thống  
**I want to** kiểm tra hạn mức công nợ khi nhập đơn  
**So that** không cho nợ vượt hạn mức

**Acceptance Criteria:**
- [x] NPP **có thể có hoặc không có** hạn mức công nợ (không phải hạn mức tín dụng — R15)
- [x] Hạn mức thiết lập **theo thời kỳ** (từ ngày → đến ngày), Admin cấu hình *(Impl: bảng credit_limits với valid_from/valid_to)*
- [x] Khi nhập đơn → **chỉ kiểm tra nếu NPP có hạn mức đang hiệu lực**: Công nợ hiện tại + Giá trị đơn mới ≤ Hạn mức
- [x] NPP không có hạn mức → **bỏ qua bước check**, đơn tiếp tục bình thường
- [x] Vượt hạn mức → chặn đơn mới, yêu cầu phê duyệt từ Kế toán
- [x] Đơn chuyển `pending_approval` → Kế toán duyệt → tiếp tục / từ chối *(Impl: GET /v1/orders/pending-approvals, POST /v1/orders/:id/approve)*
- [x] Hết thời kỳ → Hạn mức không còn hiệu lực → cảnh báo Admin cập nhật *(Impl: Cron 6h/lần CheckCreditLimitExpiry)*
- [x] Lịch sử thay đổi hạn mức được ghi log đầy đủ *(Impl: entity_events audit trail với changes diff)*

### US-OMS-08: Mốc chốt đơn trước/sau 16h
**As a** hệ thống  
**I want to** phân luồng đơn hàng theo mốc 16h  
**So that** tuân thủ quy định vận hành hiện hành (R08)

**Acceptance Criteria:**
- [x] Đơn nhập trước 16h → nhóm "Giao trong ngày" (xếp tuyến trong 20 phút)
- [x] Đơn nhập sau 16h → nhóm "Giao ngày mai" (xếp tuyến trong 1.5 giờ)
- [x] Mốc 16h cấu hình được (Admin có thể điều chỉnh theo thời kỳ) *(Impl: system_settings key `cutoff_hour`)*
- [x] Hệ thống tự động gán nhóm, hiển thị rõ cho DVKH và Điều phối *(Impl: cutoff_group field trên order)*

## 4.3 Trạng thái đơn hàng (Order Status Flow)
```
Draft (Mới nhập, ATP reserved)
  ├→ Pending Customer Confirm (ATP OK + hạn mức OK → gửi Zalo cho NPP xác nhận đơn)
  │    ├→ Confirmed (NPP bấm "Xác nhận" hoặc auto-confirm sau 2h)
  │    └→ Cancelled (NPP bấm "Từ chối" → hoàn ATP)
  │
  └→ Pending Approval (Vượt hạn mức công nợ — chờ Kế toán duyệt)
       ├→ Pending Customer Confirm (Kế toán duyệt → gửi Zalo cho NPP)
       └→ Cancelled (Kế toán từ chối → hoàn ATP)

  Confirmed (NPP đã xác nhận, tạo shipment, ghi nợ)
    → Planned (Đã xếp xe — từ TMS)
      → Picking (Kho đang đóng hàng — từ WMS)
        → Loaded (Hàng đã lên xe, kiểm đếm OK)
          → In Transit (Xe đang giao)
            → Delivered (Giao thành công → gửi Zalo xác nhận nhận hàng)
            → Partial Delivered (Giao thiếu — xác nhận thực tế với NPP)
              → **Giao bổ sung (từ partially_delivered hoặc failed — không giới hạn số lần)**
            → Rejected (Khách từ chối → **hủy đơn và tạo mới**, không giao lại)
            → On Credit (Giao hàng nhưng chưa thu tiền — ghi nhận công nợ)
  → Cancelled (Hủy đơn — từ draft, pending_approval, pending_customer_confirm, confirmed, planned)
```

> **Lưu ý:** Đơn hàng đi qua **2 lần xác nhận Zalo với NPP:**
> 1. **Xác nhận đơn hàng** (sau khi lập đơn) — NPP đồng ý mua, timeout 2h
> 2. **Xác nhận nhận hàng** (sau khi giao) — NPP xác nhận đã nhận đúng, timeout 24h

---

# 5. PHÂN HỆ TMS — QUẢN LÝ VẬN TẢI

## 5.1 Tổng quan
TMS quản lý toàn bộ vòng đời vận tải: Xếp xe tự động → Checklist kỹ thuật → Giám sát GPS → Giao hàng (ePOD) → Thu tiền/Công nợ → Thu vỏ → Hoàn chứng từ → Đối soát. Bao gồm cả xe nội bộ và xe thuê ngoài.

**Quy tắc bắt buộc:**
- TMS-01: Ưu tiên điều phối theo hiệu suất xe khi thiếu xe (thứ tự cấu hình được)
- TMS-02: Một chuyến nhiều điểm giao, không giới hạn số điểm (Multi-drop)
- TMS-03: Theo dõi trạng thái từng chuyến và từng điểm giao
- TMS-04: Giao thất bại → giao lại không giới hạn
- TMS-05: Bắt buộc thống kê số lần giao lại + lý do
- TMS-06: Khung giờ giao chuẩn 1 giờ
- TMS-07: Khung giờ điều chỉnh theo từng thời kỳ

## 5.2 Module: Auto-Planning (Xếp xe tự động)

### US-TMS-01: Tự động xếp xe (VRP Solver)
**As a** điều phối viên  
**I want to** hệ thống tự động đề xuất phương án xếp xe tối ưu  
**So that** giảm thời gian xếp xe từ 1-3h xuống vài phút

**Acceptance Criteria:**
- [x] Input: Danh sách Shipment (từ OMS) + Danh sách xe khả dụng + Ràng buộc
- [x] Ràng buộc xử lý:
  - Tải trọng xe (kg)
  - Thể tích thùng xe (m³)
  - Giờ cấm tải (theo bảng cấu hình thủ công — US-TMS-03)
  - Cung đường / khu vực phục vụ
  - Khung giờ giao hàng: **1 giờ** chuẩn, cấu hình theo thời kỳ (R07)
  - Thời gian dỡ hàng ước tính tại mỗi điểm
- [ ] **Khi thiếu xe** → áp dụng thứ tự ưu tiên **cấu hình được** (R12):
  - Admin thiết lập bộ tiêu chí ưu tiên (ví dụ: Tải trọng lớn trước / Tuyến xa trước / Đơn giá trị cao trước)
  - Thứ tự ưu tiên có thể thay đổi bất kỳ lúc nào
- [x] Output: Danh sách Trip (chuyến xe), mỗi Trip gồm: Xe, Tài xế, Thứ tự điểm giao, Thời gian dự kiến
- [x] Sử dụng **Google OR-Tools** làm engine tối ưu *(Impl: VRP Python service port 8090)*
- [x] Hỗ trợ bài toán **Multi-drop** — 1 xe giao nhiều điểm, **không giới hạn số điểm** (TMS-02)
- [x] Điều phối viên **xem kết quả → duyệt hoặc chỉnh tay** trước khi xác nhận *(Impl: POST /v1/planning/approve với trip_assignments)*
- [x] Thời gian xử lý solver: < 2 phút cho 1,000 đơn
- [ ] **Lập kế hoạch thủ công hoàn toàn**: Điều phối có thể bỏ qua VRP, tự tạo Trip và gán điểm giao bằng tay (không bắt buộc chạy solver)
- [x] **Chọn lại tiêu chí tối ưu VRP**: Trước khi chạy solver, điều phối chọn tiêu chí ưu tiên (ví dụ: tối thiểu quãng đường / tối thiểu số xe / tối đa tải trọng). Tiêu chí lưu theo session, không cần cấu hình Admin. *(Impl: 6 tiêu chí drag-to-reorder + toggle ON/OFF, session-based)*

### US-TMS-01a: Dashboard đánh giá kết quả tối ưu
**As a** điều phối viên  
**I want to** xem các chỉ số đánh giá chất lượng kế hoạch vận tải ngay sau khi solver chạy xong  
**So that** biết kế hoạch đã tối ưu hay cần điều chỉnh trước khi duyệt

**Acceptance Criteria:**
- [x] Hiển thị KPI tổng hợp sau mỗi lần chạy VRP:
  - Số chuyến xe được tạo
  - Tổng số điểm giao đã xếp / không xếp được
  - Tổng quãng đường (km) và tổng thời gian dự kiến (phút)
  - Tổng trọng lượng hàng (kg)
  - Tỷ lệ sử dụng tải trọng trung bình (%)
  - Số điểm giao trung bình / chuyến
  - Thời gian solver giải bài toán (ms)
- [ ] Biểu đồ thanh (bar chart) hiển thị **mức sử dụng tải trọng từng xe**: xanh (<70%), vàng (70-90%), đỏ (>90%)
- [x] Cảnh báo nổi bật nếu có shipment **không xếp được** (unassigned) kèm lý do gợi ý (vượt tải, thiếu xe)
- [x] Cảnh báo nếu xe nào bị **quá tải** (vượt capacity)

### US-TMS-01b: Điều chỉnh kế hoạch thủ công
**As a** điều phối viên  
**I want to** điều chỉnh lại kế hoạch vận tải sau khi xem kết quả tối ưu  
**So that** linh hoạt xử lý các tình huống thực tế mà thuật toán chưa tính

**Acceptance Criteria:**
- [ ] **Kéo thả (drag & drop)** một điểm giao từ chuyến này sang chuyến khác
- [ ] **Sắp xếp lại thứ tự** điểm giao trong cùng 1 chuyến (kéo lên/xuống)
- [ ] Khi điều chỉnh, tải tích lũy (cumulative_load_kg) tự động **tính lại** real-time
- [ ] Hiển thị cảnh báo khi thao tác khiến xe **vượt tải trọng** cho phép
- [x] **Gán tài xế** cho từng chuyến từ danh sách tài xế khả dụng (dropdown) *(Impl: trip_assignments trong approve API)*
- [x] Nút **"Chạy lại VRP"** — cho phép tối ưu lại toàn bộ từ đầu nếu không hài lòng *(Impl: POST /v1/planning/run-vrp)*
- [x] Nút **"Duyệt kế hoạch"** — xác nhận tạo Trip sau khi điều chỉnh xong *(Impl: POST /v1/planning/approve)*

### US-TMS-01c: Bản đồ tuyến đường chuyến xe
**As a** điều phối viên / quản lý  
**I want to** xem bản đồ hiển thị tuyến đường thực tế (theo đường bộ) của từng chuyến xe  
**So that** đánh giá trực quan lộ trình và phát hiện bất thường

**Acceptance Criteria:**
- [x] Bản đồ hiển thị: điểm kho xuất phát (icon kho) + các điểm giao (icon số thứ tự) + tuyến đường nối
- [x] Tuyến đường vẽ theo **đường bộ thực tế** (sử dụng OSRM routing), không phải đường thẳng *(Impl: OSRM Docker container port 5000)*
- [x] Popup mỗi điểm giao: Tên NPP, Địa chỉ, Trọng lượng, Trạng thái
- [x] Fallback: Nếu OSRM không phản hồi → vẽ đường thẳng nét đứt

### US-TMS-01d: Tối ưu chi phí vận chuyển (Cost Engine)
**As a** điều phối viên / quản lý  
**I want to** hệ thống tối ưu tuyến đường theo tổng chi phí (VND) = xăng/dầu + phí cầu đường, thay vì chỉ tối ưu quãng đường  
**So that** giảm tổng chi phí vận chuyển thực tế (phí toll chiếm 30-40% chi phí route tại VN)

**Acceptance Criteria:**
- [x] Planning tự động chạy theo cost mode khi dữ liệu cost đã đủ (`cost readiness`); không còn toggle tay riêng cho cost optimize
- [x] Chi phí mỗi tuyến = fuel_cost_per_km × khoảng cách + phí toll (trạm BOT + cao tốc)
- [x] Solver sử dụng `SetArcCostEvaluatorOfVehicle` — chi phí khác nhau theo loại xe (toll class L1-L5)
- [x] Kết quả hiển thị cost_breakdown cho mỗi chuyến: xăng/dầu, cầu đường, tổng chi phí, chi phí/tấn
- [x] Summary: tổng chi phí, tổng xăng/dầu, tổng toll, chi phí/tấn trung bình
- [x] Phát hiện toll hybrid: dùng OSRM route geometry trên đường thực tế; cost mode dùng `exclude=toll` và không proximity-detect lại để tránh false positive

### US-TMS-01e: Quản lý biểu phí vận chuyển (Cost Admin)
**As a** admin / điều phối viên  
**I want to** quản lý biểu phí toll, chi phí nhiên liệu theo loại xe, phụ phí tài xế  
**So that** dữ liệu chi phí luôn cập nhật cho cost engine

**Acceptance Criteria:**
- [x] CRUD trạm thu phí (tên, vị trí GPS, phí 5 hạng xe L1-L5, ngày hiệu lực)
- [x] CRUD cao tốc + cổng thu phí (giá/km 5 hạng, danh sách cổng với km_marker)
- [x] Chi phí mặc định theo loại xe: mức tiêu hao nhiên liệu, giá xăng/dầu, hạng toll
- [x] Override chi phí riêng cho từng xe (profile > default > fallback)
- [x] CRUD phụ phí tài xế: phụ cấp/chuyến, tiền ăn, phí đêm, overweight bonus
- [x] Migration 020 + 025/026: dữ liệu toll miền Bắc thực tế (trạm hở + cao tốc + gate), 4 vehicle type defaults, 5 driver rates; frontend có trang quản trị chi phí `/dashboard/settings/transport-costs`

### US-TMS-01f: Giả lập GPS trên tuyến đã phân công
**As a** điều phối viên  
**I want to** giả lập vị trí xe GPS trên các tuyến giao hàng đã được phân công (approved)  
**So that** test và demo control tower, GPS tracking, bản đồ realtime mà không cần xe thật

**Acceptance Criteria:**
- [x] API start/stop/status tại `/v1/gps/simulate/`
- [x] Tự load active trips từ DB theo trạng thái thực tế (`planned`, `assigned`, `ready`, `in_transit`, `pre_check`); có thể fallback demo routes khi cần
- [x] Hỗ trợ chọn trip IDs cụ thể hoặc use_demo=true cho demo routes
- [x] Speed multiplier: speed_mul=2 → xe chạy nhanh gấp đôi (rút ngắn demo)
- [x] GPS data publish qua Hub.PublishGPS → Redis → WebSocket → dispatch center UI
- [x] Dừng giao hàng mỗi điểm 15-45s, GPS jitter ±5m, heading thực tế

### US-TMS-02: Tối ưu Shuttle Run (HL ↔ Đông Mai)
**As a** điều phối viên  
**I want to** hệ thống đề xuất lịch shuttle tối ưu giữa 2 nhà máy  
**So that** giảm tỷ lệ xe chạy rỗng chiều về

**Acceptance Criteria:**
- [ ] Shuttle chạy **theo nhu cầu** (không lịch cố định)
- [ ] Khi auto-planning phát hiện: Xe giao hàng xong tại khu vực gần Đông Mai + Đông Mai cần chuyển hàng về HL (hoặc ngược lại) → gợi ý ghép chiều về
- [ ] Dashboard hiển thị tỷ lệ xe rỗng chiều về (target: giảm dần)
- [ ] Hàng trung chuyển: cả thành phẩm và bán thành phẩm

### US-TMS-03: Quản lý giờ cấm tải
**As a** admin / điều phối viên  
**I want to** cấu hình bảng giờ cấm tải  
**So that** auto-planning né được giờ cấm

**Acceptance Criteria:**
- [ ] Bảng cấu hình: Khu vực / Tuyến đường + Khung giờ cấm + Loại xe áp dụng
- [ ] Admin cập nhật **thủ công** (không có nguồn tự động)
- [ ] Auto-planning sử dụng bảng này làm ràng buộc
- [ ] Cảnh báo khi Trip dự kiến vi phạm giờ cấm

### US-TMS-04: Quản lý xe thuê ngoài
**As a** điều phối viên  
**I want to** đưa xe thuê ngoài vào hệ thống  
**So that** quản lý tương tự xe nội bộ

**Acceptance Criteria:**
- [ ] Thêm xe thuê ngoài vào danh mục xe với flag "Thuê ngoài"
- [ ] Nhập thông tin: Biển số, Tải trọng, Nhà cung cấp xe, Tài xế thuê
- [ ] Auto-planning xếp xe thuê ngoài tương tự xe nội bộ
- [ ] Báo cáo phân tách chi phí xe nội bộ vs thuê ngoài

### US-TMS-05: Quản lý khung giờ giao hàng theo thời kỳ
**As a** admin  
**I want to** cấu hình khung giờ giao chuẩn theo từng thời kỳ  
**So that** linh hoạt điều chỉnh theo chính sách

**Acceptance Criteria:**
- [ ] Mặc định: 1 giờ (R07)
- [ ] Admin có thể thay đổi khung giờ với hiệu lực: Từ ngày → Đến ngày
- [ ] Lưu lịch sử thay đổi
- [ ] Auto-planning và báo cáo OTD sử dụng khung giờ đang hiệu lực

## 5.3 Module: Driver App (Ứng dụng Tài xế)

### US-TMS-10: Checklist kỹ thuật trước chuyến
**As a** tài xế  
**I want to** thực hiện checklist kỹ thuật xe trên app  
**So that** đảm bảo an toàn và có bằng chứng lưu trữ

**Acceptance Criteria:**
- [x] Danh mục kiểm tra (cấu hình được): Phanh, Lốp, Đèn, Gương, Nước làm mát, Dầu... *(Impl: 12 items cố định + fuel_level)*
- [x] Mỗi mục: Đạt / Không đạt
- [x] **Bắt buộc chụp ảnh** tổng quát xe (tối thiểu 1 ảnh) *(Impl: photo_urls field, chưa enforce bắt buộc)*
- [ ] Nếu có mục "Không đạt" → ghi chú + ảnh chi tiết → thông báo Đội trưởng *(Chưa có notification tự động)*
- [x] Checklist phải hoàn thành **trước khi** nhận lệnh vận chuyển *(Impl: pass = all_true + fuel ≥ 20%)*
- [◐] App hoạt động trên **iOS và Android** *(Impl: Next.js PWA standalone, chưa native — DEC-001)*

### US-TMS-11: Nhận lệnh vận chuyển
**As a** tài xế  
**I want to** nhận Trip được giao trên app  
**So that** biết lịch trình giao hàng

**Acceptance Criteria:**
- [x] Hiển thị danh sách điểm giao theo thứ tự tối ưu (không giới hạn số điểm)
- [x] Mỗi điểm giao hiển thị: Tên NPP, Địa chỉ, SĐT, Sản phẩm, Số lượng, Ghi chú *(Impl: Stop cards với thông tin đầy đủ + customer phone)*
- [x] Hiển thị rõ trạng thái **từng điểm giao** (chưa giao / đang giao / đã giao / thất bại) *(Impl: pending/arrived/delivering/delivered/failed/skipped)*
- [x] Nút "Bắt đầu chuyến" → kích hoạt GPS tracking *(Impl: POST /v1/driver/trips/:id/start + useGpsTracker hook)*
- [x] Nút "Mở bản đồ" → mở Google Maps/Apple Maps điều hướng *(Impl: Google Maps deep link)*

### US-TMS-12: GPS Tracking thời gian thực
**As a** điều phối viên  
**I want to** xem vị trí tất cả xe trên bản đồ  
**So that** giám sát tiến trình giao hàng — xem tiến độ và kết quả theo điểm giao (TMS-03)

**Acceptance Criteria:**
- [x] GPS lấy từ **điện thoại tài xế** (không thiết bị gắn xe)
- [x] Tần suất gửi vị trí: mỗi 30 giây khi xe đang chạy *(Impl: useGpsTracker hook, batch upload lên tới 1000 points)*
- [x] Bản đồ dashboard: Hiển thị tất cả xe đang chạy (icon theo trạng thái) *(Impl: /dashboard/map với biển số, tên TX, trạng thái trip)*
- [x] Lưu lịch sử tuyến đường (route history) theo ngày *(Impl: gps_tracks table)*
- [◐] Phát hiện xe dừng quá lâu tại 1 điểm → cảnh báo (ngưỡng cấu hình được) *(Impl: idle_vehicle anomaly type + KPI IdleVehicles count, threshold hardcoded 5 min)*

### US-TMS-13: Xác nhận giao hàng (ePOD)
**As a** tài xế  
**I want to** xác nhận giao hàng tại điểm giao  
**So that** có bằng chứng điện tử

**Acceptance Criteria:**
- [x] Khi đến điểm giao → app ghi nhận GPS arrival (tự động detect khoảng cách) *(Impl: action "arrive" update stop status)*
- [x] **Tài xế thông báo miệng cho NPP** dựa trên thông tin đơn trên app (R13)
- [x] NPP xác nhận đúng → Tiến hành **hạ hàng TRƯỚC** (R03) *(Impl: "delivering" intermediate step)*
- [x] Nhập số lượng **thực giao** cho từng SKU (có thể khác đơn nếu giao thiếu)
- [x] **Chụp ảnh chứng từ** (ít nhất 1 ảnh) *(Impl: service validate `len(photo_urls) > 0` trước khi tạo ePOD)*
- [x] Xác nhận giao hàng trên app → Hệ thống **gửi tin nhắn Zalo kèm link xác nhận cho NPP** (silent consent 24h — R13) *(Impl: integration hook auto-trigger)*
- [x] Trạng thái cập nhật real-time về OMS

### US-TMS-14: Xử lý ngoại lệ giao hàng
**As a** tài xế  
**I want to** ghi nhận các tình huống bất thường  
**So that** có dữ liệu xử lý và truy vết

| Tình huống | Xử lý trên App | Ghi chú |
|-----------|----------------|---------|
| Khách **từ chối nhận** | Chọn "Từ chối" → Nhập lý do (dropdown + text) → Chụp ảnh → **Hủy đơn**, tạo đơn mới nếu cần | *(Impl: rejected → chỉ hủy, không giao lại — Session 22/03)* |
| **Giao thiếu** | Nhập số lượng thực giao < đơn → Xác nhận với NPP → **Nút "Giao bổ sung"** | Giao bổ sung không giới hạn (R05) |
| **Giao sai hàng** | Ghi chú "Giao sai" → Xác nhận thực tế với NPP → Báo điều phối | Tra soát: ai sai người đó chịu |
| **KH đổi địa chỉ** | Cập nhật địa chỉ mới trên app → Thông báo điều phối | |
| **Xe hỏng giữa đường** | Chọn "Sự cố xe" → Mô tả + Ảnh → Thông báo tự động cho điều phối | Điều xe thay thế |
| **Vi phạm GT / Bị giữ** | Chọn "Vi phạm GT" → Mô tả → Thông báo điều phối | |

### US-TMS-14b: Giao bổ sung / Giao lại (Re-delivery)
**As a** điều phối viên / DVKH  
**I want to** tạo lần giao bổ sung cho đơn giao thiếu hoặc thất bại  
**So that** NPP nhận được hàng — tuân thủ R05

**Acceptance Criteria:**
- [x] Từ đơn `partially_delivered` hoặc `failed` → nút "📦 Giao bổ sung" (brand #F68634)
- [x] **Không giới hạn số lần giao lại** cho cùng 1 đơn
- [x] Mỗi lần giao lại ghi nhận: Lần thứ mấy, Lý do lần trước thất bại, Ngày giờ
- [x] **Bắt buộc thống kê** số lần giao lại và lý do từng lần (R05, TMS-05)
- [x] Giao lại tạo shipment mới, reset đơn về `confirmed` → xếp Trip mới
- [x] Báo cáo: Số đơn giao lại, Số lần trung bình/đơn, Top lý do thất bại *(Impl: GET /v1/kpi/redeliveries)*
- [x] `rejected` → không cho phép giao bổ sung, user nên hủy đơn và tạo mới *(Impl: Session 22/03)*
- [x] `delivered` → không cho phép giao bổ sung (đã giao xong) *(Impl: Session 22/03)*

### US-TMS-15: Thu tiền / Ghi nhận công nợ
**As a** tài xế  
**I want to** ghi nhận thu tiền hoặc công nợ tại điểm giao  
**So that** đối soát được khi về công ty

**Acceptance Criteria:**
- [x] Hiển thị số tiền cần thu (tự động từ đơn hàng)
- [x] **3 lựa chọn thanh toán:** *(Impl: 5 phương thức — cash, transfer, credit, cod, partial)*
  - **Tiền mặt:** Nhập số tiền thu → app tính tiền thừa (nếu có)
  - **Chuyển khoản:** Tài xế chọn → Hiển thị TK công ty → Điều vận xác nhận. **Timeout** nếu không xác nhận (Admin cấu hình) → escalation cấp trên
  - **Công nợ:** Tài xế chọn "Ghi nợ" → Hệ thống ghi nhận công nợ cho NPP (R04)
- [x] **Cho phép hạ hàng TRƯỚC khi xác nhận thanh toán** (R03) *(Impl: ePOD trước payment)*
- [x] Thu tiền **không bắt buộc** — đơn có thể hoàn tất giao dù chưa thu tiền (R04) *(Impl: payment_method=credit)*
- [ ] Chụp ảnh phiếu thu / biên lai (nếu có) *(Photo URL field có, chưa enforce)*
- [x] Trạng thái thu tiền **độc lập** với trạng thái giao hàng: Đã thu / Chưa thu / Thu một phần / Công nợ (FIN-03) *(Impl: payment.status enum)*

### US-TMS-16: Thu vỏ
**As a** tài xế  
**I want to** ghi nhận vỏ thu hồi tại điểm giao  
**So that** đối trừ công nợ vỏ cho NPP

**Acceptance Criteria:**
- [x] Sau khi giao hàng → chuyển sang bước thu vỏ
- [x] Nhập số lượng theo loại: Chai (đơn vị: cái), Két/Vỏ (đơn vị: keg), Keg, Pallet, CCDC (R14) *(Impl: bottle, crate, keg, pallet)*
- [x] Phân loại: **Tốt** / **Hỏng** *(Impl: good, damaged, lost)*
- [ ] Nếu khai **vỏ hỏng** → **bắt buộc chụp ảnh** làm bằng chứng *(Impl: photo_url field có, chưa enforce)*
- [x] Vỏ tốt → đối trừ công nợ vỏ NPP *(Impl: asset_ledger entry auto)*
- [x] Vỏ hỏng/mất/sứt → **bồi hoàn theo đơn giá hiệu lực từng thời kỳ** (R10) — NPP chịu *(Impl: WMS asset compensation endpoint)*
- [x] **Sai lệch vỏ = 0** theo chuyến (R02): Nếu phân xưởng đếm khác số tài xế khai → **lái xe chịu trách nhiệm**

### US-TMS-17: Hoàn chứng từ & Bàn giao B + C (về công ty)
**As a** tài xế  
**I want to** hoàn tất chuyến khi về công ty với 3 bàn giao song song, mỗi bàn giao có ký số  
**So that** kết thúc Trip với biên bản số đầy đủ (R17, R18)

**Acceptance Criteria:**
- [x] App hiển thị tổng kết chuyến: Tiền đã thu, Tiền công nợ, Vỏ đã thu, Trạng thái từng điểm
- [x] **Bàn giao B — Vỏ:** Tài xế khai số vỏ trên app → Phân xưởng đếm độc lập và nhập vào hệ thống → Cả 2 ký số → biên bản B tự động *(Impl: WMS return inbound)*
  - Chênh lệch → lái xe chịu (R02, R17)
  - Trip → `unloading_returns` khi B đang xử lý
- [x] **Bàn giao C — Tiền:** KT đếm tiền mặt cùng lái xe → KT xác nhận nhận đủ hoặc ghi chênh lệch → Cả 2 ký số → biên bản C tự động
  - Thiếu tiền → tài xế bổ sung trong T+1; Thừa → ghi vào công nợ NPP
  - Trip → `settling` khi C đang xử lý
- [x] Nộp sổ giao hàng, sổ thu vỏ cho DVKH → xác nhận trên hệ thống *(Impl: EOD checkpoint system — POST /v1/driver/trips/:id/eod/checkpoint/:cpType/submit)*
- [x] Trip → `Completed` khi tất cả Bàn giao A + B + C đã có ký số 2 bên *(Impl: POST /v1/driver/trips/:id/complete)*

### US-TMS-18: Bàn giao xe cuối ca
**As a** tài xế  
**I want to** checklist cuối ca và bàn giao xe  
**So that** ghi nhận tình trạng xe sau ca

**Acceptance Criteria:**
- [x] Checklist cuối ca (tương tự đầu ca, cấu hình được) *(Impl: Post-trip checklist modal 6 items trên Driver App)*
- [ ] Nếu phát hiện hư hỏng → tạo **yêu cầu sửa chữa** (ghi mô tả + ảnh)
- [ ] Bàn giao chìa khóa cho Đội trưởng/Đội phó → xác nhận trên app

## 5.4 Module: Quản lý phương tiện & Bảo trì

### US-TMS-20: Hồ sơ phương tiện
**As a** quản lý đội xe  
**I want to** quản lý thông tin từng xe  
**So that** có hồ sơ đầy đủ

**Acceptance Criteria:**
- [x] Thông tin xe: Biển số, Loại xe, Tải trọng, Thể tích thùng, Năm SX *(Impl: vehicles CRUD 6 endpoints)*
- [x] Giấy tờ: Đăng ký (ngày hết hạn), Kiểm định (ngày hết hạn), Bảo hiểm (ngày hết hạn) *(Impl: vehicle_documents table + CRUD + document_expiry_cron)*
- [x] Phân loại: Nội bộ / Thuê ngoài *(Impl: is_external boolean + supplier_name trên vehicles)*
- [x] Trạng thái: Hoạt động / Đang sửa chữa / Tạm dừng *(Impl: active/maintenance/inactive)*

### US-TMS-21: Lịch bảo dưỡng định kỳ
**As a** quản lý đội xe  
**I want to** hệ thống nhắc lịch bảo dưỡng  
**So that** không bỏ sót

**Acceptance Criteria:**
- [◐] Thiết lập lịch bảo dưỡng theo: Km đã chạy HOẶC Thời gian (tuần/tháng) *(Impl: vehicle_maintenance_schedules + records schema, CRUD API — chưa có cron auto-overdue)*
- [◐] Cảnh báo trước X ngày (cấu hình được) khi đến hạn bảo dưỡng/kiểm định/bảo hiểm *(Impl: alert_days_before field có, chưa wire cron)*
- [ ] Cảnh báo gửi qua **Web + Mobile App** cho quản lý đội xe
- [ ] Xe quá hạn kiểm định/bảo hiểm → **tự động loại khỏi danh sách xe khả dụng** cho auto-planning

### US-TMS-22: Hồ sơ tài xế
**As a** quản lý đội xe  
**I want to** quản lý thông tin tài xế  
**So that** kiểm soát điều kiện lái xe

**Acceptance Criteria:**
- [x] Thông tin: Họ tên, CCCD, SĐT, Địa chỉ *(Impl: drivers CRUD 7 endpoints)*
- [x] Bằng lái: Loại, Ngày cấp, Ngày hết hạn
- [x] Trạng thái: Đang làm việc / Nghỉ phép / Đã nghỉ *(Impl: active/on_leave/terminated)*
- [x] Cảnh báo khi bằng lái sắp hết hạn *(Impl: driver_documents + document_expiry_cron → dispatcher notification)*

## 5.5 Trạng thái Trip (Trip Status Flow)
```
Created (Auto-planning tạo)
  → Assigned (Điều phối duyệt, gán xe + tài xế)
    → Checked (Tài xế hoàn thành checklist kỹ thuật)
      → Loading (Kho đang đóng hàng, Thủ kho + Bảo vệ + Lái xe kiểm đếm)
        → Handover_A_Signed (Bàn giao A: 3 bên ký số, sai lệch = 0 — Bảo vệ mở barrier)
          → In Transit (Xe đã xuất phát)
            → At Stop #N (Đang tại điểm giao thứ N)
              [Mỗi Stop: Delivered / Partial / Rejected / Re-delivery]
              → Returning (Đã giao xong tất cả điểm, đang về)
                → Unloading_Returns (Bàn giao B: nhập vỏ, Lái xe + Phân xưởng ký số)
                  → Settling (Bàn giao C: nộp tiền, Lái xe + KT ký số)
                    → Reconciled (Đối soát cuối chuyến hoàn tất)
                      → Completed (Hoàn tất)
  → Cancelled (Hủy chuyến)
  → Vehicle_Breakdown (Xe hỏng giữa đường — xem kịch bản KC-1..4)
```

---

# 6. PHÂN HỆ WMS — QUẢN LÝ KHO

## 6.1 Tổng quan
WMS quản lý kho: sơ đồ vị trí → nhập xuất → FIFO/FEFO → quản lý tài sản quay vòng.

> **v3.2:** Không dùng PDA ở khâu xuất kho. Thủ kho pick thủ công theo gợi ý FEFO trên hệ thống (Web/Tablet). Kiểm đếm xuất kho do Thủ kho + Bảo vệ + Lái xe thực hiện cùng nhau tại khu vực xếp hàng — không có bước kiểm đếm riêng tại cổng. PDA chỉ dùng cho nhập kho và kiểm kê.

**Quy tắc bắt buộc:**
- WMS-01: Quản lý vị trí hàng trong kho
- WMS-02: Theo dõi hạn dùng + cảnh báo cận hạn theo ngưỡng
- WMS-03: Thủ kho + Bảo vệ + Lái xe cùng kiểm đếm và ký Bàn giao A — sai lệch = 0 (R01, R16)
- WMS-04: Sai lệch vỏ = 0 theo chuyến, Phân xưởng đếm là chuẩn (R02, R17)

## 6.2 Module: Quản lý Kho & Vị trí

### US-WMS-01: Sơ đồ kho (Layout/Bin/Location)
**As a** thủ kho  
**I want to** quản lý vị trí lưu trữ trong kho  
**So that** biết hàng nằm ở đâu

**Acceptance Criteria:**
- [x] Cấu trúc: Kho → Khu vực (Zone) → Dãy (Aisle) → Vị trí (Bin/Location) *(Impl: locations CRUD với code/warehouse_id)*
- [x] Mỗi vị trí có: Mã vị trí, Loại (Thành phẩm / Vỏ / Keg / Pallet), Sức chứa tối đa
- [x] Hỗ trợ **2 kho hiện tại, mở rộng tới 8 kho** (bao gồm kho thuê ngoài thời vụ) *(Impl: WH-HL + WH-HP)*
- [ ] Giao diện trực quan sơ đồ kho (không yêu cầu 3D, dạng grid/table OK)
- [x] Truy xuất được vị trí lưu trữ theo lô hàng

### US-WMS-02: Nhập kho (Inbound)
**As a** thủ kho  
**I want to** nhập hàng từ sản xuất vào kho  
**So that** cập nhật tồn kho

**Acceptance Criteria:**
- [x] Tạo phiếu nhập: Nguồn (Từ sản xuất / Từ trả hàng / Từ trung chuyển), Sản phẩm, Số lượng, Lô (Batch), Ngày SX, Hạn sử dụng *(Impl: POST /v1/warehouse/inbound)*
- [x] **Quét mã vạch bằng PDA** để xác nhận nhập → tự động gán vị trí kho *(Impl: PWA barcode scanner)*
- [x] Gán vị trí lưu trữ (hệ thống gợi ý theo FIFO/FEFO + vị trí trống)
- [x] Cập nhật tồn kho real-time *(Impl: stock_quants + lots tables)*

### US-WMS-03: Xuất kho / Đóng hàng & Bàn giao A
**As a** thủ kho  
**I want to** xuất hàng theo lệnh đóng hàng, kiểm đếm chung 3 bên, ký Bàn giao A  
**So that** có số liệu bàn giao rõ ràng và biên bản số ký bởi 3 bên (R16)

**Acceptance Criteria:**
- [x] Nhận lệnh đóng hàng từ OMS (tự động khi Shipment được duyệt)
- [x] Hệ thống gợi ý **vị trí pick** theo FEFO (ưu tiên lô cận date) trên màn hình Web/Tablet *(Impl: FEFO sort by expiry_date)*
- [ ] Thủ kho chọn lô thủ công; nếu không lấy lô FEFO gợi ý → **bắt buộc ghi lý do**
- [ ] In hoặc hiển thị **Phiếu xuất kho** trên màn hình để đối chiếu
- [x] **Bàn giao A — Kiểm đếm chung 3 bên** (thực hiện tại khu vực xếp hàng, KHÔNG tại cổng):
  - Thủ kho + Bảo vệ + Lái xe cùng đếm, đối chiếu với Phiếu xuất kho
  - Sai lệch = 0 tuyệt đối (R01, R16)
  - Nếu thiếu → Thủ kho xuất bổ sung ngay; nếu phát hiện đổ vỡ → thay thế
  - Cả 3 bên ký số trên hệ thống → biên bản số tạo tự động
- [x] Sau khi Bàn giao A hoàn tất → Bảo vệ mở barrier cổng, xe xuất phát *(Impl: gate_pass_issued = true)*
- [x] Không có bước kiểm đếm riêng tại cổng — Bàn giao A là điểm kiểm soát duy nhất *(Impl: gate_checks là pass/fail, không item-level counting)*

### US-WMS-04: Bảo vệ mở cổng sau Bàn giao A
**As a** bảo vệ cổng  
**I want to** chỉ mở barrier sau khi nhận được xác nhận Bàn giao A hoàn tất  
**So that** đảm bảo xe chỉ xuất khi hàng đã kiểm đếm xong (R16)

**Acceptance Criteria:**
- [x] Barrier cổng chỉ mở khi `handover_a_status = completed` trên hệ thống *(Impl: gate_pass_issued flag)*
- [x] Bảo vệ xác nhận trên Web/Mobile: "Cho phép xuất — Biển số [XX-XXXXX]"
- [x] Ghi nhận thời gian xe ra cổng
- [◐] Nếu Bàn giao A chưa hoàn tất → không mở barrier, thông báo Thủ kho và Điều phối *(Impl: gate_pass_issued blocks barrier, thông báo chưa wire)*
- [x] **Không có bước kiểm đếm tại cổng** — kiểm đếm đã thực hiện đầy đủ trong Bàn giao A *(Impl: gate_checks = pass/fail, không đếm item)*

## 6.3 Module: Quản lý Hạn sử dụng & Chất lượng

### US-WMS-10: FIFO/FEFO tự động
**As a** hệ thống  
**I want to** luôn gợi ý xuất lô cận date trước  
**So that** tránh hàng hết hạn trong kho

**Acceptance Criteria:**
- [x] **Bia tươi / Bia hơi (Keg):** Bắt buộc FEFO (First Expired First Out) *(Impl: FEFO picking sort)*
- [x] **Bia chai, bia lon, nước giải khát:** FIFO (First In First Out)
- [x] Khi tạo picking list → tự động sắp xếp theo nguyên tắc trên
- [x] Nếu thủ kho pick sai lô (quét mã vạch không khớp lô gợi ý) → **cảnh báo** (cho phép override có ghi lý do)

### US-WMS-11: Cảnh báo lô cận date
**As a** quản lý kho  
**I want to** được cảnh báo khi hàng sắp hết hạn  
**So that** ưu tiên đẩy bán

**Acceptance Criteria:**
- [x] Ngưỡng cảnh báo: **Cấu hình được theo loại sản phẩm** (ví dụ: quá 1/3 hạn sử dụng) — WMS-02 *(Impl: GET /v1/warehouse/expiry-alerts)*
- [x] Có **trường ngưỡng cận hạn** và cảnh báo khi đạt ngưỡng
- [x] Cảnh báo hiển thị trên dashboard WMS *(Impl: /dashboard/warehouse)*
- [ ] Gửi thông báo **Web + Mobile App** cho quản lý kho + DVKH (để ưu tiên lên đơn)
- [x] Danh sách hàng cận date: SKU, Lô, Số lượng, Ngày hết hạn, Vị trí kho

## 6.4 Module: Mã vạch & PDA

### US-WMS-15: Quản lý mã vạch & PDA (Nhập kho và Kiểm kê)
**As a** hệ thống  
**I want to** hỗ trợ quét mã vạch trên PDA  
**So that** thay thế đếm thủ công

> PDA chỉ dùng cho **nhập kho** và **kiểm kê định kỳ**. Xuất kho thực hiện thủ công (xem US-WMS-03).

**Acceptance Criteria:**
- [x] Mã vạch được **in và dán tại khâu sản xuất**
- [x] Cấp độ mã vạch: Vỏ bia hơi (Keg) — từng vỏ; Keg bia chai — từng keg; Thùng — từng thùng
- [x] Thông tin encode: Mã SKU, Mã Lô (Batch), Ngày SX
- [x] PDA quét → hệ thống tra cứu → hiển thị đầy đủ thông tin sản phẩm *(Impl: POST /v1/warehouse/barcode-scan)*
- [x] Sử dụng tại: **Nhập kho** và **Kiểm kê** *(Impl: PWA PDA scanner page)*
- [ ] **Không dùng PDA** cho xuất kho picking hoặc gate check — thủ công + ký số thay thế

## 6.5 Module: Tài sản quay vòng (Returnable Assets)

### US-WMS-20: Quản lý vòng đời tài sản
**As a** quản lý CCDC  
**I want to** theo dõi từng loại tài sản quay vòng  
**So that** kiểm soát mất mát

**Acceptance Criteria:**
- [x] Loại tài sản: Vỏ chai, Két nhựa, Keg, Pallet, CCDC *(Impl: asset_type enum)*
- [x] Danh mục chuẩn cho từng loại (RA-01)
- [x] Quy đổi: Vỏ bia hơi theo **CÁI** (RA-02), Vỏ bia chai theo **KEG** (RA-03)
- [x] Trạng thái: Trong kho → Trên xe → Tại NPP → Thu hồi → Phân loại → Nhập lại kho *(Impl: asset_ledger tracking)*
- [x] Số lượng theo dõi theo: Loại + Trạng thái + NPP (ai đang giữ bao nhiêu)
- [ ] Theo dõi tuổi thọ / vòng quay (số lần sử dụng) để đánh giá hiệu quả đầu tư

### US-WMS-21: Đối trừ công nợ vỏ tự động
**As a** hệ thống  
**I want to** tự động trừ công nợ vỏ khi tài xế thu về  
**So that** không cần đối chiếu thủ công

**Acceptance Criteria:**
- [x] Khi tài xế nhập vỏ thu hồi trên Driver App (US-TMS-16) → dữ liệu về WMS
- [x] Hệ thống phân loại: **Vỏ tốt** → trừ công nợ NPP; **Vỏ hỏng** → KHÔNG trừ (NPP chịu) *(Impl: good→reusable stock, damaged→scrap)*
- [x] Vỏ hỏng có **ảnh bắt buộc** làm bằng chứng (từ Driver App)
- [x] Vỏ hỏng/mất/sứt → **bồi hoàn theo đơn giá hiệu lực từng thời kỳ** (R10) *(Impl: asset compensation endpoint)*
- [x] Cập nhật bảng công nợ vỏ theo NPP real-time
- [◐] Đẩy dữ liệu công nợ vỏ sang **Bravo** để hạch toán *(Impl: BravoAdapter có PushDeliveryDocument(), chưa wire vào delivery hook)*

### US-WMS-21b: Bảng đơn giá bồi hoàn vỏ
**As a** admin  
**I want to** quản lý bảng đơn giá bồi hoàn vỏ theo từng thời kỳ  
**So that** tính chính xác tiền bồi hoàn

**Acceptance Criteria:**
- [ ] Bảng riêng: Loại vỏ + Đơn giá bồi hoàn + Từ ngày → Đến ngày (hiệu lực)
- [ ] Admin cập nhật khi có thay đổi
- [ ] Hệ thống tự động áp đúng đơn giá theo thời điểm phát sinh
- [ ] Lưu lịch sử thay đổi

### US-WMS-22: Bàn giao B — Nhập vỏ tại phân xưởng
**As a** nhân viên phân xưởng  
**I want to** đếm độc lập, đối chiếu với khai của tài xế, cả 2 ký số  
**So that** sai lệch vỏ = 0, có biên bản số B (R17)

**Acceptance Criteria:**
- [x] Tài xế khai số vỏ trên Driver App trước khi về kho
- [x] Phân xưởng đếm thực tế + phân loại (Tốt / Hỏng / Hủy) trên hệ thống *(Impl: POST /v1/warehouse/returns/process)*
- [x] Nếu chênh lệch → **lái xe chịu trách nhiệm** (R02, R17); ghi nhận chênh lệch
- [x] Phân xưởng ký số xác nhận → Lái xe ký nhận chênh lệch (nếu có) → biên bản B tạo tự động
- [x] Tạo phiếu nhập vỏ
- [x] **Phân xưởng đếm là chuẩn** (R02)

---

## 6.6 Module: Pallet · QR · Bin · Cycle Count (Phase 9 — Bổ sung 23/04/2026)

> **Bối cảnh quyết định (DEC-WMS-01..03):** BHL là nhà máy sản xuất bia + phân phối. Hàng từ NMSX → kho thành phẩm đã được **đóng pallet trước**. Toàn bộ vận hành kho mới sẽ chạy theo mô hình **QR-driven, scan-to-X, hybrid PDA + Smartphone PWA**. **FEFO là nguyên tắc duy nhất** (không thêm FIFO theo received_at — bỏ yêu cầu FIFO ban đầu vì chu kỳ bia ngắn, FEFO đã đủ kiểm soát HSD).
>
> **Phạm vi loại trừ:** KHÔNG bao gồm tính giá thành kế toán (cost layer / FIFO valuation / COGS). Chỉ quản lý **số lượng vật lý**. Bravo tích hợp ở pha sau (DEC-WMS-04).

### 6.6.1 Chuẩn QR & nhãn (theo thực tiễn ngành bia thế giới)

| Cấp QR | Format | Khổ nhãn khuyến nghị | Vật liệu | Sinh khi |
|---|---|---|---|---|
| **Pallet (LPN)** | `BHL-LP-YYYYMMDD-NNNNNN` (GS1 SSCC `(00)…`) | **100×150 mm** (A6) — chuẩn industry FMCG | Nhựa PP/PET cán bóng, keo chịu ẩm | NMSX đóng pallet xong → in & dán trước khi nhập kho |
| **Lot/Batch** | `BHL-LOT-{sku}-{prod_date}-{batch}` (GS1 GTIN+LOT+EXP) | **70×40 mm** | Decal coated paper | Từ NMSX, đã có sẵn trên thùng |
| **Bin** | `BHL-BIN-{wh}-{zone}-{row}-{level}` | **50×30 mm** | PVC/Aluminum dán cố định kệ | Setup kho 1 lần |
| **Asset** (keg/két lưu động) | `BHL-AST-{type}-{seq}` | 30×20 mm | Khắc laser hoặc decal nhựa | Khi nhập tài sản mới |

**Máy in nhãn khuyến nghị (theo benchmark Heineken/Sabeco/Carlsberg):**
- **Industrial — kho HL & HP:** Zebra **ZT231** (203 dpi) hoặc TSC TTP-244 Pro — in pallet label A6 liên tục.
- **Desktop — bàn nhập kho/phân xưởng:** Zebra **GK420t** hoặc Brother QL-820NWB — in nhãn nhỏ on-demand.
- **Chuẩn ngôn ngữ máy in:** ZPL (Zebra Programming Language) — backend sinh ZPL string, gửi qua WebUSB/network.

### 6.6.2 Thiết bị scan (Hybrid: PDA + Smartphone)

| Đối tượng | Thiết bị | Lý do |
|---|---|---|
| Thủ kho chính, soạn hàng cường độ cao | **PDA Zebra TC22 / Honeywell EDA52** (Android, 1D/2D laser engine) | Quét nhanh < 0.3s, chịu rơi, pin trâu, thao tác 1 tay |
| Bảo vệ, phân xưởng, dispatcher kiểm tra, tài xế | **Smartphone Android (PWA + camera scan)** | Tận dụng thiết bị sẵn có, tiết kiệm chi phí, đủ dùng cho < 200 scan/ngày |
| Cycle count (kiểm kê) | Cả 2 đều dùng được | PDA cho kho lớn, phone cho kho nhỏ |

**Frontend:** PWA `/warehouse/scan` chạy chung 1 codebase cho cả PDA và phone — PDA dùng hardware scan key (KeyEvent), phone dùng `BarcodeDetector` API hoặc `@zxing/browser`.

### 6.6.3 User Stories — Phase 9

#### US-WMS-25: License Plate Number (LPN) & Pallet master
**As a** thủ kho nhập hàng  
**I want to** mỗi pallet có 1 LPN duy nhất gắn QR  
**So that** truy vết được vị trí, lô, số lượng từng pallet trong kho

**Acceptance Criteria:**
- [ ] Sinh LPN tự động format `BHL-LP-YYYYMMDD-NNNNNN` khi tạo pallet inbound
- [ ] QR payload theo chuẩn GS1 (SSCC `(00)…`, GTIN `(01)…`, LOT `(10)…`, EXP `(17)…`)
- [ ] Pallet status: `in_stock | reserved | picked | loaded | shipped | empty`
- [ ] 1 pallet = 1 lot duy nhất (không trộn lot — rule cứng để FEFO chính xác)
- [ ] In nhãn pallet (ZPL) ngay khi receive — gửi tới máy in qua HTTP/WebUSB
- [ ] Tra cứu LPN: API trả về lot, qty, current_bin, received_at, lịch sử di chuyển

#### US-WMS-26: Bin location & sơ đồ kho 2D
**As a** trưởng kho  
**I want to** vị trí kho được mã hóa & gắn QR cố định  
**So that** scan biết hàng đặt đúng vị trí

**Acceptance Criteria:**
- [ ] Cấu trúc bin: `warehouse → zone → row → level → bin`, code unique
- [ ] Loại bin: `storage | staging | dock | quarantine`
- [ ] Mỗi bin có `capacity_pallets`, `allowed_sku_categories`, `velocity_class` (A/B/C)
- [ ] Sơ đồ 2D dạng grid/canvas trên trang `/warehouse/bin-map`, click bin xem pallet đang chứa
- [ ] Heatmap occupancy (xanh < 50%, vàng 50-90%, đỏ > 90%)
- [ ] In QR bin label (50×30 mm) hàng loạt cho setup ban đầu

#### US-WMS-27: Inbound putaway theo gợi ý hệ thống
**As a** thủ kho  
**I want to** scan pallet nhập + scan bin → hệ thống xác nhận đúng/sai vị trí  
**So that** không cần ghi nhớ sơ đồ kho, giảm sai sót

**Acceptance Criteria:**
- [ ] Workflow scan: Scan LPN → Scan Bin → Submit → ghi `qr_scan_log` + cập nhật `pallets.current_bin_id`
- [ ] API `POST /warehouse/inbound/suggest-bin` trả 3 gợi ý xếp hạng theo:
  1. Same-SKU consolidation (bin đã chứa cùng lot/SKU)
  2. Velocity class match (SKU A → bin gần dock)
  3. Capacity còn trống
- [ ] Validation: bin phải `is_pickable=true`, còn slot, đúng `allowed_sku_categories`
- [ ] Nếu thủ kho đặt khác bin gợi ý → cho phép nhưng ghi lý do (override)
- [ ] Mỗi pallet sinh 1 `stock_moves` type=inbound liên kết LPN

#### US-WMS-28: Picking scan-by-pallet (FEFO chặt)
**As a** thủ kho soạn hàng  
**I want to** quét chính xác pallet được hệ thống chỉ định theo FEFO  
**So that** không pick nhầm lot, đúng nguyên tắc cận hạn xuất trước

**Acceptance Criteria:**
- [ ] API `POST /warehouse/picking/:id/suggest-pallets` trả danh sách LPN cụ thể theo `lots.expiry_date ASC` (FEFO)
- [ ] Workflow scan: Scan Bin → Scan LPN gợi ý → nhập qty pick → confirm
- [ ] Sai LPN (không phải lot FEFO) → cảnh báo + bắt ghi lý do override
- [ ] Pallet sau pick: nếu hết qty → status `empty`; còn dư → giữ status `in_stock` với qty mới
- [ ] Cập nhật `picking_orders.items[].picked_lpns` để truy vết
- [ ] **Nguyên tắc duy nhất là FEFO** — bỏ yêu cầu FIFO_RECEIVED ban đầu (DEC-WMS-02)

#### US-WMS-29: Loading scan-to-truck
**As a** thủ kho/bảo vệ  
**I want to** quét biển số xe + quét từng LPN khi xếp lên xe  
**So that** đảm bảo hàng lên đúng xe đúng chuyến

**Acceptance Criteria:**
- [ ] Workflow: Scan biển số xe → mở session loading cho trip → Scan LPN → cập nhật `pallets.status='loaded'`
- [ ] Validation: LPN phải thuộc `picking_orders` đã hoàn tất của trip này
- [ ] Hiển thị progress: đã load X/Y pallets
- [ ] Khi đủ → tự động mở Bàn giao A (US-WMS-03) — không phá vỡ flow hiện tại
- [ ] Lệch (load thiếu/thừa) → block submit, alert dispatcher

#### US-WMS-30: Cycle count (kiểm kê quay vòng)
**As a** trưởng kho  
**I want to** kiểm kê theo bin định kỳ thay vì đóng kho 1 lần/năm  
**So that** giữ độ chính xác tồn kho > 99% mà không gián đoạn vận hành

**Acceptance Criteria:**
- [ ] Tự động sinh tasks hàng ngày theo ABC: A (top 80% velocity) → 1 lần/tuần, B → 1 lần/tháng, C → 1 lần/quý
- [ ] Bảng `cycle_count_tasks` (warehouse, bin, scheduled_date, assigned_to, status)
- [ ] Workflow scan: Scan Bin → liệt kê LPN expected → scan từng LPN xuất hiện → submit
- [ ] Lệch (LPN missing / LPN extra / qty mismatch) → tự sinh discrepancy ticket vào module Reconciliation hiện có
- [ ] Trang `/warehouse/cycle-count` hiển thị task hôm nay theo người được giao
- [ ] Báo cáo độ chính xác: `accuracy = 1 - (lệch / expected)` theo kho/tuần

#### US-WMS-31: Scan log & truy vết lô (Traceability)
**As a** quản lý chất lượng / kiểm toán  
**I want to** truy vết toàn bộ hành trình 1 LPN/lot từ NMSX → NPP  
**So that** đáp ứng yêu cầu ATTP (NĐ 15/2018, ISO 22005) và xử lý recall nhanh

**Acceptance Criteria:**
- [ ] Bảng `qr_scan_log` immutable (append-only): scan_type, qr_code, action, user, device, result, timestamp
- [ ] API `GET /warehouse/pallets/:lpn/history` — trả timeline scan + di chuyển
- [ ] API `GET /warehouse/lots/:id/distribution` — lot này hiện ở pallets nào, đã giao NPP nào
- [ ] Recall scenario: nhập lot_id → trả danh sách NPP đã nhận + qty + ngày giao
- [ ] Performance: query 1 LPN < 200ms (index trên lpn_code, scanned_at)

#### US-WMS-32: Realtime stock dashboard & cảnh báo
**As a** trưởng kho / DVKH  
**I want to** thấy tồn kho realtime + cảnh báo chủ động  
**So that** đẩy hàng cận date trước khi mất giá / không hết hàng đột ngột

**Acceptance Criteria:**
- [ ] WebSocket push khi stock thay đổi (Redis pub/sub có sẵn)
- [ ] 4 loại cảnh báo:
  - 🟠 SKU < `safety_stock` (config theo SKU/kho)
  - 🔴 Lot HSD < 30 ngày + qty còn lớn (cần đẩy hàng)
  - 🟡 Bin chiếm > 90% capacity
  - 🟣 LPN "mồ côi" (≥ 7 ngày không di chuyển ở staging area)
- [ ] Trang `/warehouse/dashboard/realtime` hiển thị 4 widget + drill-down
- [ ] Tích hợp notification service hiện có (priority mapping: urgent cho 🔴, high cho 🟠/🟣)

### 6.6.4 Quy tắc bắt buộc bổ sung

- **WMS-05:** 1 pallet = 1 lot duy nhất (không trộn) — đảm bảo FEFO chính xác
- **WMS-06:** Mọi inbound/picking/loading phải scan LPN — không có "nhập tay" trừ khi override + ghi lý do
- **WMS-07:** Phạm vi WMS chỉ quản số lượng vật lý — KHÔNG tính giá vốn / không sinh kế toán bút toán
- **WMS-08:** Bravo integration cho Phase 9 đặt PENDING — phát triển độc lập trước, API kết nối tính sau (DEC-WMS-04)

### 6.6.5 Risks & Mitigation

| Rủi ro | Mitigation |
|---|---|
| Thủ kho ngại scan vì chậm hơn cách cũ | KPI scan compliance + bonus; PDA quét < 0.3s, phone < 1s |
| Nhãn QR pallet bị ướt/bẩn trong kho | Vật liệu PP cán bóng + QR error-correction level H (chịu hỏng 30%) |
| Mất kết nối WiFi ở khu kho xa | PWA offline-first, IndexedDB queue, sync khi có mạng |
| Migration tồn kho cũ → cấu trúc pallet | Tạo "virtual pallet" cho tồn hiện tại (1 lot = 1 virtual LPN), thay dần khi xuất/nhập thực tế |
| Scope creep sang accounting | Lock cứng trong WMS-07; review code mỗi PR |

---

# 7. MODULE ĐỐI SOÁT (RECONCILIATION)

## 7.1 Tổng quan
Đối soát là module khép kín cuối cùng, đảm bảo hàng đi - tiền về - vỏ về khớp tuyệt đối theo từng chuyến và theo ngày.

**Quy tắc bắt buộc:**
- REC-01: Đối soát cuối chuyến gồm hàng giao, tiền thu, vỏ thu
- REC-02: Sai lệch xử lý đến T+1 (T = ngày giao)

### US-REC-01: Đối soát cuối chuyến
**As a** kế toán  
**I want to** xem biên bản đối soát cuối mỗi chuyến  
**So that** kiểm tra khớp hàng-tiền-vỏ

**Acceptance Criteria:**
- [x] Mỗi Trip khi kết thúc → hệ thống tự động tạo **biên bản đối soát chuyến** gồm: *(Impl: POST /v1/reconciliation/trip/:id với 3 types)*
  - Hàng: Số lượng xuất (phiếu xuất) vs Số lượng giao thực tế (ePOD) vs Hàng mang về (nếu có)
  - Tiền: Số tiền phải thu vs Số tiền đã thu (mặt + CK) vs Công nợ ghi nhận
  - Vỏ: Số vỏ tài xế khai thu vs Số vỏ phân xưởng đếm thực tế
- [x] Nếu tất cả khớp → Trạng thái "Reconciled" *(Impl: recon_status = matched)*
- [x] Nếu có sai lệch → Trạng thái "Discrepancy" → Mở hồ sơ xử lý *(Impl: auto-create discrepancy ticket)*

### US-REC-02: Xử lý sai lệch
**As a** kế toán  
**I want to** mở và đóng hồ sơ sai lệch  
**So that** quy trách nhiệm và xử lý dứt điểm

**Acceptance Criteria:**
- [x] Kế toán có quyền **mở hồ sơ sai lệch** (R06)
- [x] Hồ sơ gồm: Mã chuyến, Loại sai lệch (hàng/tiền/vỏ), Số lượng chênh, Người liên quan *(Impl: discrepancy tickets với recon_type)*
- [x] Sai lệch vỏ → **lái xe chịu trách nhiệm** (R02)
- [x] Sai lệch hàng tại cổng = 0 (R01) — nếu phát sinh sau giao → tra soát ai sai người đó chịu
- [x] Deadline xử lý: **T+1** (T = ngày giao) (R06) *(Impl: auto-set deadline = T+1 khi tạo discrepancy)*
- [x] Nếu quá T+1 chưa đóng → **cảnh báo escalation** lên quản lý vận hành *(Impl: discrepancy_status = escalated)*
- [x] Hồ sơ sai lệch có trạng thái: Mở → Đang xử lý → Đã đóng *(Impl: open/investigating/resolved/escalated/closed)*
- [x] Lưu lịch sử xử lý đầy đủ (ai làm gì, lúc nào) *(Impl: resolved_by, resolved_at, notes)*

### US-REC-03: Đối soát cuối ngày
**As a** kế toán  
**I want to** xem tổng hợp đối soát tất cả chuyến trong ngày  
**So that** kiểm tra tổng thể trước khi chốt sổ

**Acceptance Criteria:**
- [x] Tổng hợp theo ngày: Tổng hàng xuất / giao / trả về, Tổng tiền thu / nợ, Tổng vỏ thu / nhập *(Impl: POST /v1/reconciliation/daily-close)*
- [x] Highlight các chuyến có sai lệch chưa xử lý
- [x] Cho phép xử lý sai lệch cuối ngày đến **T+1**
- [x] Khi tất cả chuyến "Reconciled" → chốt ngày *(Impl: daily_close_summaries table)*

---

# 8. TÍCH HỢP HỆ THỐNG

## 8.1 Tổng quan kiến trúc tích hợp

```
                    ┌──────────────┐
                    │  Hệ thống    │
                    │  mới         │
                    │ (OMS-TMS-WMS)│
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │  Bravo   │ │   DMS    │ │ Zalo OA  │
        │ (Kế toán)│ │ (Sales)  │ │ (Notify) │
        └──────────┘ └──────────┘ └──────────┘
```

## 8.2 Tích hợp BRAVO (Kế toán) — API 2 chiều

### Chiều đi (Hệ thống mới → Bravo)
| Dữ liệu | Trigger | Tần suất |
|----------|---------|----------|
| Kết quả giao hàng (Delivered/Partial/Rejected) | Khi tài xế xác nhận ePOD | Real-time |
| Số tiền đã thu (tiền mặt + CK) | Khi tài xế ghi nhận thu tiền | Real-time |
| Công nợ tiền hàng (đơn ghi nợ) | Khi tài xế chọn "Công nợ" | Real-time |
| Số vỏ thu về + phân loại (tốt/hỏng) | Khi phân xưởng xác nhận nhập vỏ | Real-time |
| Tiền bồi hoàn vỏ hỏng/mất | Khi hệ thống tính bồi hoàn | Real-time |
| Phiếu xuất kho | Khi hàng xuất cổng | Real-time |

### Chiều về (Bravo → Hệ thống mới)
| Dữ liệu | Mục đích |
|----------|----------|
| Số dư công nợ NPP | Kiểm tra hạn mức công nợ tại OMS |
| Xác nhận hạch toán | Đánh dấu chứng từ đã xử lý kế toán |

### Yêu cầu kỹ thuật
- [x] Giao thức: RESTful API (JSON)
- [x] Xác thực: API Key hoặc OAuth2 *(Impl: mock mode, API key planned)*
- [x] Retry mechanism: 3 lần, interval 1-5-15 phút *(Impl: DLQ với retry endpoint)*
- [x] Dead letter queue: Lưu message lỗi để xử lý thủ công *(Impl: dlq_entries table với list/stats/retry/resolve)*
- [x] Log mọi transaction tích hợp (audit trail) *(Impl: audit_logs table, migration 008)*

## 8.3 Tích hợp DMS (Sales) — Chiều đi

| Dữ liệu | Trigger |
|----------|---------|
| Đơn hàng đã xác nhận | Khi OMS confirm đơn |
| Cập nhật trạng thái đơn (Đang giao / Đã giao / Hoãn / Hủy) | Khi trạng thái thay đổi |

### Yêu cầu
- [x] Giao thức: API do DMS cung cấp *(Impl: POST /v1/integration/dms/sync mock mode)*
- [x] Chiều duy nhất: Hệ thống mới → DMS (Master data giai đoạn đầu **độc lập**, sync sau)

## 8.4 Tích hợp Zalo OA

Chỉ dùng cho **xác nhận giao hàng với NPP** (gửi link xác nhận). Xem chi tiết tại [Mục 11.3](#113-xác-nhận-giao-hàng-qua-zalo-oa-dành-cho-npp).

---

# 9. PHÂN QUYỀN 3 LỚP & APPROVAL FLOW

## 9.1 Danh sách vai trò (11 Roles — 80 internal users)

| Vai trò | Mô tả | Số lượng | Platform |
|---------|-------|----------|----------|
| **Admin** | Quản trị hệ thống, cấu hình, phân quyền | 2–3 | Web |
| **BGĐ / Quản lý vận hành** | Dashboard, báo cáo (R), phê duyệt ngoại lệ | 3–5 | Web |
| **Điều phối viên** | VRP, GPS map, gán xe, giám sát chuyến | 3–5 | Web |
| **DVKH** (Dịch vụ khách hàng) | Nhập đơn, xử lý đơn, theo dõi, CCDC | 5–8 | Web |
| **Kế toán / Thủ quỹ** | Đối soát, sai lệch, mở/đóng hồ sơ, xác nhận nộp tiền | 3–5 | Web |
| **KT Trưởng** | Duyệt hạn mức, escalation authority | 1–2 | Web |
| **Thủ kho** | Nhập/xuất kho, PDA, picking, gate check | 5–8 | Web + PDA |
| **Đội trưởng xe** | Quản lý tài xế, xe, checklist, bảo trì | 2–3 | Web |
| **Bảo vệ (Cổng)** | Gate check phối hợp | 2–4 | Web |
| **Phân xưởng** | Nhập vỏ, phân loại, đếm thực tế | 3–5 | Web |
| **Tài xế** (70 người) | Driver App: checklist, GPS, ePOD, thu tiền, thu vỏ | 70 | Mobile App |

## 9.2 Ba lớp phân quyền

| Lớp | Tên | Mô tả | Trạng thái |
|-----|-----|-------|------------|
| 1 | **Screen-level** | Ai được vào màn hình nào. Ma trận 11 roles × 49 screens (xem UIX v1.0) | [x] Đã triển khai — middleware role check |
| 2 | **Action-level** | Ai làm được gì trong cùng màn hình. VD: DVKH chỉ tạo đơn, không approve. KT thường chỉ investigate, KT Trưởng mới resolve | [◐] Partial — PermissionGuard middleware + role_permissions + user_permission_overrides (Session 24/03) |
| 3 | **Data-scoping** | Ai thấy data gì. Thủ kho Hạ Long chỉ thấy tồn kho Hạ Long. KT phụ trách khu vực A chỉ duyệt NPP khu vực A | [◐] warehouse_ids có trong JWT, enforce chưa consistent |

## 9.3 Ma trận hành động (Action-level RBAC)

| Chức năng | Admin | BGĐ | ĐPV | DVKH | KT | KT Trưởng | Thủ kho | Tài xế |
|-----------|-------|-----|-----|------|----|-----------|---------|--------|
| Order — Create/Edit | ✓ | – | ✓ | ✓ | – | – | – | – |
| Order — Approve credit | ✓ | ✓ | – | – | ◐ | ✓ | – | – |
| VRP — Run/Approve | ✓ | ✓ | ✓ | – | – | – | – | – |
| Trip — Monitor GPS | ✓ | ✓ | ✓ | – | – | – | – | – |
| Driver App — Execute | – | – | – | – | – | – | – | ✓ |
| Inventory — View | ✓ | ✓ | ◐ | ◐ | – | – | ◐ | – |
| Gate Check — Execute | ✓ | – | – | – | ✓ | – | ✓ | – |
| Recon — Resolve | ✓ | – | – | – | ◐ | ✓ | – | – |
| Recon — Escalate | ✓ | – | – | – | – | ✓ | – | – |
| Admin — Config | ✓ | – | – | – | – | – | – | – |

*✓ = Full access | ◐ = Data-scoped (own warehouse / own region) | – = No access*

## 9.4 Approval Flow

### Flow 1: Đơn hàng vượt hạn mức công nợ
```
DVKH nhập đơn → Hệ thống phát hiện vượt hạn mức công nợ NPP
  → Đơn chuyển trạng thái "Pending Approval"
  → Thông báo trên Web + App cho Kế toán (R15)
  → Kế toán duyệt → Đơn tiếp tục quy trình
  → Kế toán từ chối → Đơn bị block, thông báo DVKH
```

### Flow 2: Xác nhận chuyển khoản
```
Tài xế chọn "Chuyển khoản" → Thông báo Điều vận
  → Điều vận xác nhận (hoặc từ chối)
  → Nếu không xác nhận trong [timeout - Admin cấu hình]
    → Cảnh báo escalation lên cấp trên
```

### Flow 3: Hạn mức công nợ theo thời kỳ
```
Admin thiết lập: NPP X → Hạn mức 500 triệu (từ 01/01 → 30/06)
  → Tự động áp dụng khi kiểm tra đơn hàng
  → Hết thời kỳ → Hạn mức không còn hiệu lực → Cảnh báo Admin cập nhật
```

### Flow 4: Đối soát sai lệch T+1
```
Trip kết thúc → Hệ thống tạo biên bản đối soát
  → Có sai lệch → Kế toán mở hồ sơ
  → Xử lý trong T+1
  → Quá T+1 chưa đóng → Cảnh báo escalation lên Quản lý vận hành
```

---

# 10. BÁO CÁO & DASHBOARD

## 10.1 Dashboard vận hành (Real-time)

| Widget | Nội dung | Người xem |
|--------|----------|-----------|
| Bản đồ xe | Vị trí tất cả xe đang chạy, màu theo trạng thái | Điều phối, BGĐ |
| Pipeline đơn hàng | Số đơn theo trạng thái (Draft → Confirmed → In Transit → Delivered) | DVKH, BGĐ |
| Cảnh báo active | Xe dừng lâu, CK chưa xác nhận, hàng cận date, sai lệch chưa đóng | Điều phối, Thủ kho, Kế toán |
| Số liệu hôm nay | Đơn đã giao / Tổng đơn, Tiền đã thu, Công nợ phát sinh, Vỏ đã thu | BGĐ |
| Đối soát ngày | Số chuyến reconciled / Tổng chuyến, Sai lệch mở | Kế toán |

## 10.2 KPI Reports (từ BRD V1.2 + trao đổi)

| KPI | Công thức | Tần suất |
|-----|-----------|----------|
| **Tỷ lệ giao đúng hẹn (OTD)** | Số đơn giao trong khung 1 giờ / Tổng đơn × 100% | Ngày, Tuần, Tháng |
| **Tỷ lệ xe rỗng (Empty Run %)** | Số km chạy rỗng / Tổng km × 100% | Ngày, Tuần, Tháng |
| **Hiệu suất sử dụng xe** | Tải trọng sử dụng / Tải trọng khả dụng × 100% | Ngày, Tuần, Tháng |
| **Thời gian hoàn tất 1 vòng chuyến** | Thời gian từ xuất cổng → hoàn chứng từ | Ngày |
| **Số đơn giao lại** | Tổng đơn giao lại + Số lần trung bình/đơn | Ngày, Tuần |
| **Tỷ lệ hoàn chứng từ đúng hạn** | Chuyến hoàn tất trong ngày / Tổng chuyến × 100% | Ngày |
| **Tỷ lệ chênh lệch hàng & vỏ** | Target: 0 | Ngày |
| **Tình hình công nợ tiền hàng** | Tổng nợ theo NPP, NPP vượt hạn mức | Ngày |
| **Công nợ vỏ** | Theo NPP, theo loại vỏ | Tuần |
| **Tỷ lệ xử lý sai lệch đúng T+1** | Sai lệch đóng đúng hạn / Tổng sai lệch × 100% | Tuần |

## 10.3 Báo cáo nghiệp vụ

| Báo cáo | Nội dung |
|---------|----------|
| Báo cáo giao hàng theo ngày | Chi tiết Trip: xe, tài xế, điểm giao, kết quả |
| Báo cáo giao đúng hẹn khung 1 giờ | Tỷ lệ đúng hẹn + danh sách vi phạm (REP-02) |
| Báo cáo hiệu suất điều vận | Theo xe, tuyến, lái xe (REP-01) |
| Báo cáo giao lại | Số đơn, số lần, top lý do thất bại |
| Báo cáo thu tiền | Tiền mặt vs CK vs Công nợ, theo tài xế, chênh lệch |
| Báo cáo vỏ quay vòng | Vỏ phát ra / Thu về / Hỏng / Tồn tại NPP (REP-03) |
| Báo cáo bồi hoàn vỏ | Theo NPP, theo loại vỏ, theo thời kỳ đơn giá |
| Báo cáo xuất nhập tồn kho | Theo kho, SKU, lô (batch) |
| Báo cáo đối soát | Chuyến đã reconciled, sai lệch mở, deadline T+1 |
| Báo cáo ngoại lệ | Từ chối nhận, giao thiếu, xe hỏng, vi phạm GT |

---

# 11. THÔNG BÁO & CẢNH BÁO (48 EVENTS — 33 gốc + 15 Fleet/Driver)

## 11.1 Phân kênh thông báo

| Kênh | Đối tượng | Mục đích |
|------|-----------|----------|
| **Zalo OA** | NPP (bên ngoài) | Dùng cho **2 mục đích**: (1) **Xác nhận đơn hàng** — sau khi lập đơn, gửi link để NPP xác nhận/từ chối đặt hàng; (2) **Xác nhận nhận hàng** — sau khi giao, gửi link để NPP xác nhận đã nhận đúng chủng loại & số lượng |
| **Web (Back-office)** | Nội bộ (DVKH, Điều phối, Kế toán, Thủ kho, BGĐ…) | Tất cả thông báo & cảnh báo vận hành nội bộ |
| **Mobile App (Driver App)** | Tài xế, Đội trưởng xe | Thông báo liên quan đến chuyến, xe, checklist |

> **Nguyên tắc:** Zalo OA là kênh **duy nhất giao tiếp với NPP bên ngoài**. Mọi cảnh báo/thông báo nội bộ đều hiển thị trên **Web + Mobile App** (kèm push notification).
> 
> **2 loại Zalo gửi NPP:** (1) Xác nhận đơn hàng — khi lập đơn thành công; (2) Xác nhận nhận hàng — khi giao hàng xong.

## 11.2 Priority Tiers

| Tier | Tên | Kênh | User action | Escalation |
|------|-----|------|------------|------------|
| **P0** | Critical | Web popup fullscreen + App push + SMS | KHÔNG dismiss cho đến khi confirm xử lý | Tự động sau 5 phút nếu chưa phản hồi |
| **P1** | Urgent | Web toast persistent + App push | Inline CTA, Snooze tối đa 30 phút | Tự động sau 30 phút lên cấp trên |
| **P2** | Important | Web bell badge + App badge | Inline CTA, auto dismiss sau 24h | Không escalate |
| **P3** | Digest | Web bell — gộp hourly digest | FYI only, không CTA | Không escalate |

## 11.3 Danh sách 33 Events

### P0 — Critical (4 events)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 1 | Gate check fail — xe không được xuất | Dispatcher, Thủ kho, Manager | Web popup + App push + SMS |
| 2 | Xe tai nạn / sự cố nghiêm trọng | Dispatcher, Manager, BGĐ | Web popup + App push + SMS |
| 3 | DLQ hết 3 lần retry — tích hợp fail | Admin, Manager | Web popup + SMS |
| 4 | Sai lệch T+1 escalated — quá deadline | Manager, BGĐ | Web popup + SMS |

### P1 — Urgent (12 events)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 5 | Đơn chờ duyệt hạn mức (R15) | KT phụ trách, KT Trưởng | Web toast + App push |
| 6 | CK timeout — chưa xác nhận | Dispatcher | Web toast + App push |
| 7 | Sai lệch T+1 còn < 2 giờ | KT phụ trách | Web toast + App push |
| 8 | Xe dừng bất thường > 15 phút | Dispatcher | Web toast + App push |
| 9 | NPP từ chối đơn hàng | DVKH | Web toast |
| 10 | DLQ entry mới — lỗi tích hợp | Admin, KT | Web toast |
| 11 | DMS sync thất bại | Admin, DVKH | Web toast |
| 12 | NPP xác nhận nhận hàng — disputed | DVKH, KT | Web toast |
| 13 | VRP solver không xếp được shipment | Dispatcher | Web toast |
| 14 | Xe quá tải trong kế hoạch VRP | Dispatcher | Web toast |
| 15 | Tài xế checklist fail (mục không đạt) | Đội trưởng xe | App push |
| 16 | Hạn mức công nợ NPP hết thời kỳ | Admin, KT | Web toast |

### P2 — Important (8 events)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 17 | Đơn giao lại lần 3+ | DVKH, Dispatcher | Web bell |
| 18 | Trip hoàn thành | Dispatcher, KT | Web bell + App badge |
| 19 | Vỏ cần đếm phân xưởng | Phân xưởng | Web bell |
| 20 | Xe cần kiểm định / bảo dưỡng | Đội trưởng xe | Web bell + App push |
| 21 | Bằng lái xe / GPLX sắp hết hạn | Đội trưởng xe | Web bell + App push |
| 22 | ATP xuống dưới ngưỡng thấp | Thủ kho, DVKH | Web bell |
| 23 | Hạn mức NPP sắp hết thời kỳ | Admin, KT | Web bell |
| 24 | Nhiên liệu xe hao vượt 20% định mức | Đội trưởng xe | Web bell |

### P3 — Digest (9 events)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 25 | Đơn mới tạo | DVKH | Hourly digest |
| 26 | NPP xác nhận đơn hàng — silent (2h) | DVKH | Digest |
| 27 | DMS synced thành công | Admin | Digest |
| 28 | Bravo hạch toán thành công | KT | Digest |
| 29 | Trạng thái đơn thay đổi thông thường | DVKH phụ trách | Digest |
| 30 | Tài xế check-in hàng ngày | Dispatcher | Digest tổng hợp 7h sáng |
| 31 | NPP xác nhận nhận hàng — silent (24h) | DVKH | Digest |
| 32 | VRP job hoàn thành | Dispatcher | Digest |
| 33 | Report ngày đã sẵn sàng | BGĐ, Manager | Digest 23:55 |

**Trạng thái triển khai:** Events #1–13 phần lớn đã có backend logic (9 events gốc v2.4 `[x]` + 4 mới). Events #14–33 chưa triển khai `[ ]`. **4-Layer Delivery System đã triển khai (Session 24/03):** Layer 1 In-app (DB+WS), Layer 2 Toast (AutoToast/PersistentToast), Layer 3 Sound/vibration, Layer 4 External (Zalo mock).

## 11.4 Acceptance Criteria (Notification Engine)

- [x] Mỗi thông báo tạo record trong bảng Notification (user, type, content, read/unread, timestamp) *(Impl: notifications table)*
- [x] Web: Hiển thị badge số thông báo chưa đọc + slide panel danh sách (bell icon trên topbar, panel trượt từ phải) *(Impl: GET /v1/notifications, /unread-count, NotificationBell component)*
- [ ] Mobile App: Push notification (Firebase Cloud Messaging hoặc tương đương) *(Impl: WebSocket /ws/notifications thay thế — chưa có FCM)*
- [x] Người dùng có thể đánh dấu đã đọc, lọc theo loại *(Impl: mark-read, mark-all-read endpoints)*
- [x] Trang danh sách thông báo đầy đủ với filter theo loại, priority badge, phân trang *(Impl: /dashboard/notifications page)*
- [x] Real-time push qua WebSocket — toast notification khi có thông báo mới *(Impl: WS /ws/notifications + NotificationToast)*
- [ ] P0 popup fullscreen + không dismiss cho đến khi confirm
- [x] P1 toast persistent + snooze *(Impl: PersistentToast cho urgent priority, không tự dismiss — Session 24/03)*
- [ ] P1 escalation chain (auto-escalate after 30 min)
- [ ] P3 hourly digest grouping
- [ ] SMS channel cho P0 events

## 11.3 Xác nhận đơn hàng qua Zalo OA (dành cho NPP — sau khi lập đơn)

**Yêu cầu:** BHL cần có Zalo OA đã xác thực để sử dụng Zalo ZNS API.

**Quy trình:**
```
DVKH nhập đơn → Hệ thống check ATP + hạn mức công nợ → OK
  → Đơn chuyển trạng thái "Chờ NPP xác nhận" (Pending Customer Confirm)
  → Hệ thống tự động gửi tin nhắn Zalo cho NPP kèm LINK XÁC NHẬN ĐƠN HÀNG:
    ─────────────────────────────────────────
    "BHL — Xác nhận đơn hàng mới

     Kính gửi: [Tên NPP]
     Đơn hàng #SO-YYYYMMDD-NNNN
     Ngày đặt: DD/MM/YYYY HH:mm

     Chi tiết đơn hàng:
     • Bia Hạ Long chai 450ml — 50 thùng
     • Bia Hạ Long lon 330ml — 30 thùng

     Tổng giá trị: XX,XXX,XXX VNĐ
     Ngày giao dự kiến: DD/MM/YYYY

     👉 [XÁC NHẬN ĐƠN HÀNG] (link)

     Để xem chi tiết hoặc từ chối đơn, vui lòng
     bấm vào link trên trong vòng 2 giờ.
     Không phản hồi = đồng ý đặt hàng."
    ─────────────────────────────────────────

→ NPP bấm link → Mở trang web xác nhận đơn hàng:
   • Hiển thị đầy đủ: sản phẩm, số lượng, đơn giá, thành tiền, ngày giao dự kiến
   • Có thể tải PDF đơn hàng
   • NPP chọn:
     ✅ "Xác nhận đặt hàng" → Đơn chuyển "Confirmed", tạo shipment, ghi nợ
     ❌ "Từ chối đơn hàng" (chọn lý do: giá không đúng / không đặt / số lượng sai / khác) → Đơn "Cancelled", hoàn ATP
   • Submit → Hệ thống ghi nhận kết quả, thông báo DVKH trên Web

→ NPP không phản hồi trong 2h → Tự động xác nhận đơn hàng (Silent Consent)
```

**Acceptance Criteria:**
- [x] Gửi tin nhắn Zalo OA tự động khi đơn chuyển trạng thái `pending_customer_confirm` *(Impl: hook OnOrderCreated → SendOrderConfirmation)*
- [x] Tin nhắn hiển thị **tên NPP, mã đơn, danh sách sản phẩm, tổng giá trị, ngày giao dự kiến**
- [x] Tin nhắn kèm **đường link duy nhất** (unique token, hết hạn sau 2h) dẫn đến trang xác nhận *(Impl: order_confirmations table với token)*
- [x] Trang xác nhận (web): NPP xem chi tiết từng SKU + số lượng + giá + tổng, có thể tải PDF *(Impl: /order-confirm/[token] public page + /order-confirm/[token]/pdf)*
- [x] NPP bấm "Từ chối" → Đơn cancelled, hoàn ATP, thông báo DVKH *(Impl: CancelOrderByCustomer)*
- [x] **Sau 2h không phản hồi → Mặc nhiên xác nhận đơn hàng** (tạo shipment, ghi nợ) *(Impl: cron AutoConfirmExpiredOrders mỗi 5 phút)*
- [x] Lưu toàn bộ lịch sử: tin nhắn Zalo, lượt bấm link, thời điểm xác nhận/từ chối, lý do từ chối
- [x] Khi Kế toán duyệt đơn vượt hạn mức (`pending_approval → approved`) → cũng gửi Zalo cho NPP xác nhận *(Impl: ApproveOrder → fireOrderConfirmation)*

## 11.4 Xác nhận nhận hàng qua Zalo OA (dành cho NPP — sau khi giao hàng)

**Quy trình:**
```
Tài xế đến điểm giao → Thông báo miệng cho NPP dựa trên đơn trên app
  → NPP xác nhận đúng → Hạ hàng
  → Tài xế xác nhận giao hàng trên app (ePOD + ảnh)
  → Hệ thống gửi tin nhắn Zalo cho NPP kèm LINK XÁC NHẬN NHẬN HÀNG:
    ─────────────────────────────────────────
    "BHL — Xác nhận nhận hàng

     Kính gửi: [Tên NPP]
     Đơn hàng #SO-YYYYMMDD-NNNN
     Ngày giao: DD/MM/YYYY HH:mm
     Tài xế: [Tên tài xế] — [Biển số xe]

     Hàng hóa đã giao:
     • Bia Hạ Long chai 450ml — 50 thùng
     • Bia Hạ Long lon 330ml — 30 thùng
     • Keg 50L — 10 keg

     Tổng giá trị: XX,XXX,XXX VNĐ

     👉 [XÁC NHẬN ĐÃ NHẬN HÀNG] (link)

     Nếu có sai lệch về chủng loại hoặc số lượng,
     vui lòng phản hồi qua link trên trong vòng 24h.
     Không phản hồi = xác nhận nhận đúng & đủ."
    ─────────────────────────────────────────

→ NPP bấm link → Mở trang web xác nhận nhận hàng:
   • Hiển thị danh sách chủng loại + số lượng giao
   • NPP chọn:
     ✅ "Xác nhận đã nhận đúng" → Ghi nhận hoàn tất
     ⚠️ "Báo sai lệch" (chọn SKU sai, nhập số lượng thực nhận, ghi chú, đính kèm ảnh)
   • Submit → Hệ thống ghi nhận kết quả

→ NPP bấm "Báo sai lệch" → Tạo ticket tranh chấp (tra soát, ai sai người đó chịu — R13)
→ NPP không phản hồi trong 24h → Tự động xác nhận "Đúng" (Silent Consent — R13)
```

**Acceptance Criteria:**
- [x] Gửi tin nhắn Zalo OA tự động khi tài xế hoàn thành ePOD tại điểm giao *(Impl: integration hook auto-trigger, mock mode)*
- [x] Tin nhắn hiển thị **tên NPP, mã đơn, tên tài xế, biển số xe, danh sách chủng loại + số lượng giao, tổng giá trị**
- [x] Tin nhắn kèm **đường link duy nhất** (unique token, hết hạn sau 24h) dẫn đến trang xác nhận *(Impl: zalo_confirmations table với token)*
- [x] Trang xác nhận (web): NPP xem chi tiết từng SKU + số lượng, chọn "Xác nhận đúng" hoặc "Báo sai lệch" (chọn SKU sai, nhập số lượng thực nhận, ghi chú) *(Impl: /confirm/[token] public page)*
- [x] NPP bấm "Báo sai lệch" → Hệ thống tạo ticket tranh chấp, thông báo DVKH trên Web *(Impl: dispute action)*
- [x] **Sau 24h không phản hồi → Mặc nhiên xác nhận đúng** (ghi nhận timestamp auto-confirm) *(Impl: auto-confirm cron mỗi 1 giờ)*
- [x] Lưu toàn bộ lịch sử: tin nhắn Zalo, lượt bấm link, kết quả xác nhận/sai lệch

---

# 12. TIMELINE ĐƠN HÀNG — 10 LỚP

> Mỗi đơn hàng trải qua tối đa 10 lớp dữ liệu. Khi xem chi tiết đơn, tất cả 10 lớp hiển thị trên 1 trang dưới dạng timeline dọc (vertical stepper), mỗi lớp là 1 section collapse/expand.

## 12.1 Cấu trúc 10 lớp

| Lớp | Tên | Nguồn dữ liệu | Ghi vào DB | Status |
|-----|-----|---------------|-----------|--------|
| 1 | **Tạo đơn** | DVKH nhập / import | sales_orders + order_items | [x] |
| 2 | **Duyệt hạn mức** | Kế toán approve / auto (chỉ với NPP có hạn mức) | sales_orders.status → approved | [x] |
| 3 | **Xác nhận NPP** | Zalo OA link → NPP bấm (hoặc silent consent 2h) | zalo_confirmations | [x] |
| 4 | **Xếp chuyến** | Auto-planning (VRP) / lập kế hoạch thủ công | trips + trip_stops | [x] |
| 5 | **Xuất kho (WMS)** | Thủ kho pick theo FEFO, xác nhận trên Web/Tablet | picking_lists + picking_items | [x] |
| 6 | **Bàn giao A** | Thủ kho + Bảo vệ + Lái xe cùng kiểm đếm & ký số | handover_records (type=A) | [x] Migration 017+018 |
| 7 | **Giao hàng (ePOD)** | Tài xế tại NPP: hạ hàng, xác nhận thực giao, ảnh | delivery_confirmations | [x] |
| 8 | **Thu tiền** | Tài xế ghi nhận COD / CK / công nợ | payment_confirmations | [x] |
| 9 | **Xác nhận nhận hàng** | Zalo OA → NPP bấm (hoặc silent consent 24h) | zalo_confirmations (post-delivery) | [x] |
| 10 | **Đối soát + Bàn giao B/C** | KT reconcile T+1; Phân xưởng + KT ký nhận vỏ/tiền | reconciliation_items + handover_records (type=B,C) | [x] Migration 017+018 |

> **Bàn giao A/B/C** dùng bảng `handover_records` (type: A/B/C, trip_id, signatories JSONB, signed_at, biên bản PDF). ✅ Migration 017 + 018 (photo_urls, reject_reason, items).

## 12.2 Đồng bộ với Entity Events (US-NEW-11)

Timeline lớp được populate từ `entity_events`. Mapping event → lớp:

| Lớp | Event types tương ứng |
|-----|----------------------|
| 1 | order_created |
| 2 | order_credit_approved, order_credit_rejected |
| 3 | order_confirmed, order_rejected, order_cancelled_by_customer, auto_confirmed, zalo_sent |
| 4 | trip_planned, assignment_changed |
| 5 | picking_started, picking_completed |
| 6 | handover_a_signed *(event mới — cần thêm)* |
| 7 | trip_started, stop_arrived, delivery_completed, delivery_partial, delivery_rejected, epod_captured |
| 8 | payment_recorded |
| 9 | zalo_sent (post-delivery), auto_confirmed (24h) |
| 10 | return_collected, handover_b_signed, handover_c_signed, reconciliation_matched, reconciliation_discrepancy *(3 event mới)* |

## 12.3 UX Timeline Features

| Feature | Mô tả | Status |
|---------|--------|--------|
| Vertical stepper | 10 lớp dọc — ✅ hoàn thành / spinner đang xử lý / grayed out chưa đến | [x] (OrderTimeline component) |
| Collapse/expand | Click lớp → xem chi tiết data, timestamp, user thực hiện | [x] |
| Status color coding | Xanh = xong, Vàng = đang, Xám = chưa, Đỏ = lỗi/từ chối | [x] |
| Audit trail per layer | Mỗi lớp ghi nhận who/when/what changed, trước/sau | [ ] Partial |
| Export timeline PDF | Xuất timeline đơn ra PDF để archive / tranh chấp | [ ] |

## 12.4 Acceptance Criteria

- [x] Trang chi tiết đơn hiển thị timeline 10 lớp vertical stepper
- [x] Mỗi lớp collapse/expand, hiển thị data chi tiết + timestamp + user
- [x] Lớp hoàn thành / đang xử lý / chưa đến có visual indicator rõ ràng
- [ ] Lớp 6 (Bàn giao A) hiển thị: 3 chữ ký số, timestamp từng bên ký, biên bản PDF
- [ ] Lớp 10 (Bàn giao B/C) hiển thị tương tự với chữ ký Phân xưởng + KT
- [ ] Audit trail per layer — click lớp thấy lịch sử thay đổi chi tiết
- [ ] Export timeline ra PDF

---

# 13. QUY MÔ & SIZING

## 13.1 Dữ liệu ước tính

| Thông số | Ngày thường | Cao điểm (Tết/Hè) |
|----------|------------|-------------------|
| Đơn hàng / ngày | ~1,000 | ~3,000-5,000 (ước tính) |
| Trip / ngày | ~100-150 | ~300-500 |
| GPS point / ngày | ~200,000 (70 xe × 30s × 12h) | ~500,000+ |
| Ảnh upload / ngày | ~500 (checklist + ePOD + vỏ) | ~1,500+ |

## 13.2 Yêu cầu phi chức năng
- [ ] **Availability:** 99.5% uptime (cho phép maintenance window ngoài giờ làm việc)
- [ ] **Concurrency:** Chịu tải 50 user web + 70 tài xế app đồng thời
- [ ] **Response time:** API < 2s, Auto-planning < 2 phút, Dashboard < 3s
- [ ] **Data retention:** Lịch sử GPS 6 tháng online, archive 3 năm
- [ ] **Offline:** Driver App hoạt động offline cơ bản (nhập dữ liệu, queue sync khi có mạng)
- [ ] **Mobile:** iOS + Android (tài xế), Web responsive (back-office)

---

# 14. PHỤ LỤC — DATA ENTITIES

## 14.1 Master Data

| Entity | Trường chính | Nguồn |
|--------|-------------|-------|
| **Sản phẩm (SKU)** | Mã, Tên, Loại (Bia chai/Bia hơi/Keg/NGK), ĐVT, Trọng lượng, Thể tích, Hạn SD tiêu chuẩn | Hệ thống mới |
| **NPP / Khách hàng** | Mã, Tên, Địa chỉ (nhiều), SĐT, Zalo, Hạn mức công nợ (theo thời kỳ), Chính sách cược | Hệ thống mới |
| **Tuyến đường** | Mã, Tên, Danh sách điểm giao, Khoảng cách, Thời gian ước tính | Hệ thống mới |
| **Xe** | Biển số, Loại, Tải trọng, Thể tích, Nội bộ/Thuê ngoài, Giấy tờ | Hệ thống mới |
| **Tài xế** | Mã, Họ tên, CCCD, SĐT, Bằng lái, Trạng thái | Hệ thống mới |
| **Kho / Vị trí** | Mã kho, Tên, Địa chỉ, Zone, Bin | Hệ thống mới |
| **Giờ cấm tải** | Khu vực, Khung giờ, Loại xe | Admin nhập tay |
| **Tài sản quay vòng** | Loại (Chai/Két/Keg/Pallet/CCDC), ĐVT quy đổi, Đơn giá cược | Hệ thống mới |
| **Đơn giá bồi hoàn vỏ** | Loại vỏ, Đơn giá, Từ ngày, Đến ngày (hiệu lực) | Admin cập nhật |
| **Khung giờ giao** | Khung giờ chuẩn (phút), Từ ngày, Đến ngày (hiệu lực) | Admin cập nhật |
| **Thứ tự ưu tiên xe** | Tiêu chí ưu tiên (trọng tải/tuyến xa/giá trị đơn), Thứ tự | Admin cấu hình |

## 14.2 Transaction Data

| Entity | Mô tả |
|--------|-------|
| **Sales Order** | Đơn hàng gốc từ OMS |
| **Shipment** | Lệnh vận chuyển (có thể gom/tách từ nhiều SO) |
| **Trip** | Chuyến xe (1 Trip = 1 xe + 1 tài xế + nhiều Shipment) |
| **Delivery Attempt** | Lần giao hàng (có thể nhiều lần cho 1 SO — giao lại) |
| **Picking Order** | Lệnh đóng hàng cho kho |
| **Stock Move** | Phiếu nhập/xuất kho (mỗi dòng: SKU, Lô, Số lượng, Vị trí) |
| **Gate Check** | Biên bản kiểm đếm cổng |
| **ePOD** | Xác nhận giao hàng (ảnh, GPS, timestamp) |
| **Payment** | Thu tiền (tiền mặt/CK/công nợ, số tiền, trạng thái) |
| **Return Collection** | Vỏ thu hồi (loại, số lượng, tốt/hỏng, ảnh) |
| **Asset Ledger** | Sổ công nợ vỏ theo NPP |
| **Receivable Ledger** | Sổ công nợ tiền hàng theo NPP |
| **Reconciliation Record** | Biên bản đối soát chuyến (hàng-tiền-vỏ) |
| **Discrepancy Ticket** | Hồ sơ sai lệch (mở → xử lý → đóng, deadline T+1) |

## 14.3 Mapping với biểu mẫu hiện tại

| Biểu mẫu cũ | Thay thế bằng |
|-------------|---------------|
| File nhu cầu vận tải (BM10) | Auto-planning output (Trip list) |
| Biên bản kiểm tra ATKT (BM11) | Driver App Checklist (US-TMS-10) |
| Lệnh đóng hàng | Picking Order (WMS) |
| Phiếu xuất kho | Stock Move - Outbound (WMS) |
| Biên bản bàn giao hàng hóa | ePOD + Gate Check (digital) |
| Sổ giao hàng, thu vỏ (BM06, BM07) | ePOD + Return Collection (Driver App) |
| Phiếu thu tiền | Payment record (Driver App) |
| Phiếu nhập vỏ | Stock Move - Inbound Returns (WMS) |

## 14.4 Danh mục đầu vào cần cung cấp (để khóa tài liệu)

1. Danh mục khách hàng/NPP và điểm giao chuẩn
2. Danh mục xe, lái xe và điều kiện vận hành
3. Danh mục vỏ cược và quy tắc quy đổi chính thức
4. Bảng đơn giá bồi hoàn vỏ theo thời kỳ hiệu lực
5. Danh mục ngưỡng cận hạn theo nhóm sản phẩm
6. Danh sách biểu mẫu nghiệp vụ chính thức theo thiết kế mới

---

# 14B. TÍNH NĂNG BỔ SUNG (PHÁT SINH TỪ PHÁT TRIỂN)

> Các tính năng dưới đây được bổ sung trong quá trình phát triển, không có trong BRD gốc, nhưng cần thiết cho vận hành thực tế.

## US-NEW-01: Quản trị người dùng (Admin)
**As a** quản trị viên  
**I want to** quản lý người dùng hệ thống (tạo, sửa, xóa, reset mật khẩu)  
**So that** kiểm soát quyền truy cập

**Acceptance Criteria:**
- [x] CRUD người dùng: username, full_name, role, warehouse_ids
- [x] Soft-delete (không xóa vĩnh viễn)
- [x] Reset mật khẩu theo yêu cầu
- [x] Danh sách roles với default permissions
- [x] Chỉ admin được truy cập
- [x] Frontend: `/dashboard/settings` — quản trị hệ thống

**Endpoints:** 7 (GET/POST/PUT/DELETE users, reset-password, list roles)

## US-NEW-02: Check-in tài xế hàng ngày
**As a** tài xế  
**I want to** check-in hàng ngày báo sẵn sàng hoặc xin nghỉ  
**So that** điều phối biết ai khả dụng khi lập kế hoạch

**Acceptance Criteria:**
- [x] Tài xế check-in: available hoặc off_duty (kèm lý do: sick, personal, vehicle_maintenance)
- [x] Xem trạng thái check-in hôm nay
- [x] Dispatcher xem toàn bộ trạng thái tài xế theo kho/ngày
- [x] Tài xế đang có trip → auto hiển thị trạng thái "on_trip"

**Endpoints:** POST /v1/driver/checkin, GET /v1/driver/checkin, GET /v1/drivers/checkins

## US-NEW-03: KPI Dashboard & Cron
**As a** quản lý vận hành  
**I want to** xem KPI tổng hợp mỗi ngày  
**So that** theo dõi hiệu suất vận hành

**Acceptance Criteria:**
- [x] KPI report theo date range + warehouse filter
- [x] Metrics: OTD rate, delivery success, vehicle utilization, tổng khoảng cách, doanh thu, tiền thu, recon match rate
- [x] Daily cron 23:50 ICT tự động snapshot tất cả warehouses
- [x] Manual snapshot generation
- [x] Frontend: `/dashboard/kpi` — management role

**Endpoints:** GET /v1/kpi/report, POST /v1/kpi/snapshot

## US-NEW-04: Real-time GPS Map (enriched)
**As a** điều phối viên  
**I want to** xem bản đồ GPS với thông tin xe+tài xế+trip  
**So that** giám sát vận hành trực quan

**Acceptance Criteria:**
- [x] Bản đồ hiển thị tất cả xe có GPS position
- [x] Mỗi xe hiển thị: biển số, tên tài xế, trạng thái trip
- [x] WebSocket /ws/gps real-time update qua Redis pub/sub
- [x] GPS batch upload lên tới 1000 points (offline buffer)

**Endpoints:** POST /v1/driver/gps/batch, GET /v1/gps/latest, WS /ws/gps

## US-NEW-05: Offline Sync (Driver App)
**As a** tài xế  
**I want to** thao tác khi mất mạng, đồng bộ khi có mạng lại  
**So that** không bị gián đoạn công việc

**Acceptance Criteria:**
- [x] IndexedDB queue lưu actions khi offline
- [x] Auto sync khi online trở lại (FIFO ordered)
- [x] Các action hỗ trợ offline: ePOD, payment, return collection, GPS

**Frontend lib:** `useOfflineSync.ts`

## US-NEW-06: Driver Profile
**As a** tài xế  
**I want to** xem thông tin tài khoản và đăng xuất  
**So that** quản lý tài khoản cá nhân

**Acceptance Criteria:**
- [x] Hiển thị: họ tên, username, role, phiên bản app
- [x] Nút đăng xuất
- [x] Link từ trang chủ driver

**Frontend:** `/dashboard/driver/profile`

## US-NEW-07: Shipment Urgent Priority
**As a** điều phối viên  
**I want to** đánh dấu shipment ưu tiên giao gấp  
**So that** VRP solver xếp ưu tiên trước

**Acceptance Criteria:**
- [x] Toggle urgent flag trên shipment
- [x] Danh sách shipment sắp xếp: urgent DESC → order_created_at ASC
- [x] Hiển thị badge urgent trên frontend

**Endpoint:** PUT /v1/shipments/:id/urgent

## US-NEW-08: Pending Shipment Dates
**As a** điều phối viên  
**I want to** xem ngày nào có shipment chờ giao  
**So that** chọn đúng ngày khi lập kế hoạch VRP

**Acceptance Criteria:**
- [x] Trả danh sách dates với count + total weight
- [x] Frontend auto-detect ngày giao từ dữ liệu này

**Endpoint:** GET /v1/shipments/pending-dates

## US-NEW-09: Role-specific Dashboard
**As a** người dùng hệ thống  
**I want to** dashboard tùy chỉnh theo vai trò  
**So that** chỉ thấy thông tin liên quan

**Acceptance Criteria:**
- [x] Admin/Dispatcher: thống kê vận hành (đơn, chuyến, xe, doanh thu)
- [x] Accountant: pending approvals, discrepancies, reconciliation
- [x] DVKH: tổng quan đơn hàng
- [x] Management: KPI dashboard
- [x] Driver: danh sách chuyến + check-in
- [x] Warehouse: tồn kho + picking

**Frontend:** `/dashboard` (phân nhánh theo role)

## US-NEW-10: DLQ Management (Dead Letter Queue)
**As a** admin  
**I want to** quản lý các integration calls bị lỗi  
**So that** retry hoặc xử lý thủ công

**Acceptance Criteria:**
- [x] Danh sách DLQ entries với thống kê
- [x] Retry individual entries
- [x] Resolve (đánh dấu đã xử lý thủ công)

**Endpoints:** GET /v1/integration/dlq, GET /v1/integration/dlq/stats, POST /v1/integration/dlq/:id/retry, POST /v1/integration/dlq/:id/resolve

## US-NEW-11: Timeline & Lịch sử đơn hàng (Entity Events)
**As a** DVKH / Điều phối / Quản lý  
**I want to** xem toàn bộ lịch sử thay đổi (timeline) của đơn hàng / chuyến xe  
**So that** truy vết ai làm gì, lúc nào, chi tiết ra sao

**Acceptance Criteria:**
- [x] Bảng `entity_events` lưu immutable events: entity_type, entity_id, event_type, actor, detail (JSONB), created_at
- [x] 23 event types + **3 mới cho bàn giao = 26 tổng**: order_created, order_confirmed, order_rejected, order_cancelled_by_customer, order_credit_approved, order_credit_rejected, shipment_created, trip_planned, trip_started, stop_arrived, delivery_completed, delivery_partial, delivery_rejected, payment_recorded, epod_captured, return_collected, reconciliation_matched, reconciliation_discrepancy, auto_confirmed (silent consent), zalo_sent, note_added, status_changed, assignment_changed, **handover_a_signed**, **handover_b_signed**, **handover_c_signed**
- [x] `actor_name` lưu tên người thực hiện (từ JWT FullName claim hoặc "system" cho cron)
- [x] JSONB `detail` lưu context tùy event (lý do từ chối, số tiền, ghi chú…)
- [x] Frontend: `/dashboard/orders/:id` hiển thị tab Timeline với timeline dọc, icon + màu theo event type
- [x] API lọc theo entity_type + entity_id, sắp xếp created_at DESC

**Endpoints:** GET /v1/orders/:id/timeline, POST /v1/orders/:id/timeline (internal — event recorder service ghi)

## US-NEW-12: Ghi chú đơn hàng (Order Notes)
**As a** DVKH / Điều phối  
**I want to** thêm ghi chú nội bộ vào đơn hàng  
**So that** lưu lại những trao đổi, nhắc nhở, lưu ý liên quan đến đơn

**Acceptance Criteria:**
- [x] Bảng `order_notes`: order_id, user_id, content (text), created_at
- [x] Mỗi ghi chú hiển thị tên người viết + thời gian
- [x] Frontend: tab "Ghi chú" trên trang chi tiết đơn hàng, form thêm ghi chú mới
- [x] Ghi chú mới tự động tạo event `note_added` trong timeline

**Endpoints:** GET /v1/orders/:id/notes, POST /v1/orders/:id/notes

## US-NEW-13: Test Portal (Dev/QA)
**As a** QA tester / Developer  
**I want to** nhanh chóng seed, reset, và điều khiển test data  
**So that** test end-to-end mà không cần SQL thủ công

**Acceptance Criteria:**
- [x] Reset toàn bộ test data (chỉ cho role admin, KHÔNG dùng trên production)
- [x] Seed scenarios: demo data, planning test, UAT data
- [x] Simulate: GPS injection, delivery completion, payment recording
- [x] Quick actions: tạo orders, advance trip status, generate discrepancies
- [x] Frontend: `/dashboard/test-portal` (chỉ hiện cho admin role)
- [x] Bảo vệ: middleware kiểm tra role + environment flag

**Endpoints:** 21 endpoints dưới `/v1/test-portal/*` (data overview 8, test actions 7, GPS simulation 6)

## US-NEW-14: Notification 4-Layer Delivery System
**As a** operational user (bất kỳ role nào)
**I want to** nhận thông báo theo 4 kênh phân tầng theo priority
**So that** thông báo khẩn cấp (urgent) luôn được chú ý, thông báo thường không gây phiền

**Acceptance Criteria:**
- [x] Layer 1 — In-app: DB notification + WebSocket push real-time
- [x] Layer 2 — Toast: AutoToast (auto-dismiss 6s) cho high, PersistentToast (không tự dismiss) cho urgent
- [x] Layer 3 — Sound/vibration based on priority level
- [ ] Layer 4 — External (Zalo ZNS) — mock mode, chờ Zalo OA credentials
- [x] Frontend components: `AutoToast.tsx`, `PersistentToast.tsx` trong notification UI
- [x] Grouped notifications endpoint: GET `/v1/notifications/grouped`

## US-NEW-15: Admin Dynamic RBAC + Session Management
**As an** Admin
**I want to** quản lý permissions chi tiết cho từng role và kiểm soát phiên đăng nhập
**So that** phân quyền linh hoạt hơn screen-level, và có thể revoke sessions khi cần

**Acceptance Criteria:**
- [x] Bảng `role_permissions`: role → resource:action mapping (migration 016)
- [x] Bảng `user_permission_overrides`: override per-user (grant/deny)
- [x] `PermissionGuard` middleware kiểm tra permission trước khi cho phép action
- [x] Admin API: CRUD permissions (GET/POST/PUT/DELETE `/v1/admin/permissions/*`)
- [x] Admin API: Session management (list/revoke `/v1/admin/sessions/*`)
- [x] Bảng `user_sessions`: track active sessions per user
- [x] Frontend: `/dashboard/settings/permissions` — Permission Matrix Editor

**Endpoints:** 10+ endpoints dưới `/v1/admin/permissions/*` và `/v1/admin/sessions/*`

## US-NEW-16: End-of-Day (EOD) Checkpoint System
**As a** tài xế / thủ kho / bảo vệ
**I want to** submit và xác nhận các checkpoint cuối ngày (tiền, hàng trả, vỏ, phiếu)
**So that** đối soát cuối ngày chính xác, có audit trail cho từng bước bàn giao

**Acceptance Criteria:**
- [x] Bảng `eod_sessions` + `eod_checkpoints` (migration 015)
- [x] Tài xế bắt đầu EOD session: POST `/v1/driver/trips/:id/eod/start`
- [x] Tài xế xem trạng thái EOD: GET `/v1/driver/trips/:id/eod`
- [x] Tài xế submit checkpoint theo loại (cash/returns/assets/documents): POST `/v1/driver/trips/:id/eod/checkpoint/:cpType/submit`
- [x] Người nhận xem pending checkpoints: GET `/v1/eod/pending/:cpType`
- [x] Người nhận confirm/reject: POST `/v1/eod/checkpoint/:id/confirm`, POST `/v1/eod/checkpoint/:id/reject`

**Endpoints:** 6 endpoints (3 driver-side, 3 receiver-side)

## US-NEW-17: Vehicle/Driver Document Management
**As a** điều phối viên
**I want to** quản lý giấy tờ xe và tài xế với cảnh báo hết hạn
**So that** không có xe/tài xế nào chạy với giấy tờ hết hạn

**Acceptance Criteria:**
- [x] Vehicle documents CRUD: registration, inspection, insurance (5 endpoints)
- [x] Driver documents CRUD: license (with class B2/C/D/E), health_check (5 endpoints)
- [x] Cron job 07:00 ICT daily: check expiring docs ≤ 7 ngày → alert dispatcher
- [x] Frontend: `/dashboard/vehicles/:id/documents`, `/dashboard/drivers-list/:id/documents` — CRUD + expiry badges

## US-NEW-18: Sentry Error Tracking
**As a** admin / developer
**I want to** theo dõi lỗi frontend và backend trên Sentry
**So that** phát hiện và fix bug nhanh hơn

**Acceptance Criteria:**
- [x] Frontend: Sentry SDK (@sentry/nextjs) configured, automatic error capture
- [x] Backend: Sentry SDK (sentry-go) + Gin middleware, capture panics + errors
- [x] Environment-based DSN configuration

## US-NEW-19: Control Tower Enhancements
**As a** điều phối viên
**I want to** giám sát ngoại lệ, di chuyển điểm giao giữa các chuyến, và xem thống kê fleet
**So that** phản ứng nhanh khi có vấn đề và tối ưu hoá chuyến

**Acceptance Criteria:**
- [x] Exception monitoring: GET `/v1/trips/exceptions` — danh sách trips có vấn đề (trễ, dừng bất thường)
- [x] Bulk move stops: POST `/v1/trips/:id/stops/:stopId/move` — chuyển stop sang trip khác
- [x] Trip cancel: POST `/v1/trips/:id/cancel` — huỷ chuyến với lý do
- [x] Control tower stats: GET `/v1/trips/control-tower/stats` — tổng quan fleet (active/completed/delayed)
- [x] Trip progress + ETA deviation: hiển thị tiến độ theo điểm giao (progress bar), ETA countdown và badge lệch ETA (đúng tiến độ/trễ/thiếu ETA) ngay trên danh sách chuyến
- [x] Frontend: Exception descriptions (Vietnamese), bulk move modal, fleet tab toggle

## US-NEW-20: Import/Export Excel
**As a** điều phối viên / kế toán / quản lý
**I want to** import đơn hàng từ file Excel và export báo cáo ra Excel
**So that** nhập liệu hàng loạt nhanh chóng và chia sẻ dữ liệu với các bên liên quan

**Acceptance Criteria:**
- [x] Import đơn hàng: POST `/v1/orders/import` — upload file Excel, validate & tạo đơn hàng hàng loạt *(Impl: oms/excel.go)*
- [x] Template download: GET `/v1/orders/import/template` — tải file mẫu Excel *(Impl: oms/excel.go)*
- [x] Export đơn hàng: GET `/v1/orders/export` — xuất danh sách đơn hàng ra Excel (có filter)
- [x] Export báo cáo đối soát: GET `/v1/reconciliation/export` — xuất báo cáo đối soát *(Impl: reconciliation/excel.go)*
- [x] Export báo cáo chuyến: GET `/v1/trips/export` — xuất danh sách chuyến ra Excel *(Impl: tms/excel.go, 2-sheet)*
- [x] Validation: kiểm tra format, dữ liệu bắt buộc, trùng lặp trước khi import
- [x] Trả về kết quả import: số dòng thành công, số dòng lỗi, chi tiết lỗi từng dòng
- [x] Frontend: Upload modal với drag & drop, progress bar, error summary

---

# 14C. QUẢN LÝ ĐỘI XE & TÀI XẾ NÂNG CAO (FMS+ / DMS+)

> **Phiên bản:** v3.6 (21/04/2026)  
> **Nguồn gốc:** Phân tích 3 đề xuất chuyên gia + phản biện + điều chỉnh  
> **Ràng buộc:** Không GPS hộp đen (Phase đầu), Bỏ HOS/Shift, OCR hạ ưu tiên  
> **Nguyên tắc:** Rule-based trước ML, đơn giản hóa cho quy mô BHL 70 xe

## FMS+ — Quản lý Phương tiện

### US-TMS-23: Vehicle Health Score (Rule-based)
**As a** quản lý đội xe  
**I want to** xem Health Score 0-100 cho từng xe  
**So that** chủ động bảo dưỡng trước khi xe hỏng, giảm breakdown khẩn cấp

**Công thức Health Score (Rule-based Phase 1):**
```
health_score = 100
  - (km_overdue / 1000) × 5          -- Mỗi 1000km quá hạn bảo dưỡng: -5đ
  - overdue_days × 2                  -- Mỗi ngày quá hạn: -2đ
  - open_repair_orders × 10           -- Mỗi RO chưa xử lý: -10đ
  - critical_checklist_fails × 15     -- Checklist fail items critical: -15đ
  - age_factor                        -- Xe > 5 năm: -5đ, > 8 năm: -10đ
  CLAMP to [0, 100]
```

**Acceptance Criteria:**
- [ ] Health Score 0-100 hiển thị trên Vehicle Profile, color-coded: xanh ≥80, vàng 50-79, đỏ <50
- [ ] Xe có Health Score < 50 → TỰ ĐỘNG loại khỏi VRP pool (port 8090) — dispatcher không thể assign
- [ ] Cron tính lại health score mỗi 4 giờ, lưu vào `vehicles.health_score`
- [ ] Control Tower map: vehicle icon color theo health (xanh/vàng/đỏ)
- [ ] Entity Events: `health_score_changed`, `vehicle_health_critical`
- [ ] Phase 4+: Khi có ≥6 tháng data → thay bằng ML XGBoost (predict failure_14d)

### US-TMS-31: Repair Order Management
**As a** quản lý đội xe / tài xế  
**I want to** quản lý toàn bộ quy trình sửa chữa từ báo hỏng đến đối soát  
**So that** kiểm soát chi phí sửa chữa, giảm thất thoát, có dữ liệu TCO

**Status Flow:**
```
DRAFT → QUOTED → APPROVED → IN_PROGRESS → COMPLETED → VERIFIED (KT đối soát)
```

**Approval Workflow:**
| Giá trị RO | Cấp duyệt | SLA | Escalate |
|------------|-----------|-----|----------|
| < 3,000,000 VNĐ | Đội trưởng xe | 2h | Quản lý vận hành |
| 3M – 15,000,000 VNĐ | Quản lý vận hành | 4h | BGĐ |
| > 15,000,000 VNĐ | BGĐ/CFO | 8h | Email BGĐ |
| Khẩn cấp (xe hỏng đường) | Auto-approve ceiling 5M | — | Đội trưởng review 24h |
| Bảo dưỡng định kỳ | Auto-approve nếu ≤ 120% lần trước | — | — |

**Acceptance Criteria:**
- [ ] CRUD Repair Order: POST/GET/PUT/DELETE `/v1/fleet/work-orders`
- [ ] Approval: POST `/v1/fleet/work-orders/:id/approve` — theo hạn mức + role
- [ ] Complete: POST `/v1/fleet/work-orders/:id/complete` — kèm upload ảnh HĐ
- [ ] Emergency bypass: tài xế chọn "Khẩn cấp" → auto-approve ≤5M → review 24h
- [ ] Recurring auto-approve: bảo dưỡng định kỳ ≤120% lần trước
- [ ] Timeline dọc per vehicle — xem lịch sử sửa chữa trên Vehicle Profile
- [ ] Khi RO status = IN_PROGRESS → vehicle.status = "maintenance" → loại VRP pool
- [ ] Upload ảnh/video tối thiểu 1 ảnh (bắt buộc) → lưu lên MinIO/S3
- [ ] Entity Events: `repair_created`, `repair_approved`, `repair_completed`, `repair_cost_flagged`
- [ ] RO → Trip impact: xe vào sửa → alert Dispatcher nếu có trip assign

### US-TMS-32: Repair Cost & Budget Control
**As a** BGĐ / quản lý đội xe  
**I want to** dashboard chi phí sửa chữa và cảnh báo ngân sách  
**So that** kiểm soát chi phí fleet, phát hiện outlier

**Acceptance Criteria:**
- [ ] Gauge ngân sách tháng: đã dùng X / ngân sách Y — màu xanh/vàng/đỏ
- [ ] Top 10 xe chi phí sửa chữa cao nhất 6 tháng — bar chart
- [ ] Breakdown theo hạng mục: Engine vs Brake vs Body vs Electrical vs Tyre — pie chart
- [ ] MTTR (Mean Time To Repair) theo loại xe, theo garage — trend line
- [ ] Garage benchmark: so sánh chi phí trung bình cùng dịch vụ giữa các garage
- [ ] Alert: chi phí 12 tháng > 150% benchmark → thông báo Quản lý + BGĐ
- [ ] Alert: hóa đơn vượt báo giá > 20% → approver + KT phải giải trình
- [ ] Alert: ngân sách tháng > 90% → real-time notification

### US-TMS-33: Fuel Management & Anomaly Detection
**As a** quản lý đội xe / tài xế  
**I want to** ghi nhận nhiên liệu và phát hiện tiêu hao bất thường  
**So that** giảm thất thoát nhiên liệu, ước tính 200-350M VNĐ/năm

**Fuel Anomaly Formula:**
```
expected_fuel (lít) = 
  distance_km 
  × base_consumption[vehicle_type]  -- L/100km theo loại xe
  × road_factor[route_type]         -- đồng bằng=1.0, đèo=1.3, đô thị=1.15
  × load_factor = (1 + 0.15 × load_pct)
  × ac_factor (1.08 nếu A/C)

anomaly_ratio = |actual - expected| / expected
if anomaly_ratio > 0.25 → Flag "Bất thường" → yêu cầu giải trình
```

**Seed data định mức tiêu hao VN:**
| Loại xe | Định mức (L/100km) | Ghi chú |
|---------|-------------------|---------|
| 2.5 tấn | 10-12 | Tốc độ 60-80km/h, tải 70% |
| 5 tấn | 13-16 | Tốc độ 60-80km/h, tải 70% |
| 8 tấn | 18-22 | Đường quốc lộ |
| 16 tấn | 25-30 | Tải đầy, quốc lộ |

**Acceptance Criteria:**
- [ ] CRUD Fuel Log: POST/GET `/v1/fleet/fuel-logs` — tài xế nhập km + lít + tiền + ảnh HĐ
- [ ] 3 kênh nhập: Driver App (chính), Web (Đội trưởng backup), Fleet card API (tương lai)
- [ ] Anomaly detection: tự động tính khi fuel_log created → flag nếu > 25%
- [ ] Fuel anomaly: yêu cầu giải trình tài xế (text) → Fleet Manager review
- [ ] Cross-check: km đồng hồ vs GPS distance (±5% tolerance xe cũ)
- [ ] Entity Events: `fuel_log_created`, `fuel_anomaly_detected`, `fuel_anomaly_resolved`

### US-TMS-34: Tire & Component Lifecycle (Simplified)
**As a** quản lý đội xe  
**I want to** theo dõi tình trạng lốp theo từng xe  
**So that** lên kế hoạch thay lốp tập trung, tiết kiệm 10-15% chi phí volume

**Đơn giản hóa cho BHL:** Track theo **bộ lốp per xe** (không per serial number)

**Acceptance Criteria:**
- [ ] Tire Set per vehicle: gắn bộ lốp (thương hiệu, kích thước, ngày lắp, km lắp, số lượng lốp)
- [ ] Tài xế report tình trạng: OK / Mòn / Cần thay (trong checklist đầu ca)
- [ ] Rotation reminder: mỗi 10,000km → thông báo đảo lốp
- [ ] Cost per km per bộ lốp per xe — so sánh thương hiệu
- [ ] Bulk replacement forecast: bao nhiêu bộ lốp cần thay quý tới

### US-TMS-36: Vendor/Garage Rating & Management
**As a** quản lý đội xe  
**I want to** đánh giá và quản lý garage sửa chữa  
**So that** chọn garage tốt nhất về chất lượng-giá-thời gian

**Acceptance Criteria:**
- [ ] CRUD Garage profile: tên, địa chỉ, SĐT, chuyên môn, giờ mở, GPS
- [ ] Performance Score tự động sau RO completed: chất lượng (0-10) + MTTR + chi phí vs báo giá + tỷ lệ sửa lại
- [ ] Benchmark bảng giá: cùng dịch vụ, so sánh giữa các garage
- [ ] Preferred Garage list: quản lý đánh dấu garage ưu tiên per vehicle type
- [ ] Blacklist: garage "không dùng" → không xuất hiện khi tạo RO
- [ ] Garage distance suggest: khi xe hỏng đường → OSRM suggest garage gần nhất + rating cao

### US-TMS-37: Fleet TCO Dashboard
**As a** BGĐ / quản lý đội xe  
**I want to** xem tổng chi phí sở hữu (TCO) từng xe  
**So that** quyết định thanh lý/mua mới/thuê ngoài dựa trên dữ liệu

**TCO Formula:**
```
TCO/vehicle/month = depreciation + fuel + maintenance + repair 
  + tyre + toll + driver_allowance + insurance + misc
CPK = TCO / km_driven
ROI = revenue_contributed / TCO
```

**Acceptance Criteria:**
- [ ] CPK (Cost Per Km) per vehicle — GET `/v1/fleet/tco/:vehicle_id`
- [ ] Fleet TCO summary — GET `/v1/fleet/tco/summary`
- [ ] Scatter plot ROI vs Tuổi xe → xe cần thanh lý (ROI thấp + tuổi cao)
- [ ] Cost Heatmap: xe × hạng mục chi phí → outlier cell đỏ
- [ ] Make vs Buy: CPK nội bộ vs thuê ngoài per tuyến
- [ ] Replacement recommendation: tuổi > 8 năm + repair_12m > 60% giá → đề xuất thanh lý

## DMS+ — Quản lý Tài xế

### US-TMS-27: Driver AI Safety Scorecard
**As a** quản lý đội xe / tài xế  
**I want to** điểm hiệu suất tổng hợp cho từng tài xế  
**So that** khen thưởng minh bạch, phát hiện rủi ro, cải thiện

**5 Chỉ số (Phase 1 — GPS smartphone only, không dùng accelerometer):**
| Chỉ số | Trọng số | Nguồn |
|--------|----------|-------|
| OTD Rate (giao đúng giờ) | 30% | Trip timestamps vs planned ETA |
| Delivery Success Rate | 25% | Stops delivered / total stops |
| Compliance Score | 25% | Checklist + ePOD + EOD on-time |
| Customer Score | 10% | Zalo confirm vs reject rate |
| Speed Compliance | 10% | GPS speed vs OSRM road limit (threshold >20%) |

**Acceptance Criteria:**
- [ ] Score batch tính lúc 23:59 ICT → lưu `driver_score_snapshots`
- [ ] Driver App: Gauge chart 0-100, radar 5 chỉ số, trend 6 tháng
- [ ] Driver App: So sánh với đội "Bạn ở top X% / 70 tài xế"
- [ ] Driver App: Contextual tip khi chỉ số thấp
- [ ] Manager Dashboard: bảng tài xế sort theo score, filter ca/tuyến/xe
- [ ] Drill-down: click tài xế → timeline vi phạm từng chuyến
- [ ] Export báo cáo tháng → Excel → input Kế toán tính lương
- [ ] Entity Events: `driver_score_calculated`, `driver_score_milestone`

### US-TMS-29: Gamification & Incentive Engine
**As a** tài xế  
**I want to** thấy huy hiệu, thứ hạng, phần thưởng  
**So that** có động lực cải thiện hiệu suất

**Badge System:**
| Huy hiệu | Điều kiện | Thưởng |
|-----------|-----------|--------|
| 🏆 Tài xế Xuất sắc Tháng | Top 3 điểm tổng hợp | 1,000,000 VNĐ |
| ⚡ Vô địch Đúng Giờ | OTD = 100% cả tháng (≥15 ngày) | 500,000 VNĐ |
| 🛡 Lái xe An toàn | Safety ≥ 90 cả tháng | 500,000 VNĐ |
| 💚 Tiết kiệm Nhiên liệu | Tiêu hao < định mức ≥ 10% | 300,000 VNĐ |
| 🔥 Streak 30 ngày | 30 ngày liên tiếp không vi phạm | 300,000 VNĐ |
| 📸 ePOD Master | 30 ngày ePOD đủ + sắc nét | 200,000 VNĐ |
| 💯 Mốc 100/500/1000 Chuyến | Cộng dồn | Danh dự + thưởng |

**Acceptance Criteria:**
- [ ] Badge auto-award chạy 23:59 cuối tháng — admin có thể trigger thủ công
- [ ] Leaderboard cập nhật hàng ngày, Top 5 tuần (Avatar, Tên, Điểm, Badges)
- [ ] Rank cá nhân: "#X / 70 tài xế" + so sánh tuần trước (↑/↓)
- [ ] Progress bar đến badge tiếp theo: "Còn X ngày đạt Streak 30"
- [ ] Bonus report export Excel compatible format Bravo
- [ ] `monthly_bonus = sum(badges × value) + performance_bonus × (avg_score/100)`
- [ ] Tất cả badge award có audit trail (condition_snapshot lưu DB)
- [ ] Admin: thêm/sửa/ẩn badge không cần deploy code (JSONB condition_config)
- [ ] Anti-gaming: random audit 10% chuyến/tuần bởi Đội trưởng
- [ ] Grace period: 2 tháng đầu chỉ hiển thị score, KHÔNG gắn lương
- [ ] Entity Events: `badge_awarded`, `bonus_calculated`

### US-TMS-39: Driver Leave & Wellbeing (Mini)
**As a** tài xế  
**I want to** xin nghỉ phép trên app  
**So that** VRP tự động không xếp chuyến trong ngày nghỉ

**Acceptance Criteria:**
- [ ] Leave Request: POST `/v1/drivers/:id/leave-requests` — loại, ngày, lý do
- [ ] Đội trưởng duyệt: PUT `/v1/drivers/leave-requests/:id/approve`
- [ ] Khi approved → VRP Engine exclude driver khỏi available pool ngày nghỉ
- [ ] Xem số ngày phép còn lại: annual/sick/unpaid
- [ ] Emergency contact: 2 SĐT người thân trên driver profile
- [ ] Entity Events: `leave_requested`, `leave_approved`

---

## 14C.1 Notification Events Mới (Fleet & Driver)

Bổ sung vào 33 events hiện tại (Section 11). Tổng: 33 + 15 = 48 events.

### P0 — Critical (thêm 2)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 34 | Vehicle Health Score < 40 (critical) | Fleet Manager + Dispatcher | Web push + Zalo |
| 35 | Fuel anomaly ratio > 40% (nghiêm trọng) | Fleet Manager + KT | Web push + Email |

### P1 — Urgent (thêm 7)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 36 | Repair Order tạo mới (cần approve) | Approver theo hạn mức | Web push |
| 37 | Repair Order overdue (chưa duyệt > SLA) | Cấp trên approver | Web push + Zalo |
| 38 | Repair Order completed | Fleet Manager + KT | Web push |
| 39 | Ngân sách sửa chữa > 90% tháng | Fleet Manager + CFO | Web push + Email |
| 40 | Fuel anomaly detected (ratio > 25%) | Fleet Manager | Web push |
| 41 | Tire status "Cần thay" reported | Fleet Manager | Web push |
| 42 | Vehicle document expiry ≤ 7 ngày | Fleet Manager + Dispatcher | Web push |

### P2 — Important (thêm 4)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 43 | Badge awarded (tài xế đạt huy hiệu) | Driver | Driver App confetti + push |
| 44 | Driver score milestone (vào tier mới) | Driver | Driver App push |
| 45 | Vehicle document expiry ≤ 30 ngày | Fleet Manager | Web bell |
| 46 | Fuel anomaly resolved (đã giải trình) | Fleet Manager | Web notification |

### P3 — Digest (thêm 2)

| # | Sự kiện | Người nhận | Kênh |
|---|---------|-----------|------|
| 47 | Leave request approved/rejected | Driver | Driver App push |
| 48 | Vehicle health improved (score > 70) | Fleet Manager | Web notification |

---

## 14C.2 Migration Plan

| Migration# | Bảng | ALTER | Phase |
|------------|------|-------|-------|
| 030 | work_orders, repair_items, repair_attachments | vehicles (health_score, last_health_check) | 8A |
| 031 | garages, garage_ratings | — | 8A |
| 032 | fuel_logs, fuel_anomalies | — | 8A |
| 033 | driver_scores, driver_score_snapshots | — | 8B |
| 034 | gamification_badges, badge_awards | — | 8B |
| 035 | tire_sets, leave_requests | — | 8B |

## 14C.3 API Endpoints

**Fleet Management:**
```
POST   /v1/fleet/work-orders                  -- Tạo Repair Order
GET    /v1/fleet/work-orders                  -- List (filter: status/vehicle/date)
PUT    /v1/fleet/work-orders/:id              -- Cập nhật RO
POST   /v1/fleet/work-orders/:id/approve      -- Phê duyệt
POST   /v1/fleet/work-orders/:id/complete     -- Hoàn thành
GET    /v1/fleet/garages                      -- Danh sách garage
POST   /v1/fleet/garages                      -- Tạo garage
PUT    /v1/fleet/garages/:id                  -- Cập nhật garage
POST   /v1/fleet/garages/:id/rate             -- Đánh giá garage
POST   /v1/fleet/fuel-logs                    -- Nhập nhiên liệu
GET    /v1/fleet/fuel-logs                    -- List + filter
GET    /v1/fleet/fuel-logs/:id/anomaly        -- Anomaly detail
GET    /v1/fleet/tco/:vehicle_id              -- TCO breakdown 1 xe
GET    /v1/fleet/tco/summary                  -- TCO toàn fleet
GET    /v1/fleet/analytics/cost               -- Cost analytics
GET    /v1/fleet/analytics/replacement        -- Xe nên thanh lý
GET    /v1/fleet/tyres/:vehicle_id            -- Bộ lốp xe
POST   /v1/fleet/tyres                        -- Gắn bộ lốp mới
PUT    /v1/fleet/tyres/:id                    -- Cập nhật tình trạng
GET    /v1/vehicles/:id/health                -- Health score
```

**Driver Management:**
```
GET    /v1/drivers/:id/scorecard              -- Điểm tổng hợp + breakdown
GET    /v1/drivers/leaderboard                -- Bảng xếp hạng (week/month)
GET    /v1/drivers/:id/safety-events          -- Vi phạm chi tiết
GET    /v1/drivers/:id/badges                 -- Huy hiệu đã đạt
GET    /v1/drivers/gamification/bonus-report  -- Export bonus KT
POST   /v1/drivers/:id/leave-requests         -- Xin nghỉ phép
PUT    /v1/drivers/leave-requests/:id/approve -- Duyệt nghỉ
GET    /v1/drivers/:id/fuel-logs              -- Nhiên liệu driver
```

---

# 14D. AI-NATIVE PROGRESSIVE ENHANCEMENT LAYER

> **Phiên bản:** 2.1 — 27/04/2026  
> **Nguồn chi tiết:** `docs/specs/AI_NATIVE_BLUEPRINT_v3.md`  
> **Nguyên tắc:** AI là progressive enhancement. Core workflow phải chạy 100% khi AI flag OFF.  
> **Kiến trúc:** Hybrid-Edge + Feature Flag + Privacy Router + provider fallback.  
> **Quyết định:** DEC-AI-01, DEC-AI-02.

## 14D.1 Tổng quan

AI-Native Layer không phải module riêng lẻ — là **tầng tăng cường** xuyên suốt OMS, TMS, WMS, Control Tower, Driver, Admin. Mọi AI feature phải có baseline UX tương ứng khi tắt AI.

Từ 27/04/2026, phạm vi UX triển khai theo **Decision Intelligence Layer**: AI chỉ mở rộng tại điểm ra quyết định có giá trị cao, gồm OMS tạo đơn, approval queue, VRP planning, Control Tower và Driver PWA. Không coi “AI luôn hiện” là yêu cầu; AI OFF là trạng thái an toàn bắt buộc.

| Nhóm | Approach | Chi phí | Phụ thuộc |
|------|---------|---------|----------|
| **Smart Rules** (AI-R) | Công thức Go thuần — score, alert, suggest | $0 | Không |
| **Generative AI** (AI-G) | Gemini 2.0 Flash free (1,500 req/ngày) + Groq fallback | $0 | API key free |
| **ML Service** (AI-M) | Extend Python VRP solver :8090 hiện có | $0 | :8090 đang chạy |
| **AI Toggle** (AI-F) | `ai_feature_flags` 3 cấp org/role/user, default OFF | $0 | PostgreSQL |
| **Privacy Router** (AI-P) | Fail-closed backend classifier trước provider | $0 | Go regex/rules |

## 14D.1a AI Toggle Requirements

| Requirement | Acceptance Criteria |
|---|---|
| Master switch | Admin có thể tắt `ai.master`; toàn bộ AI hidden/disabled, baseline còn dùng được |
| Feature flag | Admin bật/tắt từng feature độc lập: copilot, briefing, voice, camera, simulation, intent, automation, anomaly, forecast, credit score, adaptive UI, transparency, trust loop, explainability, feedback |
| Role/user scope | Flag có thể áp cho org, role hoặc user; độ ưu tiên user > role > org > default |
| Fail-safe | Không có row hoặc DB lỗi khi resolve flag → disabled |
| Audit | Mọi thay đổi flag ghi lại người cập nhật, thời điểm, config |

## 14D.1b Baseline UX khi AI OFF

| AI Feature | Baseline bắt buộc |
|---|---|
| Copilot | Người dùng dùng sidebar/menu/search truyền thống |
| Daily Briefing | Dashboard KPI hiện tại vẫn render |
| Voice Driver | Tài xế thao tác bằng nút manual |
| Camera Extract | Tài xế/DVKH điền form thủ công |
| Simulation | Dispatcher chạy VRP/đổi tuyến thủ công |
| Intent | Cmd+K chỉ navigate/search |
| Forecast/Credit score | Hiển thị số liệu raw hiện có |

## 14D.1c Decision Intelligence Requirements

| Requirement | Acceptance Criteria |
|---|---|
| Attention budget | Mỗi workflow chỉ có tối đa 1 AI surface expanded mặc định; các insight phụ dùng chip/drawer/inbox |
| Trust metadata | Suggestion quan trọng có nguồn, confidence hoặc data freshness/sample size nếu có |
| Human control | AI không auto-approve công nợ, không auto-submit voice/camera/write action |
| Fail-soft | AI endpoint lỗi hoặc flag OFF không crash page, không chặn submit baseline |
| Workflow fit | Insight xuất hiện ngay tại điểm quyết định, không bắt user mở trang AI riêng để xử lý nghiệp vụ |

## 14D.2 User Stories

### US-AI-01: Anomaly Score Realtime — Control Tower

**Role:** Dispatcher  
**As a** Dispatcher,  
**I want** mỗi xe trên bản đồ hiển thị Anomaly Score (0–100),  
**So that** tôi biết ngay xe nào cần chú ý mà không cần đọc từng cảnh báo riêng lẻ.

**Acceptance Criteria:**
- AC#1: Score được tính từ 3 signal: deviation_km (×40%), stop_duration_min (×40%), speed_kmh (×20%)
- AC#2: Score 0–39 = xanh, 40–69 = vàng, 70–100 = đỏ với pulse animation
- AC#3: Hover marker hiển thị breakdown từng signal
- AC#4: Score cập nhật mỗi khi GPS point mới đến (real-time)
- AC#5: Score lưu vào `ai_insights` với TTL 24h

**Data sources:** GPS live stream, `gps_anomaly_thresholds` table (đã có từ F7), `trip_stops`

---

### US-AI-02: Credit Risk Intelligence — Accountant

**Role:** Accountant / KT trưởng  
**As an** Accountant,  
**I want** mỗi NPP có Credit Risk chip (THẤP/TRUNG BÌNH/CAO/NGUY HIỂM),  
**So that** tôi ra quyết định duyệt công nợ có thông tin đầy đủ hơn số dư đơn thuần.

**Acceptance Criteria:**
- AC#1: Score = `payment_delay_days×3 + debt_growth_14d_pct×2 + order_drop_30d_pct×1`
- AC#2: THẤP (<30), TRUNG BÌNH (30–59), CAO (60–79), NGUY HIỂM (≥80) — màu xanh/vàng/cam/đỏ
- AC#3: Tooltip giải thích từng yếu tố: "Trễ thanh toán 8 ngày, nợ tăng 22%, đơn giảm 15%"
- AC#4: Endpoint `GET /v1/ai/customers/:id/risk-score` chỉ trả dữ liệu khi `ai.credit_score` ON; roles gồm admin, accountant, management, dvkh
- AC#5: Score xuất hiện trong danh sách duyệt pending approvals và OMS create order strip; AI OFF thì chỉ hiện raw công nợ/hạn mức

**Data sources:** `receivable_ledger`, `sales_orders`, `npp_health_scores` table (đã có từ F2)

---

### US-AI-03: Daily Dispatch Briefing — Dashboard Dispatcher

**Role:** Dispatcher  
**As a** Dispatcher,  
**I want** một đoạn tóm tắt AI (~100 từ) hiển thị trên dashboard khi tôi vào lúc sáng,  
**So that** tôi nắm tình hình trong 5 giây mà không cần đọc nhiều widget riêng lẻ.

**Acceptance Criteria:**
- AC#1: Cron 7h ICT mỗi ngày → gọi Gemini API với context (đơn hôm nay, xe available, NPP at-risk, seasonal index)
- AC#2: Output lưu vào `ai_insights` (type=dispatch_brief, expires 24h)
- AC#3: Widget "Tóm tắt AI" xuất hiện đầu trang Dashboard dispatcher, có timestamp
- AC#4: Fallback: nếu Gemini fail → Groq API; nếu cả hai fail → hiển thị summary rule-based (số đơn, số xe)
- AC#5: Nội dung tiếng Việt, ≤150 từ, format: Tổng quan → Điểm chú ý → Đề xuất ưu tiên

**Provider:** Gemini 2.0 Flash free tier (~1 req/ngày)

---

### US-AI-04: Exception Explanation — Control Tower

**Role:** Dispatcher  
**As a** Dispatcher,  
**I want** khi click vào exception, thấy giải thích AI thay vì chỉ label "Lệch tuyến 2.3km",  
**So that** tôi hiểu context và quyết định action phù hợp nhanh hơn.

**Acceptance Criteria:**
- AC#1: Khi exception type=deviation/idle/failed_stop → gọi Gemini với context (GPS trace 30 phút, trip info, NPP history lần giao trước)
- AC#2: Output: 2–3 câu giải thích + 2 action suggestions (VD: "Gọi tài xế", "Xem lại tuyến")
- AC#3: Explanation lưu vào `ai_insights` (linked to `trip_exceptions.id`)
- AC#4: UI: expand "▶ Xem phân tích AI" trong exception card — không tự động mở (tránh spam API)
- AC#5: Nếu Gemini fail → hiển thị template explanation dựa trên exception type

**Provider:** Gemini 2.0 Flash free tier (~10 req/ngày)

---

### US-AI-05: Demand Intelligence Panel — OMS Order Form

**Role:** DVKH  
**As a** DVKH,  
**I want** sidebar hiển thị demand forecast khi tôi đang tạo đơn cho NPP,  
**So that** tôi gợi ý số lượng đúng và không cần hỏi NPP về nhu cầu.

**Acceptance Criteria:**
- AC#1: Khi chọn NPP + SKU trong order form → call `GET /ml/forecast-demand?npp_code=&sku=&week=`
- AC#2: Hiển thị: "Tuần này NPP này thường đặt ~340 Vỉ. Đơn hiện tại: 200 (thấp hơn 41%)."
- AC#3: Seasonal indicator: nếu seasonal_index tháng hiện tại >120 → badge "Mùa cao điểm"
- AC#4: Python endpoint `POST /ml/forecast-demand` trả p50 + p90 confidence interval
- AC#5: Nếu NPP/SKU không đủ data (< 4 tuần history) → hiển thị "Chưa đủ dữ liệu lịch sử"

**Provider:** Python :8090 (Prophet model, sku_daily_demand.parquet)

---

### US-AI-06: NPP Auto-Draft Zalo — DVKH Dashboard

**Role:** DVKH  
**As a** DVKH,  
**I want** khi NPP health score drop >20 điểm, hệ thống soạn sẵn tin nhắn Zalo nhắc nhở để tôi review và gửi,  
**So that** tôi không bỏ qua NPP at-risk và không mất thời gian soạn thảo.

**Acceptance Criteria:**
- AC#1: Trigger: cron hàng ngày 8h — detect NPP có health_score drop >20 trong 7 ngày
- AC#2: Gọi Gemini với context (NPP name, tỉnh, last order, đơn hàng gần nhất, segment)
- AC#3: Output: tin nhắn Zalo ~50 từ, thân thiện, không template cứng
- AC#4: DVKH thấy notification "3 NPP cần chăm sóc" + modal preview draft + nút "Gửi qua Zalo"
- AC#5: Ghi log `ai_insights` (type=zalo_draft, npp_id, generated_text, sent_at nullable)

**Provider:** Gemini 2.0 Flash free tier (~5 req/ngày)

---

### US-AI-07: AI Toggle Admin Panel

**Role:** Admin  
**As an** Admin,  
**I want** bật/tắt từng tính năng AI theo org/role/user,  
**So that** BHL rollout AI có kiểm soát và tắt nhanh khi cần mà không phá UX core.

**Acceptance Criteria:**
- AC#1: Page `/dashboard/settings/ai` chỉ admin truy cập được.
- AC#2: Hiển thị master switch và danh sách flags chuẩn trong blueprint v3.
- AC#3: Toggle lưu qua API admin, default missing flag = OFF.
- AC#4: Flag OFF làm AI UI hidden/disabled, baseline UI vẫn render.
- AC#5: Lưu `updated_by`, `updated_at`, `config`.

---

### US-AI-08: Privacy Router

**Role:** System  
**As a** backend service,  
**I want** phân loại dữ liệu sensitive trước khi gọi provider AI,  
**So that** PII/NPP/giá/tồn kho không bị gửi cloud sai rule.

**Acceptance Criteria:**
- AC#1: Regex classifier chạy <5ms cho prompt/context.
- AC#2: Confidence thấp hoặc match PII → route local/rules, fail-closed.
- AC#3: Cloud route phải anonymize NPP code, giá, tồn kho, số điện thoại.
- AC#4: Unit tests ≥50 cases, zero PII leak tolerance.

---

### US-AI-09: Simulation Before Action

**Role:** Dispatcher / Accountant / DVKH  
**As a** operator,  
**I want** xem trade-off trước khi áp dụng action AI,  
**So that** quyết định vận hành có dữ liệu nhưng vẫn do người duyệt.

**Acceptance Criteria:**
- AC#1: Simulation không ghi DB chính; chỉ lưu snapshot có TTL 5 phút.
- AC#2: VRP/re-route triển khai trước; stock/credit/cutoff sau.
- AC#3: Apply simulation phải revalidate snapshot rồi tạo Approval Card Tier 2.
- AC#4: UI có queued/running/ready/expired/failed state.

---

### US-AI-10: Explainability + Feedback

**Role:** All AI users  
**As a** user,  
**I want** biết vì sao AI đề xuất và gửi feedback,  
**So that** tôi calibrate trust và hệ thống cải thiện theo thời gian.

**Acceptance Criteria:**
- AC#1: AI suggestion card có Explainability popover hoặc lý do explicit `noExplain`.
- AC#2: Explanation lazy-load khi click, không gọi API lúc render.
- AC#3: Feedback options: correct, wrong, not_useful.
- AC#4: Feedback ghi vào audit/feedback log để dùng cho Trust Loop.

## 14D.3 Architecture — `internal/ai/` package

```
internal/ai/
├── flags.go            # Feature flag store, IsEnabled, cache TTL
├── privacy_router.go   # Sensitive classifier + anonymizer route decision
├── provider.go         # Provider interface: Generate(ctx, prompt, opts) (string, error)
├── rules.go            # RulesEngine: AnomalyScore, CreditRiskScore, SeasonalAlert
├── gemini.go           # GeminiProvider (Google Generative AI SDK)
├── groq.go             # GroqProvider (Groq API — fallback)
├── fallback.go         # FallbackChain: try providers in order
├── prompts/
│   ├── dispatch_brief.go
│   ├── exception_explain.go
│   └── npp_zalo_draft.go
└── service.go          # AIService: inject providers + rules, high-level methods

middleware/
└── ai_flags.go         # AIFeatureMiddleware(flagKey) cho endpoint AI mới
```

**Provider interface:**
```go
type Provider interface {
    Generate(ctx context.Context, prompt string, opts GenerateOpts) (string, error)
    Name() string
}

// Config: AI_PROVIDER=gemini (default free), AI_PROVIDER=claude (premium khi có revenue)
```

## 14D.4 Database — Migrations 040+

```sql
-- Bảng cache kết quả LLM (tránh gọi lại cho cùng context)
CREATE TABLE ai_insights (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type        TEXT NOT NULL,          -- dispatch_brief | exception_explain | zalo_draft | anomaly_score
    entity_type TEXT,                   -- trip | customer | exception | null
    entity_id   UUID,
    content     TEXT NOT NULL,          -- output text hoặc JSON
    provider    TEXT NOT NULL,          -- gemini | groq | rules
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    expires_at  TIMESTAMPTZ             -- NULL = permanent, SET = auto-expire
);
CREATE INDEX idx_ai_insights_entity ON ai_insights(entity_type, entity_id);
CREATE INDEX idx_ai_insights_type_created ON ai_insights(type, created_at DESC);

-- View daily signal for NPP outreach queue
CREATE VIEW npp_risk_signals AS
SELECT
    c.id AS customer_id, c.npp_code, c.name,
    hs.health_score, hs.risk_band, hs.segment,
    hs.recency_days, hs.frequency_orders,
    (hs.health_score - LAG(hs.health_score, 7) OVER (PARTITION BY c.id ORDER BY hs.computed_date)) AS score_delta_7d
FROM customers c
JOIN npp_health_scores hs ON hs.npp_code = c.npp_code
WHERE hs.computed_date = CURRENT_DATE;
```

Migration 042+ bổ sung AI Toggle:

```sql
CREATE TABLE ai_feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_key TEXT NOT NULL,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('org','role','user')),
  scope_id TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  config JSONB NOT NULL DEFAULT '{}',
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(flag_key, scope_type, scope_id)
);
```

## 14D.5 API Endpoints mới (Sprint 2)

```
GET  /v1/ai/dispatch-brief          -- Lấy brief hôm nay (cache từ cron)
GET  /v1/ai/features                -- Effective AI flags cho user hiện tại
GET  /v1/admin/ai-flags             -- Admin list flags
PUT  /v1/admin/ai-flags             -- Admin upsert flag org/role/user
GET  /v1/customers/:id/risk-score   -- Credit risk score cho NPP
GET  /v1/ai/outreach-queue          -- Danh sách NPP cần liên hệ hôm nay
POST /v1/ai/npp-zalo-draft          -- Generate Zalo draft cho NPP
POST /v1/ai/exception-explain/:id   -- Explain exception (lazy — gọi khi user expand)

# Python :8090 extension (không thay đổi port hay service)
POST /ml/forecast-demand            -- Prophet forecast per NPP×SKU×week
GET  /ml/seasonal-index             -- seasonal_index_kho_month lookup
```

## 14D.6 Phân quyền

| Endpoint | Roles |
|----------|-------|
| `GET /v1/ai/dispatch-brief` | dispatcher, admin, management |
| `GET /v1/customers/:id/risk-score` | accountant, admin, dvkh |
| `GET /v1/ai/outreach-queue` | dvkh, admin |
| `POST /v1/ai/npp-zalo-draft` | dvkh, admin |
| `POST /v1/ai/exception-explain/:id` | dispatcher, admin |
| `POST /ml/forecast-demand` | dvkh, dispatcher, management, admin |
| `GET /v1/ai/features` | authenticated users |
| `GET/PUT /v1/admin/ai-flags` | admin |

---

# 15. TIÊU CHÍ NGHIỆM THU (UAT)

| # | Tiêu chí | Tham chiếu |
|---|----------|-----------|
| 1 | Đơn hàng được xử lý đúng quy trình từ nhận đơn đến đối soát cuối ngày | OMS → TMS → WMS → REC |
| 2 | Quy tắc mốc chốt đơn trước/sau 16h vận hành đúng | R08, US-OMS-08 |
| 3 | Cho phép công nợ, không bắt buộc thu ngay, hạ hàng trước thanh toán | R03, R04, FIN-01, FIN-02 |
| 4 | Giao thất bại → giao lại nhiều lần, thống kê đúng số lần + lý do | R05, US-TMS-14b |
| 5 | Quản lý vỏ theo quy đổi (CÁI/KEG), sai lệch vỏ = 0, lái xe chịu trách nhiệm | R02, R14, RA-01~04 |
| 6 | Vỏ hỏng/mất tính bồi hoàn đúng theo đơn giá từng thời kỳ | R10, RA-05, US-WMS-21b |
| 7 | Cảnh báo cận hạn hoạt động theo ngưỡng đã thiết lập | WMS-02, US-WMS-11 |
| 8 | Sai lệch phát sinh được theo dõi và đóng xử lý đúng hạn T+1 | R06, REC-02, US-REC-02 |
| 9 | Báo cáo vận hành thể hiện đầy đủ KPI: OTD (khung 1 giờ), xe rỗng, giao lại, công nợ | REP-01~03 |
| 10 | Bàn giao A: Thủ kho + Bảo vệ + Lái xe cùng ký số, sai lệch = 0; Bàn giao B/C có ký số 2 bên | R01, R16, R17, R18, US-WMS-03, US-WMS-04 |
| 11 | Hạn mức công nợ NPP chặn đơn đúng, Kế toán duyệt đúng flow | R15, US-OMS-07 |
| 12 | Xác nhận giao hàng qua Zalo + Silent Consent 24h hoạt động đúng | R13 |
| 13 | Repair Order: tạo → approve → complete → chi phí tracked end-to-end | US-TMS-31, US-TMS-32 |
| 14 | Fuel Log: driver nhập → anomaly detection → alert fleet manager | US-TMS-33 |
| 15 | Driver Scorecard: 5 chỉ số batch daily, leaderboard, badge auto-award | US-TMS-27, US-TMS-29 |
| 16 | Vehicle Health Score → VRP exclude xe < 50 | US-TMS-23 |

---

**=== HẾT TÀI LIỆU BRD V3.6 ===

*Phiên bản 3.6 (21/04/2026) — Thêm Section 14C Fleet & Driver Management (FMS+/DMS+): 9 US mới, 15 notification events, 6 migrations (030-035), 28 API endpoints. Bỏ HOS/Shift/Spare Parts. Rule-based Health Score thay ML Phase đầu. Driver Scorecard 5 chỉ số (không accelerometer). Gamification 7 badge types.*

*Phiên bản 3.5 (20/04/2026) — Audit lại code thực tế và đồng bộ BRD: thống nhất metadata đầu file với lịch sử phiên bản, cập nhật US-TMS-01d/01e/01f theo Cost Engine + GPS Simulation đang chạy thật (cost readiness auto mode, dữ liệu toll miền Bắc, active trip statuses thực tế), cập nhật US-TMS-13 AC ảnh ePOD từ [ ] sang [x] vì backend đã enforce tối thiểu 1 ảnh.*

*Phiên bản 3.4 (17/04/2026) — Đồng bộ Control Tower theo code thực tế: bổ sung acceptance criteria hiển thị Trip progress + ETA deviation (progress bar + ETA countdown + badge lệch ETA) trong US-NEW-19; chuẩn hoá endpoint cancel/move theo POST.*

*Phiên bản 3.3 (16/04/2026) — Rà soát code vs BRD toàn diện. Thêm US-TMS-01d (Cost Engine VRP tối ưu chi phí VND), US-TMS-01e (Quản lý biểu phí toll/fuel/driver), US-TMS-01f (GPS Simulation API in-process). Migration 020: 6 bảng cost engine + seed data QN/HP. Đánh dấu [x] các AC đã triển khai: VRP criteria selection, payment recording (5 methods), credit limit expiry/history, redelivery report, import/export Excel, EOD bàn giao sổ, checklist photo. Fix proxy port 8097→8080.*

*Phiên bản 3.2 — Cập nhật nghiệp vụ: Bàn giao A/B/C thay gate-check (R16-R18, US-WMS-03/22, US-TMS-17); Hạn mức công nợ NPP tuỳ chọn 4 trường hợp (R04, R15, US-OMS-01/07); VRP criteria + manual planning (US-TMS-01); PDA chỉ inbound+inventory (US-WMS-15); Timeline 12 lớp event mapping; Trip status thêm Handover_A_Signed, Vehicle_Breakdown; NPP Portal 800 users; Thêm US-NEW-20 Import/Export Excel. Entity events 23→26.*

*Phiên bản 3.1 — Rà soát code vs docs toàn diện (Session 25/03). Thêm US-NEW-14~19 (Notification 4-Layer, Dynamic RBAC + Sessions, EOD Checkpoints, Vehicle/Driver Docs, Sentry, Control Tower). Cập nhật: Section 9.2 Action-level RBAC → [◐] Partial (PermissionGuard middleware). Section 11.4 P1 toast persistent → [x]. Test Portal 13→21 endpoints.*

*Phiên bản 3.0 — Merge từ BRD v4.0 gap analysis. Nâng cấp: Section 1 (KPI mục tiêu + quy mô 80 users), Section 9 (3-layer RBAC + action matrix 11 roles), Section 11 (33 notification events P0-P3), NEW Section 12 (Timeline 10 lớp), renumber sections 13-15. Session 18.*

*Phiên bản 2.4 — Thêm US-NEW-11~13 (Entity Events/Timeline, Order Notes, Test Portal). Cập nhật acceptance criteria notification: slide panel thay dropdown, trang /notifications, WebSocket toast. Session 18.*

*Phiên bản 2.3 — Rà soát code vs spec toàn diện. Đánh dấu [x] tất cả acceptance criteria đã triển khai. Thêm 10 user stories bổ sung (US-NEW-01~10) cho các tính năng phát sinh: Admin CRUD, Driver Check-in, KPI, GPS enriched, Offline Sync, Driver Profile, Urgent Priority, Pending Dates, Role-specific Dashboard, DLQ Management.*

*Phiên bản 2.2 — Thêm US-OMS-02a (Sửa đơn hàng khi chưa giao).*

*Phiên bản 2.1 — Thêm US-TMS-01a/01b/01c (Dashboard tối ưu VRP, Điều chỉnh kế hoạch, Bản đồ OSRM).*

*Phiên bản 2.0 Final — Merge BRD V1.2 (nghiệp vụ) + trao đổi BA (giải pháp). Sẵn sàng cho thiết kế kỹ thuật và vibe coding.*


---

# 16. WORLD-CLASS ENHANCEMENTS — Session 28/04/2026

> Bổ sung 3 bộ năng lực vận hành "world-class" trên nền BRD v2.4. KHÔNG đảo ngược bất kỳ user story nào trước đó — chỉ mở rộng.

## 16.1 WMS Bin Guidance (Phase A)

### Mục tiêu nghiệp vụ
Khi nhập kho, thủ kho thấy ngay 3 vị trí (bin) được hệ thống đề xuất; khi soạn hàng (picking) phiếu in luôn ghi rõ "CẤT TỪ BIN" để picker đi đúng đường, giảm thời gian dò tìm.

### User Stories
| ID | Vai trò | Yêu cầu | Acceptance |
|----|---------|---------|-----------|
| US-WMS-WC-01 | Thủ kho nhập | "Khi tôi chọn sản phẩm + số lượng kg, hệ thống gợi ý 3 bin tốt nhất" | GET /v1/warehouse/inbound/suggest-bin-preview trả top-3 (cùng SKU +40, velocity A +25, free slots ×5 cap 20). UI hiển thị card kèm nút "✨ Gợi ý vị trí tốt nhất". |
| US-WMS-WC-02 | Picker | "Phiếu lấy hàng phải in rõ bin để tôi đi 1 lần đúng đường" | A4 slip có cột "CẤT TỪ BIN" font-2xl emerald, sort theo Zone→BinCode→ExpiryDate (FEFO + walk-path). |
| US-WMS-WC-03 | Quản lý kho | "Mỗi kho có bin code riêng, không đụng kho khác" | Migration 044 thay unq_bin_locations_code bằng unq_bin_locations_wh_code (warehouse_id, code). Seed 104 bin (52/kho × 2). |

### Phụ thuộc
- in_locations, pallets.current_bin_id, stock_quants (Phase 9 đã có).

## 16.2 VRP Customer Delivery Constraints (Phase B)

### Mục tiêu nghiệp vụ
Mỗi khách hàng có thể quy định: tải trọng tối đa xe được vào, các khung giờ giao hàng, các khung giờ cấm tải, ghi chú tiếp cận. Auto-planning (VRP) phải tôn trọng tải trọng; planner thấy chips constraint trên màn hình kế hoạch để không xếp sai khung giờ.

### User Stories
| ID | Vai trò | Yêu cầu | Acceptance |
|----|---------|---------|-----------|
| US-VRP-WC-01 | Sales/Admin/Dispatcher | "Tôi muốn khai báo ràng buộc vận chuyển cho từng khách" | /dashboard/customers/[id]/vrp-constraints cho phép sửa max_vehicle_weight_kg + delivery_windows + forbidden_windows + access_notes. PUT /v1/customers/:id/vrp-constraints (admin/dispatcher). |
| US-VRP-WC-02 | VRP solver | "Khi giải VRP, không gán xe quá tải cho khách giới hạn" | Solver Python outing.VehicleVar(node).SetValues([-1] + allowed); log weight_constraint_count. Nếu KHÔNG có xe phù hợp, node bị unassigned (đã có disjunction). |
| US-VRP-WC-03 | Dispatcher | "Khi xem kế hoạch, thấy ngay khách nào có giới hạn để né lỗi giao thủ công" | Planning page chips: ≤5T amber, 🟢 06-11+1 emerald, 🚫 06-09 red, 📝 slate cạnh tên khách trên modal trip + bảng trip. Bulk-fetch theo customer_id duy nhất. |

### Schema (mig 045)
`sql
ALTER TABLE customers
  ADD COLUMN max_vehicle_weight_kg INT DEFAULT 0,
  ADD COLUMN delivery_windows JSONB DEFAULT '[]',   -- [{start:"06:00",end:"11:00",days:[1,2,3,4,5,6]}]
  ADD COLUMN forbidden_windows JSONB DEFAULT '[]',  -- [{start,end,days,reason}]
  ADD COLUMN access_notes TEXT;
`

### Tech Debt mở
- TD-VRP-TIMEWINDOWS: solver chưa enforce time windows (mới enforce weight). Planner xem chips để né.

## 16.3 Asset Passport — Vehicle & Driver Profile (Phase C)

### Mục tiêu nghiệp vụ
Mỗi xe và mỗi tài xế có "tư liệu nghề nghiệp" (passport) hiển thị toàn bộ lịch sử: chuyến, bảo dưỡng, đổ dầu, điểm số, nghỉ phép, huy hiệu — phục vụ đánh giá định kỳ, điều tra sự cố, thưởng/phạt.

### User Stories
| ID | Vai trò | Yêu cầu | Acceptance |
|----|---------|---------|-----------|
| US-PASSPORT-01 | Quản lý đội xe | "Tôi muốn xem hồ sơ vận hành 1 xe (km, chuyến, bảo dưỡng, đổ dầu)" | /dashboard/vehicles/[id]/profile — KPI grid + timeline merge work_orders/fuel_logs. Endpoints /v1/vehicles/:id/{timeline,utilization}. |
| US-PASSPORT-02 | HR / Trưởng đội | "Tôi muốn xem sự nghiệp 1 tài xế (chuyến, điểm, nghỉ, huy hiệu)" | /dashboard/drivers-list/[id]/profile — KPI grid + timeline merge trips/scores/leaves/badges. Endpoints /v1/drivers/:id/{timeline,career-stats}. |
| US-PASSPORT-03 | Designer | "Hồ sơ phải có ngôn ngữ thiết kế khác dashboard để cảm giác trang trọng" | Layout dùng font serif 5xl + palette stone/neutral, KHÁC brand-orange dashboard chính. Truy cập từ list page qua CTA "📜 Hồ sơ". |

### Endpoints
- GET /v1/vehicles/:id/timeline → [{at, kind, title, subtitle?, amount_vnd?, meta?}]
- GET /v1/vehicles/:id/utilization → {total_km, active_days, total_trips, avg_km_per_day, first_trip_at, last_trip_at, last_service_at}
- GET /v1/drivers/:id/timeline → tương tự
- GET /v1/drivers/:id/career-stats → {full_name, hire_date, years_active, total_trips, total_km, current_score, avg_score_90d, badge_count, ...}

---
*Phiên bản 2.5 — Bổ sung 3 năng lực World-Class Phase A/B/C (28/04/2026): WMS Bin Guidance, VRP Customer Constraints, Asset Passport.*
