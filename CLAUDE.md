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
| Thêm/sửa AI-native UX, AI toggle, Copilot, Simulation, Privacy Router | AI_NATIVE_BLUEPRINT_v3.md → BACKEND_GUIDE.md/FRONTEND_GUIDE.md → CURRENT_STATE_COMPACT.md |
| Thêm/sửa QA Portal, test data, automation, smoke/evidence | AQF_BHL_SETUP.md → TST_BHL_OMS_TMS_WMS.md → CURRENT_STATE_COMPACT.md |
| Làm feature có ảnh hưởng go-live hoặc dữ liệu thật | AQF_BHL_SETUP.md §3 + §9 → test-after-code.instructions.md |
| Xem tiến độ | TASK_TRACKER.md |
| Hiểu quyết định cũ | DECISIONS.md |
| Tham khảo spec gốc | BRD / SAD / API / DBS / INT / INF / UIX / MIG (Tầng 3) |

**Tầng 3 = file lớn, chỉ đọc khi cần tra cứu chi tiết. KHÔNG load lúc đầu session.**

---

## 8 quy tắc KHÔNG BAO GIỜ vi phạm

1. **Tiền:** `decimal.Decimal` / `NUMERIC(15,2)` — KHÔNG float64
2. **Enum/date pgx:** LUÔN cast `::text` trong SELECT
3. **Integration errors:** trả 202, KHÔNG block nghiệp vụ
4. **KHÔNG refactor code cũ** — chỉ áp dụng rules cho code mới
5. **Verify localhost** SAU MỖI thay đổi — KHÔNG nói "xong" mà chưa test
6. **TEST TỪNG FEATURE NGAY SAU KHI CODE** — viết xong → compile → chạy → gọi API/load page → confirm OK → rồi mới làm tiếp. KHÔNG batch nhiều features rồi test 1 lần. Chi tiết: xem `.github/instructions/test-after-code.instructions.md`
7. **AQF là gate bắt buộc khi vibe code:** mọi code mới phải có kiểm chứng tương ứng (unit/API/page/golden/evidence), không dùng destructive test data, không chạm dữ liệu lịch sử, và phải ghi rõ gate đã pass/skip trong báo cáo cuối.
8. **AI là progressive enhancement:** core workflow phải chạy khi AI flag OFF. Default AI flags = OFF, baseline UX luôn render trước, AI không được block page.

---

## AQF bắt buộc khi vibe code

Trước khi code:
- Nếu task đụng QA Portal, test data, scenario, DB seed, smoke, Playwright, Bruno, Sentry, Clarity, Telegram hoặc go-live readiness → đọc `AQF_BHL_SETUP.md` trước khi sửa.
- Nếu task tạo/sửa dữ liệu demo/test trong DB → bắt buộc dùng ownership model `qa_scenario_runs` + `qa_owned_entities`; cấm `TRUNCATE` và cấm `DELETE` transactional data không có registry filter.
- Nếu task đổi business rule/state/API/page quan trọng → xác định AQF layer cần verify: G0 build, G1 fast tests, G2 golden/domain/API, G3 E2E, G4 production watch.

Sau khi code:
- Test từng feature ngay theo `.github/instructions/test-after-code.instructions.md`.
- Với backend endpoint mới/sửa: compile server + gọi endpoint happy/error case; nếu endpoint thuộc AQF/QA Portal, thêm xác nhận `historical_rows_touched = 0` khi có data mutation.
- Với frontend page mới/sửa: load đúng page, xác nhận auth/role/error/empty state; nếu là QA Portal, xác nhận Data Safety Panel không báo chạm history.
- Với migration/test data: chạy migration/verify schema nếu có DB thay đổi; mọi seed demo phải đăng ký ownership trong transaction.
- Cập nhật docs theo `.github/instructions/doc-update-rules.instructions.md`, đặc biệt `CURRENT_STATE.md`, `TASK_TRACKER.md`, `AQF_BHL_SETUP.md`, `TST_BHL_OMS_TMS_WMS.md` khi AQF thay đổi.

---

## Ngôn ngữ

- **LUÔN suy luận và trình bày bằng tiếng Việt** — mọi phân tích, giải thích, comment cho user đều bằng tiếng Việt.
- Code (biến, hàm, comment trong code) vẫn dùng tiếng Anh.

---

## Bẫy đã biết → xem AI_LESSONS.md (32 bài học)

AI_LESSONS.md LUÔN load cùng file này. Chứa mọi lỗi AI đã mắc:
- 🔴 Crash/Data loss (6): pgx cast, port sai, PowerShell UTF-8, float64 tiền...
- 🟡 Logic/UX (8): verify localhost, API drift, brand≠warning, reject_reason chain...
- 🟢 Scope (4): over-prioritize enterprise features, role mapping spec vs code...

---

## Cuối session — checklist

- [ ] **MỌI feature/endpoint/page đã test riêng lẻ?** (xem `.github/instructions/test-after-code.instructions.md`)
- [ ] AQF gate phù hợp đã chạy hoặc nêu rõ lý do skip? (G0/G1/G2/G3/G4 tùy phạm vi)
- [ ] Nếu có test/demo data: `historical_rows_touched = 0`, không `TRUNCATE`, không unscoped `DELETE`?
- [ ] Localhost OK? (backend health + frontend load)
- [ ] CURRENT_STATE_COMPACT.md đã cập nhật?
- [ ] AQF_BHL_SETUP.md / TST_BHL_OMS_TMS_WMS.md đã cập nhật nếu đổi QA/test/evidence?
- [ ] CHANGELOG.md đã ghi?
- [ ] TASK_TRACKER.md đã đánh dấu task xong?
- [ ] Lỗi mới → AI_LESSONS.md? KNOWN_ISSUES.md? Nợ kỹ thuật mới → TECH_DEBT.md?
- [ ] Quyết định mới → DECISIONS.md?
