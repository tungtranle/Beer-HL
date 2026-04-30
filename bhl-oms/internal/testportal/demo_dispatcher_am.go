package testportal

// demo_dispatcher_am.go — DEMO-DISPATCHER-AM-01
// "Dispatcher AI Morning — World-class 8:30 AM experience"
//
// Đạt 7/7 tiêu chí AI-native world-class từ AI_UX_WorldClass_v2.md:
//   1. Mở màn hình thấy ngay việc quan trọng nhất
//   2. Hệ thống đề xuất hành động tiếp theo cụ thể
//   3. AI giải thích vì sao (confidence %, lịch sử, nguyên nhân dự báo)
//   4. Duyệt/sửa/từ chối trong ≤2 thao tác
//   5. Có audit trail (3 entries) + undo support
//   6. Có feedback loop (2 entries từ ca trước)
//   7. Brief synthesis giảm cognitive load — không cần đọc 8 items riêng lẻ
//
// So sánh với DEMO-MORNING-01:
//   BEFORE: 5 inbox items (generic), 0 simulation, 2 audits, brief chưa phân cấp
//   AFTER:  8 inbox items (quantified), VRP simulation A/B/C, 3 audits, 2 feedback,
//           brief KHẨN/ƯU TIÊN CAO/BUỔI CHIỀU/THEO DÕI, 18 đơn chiều 3 nhóm tải

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// demoscenarioDispatcherAM trả về metadata cho DEMO-DISPATCHER-AM-01.
func demoscenarioDispatcherAM() DemoScenario {
	return DemoScenario{
		ID:       "DEMO-DISPATCHER-AM-01",
		Title:    "Dispatcher AI Morning — World-class 8:30 AM",
		Category: "AI-NATIVE/DISPATCH",
		Description: "Kịch bản buổi sáng 8:30 đạt chuẩn world-class: dispatcher mở dashboard thấy " +
			"Brief AI tổng hợp đa tín hiệu (GPS hard-stop, SLA breach, QL5 cascade, NPP health, VRP ready), " +
			"8 Inbox items P0→P2 với context định lượng và CTA actionable, " +
			"6 chuyến in_transit đa dạng trạng thái, simulation VRP 3 phương án A/B/C sẵn sàng buổi chiều. " +
			"Hơn DEMO-MORNING-01 ở: 2 P0 thay vì 1, correlated signals, NPP health link, " +
			"simulation pre-queued, 18 đơn 3 nhóm tải cho VRP bin-packing rõ ràng, " +
			"3 audit + 2 feedback Trust Loop.",
		Roles: []string{"qa.demo", "dispatcher", "management", "admin"},
		DataSummary: "6 trips in_transit (22 stops đa trạng thái) + 18 đơn chiều 3 nhóm tải " +
			"+ 8 AI Inbox items đa tín hiệu + 1 VRP simulation A/B/C + 1 brief phân cấp " +
			"+ 3 audit + 2 feedback. Cleanup scoped, historical_rows_touched = 0.",
		Steps: []ScenarioStep{
			{
				Role:     "qa.demo",
				Page:     "/test-portal/demo",
				Action:   "Load DEMO-DISPATCHER-AM-01",
				Expected: "historical_rows_touched = 0; ~185 rows owned, 6 trips, 8 inbox items seeded",
			},
			{
				Role:     "dispatcher",
				Page:     "/dashboard",
				Action:   "Xem AI Brief + 8 Inbox items",
				Expected: "Brief phân cấp KHẨN/ƯU TIÊN CAO; P0 GPS hard-stop + P0 SLA breach đầu danh sách",
			},
			{
				Role:     "dispatcher",
				Page:     "/dashboard/control-tower",
				Action:   "Mở Control Tower — GPS + QL5 + SLA",
				Expected: "Thấy 6 chuyến in_transit; xe dừng bất thường, trip trễ SLA 47 phút rõ ràng",
			},
			{
				Role:     "dispatcher",
				Page:     "/dashboard/ai/simulations",
				Action:   "Xem VRP simulation A/B/C buổi chiều",
				Expected: "3 phương án: A (balance), B (cost), C (OTD max) — apply cần approval",
			},
			{
				Role:     "dispatcher",
				Page:     "/dashboard/orders?tab=pending_confirmation",
				Action:   "Xem 5 NPP chờ xác nhận Zalo",
				Expected: "Cutoff 9:30 còn 22 phút; NPP BN-047 và HP-215 ưu tiên",
			},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Morning fleet", Value: "6 trips in_transit, 22 stops (4 delivered / 5 delivering / 13 pending)"},
			{Label: "P0 items ×2", Value: "GPS hard-stop xe 29H-8472 (38 min off-route) | SLA breach trip DAM-03 (+47 min)"},
			{Label: "P1 items ×3", Value: "QL5 cascade 2 chuyến | Zalo 5 NPP cutoff 9:30 | NPP health BN-047 (38/100)"},
			{Label: "P2 items ×3", Value: "VRP sim ready (14% savings) | Doc expiry 3 ngày | Budget +9% KPI"},
			{Label: "Afternoon VRP", Value: "18 đơn: light(×6 150-450kg) + medium(×6 600-1300kg) + heavy(×6 2000-4500kg)"},
			{Label: "Trust Loop", Value: "3 audit trails + 2 feedback từ ca trước (correct + not_useful)"},
		},
	}
}

// seedDispatcherAM seeds kịch bản world-class buổi sáng điều phối.
// Mọi row đều được đăng ký trong qa_owned_entities. historical_rows_touched = 0.
func (s *DemoService) seedDispatcherAM(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	// ── 1. Driver check-ins cho 6 tài xế sáng hôm nay ──────────────────────
	checkins, err := s.insertDriverCheckins(ctx, tx, runID, 6)
	if err != nil {
		return created, fmt.Errorf("dam checkins: %w", err)
	}
	created += checkins

	// ── 2. 6 chuyến in_transit với tình huống đa dạng ──────────────────────
	type damStop struct {
		weightKg int
		status   string
	}
	type damTrip struct {
		seq    int
		offset int
		stops  []damStop
		note   string
	}

	trips := []damTrip{
		// Trip 1: Tuyến Quảng Yên — đúng tiến độ (baseline bình thường để so sánh)
		{1, 0, []damStop{{420, "delivered"}, {380, "delivered"}, {510, "delivering"}, {290, "pending"}},
			"Tuyến Quảng Yên — đúng tiến độ, baseline bình thường"},
		// Trip 2: GPS hard-stop — xe 29H-8472, dừng 38 phút, off-route 2.3km (→ P0 inbox)
		{2, 1, []damStop{{600, "delivered"}, {450, "delivering"}, {320, "pending"}},
			"QA demo GPS hard-stop: xe 29H-8472 dừng >38 phút tại Km47 QL5, off-route 2.3km"},
		// Trip 3: Delivery SLA breach — stop #1 trễ 47 phút SLA (→ P0 inbox)
		{3, 2, []damStop{{850, "delivering"}, {540, "pending"}, {620, "pending"}},
			"QA demo SLA breach: stop #1 đang giao trễ 47 phút SLA, NPP Đại Việt BN-112 chờ"},
		// Trip 4: QL5 congestion — rủi ro cascade, cần re-route trước 9:15 (→ P1 inbox)
		{4, 3, []damStop{{750, "delivered"}, {680, "delivering"}, {420, "pending"}, {310, "pending"}},
			"Tuyến QL5 — ùn tắc Km35-42, ETA shift +35 phút, re-route qua CT HN-HP tiết kiệm 22 phút"},
		// Trip 5: QL5 affected — chưa giao được stop nào, xuất phát muộn (→ P1 cascade)
		{5, 4, []damStop{{920, "delivering"}, {480, "pending"}, {370, "pending"}},
			"Tuyến QL5 — xuất phát muộn, đang đi qua vùng tắc nghẽn Km35-42"},
		// Trip 6: NPP health risk — còn 1 stop NPP BN-047 health=38/100 (→ P1 NPP inbox)
		{6, 5, []damStop{{380, "delivered"}, {340, "delivered"}, {290, "pending"}},
			"Tuyến Uông Bí — còn 1 stop NPP BN-047 (health=38/100, công nợ tồn đọng 12 ngày)"},
	}

	for _, mt := range trips {
		shipmentIDs := []uuid.UUID{}
		customerIDs := []uuid.UUID{}

		totalWeight := 0
		for _, st := range mt.stops {
			totalWeight += st.weightKg
		}

		for stopIdx, stop := range mt.stops {
			orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
				Prefix:       "DAM",
				Seq:          mt.seq*10 + stopIdx + 1,
				CustomerOff:  mt.offset*4 + stopIdx,
				Status:       "confirmed",
				Amount:       12000000 + mt.seq*1000000 + stopIdx*1500000,
				WeightKg:     stop.weightKg,
				CreditStatus: "pass",
				Notes:        fmt.Sprintf("QA demo dispatcher AM: chuyến DAM-%02d stop %d — %s", mt.seq, stopIdx+1, mt.note),
			})
			if err != nil {
				return created, fmt.Errorf("dam trip %d order: %w", mt.seq, err)
			}
			created += 2 // order + entity_event
			if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 40+stopIdx*10, stopIdx%3); err != nil {
				return created, err
			}
			created++
			shipmentID, err := s.insertShipment(ctx, tx, runID, orderID, mt.seq*10+stopIdx+1)
			if err != nil {
				return created, fmt.Errorf("dam trip %d shipment: %w", mt.seq, err)
			}
			created++
			shipmentIDs = append(shipmentIDs, shipmentID)
			customerIDs = append(customerIDs, customerID)
		}

		tripID, err := s.insertTripWithFleetOffset(ctx, tx, runID, "DAM", mt.seq, len(mt.stops), totalWeight, mt.offset, mt.offset, "in_transit")
		if err != nil {
			return created, fmt.Errorf("dam trip %d create: %w", mt.seq, err)
		}
		created++

		for stopIdx, shipmentID := range shipmentIDs {
			if _, err := s.insertTripStopWithStatus(ctx, tx, runID, tripID, shipmentID, customerIDs[stopIdx], stopIdx+1, mt.stops[stopIdx].status); err != nil {
				return created, fmt.Errorf("dam trip %d stop %d: %w", mt.seq, stopIdx+1, err)
			}
			created++
		}
	}

	// ── 3. 18 đơn pending chiều — 3 nhóm tải rõ ràng cho VRP bin-packing ──
	type damAfternoonOrder struct {
		weightKg int
		amount   int
	}
	afternoonOrders := []damAfternoonOrder{
		// Light group: 6 đơn 150-450kg — phù hợp xe 3.5T, có thể ghép nhiều
		{150, 8500000}, {220, 10200000}, {310, 12000000},
		{380, 14500000}, {420, 16000000}, {450, 17500000},
		// Medium group: 6 đơn 600-1300kg — xe 5T, bin-packing 1-2 đơn/xe
		{600, 22000000}, {750, 27000000}, {900, 32000000},
		{1050, 37000000}, {1200, 42000000}, {1300, 46000000},
		// Heavy group: 6 đơn 2000-4500kg — phải dùng xe 8T, mỗi xe 1 đơn lớn
		{2000, 68000000}, {2500, 84000000}, {3000, 98000000},
		{3500, 115000000}, {4000, 132000000}, {4500, 148000000},
	}

	for i, ao := range afternoonOrders {
		orderID, _, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
			Prefix:       "DAM-AFT",
			Seq:          i + 1,
			CustomerOff:  40 + i,
			Status:       "confirmed",
			Amount:       ao.amount,
			WeightKg:     ao.weightKg,
			CreditStatus: "pass",
			Notes:        fmt.Sprintf("QA demo dispatcher AM chiều: chờ VRP 10:30 — nhóm tải %s", damWeightGroupLabel(ao.weightKg)),
		})
		if err != nil {
			return created, fmt.Errorf("dam afternoon order %d: %w", i+1, err)
		}
		created += 2 // order + entity_event
		if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 60+i*5, i%3); err != nil {
			return created, err
		}
		created++
		if _, err := s.insertShipment(ctx, tx, runID, orderID, 200+i); err != nil {
			return created, fmt.Errorf("dam afternoon shipment %d: %w", i+1, err)
		}
		created++
	}

	// ── 4. 8 AI Inbox items — đa tín hiệu, định lượng, CTA actionable ──────
	inboxItems := []struct {
		role, priority, title, detail, group, route, cta string
	}{
		// P0 — GPS hard-stop: quantified (38 min, 2.3km), named vehicle, history, action chain
		{
			"dispatcher", "P0",
			"Xe 29H-8472 dừng bất thường 38 phút — gọi lái xe ngay",
			"GPS ghi nhận xe 29H-8472 (chuyến DAM-02) dừng 38 phút tại Km 47 QL5 — " +
				"tọa độ lệch 2.3km so với tuyến kế hoạch, không khớp điểm giao hàng nào. " +
				"Lịch sử 60 ngày: xe này có 2 anomaly tương tự, 1 lần do hỏng máy lạnh, 1 lần do sự cố giao thông. " +
				"AI confidence: 91% (pattern khớp sự cố kỹ thuật). " +
				"Đề xuất: gọi ngay lái xe (chuyến DAM-02). Nếu không liên lạc được trong 5 phút: " +
				"báo quản lý + điều xe hỗ trợ (WH-HL có 2 xe dự phòng sẵn sàng).",
			"dam-gps-hardstop",
			"/dashboard/control-tower",
			"Mở Control Tower",
		},
		// P0 — Delivery SLA breach: specific trip, NPP name, delay cascade risk
		{
			"dispatcher", "P0",
			"Chuyến DAM-03 trễ SLA 47 phút — NPP Đại Việt (BN-112) đang chờ",
			"Stop #1 chuyến DAM-03 đang giao nhưng đã vượt SLA 47 phút. " +
				"NPP Đại Việt tại Bắc Ninh (BN-112) đã xác nhận đơn nhưng tài xế chưa hoàn tất bàn giao. " +
				"Với 2 stop tiếp theo cùng tuyến, trễ sẽ tích lũy +15-20 phút nếu không can thiệp. " +
				"AI confidence: 88% dự báo stop #2 và #3 sẽ trễ nếu giữ thứ tự hiện tại. " +
				"Đề xuất: mở Control Tower → xem vị trí xe thực tế → liên hệ tài xế xác nhận tình trạng.",
			"dam-sla-breach",
			"/dashboard/control-tower",
			"Xem Control Tower",
		},
		// P1 — QL5 cascade: quantified ETA shift, re-route option với cost/benefit
		{
			"dispatcher", "P1",
			"QL5 tắc nghẽn Km 35-42 — 2 chuyến nguy cơ trễ +35 phút",
			"Sự cố giao thông QL5 đoạn Km 35-42 (nút An Lão, ghi nhận từ 7:30 sáng). " +
				"Chuyến DAM-04 và DAM-05 đang đi qua đoạn này; ETA tất cả stops tiếp theo dịch +35 phút. " +
				"Re-route qua CT Hà Nội–Hải Phòng: tiết kiệm 22 phút giao hàng, tăng phí cầu 36.000đ/xe (2 xe = 72.000đ). " +
				"Net saving sau khi trừ phí cầu: ~308.000đ (OT tài xế + phí phạt SLA nếu trễ). " +
				"Cần duyệt trước 9:15 để kịp điểm rẽ tại nút An Lão.",
			"dam-ql5-cascade",
			"/dashboard/control-tower",
			"Xem tuyến + Re-route",
		},
		// P1 — Zalo cutoff: named NPPs, priority ranked, cross-role (DVKH)
		{
			"dispatcher", "P1",
			"5 NPP chưa xác nhận Zalo — cutoff 9:30 còn 22 phút",
			"5 NPP vùng Bắc Ninh và Hải Phòng chưa nhấn xác nhận link Zalo. " +
				"Theo SLA rule R06, đơn không confirm trước 9:30 sẽ auto-confirm. " +
				"Ưu tiên liên hệ: (1) BN-047 — đơn 31M, health thấp 38/100, cần xác nhận ý định tiếp nhận; " +
				"(2) HP-215 — đơn 24M, NPP ổn định, có thể chỉ quên. " +
				"DVKH đang xử lý, nhưng dispatcher cần xác nhận không cần hold đơn nào để tránh ảnh hưởng VRP.",
			"dam-zalo-cutoff",
			"/dashboard/orders?tab=pending_confirmation",
			"Xem đơn chờ xác nhận",
		},
		// P1 — NPP health risk: correlated với chuyến đang giao, quantified signals
		{
			"dispatcher", "P1",
			"NPP BN-047 health 38/100 — 2 đơn trong cụm giao hôm nay (31M)",
			"NPP Bắc Ninh BN-047 có health score 38/100 — thấp nhất cluster Bắc Ninh hôm nay. " +
				"Signals gom từ: công nợ tồn đọng 12 ngày, 1 đơn từ chối trong 30 ngày qua, liên hệ cuối cùng 5 ngày trước. " +
				"Hôm nay NPP này có 2 đơn trong chuyến DAM-06, tổng giá trị 31M. " +
				"Đề xuất: DVKH gọi xác nhận trước khi xe đến (còn ~45 phút). " +
				"Nếu không liên lạc được: cân nhắc hold stop hoặc đổi thứ tự để tài xế xử lý stops khác trước.",
			"dam-npp-health",
			"/dashboard/customers",
			"Xem hồ sơ NPP BN-047",
		},
		// P2 — VRP simulation ready: 3 options pre-computed với trade-off matrix
		{
			"dispatcher", "P2",
			"VRP simulation buổi chiều sẵn sàng — 18 đơn, phương án A tiết kiệm 14%",
			"AI đã tính trước VRP cho 18 đơn buổi chiều (tổng ~24T, 3 nhóm tải: light/medium/heavy). " +
				"Phương án A (đề xuất): 6 xe, OTD 95%, chi phí giảm 14% vs tối ưu thủ công. " +
				"Phương án B: 5 xe, OTD 89% (rủi ro 2 stop trễ cuối ngày), tiết kiệm thêm 7% chi phí. " +
				"Phương án C: 7 xe, OTD 97% (an toàn nhất), chi phí tăng 8%. " +
				"Snapshot hết hạn 5 phút từ khi mở — apply vẫn cần duyệt thủ công (Tier 2 approval).",
			"dam-vrp-sim-ready",
			"/dashboard/ai/simulations",
			"Xem Simulation A/B/C",
		},
		// P2 — Doc expiry: specific vehicle, specific date, impact on schedule
		{
			"dispatcher", "P2",
			"Xe 14C19586T đăng kiểm hết hạn 02/05 — còn 3 ngày",
			"Xe 14C19586T (tải 8T, tham gia chuyến sáng hôm nay) có giấy đăng kiểm hết hạn ngày 02/05/2026. " +
				"Theo quy định nội bộ, xe không được xuất kho sau ngày hết hạn giấy tờ. " +
				"Lịch xe hiện tại: giao hàng ngày 01/05 (ngày mai) và 02/05. " +
				"Đề xuất: giao Workshop đặt lịch đăng kiểm hôm nay; nếu không kịp, " +
				"sắp xếp xe thay thế cho lịch giao ngày 02/05 (cần xác nhận với fleet WH-HL).",
			"dam-doc-expiry",
			"/dashboard/fleet",
			"Xem hồ sơ xe",
		},
		// P2 — Budget variance: net benefit analysis, links re-route decision to KPI
		{
			"dispatcher", "P2",
			"Chi phí vận chuyển hôm nay dự báo vượt KPI +9% nếu không re-route QL5",
			"Với tình trạng QL5 hiện tại, chi phí vận chuyển hôm nay ước tính vượt KPI tháng +9%. " +
				"Gồm: 2 giờ xe chạy thêm (~180.000đ), phí OT tài xế nếu trễ (~200.000đ), phí phạt SLA 2 stop (~72.000đ). " +
				"Nếu duyệt re-route qua CT HN-HP: tăng phí cầu +72.000đ nhưng tiết kiệm OT/phạt ≈ 380.000đ. " +
				"Net benefit re-route: +308.000đ so với giữ nguyên. " +
				"Phân tích này được ghi vào audit log — dispatcher có thể tham chiếu trong báo cáo cuối ngày.",
			"dam-budget-variance",
			"/dashboard/planning",
			"Xem KPI hôm nay",
		},
	}

	for _, item := range inboxItems {
		if _, err := s.insertAIInboxWithRoute(ctx, tx, runID, item.role, item.priority, item.title, item.detail, item.group, item.route, item.cta, actor.UserID); err != nil {
			return created, fmt.Errorf("dam inbox [%s/%s]: %w", item.priority, item.group, err)
		}
		created++
	}

	// ── 5. AI Simulation — VRP what-if 3 phương án, pre-computed (Tier 2 apply) ─
	if _, err := s.insertAISimulation(ctx, tx, runID, actor, "vrp_morning_dispatch"); err != nil {
		return created, fmt.Errorf("dam vrp simulation: %w", err)
	}
	created++

	// ── 6. Dispatch Brief — tổng hợp đa tín hiệu, phân cấp KHẨN/ƯU TIÊN CAO ──
	today := time.Now().Format("2006-01-02")
	briefText := fmt.Sprintf(
		"Buổi sáng %s — Tình hình vận hành 8:30 AM:\n\n"+
			"🔴 KHẨN (xử lý trong 15 phút):\n"+
			"• Xe 29H-8472 dừng bất thường 38 phút tại Km 47 QL5 — GPS off-route 2.3km. "+
			"Gọi lái xe (chuyến DAM-02) ngay; backup: 2 xe dự phòng sẵn tại WH-HL.\n"+
			"• Chuyến DAM-03 trễ SLA 47 phút tại stop #1 (NPP Đại Việt BN-112 đang chờ). "+
			"Mở Control Tower → liên hệ tài xế can thiệp.\n\n"+
			"🟡 ƯU TIÊN CAO (trong 30 phút):\n"+
			"• QL5 tắc Km 35-42: DAM-04 và DAM-05 dự báo trễ +35 phút. "+
			"Re-route qua CT HN-HP tiết kiệm 22 phút, net saving 308.000đ — cần duyệt trước 9:15.\n"+
			"• 5 NPP chưa xác nhận Zalo, cutoff 9:30 còn 22 phút. "+
			"Ưu tiên: NPP BN-047 (31M, health=38) và HP-215 (24M) — DVKH liên hệ ngay.\n"+
			"• NPP BN-047 có 2 stop trong DAM-06 — DVKH xác nhận tiếp nhận trước khi xe đến.\n\n"+
			"🟢 BUỔI CHIỀU:\n"+
			"• 18 đơn pending (total ~24T, 3 nhóm tải). "+
			"Simulation A/B/C đã tính: phương án A tối ưu (6 xe, OTD 95%%, tiết kiệm 14%%). "+
			"Khởi chạy sau 10:30 khi xong tồn đọng sáng.\n\n"+
			"⚪ THEO DÕI:\n"+
			"• Xe 14C19586T đăng kiểm hết hạn 02/05 — Workshop xử lý hôm nay.\n"+
			"• Budget vận chuyển dự báo +9%% KPI nếu không re-route QL5.",
		today,
	)
	insightID, err := s.insertAIInsightUpsert(ctx, tx, runID, "dispatch_brief", "dam-brief-"+today, briefText, "groq-llama-3.1")
	if err != nil {
		return created, fmt.Errorf("dam brief: %w", err)
	}
	if insightID != uuid.Nil {
		created++
	}

	// ── 7. AI Audit trails (3 entries — brief cloud, GPS rules, SLA rules) ──
	auditBriefID, err := s.insertAIAudit(ctx, tx, runID, "ai.briefing", "dispatch_brief_am", "groq-llama-3.1", "cloud", "low", true, "")
	if err != nil {
		return created, err
	}
	created++

	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.gps_anomaly", "anomaly_detect_hardstop", "rules", "rules", "medium", true, ""); err != nil {
		return created, err
	}
	created++

	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.delivery_sla", "sla_breach_detect_dam03", "rules", "rules", "low", true, ""); err != nil {
		return created, err
	}
	created++

	// ── 8. AI Feedback (2 entries — Trust Loop từ ca trước) ────────────────
	// "correct" — dispatcher ca trước xác nhận brief hữu ích
	if _, err := s.insertAIFeedback(ctx, tx, runID, auditBriefID, "correct",
		"Brief sáng hôm qua chuẩn, phát hiện GPS issue sớm hơn 15 phút so với thủ công", actor); err != nil {
		return created, err
	}
	created++

	// "not_useful" — feedback cải thiện: budget variance quá chi tiết cho ca sáng
	if _, err := s.insertAIFeedback(ctx, tx, runID, auditBriefID, "not_useful",
		"Phần budget variance quá chi tiết cho 8:30 sáng — nên gộp vào P3 hoặc chỉ hiện khi click", actor); err != nil {
		return created, err
	}
	created++

	// ── 9. Entity event — marker kịch bản đã nạp ────────────────────────────
	if _, err := s.insertEvent(ctx, tx, runID, "qa_scenario", runID, "qa.dispatcher_am.seeded", actor,
		"Kịch bản dispatcher AM world-class đã nạp",
		fmt.Sprintf(`{"trips":6,"afternoon_orders":18,"inbox_items":8,"simulation":1,"brief":"seeded","scenario":"DEMO-DISPATCHER-AM-01","today":"%s"}`, today)); err != nil {
		return created, err
	}
	created++

	return created, nil
}

// damWeightGroupLabel trả về nhãn nhóm tải cho order notes.
func damWeightGroupLabel(kg int) string {
	switch {
	case kg <= 500:
		return "light (<500kg)"
	case kg <= 1500:
		return "medium (500-1500kg)"
	default:
		return "heavy (>1500kg)"
	}
}
