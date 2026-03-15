---
description: "Apply business rules from spec when implementing business logic, validation, or calculation. Must read BUSINESS_RULES.md before implementing service methods."
applyTo: ["**/service.go", "**/repository.go"]
---

# Business Rules

## Bắt buộc

Trước khi implement validation, calculation, hoặc business condition, ĐỌC file `docs/specs/BUSINESS_RULES.md`.

## Quy tắc

1. **Đây là source of truth cho nghiệp vụ** — không đoán, không suy luận.
2. **Code hiện tại là source of truth cho implementation** — KHÔNG refactor code cũ.
3. Chỉ áp dụng business rules cho **code mới**.
4. Khi business rule conflict với code hiện tại → giữ code hiện tại, note lại.

## Business Rules chính

- **BR-OMS-01:** ATP formula — per (product_id, warehouse_id), draft không trừ
- **BR-OMS-02:** Credit limit check — per customer, vượt → pending_approval (không block)
- **BR-OMS-03:** Order number — SO-{YYYYMMDD}-{NNNN}, Asia/Ho_Chi_Minh
- **BR-OMS-04:** Cutoff 16h — trước = giao trong ngày, sau = T+1
- **BR-OMS-05:** Vỏ cược tự động khi có bia chai/két/keg
- **BR-TMS-01:** VRP constraints — capacity, 8h, depot round-trip
- **BR-TMS-04:** Gate check R01 — qty_loaded = qty_ordered (100%)
- **BR-TMS-05:** Failed delivery R05 — giao lại KHÔNG GIỚI HẠN
- **BR-WMS-01:** FEFO picking — expiry_date ASC, lot_number ASC
- **BR-REC-01:** Đối soát 3 loại: hàng, tiền, vỏ
- **BR-REC-02:** Zalo auto-confirm 24h (R13)

## Quan trọng

- Tiền: dùng `decimal.Decimal` hoặc `NUMERIC(15,2)`, KHÔNG float64
- Timezone: UTC trong DB, convert `Asia/Ho_Chi_Minh` ở app
- ATP: không cache quá 30 giây
