# BHL Test & Demo Blueprint — GPS thực tế, AI tương tác, báo cáo theo ngữ cảnh

> Ngày lập: 27/04/2026  
> Nguồn: BRD v3.8, AQF 4.1, TST v2.2, code audit ngày 27/04/2026.  
> Mục tiêu: biến QA/demo từ “có dữ liệu để nhìn” thành “có kịch bản chứng minh hệ thống vận hành đúng trong đời thực”.

---

## 1. Kết luận audit nhanh

### 1.1 GPS / tuyến đường

- BRD TMS-01c yêu cầu tuyến trên bản đồ phải theo đường bộ thực tế bằng OSRM; TMS-01f yêu cầu giả lập GPS trên tuyến đã phân công.
- Code hiện có đã gọi OSRM ở `bhl-oms/internal/gps/simulator.go` và `bhl-oms/internal/testportal/gps_routes.go`.
- Rủi ro còn lại: nếu OSRM lỗi, các hàm đang trả lại waypoint gốc, khiến UI/simulator nối điểm trực tiếp kiểu đường chim bay. Đây chỉ nên là degraded mode có cảnh báo, không được dùng cho demo/test route-real.
- Rủi ro cấu hình: GPS simulator runtime đang hardcode `http://localhost:5000` và public OSRM; nên dùng `OSRM_URL` từ config. Trong Docker/production, `localhost` của backend không phải OSRM container.
- Rủi ro dữ liệu: demo fallback còn hardcode tọa độ NPP giả. Các kịch bản liên quan tuyến đường nên ưu tiên trip/stops từ DB hoặc customer master data có tọa độ thật; hardcoded template chỉ được giữ cho smoke degraded, không gọi là route thực tế.

### 1.2 AI cards chưa đủ tương tác

- `DispatchBriefCard` hiện là tóm tắt đọc được nhưng 4 mini metric không click/drill-down, không có “next best action”.
- `OutreachQueueWidget` có danh sách NPP cần liên hệ nhưng item chưa click vào customer, chưa mở bản nháp Zalo, chưa tạo task/call note, icon tin nhắn chỉ là hình.
- `AIInboxPanel` có CTA nhưng rule-generated item dùng ID dạng `rules-*`, trong khi backend `PATCH /v1/ai/inbox/:id/action` yêu cầu UUID. Nếu item không đến từ bảng `ai_inbox_items`, bấm action sẽ fail.

### 1.3 Báo cáo / lịch sử dữ liệu

- KPI overview theo `period=today|week|month` đang dùng snapshot mới nhất nếu hôm nay chưa có snapshot. Điều này giúp demo có số liệu, nhưng dễ gây hiểu sai “hôm nay” thành “ngày gần nhất có dữ liệu”.
- Issues/cancellations/redeliveries có default khoảng thời gian, nhưng frontend chưa cho người dùng chọn rõ `from/to`, chưa hiện “data as of” và scope.
- NPP outreach đang lấy toàn bộ `ml_features.npp_health_scores` theo risk band, không giới hạn theo vùng/role/last order window/trạng thái hoạt động trong ngày. Với dữ liệu lịch sử lớn, danh sách có thể đúng về thống kê nhưng sai về nhu cầu thao tác hôm nay.

---

## 2. GPS route-real policy

Mọi kịch bản GPS hoặc tuyến đường phải công bố `route_geometry_source`:

| Source | Được dùng cho demo khách? | Hành vi |
|---|---:|---|
| `osrm_local` | Có | Tuyến đường thực tế từ OSRM local Vietnam data. Đây là chuẩn mặc định. |
| `osrm_public` | Chỉ smoke/dev | Chấp nhận khi local OSRM chưa chạy, phải hiển thị badge external/fallback. |
| `db_route_geometry` | Có | Tuyến đã lưu từ planning/VRP, nếu có geometry đủ điểm. |
| `straight_line_degraded` | Không | Chỉ dùng để chứng minh degraded mode; polyline phải nét đứt và banner cảnh báo. |

Quy tắc triển khai:

1. `route-real` scenarios phải fail/HOLD nếu không lấy được OSRM geometry; không silent fallback sang đường thẳng.
2. API GPS scenario phải trả metadata: `geometry_source`, `distance_km`, `duration_min`, `waypoint_count`, `osrm_status`.
3. Control Tower phải hiển thị badge “Tuyến thực tế” hoặc “Degraded: OSRM unavailable”.
4. Demo routes phải lấy từ `trips -> trip_stops -> customers latitude/longitude -> OSRM`, hoặc từ route library chuẩn; không dùng tọa độ giả không có NPP thật.
5. Nếu cần kịch bản mất OSRM, đặt tên rõ `GPS-DEG-01 OSRM unavailable`, không dùng cho demo vận hành chính.

---

## 3. Ma trận test/demo đầy đủ theo BRD

### 3.1 Golden/domain invariants

| ID | Module | Rule | Evidence |
|---|---|---|---|
| G-OMS-ATP | OMS | ATP không bán vượt tồn | Golden JSON + service test |
| G-OMS-CREDIT | OMS | R15 hạn mức công nợ theo thời kỳ | Golden JSON + API assertion |
| G-OMS-CUTOFF | OMS | R08 trước/sau 16h | Unit + API assertion |
| G-OMS-STATE | OMS | State machine đơn hàng | Golden JSON |
| G-TMS-STATE | TMS | State machine trip/stop | Golden JSON |
| G-TMS-VRP | TMS | Capacity, multi-drop, unassigned đúng | VRP property cases |
| G-TMS-COST | TMS | Fuel/toll/base cost | Golden JSON + Go test |
| G-GPS-REAL | GPS | Route geometry không đường chim bay | OSRM assertion: waypoint_count > stops, distance road >= haversine |
| G-WMS-FEFO | WMS | FEFO xuất lô hết hạn trước | Golden JSON + stock fixture |
| G-WMS-HANDOVER-A | WMS | R01 sai lệch hàng = 0 | API/state assertion |
| G-WMS-ASSET | WMS | R02/R14/R17 vỏ, keg, bồi hoàn | Domain + API assertion |
| G-RECON | Recon | Idempotent, T+1 | Golden + scoped DB run |
| G-RBAC | Security | 9 role đúng quyền | Bruno matrix |
| G-AI-OFF | AI | AI flags OFF không phá baseline | Page/API smoke |
| G-AI-ACTION | AI | AI gợi ý phải có action hoặc lý do read-only | UX/API assertion |

### 3.2 Scoped DB scenarios

Mọi scenario mutate DB phải có `qa_scenario_runs` + `qa_owned_entities`, cleanup scoped, `historical_rows_touched = 0`.

| ID | Tên | Seed tối thiểu | Chứng minh |
|---|---|---|---|
| SC-01 | OMS happy path | 2-3 orders owned | created -> confirm -> shipment -> trip -> recon |
| SC-02 | Credit exceed | 1 NPP/order/ledger owned | pending_approval, audit event |
| SC-03 | ATP fail/partial | stock snapshot owned | insufficient, reserved không vượt tồn |
| SC-04 | NPP reject | order confirmation token owned | cancelled + reason chain |
| SC-05 | Dispatch/VRP normal | 8-12 shipments, 2-3 vehicles | assigned/unassigned rõ lý do |
| SC-06 | Driver flow | 1 trip, 3 stops | arrive -> delivering -> delivered/failed |
| SC-07 | Handover A fail | picking/gate fixture | blocker, không xuất cổng |
| SC-08 | Recon discrepancy | completed trip fixture | discrepancy + T+1 deadline |
| SC-09 | VRP stress | synthetic shipments owned | capacity, route time, no overload |
| SC-10 | Historical read-only day | chỉ đọc data lịch sử | không mutate, scope/date visible |
| SC-11 | Control Tower GPS route-real | active trips owned hoặc real active | OSRM geometry, Redis keys cleanup scoped |
| SC-12 | Ops/Audit regression | DLQ/KPI/recon owned | timeline, notes, DLQ, KPI visible |
| SC-13-R | Fleet document expiry scoped | owned vehicle/doc fixture | không update xe thật; alert đúng |
| SC-14-R | FEFO scoped | owned lots/stock/order | lot gần hết hạn được pick trước |
| SC-15 | WMS inbound/putaway | owned pallet/bin/lot | LPN, bin, stock updated |
| SC-16 | Returnable assets | owned returns | good/damaged/lost ledger đúng |
| SC-17 | Payment/reconciliation | owned payment/discrepancy | cash/credit/partial, close T+1 |
| SC-18 | GPS anomaly trio | route-real + idle/lost/speed | anomaly open, explainable, map link |
| SC-19 | AI actionability | AI inbox/brief/outreach owned | CTA routes, draft, ack works |
| SC-20 | Report scope | snapshots + history read-only | default period rõ, custom range đúng |

### 3.3 Demo journeys cho khách hàng

| Demo | Người xem | Câu chuyện | Must-have tương tác |
|---|---|---|---|
| DEMO-01 | DVKH | Tạo đơn -> NPP xác nhận Zalo | mở order, copy/open confirmation link, timeline |
| DEMO-02 | Kế toán | Vượt hạn mức -> duyệt/từ chối | drill vào NPP debt, approve/reject |
| DEMO-03 | Điều phối | VRP -> duyệt chuyến nhiều điểm | map route-real, stops, vehicle/driver |
| DEMO-04 | DVKH/Management | NPP từ chối -> audit | reason, timeline, retry/create new order |
| DEMO-05 | Kho/Bảo vệ | Picking -> Bàn giao A -> mở cổng | zero variance, signed handover |
| DEMO-06 | Tài xế | Start trip -> ePOD -> payment -> returns | mobile/PWA stop workflow |
| DEMO-07 | Phân xưởng/Kế toán | Bàn giao B/C -> hoàn chuyến | variance handling, signatures |
| DEMO-08 | Control Tower | GPS realtime trên route thực | OSRM badge, anomaly, focus vehicle |
| DEMO-09 | Báo cáo quản trị | Today/week/custom range | scope switch, data-as-of, drill-down |
| DEMO-10 | AI điều phối | Brief + outreach + inbox | next action, Zalo draft, ack, explainability |
| DEMO-11 | AI simulation | What-if VRP | 3 options, approval required, no core mutation |
| DEMO-12 | AQF safety | Load/cleanup scenario | historical_rows_touched = 0 |

---

## 4. UX world-class đề xuất

### 4.1 AI không chỉ là text, phải là decision surface

Brief điều phối hôm nay:

- 4 metric mini card phải click được: Đơn hôm nay -> `/dashboard/orders?date=today`, Chuyến active -> Control Tower filtered active, NPP rủi ro -> outreach queue, Cảnh báo GPS -> anomalies.
- Thêm “why now”: dữ liệu tính từ đâu, cập nhật lúc nào, provider nào.
- Thêm “next best actions”: chạy VRP, mở Control Tower, gọi NPP, xem cảnh báo GPS.
- Nếu AI OFF, giữ dashboard baseline và chỉ hiện KPI/action thủ công.

NPP cần liên hệ hôm nay:

- Mỗi item phải mở customer 360, lịch sử đơn, công nợ, health trend.
- Primary action: “Mở bản nháp Zalo”; secondary: “Ghi chú cuộc gọi”, “Tạo đơn mới”, “Đánh dấu đã liên hệ”.
- Sau khi xử lý, item biến thành done/dismissed với audit trail, không nằm lại danh sách.
- Ưu tiên theo role/territory/last contact, không lấy toàn bộ history mù ngữ cảnh.

AI Inbox:

- Rule-generated item phải dùng UUID persisted hoặc endpoint ack hỗ trợ `group_key`/synthetic ID.
- Mỗi CTA phải route được hoặc thực thi được; nếu read-only thì label là “Xem lý do” thay vì “Xem chi tiết”.
- Cần empty state nói rõ “AI đang tắt” hoặc “không có việc cần xử lý”, tránh hiểu là lỗi.

### 4.2 Báo cáo không được mặc định “toàn bộ lịch sử”

Default theo persona:

| Persona | Default scope | Vì sao |
|---|---|---|
| Điều phối | Hôm nay + ngày gần nhất có activity nếu hôm nay trống, có banner rõ | Cần vận hành realtime |
| DVKH | 7 ngày + NPP cần xử lý | Cần gọi/chốt đơn |
| Kế toán | Kỳ chốt sổ hiện tại + T+1 overdue | Cần thu tiền/đối soát |
| Quản lý | Today / week / month / custom | Cần xu hướng và drill-down |
| QA Portal | Scenario run scope | Cần evidence an toàn dữ liệu |

Yêu cầu UI:

1. Mọi report có scope bar: `Hôm nay`, `7 ngày`, `Tháng này`, `Tùy chọn`, `Dữ liệu lịch sử`.
2. “Dữ liệu lịch sử” phải là lựa chọn chủ động, không là default.
3. Hiện `Data as of`, `Source`, `Rows scanned`, `Filters applied`.
4. KPI click phải giữ filter/date scope khi điều hướng sang danh sách chi tiết.
5. Nếu fallback sang latest snapshot, text phải là “Ngày gần nhất có dữ liệu: yyyy-mm-dd”, không gọi là “Hôm nay”.

---

## 5. Backlog triển khai ưu tiên

| Ưu tiên | Item | Kết quả mong đợi |
|---|---|---|
| P0 | GPS route-real fail-closed cho demo/test | Không còn đường chim bay trong route demo chính |
| P0 | Dùng `OSRM_URL` trong GPS simulator runtime | Local/Docker/prod nhất quán |
| P0 | Retire hardcoded demo GPS templates khỏi demo chính | Demo dùng trip/customer thật hoặc route library |
| P0 | Fix AI Inbox synthetic ID ack | CTA không fail âm thầm |
| P0 | Outreach item actions | Mở customer, draft Zalo, mark contacted |
| P0 | Dispatch brief drill-down | Metric click được và giữ context |
| P1 | Report scope bar toàn hệ thống | Không hiểu nhầm data lịch sử là hôm nay |
| P1 | Scenario ownership audit cho SC-13..17 | Không update master/historical row trực tiếp |
| P1 | Add SC-18/19/20 | GPS anomaly, AI actionability, report scope |
| P2 | Evidence import Playwright/Bruno vào QA Portal | AQF decision có artifact đầy đủ |

---

## 6. Exit criteria

- GPS demo chính: `geometry_source=osrm_local|db_route_geometry`, không có `straight_line_degraded`.
- Route-real test fail nếu OSRM unavailable, trừ kịch bản degraded được đặt tên riêng.
- Mỗi AI card có ít nhất một hành động cụ thể hoặc label read-only rõ ràng.
- Mỗi report hiển thị scope/date/as-of và không mặc định quét toàn bộ lịch sử.
- Mọi scenario mutate DB pass `historical_rows_touched = 0`.
- Tắt toàn bộ AI flags: dashboard, order, planning, control tower vẫn chạy baseline.