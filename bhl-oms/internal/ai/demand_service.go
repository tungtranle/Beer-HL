package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"os"
	"strings"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
)

func (s *Service) GetDemandForecast(ctx context.Context, customerID, productID, warehouseID uuid.UUID, horizonWeeks int) (*DemandForecast, error) {
	if horizonWeeks <= 0 || horizonWeeks > 8 {
		horizonWeeks = 4
	}
	fc, err := s.repo.GetDemandForecastContext(ctx, customerID, productID, warehouseID)
	if err != nil {
		return nil, err
	}

	result, err := s.callDemandForecastSolver(ctx, fc, horizonWeeks)
	if err != nil {
		s.log.Warn(ctx, "ai.demand_forecast_solver_failed", logger.F("err", err.Error()))
		result = fallbackDemandForecast(fc, horizonWeeks, err.Error())
	}
	return result, nil
}

func (s *Service) ListOutreachQueue(ctx context.Context, limit int) ([]OutreachQueueItem, error) {
	items, err := s.repo.ListOutreachQueue(ctx, limit)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return []OutreachQueueItem{}, nil
	}
	return items, nil
}

func (s *Service) callDemandForecastSolver(ctx context.Context, fc *DemandForecastContext, horizonWeeks int) (*DemandForecast, error) {
	baseURL := strings.TrimRight(os.Getenv("VRP_SOLVER_URL"), "/")
	if baseURL == "" {
		baseURL = "http://localhost:8090"
	}
	body, err := json.Marshal(map[string]any{
		"sku":            fc.SKU,
		"npp_code":       fc.CustomerCode,
		"warehouse_code": fc.WarehouseCode,
		"horizon_weeks":  horizonWeeks,
		"history":        fc.History,
		"baseline_qty":   fc.BaselineQty,
	})
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/ml/forecast-demand", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("solver status %d", resp.StatusCode)
	}

	var raw struct {
		HistoryPoints int                   `json:"history_points"`
		ModelMethod   string                `json:"model_method"`
		Confidence    float64               `json:"confidence"`
		Forecast      []DemandForecastPoint `json:"forecast"`
		Explanation   string                `json:"explanation"`
		GeneratedAt   string                `json:"generated_at"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}
	generatedAt, _ := time.Parse(time.RFC3339, raw.GeneratedAt)
	if generatedAt.IsZero() {
		generatedAt = time.Now()
	}
	return &DemandForecast{
		DemandForecastContext: *fc,
		HorizonWeeks:          horizonWeeks,
		HistoryPoints:         raw.HistoryPoints,
		ModelMethod:           raw.ModelMethod,
		Confidence:            raw.Confidence,
		Forecast:              raw.Forecast,
		Explanation:           raw.Explanation,
		Provider:              "vrp-solver",
		GeneratedAt:           generatedAt,
	}, nil
}

func fallbackDemandForecast(fc *DemandForecastContext, horizonWeeks int, reason string) *DemandForecast {
	baseline := fc.BaselineQty
	if baseline <= 0 && len(fc.History) > 0 {
		for _, point := range fc.History {
			baseline += point.Qty
		}
		baseline = baseline / float64(len(fc.History))
	}
	if baseline < 0 {
		baseline = 0
	}
	forecast := make([]DemandForecastPoint, 0, horizonWeeks)
	weekStart := nextMonday(time.Now())
	for i := 0; i < horizonWeeks; i++ {
		qty := math.Round(baseline*100) / 100
		forecast = append(forecast, DemandForecastPoint{
			WeekStart: weekStart.AddDate(0, 0, i*7).Format("2006-01-02"),
			QtyPred:   qty,
			QtyLower:  math.Round(qty*0.8*100) / 100,
			QtyUpper:  math.Round(qty*1.2*100) / 100,
		})
	}
	return &DemandForecast{
		DemandForecastContext: *fc,
		HorizonWeeks:          horizonWeeks,
		HistoryPoints:         len(fc.History),
		ModelMethod:           "rules-fallback",
		Confidence:            0.45,
		Forecast:              forecast,
		Explanation:           "ML service chưa sẵn sàng, hệ thống dùng trung bình lịch sử làm dự báo tạm thời: " + reason,
		Provider:              "rules",
		GeneratedAt:           time.Now(),
	}
}

func nextMonday(now time.Time) time.Time {
	daysUntilMonday := (int(time.Monday) - int(now.Weekday()) + 7) % 7
	if daysUntilMonday == 0 {
		daysUntilMonday = 7
	}
	return time.Date(now.Year(), now.Month(), now.Day()+daysUntilMonday, 0, 0, 0, 0, now.Location())
}
