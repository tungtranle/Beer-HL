---
description: "Use standardized error codes when handling errors in handlers and services. Must reference ERROR_CATALOGUE.md for correct error codes."
applyTo: ["**/handler.go", "**/service.go"]
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
| `VALIDATION_` | General validation |
| `INTERNAL_` | System |
