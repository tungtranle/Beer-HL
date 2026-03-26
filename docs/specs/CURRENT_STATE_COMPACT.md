# CURRENT_STATE_COMPACT — BHL OMS-TMS-WMS

> Rút gọn từ CURRENT_STATE.md. Chi tiết endpoints → xem CURRENT_STATE.md (Tầng 3).
> Cập nhật: 24/03/2026

---

## Hệ thống

| Component | Port | Status |
|-----------|------|--------|
| Backend Go+Gin | :8080 | ✅ |
| Frontend Next.js | :3000 | ✅ |
| PostgreSQL 16 | :5434 | ✅ 17 migrations (001-014) |
| Redis | :6379 | ✅ Local Windows |
| VRP Python | :8090 | ✅ |
| OSRM | :5000 | ⚠️ Cần setup |
| Mock Server | :9001-9003 | ✅ Optional |
| Sentry | Cloud | ✅ |

## Modules

| Module | Endpoints | Ghi chú chính |
|--------|-----------|----------------|
| Auth | 2 | RS256 JWT, 9 roles |
| Admin | 16 | Users, configs, health, routes, credit, audit |
| OMS | 32 | Orders CRUD, ATP, credit, cutoff 16h, Zalo confirm 2h, redelivery |
| TMS | 50+ | Trips, VRP, driver flow, gate check, vehicle/driver docs |
| WMS | 28 | Stock, FEFO picking, gate check, returns, bottle classification |
| Integration | 18 | Bravo/DMS/Zalo mock, DLQ, NPP portal |
| Reconciliation | 12 | Auto-reconcile, discrepancy T+1, action history, KT Trưởng RBAC |
| Notification | 5+WS | Bell slide panel, toast, entity events, timeline+notes |
| KPI | 4+cron | Reports, issues, cancellations, daily snapshot 23:50 |
| GPS | 3+WS | Batch upload, latest positions, pub/sub |
| Test Portal | 18 | 8 tabs, GPS simulator, no auth |

## Cron Jobs

| Job | Interval |
|-----|----------|
| Auto-confirm order 2h | 5 phút |
| Auto-confirm delivery 24h | 1 giờ |
| Bravo credit reconcile | Nightly 0:00 |
| KPI snapshot | 23:50 ICT |
| Doc expiry check | 07:00 ICT |
| Credit limit expiry | 6 giờ |

## Database
- 38+ bảng, 9 enums, 17 migration files (001-014, có trùng số 009, 010)
- 40+ structs trong `internal/domain/models.go`
- Frontend: 42 pages

## Khác với spec

| Spec | Thực tế | Quyết định |
|------|---------|------------|
| React Native Expo | Next.js web + PWA | DEC-001 |
| Ant Design 5.x | Tailwind CSS | DEC-005 |
| sqlc | Raw pgx | DEC-004 |
| pkg/apperror/ | pkg/response/ | DEC-003 |
| 11 roles (BRD) | 9 roles (code) | 2 roles = sub-roles |
| 13 trip statuses | Code dùng ~8 | Bổ sung dần |

## Tiến độ
- 128 tasks, 119 xong (93%). Phase 1-3, 5-6: ✅. Phase 4: 15/20 (75%)
- Còn: infra production, backup/DR, training, go-live
- Chờ BHL IT: Bravo sandbox, DMS sandbox, Zalo OA, PDA model

## Seed Data
218 NPP thực tế BHL, 82 xe+TX, 30 SP, 500 routes, 120+ users

## Code Compliance
200+ vi phạm (TD-018→025). Chỉ fix khi chạm file đó. Chi tiết: TECH_DEBT.md
