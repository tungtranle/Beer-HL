package fleet

import (
	"context"
	"fmt"
	"strings"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/shopspring/decimal"
)

// Repository handles all fleet-related database operations.
type Repository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRepository(db *pgxpool.Pool, log logger.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// ─── Work Orders ───

func (r *Repository) NextWONumber(ctx context.Context) (string, error) {
	var seq int
	err := r.db.QueryRow(ctx, "SELECT nextval('wo_number_seq')").Scan(&seq)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("WO-%06d", seq), nil
}

func (r *Repository) CreateWorkOrder(ctx context.Context, wo *WorkOrder) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO work_orders (id, wo_number, vehicle_id, driver_id, garage_id,
			trigger_type, category, priority, description, status,
			quoted_amount, is_emergency, is_recurring, km_at_repair, created_by)
		VALUES ($1, $2, $3, $4, $5, $6::text::wo_trigger_type, $7::text::wo_category,
			$8::text::wo_priority, $9, $10::text::work_order_status, $11, $12, $13, $14, $15)
	`, wo.ID, wo.WONumber, wo.VehicleID, wo.DriverID, wo.GarageID,
		wo.TriggerType, wo.Category, wo.Priority, wo.Description, wo.Status,
		wo.QuotedAmount, wo.IsEmergency, wo.IsRecurring, wo.KmAtRepair, wo.CreatedBy)
	return err
}

func (r *Repository) GetWorkOrder(ctx context.Context, id uuid.UUID) (*WorkOrder, error) {
	wo := &WorkOrder{}
	err := r.db.QueryRow(ctx, `
		SELECT w.id, w.wo_number, w.vehicle_id, v.plate_number, w.driver_id,
			COALESCE(d.full_name, ''), w.garage_id, COALESCE(g.name, ''),
			w.trigger_type::text, w.category::text, w.priority::text,
			w.description, w.status::text, w.quoted_amount, w.actual_amount,
			w.approved_by, w.approved_at, w.eta_completion, w.actual_completion,
			w.km_at_repair, w.invoice_url, w.is_emergency, w.is_recurring,
			w.rejection_reason, w.created_by, w.created_at, w.updated_at
		FROM work_orders w
		JOIN vehicles v ON v.id = w.vehicle_id
		LEFT JOIN drivers d ON d.id = w.driver_id
		LEFT JOIN garages g ON g.id = w.garage_id
		WHERE w.id = $1
	`, id).Scan(
		&wo.ID, &wo.WONumber, &wo.VehicleID, &wo.VehiclePlate, &wo.DriverID,
		&wo.DriverName, &wo.GarageID, &wo.GarageName,
		&wo.TriggerType, &wo.Category, &wo.Priority,
		&wo.Description, &wo.Status, &wo.QuotedAmount, &wo.ActualAmount,
		&wo.ApprovedBy, &wo.ApprovedAt, &wo.ETACompletion, &wo.ActualCompletion,
		&wo.KmAtRepair, &wo.InvoiceURL, &wo.IsEmergency, &wo.IsRecurring,
		&wo.RejectionReason, &wo.CreatedBy, &wo.CreatedAt, &wo.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return wo, nil
}

func (r *Repository) ListWorkOrders(ctx context.Context, filter WOFilter) ([]WorkOrder, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if filter.VehicleID != nil {
		where = append(where, fmt.Sprintf("w.vehicle_id = $%d", idx))
		args = append(args, *filter.VehicleID)
		idx++
	}
	if filter.Status != "" {
		where = append(where, fmt.Sprintf("w.status::text = $%d", idx))
		args = append(args, filter.Status)
		idx++
	}
	if filter.Category != "" {
		where = append(where, fmt.Sprintf("w.category::text = $%d", idx))
		args = append(args, filter.Category)
		idx++
	}

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM work_orders w WHERE %s", strings.Join(where, " AND "))
	var total int
	if err := r.db.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := 20
	offset := 0
	if filter.Limit > 0 {
		limit = filter.Limit
	}
	if filter.Offset > 0 {
		offset = filter.Offset
	}

	dataSQL := fmt.Sprintf(`
		SELECT w.id, w.wo_number, w.vehicle_id, v.plate_number, w.driver_id,
			COALESCE(d.full_name, ''), w.garage_id, COALESCE(g.name, ''),
			w.trigger_type::text, w.category::text, w.priority::text,
			w.description, w.status::text, w.quoted_amount, w.actual_amount,
			w.is_emergency, w.is_recurring, w.created_at, w.updated_at
		FROM work_orders w
		JOIN vehicles v ON v.id = w.vehicle_id
		LEFT JOIN drivers d ON d.id = w.driver_id
		LEFT JOIN garages g ON g.id = w.garage_id
		WHERE %s
		ORDER BY w.created_at DESC
		LIMIT %d OFFSET %d
	`, strings.Join(where, " AND "), limit, offset)

	rows, err := r.db.Query(ctx, dataSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []WorkOrder
	for rows.Next() {
		var wo WorkOrder
		if err := rows.Scan(
			&wo.ID, &wo.WONumber, &wo.VehicleID, &wo.VehiclePlate, &wo.DriverID,
			&wo.DriverName, &wo.GarageID, &wo.GarageName,
			&wo.TriggerType, &wo.Category, &wo.Priority,
			&wo.Description, &wo.Status, &wo.QuotedAmount, &wo.ActualAmount,
			&wo.IsEmergency, &wo.IsRecurring, &wo.CreatedAt, &wo.UpdatedAt,
		); err != nil {
			return nil, 0, err
		}
		list = append(list, wo)
	}
	return list, total, nil
}

func (r *Repository) UpdateWorkOrder(ctx context.Context, id uuid.UUID, fields map[string]interface{}) error {
	sets := []string{}
	args := []interface{}{}
	idx := 1
	for k, v := range fields {
		if k == "status" {
			sets = append(sets, fmt.Sprintf("%s = $%d::text::work_order_status", k, idx))
		} else if k == "category" {
			sets = append(sets, fmt.Sprintf("%s = $%d::text::wo_category", k, idx))
		} else if k == "priority" {
			sets = append(sets, fmt.Sprintf("%s = $%d::text::wo_priority", k, idx))
		} else {
			sets = append(sets, fmt.Sprintf("%s = $%d", k, idx))
		}
		args = append(args, v)
		idx++
	}
	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)

	sql := fmt.Sprintf("UPDATE work_orders SET %s WHERE id = $%d", strings.Join(sets, ", "), idx)
	_, err := r.db.Exec(ctx, sql, args...)
	return err
}

func (r *Repository) CreateRepairItems(ctx context.Context, items []RepairItem) error {
	for _, item := range items {
		_, err := r.db.Exec(ctx, `
			INSERT INTO repair_items (id, work_order_id, item_type, description, quantity, unit_price, total_price, part_number)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		`, item.ID, item.WorkOrderID, item.ItemType, item.Description, item.Quantity, item.UnitPrice, item.TotalPrice, item.PartNumber)
		if err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) ListRepairItems(ctx context.Context, woID uuid.UUID) ([]RepairItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, work_order_id, item_type, description, quantity, unit_price, total_price,
			part_number, warranty_km, warranty_days, created_at
		FROM repair_items WHERE work_order_id = $1 ORDER BY created_at
	`, woID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []RepairItem
	for rows.Next() {
		var ri RepairItem
		if err := rows.Scan(&ri.ID, &ri.WorkOrderID, &ri.ItemType, &ri.Description,
			&ri.Quantity, &ri.UnitPrice, &ri.TotalPrice, &ri.PartNumber,
			&ri.WarrantyKm, &ri.WarrantyDays, &ri.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, ri)
	}
	return list, nil
}

func (r *Repository) CreateRepairAttachment(ctx context.Context, att *RepairAttachment) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO repair_attachments (id, work_order_id, attachment_type, url, file_name, uploaded_by)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, att.ID, att.WorkOrderID, att.AttachmentType, att.URL, att.FileName, att.UploadedBy)
	return err
}

func (r *Repository) ListRepairAttachments(ctx context.Context, woID uuid.UUID) ([]RepairAttachment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, work_order_id, attachment_type, url, file_name, file_size, uploaded_by, created_at
		FROM repair_attachments WHERE work_order_id = $1 ORDER BY created_at
	`, woID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []RepairAttachment
	for rows.Next() {
		var a RepairAttachment
		if err := rows.Scan(&a.ID, &a.WorkOrderID, &a.AttachmentType, &a.URL,
			&a.FileName, &a.FileSize, &a.UploadedBy, &a.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, nil
}

func (r *Repository) SetVehicleStatus(ctx context.Context, vehicleID uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, "UPDATE vehicles SET status = $1, updated_at = NOW() WHERE id = $2", status, vehicleID)
	return err
}

func (r *Repository) UpdateVehicleHealthScore(ctx context.Context, vehicleID uuid.UUID, score int) error {
	_, err := r.db.Exec(ctx, `
		UPDATE vehicles SET health_score = $1, last_health_check = NOW(), updated_at = NOW() WHERE id = $2
	`, score, vehicleID)
	return err
}

func (r *Repository) GetVehicleHealthData(ctx context.Context, vehicleID uuid.UUID) (*VehicleHealthData, error) {
	vhd := &VehicleHealthData{}
	err := r.db.QueryRow(ctx, `
		SELECT v.id, v.plate_number, v.vehicle_type, v.health_score, v.current_km,
			v.year_of_manufacture, v.last_health_check,
			(SELECT COUNT(*) FROM work_orders WHERE vehicle_id = v.id AND status::text NOT IN ('completed','verified','cancelled')) as open_ros,
			(SELECT COUNT(*) FROM vehicle_maintenance_records WHERE vehicle_id = v.id AND status = 'pending' AND next_due_date < CURRENT_DATE) as overdue_maintenance
		FROM vehicles v WHERE v.id = $1
	`, vehicleID).Scan(
		&vhd.VehicleID, &vhd.PlateNumber, &vhd.VehicleType, &vhd.HealthScore,
		&vhd.CurrentKm, &vhd.YearOfManufacture, &vhd.LastHealthCheck,
		&vhd.OpenROs, &vhd.OverdueMaintenance,
	)
	if err != nil {
		return nil, err
	}
	return vhd, nil
}

func (r *Repository) ListAllVehiclesForHealth(ctx context.Context) ([]VehicleHealthData, error) {
	rows, err := r.db.Query(ctx, `
		SELECT v.id, v.plate_number, v.vehicle_type, v.health_score, v.current_km,
			v.year_of_manufacture, v.last_health_check,
			(SELECT COUNT(*) FROM work_orders WHERE vehicle_id = v.id AND status::text NOT IN ('completed','verified','cancelled')),
			(SELECT COUNT(*) FROM vehicle_maintenance_records WHERE vehicle_id = v.id AND status = 'pending' AND next_due_date < CURRENT_DATE)
		FROM vehicles v WHERE v.status != 'inactive'
		ORDER BY v.health_score ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []VehicleHealthData
	for rows.Next() {
		var vhd VehicleHealthData
		if err := rows.Scan(&vhd.VehicleID, &vhd.PlateNumber, &vhd.VehicleType, &vhd.HealthScore,
			&vhd.CurrentKm, &vhd.YearOfManufacture, &vhd.LastHealthCheck,
			&vhd.OpenROs, &vhd.OverdueMaintenance); err != nil {
			return nil, err
		}
		list = append(list, vhd)
	}
	return list, nil
}

// ─── Garages ───

func (r *Repository) CreateGarage(ctx context.Context, g *Garage) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO garages (id, name, address, gps_lat, gps_lng, phone, specialties,
			payment_terms, opening_hours, is_preferred, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, g.ID, g.Name, g.Address, g.GPSLat, g.GPSLng, g.Phone, g.Specialties,
		g.PaymentTerms, g.OpeningHours, g.IsPreferred, g.CreatedBy)
	return err
}

func (r *Repository) ListGarages(ctx context.Context, includeBlacklisted bool) ([]Garage, error) {
	where := "1=1"
	if !includeBlacklisted {
		where = "is_blacklisted = false"
	}
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT id, name, address, gps_lat, gps_lng, phone, specialties,
			payment_terms, opening_hours, is_preferred, is_blacklisted,
			avg_rating, total_repairs, avg_mttr_hours, created_at
		FROM garages WHERE %s ORDER BY is_preferred DESC, avg_rating DESC
	`, where))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Garage
	for rows.Next() {
		var g Garage
		if err := rows.Scan(&g.ID, &g.Name, &g.Address, &g.GPSLat, &g.GPSLng,
			&g.Phone, &g.Specialties, &g.PaymentTerms, &g.OpeningHours,
			&g.IsPreferred, &g.IsBlacklisted, &g.AvgRating, &g.TotalRepairs,
			&g.AvgMTTRHours, &g.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, g)
	}
	return list, nil
}

func (r *Repository) UpdateGarage(ctx context.Context, id uuid.UUID, fields map[string]interface{}) error {
	sets := []string{}
	args := []interface{}{}
	idx := 1
	for k, v := range fields {
		sets = append(sets, fmt.Sprintf("%s = $%d", k, idx))
		args = append(args, v)
		idx++
	}
	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)
	sql := fmt.Sprintf("UPDATE garages SET %s WHERE id = $%d", strings.Join(sets, ", "), idx)
	_, err := r.db.Exec(ctx, sql, args...)
	return err
}

func (r *Repository) CreateGarageRating(ctx context.Context, rating *GarageRating) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO garage_ratings (id, garage_id, work_order_id, quality_score, time_score,
			cost_vs_quote, rework_flag, notes, rated_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, rating.ID, rating.GarageID, rating.WorkOrderID, rating.QualityScore,
		rating.TimeScore, rating.CostVsQuote, rating.ReworkFlag, rating.Notes, rating.RatedBy)
	if err != nil {
		return err
	}
	// Update garage aggregate
	_, err = r.db.Exec(ctx, `
		UPDATE garages SET
			avg_rating = (SELECT AVG((quality_score + time_score)::numeric / 2) FROM garage_ratings WHERE garage_id = $1),
			total_repairs = (SELECT COUNT(*) FROM garage_ratings WHERE garage_id = $1),
			avg_mttr_hours = COALESCE((
				SELECT AVG(EXTRACT(EPOCH FROM (wo.actual_completion - wo.created_at)) / 3600)
				FROM garage_ratings gr JOIN work_orders wo ON wo.id = gr.work_order_id
				WHERE gr.garage_id = $1 AND wo.actual_completion IS NOT NULL
			), 0),
			updated_at = NOW()
		WHERE id = $1
	`, rating.GarageID)
	return err
}

// ─── Fuel Logs ───

func (r *Repository) CreateFuelLog(ctx context.Context, fl *FuelLog) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO fuel_logs (id, vehicle_id, driver_id, log_date, km_odometer,
			liters_filled, amount_vnd, fuel_type, station_name, invoice_photo_url,
			channel, expected_liters, anomaly_ratio, anomaly_flag, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
			$11::text::fuel_channel, $12, $13, $14, $15)
	`, fl.ID, fl.VehicleID, fl.DriverID, fl.LogDate, fl.KmOdometer,
		fl.LitersFilled, fl.AmountVND, fl.FuelType, fl.StationName, fl.InvoicePhotoURL,
		fl.Channel, fl.ExpectedLiters, fl.AnomalyRatio, fl.AnomalyFlag, fl.CreatedBy)
	return err
}

func (r *Repository) ListFuelLogs(ctx context.Context, filter FuelLogFilter) ([]FuelLog, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1

	if filter.VehicleID != nil {
		where = append(where, fmt.Sprintf("fl.vehicle_id = $%d", idx))
		args = append(args, *filter.VehicleID)
		idx++
	}
	if filter.DriverID != nil {
		where = append(where, fmt.Sprintf("fl.driver_id = $%d", idx))
		args = append(args, *filter.DriverID)
		idx++
	}
	if filter.AnomalyOnly {
		where = append(where, "fl.anomaly_flag = true")
	}

	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM fuel_logs fl WHERE %s", strings.Join(where, " AND "))
	var total int
	if err := r.db.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := 20
	offset := 0
	if filter.Limit > 0 {
		limit = filter.Limit
	}
	if filter.Offset > 0 {
		offset = filter.Offset
	}

	dataSQL := fmt.Sprintf(`
		SELECT fl.id, fl.vehicle_id, v.plate_number, fl.driver_id, d.full_name,
			fl.log_date::text, fl.km_odometer, fl.liters_filled, fl.amount_vnd,
			fl.fuel_type, fl.station_name, fl.invoice_photo_url,
			fl.channel::text, fl.expected_liters, fl.anomaly_ratio, fl.anomaly_flag, fl.created_at
		FROM fuel_logs fl
		JOIN vehicles v ON v.id = fl.vehicle_id
		JOIN drivers d ON d.id = fl.driver_id
		WHERE %s
		ORDER BY fl.created_at DESC
		LIMIT %d OFFSET %d
	`, strings.Join(where, " AND "), limit, offset)

	rows, err := r.db.Query(ctx, dataSQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []FuelLog
	for rows.Next() {
		var fl FuelLog
		if err := rows.Scan(&fl.ID, &fl.VehicleID, &fl.VehiclePlate, &fl.DriverID, &fl.DriverName,
			&fl.LogDate, &fl.KmOdometer, &fl.LitersFilled, &fl.AmountVND,
			&fl.FuelType, &fl.StationName, &fl.InvoicePhotoURL,
			&fl.Channel, &fl.ExpectedLiters, &fl.AnomalyRatio, &fl.AnomalyFlag, &fl.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, fl)
	}
	return list, total, nil
}

func (r *Repository) CreateFuelAnomaly(ctx context.Context, fa *FuelAnomaly) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO fuel_anomalies (id, fuel_log_id, vehicle_id, driver_id,
			expected_liters, actual_liters, anomaly_ratio, status)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8::text::fuel_anomaly_status)
	`, fa.ID, fa.FuelLogID, fa.VehicleID, fa.DriverID,
		fa.ExpectedLiters, fa.ActualLiters, fa.AnomalyRatio, fa.Status)
	return err
}

func (r *Repository) ListFuelAnomalies(ctx context.Context, status string) ([]FuelAnomaly, error) {
	where := "1=1"
	args := []interface{}{}
	if status != "" {
		where = "fa.status::text = $1"
		args = append(args, status)
	}
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT fa.id, fa.fuel_log_id, fa.vehicle_id, v.plate_number,
			fa.driver_id, d.full_name, fa.expected_liters, fa.actual_liters,
			fa.anomaly_ratio, fa.status::text, fa.explanation_text, fa.created_at
		FROM fuel_anomalies fa
		JOIN vehicles v ON v.id = fa.vehicle_id
		JOIN drivers d ON d.id = fa.driver_id
		WHERE %s ORDER BY fa.created_at DESC
	`, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []FuelAnomaly
	for rows.Next() {
		var fa FuelAnomaly
		if err := rows.Scan(&fa.ID, &fa.FuelLogID, &fa.VehicleID, &fa.VehiclePlate,
			&fa.DriverID, &fa.DriverName, &fa.ExpectedLiters, &fa.ActualLiters,
			&fa.AnomalyRatio, &fa.Status, &fa.ExplanationText, &fa.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, fa)
	}
	return list, nil
}

func (r *Repository) UpdateFuelAnomaly(ctx context.Context, id uuid.UUID, status, explanation string, reviewerID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE fuel_anomalies SET status = $1::text::fuel_anomaly_status,
			explanation_text = $2, reviewer_id = $3, reviewed_at = NOW()
		WHERE id = $4
	`, status, explanation, reviewerID, id)
	return err
}

func (r *Repository) GetFuelConsumptionRate(ctx context.Context, vehicleType string) (*FuelConsumptionRate, error) {
	fcr := &FuelConsumptionRate{}
	err := r.db.QueryRow(ctx, `
		SELECT vehicle_type, base_rate, urban_factor, highway_factor, mountain_factor
		FROM fuel_consumption_rates WHERE vehicle_type = $1
	`, vehicleType).Scan(&fcr.VehicleType, &fcr.BaseRate, &fcr.UrbanFactor, &fcr.HighwayFactor, &fcr.MountainFactor)
	if err == pgx.ErrNoRows {
		// default
		return &FuelConsumptionRate{VehicleType: vehicleType, BaseRate: 15.0, UrbanFactor: 1.15, HighwayFactor: 1.0, MountainFactor: 1.3}, nil
	}
	return fcr, err
}

func (r *Repository) GetPreviousOdometer(ctx context.Context, vehicleID uuid.UUID) (int, error) {
	var km int
	err := r.db.QueryRow(ctx, `
		SELECT km_odometer FROM fuel_logs WHERE vehicle_id = $1 ORDER BY log_date DESC, created_at DESC LIMIT 1
	`, vehicleID).Scan(&km)
	if err == pgx.ErrNoRows {
		return 0, nil
	}
	return km, err
}

// ─── Tire Sets ───

func (r *Repository) CreateTireSet(ctx context.Context, ts *TireSet) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO tire_sets (id, vehicle_id, brand, model, size, tire_count,
			installed_date, installed_km, purchase_cost, condition, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::text::tire_condition, $11)
	`, ts.ID, ts.VehicleID, ts.Brand, ts.Model, ts.Size, ts.TireCount,
		ts.InstalledDate, ts.InstalledKm, ts.PurchaseCost, ts.Condition, ts.CreatedBy)
	return err
}

func (r *Repository) ListTireSets(ctx context.Context, vehicleID uuid.UUID) ([]TireSet, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, vehicle_id, brand, model, size, tire_count,
			installed_date::text, installed_km, purchase_cost, condition::text,
			last_rotation_km, notes, is_active, created_at
		FROM tire_sets WHERE vehicle_id = $1 ORDER BY is_active DESC, created_at DESC
	`, vehicleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []TireSet
	for rows.Next() {
		var ts TireSet
		if err := rows.Scan(&ts.ID, &ts.VehicleID, &ts.Brand, &ts.Model, &ts.Size,
			&ts.TireCount, &ts.InstalledDate, &ts.InstalledKm, &ts.PurchaseCost,
			&ts.Condition, &ts.LastRotationKm, &ts.Notes, &ts.IsActive, &ts.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, ts)
	}
	return list, nil
}

func (r *Repository) UpdateTireSet(ctx context.Context, id uuid.UUID, fields map[string]interface{}) error {
	sets := []string{}
	args := []interface{}{}
	idx := 1
	for k, v := range fields {
		if k == "condition" {
			sets = append(sets, fmt.Sprintf("%s = $%d::text::tire_condition", k, idx))
		} else {
			sets = append(sets, fmt.Sprintf("%s = $%d", k, idx))
		}
		args = append(args, v)
		idx++
	}
	sets = append(sets, "updated_at = NOW()")
	args = append(args, id)
	sql := fmt.Sprintf("UPDATE tire_sets SET %s WHERE id = $%d", strings.Join(sets, ", "), idx)
	_, err := r.db.Exec(ctx, sql, args...)
	return err
}

// ─── Leave Requests ───

func (r *Repository) CreateLeaveRequest(ctx context.Context, lr *LeaveRequest) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO leave_requests (id, driver_id, leave_type, start_date, end_date, reason, status)
		VALUES ($1, $2, $3::text::leave_type, $4, $5, $6, $7::text::leave_status)
	`, lr.ID, lr.DriverID, lr.LeaveType, lr.StartDate, lr.EndDate, lr.Reason, lr.Status)
	return err
}

func (r *Repository) ListLeaveRequests(ctx context.Context, driverID *uuid.UUID, status string) ([]LeaveRequest, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	idx := 1
	if driverID != nil {
		where = append(where, fmt.Sprintf("lr.driver_id = $%d", idx))
		args = append(args, *driverID)
		idx++
	}
	if status != "" {
		where = append(where, fmt.Sprintf("lr.status::text = $%d", idx))
		args = append(args, status)
		idx++
	}

	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT lr.id, lr.driver_id, d.full_name, lr.leave_type::text, lr.start_date::text,
			lr.end_date::text, lr.reason, lr.status::text, lr.approved_by, lr.approved_at,
			lr.rejection_reason, lr.created_at
		FROM leave_requests lr
		JOIN drivers d ON d.id = lr.driver_id
		WHERE %s ORDER BY lr.created_at DESC
	`, strings.Join(where, " AND ")), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []LeaveRequest
	for rows.Next() {
		var lr LeaveRequest
		if err := rows.Scan(&lr.ID, &lr.DriverID, &lr.DriverName, &lr.LeaveType,
			&lr.StartDate, &lr.EndDate, &lr.Reason, &lr.Status,
			&lr.ApprovedBy, &lr.ApprovedAt, &lr.RejectionReason, &lr.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, lr)
	}
	return list, nil
}

func (r *Repository) UpdateLeaveRequest(ctx context.Context, id uuid.UUID, status string, approvedBy uuid.UUID, rejectionReason string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE leave_requests SET status = $1::text::leave_status, approved_by = $2,
			approved_at = NOW(), rejection_reason = $3, updated_at = NOW()
		WHERE id = $4
	`, status, approvedBy, rejectionReason, id)
	return err
}

func (r *Repository) GetDriverLeaveBalance(ctx context.Context, driverID uuid.UUID) (int, int, error) {
	var annual, used int
	err := r.db.QueryRow(ctx, `
		SELECT annual_leave_days, used_leave_days FROM drivers WHERE id = $1
	`, driverID).Scan(&annual, &used)
	return annual, used, err
}

func (r *Repository) IncrementUsedLeave(ctx context.Context, driverID uuid.UUID, days int) error {
	_, err := r.db.Exec(ctx, `
		UPDATE drivers SET used_leave_days = used_leave_days + $1 WHERE id = $2
	`, days, driverID)
	return err
}

// ─── Driver Scores ───

func (r *Repository) UpsertDriverScore(ctx context.Context, ds *DriverScore) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO driver_scores (id, driver_id, score_date, total_score,
			otd_score, delivery_score, safety_score, compliance_score, customer_score,
			trips_count, stops_count, on_time_count, delivered_count, failed_count,
			speed_violations, checklist_completions, epod_completions, model_version)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
		ON CONFLICT (driver_id, score_date) DO UPDATE SET
			total_score = $4, otd_score = $5, delivery_score = $6, safety_score = $7,
			compliance_score = $8, customer_score = $9, trips_count = $10, stops_count = $11,
			on_time_count = $12, delivered_count = $13, failed_count = $14,
			speed_violations = $15, checklist_completions = $16, epod_completions = $17
	`, ds.ID, ds.DriverID, ds.ScoreDate, ds.TotalScore,
		ds.OTDScore, ds.DeliveryScore, ds.SafetyScore, ds.ComplianceScore, ds.CustomerScore,
		ds.TripsCount, ds.StopsCount, ds.OnTimeCount, ds.DeliveredCount, ds.FailedCount,
		ds.SpeedViolations, ds.ChecklistCompletions, ds.EPODCompletions, ds.ModelVersion)
	return err
}

func (r *Repository) UpdateDriverCurrentScore(ctx context.Context, driverID uuid.UUID, score float64) error {
	_, err := r.db.Exec(ctx, "UPDATE drivers SET current_score = $1 WHERE id = $2", score, driverID)
	return err
}

func (r *Repository) GetDriverScoreHistory(ctx context.Context, driverID uuid.UUID, days int) ([]DriverScore, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, driver_id, score_date::text, total_score, otd_score, delivery_score,
			safety_score, compliance_score, customer_score,
			trips_count, stops_count, on_time_count, delivered_count, failed_count
		FROM driver_scores WHERE driver_id = $1
		ORDER BY score_date DESC LIMIT $2
	`, driverID, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []DriverScore
	for rows.Next() {
		var ds DriverScore
		if err := rows.Scan(&ds.ID, &ds.DriverID, &ds.ScoreDate, &ds.TotalScore,
			&ds.OTDScore, &ds.DeliveryScore, &ds.SafetyScore, &ds.ComplianceScore,
			&ds.CustomerScore, &ds.TripsCount, &ds.StopsCount, &ds.OnTimeCount,
			&ds.DeliveredCount, &ds.FailedCount); err != nil {
			return nil, err
		}
		list = append(list, ds)
	}
	return list, nil
}

func (r *Repository) GetDriverTripStats(ctx context.Context, driverID uuid.UUID, date time.Time) (*DriverTripStats, error) {
	stats := &DriverTripStats{}
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT t.id) as trips,
			COUNT(ts.id) as total_stops,
			COUNT(CASE WHEN ts.status::text = 'delivered' THEN 1 END) as delivered,
			COUNT(CASE WHEN ts.status::text IN ('failed','rejected') THEN 1 END) as failed,
			COUNT(CASE WHEN ts.actual_arrival IS NOT NULL AND ts.planned_arrival IS NOT NULL
				AND ts.actual_arrival <= ts.planned_arrival + interval '60 minutes' THEN 1 END) as on_time
		FROM trips t
		JOIN trip_stops ts ON ts.trip_id = t.id
		WHERE t.driver_id = $1
		  AND t.created_at::date = $2
		  AND t.status::text NOT IN ('cancelled')
	`, driverID, date).Scan(&stats.Trips, &stats.TotalStops, &stats.Delivered, &stats.Failed, &stats.OnTime)
	if err == pgx.ErrNoRows {
		return stats, nil
	}
	return stats, err
}

func (r *Repository) GetDriverChecklistStats(ctx context.Context, driverID uuid.UUID, date time.Time) (int, int, error) {
	var checklists, epods int
	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT COUNT(*) FROM trip_checklists tc JOIN trips t ON t.id = tc.trip_id
			 WHERE t.driver_id = $1 AND tc.created_at::date = $2),
			(SELECT COUNT(*) FROM trip_stops ts JOIN trips t ON t.id = ts.trip_id
			 WHERE t.driver_id = $1 AND ts.status::text = 'delivered' AND t.created_at::date = $2
			 AND ts.photo_urls IS NOT NULL AND array_length(ts.photo_urls, 1) > 0)
	`, driverID, date).Scan(&checklists, &epods)
	if err == pgx.ErrNoRows {
		return 0, 0, nil
	}
	return checklists, epods, err
}

func (r *Repository) GetAllActiveDriverIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, "SELECT id FROM drivers WHERE status = 'active'")
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

// ─── Leaderboard ───

func (r *Repository) GetLeaderboard(ctx context.Context, period string, limit int) ([]LeaderboardEntry, error) {
	dateFilter := "score_date >= CURRENT_DATE - interval '7 days'"
	if period == "month" {
		dateFilter = "score_date >= date_trunc('month', CURRENT_DATE)"
	}

	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT d.id, d.full_name, COALESCE(AVG(ds.total_score), 0) as avg_score,
			COALESCE(SUM(ds.trips_count), 0) as total_trips,
			(SELECT COUNT(*) FROM badge_awards ba WHERE ba.driver_id = d.id) as badge_count
		FROM drivers d
		LEFT JOIN driver_scores ds ON ds.driver_id = d.id AND %s
		WHERE d.status = 'active'
		GROUP BY d.id, d.full_name
		ORDER BY avg_score DESC
		LIMIT $1
	`, dateFilter), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []LeaderboardEntry
	rank := 0
	for rows.Next() {
		rank++
		var le LeaderboardEntry
		if err := rows.Scan(&le.DriverID, &le.DriverName, &le.AvgScore,
			&le.TotalTrips, &le.BadgeCount); err != nil {
			return nil, err
		}
		le.Rank = rank
		list = append(list, le)
	}
	return list, nil
}

func (r *Repository) GetDriverRank(ctx context.Context, driverID uuid.UUID, period string) (int, int, error) {
	dateFilter := "score_date >= CURRENT_DATE - interval '7 days'"
	if period == "month" {
		dateFilter = "score_date >= date_trunc('month', CURRENT_DATE)"
	}

	var rank, total int
	err := r.db.QueryRow(ctx, fmt.Sprintf(`
		WITH ranked AS (
			SELECT d.id, ROW_NUMBER() OVER (ORDER BY COALESCE(AVG(ds.total_score), 0) DESC) as rn
			FROM drivers d
			LEFT JOIN driver_scores ds ON ds.driver_id = d.id AND %s
			WHERE d.status = 'active'
			GROUP BY d.id
		)
		SELECT rn, (SELECT COUNT(*) FROM ranked) FROM ranked WHERE id = $1
	`, dateFilter), driverID).Scan(&rank, &total)
	if err == pgx.ErrNoRows {
		return 0, 0, nil
	}
	return rank, total, err
}

// ─── Badges ───

func (r *Repository) ListBadges(ctx context.Context, activeOnly bool) ([]Badge, error) {
	where := "1=1"
	if activeOnly {
		where = "is_active = true"
	}
	rows, err := r.db.Query(ctx, fmt.Sprintf(`
		SELECT id, badge_code, name, description, icon_emoji, condition_config,
			value_vnd, is_active, sort_order
		FROM gamification_badges WHERE %s ORDER BY sort_order
	`, where))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []Badge
	for rows.Next() {
		var b Badge
		if err := rows.Scan(&b.ID, &b.BadgeCode, &b.Name, &b.Description,
			&b.IconEmoji, &b.ConditionConfig, &b.ValueVND, &b.IsActive, &b.SortOrder); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

func (r *Repository) GetDriverBadges(ctx context.Context, driverID uuid.UUID) ([]BadgeAward, error) {
	rows, err := r.db.Query(ctx, `
		SELECT ba.id, ba.badge_id, gb.badge_code, gb.name, gb.icon_emoji,
			ba.awarded_at, ba.period_month::text, ba.bonus_vnd
		FROM badge_awards ba
		JOIN gamification_badges gb ON gb.id = ba.badge_id
		WHERE ba.driver_id = $1 ORDER BY ba.awarded_at DESC
	`, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []BadgeAward
	for rows.Next() {
		var ba BadgeAward
		if err := rows.Scan(&ba.ID, &ba.BadgeID, &ba.BadgeCode, &ba.BadgeName,
			&ba.BadgeEmoji, &ba.AwardedAt, &ba.PeriodMonth, &ba.BonusVND); err != nil {
			return nil, err
		}
		ba.DriverID = driverID
		list = append(list, ba)
	}
	return list, nil
}

func (r *Repository) CreateBadgeAward(ctx context.Context, ba *BadgeAward) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO badge_awards (id, badge_id, driver_id, period_month, condition_snapshot, bonus_vnd, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (badge_id, driver_id, period_month) DO NOTHING
	`, ba.ID, ba.BadgeID, ba.DriverID, ba.PeriodMonth, ba.ConditionSnapshot, ba.BonusVND, ba.CreatedBy)
	return err
}

// ─── Cost Analytics ───

func (r *Repository) GetRepairCostSummary(ctx context.Context, months int) (*RepairCostSummary, error) {
	summary := &RepairCostSummary{}
	err := r.db.QueryRow(ctx, `
		SELECT
			COALESCE(SUM(actual_amount), 0),
			COUNT(*),
			COALESCE(AVG(EXTRACT(EPOCH FROM (actual_completion - created_at)) / 3600), 0)
		FROM work_orders
		WHERE status::text IN ('completed','verified')
		  AND created_at >= CURRENT_DATE - $1 * interval '1 month'
	`, months).Scan(&summary.TotalCost, &summary.TotalOrders, &summary.AvgMTTRHours)
	return summary, err
}

func (r *Repository) GetTopCostVehicles(ctx context.Context, months, limit int) ([]VehicleCostRank, error) {
	rows, err := r.db.Query(ctx, `
		SELECT v.id, v.plate_number, v.vehicle_type,
			COALESCE(SUM(wo.actual_amount), 0) as total_cost,
			COUNT(wo.id) as repair_count
		FROM vehicles v
		LEFT JOIN work_orders wo ON wo.vehicle_id = v.id
			AND wo.status::text IN ('completed','verified')
			AND wo.created_at >= CURRENT_DATE - $1 * interval '1 month'
		GROUP BY v.id, v.plate_number, v.vehicle_type
		ORDER BY total_cost DESC
		LIMIT $2
	`, months, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []VehicleCostRank
	for rows.Next() {
		var vc VehicleCostRank
		if err := rows.Scan(&vc.VehicleID, &vc.PlateNumber, &vc.VehicleType,
			&vc.TotalCost, &vc.RepairCount); err != nil {
			return nil, err
		}
		list = append(list, vc)
	}
	return list, nil
}

func (r *Repository) GetCostBreakdownByCategory(ctx context.Context, months int) ([]CategoryCost, error) {
	rows, err := r.db.Query(ctx, `
		SELECT category::text, COALESCE(SUM(actual_amount), 0), COUNT(*)
		FROM work_orders
		WHERE status::text IN ('completed','verified')
		  AND created_at >= CURRENT_DATE - $1 * interval '1 month'
		GROUP BY category ORDER BY SUM(actual_amount) DESC
	`, months)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []CategoryCost
	for rows.Next() {
		var cc CategoryCost
		if err := rows.Scan(&cc.Category, &cc.TotalCost, &cc.Count); err != nil {
			return nil, err
		}
		list = append(list, cc)
	}
	return list, nil
}

func (r *Repository) GetVehicleTCO(ctx context.Context, vehicleID uuid.UUID, months int) (*VehicleTCO, error) {
	tco := &VehicleTCO{VehicleID: vehicleID}
	// Repair cost
	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(actual_amount), 0)
		FROM work_orders WHERE vehicle_id = $1
		AND status::text IN ('completed','verified')
		AND created_at >= CURRENT_DATE - $2 * interval '1 month'
	`, vehicleID, months).Scan(&tco.RepairCost)

	// Fuel cost
	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(amount_vnd), 0)
		FROM fuel_logs WHERE vehicle_id = $1
		AND created_at >= CURRENT_DATE - $2 * interval '1 month'
	`, vehicleID, months).Scan(&tco.FuelCost)

	// Tire cost
	r.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(purchase_cost), 0)
		FROM tire_sets WHERE vehicle_id = $1
		AND created_at >= CURRENT_DATE - $2 * interval '1 month'
	`, vehicleID, months).Scan(&tco.TireCost)

	// Km driven (from fuel logs)
	r.db.QueryRow(ctx, `
		SELECT COALESCE(MAX(km_odometer) - MIN(km_odometer), 0)
		FROM fuel_logs WHERE vehicle_id = $1
		AND created_at >= CURRENT_DATE - $2 * interval '1 month'
	`, vehicleID, months).Scan(&tco.KmDriven)

	// Vehicle info
	r.db.QueryRow(ctx, `
		SELECT plate_number, vehicle_type, year_of_manufacture FROM vehicles WHERE id = $1
	`, vehicleID).Scan(&tco.PlateNumber, &tco.VehicleType, &tco.YearOfManufacture)

	tco.TotalCost = tco.RepairCost.Add(tco.FuelCost).Add(tco.TireCost)
	if tco.KmDriven > 0 {
		tco.CostPerKm = tco.TotalCost.Div(decimal.NewFromInt(int64(tco.KmDriven)))
	}

	return tco, nil
}

func (r *Repository) GetFleetTCOSummary(ctx context.Context, months int) ([]VehicleTCO, error) {
	rows, err := r.db.Query(ctx, "SELECT id FROM vehicles WHERE status != 'inactive' ORDER BY plate_number")
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

	var list []VehicleTCO
	for _, id := range ids {
		tco, err := r.GetVehicleTCO(ctx, id, months)
		if err != nil {
			continue
		}
		list = append(list, *tco)
	}
	return list, nil
}

// GetBonusReport for a given month
func (r *Repository) GetBonusReport(ctx context.Context, month string) ([]BonusReportEntry, error) {
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.full_name, d.current_score,
			COALESCE(SUM(ba.bonus_vnd), 0) as badge_bonus,
			COUNT(ba.id) as badge_count
		FROM drivers d
		LEFT JOIN badge_awards ba ON ba.driver_id = d.id AND ba.period_month::text = $1
		WHERE d.status = 'active'
		GROUP BY d.id, d.full_name, d.current_score
		ORDER BY badge_bonus DESC
	`, month)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []BonusReportEntry
	for rows.Next() {
		var b BonusReportEntry
		if err := rows.Scan(&b.DriverID, &b.DriverName, &b.AvgScore,
			&b.BadgeBonus, &b.BadgeCount); err != nil {
			return nil, err
		}
		list = append(list, b)
	}
	return list, nil
}

// ─── Document Expiry for VRP Block ───

func (r *Repository) GetVehiclesWithExpiredDocuments(ctx context.Context, withinDays int) ([]VehicleDocAlert, error) {
	rows, err := r.db.Query(ctx, `
		SELECT v.id, v.plate_number, vd.document_type, vd.expiry_date::text,
			CASE WHEN vd.expiry_date < CURRENT_DATE THEN 'expired'
			     WHEN vd.expiry_date <= CURRENT_DATE + $1 * interval '1 day' THEN 'expiring'
			END as alert_level
		FROM vehicles v
		JOIN vehicle_documents vd ON vd.vehicle_id = v.id
		WHERE v.status != 'inactive'
		  AND vd.expiry_date <= CURRENT_DATE + $1 * interval '1 day'
		ORDER BY vd.expiry_date ASC
	`, withinDays)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []VehicleDocAlert
	for rows.Next() {
		var a VehicleDocAlert
		if err := rows.Scan(&a.VehicleID, &a.PlateNumber, &a.DocumentType,
			&a.ExpiryDate, &a.AlertLevel); err != nil {
			return nil, err
		}
		list = append(list, a)
	}
	return list, nil
}

// ─── Garage Benchmark ───
func (r *Repository) GetGarageBenchmark(ctx context.Context) ([]GarageBenchmark, error) {
	rows, err := r.db.Query(ctx, `
		SELECT g.id, g.name, g.avg_rating, g.total_repairs, g.avg_mttr_hours,
			COALESCE(AVG(wo.actual_amount), 0) as avg_cost
		FROM garages g
		LEFT JOIN work_orders wo ON wo.garage_id = g.id AND wo.status::text IN ('completed','verified')
		WHERE g.is_blacklisted = false
		GROUP BY g.id, g.name, g.avg_rating, g.total_repairs, g.avg_mttr_hours
		ORDER BY g.avg_rating DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []GarageBenchmark
	for rows.Next() {
		var gb GarageBenchmark
		if err := rows.Scan(&gb.GarageID, &gb.GarageName, &gb.AvgRating,
			&gb.TotalRepairs, &gb.AvgMTTRHours, &gb.AvgCost); err != nil {
			return nil, err
		}
		list = append(list, gb)
	}
	return list, nil
}
