# UAT Test Script — Kế toán (Accountant Reconciliation)

> **Task 4.9** | Kế toán test đối soát  
> **Phiên bản:** 1.0 | **Ngày:** 15/03/2026

---

## 📱 Thông tin Test

| Hạng mục | Chi tiết |
|----------|---------|
| URL | `http://localhost:3000/login` |
| Tài khoản | `accountant01` (Lê Thị Mai) |
| Mật khẩu | `demo123` |
| Vai trò | Kế toán — quyền: order:view, order:approve, payment:view, report:view |

---

## 🧪 Test Cases (10 cases)

### TC-A01: Đăng nhập & Dashboard Kế toán

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Đăng nhập `accountant01` / `demo123` | Dashboard kế toán hiển thị |
| 2 | Kiểm tra sidebar: Đơn hàng, Đối soát, Báo cáo | Menu items hiện đúng role |
| 3 | Kiểm tra dashboard widgets: doanh thu, công nợ | Dữ liệu tổng hợp hiển thị |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A02: Duyệt đơn hàng vượt credit limit

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Vào "Đơn hàng" → Lọc trạng thái "Chờ duyệt" | Danh sách đơn pending_approval |
| 2 | Nhấn vào 1 đơn hàng | Chi tiết đơn: NPP, sản phẩm, số tiền |
| 3 | Kiểm tra thông tin credit: dư nợ, hạn mức | Hiện credit_limit & outstanding |
| 4 | Nhấn "Duyệt" (Approve) | Đơn → status "approved" |
| 5 | Thử "Từ chối" (Reject) trên đơn khác | Đơn → status "cancelled" |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A03: Đối soát hàng hóa (Goods Reconciliation)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Vào "Đối soát" → Tab "Đối soát" | Danh sách phiên đối soát |
| 2 | Lọc theo ngày: 15/03/2026 | Kết quả lọc đúng |
| 3 | Xem chi tiết phiên: so sánh ordered vs delivered | Bảng so sánh hiển thị |
| 4 | Kiểm tra trạng thái: matched / discrepancy | Color-coded badges |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A04: Đối soát tiền (Payment Reconciliation)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tại tab "Đối soát" → Lọc "Tiền" | Danh sách đối soát tiền |
| 2 | Kiểm tra: amount_expected vs amount_collected | Số liệu hiển thị |
| 3 | Xem chi tiết phương thức thu (cash/transfer) | Breakdown hiện đúng |
| 4 | Tìm discrepancy (sai lệch) | Highlight sai lệch |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A05: Đối soát vỏ (Asset Reconciliation)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Tại tab "Đối soát" → Lọc "Vỏ" | Danh sách đối soát vỏ |
| 2 | Kiểm tra: vỏ phát (out) vs vỏ thu (in) | Số liệu hiển thị |
| 3 | Xem chi tiết theo NPP | Breakdown per customer |
| 4 | Kiểm tra tồn vỏ | Balance hiện đúng |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A06: Xử lý sai lệch (Discrepancy Resolution)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Vào Tab "Sai lệch" | Danh sách discrepancies |
| 2 | Nhấn vào 1 sai lệch | Chi tiết: loại, số tiền, NPP |
| 3 | Chọn cách xử lý: "Chấp nhận sai lệch" | Status → resolved |
| 4 | Thử "Yêu cầu tài xế bổ sung" | Tạo ticket cho driver |
| 5 | Kiểm tra lịch sử xử lý | Audit trail hiện đúng |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A07: Chốt ngày (Daily Close)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Vào Tab "Chốt ngày" | Form chốt ngày hiển thị |
| 2 | Chọn ngày: 15/03/2026 | Tổng hợp ngày hiện |
| 3 | Kiểm tra: tổng đơn, tổng tiền, tổng vỏ | Số liệu aggregate |
| 4 | Kiểm tra: số sai lệch chưa xử lý | Warning nếu > 0 |
| 5 | Nhấn "Chốt ngày" | Xác nhận dialog → Closed |
| 6 | Thử chốt ngày đã chốt | Không cho phép chốt lại |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A08: Báo cáo KPI

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Vào "Dashboard" → Widgets KPI | Widgets hiện đúng |
| 2 | Kiểm tra: Tỷ lệ giao thành công (%) | % calculated correctly |
| 3 | Kiểm tra: Doanh thu ngày/tuần | Charts hiển thị |
| 4 | Kiểm tra: Công nợ quá hạn | Highlight warning |
| 5 | Export báo cáo (nếu có) | File download |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A09: Xem lịch sử thanh toán (Payment History)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Xem danh sách thanh toán theo NPP | Filter by customer |
| 2 | Lọc theo phương thức: cash / transfer | Filter hoạt động |
| 3 | Lọc theo trạng thái: collected / confirmed | Filter hoạt động |
| 4 | Xem chi tiết payment: số tiền, tài xế, thời gian | Đầy đủ thông tin |

**Kết quả:** ☐ Pass ☐ Fail

---

### TC-A10: Audit Log (Nhật ký hệ thống)

| Bước | Hành động | Kết quả mong đợi |
|------|-----------|-------------------|
| 1 | Thực hiện duyệt 1 đơn hàng | Đơn approved OK |
| 2 | Kiểm tra audit_logs table (via admin) | Có record: user=accountant01, action=approve |
| 3 | Kiểm tra timestamp, IP, user_agent | Đầy đủ metadata |

**Kết quả:** ☐ Pass ☐ Fail

---

## 📊 Bảng tổng hợp

| Test Case | Mô tả | Kết quả | Tester | Ngày |
|-----------|-------|---------|--------|------|
| TC-A01 | Đăng nhập Dashboard | ☐ | | |
| TC-A02 | Duyệt đơn credit | ☐ | | |
| TC-A03 | Đối soát hàng | ☐ | | |
| TC-A04 | Đối soát tiền | ☐ | | |
| TC-A05 | Đối soát vỏ | ☐ | | |
| TC-A06 | Xử lý sai lệch | ☐ | | |
| TC-A07 | Chốt ngày | ☐ | | |
| TC-A08 | Báo cáo KPI | ☐ | | |
| TC-A09 | Lịch sử thanh toán | ☐ | | |
| TC-A10 | Audit Log | ☐ | | |

**Criteria:** 10/10 Pass = UAT Kế toán OK
