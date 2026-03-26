package kpi

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRepository(db *pgxpool.Pool, log logger.Logger) *Repository {
	return &Repository{db: db, log: log}
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
	log  logger.Logger
}

func NewService(repo *Repository, log logger.Logger) *Service {
	return &Service{repo: repo, log: log}
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

// IssueItem represents an order/trip with issues.
type IssueItem struct {
	ID           string  `json:"id"`
	Type         string  `json:"type"` // failed_delivery, discrepancy, late_delivery
	OrderNumber  string  `json:"order_number"`
	CustomerName string  `json:"customer_name"`
	Status       string  `json:"status"`
	Reason       string  `json:"reason"`
	Amount       float64 `json:"amount"`
	Date         string  `json:"date"`
}

// CancellationItem represents a cancelled or on-credit order.
type CancellationItem struct {
	ID           string  `json:"id"`
	Type         string  `json:"type"` // cancelled, rejected, on_credit, pending_approval
	OrderNumber  string  `json:"order_number"`
	CustomerName string  `json:"customer_name"`
	Status       string  `json:"status"`
	Reason       string  `json:"reason"`
	TotalAmount  float64 `json:"total_amount"`
	CreditStatus string  `json:"credit_status"`
	Date         string  `json:"date"`
}

// IssuesReport wraps issue items with summary counts.
type IssuesReport struct {
	Summary struct {
		FailedDeliveries int `json:"failed_deliveries"`
		Discrepancies    int `json:"discrepancies"`
		LateDeliveries   int `json:"late_deliveries"`
		Total            int `json:"total"`
	} `json:"summary"`
	Items []IssueItem `json:"items"`
}

// CancellationsReport wraps cancellation items with summary counts.
type CancellationsReport struct {
	Summary struct {
		Cancelled       int     `json:"cancelled"`
		Rejected        int     `json:"rejected"`
		OnCredit        int     `json:"on_credit"`
		PendingApproval int     `json:"pending_approval"`
		TotalDebt       float64 `json:"total_debt"`
	} `json:"summary"`
	Items []CancellationItem `json:"items"`
}

func (s *Service) GetIssuesReport(ctx context.Context, from, to string, limit int) (*IssuesReport, error) {
	report := &IssuesReport{}

	// Failed deliveries
	rows, err := s.repo.db.Query(ctx, `
		SELECT so.id::text, so.order_number, COALESCE(c.name,''), so.status::text,
			COALESCE(ts.failure_reason,'Không rõ nguyên nhân'), COALESCE(so.grand_total,0), so.delivery_date::text
		FROM trip_stops ts
		JOIN shipments sh ON sh.id = ts.shipment_id
		JOIN sales_orders so ON so.id = sh.order_id
		JOIN customers c ON c.id = so.customer_id
		WHERE ts.status = 'failed'
		  AND so.delivery_date::text >= $1 AND so.delivery_date::text <= $2
		ORDER BY so.delivery_date DESC LIMIT $3
	`, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("query failed deliveries: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item IssueItem
		if err := rows.Scan(&item.ID, &item.OrderNumber, &item.CustomerName, &item.Status, &item.Reason, &item.Amount, &item.Date); err != nil {
			continue
		}
		item.Type = "failed_delivery"
		report.Items = append(report.Items, item)
		report.Summary.FailedDeliveries++
	}

	// Discrepancies
	rows2, err := s.repo.db.Query(ctx, `
		SELECT so.id::text, so.order_number, COALESCE(c.name,''), so.status::text,
			COALESCE(d.discrepancy_type::text,'qty_mismatch'), COALESCE(so.grand_total,0), so.delivery_date::text
		FROM discrepancies d
		JOIN trips t ON t.id = d.trip_id
		JOIN trip_stops ts ON ts.trip_id = t.id
		JOIN shipments sh ON sh.id = ts.shipment_id
		JOIN sales_orders so ON so.id = sh.order_id
		JOIN customers c ON c.id = so.customer_id
		WHERE so.delivery_date::text >= $1 AND so.delivery_date::text <= $2
		ORDER BY so.delivery_date DESC LIMIT $3
	`, from, to, limit)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var item IssueItem
			if err := rows2.Scan(&item.ID, &item.OrderNumber, &item.CustomerName, &item.Status, &item.Reason, &item.Amount, &item.Date); err != nil {
				continue
			}
			item.Type = "discrepancy"
			report.Items = append(report.Items, item)
			report.Summary.Discrepancies++
		}
	}

	report.Summary.Total = report.Summary.FailedDeliveries + report.Summary.Discrepancies + report.Summary.LateDeliveries
	return report, nil
}

func (s *Service) GetCancellationsReport(ctx context.Context, from, to string, limit int) (*CancellationsReport, error) {
	report := &CancellationsReport{}

	rows, err := s.repo.db.Query(ctx, `
		SELECT so.id::text, so.order_number, COALESCE(c.name,''), so.status::text,
			COALESCE(so.notes,''), COALESCE(so.grand_total,0), COALESCE(so.credit_status::text,''),
			so.delivery_date::text
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		WHERE so.status::text IN ('cancelled','rejected','on_credit','pending_approval')
		  AND so.created_at::date >= $1::date AND so.created_at::date <= $2::date
		ORDER BY so.created_at DESC LIMIT $3
	`, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("query cancellations: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item CancellationItem
		if err := rows.Scan(&item.ID, &item.OrderNumber, &item.CustomerName, &item.Status, &item.Reason, &item.TotalAmount, &item.CreditStatus, &item.Date); err != nil {
			continue
		}
		switch item.Status {
		case "cancelled":
			item.Type = "cancelled"
			report.Summary.Cancelled++
		case "rejected":
			item.Type = "rejected"
			report.Summary.Rejected++
		case "on_credit":
			item.Type = "on_credit"
			report.Summary.OnCredit++
			report.Summary.TotalDebt += item.TotalAmount
		case "pending_approval":
			item.Type = "pending_approval"
			report.Summary.PendingApproval++
			report.Summary.TotalDebt += item.TotalAmount
		}
		report.Items = append(report.Items, item)
	}

	return report, nil
}

// ─── Redelivery Report (BRD US-TMS-14b AC#6) ───────────────

type RedeliveryReport struct {
	Summary struct {
		TotalRedeliveries   int                `json:"total_redeliveries"`
		AvgAttemptsPerOrder float64            `json:"avg_attempts_per_order"`
		TopReasons          []RedeliveryReason `json:"top_reasons"`
	} `json:"summary"`
	Items []RedeliveryItem `json:"items"`
}

type RedeliveryReason struct {
	Reason string `json:"reason"`
	Count  int    `json:"count"`
}

type RedeliveryItem struct {
	ID             string  `json:"id"`
	OrderNumber    string  `json:"order_number"`
	CustomerName   string  `json:"customer_name"`
	AttemptNumber  int     `json:"attempt_number"`
	PreviousStatus string  `json:"previous_status"`
	PreviousReason string  `json:"previous_reason"`
	Amount         float64 `json:"amount"`
	Date           string  `json:"date"`
}

func (s *Service) GetRedeliveryReport(ctx context.Context, from, to string, limit int) (*RedeliveryReport, error) {
	report := &RedeliveryReport{}

	// Redelivery attempts
	rows, err := s.repo.db.Query(ctx, `
		SELECT so.id::text, so.order_number, COALESCE(c.name,''), da.attempt_number,
			COALESCE(da.previous_status::text,''), COALESCE(da.previous_reason,''),
			COALESCE(so.grand_total,0), so.delivery_date::text
		FROM delivery_attempts da
		JOIN sales_orders so ON so.id = da.order_id
		JOIN customers c ON c.id = so.customer_id
		WHERE so.delivery_date::text >= $1 AND so.delivery_date::text <= $2
		ORDER BY da.attempt_number DESC, so.delivery_date DESC LIMIT $3
	`, from, to, limit)
	if err != nil {
		return nil, fmt.Errorf("query redeliveries: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var item RedeliveryItem
		if err := rows.Scan(&item.ID, &item.OrderNumber, &item.CustomerName, &item.AttemptNumber,
			&item.PreviousStatus, &item.PreviousReason, &item.Amount, &item.Date); err != nil {
			continue
		}
		report.Items = append(report.Items, item)
		report.Summary.TotalRedeliveries++
	}

	// Average attempts per order
	var avgAttempts float64
	_ = s.repo.db.QueryRow(ctx, `
		SELECT COALESCE(AVG(max_attempt)::numeric, 0)
		FROM (SELECT MAX(attempt_number) as max_attempt FROM delivery_attempts
			  JOIN sales_orders so ON so.id = delivery_attempts.order_id
			  WHERE so.delivery_date::text >= $1 AND so.delivery_date::text <= $2
			  GROUP BY order_id) sub
	`, from, to).Scan(&avgAttempts)
	report.Summary.AvgAttemptsPerOrder = avgAttempts

	// Top failure reasons
	rows2, err := s.repo.db.Query(ctx, `
		SELECT COALESCE(previous_reason, 'Không rõ'), COUNT(*)
		FROM delivery_attempts da
		JOIN sales_orders so ON so.id = da.order_id
		WHERE so.delivery_date::text >= $1 AND so.delivery_date::text <= $2
			AND previous_reason IS NOT NULL AND previous_reason != ''
		GROUP BY previous_reason ORDER BY COUNT(*) DESC LIMIT 10
	`, from, to)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var r RedeliveryReason
			if err := rows2.Scan(&r.Reason, &r.Count); err == nil {
				report.Summary.TopReasons = append(report.Summary.TopReasons, r)
			}
		}
	}

	return report, nil
}

// RunDailySnapshotCron runs at 23:50 daily, generating KPI snapshots for all warehouses.
func (s *Service) RunDailySnapshotCron(ctx context.Context) {
	s.log.Info(ctx, "cron_started", logger.F("cron", "kpi_daily_snapshot"))
	for {
		now := time.Now().In(time.FixedZone("ICT", 7*3600))
		// Next 23:50
		next := time.Date(now.Year(), now.Month(), now.Day(), 23, 50, 0, 0, now.Location())
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}
		waitDuration := time.Until(next)
		s.log.Info(ctx, "cron_next_run", logger.F("cron", "kpi_daily_snapshot"), logger.F("next_run", next.Format("2006-01-02 15:04")), logger.F("wait", waitDuration.Round(time.Minute).String()))

		select {
		case <-ctx.Done():
			return
		case <-time.After(waitDuration):
		}

		date := time.Now().In(time.FixedZone("ICT", 7*3600)).Format("2006-01-02")
		warehouseIDs, err := s.repo.GetWarehouseIDs(ctx)
		if err != nil {
			s.log.Error(ctx, "cron_get_warehouses_failed", err, logger.F("cron", "kpi_daily_snapshot"))
			continue
		}

		for _, whID := range warehouseIDs {
			snap, err := s.GenerateSnapshot(ctx, whID, date)
			if err != nil {
				s.log.Error(ctx, "cron_snapshot_failed", err, logger.F("cron", "kpi_daily_snapshot"), logger.F("warehouse_id", whID))
			} else {
				s.log.Info(ctx, "kpi_snapshot_done", logger.F("warehouse_id", whID), logger.F("date", date), logger.F("total_orders", snap.TotalOrders), logger.F("delivered_orders", snap.DeliveredOrders), logger.F("delivery_rate", snap.DeliverySuccessRate))
			}
		}
	}
}
