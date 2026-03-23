# DECISIONS — BHL OMS-TMS-WMS

> Record architectural and implementation decisions with rationale.  
> AI reads this to understand WHY code is written a certain way.  
> **Quy tắc:** Mỗi decision ghi rõ "Docs Impact" — file docs nào cần cập nhật khi đọc decision này.

---

## DEC-001: Bổ sung Web Driver UI cho bản demo (không thay thế React Native)

**Date:** 2026-03-15  
**Context:** BRD spec yêu cầu React Native Expo driver app (SDK 51+). Yêu cầu native app **KHÔNG thay đổi** — vẫn là mục tiêu chính cho production.  
**Decision:** Bổ sung thêm driver UI dạng Next.js web `/dashboard/driver/` để phục vụ demo trong khi chưa có app native.  
**Rationale:**
- App native cần thời gian build + publish lên store → chưa kịp cho phase demo
- Web driver UI cho phép demo ngay trên trình duyệt, không cần cài app
- Cùng API backend, sau này React Native Expo chỉ cần gọi lại API sẵn có
- PWA fallback: web có thể "Add to Home Screen" để tạm thay thế native
- **Native app vẫn nằm trong roadmap Phase 4/5** — web không thay thế, chỉ bổ sung
**Impact:** Tasks 2.7-2.8 done as web pages cho demo. Native app sẽ implement riêng khi đến phase.  
**Docs Impact:** CURRENT_STATE.md (ghi rõ "Driver app = Next.js web cho demo, native vẫn planned"), TECH_DEBT.md (TD-006)

---

## DEC-002: Single models.go instead of per-module domain files

**Date:** 2026-03-14  
**Context:** CONVENTIONS.md suggests separate files (order.go, trip.go, stock.go)  
**Decision:** Keep all structs in `internal/domain/models.go`  
**Rationale:**
- Project is medium-sized (~31 entities), single file is manageable
- Avoids circular import issues between modules
- Easy to grep and find any struct
**Impact:** All new structs go into models.go  
**Docs Impact:** CURRENT_STATE.md (ghi "31 structs in models.go")

---

## DEC-003: pkg/response/ instead of apperror package

**Date:** 2026-03-14  
**Context:** CONVENTIONS and ERROR_CATALOGUE spec define `pkg/apperror/` with typed errors  
**Decision:** Use simpler `pkg/response/` with direct HTTP helpers  
**Rationale:**
- Faster to implement during demo phase
- Less ceremony for simple CRUD operations
- Will migrate to apperror when error handling becomes complex (Phase 3)
**Impact:** Handlers use response.OK(), response.Err(), etc.  
**Docs Impact:** TECH_DEBT.md (TD-001), KNOWN_ISSUES.md (KI-004)

---

## DEC-004: Raw pgx queries instead of sqlc

**Date:** 2026-03-14  
**Context:** AI_CONTEXT_PRIMER specifies sqlc for DB access  
**Decision:** Use raw pgx v5 queries in repository.go  
**Rationale:**
- sqlc requires separate compilation step and config
- Dynamic queries (filters, pagination) are easier with raw pgx
- pgx v5 enum/date casting issues are handled inline
**Impact:** No sqlc.yaml, no generated code. Manual SQL in repository files.  
**Docs Impact:** TECH_DEBT.md (TD-005), KNOWN_ISSUES.md (KI-001, KI-002)

---

## DEC-005: Tailwind CSS instead of Ant Design

**Date:** 2026-03-14  
**Context:** BOILERPLATE_SPEC and AI_CONTEXT_PRIMER specify Ant Design 5.x  
**Decision:** Use Tailwind CSS with custom components  
**Rationale:**
- Lighter bundle size for demo
- More control over styling
- No antd dependency conflicts with Next.js 14
**Impact:** All UI uses Tailwind utility classes, no Ant Design components  
**Docs Impact:** TECH_DEBT.md (TD-002)

---

## DEC-006: Integration hooks pattern (fire-and-forget async)

**Date:** 2026-03-15  
**Context:** Tasks 3.1-3.7 require wiring Bravo/DMS/Zalo into business flows  
**Decision:** Create `integration.Hooks` struct injected into OMS/TMS services via `SetIntegrationHooks()`. All integration calls are goroutine fire-and-forget — never block the user.  
**Rationale:**
- Integration errors should NEVER fail business operations (error-codes instruction: return 202)
- Clean separation: services don't import adapters directly
- Hooks are optional — nil check before calling
- Easy to add new hooks without changing service constructors
**Impact:** `hooks.go` created, OMS/TMS services accept hooks  
**Docs Impact:** CURRENT_STATE.md (integration wiring section)

---

## DEC-007: Notification Bell → Right-side Slide Panel (topbar design)

**Date:** 2026-03-20  
**Context:** Session 17 đặt NotificationBell trong sidebar header (w-64). Text bị cắt, khó đọc. User feedback: UI khó đọc, đề xuất đặt bên phải.  
**Decision:** Chuyển NotificationBell từ sidebar sang topbar trong main content area. Click mở slide-in panel full-height bên phải (max-w-md), thay vì dropdown nhỏ w-80.  
**Rationale:**
- Sidebar chỉ rộng 256px (w-64), dropdown w-80 bị tràn ra ngoài viewport
- Slide panel từ phải cho phép hiển thị nội dung đầy đủ (400px+ width)
- Topbar là vị trí chuẩn cho notification bell (GitHub, Slack, Teams pattern)
- Panel có backdrop overlay, ESC close, body scroll lock — UX chuẩn
**Impact:** Layout restructured: sidebar (nav only) + topbar (greeting + bell) + main content. NotificationBell renders portal-style fixed positioning.  
**Docs Impact:** CURRENT_STATE.md (notification UI section), CHANGELOG.md

---

## DEC-008: Entity Events as immutable audit log (JSONB detail)

**Date:** 2026-03-20  
**Context:** Cần track timeline/history cho orders + trips. Options: (a) separate columns cho mỗi event type, (b) JSONB detail column.  
**Decision:** Sử dụng bảng `entity_events` với `detail JSONB` — mỗi event type tự define fields trong JSONB.  
**Rationale:**
- Immutable log — không update, chỉ INSERT
- Flexible: mỗi event type có fields khác nhau (reject_reason, order_number, etc.)
- Không cần migration khi thêm event type mới
- 23 event types hiện tại, dễ mở rộng
- Query bằng JSONB operators khi cần
**Impact:** `internal/events/` package, `entity_events` + `order_notes` tables  
**Docs Impact:** DBS_BHL_OMS_TMS_WMS.md (schema), CURRENT_STATE.md

---

## DEC-009: UXUI_SPEC.md — Per-role UX/UI specification

**Date:** 2026-03-21  
**Context:** Frontend pages đang code không nhất quán về layout, color, interaction. Mỗi role có context khác nhau (driver mobile vs dispatcher desktop vs PDA warehouse). Cần source of truth cho UI decisions.  
**Decision:** Tạo `docs/specs/UXUI_SPEC.md` — per-role UX spec với layout patterns, color rules, component snippets. Brand color #F68634 + 5 UX rules bắt buộc.  
**Rationale:**
- 8 roles → 8 layout patterns khác nhau (3-column cockpit, mobile full-width, PDA scan-first, etc.)
- Brand color #F68634 ≠ amber warning → phải phân biệt rõ ràng
- 5 UX rules (zero dead ends, instant feedback, role-aware empty states, trace ID, tap targets) đảm bảo consistency
- Copy-paste color snippets tiết kiệm thời gian, giảm sai sót
- `frontend-patterns.instructions.md` updated → AI auto-read UXUI_SPEC.md trước khi code
**Impact:** `docs/specs/UXUI_SPEC.md` (mới), `.github/instructions/frontend-patterns.instructions.md` (updated), `CLAUDE.md` (added UX section)  
**Docs Impact:** CLAUDE.md, frontend-patterns.instructions.md

---

## DEC-010: Gap Analysis — Priority Adjustments (11 role UX gaps)

**Date:** 2026-03-21  
**Context:** Phản biện bảng gap analysis 11 roles. Bảng gốc đánh P0 cho 6 items. Sau phân tích code thực tế + business context BHL (~70 xe, ~800 NPP), nhiều items bị over-prioritized.  
**Decision:** Điều chỉnh priorities theo bảng sau:

| Role | Đề xuất gốc | Điều chỉnh | Lý do |
|------|-------------|------------|-------|
| Admin (config versioning, 4-eye) | P0 | **P1** | Audit log đã cover; 4-eye overkill cho 1-2 admin |
| BGĐ (executive narrative) | P1 | **P1** ✓ | Chỉ cần drill links, không cần narrative engine |
| Điều phối (what-if, bulk) | P0 | **P2** | Đã là role mạnh nhất; what-if quá sớm cho ~70 xe |
| DVKH (customer workspace) | P0 | **P1** | Thêm vài links/tabs, không cần redesign |
| Kế toán (recon workbench) | P0 | **P0** ✓ | Nhưng scope gọn: T+1, split view, history |
| KT Trưởng (đà riêng) | P0 | **P2** | 1 người; action-level RBAC đủ, không cần screen riêng |
| Thủ kho (workbench) | P1 | **P1** ✓ | Queue picking + gate backlog |
| Đội trưởng (fleet console) | P1 | **P2** | Gộp vào dispatcher là deliberate (CURRENT_STATE.md) |
| Bảo vệ (evidence) | P1 | **P1** ✓ | Photo + per-item + reason code |
| Phân xưởng (assets desk) | P0 | **P0** ✓ | Gap lớn nhất: role + page cần thiết |
| Tài xế (native app) | P0 | **P3** | PWA đủ go-live; native = 6-12 tháng, 200-500M VND |

**Rationale:**
- BHL chưa chạy production → chưa biết pain points thực tế
- "World-class" features (what-if, 4-eye, executive narrative) không cần cho go-live ~70 xe
- P0 trước go-live chỉ nên là features ảnh hưởng trực tiếp đến daily operations
- Native mobile đánh giá lại sau 3 tháng production với data thực tế

**Impact:** Tạo Phase 6 (18 tasks): 5 P0 + 8 P1 + 5 P2/P3. Tổng 128 tasks.  
**Docs Impact:** TASK_TRACKER.md (Phase 6), TECH_DEBT.md (TD-014–TD-017), UXUI_SPEC.md (add workshop role)

---

## DEC-011: Workshop (Phân xưởng) = sub-role của warehouse_handler

**Date:** 2026-03-21  
**Context:** BRD định nghĩa "Phân xưởng" là role riêng, nhưng business logic gồng warehouse_handler (cùng thuộc WMS). Tách role hoàn toàn sẽ cần migration, RBAC update, frontend routing.  
**Decision:** Implement workshop như role `workshop` riêng trong DB nhưng share WMS API endpoints. Frontend page riêng `/dashboard/workshop/`. Sub-set quyền của warehouse_handler — chỉ thấy returns + asset classification, không thấy picking/inbound.  
**Rationale:**
- Role riêng cho RBAC sạch (security boundary)
- Share endpoints tránh duplicate code
- Scope gọn: 1 page phân loại vỏ + 1 report đối chiếu
**Impact:** Thêm role `workshop` vào auth enum, migration, seed data. 2 frontend pages.  
**Docs Impact:** UXUI_SPEC.md (§9b), CURRENT_STATE.md, BRD role mapping

---

## DEC-012: NPP App defer sang Phase 2 (sau 3-6 tháng go-live)

**Date:** 2026-03-22  
**Context:** v4 spec thiết kế đầy đủ NPP App với token-based confirm/reject, xem công nợ, báo sai lệch. Tuy nhiên Phase 1 chỉ có ~70 xe và NPP chưa quen dùng app.  
**Decision:** Phase 1 dùng Zalo OA + DVKH ghi thay (DEC-013). NPP App bằng React Native Expo sẽ triển khai Phase 2 sau 3-6 tháng production ổn định.  
**Rationale:**
- Zalo OA đã quen thuộc với NPP, không cần cài thêm app
- DVKH ghi thay đảm bảo quy trình không bị block
- Auto-confirm 2h/24h giảm tải cho DVKH khi NPP không phản hồi
- Schema DB đã sẵn sàng (`reject_reason_code`, `dispute_reason_code`, `visibility`) — không cần migration Phase 2
**Impact:** Token-based endpoints (`confirm_order`, `reject_order`) → TD-026. Note visibility locked → TD-027.  
**Docs Impact:** TECH_DEBT.md (TD-026, TD-027), UXUI_SPEC.md (§14.8)

---

## DEC-013: DVKH ghi thay NPP trong Phase 1

**Date:** 2026-03-22  
**Context:** NPP phản hồi qua Zalo/ĐT, không trực tiếp thao tác trên hệ thống. DVKH phải ghi nhận thay.  
**Decision:** DVKH sử dụng 2 modal chuyên dụng:
- `record_npp_rejection` — NPP từ chối đơn (reason code + ghi chú)
- `record_npp_dispute` — NPP báo sai lệch giao hàng (reason code + ghi chú)
Cả 2 modal ghi log `actor_type = 'dvkh'`, `on_behalf_of = 'npp'` vào entity_events.  
**Rationale:**
- Không cần NPP learn hệ thống mới
- DVKH đã là touchpoint chính với NPP
- Audit trail rõ ràng: ai ghi, ghi thay ai, lý do gì
**Impact:** 2 modals mới trong frontend DVKH, backend endpoint ghi entity_events.  
**Docs Impact:** UXUI_SPEC.md (§13, §14.1), BUSINESS_RULES.md (BR-OMS-AUTO)

---

*Cập nhật: 22/03/2026 — DEC-012/013 từ BHL_UX_VIBE_CODING_SPEC_v4.md*
