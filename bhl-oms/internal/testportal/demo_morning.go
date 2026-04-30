package testportal

// demo_morning.go — DEMO-MORNING-01: Kịch bản buổi sáng điều phối viên
// Dispatcher login lúc 8:30 thấy AI Brief + 5 Inbox ưu tiên + xe đang chạy + đơn chờ VRP.

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// demoscenarioDispatcherMorning trả về metadata cho scenario DEMO-MORNING-01.
func demoscenarioDispatcherMorning() DemoScenario {
	return DemoScenario{
		ID:       "DEMO-MORNING-01",
		Title:    "Buổi sáng điều phối — AI briefing + 5 ưu tiên thực tế",
		Category: "AI-NATIVE/DISPATCH",
		Description: "Mô phỏng lúc 8:30 sáng: dispatcher login và thấy Brief AI tổng hợp tình hình, " +
			"5 Inbox items ưu tiên từ P0→P2 (GPS anomaly, Zalo cutoff, doc expiry, demand drop, QL5 incident), " +
			"5 chuyến in_transit trên Control Tower, và 12 đơn chờ VRP buổi chiều. " +
			"Dữ liệu đủ thực để trình bày giá trị AI-native dispatcher experience.",
		Roles: []string{"qa.demo", "dispatcher", "management"},
		DataSummary: "5 trips in_transit (owned) + 12 pending orders/shipments + 5 AI Inbox items " +
			"+ 1 dispatch_brief cached insight. Cleanup scoped, historical_rows_touched = 0.",
		Steps: []ScenarioStep{
			{Role: "qa.demo", Page: "/test-portal/demo", Action: "Load DEMO-MORNING-01",
				Expected: "historical_rows_touched = 0; 5 trips in_transit, 5 inbox items, 1 brief seeded"},
			{Role: "dispatcher", Page: "/dashboard", Action: "Xem Brief AI + Inbox",
				Expected: "Brief mô tả tình hình sáng nay (QL5, GPS, Zalo); Inbox có P0 GPS + P1 Zalo + P1 Doc + P2 Demand + P2 QL5"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Xem xe đang giao",
				Expected: "5 chuyến in_transit với tiến độ stop khác nhau (delivered/delivering/pending)"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Xem đơn chờ VRP",
				Expected: "12 đơn prefix QA-AFT-* pending, sẵn sàng chạy VRP buổi chiều"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Morning trips", Value: "5 in_transit, mỗi chuyến 3-4 stops"},
			{Label: "Afternoon VRP", Value: "12 đơn QA-AFT-* pending"},
			{Label: "AI Inbox", Value: "P0: GPS anomaly | P1: Zalo cutoff | P1: Doc expiry | P2: Demand drop | P2: QL5 incident"},
			{Label: "Brief AI", Value: "Groq tóm tắt bức tranh sáng nay, cache vào ai_insights"},
		},
	}
}

// seedDispatcherMorning seeds dữ liệu kịch bản buổi sáng điều phối.
// Mọi row đều được đăng ký trong qa_owned_entities. historical_rows_touched = 0.
func (s *DemoService) seedDispatcherMorning(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	// ── 1. Driver check-ins cho 5 tài xế sáng hôm nay ──────────────────────
	checkins, err := s.insertDriverCheckins(ctx, tx, runID, 5)
	if err != nil {
		return created, fmt.Errorf("morning checkins: %w", err)
	}
	created += checkins

	// ── 2. 5 chuyến in_transit (bắt đầu từ ~6:30, đang trên đường) ─────────
	type morningStop struct {
		weightKg   int
		stopStatus string
	}
	type morningTrip struct {
		seq   int
		stops []morningStop
		note  string
	}
	morningTrips := []morningTrip{
		// Trip 1: tuyến WH-HL → Quảng Yên, tiến độ đúng kế hoạch
		{
			seq: 1,
			stops: []morningStop{
				{420, "delivered"},
				{380, "delivered"},
				{510, "delivering"},
				{290, "pending"},
			},
			note: "Tuyến Quảng Yên, đúng tiến độ",
		},
		// Trip 2: xe có GPS anomaly — dừng bất thường tại điểm không phải NPP
		{
			seq: 2,
			stops: []morningStop{
				{600, "delivered"},
				{450, "delivering"},
				{320, "pending"},
			},
			note: "QA demo GPS anomaly: xe dừng >20 phút tại stop 2",
		},
		// Trip 3: tuyến qua QL5, tiến độ chậm, rủi ro trễ
		{
			seq: 3,
			stops: []morningStop{
				{850, "delivered"},
				{720, "delivering"},
				{380, "pending"},
				{290, "pending"},
			},
			note: "Tuyến QL5 — ùn tắc, có thể trễ 25-30 phút",
		},
		// Trip 4: tuyến qua QL5, chưa giao stop nào — rủi ro trễ cao nhất
		{
			seq: 4,
			stops: []morningStop{
				{1100, "delivering"},
				{540, "pending"},
				{620, "pending"},
			},
			note: "Tuyến QL5 — xuất phát muộn, nguy cơ trễ cao",
		},
		// Trip 5: tuyến ngắn Uông Bí, gần xong
		{
			seq: 5,
			stops: []morningStop{
				{380, "delivered"},
				{340, "delivered"},
				{270, "pending"},
			},
			note: "Tuyến Uông Bí, còn 1 điểm giao",
		},
	}

	for tripIdx, mt := range morningTrips {
		shipmentIDs := []uuid.UUID{}
		customerIDs := []uuid.UUID{}

		totalWeight := 0
		for _, st := range mt.stops {
			totalWeight += st.weightKg
		}

		for stopIdx, stop := range mt.stops {
			orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
				Prefix:       "MRN",
				Seq:          tripIdx*6 + stopIdx + 1,
				CustomerOff:  tripIdx*6 + stopIdx,
				Status:       "confirmed",
				Amount:       10000000 + stopIdx*2000000,
				WeightKg:     stop.weightKg,
				CreditStatus: "pass",
				Notes:        fmt.Sprintf("QA demo sáng: chuyến MRN-%02d stop %d — %s", mt.seq, stopIdx+1, mt.note),
			})
			if err != nil {
				return created, fmt.Errorf("morning trip %d order: %w", mt.seq, err)
			}
			created += 2
			if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 40+stopIdx*10, stopIdx%3); err != nil {
				return created, err
			}
			created++
			shipmentID, err := s.insertShipment(ctx, tx, runID, orderID, tripIdx*6+stopIdx+1)
			if err != nil {
				return created, fmt.Errorf("morning trip %d shipment: %w", mt.seq, err)
			}
			created++
			shipmentIDs = append(shipmentIDs, shipmentID)
			customerIDs = append(customerIDs, customerID)
		}

		tripID, err := s.insertTripWithFleetOffset(ctx, tx, runID, "MRN", mt.seq, len(mt.stops), totalWeight, tripIdx, tripIdx, "in_transit")
		if err != nil {
			return created, fmt.Errorf("morning trip %d create: %w", mt.seq, err)
		}
		created++

		for stopIdx, shipmentID := range shipmentIDs {
			status := mt.stops[stopIdx].stopStatus
			if _, err := s.insertTripStopWithStatus(ctx, tx, runID, tripID, shipmentID, customerIDs[stopIdx], stopIdx+1, status); err != nil {
				return created, fmt.Errorf("morning trip %d stop %d: %w", mt.seq, stopIdx+1, err)
			}
			created++
		}
	}

	// ── 3. 12 đơn pending cho VRP buổi chiều ────────────────────────────────
	for i := 0; i < 12; i++ {
		orderID, _, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
			Prefix:       "AFT",
			Seq:          i + 1,
			CustomerOff:  30 + i,
			Status:       "confirmed",
			Amount:       14000000 + i*1500000,
			WeightKg:     350 + i*80,
			CreditStatus: "pass",
			Notes:        "QA demo buổi chiều: shipment chờ VRP kế hoạch 10:30",
		})
		if err != nil {
			return created, fmt.Errorf("afternoon order %d: %w", i+1, err)
		}
		created += 2
		if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 50+i*5, i%3); err != nil {
			return created, err
		}
		created++
		if _, err := s.insertShipment(ctx, tx, runID, orderID, 100+i); err != nil {
			return created, fmt.Errorf("afternoon shipment %d: %w", i+1, err)
		}
		created++
	}

	// ── 4. 5 AI Inbox items — thực tế, đủ chi tiết để dispatcher hành động ──
	inboxItems := []struct {
		role, priority, title, detail, group, route, cta string
	}{
		{
			"dispatcher", "P0",
			"Xe 29H-8472 dừng bất thường > 22 phút — cần xác minh ngay",
			"GPS ghi nhận xe 29H-8472 (chuyến MRN-02) dừng tại tọa độ không phải điểm giao hàng trong 22 phút. " +
				"Trong 30 ngày qua xe này đã có 1 lần anomaly tương tự. " +
				"Đề xuất: gọi tài xế Nguyễn Văn Hùng xác nhận lý do; nếu không liên lạc được trong 5 phút, báo quản lý.",
			"morning-gps-anomaly",
			"/dashboard/control-tower",
			"Mở Control Tower",
		},
		{
			"dispatcher", "P1",
			"7 đơn hàng chưa xác nhận Zalo — cutoff 10:00 còn 1 giờ 20 phút",
			"7 NPP vùng Hải Phòng và Hải Dương chưa nhấn xác nhận link Zalo. " +
				"Nếu không xác nhận trước 10:00, đơn sẽ auto-confirm theo quy trình. " +
				"Đề xuất: DVKH gọi điện trực tiếp cho 3 NPP có tổng đơn lớn nhất (NPP Minh Hòa, NPP Bình An, NPP Thắng Lợi).",
			"morning-zalo-cutoff",
			"/dashboard/orders?tab=pending_confirmation",
			"Xem danh sách đơn",
		},
		{
			"dispatcher", "P1",
			"Xe 14C19586T hết bảo hiểm TNDS sau 5 ngày — cần xử lý hôm nay",
			"Bảo hiểm TNDS xe 14C19586T (tải 8T) hết hạn sau 5 ngày. " +
				"Xe đang tham gia chuyến sáng hôm nay và có kế hoạch giao tuần tới. " +
				"Theo quy định, xe không được xuất kho sau ngày hết hạn. " +
				"Đề xuất: giao Workshop mua gia hạn hôm nay; nếu chưa xong trước ngày hết hạn, điều xe dự phòng.",
			"morning-doc-expiry",
			"/dashboard/fleet",
			"Xem hồ sơ xe",
		},
		{
			"dispatcher", "P2",
			"NPP Minh Hòa (HD-53) đặt hàng thấp hơn 47% so với tuần trước",
			"NPP Minh Hòa tại Hải Dương đặt 4 SKU với tổng 1.2T hôm nay — giảm 47% so với trung bình 2.3T/tuần trước. " +
				"Lần drop tương tự xảy ra 3 tuần trước đi kèm yêu cầu đổi lịch giao do NPP thiếu kho. " +
				"Đề xuất: DVKH gọi xác nhận sớm trước 10:00 để tránh ảnh hưởng VRP buổi chiều.",
			"morning-demand-drop",
			"/dashboard/orders",
			"Xem đơn NPP",
		},
		{
			"dispatcher", "P2",
			"QL5 ùn tắc Km 35 — 4 chuyến có thể trễ 25-40 phút",
			"Sự cố giao thông QL5 đoạn Km 35-42 gần nút giao An Lão (ghi nhận 7:45 sáng). " +
				"Chuyến MRN-03 và MRN-04 đang đi qua đoạn này; 2 chuyến buổi chiều cũng sẽ qua đây. " +
				"Simulation đề xuất re-route qua CT Hà Nội–Hải Phòng: tiết kiệm 20-25 phút nhưng tăng 18.000đ phí cầu/xe. " +
				"Cần duyệt thủ công trước 9:15 để kịp thời điểm rẽ.",
			"morning-road-incident",
			"/dashboard/control-tower",
			"Xem trên bản đồ",
		},
	}
	for _, item := range inboxItems {
		if _, err := s.insertAIInboxWithRoute(ctx, tx, runID, item.role, item.priority, item.title, item.detail, item.group, item.route, item.cta, actor.UserID); err != nil {
			return created, fmt.Errorf("morning inbox [%s]: %w", item.priority, err)
		}
		created++
	}

	// ── 5. Dispatch Brief — seed/override cache ai_insights cho hôm nay ─────
	// Brief text được viết sẵn thực tế, sẽ xuất hiện ngay khi dispatcher mở Dashboard.
	today := time.Now().Format("2006-01-02")
	briefText := fmt.Sprintf(
		"Buổi sáng %s: 5 chuyến đang chạy với 17 điểm giao. "+
			"Cần xử lý ngay: xe 29H-8472 dừng bất thường 22 phút (chuyến MRN-02) — gọi tài xế xác minh. "+
			"Tuyến QL5 tắc nghẽn ảnh hưởng 4 chuyến — đề xuất re-route qua CT trước 9:15 tránh trễ thêm 25-40 phút. "+
			"7 đơn Hải Phòng/Hải Dương chưa xác nhận Zalo, cutoff 10:00 còn 1 giờ 20 phút — DVKH gọi ngay NPP Minh Hòa/Bình An/Thắng Lợi. "+
			"Chiều nay: 12 đơn sẵn sàng chạy VRP, đề xuất khởi chạy 10:30 sau khi xử lý tồn đọng sáng xong. "+
			"NPP Minh Hòa giảm 47%% sản lượng — DVKH theo dõi để tránh ảnh hưởng kế hoạch tuần tới.",
		today,
	)
	insightID, err := s.insertAIInsightUpsert(ctx, tx, runID, "dispatch_brief", today, briefText, "groq-llama-3.1")
	if err != nil {
		return created, fmt.Errorf("morning brief: %w", err)
	}
	if insightID != uuid.Nil {
		created++
	}

	// ── 6. Audit trail ────────────────────────────────────────────────────────
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.briefing", "dispatch_brief", "groq-llama-3.1", "cloud", "low", true, ""); err != nil {
		return created, err
	}
	created++

	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.gps_anomaly", "anomaly_detect", "rules", "rules", "medium", true, ""); err != nil {
		return created, err
	}
	created++

	if _, err := s.insertEvent(ctx, tx, runID, "qa_scenario", runID, "qa.morning_dispatch.seeded", actor,
		"Kịch bản buổi sáng điều phối đã nạp",
		`{"trips":5,"pending_orders":12,"inbox_items":5,"brief":"seeded","scenario":"DEMO-MORNING-01"}`); err != nil {
		return created, err
	}
	created++

	return created, nil
}

// insertAIInsightUpsert upserts một row vào ai_insights và đăng ký ownership.
// Dùng ON CONFLICT để tránh lỗi khi brief của ngày hôm nay đã tồn tại.
func (s *DemoService) insertAIInsightUpsert(ctx context.Context, tx pgx.Tx, runID uuid.UUID, insightType, entityID, content, provider string) (uuid.UUID, error) {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO ai_insights (insight_type, entity_id, content, provider, generated_at, expires_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '12 hours')
		ON CONFLICT (insight_type, entity_id)
		DO UPDATE SET
			content      = EXCLUDED.content,
			provider     = EXCLUDED.provider,
			generated_at = NOW(),
			expires_at   = NOW() + INTERVAL '12 hours'
		RETURNING id
	`, insightType, entityID, content, provider).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("upsert ai_insight %s/%s: %w", insightType, entityID, err)
	}
	return id, s.repo.RecordEntity(ctx, tx, runID, "ai_insights", id)
}
