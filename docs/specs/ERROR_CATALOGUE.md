# ERROR CATALOGUE — BHL OMS-TMS-WMS

> **Mục đích:** Danh sách tất cả error codes, HTTP status, user-facing messages.
> AI phải dùng đúng error codes này. KHÔNG tự tạo error code mới.
> Khi cần thêm error mới, thêm vào file này trước, sau đó implement.
>
> **⚠ LƯU Ý:** Code hiện tại dùng `pkg/response/` package.
> File này là reference cho error codes. Áp dụng cho code MỚI.

---

## 1. Standard Error Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_HERE",
    "message": "Thông báo cho user (tiếng Việt)",
    "details": { "field": "value" }
  }
}
```

---

## 2. AUTH ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `AUTH_MISSING_TOKEN` | 401 | Vui lòng đăng nhập để tiếp tục |
| `AUTH_INVALID_TOKEN` | 401 | Phiên đăng nhập không hợp lệ |
| `AUTH_TOKEN_EXPIRED` | 401 | Phiên đăng nhập đã hết hạn |
| `AUTH_REFRESH_EXPIRED` | 401 | Phiên làm việc đã hết hạn, vui lòng đăng nhập lại |
| `AUTH_INVALID_CREDENTIALS` | 401 | Tên đăng nhập hoặc mật khẩu không đúng |
| `AUTH_ACCOUNT_DISABLED` | 403 | Tài khoản đã bị vô hiệu hóa |
| `AUTH_PERMISSION_DENIED` | 403 | Không có quyền thực hiện hành động này |

---

## 3. OMS — ORDER ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `ORDER_NOT_FOUND` | 404 | Không tìm thấy đơn hàng |
| `ORDER_INVALID_STATUS` | 422 | Không thể thực hiện với trạng thái hiện tại |
| `ORDER_INVALID_TRANSITION` | 422 | Không thể chuyển trạng thái đơn hàng |
| `ORDER_ALREADY_CANCELLED` | 422 | Đơn hàng đã bị hủy |
| `ORDER_CANNOT_CANCEL_PLANNED` | 422 | Không thể hủy đơn đã lập kế hoạch |
| `ORDER_DUPLICATE_PRODUCT` | 400 | Đơn hàng chứa sản phẩm trùng lặp |
| `ORDER_EMPTY_ITEMS` | 400 | Đơn hàng phải có ít nhất 1 sản phẩm |
| `ORDER_INVALID_DELIVERY_DATE` | 400 | Ngày giao hàng không hợp lệ |
| `ORDER_CUTOFF_PASSED` | 422 | Đơn sau mốc 16h, giao ngày hôm sau |

---

## 4. ATP ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `ATP_INSUFFICIENT` | 422 | Sản phẩm không đủ tồn kho |
| `ATP_PRODUCT_NOT_IN_WAREHOUSE` | 422 | Sản phẩm không có trong kho |
| `ATP_WAREHOUSE_REQUIRED` | 400 | Vui lòng chọn kho xuất hàng |

---

## 5. CREDIT ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `CREDIT_LIMIT_EXCEEDED` | 201* | NPP vượt hạn mức, chờ kế toán duyệt |
| `CREDIT_CUSTOMER_NOT_FOUND` | 404 | Không tìm thấy thông tin công nợ |
| `CREDIT_ALREADY_APPROVED` | 409 | Đơn đã được duyệt |
| `CREDIT_ALREADY_REJECTED` | 409 | Đơn đã bị từ chối |
| `CREDIT_APPROVE_NOT_PENDING` | 422 | Chỉ duyệt đơn trạng thái "Chờ duyệt" |

> *CREDIT_LIMIT_EXCEEDED trả HTTP 201 — đơn tạo thành công nhưng status = pending_approval

---

## 6. VALIDATION ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `VALIDATION_FAILED` | 400 | Dữ liệu không hợp lệ |
| `VALIDATION_REQUIRED` | 400 | Vui lòng điền đầy đủ thông tin bắt buộc |
| `VALIDATION_INVALID_UUID` | 400 | ID không hợp lệ |
| `VALIDATION_INVALID_DATE` | 400 | Định dạng ngày không hợp lệ |
| `VALIDATION_QUANTITY_NEGATIVE` | 400 | Số lượng phải lớn hơn 0 |
| `VALIDATION_QUANTITY_TOO_LARGE` | 400 | Số lượng không vượt quá 99,999 |

---

## 7. TMS ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `TRIP_NOT_FOUND` | 404 | Không tìm thấy chuyến xe |
| `TRIP_INVALID_STATUS` | 422 | Không thể thực hiện với trạng thái này |
| `TRIP_NO_DRIVER_ASSIGNED` | 422 | Chưa phân công tài xế |
| `TRIP_NO_VEHICLE_ASSIGNED` | 422 | Chưa phân công xe |
| `TRIP_DRIVER_UNAVAILABLE` | 422 | Tài xế đã có chuyến ngày này |
| `TRIP_VEHICLE_UNAVAILABLE` | 422 | Xe đã có lịch ngày này |
| `VRP_NO_SHIPMENTS` | 422 | Không có shipments cần giao |
| `VRP_NO_VEHICLES` | 422 | Không có xe khả dụng |
| `VRP_SOLVER_TIMEOUT` | 422 | Tối ưu tuyến đường mất quá lâu |
| `VRP_SOLVER_ERROR` | 500 | Lỗi hệ thống tối ưu tuyến đường |
| `GATE_CHECK_DISCREPANCY` | 422 | Sai lệch hàng hóa tại cổng |
| `STOP_NOT_FOUND` | 404 | Không tìm thấy điểm giao |
| `STOP_ALREADY_COMPLETED` | 409 | Điểm giao đã hoàn thành |

---

## 8. WMS ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `WAREHOUSE_NOT_FOUND` | 404 | Không tìm thấy kho |
| `STOCK_INSUFFICIENT` | 422 | Tồn kho không đủ |
| `LOT_EXPIRED` | 422 | Lô hàng đã hết hạn sử dụng |
| `LOT_NOT_FOUND` | 404 | Không tìm thấy lô hàng |
| `PICKING_TASK_NOT_FOUND` | 404 | Không tìm thấy lệnh picking |
| `BARCODE_NOT_FOUND` | 404 | Mã vạch không tồn tại |
| `BARCODE_WRONG_PRODUCT` | 422 | Mã vạch thuộc sản phẩm khác |

---

## 9. RECONCILIATION ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `RECONCILIATION_NOT_FOUND` | 404 | Không tìm thấy bản đối soát |
| `DISCREPANCY_NOT_FOUND` | 404 | Không tìm thấy bản ghi sai lệch |
| `DISCREPANCY_ALREADY_CLOSED` | 409 | Sai lệch đã đóng |
| `RECONCILIATION_TRIP_NOT_SETTLED` | 422 | Chuyến xe chưa quyết toán |

---

## 10. INTEGRATION ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `BRAVO_SYNC_FAILED` | 202 | Chưa đồng bộ Bravo, sẽ retry |
| `DMS_SYNC_FAILED` | 202 | Chưa đồng bộ DMS |
| `ZALO_SEND_FAILED` | 202 | Chưa gửi Zalo cho NPP |

---

## 11. SYSTEM ERRORS

| Code | HTTP | Message (VN) |
|------|------|--------------|
| `INTERNAL_ERROR` | 500 | Lỗi hệ thống |
| `RATE_LIMIT_EXCEEDED` | 429 | Quá nhiều yêu cầu |
| `RESOURCE_NOT_FOUND` | 404 | Không tìm thấy dữ liệu |
| `CONFLICT` | 409 | Xung đột dữ liệu |
| `SERVICE_UNAVAILABLE` | 503 | Hệ thống đang bảo trì |

---

*ERROR CATALOGUE v1.0 — 15/03/2026*
