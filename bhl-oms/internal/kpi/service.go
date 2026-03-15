package kpi

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

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

func (r *Repository) CreateSnapshot(ctx context.Context, s *domain.DailyKPISnapshot) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO daily_kpi_snapshots (
			snapshot_date, warehouse_id, otd_rate, delivery_success_rate,
			total_orders, delivered_orders, failed_orders,
			avg_vehicle_utilization, total_trips, total_distance_km,
			total_revenue, total_collected, outstanding_receivable,
			recon_match_rate, total_discrepancies, details
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		ON CONFLICT (snapshot_date, warehouse_id) DO UPDATE SET
			otd_rate = EXCLUDED.otd_rate,
			delivery_success_rate = EXCLUDED.delivery_success_rate,
			total_orders = EXCLUDED.total_orders,
			delivered_orders = EXCLUDED.delivered_orders,
			failed_orders = EXCLUDED.failed_orders,
			avg_vehicle_utilization = EXCLUDED.avg_vehicle_utilization,
			total_trips = EXCLUDED.total_trips,
			total_distance_km = EXCLUDED.total_distance_km,
			total_revenue = EXCLUDED.total_revenue,
			total_collected = EXCLUDED.total_collected,
			outstanding_receivable = EXCLUDED.outstanding_receivable,
			recon_match_rate = EXCLUDED.recon_match_rate,
			total_discrepancies = EXCLUDED.total_discrepancies,
			details = EXCLUDED.details
		RETURNING id, created_at
	`, s.SnapshotDate, s.WarehouseID, s.OTDRate, s.DeliverySuccessRate,
		s.TotalOrders, s.DeliveredOrders, s.FailedOrders,
		s.AvgVehicleUtilization, s.TotalTrips, s.TotalDistanceKm,
		s.TotalRevenue, s.TotalCollected, s.OutstandingReceivable,
		s.ReconMatchRate, s.TotalDiscrepancies, s.Details,
	).Scan(&s.ID, &s.CreatedAt)
}

func (r *Repository) GetSnapshots(ctx context.Context, warehouseID *uuid.UUID, from, to string, limit int) ([]domain.DailyKPISnapshot, error) {
	query := `SELECT id, snapshot_date, warehouse_id, otd_rate, delivery_success_rate,
		total_orders, delivered_orders, failed_orders,
		avg_vehicle_utilization, total_trips, total_distance_km,
		total_revenue, total_collected, outstanding_receivable,
		recon_match_rate, total_discrepancies, details, created_at
		FROM daily_kpi_snapshots WHERE 1=1`

	args := []interface{}{}
	argIdx := 1

	if warehouseID != nil {
		query += fmt.Sprintf(" AND warehouse_id = $%d", argIdx)
		args = append(args, *warehouseID)
		argIdx++
	}
	if from != "" {
		query += fmt.Sprintf(" AND snapshot_date >= $%d", argIdx)
		args = append(args, from)
		argIdx++
	}
	if to != "" {
		query += fmt.Sprintf(" AND snapshot_date <= $%d", argIdx)
		args = append(args, to)
		argIdx++
	}

	query += " ORDER BY snapshot_date DESC"
	query += fmt.Sprintf(" LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.DailyKPISnapshot
	for rows.Next() {
		var s domain.DailyKPISnapshot
		if err := rows.Scan(
			&s.ID, &s.SnapshotDate, &s.WarehouseID, &s.OTDRate, &s.DeliverySuccessRate,
			&s.TotalOrders, &s.DeliveredOrders, &s.FailedOrders,
			&s.AvgVehicleUtilization, &s.TotalTrips, &s.TotalDistanceKm,
			&s.TotalRevenue, &s.TotalCollected, &s.OutstandingReceivable,
			&s.ReconMatchRate, &s.TotalDiscrepancies, &s.Details, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, s)
	}
	return results, nil
}

// GetWarehouseIDs returns all active root warehouse IDs.
func (r *Repository) GetWarehouseIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `SELECT id FROM warehouses WHERE path IS NULL AND is_active = true`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// ComputeKPI calculates KPI metrics for a given warehouse and date.
func (r *Repository) ComputeKPI(ctx context.Context, warehouseID uuid.UUID, date string) (*domain.DailyKPISnapshot, error) {
	s := &domain.DailyKPISnapshot{
		SnapshotDate: date,
		WarehouseID:  warehouseID,
	}

	// Total orders for the date
	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM sales_orders WHERE warehouse_id = $1 AND delivery_date = $2
	`, warehouseID, date).Scan(&s.TotalOrders)

	// Delivered & failed
	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND ts.status = 'delivered'
	`, warehouseID, date).Scan(&s.DeliveredOrders)

	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND ts.status = 'failed'
	`, warehouseID, date).Scan(&s.FailedOrders)

	// Delivery success rate
	total := s.DeliveredOrders + s.FailedOrders
	if total > 0 {
		s.DeliverySuccessRate = float64(s.DeliveredOrders) / float64(total) * 100
	}

	// OTD rate (on-time delivery): delivered stops that arrived within time_window)
	var onTime int
	r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2
		  AND ts.status = 'delivered'
		  AND (ts.actual_arrival IS NULL OR ts.actual_arrival <= ts.estimated_arrival + interval '60 minutes')
	`, warehouseID, date).Scan(&onTime)
	if s.DeliveredOrders > 0 {
		s.OTDRate = float64(onTime) / float64(s.DeliveredOrders) * 100
	}

	// Trips
	r.db.QueryRow(ctx, `
		SELECT COUNT(*), COALESCE(SUM(total_distance_km), 0)
		FROM trips WHERE warehouse_id = $1 AND planned_date = $2
	`, warehouseID, date).Scan(&s.TotalTrips, &s.TotalDistanceKm)

	// Vehicle utilization (avg weight_used / capacity)
	r.db.QueryRow(ctx, `
		SELECT COALESCE(AVG(
			CASE WHEN v.capacity_kg > 0 THEN t.total_weight_kg / v.capacity_kg * 100 ELSE 0 END
		), 0)
		FROM trips t
		JOIN vehicles v ON v.id = t.vehicle_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2
	`, warehouseID, date).Scan(&s.AvgVehicleUtilization)

	// Revenue
	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(p.amount), 0)
		FROM payments p
		JOIN trip_stops ts ON ts.id = p.trip_stop_id
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2 AND p.status = 'confirmed'
	`, warehouseID, date).Scan(&s.TotalCollected)

	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(so.grand_total), 0)
		FROM sales_orders so WHERE so.warehouse_id = $1 AND so.delivery_date = $2 AND so.status IN ('confirmed','shipped','delivered')
	`, warehouseID, date).Scan(&s.TotalRevenue)

	s.OutstandingReceivable = s.TotalRevenue - s.TotalCollected
	if s.OutstandingReceivable < 0 {
		s.OutstandingReceivable = 0
	}

	// Reconciliation match rate
	var totalRecons, matchedRecons int
	r.db.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(*) FILTER (WHERE r.status = 'matched')
		FROM reconciliations r
		JOIN trips t ON t.id = r.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2
	`, warehouseID, date).Scan(&totalRecons, &matchedRecons)
	if totalRecons > 0 {
		s.ReconMatchRate = float64(matchedRecons) / float64(totalRecons) * 100
	}

	// Discrepancies
	r.db.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM discrepancies d
		JOIN trips t ON t.id = d.trip_id
		WHERE t.warehouse_id = $1 AND t.planned_date = $2
	`, warehouseID, date).Scan(&s.TotalDiscrepancies)

	// Details JSON
	details, _ := json.Marshal(map[string]interface{}{
		"on_time_deliveries": onTime,
		"total_recons":       totalRecons,
		"matched_recons":     matchedRecons,
	})
	s.Details = details

	return s, nil
}

// ── Service ─────────────────────────────────────────

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetKPIReport(ctx context.Context, warehouseID *uuid.UUID, from, to string, limit int) ([]domain.DailyKPISnapshot, error) {
	if limit <= 0 || limit > 365 {
		limit = 30
	}
	return s.repo.GetSnapshots(ctx, warehouseID, from, to, limit)
}

func (s *Service) GenerateSnapshot(ctx context.Context, warehouseID uuid.UUID, date string) (*domain.DailyKPISnapshot, error) {
	snap, err := s.repo.ComputeKPI(ctx, warehouseID, date)
	if err != nil {
		return nil, err
	}
	if err := s.repo.CreateSnapshot(ctx, snap); err != nil {
		return nil, err
	}
	return snap, nil
}

// RunDailySnapshotCron runs at 23:50 daily, generating KPI snapshots for all warehouses.
func (s *Service) RunDailySnapshotCron(ctx context.Context) {
	log.Println("📊 KPI daily snapshot cron started")
	for {
		now := time.Now().In(time.FixedZone("ICT", 7*3600))
		// Next 23:50
		next := time.Date(now.Year(), now.Month(), now.Day(), 23, 50, 0, 0, now.Location())
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}
		waitDuration := time.Until(next)
		log.Printf("📊 KPI snapshot cron: next run at %s (in %s)", next.Format("2006-01-02 15:04"), waitDuration.Round(time.Minute))

		select {
		case <-ctx.Done():
			return
		case <-time.After(waitDuration):
		}

		date := time.Now().In(time.FixedZone("ICT", 7*3600)).Format("2006-01-02")
		warehouseIDs, err := s.repo.GetWarehouseIDs(ctx)
		if err != nil {
			log.Printf("❌ KPI cron: failed to get warehouses: %v", err)
			continue
		}

		for _, whID := range warehouseIDs {
			snap, err := s.GenerateSnapshot(ctx, whID, date)
			if err != nil {
				log.Printf("❌ KPI cron: snapshot failed for warehouse %s: %v", whID, err)
			} else {
				log.Printf("📊 KPI snapshot: warehouse=%s date=%s orders=%d delivered=%d rate=%.1f%%",
					whID, date, snap.TotalOrders, snap.DeliveredOrders, snap.DeliverySuccessRate)
			}
		}
	}
}
