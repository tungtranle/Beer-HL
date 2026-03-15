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

---

## Resolved Issues

| ID | Description | Resolution | Date |
|----|-------------|-----------|------|
| — | Double-paren syntax in WMS handler | Fixed regex replacement | 2026-03-15 |
| — | response.Error/Success undefined | Used correct pkg/response API names | 2026-03-15 |

---

*Updated: 2026-03-15*
