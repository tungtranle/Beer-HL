package reconciliation

import (
	"context"
	"encoding/json"
	"fmt"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ── Reconciliation CRUD ─────────────────────────────

func (r *Repository) CreateReconciliation(ctx context.Context, rec *domain.Reconciliation) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO reconciliations (trip_id, recon_type, status, expected_value, actual_value, variance, details)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (trip_id, recon_type) DO UPDATE SET
			expected_value = EXCLUDED.expected_value,
			actual_value = EXCLUDED.actual_value,
			variance = EXCLUDED.variance,
			details = EXCLUDED.details,
			status = EXCLUDED.status,
			updated_at = NOW()
		RETURNING id, created_at, updated_at
	`, rec.TripID, rec.ReconType, rec.Status, rec.ExpectedValue, rec.ActualValue, rec.Variance, rec.Details,
	).Scan(&rec.ID, &rec.CreatedAt, &rec.UpdatedAt)
}

func (r *Repository) GetReconciliationsByTrip(ctx context.Context, tripID uuid.UUID) ([]domain.Reconciliation, error) {
	rows, err := r.db.Query(ctx, `
		SELECT r.id, r.trip_id, t.trip_number, r.recon_type::text, r.status::text,
			r.expected_value, r.actual_value, r.variance, r.details,
			r.reconciled_by, r.reconciled_at, r.created_at, r.updated_at
		FROM reconciliations r
		JOIN trips t ON t.id = r.trip_id
		WHERE r.trip_id = $1
		ORDER BY r.recon_type
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.Reconciliation
	for rows.Next() {
		var rec domain.Reconciliation
		if err := rows.Scan(&rec.ID, &rec.TripID, &rec.TripNumber, &rec.ReconType, &rec.Status,
			&rec.ExpectedValue, &rec.ActualValue, &rec.Variance, &rec.Details,
			&rec.ReconciledBy, &rec.ReconciledAt, &rec.CreatedAt, &rec.UpdatedAt); err != nil {
			continue
		}
		results = append(results, rec)
	}
	return results, nil
}

func (r *Repository) ListReconciliations(ctx context.Context, status string, page, limit int) ([]domain.Reconciliation, int64, error) {
	offset := (page - 1) * limit

	countSQL := `SELECT COUNT(*) FROM reconciliations`
	querySQL := `
		SELECT r.id, r.trip_id, t.trip_number, r.recon_type::text, r.status::text,
			r.expected_value, r.actual_value, r.variance, r.details,
			r.reconciled_by, r.reconciled_at, r.created_at, r.updated_at
		FROM reconciliations r
		JOIN trips t ON t.id = r.trip_id`

	if status != "" {
		countSQL += ` WHERE status::text = '` + status + `'`
		querySQL += ` WHERE r.status::text = '` + status + `'`
	}
	querySQL += ` ORDER BY r.created_at DESC LIMIT $1 OFFSET $2`

	var total int64
	r.db.QueryRow(ctx, countSQL).Scan(&total)

	rows, err := r.db.Query(ctx, querySQL, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []domain.Reconciliation
	for rows.Next() {
		var rec domain.Reconciliation
		if err := rows.Scan(&rec.ID, &rec.TripID, &rec.TripNumber, &rec.ReconType, &rec.Status,
			&rec.ExpectedValue, &rec.ActualValue, &rec.Variance, &rec.Details,
			&rec.ReconciledBy, &rec.ReconciledAt, &rec.CreatedAt, &rec.UpdatedAt); err != nil {
			continue
		}
		results = append(results, rec)
	}
	return results, total, nil
}

func (r *Repository) ResolveReconciliation(ctx context.Context, id, userID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE reconciliations SET status = 'resolved', reconciled_by = $2, reconciled_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, id, userID)
	return err
}

// ── Discrepancy CRUD ────────────────────────────────

func (r *Repository) CreateDiscrepancy(ctx context.Context, d *domain.Discrepancy) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO discrepancies (recon_id, trip_id, stop_id, disc_type, status, description,
			expected_value, actual_value, variance, deadline)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at, updated_at
	`, d.ReconID, d.TripID, d.StopID, d.DiscType, d.Status, d.Description,
		d.ExpectedValue, d.ActualValue, d.Variance, d.Deadline,
	).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
}

func (r *Repository) ListDiscrepancies(ctx context.Context, tripID *uuid.UUID, status string, page, limit int) ([]domain.Discrepancy, int64, error) {
	offset := (page - 1) * limit
	args := []interface{}{}
	where := " WHERE 1=1"
	argN := 1

	if tripID != nil {
		where += fmt.Sprintf(" AND d.trip_id = $%d", argN)
		args = append(args, *tripID)
		argN++
	}
	if status != "" {
		where += fmt.Sprintf(" AND d.status::text = $%d", argN)
		args = append(args, status)
		argN++
	}

	var total int64
	r.db.QueryRow(ctx, `SELECT COUNT(*) FROM discrepancies d`+where, args...).Scan(&total)

	querySQL := `
		SELECT d.id, d.recon_id, d.trip_id, t.trip_number, d.stop_id, d.disc_type::text, d.status::text,
			d.description, d.expected_value, d.actual_value, d.variance,
			d.resolution, d.assigned_to, d.deadline, d.resolved_at, d.resolved_by,
			d.created_at, d.updated_at
		FROM discrepancies d
		JOIN trips t ON t.id = d.trip_id` + where +
		fmt.Sprintf(` ORDER BY d.created_at DESC LIMIT $%d OFFSET $%d`, argN, argN+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, querySQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []domain.Discrepancy
	for rows.Next() {
		var disc domain.Discrepancy
		if err := rows.Scan(&disc.ID, &disc.ReconID, &disc.TripID, &disc.TripNumber, &disc.StopID,
			&disc.DiscType, &disc.Status, &disc.Description,
			&disc.ExpectedValue, &disc.ActualValue, &disc.Variance,
			&disc.Resolution, &disc.AssignedTo, &disc.Deadline,
			&disc.ResolvedAt, &disc.ResolvedBy, &disc.CreatedAt, &disc.UpdatedAt); err != nil {
			continue
		}
		results = append(results, disc)
	}
	return results, total, nil
}

func (r *Repository) ResolveDiscrepancy(ctx context.Context, id, userID uuid.UUID, resolution string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE discrepancies SET status = 'resolved', resolution = $2, resolved_by = $3, resolved_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, id, resolution, userID)
	return err
}

// ── Trip data queries for auto-reconcile ────────────

// GetTripDeliveryExpected returns the total expected revenue from a trip's stops.
func (r *Repository) GetTripDeliveryExpected(ctx context.Context, tripID uuid.UUID) (float64, error) {
	var total float64
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(so.grand_total), 0)
		FROM trip_stops ts
		JOIN shipments sh ON sh.id = ts.shipment_id
		JOIN sales_orders so ON so.id = sh.order_id
		WHERE ts.trip_id = $1 AND ts.status::text IN ('delivered', 'partially_delivered')
	`, tripID).Scan(&total)
	return total, err
}

// GetTripPaymentActual returns total payments collected for a trip.
func (r *Repository) GetTripPaymentActual(ctx context.Context, tripID uuid.UUID) (float64, error) {
	var total float64
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(p.amount), 0)
		FROM payments p
		JOIN trip_stops ts ON ts.id = p.trip_stop_id
		WHERE ts.trip_id = $1
	`, tripID).Scan(&total)
	return total, err
}

// GetTripAssetExpected returns total assets expected to be returned (from orders).
func (r *Repository) GetTripAssetExpected(ctx context.Context, tripID uuid.UUID) (int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM trip_stops ts
		JOIN shipments sh ON sh.id = ts.shipment_id
		JOIN order_items oi ON oi.order_id = sh.order_id
		JOIN products p ON p.id = oi.product_id
		WHERE ts.trip_id = $1 AND ts.status::text IN ('delivered', 'partially_delivered')
			AND p.deposit_price > 0
	`, tripID).Scan(&total)
	return total, err
}

// GetTripAssetActual returns total assets actually returned (from return_collections).
func (r *Repository) GetTripAssetActual(ctx context.Context, tripID uuid.UUID) (int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(rc.quantity), 0)
		FROM return_collections rc
		JOIN trip_stops ts ON ts.id = rc.trip_stop_id
		WHERE ts.trip_id = $1
	`, tripID).Scan(&total)
	return total, err
}

// GetTripGoodsExpected returns expected delivered quantity.
func (r *Repository) GetTripGoodsExpected(ctx context.Context, tripID uuid.UUID) (int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(oi.quantity), 0)
		FROM trip_stops ts
		JOIN shipments sh ON sh.id = ts.shipment_id
		JOIN order_items oi ON oi.order_id = sh.order_id
		WHERE ts.trip_id = $1 AND ts.status::text IN ('delivered', 'partially_delivered')
	`, tripID).Scan(&total)
	return total, err
}

// GetTripGoodsActual returns actual delivered quantity from ePOD.
func (r *Repository) GetTripGoodsActual(ctx context.Context, tripID uuid.UUID) (int, error) {
	var total int
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM((item->>'delivered_qty')::int), 0)
		FROM epod e
		JOIN trip_stops ts ON ts.id = e.trip_stop_id,
		LATERAL jsonb_array_elements(e.delivered_items) AS item
		WHERE ts.trip_id = $1
	`, tripID).Scan(&total)
	return total, err
}

// ── Daily Close Summary ─────────────────────────────

func (r *Repository) CreateDailyCloseSummary(ctx context.Context, s *domain.DailyCloseSummary) error {
	summaryJSON, _ := json.Marshal(s.Summary)
	if summaryJSON == nil {
		summaryJSON = []byte("{}")
	}
	return r.db.QueryRow(ctx, `
		INSERT INTO daily_close_summaries (close_date, warehouse_id, total_trips, completed_trips,
			total_stops, delivered_stops, failed_stops, total_revenue, total_collected,
			total_outstanding, total_returns_good, total_returns_damaged,
			total_discrepancies, resolved_discrepancies, summary)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		ON CONFLICT (close_date, warehouse_id) DO UPDATE SET
			total_trips = EXCLUDED.total_trips, completed_trips = EXCLUDED.completed_trips,
			total_stops = EXCLUDED.total_stops, delivered_stops = EXCLUDED.delivered_stops,
			failed_stops = EXCLUDED.failed_stops, total_revenue = EXCLUDED.total_revenue,
			total_collected = EXCLUDED.total_collected, total_outstanding = EXCLUDED.total_outstanding,
			total_returns_good = EXCLUDED.total_returns_good, total_returns_damaged = EXCLUDED.total_returns_damaged,
			total_discrepancies = EXCLUDED.total_discrepancies, resolved_discrepancies = EXCLUDED.resolved_discrepancies,
			summary = EXCLUDED.summary
		RETURNING id, created_at
	`, s.CloseDate, s.WarehouseID, s.TotalTrips, s.CompletedTrips,
		s.TotalStops, s.DeliveredStops, s.FailedStops, s.TotalRevenue, s.TotalCollected,
		s.TotalOutstanding, s.TotalReturnsGood, s.TotalReturnsDamaged,
		s.TotalDiscrepancies, s.ResolvedDiscrepancies, summaryJSON,
	).Scan(&s.ID, &s.CreatedAt)
}

func (r *Repository) GetDailyCloseSummary(ctx context.Context, date string, warehouseID uuid.UUID) (*domain.DailyCloseSummary, error) {
	var s domain.DailyCloseSummary
	err := r.db.QueryRow(ctx, `
		SELECT id, close_date::text, warehouse_id, total_trips, completed_trips,
			total_stops, delivered_stops, failed_stops, total_revenue, total_collected,
			total_outstanding, total_returns_good, total_returns_damaged,
			total_discrepancies, resolved_discrepancies, summary, created_at
		FROM daily_close_summaries
		WHERE close_date = $1 AND warehouse_id = $2
	`, date, warehouseID).Scan(&s.ID, &s.CloseDate, &s.WarehouseID, &s.TotalTrips, &s.CompletedTrips,
		&s.TotalStops, &s.DeliveredStops, &s.FailedStops, &s.TotalRevenue, &s.TotalCollected,
		&s.TotalOutstanding, &s.TotalReturnsGood, &s.TotalReturnsDamaged,
		&s.TotalDiscrepancies, &s.ResolvedDiscrepancies, &s.Summary, &s.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func (r *Repository) ListDailyCloseSummaries(ctx context.Context, warehouseID *uuid.UUID, limit int) ([]domain.DailyCloseSummary, error) {
	querySQL := `
		SELECT id, close_date::text, warehouse_id, total_trips, completed_trips,
			total_stops, delivered_stops, failed_stops, total_revenue, total_collected,
			total_outstanding, total_returns_good, total_returns_damaged,
			total_discrepancies, resolved_discrepancies, summary, created_at
		FROM daily_close_summaries`
	args := []interface{}{}
	if warehouseID != nil {
		querySQL += ` WHERE warehouse_id = $1 ORDER BY close_date DESC LIMIT $2`
		args = append(args, *warehouseID, limit)
	} else {
		querySQL += ` ORDER BY close_date DESC LIMIT $1`
		args = append(args, limit)
	}

	rows, err := r.db.Query(ctx, querySQL, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.DailyCloseSummary
	for rows.Next() {
		var s domain.DailyCloseSummary
		if err := rows.Scan(&s.ID, &s.CloseDate, &s.WarehouseID, &s.TotalTrips, &s.CompletedTrips,
			&s.TotalStops, &s.DeliveredStops, &s.FailedStops, &s.TotalRevenue, &s.TotalCollected,
			&s.TotalOutstanding, &s.TotalReturnsGood, &s.TotalReturnsDamaged,
			&s.TotalDiscrepancies, &s.ResolvedDiscrepancies, &s.Summary, &s.CreatedAt); err != nil {
			continue
		}
		results = append(results, s)
	}
	return results, nil
}

// GetCompletedTripIDs returns trip IDs for a warehouse+date that are completed but not yet reconciled.
func (r *Repository) GetCompletedTripIDs(ctx context.Context, warehouseID uuid.UUID, date string) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id FROM trips t
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND t.status::text = 'completed'
			AND NOT EXISTS (SELECT 1 FROM reconciliations rc WHERE rc.trip_id = t.id AND rc.recon_type = 'goods')
	`, warehouseID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err == nil {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

// GetWarehouseStatsForClose fetches aggregate data for daily close summary.
func (r *Repository) GetWarehouseStatsForClose(ctx context.Context, warehouseID uuid.UUID, date string) (*domain.DailyCloseSummary, error) {
	s := &domain.DailyCloseSummary{CloseDate: date, WarehouseID: warehouseID}

	// Trip counts
	r.db.QueryRow(ctx, `SELECT COUNT(*) FROM trips WHERE warehouse_id = $1 AND planned_date = $2`, warehouseID, date).Scan(&s.TotalTrips)
	r.db.QueryRow(ctx, `SELECT COUNT(*) FROM trips WHERE warehouse_id = $1 AND planned_date = $2 AND status::text = 'completed'`, warehouseID, date).Scan(&s.CompletedTrips)

	// Stop counts
	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2
	`, warehouseID, date).Scan(&s.TotalStops)

	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND ts.status::text IN ('delivered', 'partially_delivered')
	`, warehouseID, date).Scan(&s.DeliveredStops)

	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND ts.status::text IN ('failed', 'skipped')
	`, warehouseID, date).Scan(&s.FailedStops)

	// Revenue & Collection
	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(so.grand_total), 0)
		FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		JOIN shipments sh ON sh.id = ts.shipment_id
		JOIN sales_orders so ON so.id = sh.order_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND ts.status::text IN ('delivered', 'partially_delivered')
	`, warehouseID, date).Scan(&s.TotalRevenue)

	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(p.amount), 0)
		FROM payments p
		JOIN trip_stops ts ON ts.id = p.trip_stop_id
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2
	`, warehouseID, date).Scan(&s.TotalCollected)

	s.TotalOutstanding = s.TotalRevenue - s.TotalCollected

	// Returns
	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(rc.quantity), 0)
		FROM return_collections rc
		JOIN trip_stops ts ON ts.id = rc.trip_stop_id
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND rc.condition = 'good'
	`, warehouseID, date).Scan(&s.TotalReturnsGood)

	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(rc.quantity), 0)
		FROM return_collections rc
		JOIN trip_stops ts ON ts.id = rc.trip_stop_id
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND rc.condition IN ('damaged', 'lost')
	`, warehouseID, date).Scan(&s.TotalReturnsDamaged)

	// Discrepancies
	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM discrepancies d
		JOIN trips t ON t.id = d.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2
	`, warehouseID, date).Scan(&s.TotalDiscrepancies)

	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM discrepancies d
		JOIN trips t ON t.id = d.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND d.status::text = 'resolved'
	`, warehouseID, date).Scan(&s.ResolvedDiscrepancies)

	return s, nil
}
