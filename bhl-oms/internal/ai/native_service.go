package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
)

func (s *Service) GenerateWithPrivacy(ctx context.Context, input AIProviderCall) (*AIProviderCallResult, error) {
	start := time.Now()
	decision := RoutePrivacy(input.Prompt)
	providerName := "rules"
	text := ""
	var err error

	switch decision.Route {
	case PrivacyRouteBlocked:
		err = fmt.Errorf("privacy router blocked request")
	case PrivacyRouteLocal, PrivacyRouteRules:
		text = (&MockProvider{}).mustGenerate(ctx, decision.SanitizedInput)
		providerName = "local-rules"
	case PrivacyRouteCloud:
		text, err = s.provider.Generate(ctx, decision.SanitizedInput)
		providerName = s.provider.Name()
	}

	latency := int(time.Since(start).Milliseconds())
	audit := AIAuditLogInput{
		FeatureKey:  input.FeatureKey,
		ActionType:  input.ActionType,
		Provider:    providerName,
		Route:       decision.Route,
		Model:       providerName,
		Sensitivity: decision.Sensitivity,
		Confidence:  decision.Confidence,
		RequestHash: decision.RequestHash,
		Redacted:    decision.Redacted,
		LatencyMS:   latency,
		Success:     err == nil,
		UserID:      input.UserID,
		Role:        input.Role,
	}
	if err != nil {
		audit.ErrorMessage = err.Error()
	}
	if saveErr := s.repo.SaveAIAuditLog(ctx, audit); saveErr != nil {
		s.log.Warn(ctx, "ai.audit_log_save_failed", logger.F("err", saveErr.Error()))
	}
	if err != nil {
		return nil, err
	}
	return &AIProviderCallResult{Text: text, Provider: providerName, Privacy: decision, Latency: latency}, nil
}

func (m *MockProvider) mustGenerate(ctx context.Context, prompt string) string {
	text, err := m.Generate(ctx, prompt)
	if err != nil || text == "" {
		return "AI đang chạy bằng rule/local fallback. Vui lòng kiểm tra dữ liệu đầu vào và thử lại."
	}
	return text
}

func (s *Service) IsFeatureEnabled(ctx context.Context, flagKey, role string, userID uuid.UUID) bool {
	flags, err := s.GetEffectiveFeatureFlags(ctx, role, userID)
	if err != nil {
		s.log.Warn(ctx, "ai.feature_flag_lookup_failed", logger.F("flag", flagKey), logger.F("err", err.Error()))
		return false
	}
	return flags.Flags[flagKey]
}

func (s *Service) GetTransparencySnapshot(ctx context.Context, role string, userID uuid.UUID) (*AITransparencySnapshot, error) {
	flags, _ := s.GetEffectiveFeatureFlags(ctx, role, userID)
	flagMap := map[string]bool{}
	if flags != nil {
		flagMap = flags.Flags
	}
	providers := []AIProviderStatus{
		{Name: "gemini-2.0-flash", Route: "cloud", Available: os.Getenv("GEMINI_API_KEY") != "", Reason: envReason("GEMINI_API_KEY")},
		{Name: "groq-llama-3.1", Route: "cloud", Available: os.Getenv("GROQ_API_KEY") != "", Reason: envReason("GROQ_API_KEY")},
		{Name: "local-rules", Route: "rules", Available: true},
	}
	return &AITransparencySnapshot{
		GeneratedAt: time.Now(),
		Flags:       flagMap,
		Providers:   providers,
		Guardrails: []string{
			"AI flags default OFF",
			"Privacy Router fail-closed before provider calls",
			"Raw prompt is never stored in ai_audit_log",
			"Simulation snapshots do not mutate core workflow tables",
		},
		CostMode: "free-tier-first",
	}, nil
}

func envReason(key string) string {
	if os.Getenv(key) == "" {
		return key + " not configured"
	}
	return "configured"
}

func (s *Service) ListInbox(ctx context.Context, role string, userID uuid.UUID) ([]AIInboxItem, error) {
	items, err := s.repo.ListAIInbox(ctx, role, userID)
	if err != nil {
		return nil, err
	}
	if len(items) > 0 {
		return items, nil
	}
	return s.buildRuleInbox(ctx, role), nil
}

func (s *Service) buildRuleInbox(ctx context.Context, role string) []AIInboxItem {
	now := time.Now()
	if role == "dispatcher" || role == "admin" || role == "management" {
		dc, _ := s.repo.GetDispatchContext(ctx)
		if dc != nil && (dc.PendingOrders > 0 || dc.OpenExceptions > 0) {
			suggestion, _ := json.Marshal(map[string]any{"action": "review_dispatch_brief", "confidence": 0.78, "source": "rules"})
			return []AIInboxItem{{ID: "rules-dispatch-focus", Type: "dispatch_focus", Priority: "P1", Title: "Điều phối cần rà soát đầu ngày", Detail: fmt.Sprintf("%d đơn đang chờ, %d cảnh báo GPS đang mở.", dc.PendingOrders, dc.OpenExceptions), Suggestion: suggestion, GroupKey: "dispatch", Status: "open", CreatedAt: now, Explainable: true}}
		}
	}
	suggestion, _ := json.Marshal(map[string]any{"action": "open_dashboard", "confidence": 0.6, "source": "rules"})
	return []AIInboxItem{{ID: "rules-baseline", Type: "baseline", Priority: "P3", Title: "Không có cảnh báo AI khẩn", Detail: "AI Inbox đang ở chế độ baseline/rules. Workflow lõi vẫn hoạt động bình thường.", Suggestion: suggestion, GroupKey: "baseline", Status: "open", CreatedAt: now, Explainable: false}}
}

func (s *Service) AckInboxItem(ctx context.Context, itemID uuid.UUID, status string, userID uuid.UUID) error {
	return s.repo.AckAIInbox(ctx, itemID, status, userID)
}

// ChatWithAI handles a free-text chat message from the user.
// Returns AI reply text + matched intents for navigation hints.
func (s *Service) ChatWithAI(ctx context.Context, message, role string, userID uuid.UUID) (string, []IntentMatch, error) {
	intents := MatchIntent(message, role, s.IsFeatureEnabled(ctx, FlagIntent, role, userID))

	systemPrompt := fmt.Sprintf(`Bạn là trợ lý AI của hệ thống BHL OMS — phần mềm quản lý đơn hàng, vận chuyển, kho hàng bia.
Người dùng là %s. Trả lời ngắn gọn bằng tiếng Việt (tối đa 3 câu). Chỉ trả lời trong phạm vi logistics/vận hành/dữ liệu BHL.
Câu hỏi: %s`, role, message)

	result, err := s.GenerateWithPrivacy(ctx, AIProviderCall{
		FeatureKey: FlagCopilot,
		ActionType: "chat",
		Prompt:     systemPrompt,
		UserID:     userID,
		Role:       role,
	})
	if err != nil {
		return "AI hiện không khả dụng. Vui lòng thử lại sau.", intents, nil
	}
	return result.Text, intents, nil
}

func MatchIntent(query, role string, aiEnabled bool) []IntentMatch {
	q := normalizeIntent(query)
	if q == "" {
		return []IntentMatch{}
	}
	registry := []IntentMatch{
		{Intent: "navigate.orders", Action: "open_orders", Confidence: 0.85, Tier: 1, Href: "/dashboard/orders", Args: map[string]any{}, RequiresAI: false},
		{Intent: "navigate.trips", Action: "open_trips", Confidence: 0.85, Tier: 1, Href: "/dashboard/trips", Args: map[string]any{}, RequiresAI: false},
		{Intent: "query.daily_kpi", Action: "open_kpi", Confidence: 0.8, Tier: 1, Href: "/dashboard/kpi", Args: map[string]any{}, RequiresAI: false},
		{Intent: "simulate.vrp_what_if", Action: "create_simulation", Confidence: 0.74, Tier: 1, Args: map[string]any{"type": "vrp_what_if"}, RequiresAI: true},
		{Intent: "execute.create_order_draft", Action: "open_new_order", Confidence: 0.72, Tier: 2, Href: "/dashboard/orders/new", Args: map[string]any{}, RequiresAI: true},
	}
	keywords := map[string][]string{
		"navigate.orders":            []string{"don", "order", "oms"},
		"navigate.trips":             []string{"trip", "chuyen", "xe", "tms"},
		"query.daily_kpi":            []string{"kpi", "doanh thu", "bao cao"},
		"simulate.vrp_what_if":       []string{"neu", "nếu", "vrp", "mo phong", "mô phỏng", "them xe"},
		"execute.create_order_draft": []string{"tao don", "tạo đơn", "lap don", "lặp đơn"},
	}
	result := []IntentMatch{}
	for _, intent := range registry {
		if intent.RequiresAI && !aiEnabled {
			continue
		}
		for _, kw := range keywords[intent.Intent] {
			if strings.Contains(q, normalizeIntent(kw)) {
				result = append(result, intent)
				break
			}
		}
	}
	if len(result) == 0 {
		result = append(result, IntentMatch{Intent: "navigate.search", Action: "manual_search", Confidence: 0.45, Tier: 1, Args: map[string]any{"query": query}, RequiresAI: false})
	}
	return result
}

func normalizeIntent(input string) string {
	return strings.ToLower(strings.TrimSpace(input))
}

func ParseVoiceCommand(transcript, role string) VoiceCommandResult {
	q := normalizeIntent(transcript)
	result := VoiceCommandResult{Transcript: transcript, Confidence: 0.5, Allowed: false, ConfirmRequired: true, AutoCancelSecond: 10, Reasons: []string{"unrecognized_command"}}
	commands := map[string]string{
		"da den diem":       "arrived_stop",
		"đã đến điểm":       "arrived_stop",
		"hoan thanh giao":   "complete_delivery",
		"hoàn thành giao":   "complete_delivery",
		"thu tien":          "collect_payment",
		"thu tiền":          "collect_payment",
		"bao loi":           "report_issue",
		"báo lỗi":           "report_issue",
		"goi dieu phoi":     "call_dispatcher",
		"gọi điều phối":     "call_dispatcher",
		"mo diem tiep theo": "open_next_stop",
		"mở điểm tiếp theo": "open_next_stop",
	}
	for phrase, command := range commands {
		if strings.Contains(q, phrase) {
			result.Command = command
			result.Confidence = 0.82
			result.Allowed = role == "driver" || role == "admin"
			result.Reasons = []string{"whitelisted_command", "visual_confirmation_required"}
			return result
		}
	}
	return result
}

func (s *Service) CreateSimulation(ctx context.Context, simulationType string, rawContext json.RawMessage, userID uuid.UUID) (*SimulationSnapshot, error) {
	if len(rawContext) == 0 {
		rawContext = json.RawMessage(`{}`)
	}
	if !json.Valid(rawContext) {
		return nil, fmt.Errorf("context must be valid JSON")
	}
	options := buildSimulationOptions(simulationType)
	expiresAt := time.Now().Add(5 * time.Minute)
	return s.repo.CreateSimulation(ctx, simulationType, rawContext, options, "A", "Phương án A cân bằng chi phí và độ đúng giờ; cần người duyệt trước khi áp dụng.", expiresAt, userID)
}

func buildSimulationOptions(simulationType string) []SimulationOption {
	if simulationType == "vrp_what_if" || simulationType == "reroute_trip" {
		return []SimulationOption{
			{ID: "A", Title: "Cân bằng", Metrics: map[string]any{"vehicles": 11, "otd_pct": 95, "cost_delta_pct": -6, "late_stops": 1}, Warnings: []string{}},
			{ID: "B", Title: "Tiết kiệm chi phí", Metrics: map[string]any{"vehicles": 10, "otd_pct": 91, "cost_delta_pct": -11, "late_stops": 3}, Warnings: []string{"OTD giảm dưới ngưỡng mục tiêu"}},
			{ID: "C", Title: "Tối đa OTD", Metrics: map[string]any{"vehicles": 13, "otd_pct": 97, "cost_delta_pct": 5, "late_stops": 0}, Warnings: []string{"Chi phí tăng"}},
		}
	}
	return []SimulationOption{
		{ID: "A", Title: "Khuyến nghị", Metrics: map[string]any{"risk": "medium", "impact": "controlled"}, Warnings: []string{}},
		{ID: "B", Title: "Thận trọng", Metrics: map[string]any{"risk": "low", "impact": "limited"}, Warnings: []string{"Hiệu quả thấp hơn"}},
	}
}

func (s *Service) ApplySimulation(ctx context.Context, id uuid.UUID, optionID string, userID uuid.UUID) (*SimulationSnapshot, error) {
	if optionID == "" {
		return nil, fmt.Errorf("option_id is required")
	}
	return s.repo.MarkSimulationApplied(ctx, id, optionID, userID)
}

func (s *Service) GetSimulation(ctx context.Context, id uuid.UUID) (*SimulationSnapshot, error) {
	return s.repo.GetSimulation(ctx, id)
}

func (s *Service) ListTrustSuggestions(ctx context.Context) ([]TrustSuggestion, error) {
	return s.repo.ListTrustSuggestions(ctx)
}
