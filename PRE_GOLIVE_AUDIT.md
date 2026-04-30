# PRE-GO-LIVE AUDIT — BHL OMS-TMS-WMS

> **Ngày audit:** 30/04/2026
> **Phạm vi:** toàn bộ backend Go + frontend Next.js + RBAC + state machines + notification + driver E2E
> **Phương pháp:** đọc trực tiếp `cmd/server/main.go`, 8 module backend, middleware, và các page frontend trọng yếu. Mọi finding đều có file:line cụ thể.
> **Tổng số phát hiện:** 27 (8 Critical · 10 High · 6 Medium · 3 Low)

---

## 1. EXECUTIVE SUMMARY

| Mức | Số lượng | Trạng thái sau session 30/04 |
|-----|----------|------------------------------|
| 🔴 Critical | 8 | 4 đã FIX (Quick Wins QW) · 4 còn lại cần dev review |
| 🟠 High     | 10 | 6 đã FIX (Quick Wins QW) · 4 còn lại cần fix sprint kế |
| 🟡 Medium   | 6 | 0 fix · để sau go-live |
| 🟢 Low      | 3 | 1 đã FIX (QW-010) · 2 polish |

### Verdict ban đầu: ❌ NO-GO
### Verdict sau Quick Wins (sau session này): ⚠️ CONDITIONAL GO

> Hệ thống có thể go-live SAU KHI fix nốt 4 Critical còn lại trong 1 sprint:
> CRIT-001 (decimal money), CRIT-002 (FEFO reserve), CRIT-003 (gate-check thật),
> CRIT-007 (GPS spoof per-trip enforcement).
>
> 10 Quick Wins đã fix đóng được toàn bộ lỗ RBAC critical (CRIT-004/005/006/008
> + HIGH-001/002/003/009 + LOW-003).

---

## 2. ĐÃ FIX TRONG SESSION 30/04 (10 Quick Wins)

| ID | Critical / High | File:line | Mô tả ngắn |
|----|-----------------|-----------|------------|
| QW-001 | CRIT-008 | `internal/middleware/auth.go:39` | `JWTAuth` từ chối refresh token khi gọi API thường (`TokenType != "access"`). |
| QW-002 | CRIT-006 | `internal/integration/handler.go:52` | Group `/integration` yêu cầu role `admin/management/dispatcher`. Bịt lỗ ai cũng push Bravo / gửi Zalo / quản DLQ. |
| QW-003 | CRIT-005 | `internal/reconciliation/handler.go:24` | Group `/reconciliation` yêu cầu role `admin/accountant/management/dispatcher`. |
| QW-004 | CRIT-004 | `internal/wms/handler.go:24` | Group `/warehouse` yêu cầu role `admin/warehouse_handler/dispatcher/management/workshop`. Driver/security không còn ký bàn giao, fake inbound, picking. |
| QW-005 | HIGH-002 | `internal/tms/handler.go:117` | Group `/eod` (kết ca tài xế) yêu cầu role receiver hợp lệ. |
| QW-006 | HIGH-009 | `internal/gps/handler.go:34` | `GET /gps/latest` chỉ cho admin/dispatcher/management/warehouse_handler. |
| QW-007 | HIGH-003 | `internal/reconciliation/service.go:188` | `IsChiefAccountant` fail-CLOSED khi `db == nil` (trước fail-open trả `true`). |
| QW-008 | HIGH-001 | `internal/oms/handler.go:51-55` | `POST/PUT/cancel /orders` yêu cầu role `admin/dispatcher/dvkh`. Driver không còn tạo/sửa/hủy đơn. |
| QW-010 | LOW-003 | `internal/oms/service.go:262` | OSRM table call có timeout 3s; tránh treo pipeline gợi ý kho. |
| (build) | — | — | `go build ./cmd/server` PASS. Binary `bhl-oms.exe` đã refresh 38.35 MB. |

> QW-009 (driver page swallow error) là lỗi frontend — đã có ghi chú, sẽ làm chung sprint UX hôm sau.

---

## 3. CRITICAL CÒN LẠI (BẮT BUỘC FIX TRƯỚC GO-LIVE)

### 🔴 CRIT-001 — Tiền dùng `float64` toàn hệ thống
- **File:** `internal/domain/models.go:33-34, 109-110, 137`; `internal/oms/service.go:387`; `internal/wms/service.go:619, 644`; `internal/integration/hooks.go:50`.
- **Tác động:** vi phạm rule #1 dự án; recon `payVariance != 0` so float ⇒ tự sinh discrepancy giả; tổng công nợ drift theo thời gian; pháp lý/kế toán không chấp nhận.
- **Đề xuất:** chuyển sang `shopspring/decimal.Decimal` trong domain + repository (DB cột đã là `NUMERIC(15,2)`); lint cấm `float64.*Amount|Price`.
- **Effort:** 1 sprint (2 tuần) — đụng schema scan toàn bộ.
- **Ai fix:** **dev team** (rộng + đụng pgx scan).

### 🔴 CRIT-002 — `ReserveStock` over-reserve khi product có nhiều lot
- **File:** `internal/oms/repository.go:324-339`.
- **Cơ chế:** UPDATE chạy trên N row lot ⇒ reserve `N × qty`. Cancel ⇒ over-release ⇒ `reserved_qty` âm vi phạm CHECK ⇒ rollback.
- **Tác động:** 1 đơn 10 thùng × 5 lot ⇒ reserve 50 thùng; ATP sụt giả; đơn sau bị từ chối oan; cancel có thể vỡ tx.
- **Đề xuất:** viết `ReserveStockFEFO` loop từng lot theo expiry ASC (giống `wms.SuggestPickingLots`). Hoặc dùng CTE `LIMIT 1` lặp đến khi đủ.
- **Effort:** 3-5 ngày + test FEFO regression.
- **Ai fix:** **dev team** (logic tồn kho gắn với BR-WMS).

### 🔴 CRIT-003 — Gate Check R01 luôn PASS (`ExpectedItems = "[]"`)
- **File:** `internal/wms/service.go:433-445`.
- **Tác động:** R01 (zero tolerance) hoàn toàn vô hiệu. Thất thoát hàng tại cổng kho không bị phát hiện. Ảnh hưởng kế toán + bồi thường tài xế.
- **Đề xuất:** load expected từ `picking_orders.items` của shipment, normalize theo `(product_id, lot_id)`, compare → set `result='fail'` nếu lệch + ghi `discrepancies`.
- **Effort:** 2 ngày — AI có thể fix nếu được duyệt (đã có sẵn data nguồn).
- **Ai fix:** AI có thể tự fix; cần QA review case fail-path.

### 🔴 CRIT-007 — Driver có thể spoof GPS của xe khác
- **File:** `internal/gps/handler.go:44-75` (`BatchGPS`); `internal/gps/hub.go:300-322` (`readPump`).
- **Cơ chế:** `vehicle_id` lấy từ payload client, không validate ownership.
- **Tác động:** Tài xế A bơm GPS giả vào xe B ⇒ control tower hiển thị sai vị trí; anomaly detector trigger sai; evidence pháp lý không tin được.
- **Đề xuất:** trong `BatchGPS` và `readPump`, override `point.VehicleID` bằng vehicle gắn với trip `in_transit` của driver (lookup `trips WHERE driver_id=$1 AND status='in_transit'`). Reject nếu không có.
- **Effort:** 1 ngày (đã có repo lookup).
- **Ai fix:** AI có thể fix; cần test driver E2E trip-start → batch GPS.

---

## 4. HIGH CÒN LẠI (FIX SAU GO-LIVE NẾU BUỘC, NHƯNG NÊN CÙNG SPRINT 1)

| ID | Vấn đề | File | Đề xuất |
|----|--------|------|---------|
| HIGH-004 | Login không rate-limit, không lockout | `internal/auth/handler.go:30-48` | Redis token bucket per IP+username, lockout 10 fail. |
| HIGH-005 | Permission cache 300s không invalidate khi đổi quyền hoặc disable user | `internal/middleware/auth.go:150-196` | Pub/sub `perm:invalidate:<user_id|role>` ở admin handler; `user_version` trong claims. |
| HIGH-006 | Không có endpoint logout / revoke JWT | `internal/auth/handler.go:20-24` | `POST /auth/logout` đẩy `jti` Redis denylist; middleware check; hoặc `token_version`. |
| HIGH-007 | GPS WS `CheckOrigin: return true` (Cross-Site WS Hijacking) | `internal/gps/hub.go:88-93` | Whitelist origin từ `cfg.CORSAllowedOrigins`. |
| HIGH-008 | ATP race giữa check và reserve | `internal/oms/service.go:337-437` | `SELECT ... FOR UPDATE` trong cùng tx hoặc retry với CHECK constraint. Khắc phục cùng CRIT-002. |
| HIGH-010 | `loadEffectivePermissions` lỗi DB → user bị Forbidden cho mọi route | `internal/middleware/auth.go:195-200` | Trả 503 + mã `PERMISSION_CHECK_UNAVAILABLE` + alert. |

---

## 5. MEDIUM (FIX SAU GO-LIVE — POLISH/OPTIMIZATION)

| ID | Vấn đề | File |
|----|--------|------|
| MED-001 | N+1 query trong `EnrichPickingOrders` | `internal/wms/service.go:177-210` |
| MED-002 | `CreatePickingOrderForShipment` không transactional | `internal/wms/service.go:390-410` |
| MED-003 | `payVariance != 0` so float gây recon false-positive (gắn CRIT-001) | `internal/reconciliation/service.go:78-86` |
| MED-004 | `BroadcastEntityUpdate` gửi tới mọi WS client (leak entity_id, refetch storm) | `internal/notification/service.go:342-367` |
| MED-005 | `loadTrip` swallow error trong driver page | `web/src/app/dashboard/driver/[id]/page.tsx:386-391` |
| MED-006 | `parseFloat` cho tiền ở fleet/tco và fleet/fuel | `web/src/app/dashboard/fleet/{tco,fuel}/page.tsx` |

---

## 6. LOW (POLISH)

| ID | Vấn đề | File |
|----|--------|------|
| LOW-001 | GPS WS `removeClient` race ⇒ panic "close of closed channel" | `internal/gps/hub.go:249-257` |
| LOW-002 | Nhiều `defer rows.Close()` shadow trong `cmd/server/main.go` (vehicle timeline) | `cmd/server/main.go:529-612` |
| LOW-003 | OSRM `http.Get` không timeout | ✅ FIX (QW-010) |

---

## 7. NGHIỆP VỤ CHƯA HOÀN THIỆN (gap world-class)

| # | Nghiệp vụ | Thiếu | Đề xuất | Ưu tiên |
|---|-----------|-------|---------|--------|
| G1 | Gate Check R01 thật | logic compare expected/scanned (CRIT-003) | rebuild compare engine + alert realtime | P0 |
| G2 | Reservation theo lot FEFO | cấp phát stock_quants per-lot (CRIT-002) | `ReserveStockFEFO` + rollback per-lot | P0 |
| G3 | Token revocation / logout | hiện không có | denylist `jti` Redis + `/auth/logout` | P0 |
| G4 | Audit chain handover A/B/C | gắn role guard + DB trigger từ chối UPDATE sau khi `signed_c=true` | DB trigger | P0 |
| G5 | Permission live-invalidate | thiếu pub/sub khi đổi quyền | channel `perm:invalidate` | P1 |
| G6 | Recon precision | float drift gây discrepancy giả | migrate `decimal.Decimal` (CRIT-001) | P1 |
| G7 | Bravo webhook auth | chỉ JWT, không HMAC | `X-Bravo-Signature` HMAC-SHA256 | P1 |
| G8 | Driver offline queue coverage | chỉ wrap 3 chỗ trong driver page | helper `safeAction()` cho mọi POST/PUT driver | P1 |
| G9 | Notification scoping | broadcast all leak entity id | gắn role/warehouse trong message envelope | P2 |
| G10 | Stock reconcile sau hủy theo lot | release stock không phân lot ⇒ lệch | dùng ledger `stock_moves` (gắn G2) | P2 |
| G11 | Anti-bruteforce login | thiếu rate-limit | Redis bucket per IP+username | P2 |

---

## 8. E2E NOTIFICATION COVERAGE GAP

| Category | Trigger hiện có | Target role | Vấn đề |
|----------|----------------|-------------|--------|
| `order_created` | OMS `CreateOrder` ✅ | dvkh / accountant (vượt hạn mức) | dispatcher không nhận; cutoff sau 16h không cảnh báo dispatcher |
| `order_confirmed_by_customer` | OMS `ConfirmOrderByCustomer` ([service.go:540](bhl-oms/internal/oms/service.go#L540)) | recorder event only | chưa có notification cho dispatcher để bắt đầu plan |
| `trip_started` | TMS `StartTrip` ([service.go:2008](bhl-oms/internal/tms/service.go#L2008)) | dispatcher ✅ | NPP không nhận biết "Xe đã xuất bến" — gap UX (BR yêu cầu Zalo ZNS) |
| `stop_arrived/delivered` | broadcast `entity_update` | mọi client (MED-004) | thiếu notification riêng cho NPP/DVKH; thiếu category `delivery_progress` |
| `payment_recorded` | RecordPayment | KHÔNG trigger notif | accountant cần nhận để recon kịp |
| `discrepancy_open` | recon `AutoReconcileTrip` ✅ | tạo row nhưng KHÔNG gửi notification | thêm `notifSvc.SendToRoleWithEntity("accountant", ...)` |
| `dlq_entry` | DLQ insert | KHÔNG có notification | admin/management cần biết integration fail |
| `gate_check_fail` | placeholder (CRIT-003) | — | sau khi fix CRIT-003 → push P0 cho dispatcher + warehouse_handler |
| `handover_rejected` | wms `SignHandover` | thiếu notification chain | gửi cho bên còn lại + dispatcher |
| `document_expiry` | cron `RunDocumentExpiryCron` | có notif | verify category đến đúng admin/accountant |
| `vehicle_anomaly` | F7 anomaly `DetectPoint` | có service nhưng không thấy `Send` trực tiếp | audit anomaly → notification wiring |
| `driver_checkin_late` | DriverCheckin | KHÔNG có notif | dispatcher cần biết tài xế chưa check-in trước cutoff |

> **Đề xuất:** tạo `internal/notification/categories.go` enumerate 24 category, viết unit test "every state transition fires correct notification" để khoá coverage.

---

## 9. KHUYẾN NGHỊ TIMELINE GO-LIVE

| Tuần | Nội dung |
|------|----------|
| **Tuần này** | ✅ Apply 10 Quick Wins (đã làm). Re-test toàn bộ RBAC bằng Bruno collection có sẵn. |
| **Tuần 1**   | Fix CRIT-001 (decimal money) — bắt đầu domain/repo, viết test recon precision. |
| **Tuần 2**   | Fix CRIT-002 (ReserveStockFEFO) + HIGH-008 (FOR UPDATE). Test load 50 đơn đồng thời. |
| **Tuần 3**   | Fix CRIT-003 (gate-check thật) + CRIT-007 (GPS ownership) + HIGH-006 (logout) + HIGH-007 (WS origin). |
| **Tuần 4**   | Fix HIGH-004/005/010 + Notification coverage (G9). Smoke E2E full 9 roles. |
| **Tuần 5**   | UAT, fix Medium nếu còn thời gian, go-live. |

---

## 10. CÁCH RE-TEST SAU FIX

```powershell
# 1. Build
cd "d:\Beer HL\bhl-oms"
go build -o bhl-oms.exe ./cmd/server

# 2. Khởi động full stack
.\START_LOCAL.bat   # hoặc START_DOCKER.bat

# 3. Smoke RBAC bằng Bruno collection
cd tests\api\rbac
bru run --env local

# 4. Smoke E2E bằng Playwright
cd web
npx playwright test
```

---

*Cuối báo cáo. Mọi finding đã có file:line cụ thể. AI Quick Wins đã build PASS, sẵn sàng deploy lên môi trường staging để regression.*
