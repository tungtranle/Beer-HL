package wms

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"
)

type Repository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRepository(db *pgxpool.Pool, log logger.Logger) *Repository {
	return &Repository{db: db, log: log}
}

// ── Stock ───────────────────────────────────────────

func (r *Repository) GetStock(ctx context.Context, warehouseID, productID *uuid.UUID, lotID *uuid.UUID) ([]domain.StockQuant, error) {
	query := `SELECT sq.id, sq.product_id, p.name, p.sku,
		sq.lot_id, l.batch_number, l.expiry_date::text,
		sq.warehouse_id, sq.location_id,
		sq.quantity, sq.reserved_qty, (sq.quantity - sq.reserved_qty) AS available,
		sq.created_at, sq.updated_at
		FROM stock_quants sq
		JOIN products p ON p.id = sq.product_id
		JOIN lots l ON l.id = sq.lot_id
		WHERE 1=1`

	args := []interface{}{}
	argIdx := 1

	if warehouseID != nil {
		query += fmt.Sprintf(" AND sq.warehouse_id = $%d", argIdx)
		args = append(args, *warehouseID)
		argIdx++
	}
	if productID != nil {
		query += fmt.Sprintf(" AND sq.product_id = $%d", argIdx)
		args = append(args, *productID)
		argIdx++
	}
	if lotID != nil {
		query += fmt.Sprintf(" AND sq.lot_id = $%d", argIdx)
		args = append(args, *lotID)
		argIdx++
	}

	query += " ORDER BY l.expiry_date ASC, sq.quantity DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.StockQuant
	for rows.Next() {
		var sq domain.StockQuant
		if err := rows.Scan(
			&sq.ID, &sq.ProductID, &sq.ProductName, &sq.ProductSKU,
			&sq.LotID, &sq.BatchNumber, &sq.ExpiryDate,
			&sq.WarehouseID, &sq.LocationID,
			&sq.Quantity, &sq.ReservedQty, &sq.Available,
			&sq.CreatedAt, &sq.UpdatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, sq)
	}
	return results, nil
}

// ── Lots ────────────────────────────────────────────

func (r *Repository) GetOrCreateLot(ctx context.Context, productID uuid.UUID, batchNumber string, productionDate, expiryDate string) (uuid.UUID, error) {
	var lotID uuid.UUID
	err := r.db.QueryRow(ctx,
		`SELECT id FROM lots WHERE product_id = $1 AND batch_number = $2`,
		productID, batchNumber,
	).Scan(&lotID)
	if err == nil {
		return lotID, nil
	}

	err = r.db.QueryRow(ctx,
		`INSERT INTO lots (product_id, batch_number, production_date, expiry_date)
		 VALUES ($1, $2, $3::date, $4::date)
		 ON CONFLICT (product_id, batch_number) DO UPDATE SET product_id = lots.product_id
		 RETURNING id`,
		productID, batchNumber, productionDate, expiryDate,
	).Scan(&lotID)
	return lotID, err
}

// ── Inbound (Stock Move) ────────────────────────────

func (r *Repository) CreateStockMove(ctx context.Context, move domain.StockMove) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx,
		`INSERT INTO stock_moves (move_number, move_type, warehouse_id, reference_type, reference_id, items, total_items, notes, created_by)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		 RETURNING id`,
		move.MoveNumber, move.MoveType, move.WarehouseID,
		move.ReferenceType, move.ReferenceID,
		move.Items, move.TotalItems, move.Notes, move.CreatedBy,
	).Scan(&id)
	return id, err
}

func (r *Repository) UpsertStockQuant(ctx context.Context, productID, lotID, warehouseID, locationID uuid.UUID, qty int) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO stock_quants (product_id, lot_id, warehouse_id, location_id, quantity)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (product_id, lot_id, location_id)
		 DO UPDATE SET quantity = stock_quants.quantity + $5, updated_at = now()`,
		productID, lotID, warehouseID, locationID, qty,
	)
	return err
}

func (r *Repository) GetStockMovesByWarehouse(ctx context.Context, warehouseID uuid.UUID, moveType string) ([]domain.StockMove, error) {
	query := `SELECT id, move_number, move_type, warehouse_id, reference_type, reference_id, items, total_items, notes, created_by, created_at
		FROM stock_moves WHERE warehouse_id = $1`
	args := []interface{}{warehouseID}

	if moveType != "" {
		query += " AND move_type = $2"
		args = append(args, moveType)
	}
	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var moves []domain.StockMove
	for rows.Next() {
		var m domain.StockMove
		if err := rows.Scan(
			&m.ID, &m.MoveNumber, &m.MoveType, &m.WarehouseID,
			&m.ReferenceType, &m.ReferenceID, &m.Items, &m.TotalItems,
			&m.Notes, &m.CreatedBy, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		moves = append(moves, m)
	}
	return moves, nil
}

// ── Picking ─────────────────────────────────────────

// NextPickNumber generates pick number like PICK-20260321-001
func (r *Repository) NextPickNumber(ctx context.Context, dateStr string) (string, error) {
	var seq int
	err := r.db.QueryRow(ctx, `
		SELECT COALESCE(MAX(CAST(SUBSTRING(pick_number FROM '.{3}$') AS INTEGER)), 0) + 1
		FROM picking_orders WHERE pick_number LIKE 'PICK-' || $1 || '-%'
	`, dateStr).Scan(&seq)
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("PICK-%s-%03d", dateStr, seq), nil
}

// ShipmentItem represents one item from a shipment's items JSONB.
type ShipmentItem struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

// GetShipmentWithItems returns shipment data needed for picking order creation.
func (r *Repository) GetShipmentWithItems(ctx context.Context, shipmentID uuid.UUID) (warehouseID, orderID uuid.UUID, items []ShipmentItem, err error) {
	var itemsJSON json.RawMessage
	err = r.db.QueryRow(ctx,
		`SELECT warehouse_id, order_id, items FROM shipments WHERE id = $1`, shipmentID,
	).Scan(&warehouseID, &orderID, &itemsJSON)
	if err != nil {
		return
	}
	err = json.Unmarshal(itemsJSON, &items)
	return
}

// UpdateShipmentStatus updates shipment status (non-transactional).
func (r *Repository) UpdateShipmentStatus(ctx context.Context, shipmentID uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, `UPDATE shipments SET status = $2, updated_at = now() WHERE id = $1`, shipmentID, status)
	return err
}

// UpdateOrderStatus updates order status (non-transactional).
func (r *Repository) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, `UPDATE sales_orders SET status = $2, updated_at = now() WHERE id = $1`, orderID, status)
	return err
}

func (r *Repository) CreatePickingOrder(ctx context.Context, po domain.PickingOrder) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx,
		`INSERT INTO picking_orders (pick_number, shipment_id, warehouse_id, status, items, assigned_to)
		 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		po.PickNumber, po.ShipmentID, po.WarehouseID, po.Status, po.Items, po.AssignedTo,
	).Scan(&id)
	return id, err
}

func (r *Repository) GetAllPickingOrders(ctx context.Context, status string) ([]domain.PickingOrder, error) {
	query := `SELECT id, pick_number, shipment_id, warehouse_id, status, items, assigned_to, started_at, completed_at, created_at, updated_at
		FROM picking_orders WHERE 1=1`
	args := []interface{}{}

	if status != "" {
		query += " AND status = $1"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []domain.PickingOrder
	for rows.Next() {
		var po domain.PickingOrder
		if err := rows.Scan(
			&po.ID, &po.PickNumber, &po.ShipmentID, &po.WarehouseID,
			&po.Status, &po.Items, &po.AssignedTo,
			&po.StartedAt, &po.CompletedAt, &po.CreatedAt, &po.UpdatedAt,
		); err != nil {
			return nil, err
		}
		orders = append(orders, po)
	}
	return orders, nil
}

func (r *Repository) GetPickingOrders(ctx context.Context, warehouseID uuid.UUID, status string) ([]domain.PickingOrder, error) {
	query := `SELECT id, pick_number, shipment_id, warehouse_id, status, items, assigned_to, started_at, completed_at, created_at, updated_at
		FROM picking_orders WHERE warehouse_id = $1`
	args := []interface{}{warehouseID}

	if status != "" {
		query += " AND status = $2"
		args = append(args, status)
	}
	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []domain.PickingOrder
	for rows.Next() {
		var po domain.PickingOrder
		if err := rows.Scan(
			&po.ID, &po.PickNumber, &po.ShipmentID, &po.WarehouseID,
			&po.Status, &po.Items, &po.AssignedTo,
			&po.StartedAt, &po.CompletedAt, &po.CreatedAt, &po.UpdatedAt,
		); err != nil {
			return nil, err
		}
		orders = append(orders, po)
	}
	return orders, nil
}

func (r *Repository) GetPickingOrderByID(ctx context.Context, id uuid.UUID) (*domain.PickingOrder, error) {
	var po domain.PickingOrder
	err := r.db.QueryRow(ctx,
		`SELECT id, pick_number, shipment_id, warehouse_id, status, items, assigned_to, started_at, completed_at, created_at, updated_at
		 FROM picking_orders WHERE id = $1`, id,
	).Scan(
		&po.ID, &po.PickNumber, &po.ShipmentID, &po.WarehouseID,
		&po.Status, &po.Items, &po.AssignedTo,
		&po.StartedAt, &po.CompletedAt, &po.CreatedAt, &po.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &po, nil
}

func (r *Repository) UpdatePickingOrderStatus(ctx context.Context, id uuid.UUID, status string, items json.RawMessage) error {
	query := `UPDATE picking_orders SET status = $2, items = $3, updated_at = now()`
	if status == "in_progress" {
		query += ", started_at = now()"
	} else if status == "completed" {
		query += ", completed_at = now()"
	}
	query += " WHERE id = $1"
	_, err := r.db.Exec(ctx, query, id, status, items)
	return err
}

// ── FEFO/FIFO suggestion ────────────────────────────

func (r *Repository) SuggestPickingLots(ctx context.Context, warehouseID, productID uuid.UUID, qty int) ([]domain.StockQuant, error) {
	rows, err := r.db.Query(ctx,
		`SELECT sq.id, sq.product_id, p.name, p.sku,
			sq.lot_id, l.batch_number, l.expiry_date::text,
			sq.warehouse_id, sq.location_id,
			sq.quantity, sq.reserved_qty, (sq.quantity - sq.reserved_qty) AS available,
			sq.created_at, sq.updated_at
		FROM stock_quants sq
		JOIN products p ON p.id = sq.product_id
		JOIN lots l ON l.id = sq.lot_id
		WHERE sq.warehouse_id = $1 AND sq.product_id = $2 AND (sq.quantity - sq.reserved_qty) > 0
		ORDER BY l.expiry_date ASC, sq.created_at ASC`,
		warehouseID, productID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var suggestions []domain.StockQuant
	remaining := qty
	for rows.Next() && remaining > 0 {
		var sq domain.StockQuant
		if err := rows.Scan(
			&sq.ID, &sq.ProductID, &sq.ProductName, &sq.ProductSKU,
			&sq.LotID, &sq.BatchNumber, &sq.ExpiryDate,
			&sq.WarehouseID, &sq.LocationID,
			&sq.Quantity, &sq.ReservedQty, &sq.Available,
			&sq.CreatedAt, &sq.UpdatedAt,
		); err != nil {
			return nil, err
		}
		suggestions = append(suggestions, sq)
		remaining -= sq.Available
	}
	return suggestions, nil
}

// ── Gate Check ──────────────────────────────────────

func (r *Repository) CreateGateCheck(ctx context.Context, gc domain.GateCheck) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx,
		`INSERT INTO gate_checks (trip_id, shipment_id, expected_items, scanned_items, result, discrepancy_details, checked_by, exit_time)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
		gc.TripID, gc.ShipmentID, gc.ExpectedItems, gc.ScannedItems,
		gc.Result, gc.DiscrepancyDetails, gc.CheckedBy, gc.ExitTime,
	).Scan(&id)
	return id, err
}

func (r *Repository) GetGateChecksByTrip(ctx context.Context, tripID uuid.UUID) ([]domain.GateCheck, error) {
	rows, err := r.db.Query(ctx,
		`SELECT id, trip_id, shipment_id, expected_items, scanned_items, result, discrepancy_details, checked_by, exit_time, created_at
		 FROM gate_checks WHERE trip_id = $1 ORDER BY created_at`, tripID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var checks []domain.GateCheck
	for rows.Next() {
		var gc domain.GateCheck
		if err := rows.Scan(
			&gc.ID, &gc.TripID, &gc.ShipmentID,
			&gc.ExpectedItems, &gc.ScannedItems,
			&gc.Result, &gc.DiscrepancyDetails,
			&gc.CheckedBy, &gc.ExitTime, &gc.CreatedAt,
		); err != nil {
			return nil, err
		}
		checks = append(checks, gc)
	}
	return checks, nil
}

// ── Reserve / Release stock ─────────────────────────

func (r *Repository) ReserveStock(ctx context.Context, productID, lotID, locationID uuid.UUID, qty int) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE stock_quants SET reserved_qty = reserved_qty + $4, updated_at = now()
		 WHERE product_id = $1 AND lot_id = $2 AND location_id = $3
		 AND (quantity - reserved_qty) >= $4`,
		productID, lotID, locationID, qty,
	)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("insufficient stock for product %s, lot %s", productID, lotID)
	}
	return nil
}

func (r *Repository) DeductStock(ctx context.Context, productID, lotID, locationID uuid.UUID, qty int) error {
	_, err := r.db.Exec(ctx,
		`UPDATE stock_quants SET quantity = quantity - $4, reserved_qty = reserved_qty - $4, updated_at = now()
		 WHERE product_id = $1 AND lot_id = $2 AND location_id = $3`,
		productID, lotID, locationID, qty,
	)
	return err
}

// ── Expiry Alerts ───────────────────────────────────

func (r *Repository) GetExpiringLots(ctx context.Context, warehouseID *uuid.UUID) ([]domain.StockQuant, error) {
	query := `SELECT sq.id, sq.product_id, p.name, p.sku,
		sq.lot_id, l.batch_number, l.expiry_date::text,
		sq.warehouse_id, sq.location_id,
		sq.quantity, sq.reserved_qty, (sq.quantity - sq.reserved_qty) AS available,
		sq.created_at, sq.updated_at
	FROM stock_quants sq
	JOIN products p ON p.id = sq.product_id
	JOIN lots l ON l.id = sq.lot_id
	WHERE sq.quantity > 0
	  AND l.expiry_date <= CURRENT_DATE + (
		COALESCE(p.shelf_life_days, 365) * COALESCE(p.expiry_threshold_pct, 33) / 100.0
	  )::int`

	args := []interface{}{}
	if warehouseID != nil {
		query += " AND sq.warehouse_id = $1"
		args = append(args, *warehouseID)
	}
	query += " ORDER BY l.expiry_date ASC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.StockQuant
	for rows.Next() {
		var sq domain.StockQuant
		if err := rows.Scan(
			&sq.ID, &sq.ProductID, &sq.ProductName, &sq.ProductSKU,
			&sq.LotID, &sq.BatchNumber, &sq.ExpiryDate,
			&sq.WarehouseID, &sq.LocationID,
			&sq.Quantity, &sq.ReservedQty, &sq.Available,
			&sq.CreatedAt, &sq.UpdatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, sq)
	}
	return results, nil
}

// ── Location Hierarchy ──────────────────────────────

type WarehouseLocation struct {
	ID           uuid.UUID `json:"id"`
	Code         string    `json:"code"`
	Name         string    `json:"name"`
	Path         *string   `json:"path,omitempty"`
	LocationType string    `json:"location_type"`
	MaxCapacity  *int      `json:"max_capacity,omitempty"`
	IsActive     bool      `json:"is_active"`
}

func (r *Repository) GetLocationsByParent(ctx context.Context, parentPath string) ([]WarehouseLocation, error) {
	query := `SELECT id, code, name, path::text, location_type, max_capacity, is_active
		FROM warehouses WHERE path <@ $1::ltree AND path != $1::ltree
		ORDER BY path`

	rows, err := r.db.Query(ctx, query, parentPath)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var locs []WarehouseLocation
	for rows.Next() {
		var loc WarehouseLocation
		if err := rows.Scan(&loc.ID, &loc.Code, &loc.Name, &loc.Path, &loc.LocationType, &loc.MaxCapacity, &loc.IsActive); err != nil {
			return nil, err
		}
		locs = append(locs, loc)
	}
	return locs, nil
}

func (r *Repository) CreateLocation(ctx context.Context, loc WarehouseLocation) (uuid.UUID, error) {
	var id uuid.UUID
	err := r.db.QueryRow(ctx,
		`INSERT INTO warehouses (code, name, path, location_type, max_capacity, is_active)
		 VALUES ($1, $2, $3::ltree, $4, $5, $6) RETURNING id`,
		loc.Code, loc.Name, loc.Path, loc.LocationType, loc.MaxCapacity, loc.IsActive,
	).Scan(&id)
	return id, err
}

// ── Return Inbound (Task 3.12) ──────────────────────

// GetPendingReturns gets return_collections not yet processed into stock (good condition only).
func (r *Repository) GetPendingReturns(ctx context.Context, warehouseID uuid.UUID) ([]PendingReturn, error) {
	rows, err := r.db.Query(ctx, `
		SELECT rc.id, rc.trip_stop_id, rc.customer_id, rc.asset_type, rc.quantity, rc.condition::text,
			ts.trip_id, t.warehouse_id
		FROM return_collections rc
		JOIN trip_stops ts ON ts.id = rc.trip_stop_id
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1
		  AND rc.condition = 'good'
		  AND NOT EXISTS (
			SELECT 1 FROM stock_moves sm
			WHERE sm.reference_type = 'return_collection' AND sm.reference_id = rc.id
		  )
		ORDER BY rc.created_at
	`, warehouseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []PendingReturn
	for rows.Next() {
		var pr PendingReturn
		if err := rows.Scan(&pr.ID, &pr.TripStopID, &pr.CustomerID, &pr.AssetType, &pr.Quantity, &pr.Condition,
			&pr.TripID, &pr.WarehouseID); err != nil {
			return nil, err
		}
		results = append(results, pr)
	}
	return results, nil
}

// GetAssetPrice reads the configured price for an asset type from system_configs.
func (r *Repository) GetAssetPrice(ctx context.Context, assetType string) (float64, error) {
	var price float64
	err := r.db.QueryRow(ctx,
		`SELECT COALESCE(config_value::numeric, 0) FROM system_configs WHERE config_key = $1`,
		"asset_price_"+assetType,
	).Scan(&price)
	if err != nil {
		// default prices if not configured
		defaults := map[string]float64{"bottle": 1500, "crate": 45000, "keg": 700000, "pallet": 200000}
		if p, ok := defaults[assetType]; ok {
			return p, nil
		}
		return 0, err
	}
	return price, nil
}

// GetLostReturnsByTrip gets return_collections with condition='lost' for a trip.
func (r *Repository) GetLostReturnsByTrip(ctx context.Context, tripID uuid.UUID) ([]PendingReturn, error) {
	rows, err := r.db.Query(ctx, `
		SELECT rc.id, rc.trip_stop_id, rc.customer_id, rc.asset_type, rc.quantity, rc.condition::text,
			ts.trip_id, t.warehouse_id
		FROM return_collections rc
		JOIN trip_stops ts ON ts.id = rc.trip_stop_id
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.id = $1 AND rc.condition = 'lost'
		ORDER BY rc.created_at
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []PendingReturn
	for rows.Next() {
		var pr PendingReturn
		if err := rows.Scan(&pr.ID, &pr.TripStopID, &pr.CustomerID, &pr.AssetType, &pr.Quantity, &pr.Condition,
			&pr.TripID, &pr.WarehouseID); err != nil {
			return nil, err
		}
		results = append(results, pr)
	}
	return results, nil
}

// GetAllLostReturns gets return_collections with condition='lost' for a warehouse.
func (r *Repository) GetAllLostReturns(ctx context.Context, warehouseID uuid.UUID) ([]PendingReturn, error) {
	rows, err := r.db.Query(ctx, `
		SELECT rc.id, rc.trip_stop_id, rc.customer_id, rc.asset_type, rc.quantity, rc.condition::text,
			ts.trip_id, t.warehouse_id
		FROM return_collections rc
		JOIN trip_stops ts ON ts.id = rc.trip_stop_id
		JOIN trips t ON t.id = ts.trip_id
		WHERE t.warehouse_id = $1 AND rc.condition = 'lost'
		ORDER BY rc.created_at DESC
		LIMIT 200
	`, warehouseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []PendingReturn
	for rows.Next() {
		var pr PendingReturn
		if err := rows.Scan(&pr.ID, &pr.TripStopID, &pr.CustomerID, &pr.AssetType, &pr.Quantity, &pr.Condition,
			&pr.TripID, &pr.WarehouseID); err != nil {
			return nil, err
		}
		results = append(results, pr)
	}
	return results, nil
}
