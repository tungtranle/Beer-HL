# CURRENT_STATE_COMPACT — BHL OMS-TMS-WMS

> Rút gọn từ CURRENT_STATE.md. Chi tiết endpoints → xem CURRENT_STATE.md (Tầng 3).
> Cập nhật: 27/04/2026 — Decision Intelligence UX one-shot

---

## Hệ thống

| Component | Port | Status |
|-----------|------|--------|
| Backend Go+Gin | :8080 | ✅ |
| Frontend Next.js | :3000 | ✅ |
| PostgreSQL 16 | :5434 | ✅ migrations tới 043 (`ai_feature_flags`, AI audit/inbox/simulation/feedback) |
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
| Cost Engine | 19 | Toll stations/expressways CRUD, vehicle cost defaults/profiles, driver rates. VRP cost optimization (fuel+toll) |
| WMS | 28 | Stock, FEFO picking, gate check, returns, bottle classification |
| Integration | 18 | Bravo/DMS/Zalo mock, DLQ, NPP portal |
| Reconciliation | 12 | Auto-reconcile, discrepancy T+1, action history, KT Trưởng RBAC |
| Notification | 5+WS | Bell slide panel, toast, entity events, timeline+notes |
| KPI | 4+cron | Reports, issues, cancellations, daily snapshot 23:50; report scope/date-as-of metadata |
| GPS | 3+WS+3sim | Batch upload, latest positions, pub/sub, simulate start/stop/status, route thật theo kho/NPP + OSRM |
| QA Portal / AQF | 18+ | `/test-portal` login protected; AQF Command Center + scoped demo scenarios; legacy destructive endpoints disabled |
| AI-native | 20+ | AI flags + Privacy Router + Transparency + Inbox + Intent + Voice + Simulation + Trust Loop + AI-R/AI-G/AI-M rules/provider/ML endpoints; frontend `/dashboard/settings/ai`, `/dashboard/ai/transparency`, `/dashboard/ai/simulations`, Dashboard brief/outreach, Control Tower score badge, Approvals risk chip, OMS seasonal+demand panels, Anomalies explain, Customers Zalo draft; default AI flags OFF |

## AI-native Phase 2-6 thực tế

- Migration 043 đã apply: `ai_audit_log`, `ai_inbox_items`, `ai_simulations`, `ai_feedback`.
- Privacy Router không lưu raw prompt; lưu `request_hash`, route `cloud/local/rules/blocked`, sensitivity `low/medium/high`.
- Simulation là dry-run snapshot TTL 5 phút; apply trả `approval_required=true`, `core_tables_mutated=false`.
- Smoke đã chạy trên backend tạm `SERVER_PORT=18080`; sau test reset `ai.master`, `ai.intent`, `ai.voice`, `ai.simulation` về OFF.
- Fix 27/04: frontend refresh token đọc được cả `data.access_token` và `data.tokens.access_token`; AI dashboard/order widgets gate bằng feature flags trước khi gọi `/ai/*`, nên AI OFF không còn gây API 401 nền và core UI vẫn render baseline.
- Decision Intelligence one-shot 27/04: thêm AI surface primitives (`AIContextStrip`, `ConfidenceMeter`, AI tokens, TTL cache, feedback adapter), OMS risk strip cho DVKH, Approval “Ưu tiên xử lý”, VRP review panel, Control Tower `ai.gps_anomaly` gate và Driver `VoiceCommandFAB` confirm-only. AI OFF/API fail vẫn silent/fallback.
- Fix 27/04 follow-up: AI Inbox synthetic rule items (`rules-*`) ack/dismiss thành công bằng no-op backend response; DB-backed inbox UUID items vẫn update bảng `ai_inbox_items` như cũ.
- Fix 27/04 follow-up: `DispatchBriefCard` mini metrics drill down tới operational pages tương ứng thay vì chỉ hiển thị số tĩnh.
- Fix 27/04 follow-up: `OutreachQueueWidget` có item-level actions: mở NPP theo filter, tạo nháp Zalo, đánh dấu đã liên hệ trong widget.
- Report scope 27/04: `/dashboard/kpi` mặc định 7 ngày, có scope bar Today/7 ngày/30 ngày/Historical; issues/cancellations dùng `from/to` theo lựa chọn; aggregate report trả `scope_from/scope_to/data_as_of/latest_fallback`.
- Operational scope 27/04: `/dashboard/stats` dùng month-to-date cho `total_orders`; `/dashboard/orders` mặc định tháng hiện tại và gửi `from/to` cho stats/list/export/sidebar; `/v1/trips?active=true` dùng cho Control Tower/Handover A; Reconciliation mặc định work queue mở (`pending`/`open`) + tháng hiện tại, backend list/discrepancy/daily-close/export nhận `from/to`.
- GPS route-real 27/04: runtime GPS simulator và Test Portal GPS dùng `OSRM_URL`/OSRM local cho road geometry; nếu không có geometry trả 503 `ROUTE_GEOMETRY_UNAVAILABLE`, không fallback đường chim bay/public OSRM cho demo/test chính.
- VRP fallback BOT 27/04: khi solver Python unavailable (`distance_source=mock`), mock planner vẫn tách `optimize_for=cost|time` và đã cộng BOT theo toll station/expressway vào `trip.toll_cost_vnd` + `summary.total_toll_cost_vnd` (route nào không chạm trạm/không có fee class hợp lệ thì toll có thể = 0).

## AI-R / AI-G / AI-M thực tế

- AI-R1–R5 DONE: rules engine anomaly/credit/seasonal, migration 040 cache/risk signals, backend endpoints và FE inline surfaces.
- AI-G1–G4 DONE: Gemini 2.0 Flash + Groq fallback retry, daily dispatch brief cron 07:00 ICT, anomaly explanation, Zalo NPP draft modal.
- AI-M1–M3 DONE: Python `POST /ml/forecast-demand`, Go `GET /v1/ai/demand-forecast` fail-soft, `GET /v1/ai/outreach-queue`, OMS `DemandIntelligencePanel`, Dashboard `OutreachQueueWidget`.
- Smoke 26/04 trên backend tạm `SERVER_PORT=18080`: `vehicle=normal`, `seasonal=high`, `brief=mock-rules→mock-rules`, `risk=medium`, `zalo=mock-rules→mock-rules`; anomaly explain skip vì DB không có open anomaly.
- Smoke AI-M 26/04: Python forecast function returns `prophet-compatible-rules` 4 points; Go demand forecast fallback returns 4 points/provider `rules`; outreach queue returns 3 items; `/dashboard/orders/new` và `/dashboard` HTTP 200.

## AQF / QA Portal thực tế

- `/v1/test-portal/*` yêu cầu JWT + role `admin` hoặc `management` khi `ENABLE_TEST_PORTAL=true`.
- Demo user: `qa.demo` / `demo123`, role `management`.
- Safe scenario APIs: `GET /demo-scenarios`, `GET /demo-runs`, `POST /demo-scenarios/:id/load`, `POST /demo-scenarios/:id/cleanup`.
- Scenario hiện có: DEMO-01 Zalo confirm, DEMO-02 credit approval, DEMO-03 historical-calibrated dispatch nhiều điểm, DEMO-04 rejected order audit, DEMO-HIST-01 historical read-only replay, DEMO-DISPATCH-01 live ops gần công suất, DEMO-AI-DISPATCH-01 AI dispatcher demo.
- Demo realism 27/04: DEMO-HIST-01 chọn busiest historical `delivery_date` làm evidence read-only; DEMO-03 tạo tối thiểu 24 orders thay vì 3 orders; DEMO-DISPATCH-01 tạo owned live trips theo busiest historical day + ~80% active vehicles/drivers, cap 40 trips, driver check-ins scoped và NPP có tọa độ; DEMO-AI-DISPATCH-01 thêm AI Inbox/Brief/Simulation cho điều phối viên.
- Data safety: migration 041 ownership registry; cleanup chỉ xóa entity owned; `historical_rows_touched = 0`; cấm `TRUNCATE` và unscoped `DELETE`.
- Legacy endpoints `reset-data`, `load-scenario`, `run-scenario`, `run-all-smoke` đã disabled để bảo toàn history.
- Monitoring/evidence map nằm trong `AQF_BHL_SETUP.md`: Playwright G3, Sentry, Clarity, Telegram config, G4 health.

## Cron Jobs

| Job | Interval |
|-----|----------|
| Auto-confirm order 2h | 5 phút |
| Auto-confirm delivery 24h | 1 giờ |
| Bravo credit reconcile | Nightly 0:00 |
| KPI snapshot | 23:50 ICT |
| AI daily dispatch brief | 07:00 ICT |
| Doc expiry check | 07:00 ICT |
| Credit limit expiry | 6 giờ |

## Database
- 60+ bảng, 9+ enums, migrations tới 042
- 48+ structs trong `internal/domain/models.go`
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
- 133 tasks, 133 xong phần core+AI-R/G/M theo tracker hiện hành. Phase 1-3, 5-7: ✅. Phase 4: 15/20 (75%)
- Còn: infra production, backup/DR, training, go-live
- Chờ BHL IT: Bravo sandbox, DMS sandbox, Zalo OA, PDA model

## Seed Data
218 NPP thực tế BHL, 82 xe+TX, 30 SP, 500 routes, 120+ users

## Code Compliance
200+ vi phạm (TD-018→025). Chỉ fix khi chạm file đó. Chi tiết: TECH_DEBT.md
