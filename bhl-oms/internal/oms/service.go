package oms

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/internal/integration"

	"github.com/google/uuid"
)

type Service struct {
	repo  *Repository
	hooks *integration.Hooks
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// SetIntegrationHooks injects optional integration hooks (Task 3.4 DMS wiring).
func (s *Service) SetIntegrationHooks(h *integration.Hooks) {
	s.hooks = h
}

func (s *Service) ListProducts(ctx context.Context) ([]domain.Product, error) {
	return s.repo.ListProducts(ctx)
}

func (s *Service) GetProduct(ctx context.Context, id uuid.UUID) (*domain.Product, error) {
	return s.repo.GetProduct(ctx, id)
}

func (s *Service) CreateProduct(ctx context.Context, p *domain.Product) error {
	return s.repo.CreateProduct(ctx, p)
}

func (s *Service) UpdateProduct(ctx context.Context, p *domain.Product) error {
	return s.repo.UpdateProduct(ctx, p)
}

func (s *Service) DeleteProduct(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteProduct(ctx, id)
}

func (s *Service) ListCustomers(ctx context.Context) ([]domain.Customer, error) {
	return s.repo.ListCustomers(ctx)
}

func (s *Service) GetCustomer(ctx context.Context, id uuid.UUID) (*domain.Customer, error) {
	return s.repo.GetCustomer(ctx, id)
}

func (s *Service) CreateCustomer(ctx context.Context, c *domain.Customer) error {
	return s.repo.CreateCustomer(ctx, c)
}

func (s *Service) UpdateCustomer(ctx context.Context, c *domain.Customer) error {
	return s.repo.UpdateCustomer(ctx, c)
}

func (s *Service) DeleteCustomer(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteCustomer(ctx, id)
}

func (s *Service) GetCustomerWithCredit(ctx context.Context, customerID uuid.UUID) (*domain.CustomerWithCredit, error) {
	return s.repo.GetCustomerWithCredit(ctx, customerID)
}

func (s *Service) CheckATP(ctx context.Context, productID, warehouseID uuid.UUID) (*domain.ATPResult, error) {
	return s.repo.GetATP(ctx, productID, warehouseID)
}

func (s *Service) CheckATPBatch(ctx context.Context, warehouseID uuid.UUID, productIDs []uuid.UUID) ([]domain.ATPResult, error) {
	return s.repo.GetATPBatch(ctx, warehouseID, productIDs)
}

type CreateOrderRequest struct {
	CustomerID   uuid.UUID        `json:"customer_id"`
	WarehouseID  uuid.UUID        `json:"warehouse_id"`
	DeliveryDate string           `json:"delivery_date"`
	TimeWindow   *string          `json:"time_window"`
	Notes        *string          `json:"notes"`
	Items        []OrderItemInput `json:"items"`
}

type OrderItemInput struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

func (s *Service) CreateOrder(ctx context.Context, req CreateOrderRequest, userID uuid.UUID) (*domain.SalesOrder, error) {
	// 1. Get customer credit info
	customer, err := s.repo.GetCustomerWithCredit(ctx, req.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}

	// 2. Get product details for pricing
	productIDs := make([]uuid.UUID, len(req.Items))
	for i, item := range req.Items {
		productIDs[i] = item.ProductID
	}

	products, err := s.repo.ListProducts(ctx)
	if err != nil {
		return nil, fmt.Errorf("load products: %w", err)
	}

	productMap := make(map[uuid.UUID]domain.Product)
	for _, p := range products {
		productMap[p.ID] = p
	}

	// 3. Check ATP for all items
	atpResults, err := s.repo.GetATPBatch(ctx, req.WarehouseID, productIDs)
	if err != nil {
		return nil, fmt.Errorf("check ATP: %w", err)
	}

	atpMap := make(map[uuid.UUID]int)
	for _, a := range atpResults {
		atpMap[a.ProductID] = a.ATP
	}

	// 4. Build order + items
	orderNumber := generateOrderNumber()
	var totalAmount, depositAmount, totalWeight, totalVolume float64
	atpStatus := "sufficient"

	items := make([]domain.OrderItem, 0, len(req.Items))
	for _, reqItem := range req.Items {
		p, ok := productMap[reqItem.ProductID]
		if !ok {
			return nil, fmt.Errorf("product %s not found", reqItem.ProductID)
		}

		amount := p.Price * float64(reqItem.Quantity)
		deposit := p.DepositPrice * float64(reqItem.Quantity)
		totalAmount += amount
		depositAmount += deposit
		totalWeight += p.WeightKg * float64(reqItem.Quantity)
		totalVolume += p.VolumeM3 * float64(reqItem.Quantity)

		items = append(items, domain.OrderItem{
			ProductID:     reqItem.ProductID,
			Quantity:      reqItem.Quantity,
			UnitPrice:     p.Price,
			Amount:        amount,
			DepositAmount: deposit,
		})

		// Check ATP
		if atp, found := atpMap[reqItem.ProductID]; !found || atp < reqItem.Quantity {
			atpStatus = "insufficient"
		}
	}

	// 5. Check credit limit
	creditStatus := "within_limit"
	orderStatus := "confirmed"
	if customer.AvailableLimit < totalAmount {
		creditStatus = "exceeded"
		orderStatus = "pending_approval"
	}

	if atpStatus == "insufficient" {
		return nil, fmt.Errorf("ATP_INSUFFICIENT: không đủ tồn kho cho một hoặc nhiều sản phẩm")
	}

	// 6. Determine cutoff group (R08: trước/sau 16h)
	cutoffGroup := determineCutoffGroup(ctx, s.repo)

	// 7. Create within transaction
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	order := &domain.SalesOrder{
		OrderNumber:   orderNumber,
		CustomerID:    req.CustomerID,
		WarehouseID:   req.WarehouseID,
		Status:        orderStatus,
		CutoffGroup:   cutoffGroup,
		DeliveryDate:  req.DeliveryDate,
		TimeWindow:    req.TimeWindow,
		TotalAmount:   totalAmount,
		DepositAmount: depositAmount,
		TotalWeightKg: totalWeight,
		TotalVolumeM3: totalVolume,
		ATPStatus:     atpStatus,
		CreditStatus:  creditStatus,
		Notes:         req.Notes,
		CreatedBy:     &userID,
	}

	if err := s.repo.CreateOrder(ctx, tx, order); err != nil {
		return nil, fmt.Errorf("create order: %w", err)
	}

	// Reserve stock + create items
	for i := range items {
		items[i].OrderID = order.ID
		if err := s.repo.CreateOrderItem(ctx, tx, &items[i]); err != nil {
			return nil, fmt.Errorf("create order item: %w", err)
		}
		if err := s.repo.ReserveStock(ctx, tx, items[i].ProductID, req.WarehouseID, items[i].Quantity); err != nil {
			return nil, fmt.Errorf("reserve stock: %w", err)
		}
	}

	// If confirmed, create shipment + debit ledger
	if orderStatus == "confirmed" {
		order.Items = items
		if _, err := s.repo.CreateShipment(ctx, tx, order); err != nil {
			return nil, fmt.Errorf("create shipment: %w", err)
		}
		if err := s.repo.CreateDebitEntry(ctx, tx, order.CustomerID, order.ID, totalAmount, userID); err != nil {
			return nil, fmt.Errorf("create debit entry: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	order.Items = items
	order.CustomerName = customer.Name
	order.GrandTotal = totalAmount + depositAmount

	// Fire DMS sync (Task 3.4)
	s.fireDMSSync(order.OrderNumber, orderStatus, order.DeliveryDate, order.TotalAmount)

	return order, nil
}

// fireDMSSync sends order status event to DMS asynchronously.
func (s *Service) fireDMSSync(orderNumber, status, deliveryDate string, totalAmount float64) {
	if s.hooks == nil {
		return
	}
	s.hooks.OnOrderStatusChanged(context.Background(), integration.OrderStatusEvent{
		OrderNumber:  orderNumber,
		Status:       status,
		DeliveryDate: deliveryDate,
		TotalAmount:  totalAmount,
	})
	log.Printf("[OMS] DMS sync fired for %s → %s", orderNumber, status)
}

func (s *Service) UpdateOrder(ctx context.Context, orderID uuid.UUID, req CreateOrderRequest, userID uuid.UUID) (*domain.SalesOrder, error) {
	// 1. Get existing order
	existing, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	// Only editable statuses (not yet shipped/delivered)
	if existing.Status != "draft" && existing.Status != "confirmed" && existing.Status != "pending_approval" {
		return nil, fmt.Errorf("không thể sửa đơn hàng ở trạng thái %s", existing.Status)
	}

	// 2. Get customer credit info
	customer, err := s.repo.GetCustomerWithCredit(ctx, req.CustomerID)
	if err != nil {
		return nil, fmt.Errorf("customer not found: %w", err)
	}

	// 3. Get product details
	products, err := s.repo.ListProducts(ctx)
	if err != nil {
		return nil, fmt.Errorf("load products: %w", err)
	}
	productMap := make(map[uuid.UUID]domain.Product)
	for _, p := range products {
		productMap[p.ID] = p
	}

	// 4. Check ATP for new items
	productIDs := make([]uuid.UUID, len(req.Items))
	for i, item := range req.Items {
		productIDs[i] = item.ProductID
	}
	atpResults, err := s.repo.GetATPBatch(ctx, req.WarehouseID, productIDs)
	if err != nil {
		return nil, fmt.Errorf("check ATP: %w", err)
	}
	atpMap := make(map[uuid.UUID]int)
	for _, a := range atpResults {
		atpMap[a.ProductID] = a.ATP
	}

	// Build map of old items for stock delta calculation
	oldItemMap := make(map[uuid.UUID]int)
	for _, item := range existing.Items {
		oldItemMap[item.ProductID] = item.Quantity
	}

	// 5. Build new items + calculate totals
	var totalAmount, depositAmount, totalWeight, totalVolume float64
	atpStatus := "sufficient"
	items := make([]domain.OrderItem, 0, len(req.Items))

	for _, reqItem := range req.Items {
		p, ok := productMap[reqItem.ProductID]
		if !ok {
			return nil, fmt.Errorf("product %s not found", reqItem.ProductID)
		}

		amount := p.Price * float64(reqItem.Quantity)
		deposit := p.DepositPrice * float64(reqItem.Quantity)
		totalAmount += amount
		depositAmount += deposit
		totalWeight += p.WeightKg * float64(reqItem.Quantity)
		totalVolume += p.VolumeM3 * float64(reqItem.Quantity)

		items = append(items, domain.OrderItem{
			ProductID:     reqItem.ProductID,
			Quantity:      reqItem.Quantity,
			UnitPrice:     p.Price,
			Amount:        amount,
			DepositAmount: deposit,
		})

		// Check ATP: available ATP + old reserved qty for this product
		oldQty := oldItemMap[reqItem.ProductID]
		effectiveATP := atpMap[reqItem.ProductID] + oldQty
		if effectiveATP < reqItem.Quantity {
			atpStatus = "insufficient"
		}
	}

	if atpStatus == "insufficient" {
		return nil, fmt.Errorf("ATP_INSUFFICIENT: không đủ tồn kho cho một hoặc nhiều sản phẩm")
	}

	// 6. Re-check credit limit
	creditStatus := "within_limit"
	orderStatus := "confirmed"
	if customer.AvailableLimit+existing.TotalAmount < totalAmount {
		creditStatus = "exceeded"
		orderStatus = "pending_approval"
	}

	// 7. Execute in transaction
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Check if order has non-pending shipments (already in trip) → block edit
	var nonPendingCount int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM shipments WHERE order_id = $1 AND status != 'pending'`, orderID).Scan(&nonPendingCount); err != nil {
		return nil, fmt.Errorf("check shipments: %w", err)
	}
	if nonPendingCount > 0 {
		return nil, fmt.Errorf("không thể sửa: đơn hàng đã có shipment đang xử lý/giao hàng")
	}

	// Release old stock reservations
	for _, oldItem := range existing.Items {
		if err := s.repo.ReleaseStock(ctx, tx, oldItem.ProductID, existing.WarehouseID, oldItem.Quantity); err != nil {
			return nil, fmt.Errorf("release old stock: %w", err)
		}
	}

	// Delete old items
	if _, err := tx.Exec(ctx, `DELETE FROM order_items WHERE order_id = $1`, orderID); err != nil {
		return nil, fmt.Errorf("delete old items: %w", err)
	}

	// Delete old pending shipments
	if _, err := tx.Exec(ctx, `DELETE FROM shipments WHERE order_id = $1 AND status = 'pending'`, orderID); err != nil {
		return nil, fmt.Errorf("delete old shipment: %w", err)
	}

	// Delete old debit entry
	if _, err := tx.Exec(ctx, `DELETE FROM receivable_ledger WHERE order_id = $1`, orderID); err != nil {
		return nil, fmt.Errorf("delete old debit: %w", err)
	}

	// Update order record
	if _, err := tx.Exec(ctx, `
		UPDATE sales_orders SET 
			customer_id = $2, warehouse_id = $3, delivery_date = $4, time_window = $5,
			notes = $6, status = $7, total_amount = $8, deposit_amount = $9,
			total_weight_kg = $10, total_volume_m3 = $11, atp_status = $12, credit_status = $13,
			updated_at = now()
		WHERE id = $1
	`, orderID, req.CustomerID, req.WarehouseID, req.DeliveryDate, req.TimeWindow,
		req.Notes, orderStatus, totalAmount, depositAmount,
		totalWeight, totalVolume, atpStatus, creditStatus,
	); err != nil {
		return nil, fmt.Errorf("update order: %w", err)
	}

	// Insert new items + reserve stock
	for i := range items {
		items[i].OrderID = orderID
		if err := s.repo.CreateOrderItem(ctx, tx, &items[i]); err != nil {
			return nil, fmt.Errorf("create order item: %w", err)
		}
		if err := s.repo.ReserveStock(ctx, tx, items[i].ProductID, req.WarehouseID, items[i].Quantity); err != nil {
			return nil, fmt.Errorf("reserve stock: %w", err)
		}
	}

	// If confirmed, recreate shipment + debit
	order := &domain.SalesOrder{
		ID:            orderID,
		OrderNumber:   existing.OrderNumber,
		CustomerID:    req.CustomerID,
		WarehouseID:   req.WarehouseID,
		Status:        orderStatus,
		DeliveryDate:  req.DeliveryDate,
		TotalAmount:   totalAmount,
		DepositAmount: depositAmount,
		TotalWeightKg: totalWeight,
		TotalVolumeM3: totalVolume,
		Items:         items,
	}

	if orderStatus == "confirmed" {
		if _, err := s.repo.CreateShipment(ctx, tx, order); err != nil {
			return nil, fmt.Errorf("create shipment: %w", err)
		}
		if err := s.repo.CreateDebitEntry(ctx, tx, req.CustomerID, orderID, totalAmount, userID); err != nil {
			return nil, fmt.Errorf("create debit entry: %w", err)
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	order.CustomerName = customer.Name
	order.GrandTotal = totalAmount + depositAmount
	return order, nil
}

func (s *Service) ListOrders(ctx context.Context, warehouseID *uuid.UUID, status, deliveryDate, cutoffGroup string, page, limit int) ([]domain.SalesOrder, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.repo.ListOrders(ctx, warehouseID, status, deliveryDate, cutoffGroup, limit, offset)
}

func (s *Service) GetOrder(ctx context.Context, orderID uuid.UUID) (*domain.SalesOrder, error) {
	return s.repo.GetOrder(ctx, orderID)
}

func (s *Service) CancelOrder(ctx context.Context, orderID uuid.UUID) error {
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return fmt.Errorf("order not found: %w", err)
	}

	if order.Status != "draft" && order.Status != "confirmed" && order.Status != "pending_approval" {
		return fmt.Errorf("cannot cancel order with status %s", order.Status)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Release reserved stock
	for _, item := range order.Items {
		if err := s.repo.ReleaseStock(ctx, tx, item.ProductID, order.WarehouseID, item.Quantity); err != nil {
			return fmt.Errorf("release stock: %w", err)
		}
	}

	if _, err := tx.Exec(ctx, `UPDATE sales_orders SET status = 'cancelled', updated_at = now() WHERE id = $1`, orderID); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Fire DMS sync (Task 3.4)
	s.fireDMSSync(order.OrderNumber, "cancelled", order.DeliveryDate, order.TotalAmount)

	return nil
}

func (s *Service) ApproveOrder(ctx context.Context, orderID, approvedBy uuid.UUID) error {
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return fmt.Errorf("order not found: %w", err)
	}

	if order.Status != "pending_approval" {
		return fmt.Errorf("order status must be pending_approval, got %s", order.Status)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `
		UPDATE sales_orders SET status = 'confirmed', approved_by = $2, approved_at = now(), 
		    credit_status = 'approved', updated_at = now() 
		WHERE id = $1
	`, orderID, approvedBy); err != nil {
		return err
	}

	// Create shipment + debit
	if _, err := s.repo.CreateShipment(ctx, tx, order); err != nil {
		return fmt.Errorf("create shipment: %w", err)
	}

	userID := approvedBy
	if err := s.repo.CreateDebitEntry(ctx, tx, order.CustomerID, order.ID, order.TotalAmount, userID); err != nil {
		return fmt.Errorf("create debit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Fire DMS sync (Task 3.4)
	s.fireDMSSync(order.OrderNumber, "confirmed", order.DeliveryDate, order.TotalAmount)

	return nil
}

func generateOrderNumber() string {
	now := time.Now()
	return fmt.Sprintf("SO-%s-%04d", now.Format("20060102"), now.UnixNano()%10000)
}

// determineCutoffGroup reads configurable cutoff hour and classifies order
func determineCutoffGroup(ctx context.Context, repo *Repository) string {
	cutoffHour := 16 // default
	if val, err := repo.GetSetting(ctx, "cutoff_hour"); err == nil {
		if h, err := strconv.Atoi(val); err == nil && h >= 0 && h <= 23 {
			cutoffHour = h
		}
	}

	loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
	now := time.Now().In(loc)
	if now.Hour() < cutoffHour {
		return "before_16h"
	}
	return "after_16h"
}

// ===== CONSOLIDATION (US-OMS-03) =====

type ConsolidateRequest struct {
	OrderIDs    []uuid.UUID `json:"order_ids"`
	WarehouseID uuid.UUID   `json:"warehouse_id"`
}

func (s *Service) ConsolidateOrders(ctx context.Context, req ConsolidateRequest) (*domain.Shipment, error) {
	if len(req.OrderIDs) < 2 {
		return nil, fmt.Errorf("cần ít nhất 2 đơn hàng để gom")
	}

	// 1. Load all orders
	orders, err := s.repo.GetOrdersByIDs(ctx, req.OrderIDs)
	if err != nil {
		return nil, fmt.Errorf("load orders: %w", err)
	}
	if len(orders) != len(req.OrderIDs) {
		return nil, fmt.Errorf("một hoặc nhiều đơn hàng không tồn tại")
	}

	// 2. Validate: all orders must be confirmed
	for _, o := range orders {
		if o.Status != "confirmed" {
			return nil, fmt.Errorf("đơn hàng %s ở trạng thái %s, yêu cầu confirmed", o.OrderNumber, o.Status)
		}
	}

	// 3. Validate: same customer and warehouse
	firstCustomer := orders[0].CustomerID
	for _, o := range orders[1:] {
		if o.CustomerID != firstCustomer {
			return nil, fmt.Errorf("đơn hàng %s thuộc khách hàng khác, không thể gom", o.OrderNumber)
		}
	}

	// 4. Load items for each order
	for i := range orders {
		items, err := s.repo.GetOrderItemsByOrderID(ctx, orders[i].ID)
		if err != nil {
			return nil, fmt.Errorf("load items for %s: %w", orders[i].OrderNumber, err)
		}
		orders[i].Items = items
	}

	// 5. Execute consolidation in transaction
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Delete old pending shipments
	if err := s.repo.DeletePendingShipmentsByOrderIDs(ctx, tx, req.OrderIDs); err != nil {
		return nil, fmt.Errorf("delete old shipments: %w", err)
	}

	// Create consolidated shipment
	shipmentNumber := fmt.Sprintf("SH-CON-%s-%04d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)
	shipment, err := s.repo.CreateConsolidatedShipment(ctx, tx, shipmentNumber, orders, req.WarehouseID)
	if err != nil {
		return nil, fmt.Errorf("create consolidated shipment: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return shipment, nil
}

// ===== SPLIT (US-OMS-04) =====

type SplitRequest struct {
	Splits []SplitPart `json:"splits"`
}

type SplitPart struct {
	Items []SplitItem `json:"items"`
}

type SplitItem struct {
	ProductID uuid.UUID `json:"product_id"`
	Quantity  int       `json:"quantity"`
}

func (s *Service) SplitOrder(ctx context.Context, orderID uuid.UUID, req SplitRequest) ([]domain.Shipment, error) {
	if len(req.Splits) < 2 {
		return nil, fmt.Errorf("cần ít nhất 2 phần tách")
	}

	// 1. Load order with items
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}
	if order.Status != "confirmed" && order.Status != "draft" {
		return nil, fmt.Errorf("không thể tách đơn ở trạng thái %s", order.Status)
	}

	// 2. Validate split quantities = order quantities
	orderQtyMap := make(map[uuid.UUID]int)
	for _, item := range order.Items {
		orderQtyMap[item.ProductID] = item.Quantity
	}
	splitQtyMap := make(map[uuid.UUID]int)
	for _, part := range req.Splits {
		for _, item := range part.Items {
			splitQtyMap[item.ProductID] += item.Quantity
		}
	}
	for pid, orderQty := range orderQtyMap {
		if splitQtyMap[pid] != orderQty {
			return nil, fmt.Errorf("tổng số lượng tách cho sản phẩm %s (%d) khác đơn gốc (%d)", pid, splitQtyMap[pid], orderQty)
		}
	}

	// 3. Build product lookup for calculating amounts
	productMap := make(map[uuid.UUID]domain.OrderItem)
	for _, item := range order.Items {
		productMap[item.ProductID] = item
	}

	// 4. Execute split in transaction
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Delete old pending shipments for this order
	if err := s.repo.DeletePendingShipmentsByOrderIDs(ctx, tx, []uuid.UUID{orderID}); err != nil {
		return nil, fmt.Errorf("delete old shipments: %w", err)
	}

	var shipments []domain.Shipment
	for i, part := range req.Splits {
		// Build split items with calculated amounts
		var splitItems []domain.OrderItem
		for _, si := range part.Items {
			origItem := productMap[si.ProductID]
			unitPrice := origItem.UnitPrice
			amount := unitPrice * float64(si.Quantity)
			depositPerUnit := float64(0)
			if origItem.Quantity > 0 {
				depositPerUnit = origItem.DepositAmount / float64(origItem.Quantity)
			}
			splitItems = append(splitItems, domain.OrderItem{
				ProductID:     si.ProductID,
				Quantity:      si.Quantity,
				UnitPrice:     unitPrice,
				Amount:        amount,
				DepositAmount: depositPerUnit * float64(si.Quantity),
			})
		}

		shipmentNumber := fmt.Sprintf("SH-%s-%d-%04d", order.OrderNumber[3:], i+1, time.Now().UnixNano()%10000)
		shipment, err := s.repo.CreateSplitShipment(ctx, tx, shipmentNumber, order, splitItems)
		if err != nil {
			return nil, fmt.Errorf("create split shipment %d: %w", i+1, err)
		}
		shipments = append(shipments, *shipment)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	return shipments, nil
}
