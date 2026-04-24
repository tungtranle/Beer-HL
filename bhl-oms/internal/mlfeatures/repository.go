// Package mlfeatures exposes read-only ML/analytics features stored in
// schema `ml_features` (migration 036 + 036b). World-Class Strategy F1–F15.
//
// Pattern: Handler -> Service -> Repository (CLAUDE.md rule).
// Tables here are READ-ONLY for OLTP — refresh via cron / import script,
// never mutated by user actions.
package mlfeatures

import (
	"context"
	"errors"
	"fmt"

	"bhl-oms/pkg/logger"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// Domain types
// ============================================================

// NppHealth = row from ml_features.npp_health_scores. F2.
type NppHealth struct {
	NppCode           string   `json:"npp_code"`
	TenNppChuan       string   `json:"ten_npp_chuan"`
	Tinh              string   `json:"tinh,omitempty"`
	Lat               *float64 `json:"lat,omitempty"`
	Lon               *float64 `json:"lon,omitempty"`
	RecencyDays       int      `json:"recency_days"`
	FrequencyOrders   int      `json:"frequency_orders"`
	MonetaryUnits     float64  `json:"monetary_units"`
	HealthScore0to100 float64  `json:"health_score_0_100"`
	Segment           string   `json:"segment"`
	RiskBand          string   `json:"risk_band"` // GREEN | YELLOW | RED
}

// BasketRule = row from ml_features.basket_rules. F3.
type BasketRule struct {
	Antecedent      string  `json:"antecedent"`
	Consequent      string  `json:"consequent"`
	PairCount       int     `json:"pair_count"`
	AntecedentCount int     `json:"antecedent_count"`
	Support         float64 `json:"support"`
	Confidence      float64 `json:"confidence"`
	Lift            float64 `json:"lift"`
}

// ErrNotFound returned when NPP code doesn't exist in ml_features.npp_health_scores.
var ErrNotFound = errors.New("ml_features: not found")

// ============================================================
// Repository
// ============================================================

type Repository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRepository(db *pgxpool.Pool, log logger.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// GetNppHealth returns RFM health for one NPP.
// CRITICAL: cast TEXT columns explicitly per AI_LESSONS pgx rule.
func (r *Repository) GetNppHealth(ctx context.Context, nppCode string) (*NppHealth, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
			npp_code::text, ten_npp_chuan::text,
			COALESCE(tinh,'')::text,
			lat, lon,
			recency_days, frequency_orders, monetary_units,
			health_score_0_100, segment::text, risk_band::text
		FROM ml_features.npp_health_scores
		WHERE npp_code = $1
	`, nppCode)

	var h NppHealth
	err := row.Scan(
		&h.NppCode, &h.TenNppChuan, &h.Tinh,
		&h.Lat, &h.Lon,
		&h.RecencyDays, &h.FrequencyOrders, &h.MonetaryUnits,
		&h.HealthScore0to100, &h.Segment, &h.RiskBand,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("scan npp_health: %w", err)
	}
	return &h, nil
}

// ListNppHealthByRiskBand: GREEN/YELLOW/RED filter, ordered by score asc (worst first).
func (r *Repository) ListNppHealthByRiskBand(ctx context.Context, riskBand string, limit int) ([]NppHealth, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			npp_code::text, ten_npp_chuan::text,
			COALESCE(tinh,'')::text,
			lat, lon,
			recency_days, frequency_orders, monetary_units,
			health_score_0_100, segment::text, risk_band::text
		FROM ml_features.npp_health_scores
		WHERE risk_band = $1
		ORDER BY health_score_0_100 ASC
		LIMIT $2
	`, riskBand, limit)
	if err != nil {
		return nil, fmt.Errorf("query npp_health: %w", err)
	}
	defer rows.Close()

	out := make([]NppHealth, 0)
	for rows.Next() {
		var h NppHealth
		if err := rows.Scan(
			&h.NppCode, &h.TenNppChuan, &h.Tinh,
			&h.Lat, &h.Lon,
			&h.RecencyDays, &h.FrequencyOrders, &h.MonetaryUnits,
			&h.HealthScore0to100, &h.Segment, &h.RiskBand,
		); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		out = append(out, h)
	}
	return out, rows.Err()
}

// SuggestForItems returns top-N consequent rules for the given antecedent SKUs.
// Filters: confidence ≥ minConfidence, lift ≥ minLift.
// Excludes rules whose consequent already in items (no duplicate suggestions).
func (r *Repository) SuggestForItems(
	ctx context.Context, items []string, minConfidence, minLift float64, limit int,
) ([]BasketRule, error) {
	if len(items) == 0 {
		return []BasketRule{}, nil
	}
	if limit <= 0 || limit > 50 {
		limit = 10
	}
	rows, err := r.db.Query(ctx, `
		SELECT antecedent::text, consequent::text,
		       pair_count, antecedent_count,
		       support, confidence, lift
		FROM ml_features.basket_rules
		WHERE antecedent = ANY($1::text[])
		  AND consequent <> ALL($1::text[])
		  AND confidence >= $2
		  AND lift >= $3
		ORDER BY confidence DESC, lift DESC
		LIMIT $4
	`, items, minConfidence, minLift, limit)
	if err != nil {
		return nil, fmt.Errorf("query basket_rules: %w", err)
	}
	defer rows.Close()

	out := make([]BasketRule, 0)
	for rows.Next() {
		var b BasketRule
		if err := rows.Scan(
			&b.Antecedent, &b.Consequent,
			&b.PairCount, &b.AntecedentCount,
			&b.Support, &b.Confidence, &b.Lift,
		); err != nil {
			return nil, fmt.Errorf("scan: %w", err)
		}
		out = append(out, b)
	}
	return out, rows.Err()
}
