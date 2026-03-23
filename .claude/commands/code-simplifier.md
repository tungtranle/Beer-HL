# code-simplifier — Code Quality Agent

## Mục đích
Chạy sau khi hoàn thành task để tìm code trùng lặp, cải thiện chất lượng.  
Dùng daily: *"Make this change then run /simplify"*

## Khi nào dùng
- Sau khi thêm tính năng mới vào handler/service/repository
- Trước khi tạo PR
- Khi suspect có code trùng lặp giữa modules

## Checklist review (chạy song song 3 concerns)

### Agent 1 — Duplication Check
Tìm code trùng lặp trong các modules:
- Có query SQL giống nhau ở nhiều repository không?
- Có validation logic lặp lại giữa handlers không?
- Có helper function nên extract ra `pkg/` không?

### Agent 2 — Quality Check
- Error handling có đúng pattern không? (`fmt.Errorf("context: %w", err)`)
- Transaction có `defer tx.Rollback(ctx)` không?
- Enum/date columns có `::text` cast không?
- Loading state có `setLoading(false)` trong `finally` không?

### Agent 3 — Efficiency Check
- Query có `SELECT *` không? (phải liệt kê columns)
- Có N+1 query không?
- Có thể dùng batch query thay vì loop queries không?

## Rules

1. **KHÔNG refactor code không liên quan** đến task vừa làm
2. **KHÔNG thay đổi tech debt items** (xem TECH_DEBT.md)
3. Chỉ report — không tự sửa nếu ngoài scope task
4. Nếu tìm thấy tech debt mới → ghi vào TECH_DEBT.md

## Output format

```
Code Simplifier Report:
📋 Task vừa làm: [tên task]
🔁 Duplication found: [list hoặc "Không có"]
⚠️  Quality issues: [list hoặc "Không có"]
🚀 Efficiency issues: [list hoặc "Không có"]
✅ Actions taken: [những gì đã sửa trong scope task]
📝 Deferred: [ghi vào TECH_DEBT.md nếu có]
```
