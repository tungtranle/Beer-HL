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
| — | Driver modal shows 79 drivers instead of warehouse-filtered count | Use checkins data as primary source in DriverStatusModal | 2026-03-15 |
| — | Unassigned orders list shows empty rows with "? kg" | Enrich bare UUIDs from VRP with shipment data from local state | 2026-03-15 |
| — | Assigned drivers mixed with available in dropdown | Sort assigned drivers to bottom of select list | 2026-03-15 |
| — | Double-paren syntax in WMS handler | Fixed regex replacement | 2026-03-15 |
| — | response.Error/Success undefined | Used correct pkg/response API names | 2026-03-15 |
| — | Dashboard "Tổng đơn hàng" shows "-" | Added `total_orders` field to `/dashboard/stats` API response | 2026-03-16 |
| — | Vietnamese text (???? garble) in order notes for SO-20260317 | Fixed corrupted DB data with Unicode escapes; caused by PowerShell SQL piping (KI-006) | 2026-03-16 |

---

*Updated: 2026-03-16*
