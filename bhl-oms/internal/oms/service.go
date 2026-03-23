package oms

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/internal/events"
	"bhl-oms/internal/integration"
	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
)

type Service struct {
	repo     *Repository
	hooks    *integration.Hooks
	recorder *events.Recorder
	notifSvc NotificationSender
	log      logger.Logger
}

// NotificationSender allows sending notifications without importing notification package.
type NotificationSender interface {
	Send(ctx context.Context, userID uuid.UUID, title, body, category string, link *string) error
	SendToRole(ctx context.Context, role, title, body, category string, link *string) error
	SendToRoleWithEntity(ctx context.Context, role, title, body, category string, link *string, entityType *string, entityID *uuid.UUID) error
	SendWithPriority(ctx context.Context, userID uuid.UUID, title, body, category, priority string, link *string, entityType *string, entityID *uuid.UUID) error
}

func NewService(repo *Repository, log logger.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// SetIntegrationHooks injects optional integration hooks (Task 3.4 DMS wiring).
func (s *Service) SetIntegrationHooks(h *integration.Hooks) {
	s.hooks = h
}

// SetEventRecorder injects the event recorder for activity timeline.
func (s *Service) SetEventRecorder(r *events.Recorder) {
	s.recorder = r
}

// SetNotificationService injects notification service for real-time alerts.
func (s *Service) SetNotificationService(ns NotificationSender) {
	s.notifSvc = ns
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
	orderNumber, err := s.repo.NextOrderNumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("generate order number: %w", err)
	}
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
	orderStatus := "pending_customer_confirm"
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

	// Don't create shipment/debit yet — wait for customer confirmation or 2h auto-confirm

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	order.Items = items
	order.CustomerName = customer.Name
	order.GrandTotal = totalAmount + depositAmount

	// Fire DMS sync (Task 3.4)
	s.fireDMSSync(order.OrderNumber, orderStatus, order.DeliveryDate, order.TotalAmount)

	// Record event: order created
	if s.recorder != nil {
		actorName := middleware.FullNameFromCtx(ctx)
		s.recorder.RecordAsync(events.OrderCreatedEvent(order.ID, &userID, actorName, order.OrderNumber, customer.Name, totalAmount))
	}

	// Notify stakeholders about new order
	if s.notifSvc != nil {
		go func() {
			link := fmt.Sprintf("/orders/%s", order.ID.String())
			eType := "order"
			eID := order.ID
			if orderStatus == "pending_approval" {
				title := "Đơn hàng cần duyệt công nợ"
				body := fmt.Sprintf("Đơn %s (%s) - %s vượt hạn mức, cần duyệt", order.OrderNumber, customer.Name, formatVND(totalAmount))
				_ = s.notifSvc.SendToRoleWithEntity(context.Background(), "accountant", title, body, "warning", &link, &eType, &eID)
			} else {
				title := "Đơn hàng mới chờ xác nhận"
				body := fmt.Sprintf("Đơn %s (%s) - %s đang chờ KH xác nhận", order.OrderNumber, customer.Name, formatVND(totalAmount))
				_ = s.notifSvc.SendToRoleWithEntity(context.Background(), "dvkh", title, body, "info", &link, &eType, &eID)
			}
		}()
	}

	// Fire Zalo order confirmation to customer (2h timeout)
	if orderStatus == "pending_customer_confirm" {
		s.fireOrderConfirmation(order, customer)
	}

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
	s.log.Info(context.Background(), "dms_sync_fired", logger.F("order_number", orderNumber), logger.F("status", status))
}

// fireOrderConfirmation sends Zalo order confirmation to customer (2h timeout).
func (s *Service) fireOrderConfirmation(order *domain.SalesOrder, customer *domain.CustomerWithCredit) {
	if s.hooks == nil {
		return
	}
	phone := ""
	if customer.Phone != nil {
		phone = *customer.Phone
	}
	s.hooks.OnOrderCreated(context.Background(), integration.OrderCreatedEvent{
		OrderID:       order.ID,
		CustomerID:    order.CustomerID,
		OrderNumber:   order.OrderNumber,
		CustomerName:  customer.Name,
		CustomerPhone: phone,
		DeliveryDate:  order.DeliveryDate,
		TotalAmount:   order.TotalAmount,
	})
}

// ConfirmOrderByCustomer processes customer confirmation from Zalo link.
// Transitions order: pending_customer_confirm → confirmed, creates shipment + debit.
func (s *Service) ConfirmOrderByCustomer(ctx context.Context, orderID uuid.UUID) error {
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return fmt.Errorf("order not found: %w", err)
	}

	if order.Status != "pending_customer_confirm" {
		return fmt.Errorf("đơn hàng không ở trạng thái chờ xác nhận (hiện: %s)", order.Status)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Update order status to confirmed
	if _, err := tx.Exec(ctx, `UPDATE sales_orders SET status = 'confirmed', updated_at = now() WHERE id = $1`, orderID); err != nil {
		return fmt.Errorf("update order status: %w", err)
	}

	// Create shipment + debit entry (was deferred from CreateOrder)
	if _, err := s.repo.CreateShipment(ctx, tx, order); err != nil {
		return fmt.Errorf("create shipment: %w", err)
	}

	if err := s.repo.CreateDebitEntry(ctx, tx, order.CustomerID, orderID, order.TotalAmount, order.CreatedBy); err != nil {
		return fmt.Errorf("create debit entry: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	// Fire DMS sync
	s.fireDMSSync(order.OrderNumber, "confirmed", order.DeliveryDate, order.TotalAmount)

	// Record event: customer confirmed
	if s.recorder != nil {
		s.recorder.RecordAsync(events.OrderConfirmedByCustomerEvent(orderID, order.OrderNumber, order.CustomerName))
	}

	s.log.Info(ctx, "order_customer_confirmed", logger.F("order_id", orderID.String()), logger.F("order_number", order.OrderNumber))
	return nil
}

// CancelOrderByCustomer processes customer rejection from Zalo link.
// Transitions order: pending_customer_confirm → cancelled, releases stock.
func (s *Service) CancelOrderByCustomer(ctx context.Context, orderID uuid.UUID, reason string) error {
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return fmt.Errorf("order not found: %w", err)
	}

	if order.Status != "pending_customer_confirm" {
		return fmt.Errorf("đơn hàng không ở trạng thái chờ xác nhận (hiện: %s)", order.Status)
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

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

	s.fireDMSSync(order.OrderNumber, "cancelled", order.DeliveryDate, order.TotalAmount)

	// Record event: customer rejected (with reason)
	if s.recorder != nil {
		s.recorder.RecordAsync(events.OrderRejectedByCustomerEvent(orderID, order.OrderNumber, order.CustomerName, reason))
	}

	s.log.Info(ctx, "order_customer_rejected", logger.F("order_id", orderID.String()), logger.F("order_number", order.OrderNumber), logger.F("reason", reason))
	return nil
}

func (s *Service) UpdateOrder(ctx context.Context, orderID uuid.UUID, req CreateOrderRequest, userID uuid.UUID) (*domain.SalesOrder, error) {
	// 1. Get existing order
	existing, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	// Only editable statuses (not yet shipped/delivered)
	if existing.Status != "draft" && existing.Status != "confirmed" && existing.Status != "pending_approval" && existing.Status != "pending_customer_confirm" {
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
		if err := s.repo.CreateDebitEntry(ctx, tx, req.CustomerID, orderID, totalAmount, &userID); err != nil {
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

	if order.Status != "draft" && order.Status != "confirmed" && order.Status != "pending_approval" && order.Status != "pending_customer_confirm" {
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

	// Record event: order cancelled
	if s.recorder != nil {
		cancelActor := middleware.FullNameFromCtx(ctx)
		if cancelActor == "" {
			cancelActor = "Hệ thống"
		}
		s.recorder.RecordAsync(events.OrderCancelledEvent(orderID, nil, cancelActor, order.OrderNumber, ""))
	}

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

	// After approval, send to customer for confirmation (2h timeout)
	if _, err := tx.Exec(ctx, `
		UPDATE sales_orders SET status = 'pending_customer_confirm', approved_by = $2, approved_at = now(), 
		    credit_status = 'approved', updated_at = now() 
		WHERE id = $1
	`, orderID, approvedBy); err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	// Fire Zalo order confirmation to customer
	customer, custErr := s.repo.GetCustomerWithCredit(ctx, order.CustomerID)
	if custErr == nil {
		s.fireOrderConfirmation(order, customer)
	}

	s.fireDMSSync(order.OrderNumber, "pending_customer_confirm", order.DeliveryDate, order.TotalAmount)

	// Record event: order approved
	if s.recorder != nil {
		s.recorder.RecordAsync(events.OrderApprovedEvent(orderID, &approvedBy, middleware.FullNameFromCtx(ctx), order.OrderNumber))
	}

	// Notify DVKH that credit was approved
	if s.notifSvc != nil {
		go func() {
			link := fmt.Sprintf("/orders/%s", orderID.String())
			eType := "order"
			title := "Công nợ đã được duyệt"
			body := fmt.Sprintf("Đơn %s đã được duyệt công nợ, đang chờ KH xác nhận qua Zalo", order.OrderNumber)
			_ = s.notifSvc.SendToRoleWithEntity(context.Background(), "dvkh", title, body, "success", &link, &eType, &orderID)
		}()
	}

	return nil
}

func generateOrderNumber() string {
	now := time.Now()
	return fmt.Sprintf("SO-%s-%04d", now.Format("20060102"), now.UnixNano()%10000)
}

func formatVND(amount float64) string {
	return fmt.Sprintf("%.0fđ", amount)
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

// ListPendingApprovals returns orders with status pending_approval, enriched with credit details and items
func (s *Service) ListPendingApprovals(ctx context.Context) ([]map[string]interface{}, error) {
	return s.repo.ListPendingApprovals(ctx)
}

// ===== RE-DELIVERY (US-TMS-14b) =====

// CreateRedelivery creates a new delivery attempt from a failed/rejected/partial order.
// It resets the order status back to confirmed, creates a new shipment, and tracks the attempt.
func (s *Service) CreateRedelivery(ctx context.Context, orderID uuid.UUID, reason string, userID uuid.UUID) (*domain.DeliveryAttempt, error) {
	// 1. Get the order
	order, err := s.repo.GetOrder(ctx, orderID)
	if err != nil {
		return nil, fmt.Errorf("order not found: %w", err)
	}

	// 2. Validate — only allow re-delivery from partially_delivered or failed
	// rejected → user should cancel and create new order
	// delivered → already completed, no re-delivery needed
	allowedStatuses := map[string]bool{
		"partially_delivered": true,
		"failed":              true,
	}
	if !allowedStatuses[order.Status] {
		return nil, fmt.Errorf("không thể giao bổ sung từ trạng thái '%s' — chỉ cho phép từ: partially_delivered, failed", order.Status)
	}

	// 3. Get previous stop info
	var previousStopID *uuid.UUID
	var previousStatus string
	lastStop, err := s.repo.GetLastStopForOrder(ctx, orderID)
	if err == nil && lastStop != nil {
		previousStopID = &lastStop.ID
		previousStatus = lastStop.Status
	}

	// 4. Count existing attempts
	attemptCount, _ := s.repo.GetDeliveryAttemptCount(ctx, orderID)
	attemptNumber := attemptCount + 1

	// 5. Transaction: create attempt + shipment + update order
	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Create delivery attempt record
	attempt := &domain.DeliveryAttempt{
		OrderID:        orderID,
		AttemptNumber:  attemptNumber,
		PreviousStopID: previousStopID,
		PreviousStatus: previousStatus,
		PreviousReason: reason,
		CreatedBy:      &userID,
	}
	if err := s.repo.CreateDeliveryAttempt(ctx, tx, attempt); err != nil {
		return nil, fmt.Errorf("create delivery attempt: %w", err)
	}

	// Increment re_delivery_count on order
	if err := s.repo.IncrementRedeliveryCount(ctx, tx, orderID); err != nil {
		return nil, fmt.Errorf("increment redelivery count: %w", err)
	}

	// Create new shipment for re-delivery
	shipment, err := s.repo.CreateShipment(ctx, tx, order)
	if err != nil {
		return nil, fmt.Errorf("create redelivery shipment: %w", err)
	}
	attempt.ShipmentID = &shipment.ID

	// Link shipment to attempt
	if err := s.repo.UpdateDeliveryAttemptShipment(ctx, attempt.ID, shipment.ID); err != nil {
		return nil, fmt.Errorf("link shipment to attempt: %w", err)
	}

	// Update order status back to confirmed (re-enters delivery flow)
	if err := s.repo.UpdateOrderStatus(ctx, orderID, "confirmed"); err != nil {
		return nil, fmt.Errorf("reset order status: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	// Record event
	if s.recorder != nil {
		actorName := middleware.FullNameFromCtx(ctx)
		s.recorder.RecordAsync(events.OrderRedeliveryCreatedEvent(orderID, &userID, actorName, order.OrderNumber, attemptNumber, reason))
	}

	// Notify dispatcher about new re-delivery
	if s.notifSvc != nil {
		go func() {
			link := fmt.Sprintf("/orders/%s", orderID.String())
			eType := "order"
			eID := orderID
			title := fmt.Sprintf("Giao lại lần %d", attemptNumber)
			body := fmt.Sprintf("Đơn %s (%s) — Lý do: %s", order.OrderNumber, order.CustomerName, reason)
			_ = s.notifSvc.SendToRoleWithEntity(context.Background(), "dispatcher", title, body, "warning", &link, &eType, &eID)
		}()
	}

	attempt.OrderNumber = order.OrderNumber
	attempt.CustomerName = order.CustomerName
	return attempt, nil
}

// ListDeliveryAttempts returns all re-delivery attempts for an order
func (s *Service) ListDeliveryAttempts(ctx context.Context, orderID uuid.UUID) ([]domain.DeliveryAttempt, error) {
	return s.repo.ListDeliveryAttempts(ctx, orderID)
}

// ===== CONTROL DESK (Task 5.9, 5.10, 5.11) =====

// GetControlDeskStats returns order counts per status for the DVKH control desk
func (s *Service) GetControlDeskStats(ctx context.Context, warehouseID *uuid.UUID) (*domain.ControlDeskStats, error) {
	return s.repo.GetControlDeskStats(ctx, warehouseID)
}

// SearchOrders performs a global search across customer name, phone, order number, vehicle plate
func (s *Service) SearchOrders(ctx context.Context, q string, page, limit int) ([]domain.SalesOrder, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.repo.SearchOrders(ctx, q, limit, offset)
}
