package ai

import (
	"fmt"
	"math"
	"time"

	"github.com/google/uuid"
)

// ─── Rules Engine ────────────────────────────────────────────────────────────
// All scoring is deterministic — no API call needed.
// Weights are tuned for BHL operations based on historical anomaly patterns.

// ─── Anomaly Score ───────────────────────────────────────────────────────────

// anomalyLevel maps a 0-100 score to a human label.
func anomalyLevel(score int) string {
	switch {
	case score >= 75:
		return "critical"
	case score >= 50:
		return "alert"
	case score >= 25:
		return "watch"
	default:
		return "normal"
	}
}

// ScoreAnomaly computes a 0–100 vehicle anomaly score from three signals.
//   - speedKmh: current GPS speed
//   - stopDurationMin: minutes vehicle has been stationary (0 if moving)
//   - routeDeviationKm: distance in km from planned route (0 if on-route)
//
// Weights: stop(40%) + deviation(35%) + speed(25%) — stop is most indicative
// of an issue in BHL's delivery context.
func ScoreAnomaly(speedKmh, stopDurationMin, routeDeviationKm float64) AnomalyScore {
	// Speed score: 0 if normal (<80), rises toward 100 as speed exceeds 100 kmh
	speedScore := 0
	if speedKmh > 100 {
		speedScore = int(math.Min(100, (speedKmh-100)/50*100))
	} else if speedKmh < 0.1 && stopDurationMin == 0 {
		// GPS signal lost (speed=0 but not a known stop)
		speedScore = 20
	}

	// Stop score: 0 up to 10 min, then rises — 30+ min = max
	stopScore := 0
	if stopDurationMin > 10 {
		stopScore = int(math.Min(100, (stopDurationMin-10)/20*100))
	}

	// Route deviation score: 0 up to 0.5km, rises — 3km+ = max
	routeScore := 0
	if routeDeviationKm > 0.5 {
		routeScore = int(math.Min(100, (routeDeviationKm-0.5)/2.5*100))
	}

	// Weighted composite
	composite := int(float64(stopScore)*0.40 + float64(routeScore)*0.35 + float64(speedScore)*0.25)

	return AnomalyScore{
		Score:       composite,
		Level:       anomalyLevel(composite),
		SpeedScore:  speedScore,
		StopScore:   stopScore,
		RouteScore:  routeScore,
		LastUpdated: time.Now(),
	}
}

// ─── Credit Risk Score ───────────────────────────────────────────────────────

// CreditRiskInput holds the raw signals for scoring a customer.
type CreditRiskInput struct {
	CustomerID       uuid.UUID
	CustomerName     string
	PaymentDelayDays int     // average days overdue on payments
	DebtChangeD30    float64 // debt amount change over 30 days (+= increase)
	OrderChangeD30   float64 // % change in order qty over 30 days (-= drop)
	CurrentDebt      float64 // current outstanding receivable
	CreditLimit      float64 // approved credit limit
}

// ScoreCreditRisk computes a 0–100 credit risk score using a weighted formula.
// Higher = riskier. Thresholds tuned for BHL NPP profile.
func ScoreCreditRisk(in CreditRiskInput) CreditRiskScore {
	// Payment delay signal: 0 = no delay, 100 = 30+ days overdue
	delayScore := int(math.Min(100, float64(in.PaymentDelayDays)/30*100))

	// Debt trend signal: positive = debt growing, 100 = debt grew 50%+ in 30 days
	debtScore := 0
	if in.DebtChangeD30 > 0 && in.CreditLimit > 0 {
		debtScore = int(math.Min(100, in.DebtChangeD30/in.CreditLimit*200))
	}

	// Order drop signal: negative change means dropped orders
	orderScore := 0
	if in.OrderChangeD30 < 0 {
		orderScore = int(math.Min(100, math.Abs(in.OrderChangeD30)*1.5))
	}

	// Utilization signal: debt near or over limit
	utilScore := 0
	if in.CreditLimit > 0 {
		util := in.CurrentDebt / in.CreditLimit
		if util > 0.8 {
			utilScore = int(math.Min(100, (util-0.8)/0.2*100))
		}
	}

	// Weights: payment_delay(35%) + debt_trend(25%) + util(25%) + order_drop(15%)
	score := int(float64(delayScore)*0.35 + float64(debtScore)*0.25 +
		float64(utilScore)*0.25 + float64(orderScore)*0.15)

	level := "low"
	switch {
	case score >= 70:
		level = "critical"
	case score >= 50:
		level = "high"
	case score >= 30:
		level = "medium"
	}

	debtTrend := "stable"
	if in.DebtChangeD30 > 0 {
		debtTrend = "increasing"
	} else if in.DebtChangeD30 < 0 {
		debtTrend = "decreasing"
	}

	// Rule-template narrative (no LLM needed for scoring UI)
	narrative := buildCreditNarrative(in, score, level, debtTrend)

	return CreditRiskScore{
		CustomerID:   in.CustomerID,
		CustomerName: in.CustomerName,
		Score:        score,
		Level:        level,
		PaymentDelay: in.PaymentDelayDays,
		DebtTrend:    debtTrend,
		OrderDropPct: math.Max(0, -in.OrderChangeD30),
		Narrative:    narrative,
		ComputedAt:   time.Now(),
	}
}

func buildCreditNarrative(in CreditRiskInput, score int, level, debtTrend string) string {
	switch level {
	case "critical":
		return fmt.Sprintf(
			"%s: rủi ro RẤT CAO (điểm %d/100). Nợ %s trong 30 ngày, thanh toán trễ %d ngày, "+
				"tổng dư nợ %.0f VNĐ. Đề xuất: giảm hạn mức và yêu cầu thanh toán trước.",
			in.CustomerName, score, debtTrend, in.PaymentDelayDays, in.CurrentDebt,
		)
	case "high":
		return fmt.Sprintf(
			"%s: rủi ro CAO (điểm %d/100). Nợ %s, trễ hạn %d ngày. "+
				"Cần theo dõi sát và nhắc thanh toán.",
			in.CustomerName, score, debtTrend, in.PaymentDelayDays,
		)
	case "medium":
		return fmt.Sprintf(
			"%s: rủi ro TRUNG BÌNH (điểm %d/100). Xu hướng nợ %s. Theo dõi tiếp.",
			in.CustomerName, score, debtTrend,
		)
	default:
		return fmt.Sprintf("%s: rủi ro THẤP (điểm %d/100). Thanh toán ổn định.", in.CustomerName, score)
	}
}

// ─── Seasonal Alert ──────────────────────────────────────────────────────────

// SeasonalIndexEntry is loaded from ml_features.seasonal_indices table.
type SeasonalIndexEntry struct {
	WarehouseCode string
	Month         int
	Index         float64 // 100 = average month
}

// CheckSeasonalAlert computes whether an order quantity is significantly
// below the seasonal expectation for this SKU/warehouse/month.
// threshold: 0.70 means "warn if ordered < 70% of seasonal expectation".
func CheckSeasonalAlert(
	sku, warehouseCode string,
	month int,
	orderedQty, historicalAvgQty, seasonalIndex float64,
	threshold float64,
) SeasonalAlert {
	if historicalAvgQty <= 0 || seasonalIndex <= 0 {
		return SeasonalAlert{SKU: sku, WarehouseCode: warehouseCode,
			Month: month, AlertLevel: "none"}
	}

	expectedQty := historicalAvgQty * (seasonalIndex / 100.0)
	if expectedQty <= 0 {
		return SeasonalAlert{SKU: sku, AlertLevel: "none"}
	}

	dropPct := (expectedQty - orderedQty) / expectedQty * 100
	alertLevel := "none"
	message := ""

	switch {
	case orderedQty < expectedQty*(1-threshold):
		alertLevel = "high"
		message = fmt.Sprintf(
			"Tháng %d thường cần ~%.0f %s (chỉ số mùa vụ %.0f%%). "+
				"Đơn này chỉ %.0f — thấp hơn dự kiến %.0f%%.",
			month, expectedQty, sku, seasonalIndex, orderedQty, dropPct,
		)
	case orderedQty < expectedQty*0.85:
		alertLevel = "low"
		message = fmt.Sprintf(
			"Đơn %s tháng %d thấp hơn mức thường của NPP này. Kiểm tra lại nhu cầu.",
			sku, month,
		)
	}

	return SeasonalAlert{
		SKU:           sku,
		WarehouseCode: warehouseCode,
		Month:         month,
		SeasonalIndex: seasonalIndex,
		OrderedQty:    orderedQty,
		ExpectedQty:   expectedQty,
		DropPct:       dropPct,
		AlertLevel:    alertLevel,
		Message:       message,
	}
}
