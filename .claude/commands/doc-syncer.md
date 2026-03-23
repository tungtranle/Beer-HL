# doc-syncer — Documentation Sync Agent

## Mục đích
Chạy tự động cuối mỗi task để đồng bộ docs với code.  
*"Docs và code phải đồng bộ — AI session tiếp theo sẽ sinh code sai nếu docs lỗi thời."*

## Trigger
Tự động chạy sau mỗi thay đổi code, hoặc gọi thủ công với `/sync-docs`

## Bảng mapping thay đổi → docs cần cập nhật

| Thay đổi | Files bắt buộc |
|---------|---------------|
| Thêm API endpoint | CURRENT_STATE.md + API_BHL_OMS_TMS_WMS.md + CHANGELOG.md |
| Thêm/sửa DB table | DBS_BHL_OMS_TMS_WMS.md + CURRENT_STATE.md + CHANGELOG.md |
| Thêm migration SQL | CURRENT_STATE.md (số migration + mô tả) + CHANGELOG.md |
| Thêm tính năng | CURRENT_STATE.md + CHANGELOG.md + TASK_TRACKER.md |
| Quyết định kỹ thuật | DECISIONS.md + CURRENT_STATE.md |
| Phát hiện bug | KNOWN_ISSUES.md |
| Tech debt mới | TECH_DEBT.md |
| Thêm frontend page | CURRENT_STATE.md (danh sách pages) + CHANGELOG.md |
| Khác với BRD gốc | BRD_BHL_OMS_TMS_WMS.md (+ version bump) |

## Checklist đồng bộ

1. `CURRENT_STATE.md` — cập nhật endpoint count, migration số, page list
2. `CHANGELOG.md` — ghi session hiện tại
3. `TASK_TRACKER.md` — đánh ☑ task hoàn thành, cập nhật counter và %
4. `DECISIONS.md` — nếu có quyết định kỹ thuật mới
5. `TECH_DEBT.md` — nếu accept nợ kỹ thuật mới
6. `KNOWN_ISSUES.md` — nếu phát hiện bug/workaround mới
7. `CLAUDE.md` — nếu AI học được điều gì cần nhớ cho lần sau

## KHÔNG cần cập nhật khi
- Chỉ refactor (không đổi behavior)
- Fix typo / format
- Thay đổi chỉ trong test files

## Output format

```
Doc Sync Report:
✅ CURRENT_STATE.md — [mô tả thay đổi]
✅ CHANGELOG.md — [session entry added]
✅ TASK_TRACKER.md — [tasks marked: X.X, X.X]
⏭️  DECISIONS.md — [không có quyết định mới]
⏭️  TECH_DEBT.md — [không có nợ mới]
```
