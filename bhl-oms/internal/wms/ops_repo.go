package wms

// ops_repo.go — DB queries for WMS Operations Center (Phase D).
// Endpoints: /warehouse/dashboard/kpis, /warehouse/exceptions, /warehouse/picker-stats

import (
	"context"
	"time"

	"github.com/google/uuid"
)

// ─────────────────────────────────────────────────────────────────────────────
// KPI types
// ─────────────────────────────────────────────────────────────────────────────

type WarehouseKPI struct {
	WarehouseID        string `json:"warehouse_id"`
	TotalBins          int    `json:"total_bins"`
	BinsOver90         int    `json:"bins_over_90_pct"`
	BinsOccupied       int    `json:"bins_occupied"`
	ActivePickOrders   int    `json:"active_pick_orders"`
	PendingPickOrders  int    `json:"pending_pick_orders"`
	CompletedToday     int    `json:"completed_pick_today"`
	NearExpiryCount    int    `json:"near_expiry_count"` // lots expiring <=30d
	TotalSKUs          int    `json:"total_skus"`
	TotalUnits         int64  `json:"total_units"`
	OpenExceptions     int    `json:"open_exceptions"`
	CriticalExceptions int    `json:"critical_exceptions"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Exception types
// ─────────────────────────────────────────────────────────────────────────────

type WMSException struct {
	ID             string    `json:"id"`
	WarehouseID    string    `json:"warehouse_id"`
	Type           string    `json:"type"`
	Severity       string    `json:"severity"`
	Title          string    `json:"title"`
	Description    string    `json:"description,omitempty"`
	ReferenceID    string    `json:"reference_id,omitempty"`
	ReferenceType  string    `json:"reference_type,omitempty"`
	AssignedTo     string    `json:"assigned_to,omitempty"`
	Status         string    `json:"status"`
	ResolutionNote string    `json:"resolution_note,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// ─────────────────────────────────────────────────────────────────────────────
// Picker stats types
// ─────────────────────────────────────────────────────────────────────────────

type PickerStat struct {
	UserID     string  `json:"user_id"`
	FullName   string  `json:"full_name"`
	Username   string  `json:"username"`
	PicksToday int     `json:"picks_today"`
	PicksWeek  int     `json:"picks_week"`
	InProgress int     `json:"in_progress"`
	AvgMinutes float64 `json:"avg_minutes_per_order"`
}

// ─────────────────────────────────────────────────────────────────────────────
// GetWarehouseKPIs
// ─────────────────────────────────────────────────────────────────────────────

func (r *Repository) GetWarehouseKPIs(ctx context.Context, warehouseID uuid.UUID) (*WarehouseKPI, error) {
	kpi := &WarehouseKPI{WarehouseID: warehouseID.String()}
	today := time.Now().Truncate(24 * time.Hour)

	// Bin counts
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*) as total,
		       COUNT(*) FILTER (WHERE bin_type = 'storage') as storage
		FROM bin_locations WHERE warehouse_id = $1`, warehouseID).
		Scan(&kpi.TotalBins, &kpi.BinsOccupied)
	if err != nil {
		return nil, err
	}
	// Bins >90% occupied (via pallet counts)
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*) FROM (
			SELECT bl.id, bl.capacity_pallets,
			       COUNT(p.id) AS occupied
			FROM bin_locations bl
			LEFT JOIN pallets p ON p.current_bin_id = bl.id AND p.status NOT IN ('dispatched','destroyed')
			WHERE bl.warehouse_id = $1 AND bl.bin_type = 'storage'
			GROUP BY bl.id, bl.capacity_pallets
			HAVING bl.capacity_pallets > 0 AND COUNT(p.id)::float / bl.capacity_pallets >= 0.9
		) t`, warehouseID).Scan(&kpi.BinsOver90)
	if err != nil {
		kpi.BinsOver90 = 0
	}

	// Pick orders
	err = r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE status = 'in_progress') AS active,
			COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
			COUNT(*) FILTER (WHERE status = 'completed' AND completed_at >= $2) AS today
		FROM picking_orders WHERE warehouse_id = $1`, warehouseID, today).
		Scan(&kpi.ActivePickOrders, &kpi.PendingPickOrders, &kpi.CompletedToday)
	if err != nil {
		return nil, err
	}

	// Near expiry lots (<=30 days)
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT l.id)
		FROM lots l
		JOIN stock_quants sq ON sq.lot_id = l.id AND sq.warehouse_id = $1 AND sq.quantity > 0
		WHERE l.expiry_date IS NOT NULL
		  AND l.expiry_date <= CURRENT_DATE + INTERVAL '30 days'
		  AND l.expiry_date >= CURRENT_DATE`, warehouseID).Scan(&kpi.NearExpiryCount)
	if err != nil {
		kpi.NearExpiryCount = 0
	}

	// Stock totals
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(DISTINCT sq.product_id), COALESCE(SUM(sq.quantity),0)
		FROM stock_quants sq WHERE sq.warehouse_id = $1 AND sq.quantity > 0`, warehouseID).
		Scan(&kpi.TotalSKUs, &kpi.TotalUnits)
	if err != nil {
		return nil, err
	}

	// Open exceptions
	err = r.db.QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE status IN ('open','in_progress')),
		       COUNT(*) FILTER (WHERE status IN ('open','in_progress') AND severity = 'critical')
		FROM wms_exceptions WHERE warehouse_id = $1`, warehouseID).
		Scan(&kpi.OpenExceptions, &kpi.CriticalExceptions)
	if err != nil {
		kpi.OpenExceptions = 0
	}

	return kpi, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// GetExceptions
// ─────────────────────────────────────────────────────────────────────────────

func (r *Repository) GetExceptions(ctx context.Context, warehouseID uuid.UUID, status string) ([]WMSException, error) {
	query := `
		SELECT id::text, warehouse_id::text, type, severity, title,
		       COALESCE(description, ''), COALESCE(reference_id::text, ''),
		       COALESCE(reference_type, ''), COALESCE(assigned_to::text, ''),
		       status, COALESCE(resolution_note, ''), created_at, updated_at
		FROM wms_exceptions WHERE warehouse_id = $1`
	args := []interface{}{warehouseID}
	if status != "" {
		args = append(args, status)
		query += ` AND status = $2`
	}
	query += ` ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END, created_at DESC LIMIT 100`

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []WMSException
	for rows.Next() {
		var e WMSException
		if err := rows.Scan(
			&e.ID, &e.WarehouseID, &e.Type, &e.Severity, &e.Title, &e.Description,
			&e.ReferenceID, &e.ReferenceType, &e.AssignedTo,
			&e.Status, &e.ResolutionNote, &e.CreatedAt, &e.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, e)
	}
	return out, nil
}

// ─────────────────────────────────────────────────────────────────────────────
// ResolveException
// ─────────────────────────────────────────────────────────────────────────────

func (r *Repository) ResolveException(ctx context.Context, id, resolvedBy uuid.UUID, note string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE wms_exceptions
		SET status = 'resolved', resolved_by = $2, resolved_at = NOW(),
		    resolution_note = $3, updated_at = NOW()
		WHERE id = $1 AND status IN ('open','in_progress')`, id, resolvedBy, note)
	return err
}

// DismissException marks an exception as dismissed.
func (r *Repository) DismissException(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE wms_exceptions SET status = 'dismissed', updated_at = NOW()
		WHERE id = $1`, id)
	return err
}

// ─────────────────────────────────────────────────────────────────────────────
// GetPickerStats
// ─────────────────────────────────────────────────────────────────────────────

func (r *Repository) GetPickerStats(ctx context.Context, warehouseID uuid.UUID) ([]PickerStat, error) {
	today := time.Now().Truncate(24 * time.Hour)
	weekAgo := today.AddDate(0, 0, -7)

	rows, err := r.db.Query(ctx, `
		SELECT u.id::text, u.full_name, u.username,
		       COUNT(*) FILTER (WHERE po.completed_at >= $2)  AS picks_today,
		       COUNT(*) FILTER (WHERE po.created_at  >= $3)   AS picks_week,
		       COUNT(*) FILTER (WHERE po.status = 'in_progress') AS in_progress,
		       COALESCE(
		         AVG(EXTRACT(EPOCH FROM (po.completed_at - po.started_at))/60.0)
		         FILTER (WHERE po.completed_at IS NOT NULL AND po.started_at IS NOT NULL),
		         0
		       ) AS avg_minutes
		FROM users u
		JOIN picking_orders po ON po.assigned_to = u.id AND po.warehouse_id = $1
		WHERE u.role IN ('warehouse_handler','admin')
		GROUP BY u.id, u.full_name, u.username
		ORDER BY picks_today DESC, picks_week DESC
		LIMIT 20`, warehouseID, today, weekAgo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []PickerStat
	for rows.Next() {
		var s PickerStat
		if err := rows.Scan(&s.UserID, &s.FullName, &s.Username,
			&s.PicksToday, &s.PicksWeek, &s.InProgress, &s.AvgMinutes); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, nil
}
