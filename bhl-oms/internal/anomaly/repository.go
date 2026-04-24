// Package anomaly provides GPS anomaly detection (F7 — World-Class S1 W3).
//
// Pattern: Handler -> Service -> Repository (CLAUDE.md rule).
// Detection rules driven by ml_features.gps_anomaly_thresholds (migration 038).
package anomaly

import (
	"context"
	"errors"
	"fmt"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ============================================================
// Domain types
// ============================================================

// Anomaly represents a detected GPS anomaly.
type Anomaly struct {
	ID             uuid.UUID  `json:"id"`
	VehicleID      uuid.UUID  `json:"vehicle_id"`
	VehiclePlate   string     `json:"vehicle_plate,omitempty"`
	TripID         *uuid.UUID `json:"trip_id,omitempty"`
	DriverID       *uuid.UUID `json:"driver_id,omitempty"`
	DriverName     string     `json:"driver_name,omitempty"`
	AnomalyType    string     `json:"anomaly_type"`
	Severity       string     `json:"severity"`
	Lat            float64    `json:"lat"`
	Lng            float64    `json:"lng"`
	DistanceKm     *float64   `json:"distance_km,omitempty"`
	DurationMin    *float64   `json:"duration_min,omitempty"`
	SpeedKmh       *float64   `json:"speed_kmh,omitempty"`
	Description    string     `json:"description"`
	DetectedAt     time.Time  `json:"detected_at"`
	Status         string     `json:"status"`
	AcknowledgedBy *uuid.UUID `json:"acknowledged_by,omitempty"`
	AcknowledgedAt *time.Time `json:"acknowledged_at,omitempty"`
	ResolvedBy     *uuid.UUID `json:"resolved_by,omitempty"`
	ResolvedAt     *time.Time `json:"resolved_at,omitempty"`
	ResolutionNote string     `json:"resolution_note,omitempty"`
	ZaloSent       bool       `json:"zalo_sent"`
}

// Threshold from ml_features.gps_anomaly_thresholds.
type Threshold struct {
	RuleName       string
	ThresholdValue float64
	Severity       string
}

var ErrNotFound = errors.New("anomaly: not found")

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

// LoadThresholds reads all rule thresholds.
// CRITICAL: cast text per AI_LESSONS pgx rule.
func (r *Repository) LoadThresholds(ctx context.Context) (map[string]Threshold, error) {
	rows, err := r.db.Query(ctx, `
		SELECT rule_name::text, threshold_value, severity::text
		FROM ml_features.gps_anomaly_thresholds
	`)
	if err != nil {
		return nil, fmt.Errorf("load thresholds: %w", err)
	}
	defer rows.Close()

	out := make(map[string]Threshold, 8)
	for rows.Next() {
		var t Threshold
		if err := rows.Scan(&t.RuleName, &t.ThresholdValue, &t.Severity); err != nil {
			return nil, err
		}
		out[t.RuleName] = t
	}
	return out, rows.Err()
}

// Insert creates a new anomaly record.
func (r *Repository) Insert(ctx context.Context, a *Anomaly) error {
	row := r.db.QueryRow(ctx, `
		INSERT INTO gps_anomalies (
			vehicle_id, trip_id, driver_id,
			anomaly_type, severity,
			lat, lng, distance_km, duration_min, speed_kmh,
			description, detected_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
		RETURNING id, created_at
	`, a.VehicleID, a.TripID, a.DriverID,
		a.AnomalyType, a.Severity,
		a.Lat, a.Lng, a.DistanceKm, a.DurationMin, a.SpeedKmh,
		a.Description, a.DetectedAt)
	return row.Scan(&a.ID, &a.DetectedAt)
}

// HasOpenSimilar prevents duplicate alerts for same (vehicle, type) within last `window`.
func (r *Repository) HasOpenSimilar(ctx context.Context, vehicleID uuid.UUID, anomalyType string, window time.Duration) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM gps_anomalies
			WHERE vehicle_id = $1 AND anomaly_type = $2
			  AND status IN ('open','acknowledged')
			  AND detected_at > NOW() - $3::interval
		)
	`, vehicleID, anomalyType, fmt.Sprintf("%d seconds", int(window.Seconds()))).Scan(&exists)
	return exists, err
}

// List returns anomalies filtered by status (empty = all open + acknowledged).
func (r *Repository) List(ctx context.Context, status string, limit int) ([]Anomaly, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	q := `
		SELECT
			a.id, a.vehicle_id, COALESCE(v.plate_number,'')::text,
			a.trip_id, a.driver_id, COALESCE(d.full_name,'')::text,
			a.anomaly_type::text, a.severity::text,
			a.lat, a.lng, a.distance_km, a.duration_min, a.speed_kmh,
			a.description::text, a.detected_at,
			a.status::text,
			a.acknowledged_by, a.acknowledged_at,
			a.resolved_by, a.resolved_at,
			COALESCE(a.resolution_note,'')::text,
			a.zalo_sent
		FROM gps_anomalies a
		LEFT JOIN vehicles v ON v.id = a.vehicle_id
		LEFT JOIN drivers d ON d.id = a.driver_id
		WHERE ($1 = '' OR a.status::text = $1)
		ORDER BY
			CASE a.severity WHEN 'P0' THEN 0 WHEN 'P1' THEN 1 ELSE 2 END,
			a.detected_at DESC
		LIMIT $2
	`
	rows, err := r.db.Query(ctx, q, status, limit)
	if err != nil {
		return nil, fmt.Errorf("list anomalies: %w", err)
	}
	defer rows.Close()
	out := make([]Anomaly, 0, limit)
	for rows.Next() {
		var a Anomaly
		if err := rows.Scan(
			&a.ID, &a.VehicleID, &a.VehiclePlate,
			&a.TripID, &a.DriverID, &a.DriverName,
			&a.AnomalyType, &a.Severity,
			&a.Lat, &a.Lng, &a.DistanceKm, &a.DurationMin, &a.SpeedKmh,
			&a.Description, &a.DetectedAt,
			&a.Status,
			&a.AcknowledgedBy, &a.AcknowledgedAt,
			&a.ResolvedBy, &a.ResolvedAt,
			&a.ResolutionNote,
			&a.ZaloSent,
		); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// Acknowledge marks anomaly as 'acknowledged'.
func (r *Repository) Acknowledge(ctx context.Context, id, userID uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE gps_anomalies
		SET status = 'acknowledged',
		    acknowledged_by = $2,
		    acknowledged_at = NOW(),
		    updated_at = NOW()
		WHERE id = $1 AND status = 'open'
	`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// Resolve marks anomaly as 'resolved' (or 'false_positive').
func (r *Repository) Resolve(ctx context.Context, id, userID uuid.UUID, note string, falsePositive bool) error {
	status := "resolved"
	if falsePositive {
		status = "false_positive"
	}
	tag, err := r.db.Exec(ctx, `
		UPDATE gps_anomalies
		SET status = $3,
		    resolved_by = $2,
		    resolved_at = NOW(),
		    resolution_note = $4,
		    updated_at = NOW()
		WHERE id = $1 AND status IN ('open','acknowledged')
	`, id, userID, status, note)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// MarkZaloSent flags notification dispatched.
func (r *Repository) MarkZaloSent(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE gps_anomalies
		SET zalo_sent = TRUE, zalo_sent_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, id)
	return err
}

// PlannedStop represents a stop coord from a trip's planned route.
type PlannedStop struct {
	Lat       float64
	Lng       float64
	Name      string
	StopOrder int
}

// LoadActiveTripPlannedStops returns planned stops for vehicle's currently in-transit trip.
// Returns nil if no active trip. Used by detector.
func (r *Repository) LoadActiveTripPlannedStops(ctx context.Context, vehicleID uuid.UUID) (*uuid.UUID, []PlannedStop, error) {
	var tripID uuid.UUID
	err := r.db.QueryRow(ctx, `
		SELECT id FROM trips
		WHERE vehicle_id = $1 AND status::text = 'in_transit'
		ORDER BY started_at DESC NULLS LAST LIMIT 1
	`, vehicleID).Scan(&tripID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil, nil
		}
		return nil, nil, fmt.Errorf("active trip: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			COALESCE(c.latitude, 0)::float8,
			COALESCE(c.longitude, 0)::float8,
			COALESCE(c.name, '')::text,
			ts.stop_order
		FROM trip_stops ts
		JOIN customers c ON c.id = ts.customer_id
		WHERE ts.trip_id = $1
		  AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
		ORDER BY ts.stop_order
	`, tripID)
	if err != nil {
		return &tripID, nil, fmt.Errorf("trip stops: %w", err)
	}
	defer rows.Close()
	stops := make([]PlannedStop, 0, 12)
	for rows.Next() {
		var s PlannedStop
		if err := rows.Scan(&s.Lat, &s.Lng, &s.Name, &s.StopOrder); err != nil {
			return &tripID, nil, err
		}
		stops = append(stops, s)
	}
	return &tripID, stops, rows.Err()
}
