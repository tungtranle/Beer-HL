# UX_REDESIGN_EXECUTION_PLAN — Implementation Roadmap

> **Mục đích:** Plan triển khai cụ thể cho [UX_AUDIT_AND_REDESIGN.md](UX_AUDIT_AND_REDESIGN.md ).
> Chia thành 4 phase, mỗi phase deliverable rõ ràng + acceptance criteria + rollback path.
>
> **Ngày:** 23/04/2026.
> **Owner:** Frontend dev + UX designer.
> **Sync với:** [WORLDCLASS_EXECUTION_PLAN.md](WORLDCLASS_EXECUTION_PLAN.md ) (Sprint 1–3).

---

## NGUYÊN TẮC TRIỂN KHAI

1. **Component-first, page-second** — build foundation components trước, integrate vào page sau.
2. **Backward compatible** — KHÔNG xóa/đổi API page hiện tại; chỉ thêm enhancement.
3. **Feature flag** — mỗi feature mới có env flag (`NEXT_PUBLIC_FEATURE_F2_HEALTH=on`) để rollback nhanh.
4. **No new heavy deps** — dùng lucide-react + Tailwind có sẵn. Tránh thêm Headless UI/cmdk nếu tự build được < 200 LOC.
5. **Test mỗi component** với Vitest + React Testing Library trước khi mount vào page.

---

## PHASE 1 — Foundation Components (Tuần 1, Sprint 1 — DOING NOW)

> **Mục tiêu:** Xây 7 shared components reusable. Không touch business pages chính (orders/new, control-tower) trong phase này — chỉ test riêng.

### Deliverables

| # | Component | File | Đáp ứng UX issue | Status |
|---|---|---|---|---|
| P1.1 | `Skeleton` primitives (Card/Line/Avatar) | `web/src/components/ui/Skeleton.tsx` | U5 | ⏳ |
| P1.2 | `EmptyState` role-aware | `web/src/components/ui/EmptyState.tsx` | U5 + UX-03 | ⏳ |
| P1.3 | `ExplainabilityModal` (F15) | `web/src/components/ui/ExplainabilityModal.tsx` | F15 | ⏳ |
| P1.4 | `CommandPalette` (Cmd+K) | `web/src/components/ui/CommandPalette.tsx` | U2 | ⏳ |
| P1.5 | `NppHealthBadge` (F2) | `web/src/components/ui/NppHealthBadge.tsx` | F2 | ⏳ |
| P1.6 | `SmartSuggestionsBox` (F3) | `web/src/components/ui/SmartSuggestionsBox.tsx` | F3 | ⏳ |
| P1.7 | `InboxItem` (U4) | `web/src/components/ui/InboxItem.tsx` | U4 | ⏳ |
| P1.8 | Mount `<CommandPalette>` globally | edit `dashboard/layout.tsx` | U2 wiring | ⏳ |
| P1.9 | Update FRONTEND_GUIDE §10 (new patterns) | `docs/specs/FRONTEND_GUIDE.md` | docs | ⏳ |

### Acceptance Phase 1
- [ ] `npm run build` pass không TypeScript error
- [ ] Mỗi component có default export + named props interface
- [ ] Cmd+K mở/đóng được từ bất kỳ page nào
- [ ] FRONTEND_GUIDE có section "Shared World-Class Components"
- [ ] CHANGELOG entry

### Rollback
Components mới không break code cũ vì:
- Chỉ là file mới (CommandPalette/Skeleton/...)
- Layout integration chỉ thêm 1 dòng mount, comment out để rollback

---

## PHASE 2 — Page Integration (Tuần 2, Sprint 1)

> **Mục tiêu:** Mount components vào 3 page chính (orders/new, control-tower, dashboard homepage).

### Deliverables

| # | Page | Changes | Affected UX |
|---|---|---|---|
| P2.1 | `/dashboard/orders/new` | Thêm `<NppHealthBadge>` cạnh customer select; `<SmartSuggestionsBox>` dưới items list; auto-save draft 30s | C-1, C-2, F2, F3 |
| P2.2 | `/dashboard/control-tower` | Thêm "Focus Panel" component (1 việc cần làm tiếp); rút 14 KPIs → 4 visible + "Mở rộng" | D-1, D-2 |
| P2.3 | `/dashboard` (homepage) | Replace 5 KPI cards bằng "narrative cards" cho BGĐ; mobile-responsive | M-1, M-3 |
| P2.4 | E2E Playwright | 3 happy path: create order with suggestions, control tower focus action, dashboard load | testing |

### Acceptance Phase 2
- [ ] Order form mới render < 2.5s LCP
- [ ] DVKH UAT (1 user, 30 phút) confirm "dễ hơn trước"
- [ ] Focus Panel cập nhật real-time qua WebSocket existing
- [ ] Mobile homepage usable trên iPhone SE 375px

---

## PHASE 3 — Driver Mobile Redesign (Tuần 3, Sprint 1)

> **Mục tiêu:** Driver one-thumb operation (DR-1).

### Deliverables

| # | Page | Changes |
|---|---|---|
| P3.1 | `/dashboard/driver/[id]` | Bottom Action Sheet thay top header; sync indicator pill |
| P3.2 | `/dashboard/driver/[id]/eod` | Auto-match expected vs actual; show "Yesterday's recap" entry point |
| P3.3 | New: `<DriverCoachingCard>` (F13) | Component show sau EOD complete |
| P3.4 | Mobile usability test | 3 drivers on Galaxy A55 + iPhone SE — measure thumb-reach success rate |

### Acceptance Phase 3
- [ ] Touch targets đủ h-12/h-14 ở thumb zone
- [ ] One-thumb success rate > 95% (lab test)
- [ ] Coaching card tuân thủ "positive framing + max 3 bullets"

---

## PHASE 4 — Cross-cutting (Tuần 4–5, Sprint 1–2)

### Deliverables

| # | Item | Description |
|---|---|---|
| P4.1 | Inbox page `/dashboard/inbox` | Replace toast-only; tabs Cần làm / Đợi / Snoozed / Done |
| P4.2 | Saved Views (orders/trips/customers) | Dropdown "Views" cạnh search bar |
| P4.3 | Onboarding tour (Shepherd.js hoặc custom) | First-login per role, 5 steps highlight |
| P4.4 | A11y audit + fixes | axe-playwright run + fix focus-visible/aria-label |
| P4.5 | Optimistic UI refactor | 5 pages convert from `setLoading(true)` → optimistic |
| P4.6 | F1 Forecast pill in order form | Cần ML service ready (Sprint 2) |

### Acceptance Phase 4
- [ ] Lighthouse > 90 cho 3 page chính
- [ ] axe 0 critical issues
- [ ] User survey SUS > 80

---

## TIMELINE (sync với Sprint 1–3)

| Tuần | Phase | Done by |
|---|---|---|
| 1 (current) | Phase 1 — Foundation | Frontend dev + AI |
| 2 | Phase 2 — Page integration | Frontend dev |
| 3 | Phase 3 — Driver mobile | Frontend dev + UX |
| 4–5 | Phase 4 — Cross-cutting | Full team |
| 6+ | F1 forecast pill, F4/F5/F7 UX (depends ML service Sprint 2) | — |
| 9–12 | F6 driver dashboard, F10 revenue BI, F13 coaching, F14 warehouse | Sprint 3 |

---

## TÀI LIỆU CẦN UPDATE SAU MỖI PHASE

| Phase | Files |
|---|---|
| 1 | FRONTEND_GUIDE.md (§10 new components), CHANGELOG.md, DECISIONS.md (DEC-WC-02 component-first approach) |
| 2 | CURRENT_STATE_COMPACT.md (page changes), CHANGELOG.md, KNOWN_ISSUES.md (nếu có) |
| 3 | UX_AUDIT_AND_REDESIGN.md (cập nhật usability test results), CHANGELOG.md |
| 4 | TECH_DEBT.md (remove TD-010 testing infra), AI_LESSONS.md (nếu có pattern mới học được) |

---

*Phase 1 đang triển khai. Updates xem CHANGELOG.md.*
