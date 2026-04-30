package ai

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
)

// ─── Service ─────────────────────────────────────────────────────────────────

type Service struct {
	repo     *Repository
	provider Provider
	log      logger.Logger
}

func NewService(repo *Repository, provider Provider, log logger.Logger) *Service {
	return &Service{repo: repo, provider: provider, log: log}
}

// ─── Anomaly Score (rules-based, no LLM) ─────────────────────────────────────

// ComputeAnomalyScore computes a real-time vehicle anomaly score from GPS signals.
// Called from Control Tower API — no DB write needed (ephemeral score).
func (s *Service) ComputeAnomalyScore(plate string, speedKmh, stopMin, deviationKm float64) AnomalyScore {
	score := ScoreAnomaly(speedKmh, stopMin, deviationKm)
	score.VehiclePlate = plate
	return score
}

// ─── Credit Risk Score (rules-based, no LLM) ─────────────────────────────────

// GetCreditRiskScore computes a credit risk score for a customer.
// Tries cache first; falls back to live DB query + formula.
func (s *Service) GetCreditRiskScore(ctx context.Context, customerID uuid.UUID) (*CreditRiskScore, error) {
	cacheKey := customerID.String()

	// Try cache (6h TTL)
	if content, _, ok := s.repo.GetInsight(ctx, "credit_risk", cacheKey); ok {
		// Cache hit — parse narrative back
		return &CreditRiskScore{
			CustomerID: customerID,
			Narrative:  content,
			Level:      extractLevelFromNarrative(content),
			ComputedAt: time.Now(),
			DebtTrend:  "stable",
		}, nil
	}

	input, err := s.repo.GetCreditRiskInput(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("ai.GetCreditRiskScore: %w", err)
	}

	result := ScoreCreditRisk(*input)

	// Cache the narrative
	if saveErr := s.repo.SaveInsight(ctx, "credit_risk", cacheKey, result.Narrative, "rules"); saveErr != nil {
		s.log.Warn(ctx, "ai.credit_risk_cache_save_failed", logger.F("err", saveErr.Error()))
	}

	return &result, nil
}

// ─── Dispatch Brief (LLM) ────────────────────────────────────────────────────

// GetDispatchBrief returns today's dispatch briefing.
// Checks cache first (refreshed by cron at 7h daily).
func (s *Service) GetDispatchBrief(ctx context.Context) (*DispatchBrief, error) {
	today := time.Now().Format("2006-01-02")

	// Cache hit
	if content, prov, ok := s.repo.GetInsight(ctx, "dispatch_brief", today); ok {
		if isFallbackBriefProvider(prov) && cloudProviderConfigured() {
			return s.generateDispatchBrief(ctx, today)
		}
		dc, _ := s.repo.GetDispatchContext(ctx)
		brief := &DispatchBrief{
			Date:        today,
			Summary:     content,
			Provider:    prov,
			GeneratedAt: time.Now(),
		}
		if dc != nil {
			brief.TotalOrders = dc.TotalOrders
			brief.AtRiskNPPs = dc.AtRiskNPPs
			brief.ActiveTrips = dc.ActiveTrips
			brief.Exceptions = dc.OpenExceptions
		}
		return brief, nil
	}

	return s.generateDispatchBrief(ctx, today)
}

func (s *Service) RefreshDispatchBrief(ctx context.Context) (*DispatchBrief, error) {
	return s.generateDispatchBrief(ctx, time.Now().Format("2006-01-02"))
}

func cloudProviderConfigured() bool {
	return os.Getenv("GROQ_API_KEY") != "" || os.Getenv("GEMINI_API_KEY") != ""
}

func isFallbackBriefProvider(provider string) bool {
	lower := strings.ToLower(provider)
	return lower == "" || strings.Contains(lower, "mock") || strings.Contains(lower, "rules")
}

func (s *Service) generateDispatchBrief(ctx context.Context, date string) (*DispatchBrief, error) {
	dc, err := s.repo.GetDispatchContext(ctx)
	if err != nil {
		return nil, err
	}

	prompt := fmt.Sprintf(`Bạn là trợ lý điều phối logistics cho công ty bia BHL.
Hãy viết 1 đoạn tóm tắt ngắn gọn (5-6 câu tiếng Việt tự nhiên) cho dispatcher biết tình hình hôm nay.

Số liệu hôm nay (%s):
- Tổng đơn hàng: %d (đang chờ xử lý: %d)
- Chuyến xe đang hoạt động: %d
- NPP có rủi ro churn (điểm thấp): %d
- Cảnh báo GPS đang mở: %d

Viết ngắn gọn, thực tế, tập trung điểm cần chú ý nhất. Không dùng gạch đầu dòng. Không thêm lời chào hay tiêu đề.`,
		dc.Date, dc.TotalOrders, dc.PendingOrders, dc.ActiveTrips, dc.AtRiskNPPs, dc.OpenExceptions,
	)

	result, err := s.GenerateWithPrivacy(ctx, AIProviderCall{FeatureKey: FlagBriefing, ActionType: "dispatch_brief", Prompt: prompt})
	text := ""
	provider := s.provider.Name()
	if err != nil {
		s.log.Warn(ctx, "ai.dispatch_brief_llm_failed", logger.F("err", err.Error()))
		text = fmt.Sprintf("Hôm nay %s: %d đơn (%d đang chờ), %d chuyến active, %d NPP cần theo dõi, %d cảnh báo GPS đang mở.",
			dc.Date, dc.TotalOrders, dc.PendingOrders, dc.ActiveTrips, dc.AtRiskNPPs, dc.OpenExceptions)
		provider = "rules"
	} else {
		text = result.Text
		provider = result.Provider
	}

	_ = s.repo.SaveInsight(ctx, "dispatch_brief", date, text, provider)

	return &DispatchBrief{
		Date:        date,
		Summary:     text,
		TotalOrders: dc.TotalOrders,
		AtRiskNPPs:  dc.AtRiskNPPs,
		ActiveTrips: dc.ActiveTrips,
		Exceptions:  dc.OpenExceptions,
		GeneratedAt: time.Now(),
		Provider:    provider,
	}, nil
}

// ─── Exception Explanation (LLM) ─────────────────────────────────────────────

// ExplainAnomaly generates a human-readable explanation for a GPS anomaly.
func (s *Service) ExplainAnomaly(ctx context.Context, anomalyID uuid.UUID) (*ExceptionExplanation, error) {
	cacheKey := anomalyID.String()

	if content, prov, ok := s.repo.GetInsight(ctx, "exception_explain", cacheKey); ok {
		return &ExceptionExplanation{
			AnomalyID:   anomalyID,
			Explanation: content,
			Suggestions: []string{"Liên hệ tài xế qua điện thoại", "Theo dõi GPS trong 10 phút tiếp theo"},
			Confidence:  "medium",
			Provider:    prov,
			GeneratedAt: time.Now(),
		}, nil
	}

	ac, err := s.repo.GetAnomalyContext(ctx, anomalyID)
	if err != nil {
		return nil, fmt.Errorf("ai.ExplainAnomaly: %w", err)
	}

	anomalyTypeVN := map[string]string{
		"deviation":    "lệch tuyến",
		"stop_overdue": "dừng lâu bất thường",
		"speed_high":   "vi phạm tốc độ",
		"off_route":    "ra khỏi tuyến kế hoạch",
	}
	typeVN, ok := anomalyTypeVN[ac.AnomalyType]
	if !ok {
		typeVN = ac.AnomalyType
	}

	pastNote := ""
	if ac.PastCount > 0 {
		pastNote = fmt.Sprintf("Trong 30 ngày qua xe này đã có %d lần tương tự.", ac.PastCount)
	}

	prompt := fmt.Sprintf(`Bạn là chuyên gia giám sát vận tải logistics.
Hãy giải thích ngắn gọn (2-3 câu tiếng Việt) sự kiện sau và đưa ra 2 hành động cụ thể cho dispatcher.

Sự kiện: %s
Xe: %s, Lái xe: %s
Chi tiết: %s
Khoảng cách lệch: %.1f km, Thời gian dừng: %.0f phút
Thời điểm: %s
%s

Định dạng output:
GIẢI THÍCH: [2-3 câu]
HÀNH ĐỘNG 1: [hành động cụ thể]
HÀNH ĐỘNG 2: [hành động cụ thể]`,
		typeVN, ac.VehiclePlate, ac.DriverName, ac.Description,
		ac.DistanceKm, ac.DurationMin,
		ac.DetectedAt.Format("15:04 02/01/2006"), pastNote,
	)

	result, genErr := s.GenerateWithPrivacy(ctx, AIProviderCall{FeatureKey: FlagExplainability, ActionType: "explain_anomaly", Prompt: prompt})
	text := ""
	provider := s.provider.Name()
	if genErr != nil {
		s.log.Warn(ctx, "ai.explain_anomaly_llm_failed", logger.F("err", genErr.Error()))
		text = fmt.Sprintf("GIẢI THÍCH: Xe %s %s (%.1f km, %.0f phút). %s\nHÀNH ĐỘNG 1: Gọi điện tài xế xác nhận tình trạng\nHÀNH ĐỘNG 2: Theo dõi GPS trong 10 phút tiếp theo",
			ac.VehiclePlate, typeVN, ac.DistanceKm, ac.DurationMin, pastNote)
		provider = "rules"
	} else {
		text = result.Text
		provider = result.Provider
	}

	_ = s.repo.SaveInsight(ctx, "exception_explain", cacheKey, text, provider)

	explanation, suggestions := parseExplanationOutput(text)
	return &ExceptionExplanation{
		AnomalyID:   anomalyID,
		Explanation: explanation,
		Suggestions: suggestions,
		Confidence:  "high",
		Provider:    provider,
		GeneratedAt: time.Now(),
	}, nil
}

// ─── NPP Zalo Draft (LLM) ────────────────────────────────────────────────────

// GenerateNPPZaloDraft creates a draft Zalo message for DVKH to review.
func (s *Service) GenerateNPPZaloDraft(ctx context.Context, customerID uuid.UUID) (*NPPZaloDraft, error) {
	nc, err := s.repo.GetNPPZaloContext(ctx, customerID)
	if err != nil {
		return nil, fmt.Errorf("ai.GenerateNPPZaloDraft: %w", err)
	}

	cacheKey := customerID.String()
	if content, provider, ok := s.repo.GetInsight(ctx, "npp_zalo_draft", cacheKey); ok {
		return &NPPZaloDraft{
			CustomerID:   customerID,
			CustomerName: nc.CustomerName,
			HealthScore:  nc.HealthScore,
			DraftMessage: content,
			Reason:       fmt.Sprintf("NPP chưa đặt hàng %d ngày, health score %d/100", nc.LastOrderDays, nc.HealthScore),
			Provider:     provider,
			GeneratedAt:  time.Now(),
		}, nil
	}

	prompt := fmt.Sprintf(`Bạn là nhân viên DVKH của công ty bia BHL, viết tin nhắn Zalo ngắn gọn (2-3 câu)
để hỏi thăm và nhắc khéo NPP về việc đặt hàng. Giọng thân thiện, tự nhiên, không sáo rỗng.

Thông tin NPP:
- Tên: %s
- Ngày đặt hàng cuối: %d ngày trước
- Tổng đơn đã đặt: %d đơn

Chỉ viết nội dung tin nhắn, không thêm tiêu đề hay giải thích.`,
		nc.CustomerName, nc.LastOrderDays, nc.TotalOrders,
	)

	result, genErr := s.GenerateWithPrivacy(ctx, AIProviderCall{FeatureKey: FlagCopilot, ActionType: "npp_zalo_draft", Prompt: prompt})
	draft := ""
	provider := s.provider.Name()
	if genErr != nil {
		s.log.Warn(ctx, "ai.npp_zalo_draft_failed", logger.F("err", genErr.Error()))
		draft = fmt.Sprintf("Chào %s! BHL gửi lời hỏi thăm. Anh/chị cần đặt hàng gì không ạ? BHL sẵn sàng phục vụ!", nc.CustomerName)
		provider = "rules"
	} else {
		draft = result.Text
		provider = result.Provider
	}

	reason := fmt.Sprintf("NPP chưa đặt hàng %d ngày, health score %d/100", nc.LastOrderDays, nc.HealthScore)
	if saveErr := s.repo.SaveInsight(ctx, "npp_zalo_draft", cacheKey, draft, provider); saveErr != nil {
		s.log.Warn(ctx, "ai.npp_zalo_draft_cache_save_failed", logger.F("err", saveErr.Error()))
	}

	return &NPPZaloDraft{
		CustomerID:   customerID,
		CustomerName: nc.CustomerName,
		HealthScore:  nc.HealthScore,
		DraftMessage: draft,
		Reason:       reason,
		Provider:     provider,
		GeneratedAt:  time.Now(),
	}, nil
}

// ─── Seasonal Alert (rules-based) ────────────────────────────────────────────

// CheckOrderSeasonalAlert checks if an order quantity is below seasonal expectation.
func (s *Service) CheckOrderSeasonalAlert(ctx context.Context, sku, warehouseCode string, orderedQty, historicalAvg float64) (*SeasonalAlert, error) {
	month := time.Now().Month()
	idx, err := s.repo.GetSeasonalIndex(ctx, warehouseCode, int(month))
	if err != nil {
		return nil, err
	}
	alert := CheckSeasonalAlert(sku, warehouseCode, int(month), orderedQty, historicalAvg, idx, 0.70)
	return &alert, nil
}

// ─── RunDailyBriefingCron generates and caches the daily dispatch briefing at 7h ─

func (s *Service) RunDailyBriefingCron(ctx context.Context) {
	s.log.Info(ctx, "ai.daily_briefing_cron_started", logger.F("cron", "07:00_daily"))
	loc, err := time.LoadLocation("Asia/Ho_Chi_Minh")
	if err != nil {
		loc = time.Local
	}

	for {
		now := time.Now().In(loc)
		next := time.Date(now.Year(), now.Month(), now.Day(), 7, 0, 0, 0, loc)
		if !now.Before(next) {
			next = next.Add(24 * time.Hour)
		}
		s.log.Info(ctx, "ai.daily_briefing_cron_next", logger.F("next_run", next.Format("2006-01-02 15:04")))

		select {
		case <-ctx.Done():
			s.log.Info(ctx, "ai.daily_briefing_cron_stopped")
			return
		case <-time.After(next.Sub(now)):
			if _, err := s.generateDispatchBrief(ctx, time.Now().In(loc).Format("2006-01-02")); err != nil {
				s.log.Warn(ctx, "ai.daily_briefing_cron_failed", logger.F("err", err.Error()))
			}
		}
	}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func extractLevelFromNarrative(s string) string {
	if containsAny(s, "RẤT CAO", "critical") {
		return "critical"
	}
	if containsAny(s, "CAO", "high") {
		return "high"
	}
	if containsAny(s, "TRUNG BÌNH", "medium") {
		return "medium"
	}
	return "low"
}

func containsAny(s string, subs ...string) bool {
	for _, sub := range subs {
		if len(s) >= len(sub) {
			for i := 0; i <= len(s)-len(sub); i++ {
				if s[i:i+len(sub)] == sub {
					return true
				}
			}
		}
	}
	return false
}

func parseExplanationOutput(text string) (explanation string, suggestions []string) {
	// Parse structured output from LLM: "GIẢI THÍCH: ...\nHÀNH ĐỘNG 1: ...\nHÀNH ĐỘNG 2: ..."
	lines := splitLines(text)
	explanation = text
	suggestions = []string{"Liên hệ tài xế qua điện thoại", "Theo dõi GPS trong 10 phút tiếp theo"}

	var explParts []string
	for _, line := range lines {
		if len(line) > 10 && line[:9] == "GIẢI THÍCH" {
			explanation = trimPrefix(line, "GIẢI THÍCH: ")
		} else if len(line) > 12 && line[:11] == "HÀNH ĐỘNG 1" {
			suggestions[0] = trimPrefix(line, "HÀNH ĐỘNG 1: ")
		} else if len(line) > 12 && line[:11] == "HÀNH ĐỘNG 2" {
			if len(suggestions) > 1 {
				suggestions[1] = trimPrefix(line, "HÀNH ĐỘNG 2: ")
			}
		} else if line != "" {
			explParts = append(explParts, line)
		}
	}
	if explanation == text && len(explParts) > 0 {
		explanation = explParts[0]
	}
	return
}

func splitLines(s string) []string {
	var lines []string
	start := 0
	for i, c := range s {
		if c == '\n' {
			lines = append(lines, s[start:i])
			start = i + 1
		}
	}
	lines = append(lines, s[start:])
	return lines
}

func trimPrefix(s, prefix string) string {
	if len(s) >= len(prefix) && s[:len(prefix)] == prefix {
		return s[len(prefix):]
	}
	return s
}
