# BUSINESS RULES — BHL OMS-TMS-WMS

> **Mục đích:** Định nghĩa chính xác tất cả công thức, điều kiện và logic nghiệp vụ.
> AI phải đọc file này khi implement bất kỳ service hoặc validation nào.
> Đây là **source of truth** cho nghiệp vụ — không được đoán hay suy luận.
>
> **⚠ LƯU Ý QUAN TRỌNG:** Code hiện tại (đã implement) là SOURCE OF TRUTH.
> File này là TARGET cho code MỚI. KHÔNG refactor code cũ cho khớp spec trừ khi được yêu cầu rõ ràng.

---

## MODULE 1: OMS — QUẢN LÝ ĐƠN HÀNG

### BR-OMS-01: Công thức tính ATP (Available-To-Promise)

```sql
SELECT
    sq.qty_on_hand
    - COALESCE(
        SUM(oi.quantity) FILTER (
            WHERE so.warehouse_id = $warehouse_id
              AND so.status IN ('confirmed', 'pending_approval', 'planned', 'picking', 'loaded')
              AND oi.product_id = $product_id
        ), 0
    )
    - COALESCE(
        SUM(sh.quantity) FILTER (
            WHERE sh.warehouse_id = $warehouse_id
              AND sh.status IN ('pending', 'assigned', 'in_transit')
              AND sh.product_id = $product_id
        ), 0
    ) AS atp
FROM stock_quants sq
LEFT JOIN order_items oi ON oi.product_id = sq.product_id
LEFT JOIN sales_orders so ON so.id = oi.order_id
LEFT JOIN shipments sh ON sh.warehouse_id = $warehouse_id
WHERE sq.product_id = $product_id
  AND sq.warehouse_id = $warehouse_id
  AND sq.location_type = 'available'
GROUP BY sq.qty_on_hand;
```

**Quy tắc:**
- ATP tính **theo thời điểm thực tế** (không cache quá 30 giây)
- Đơn `draft` **KHÔNG** trừ ATP
- Đơn `cancelled` / `rejected` **đã restore** ATP
- ATP < 0 → lỗi dữ liệu, alert kế toán
- ATP < 10% tồn kho → cảnh báo cam 🟠
- ATP = 0 → block nhập số lượng → đỏ 🔴
- KHÔNG áp dụng backorder (BHL không dùng)

---

### BR-OMS-02: Credit Limit Check

```
current_balance = SUM(receivable_ledger debit) - SUM(credit) per customer
available_credit = credit_limits.limit_amount - current_balance

IF (current_balance + new_order_amount) > credit_limits.limit_amount:
    → status = 'pending_approval', notify accountant
ELSE:
    → status = 'confirmed'
```

**Quy tắc:**
- Per customer, lưu trong `credit_limits`
- Snapshot tại thời điểm tạo đơn
- `pending_approval` = đã trừ available_credit (reserved)
- `cancelled` → restore credit ngay (transaction)
- Credit limit có thể **âm** nếu kế toán vẫn duyệt

---

### BR-OMS-03: Order Number Generation

```
Format: SO-{YYYYMMDD}-{NNNN}
Timezone: Asia/Ho_Chi_Minh
Sequence: reset mỗi ngày, dùng FOR UPDATE lock
```

---

### BR-OMS-04: Cutoff Time — Mốc chốt đơn

```
Cutoff = 16:00:00 Asia/Ho_Chi_Minh

Trước 16h → giao trong ngày, deadline_for_planning = 16:20
Sau 16h → giao T+1, deadline_for_planning = 17:30
```

---

### BR-OMS-05: Vỏ cược (Returnable Assets)

```
Bia chai/két/keg → tự động tính vỏ cược
Vỏ xuất: asset_ledger (out)
Vỏ thu: asset_ledger (in)
Đơn giá: system_configs key='asset_price_{asset_type}'
```

---

## MODULE 2: TMS — QUẢN LÝ VẬN TẢI

### BR-TMS-01: VRP Constraints

- capacity_kg không vượt
- Route ≤ 480 phút (8h)
- Bắt đầu + kết thúc tại depot
- Time window = soft constraint (penalty)
- Ưu tiên xe nhỏ
- Fallback: partial results + hiện unassigned

### BR-TMS-02: Trip Number

```
Format: TR-{YYYYMMDD}-{NNN}
YYYYMMDD = planned_date
```

### BR-TMS-03: Xe ưu tiên

```
1. Xe nội bộ nhỏ → 2. Xe nội bộ lớn → 3. Xe thuê ngoài
Cấu hình: system_configs key='vehicle_priority_order'
```

### BR-TMS-04: Gate Check (R01)

```
shipment.qty_loaded = shipment.qty_ordered → PASS
Sai lệch > 0 → FAIL, alert dispatcher + team_leader
```

### BR-TMS-05: Failed Delivery (R05)

```
Giao lại KHÔNG GIỚI HẠN số lần
Bắt buộc: lý do từ preset list
Lý do: Không người nhận, NPP hoãn, địa chỉ sai, tranh chấp công nợ, sự cố xe, khác
```

### BR-TMS-06: Tính giờ giao chuẩn

```
delivery_time_window_minutes = 60 (cấu hình system_configs)
Vượt → ghi nhận GIAO TRỄ → tính KPI
```

---

## MODULE 3: WMS — QUẢN LÝ KHO

### BR-WMS-01: FEFO Picking

```sql
SELECT lot_id, qty_available
FROM lots l JOIN stock_quants sq ON sq.lot_id = l.id
WHERE sq.product_id = $1 AND sq.warehouse_id = $2
  AND sq.qty_available > 0 AND l.expiry_date > CURRENT_DATE
ORDER BY l.expiry_date ASC, l.lot_number ASC;
```

### BR-WMS-02: Cảnh báo hàng gần hết hạn

```
Cron: 06:00 Asia/HCM hàng ngày
≤ 7 ngày → Critical 🔴
≤ 30 ngày → Warning 🟠
```

### BR-WMS-03: Nhập vỏ — Phân loại

```
good → tái sử dụng
damaged → ghi nhận, tùy mức độ
lost → bồi hoàn = qty_lost * asset_price
```

---

## MODULE 4: RECONCILIATION

### BR-REC-01: Đối soát cuối chuyến

```
Trigger: trip.status → 'settling'
3 loại: HÀNG, TIỀN, VỎ
ALL sai_lech = 0 → reconciled → completed
ANY sai_lech > 0 → discrepancy_record, deadline T+1
```

### BR-REC-02: Xác nhận Zalo NPP (R13)

```
Giao OK → Zalo ZNS → NPP xác nhận/báo sai
Không phản hồi 24h → auto_confirmed
Cron: mỗi 1 giờ check auto-confirm
```

---

## MODULE 5: NOTIFICATION RULES

| Event | Channels | Recipients |
|-------|----------|------------|
| Đơn mới | Web | dvkh |
| Vượt hạn mức | Web + FCM | accountant |
| Duyệt/từ chối | Web | dvkh |
| VRP ready | Web | dispatcher |
| Trip tạo | Web + FCM | driver |
| Xuất cổng | Web | dispatcher |
| Giao OK | Zalo | NPP |
| Giao thất bại | Web + FCM | dispatcher |
| Hàng hết hạn | Web | warehouse + admin |
| Sai lệch | Web + FCM | accountant + dispatcher |
| Quá hạn T+1 | Web + FCM | manager |

---

## MODULE 6: KPI

```
1. OTD Rate = delivered_on_time / total * 100
2. Delivery Success Rate = delivered / (delivered + rejected) * 100
3. Vehicle Utilization = actual_kg / capacity_kg * 100
4. Recon Match Rate = zero_discrepancy / total_completed * 100
5. Outstanding Receivable = SUM(debit) - SUM(credit) per customer
Snapshot: Cron 23:50 daily → daily_kpi_snapshots
```

---

*BUSINESS RULES v1.0 — 15/03/2026*
