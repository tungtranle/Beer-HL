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
| TD-020-followup | 17 background `.catch(console.error)` chưa chuyển sang `handleError()` | console.error im lặng | `handleError(err, {silent:true})` hoặc userMessage | Sprint 2 | Low — đều là secondary fetches (timeline, attempts, notes); user không thấy lỗi nhưng vẫn log console |
| TD-H4-geocode | 44 toll stations mới (mig 039) có lat/lng=0/0 | `is_active=FALSE` — không tham gia VRP cost matching | Ops geocode thủ công + ENABLE | Sprint 2 | Medium — VRP cost chưa tính được 44 trạm này → underestimate ~30% chi phí BOT cho miền Bắc |
| TD-F7-state-redis | GPS anomaly stationary state in-memory `map[uuid.UUID]` | Mất khi restart → stop-overdue trễ tối đa 10min | Migrate sang Redis khi scale > 1 instance | Sprint 3+ | Low — hiện tại single-instance |
| TD-F7-zalo-stub | `notify()` chỉ log `anomaly_detected_zalo_pending` | Không gửi Zalo thực | Integrate `internal/integration/zalo` với template P0/P1 | Sprint 2 | Medium — dispatcher phải vào `/dashboard/anomalies` xem thay vì nhận push |
| TD-005 | DB access thủ công | Raw pgx queries | sqlc generated code | Sau go-live | **High** — rewrite toàn bộ repository |
| TD-006 | Driver app là web | Next.js web pages | React Native Expo (BRD) | Sau go-live | **High** — build app mới, khác codebase |
| TD-007 | Integration mock mặc định | `INTEGRATION_MOCK=true`, standalone mock server sẵn sàng (cmd/mock_server) | Real HTTP calls | Khi có sandbox | Low — mock server đã test HTTP path |
| TD-008 | Barcode scan stubbed | Endpoint có, logic placeholder | Full barcode mapping + validation | Phase 3 | Low |
| TD-009 | Expiry alerts stubbed | Endpoint có, query placeholder | Full FEFO threshold calculation | Phase 3 | Low |
| TD-010 | No unit tests | 0 test files | Unit + integration tests (TST.md) | ~~Phase 4~~ In Progress | Medium — cần viết từ đầu |
| TD-011 | FCM push notification chưa implement | Chỉ có WebSocket push | WebSocket + FCM (BRD) | Sau go-live | Low — WS đủ cho web, FCM cần cho native app |
| TD-012 | API spec drift lớn | Nhiều endpoint chưa document, path khác spec gốc | API doc sync 100% với code | Liên tục | Medium — AI session tiếp theo có thể implement sai path |
| TD-013 | Migration file numbering | Hai file `009_*.up.sql` (driver_checkin + urgent_priority) | Mỗi migration number duy nhất | Không fix | Low — đã apply, không gây lỗi |
| TD-014 | Action-level RBAC chưa có | Mọi user cùng role có cùng quyền | KT Trưởng resolve, KT thường chỉ xem (BRD §9.2 Layer 2) | Phase 6 (P2) | Low — 1 KT Trưởng, manual process OK |
| TD-015 | Data-scoping RBAC chưa enforce | warehouse_ids trong JWT nhưng không filter | Query filter theo warehouse_ids (BRD §9.2 Layer 3) | Post go-live | Medium — multi-warehouse sẽ cần |
| TD-016 | Phân xưởng gộp vào warehouse_handler | Không có role/page riêng | Role `workshop` + classification page (BRD §9.1) | Phase 6 (P0) | High — business process gap |
| TD-017 | Đội trưởng xe gộp vào dispatcher | Không có fleet view riêng | Fleet tab: xe, giấy tờ, checklist, bảo trì | Phase 6 (P2) | Low — dispatcher đủ cho ~70 xe |
| TD-018 | float64 cho tiền/giá | 30+ fields dùng float64 (Price, Amount, TotalAmount, DepositPrice...) | `decimal.Decimal` + `NUMERIC(15,2)` | Post go-live | **High** — ảnh hưởng models.go + 5 service files, cần migration |
| TD-019 | TestPortal bypass 3-layer | handler.go inject `pgxpool.Pool` trực tiếp, 21+ SQL queries trong handler | Handler → Service → Repository | Post go-live | Low — module test-only, không ảnh hưởng production |
| TD-020 | console.error không feedback UI | 26 chỗ `catch(err) { console.error(err) }` — user không thấy lỗi | Toast/alert cho mọi error catch | Liên tục | Medium — UX kém, user không biết thao tác thất bại |
| TD-021 | Direct fetch() thay vì apiFetch | 10 chỗ dùng `fetch()` trực tiếp (planning, test-portal, confirm, map) | `apiFetch()` wrapper cho auto token refresh | Liên tục | Medium — token hết hạn sẽ không auto-refresh |
| TD-022 | time.Now() không timezone | 20+ chỗ dùng `time.Now()` mà không convert `Asia/Ho_Chi_Minh` (tms/service, kpi/handler, auth) | `time.Now().In(loc)` với `loc, _ = time.LoadLocation("Asia/Ho_Chi_Minh")` | Liên tục | Medium — sai ngày cutoff, KPI snapshot nếu server UTC |
| TD-023 | Thiếu ::text cast enum/date pgx | ~50 SELECT queries không cast `::text` cho enum/date columns | LUÔN cast `status::text, delivery_date::text` | Liên tục | **High** — runtime scan errors nếu pgx v5 strict mode |
| TD-024 | Global logging (cmd utilities) | 40+ chỗ `log.Printf`, `fmt.Println` trong cmd/ và tests/ | `logger.Logger` interface qua constructor DI | Post go-live | Low — chỉ trong CLI tools, không ảnh hưởng API |
| TD-025 | Thiếu Repository layer (3 modules) | auth, admin, kpi: service query DB trực tiếp, không có repository.go | Tách repository.go riêng cho mỗi module | Post go-live | Medium — khó mock test, khó thay đổi DB layer |
| TD-026 | Token endpoint defer (NPP confirm/reject) | Endpoints `confirm_order`, `reject_order` token-based chưa build — Phase 2 cần NPP App | Build khi triển khai NPP App (DEC-012) | Phase 2 (3-6 tháng) | Low — Zalo OA + DVKH ghi thay đủ cho Phase 1 |
| TD-027 | Note visibility locked (internal only) | `order_notes.visibility` chỉ hỗ trợ `internal`, chưa unlock `shared` cho NPP đọc | Unlock khi NPP App Phase 2, thêm filter visibility trong query | Phase 2 (3-6 tháng) | Low — NPP chưa có app nên không cần shared |

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

*Cập nhật: 22/03/2026 — Session audit: TD-018~TD-025 (code compliance audit), TD-026~TD-027 (v4 spec defer)*
