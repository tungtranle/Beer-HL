---
description: "MUST run at end of every task/session. After making code changes, update all related documentation files to keep docs in sync with code. Prevents documentation drift."
applyTo: "**/*.{go,ts,tsx,sql}"
---

# Quy tắc đồng bộ tài liệu sau mỗi thay đổi

## Nguyên tắc cốt lõi

**Docs và code phải đồng bộ.** Nếu thay đổi code mà không cập nhật docs → docs là rác, AI session tiếp theo sẽ sinh code sai.

## Bảng: Thay đổi nào → Cập nhật docs nào

| Loại thay đổi | Files BẮT BUỘC cập nhật |
|---------------|------------------------|
| Thêm tính năng mới | CURRENT_STATE.md + CHANGELOG.md + TASK_TRACKER.md |
| Sửa tính năng cũ | CURRENT_STATE.md + CHANGELOG.md |
| Thêm API endpoint | CURRENT_STATE.md + API_BHL_OMS_TMS_WMS.md + CHANGELOG.md |
| Thêm/sửa DB table/column | DBS_BHL_OMS_TMS_WMS.md + CURRENT_STATE.md + CHANGELOG.md |
| Thêm migration SQL | CURRENT_STATE.md (số migration + mô tả) + CHANGELOG.md |
| Quyết định kỹ thuật mới | DECISIONS.md + CURRENT_STATE.md |
| Phát hiện bug/workaround | KNOWN_ISSUES.md |
| Chấp nhận nợ kỹ thuật | TECH_DEBT.md |
| Thay đổi cấu trúc thư mục | CURRENT_STATE.md + CHANGELOG.md |
| Thêm/sửa biến môi trường | CURRENT_STATE.md + CHANGELOG.md |
| Thêm frontend page mới | CURRENT_STATE.md (danh sách pages) + CHANGELOG.md |
| Xong task trong TASK_TRACKER | TASK_TRACKER.md (đánh ☑, cập nhật counter) |

## Thứ tự ưu tiên cập nhật

1. **CURRENT_STATE.md** — Luôn cập nhật đầu tiên (source of truth cho trạng thái thực tế)
2. **CHANGELOG.md** — Ghi lại thay đổi cụ thể
3. **TASK_TRACKER.md** — Nếu liên quan đến task
4. **Spec files** (API, DBS, BRD...) — Nếu spec cần cập nhật theo

## KHÔNG cần cập nhật khi

- Chỉ refactor code mà không thay đổi behavior
- Fix typo / format code
- Thay đổi chỉ trong test files
- Thay đổi docs (cập nhật docs không cần ghi vào CHANGELOG)

## Quy trình cuối session

Trước khi kết thúc, AI phải tự kiểm tra:
0. **[BẮT BUỘC] Code đã test chưa?** Mỗi feature/endpoint/page đã viết PHẢI được test riêng lẻ. Xem `test-after-code.instructions.md`.
1. **[BẮT BUỘC] Localhost hoạt động?** Fetch backend health check + frontend login page. Nếu fail → fix trước khi báo "đã xong". Nếu port bị chiếm → dùng port khác + cập nhật proxy.
2. Đã cập nhật CURRENT_STATE.md cho mọi thay đổi chưa?
3. Đã ghi CHANGELOG.md chưa?
4. TASK_TRACKER.md đã đánh dấu các task hoàn thành chưa?
5. Có quyết định kỹ thuật mới cần ghi vào DECISIONS.md không?
6. Có nợ kỹ thuật mới cần ghi vào TECH_DEBT.md không?
