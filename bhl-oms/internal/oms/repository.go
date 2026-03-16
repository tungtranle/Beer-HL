package oms

import (
	"context"
	"fmt"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

// ===== PRODUCTS =====
func (r *Repository) ListProducts(ctx context.Context) ([]domain.Product, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, sku, name, unit, weight_kg, volume_m3, price, deposit_price, category, is_active
		FROM products WHERE is_active = true ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var products []domain.Product
	for rows.Next() {
		var p domain.Product
		if err := rows.Scan(&p.ID, &p.SKU, &p.Name, &p.Unit, &p.WeightKg, &p.VolumeM3, &p.Price, &p.DepositPrice, &p.Category, &p.IsActive); err != nil {
			return nil, err
		}
		products = append(products, p)
	}
	return products, nil
}

func (r *Repository) GetProduct(ctx context.Context, id uuid.UUID) (*domain.Product, error) {
	var p domain.Product
	err := r.db.QueryRow(ctx, `
		SELECT id, sku, name, unit, weight_kg, volume_m3, price, deposit_price, category, is_active
		FROM products WHERE id = $1
	`, id).Scan(&p.ID, &p.SKU, &p.Name, &p.Unit, &p.WeightKg, &p.VolumeM3, &p.Price, &p.DepositPrice, &p.Category, &p.IsActive)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

func (r *Repository) CreateProduct(ctx context.Context, p *domain.Product) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO products (sku, name, unit, weight_kg, volume_m3, price, deposit_price, category, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, p.SKU, p.Name, p.Unit, p.WeightKg, p.VolumeM3, p.Price, p.DepositPrice, p.Category, p.IsActive).Scan(&p.ID)
}

func (r *Repository) UpdateProduct(ctx context.Context, p *domain.Product) error {
	_, err := r.db.Exec(ctx, `
		UPDATE products SET sku=$2, name=$3, unit=$4, weight_kg=$5, volume_m3=$6, 
		       price=$7, deposit_price=$8, category=$9, is_active=$10, updated_at=now()
		WHERE id = $1
	`, p.ID, p.SKU, p.Name, p.Unit, p.WeightKg, p.VolumeM3, p.Price, p.DepositPrice, p.Category, p.IsActive)
	return err
}

func (r *Repository) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE products SET is_active = false, updated_at = now() WHERE id = $1`, id)
	return err
}

// ===== CUSTOMERS =====
func (r *Repository) ListCustomers(ctx context.Context) ([]domain.Customer, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, code, name, address, phone, latitude, longitude, province, district, route_code, is_active
		FROM customers WHERE is_active = true ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var customers []domain.Customer
	for rows.Next() {
		var c domain.Customer
		if err := rows.Scan(&c.ID, &c.Code, &c.Name, &c.Address, &c.Phone, &c.Latitude, &c.Longitude, &c.Province, &c.District, &c.RouteCode, &c.IsActive); err != nil {
			return nil, err
		}
		customers = append(customers, c)
	}
	return customers, nil
}

func (r *Repository) GetCustomer(ctx context.Context, id uuid.UUID) (*domain.Customer, error) {
	var c domain.Customer
	err := r.db.QueryRow(ctx, `
		SELECT id, code, name, address, phone, latitude, longitude, province, district, route_code, is_active
		FROM customers WHERE id = $1
	`, id).Scan(&c.ID, &c.Code, &c.Name, &c.Address, &c.Phone, &c.Latitude, &c.Longitude, &c.Province, &c.District, &c.RouteCode, &c.IsActive)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (r *Repository) CreateCustomer(ctx context.Context, c *domain.Customer) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO customers (code, name, address, phone, latitude, longitude, province, district, route_code, is_active)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`, c.Code, c.Name, c.Address, c.Phone, c.Latitude, c.Longitude, c.Province, c.District, c.RouteCode, c.IsActive).Scan(&c.ID)
}

func (r *Repository) UpdateCustomer(ctx context.Context, c *domain.Customer) error {
	_, err := r.db.Exec(ctx, `
		UPDATE customers SET code=$2, name=$3, address=$4, phone=$5, latitude=$6, longitude=$7,
		       province=$8, district=$9, route_code=$10, is_active=$11, updated_at=now()
		WHERE id = $1
	`, c.ID, c.Code, c.Name, c.Address, c.Phone, c.Latitude, c.Longitude, c.Province, c.District, c.RouteCode, c.IsActive)
	return err
}

func (r *Repository) DeleteCustomer(ctx context.Context, id uuid.UUID) error {
	_, err := r.db.Exec(ctx, `UPDATE customers SET is_active = false, updated_at = now() WHERE id = $1`, id)
	return err
}

func (r *Repository) GetCustomerWithCredit(ctx context.Context, customerID uuid.UUID) (*domain.CustomerWithCredit, error) {
	var c domain.CustomerWithCredit
	err := r.db.QueryRow(ctx, `
		SELECT c.id, c.code, c.name, c.address, c.phone, c.latitude, c.longitude,
		       c.province, c.district, c.route_code, c.is_active,
		       COALESCE(cl.credit_limit, 0) as credit_limit,
		       COALESCE((SELECT SUM(CASE WHEN rl.ledger_type = 'debit' THEN rl.amount ELSE -rl.amount END) 
		                 FROM receivable_ledger rl WHERE rl.customer_id = c.id), 0) as current_balance
		FROM customers c
		LEFT JOIN credit_limits cl ON cl.customer_id = c.id 
		     AND cl.effective_from <= CURRENT_DATE 
		     AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
		WHERE c.id = $1
	`, customerID).Scan(
		&c.ID, &c.Code, &c.Name, &c.Address, &c.Phone, &c.Latitude, &c.Longitude,
		&c.Province, &c.District, &c.RouteCode, &c.IsActive,
		&c.CreditLimit, &c.CurrentBalance,
	)
	if err != nil {
		return nil, err
	}
	c.AvailableLimit = c.CreditLimit - c.CurrentBalance
	return &c, nil
}

// ===== ATP =====
func (r *Repository) GetATP(ctx context.Context, productID, warehouseID uuid.UUID) (*domain.ATPResult, error) {
	var result domain.ATPResult
	err := r.db.QueryRow(ctx, `
		SELECT sq.product_id, p.name, sq.warehouse_id,
		       SUM(sq.quantity) as available,
		       0 as committed,
		       SUM(sq.reserved_qty) as reserved,
		       SUM(sq.quantity - sq.reserved_qty) as atp
		FROM stock_quants sq
		JOIN products p ON p.id = sq.product_id
		WHERE sq.product_id = $1 AND sq.warehouse_id = $2
		GROUP BY sq.product_id, p.name, sq.warehouse_id
	`, productID, warehouseID).Scan(
		&result.ProductID, &result.ProductName, &result.WarehouseID,
		&result.Available, &result.Committed, &result.Reserved, &result.ATP,
	)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

func (r *Repository) GetATPBatch(ctx context.Context, warehouseID uuid.UUID, productIDs []uuid.UUID) ([]domain.ATPResult, error) {
	rows, err := r.db.Query(ctx, `
		SELECT sq.product_id, p.name, sq.warehouse_id,
		       SUM(sq.quantity) as available,
		       0 as committed,
		       SUM(sq.reserved_qty) as reserved,
		       SUM(sq.quantity - sq.reserved_qty) as atp
		FROM stock_quants sq
		JOIN products p ON p.id = sq.product_id
		WHERE sq.warehouse_id = $1 AND sq.product_id = ANY($2)
		GROUP BY sq.product_id, p.name, sq.warehouse_id
	`, warehouseID, productIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.ATPResult
	for rows.Next() {
		var r domain.ATPResult
		if err := rows.Scan(&r.ProductID, &r.ProductName, &r.WarehouseID, &r.Available, &r.Committed, &r.Reserved, &r.ATP); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, nil
}

// ReserveStock reserves stock for an order within a transaction
func (r *Repository) ReserveStock(ctx context.Context, tx pgx.Tx, productID, warehouseID uuid.UUID, qty int) error {
	result, err := tx.Exec(ctx, `
		UPDATE stock_quants 
		SET reserved_qty = reserved_qty + $3, updated_at = now()
		WHERE product_id = $1 AND warehouse_id = $2 
		AND (quantity - reserved_qty) >= $3
	`, productID, warehouseID, qty)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("insufficient stock for product %s", productID)
	}
	return nil
}

// ReleaseStock releases reserved stock (e.g., on order cancel)
func (r *Repository) ReleaseStock(ctx context.Context, tx pgx.Tx, productID, warehouseID uuid.UUID, qty int) error {
	_, err := tx.Exec(ctx, `
		UPDATE stock_quants 
		SET reserved_qty = GREATEST(reserved_qty - $3, 0), updated_at = now()
		WHERE product_id = $1 AND warehouse_id = $2
	`, productID, warehouseID, qty)
	return err
}

// ===== ORDERS =====
func (r *Repository) CreateOrder(ctx context.Context, tx pgx.Tx, order *domain.SalesOrder) error {
	return tx.QueryRow(ctx, `
		INSERT INTO sales_orders (order_number, customer_id, warehouse_id, status, cutoff_group, delivery_date, 
		    delivery_address, time_window, total_amount, deposit_amount, total_weight_kg, total_volume_m3,
		    atp_status, credit_status, notes, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
		RETURNING id, created_at
	`, order.OrderNumber, order.CustomerID, order.WarehouseID, order.Status, order.CutoffGroup,
		order.DeliveryDate, order.DeliveryAddress, order.TimeWindow, order.TotalAmount, order.DepositAmount,
		order.TotalWeightKg, order.TotalVolumeM3, order.ATPStatus, order.CreditStatus,
		order.Notes, order.CreatedBy,
	).Scan(&order.ID, &order.CreatedAt)
}

func (r *Repository) CreateOrderItem(ctx context.Context, tx pgx.Tx, item *domain.OrderItem) error {
	return tx.QueryRow(ctx, `
		INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount, deposit_amount)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, item.OrderID, item.ProductID, item.Quantity, item.UnitPrice, item.Amount, item.DepositAmount,
	).Scan(&item.ID)
}

func (r *Repository) ListOrders(ctx context.Context, warehouseID *uuid.UUID, status, deliveryDate, cutoffGroup string, limit, offset int) ([]domain.SalesOrder, int64, error) {
	query := `
		SELECT so.id, so.order_number, so.customer_id, c.name, so.warehouse_id, so.status::text,
		       COALESCE(so.cutoff_group, '')::text, so.delivery_date::text, so.total_amount, so.deposit_amount, so.total_weight_kg,
		       so.atp_status, so.credit_status, so.created_at
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		WHERE 1=1
	`
	countQuery := `SELECT COUNT(*) FROM sales_orders so WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if warehouseID != nil {
		query += fmt.Sprintf(" AND so.warehouse_id = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND so.warehouse_id = $%d", argIdx)
		args = append(args, *warehouseID)
		argIdx++
	}
	if status != "" {
		query += fmt.Sprintf(" AND so.status = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND so.status = $%d", argIdx)
		args = append(args, status)
		argIdx++
	}
	if deliveryDate != "" {
		query += fmt.Sprintf(" AND so.delivery_date = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND so.delivery_date = $%d", argIdx)
		args = append(args, deliveryDate)
		argIdx++
	}
	if cutoffGroup != "" {
		query += fmt.Sprintf(" AND so.cutoff_group = $%d", argIdx)
		countQuery += fmt.Sprintf(" AND so.cutoff_group = $%d", argIdx)
		args = append(args, cutoffGroup)
		argIdx++
	}

	var total int64
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	query += " ORDER BY so.created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var orders []domain.SalesOrder
	for rows.Next() {
		var o domain.SalesOrder
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.WarehouseID, &o.Status,
			&o.CutoffGroup, &o.DeliveryDate, &o.TotalAmount, &o.DepositAmount, &o.TotalWeightKg,
			&o.ATPStatus, &o.CreditStatus, &o.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		orders = append(orders, o)
	}
	return orders, total, nil
}

func (r *Repository) GetOrder(ctx context.Context, orderID uuid.UUID) (*domain.SalesOrder, error) {
	var o domain.SalesOrder
	err := r.db.QueryRow(ctx, `
		SELECT so.id, so.order_number, so.customer_id, c.name, c.code, so.warehouse_id,
		       COALESCE(w.name, '') as warehouse_name, so.status::text,
		       COALESCE(so.cutoff_group, '')::text, so.delivery_date::text, so.delivery_address,
		       so.time_window, so.total_amount, so.deposit_amount,
		       so.total_weight_kg, so.total_volume_m3, so.atp_status, so.credit_status, so.notes, so.created_at
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		LEFT JOIN warehouses w ON w.id = so.warehouse_id
		WHERE so.id = $1
	`, orderID).Scan(
		&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.CustomerCode, &o.WarehouseID,
		&o.WarehouseName, &o.Status,
		&o.CutoffGroup, &o.DeliveryDate, &o.DeliveryAddress,
		&o.TimeWindow, &o.TotalAmount, &o.DepositAmount,
		&o.TotalWeightKg, &o.TotalVolumeM3, &o.ATPStatus, &o.CreditStatus, &o.Notes, &o.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	o.GrandTotal = o.TotalAmount + o.DepositAmount

	// Load items
	rows, err := r.db.Query(ctx, `
		SELECT oi.id, oi.order_id, oi.product_id, p.name, p.sku, oi.quantity, oi.unit_price, oi.amount, oi.deposit_amount
		FROM order_items oi
		JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item domain.OrderItem
		if err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.ProductSKU,
			&item.Quantity, &item.UnitPrice, &item.Amount, &item.DepositAmount); err != nil {
			return nil, err
		}
		o.Items = append(o.Items, item)
	}

	return &o, nil
}

func (r *Repository) UpdateOrderStatus(ctx context.Context, orderID uuid.UUID, status string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE sales_orders SET status = $2, updated_at = now() WHERE id = $1
	`, orderID, status)
	return err
}

func (r *Repository) ApproveOrder(ctx context.Context, orderID, approvedBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		UPDATE sales_orders SET status = 'approved', approved_by = $2, approved_at = now(), 
		    credit_status = 'approved', updated_at = now() 
		WHERE id = $1 AND status = 'pending_approval'
	`, orderID, approvedBy)
	return err
}

// CreateShipment creates a shipment when order is confirmed
func (r *Repository) CreateShipment(ctx context.Context, tx pgx.Tx, order *domain.SalesOrder) (*domain.Shipment, error) {
	shipment := &domain.Shipment{
		ShipmentNumber: "SH" + order.OrderNumber[2:], // SO-xxx → SH-xxx
		OrderID:        order.ID,
		CustomerID:     order.CustomerID,
		WarehouseID:    order.WarehouseID,
		Status:         "pending",
		DeliveryDate:   order.DeliveryDate,
		TotalWeightKg:  order.TotalWeightKg,
		TotalVolumeM3:  order.TotalVolumeM3,
	}

	itemsJSON := "[]"
	if len(order.Items) > 0 {
		// Build items JSON from order items
		itemsJSON = "["
		for i, item := range order.Items {
			if i > 0 {
				itemsJSON += ","
			}
			itemsJSON += fmt.Sprintf(`{"product_id":"%s","quantity":%d}`, item.ProductID, item.Quantity)
		}
		itemsJSON += "]"
	}

	err := tx.QueryRow(ctx, `
		INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
		RETURNING id
	`, shipment.ShipmentNumber, shipment.OrderID, shipment.CustomerID, shipment.WarehouseID,
		shipment.Status, shipment.DeliveryDate, shipment.TotalWeightKg, shipment.TotalVolumeM3, itemsJSON,
	).Scan(&shipment.ID)

	return shipment, err
}

// CreateDebitEntry adds to receivable ledger when order is confirmed
func (r *Repository) CreateDebitEntry(ctx context.Context, tx pgx.Tx, customerID, orderID uuid.UUID, amount float64, createdBy uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO receivable_ledger (customer_id, order_id, ledger_type, amount, description, created_by)
		VALUES ($1, $2, 'debit', $3, 'Ghi nợ đơn hàng', $4)
	`, customerID, orderID, amount, createdBy)
	return err
}

func (r *Repository) BeginTx(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

// ===== SYSTEM SETTINGS =====
func (r *Repository) GetSetting(ctx context.Context, key string) (string, error) {
	var value string
	err := r.db.QueryRow(ctx, `SELECT value FROM system_settings WHERE key = $1`, key).Scan(&value)
	return value, err
}

// ===== CONSOLIDATION & SPLIT =====

// GetOrdersByIDs returns multiple orders for consolidation validation
func (r *Repository) GetOrdersByIDs(ctx context.Context, orderIDs []uuid.UUID) ([]domain.SalesOrder, error) {
	rows, err := r.db.Query(ctx, `
		SELECT so.id, so.order_number, so.customer_id, c.name, so.warehouse_id, so.status::text,
		       COALESCE(so.cutoff_group, '')::text, so.delivery_date::text, so.total_amount,
		       so.total_weight_kg, so.total_volume_m3
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		WHERE so.id = ANY($1)
		ORDER BY so.created_at
	`, orderIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []domain.SalesOrder
	for rows.Next() {
		var o domain.SalesOrder
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.CustomerID, &o.CustomerName, &o.WarehouseID, &o.Status,
			&o.CutoffGroup, &o.DeliveryDate, &o.TotalAmount,
			&o.TotalWeightKg, &o.TotalVolumeM3,
		); err != nil {
			return nil, err
		}
		orders = append(orders, o)
	}
	return orders, nil
}

// DeletePendingShipmentsByOrderIDs removes pending shipments for orders being consolidated
func (r *Repository) DeletePendingShipmentsByOrderIDs(ctx context.Context, tx pgx.Tx, orderIDs []uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		DELETE FROM shipments WHERE order_id = ANY($1) AND status = 'pending'
	`, orderIDs)
	return err
}

// CreateConsolidatedShipment creates a single shipment covering multiple orders
func (r *Repository) CreateConsolidatedShipment(ctx context.Context, tx pgx.Tx, shipmentNumber string, orders []domain.SalesOrder, warehouseID uuid.UUID) (*domain.Shipment, error) {
	// Use first order's customer/delivery date (validation ensures they're compatible)
	firstOrder := orders[0]
	var totalWeight, totalVolume float64
	itemsJSON := "["
	first := true
	for _, o := range orders {
		totalWeight += o.TotalWeightKg
		totalVolume += o.TotalVolumeM3
		for _, item := range o.Items {
			if !first {
				itemsJSON += ","
			}
			itemsJSON += fmt.Sprintf(`{"product_id":"%s","quantity":%d,"order_id":"%s"}`, item.ProductID, item.Quantity, o.ID)
			first = false
		}
	}
	itemsJSON += "]"

	shipment := &domain.Shipment{
		ShipmentNumber: shipmentNumber,
		OrderID:        firstOrder.ID,
		CustomerID:     firstOrder.CustomerID,
		WarehouseID:    warehouseID,
		Status:         "pending",
		DeliveryDate:   firstOrder.DeliveryDate,
		TotalWeightKg:  totalWeight,
		TotalVolumeM3:  totalVolume,
	}

	err := tx.QueryRow(ctx, `
		INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
		RETURNING id
	`, shipment.ShipmentNumber, shipment.OrderID, shipment.CustomerID, shipment.WarehouseID,
		shipment.Status, shipment.DeliveryDate, shipment.TotalWeightKg, shipment.TotalVolumeM3, itemsJSON,
	).Scan(&shipment.ID)

	return shipment, err
}

// GetOrderItemsByOrderID loads items for a specific order
func (r *Repository) GetOrderItemsByOrderID(ctx context.Context, orderID uuid.UUID) ([]domain.OrderItem, error) {
	rows, err := r.db.Query(ctx, `
		SELECT oi.id, oi.order_id, oi.product_id, p.name, p.sku, oi.quantity, oi.unit_price, oi.amount, oi.deposit_amount
		FROM order_items oi
		JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.OrderItem
	for rows.Next() {
		var item domain.OrderItem
		if err := rows.Scan(&item.ID, &item.OrderID, &item.ProductID, &item.ProductName, &item.ProductSKU,
			&item.Quantity, &item.UnitPrice, &item.Amount, &item.DepositAmount); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, nil
}

// CreateSplitShipment creates a shipment for a subset of order items (split)
func (r *Repository) CreateSplitShipment(ctx context.Context, tx pgx.Tx, shipmentNumber string, order *domain.SalesOrder, items []domain.OrderItem) (*domain.Shipment, error) {
	var totalWeight, totalVolume float64
	itemsJSON := "["
	for i, item := range items {
		if i > 0 {
			itemsJSON += ","
		}
		itemsJSON += fmt.Sprintf(`{"product_id":"%s","quantity":%d}`, item.ProductID, item.Quantity)
		totalWeight += item.Amount / 1000 // simplified proportional weight
		totalVolume += item.DepositAmount / 1000
	}
	itemsJSON += "]"

	// Calculate proportional weight/volume from order
	if order.TotalWeightKg > 0 {
		totalWeight = 0
		totalVolume = 0
		var splitTotal float64
		for _, item := range items {
			splitTotal += item.Amount
		}
		ratio := splitTotal / order.TotalAmount
		totalWeight = order.TotalWeightKg * ratio
		totalVolume = order.TotalVolumeM3 * ratio
	}

	shipment := &domain.Shipment{
		ShipmentNumber: shipmentNumber,
		OrderID:        order.ID,
		CustomerID:     order.CustomerID,
		WarehouseID:    order.WarehouseID,
		Status:         "pending",
		DeliveryDate:   order.DeliveryDate,
		TotalWeightKg:  totalWeight,
		TotalVolumeM3:  totalVolume,
	}

	err := tx.QueryRow(ctx, `
		INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status, delivery_date, total_weight_kg, total_volume_m3, items)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
		RETURNING id
	`, shipment.ShipmentNumber, shipment.OrderID, shipment.CustomerID, shipment.WarehouseID,
		shipment.Status, shipment.DeliveryDate, shipment.TotalWeightKg, shipment.TotalVolumeM3, itemsJSON,
	).Scan(&shipment.ID)

	return shipment, err
}

// ListPendingApprovals returns orders with pending_approval status, enriched with credit data and items
func (r *Repository) ListPendingApprovals(ctx context.Context) ([]map[string]interface{}, error) {
	rows, err := r.db.Query(ctx, `
		SELECT so.id, so.order_number, so.customer_id, c.code, c.name,
		       so.status::text, so.total_amount, so.delivery_date::text, so.created_at,
		       COALESCE(cl.credit_limit, 0) as credit_limit,
		       COALESCE((SELECT SUM(CASE WHEN rl.ledger_type = 'debit' THEN rl.amount ELSE -rl.amount END)
		                 FROM receivable_ledger rl WHERE rl.customer_id = so.customer_id), 0) as current_balance,
		       so.notes
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		LEFT JOIN credit_limits cl ON cl.customer_id = so.customer_id
		     AND cl.effective_from <= CURRENT_DATE
		     AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
		WHERE so.status = 'pending_approval'
		ORDER BY so.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []map[string]interface{}
	for rows.Next() {
		var id, customerID uuid.UUID
		var orderNumber, customerCode, customerName, status, deliveryDate string
		var totalAmount, creditLimit, currentBalance float64
		var createdAt interface{}
		var notes *string

		if err := rows.Scan(&id, &orderNumber, &customerID, &customerCode, &customerName,
			&status, &totalAmount, &deliveryDate, &createdAt, &creditLimit, &currentBalance, &notes); err != nil {
			return nil, err
		}

		exceedAmount := (currentBalance + totalAmount) - creditLimit
		if exceedAmount < 0 {
			exceedAmount = 0
		}

		order := map[string]interface{}{
			"id":              id,
			"order_number":    orderNumber,
			"customer_id":     customerID,
			"customer_code":   customerCode,
			"customer_name":   customerName,
			"status":          status,
			"total_amount":    totalAmount,
			"delivery_date":   deliveryDate,
			"created_at":      createdAt,
			"credit_limit":    creditLimit,
			"current_balance": currentBalance,
			"available_limit": creditLimit - currentBalance,
			"exceed_amount":   exceedAmount,
			"notes":           notes,
		}

		// Load order items
		itemRows, err := r.db.Query(ctx, `
			SELECT oi.product_id, p.name, p.sku, oi.quantity, oi.unit_price, oi.amount
			FROM order_items oi
			JOIN products p ON p.id = oi.product_id
			WHERE oi.order_id = $1
		`, id)
		if err == nil {
			var items []map[string]interface{}
			for itemRows.Next() {
				var productID uuid.UUID
				var productName, productSKU string
				var qty int
				var unitPrice, amount float64
				if err := itemRows.Scan(&productID, &productName, &productSKU, &qty, &unitPrice, &amount); err == nil {
					items = append(items, map[string]interface{}{
						"product_id":   productID,
						"product_name": productName,
						"product_sku":  productSKU,
						"quantity":     qty,
						"unit_price":   unitPrice,
						"amount":       amount,
					})
				}
			}
			itemRows.Close()
			order["items"] = items
		}

		results = append(results, order)
	}
	if results == nil {
		results = []map[string]interface{}{}
	}
	return results, nil
}
