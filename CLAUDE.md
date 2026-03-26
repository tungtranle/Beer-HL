# CLAUDE.md — BHL OMS-TMS-WMS

> File này AI đọc ĐẦU TIÊN mỗi session. Chỉ làm router.
> Luôn đọc kèm **AI_LESSONS.md** — bài học AI đã mắc, KHÔNG được lặp lại.

---

## Tech Stack

| Layer | Tech | Port |
|-------|------|------|
| Backend | Go + Gin | :8080 |
| Frontend | Next.js 14 + Tailwind | :3000 |
| DB | PostgreSQL 16 | :5434 (không phải 5432) |
| Cache | Redis (local Windows) | :6379 |
| VRP | Python + OR-Tools | :8090 |

Pattern: `Handler → Service → Repository` (luôn 3 tầng, không bỏ, không ngược)
9 roles: admin, dispatcher, driver, warehouse_handler, accountant, management, dvkh, security, workshop

---

## File nào cho task nào

| Bạn muốn... | AI đọc... |
|-------------|-----------|
| Thêm/sửa backend logic | BACKEND_GUIDE.md → RULES.md → CURRENT_STATE_COMPACT.md |
| Thêm/sửa frontend page | FRONTEND_GUIDE.md → CURRENT_STATE_COMPACT.md |
| Sửa bug | KNOWN_ISSUES.md → CURRENT_STATE_COMPACT.md |
| Code status transition | RULES.md §2 (State Machines) |
| Code ATP/credit/cutoff | RULES.md §1 (Business Rules) |
| Thêm API endpoint | BACKEND_GUIDE.md → API spec (Tầng 3) |
| Thêm DB migration | DBS spec (Tầng 3) → CURRENT_STATE_COMPACT.md |
| Xem tiến độ | TASK_TRACKER.md |
| Hiểu quyết định cũ | DECISIONS.md |
| Tham khảo spec gốc | BRD / SAD / API / DBS / INT / INF / UIX / MIG (Tầng 3) |

**Tầng 3 = file lớn, chỉ đọc khi cần tra cứu chi tiết. KHÔNG load lúc đầu session.**

---

## 5 quy tắc KHÔNG BAO GIỜ vi phạm

1. **Tiền:** `decimal.Decimal` / `NUMERIC(15,2)` — KHÔNG float64
2. **Enum/date pgx:** LUÔN cast `::text` trong SELECT
3. **Integration errors:** trả 202, KHÔNG block nghiệp vụ
4. **KHÔNG refactor code cũ** — chỉ áp dụng rules cho code mới
5. **Verify localhost** SAU MỖI thay đổi — KHÔNG nói "xong" mà chưa test

---

## Bẫy đã biết → xem AI_LESSONS.md (18 bài học)

AI_LESSONS.md LUÔN load cùng file này. Chứa mọi lỗi AI đã mắc:
- 🔴 Crash/Data loss (6): pgx cast, port sai, PowerShell UTF-8, float64 tiền...
- 🟡 Logic/UX (8): verify localhost, API drift, brand≠warning, reject_reason chain...
- 🟢 Scope (4): over-prioritize enterprise features, role mapping spec vs code...

---

## Cuối session — checklist

- [ ] Localhost OK? (backend health + frontend load)
- [ ] CURRENT_STATE_COMPACT.md đã cập nhật?
- [ ] CHANGELOG.md đã ghi?
- [ ] TASK_TRACKER.md đã đánh dấu task xong?
- [ ] Lỗi mới → AI_LESSONS.md? KNOWN_ISSUES.md? Nợ kỹ thuật mới → TECH_DEBT.md?
- [ ] Quyết định mới → DECISIONS.md?
