package tms

import (
	"context"
	"fmt"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRepository(db *pgxpool.Pool, log logger.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// ===== SHIPMENTS =====
func (r *Repository) ListPendingDates(ctx context.Context, warehouseID uuid.UUID) ([]map[string]interface{}, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.delivery_date::text, COUNT(*) as shipment_count,
		       COALESCE(SUM(s.total_weight_kg), 0) as total_weight_kg
		FROM shipments s
		WHERE s.warehouse_id = $1 AND s.status = 'pending'
		GROUP BY s.delivery_date
		ORDER BY s.delivery_date
	`, warehouseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dates []map[string]interface{}
	for rows.Next() {
		var date string
		var count int
		var weight float64
		if err := rows.Scan(&date, &count, &weight); err != nil {
			return nil, err
		}
		dates = append(dates, map[string]interface{}{
			"delivery_date":   date,
			"shipment_count":  count,
			"total_weight_kg": weight,
		})
	}
	return dates, nil
}

func (r *Repository) ListPendingShipments(ctx context.Context, warehouseID uuid.UUID, deliveryDate string) ([]domain.Shipment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT s.id, s.shipment_number, s.order_id, s.customer_id, c.name, c.address,
		       s.warehouse_id, s.status::text, s.delivery_date::text, s.total_weight_kg, s.total_volume_m3,
		       c.latitude, c.longitude, s.is_urgent, s.created_at, o.created_at, o.approved_at
		FROM shipments s
		JOIN customers c ON c.id = s.customer_id
		LEFT JOIN sales_orders o ON o.id = s.order_id
		WHERE s.warehouse_id = $1 AND s.delivery_date = $2 AND s.status = 'pending'
		ORDER BY s.is_urgent DESC, o.created_at ASC NULLS LAST, c.route_code, c.name
	`, warehouseID, deliveryDate)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var shipments []domain.Shipment
	for rows.Next() {
		var s domain.Shipment
		if err := rows.Scan(&s.ID, &s.ShipmentNumber, &s.OrderID, &s.CustomerID, &s.CustomerName, &s.CustomerAddress,
			&s.WarehouseID, &s.Status, &s.DeliveryDate, &s.TotalWeightKg, &s.TotalVolumeM3,
			&s.Latitude, &s.Longitude, &s.IsUrgent, &s.CreatedAt, &s.OrderCreatedAt, &s.OrderConfirmedAt); err != nil {
			return nil, err
		}
		shipments = append(shipments, s)
	}
	return shipments, nil
}

func (r *Repository) ToggleUrgent(ctx context.Context, shipmentID uuid.UUID, isUrgent bool) error {
	_, err := r.db.Exec(ctx, `UPDATE shipments SET is_urgent = $1, updated_at = now() WHERE id = $2`, isUrgent, shipmentID)
	return err
}

// GetShipmentCustomerMap returns a map of shipment_id -> customer_id for the given IDs
func (r *Repository) GetShipmentCustomerMap(ctx context.Context, shipmentIDs []uuid.UUID) (map[uuid.UUID]uuid.UUID, error) {
	result := make(map[uuid.UUID]uuid.UUID)
	if len(shipmentIDs) == 0 {
		return result, nil
	}
	rows, err := r.db.Query(ctx, `SELECT id, customer_id FROM shipments WHERE id = ANY($1)`, shipmentIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var sid, cid uuid.UUID
		if err := rows.Scan(&sid, &cid); err != nil {
			return nil, err
		}
		result[sid] = cid
	}
	return result, nil
}

// ===== VEHICLES =====
func (r *Repository) ListAllVehicles(ctx context.Context) ([]domain.Vehicle, error) {
	rows, err := r.db.Query(ctx, `
		SELECT v.id, v.plate_number, v.vehicle_type::text, v.capacity_kg, v.capacity_m3, v.status::text, v.warehouse_id
		FROM vehicles v
		ORDER BY v.warehouse_id, v.capacity_kg
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicles []domain.Vehicle
	for rows.Next() {
		var v domain.Vehicle
		if err := rows.Scan(&v.ID, &v.PlateNumber, &v.VehicleType, &v.CapacityKg, &v.CapacityM3, &v.Status, &v.WarehouseID); err != nil {
			return nil, err
		}
		vehicles = append(vehicles, v)
	}
	return vehicles, nil
}

func (r *Repository) GetVehicle(ctx context.Context, id uuid.UUID) (*domain.Vehicle, error) {
	var v domain.Vehicle
	err := r.db.QueryRow(ctx, `
		SELECT id, plate_number, vehicle_type::text, capacity_kg, capacity_m3, status::text, warehouse_id
		FROM vehicles WHERE id = $1
	`, id).Scan(&v.ID, &v.PlateNumber, &v.VehicleType, &v.CapacityKg, &v.CapacityM3, &v.Status, &v.WarehouseID)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (r *Repository) CreateVehicle(ctx context.Context, v *domain.Vehicle) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO vehicles (plate_number, vehicle_type, capacity_kg, capacity_m3, status, warehouse_id)
		VALUES ($1, $2::vehicle_type, $3, $4, $5, $6)
		RETURNING id
	`, v.PlateNumber, v.VehicleType, v.CapacityKg, v.CapacityM3, v.Status, v.WarehouseID).Scan(&v.ID)
}

func (r *Repository) UpdateVehicle(ctx context.Context, v *domain.Vehicle) error {
	_, err := r.db.Exec(ctx, `
		UPDATE vehicles SET plate_number=$2, vehicle_type=$3::vehicle_type, capacity_kg=$4, 
		       capacity_m3=$5, status=$6, warehouse_id=$7
		WHERE id = $1
	`, v.ID, v.PlateNumber, v.VehicleType, v.CapacityKg, v.CapacityM3, v.Status, v.WarehouseID)
	return err
}

func (r *Repository) DeleteVehicle(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE vehicles SET status = 'inactive' WHERE id = $1`, id)
	return err
}

func (r *Repository) ListAvailableVehicles(ctx context.Context, warehouseID uuid.UUID, date string) ([]domain.Vehicle, error) {
	rows, err := r.db.Query(ctx, `
		SELECT v.id, v.plate_number, v.vehicle_type::text, v.capacity_kg, v.capacity_m3, v.status::text, v.warehouse_id
		FROM vehicles v
		WHERE v.warehouse_id = $1 AND v.status = 'active'
		AND NOT EXISTS (
			SELECT 1 FROM trips t WHERE t.vehicle_id = v.id AND t.planned_date = $2 
			AND t.status NOT IN ('completed', 'cancelled', 'closed')
		)
		ORDER BY v.capacity_kg
	`, warehouseID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vehicles []domain.Vehicle
	for rows.Next() {
		var v domain.Vehicle
		if err := rows.Scan(&v.ID, &v.PlateNumber, &v.VehicleType, &v.CapacityKg, &v.CapacityM3, &v.Status, &v.WarehouseID); err != nil {
			return nil, err
		}
		vehicles = append(vehicles, v)
	}
	return vehicles, nil
}

// ===== DRIVERS =====
func (r *Repository) ListAllDrivers(ctx context.Context) ([]domain.Driver, error) {
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.full_name, d.phone, d.license_number, d.status::text, d.warehouse_id
		FROM drivers d
		ORDER BY d.warehouse_id, d.full_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drivers []domain.Driver
	for rows.Next() {
		var d domain.Driver
		if err := rows.Scan(&d.ID, &d.FullName, &d.Phone, &d.LicenseNumber, &d.Status, &d.WarehouseID); err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}
	return drivers, nil
}

func (r *Repository) GetDriver(ctx context.Context, id uuid.UUID) (*domain.Driver, error) {
	var d domain.Driver
	err := r.db.QueryRow(ctx, `
		SELECT id, full_name, phone, license_number, status::text, warehouse_id
		FROM drivers WHERE id = $1
	`, id).Scan(&d.ID, &d.FullName, &d.Phone, &d.LicenseNumber, &d.Status, &d.WarehouseID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

// GetDriverUserID returns the user_id for a given driver ID.
func (r *Repository) GetDriverUserID(ctx context.Context, driverID uuid.UUID) (uuid.UUID, error) {
	var userID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT user_id FROM drivers WHERE id = $1`, driverID).Scan(&userID)
	return userID, err
}

func (r *Repository) CreateDriver(ctx context.Context, d *domain.Driver) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO drivers (full_name, phone, license_number, status, warehouse_id)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, d.FullName, d.Phone, d.LicenseNumber, d.Status, d.WarehouseID).Scan(&d.ID)
}

func (r *Repository) UpdateDriver(ctx context.Context, d *domain.Driver) error {
	_, err := r.db.Exec(ctx, `
		UPDATE drivers SET full_name=$2, phone=$3, license_number=$4, status=$5, warehouse_id=$6
		WHERE id = $1
	`, d.ID, d.FullName, d.Phone, d.LicenseNumber, d.Status, d.WarehouseID)
	return err
}

func (r *Repository) DeleteDriver(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE drivers SET status = 'inactive' WHERE id = $1`, id)
	return err
}

func (r *Repository) ListAvailableDrivers(ctx context.Context, warehouseID uuid.UUID, date string) ([]domain.Driver, error) {
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.full_name, d.phone, d.license_number, d.status::text, d.warehouse_id
		FROM drivers d
		WHERE d.warehouse_id = $1 AND d.status = 'active'
		AND NOT EXISTS (
			SELECT 1 FROM trips t WHERE t.driver_id = d.id AND t.planned_date = $2 
			AND t.status NOT IN ('completed', 'cancelled', 'closed')
		)
		ORDER BY d.full_name
	`, warehouseID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drivers []domain.Driver
	for rows.Next() {
		var d domain.Driver
		if err := rows.Scan(&d.ID, &d.FullName, &d.Phone, &d.LicenseNumber, &d.Status, &d.WarehouseID); err != nil {
			return nil, err
		}
		drivers = append(drivers, d)
	}
	return drivers, nil
}

// ===== DRIVER CHECK-IN =====
func (r *Repository) UpsertDriverCheckin(ctx context.Context, driverID uuid.UUID, date, status string, reason, note *string) (*domain.DriverCheckin, error) {
	var c domain.DriverCheckin
	err := r.db.QueryRow(ctx, `
		INSERT INTO driver_checkins (driver_id, checkin_date, status, reason, note)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (driver_id, checkin_date) DO UPDATE
		SET status = EXCLUDED.status, reason = EXCLUDED.reason, note = EXCLUDED.note, checked_in_at = NOW()
		RETURNING id, driver_id, checkin_date::text, status, reason, note, checked_in_at
	`, driverID, date, status, reason, note).Scan(
		&c.ID, &c.DriverID, &c.CheckinDate, &c.Status, &c.Reason, &c.Note, &c.CheckedInAt)
	return &c, err
}

func (r *Repository) GetDriverCheckin(ctx context.Context, driverID uuid.UUID, date string) (*domain.DriverCheckin, error) {
	var c domain.DriverCheckin
	err := r.db.QueryRow(ctx, `
		SELECT id, driver_id, checkin_date::text, status, reason, note, checked_in_at
		FROM driver_checkins WHERE driver_id = $1 AND checkin_date = $2
	`, driverID, date).Scan(
		&c.ID, &c.DriverID, &c.CheckinDate, &c.Status, &c.Reason, &c.Note, &c.CheckedInAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) ListDriverCheckinsForDate(ctx context.Context, warehouseID uuid.UUID, date string) ([]map[string]interface{}, error) {
	rows, err := r.db.Query(ctx, `
		SELECT d.id, d.full_name, d.phone, d.status::text as driver_status,
		       COALESCE(dc.status, 'not_checked_in') as checkin_status,
		       dc.reason, dc.checked_in_at,
		       CASE WHEN EXISTS (
		           SELECT 1 FROM trips t WHERE t.driver_id = d.id AND t.planned_date = $2
		           AND t.status NOT IN ('completed', 'cancelled', 'closed')
		       ) THEN true ELSE false END as has_active_trip
		FROM drivers d
		LEFT JOIN driver_checkins dc ON dc.driver_id = d.id AND dc.checkin_date = $2
		WHERE d.warehouse_id = $1 AND d.status != 'inactive'
		ORDER BY CASE COALESCE(dc.status, 'not_checked_in')
		    WHEN 'available' THEN 1 WHEN 'not_checked_in' THEN 2 WHEN 'off_duty' THEN 3 END,
		    d.full_name
	`, warehouseID, date)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id uuid.UUID
		var fullName, phone, driverStatus, checkinStatus string
		var reason *string
		var checkedInAt *time.Time
		var hasActiveTrip bool
		if err := rows.Scan(&id, &fullName, &phone, &driverStatus, &checkinStatus, &reason, &checkedInAt, &hasActiveTrip); err != nil {
			return nil, err
		}

		// Determine display status
		displayStatus := checkinStatus
		if hasActiveTrip {
			displayStatus = "on_trip"
		}

		result := map[string]interface{}{
			"id":              id,
			"full_name":       fullName,
			"phone":           phone,
			"driver_status":   driverStatus,
			"checkin_status":  displayStatus,
			"has_active_trip": hasActiveTrip,
		}
		if reason != nil {
			result["reason"] = *reason
		}
		if checkedInAt != nil {
			result["checked_in_at"] = checkedInAt
		}
		results = append(results, result)
	}
	return results, nil
}

func (r *Repository) GetWarehouse(ctx context.Context, warehouseID uuid.UUID) (float64, float64, error) {
	var lat, lng float64
	err := r.db.QueryRow(ctx, `SELECT latitude, longitude FROM warehouses WHERE id = $1`, warehouseID).Scan(&lat, &lng)
	return lat, lng, err
}

// ===== TRIPS =====
func (r *Repository) NextTripNumber(ctx context.Context, tx pgx.Tx, dateStr string) (string, error) {
	var seq int
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(MAX(CAST(SUBSTRING(trip_number FROM '.{3}$') AS INTEGER)), 0) + 1
		FROM trips WHERE trip_number LIKE 'TR-' || $1 || '-%'
	`, dateStr).Scan(&seq)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("TR-%s-%03d", dateStr, seq), nil
}

func (r *Repository) CreateTrip(ctx context.Context, tx pgx.Tx, trip *domain.Trip) error {
	return tx.QueryRow(ctx, `
		INSERT INTO trips (trip_number, warehouse_id, vehicle_id, driver_id, status, planned_date,
		    total_stops, total_weight_kg, total_distance_km, total_duration_min)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id, created_at
	`, trip.TripNumber, trip.WarehouseID, trip.VehicleID, trip.DriverID, trip.Status,
		trip.PlannedDate, trip.TotalStops, trip.TotalWeightKg, trip.TotalDistanceKm, trip.TotalDurationMin,
	).Scan(&trip.ID, &trip.CreatedAt)
}

func (r *Repository) CreateTripStop(ctx context.Context, tx pgx.Tx, stop *domain.TripStop) error {
	return tx.QueryRow(ctx, `
		INSERT INTO trip_stops (trip_id, shipment_id, customer_id, stop_order, status,
		    estimated_arrival, estimated_departure, distance_from_prev_km, cumulative_load_kg)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, stop.TripID, stop.ShipmentID, stop.CustomerID, stop.StopOrder, stop.Status,
		stop.EstimatedArrival, stop.EstimatedDeparture, stop.DistanceFromPrevKm, stop.CumulativeLoadKg,
	).Scan(&stop.ID)
}

func (r *Repository) UpdateShipmentStatus(ctx context.Context, tx pgx.Tx, shipmentID uuid.UUID, status string) error {
	_, err := tx.Exec(ctx, `UPDATE shipments SET status = $2, updated_at = now() WHERE id = $1`, shipmentID, status)
	return err
}

func (r *Repository) ListTrips(ctx context.Context, warehouseID *uuid.UUID, plannedDate, status string, limit, offset int) ([]domain.Trip, int64, error) {
	query := `
		SELECT t.id, t.trip_number, t.warehouse_id, t.vehicle_id, t.driver_id,
		       COALESCE(v.plate_number, '') as vehicle_plate,
		       COALESCE(d.full_name, '') as driver_name,
		       t.status::text, t.planned_date::text, t.total_stops, t.total_weight_kg,
		       t.total_distance_km, t.total_duration_min, t.created_at
		FROM trips t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN drivers d ON d.id = t.driver_id
		WHERE 1=1
	`
	countQuery := `SELECT COUNT(*) FROM trips t WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if warehouseID != nil {
		query += fmt.Sprintf(" AND t.warehouse_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND t.warehouse_id = $%d", argIdx)
		args = append(args, *warehouseID)
		argIdx++
	}
	if plannedDate != "" {
		query += fmt.Sprintf(" AND t.planned_date = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND t.planned_date = $%d", argIdx)
		args = append(args, plannedDate)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND t.status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND t.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query += " ORDER BY t.created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var trips []domain.Trip
	for rows.Next() {
		var t domain.Trip
		if err := rows.Scan(&t.ID, &t.TripNumber, &t.WarehouseID, &t.VehicleID, &t.DriverID,
			&t.VehiclePlate, &t.DriverName, &t.Status, &t.PlannedDate, &t.TotalStops,
			&t.TotalWeightKg, &t.TotalDistanceKm, &t.TotalDurationMin, &t.CreatedAt); err != nil {
			return nil, 0, err
		}
		trips = append(trips, t)
	}
	return trips, total, nil
}

func (r *Repository) GetTrip(ctx context.Context, tripID uuid.UUID) (*domain.Trip, error) {
	var t domain.Trip
	err := r.db.QueryRow(ctx, `
		SELECT t.id, t.trip_number, t.warehouse_id, t.vehicle_id, t.driver_id,
		       COALESCE(v.plate_number, '') as vehicle_plate,
		       COALESCE(d.full_name, '') as driver_name,
		       COALESCE(d.phone, '') as driver_phone,
		       COALESCE(w.name, '') as warehouse_name,
		       w.latitude as warehouse_lat, w.longitude as warehouse_lng,
		       t.status::text, t.planned_date::text, t.total_stops, t.total_weight_kg,
		       t.total_distance_km, t.total_duration_min, t.started_at, t.completed_at, t.created_at
		FROM trips t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN drivers d ON d.id = t.driver_id
		LEFT JOIN warehouses w ON w.id = t.warehouse_id
		WHERE t.id = $1
	`, tripID).Scan(&t.ID, &t.TripNumber, &t.WarehouseID, &t.VehicleID, &t.DriverID,
		&t.VehiclePlate, &t.DriverName, &t.DriverPhone,
		&t.WarehouseName, &t.WarehouseLat, &t.WarehouseLng,
		&t.Status, &t.PlannedDate, &t.TotalStops,
		&t.TotalWeightKg, &t.TotalDistanceKm, &t.TotalDurationMin, &t.StartedAt, &t.CompletedAt, &t.CreatedAt)
	if err != nil {
		return nil, err
	}

	// Load stops
	rows, err := r.db.Query(ctx, `
		SELECT ts.id, ts.trip_id, ts.shipment_id, ts.customer_id, c.name, c.address,
		       COALESCE(c.phone, ''), c.latitude, c.longitude, ts.stop_order, ts.status::text,
		       ts.estimated_arrival, ts.estimated_departure,
		       ts.actual_arrival, ts.actual_departure,
		       ts.distance_from_prev_km, ts.cumulative_load_kg, ts.notes
		FROM trip_stops ts
		JOIN customers c ON c.id = ts.customer_id
		WHERE ts.trip_id = $1
		ORDER BY ts.stop_order
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var s domain.TripStop
		if err := rows.Scan(&s.ID, &s.TripID, &s.ShipmentID, &s.CustomerID, &s.CustomerName,
			&s.CustomerAddress, &s.CustomerPhone, &s.Latitude, &s.Longitude, &s.StopOrder, &s.Status,
			&s.EstimatedArrival, &s.EstimatedDeparture,
			&s.ActualArrival, &s.ActualDeparture,
			&s.DistanceFromPrevKm, &s.CumulativeLoadKg, &s.Notes); err != nil {
			return nil, err
		}
		t.Stops = append(t.Stops, s)
	}

	// Load order items for each stop (via shipment → order → order_items)
	for i, stop := range t.Stops {
		if stop.ShipmentID == nil {
			continue
		}
		var orderNumber string
		var orderAmount float64
		err := r.db.QueryRow(ctx, `
			SELECT so.order_number, so.total_amount + so.deposit_amount
			FROM shipments sh
			JOIN sales_orders so ON so.id = sh.order_id
			WHERE sh.id = $1
		`, *stop.ShipmentID).Scan(&orderNumber, &orderAmount)
		if err != nil {
			continue
		}
		t.Stops[i].OrderNumber = orderNumber
		t.Stops[i].OrderAmount = orderAmount

		itemRows, err := r.db.Query(ctx, `
			SELECT oi.id, oi.order_id, oi.product_id, p.name, p.sku, oi.quantity, oi.unit_price, oi.amount, oi.deposit_amount
			FROM shipments sh
			JOIN order_items oi ON oi.order_id = sh.order_id
			JOIN products p ON p.id = oi.product_id
			WHERE sh.id = $1
			ORDER BY p.name
		`, *stop.ShipmentID)
		if err != nil {
			continue
		}
		for itemRows.Next() {
			var item domain.OrderItem
			if err := itemRows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.ProductSKU,
				&item.Quantity, &item.UnitPrice, &item.Amount, &item.DepositAmount); err != nil {
				break
			}
			t.Stops[i].OrderItems = append(t.Stops[i].OrderItems, item)
		}
		itemRows.Close()
	}

	// Load checklist if exists
	cl, err := r.GetChecklistByTripID(ctx, tripID)
	if err == nil {
		t.Checklist = cl
	}

	return &t, nil
}

func (r *Repository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

// ===== DRIVER =====
func (r *Repository) GetDriverByUserID(ctx context.Context, userID uuid.UUID) (*domain.Driver, error) {
	var d domain.Driver
	err := r.db.QueryRow(ctx, `
		SELECT id, full_name, phone, license_number, status::text, warehouse_id
		FROM drivers WHERE user_id = $1
	`, userID).Scan(&d.ID, &d.FullName, &d.Phone, &d.LicenseNumber, &d.Status, &d.WarehouseID)
	if err != nil {
		return nil, err
	}
	return &d, nil
}

func (r *Repository) GetTripsByDriverID(ctx context.Context, driverID uuid.UUID) ([]domain.Trip, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.trip_number, t.warehouse_id, t.vehicle_id, t.driver_id,
		       COALESCE(v.plate_number, '') as vehicle_plate,
		       COALESCE(d.full_name, '') as driver_name,
		       t.status::text, t.planned_date::text, t.total_stops, t.total_weight_kg,
		       t.total_distance_km, t.total_duration_min, t.started_at, t.completed_at, t.created_at
		FROM trips t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN drivers d ON d.id = t.driver_id
		WHERE t.driver_id = $1
		ORDER BY t.planned_date DESC, t.created_at DESC
	`, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var trips []domain.Trip
	for rows.Next() {
		var t domain.Trip
		if err := rows.Scan(&t.ID, &t.TripNumber, &t.WarehouseID, &t.VehicleID, &t.DriverID,
			&t.VehiclePlate, &t.DriverName, &t.Status, &t.PlannedDate, &t.TotalStops,
			&t.TotalWeightKg, &t.TotalDistanceKm, &t.TotalDurationMin,
			&t.StartedAt, &t.CompletedAt, &t.CreatedAt); err != nil {
			return nil, err
		}
		trips = append(trips, t)
	}
	return trips, nil
}

func (r *Repository) UpdateTripStatus(ctx context.Context, tripID uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE trips SET status = $2, updated_at = now() WHERE id = $1
	`, tripID, status)
	return err
}

func (r *Repository) StartTrip(ctx context.Context, tripID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE trips SET status = 'in_transit', started_at = now(), updated_at = now() WHERE id = $1
	`, tripID)
	return err
}

func (r *Repository) CompleteTrip(ctx context.Context, tripID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE trips SET status = 'completed', completed_at = now(), updated_at = now() WHERE id = $1
	`, tripID)
	return err
}

func (r *Repository) UpdateTripStopStatus(ctx context.Context, stopID uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE trip_stops SET status = $2 WHERE id = $1
	`, stopID, status)
	return err
}

func (r *Repository) ArriveAtStop(ctx context.Context, stopID uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE trip_stops SET status = 'arrived', actual_arrival = now() WHERE id = $1
	`, stopID)
	return err
}

func (r *Repository) DeliverStop(ctx context.Context, stopID uuid.UUID, notes *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE trip_stops SET status = 'delivered', actual_departure = now(), notes = $2 WHERE id = $1
	`, stopID, notes)
	return err
}

func (r *Repository) FailStop(ctx context.Context, stopID uuid.UUID, notes *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE trip_stops SET status = 'failed', actual_departure = now(), notes = $2 WHERE id = $1
	`, stopID, notes)
	return err
}

func (r *Repository) GetTripStopByID(ctx context.Context, stopID uuid.UUID) (*domain.TripStop, error) {
	var s domain.TripStop
	err := r.db.QueryRow(ctx, `
		SELECT id, trip_id, shipment_id, customer_id, stop_order, status::text,
		       actual_arrival, actual_departure, notes
		FROM trip_stops WHERE id = $1
	`, stopID).Scan(&s.ID, &s.TripID, &s.ShipmentID, &s.CustomerID, &s.StopOrder, &s.Status,
		&s.ActualArrival, &s.ActualDeparture, &s.Notes)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

// ===== CHECKLIST =====
func (r *Repository) CreateChecklist(ctx context.Context, cl *domain.TripChecklist) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO trip_checklists (trip_id, driver_id, vehicle_id,
			tires_ok, brakes_ok, lights_ok, mirrors_ok, horn_ok,
			coolant_ok, oil_ok, fuel_level, fire_extinguisher_ok,
			first_aid_ok, documents_ok, cargo_secured, is_passed, notes)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
		RETURNING id, checked_at
	`, cl.TripID, cl.DriverID, cl.VehicleID,
		cl.TiresOk, cl.BrakesOk, cl.LightsOk, cl.MirrorsOk, cl.HornOk,
		cl.CoolantOk, cl.OilOk, cl.FuelLevel, cl.FireExtinguisherOk,
		cl.FirstAidOk, cl.DocumentsOk, cl.CargoSecured, cl.IsPassed, cl.Notes,
	).Scan(&cl.ID, &cl.CheckedAt)
}

func (r *Repository) GetChecklistByTripID(ctx context.Context, tripID uuid.UUID) (*domain.TripChecklist, error) {
	var cl domain.TripChecklist
	err := r.db.QueryRow(ctx, `
		SELECT id, trip_id, driver_id, vehicle_id,
		       tires_ok, brakes_ok, lights_ok, mirrors_ok, horn_ok,
		       coolant_ok, oil_ok, fuel_level, fire_extinguisher_ok,
		       first_aid_ok, documents_ok, cargo_secured, is_passed, notes, checked_at
		FROM trip_checklists WHERE trip_id = $1
	`, tripID).Scan(&cl.ID, &cl.TripID, &cl.DriverID, &cl.VehicleID,
		&cl.TiresOk, &cl.BrakesOk, &cl.LightsOk, &cl.MirrorsOk, &cl.HornOk,
		&cl.CoolantOk, &cl.OilOk, &cl.FuelLevel, &cl.FireExtinguisherOk,
		&cl.FirstAidOk, &cl.DocumentsOk, &cl.CargoSecured, &cl.IsPassed, &cl.Notes, &cl.CheckedAt,
	)
	if err != nil {
		return nil, err
	}
	return &cl, nil
}

// ===== ePOD =====

func (r *Repository) CreateEPOD(ctx context.Context, epod *domain.EPOD) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO epod (trip_stop_id, driver_id, customer_id, delivered_items,
			receiver_name, receiver_phone, signature_url, photo_urls,
			total_amount, deposit_amount, delivery_status, notes,
			reject_reason, reject_detail, reject_photos)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id, created_at, updated_at
	`, epod.TripStopID, epod.DriverID, epod.CustomerID, epod.DeliveredItems,
		epod.ReceiverName, epod.ReceiverPhone, epod.SignatureURL, epod.PhotoURLs,
		epod.TotalAmount, epod.DepositAmount, epod.DeliveryStatus, epod.Notes,
		epod.RejectReason, epod.RejectDetail, epod.RejectPhotos,
	).Scan(&epod.ID, &epod.CreatedAt, &epod.UpdatedAt)
}

func (r *Repository) GetEPODByStopID(ctx context.Context, stopID uuid.UUID) (*domain.EPOD, error) {
	var e domain.EPOD
	err := r.db.QueryRow(ctx, `
		SELECT id, trip_stop_id, driver_id, customer_id, delivered_items,
		       receiver_name, receiver_phone, signature_url, photo_urls,
		       total_amount, deposit_amount, delivery_status, notes,
		       reject_reason, reject_detail, reject_photos,
		       created_at, updated_at
		FROM epod WHERE trip_stop_id = $1
	`, stopID).Scan(&e.ID, &e.TripStopID, &e.DriverID, &e.CustomerID, &e.DeliveredItems,
		&e.ReceiverName, &e.ReceiverPhone, &e.SignatureURL, &e.PhotoURLs,
		&e.TotalAmount, &e.DepositAmount, &e.DeliveryStatus, &e.Notes,
		&e.RejectReason, &e.RejectDetail, &e.RejectPhotos,
		&e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

func (r *Repository) GetOrderAmountsByShipment(ctx context.Context, shipmentID uuid.UUID) (float64, float64, error) {
	var totalAmount, depositAmount float64
	err := r.db.QueryRow(ctx, `
		SELECT so.total_amount, so.deposit_amount
		FROM shipments sh JOIN sales_orders so ON so.id = sh.order_id
		WHERE sh.id = $1
	`, shipmentID).Scan(&totalAmount, &depositAmount)
	return totalAmount, depositAmount, err
}

func (r *Repository) GetOrderIDByShipment(ctx context.Context, shipmentID uuid.UUID) (uuid.UUID, error) {
	var orderID uuid.UUID
	err := r.db.QueryRow(ctx, `SELECT order_id FROM shipments WHERE id = $1`, shipmentID).Scan(&orderID)
	return orderID, err
}

// ===== PAYMENT =====

func (r *Repository) CreatePayment(ctx context.Context, p *domain.Payment) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO payments (trip_stop_id, epod_id, customer_id, driver_id, order_id,
			payment_method, amount, status, reference_number, notes)
		VALUES ($1, $2, $3, $4, $5, $6::payment_method, $7, $8::payment_status, $9, $10)
		RETURNING id, collected_at, created_at, updated_at
	`, p.TripStopID, p.EPODID, p.CustomerID, p.DriverID, p.OrderID,
		p.PaymentMethod, p.Amount, p.Status, p.ReferenceNumber, p.Notes,
	).Scan(&p.ID, &p.CollectedAt, &p.CreatedAt, &p.UpdatedAt)
}

func (r *Repository) GetPaymentsByStopID(ctx context.Context, stopID uuid.UUID) ([]domain.Payment, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, trip_stop_id, epod_id, customer_id, driver_id, order_id,
		       payment_method::text, amount, status::text, reference_number, notes,
		       collected_at, confirmed_at, confirmed_by, created_at, updated_at
		FROM payments WHERE trip_stop_id = $1
		ORDER BY created_at
	`, stopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.Payment
	for rows.Next() {
		var p domain.Payment
		if err := rows.Scan(&p.ID, &p.TripStopID, &p.EPODID, &p.CustomerID, &p.DriverID, &p.OrderID,
			&p.PaymentMethod, &p.Amount, &p.Status, &p.ReferenceNumber, &p.Notes,
			&p.CollectedAt, &p.ConfirmedAt, &p.ConfirmedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, p)
	}
	return results, nil
}

func (r *Repository) CreateCreditLedgerEntry(ctx context.Context, customerID, orderID uuid.UUID, amount float64, createdBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO receivable_ledger (customer_id, order_id, ledger_type, amount, description, created_by)
		VALUES ($1, $2, 'debit', $3, 'Ghi nợ giao hàng - thanh toán công nợ', $4)
	`, customerID, orderID, amount, createdBy)
	return err
}

// ===== RETURN COLLECTION =====

func (r *Repository) CreateReturnCollection(ctx context.Context, rc *domain.ReturnCollection) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO return_collections (trip_stop_id, customer_id, asset_type, quantity, condition, photo_url, created_by)
		VALUES ($1, $2, $3::asset_type, $4, $5::asset_condition, $6, $7)
		RETURNING id, created_at, updated_at
	`, rc.TripStopID, rc.CustomerID, rc.AssetType, rc.Quantity, rc.Condition, rc.PhotoURL, rc.CreatedBy,
	).Scan(&rc.ID, &rc.CreatedAt, &rc.UpdatedAt)
}

func (r *Repository) GetReturnsByStopID(ctx context.Context, stopID uuid.UUID) ([]domain.ReturnCollection, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, trip_stop_id, customer_id, asset_type::text, quantity, condition::text,
		       photo_url, workshop_confirmed_qty, workshop_confirmed_by, workshop_confirmed_at,
		       discrepancy_qty, created_by, created_at, updated_at
		FROM return_collections WHERE trip_stop_id = $1
		ORDER BY created_at
	`, stopID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.ReturnCollection
	for rows.Next() {
		var rc domain.ReturnCollection
		if err := rows.Scan(&rc.ID, &rc.TripStopID, &rc.CustomerID, &rc.AssetType, &rc.Quantity, &rc.Condition,
			&rc.PhotoURL, &rc.WorkshopConfirmedQty, &rc.WorkshopConfirmedBy, &rc.WorkshopConfirmedAt,
			&rc.DiscrepancyQty, &rc.CreatedBy, &rc.CreatedAt, &rc.UpdatedAt); err != nil {
			return nil, err
		}
		results = append(results, rc)
	}
	return results, nil
}

func (r *Repository) CreateAssetLedgerEntry(ctx context.Context, customerID uuid.UUID, assetType, direction string, quantity int, condition, refType string, refID, createdBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO asset_ledger (customer_id, asset_type, direction, quantity, condition,
			reference_type, reference_id, created_by)
		VALUES ($1, $2::asset_type, $3::asset_direction, $4, $5::asset_condition, $6, $7, $8)
	`, customerID, assetType, direction, quantity, condition, refType, refID, createdBy)
	return err
}

// ===== VEHICLE DOCUMENTS =====

func (r *Repository) ListVehicleDocuments(ctx context.Context, vehicleID uuid.UUID) ([]domain.VehicleDocument, error) {
	rows, err := r.db.Query(ctx, `
		SELECT vd.id, vd.vehicle_id, vd.doc_type, COALESCE(vd.doc_number,''), 
		       vd.issued_date::text, vd.expiry_date::text, vd.notes, vd.created_by,
		       vd.created_at, vd.updated_at,
		       v.plate_number, (vd.expiry_date - CURRENT_DATE) as days_to_expiry
		FROM vehicle_documents vd
		JOIN vehicles v ON v.id = vd.vehicle_id
		WHERE vd.vehicle_id = $1
		ORDER BY vd.expiry_date ASC
	`, vehicleID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []domain.VehicleDocument
	for rows.Next() {
		var d domain.VehicleDocument
		if err := rows.Scan(&d.ID, &d.VehicleID, &d.DocType, &d.DocNumber,
			&d.IssuedDate, &d.ExpiryDate, &d.Notes, &d.CreatedBy,
			&d.CreatedAt, &d.UpdatedAt, &d.PlateNumber, &d.DaysToExpiry); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, nil
}

func (r *Repository) CreateVehicleDocument(ctx context.Context, doc *domain.VehicleDocument) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO vehicle_documents (vehicle_id, doc_type, doc_number, issued_date, expiry_date, notes, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at
	`, doc.VehicleID, doc.DocType, doc.DocNumber, doc.IssuedDate, doc.ExpiryDate, doc.Notes, doc.CreatedBy).Scan(&doc.ID, &doc.CreatedAt, &doc.UpdatedAt)
}

func (r *Repository) UpdateVehicleDocument(ctx context.Context, doc *domain.VehicleDocument) error {
	_, err := r.db.Exec(ctx, `
		UPDATE vehicle_documents SET doc_type=$1, doc_number=$2, issued_date=$3, expiry_date=$4, notes=$5, updated_at=NOW()
		WHERE id = $6
	`, doc.DocType, doc.DocNumber, doc.IssuedDate, doc.ExpiryDate, doc.Notes, doc.ID)
	return err
}

func (r *Repository) DeleteVehicleDocument(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM vehicle_documents WHERE id = $1`, id)
	return err
}

func (r *Repository) ListExpiringVehicleDocs(ctx context.Context, days int) ([]domain.VehicleDocument, error) {
	rows, err := r.db.Query(ctx, `
		SELECT vd.id, vd.vehicle_id, vd.doc_type, COALESCE(vd.doc_number,''),
		       vd.issued_date::text, vd.expiry_date::text, vd.notes, vd.created_by,
		       vd.created_at, vd.updated_at,
		       v.plate_number, (vd.expiry_date - CURRENT_DATE) as days_to_expiry
		FROM vehicle_documents vd
		JOIN vehicles v ON v.id = vd.vehicle_id
		WHERE vd.expiry_date <= CURRENT_DATE + $1
		ORDER BY vd.expiry_date ASC
	`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []domain.VehicleDocument
	for rows.Next() {
		var d domain.VehicleDocument
		if err := rows.Scan(&d.ID, &d.VehicleID, &d.DocType, &d.DocNumber,
			&d.IssuedDate, &d.ExpiryDate, &d.Notes, &d.CreatedBy,
			&d.CreatedAt, &d.UpdatedAt, &d.PlateNumber, &d.DaysToExpiry); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, nil
}

// ===== DRIVER DOCUMENTS =====

func (r *Repository) ListDriverDocuments(ctx context.Context, driverID uuid.UUID) ([]domain.DriverDocument, error) {
	rows, err := r.db.Query(ctx, `
		SELECT dd.id, dd.driver_id, dd.doc_type, COALESCE(dd.doc_number,''),
		       dd.issued_date::text, dd.expiry_date::text, dd.license_class, dd.notes, dd.created_by,
		       dd.created_at, dd.updated_at,
		       d.name, (dd.expiry_date - CURRENT_DATE) as days_to_expiry
		FROM driver_documents dd
		JOIN drivers d ON d.id = dd.driver_id
		WHERE dd.driver_id = $1
		ORDER BY dd.expiry_date ASC
	`, driverID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []domain.DriverDocument
	for rows.Next() {
		var d domain.DriverDocument
		if err := rows.Scan(&d.ID, &d.DriverID, &d.DocType, &d.DocNumber,
			&d.IssuedDate, &d.ExpiryDate, &d.LicenseClass, &d.Notes, &d.CreatedBy,
			&d.CreatedAt, &d.UpdatedAt, &d.DriverName, &d.DaysToExpiry); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, nil
}

func (r *Repository) CreateDriverDocument(ctx context.Context, doc *domain.DriverDocument) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO driver_documents (driver_id, doc_type, doc_number, issued_date, expiry_date, license_class, notes, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at, updated_at
	`, doc.DriverID, doc.DocType, doc.DocNumber, doc.IssuedDate, doc.ExpiryDate, doc.LicenseClass, doc.Notes, doc.CreatedBy).Scan(&doc.ID, &doc.CreatedAt, &doc.UpdatedAt)
}

func (r *Repository) UpdateDriverDocument(ctx context.Context, doc *domain.DriverDocument) error {
	_, err := r.db.Exec(ctx, `
		UPDATE driver_documents SET doc_type=$1, doc_number=$2, issued_date=$3, expiry_date=$4, license_class=$5, notes=$6, updated_at=NOW()
		WHERE id = $7
	`, doc.DocType, doc.DocNumber, doc.IssuedDate, doc.ExpiryDate, doc.LicenseClass, doc.Notes, doc.ID)
	return err
}

func (r *Repository) DeleteDriverDocument(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `DELETE FROM driver_documents WHERE id = $1`, id)
	return err
}

func (r *Repository) ListExpiringDriverDocs(ctx context.Context, days int) ([]domain.DriverDocument, error) {
	rows, err := r.db.Query(ctx, `
		SELECT dd.id, dd.driver_id, dd.doc_type, COALESCE(dd.doc_number,''),
		       dd.issued_date::text, dd.expiry_date::text, dd.license_class, dd.notes, dd.created_by,
		       dd.created_at, dd.updated_at,
		       d.name, (dd.expiry_date - CURRENT_DATE) as days_to_expiry
		FROM driver_documents dd
		JOIN drivers d ON d.id = dd.driver_id
		WHERE dd.expiry_date <= CURRENT_DATE + $1
		ORDER BY dd.expiry_date ASC
	`, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var docs []domain.DriverDocument
	for rows.Next() {
		var d domain.DriverDocument
		if err := rows.Scan(&d.ID, &d.DriverID, &d.DocType, &d.DocNumber,
			&d.IssuedDate, &d.ExpiryDate, &d.LicenseClass, &d.Notes, &d.CreatedBy,
			&d.CreatedAt, &d.UpdatedAt, &d.DriverName, &d.DaysToExpiry); err != nil {
			return nil, err
		}
		docs = append(docs, d)
	}
	return docs, nil
}

// ─── Dispatcher Control Tower ────────────────────────

func (r *Repository) GetControlTowerStats(ctx context.Context) (*domain.ControlTowerStats, error) {
	var s domain.ControlTowerStats
	err := r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE 1=1),
			COUNT(*) FILTER (WHERE t.status = 'in_transit'),
			COUNT(*) FILTER (WHERE t.status = 'completed'),
			COUNT(*) FILTER (WHERE t.status IN ('planned','assigned','ready')),
			COALESCE(SUM(t.total_stops), 0),
			COALESCE(SUM(t.total_weight_kg), 0),
			COALESCE(SUM(t.total_distance_km), 0)
		FROM trips t
		WHERE t.planned_date = CURRENT_DATE
	`).Scan(&s.TotalTripsToday, &s.InTransit, &s.Completed, &s.Planned,
		&s.TotalStopsToday, &s.TotalWeightKg, &s.TotalDistanceKm)
	if err != nil {
		return nil, fmt.Errorf("control_tower_stats: %w", err)
	}

	// Stop-level stats for today's trips
	r.db.QueryRow(ctx, `
		SELECT
			COUNT(*) FILTER (WHERE ts.status = 'delivered'),
			COUNT(*) FILTER (WHERE ts.status IN ('failed','skipped')),
			COUNT(*) FILTER (WHERE ts.status = 'pending')
		FROM trip_stops ts
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.planned_date = CURRENT_DATE
	`).Scan(&s.StopsDelivered, &s.StopsFailed, &s.StopsPending)

	// Vehicle activity
	r.db.QueryRow(ctx, `
		SELECT
			COUNT(DISTINCT t.vehicle_id) FILTER (WHERE t.status = 'in_transit'),
			COUNT(DISTINCT t.vehicle_id) FILTER (WHERE t.status IN ('planned','assigned','ready'))
		FROM trips t
		WHERE t.planned_date = CURRENT_DATE AND t.vehicle_id IS NOT NULL
	`).Scan(&s.ActiveVehicles, &s.IdleVehicles)

	// On-time rate
	total := s.StopsDelivered + s.StopsFailed
	if total > 0 {
		s.OnTimeRate = float64(s.StopsDelivered) / float64(total) * 100
	}

	return &s, nil
}

func (r *Repository) ListExceptions(ctx context.Context) ([]domain.TripException, error) {
	rows, err := r.db.Query(ctx, `
		SELECT t.id, t.trip_number, COALESCE(v.plate_number,''), COALESCE(d.full_name,''),
		       ts.id, ts.status::text, COALESCE(ts.customer_name,''),
		       ts.estimated_arrival, ts.actual_arrival,
		       t.status::text AS trip_status, t.started_at
		FROM trips t
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN drivers d ON d.id = t.driver_id
		LEFT JOIN trip_stops ts ON ts.trip_id = t.id
		WHERE t.planned_date = CURRENT_DATE
		  AND (
		    ts.status IN ('failed','skipped')
		    OR (t.status = 'in_transit' AND ts.status = 'pending'
		        AND ts.estimated_arrival IS NOT NULL AND ts.estimated_arrival < now())
		    OR (t.status IN ('assigned','ready') AND ts.stop_order = 1
		        AND ts.estimated_arrival IS NOT NULL
		        AND ts.estimated_arrival < now() - interval '2 hours')
		  )
		ORDER BY
		  CASE WHEN ts.status IN ('failed','skipped') THEN 0
		       WHEN t.status IN ('assigned','ready') THEN 1
		       ELSE 2 END,
		  ts.estimated_arrival ASC NULLS LAST
	`)
	if err != nil {
		return nil, fmt.Errorf("list_exceptions: %w", err)
	}
	defer rows.Close()

	var exceptions []domain.TripException
	for rows.Next() {
		var tripID uuid.UUID
		var tripNumber, plate, driverName, stopStatus, customerName, tripStatus string
		var stopID *uuid.UUID
		var estimatedArrival, actualArrival, startedAt *time.Time

		if err := rows.Scan(&tripID, &tripNumber, &plate, &driverName,
			&stopID, &stopStatus, &customerName,
			&estimatedArrival, &actualArrival, &tripStatus, &startedAt); err != nil {
			return nil, fmt.Errorf("scan_exception: %w", err)
		}

		exc := domain.TripException{
			TripID:       tripID,
			TripNumber:   tripNumber,
			VehiclePlate: plate,
			DriverName:   driverName,
			StopID:       stopID,
			CustomerName: customerName,
			CreatedAt:    time.Now().Format(time.RFC3339),
		}
		exc.ID = uuid.New()

		switch {
		case stopStatus == "failed" || stopStatus == "skipped":
			exc.Type = "failed_stop"
			exc.Priority = "P0"
			exc.Title = "Giao thất bại: " + customerName
			exc.Description = fmt.Sprintf("Chuyến %s — %s (%s) — điểm %s bị %s",
				tripNumber, plate, driverName, customerName, stopStatus)
		case tripStatus == "assigned" || tripStatus == "ready":
			exc.Type = "idle_vehicle"
			exc.Priority = "P1"
			exc.Title = "Xe chưa xuất bến: " + plate
			exc.Description = fmt.Sprintf("Chuyến %s — %s (%s) — chưa bắt đầu sau 2h",
				tripNumber, plate, driverName)
		default:
			exc.Type = "late_eta"
			exc.Priority = "P1"
			exc.Title = "Trễ ETA: " + customerName
			exc.Description = fmt.Sprintf("Chuyến %s — %s (%s) — điểm %s trễ ETA",
				tripNumber, plate, driverName, customerName)
		}

		exceptions = append(exceptions, exc)
	}
	if exceptions == nil {
		exceptions = []domain.TripException{}
	}
	return exceptions, nil
}

func (r *Repository) MoveStop(ctx context.Context, fromTripID, stopID, toTripID uuid.UUID) error {
	// Verify stop belongs to source trip and is pending
	var currentStatus string
	err := r.db.QueryRow(ctx, `
		SELECT status::text FROM trip_stops WHERE id = $1 AND trip_id = $2
	`, stopID, fromTripID).Scan(&currentStatus)
	if err != nil {
		return fmt.Errorf("stop not found in source trip: %w", err)
	}
	if currentStatus != "pending" {
		return fmt.Errorf("can only move pending stops (current: %s)", currentStatus)
	}

	// Get max stop_order in target trip
	var maxOrder int
	r.db.QueryRow(ctx, `SELECT COALESCE(MAX(stop_order), 0) FROM trip_stops WHERE trip_id = $1`, toTripID).Scan(&maxOrder)

	// Move the stop
	_, err = r.db.Exec(ctx, `
		UPDATE trip_stops SET trip_id = $1, stop_order = $2 WHERE id = $3
	`, toTripID, maxOrder+1, stopID)
	if err != nil {
		return fmt.Errorf("move stop: %w", err)
	}

	// Recalculate total_stops for both trips
	r.db.Exec(ctx, `UPDATE trips SET total_stops = (SELECT COUNT(*) FROM trip_stops WHERE trip_id = trips.id) WHERE id IN ($1, $2)`, fromTripID, toTripID)
	return nil
}

func (r *Repository) CancelTrip(ctx context.Context, tripID uuid.UUID, reason string) error {
	// Only cancel planned/assigned/ready trips
	var currentStatus string
	err := r.db.QueryRow(ctx, `SELECT status::text FROM trips WHERE id = $1`, tripID).Scan(&currentStatus)
	if err != nil {
		return fmt.Errorf("trip not found: %w", err)
	}
	if currentStatus != "planned" && currentStatus != "assigned" && currentStatus != "ready" {
		return fmt.Errorf("cannot cancel trip in status %s", currentStatus)
	}

	_, err = r.db.Exec(ctx, `UPDATE trips SET status = 'cancelled' WHERE id = $1`, tripID)
	if err != nil {
		return fmt.Errorf("cancel trip: %w", err)
	}

	// Cancel all pending stops
	_, err = r.db.Exec(ctx, `UPDATE trip_stops SET status = 'skipped' WHERE trip_id = $1 AND status = 'pending'`, tripID)
	return err
}
