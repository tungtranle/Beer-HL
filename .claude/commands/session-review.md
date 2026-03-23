# /session-review — Tổng kết cuối session

Chạy full review trước khi kết thúc session: sync docs + tech debt + lesson learned.

## Chạy theo thứ tự

### Bước 1 — Summary

Liệt kê ngắn gọn:
- Đã làm gì trong session này?
- Task nào hoàn thành? Task nào còn dang dở?
- Có issue nào phát sinh không?

### Bước 2 — Code Quality (dùng code-simplifier agent)

```
use subagents: chạy code-simplifier cho code vừa thay đổi
```

### Bước 3 — Sync Docs (dùng /sync-docs)

Cập nhật tất cả docs liên quan.

### Bước 4 — Tech Debt (dùng /techdebt)

Ghi nhận tech debt mới nếu có.

### Bước 5 — Lessons Learned

Có điều gì AI làm sai hoặc cần nhớ cho lần sau không?  
→ Cập nhật `CLAUDE.md` ngay.

### Bước 6 — Next Session Setup

Ghi rõ vào TASK_TRACKER.md:
- Task tiếp theo là gì?
- Context nào cần đọc trước?
- Có blocker nào cần xử lý trước không?

## Output format

```
=== Session Review ===
📌 Đã làm: [list]
✅ Tasks done: [X.X, X.X]
🔄 Tasks dang dở: [X.X - trạng thái]
⚠️  Issues mới: [list hoặc "Không có"]
🧹 Tech debt ghi nhận: [TD-NNN hoặc "Không có"]
📚 Docs đã sync: [list files]
💡 Lessons learned → CLAUDE.md: [list hoặc "Không có"]
➡️  Session tiếp theo: [task X.X - context cần đọc]
```
