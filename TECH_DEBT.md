# TECH_DEBT — BHL OMS-TMS-WMS

> **Mục đích:** Liệt kê nợ kỹ thuật đã chấp nhận. AI **KHÔNG** được tự ý sửa các mục trong file này trừ khi được yêu cầu rõ ràng.  
> **Khác với KNOWN_ISSUES:** KNOWN_ISSUES = bugs/workarounds cần fix. TECH_DEBT = đang hoạt động nhưng chưa đúng chuẩn, có kế hoạch cải thiện.

---

## Danh sách nợ kỹ thuật

| ID | Mô tả | Đang dùng | Nên dùng (theo spec) | Phase xử lý | Rủi ro nếu đổi ngay |
|----|-------|-----------|---------------------|-------------|---------------------|
| TD-001 | Error handling đơn giản | `pkg/response/` | `pkg/apperror/` + ERROR_CATALOGUE | Phase 3 | Low — chỉ thay đổi handler layer |
| TD-002 | UI framework | Tailwind CSS tự build | Ant Design 5.x (UXUI.md) | Sau go-live | **High** — rebuild toàn bộ UI |
| TD-003 | Trip statuses dùng không hết | Code dùng ~8/13 statuses | 13 statuses (STATE_MACHINES SM-02) | Dần theo feature | Medium — cần test lại flow |
| TD-004 | Logger không structured | `log` stdlib | `zerolog` structured logging | Phase 3 | Low — thay thế đơn giản |
| TD-005 | DB access thủ công | Raw pgx queries | sqlc generated code | Sau go-live | **High** — rewrite toàn bộ repository |
| TD-006 | Driver app là web | Next.js web pages | React Native Expo (BRD) | Sau go-live | **High** — build app mới, khác codebase |
| TD-007 | Integration mock mặc định | `INTEGRATION_MOCK=true` | Real HTTP calls | Khi có sandbox | Low — chỉ đổi config |
| TD-008 | Barcode scan stubbed | Endpoint có, logic placeholder | Full barcode mapping + validation | Phase 3 | Low |
| TD-009 | Expiry alerts stubbed | Endpoint có, query placeholder | Full FEFO threshold calculation | Phase 3 | Low |
| TD-010 | No unit tests | 0 test files | Unit + integration tests (TST.md) | Phase 4 | Medium — cần viết từ đầu |

---

## Quy tắc

1. **Không tự ý refactor** — Nếu AI gặp tech debt khi implement feature mới, hỏi user trước.
2. **Thêm mới vào cuối bảng** — Mỗi debt cần ID duy nhất (TD-NNN).
3. **Khi xử lý xong** → chuyển xuống section "Đã xử lý" bên dưới, ghi ngày.

---

## Đã xử lý

| ID | Mô tả | Ngày xử lý | Ghi chú |
|----|-------|-----------|---------|
| — | — | — | Chưa có mục nào |

---

*Cập nhật: 15/03/2026*
