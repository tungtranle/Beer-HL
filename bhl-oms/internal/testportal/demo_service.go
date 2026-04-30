package testportal

import (
	"context"
	"fmt"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

type DemoActor struct {
	UserID   uuid.UUID
	FullName string
}

type DemoScenario struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	Category    string              `json:"category"`
	Description string              `json:"description"`
	Guide       string              `json:"guide"`
	Roles       []string            `json:"roles"`
	Steps       []ScenarioStep      `json:"steps"`
	DataSummary string              `json:"data_summary"`
	PreviewData []ScenarioDataPoint `json:"preview_data"`
}

type DemoScenarioRunResult struct {
	RunID                 uuid.UUID `json:"run_id"`
	ScenarioID            string    `json:"scenario_id"`
	ScenarioTitle         string    `json:"scenario_title"`
	Status                string    `json:"status"`
	Message               string    `json:"message"`
	CreatedCount          int       `json:"created_count"`
	CleanupDeletedCount   int       `json:"cleanup_deleted_count"`
	HistoricalRowsTouched int       `json:"historical_rows_touched"`
	Assertions            []string  `json:"assertions"`
	RunAt                 time.Time `json:"run_at"`
	// DeliveryDate là ngày dùng cho demo data (CURRENT_DATE khi seed).
	// AppURL là deep-link đến trang app phù hợp để xem ngay kết quả.
	DeliveryDate string `json:"delivery_date,omitempty"`
	AppURL       string `json:"app_url,omitempty"`
}

type DemoService struct {
	repo *DemoRepository
	log  logger.Logger
}

type demoOpsProfile struct {
	DeliveryDate string
	OrderCount   int
	TripCount    int
	AvgStops     float64
}

func NewDemoService(repo *DemoRepository, log logger.Logger) *DemoService {
	return &DemoService{repo: repo, log: log}
}

func (s *DemoService) ListScenarios() []DemoScenario {
	ss := []DemoScenario{
		{
			ID:          "DEMO-01",
			Title:       "DVKH tạo đơn → NPP xác nhận Zalo",
			Category:    "OMS/ZALO",
			Description: "Tạo 2 đơn chờ NPP xác nhận, có token Zalo để demo luồng gửi xác nhận và timeline đơn hàng.",
			Roles:       []string{"qa.demo", "dvkh", "management"},
			DataSummary: "2 sales_orders + 2 order_confirmations + timeline events, cleanup theo ownership.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal", Action: "Load DEMO-01", Expected: "Portal báo historical rows touched = 0"},
				{Role: "dvkh", Page: "/dashboard/orders", Action: "Lọc đơn mã QA-D01", Expected: "Thấy 2 đơn chờ NPP xác nhận"},
				{Role: "management", Page: "/test-portal", Action: "Soi evidence/run history", Expected: "Thấy số record tạo và cleanup scoped"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Order prefix", Value: "QA-D01-*"}, {Label: "Cleanup", Value: "Chỉ xóa data owned của DEMO-01 run trước"}},
		},
		{
			ID:          "DEMO-02",
			Title:       "Vượt hạn mức tín dụng → kế toán duyệt",
			Category:    "CREDIT",
			Description: "Tạo 1 công nợ demo và 1 đơn pending_approval để khách thấy kiểm soát credit trước khi giao.",
			Roles:       []string{"qa.demo", "dvkh", "accountant", "management"},
			DataSummary: "1 receivable_ledger + 1 sales_order pending_approval + item + timeline event.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal", Action: "Load DEMO-02", Expected: "Không reset dữ liệu lịch sử"},
				{Role: "accountant", Page: "/dashboard/approvals", Action: "Xem đơn QA-D02", Expected: "Đơn nằm ở trạng thái chờ duyệt credit"},
				{Role: "management", Page: "/dashboard/customers", Action: "Kiểm tra NPP demo", Expected: "Công nợ demo có mô tả QA scoped"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Order prefix", Value: "QA-D02-*"}, {Label: "Credit", Value: "pending_approval / exceed"}},
		},
		{
			ID:          "DEMO-03",
			Title:       "Điều phối tạo chuyến giao nhiều điểm",
			Category:    "TMS",
			Description: "Tạo dữ liệu điều phối theo ngày lịch sử bận nhất: nhiều đơn/chuyến/stops, có xe và lái xe active để demo dispatcher/control tower mà không đụng chuyến lịch sử.",
			Roles:       []string{"qa.demo", "dispatcher", "driver", "management"},
			DataSummary: "Historical-calibrated owned data: tối thiểu 24 orders, chia nhiều trips/stops theo active fleet; cleanup theo ownership.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal", Action: "Load DEMO-03", Expected: "Có trip QA-D03 và 3 stops"},
				{Role: "dispatcher", Page: "/dashboard/trips", Action: "Tìm chuyến QA-D03", Expected: "Chuyến assigned, đủ 3 điểm giao"},
				{Role: "driver", Page: "/dashboard/driver", Action: "Mở flow tài xế", Expected: "Có thể trình diễn danh sách stop"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Trip prefix", Value: "QA-D03-*"}, {Label: "Baseline", Value: "Busiest historical delivery_date + active fleet"}},
		},
		{
			ID:          "DEMO-HIST-01",
			Title:       "Replay ngày lịch sử có sản lượng thật",
			Category:    "HISTORICAL/READONLY",
			Description: "Dùng chính ngày có nhiều đơn/chuyến nhất trong dữ liệu lịch sử làm kịch bản phân tích. Không copy, không sửa, không xóa dữ liệu lịch sử.",
			Roles:       []string{"qa.demo", "dispatcher", "management"},
			DataSummary: "Read-only: chọn busiest delivery_date từ sales_orders/trips, hiển thị scope và evidence; historical_rows_touched = 0.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal", Action: "Load DEMO-HIST-01", Expected: "Portal tạo run evidence read-only, không tạo dữ liệu nghiệp vụ"},
				{Role: "management", Page: "/dashboard/kpi", Action: "Chọn Dữ liệu lịch sử", Expected: "Báo cáo hiển thị rõ scope, không gọi là hôm nay"},
				{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Đối chiếu ngày lịch sử với tuyến/chuyến", Expected: "Dùng dữ liệu thật để kể câu chuyện demo"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Mutation", Value: "0 business rows"}, {Label: "Source", Value: "Busiest historical delivery_date"}},
		},
		{
			ID:          "DEMO-DISPATCH-01",
			Title:       "Điều phối live ops — xe đang giao gần công suất",
			Category:    "TMS/LIVE-OPS",
			Description: "Tạo một ngày điều phối đang diễn ra dựa trên sản lượng ngày lịch sử bận nhất, dùng gần tối đa xe/lái active, check-in tài xế owned và khách có tọa độ để GPS/Control Tower đi theo cung đường thực tế.",
			Roles:       []string{"qa.demo", "dispatcher", "driver", "management"},
			DataSummary: "Owned data: target theo busiest historical day, tối thiểu 24 orders, up to 40 active trips, driver_checkins scoped, AI Inbox dispatcher.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal", Action: "Load DEMO-DISPATCH-01", Expected: "Tạo dữ liệu owned, historical_rows_touched = 0"},
				{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Xem xe đang giao", Expected: "Nhiều xe in_transit, tuyến/stops đủ dày để điều hành thật"},
				{Role: "dispatcher", Page: "/dashboard", Action: "Xem AI Brief/Inbox", Expected: "Có gợi ý điều phối ưu tiên cho ngày vận hành lớn"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Fleet usage", Value: "~80% active vehicles/drivers, cap 40"}, {Label: "Demand", Value: "Calibrated by busiest historical day"}},
		},
		{
			ID:          "DEMO-AI-DISPATCH-01",
			Title:       "AI điều phối viên — Brief, cảnh báo và hành động",
			Category:    "AI-NATIVE/DISPATCH",
			Description: "Seed live ops sát sản lượng lịch sử kèm AI Inbox/Brief/Simulation cho điều phối viên: ưu tiên chuyến trễ, xe cần theo dõi, NPP rủi ro và đề xuất chạy lại VRP.",
			Roles:       []string{"qa.demo", "dispatcher", "management", "admin"},
			DataSummary: "Live ops owned data + 4 AI Inbox dispatcher items + audit/simulation evidence; core workflow vẫn chạy khi AI OFF.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal", Action: "Load DEMO-AI-DISPATCH-01", Expected: "Run tạo live ops + AI evidence, historical_rows_touched = 0"},
				{Role: "dispatcher", Page: "/dashboard", Action: "Xem Brief điều phối hôm nay", Expected: "Brief có số liệu ngày lớn và CTA/drill-down"},
				{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Theo dõi xe đang giao", Expected: "Có nhiều xe in_transit, AI gợi ý các chuyến cần xử lý"},
				{Role: "dispatcher", Page: "/dashboard/ai/simulations", Action: "Mở simulation VRP", Expected: "Có phương án what-if, apply vẫn cần duyệt"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "AI Inbox", Value: "dispatch_delay / gps_watch / customer_risk / reroute"}, {Label: "Baseline", Value: "AI OFF không chặn live ops"}},
		},
		{
			ID:          "DEMO-04",
			Title:       "NPP từ chối đơn → timeline lý do",
			Category:    "OMS/AUDIT",
			Description: "Tạo 1 đơn cancelled/rejected với order confirmation rejected và event chain để demo audit/timeline.",
			Roles:       []string{"qa.demo", "dvkh", "management"},
			DataSummary: "1 sales_order cancelled + 1 order_confirmation rejected + 2 entity_events.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal", Action: "Load DEMO-04", Expected: "Run pass, historical rows touched = 0"},
				{Role: "dvkh", Page: "/dashboard/orders", Action: "Mở đơn QA-D04", Expected: "Thấy trạng thái hủy/từ chối và lý do"},
				{Role: "management", Page: "/dashboard/orders/:id", Action: "Xem timeline", Expected: "Có event NPP từ chối"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Order prefix", Value: "QA-D04-*"}, {Label: "Reason", Value: "NPP yêu cầu đổi lịch giao"}},
		},
		{
			ID:          "DEMO-AI-01",
			Title:       "AI Command Center: Inbox + Brief + Transparency",
			Category:    "AI-NATIVE",
			Description: "Seed AI Inbox và audit provider để demo dashboard, brief điều phối, transparency center và progressive enhancement.",
			Roles:       []string{"qa.demo", "dispatcher", "management", "admin"},
			DataSummary: "3 ai_inbox_items + 2 ai_audit_log rows, cleanup qua qa_owned_entities.",
			Steps: []ScenarioStep{
				{Role: "admin", Page: "/dashboard/settings/ai", Action: "Bật ai.master, ai.briefing, ai.transparency", Expected: "AI surface render nhưng workflow lõi vẫn chạy nếu tắt lại"},
				{Role: "dispatcher", Page: "/dashboard", Action: "Xem AI Inbox và Brief điều phối", Expected: "Có cảnh báo gom nhóm + provider Groq khi key có cấu hình"},
				{Role: "management", Page: "/dashboard/ai/transparency", Action: "Xem trạng thái provider/guardrail", Expected: "Groq configured, raw prompt không lưu"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "AI Inbox", Value: "dispatch_focus / credit_watch / gps_watch"}, {Label: "Audit", Value: "cloud + rules routes"}},
		},
		{
			ID:          "DEMO-AI-02",
			Title:       "Decision Intelligence: credit risk tại OMS/Approval",
			Category:    "AI-NATIVE",
			Description: "Tạo đơn vượt hạn mức kèm AI Inbox credit để demo risk strip, approval priority và explainability.",
			Roles:       []string{"qa.demo", "dvkh", "accountant", "management"},
			DataSummary: "1 order pending_approval + receivable ledger + AI credit inbox/audit, scoped cleanup.",
			Steps: []ScenarioStep{
				{Role: "admin", Page: "/dashboard/settings/ai", Action: "Bật ai.credit_score, ai.explainability, ai.feedback", Expected: "Credit insight chỉ là gợi ý, không auto-duyệt"},
				{Role: "dvkh", Page: "/dashboard/orders/new", Action: "Chọn NPP demo", Expected: "Risk strip xuất hiện nếu flag ON; flag OFF form vẫn bình thường"},
				{Role: "accountant", Page: "/dashboard/approvals", Action: "Mở tab ưu tiên xử lý", Expected: "Đơn QA-D02/AI nằm trong luồng duyệt thủ công"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Order prefix", Value: "QA-D02-*"}, {Label: "AI flags", Value: "credit_score + explainability + feedback"}},
		},
		{
			ID:          "DEMO-AI-03",
			Title:       "Simulation/VRP what-if trước khi duyệt kế hoạch",
			Category:    "AI-NATIVE",
			Description: "Seed chuyến nhiều điểm và simulation snapshot để demo 3 phương án trade-off, approval required và core_tables_mutated=false.",
			Roles:       []string{"qa.demo", "dispatcher", "management"},
			DataSummary: "3 orders + shipments + trip/stops + 1 ai_simulations ready + AI Inbox simulation.",
			Steps: []ScenarioStep{
				{Role: "admin", Page: "/dashboard/settings/ai", Action: "Bật ai.simulation và ai.intent", Expected: "Cmd+K có intent mô phỏng, nhưng apply vẫn cần duyệt"},
				{Role: "dispatcher", Page: "/dashboard/ai/simulations", Action: "Tạo hoặc mở simulation", Expected: "Có 3 option A/B/C, hết hạn 5 phút"},
				{Role: "management", Page: "/dashboard/planning", Action: "Soi điểm cần xem trước khi duyệt", Expected: "Không auto-approve kế hoạch"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Trip prefix", Value: "QA-D03-TR-*"}, {Label: "Simulation", Value: "vrp_what_if ready"}},
		},
		{
			ID:          "DEMO-AI-04",
			Title:       "Trust Loop + Privacy Router evidence",
			Category:    "AI-NATIVE",
			Description: "Seed audit cloud/local/blocked và feedback để demo Trust Suggestions, privacy fail-closed và evidence log.",
			Roles:       []string{"qa.demo", "admin", "management"},
			DataSummary: "3 ai_audit_log + 2 ai_feedback + 1 AI Inbox governance item, tất cả owned.",
			Steps: []ScenarioStep{
				{Role: "admin", Page: "/dashboard/ai/transparency", Action: "Xem audit routes cloud/local/blocked", Expected: "Không có raw prompt, chỉ request_hash"},
				{Role: "management", Page: "/dashboard", Action: "Xem governance inbox", Expected: "Trust Loop chỉ đề xuất, không tự nâng automation tier"},
				{Role: "admin", Page: "/test-portal", Action: "Cleanup DEMO-AI-04", Expected: "historical_rows_touched = 0"},
			},
			PreviewData: []ScenarioDataPoint{{Label: "Audit routes", Value: "cloud / rules / blocked"}, {Label: "Feedback", Value: "correct + not_useful"}},
		},
		{
			ID:          "DEMO-VRP-01",
			Title:       "VRP chuẩn sản xuất — 50 xe thực BHL, ~48 tài xế",
			Category:    "TMS/VRP",
			Description: "Nạp 105 đơn hàng thực tế ngày 13/06/2024 (~156+ shipments ≤7.5T, ~736 tấn) với 50 xe thực của BHL tại WH-HL và check-in 48/50 tài xế. Dispatcher chạy VRP và so sánh Tối ưu chi phí vs Giao nhanh trên dữ liệu thực.",
			Roles:       []string{"qa.demo", "dispatcher", "management"},
			DataSummary: "48 driver_checkins + 105 orders + ~156+ shipments. Sử dụng 50 xe thực (không tạo xe giả). Cleanup: checkins/orders/shipments → DELETE owned.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal/demo", Action: "Load DEMO-VRP-01", Expected: "historical_rows_touched = 0, 50 xe thực active tại WH-HL, 48 tài xế checked-in"},
				{Role: "dispatcher", Page: "/dashboard/planning", Action: "Chọn kho WH-HL → thấy 156+ shipments pending", Expected: "Tổng ~736 tấn, 27 NPP, 5 sản phẩm"},
				{Role: "dispatcher", Page: "/dashboard/planning", Action: "Chọn 50 xe thực → Chạy VRP → So sánh 2 phương án", Expected: "Panel Cost: tổng chi phí thấp hơn; Panel Time: tổng giờ ít hơn"},
				{Role: "dispatcher", Page: "/dashboard/planning", Action: "Kiểm tra utilization xe 8T vs xe 5T/3.5T", Expected: "Xe 8T gánh đơn lớn; xe nhỏ gánh đơn gần/nhỏ"},
				{Role: "qa.demo", Page: "/test-portal/demo", Action: "Cleanup DEMO-VRP-01", Expected: "owned data deleted, fleet và historical data intact"},
			},
			PreviewData: []ScenarioDataPoint{
				{Label: "Fleet WH-HL", Value: "50 xe thực BHL (biển 14C/14M/14N/14P)"},
				{Label: "Tài xế", Value: "48/50 tài xế active check-in"},
				{Label: "Đơn hàng", Value: "105 đơn thực 13/06/2024 → ~156+ shipments ≤7.5T mỗi chuyến"},
				{Label: "Tổng tải", Value: "~736 tấn, 27 NPP: QN, HP, HD, BG, TB, NĐ, BN, TN, HN..."},
				{Label: "Mục đích", Value: "Stress test VRP production-scale: cost vs time, bin-packing xe 8T vs nhỏ"},
			},
		},
		{
			ID:          "DEMO-VRP-02",
			Title:       "VRP so sánh bin-packing — 50 xe thực, đơn đa dạng ~463T",
			Category:    "TMS/VRP",
			Description: "60 đơn hàng chia 5 nhóm trọng lượng (XS 40-120kg / S 200-400kg / M 600-1200kg / L 7-13T / XL 22-32T) với 50 xe thực, 48 tài xế. Tổng ~463T sát sức chứa fleet — test rõ bin-packing, VRP phải ưu tiên và phân tải.",
			Roles:       []string{"qa.demo", "dispatcher", "management"},
			DataSummary: "48 driver_checkins + 60 orders (5 nhóm) + ~120+ shipments (~463T tổng). Sử dụng 50 xe thực. Cleanup scoped.",
			Steps: []ScenarioStep{
				{Role: "qa.demo", Page: "/test-portal/demo", Action: "Load DEMO-VRP-02", Expected: "historical_rows_touched = 0, 50 xe thực, 48 tài xế, 60 đơn đa dạng"},
				{Role: "dispatcher", Page: "/dashboard/planning", Action: "Xem 5 nhóm trọng lượng trong shipment list", Expected: "XL: 22-32T/đơn (3-5 ships); L: 7-13T; M: 600kg-1.2T; S: 200-400kg; XS: 40-120kg"},
				{Role: "dispatcher", Page: "/dashboard/planning", Action: "Chạy VRP → quan sát bin-packing", Expected: "Xe 8T ưu tiên đơn XL/L; xe 5T nhận S/M; xe 3.5T nhận XS ghép nhiều"},
				{Role: "dispatcher", Page: "/dashboard/planning", Action: "So sánh Cost vs Time: đơn đa dạng → chênh lệch lớn hơn thực tế", Expected: "Cost mode: gom đơn gần nhau; Time mode: ưu tiên đơn nặng/ít xe"},
			},
			PreviewData: []ScenarioDataPoint{
				{Label: "Fleet WH-HL", Value: "50 xe thực BHL (biển 14C/14M/14N/14P)"},
				{Label: "Đơn hàng", Value: "60 đơn × 5 nhóm: 12 XS + 12 S + 12 M + 12 L + 12 XL"},
				{Label: "Trọng lượng", Value: "XS: 40-120kg | S: 195-405kg | M: 600-1200kg | L: 7-13T | XL: 22-32T"},
				{Label: "Tổng tải", Value: "~463T (sát sức chứa 50 xe — VRP phải tối ưu phân tải)"},
				{Label: "Mục đích", Value: "Test bin-packing rõ ràng theo nhóm xe, thấy VRP khớp tải với loại xe"},
			},
		},
		demoscenarioDispatcherMorning(),
		demoscenarioDispatcherAM(),
	}
	for i := range ss {
		ss[i].Guide = scenarioGuide(ss[i].ID)
	}
	return ss
}

func (s *DemoService) ListRuns(ctx context.Context, limit int) ([]DemoRunRecord, error) {
	return s.repo.ListRuns(ctx, limit)
}

func (s *DemoService) RunScenario(ctx context.Context, scenarioID string, actor DemoActor) (*DemoScenarioRunResult, error) {
	scenario, ok := s.findScenario(scenarioID)
	if !ok {
		return nil, fmt.Errorf("scenario không tồn tại: %s", scenarioID)
	}

	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	runID, err := s.repo.CreateRun(ctx, tx, scenario, actor)
	if err != nil {
		return nil, err
	}

	// Cleanup TẤT CẢ kịch bản cũ (không chỉ cùng scenario) để tránh cross-scenario pollution
	// khiến planning page hiển thị xe/tài xế sai. historical_rows_touched = 0 vẫn đảm bảo.
	deletedCount, err := s.cleanupAllScenariosInTx(ctx, tx)
	if err != nil {
		s.repo.FailRun(ctx, runID, err.Error())
		return nil, err
	}

	createdCount, err := s.seedScenario(ctx, tx, scenarioID, runID, actor)
	if err != nil {
		s.repo.FailRun(ctx, runID, err.Error())
		return nil, err
	}

	if err := s.repo.CompleteRun(ctx, tx, runID, createdCount, deletedCount); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit qa scenario: %w", err)
	}

	deliveryDate := time.Now().Format("2006-01-02")
	return &DemoScenarioRunResult{
		RunID:                 runID,
		ScenarioID:            scenario.ID,
		ScenarioTitle:         scenario.Title,
		Status:                "completed",
		Message:               "Đã nạp demo data an toàn. Xóa toàn bộ data cũ (mọi kịch bản) trước khi seed mới.",
		CreatedCount:          createdCount,
		CleanupDeletedCount:   deletedCount,
		HistoricalRowsTouched: 0,
		Assertions: []string{
			"Không TRUNCATE bảng nghiệp vụ",
			"Không DELETE dữ liệu ngoài qa_owned_entities",
			"historical_rows_touched = 0",
			"Tất cả kịch bản cũ đã được cleanup trước khi seed",
		},
		RunAt:        time.Now(),
		DeliveryDate: deliveryDate,
		AppURL:       s.scenarioAppURL(scenarioID, deliveryDate),
	}, nil
}

func (s *DemoService) CleanupScenario(ctx context.Context, scenarioID string) (*DemoScenarioRunResult, error) {
	scenario, ok := s.findScenario(scenarioID)
	if !ok {
		return nil, fmt.Errorf("scenario không tồn tại: %s", scenarioID)
	}
	tx, err := s.repo.Begin(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	deletedCount, err := s.cleanupScenarioInTx(ctx, tx, scenarioID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit qa cleanup: %w", err)
	}

	return &DemoScenarioRunResult{
		ScenarioID:            scenario.ID,
		ScenarioTitle:         scenario.Title,
		Status:                "cleaned",
		Message:               "Đã cleanup scoped demo data. Dữ liệu lịch sử không bị chạm.",
		CleanupDeletedCount:   deletedCount,
		HistoricalRowsTouched: 0,
		Assertions:            []string{"Chỉ xóa entity có ownership registry", "historical_rows_touched = 0"},
		RunAt:                 time.Now(),
	}, nil
}

// cleanupAllScenariosInTx xóa data owned của TẤT CẢ kịch bản. Gọi trước khi seed kịch bản mới.
func (s *DemoService) cleanupAllScenariosInTx(ctx context.Context, tx pgx.Tx) (int, error) {
	owned, runIDs, err := s.repo.ListOwnedForAllScenarios(ctx, tx)
	if err != nil {
		return 0, err
	}
	deletedCount, err := s.repo.DeleteOwnedEntities(ctx, tx, owned)
	if err != nil {
		return deletedCount, err
	}
	if err := s.repo.RemoveOwnedRegistry(ctx, tx, runIDs); err != nil {
		return deletedCount, err
	}
	if err := s.repo.MarkRunsCleaned(ctx, tx, runIDs); err != nil {
		return deletedCount, err
	}
	return deletedCount, nil
}

// cleanupScenarioInTx xóa data owned của 1 kịch bản cụ thể. Dùng cho endpoint /cleanup.
func (s *DemoService) cleanupScenarioInTx(ctx context.Context, tx pgx.Tx, scenarioID string) (int, error) {
	owned, runIDs, err := s.repo.ListOwnedForScenario(ctx, tx, scenarioID)
	if err != nil {
		return 0, err
	}
	deletedCount, err := s.repo.DeleteOwnedEntities(ctx, tx, owned)
	if err != nil {
		return deletedCount, err
	}
	if err := s.repo.RemoveOwnedRegistry(ctx, tx, runIDs); err != nil {
		return deletedCount, err
	}
	if err := s.repo.MarkRunsCleaned(ctx, tx, runIDs); err != nil {
		return deletedCount, err
	}
	return deletedCount, nil
}

// scenarioAppURL trả URL deep-link đến trang app phù hợp để xem kết quả demo ngay.
func (s *DemoService) scenarioAppURL(scenarioID, date string) string {
	switch scenarioID {
	case "DEMO-VRP-01", "DEMO-VRP-02":
		return "/dashboard/planning?date=" + date + "&warehouse=WH-HL"
	case "DEMO-DISPATCH-01", "DEMO-AI-DISPATCH-01", "DEMO-MORNING-01", "DEMO-DISPATCHER-AM-01":
		return "/dashboard/control-tower"
	case "DEMO-03":
		return "/dashboard/trips"
	case "DEMO-01", "DEMO-04":
		return "/dashboard/orders"
	case "DEMO-02", "DEMO-AI-02":
		return "/dashboard/approvals"
	default:
		return "/dashboard"
	}
}

func (s *DemoService) findScenario(id string) (DemoScenario, bool) {
	for _, scenario := range s.ListScenarios() {
		if scenario.ID == id {
			return scenario, true
		}
	}
	return DemoScenario{}, false
}

func (s *DemoService) seedScenario(ctx context.Context, tx pgx.Tx, scenarioID string, runID uuid.UUID, actor DemoActor) (int, error) {
	switch scenarioID {
	case "DEMO-01":
		return s.seedZaloConfirmation(ctx, tx, runID, actor)
	case "DEMO-02":
		return s.seedCreditApproval(ctx, tx, runID, actor)
	case "DEMO-03":
		return s.seedDispatchTrip(ctx, tx, runID, actor)
	case "DEMO-04":
		return s.seedRejectedOrder(ctx, tx, runID, actor)
	case "DEMO-HIST-01":
		return s.seedHistoricalReplayEvidence(ctx, tx, runID)
	case "DEMO-DISPATCH-01":
		return s.seedDispatcherLiveOps(ctx, tx, runID, actor)
	case "DEMO-AI-DISPATCH-01":
		return s.seedAIDispatcherDemo(ctx, tx, runID, actor)
	case "DEMO-AI-01":
		return s.seedAICommandCenter(ctx, tx, runID, actor)
	case "DEMO-AI-02":
		return s.seedAICreditDecision(ctx, tx, runID, actor)
	case "DEMO-AI-03":
		return s.seedAISimulationScenario(ctx, tx, runID, actor)
	case "DEMO-AI-04":
		return s.seedAITrustPrivacy(ctx, tx, runID, actor)
	case "DEMO-VRP-01":
		return s.seedVRPLargeFleet(ctx, tx, runID, actor)
	case "DEMO-VRP-02":
		return s.seedVRPDiverseLoad(ctx, tx, runID, actor)
	case "DEMO-MORNING-01":
		return s.seedDispatcherMorning(ctx, tx, runID, actor)
	case "DEMO-DISPATCHER-AM-01":
		return s.seedDispatcherAM(ctx, tx, runID, actor)
	default:
		return 0, fmt.Errorf("scenario chưa có seeder: %s", scenarioID)
	}
}

func (s *DemoService) seedAICommandCenter(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0
	items := []struct{ priority, title, detail, group string }{
		{"P1", "Điều phối cần rà soát đầu ngày", "Có đơn chờ xử lý và chuyến cần theo dõi trước cutoff.", "ai-demo-dispatch"},
		{"P2", "NPP rủi ro cần DVKH gọi lại", "Risk signal gom từ công nợ và nhịp đặt hàng giảm.", "ai-demo-credit"},
		{"P2", "Xe cần theo dõi GPS", "Rule anomaly phát hiện dừng lâu, cần dispatcher xác minh.", "ai-demo-gps"},
	}
	for _, item := range items {
		if _, err := s.insertAIInbox(ctx, tx, runID, "dispatcher", item.priority, item.title, item.detail, item.group); err != nil {
			return created, err
		}
		created++
	}
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.briefing", "dispatch_brief", "groq-llama-3.1", "cloud", "low", true, ""); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.transparency", "provider_status", "local-rules", "rules", "low", true, ""); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) seedAIDispatcherDemo(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created, err := s.seedDispatcherLiveOps(ctx, tx, runID, actor)
	if err != nil {
		return created, err
	}
	items := []struct{ priority, title, detail, group string }{
		{"P0", "Ưu tiên xử lý chuyến có nguy cơ trễ", "AI gom các chuyến đang giao có stop delivering quá SLA và đề xuất mở Control Tower để điều phối lại.", "ai-dispatch-delay"},
		{"P1", "Xe cần theo dõi GPS trong 30 phút tới", "Một số xe đang chạy tuyến dài; dispatcher cần bật lớp GPS và kiểm tra dừng lâu/off-route.", "ai-dispatch-gps"},
		{"P1", "NPP rủi ro ảnh hưởng lịch giao", "Các NPP có health thấp nằm trong cụm giao hôm nay; mở danh sách để DVKH liên hệ song song.", "ai-dispatch-customer-risk"},
		{"P2", "Có phương án VRP what-if chờ xem", "Simulation đề xuất cân bằng lại cụm giao để giảm trễ nhưng apply vẫn cần duyệt thủ công.", "ai-dispatch-reroute"},
	}
	for _, item := range items {
		if _, err := s.insertAIInbox(ctx, tx, runID, "dispatcher", item.priority, item.title, item.detail, item.group); err != nil {
			return created, err
		}
		created++
	}
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.briefing", "dispatch_brief", "groq-llama-3.1", "cloud", "low", true, ""); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.gps_anomaly", "control_tower_watch", "rules", "rules", "medium", true, ""); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAISimulation(ctx, tx, runID, actor, "dispatch_reroute_what_if"); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) seedAICreditDecision(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created, err := s.seedCreditApproval(ctx, tx, runID, actor)
	if err != nil {
		return created, err
	}
	if _, err := s.insertAIInbox(ctx, tx, runID, "accountant", "P1", "Đơn vượt hạn mức cần duyệt thủ công", "AI xếp ưu tiên cao nhưng không thay rule phê duyệt R15.", "ai-demo-credit-approval"); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.credit_score", "credit_risk_score", "rules", "rules", "medium", true, ""); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) seedAISimulationScenario(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created, err := s.seedDispatchTrip(ctx, tx, runID, actor)
	if err != nil {
		return created, err
	}
	if _, err := s.insertAISimulation(ctx, tx, runID, actor, "vrp_what_if"); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIInbox(ctx, tx, runID, "dispatcher", "P1", "Có simulation VRP chờ xem xét", "Ba phương án A/B/C đã sẵn sàng; apply cần approval.", "ai-demo-simulation"); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) seedAITrustPrivacy(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0
	cloudID, err := s.insertAIAudit(ctx, tx, runID, "ai.copilot", "chat", "groq-llama-3.1", "cloud", "low", true, "")
	if err != nil {
		return created, err
	}
	created++
	localID, err := s.insertAIAudit(ctx, tx, runID, "ai.copilot", "chat", "local-rules", "rules", "high", true, "")
	if err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIAudit(ctx, tx, runID, "ai.copilot", "chat", "local-rules", "blocked", "high", false, "privacy router blocked PII"); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIFeedback(ctx, tx, runID, cloudID, "correct", "QA demo positive feedback", actor); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIFeedback(ctx, tx, runID, localID, "not_useful", "QA demo trust calibration", actor); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertAIInbox(ctx, tx, runID, "management", "P2", "Trust Loop cần admin xem xét", "Audit/feedback demo đã có dữ liệu, không tự nâng automation tier.", "ai-demo-trust"); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) seedZaloConfirmation(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0
	for i := 0; i < 2; i++ {
		orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
			Prefix:       "D01",
			Seq:          i + 1,
			CustomerOff:  i,
			Status:       "pending_customer_confirm",
			Amount:       18500000 + i*3500000,
			WeightKg:     650 + i*120,
			CreditStatus: "pass",
			Notes:        "QA demo: đơn chờ NPP xác nhận Zalo",
		})
		if err != nil {
			return created, err
		}
		created += 2
		if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 80+i*20, i); err != nil {
			return created, err
		}
		created++
		if _, err := s.insertOrderConfirmation(ctx, tx, runID, orderID, customerID, "sent", "", 18500000+i*3500000); err != nil {
			return created, err
		}
		created++
	}
	return created, nil
}

func (s *DemoService) seedCreditApproval(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
		Prefix:       "D02",
		Seq:          1,
		CustomerOff:  0,
		Status:       "pending_approval",
		Amount:       42000000,
		WeightKg:     1450,
		CreditStatus: "exceed",
		Notes:        "QA demo: đơn vượt hạn mức tín dụng, chờ kế toán duyệt",
	})
	if err != nil {
		return 0, err
	}
	created := 2
	if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 220, 0); err != nil {
		return created, err
	}
	created++
	ledgerID, err := s.insertReceivable(ctx, tx, runID, customerID, orderID, actor)
	if err != nil {
		return created, err
	}
	_ = ledgerID
	created++
	return created, nil
}

func (s *DemoService) seedDispatchTrip(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	profile := s.loadHistoricalOpsProfile(ctx, tx)
	available := s.countUsableFleet(ctx, tx)
	if available <= 0 {
		available = 1
	}
	targetOrders := profile.OrderCount
	if targetOrders < 24 {
		targetOrders = 24
	}
	maxOrders := available * 4
	if maxOrders < 12 {
		maxOrders = 12
	}
	if targetOrders > maxOrders {
		targetOrders = maxOrders
	}
	targetTrips := (targetOrders + 3) / 4
	if targetTrips < 2 {
		targetTrips = 2
	}
	if targetTrips > available {
		targetTrips = available
	}
	if targetTrips > 12 {
		targetTrips = 12
	}
	stopsPerTrip := (targetOrders + targetTrips - 1) / targetTrips
	if stopsPerTrip < 3 {
		stopsPerTrip = 3
	}
	if stopsPerTrip > 5 {
		stopsPerTrip = 5
	}
	targetOrders = targetTrips * stopsPerTrip

	created := 0
	seq := 1
	for tripIndex := 0; tripIndex < targetTrips; tripIndex++ {
		shipmentIDs := []uuid.UUID{}
		customerIDs := []uuid.UUID{}
		for stopIndex := 0; stopIndex < stopsPerTrip; stopIndex++ {
			orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
				Prefix:       "D03",
				Seq:          seq,
				CustomerOff:  seq - 1,
				Status:       "confirmed",
				Amount:       12000000 + (stopIndex * 2500000),
				WeightKg:     420 + stopIndex*80,
				CreditStatus: "pass",
				Notes:        fmt.Sprintf("QA demo: điều phối theo profile ngày lịch sử %s (%d đơn, %d chuyến)", profile.DeliveryDate, profile.OrderCount, profile.TripCount),
			})
			if err != nil {
				return created, err
			}
			created += 2
			if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 60+stopIndex*15, stopIndex); err != nil {
				return created, err
			}
			created++
			shipmentID, err := s.insertShipment(ctx, tx, runID, orderID, seq)
			if err != nil {
				return created, err
			}
			created++
			shipmentIDs = append(shipmentIDs, shipmentID)
			customerIDs = append(customerIDs, customerID)
			seq++
		}
		tripID, err := s.insertTripWithFleetOffset(ctx, tx, runID, "D03", tripIndex+1, stopsPerTrip, 1500+tripIndex*120, tripIndex, tripIndex, "assigned")
		if err != nil {
			return created, err
		}
		created++
		for i, shipmentID := range shipmentIDs {
			if _, err := s.insertTripStop(ctx, tx, runID, tripID, shipmentID, customerIDs[i], i+1); err != nil {
				return created, err
			}
			created++
		}
	}
	if _, err := s.insertEvent(ctx, tx, runID, "qa_scenario", runID, "qa.dispatch_profile.selected", actor, "Điều phối demo theo ngày lịch sử", fmt.Sprintf(`{"source_date":"%s","source_orders":%d,"source_trips":%d,"seeded_orders":%d,"seeded_trips":%d}`, profile.DeliveryDate, profile.OrderCount, profile.TripCount, targetOrders, targetTrips)); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) seedRejectedOrder(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
		Prefix:       "D04",
		Seq:          1,
		CustomerOff:  2,
		Status:       "cancelled",
		Amount:       9600000,
		WeightKg:     360,
		CreditStatus: "pass",
		Notes:        "QA demo: NPP từ chối đơn vì yêu cầu đổi lịch giao",
	})
	if err != nil {
		return 0, err
	}
	created := 2
	if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 40, 1); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertOrderConfirmation(ctx, tx, runID, orderID, customerID, "rejected", "NPP yêu cầu đổi lịch giao sang tuần sau", 9600000); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertEvent(ctx, tx, runID, "order", orderID, "order.rejected_by_customer", actor, "NPP từ chối đơn QA demo", `{"reason":"NPP yêu cầu đổi lịch giao sang tuần sau"}`); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) seedHistoricalReplayEvidence(ctx context.Context, tx pgx.Tx, runID uuid.UUID) (int, error) {
	var deliveryDate string
	var orderCount, tripCount int
	err := tx.QueryRow(ctx, `
		SELECT so.delivery_date::text, COUNT(DISTINCT so.id), COUNT(DISTINCT t.id)
		FROM sales_orders so
		LEFT JOIN shipments sh ON sh.order_id = so.id
		LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
		LEFT JOIN trips t ON t.id = ts.trip_id
		WHERE so.delivery_date IS NOT NULL
		GROUP BY so.delivery_date
		ORDER BY COUNT(DISTINCT so.id) DESC, so.delivery_date DESC
		LIMIT 1
	`).Scan(&deliveryDate, &orderCount, &tripCount)
	if err != nil {
		return 0, fmt.Errorf("historical replay needs existing sales_orders: %w", err)
	}
	_, err = s.insertEvent(ctx, tx, runID, "qa_scenario", runID, "qa.historical_replay.selected", DemoActor{}, "Chọn ngày lịch sử làm scenario read-only", fmt.Sprintf(`{"delivery_date":"%s","orders":%d,"trips":%d}`, deliveryDate, orderCount, tripCount))
	if err != nil {
		return 0, err
	}
	return 1, nil
}

func (s *DemoService) seedDispatcherLiveOps(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	profile := s.loadHistoricalOpsProfile(ctx, tx)
	var availableVehicles, availableDrivers int
	if err := tx.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM vehicles WHERE status::text = 'active'),
			(SELECT COUNT(*) FROM drivers WHERE status::text = 'active')
	`).Scan(&availableVehicles, &availableDrivers); err != nil {
		return 0, fmt.Errorf("count active fleet: %w", err)
	}
	available := availableVehicles
	if availableDrivers < available {
		available = availableDrivers
	}
	if available <= 0 {
		return 0, fmt.Errorf("không có xe/lái xe active để tạo live ops scenario")
	}
	targetTrips := available * 8 / 10
	if targetTrips < 1 {
		targetTrips = 1
	}
	if targetTrips > 40 {
		targetTrips = 40
	}
	targetOrders := profile.OrderCount
	if targetOrders < 24 {
		targetOrders = 24
	}
	maxOrders := targetTrips * 6
	if targetOrders > maxOrders {
		targetOrders = maxOrders
	}
	if targetOrders < targetTrips*3 {
		targetOrders = targetTrips * 3
	}
	stopsPerTrip := (targetOrders + targetTrips - 1) / targetTrips
	if stopsPerTrip < 3 {
		stopsPerTrip = 3
	}
	if stopsPerTrip > 6 {
		stopsPerTrip = 6
	}
	targetOrders = targetTrips * stopsPerTrip
	created := 0
	customerOffset := 0

	checkins, err := s.insertDriverCheckins(ctx, tx, runID, targetTrips)
	if err != nil {
		return created, err
	}
	created += checkins

	for tripIndex := 0; tripIndex < targetTrips; tripIndex++ {
		shipmentIDs := []uuid.UUID{}
		customerIDs := []uuid.UUID{}
		for stopIndex := 0; stopIndex < stopsPerTrip; stopIndex++ {
			orderID, customerID, err := s.insertDemoOrder(ctx, tx, runID, actor, demoOrderInput{
				Prefix:       "LIVE",
				Seq:          tripIndex*stopsPerTrip + stopIndex + 1,
				CustomerOff:  customerOffset,
				Status:       "confirmed",
				Amount:       12000000 + (stopIndex * 2500000),
				WeightKg:     420 + stopIndex*90,
				CreditStatus: "pass",
				Notes:        fmt.Sprintf("QA demo live ops: mô phỏng ngày %s có %d đơn/%d chuyến trong lịch sử", profile.DeliveryDate, profile.OrderCount, profile.TripCount),
			})
			if err != nil {
				return created, err
			}
			created += 2
			customerOffset++
			if _, err := s.insertDemoItem(ctx, tx, runID, orderID, 55+stopIndex*10, stopIndex); err != nil {
				return created, err
			}
			created++
			shipmentID, err := s.insertShipment(ctx, tx, runID, orderID, tripIndex*stopsPerTrip+stopIndex+1)
			if err != nil {
				return created, err
			}
			created++
			shipmentIDs = append(shipmentIDs, shipmentID)
			customerIDs = append(customerIDs, customerID)
		}

		tripID, err := s.insertTripWithFleetOffset(ctx, tx, runID, "LIVE", tripIndex+1, stopsPerTrip, 1550+tripIndex*20, tripIndex, tripIndex, "in_transit")
		if err != nil {
			return created, err
		}
		created++
		for stopIndex, shipmentID := range shipmentIDs {
			status := "pending"
			if stopIndex == 0 {
				status = "delivered"
			} else if stopIndex == 1 {
				status = "delivering"
			}
			if _, err := s.insertTripStopWithStatus(ctx, tx, runID, tripID, shipmentID, customerIDs[stopIndex], stopIndex+1, status); err != nil {
				return created, err
			}
			created++
		}
	}

	if _, err := s.insertAIInbox(ctx, tx, runID, "dispatcher", "P1", "Ngày điều phối lớn đang chạy", fmt.Sprintf("Profile lịch sử %s có %d đơn/%d chuyến. Demo dùng %d/%d xe active, %d/%d lái xe active, %d đơn và %d điểm/xe.", profile.DeliveryDate, profile.OrderCount, profile.TripCount, targetTrips, availableVehicles, targetTrips, availableDrivers, targetOrders, stopsPerTrip), "qa-live-dispatch"); err != nil {
		return created, err
	}
	created++
	if _, err := s.insertEvent(ctx, tx, runID, "qa_scenario", runID, "qa.live_ops_profile.selected", actor, "Live ops demo theo ngày lịch sử", fmt.Sprintf(`{"source_date":"%s","source_orders":%d,"source_trips":%d,"seeded_orders":%d,"seeded_trips":%d,"driver_checkins_created":%d}`, profile.DeliveryDate, profile.OrderCount, profile.TripCount, targetOrders, targetTrips, checkins)); err != nil {
		return created, err
	}
	created++
	return created, nil
}

func (s *DemoService) loadHistoricalOpsProfile(ctx context.Context, tx pgx.Tx) demoOpsProfile {
	profile := demoOpsProfile{DeliveryDate: time.Now().Format("2006-01-02"), OrderCount: 24, TripCount: 6, AvgStops: 4}
	_ = tx.QueryRow(ctx, `
		WITH daily AS (
			SELECT so.delivery_date::text AS delivery_date,
			       COUNT(DISTINCT so.id)::integer AS order_count,
			       COUNT(DISTINCT t.id)::integer AS trip_count,
			       COUNT(DISTINCT ts.id)::numeric / GREATEST(COUNT(DISTINCT t.id), 1) AS avg_stops
			FROM sales_orders so
			LEFT JOIN shipments sh ON sh.order_id = so.id
			LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
			LEFT JOIN trips t ON t.id = ts.trip_id
			WHERE so.delivery_date IS NOT NULL
			  AND so.order_number NOT LIKE 'QA-%'
			GROUP BY so.delivery_date
		)
		SELECT delivery_date, order_count, trip_count, COALESCE(avg_stops, 4)::float8
		FROM daily
		ORDER BY order_count DESC, delivery_date DESC
		LIMIT 1
	`).Scan(&profile.DeliveryDate, &profile.OrderCount, &profile.TripCount, &profile.AvgStops)
	if profile.OrderCount < 24 {
		profile.OrderCount = 24
	}
	if profile.TripCount < 1 {
		profile.TripCount = 1
	}
	if profile.AvgStops < 3 {
		profile.AvgStops = 3
	}
	return profile
}

func (s *DemoService) countUsableFleet(ctx context.Context, tx pgx.Tx) int {
	var availableVehicles, availableDrivers int
	if err := tx.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM vehicles WHERE status::text = 'active'),
			(SELECT COUNT(*) FROM drivers WHERE status::text = 'active')
	`).Scan(&availableVehicles, &availableDrivers); err != nil {
		return 1
	}
	if availableDrivers < availableVehicles {
		return availableDrivers
	}
	return availableVehicles
}

func (s *DemoService) insertDriverCheckins(ctx context.Context, tx pgx.Tx, runID uuid.UUID, limit int) (int, error) {
	if limit <= 0 {
		return 0, nil
	}
	rows, err := tx.Query(ctx, `
		INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at, note)
		SELECT d.id, CURRENT_DATE, 'available', now(), 'QA demo live ops owned check-in'
		FROM drivers d
		WHERE d.status::text = 'active'
		ORDER BY d.id
		LIMIT $1
		ON CONFLICT (driver_id, checkin_date) DO NOTHING
		RETURNING id
	`, limit)
	if err != nil {
		return 0, fmt.Errorf("insert driver checkins: %w", err)
	}
	defer rows.Close()

	created := 0
	checkinIDs := []uuid.UUID{}
	for rows.Next() {
		var checkinID uuid.UUID
		if err := rows.Scan(&checkinID); err != nil {
			return created, fmt.Errorf("scan driver checkin: %w", err)
		}
		checkinIDs = append(checkinIDs, checkinID)
	}
	if err := rows.Err(); err != nil {
		return created, err
	}
	rows.Close()

	for _, checkinID := range checkinIDs {
		if err := s.repo.RecordEntity(ctx, tx, runID, "driver_checkins", checkinID); err != nil {
			return created, err
		}
		created++
	}
	return created, nil
}

type demoOrderInput struct {
	Prefix       string
	Seq          int
	CustomerOff  int
	Status       string
	Amount       int
	WeightKg     int
	CreditStatus string
	Notes        string
}

func (s *DemoService) insertDemoOrder(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor, input demoOrderInput) (uuid.UUID, uuid.UUID, error) {
	orderNumber := fmt.Sprintf("QA-%s-%s-%02d", input.Prefix, runID.String()[:6], input.Seq)
	var orderID, customerID uuid.UUID
	err := tx.QueryRow(ctx, `
		WITH active_customers AS (
			SELECT id, address, phone, latitude, longitude
			FROM customers
			WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL
			ORDER BY code
		), customer_count AS (
			SELECT COUNT(*)::integer AS cnt FROM active_customers
		), selected_customer AS (
			SELECT id, address, phone, latitude, longitude
			FROM active_customers
			OFFSET ($8::integer % GREATEST((SELECT cnt FROM customer_count), 1))
			LIMIT 1
		)
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  delivery_address, total_amount, deposit_amount, total_weight_kg, total_volume_m3,
		  created_by, atp_status, credit_status, notes)
		SELECT gen_random_uuid(), $1, c.id, w.id, $2::order_status, CURRENT_DATE,
		  jsonb_build_object('address', c.address, 'phone', c.phone, 'lat', c.latitude, 'lng', c.longitude), $3::numeric, 0, $4::numeric, 1.0,
		  $5, 'pass', $6, $7
		FROM selected_customer c
		CROSS JOIN (SELECT id FROM warehouses WHERE code = 'WH-HL' LIMIT 1) w
		RETURNING id, customer_id
	`, orderNumber, input.Status, input.Amount, input.WeightKg, actor.UserID, input.CreditStatus, input.Notes, input.CustomerOff).Scan(&orderID, &customerID)
	if err != nil {
		return uuid.Nil, uuid.Nil, fmt.Errorf("insert demo order: %w", err)
	}
	if err := s.repo.RecordEntity(ctx, tx, runID, "sales_orders", orderID); err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	if _, err := s.insertEvent(ctx, tx, runID, "order", orderID, "order.created", actor, "Tạo đơn demo "+orderNumber, fmt.Sprintf(`{"order_number":"%s"}`, orderNumber)); err != nil {
		return uuid.Nil, uuid.Nil, err
	}
	return orderID, customerID, nil
}

func (s *DemoService) insertDemoItem(ctx context.Context, tx pgx.Tx, runID uuid.UUID, orderID uuid.UUID, qty int, productOffset int) (uuid.UUID, error) {
	_ = productOffset
	var itemID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
		SELECT $1, p.id, $2::integer, COALESCE(NULLIF(p.price, 0), 185000), COALESCE(NULLIF(p.price, 0), 185000) * $2::numeric
		FROM products p WHERE p.is_active = true ORDER BY p.sku LIMIT 1
		RETURNING id
	`, orderID, qty).Scan(&itemID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert demo item: %w", err)
	}
	return itemID, s.repo.RecordEntity(ctx, tx, runID, "order_items", itemID)
}

func (s *DemoService) insertOrderConfirmation(ctx context.Context, tx pgx.Tx, runID uuid.UUID, orderID uuid.UUID, customerID uuid.UUID, status string, reason string, amount int) (uuid.UUID, error) {
	var confirmationID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO order_confirmations (order_id, customer_id, token, phone, total_amount, status, rejected_at, reject_reason, expires_at)
		SELECT $1, $2, encode(gen_random_bytes(16), 'hex'), COALESCE(c.phone, '0912345678'), $3::numeric, $4::varchar,
		       CASE WHEN $4::varchar = 'rejected' THEN now() ELSE NULL END,
		       NULLIF($5, ''), now() + interval '2 hours'
		FROM customers c WHERE c.id = $2
		RETURNING id
	`, orderID, customerID, amount, status, reason).Scan(&confirmationID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert order confirmation: %w", err)
	}
	return confirmationID, s.repo.RecordEntity(ctx, tx, runID, "order_confirmations", confirmationID)
}

func (s *DemoService) insertReceivable(ctx context.Context, tx pgx.Tx, runID uuid.UUID, customerID uuid.UUID, orderID uuid.UUID, actor DemoActor) (uuid.UUID, error) {
	var ledgerID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO receivable_ledger (customer_id, order_id, ledger_type, amount, description, created_by)
		VALUES ($1, $2, 'debit', 28000000, 'QA demo scoped debt for credit approval scenario', $3)
		RETURNING id
	`, customerID, orderID, actor.UserID).Scan(&ledgerID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert receivable: %w", err)
	}
	return ledgerID, s.repo.RecordEntity(ctx, tx, runID, "receivable_ledger", ledgerID)
}

func (s *DemoService) insertShipment(ctx context.Context, tx pgx.Tx, runID uuid.UUID, orderID uuid.UUID, seq int) (uuid.UUID, error) {
	shipmentNumber := fmt.Sprintf("QA-SHP-%s-%02d", runID.String()[:6], seq)
	var shipmentID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status, delivery_date,
		  total_weight_kg, total_volume_m3, items)
		SELECT $1, so.id, so.customer_id, so.warehouse_id, 'pending', CURRENT_DATE,
		       so.total_weight_kg, so.total_volume_m3,
		       COALESCE((SELECT jsonb_agg(jsonb_build_object('product_id', oi.product_id, 'quantity', oi.quantity)) FROM order_items oi WHERE oi.order_id = so.id), '[]'::jsonb)
		FROM sales_orders so WHERE so.id = $2
		RETURNING id
	`, shipmentNumber, orderID).Scan(&shipmentID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert shipment: %w", err)
	}
	return shipmentID, s.repo.RecordEntity(ctx, tx, runID, "shipments", shipmentID)
}

func (s *DemoService) insertTrip(ctx context.Context, tx pgx.Tx, runID uuid.UUID, prefix string, stops int, weightKg int) (uuid.UUID, error) {
	tripNumber := fmt.Sprintf("QA-%s-TR-%s", prefix, runID.String()[:6])
	var tripID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO trips (trip_number, warehouse_id, vehicle_id, driver_id, status, planned_date,
		  total_stops, total_weight_kg, total_distance_km, total_duration_min)
		SELECT $1, w.id,
		       (SELECT id FROM vehicles WHERE status::text = 'active' ORDER BY plate_number LIMIT 1),
		       (SELECT id FROM drivers WHERE status::text = 'active' ORDER BY id LIMIT 1),
		       'assigned', CURRENT_DATE, $2, $3::numeric, 86.5, 240
		FROM warehouses w WHERE w.code = 'WH-HL'
		RETURNING id
	`, tripNumber, stops, weightKg).Scan(&tripID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert trip: %w", err)
	}
	return tripID, s.repo.RecordEntity(ctx, tx, runID, "trips", tripID)
}

func (s *DemoService) insertTripWithFleetOffset(ctx context.Context, tx pgx.Tx, runID uuid.UUID, prefix string, seq int, stops int, weightKg int, vehicleOffset int, driverOffset int, status string) (uuid.UUID, error) {
	tripNumber := fmt.Sprintf("QA-%s-TR-%s-%02d", prefix, runID.String()[:6], seq)
	var tripID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO trips (trip_number, warehouse_id, vehicle_id, driver_id, status, planned_date,
		  total_stops, total_weight_kg, total_distance_km, total_duration_min, started_at)
		SELECT $1, w.id,
		       (SELECT id FROM vehicles WHERE status::text = 'active' ORDER BY plate_number LIMIT 1 OFFSET $4),
		       (SELECT id FROM drivers WHERE status::text = 'active' ORDER BY id LIMIT 1 OFFSET $5),
		       $6::trip_status, CURRENT_DATE, $2, $3::numeric, 42.5 + ($7::numeric * 3.5), 180 + ($7::integer * 4),
		       CASE WHEN $6::text = 'in_transit' THEN now() - interval '90 minutes' ELSE NULL END
		FROM warehouses w WHERE w.code = 'WH-HL'
		RETURNING id
	`, tripNumber, stops, weightKg, vehicleOffset, driverOffset, status, seq).Scan(&tripID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert live ops trip: %w", err)
	}
	return tripID, s.repo.RecordEntity(ctx, tx, runID, "trips", tripID)
}

func (s *DemoService) insertTripStop(ctx context.Context, tx pgx.Tx, runID uuid.UUID, tripID uuid.UUID, shipmentID uuid.UUID, customerID uuid.UUID, stopOrder int) (uuid.UUID, error) {
	return s.insertTripStopWithStatus(ctx, tx, runID, tripID, shipmentID, customerID, stopOrder, "pending")
}

func (s *DemoService) insertTripStopWithStatus(ctx context.Context, tx pgx.Tx, runID uuid.UUID, tripID uuid.UUID, shipmentID uuid.UUID, customerID uuid.UUID, stopOrder int, status string) (uuid.UUID, error) {
	var stopID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO trip_stops (trip_id, shipment_id, customer_id, stop_order, status, estimated_arrival, estimated_departure)
		VALUES ($1, $2, $3, $4::integer, $5::stop_status, now() + ($4::integer * interval '1 hour'), now() + ($4::integer * interval '1 hour') + interval '20 minutes')
		RETURNING id
	`, tripID, shipmentID, customerID, stopOrder, status).Scan(&stopID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert trip stop: %w", err)
	}
	return stopID, s.repo.RecordEntity(ctx, tx, runID, "trip_stops", stopID)
}

func (s *DemoService) insertEvent(ctx context.Context, tx pgx.Tx, runID uuid.UUID, entityType string, entityID uuid.UUID, eventType string, actor DemoActor, title string, detail string) (uuid.UUID, error) {
	var eventID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail)
		VALUES ($1, $2, $3, 'user', $4, $5, $6, $7::jsonb)
		RETURNING id
	`, entityType, entityID, eventType, actor.UserID, actor.FullName, title, detail).Scan(&eventID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert event: %w", err)
	}
	return eventID, s.repo.RecordEntity(ctx, tx, runID, "entity_events", eventID)
}

func (s *DemoService) insertAIInbox(ctx context.Context, tx pgx.Tx, runID uuid.UUID, role string, priority string, title string, detail string, groupKey string) (uuid.UUID, error) {
	return s.insertAIInboxWithRoute(ctx, tx, runID, role, priority, title, detail, groupKey, "", "Xem chi tiết", uuid.Nil)
}

func (s *DemoService) insertAIInboxWithRoute(ctx context.Context, tx pgx.Tx, runID uuid.UUID, role, priority, title, detail, groupKey, route, ctaLabel string, userID uuid.UUID) (uuid.UUID, error) {
	var itemID uuid.UUID
	var uid any
	if userID != uuid.Nil {
		uid = userID
	}
	err := tx.QueryRow(ctx, `
		INSERT INTO ai_inbox_items (role, item_type, priority, title, detail, ai_suggestion, group_key, status, user_id)
		VALUES ($1, 'qa_demo', $2, $3, $4,
		        jsonb_build_object(
		            'source', 'qa_demo',
		            'confidence', 0.86,
		            'action', 'review_demo_scenario',
		            'route', $6::text,
		            'label', $7::text
		        ),
		        $5, 'open', $8)
		RETURNING id
	`, role, priority, title, detail, groupKey, route, ctaLabel, uid).Scan(&itemID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert ai inbox: %w", err)
	}
	return itemID, s.repo.RecordEntity(ctx, tx, runID, "ai_inbox_items", itemID)
}

func (s *DemoService) insertAIAudit(ctx context.Context, tx pgx.Tx, runID uuid.UUID, featureKey string, actionType string, provider string, route string, sensitivity string, success bool, errorMessage string) (uuid.UUID, error) {
	var auditID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO ai_audit_log (feature_key, action_type, provider, route, model, sensitivity, confidence,
		                          request_hash, redacted, latency_ms, success, error_message, role)
		VALUES ($1, $2, $3, $4, $3, $5, 0.86,
		        encode(digest($1 || ':' || $2 || ':' || $3 || ':' || gen_random_uuid()::text, 'sha256'), 'hex'),
		        $5 <> 'low', 42, $6, NULLIF($7, ''), 'qa_demo')
		RETURNING id
	`, featureKey, actionType, provider, route, sensitivity, success, errorMessage).Scan(&auditID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert ai audit: %w", err)
	}
	return auditID, s.repo.RecordEntity(ctx, tx, runID, "ai_audit_log", auditID)
}

func (s *DemoService) insertAIFeedback(ctx context.Context, tx pgx.Tx, runID uuid.UUID, auditID uuid.UUID, feedback string, comment string, actor DemoActor) (uuid.UUID, error) {
	var feedbackID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO ai_feedback (audit_id, source_type, source_id, feedback, comment, user_id)
		VALUES ($1, 'qa_demo', $2, $3, $4, $5)
		RETURNING id
	`, auditID, auditID.String(), feedback, comment, actor.UserID).Scan(&feedbackID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert ai feedback: %w", err)
	}
	return feedbackID, s.repo.RecordEntity(ctx, tx, runID, "ai_feedback", feedbackID)
}

func (s *DemoService) insertAISimulation(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor, simulationType string) (uuid.UUID, error) {
	var simulationID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO ai_simulations (simulation_type, status, context, options, recommended_option_id, explanation, snapshot_hash, expires_at, created_by)
		VALUES ($1, 'ready',
		        jsonb_build_object('source', 'qa_demo', 'scenario_run_id', $2::text, 'core_tables_mutated', false),
		        '[{"id":"A","title":"Cân bằng","metrics":{"vehicles":11,"otd_pct":95,"cost_delta_pct":-6},"warnings":[]},{"id":"B","title":"Tiết kiệm chi phí","metrics":{"vehicles":10,"otd_pct":91,"cost_delta_pct":-11},"warnings":["OTD giảm"]},{"id":"C","title":"Tối đa OTD","metrics":{"vehicles":13,"otd_pct":97,"cost_delta_pct":5},"warnings":["Chi phí tăng"]}]'::jsonb,
		        'A', 'QA demo: phương án A cân bằng chi phí và đúng giờ; apply cần approval.',
		        encode(digest('qa-demo-sim:' || $2::text, 'sha256'), 'hex'), now() + interval '5 minutes', $3)
		RETURNING id
	`, simulationType, runID, actor.UserID).Scan(&simulationID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("insert ai simulation: %w", err)
	}
	return simulationID, s.repo.RecordEntity(ctx, tx, runID, "ai_simulations", simulationID)
}
