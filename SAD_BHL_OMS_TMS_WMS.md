# CÔNG TY CỔ PHẦN BIA VÀ NƯỚC GIẢI KHÁT HẠ LONG

# SYSTEM ARCHITECTURE DOCUMENT

## Tài liệu Thiết kế Hệ thống — OMS – TMS – WMS

| Thông tin | Giá trị |
|-----------|---------|
| Dự án | BHL OMS-TMS-WMS |
| Phiên bản SAD | **v2.0** |
| Dựa trên | BRD v2.0 Final (13/03/2026) |
| Ngày tạo | Tháng 3/2026 |
| Trạng thái | Draft — Chờ Review kỹ thuật |
| Deadline Go-live | ~15/05/2026 (rút từ 24/06 nhờ vibe coding) |

### Changelog so với v1.0

| # | Thay đổi | Lý do |
|---|---------|-------|
| 1 | Backend đổi sang **Go + Gin** (từ NestJS) | Hiệu năng cao, concurrency native, memory footprint nhỏ, phù hợp real-time GPS + queue |
| 2 | JWT đổi sang **RS256** (từ HS256) | Bảo mật tốt hơn cho mobile client |
| 3 | Thêm bảng `receivable_ledger`, `system_configs`, `devices`, `daily_kpi_snapshots` | Lấp gap với BRD v2.0 |
| 4 | Credit check dùng **internal ledger** thay vì chờ Bravo sync | Real-time accuracy |
| 5 | Thêm **OSRM** cho distance calculation, giảm chi phí Google Maps | Cost optimization |
| 6 | Thêm section PDA/Barcode, CI/CD, Backup/DR, Timezone policy | Hoàn thiện SAD |
| 7 | Queue đổi sang **Asynq** (Go) thay Bull Queue (Node.js) | Go-native |
| 8 | WebSocket đổi sang **gorilla/websocket** + Redis pub/sub | Go-native |
| 9 | Section Observability đã đúng Go stack | Aligned với backend |
| 10 | **Timeline rút từ 14 tuần → 8 tuần** (4 Phase thay 7 Sprint). Go-live ~15/05/2026 | Vibe coding acceleration — bottleneck là external dependencies, không phải code |
| 11 | **AI-Native UX v3** thêm progressive enhancement + feature flags | AI có thể bật/tắt từng feature; baseline UX không phụ thuộc AI |

---D

# MỤC LỤC

1. [QUYẾT ĐỊNH KIẾN TRÚC TỔNG THỂ](#1-quyết-định-kiến-trúc-tổng-thể)
2. [KIẾN TRÚC COMPONENT](#2-kiến-trúc-component)
3. [KIẾN TRÚC DỮ LIỆU](#3-kiến-trúc-dữ-liệu)
4. [KIẾN TRÚC API](#4-kiến-trúc-api)
5. [KIẾN TRÚC TÍCH HỢP](#5-kiến-trúc-tích-hợp)
6. [VRP SOLVER SERVICE](#6-vrp-solver-service-python--or-tools)
7. [BẢO MẬT](#7-bảo-mật)
8. [HẠ TẦNG & TRIỂN KHAI](#8-hạ-tầng--triển-khai)
9. [DRIVER APP — OFFLINE-FIRST](#9-driver-app--offline-first-architecture)
10. [PDA & BARCODE SCANNING](#10-pda--barcode-scanning)
11. [QUYẾT ĐỊNH THIẾT KẾ QUAN TRỌNG (ADR)](#11-quyết-định-thiết-kế-quan-trọng-adr)
12. [RỦI RO KỸ THUẬT & GIẢM THIỂU](#12-rủi-ro-kỹ-thuật--giảm-thiểu)
13. [OBSERVABILITY STACK](#13-observability-stack)
14. [BƯỚC TIẾP THEO](#14-bước-tiếp-theo)

---

# 1. QUYẾT ĐỊNH KIẾN TRÚC TỔNG THỂ

## 1.1. Pattern: Modular Monolith

🏗️ **Quyết định:** Xây dựng theo kiến trúc Modular Monolith thay vì Microservices.

**Lý do:** Timeline ~2 tháng (vibe coding accelerated), team size nhỏ, và tải hệ thống (~1,000 đơn/ngày, ~50 users) không đòi hỏi distributed architecture phức tạp. Có thể tách microservice từng module sau khi ổn định.

| Tiêu chí | Microservices | Modular Monolith (✅ Chọn) |
|----------|--------------|---------------------------|
| Timeline ~2 tháng (vibe coding) | ❌ DevOps overhead lớn (K8s, service mesh) | ✅ Deploy đơn giản, focus nghiệp vụ |
| Team size nhỏ | ❌ Cần nhiều team độc lập | ✅ Phù hợp 1-2 team |
| Tải ~1,000 đơn/ngày | ❌ Overkill | ✅ Go + PostgreSQL + Redis dư tải |
| Debugging | ❌ Distributed tracing phức tạp | ✅ Log tập trung, dễ debug |
| Module isolation | ✅ Hoàn toàn độc lập | ✅ Go package boundaries + interfaces |
| Mở rộng tương lai | ✅ Scale từng service | ✅ Extract module → service sau |

## 1.1b AI-Native extension — Progressive Enhancement

AI layer chạy trong modular monolith hiện tại, không tách microservice ở Phase 1-6 foundation. `internal/ai` quản lý provider/rules/flags/privacy/audit/inbox/intent/voice/simulation/trust; frontend dùng `/dashboard/settings/ai`, `/dashboard/ai/transparency`, `/dashboard/ai/simulations` và hooks `useFeatureFlags`/`useAIFeature` để render AI enhancement có điều kiện.

| Component | Quyết định |
|---|---|
| Feature flags | PostgreSQL `ai_feature_flags`, scope org/role/user, default OFF |
| Async jobs | Asynq/Redis-first theo stack hiện tại; không thêm pgboss khi chưa có DEC mới |
| Provider routing | Gemini/Groq/Ollama/local rules sau Privacy Router |
| Failure mode | Fail-closed: flag lookup lỗi hoặc provider lỗi không block baseline workflow |
| Privacy audit | `ai_audit_log` lưu hash/redaction/provider/route, không lưu raw prompt |
| Simulation | `ai_simulations` là dry-run snapshot; apply yêu cầu human approval và không mutate core tables ở Phase 6 foundation |

## 1.2. Tech Stack Decision

| Layer | Công nghệ | Lý do chọn | Version |
|-------|----------|-----------|---------|
| **Backend Core** | **Go + Gin** | Hiệu năng cao (goroutine cho concurrency), memory thấp, compile-time type safety, phù hợp real-time GPS + queue. Gin: HTTP framework nhanh nhất Go, middleware chain rõ ràng | Go 1.22+, Gin 1.10.x |
| **VRP Solver** | Python + Google OR-Tools | OR-Tools là engine tốt nhất cho VRP, BRD yêu cầu rõ (US-TMS-01). Chạy như separate service, giao tiếp HTTP với Go backend | OR-Tools 9.x, Python 3.11 |
| **Web Frontend** | Next.js 14 (App Router) | SSR/SSG linh hoạt, TypeScript, ecosystem React mạnh | 14.x |
| **Mobile (Driver App)** | React Native (Expo) | Cross-platform iOS/Android, Expo EAS build & OTA update | SDK 51+ |
| **Database chính** | PostgreSQL 16 | ACID, JSONB, partitioning cho GPS (time-series), mature | 16.x |
| **Cache & Queue** | Redis 7 + **Asynq** | Asynq: Go-native Redis-based task queue (retry, DLQ, scheduled jobs, web UI). Cache ATP, pub/sub cho GPS | Redis 7.x, Asynq 0.24+ |
| **File Storage** | MinIO (dev/staging) / AWS S3 (prod) | Ảnh ePOD, checklist, vỏ hỏng. Pre-signed URL | - |
| **Real-time (GPS)** | **gorilla/websocket** + Redis pub/sub | Go-native WebSocket. Redis pub/sub cho multi-process broadcast | gorilla/websocket 1.5+ |
| **Distance Matrix** | **OSRM** (self-hosted) | Tính khoảng cách/thời gian cho VRP. Miễn phí, nhanh, chính xác. Thay thế Google Maps Distance Matrix API (tiết kiệm chi phí lớn) | OSRM 5.27+ |
| **Maps Display** | Google Maps Platform | Maps JS API cho web, Navigation SDK cho Driver App (chỉ hiển thị + routing) | - |
| **Zalo Integration** | Zalo OA API (ZNS) | Gửi tin nhắn xác nhận NPP (R13). BHL đăng ký Zalo OA | - |
| **Auth** | **JWT RS256** (Access + Refresh Token) | Asymmetric key: server giữ private key ký token, client chỉ có public key verify. An toàn hơn HS256 cho mobile | - |
| **API Style** | RESTful JSON | Đơn giản, dễ debug, tương thích Bravo & DMS | - |
| **Push Notification** | Firebase Cloud Messaging | Push cho Driver App (iOS + Android) | - |
| **DB Access** | **sqlc + pgx v5** | sqlc: generate Go code từ SQL — type-safe, không reflection, nhanh. pgx: PostgreSQL driver tốt nhất Go | sqlc 1.25+, pgx 5.x |
| **Migration** | golang-migrate | SQL migration files, CLI + Go library | 4.x |
| **Logging** | zerolog | Zero allocation JSON logger, nhanh nhất Go ecosystem | 1.33+ |
| **Metrics** | prometheus/client_golang | De facto standard, Gin middleware sẵn | - |
| **Tracing** | OpenTelemetry Go SDK | Vendor-neutral, export Tempo/Jaeger | 1.x |
| **Error Tracking** | Sentry (sentry-go) | Bắt panic, group errors, stack trace | - |
| **Container** | Docker + Docker Compose | Dev/staging nhất quán. Production: Docker trên VPS | - |
| **CI/CD** | GitHub Actions | Auto test + build + deploy staging. Manual deploy production | - |

## 1.3. Project Structure (Go)

```
/
├── cmd/
│   └── server/main.go              # Entry point, wire dependencies
├── internal/
│   ├── domain/                      # Shared types, interfaces, events
│   │   ├── order.go                 # Order entity + OrderService interface
│   │   ├── trip.go                  # Trip entity + TripService interface
│   │   ├── stock.go                 # Stock entities
│   │   └── events.go                # Internal event definitions
│   ├── oms/                         # OMS module
│   │   ├── handler.go               # Gin handlers (HTTP)
│   │   ├── service.go               # Business logic
│   │   ├── repository.go            # DB queries (sqlc generated)
│   │   └── queries/                 # SQL files for sqlc
│   ├── tms/                         # TMS module
│   ├── wms/                         # WMS module
│   ├── rec/                         # Reconciliation module
│   ├── notification/                # Internal notification engine
│   ├── integration/                 # Bravo, DMS, Zalo adapters
│   │   ├── bravo/
│   │   ├── dms/
│   │   └── zalo/
│   ├── auth/                        # JWT RS256 + RBAC
│   ├── gps/                         # WebSocket GPS gateway
│   └── middleware/                   # Gin middleware chain
├── pkg/                             # Shared utilities (không chứa business logic)
│   ├── config/                      # Viper config loading
│   ├── redis/                       # Redis client wrapper
│   ├── s3/                          # S3/MinIO upload helper
│   └── eventbus/                    # Internal event bus (Go channels)
├── vrp-solver/                      # Python VRP service (Docker riêng)
├── migrations/                      # SQL migration files
├── deploy/                          # Dockerfile, docker-compose, configs
├── web/                             # Next.js frontend
└── docs/                            # API docs, ADRs
```

**Module boundaries enforced bởi:**
- Go package visibility: lowercase = unexported (package-private)
- Modules chỉ import từ `domain` package cho interfaces
- Modules KHÔNG import trực tiếp từ nhau
- Giao tiếp qua interfaces hoặc internal event bus (Go channels + Redis pub/sub)

---

# 2. KIẾN TRÚC COMPONENT

## 2.1. Tổng quan các lớp

| Layer | Component | Mô tả |
|-------|----------|-------|
| Client | Web App (Next.js) | Back-office: Dispatcher, DVKH, Thủ kho, Kế toán, Admin, BGĐ |
| Client | Driver App (React Native) | Tài xế: offline-first, checklist, ePOD, thu tiền, thu vỏ |
| Client | NPP Portal (Web — Next.js page) | Trang xác nhận nhận hàng từ link Zalo, silent consent 24h |
| Client | PDA Scanner (Web-based PWA) | Quét mã vạch tại kho: nhập, picking, gate check, kiểm kê |
| API | API Gateway (Gin) | JWT RS256 validation, rate limiting, CORS, request logging, tracing |
| Core | OMS Module (Go) | Nhập đơn, ATP, gom/tách, hạn mức công nợ, mốc 16h |
| Core | TMS Module (Go) | Planning, trip management, GPS, ePOD, thu tiền |
| Core | WMS Module (Go) | Kho, FEFO/FIFO picking, gate check, tài sản quay vòng |
| Core | Reconciliation Module (Go) | Đối soát hàng-tiền-vỏ, discrepancy tickets, đóng sổ ngày |
| Core | Notification Module (Go) | Internal notifications (WebSocket + FCM), Zalo OA outbound |
| Service | VRP Solver (Python) | Google OR-Tools, nhận job qua HTTP, trả Trip list |
| Service | GPS Gateway (gorilla/websocket) | Nhận GPS từ Driver App, broadcast cho Dispatcher map via Redis pub/sub |
| Service | OSRM (Docker container) | Self-hosted routing engine cho distance matrix |
| Integration | Bravo Adapter (Go) | Đẩy kết quả giao/tiền/vỏ, nhận webhook xác nhận hạch toán |
| Integration | DMS Adapter (Go) | Đẩy trạng thái đơn hàng (một chiều) |
| Integration | Zalo OA Adapter (Go) | Gửi tin nhắn xác nhận NPP, xử lý callback link |
| Data | PostgreSQL | Primary database — transaction + master data |
| Data | Redis | Cache ATP, Asynq task queue, GPS pub/sub, latest GPS positions |
| Data | S3 / MinIO | Ảnh ePOD, checklist, vỏ hỏng |

## 2.2. OMS Module

**Vai trò:** Điểm vào duy nhất của đơn hàng. DVKH nhập đơn → ATP → hạn mức công nợ → gom/tách → đẩy DMS + tạo lệnh TMS/WMS. Hệ thống mới là Source of Truth.

| Sub-component | Trách nhiệm | Quy tắc BRD |
|--------------|-------------|-------------|
| `OrderHandler` | Gin handlers: CRUD đơn, query status | US-OMS-01 |
| `ATPService` | ATP real-time: tồn kho - committed - reserved. Cache Redis 30s | US-OMS-02 |
| `ConsolidationService` | Gom đơn: cùng tuyến + khung giờ + NPP → Shipment | US-OMS-03 |
| `SplitService` | Tách đơn: vượt tải, thiếu hàng | US-OMS-04 |
| `CreditLimitService` | Kiểm tra hạn mức công nợ từ **receivable_ledger nội bộ** (không chờ Bravo). Block → Approval | R15, US-OMS-07 |
| `DepositPolicyService` | Tính tiền cược vỏ theo loại sản phẩm | R14, US-OMS-05 |
| `OrderCutoffService` | Phân luồng trước/sau 16h. Mốc cutoff từ `system_configs` | R08, US-OMS-08 |
| `DMSSyncTask` | Asynq task: đẩy đơn confirmed sang DMS. Retry khi lỗi | US-OMS-06 |

**Transaction flow quan trọng (OMS):**
```
Begin TX (Serializable)
  → Check ATP (SELECT FOR UPDATE trên stock_quants)
  → Reserve stock (UPDATE stock_quants.reserved_qty)
  → Check credit limit (SELECT receivable_ledger SUM)
  → Create order (INSERT sales_orders + order_items)
  → IF credit exceeded → status = 'pending_approval'
  → ELSE → status = 'confirmed'
Commit TX
  → Enqueue Asynq task: sync DMS (async, ngoài TX)
```

## 2.3. TMS Module

**Vai trò:** Quản lý toàn bộ vòng đời vận tải: Shipment → VRP → Trip → GPS → ePOD → Thu tiền → Đối soát.

| Sub-component | Trách nhiệm | Ghi chú |
|--------------|-------------|---------|
| `PlanningService` | Nhóm Shipment → gọi VRP Solver HTTP → nhận Trip list → lưu DB | US-TMS-01. Timeout 120s |
| `VRPClient` | HTTP client gọi Python solver. Format input (vehicles, shipments, constraints). Sử dụng **OSRM** cho distance matrix | Tách riêng để swap engine |
| `ShuttleService` | Detect xe rỗng chiều về gần Đông Mai/HL → gợi ý shuttle | US-TMS-02 |
| `TripHandler` | CRUD Trip, assign xe/tài xế, duyệt kế hoạch | TMS-03 |
| `GPSGateway` | gorilla/websocket nhận GPS mỗi 30s. Publish Redis → broadcast Dispatcher. Update Redis hash `gps:latest:{vehicle_id}` | US-TMS-12 |
| `EPODService` | Xác nhận giao hàng: ảnh upload S3 (pre-signed URL), GPS arrival | US-TMS-13 |
| `PaymentService` | Ghi nhận thanh toán (cash/CK/credit). CK → Approval flow timeout. **Ghi `receivable_ledger`** khi chọn Công nợ | US-TMS-15, R03, R04 |
| `ReturnCollectionService` | Vỏ thu hồi từ Driver App → forward WMS | US-TMS-16, R02 |
| `DriverHandler` | REST API cho Driver App: nhận lệnh, submit checklist, ePOD, thu tiền/vỏ, sự cố | US-TMS-10~18 |
| `ZaloConfirmTask` | Asynq task: sau ePOD → gọi Zalo Adapter gửi link. Cron 5 phút scan auto-confirm 24h | R13 |

## 2.4. WMS Module

**Vai trò:** Quản lý kho: sơ đồ vị trí → nhập/xuất FEFO/FIFO → quét mã vạch → kiểm soát cổng → tài sản quay vòng.

| Sub-component | Trách nhiệm | Quy tắc |
|--------------|-------------|---------|
| `LocationService` | Sơ đồ kho: Kho → Zone → Aisle → Bin (LTREE hierarchy) | US-WMS-01 |
| `InboundService` | Nhập kho: tạo phiếu nhập, gán Batch/Lot/HSD, gợi ý vị trí FEFO | US-WMS-02 |
| `PickingService` | Pick List theo FEFO/FIFO. Cảnh báo scan sai lô | US-WMS-03, US-WMS-10 |
| `GateCheckService` | Kiểm đếm cổng: đối chiếu scan PDA vs phiếu xuất. **Block nếu sai lệch > 0** | R01, US-WMS-04 |
| `ExpiryAlertTask` | Asynq scheduled task hàng ngày: lô hàng cận date → notification | US-WMS-11 |
| `AssetLedgerService` | Sổ cái tài sản quay vòng theo NPP | US-WMS-20, US-WMS-21 |
| `ReturnInboundService` | Nhập vỏ phân xưởng: đếm thực tế vs Driver App khai, ghi chênh lệch | R02, US-WMS-22 |
| `CompensationService` | Bồi hoàn vỏ hỏng/mất theo đơn giá hiệu lực | R10, US-WMS-21b |

## 2.5. Reconciliation Module

| Sub-component | Trách nhiệm | Quy tắc |
|--------------|-------------|---------|
| `TripReconciler` | Khi Trip = Completed: so sánh hàng xuất vs giao vs tiền vs vỏ → ReconciliationRecord | US-REC-01 |
| `DiscrepancyService` | CRUD DiscrepancyTicket. Deadline T+1. Escalation cảnh báo | R06, US-REC-02 |
| `DailyCloseService` | Tổng hợp cuối ngày. Highlight sai lệch chưa đóng. Trigger Bravo sync | US-REC-03 |

## 2.6. Notification Module

| Sub-component | Trách nhiệm |
|--------------|-------------|
| `NotificationService` | Tạo notification record (DB) + push qua các kênh |
| `WebSocketHub` | gorilla/websocket hub cho Web back-office — real-time notification badge + toast |
| `FCMPusher` | Asynq task gửi push notification qua Firebase Cloud Messaging → Driver App |
| `ZaloSender` | Asynq task gửi tin nhắn Zalo OA → NPP (chỉ dùng cho xác nhận giao hàng) |

---

# 3. KIẾN TRÚC DỮ LIỆU

## 3.1. Chiến lược Database

| Database | Dùng cho | Lý do |
|----------|---------|-------|
| PostgreSQL (primary) | Transaction data, master data, business state | ACID, constraint, JSONB, partitioning |
| PostgreSQL (partitioned) | GPS location history | Partition theo tháng. 6 tháng online, archive 3 năm. ~200K rows/ngày |
| Redis (cache) | ATP tồn kho (TTL 30s), GPS latest positions, session, rate limit | Tốc độ cao, tự expire |
| Redis (Asynq queue) | Async tasks: push Bravo/DMS/Zalo, cron alerts, notification | Retry built-in, DLQ, web UI (Asynqmon) |
| S3 / MinIO | Ảnh: ePOD, checklist, vỏ hỏng | Pre-signed URL, không lưu binary trong PostgreSQL |

## 3.2. Core Tables (PostgreSQL)

Schema chi tiết (columns, indexes, FK) trong tài liệu Database Schema riêng. Dưới đây là danh sách tables chính.

### Master Data

| Table | Mô tả chính |
|-------|-------------|
| `products` | SKU, loại, trọng lượng, thể tích, hạn SD tiêu chuẩn |
| `customers` | Mã NPP, thông tin, addresses (JSONB array), zalo_uid, chính sách cược |
| `delivery_routes` | Tuyến cố định, danh sách điểm giao, loại (fixed/dynamic) |
| `vehicles` | Biển số, tải trọng kg + m³, loại (internal/hired), documents JSONB |
| `drivers` | Tài xế, bằng lái, trạng thái |
| `warehouses` | Kho, zones, bins (LTREE hierarchy) |
| `credit_limits` | Hạn mức công nợ NPP theo thời kỳ (from_date, to_date, amount) |
| `deposit_prices` | Đơn giá bồi hoàn vỏ theo thời kỳ (asset_type, price, from/to date) |
| `delivery_windows` | Khung giờ giao chuẩn (minutes, from_date, to_date) |
| `priority_rules` | Thứ tự ưu tiên xếp xe khi thiếu xe (Admin cấu hình, JSONB criteria) |
| `forbidden_zones` | Giờ cấm tải: zone, time range, vehicle_types[] |
| **`system_configs`** | **Key-value config chung** (CK timeout, GPS idle threshold, cutoff 16h, GPS interval, etc.). Columns: `key` UNIQUE, `value` JSONB, `description`, `updated_by`, `updated_at` |

### OMS

| Table | Mô tả chính |
|-------|-------------|
| `sales_orders` | Đơn hàng gốc. Status flow Draft → Completed. FK → customers |
| `order_items` | Chi tiết SKU/số lượng. FK → sales_orders, products |
| `shipments` | Lệnh vận chuyển (gom từ nhiều SO). FK → sales_orders |

### TMS

| Table | Mô tả chính |
|-------|-------------|
| `trips` | Chuyến xe. Status flow 15 bước. FK → vehicles, drivers |
| `trip_stops` | Điểm dừng, thứ tự, trạng thái, estimated_arrival |
| `delivery_attempts` | Lần giao hàng (giao lại không giới hạn). attempt_number, failure_reason. FK → trip_stops |
| `epods` | Xác nhận giao hàng: photo_urls[], GPS lat/lng, timestamp. FK → delivery_attempts |
| `payments` | Thu tiền/công nợ. type: cash/transfer/credit. FK → delivery_attempts |
| `gps_locations` | Partitioned by month. vehicle_id, lat, lng, speed, heading, recorded_at |

### WMS

| Table | Mô tả chính |
|-------|-------------|
| `stock_moves` | Phiếu nhập/xuất. type: inbound/outbound/transfer. FK → warehouses |
| `stock_quants` | Tồn kho thực tế: (product_id, lot_id, location_id, quantity, reserved_qty) |
| `lots` | Lô hàng: batch_number, production_date, expiry_date |
| `picking_orders` | Lệnh đóng hàng. FK → shipments |
| `gate_checks` | Biên bản kiểm đếm cổng. scanned_items JSONB vs expected_items. pass/fail |
| `asset_ledger` | Sổ cái tài sản quay vòng (vỏ) theo NPP. type: keg/ket/pallet, quantity, direction |
| `return_collections` | Vỏ thu hồi Driver App. condition: good/damaged, photo_url |

### Finance *(MỚI)*

| Table | Mô tả chính |
|-------|-------------|
| **`receivable_ledger`** | **Sổ công nợ tiền hàng theo NPP**. Columns: customer_id, order_id, payment_id, amount, type (debit=ghi nợ / credit=thu tiền), running_balance, bravo_sync_status, created_at. **Source of Truth cho credit check — không chờ Bravo sync** |

### Reconciliation

| Table | Mô tả chính |
|-------|-------------|
| `reconciliation_records` | Biên bản đối soát chuyến. status: reconciled/discrepancy |
| `discrepancy_tickets` | Hồ sơ sai lệch. type: goods/money/assets. deadline T+1. status: open/in_progress/closed |

### System

| Table | Mô tả chính |
|-------|-------------|
| `users` | User accounts, role, warehouse assignment |
| `notifications` | Thông báo nội bộ. user_id, type, title, body, data JSONB, read_at |
| **`devices`** | **FCM device tokens**. user_id, platform (ios/android), fcm_token, last_active_at |
| `audit_logs` | Mọi thao tác: user_id, action, entity, entity_id, old_data JSONB, new_data JSONB, ip, created_at. **Append-only** (INSERT only, no UPDATE/DELETE) |
| `zalo_confirmations` | Token gửi Zalo, trạng thái NPP response, auto-confirm timestamp |
| `integration_logs` | Log API call Bravo/DMS. queue, job_id, attempt, status, request/response JSONB |
| **`daily_kpi_snapshots`** | **Aggregated KPI theo ngày** (pre-computed). date, kpi_type, warehouse_id, value JSONB, computed_at. Dùng cho Dashboard (BRD §10) |

## 3.3. Index Strategy

| Table | Indexes | Lý do |
|-------|---------|-------|
| `sales_orders` | `(customer_id, status, created_at)`. Partial index: `status IN ('draft','confirmed','planned')` | Query active orders |
| `trips` | `(status, planned_date)`. `(vehicle_id, status)` | Kiểm tra xe rỗng |
| `stock_quants` | `(product_id, lot_id, location_id)` UNIQUE. `(product_id, warehouse_id)` | ATP calculation |
| `gps_locations` | Partition by month. `(vehicle_id, recorded_at DESC)` | GPS history query 3 tháng |
| `asset_ledger` | `(customer_id, asset_type, created_at)` | Công nợ vỏ nhanh |
| **`receivable_ledger`** | `(customer_id, created_at DESC)`. `(customer_id) WHERE bravo_sync_status = 'pending'` | Credit check + Bravo sync |
| `audit_logs` | Partition by month. `(entity, entity_id, created_at)` | Append-only, query audit trail |
| `discrepancy_tickets` | `(status, deadline)`. Partial: `status IN ('open','in_progress')` | T+1 deadline alerts |
| `notifications` | `(user_id, read_at)`. Partial: `read_at IS NULL` | Unread count |

---

# 4. KIẾN TRÚC API

## 4.1. Quy ước REST

| Quy ước | Chi tiết |
|---------|---------|
| Base URL | `https://api.bhl-ops.vn/v1` |
| Driver App URL | `https://api.bhl-ops.vn/v1/driver` (namespace riêng) |
| Content-Type | `application/json` |
| Authentication | Bearer JWT (RS256) trong `Authorization` header |
| Timestamp | ISO 8601 UTC: `2026-03-15T08:30:00Z`. **Lưu DB dạng `timestamptz`** |
| **Timezone policy** | Server xử lý UTC. Mọi business rule (cutoff 16h, delivery window, forbidden zone time) convert sang **Asia/Ho_Chi_Minh (UTC+7)** trước khi so sánh. Frontend luôn hiển thị giờ VN |
| Pagination | `?page=1&limit=20`. Response: `{ data: [], total, page, limit }` |
| Error format | `{ success: false, error: { code, message, details } }` |
| HTTP Status | 200, 201, 400, 401, 403, 404, 409, 422, 500 |
| Idempotency | POST requests có `Idempotency-Key` header |

## 4.2. Auth Flow (JWT RS256)

| Token | TTL | Storage | Mô tả |
|-------|-----|---------|-------|
| Access Token | 15 phút | Memory (Web) / SecureStore (Mobile) | JWT signed **RS256** (asymmetric). Payload: userId, role, permissions[], warehouseIds[] |
| Refresh Token | 7 ngày | HttpOnly Cookie (Web) / SecureStore (Mobile) | Opaque token lưu DB. Rotate mỗi lần refresh |
| Device Token (FCM) | Theo FCM | DB (`devices` table) | Push notification. Update khi app open |

**RS256 vs HS256:**
- RS256: Server ký bằng private key, client verify bằng public key. Private key KHÔNG bao giờ rời server.
- HS256: Shared secret — nếu lộ (decompile mobile), attacker tạo token giả.
- **Kết luận: RS256 bắt buộc cho hệ thống có mobile client.**

## 4.3. Endpoint Groups

| Group | Base Path | Ai dùng | Endpoints chính |
|-------|----------|---------|----------------|
| Auth | `/auth` | Tất cả | POST /login, POST /refresh, POST /logout |
| Orders | `/orders` | DVKH, Dispatcher, BGĐ | CRUD orders, GET atp, POST consolidate, POST split |
| Shipments | `/shipments` | DVKH, Dispatcher | GET list, POST approve |
| Planning | `/planning` | Dispatcher | POST run-vrp, GET suggestions, POST approve-plan, POST manual-adjust |
| Trips | `/trips` | Dispatcher, Đội trưởng | CRUD trips, GET active-map, POST assign, GET history |
| Driver | `/driver` | Tài xế | POST checklist, GET my-trip, POST epod, POST payment, POST return-collection, POST incident |
| Warehouse | `/warehouse` | Thủ kho, PDA | GET picking-orders, POST confirm-pick, POST gate-check, GET stock, POST inbound, POST barcode-scan |
| Returns | `/returns` | Phân xưởng | POST confirm-return-inbound, GET pending |
| Assets | `/assets` | DVKH, Kế toán | GET ledger-by-customer, GET outstanding |
| Reconciliation | `/reconciliation` | Kế toán | GET trip-summary, POST open-discrepancy, PUT close-discrepancy, GET daily-report |
| Vehicles | `/vehicles` | Đội trưởng, Admin | CRUD vehicles, GET available, GET maintenance |
| Notifications | `/notifications` | Tất cả | GET my, PUT mark-read, GET unread-count |
| Admin | `/admin` | Admin | Master data CRUD, system configs, RBAC |
| Reports | `/reports` | Dispatcher, Kế toán, BGĐ | GET kpi-*, GET dashboard-data |
| **NPP Confirm** | `/confirm/:token` | NPP (public) | GET → load trang, POST → submit xác nhận/sai lệch |
| **Bravo Webhook** | `/integrations/bravo/webhook` | Bravo (server-to-server) | POST → nhận xác nhận hạch toán. **Validate API key** |
| **App Version** | `/app/version` | Driver App | GET → { min_version, latest_version, force_update } |

## 4.4. WebSocket (GPS Tracking)

**Sử dụng gorilla/websocket + Redis pub/sub (thay vì Socket.IO):**

| Endpoint / Event | Hướng | Payload | Mô tả |
|-----------------|-------|---------|-------|
| `wss://api.bhl-ops.vn/ws/gps` | Driver App → Server | `{ vehicleId, lat, lng, speed, heading, ts }` | Tài xế gửi mỗi 30s |
| Redis channel `gps:broadcast` | Server → Redis → All instances | `{ vehicleId, lat, lng, status, stopIndex }` | Pub/sub cho multi-process |
| `wss://api.bhl-ops.vn/ws/dispatch` | Server → Dispatcher | `{ vehicleId, lat, lng, status }` | Dispatcher room nhận GPS update |
| `wss://api.bhl-ops.vn/ws/notifications` | Server → User | `{ type, title, body, data }` | Real-time notification cho Web |

**GPS latest position (Redis):**
```
Redis Hash: gps:latest:{vehicle_id}
Fields: lat, lng, speed, heading, status, stop_index, updated_at
TTL: 1 ngày (auto cleanup xe không hoạt động)
```
Dashboard query Redis hash cho tất cả xe → map render. **Không query PostgreSQL cho real-time map.**

## 4.5. File Upload Constraints

| Rule | Giá trị |
|------|---------|
| Max file size | 5 MB / ảnh |
| Accepted formats | JPEG, PNG |
| Max files / request | 5 |
| Client-side | Compress trước upload (max 1920px, quality 80%) |
| Upload flow | Client → GET pre-signed URL → upload trực tiếp S3 → gửi URL về server |
| URL access | Pre-signed URL TTL 1 giờ. Không public URL vĩnh viễn |

---

# 5. KIẾN TRÚC TÍCH HỢP

> ⚠️ **Nguyên tắc:** Mọi integration call đi qua **Asynq queue** (async). Không gọi external API trong request/response cycle. Retry 3 lần (1m, 5m, 15m). Failed → Dead Letter Queue → alert Admin.

## 5.1. Tích hợp Bravo (2 chiều)

### Chiều đi (Hệ thống mới → Bravo)

| Event trigger | Payload | Queue / Timing |
|--------------|---------|---------------|
| Trip stop: Delivered/Partial | orderId, deliveredQty[], timestamp | `bravo:delivery` — real-time sau ePOD |
| Payment confirmed | orderId, amount, type (cash/transfer/credit) | `bravo:payment` — real-time |
| Công nợ ghi nhận | orderId, amount, customerId | `bravo:credit` — real-time |
| Return inbound confirmed | customerId, assetType, goodQty, damagedQty, compensation | `bravo:return` — sau PX xác nhận |
| Gate Check passed | shipmentId, items[], exitTime | `bravo:outbound` — xe ra cổng |
| Daily close | Tổng hợp ngày: hàng/tiền/vỏ | `bravo:daily` — 23:00 mỗi ngày |

### Chiều về (Bravo → Hệ thống mới)

| Cơ chế | Dữ liệu | Xử lý |
|--------|---------|-------|
| Scheduled (02:00 hàng đêm) | Credit balance[] theo NPP | **Chỉ dùng để RECONCILE** với `receivable_ledger` nội bộ. Ghi chênh lệch nếu có |
| **Webhook** POST `/integrations/bravo/webhook` | { documentId, status: posted } | Validate API key → đánh dấu integration_log đã hạch toán |

### ⚠️ Chiến lược Credit Check (QUAN TRỌNG)

```
                    ┌─────────────────────┐
                    │   receivable_ledger  │  ← SOURCE OF TRUTH cho credit check
                    │   (internal DB)      │
                    └────────┬────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
     Ghi nhận ngay     Ghi nhận ngay    Reconcile đêm
     khi giao công nợ  khi thu tiền     02:00 với Bravo
```

- **KHÔNG chờ Bravo sync** để kiểm tra hạn mức công nợ
- `receivable_ledger` ghi DEBIT (khi giao hàng công nợ) và CREDIT (khi thu tiền) real-time
- OMS `CreditLimitService` query `SUM(amount) WHERE customer_id = X AND type = 'debit'` - `SUM(amount) WHERE customer_id = X AND type = 'credit'` = **Số dư nợ hiện tại**
- So sánh với `credit_limits.amount` → cho phép hoặc block
- Sync Bravo hàng đêm chỉ để **reconcile** — phát hiện chênh lệch, KHÔNG phải nguồn chính

### Xử lý lỗi Bravo

- Retry 3 lần: 1m, 5m, 15m (Asynq built-in)
- Sau 3 fail → Dead Letter Queue → alert Admin qua notification
- Admin UI: xem DLQ, re-process thủ công hoặc skip
- Log đầy đủ trong `integration_logs`

## 5.2. Tích hợp DMS (1 chiều)

| Event | Trạng thái push | Timing |
|-------|-----------------|--------|
| OMS: Order confirmed | Confirmed | Async |
| TMS: Trip assigned | Planned | Async |
| TMS: In-transit | In Delivery | Async |
| TMS: Delivery success | Delivered | Async |
| TMS: Delivery failed | Failed | Async |
| TMS: Re-delivery created | Re-delivery scheduled | Async |
| OMS: Order cancelled | Cancelled | Async |

## 5.3. Tích hợp Zalo OA

**Điều kiện:** BHL phải có Zalo OA xác thực + Zalo ZNS credentials.

| Bước | Action | Chi tiết |
|------|--------|---------|
| 1 | Trigger: Tài xế xác nhận ePOD | EPODService emit event `delivery:confirmed` |
| 2 | ZaloConfirmTask tạo unique token | UUID v4 + TTL 24h → lưu `zalo_confirmations` |
| 3 | Gọi Zalo ZNS API | Template message + link: `https://confirm.bhl-ops.vn/d/{token}` |
| 4 | NPP bấm link | GET `/confirm/:token` → Next.js NPP Portal page |
| 5a | NPP xác nhận đúng | POST `/confirm/:token` `{ status: confirmed }` |
| 5b | NPP báo sai lệch | POST `/confirm/:token` `{ status: disputed, items: [...] }` → tạo DiscrepancyTicket |
| 6 | Asynq cron mỗi 5 phút | Scan tokens hết 24h chưa phản hồi → auto-confirm (R13) |

## 5.4. Distance Matrix — OSRM

**Thay thế Google Maps Distance Matrix API cho VRP input:**

| Chức năng | Tool | Chi phí |
|-----------|------|---------|
| **Distance/duration matrix cho VRP** | **OSRM self-hosted** | **Miễn phí** |
| Map display (Web back-office) | Google Maps JS API | Theo Google pricing |
| Navigation (Driver App) | Google Maps Navigation SDK | Theo Google pricing |

OSRM deploy Docker, load OSM data Vietnam. API: `GET /table/v1/driving/{coordinates}` → trả distance + duration matrix.

**Ước tính tiết kiệm:** 1,000 đơn/ngày, mỗi solve cần ~50,000 origin-dest pairs → Google Maps Distance Matrix ~$250/ngày = **~$7,500/tháng**. OSRM = $0.

---

# 6. VRP SOLVER SERVICE (Python + OR-Tools)

Chạy như **separate Python service** (Docker container riêng). Go backend gọi HTTP `POST /solve`. Timeout 120 giây. Quá timeout → trả partial solution.

## 6.1. Input / Output Contract

### POST /solve — Request

| Field | Type | Mô tả | BRD |
|-------|------|-------|-----|
| `vehicles[]` | Array | id, capacity_kg, capacity_m3, start_location, available_from | US-TMS-01 |
| `shipments[]` | Array | id, weight_kg, volume_m3, delivery_location, time_window, service_time_min | US-TMS-01 |
| `distance_matrix` | 2D Array | **Pre-computed từ OSRM** (không gọi Google Maps trong solver) | - |
| `duration_matrix` | 2D Array | Pre-computed từ OSRM | - |
| `constraints.forbidden_zones[]` | Array | zone, from_time, to_time, vehicle_types[] | US-TMS-03 |
| `constraints.delivery_window_minutes` | Integer | Khung giờ chuẩn (default 60). Từ `delivery_windows` | R07 |
| `priority_rules[]` | Array | Ưu tiên khi thiếu xe (từ `priority_rules`) | R12 |
| `max_solve_time_seconds` | Integer | Timeout: 120s | - |

### Response

| Field | Mô tả |
|-------|-------|
| `trips[]` | Trip tối ưu: vehicle_id, stops[] theo thứ tự |
| `trips[].stops[]` | shipment_id, estimated_arrival, estimated_departure, cumulative_load |
| `trips[].total_distance_km` | Tổng quãng đường |
| `unassigned_shipments[]` | Không xếp được → Dispatcher xử lý thủ công |
| `solve_time_ms` | Thời gian solver chạy |

## 6.2. Constraints

| Loại | Ràng buộc | Xử lý |
|------|----------|-------|
| Hard | Tải trọng ≤ capacity_kg | Không xếp lên xe đó |
| Hard | Thể tích ≤ capacity_m3 | Tương tự |
| Hard | Giờ cấm tải | Điều chỉnh departure time |
| Hard | Khung giờ giao ± delivery_window_minutes | R07 |
| Soft | Tối thiểu tổng quãng đường | Hàm mục tiêu chính |
| Soft | Tối đa fill rate | Giảm xe rỗng |
| Soft | Minimize lateness | Penalty weight cấu hình |

## 6.3. Scaling cho cao điểm

- Ngày thường: 1 instance, solve 1,000 đơn trong < 120s
- **Cao điểm (Tết):** 3,000-5,000 đơn → chia batch theo kho (Hạ Long + Đông Mai chạy **parallel**)
- Asynq queue `vrp:solve` cho phép chạy **2-3 VRP worker instances** đồng thời
- Benchmark Phase 1 với 1,000 đơn + 100 xe giả lập

---

# 7. BẢO MẬT

## 7.1. Authentication & Authorization

| Tầng | Cơ chế | Chi tiết |
|------|--------|---------|
| API Gateway | JWT RS256 middleware | Verify signature bằng public key, check expiry. Attach user context |
| Route Guards | Gin middleware `RolesGuard` + `PermissionsGuard` | Kiểm tra role/permission từ JWT claims |
| Row-level | Scope filter trong Service | Tài xế chỉ thấy trip mình. Thủ kho chỉ thấy kho assigned |
| Driver App | Certificate pinning | Prevent MITM. Kết hợp JWT RS256 |
| NPP Confirm link | Unique token UUID v4, **single-use**, TTL 24h | Invalidate sau submit hoặc hết hạn |
| Bravo Webhook | API key validation | Header `X-Bravo-API-Key`. Whitelist source IP nếu có |

## 7.2. Data Security

- **HTTPS bắt buộc** tất cả API. HTTP → redirect 301 HTTPS
- Sensitive data (SĐT, số tiền): **không log raw** — mask trong audit_logs
- Ảnh ePOD/checklist: pre-signed URL **TTL 1 giờ**. Không public URL
- Database: connection pool với SSL. Credentials trong environment variables (không hardcode)
- **Audit trail:** append-only (`audit_logs` — chỉ INSERT, không UPDATE/DELETE). Implementation: Go middleware interceptor gọi trước/sau handler, serialize old/new data thành JSONB
- Passwords: bcrypt cost 12

## 7.3. NPP Portal Security

| Biện pháp | Chi tiết |
|-----------|---------|
| Token format | UUID v4 (random, không chứa thông tin) |
| Single-use | Token invalidate ngay sau submit |
| TTL | 24h — sau 24h auto-confirm, token expired |
| Rate limiting | 10 requests/phút per token (tránh brute-force) |
| CORS | Chỉ cho phép origin `https://confirm.bhl-ops.vn` |
| No auth required | Token trong URL là authentication (không cần login) |

## 7.4. RBAC — 10 Roles

| Role (code) | Mô tả | Quyền đặc biệt |
|-------------|-------|----------------|
| `admin` | Quản trị hệ thống | CRUD tất cả, cấu hình system_configs |
| `dvkh` | Dịch vụ khách hàng | Nhập đơn, xử lý đơn, xem chứng từ |
| `dispatcher` | Điều phối viên | Duyệt auto-planning, chỉnh kế hoạch, giám sát GPS |
| `fleet_manager` | Đội trưởng xe | Quản lý xe/tài xế, bảo trì |
| `driver` | Tài xế | Chỉ Driver App: checklist, ePOD, thu tiền, thu vỏ |
| `warehouse` | Thủ kho / Bốc xếp | Nhập/xuất kho, picking, PDA scan |
| `gate_guard` | Bảo vệ cổng | Gate check: scan PDA, pass/fail |
| `accountant` | Kế toán / Thủ quỹ | Xác nhận thu tiền, đối soát, **mở/đóng sai lệch**, duyệt công nợ |
| `workshop` | Phân xưởng | Nhập vỏ, xác nhận số lượng |
| `management` | Quản lý / BGĐ | Read-only dashboard/báo cáo, phê duyệt ngoại lệ |

---

# 8. HẠ TẦNG & TRIỂN KHAI

## 8.1. Môi trường

| Môi trường | Mục đích | Cấu hình |
|-----------|---------|---------|
| Development | Dev local, unit test, integration test | Docker Compose: Go app + PostgreSQL + Redis + MinIO + Python VRP + OSRM |
| Staging | UAT, demo, pilot 10-15 xe | 1 VM: 4 vCPU, 8GB RAM, 100GB SSD |
| **Production** | Go-live ~15/05 — 70 xe + 2 kho | **2 VM:** App (4 vCPU 8GB) + DB (8 vCPU 32GB 500GB SSD) |

> **Note:** Go binary compiled ~20MB, memory ~50-100MB runtime. Nhẹ hơn Node.js rất nhiều → App server 4 vCPU 8GB đủ cho production.

## 8.2. Docker Services

| Service | Image | Port | Scaling |
|---------|-------|------|---------|
| `app` (Go) | golang:1.22-alpine (build) → scratch (runtime). Single binary | 8080 | Vertical trước, horizontal sau |
| `vrp-solver` (Python) | python:3.11-slim + OR-Tools | 8090 (internal) | 1-3 instances theo peak demand |
| `osrm` | osrm/osrm-backend:latest | 5000 (internal) | 1 instance, pre-loaded Vietnam OSM |
| `postgres` | postgres:16-alpine | 5432 (internal) | 1 master, daily backup. Read replica sau |
| `redis` | redis:7-alpine | 6379 (internal) | Standalone. Sentinel cho HA sau Go-live |
| `minio` | minio/minio | 9000 (internal) | Single node. S3 cho managed |
| `nginx` | nginx:alpine. SSL termination, reverse proxy | 80, 443 | 1 instance |
| `asynqmon` | hibiken/asynqmon | 8081 (internal) | Monitor queues. Dev/staging only |

## 8.3. CI/CD Pipeline (GitHub Actions)

```
┌─── Push to branch ───┐
│  ① go vet + golangci-lint
│  ② go test ./... (unit + integration with testcontainers)
│  ③ sqlc verify (check SQL ↔ Go types)
│  ④ Build Docker image
└──────────────────────┘
         │
    ┌────┴────┐
    │ PR Merge │
    │ to main  │
    └────┬────┘
         │
    ┌────┴────────────────┐
    │ ⑤ Auto deploy Staging│
    │    (Docker push + SSH │
    │     docker-compose up)│
    └────┬────────────────┘
         │
    ┌────┴────────────────┐
    │ ⑥ Manual deploy Prod │
    │    (approval gate)    │
    └──────────────────────┘
```

## 8.4. Production Deploy Strategy

**Docker Compose + systemd:**
- Docker Compose service registered via systemd → auto-restart on reboot
- Health check endpoint: `GET /health` → 200 OK (check DB + Redis connection)
- Deploy: `docker-compose pull && docker-compose up -d --remove-orphans`
- **Zero-downtime deploy:** Go binary starts in < 1s. Docker health check waits for healthy before removing old container
- Rollback: `docker-compose up -d --force-recreate` with previous image tag

**Upgrade path (nếu cần):** Docker Compose → Docker Swarm (rolling update built-in, minimal overhead change).

## 8.5. Backup & Disaster Recovery

| Component | Strategy | RPO | RTO |
|-----------|---------|-----|-----|
| PostgreSQL | WAL archiving (continuous) + pg_dump daily 02:00 → S3 | < 15 phút (WAL) | < 1 giờ |
| Redis | RDB snapshot mỗi 5 phút + AOF | < 5 phút | < 15 phút (restart + replay) |
| S3/MinIO (ảnh) | MinIO versioning + cross-bucket replication | 0 (replicated) | < 30 phút |
| Backup retention | Daily: 30 ngày. Monthly: 12 tháng | - | - |
| Restore test | Monthly restore → staging, verify data integrity | - | - |

## 8.6. NFR Mapping

| BRD Requirement | Target | Giải pháp |
|----------------|--------|-----------|
| Availability 99.5% | ~44h downtime/năm | Go auto-restart (process < 1s startup), health check, alert. Maintenance đêm |
| API < 2s | P95 < 2s | PostgreSQL indexes, Redis ATP cache 30s, connection pooling (pgxpool) |
| Auto-planning < 2 phút | 1,000 đơn/ngày | OR-Tools timeout 120s. Pre-compute distance matrix via OSRM |
| Dashboard < 3s | P95 < 3s | `daily_kpi_snapshots` pre-aggregated. Redis GPS cache |
| Concurrency 50 web + 70 drivers | 120 concurrent | Go goroutines handle 10,000+ concurrent connections dễ dàng |
| Offline Driver App | 2h mất mạng | React Native + SQLite + sync queue |
| GPS 200K points/ngày | 30s × 70 xe × 12h | PostgreSQL partitioned + batch insert. Redis `gps:latest` cho real-time |
| Peak Tết 3x | 3,000 đơn | Stateless Go binary → horizontal scale. VRP parallel batch by warehouse |
| Data retention 5 năm | GPS 6 tháng, archive 3 năm | pg_partman + archive job hàng tháng → cold storage |

---

# 9. DRIVER APP — OFFLINE-FIRST ARCHITECTURE

Tài xế giao hàng khu vực ngoại thành, sóng kém. Hoạt động offline tối thiểu 2 giờ, tự sync khi có mạng.

## 9.1. Local Storage Strategy

| Dữ liệu | Storage | Sync | TTL |
|----------|---------|------|-----|
| Trip data | SQLite (Expo SQLite) | Tải khi nhận lệnh, re-fetch khi online | 1 ngày |
| Checklist answers | SQLite + queue | Submit online, queue offline → sync | - |
| ePOD (ảnh + xác nhận) | SQLite + file cache | Ảnh lưu local, batch upload. Resumable upload | Đến khi thành công |
| GPS locations | SQLite buffer | Batch gửi 10 points khi có mạng | Xóa sau server ACK |
| Payment records | SQLite + queue | FIFO queue → sync theo thứ tự | - |
| Return collection | SQLite + queue | Tương tự payment | - |

## 9.2. Sync Queue Logic

- Mọi action → ghi local DB trước → UI cập nhật ngay (optimistic update)
- Background service check kết nối mỗi 10 giây
- Có mạng → FIFO queue → gọi API → nhận response → reconcile local
- **Conflict resolution: Server wins** (server timestamp chuẩn). Thông báo tài xế nếu conflict
- Ảnh: resumable upload, tự tiếp tục từ byte đã upload

## 9.3. App Version Management

| Endpoint | Response | Logic |
|----------|---------|-------|
| `GET /app/version` | `{ min_version: "1.2.0", latest_version: "1.3.1", force_update: false }` | App check khi mở |

- `app_version < min_version` → **Force update**: block UI, redirect App Store / Play Store
- `app_version < latest_version` → Soft prompt: "Có bản cập nhật mới"
- Expo OTA (EAS Update) cho JS bundle changes → không cần qua store
- Native changes → store update bắt buộc → tăng `min_version`

---

# 10. PDA & BARCODE SCANNING

## 10.1. Thiết bị PDA

| Thông số | Giá trị |
|----------|---------|
| Device đề xuất | Zebra TC21/TC26 hoặc tương đương (Android Enterprise) |
| OS | Android 11+ |
| Scanner | Built-in laser/imager barcode scanner |
| Kết nối | WiFi trong kho (bắt buộc). 4G backup |
| Ứng dụng | **Web-based PWA** (cùng domain Web App) — không cần app riêng |
| Browser | Chrome Android |

## 10.2. Barcode Format

| Cấp độ | Format | Thông tin encode |
|--------|--------|-----------------|
| Vỏ bia hơi (Keg 2L/20L/30L/Bom) | **Code-128** | `BHL-{SKU_CODE}-{LOT_ID}` |
| Keg bia chai | Code-128 | `BHL-{SKU_CODE}-{LOT_ID}` |
| Thùng (carton) | Code-128 | `BHL-{SKU_CODE}-{LOT_ID}-{SEQ}` |

- Mã Code-128: phù hợp PDA industrial, error tolerance tốt, encode ký tự alphanumeric
- In tại khâu sản xuất, dán trước khi nhập kho
- PDA quét → gọi API `POST /warehouse/barcode-scan` → server tra cứu → trả thông tin sản phẩm + lô

## 10.3. Điểm quét

| Điểm | Mục đích | User | BRD |
|------|---------|------|-----|
| Nhập kho | Xác nhận nhập đúng SKU/Lô/SL → gán vị trí kho | Thủ kho | US-WMS-02 |
| Picking (xuất kho) | Đối chiếu pick đúng lô FEFO → cảnh báo sai lô | Thủ kho | US-WMS-03 |
| Gate Check (cổng) | Đối chiếu hàng trên xe vs phiếu xuất → **sai lệch = 0** | Bảo vệ + Kế toán | US-WMS-04, R01 |
| Kiểm kê (stocktake) | Quét toàn bộ vị trí kho → so sánh vs DB | Thủ kho | Inventory |

---

# 11. QUYẾT ĐỊNH THIẾT KẾ QUAN TRỌNG (ADR)

### ADR-01: Tại sao Modular Monolith thay vì Microservices?

| | |
|-|---|
| **Bối cảnh** | Deadline ~15/05/2026 (~2 tháng vibe coding). Team nhỏ. Tải ~1,000 đơn/ngày |
| **Quyết định** | Modular Monolith — 1 Go binary với package boundaries rõ ràng |
| **Lý do** | Microservices tốn 30-40% effort cho DevOps. Team nhỏ không đủ bandwidth |
| **Hệ quả** | Modules giao tiếp qua interface (không query DB chéo). Có thể extract service sau |

### ADR-02: Tại sao Go + Gin thay vì NestJS (Node.js)?

| | |
|-|---|
| **Bối cảnh** | Hệ thống cần xử lý real-time GPS (70 xe × 30s), async queue, concurrent requests |
| **Quyết định** | Go + Gin |
| **Lý do** | (1) Goroutine native concurrency — handle 10,000+ connections với memory thấp. (2) Compiled binary nhỏ (~20MB), startup < 1s, memory ~50MB vs Node.js ~200-500MB. (3) Type safety compile-time, không cần runtime type checking. (4) Gin benchmark: 50,000+ req/s vs Express 15,000 req/s. (5) Observability ecosystem mạnh (zerolog, prom-client, OTel native) |
| **Trade-off** | Go verbose hơn TypeScript. Không có decorator pattern như NestJS. Cần viết middleware/DI thủ công hơn |
| **Hệ quả** | Cần dev quen Go. DI manual (constructor injection). Middleware chain qua Gin `.Use()` |

### ADR-03: VRP Solver — Python service riêng

| | |
|-|---|
| **Quyết định** | Python microservice riêng. Go backend gọi HTTP. Queue job cho concurrent requests |
| **Lý do** | OR-Tools Python binding tốt nhất. Tách biệt compute-intensive solver khỏi API server |
| **Hệ quả** | 2 codebase (Go + Python). HTTP latency ~10ms — chấp nhận (VRP chạy async) |

### ADR-04: GPS từ điện thoại, không phần cứng gắn xe

| | |
|-|---|
| **Quyết định** | GPS từ React Native Geolocation API (điện thoại tài xế) |
| **Lý do** | Tiết kiệm phần cứng. Đủ chính xác cho dispatcher monitoring |
| **Hệ quả** | Phụ thuộc pin + app chạy. UX design tránh force-close |

### ADR-05: Async Integration — không gọi Bravo/DMS trong request cycle

| | |
|-|---|
| **Quyết định** | Asynq queue (Redis) cho tất cả integration calls |
| **Lý do** | External system down → nghiệp vụ vẫn chạy. DLQ đảm bảo không mất data |
| **Hệ quả** | Bravo data có thể lag vài phút. Kế toán cần biết |

### ADR-06: OSRM thay Google Maps Distance Matrix cho VRP

| | |
|-|---|
| **Quyết định** | Self-hosted OSRM cho distance/duration calculation. Google Maps chỉ cho display + navigation |
| **Lý do** | Google Maps Distance Matrix 1,000 đơn/ngày ≈ $7,500/tháng. OSRM = $0, accuracy tương đương cho VN roads |
| **Hệ quả** | Thêm 1 Docker service OSRM. Cần update OSM data Vietnam định kỳ (monthly) |

### ADR-07: Credit check dùng internal ledger thay vì Bravo sync

| | |
|-|---|
| **Quyết định** | `receivable_ledger` nội bộ là Source of Truth cho công nợ tiền hàng. Bravo sync đêm chỉ reconcile |
| **Lý do** | Bravo sync hàng đêm = data cũ 24h → credit check sai. Internal ledger ghi real-time |
| **Hệ quả** | Maintain sổ cái kép (internal + Bravo). Reconcile job phát hiện chênh lệch |

### ADR-08: JWT RS256 thay vì HS256

| | |
|-|---|
| **Quyết định** | RS256 (asymmetric) cho JWT signing |
| **Lý do** | HS256 shared secret lộ qua mobile decompile → attacker tạo token. RS256: private key chỉ trên server |
| **Hệ quả** | Key rotation: generate RSA key pair, store private key server-side (env var), public key có thể distribute |

---

# 12. RỦI RO KỸ THUẬT & GIẢM THIỂU

| Rủi ro | Mức | Giảm thiểu |
|--------|-----|-----------|
| Zalo OA API chưa được BHL đăng ký | 🔴 Cao | BHL đăng ký tuần 1. Nếu trễ → placeholder (skip Zalo, confirm thủ công) |
| VRP Solver không đủ nhanh cho 1,000 đơn/2 phút | 🟡 TB | Benchmark Phase 1. Nếu chậm: batch theo kho, parallel. OSRM pre-compute distance |
| Bravo API không đủ endpoint | 🟡 TB | Lấy API doc Phase 1. Fallback: file import CSV |
| Driver App offline sync conflict | 🟡 TB | Server-wins. Thiết kế kỹ offline queue Phase 2. Test airplane mode |
| GPS kém ngoại thành | 🟢 Thấp | Idle detection = distance threshold (không chỉ timer). Dispatcher tắt cảnh báo per-xe |
| Tải Tết gấp 3-5x | 🟡 TB | Load test 3,000 đơn trước Go-live. Scale-up plan VPS. VRP parallel |
| OR-Tools license | 🟢 Thấp | Apache 2.0 open source — free |
| OSRM data accuracy VN | 🟢 Thấp | OSM Vietnam data tốt cho road network chính. Update monthly |
| **Data migration từ hệ thống cũ** | 🟡 TB | Plan Phase 4: import master data (800 NPP, 70 xe, 30 SKU), số dư công nợ vỏ, credit balance từ Bravo |
| **Go ecosystem learning curve** | 🟡 TB | Go syntax đơn giản. Gin/sqlc/Asynq có doc tốt. Vibe coding hỗ trợ generate code nhanh |

---

# 13. OBSERVABILITY STACK

## 13.1. Ba trụ cột Observability

| Pillar | Tool | BRD Reference |
|--------|------|--------------|
| Logs (Structured) | zerolog → Loki | §8.2 audit trail, §9.3 approval flows |
| Metrics (Time-series) | Prometheus | §12.2 NFR targets |
| Traces (Distributed) | OTel → Tempo | §12.2 API < 2s |
| Errors | Sentry | §12.2 uptime 99.5% |

**Nguyên tắc:** Mỗi log entry, metric, trace span mang chung `traceID`. Alert → traceID → log → trace → xác định function/query chậm. Không SSH debug.

## 13.2. Go + Gin Middleware Chain

```go
r := gin.New()  // Không dùng gin.Default()
r.Use(
    middleware.RequestID(),         // 1. Sinh traceID → context + header X-Trace-Id
    middleware.SentryRecovery(),    // 2. Recover panic → Sentry, trả 500 JSON
    middleware.OTelTracing(),       // 3. Start OTel span, inject traceID
    middleware.PrometheusMetrics(), // 4. Đo duration, đếm status codes
    middleware.ZerologLogger(),    // 5. Log request/response với traceID
)
```

## 13.3. Log Format (zerolog JSON)

```json
{
  "time": "2026-03-15T08:30:00.123Z",
  "level": "info",
  "service": "tms",
  "traceId": "4bf92f3577b34da6",
  "spanId": "00f067aa0ba902b7",
  "userId": "driver-042",
  "requestId": "req-7a3f...",
  "msg": "epod confirmed",
  "tripId": "trip-2026-1234",
  "orderId": "so-98765",
  "durationMs": 145
}
```

**Business context fields bắt buộc:**

| Module | Fields | BRD |
|--------|--------|-----|
| OMS | orderId, customerId, orderStatus, atpResult | §4.3 |
| TMS Planning | tripId, vehicleId, shipmentCount, solveTimeMs | §5.5, US-TMS-01 |
| TMS Driver | tripId, stopId, driverId, deliveryStatus, paymentType | §5.3, US-TMS-13~17 |
| WMS | warehouseId, skuId, lotId, locationId, quantity | §6, US-WMS-03~04 |
| Reconciliation | tripId, discrepancyType, amount, deadline | §7, REC-01~02 |
| Integration | queue, jobId, attempt, externalRef, httpStatus | §8.2 |

## 13.4. Prometheus Metrics

| Metric | Type | Labels | Alert | NFR |
|--------|------|--------|-------|-----|
| `http_request_duration_seconds` | Histogram | method, route, status | P95 > 2s → PAGE | API < 2s |
| `http_requests_total` | Counter | method, route, status | 5xx > 1% → WARN | uptime 99.5% |
| `vrp_solver_duration_seconds` | Histogram | status | P95 > 120s → PAGE | planning < 2m |
| `vrp_shipments_unassigned_total` | Counter | reason | Any → NOTIFY | US-TMS-01 |
| `gps_events_received_total` | Counter | vehicle_id | Drop > 30% → WARN | US-TMS-12 |
| `gps_processing_lag_seconds` | Gauge | – | > 60s → WARN | Real-time map |
| `integration_queue_depth` | Gauge | queue | > 50 → PAGE | §8.2 DLQ |
| `integration_dlq_total` | Counter | queue | Any → PAGE | §8.2 |
| `atp_cache_hit_ratio` | Gauge | warehouse_id | < 0.8 → WARN | US-OMS-02 |
| `db_query_duration_seconds` | Histogram | query_name | P95 > 500ms → WARN | API < 2s |
| `trips_active_total` | Gauge | status | Info | Dashboard |
| `delivery_attempts_total` | Counter | status | Failed spike → NOTIFY | TMS-05 |
| `discrepancy_tickets_open` | Gauge | type | > 0 at 23:00 → WARN | T+1 deadline |
| `receivable_balance_total` | Gauge | – | Info | Công nợ monitoring |

## 13.5. Alert Routing

| Severity | Kênh | Response |
|----------|------|---------|
| **PAGE** (Critical) | PagerDuty + SMS | < 15 phút |
| **WARN** (Warning) | Slack #ops-alerts | < 1 giờ |
| **NOTIFY** (Business) | Slack #biz-alerts + Web notification | Ca làm việc |
| **INFO** | Grafana dashboard | Không cần action |

## 13.6. Grafana Dashboards

| Dashboard | Audience | Key panels |
|-----------|---------|-----------|
| Fleet Operations | Điều phối, BGĐ | Map GPS, Trip pipeline, Delivery hôm nay, Xe dừng bất thường |
| Business KPIs (BRD §10) | BGĐ | OTD %, Empty run %, Re-delivery count, Công nợ, Vỏ, T+1 compliance |
| System Health | Dev, DevOps | API latency P50/P95/P99, Error rate, VRP duration, Queue depth, DB latency, Redis hit rate |
| Reconciliation | Kế toán | Trips reconciled, Open discrepancy, T+1 deadline, Cash collected vs expected |

## 13.7. Docker Compose — Observability

| Service | Image | Port | Volume |
|---------|-------|------|--------|
| `otel-collector` | otel/opentelemetry-collector-contrib | 4317, 4318 | otel-config.yaml |
| `loki` | grafana/loki | 3100 | loki-data (30 ngày retention) |
| `prometheus` | prom/prometheus | 9090 | prometheus-data (90 ngày) |
| `tempo` | grafana/tempo | 3200 | tempo-data (7 ngày) |
| `grafana` | grafana/grafana | 3000 | grafana-data + dashboards/*.json |
| `alertmanager` | prom/alertmanager | 9093 | alertmanager.yml |

Tổng RAM observability: ~2.5GB (Loki 512MB, Prometheus 1GB, Tempo 512MB, Grafana 256MB, OTel 128MB).

## 13.8. Sampling Strategy

| Môi trường | Strategy | Lý do |
|-----------|---------|-------|
| Dev/Staging | 100% traces | Debug thoải mái |
| Production | 100% (Go-live) | ~1,000 trips/ngày, 1.4GB/7 ngày chấp nhận |
| Production (Tết) | Tail-based 20%: 100% errors + slow > 2s, random 20% rest | Giảm storage 5× |

---

# 14. BƯỚC TIẾP THEO

| # | Việc cần làm | Owner | Sprint |
|---|-------------|-------|--------|
| 1 | ❗ Review SAD v2.0 + confirm tech stack Go + Gin với BHL | Lead Dev + PM | Phase 1 tuần 1 |
| 2 | ❗ BHL đăng ký Zalo OA + lấy ZNS credentials | BHL IT | Phase 1 tuần 1 (cần trước Phase 3) |
| 3 | ❗ Lấy Bravo API doc + setup sandbox | BHL IT + Dev | Phase 1 tuần 1 (cần trước Phase 3) |
| 4 | ❗ Lấy DMS API doc + sandbox | BHL IT + Dev | Phase 1 tuần 1 (cần trước Phase 3) |
| 5 | Setup môi trường Dev: Docker Compose all services | Lead Dev | Phase 1 ngày 1 |
| 6 | Setup GitHub repo + CI/CD pipeline | Lead Dev | Phase 1 ngày 1 |
| 7 | Thiết kế Database Schema chi tiết (②) | Lead Dev + BA | Phase 1 |
| 8 | Thiết kế API Contract đầy đủ (③) | Lead Dev + BA | Phase 1 |
| 9 | Wireframes Dispatcher + Driver App (④) | UX + Lead Dev | Phase 1 |
| 10 | Benchmark VRP Solver: 1,000 đơn/100 xe + OSRM distance | Dev VRP | Phase 1 |
| 11 | Setup OSRM Docker + load Vietnam OSM data | DevOps | Phase 1 |
| 12 | PDA selection + barcode format confirmation với BHL | BA + BHL | Phase 1 |
| 13 | Mua/thuê PDA devices cho staging test | PM + BHL | Phase 2 |
| 14 | **Data migration plan:** Chuẩn bị import 800 NPP, 70 xe, 30 SKU, 500 tuyến, số dư công nợ | BA + Dev | Phase 4 |
| 15 | **Load test:** 3,000 đơn giả lập (Tết scenario) | QA + Dev | Phase 4 |
| 16 | **Backup/DR drill:** Restore PostgreSQL staging + verify | DevOps | Phase 4 |

---

## PHỤ LỤC: Sprint Plan — Vibe Coding Accelerated (High-level)

> ⚡ **Vibe Coding Acceleration:** AI-assisted code generation giúp viết CRUD, API, frontend, migration nhanh 5-10× so với manual coding. Timeline rút từ 14 tuần → 8 tuần. **Bottleneck thực tế không còn là code** mà là:
> - BHL cung cấp: Bravo API doc, DMS API doc, Zalo OA credentials, xác nhận PDA
> - UAT với dispatcher + tài xế + NPP thực tế
> - Data migration từ hệ thống cũ (800 NPP, 70 xe, số dư công nợ)
> - VRP benchmark với dữ liệu thực

| Phase | Tuần | Focus | Ghi chú Vibe Coding |
|-------|------|-------|---------------------|
| **Phase 1** (2 tuần) | T4 W1-2 | Project setup, DB schema, Auth (RS256), CI/CD, OMS core (CRUD + ATP), TMS planning (VRP + OSRM), GPS tracking (WebSocket) | AI gen toàn bộ CRUD + migration + auth middleware. VRP benchmark song song |
| **Phase 2** (2 tuần) | T4 W3-4 | WMS (picking, gate check, PDA scan), Driver App MVP (checklist, ePOD, payment, returns), Trip delivery flow, Offline sync | AI gen components + screens. Offline sync cần test thủ công kỹ |
| **Phase 3** (2 tuần) | T5 W1-2 | Reconciliation module, Asset ledger, Credit limit, Bravo integration, DMS sync, Zalo integration, Notifications, Reports/Dashboard | ⚠️ **Blocker nếu BHL chưa cấp API doc/credentials Sprint 1** |
| **Phase 4** (2 tuần) | T5 W3-4 | UAT (dispatcher + tài xế + NPP), Data migration, Load test 3,000 đơn, Bug fix, Go-live preparation | Không thể rút ngắn — cần người dùng thật |
| **Go-live** | ~15/05/2026 | Production deploy + monitoring | Sớm hơn 5-6 tuần so với plan cũ |

> 📌 **Rủi ro chính:** Nếu BHL chậm cấp Bravo API doc + Zalo OA credentials → Phase 3 bị block → toàn bộ plan dịch phải. Cần yêu cầu BHL commit deadline cung cấp trong Phase 1.

---

**=== HẾT TÀI LIỆU SAD v2.1 (Vibe Coding Accelerated) ===**

*Phiên bản 2.1 — Go + Gin backend, tích hợp 24 điểm review từ v1.0. Timeline rút 8 tuần cho vibe coding. Sẵn sàng cho review kỹ thuật và Phase 1.*
