# CHANGELOG — BHL OMS-TMS-WMS

> Track actual code changes vs spec. Updated after each task completion.

---

## [Unreleased] — Phase 2 in progress

### 2026-03-15 — Session: Tasks 1.18–2.10

#### Added
- **OSRM Docker + Vietnam data** (Task 1.18)
  - OSRM service in docker-compose.yml with healthcheck
  - `setup-osrm.ps1` for Vietnam OSM data download
  - VRP solver OSRM integration (distance matrix + duration)
  - `/status` endpoint on VRP solver

- **VRP benchmark** (Task 1.19)
  - `vrp-solver/benchmark_vrp.py` — 1,000 orders stress test
  - Makefile `benchmark` target

- **WMS Module** (Tasks 2.1–2.6)
  - Migration `004_wms.up.sql` — 7 enums, 5 tables, 2 table ALTERs
  - `internal/wms/` — repository.go, service.go, handler.go (13 endpoints)
  - Inbound + lot management, FEFO/FIFO picking
  - Gate check (R01 compliance), barcode scan API
  - Expiry alert, location hierarchy (LTREE)

- **Driver Web Pages** (Tasks 2.7–2.8)
  - `web/src/app/dashboard/driver/[id]/page.tsx` — trip detail + actions
  - Start trip, update stops (arrived/delivered/failed), complete trip

- **CI/CD** (Task 1.3)
  - `.github/workflows/ci.yml` — 5-job pipeline

- **OMS Enhancements** (Task 1.14)
  - Cutoff 16h, consolidation/split
  - Migration `003_cutoff_consolidation.up.sql`

- **GPS WebSocket** (Task 1.17)
  - `internal/gps/` — hub.go + handler.go
  - Redis pub/sub for GPS positions

#### Spec Deviations (from docs/specs/)
- **Trip status:** Code has ~6 statuses (created, assigned, in_transit, completed, cancelled). Spec has 13 (SM-02). Will align in Phase 3.
- **Stop status:** Code uses simplified flow (pending → arrived → delivered/failed). Spec has delivering/partial/re_delivery. Will align in tasks 2.11+.
- **Error codes:** Code uses `pkg/response/` simple errors. ERROR_CATALOGUE defines structured codes. Will migrate gradually.
- **Logger:** Code uses `log` stdlib. Spec recommends `zerolog`. Low priority.

---

## [0.1.0] — Demo Build (pre-task-tracker)

### Added
- Docker Compose (postgres, redis, vrp)
- Auth (JWT RS256, login, refresh, RBAC middleware)
- OMS CRUD (orders, products, customers, shipments, ATP, credit)
- TMS (trips, drivers, vehicles, VRP planning)
- Next.js frontend (login, dashboard, 10+ pages)
- Seed data (8 drivers, 20+ customers, products, vehicles)
