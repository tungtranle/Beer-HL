package ai

import (
	"context"
	"encoding/json"
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

// ─── AI-native audit / inbox / simulation ───────────────────────────────────

func (r *Repository) SaveAIAuditLog(ctx context.Context, input AIAuditLogInput) error {
	var userID any
	if input.UserID != uuid.Nil {
		userID = input.UserID
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO ai_audit_log (
			feature_key, action_type, provider, route, model, sensitivity, confidence,
			request_hash, redacted, latency_ms, success, error_message, user_id, role
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULLIF($12, ''), $13, $14)
	`, input.FeatureKey, input.ActionType, input.Provider, string(input.Route), input.Model,
		string(input.Sensitivity), input.Confidence, input.RequestHash, input.Redacted,
		input.LatencyMS, input.Success, input.ErrorMessage, userID, input.Role)
	return err
}

func (r *Repository) ListAIInbox(ctx context.Context, role string, userID uuid.UUID) ([]AIInboxItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text, item_type, priority, title, COALESCE(detail, ''), ai_suggestion,
		       COALESCE(group_key, ''), status, created_at
		FROM ai_inbox_items
		WHERE status = 'open'
		  AND (user_id = $1 OR (user_id IS NULL AND (role = $2 OR role IS NULL)))
		ORDER BY priority, created_at DESC
		LIMIT 20
	`, userID, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []AIInboxItem{}
	for rows.Next() {
		var item AIInboxItem
		if err := rows.Scan(&item.ID, &item.Type, &item.Priority, &item.Title, &item.Detail, &item.Suggestion, &item.GroupKey, &item.Status, &item.CreatedAt); err != nil {
			return nil, err
		}
		item.Explainable = len(item.Suggestion) > 2
		items = append(items, item)
	}
	return items, rows.Err()
}

// AckAIInbox marks an inbox item as done/dismissed by the current user.
func (r *Repository) AckAIInbox(ctx context.Context, itemID uuid.UUID, status string, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE ai_inbox_items
		SET status = $1, resolved_at = NOW(), resolved_by = $2, updated_at = NOW()
		WHERE id = $3 AND status = 'open'
	`, status, userID, itemID)
	return err
}

func (r *Repository) CreateSimulation(ctx context.Context, simulationType string, rawContext json.RawMessage, options []SimulationOption, recommendedID, explanation string, expiresAt time.Time, userID uuid.UUID) (*SimulationSnapshot, error) {
	optionsJSON, err := json.Marshal(options)
	if err != nil {
		return nil, fmt.Errorf("marshal simulation options: %w", err)
	}
	snapshotHash := hashRequest(string(rawContext) + simulationType)
	var snapshot SimulationSnapshot
	var optionsRaw json.RawMessage
	err = r.db.QueryRow(ctx, `
		INSERT INTO ai_simulations (simulation_type, status, context, options, recommended_option_id, explanation, snapshot_hash, expires_at, created_by)
		VALUES ($1, 'ready', $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, simulation_type, status, options, recommended_option_id, explanation, expires_at, created_at
	`, simulationType, rawContext, optionsJSON, recommendedID, explanation, snapshotHash, expiresAt, userID).Scan(
		&snapshot.ID, &snapshot.Type, &snapshot.Status, &optionsRaw, &snapshot.RecommendedOptionID, &snapshot.Explanation, &snapshot.ExpiresAt, &snapshot.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	if err := json.Unmarshal(optionsRaw, &snapshot.Options); err != nil {
		return nil, fmt.Errorf("unmarshal simulation options: %w", err)
	}
	return &snapshot, nil
}

func (r *Repository) GetSimulation(ctx context.Context, id uuid.UUID) (*SimulationSnapshot, error) {
	var snapshot SimulationSnapshot
	var optionsRaw json.RawMessage
	err := r.db.QueryRow(ctx, `
		SELECT id, simulation_type, status, options, recommended_option_id, explanation, expires_at, created_at
		FROM ai_simulations
		WHERE id = $1
	`, id).Scan(&snapshot.ID, &snapshot.Type, &snapshot.Status, &optionsRaw, &snapshot.RecommendedOptionID, &snapshot.Explanation, &snapshot.ExpiresAt, &snapshot.CreatedAt)
	if err != nil {
		return nil, err
	}
	if time.Now().After(snapshot.ExpiresAt) && snapshot.Status == "ready" {
		snapshot.Status = "expired"
	}
	if err := json.Unmarshal(optionsRaw, &snapshot.Options); err != nil {
		return nil, fmt.Errorf("unmarshal simulation options: %w", err)
	}
	return &snapshot, nil
}

func (r *Repository) MarkSimulationApplied(ctx context.Context, id uuid.UUID, optionID string, userID uuid.UUID) (*SimulationSnapshot, error) {
	_, err := r.db.Exec(ctx, `
		UPDATE ai_simulations
		SET status = 'applied', applied_at = NOW(), applied_by = $2
		WHERE id = $1 AND expires_at > NOW() AND status = 'ready'
	`, id, userID)
	if err != nil {
		return nil, err
	}
	return r.GetSimulation(ctx, id)
}

func (r *Repository) ListTrustSuggestions(ctx context.Context) ([]TrustSuggestion, error) {
	rows, err := r.db.Query(ctx, `
		SELECT action_type,
		       COUNT(*) FILTER (WHERE success) AS success_count,
		       COUNT(*) AS total_count
		FROM ai_audit_log
		WHERE created_at > NOW() - INTERVAL '30 days'
		GROUP BY action_type
		ORDER BY total_count DESC
		LIMIT 10
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	suggestions := []TrustSuggestion{}
	for rows.Next() {
		var actionType string
		var successCount, totalCount int
		if err := rows.Scan(&actionType, &successCount, &totalCount); err != nil {
			return nil, err
		}
		if totalCount < 5 {
			continue
		}
		confidence := float64(successCount) / float64(totalCount)
		suggestion := TrustSuggestion{ActionType: actionType, CurrentTier: 2, SuggestedTier: 2, Confidence: confidence, RequiresReview: true, Reason: "Chưa đủ độ tin cậy để nâng tier"}
		if totalCount >= 30 && confidence >= 0.97 {
			suggestion.SuggestedTier = 3
			suggestion.Reason = "30 ngày gần nhất có tỷ lệ thành công cao; đề xuất admin xem xét nâng automation tier"
		}
		if confidence < 0.9 {
			suggestion.SuggestedTier = 1
			suggestion.Reason = "Tỷ lệ lỗi cao; đề xuất hạ automation tier hoặc giữ manual review"
		}
		suggestions = append(suggestions, suggestion)
	}
	if len(suggestions) == 0 {
		suggestions = append(suggestions, TrustSuggestion{ActionType: "baseline", CurrentTier: 2, SuggestedTier: 2, Confidence: 0, Reason: "Chưa đủ audit data. Trust Loop chỉ gợi ý, không tự nâng quyền.", RequiresReview: true})
	}
	return suggestions, rows.Err()
}

// ─── AI feature flags ───────────────────────────────────────────────────────

func (r *Repository) ListFeatureFlagStates(ctx context.Context) ([]FeatureFlagState, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, flag_key, scope_type, scope_id, enabled, config, updated_by, updated_at
		FROM ai_feature_flags
		ORDER BY flag_key, scope_type, scope_id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	states := []FeatureFlagState{}
	for rows.Next() {
		var state FeatureFlagState
		if err := rows.Scan(
			&state.ID,
			&state.FlagKey,
			&state.ScopeType,
			&state.ScopeID,
			&state.Enabled,
			&state.Config,
			&state.UpdatedBy,
			&state.UpdatedAt,
		); err != nil {
			return nil, err
		}
		states = append(states, state)
	}
	return states, rows.Err()
}

func (r *Repository) UpsertFeatureFlag(ctx context.Context, input UpsertFeatureFlagInput) (*FeatureFlagState, error) {
	var state FeatureFlagState
	err := r.db.QueryRow(ctx, `
		INSERT INTO ai_feature_flags (flag_key, scope_type, scope_id, enabled, config, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (flag_key, scope_type, scope_id)
		DO UPDATE SET
			enabled = EXCLUDED.enabled,
			config = EXCLUDED.config,
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
		RETURNING id, flag_key, scope_type, scope_id, enabled, config, updated_by, updated_at
	`, input.FlagKey, input.ScopeType, input.ScopeID, input.Enabled, input.Config, input.UpdatedBy).Scan(
		&state.ID,
		&state.FlagKey,
		&state.ScopeType,
		&state.ScopeID,
		&state.Enabled,
		&state.Config,
		&state.UpdatedBy,
		&state.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &state, nil
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
				(SELECT AVG(EXTRACT(DAY FROM (NOW() - d.created_at)))::int
				 FROM sales_orders d
				 WHERE d.customer_id = c.id
				   AND d.status::text = 'delivered'
				   AND d.created_at > NOW() - INTERVAL '90 days'), 0
			) AS payment_delay_days,
			COALESCE(
				(SELECT SUM(CASE WHEN ledger_type = 'debit' THEN amount ELSE -amount END)
				 FROM receivable_ledger WHERE customer_id = c.id
				   AND created_at > NOW() - INTERVAL '30 days'), 0
			) AS debt_change_d30,
			COALESCE(
				(SELECT SUM(CASE WHEN ledger_type = 'debit' THEN amount ELSE -amount END)
				 FROM receivable_ledger WHERE customer_id = c.id), 0
			) AS current_debt,
			COALESCE(cl.credit_limit, 0) AS credit_limit,
			COALESCE(
				(SELECT
					(COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::float -
					 COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days')::float)
					/ NULLIF(COUNT(*) FILTER (WHERE created_at BETWEEN NOW() - INTERVAL '60 days' AND NOW() - INTERVAL '30 days')::float, 0) * 100
				 FROM sales_orders WHERE customer_id = c.id AND status::text NOT IN ('cancelled')), 0
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
			COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE AND status::text IN ('pending_customer_confirm','pending_approval','confirmed','approved')) AS pending_orders
		FROM sales_orders
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
			COALESCE(v.plate_number, '') AS vehicle_plate,
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
		LEFT JOIN vehicles v ON v.id = a.vehicle_id
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
		LEFT JOIN ml_features.npp_health_scores nh ON nh.npp_code = c.code
		LEFT JOIN sales_orders o ON o.customer_id = c.id AND o.status::text NOT IN ('cancelled')
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
