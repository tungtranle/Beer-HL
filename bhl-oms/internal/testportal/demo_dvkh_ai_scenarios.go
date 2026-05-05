package testportal

import (
	"context"

	"github.com/jackc/pgx/v5"

	"github.com/google/uuid"
)

// seedAIDVKHOutreach seeds scenario DEMO-AI-DVKH-01:
// DVKH mở app → AI Outreach Queue hiển thị NPP ưu tiên liên hệ hôm nay →
// thấy lý do kết hợp công nợ quá hạn + nhịp đặt hàng giảm → copilot gợi ý Zalo draft.
// Core workflow vẫn chạy khi ai.master OFF.
func (s *DemoService) seedAIDVKHOutreach(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	// Tạo 1 đơn pending_approval để DVKH thấy NPP có rủi ro thực sự
	orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
		Prefix:       "DVKH01",
		Seq:          1,
		CustomerOff:  3,
		Status:       "pending_approval",
		Amount:       38500000,
		WeightKg:     1250,
		CreditStatus: "exceed",
		Notes:        "QA DEMO-AI-DVKH-01: NPP rủi ro cao — vượt hạn mức, nhịp đặt giảm 3 tuần liên tiếp",
	})
	if err != nil {
		return created, err
	}
	created += 2
	if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 180, 0); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertReceivable(ctx, tx, runID, customerID, orderID, actor); err != nil {
		return created, err
	}
	created++

	// 3 AI Inbox items cho role "dvkh" — outreach queue: NPP cần gọi hôm nay
	inboxItems := []struct {
		priority, title, detail, group, route string
	}{
		{
			"P0",
			"NPP A: Vượt hạn mức + nhịp đặt giảm 3 tuần",
			"Công nợ 38.5M vượt hạn mức; số lượng đặt hàng tuần này giảm 40% so với trung bình 4 tuần. AI gợi ý gọi ngay để xác nhận kế hoạch lấy hàng.",
			"ai-dvkh-outreach-high",
			"/dashboard/customers",
		},
		{
			"P1",
			"NPP B: Chưa đặt hàng 10 ngày — mùa vụ sắp tới",
			"Nhịp đặt hàng bình thường 5-7 ngày/lần; đã 10 ngày chưa có đơn mới. Lịch sử: cùng kỳ năm ngoái NPP này đặt 30% nhiều hơn.",
			"ai-dvkh-outreach-medium",
			"/dashboard/customers",
		},
		{
			"P2",
			"NPP C: Tồn kho ước tính thấp — cần re-order",
			"Dựa trên tốc độ bán hàng trung bình, AI ước tính tồn kho NPP C còn ~5 ngày. Đề xuất nhắc nhở đặt bổ sung.",
			"ai-dvkh-outreach-low",
			"/dashboard/customers",
		},
	}
	for _, item := range inboxItems {
		if _, err := s.insertAIInboxWithRoute(ctx, tx, runID, "dvkh", item.priority, item.title, item.detail, item.group, item.route, "Xem NPP", uuid.Nil); err != nil {
			return created, err
		}
		created++
	}

	// Audit evidence: credit_score + forecast rules engine (routes = rules, không cần cloud)
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.credit_score", "outreach_queue_score", "local-rules", "rules", "medium", true, ""); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.forecast", "demand_signal_check", "local-rules", "rules", "low", true, ""); err != nil {
		return created, err
	}
	created++

	return created, nil
}

// seedAIDVKHForecast seeds scenario DEMO-AI-DVKH-02:
// DVKH tạo đơn mới → thấy seasonal alert "dịp lễ sắp tới" + demand forecast 4 tuần →
// AI gợi ý tăng sản lượng → DVKH review và quyết định đặt bổ sung.
// Core workflow tạo đơn vẫn bình thường khi ai.forecast OFF.
func (s *DemoService) seedAIDVKHForecast(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	// 1 đơn confirmed để minh họa luồng tạo đơn bình thường
	orderID, _, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
		Prefix:       "DVKH02",
		Seq:          1,
		CustomerOff:  1,
		Status:       "confirmed",
		Amount:       22000000,
		WeightKg:     800,
		CreditStatus: "pass",
		Notes:        "QA DEMO-AI-DVKH-02: Đơn demo seasonal forecast — DVKH thấy gợi ý tăng sản lượng dịp lễ",
	})
	if err != nil {
		return created, err
	}
	created += 2
	if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 120, 0); err != nil {
		return created, err
	}
	created++

	// AI Inbox items cho "dvkh": seasonal alert + demand forecast
	inboxItems := []struct {
		priority, title, detail, group, route string
	}{
		{
			"P1",
			"Cảnh báo mùa vụ: Lễ 30/4 - 1/5 còn 3 tuần",
			"Lịch sử 2 năm gần nhất: sản lượng tăng trung bình 28% trong 2 tuần trước lễ. Các NPP khu vực HN/HP thường đặt sớm hơn 10 ngày. Đề xuất chủ động liên hệ ngay.",
			"ai-dvkh-seasonal-alert",
			"/dashboard/orders/new",
		},
		{
			"P1",
			"Dự báo 4 tuần: 3 NPP có xu hướng tăng nhanh",
			"AI dự báo NPP A tăng 25%, NPP D tăng 18%, NPP G tăng 31% so với 4 tuần trước. Đề xuất chủ động đặt lịch gặp để lên đơn trước.",
			"ai-dvkh-demand-forecast",
			"/dashboard/customers",
		},
		{
			"P2",
			"2 NPP chưa đáp ứng dự báo tuần này",
			"NPP B và NPP E có mức đặt hàng thực tế thấp hơn dự báo 20%. Nguyên nhân có thể do tồn kho chưa giải phóng hoặc cần tư vấn thêm.",
			"ai-dvkh-forecast-gap",
			"/dashboard/customers",
		},
	}
	for _, item := range inboxItems {
		if _, err := s.insertAIInboxWithRoute(ctx, tx, runID, "dvkh", item.priority, item.title, item.detail, item.group, item.route, "Xem dự báo", uuid.Nil); err != nil {
			return created, err
		}
		created++
	}

	// Audit evidence: forecast via rules (không cần cloud LLM)
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.forecast", "seasonal_alert_check", "local-rules", "rules", "low", true, ""); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.forecast", "demand_forecast_4w", "local-rules", "rules", "low", true, ""); err != nil {
		return created, err
	}
	created++

	return created, nil
}

// seedAIDVKHCopilot seeds scenario DEMO-AI-DVKH-03:
// DVKH dùng Copilot chat tìm NPP chưa đặt hàng tuần này → nhận trả lời kèm data →
// xem "Vì sao?" explainability popover → gửi feedback.
// Progressive enhancement: Copilot panel không render nếu ai.copilot OFF.
func (s *DemoService) seedAIDVKHCopilot(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	// AI Inbox items cho "dvkh": copilot insight + zalo draft suggestion
	inboxItems := []struct {
		priority, title, detail, group, route string
	}{
		{
			"P1",
			"Copilot: 5 NPP chưa đặt hàng tuần này",
			"Kết quả truy vấn Copilot: NPP A, C, E, H, K chưa có đơn nào trong 7 ngày qua. Tất cả đều có lịch sử đặt hàng tuần. Click để xem danh sách chi tiết.",
			"ai-dvkh-copilot-query",
			"/dashboard/customers",
		},
		{
			"P2",
			"AI đề xuất: Soạn Zalo cho 3 NPP có sẵn context",
			"Dựa trên lịch sử công nợ và nhịp đặt hàng, AI đã chuẩn bị draft Zalo cho NPP A, C và E. DVKH review nội dung trước khi gửi.",
			"ai-dvkh-zalo-draft",
			"/dashboard/customers",
		},
	}
	for _, item := range inboxItems {
		if _, err := s.insertAIInboxWithRoute(ctx, tx, runID, "dvkh", item.priority, item.title, item.detail, item.group, item.route, "Mở Copilot", uuid.Nil); err != nil {
			return created, err
		}
		created++
	}

	// Audit evidence: copilot cloud query + intent local + zalo draft cloud
	cloudAuditID, err := s.insertAIAudit(ctx, tx, runID, "ai.copilot", "dvkh_chat_query", "groq-llama-3.1", "cloud", "low", true, "")
	if err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.intent", "intent_match_customers", "local-rules", "rules", "low", true, ""); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.copilot", "npp_zalo_draft", "groq-llama-3.1", "cloud", "low", true, ""); err != nil {
		return created, err
	}
	created++

	// Feedback từ DVKH: copilot hữu ích
	if _, err := s.insertAIFeedback(ctx, tx, runID, cloudAuditID, "correct", "QA DEMO-AI-DVKH-03: Copilot trả lời đúng danh sách NPP", actor); err != nil {
		return created, err
	}
	created++

	return created, nil
}
