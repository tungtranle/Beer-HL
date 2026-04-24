package ai

import (
	"context"
	"fmt"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ─── Repository ──────────────────────────────────────────────────────────────

type Repository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRepository(db *pgxpool.Pool, log logger.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// ─── ai_insights cache ───────────────────────────────────────────────────────

// SaveInsight upserts an LLM-generated insight into ai_insights table.
func (r *Repository) SaveInsight(ctx context.Context, insightType, entityID, content, provider string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO ai_insights (insight_type, entity_id, content, provider, generated_at, expires_at)
		VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '6 hours')
		ON CONFLICT (insight_type, entity_id)
		DO UPDATE SET content = EXCLUDED.content, provider = EXCLUDED.provider,
		              generated_at = NOW(), expires_at = NOW() + INTERVAL '6 hours'
	`, insightType, entityID, content, provider)
	return err
}

// GetInsight retrieves a cached insight if not expired.
func (r *Repository) GetInsight(ctx context.Context, insightType, entityID string) (string, string, bool) {
	var content, provider string
	err := r.db.QueryRow(ctx, `
		SELECT content, provider FROM ai_insights
		WHERE insight_type = $1 AND entity_id = $2 AND expires_at > NOW()
	`, insightType, entityID).Scan(&content, &provider)
	if err != nil {
		return "", "", false
	}
	return content, provider, true
}

// ─── Credit risk inputs ───────────────────────────────────────────────────────

// GetCreditRiskInput queries raw signals for a customer from OMS data.
func (r *Repository) GetCreditRiskInput(ctx context.Context, customerID uuid.UUID) (*CreditRiskInput, error) {
	var in CreditRiskInput
	in.CustomerID = customerID

	err := r.db.QueryRow(ctx, `
		SELECT
			c.name,
			COALESCE(
				(SELECT AVG(EXTRACT(DAY FROM (NOW() - d.created_at)))
				 FROM orders d
				 WHERE d.customer_id = c.id
				   AND d.status = 'delivered'
				   AND d.created_at > NOW() - INTERVAL '90 days'), 0
			) AS payment_delay_days,
			COALESCE(
				(SELECT SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END)
				 FROM receivable_ledger WHERE customer_id = c.id
				   AND created_at > NOW() - INTERVAL '30 days'), 0
			) AS debt_change_d30,
			COALESCE(
				(SELECT SUM(CASE WHEN type = 'debit' THEN amount ELSE -amount END)
				 FROM receivable_ledger WHERE customer_id = c.id), 0
			) AS current_debt,
			COALESCE(cl.credit_limit, 0) AS credit_limit,
			COALESCE(
				(SELECT
					(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::float -
					 COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days')::float)
					/ NULLIF(COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days')::float, 0) * 100
				 FROM orders WHERE customer_id = c.id AND status NOT IN ('cancelled')), 0
			) AS order_change_d30
		FROM customers c
		LEFT JOIN credit_limits cl ON cl.customer_id = c.id
		WHERE c.id = $1
	`, customerID).Scan(
		&in.CustomerName,
		&in.PaymentDelayDays,
		&in.DebtChangeD30,
		&in.CurrentDebt,
		&in.CreditLimit,
		&in.OrderChangeD30,
	)
	if err != nil {
		return nil, fmt.Errorf("ai.repo.GetCreditRiskInput: %w", err)
	}
	return &in, nil
}

// ─── Dispatch brief context ───────────────────────────────────────────────────

// DispatchContext holds stats for building a dispatch briefing prompt.
type DispatchContext struct {
	Date           string
	TotalOrders    int
	PendingOrders  int
	ActiveTrips    int
	AtRiskNPPs     int
	OpenExceptions int
}

// GetDispatchContext loads today's operational stats for the briefing prompt.
func (r *Repository) GetDispatchContext(ctx context.Context) (*DispatchContext, error) {
	dc := &DispatchContext{Date: time.Now().Format("02/01/2006")}

	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS total_orders,
			COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND status IN ('pending','confirmed','approved')) AS pending_orders
		FROM orders
	`).Scan(&dc.TotalOrders, &dc.PendingOrders)
	if err != nil {
		r.log.Warn(ctx, "ai.repo.dispatch_orders_failed", logger.F("err", err.Error()))
	}

	_ = r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM trips WHERE status IN ('in_transit','assigned','ready') AND DATE(planned_date) = CURRENT_DATE
	`).Scan(&dc.ActiveTrips)

	_ = r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM ml_features.npp_health_scores WHERE risk_band = 'RED'
	`).Scan(&dc.AtRiskNPPs)

	_ = r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM gps_anomalies WHERE status = 'open'
	`).Scan(&dc.OpenExceptions)

	return dc, nil
}

// ─── Anomaly context for explanation ─────────────────────────────────────────

// AnomalyContext holds details about an anomaly for building an explanation prompt.
type AnomalyContext struct {
	AnomalyID    uuid.UUID
	VehiclePlate string
	DriverName   string
	AnomalyType  string
	Description  string
	DistanceKm   float64
	DurationMin  float64
	DetectedAt   time.Time
	PastCount    int // how many similar anomalies for this vehicle in last 30 days
}

// GetAnomalyContext loads an anomaly with enriched context for LLM prompt.
func (r *Repository) GetAnomalyContext(ctx context.Context, anomalyID uuid.UUID) (*AnomalyContext, error) {
	ac := &AnomalyContext{AnomalyID: anomalyID}

	err := r.db.QueryRow(ctx, `
		SELECT
			a.vehicle_plate,
			COALESCE(d.full_name, '') AS driver_name,
			a.anomaly_type::text,
			a.description,
			COALESCE(a.distance_km, 0),
			COALESCE(a.duration_min, 0),
			a.detected_at,
			(SELECT COUNT(*) FROM gps_anomalies x
			 WHERE x.vehicle_id = a.vehicle_id AND x.anomaly_type = a.anomaly_type
			   AND x.detected_at > NOW() - INTERVAL '30 days' AND x.id != a.id)
		FROM gps_anomalies a
		LEFT JOIN drivers d ON d.id = a.driver_id
		WHERE a.id = $1
	`, anomalyID).Scan(
		&ac.VehiclePlate,
		&ac.DriverName,
		&ac.AnomalyType,
		&ac.Description,
		&ac.DistanceKm,
		&ac.DurationMin,
		&ac.DetectedAt,
		&ac.PastCount,
	)
	if err != nil {
		return nil, fmt.Errorf("ai.repo.GetAnomalyContext: %w", err)
	}
	return ac, nil
}

// ─── NPP Zalo draft context ───────────────────────────────────────────────────

// NPPZaloContext holds NPP details for building a Zalo draft prompt.
type NPPZaloContext struct {
	CustomerName  string
	HealthScore   int
	LastOrderDays int
	TotalOrders   int
	TopSKU        string
}

// GetNPPZaloContext loads NPP data for Zalo draft generation.
func (r *Repository) GetNPPZaloContext(ctx context.Context, customerID uuid.UUID) (*NPPZaloContext, error) {
	nc := &NPPZaloContext{}

	err := r.db.QueryRow(ctx, `
		SELECT
			c.name,
			COALESCE(nh.health_score_0_100, 50)::int,
			COALESCE(EXTRACT(DAY FROM NOW() - MAX(o.created_at))::int, 999),
			COUNT(o.id)
		FROM customers c
		LEFT JOIN ml_features.npp_health_scores nh ON nh.npp_code = c.distributor_code
		LEFT JOIN orders o ON o.customer_id = c.id AND o.status NOT IN ('cancelled')
		WHERE c.id = $1
		GROUP BY c.name, nh.health_score_0_100
	`, customerID).Scan(&nc.CustomerName, &nc.HealthScore, &nc.LastOrderDays, &nc.TotalOrders)
	if err != nil {
		return nil, fmt.Errorf("ai.repo.GetNPPZaloContext: %w", err)
	}
	return nc, nil
}

// ─── Seasonal index lookup ────────────────────────────────────────────────────

// GetSeasonalIndex fetches the seasonal index for a warehouse+month from ml_features.
func (r *Repository) GetSeasonalIndex(ctx context.Context, warehouseCode string, month int) (float64, error) {
	var idx float64
	err := r.db.QueryRow(ctx, `
		SELECT seasonal_index FROM ml_features.seasonal_indices
		WHERE warehouse_code = $1 AND month = $2
	`, warehouseCode, month).Scan(&idx)
	if err != nil {
		return 100.0, nil // default: average month
	}
	return idx, nil
}
