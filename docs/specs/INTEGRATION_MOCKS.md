# INTEGRATION MOCKS & MOCK DATA — BHL OMS-TMS-WMS

> **Mục đích:** Mock responses cho Bravo/DMS/Zalo + fixture data cho test scenarios.
> AI dùng khi implement integration adapters và test cases.

---

## MOCK-01: Bravo ERP

### POST /api/documents/delivery — Gửi phiếu giao hàng

**Success (200):**
```json
{
    "status": "success",
    "document_id": "PHGIANG-2026-001234",
    "posted_at": "2026-03-16T09:30:00+07:00",
    "voucher_number": "PGH2026031601"
}
```

**Duplicate (409):** `{ "status": "error", "code": "DUPLICATE_DOCUMENT" }`
**Customer not found (422):** `{ "status": "error", "code": "CUSTOMER_NOT_FOUND" }`
**Server error (500):** `{ "status": "error", "code": "INTERNAL_ERROR" }`

---

### GET /api/credit-balance — Đối soát công nợ nightly

**Request:** `GET /api/credit-balance?customer_codes=NPP001,NPP002`

**Response (200):**
```json
{
    "status": "success",
    "data": [
        { "customer_code": "NPP001", "balance": 178750000, "last_payment": "2026-03-15" },
        { "customer_code": "NPP002", "balance": 480000000, "last_payment": "2026-03-10" }
    ]
}
```

---

## MOCK-02: DMS System

### POST /api/orders/sync

**Success (200):**
```json
{ "success": true, "dms_order_id": "DMS-2026-001234", "synced_at": "2026-03-16T08:00:05+07:00" }
```

**Product not found (422):**
```json
{ "success": false, "error_code": "PRODUCT_NOT_FOUND", "unmapped_codes": ["BIA-HN-330L"] }
```

---

## MOCK-03: Zalo OA (ZNS)

### POST /message/template

**Success (200):**
```json
{ "error": 0, "message": "Success", "data": { "msg_id": "zns_msg_abc123" } }
```

**Errors:** `100` = phone not registered, `101` = OA blocked, `200` = template not approved

---

## MOCK-04: OSRM Distance Matrix

### GET /table/v1/driving/{coordinates}

```json
{
    "code": "Ok",
    "durations": [[0, 1200, 1800], [1200, 0, 900], [1800, 900, 0]],
    "distances": [[0, 15000, 22000], [15000, 0, 8500], [22000, 8500, 0]]
}
```

Distances = meters, Durations = seconds.

---

## TEST FIXTURES

### Customers

| Alias | Tên | Credit Limit | Balance | Available | Scenario |
|-------|-----|:------------:|:-------:|:---------:|----------|
| CUST-01 | NPP Bãi Cháy - Anh Tuấn | 500M | 178.75M | ~321M | Happy path |
| CUST-02 | NPP Uông Bí - Hoàng Long | 500M | ~480M | ~20M | Gần vượt hạn |
| CUST-03 | NPP Kiến An - Chị Thảo | 300M | 305M | -5M | Đã vượt |
| CUST-04 | NPP Hạ Long Center | 800M | 50M | 750M | Dư nhiều |
| CUST-05 | NPP Hòn Gai - Anh Thắng | 400M | 0M | 400M | Không nợ |

### Products

| Alias | Tên | Unit | Price | ATP | Scenario |
|-------|-----|------|------:|:---:|----------|
| PROD-01 | Bia HL Lon 330ml (thùng 24) | thùng | 185,000 | 2,000 | ATP dồi dào |
| PROD-02 | Bia HL Gold Lon 330ml | thùng | 225,000 | 1,200 | Bình thường |
| PROD-03 | Bia HL Premium Chai 330ml | chai | 45,000 | 5 | ATP sắp hết |
| PROD-04 | Bia HL Chai 330ml | két | 205,000 | 800 | Bình thường |
| PROD-05 | Bia HL Fresh Lon 330ml | thùng | 125,000 | 0 | ATP = 0 |

---

*INTEGRATION MOCKS v1.0 — 15/03/2026*
