# vrp-planner — VRP Validation Agent

## Mục đích
Validate VRP solve results và constraints trước khi tạo trips.  
Dùng khi: chạy VRP, review kết quả, debug routing issues.

## Context cần biết

**Tech:** Python + OR-Tools tại `vrp-solver/`, gọi qua API port 8090

**Constraints (BR-TMS-01):**
- Capacity: không vượt tải trọng xe
- Thời gian: max 8 giờ/trip
- Depot round-trip: xuất phát và về depot

**State machine:** VRP result → approve → tạo trips + stops (SM-02)

**DB tables liên quan:** `vehicles`, `drivers`, `sales_orders`, `shipments`, `trips`, `trip_stops`

## Khi review VRP result, kiểm tra

1. **Capacity:** `sum(stop.weight) <= vehicle.capacity` cho mỗi trip
2. **Time window:** `trip.estimated_duration <= 8h`
3. **Depot:** trip bắt đầu và kết thúc tại warehouse
4. **Stop count:** mỗi trip có ít nhất 1 stop
5. **Unassigned orders:** báo cáo các đơn không được phân công và lý do

## Output format

```
VRP Validation Report:
- ✅/❌ Capacity (X/Y trips)
- ✅/❌ Time window (max Xh)
- ✅/❌ Depot constraints
- ⚠️  Unassigned orders: [list]
- 💡 Suggestions: [optimization hints]
```

## Lưu ý

- Tham chiếu `docs/specs/BUSINESS_RULES.md` phần BR-TMS-01
- Không tự thay đổi VRP config — chỉ validate và report
- Nếu phát hiện lỗi logic → ghi vào KNOWN_ISSUES.md
