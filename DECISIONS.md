# DECISIONS — BHL OMS-TMS-WMS

> Record architectural and implementation decisions with rationale.
> AI reads this to understand WHY code is written a certain way.

---

## DEC-001: Web-based Driver UI instead of React Native Expo

**Date:** 2026-03-15
**Context:** BRD spec calls for React Native Expo driver app (SDK 51+)
**Decision:** Implement driver UI as Next.js web pages under `/dashboard/driver/`
**Rationale:**
- Faster iteration during development phase
- Same codebase, no separate build pipeline
- Can be wrapped as PWA for mobile-like experience
- React Native Expo can be built later as thin client calling same APIs
**Impact:** Tasks 2.7-2.8 done as web pages, not Expo app

---

## DEC-002: Single models.go instead of per-module domain files

**Date:** 2026-03-14
**Context:** CONVENTIONS.md suggests separate files (order.go, trip.go, stock.go)
**Decision:** Keep all structs in `internal/domain/models.go`
**Rationale:**
- Project is medium-sized (~30 entities), single file is manageable
- Avoids circular import issues between modules
- Easy to grep and find any struct
**Impact:** All new structs go into models.go

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

---

*Updated: 2026-03-15*
