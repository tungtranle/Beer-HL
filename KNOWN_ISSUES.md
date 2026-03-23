# KNOWN ISSUES — BHL OMS-TMS-WMS

> Track bugs, workarounds, and tech debt. AI must check this file to avoid repeating known issues.

---

## Active Issues

### KI-001: pgx v5 enum scanning
- **Severity:** Critical (will crash at runtime)
- **Description:** pgx v5 cannot scan custom PostgreSQL enum types into Go strings
- **Workaround:** Always add `::text` cast in SELECT queries for enum columns
- **Affected columns:** status, vehicle_type, ledger_type, all custom enums
- **Fix:** Cast in SQL, not in Go code

### KI-002: pgx v5 date scanning
- **Severity:** Critical
- **Description:** pgx v5 cannot scan `date` type into Go strings
- **Workaround:** Add `::text` cast for date columns in SELECT
- **Affected columns:** delivery_date, planned_date, expiry_date

### KI-003: Trip status simplified vs spec
- **Severity:** Low (will fix in Phase 3)
- **Description:** Code uses ~6 trip statuses. STATE_MACHINES.md defines 13.
- **Missing statuses:** checked, loading, gate_checked, at_stop, returning, unloading_returns, settling, reconciled
- **Plan:** Add as each feature is implemented (gate check → gate_checked, etc.)

### KI-004: No structured error codes yet
- **Severity:** Low
- **Description:** Backend uses simple string errors via pkg/response/. ERROR_CATALOGUE defines structured codes.
- **Plan:** Migrate to apperror package in Phase 3 (Task 3.20)

### KI-005: No zerolog yet
- **Severity:** Low
- **Description:** Using stdlib `log`. Spec recommends `zerolog`.
- **Plan:** Migrate when adding structured logging (Phase 3)

### KI-006: Local Windows Redis conflicts with Docker Redis
- **Severity:** Medium
- **Description:** Dev machine has local Windows Redis 3.0.504 on port 6379, same port as Docker Redis mapping. Go server connects to local Redis, not Docker.
- **Workaround:** Use Go-based tools (e.g., `cmd/inject_gps/main.go`) to write to local Redis. Do NOT use PowerShell inline `HSET` or `inject-gps.ps1` — double quotes in JSON get mangled by shell layering, producing invalid JSON.
- **Fix:** Either stop Windows Redis service or change Docker Redis port mapping.

---

## Resolved Issues

| ID | Description | Resolution | Date |
|----|-------------|-----------|------|
| KI-007 | Order number race condition: `generateOrderNumber()` uses `UnixNano()%10000`, causing duplicate key under concurrent load (28% error rate at 5 workers) | Replaced with PostgreSQL sequence `order_number_seq` via `nextval()`. Migration 010. Fixed in oms/service.go + oms/repository.go + testportal/handler.go | 2026-03-21 |
| — | NotificationBell cramped in sidebar, text cut off | Redesigned: right-side slide panel (max-w-md) + moved bell to topbar | 2026-03-20 |
| — | 404 on /dashboard/notifications | Created missing `notifications/page.tsx` (file lost from session 17) | 2026-03-20 |
| — | Reject reason from Zalo not showing in order timeline | `CancelOrderByCustomer` now passes `reason` string to event recorder | 2026-03-20 |
| — | actor_name empty in entity_events | Added `FullNameFromCtx(ctx)` propagation from JWT → context → events | 2026-03-20 |
| — | Driver modal shows 79 drivers instead of warehouse-filtered count | Use checkins data as primary source in DriverStatusModal | 2026-03-15 |
| — | Unassigned orders list shows empty rows with "? kg" | Enrich bare UUIDs from VRP with shipment data from local state | 2026-03-15 |
| — | Assigned drivers mixed with available in dropdown | Sort assigned drivers to bottom of select list | 2026-03-15 |
| — | Double-paren syntax in WMS handler | Fixed regex replacement | 2026-03-15 |
| — | response.Error/Success undefined | Used correct pkg/response API names | 2026-03-15 |
| — | Dashboard "Tổng đơn hàng" shows "-" | Added `total_orders` field to `/dashboard/stats` API response | 2026-03-16 |
| — | Vietnamese text (???? garble) in order notes for SO-20260317 | Fixed corrupted DB data with Unicode escapes; caused by PowerShell SQL piping (KI-006) | 2026-03-16 |
| — | ListCreditBalances/ListCustomers crash (no credit_limit column) | JOIN `credit_limits` table instead of `customers.credit_limit` | 2026-03-20 |
| — | ResetTestData wrong table names | Fixed: removed non-existent tables, added missing ones | 2026-03-20 |

---

*Updated: 2026-03-21*
