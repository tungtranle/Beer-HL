package testportal

// demo_guides.go — Hướng dẫn chi tiết cho từng kịch bản demo/test portal.
// Được hiển thị trong Test Portal UI khi người dùng mở chi tiết kịch bản.
// Nội dung viết bằng Markdown để UI có thể render thành rich text.
//
// Cấu trúc mỗi guide:
//   - Mục tiêu: kịch bản này demo điều gì
//   - Tài khoản cần dùng: roles và tài khoản login
//   - Các bước chi tiết: step-by-step với page URL và điều cần quan sát
//   - Điểm nhấn demo: câu chốt khi thuyết trình với khách hàng
//   - Lưu ý / Cleanup: lưu ý quan trọng

func scenarioGuide(id string) string {
	guides := map[string]string{

		"DEMO-01": `## DVKH tạo đơn → NPP xác nhận Zalo

**Mục tiêu:** Demo luồng đặt hàng OMS đầy đủ: tạo đơn → gửi Zalo xác nhận → timeline audit trail.

**Tài khoản cần dùng:** dvkh (hoặc admin), management để xem evidence.

---

### Các bước thực hiện

**Bước 1 — Load data**
> Vào **Test Portal** → Tìm kịch bản DEMO-01 → Nhấn **Load**.
> Kết quả: created_count = 8, historical_rows_touched = 0.
> Tạo ra 2 đơn có prefix **QA-D01-***.

**Bước 2 — DVKH xem đơn chờ xác nhận**
> Đăng nhập tài khoản **dvkh** → Vào /dashboard/orders.
> Lọc theo từ khóa QA-D01 → Thấy **2 đơn** trạng thái **"Chờ NPP xác nhận"**.

**Bước 3 — Demo gửi Zalo**
> Click vào đơn → Panel bên phải → Nhấn **"Gửi xác nhận Zalo"**.
> Thấy preview template Zalo với thông tin đơn (mã đơn, sản phẩm, số lượng, địa chỉ giao).

**Bước 4 — Xem Timeline**
> Trong chi tiết đơn → Tab **Timeline** → Thấy chuỗi event:
> Đơn mới tạo → Gửi Zalo xác nhận → Đang chờ NPP phản hồi.

---

### Điểm nhấn demo
- Zalo OA integration: NPP xác nhận **24/7** không cần gọi điện.
- Timeline audit trail đầy đủ — khi có khiếu nại, có bằng chứng rõ ràng ai làm gì lúc nào.
- Core workflow không phụ thuộc Zalo: nếu Zalo down, DVKH vẫn xác nhận qua portal.

**Cleanup:** Test Portal → Cleanup DEMO-01 → Xóa 2 đơn QA-D01-*, dữ liệu lịch sử không bị chạm.`,

		"DEMO-02": `## Vượt hạn mức tín dụng → kế toán duyệt

**Mục tiêu:** Demo kiểm soát credit tự động: đơn vượt hạn mức → blocked → accountant review → duyệt/từ chối.

**Tài khoản cần dùng:** accountant (duyệt), dvkh (xem đơn), management (xem công nợ NPP).

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-02** → created_count = 4, hist = 0.
> Tạo: 1 receivable_ledger demo + 1 đơn **QA-D02-*** trạng thái pending_approval.

**Bước 2 — Kế toán xem approval queue**
> Đăng nhập **accountant** → Vào /dashboard/approvals.
> Tìm đơn **QA-D02-*** → Trạng thái: **"Chờ duyệt — vượt hạn mức tín dụng"**.

**Bước 3 — Xem chi tiết credit**
> Mở đơn → Panel **Credit** → Thấy:
> - Hạn mức tín dụng của NPP
> - Công nợ hiện tại (bao gồm ledger demo)
> - Số tiền vượt = tổng đơn - (hạn mức - công nợ)

**Bước 4 — Demo action**
> Kế toán chọn **Duyệt** (nhập ghi chú lý do) hoặc **Từ chối** → Timeline cập nhật ngay.

---

### Điểm nhấn demo
- Không cần gọi điện hỏi kế toán — hệ thống tự block và route đúng người phê duyệt.
- Audit trail đầy đủ: ai duyệt, lúc mấy giờ, lý do gì.
- NPP vẫn thấy trạng thái đơn realtime qua Zalo/portal.

**Lưu ý:** Công nợ demo được tạo riêng (QA scoped), không ảnh hưởng hạn mức thực của NPP demo.`,

		"DEMO-03": `## Điều phối tạo chuyến giao nhiều điểm

**Mục tiêu:** Demo tạo và quản lý chuyến giao hàng thực tế với nhiều điểm dừng, dựa trên sản lượng ngày lịch sử bận nhất.

**Tài khoản cần dùng:** dispatcher (tạo/quản lý chuyến), driver (app tài xế), management.

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-03** → Tạo trips/stops/orders calibrated theo ngày lịch sử bận nhất.
> created_count ~ 313, hist = 0.

**Bước 2 — Dispatcher xem chuyến**
> Đăng nhập **dispatcher** → /dashboard/trips.
> Lọc prefix QA-D03 → Thấy chuyến trạng thái **assigned** với **3+ điểm giao**.

**Bước 3 — Xem chi tiết chuyến**
> Mở chuyến → Map view → Thấy 3 pins stops theo tuyến tối ưu.
> Panel bên phải: danh sách stops theo thứ tự, trọng tải mỗi điểm, tài xế được phân công.

**Bước 4 — Flow tài xế**
> Đăng nhập **driver** → /dashboard/driver → Thấy chuyến hôm nay.
> Demo: Danh sách stops, nút **Check-in điểm giao**, **Xác nhận đã giao**, **Chụp hình biên lai**.

**Bước 5 — Control Tower**
> Dispatcher → /dashboard/control-tower → Xe QA-D03 hiển thị trên map.

---

### Điểm nhấn demo
- Dispatcher tạo chuyến trong **<5 phút**. Driver dùng mobile track từng stop, không cần giấy tờ.
- Data không phải fake: calibrated theo ngày thực tế bận nhất — số chuyến, số stop, số tấn đều realistic.
- Control Tower theo dõi realtime, không cần gọi điện cho tài xế để biết xe đang ở đâu.`,

		"DEMO-04": `## NPP từ chối đơn → timeline lý do

**Mục tiêu:** Demo audit trail đầy đủ khi NPP từ chối đơn: chuỗi event không thể sửa, lý do được ghi lại.

**Tài khoản cần dùng:** dvkh (xem đơn), management (xem audit).

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-04** → created_count = 5, hist = 0.
> Tạo: 1 đơn **QA-D04-*** trạng thái cancelled, 1 confirmation rejected, 2 entity events.

**Bước 2 — DVKH xem đơn bị từ chối**
> Đăng nhập **dvkh** → /dashboard/orders → Lọc QA-D04.
> Thấy đơn trạng thái **"Cancelled / NPP từ chối"**.

**Bước 3 — Xem Timeline**
> Mở đơn → Tab **Timeline** → Thấy chuỗi events theo thứ tự thời gian:
> 1. Đơn mới tạo — DVKH
> 2. Gửi Zalo xác nhận — DVKH
> 3. NPP từ chối — lý do: **"NPP yêu cầu đổi lịch giao"**
> 4. Đơn cancelled — hệ thống

**Bước 4 — Audit value**
> Management: Không thể xóa hoặc sửa event đã xảy ra.
> Mọi thay đổi đều có dấu thời gian, tên người thực hiện, lý do.

---

### Điểm nhấn demo
- Khi có khiếu nại tranh chấp, audit trail là **bằng chứng pháp lý** không thể chỉnh sửa.
- NPP từ chối qua Zalo → lý do được sync ngay vào hệ thống, DVKH thấy realtime.
- Không cần lưu screenshot WhatsApp/Zalo riêng lẻ — mọi thứ ở một nơi.`,

		"DEMO-HIST-01": `## Replay ngày lịch sử có sản lượng thật

**Mục tiêu:** Demo phân tích ngày thực tế bận nhất mà **không tạo, sửa, hoặc xóa** bất kỳ dữ liệu lịch sử nào.

**Tài khoản cần dùng:** management, dispatcher.

---

### Các bước thực hiện

**Bước 1 — Load data (read-only)**
> Test Portal → Load **DEMO-HIST-01** → created_count = 1 (chỉ tạo run evidence), hist = 0.
> **Không có row nghiệp vụ nào được tạo.**

**Bước 2 — Đọc kết quả**
> Xem run_result.message → Hiển thị: ngày lịch sử bận nhất, số đơn, số chuyến, tổng tấn thực tế ngày đó.

**Bước 3 — Management xem báo cáo thực**
> Vào /dashboard/kpi → Chọn ngày lịch sử từ run evidence.
> Thấy số liệu thật: revenue, orders delivered, fleet utilization ngày đó.

**Bước 4 — Thuyết minh với khách**
> "Đây là dữ liệu thật ngày [date]. Hệ thống đã xử lý [N] đơn, [M] chuyến, tổng [X] tấn.
> Chúng tôi không tạo data giả để demo — bạn đang nhìn vào lịch sử vận hành thực của mình."

---

### Điểm nhấn demo
- **Transparency tuyệt đối:** Khách hàng tin vì nhìn thấy số liệu thật của chính họ.
- **historical_rows_touched = 0:** Hệ thống bảo vệ dữ liệu lịch sử tuyệt đối — demo không làm ô nhiễm production data.
- Đây là kịch bản **read-only duy nhất** trong 15 kịch bản, chứng minh AQF data safety.

**Lưu ý:** Nếu không có dữ liệu lịch sử (môi trường dev mới), kịch bản sẽ báo "No historical data found" — đây là behavior đúng.`,

		"DEMO-DISPATCH-01": `## Điều phối live ops — xe đang giao gần công suất

**Mục tiêu:** Demo Control Tower thực tế với nhiều xe in_transit, AI Inbox dispatcher, gần tối đa công suất fleet.

**Tài khoản cần dùng:** dispatcher, driver, management.

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-DISPATCH-01** → created_count ~ 842, hist = 0.
> Tạo: nhiều chuyến in_transit + stops + driver_checkins owned + AI Inbox items.

**Bước 2 — Dispatcher xem Control Tower**
> Đăng nhập **dispatcher** → /dashboard/control-tower.
> Thấy nhiều xe in_transit trên map. Panel bên: danh sách xe theo status.

**Bước 3 — Xem AI Inbox**
> Panel trái → **AI Inbox** → Thấy items ưu tiên:
> - P0/P1: xe có GPS anomaly, chuyến sắp trễ SLA
> - P2: NPP có dấu hiệu rủi ro, đơn sắp hết cutoff

**Bước 4 — Demo dispatch action**
> Click xe có cảnh báo → Panel details → Options:
> - Gọi tài xế (click to call)
> - Re-assign stop sang xe khác
> - Escalate lên quản lý

**Bước 5 — Xem utilization**
> Dashboard header → Metric "Fleet utilization" → Gần tối đa.

---

### Điểm nhấn demo
- Dispatcher quản lý **40+ xe cùng lúc** mà không bỏ sót vấn đề nhờ AI ưu tiên hóa.
- Không cần gọi lần lượt từng tài xế để biết tiến độ — Control Tower hiển thị realtime.
- Data calibrated theo ngày lịch sử bận nhất: số chuyến, tải trọng đều realistic.`,

		"DEMO-AI-DISPATCH-01": `## AI điều phối viên — Brief, cảnh báo và hành động

**Mục tiêu:** Demo đầy đủ AI-native dispatcher experience: Brief tổng hợp + Inbox ưu tiên + Simulation what-if.

**Tài khoản cần dùng:** dispatcher (xem/xử lý), management (approve), admin (bật AI flags).

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-AI-DISPATCH-01** → created_count ~ 888, hist = 0.
> Tạo: live ops data + 4 AI Inbox items + simulation snapshot.

**Bước 2 — Dispatcher xem AI Brief**
> Vào /dashboard → Panel **AI Brief** (trên cùng).
> Brief tóm tắt: "Hôm nay có [N] xe in_transit, 3 chuyến có rủi ro trễ, 1 xe GPS bất thường. Ưu tiên xử lý: ..."

**Bước 3 — Xem AI Inbox (4 items)**
> - **P0** dispatch_delay: Chuyến X dự kiến trễ 45 phút — action: gọi tài xế
> - **P1** gps_watch: Xe Y dừng bất thường — action: xác nhận vị trí
> - **P2** customer_risk: NPP Z có dấu hiệu rủi ro tín dụng
> - **P2** reroute_suggestion: VRP gợi ý chuyển 1 stop tiết kiệm 12km

**Bước 4 — Mở Simulation**
> /dashboard/ai/simulations → Simulation "VRP What-if" → 3 phương án A/B/C.
> **Apply phương án cần duyệt người thật** — AI không tự áp dụng.

**Bước 5 — Toggle AI OFF để kiểm chứng**
> Settings → Tắt ai.master → Dashboard vẫn load bình thường, chỉ ẩn AI surface.
> Core workflow (chuyến, stops, tài xế) hoàn toàn bình thường.

---

### Điểm nhấn demo
- AI là **progressive enhancement** — thêm giá trị nhưng không thay thế quyết định con người.
- Core workflow không bị block khi AI tắt: đây là cam kết kiến trúc, không phải marketing.
- Dispatcher xử lý cả ngày vận hành bận nhất trong **<30 phút** nhờ AI ưu tiên hóa.`,

		"DEMO-AI-01": `## AI Command Center: Inbox + Brief + Transparency

**Mục tiêu:** Demo AI dashboard tổng thể: cách bật/tắt từng AI feature, inbox ưu tiên, audit transparency.

**Tài khoản cần dùng:** admin (bật flags), dispatcher (xem inbox/brief), management (transparency).

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-AI-01** → created_count = 5, hist = 0.
> Tạo: 3 AI Inbox items + 2 audit log rows.

**Bước 2 — Admin bật AI flags**
> /dashboard/settings/ai → Bật:  ai.master, ai.briefing, ai.transparency.
> Thấy AI surfaces xuất hiện dần trên dashboard (không reload toàn trang).

**Bước 3 — Dispatcher xem AI Inbox**
> /dashboard → **AI Inbox** → 3 items:
> - **P1** dispatch_focus: "Có đơn chờ xử lý và chuyến cần theo dõi trước cutoff"
> - **P2** credit_watch: "Risk signal từ công nợ và nhịp đặt hàng của NPP"
> - **P2** gps_watch: "Rule anomaly phát hiện xe dừng lâu, cần dispatcher xác minh"

**Bước 4 — Xem AI Transparency Center**
> /dashboard/ai/transparency → Tab **Providers** → Groq configured, latency realtime.
> Tab **Audit** → 2 log entries: route cloud + rules. Không có raw_prompt, chỉ có request_hash.

**Bước 5 — Tắt từng flag**
> Admin tắt ai.briefing → Brief ẩn, nhưng Inbox và Transparency vẫn hoạt động độc lập.
> → Chứng minh granular control, không phải all-or-nothing.

---

### Điểm nhấn demo
- Granular control: bật/tắt **từng AI feature riêng lẻ**, không phải bật tắt toàn bộ.
- Raw prompt **không lưu trữ** — chỉ có request_hash. Tuân thủ PDPA/privacy ngay từ architecture.
- AI Brief và Inbox hoạt động cả khi Groq offline (fallback sang rules engine local).`,

		"DEMO-AI-02": `## Decision Intelligence: credit risk tại OMS/Approval

**Mục tiêu:** Demo AI credit risk inline: risk strip tại điểm tạo đơn, explainability, approval route.

**Tài khoản cần dùng:** admin (bật flags), dvkh (tạo/xem đơn), accountant (duyệt).

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-AI-02** → created_count = 6, hist = 0.
> Tạo: đơn QA-D02-* pending_approval + ledger + AI credit inbox item + audit log.

**Bước 2 — Admin bật Credit AI**
> /dashboard/settings/ai → Bật: ai.credit_score, ai.explainability, ai.feedback.

**Bước 3 — DVKH xem Risk Strip**
> /dashboard/orders → Mở đơn **QA-D02-*** → Thấy **Risk Strip** màu cam phía trên form:
> "Công nợ [X]% hạn mức — rủi ro trung bình. Xem xét trước khi tiếp nhận."

**Bước 4 — Explainability**
> Click **"Tại sao?"** trên Risk Strip → Modal giải thích factors:
> - Outstanding balance: X triệu (Y% hạn mức)
> - Payment pattern: trễ 2/3 kỳ gần nhất
> - Order volume trend: giảm 30% so với tháng trước

**Bước 5 — Accountant duyệt**
> /dashboard/approvals → Đơn QA-D02-* trong queue → Review + nhập ghi chú → Duyệt.

**Bước 6 — Flag OFF test**
> Admin tắt ai.credit_score → Form tạo đơn vẫn bình thường, không có Risk Strip.
> → Core workflow không bị block bởi AI.

---

### Điểm nhấn demo
- AI **chỉ gợi ý**, không auto-block. Kế toán luôn là người quyết định cuối cùng.
- Risk Strip xuất hiện **inline tại điểm hành động** — không cần mở tab khác.
- Explainability giải thích bằng ngôn ngữ tự nhiên, không phải số liệu khô khan.`,

		"DEMO-AI-03": `## Simulation/VRP what-if trước khi duyệt kế hoạch

**Mục tiêu:** Demo AI simulation: 3 phương án trade-off A/B/C, approval required, core tables không bị mutation.

**Tài khoản cần dùng:** admin (bật flags), dispatcher (chạy simulation), management (duyệt).

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-AI-03** → created_count ~ 315, hist = 0.
> Tạo: 3 orders + shipments + trip/stops + 1 ai_simulations snapshot ready + AI Inbox item.

**Bước 2 — Admin bật Simulation**
> /dashboard/settings/ai → Bật: ai.simulation, ai.intent.
> Cmd+K → gõ "mô phỏng kế hoạch chiều" → intent route sang simulation page.

**Bước 3 — Dispatcher mở Simulation**
> /dashboard/ai/simulations → Thấy simulation **"VRP What-if"** trạng thái ready.
> 3 phương án hiển thị trong bảng so sánh:

| Phương án | Xe sử dụng | Tổng km | Chi phí ước tính |
|-----------|-----------|---------|-----------------|
| **A — Tối ưu chi phí** | ít nhất | cao hơn | thấp nhất |
| **B — Cân bằng** | trung bình | trung bình | trung bình |
| **C — Giao nhanh nhất** | nhiều nhất | thấp nhất | cao nhất |

**Bước 4 — Apply phương án**
> Click **"Apply phương án A"** → Confirmation dialog:
> "Cần phê duyệt bởi management trước khi áp dụng. core_tables_mutated = false."
> → Chứng minh AI không tự quyết định.

---

### Điểm nhấn demo
- AI không tự quyết định kế hoạch vận tải. Con người luôn **review và approve** trước khi áp dụng.
- Simulation hết hạn sau 5 phút nếu không duyệt — tránh stale plan.
- Cost vs Time trade-off được visualize rõ ràng, dispatcher hiểu ngay không cần giải thích.`,

		"DEMO-AI-04": `## Trust Loop + Privacy Router evidence

**Mục tiêu:** Demo AI governance: audit không có raw prompt, feedback loop, privacy fail-closed behavior.

**Tài khoản cần dùng:** admin (xem audit), management (governance inbox).

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-AI-04** → created_count = 6, hist = 0.
> Tạo: 3 ai_audit_log (cloud/rules/blocked) + 2 ai_feedback + 1 governance inbox item.

**Bước 2 — Admin xem AI Transparency**
> /dashboard/ai/transparency → Tab **Audit Log** → Thấy 3 entries:
> - Route **cloud** (Groq): request_hash, model, latency_ms, decision — **không có raw_prompt**
> - Route **rules** (local): processed by rules engine, no external call
> - Route **blocked** (privacy filter): request rejected — payload chứa thông tin nhạy cảm

**Bước 3 — Verify no raw prompt**
> Expand bất kỳ audit entry → Kiểm tra fields:
> ✅ request_hash — có  
> ✅ model, latency_ms, decision — có  
> ❌ raw_prompt, user_data, customer_name — **không có**

**Bước 4 — Management xem Governance Inbox**
> /dashboard → AI Inbox → Item type **governance**:
> "Trust Loop đề xuất nâng automation tier sang Tier 2 — **đang chờ phê duyệt management**."

**Bước 5 — Feedback**
> Dispatcher click suggestion → Chọn **"Đúng"** hoặc **"Không hữu ích"** → Feedback ghi vào ai_feedback.
> → Trust Loop dùng feedback để cải thiện model — closed loop.

---

### Điểm nhấn demo
- **Privacy by architecture**: dữ liệu khách hàng không bao giờ gửi sang AI provider — chỉ có hash.
- Privacy Router fail-closed: nếu request chứa data nhạy cảm, bị block chứ không bị leak.
- Trust Loop **chỉ đề xuất**, không tự nâng cấp automation tier. Luôn cần duyệt của management.`,

		"DEMO-VRP-01": `## VRP chuẩn sản xuất — ~105 xe (50 thực + 55 test), 48 tài xế

**Mục tiêu:** Stress test VRP solver với dữ liệu thực tế 13/06/2024: 105 đơn, 50 xe thực BHL, ~48 tài xế checked-in. Demo so sánh Cost vs Time optimization với fleet thực.

**Tài khoản cần dùng:** dispatcher, management.

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-VRP-01** → hist = 0.
> Tạo: 48 driver_checkins + 105 orders + ~156+ shipments. Sử dụng 50 xe thực của BHL (không tạo xe giả).

**Bước 2 — Dispatcher vào Planning**
> /dashboard/planning → Chọn kho **WH-HL** → Thấy **156+ shipments** trạng thái pending.
> Panel tổng: ~736 tấn, 27 NPP, 5 SKU sản phẩm.

**Bước 3 — Xem fleet**
> Tab **Vehicles** → Thấy **50 xe thực** active tại WH-HL (biển 14C/14M/14N/14P) + 8 xe WH-DM (15C-21*).
> Fleet hoàn toàn là fleet thực của BHL.

**Bước 4 — Chạy VRP Tối ưu Chi phí**
> Chọn tất cả xe → **"Tối ưu chi phí"** → Chờ solver (<2 phút).
> Kết quả: số xe được sử dụng, tổng km, số chuyến, chi phí ước tính.

**Bước 5 — Chạy VRP Giao nhanh nhất**
> Click **"Giao nhanh nhất"** → So sánh với phương án Cost:
> - Time mode: thường dùng nhiều xe hơn, km nhiều hơn, nhưng **tổng giờ ít hơn**
> - Cost mode: **ít xe hơn, ít km hơn**, nhưng thời gian giao dài hơn một chút

**Bước 6 — Phân tích bin-packing**
> Filter kết quả theo loại xe: xe 8T (chiếm đa số fleet) → gánh đơn nặng >4T/chuyến.
> Xe 5T/3.5T trong fleet → gánh đơn gần, nhỏ.

---

### Điểm nhấn demo
- **105 đơn thực tế, 27 NPP, 5 sản phẩm** — không phải data toy.
- VRP solver xử lý real-world complexity trong **<2 phút**. Lập lịch thủ công mất 3-4 giờ.
- Cost mode tiết kiệm **~15-20% chi phí nhiên liệu** so với lập lịch thủ công (tùy fleet).
- **50 xe thực** = fleet quy mô trung bình-lớn tại Việt Nam.

**Cleanup:** Orders/shipments → DELETE owned. Fleet xe + lịch sử không bị chạm.`,

		"DEMO-VRP-02": `## VRP so sánh bin-packing — 50 xe thực, 60 đơn đa dạng ~463 tấn

**Mục tiêu:** Test bin-packing rõ ràng với 5 nhóm trọng lượng (XS→XL). Tổng tải ~463T sát sức chứa 50 xe để VRP phải tối ưu phân bổ. Demo sự khác biệt Cost vs Time khi đơn đa dạng.

**Tài khoản cần dùng:** dispatcher, management.

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-VRP-02** → hist = 0.
> Tạo: 55 xe test + 48 driver_checkins + 60 đơn (5 nhóm, ~463T tổng tải) + ~120+ shipments.

**Bước 2 — Xem 5 nhóm trọng lượng**
> /dashboard/planning → WH-HL → Filter shipments → Thấy phân bố rõ:

| Nhóm | Số đơn | Trọng lượng/đơn | Shipments/đơn |
|------|--------|-----------------|---------------|
| XS | 12 | 40-120 kg | 1 |
| S | 12 | 195-405 kg | 1 |
| M | 12 | 600-1,200 kg | 1 |
| L | 12 | 7,000-13,000 kg | 1-2 |
| XL | 12 | 22,400-32,000 kg | 3-5 |

**Bước 3 — Chạy VRP và quan sát bin-packing**
> Click **"Tối ưu chi phí"** → Xem kết quả phân công xe:
> - Xe 8T (test fleet 55 xe): nhận đơn **XL và L**
> - Xe 5T (fleet thực): nhận đơn **M và S**
> - Xe 3.5T (fleet thực): gom **3-4 đơn XS** trên một xe

**Bước 4 — So sánh Cost vs Time**
> VRP-02 với đơn đa dạng → Chênh lệch Cost/Time **lớn hơn** VRP-01:
> - Cost: ưu tiên gom đơn cùng khu vực dù khác loại xe
> - Time: ưu tiên giao đơn nặng trước (ít xe nặng hơn = ít chuyến)

**Bước 5 — Capacity overflow**
> Tổng tải ~463T > 55 xe test × 8T = 440T.
> VRP phải sử dụng **cả fleet thực** để cover hết. Thấy rõ capacity planning value.

---

### Điểm nhấn demo
- Tổng 463T vượt sức chứa 55 xe test (440T) — buộc VRP tận dụng cả fleet thực.
- Bin-packing **rõ ràng và trực quan**: khách hàng thấy ngay tại sao cần tool VRP thay vì Excel.
- Chênh lệch Cost vs Time lớn hơn kịch bản VRP-01 — thấy giá trị optimization khi tải phức tạp.`,

		"DEMO-MORNING-01": `## Buổi sáng điều phối — AI briefing + 5 ưu tiên thực tế

**Mục tiêu:** Demo trải nghiệm dispatcher lúc 8:30 sáng: AI Brief tổng hợp, 5 Inbox ưu tiên, 5 xe đang giao, 12 đơn chờ VRP chiều.

**Tài khoản cần dùng:** dispatcher, management.

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-MORNING-01** → created_count ~ 147, hist = 0.
> Tạo: 5 trips in_transit + stops + 12 orders chiều + 5 AI Inbox items + 1 dispatch_brief.

**Bước 2 — Dispatcher login → Xem AI Brief**
> /dashboard → Panel **AI Brief** (đầu trang) → Tóm tắt buổi sáng:
> "5 chuyến đang giao. Chuyến MRN-02 có GPS anomaly. 2 chuyến qua QL5 nguy cơ trễ 25-30 phút. 12 đơn chờ VRP lúc 10:30."

**Bước 3 — Xem AI Inbox (5 items theo thứ tự ưu tiên)**
> - **P0** gps_anomaly: Xe MRN-02 dừng >20 phút tại vị trí không phải NPP → **Gọi tài xế ngay**
> - **P1** zalo_cutoff: NPP Quảng Ninh chưa confirm 3 đơn, hết cutoff **9:00** → Gọi NPP
> - **P1** doc_expiry: Giấy phép lái xe tài xế MRN-04 hết hạn **trong 7 ngày** → Nhắc gia hạn
> - **P2** demand_drop: 2 NPP giảm đơn >30% so tuần trước → DVKH gọi lại
> - **P2** ql5_incident: QL5 ùn tắc, MRN-03 và MRN-04 dự kiến trễ 25-30 phút → Thông báo NPP

**Bước 4 — Control Tower**
> /dashboard/control-tower → 5 xe in_transit trên map.
> Click xe **MRN-02** (GPS anomaly P0) → Panel chi tiết → Nút "Gọi tài xế".

**Bước 5 — Planning chiều**
> /dashboard/planning → 12 đơn prefix **QA-AFT-*** trạng thái pending.
> "Sẵn sàng chạy VRP lúc 10:30 khi dispatcher confirm."

---

### Điểm nhấn demo
- Dispatcher đến sở **không cần đọc email, gọi điện từng tài xế**. 30 giây nhìn dashboard biết ngay:
  - Hôm nay có gì cần xử lý
  - Thứ tự ưu tiên P0 → P2
  - Cần làm gì (action button ngay tại inbox item)
- Morning briefing + 5 Inbox ưu tiên = workflow chuẩn cho dispatcher chuyên nghiệp.`,

		"DEMO-DISPATCHER-AM-01": `## 8:30 AM Dispatcher Experience — World-class AI-native UX

**Mục tiêu:** Demo toàn diện trải nghiệm điều phối viên đẳng cấp: 6 chuyến in_transit, 18 đơn chiều, 8 AI Inbox items (2 P0 + 3 P1 + 3 P2), VRP simulation A/B/C, dispatch brief.

**Tài khoản cần dùng:** dispatcher, management, admin.

---

### Các bước thực hiện

**Bước 1 — Load data**
> Test Portal → Load **DEMO-DISPATCHER-AM-01** → created_count ~ 194, hist = 0.

**Bước 2 — AI Dispatch Brief (30 giây overview)**
> /dashboard → AI Brief panel → Tóm tắt:
> "6 xe đang giao. **2 vấn đề P0** cần xử lý ngay. 18 đơn chờ VRP 10:30. Fleet utilization 78%."

**Bước 3 — AI Inbox — xử lý P0 trước**
> - **P0** delivery_delay: Chuyến QA-AM-TR-02 trễ **45 phút** do kẹt xe → Action: Gọi tài xế / Thông báo NPP
> - **P0** gps_anomaly: Xe QA-AM-TR-04 dừng **30 phút** bất thường → Action: Xác nhận vị trí

**Bước 4 — Xử lý P1**
> - vehicle_overload: Xe QA-AM-TR-05 gánh **102% tải** → Đề xuất chuyển 1 stop sang xe khác
> - customer_credit_risk: NPP QA-AM-CUST-15 nợ 3 kỳ → Xem xét trước khi nhận đơn mới
> - zalo_confirmation_pending: 4 đơn chưa confirmed, cutoff 9:30

**Bước 5 — Control Tower**
> /dashboard/control-tower → 6 xe in_transit trên map.
> Click xe có P0 → Panel chi tiết → Lịch sử stop, vị trí realtime, action buttons.

**Bước 6 — VRP Simulation chiều**
> /dashboard/ai/simulations → Simulation **"Kế hoạch chiều 10:30"** → 3 phương án:

| Phương án | Xe | Tổng km | Chi phí |
|-----------|-----|---------|---------|
| **A — Cost optimal** | 8 xe | 156 km | 2.4M |
| **B — Balanced** | 10 xe | 132 km | 2.8M |
| **C — Time optimal** | 12 xe | 118 km | 3.1M |

**Bước 7 — Approve plan**
> Select phương án B → **"Apply"** → Confirmation: "Cần duyệt bởi management."
> Management approve → Plan được áp dụng, 18 đơn chuyển sang assigned.

---

### Điểm nhấn demo
- **Benchmark UX cho TMS/OMS tại Việt Nam.** Dispatcher xử lý toàn bộ buổi sáng trong **<15 phút** nhờ AI prioritization.
- 2 P0 alert đập vào mắt ngay khi login — không cần scroll, không cần tìm kiếm.
- VRP simulation cho dispatcher **real choices** với trade-off rõ ràng, không phải black box.
- **Mọi action đều có audit trail** — management luôn biết ai quyết định gì và khi nào.`,
	}

	if g, ok := guides[id]; ok {
		return g
	}
	return ""
}
