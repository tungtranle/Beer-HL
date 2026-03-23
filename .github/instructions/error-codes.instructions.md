---
description: "Use standardized error codes when handling errors in handlers and services. Must reference ERROR_CATALOGUE.md for correct error codes."
applyTo: "**/{handler,service}.go"
---

# Error Codes

## Bắt buộc

Khi trả error response, PHẢI dùng error code từ `docs/specs/ERROR_CATALOGUE.md`.
**KHÔNG tự tạo error code mới.** Nếu cần code mới → thêm vào ERROR_CATALOGUE.md trước.

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE_HERE",
    "message": "Thông báo tiếng Việt",
    "details": {}
  }
}
```

## Quy tắc

1. HTTP status phải khớp với bảng trong ERROR_CATALOGUE
2. Message phải tiếng Việt, user-friendly
3. Details cung cấp thông tin để FE xử lý cụ thể
4. Code hiện tại dùng `pkg/response/` package — giữ nguyên pattern đó
5. Integration errors (Bravo/DMS/Zalo) trả 202 — KHÔNG block user

## Error Code PHẢI xuất hiện trong Log

Error code không chỉ trả về cho client — **bắt buộc phải có trong log** để filter và alert.

```go
// ✅ Khi trả error response, log cùng lúc với error_code
s.log.Warn(ctx, "business_error",
    logger.F("error_code", "ATP_INSUFFICIENT"),
    logger.F("product_id", productID),
    logger.F("requested",  qty),
    logger.F("available",  atp),
)
return response.Error(c, http.StatusUnprocessableEntity, "ATP_INSUFFICIENT", "Không đủ hàng tồn kho", nil)

// ✅ Với lỗi hệ thống
s.log.Error(ctx, "system_error", err,
    logger.F("error_code", "INTERNAL_DB_ERROR"),
    logger.F("op",         "CreateOrder"),
)
return response.Error(c, http.StatusInternalServerError, "INTERNAL_DB_ERROR", "Lỗi hệ thống", nil)
```

## Log Level theo Error Code Prefix

| Prefix | Log Level | Lý do |
|--------|-----------|-------|
| `AUTH_` | WARN | Security event cần monitor |
| `ORDER_`, `ATP_`, `CREDIT_` | WARN | Business violation |
| `VALIDATION_` | INFO | User input error, bình thường (WARN nếu payload nghi ngờ tấn công) |
| `INTERNAL_` | ERROR | Cần investigate ngay |
| `BRAVO_`, `DMS_`, `ZALO_` | WARN | Integration degraded, không block |
| `GATE_`, `VRP_` | ERROR | Ảnh hưởng vận hành trực tiếp |
| `GPS_`, `KPI_`, `NOTIFICATION_` | WARN | Supporting modules |

## Error Code Prefixes

| Prefix | Module |
|--------|--------|
| `AUTH_` | Authentication/Authorization |
| `ORDER_` | OMS Orders |
| `ATP_` | Available-To-Promise |
| `CREDIT_` | Credit Limit |
| `TRIP_` | TMS Trips |
| `VRP_` | VRP Solver |
| `GATE_` | Gate Check |
| `STOP_` | Trip Stops |
| `STOCK_` / `LOT_` / `PICKING_` / `BARCODE_` | WMS |
| `RECONCILIATION_` / `DISCREPANCY_` | Reconciliation |
| `BRAVO_` / `DMS_` / `ZALO_` | Integrations |
| `GPS_` | GPS Tracking |
| `KPI_` | KPI Dashboard |
| `NOTIFICATION_` | Notifications |
| `VALIDATION_` | General validation |
| `INTERNAL_` | System |
