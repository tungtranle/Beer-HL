// Package ai provides the AI intelligence layer for BHL OMS-TMS-WMS.
//
// Architecture:
//   - Provider interface: abstraction over LLM backends (Gemini, Groq, mock)
//   - RulesEngine: deterministic scoring (anomaly score, credit risk, seasonal alert)
//   - GeminiProvider: Google Gemini 2.0 Flash free-tier (1,500 req/day)
//   - Service: orchestrates rules + LLM, caches results in ai_insights table
//
// Cost: $0/month — Gemini free tier handles ~50 req/day BHL needs.
package ai

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ─── Provider interface ──────────────────────────────────────────────────────

// Provider is the abstraction over any LLM backend.
// Swap between Gemini, Groq, Ollama by changing config — zero code change.
type Provider interface {
	// Generate sends a prompt and returns the text response.
	// Returns empty string + nil error when running in mock mode.
	Generate(ctx context.Context, prompt string) (string, error)
	// Name returns the provider identifier for logging.
	Name() string
}

// ─── Domain types ────────────────────────────────────────────────────────────

// AnomalyScore is a real-time AI score for a vehicle derived from rules.
type AnomalyScore struct {
	VehiclePlate string    `json:"vehicle_plate"`
	Score        int       `json:"score"`       // 0–100, higher = more anomalous
	Level        string    `json:"level"`       // "normal" | "watch" | "alert" | "critical"
	SpeedScore   int       `json:"speed_score"` // contribution from speed deviation
	StopScore    int       `json:"stop_score"`  // contribution from unplanned stop
	RouteScore   int       `json:"route_score"` // contribution from route deviation km
	LastUpdated  time.Time `json:"last_updated"`
}

// CreditRiskScore is a rule-based risk assessment for a customer (NPP).
type CreditRiskScore struct {
	CustomerID   uuid.UUID `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	Score        int       `json:"score"` // 0–100, higher = riskier
	Level        string    `json:"level"` // "low" | "medium" | "high" | "critical"
	PaymentDelay int       `json:"payment_delay_days"`
	DebtTrend    string    `json:"debt_trend"` // "stable" | "increasing" | "decreasing"
	OrderDropPct float64   `json:"order_drop_pct"`
	Narrative    string    `json:"narrative"` // AI-generated or rule-template explanation
	ComputedAt   time.Time `json:"computed_at"`
}

// DispatchBrief is a daily AI-generated summary for dispatchers.
type DispatchBrief struct {
	Date        string    `json:"date"`
	Summary     string    `json:"summary"` // 5-6 câu tiếng Việt từ Gemini
	TotalOrders int       `json:"total_orders"`
	AtRiskNPPs  int       `json:"at_risk_npps"`
	ActiveTrips int       `json:"active_trips"`
	Exceptions  int       `json:"exceptions"`
	GeneratedAt time.Time `json:"generated_at"`
	Provider    string    `json:"provider"` // "gemini" | "groq" | "rules"
}

// ExceptionExplanation is an AI-generated explanation for a trip exception/anomaly.
type ExceptionExplanation struct {
	AnomalyID   uuid.UUID `json:"anomaly_id"`
	Explanation string    `json:"explanation"` // tiếng Việt
	Suggestions []string  `json:"suggestions"` // 2 action items
	Confidence  string    `json:"confidence"`  // "high" | "medium" | "low"
	Provider    string    `json:"provider"`
	GeneratedAt time.Time `json:"generated_at"`
}

// SeasonalAlert is an inline warning shown in OMS order form.
type SeasonalAlert struct {
	SKU           string  `json:"sku"`
	WarehouseCode string  `json:"warehouse_code"`
	Month         int     `json:"month"`
	SeasonalIndex float64 `json:"seasonal_index"` // 100 = average month
	OrderedQty    float64 `json:"ordered_qty"`
	ExpectedQty   float64 `json:"expected_qty"`
	DropPct       float64 `json:"drop_pct"`
	AlertLevel    string  `json:"alert_level"` // "none" | "low" | "high"
	Message       string  `json:"message"`
}

// NPPZaloDraft is an AI-drafted Zalo message for DVKH to review before sending.
type NPPZaloDraft struct {
	CustomerID   uuid.UUID `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	HealthScore  int       `json:"health_score"`
	DraftMessage string    `json:"draft_message"` // tiếng Việt, natural tone
	Reason       string    `json:"reason"`        // why this draft was generated
	Provider     string    `json:"provider"`
	GeneratedAt  time.Time `json:"generated_at"`
}
