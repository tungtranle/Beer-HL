# /sync-docs — Đồng bộ tài liệu cuối session

Chạy doc-syncer agent để đồng bộ tất cả docs với code vừa thay đổi.

## Hướng dẫn

Liệt kê tất cả thay đổi đã làm trong session này, sau đó cập nhật theo thứ tự:

1. **CURRENT_STATE.md** — Cập nhật endpoint count, migration, pages
2. **CHANGELOG.md** — Ghi entry cho session hiện tại (format: `## Session N — DD/MM/YYYY`)
3. **TASK_TRACKER.md** — Đánh ☑ các tasks hoàn thành + cập nhật counter/progress bar
4. **DECISIONS.md** — Nếu có quyết định kỹ thuật mới
5. **TECH_DEBT.md** — Nếu có nợ kỹ thuật mới accepted
6. **KNOWN_ISSUES.md** — Nếu phát hiện bug/workaround mới
7. **CLAUDE.md** — Nếu học được lesson mới cần ghi nhớ

## Context tự động inject

```bash
# Git status để biết files đã thay đổi
git diff --name-only HEAD
git status --short
```

Dùng output trên để xác định chính xác những gì đã thay đổi và cần sync docs nào.
