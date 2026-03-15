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

*Cập nhật: 15/03/2026*
