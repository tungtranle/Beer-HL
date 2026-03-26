package wms

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"
)

// NotificationSender allows WMS to send notifications without importing notification package.
type NotificationSender interface {
	Send(ctx context.Context, userID uuid.UUID, title, body, category string, link *string) error
	SendToRole(ctx context.Context, role, title, body, category string, link *string) error
}

type Service struct {
	repo     *Repository
	log      logger.Logger
	notifSvc NotificationSender
}

func NewService(repo *Repository, log logger.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// SetNotificationService injects notification service for warehouse alerts.
func (s *Service) SetNotificationService(ns NotificationSender) {
	s.notifSvc = ns
}

// ── Stock Query ─────────────────────────────────────

func (s *Service) GetStock(ctx context.Context, warehouseID, productID, lotID *uuid.UUID) ([]domain.StockQuant, error) {
	return s.repo.GetStock(ctx, warehouseID, productID, lotID)
}

// ── Inbound ─────────────────────────────────────────

type InboundRequest struct {
	WarehouseID uuid.UUID     `json:"warehouse_id" binding:"required"`
	Notes       *string       `json:"notes"`
	Items       []InboundItem `json:"items" binding:"required,min=1"`
}

type InboundItem struct {
	ProductID      uuid.UUID `json:"product_id" binding:"required"`
	LotBatchNumber string    `json:"lot_batch_number" binding:"required"`
	ProductionDate string    `json:"production_date" binding:"required"`
	ExpiryDate     string    `json:"expiry_date" binding:"required"`
	LocationID     uuid.UUID `json:"location_id" binding:"required"`
	Quantity       int       `json:"quantity" binding:"required,min=1"`
}

func (s *Service) CreateInbound(ctx context.Context, req InboundRequest, userID uuid.UUID) (*domain.StockMove, error) {
	if len(req.Items) == 0 {
		return nil, fmt.Errorf("items cannot be empty")
	}

	// Validate dates
	for _, item := range req.Items {
		pDate, err := time.Parse("2006-01-02", item.ProductionDate)
		if err != nil {
			return nil, fmt.Errorf("invalid production_date for product %s: %w", item.ProductID, err)
		}
		eDate, err := time.Parse("2006-01-02", item.ExpiryDate)
		if err != nil {
			return nil, fmt.Errorf("invalid expiry_date for product %s: %w", item.ProductID, err)
		}
		if !eDate.After(pDate) {
			return nil, fmt.Errorf("expiry_date must be after production_date for product %s", item.ProductID)
		}
	}

	moveNumber := fmt.Sprintf("IN-%s", time.Now().Format("20060102-150405"))

	// Build items JSON
	moveItems := make([]domain.StockMoveItem, len(req.Items))
	for i, item := range req.Items {
		lotID, err := s.repo.GetOrCreateLot(ctx, item.ProductID, item.LotBatchNumber, item.ProductionDate, item.ExpiryDate)
		if err != nil {
			return nil, fmt.Errorf("failed to get/create lot: %w", err)
		}

		moveItems[i] = domain.StockMoveItem{
			ProductID:  item.ProductID,
			LotID:      lotID,
			LocationID: item.LocationID,
			Quantity:   item.Quantity,
		}

		// Update stock quant
		if err := s.repo.UpsertStockQuant(ctx, item.ProductID, lotID, req.WarehouseID, item.LocationID, item.Quantity); err != nil {
			return nil, fmt.Errorf("failed to upsert stock: %w", err)
		}
	}

	itemsJSON, err := json.Marshal(moveItems)
	if err != nil {
		return nil, err
	}

	move := domain.StockMove{
		MoveNumber:  moveNumber,
		MoveType:    "inbound",
		WarehouseID: req.WarehouseID,
		Items:       itemsJSON,
		TotalItems:  len(req.Items),
		Notes:       req.Notes,
		CreatedBy:   userID,
	}

	id, err := s.repo.CreateStockMove(ctx, move)
	if err != nil {
		return nil, err
	}

	move.ID = id
	move.CreatedAt = time.Now()
	return &move, nil
}

// ── Picking Orders ──────────────────────────────────

func (s *Service) GetPickingOrders(ctx context.Context, warehouseID uuid.UUID, status string) ([]domain.PickingOrder, error) {
	return s.repo.GetPickingOrders(ctx, warehouseID, status)
}

func (s *Service) GetAllPickingOrders(ctx context.Context, status string) ([]domain.PickingOrder, error) {
	return s.repo.GetAllPickingOrders(ctx, status)
}

func (s *Service) GetPickingOrderByID(ctx context.Context, id uuid.UUID) (*domain.PickingOrder, error) {
	return s.repo.GetPickingOrderByID(ctx, id)
}

// EnrichedPickingOrder includes product/lot details for UI display.
type EnrichedPickingOrder struct {
	domain.PickingOrder
	EnrichedItems []EnrichedPickingItem `json:"enriched_items"`
	TotalItems    int                   `json:"total_items"`
}

// EnrichedPickingItem adds product name, SKU, lot info to each picking item.
type EnrichedPickingItem struct {
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	ProductSKU  string    `json:"product_sku"`
	LotID       uuid.UUID `json:"lot_id"`
	BatchNumber string    `json:"batch_number"`
	ExpiryDate  string    `json:"expiry_date"`
	LocationID  uuid.UUID `json:"location_id"`
	Quantity    int       `json:"qty"`
	PickedQty   int       `json:"picked_qty"`
}

// EnrichPickingOrders joins product/lot info onto picking items for frontend display.
func (s *Service) EnrichPickingOrders(ctx context.Context, orders []domain.PickingOrder) []EnrichedPickingOrder {
	result := make([]EnrichedPickingOrder, 0, len(orders))
	for _, po := range orders {
		enriched := EnrichedPickingOrder{
			PickingOrder: po,
		}

		var items []domain.PickingItem
		if err := json.Unmarshal(po.Items, &items); err == nil {
			for _, item := range items {
				ei := EnrichedPickingItem{
					ProductID:  item.ProductID,
					LotID:      item.LotID,
					LocationID: item.LocationID,
					Quantity:   item.Quantity,
					PickedQty:  item.PickedQty,
				}
				// Look up product
				var pName, pSKU string
				_ = s.repo.db.QueryRow(ctx,
					`SELECT name, sku FROM products WHERE id = $1`, item.ProductID,
				).Scan(&pName, &pSKU)
				ei.ProductName = pName
				ei.ProductSKU = pSKU

				// Look up lot
				var batchNumber, expiryDate string
				_ = s.repo.db.QueryRow(ctx,
					`SELECT batch_number, expiry_date::text FROM lots WHERE id = $1`, item.LotID,
				).Scan(&batchNumber, &expiryDate)
				ei.BatchNumber = batchNumber
				ei.ExpiryDate = expiryDate

				enriched.EnrichedItems = append(enriched.EnrichedItems, ei)
			}
		}
		enriched.TotalItems = len(enriched.EnrichedItems)
		result = append(result, enriched)
	}
	return result
}

type ConfirmPickRequest struct {
	PickingOrderID uuid.UUID         `json:"picking_order_id" binding:"required"`
	Items          []ConfirmPickItem `json:"items" binding:"required,min=1"`
}

type ConfirmPickItem struct {
	ProductID  uuid.UUID `json:"product_id" binding:"required"`
	LotID      uuid.UUID `json:"lot_id"`
	LocationID uuid.UUID `json:"location_id"`
	PickedQty  int       `json:"picked_qty" binding:"min=0"`
}

func (s *Service) ConfirmPick(ctx context.Context, req ConfirmPickRequest, userID uuid.UUID) (*domain.PickingOrder, error) {
	po, err := s.repo.GetPickingOrderByID(ctx, req.PickingOrderID)
	if err != nil {
		return nil, fmt.Errorf("picking order not found: %w", err)
	}

	if po.Status != "pending" && po.Status != "in_progress" {
		return nil, fmt.Errorf("picking order status is %s, cannot confirm", po.Status)
	}

	// Parse existing items and update picked quantities
	var existingItems []domain.PickingItem
	if err := json.Unmarshal(po.Items, &existingItems); err != nil {
		return nil, fmt.Errorf("failed to parse picking items: %w", err)
	}

	// Map confirmed picks
	pickMap := make(map[string]int)
	for _, ci := range req.Items {
		key := fmt.Sprintf("%s-%s-%s", ci.ProductID, ci.LotID, ci.LocationID)
		pickMap[key] = ci.PickedQty
	}

	allComplete := true
	for i := range existingItems {
		key := fmt.Sprintf("%s-%s-%s", existingItems[i].ProductID, existingItems[i].LotID, existingItems[i].LocationID)
		if qty, ok := pickMap[key]; ok {
			existingItems[i].PickedQty = qty
		}
		if existingItems[i].PickedQty < existingItems[i].Quantity {
			allComplete = false
		}
	}

	updatedJSON, err := json.Marshal(existingItems)
	if err != nil {
		return nil, err
	}

	newStatus := "in_progress"
	if allComplete {
		newStatus = "completed"
	}

	if err := s.repo.UpdatePickingOrderStatus(ctx, po.ID, newStatus, updatedJSON); err != nil {
		return nil, err
	}

	// When picking is completed → update shipment status to "picked"
	if newStatus == "completed" {
		if err := s.repo.UpdateShipmentStatus(ctx, po.ShipmentID, "picked"); err != nil {
			s.log.Error(ctx, "update_shipment_status_after_pick_failed", err)
		}
	}

	// Notify dispatcher when picking is completed
	if newStatus == "completed" && s.notifSvc != nil {
		link := "/warehouse"
		_ = s.notifSvc.SendToRole(ctx, "dispatcher",
			"Soạn hàng hoàn tất",
			fmt.Sprintf("Lệnh soạn %s đã hoàn tất — sẵn sàng kiểm cổng", po.PickNumber),
			"success", &link)
	}

	po.Status = newStatus
	po.Items = updatedJSON
	return po, nil
}

// ── Picking Order Creation (called from TMS ApprovePlan) ────────────────────

// CreatePickingOrderForShipment creates a picking order for a shipment using FEFO lot suggestion.
// This is the bridge between TMS planning and WMS picking.
func (s *Service) CreatePickingOrderForShipment(ctx context.Context, shipmentID uuid.UUID) (*domain.PickingOrder, error) {
	// 1. Get shipment items and warehouse
	warehouseID, orderID, shipmentItems, err := s.repo.GetShipmentWithItems(ctx, shipmentID)
	if err != nil {
		return nil, fmt.Errorf("get shipment items: %w", err)
	}

	// 2. Generate pick number
	dateStr := time.Now().Format("20060102")
	pickNumber, err := s.repo.NextPickNumber(ctx, dateStr)
	if err != nil {
		return nil, fmt.Errorf("generate pick number: %w", err)
	}

	// 3. Build picking items using FEFO lot suggestion
	var pickingItems []domain.PickingItem
	for _, si := range shipmentItems {
		lots, err := s.repo.SuggestPickingLots(ctx, warehouseID, si.ProductID, si.Quantity)
		if err != nil || len(lots) == 0 {
			// Fallback: create picking item without specific lot (will need manual selection)
			pickingItems = append(pickingItems, domain.PickingItem{
				ProductID: si.ProductID,
				Quantity:  si.Quantity,
				PickedQty: 0,
			})
			continue
		}

		// FEFO: allocate from earliest-expiry lots first
		remaining := si.Quantity
		for _, lot := range lots {
			if remaining <= 0 {
				break
			}
			allocQty := lot.Available
			if allocQty > remaining {
				allocQty = remaining
			}
			pickingItems = append(pickingItems, domain.PickingItem{
				ProductID:  si.ProductID,
				LotID:      lot.LotID,
				LocationID: lot.LocationID,
				Quantity:   allocQty,
				PickedQty:  0,
			})
			remaining -= allocQty
		}
	}

	itemsJSON, err := json.Marshal(pickingItems)
	if err != nil {
		return nil, fmt.Errorf("marshal picking items: %w", err)
	}

	po := domain.PickingOrder{
		PickNumber:  pickNumber,
		ShipmentID:  shipmentID,
		WarehouseID: warehouseID,
		Status:      "pending",
		Items:       itemsJSON,
	}

	id, err := s.repo.CreatePickingOrder(ctx, po)
	if err != nil {
		return nil, fmt.Errorf("create picking order: %w", err)
	}

	// 4. Update shipment status to "picking"
	if err := s.repo.UpdateShipmentStatus(ctx, shipmentID, "picking"); err != nil {
		s.log.Error(ctx, "update_shipment_to_picking_failed", err)
	}

	// 5. Update order status to "processing"
	if err := s.repo.UpdateOrderStatus(ctx, orderID, "processing"); err != nil {
		s.log.Error(ctx, "update_order_to_processing_failed", err)
	}

	po.ID = id
	s.log.Info(ctx, "picking_order_created",
		logger.Field{Key: "pick_number", Value: pickNumber},
		logger.Field{Key: "shipment_id", Value: shipmentID.String()})
	return &po, nil
}

// ── FEFO/FIFO Suggestion ────────────────────────────

func (s *Service) SuggestPickingLots(ctx context.Context, warehouseID, productID uuid.UUID, qty int) ([]domain.StockQuant, error) {
	if qty <= 0 {
		return nil, fmt.Errorf("quantity must be positive")
	}
	return s.repo.SuggestPickingLots(ctx, warehouseID, productID, qty)
}

// ── Gate Check ──────────────────────────────────────

type GateCheckRequest struct {
	TripID       uuid.UUID       `json:"trip_id" binding:"required"`
	ShipmentID   uuid.UUID       `json:"shipment_id" binding:"required"`
	ScannedItems json.RawMessage `json:"scanned_items" binding:"required"`
}

func (s *Service) PerformGateCheck(ctx context.Context, req GateCheckRequest, userID uuid.UUID) (*domain.GateCheck, error) {
	// In a full implementation, we'd fetch expected items from the picking order.
	// For now, the expected items come from the request or from the shipment.
	gc := domain.GateCheck{
		TripID:        req.TripID,
		ShipmentID:    req.ShipmentID,
		ExpectedItems: json.RawMessage("[]"), // Placeholder: would be fetched from picking_orders
		ScannedItems:  req.ScannedItems,
		Result:        "pass",
		CheckedBy:     userID,
	}

	// Compare expected vs scanned
	// R01: discrepancy must be 0 for pass
	var scannedItems []struct {
		ProductID uuid.UUID `json:"product_id"`
		LotID     uuid.UUID `json:"lot_id"`
		Qty       int       `json:"qty"`
	}
	if err := json.Unmarshal(req.ScannedItems, &scannedItems); err != nil {
		return nil, fmt.Errorf("invalid scanned_items format: %w", err)
	}

	// For R01 compliance: any discrepancy → fail
	// Full comparison would need expected items from picking order
	now := time.Now()
	gc.ExitTime = &now

	id, err := s.repo.CreateGateCheck(ctx, gc)
	if err != nil {
		return nil, err
	}

	gc.ID = id
	gc.CreatedAt = now
	return &gc, nil
}

func (s *Service) GetGateChecksByTrip(ctx context.Context, tripID uuid.UUID) ([]domain.GateCheck, error) {
	return s.repo.GetGateChecksByTrip(ctx, tripID)
}

// ── Gate Check Queue (Task 6.12) ────────────────────

type GateCheckQueueItem struct {
	TripID        string `json:"trip_id"`
	TripNumber    string `json:"trip_number"`
	PlateNumber   string `json:"plate_number"`
	DriverName    string `json:"driver_name"`
	TotalStops    int    `json:"total_stops"`
	Status        string `json:"status"`
	DepartureTime string `json:"departure_time"`
}

func (s *Service) GetGateCheckQueue(ctx context.Context) ([]GateCheckQueueItem, error) {
	rows, err := s.repo.db.Query(ctx, `
		SELECT t.id::text, t.trip_number, v.plate_number, COALESCE(u.full_name, ''), 
			t.total_stops, t.status::text, COALESCE(t.departure_time::text, '')
		FROM trips t
		JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN users u ON u.id = t.driver_id
		WHERE t.status::text IN ('ready', 'loaded')
		  AND t.planned_date = CURRENT_DATE
		  AND NOT EXISTS (
			SELECT 1 FROM gate_checks gc WHERE gc.trip_id = t.id AND gc.result = 'pass'
		  )
		ORDER BY t.departure_time ASC NULLS LAST
	`)
	if err != nil {
		return nil, fmt.Errorf("query gate check queue: %w", err)
	}
	defer rows.Close()

	var items []GateCheckQueueItem
	for rows.Next() {
		var i GateCheckQueueItem
		if err := rows.Scan(&i.TripID, &i.TripNumber, &i.PlateNumber, &i.DriverName,
			&i.TotalStops, &i.Status, &i.DepartureTime); err != nil {
			return nil, err
		}
		items = append(items, i)
	}
	if items == nil {
		items = []GateCheckQueueItem{}
	}
	return items, nil
}

// ── Stock Moves List ────────────────────────────────

func (s *Service) GetStockMoves(ctx context.Context, warehouseID uuid.UUID, moveType string) ([]domain.StockMove, error) {
	return s.repo.GetStockMovesByWarehouse(ctx, warehouseID, moveType)
}

// ── Expiry Alerts ───────────────────────────────────

func (s *Service) GetExpiringLots(ctx context.Context, warehouseID *uuid.UUID) ([]domain.StockQuant, error) {
	return s.repo.GetExpiringLots(ctx, warehouseID)
}

// ── Location Hierarchy ──────────────────────────────

func (s *Service) GetLocationsByParent(ctx context.Context, parentPath string) ([]WarehouseLocation, error) {
	if parentPath == "" {
		return nil, fmt.Errorf("parent_path is required")
	}
	return s.repo.GetLocationsByParent(ctx, parentPath)
}

func (s *Service) CreateLocation(ctx context.Context, loc WarehouseLocation) (uuid.UUID, error) {
	if loc.Code == "" || loc.Name == "" {
		return uuid.Nil, fmt.Errorf("code and name are required")
	}
	return s.repo.CreateLocation(ctx, loc)
}

// ── Return Inbound (Task 3.12) ──────────────────────

// PendingReturn represents a return_collection ready for inbound processing.
type PendingReturn = struct {
	ID          uuid.UUID `json:"id"`
	TripStopID  uuid.UUID `json:"trip_stop_id"`
	CustomerID  uuid.UUID `json:"customer_id"`
	AssetType   string    `json:"asset_type"`
	Quantity    int       `json:"quantity"`
	Condition   string    `json:"condition"`
	TripID      uuid.UUID `json:"trip_id"`
	WarehouseID uuid.UUID `json:"warehouse_id"`
}

// GetPendingReturnInbound lists good-condition returns not yet stocked in.
func (s *Service) GetPendingReturnInbound(ctx context.Context, warehouseID uuid.UUID) ([]PendingReturn, error) {
	return s.repo.GetPendingReturns(ctx, warehouseID)
}

// ProcessReturnInbound creates a return_inbound stock move for good-condition returns.
// Per BR-WMS-03: good → tái sử dụng (reusable, put back to stock).
func (s *Service) ProcessReturnInbound(ctx context.Context, returnCollectionID, warehouseID uuid.UUID, userID uuid.UUID) (*domain.StockMove, error) {
	// Verify the return exists and is good condition by checking pending returns
	pending, err := s.repo.GetPendingReturns(ctx, warehouseID)
	if err != nil {
		return nil, fmt.Errorf("get pending returns: %w", err)
	}

	var target *PendingReturn
	for i := range pending {
		if pending[i].ID == returnCollectionID {
			target = &pending[i]
			break
		}
	}
	if target == nil {
		return nil, fmt.Errorf("return_collection không tìm thấy hoặc đã nhập kho")
	}

	moveNumber := fmt.Sprintf("RT-%s", time.Now().Format("20060102-150405"))
	refType := "return_collection"
	items, _ := json.Marshal([]map[string]interface{}{
		{"asset_type": target.AssetType, "quantity": target.Quantity, "condition": target.Condition},
	})

	move := domain.StockMove{
		MoveNumber:    moveNumber,
		MoveType:      "return_inbound",
		WarehouseID:   warehouseID,
		ReferenceType: &refType,
		ReferenceID:   &returnCollectionID,
		Items:         items,
		TotalItems:    target.Quantity,
		CreatedBy:     userID,
	}

	id, err := s.repo.CreateStockMove(ctx, move)
	if err != nil {
		return nil, err
	}
	move.ID = id
	move.CreatedAt = time.Now()
	return &move, nil
}

// ── Asset Compensation (Task 3.13) ──────────────────

// AssetCompensation represents the calculated compensation for a lost asset.
type AssetCompensation struct {
	ReturnCollectionID uuid.UUID `json:"return_collection_id"`
	CustomerID         uuid.UUID `json:"customer_id"`
	AssetType          string    `json:"asset_type"`
	Quantity           int       `json:"quantity"`
	UnitPrice          float64   `json:"unit_price"`
	TotalCompensation  float64   `json:"total_compensation"`
}

// CalculateAssetCompensation calculates compensation for lost assets.
// Per BR-WMS-03: lost → bồi hoàn = qty_lost × asset_price.
func (s *Service) CalculateAssetCompensation(ctx context.Context, warehouseID uuid.UUID) ([]AssetCompensation, float64, error) {
	lost, err := s.repo.GetAllLostReturns(ctx, warehouseID)
	if err != nil {
		return nil, 0, fmt.Errorf("get lost returns: %w", err)
	}

	var results []AssetCompensation
	var grandTotal float64
	for _, lr := range lost {
		price, err := s.repo.GetAssetPrice(ctx, lr.AssetType)
		if err != nil {
			price = 0
		}
		comp := AssetCompensation{
			ReturnCollectionID: lr.ID,
			CustomerID:         lr.CustomerID,
			AssetType:          lr.AssetType,
			Quantity:           lr.Quantity,
			UnitPrice:          price,
			TotalCompensation:  float64(lr.Quantity) * price,
		}
		grandTotal += comp.TotalCompensation
		results = append(results, comp)
	}
	return results, grandTotal, nil
}

// CalculateTripCompensation calculates compensation for lost assets on a specific trip.
func (s *Service) CalculateTripCompensation(ctx context.Context, tripID uuid.UUID) ([]AssetCompensation, float64, error) {
	lost, err := s.repo.GetLostReturnsByTrip(ctx, tripID)
	if err != nil {
		return nil, 0, fmt.Errorf("get lost returns: %w", err)
	}

	var results []AssetCompensation
	var grandTotal float64
	for _, lr := range lost {
		price, err := s.repo.GetAssetPrice(ctx, lr.AssetType)
		if err != nil {
			price = 0
		}
		comp := AssetCompensation{
			ReturnCollectionID: lr.ID,
			CustomerID:         lr.CustomerID,
			AssetType:          lr.AssetType,
			Quantity:           lr.Quantity,
			UnitPrice:          price,
			TotalCompensation:  float64(lr.Quantity) * price,
		}
		grandTotal += comp.TotalCompensation
		results = append(results, comp)
	}
	return results, grandTotal, nil
}

// ── Picking by Vehicle — Vehicle-grouped picking view ────

// VehiclePickingWorkbench groups all picking orders by trip/vehicle for warehouse UI.
type VehiclePickingWorkbench struct {
	TripID         string                 `json:"trip_id"`
	TripNumber     string                 `json:"trip_number"`
	VehiclePlate   string                 `json:"vehicle_plate"`
	DriverName     string                 `json:"driver_name"`
	DepartureTime  string                 `json:"departure_time"`
	PlannedDate    string                 `json:"planned_date"`
	TotalStops     int                    `json:"total_stops"`
	Status         string                 `json:"status"`
	HandoverStatus string                 `json:"handover_status"` // "", "pending", "partially_signed", "completed"
	PickingItems   []VehiclePickingItem   `json:"picking_items"`
	Orders         []VehiclePickingOrder  `json:"orders"`
	Progress       VehiclePickingProgress `json:"progress"`
}

type VehiclePickingItem struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	ProductSKU  string `json:"product_sku"`
	TotalQty    int    `json:"total_qty"`
	PickedQty   int    `json:"picked_qty"`
	FEFOLot     string `json:"fefo_lot"`
	ExpiryDate  string `json:"expiry_date"`
}

type VehiclePickingOrder struct {
	OrderNumber    string             `json:"order_number"`
	CustomerName   string             `json:"customer_name"`
	StopOrder      int                `json:"stop_order"`
	ItemSummary    string             `json:"item_summary"`
	Amount         float64            `json:"amount"`
	PickStatus     string             `json:"pick_status"`
	PickingOrderID string             `json:"picking_order_id"`
	Items          []VehicleOrderItem `json:"items"`
}

type VehicleOrderItem struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	ProductSKU  string `json:"product_sku"`
	LotID       string `json:"lot_id"`
	BatchNumber string `json:"batch_number"`
	ExpiryDate  string `json:"expiry_date"`
	LocationID  string `json:"location_id"`
	Qty         int    `json:"qty"`
	PickedQty   int    `json:"picked_qty"`
}

type VehiclePickingProgress struct {
	TotalItems  int `json:"total_items"`
	PickedItems int `json:"picked_items"`
	Percentage  int `json:"percentage"`
}

func (s *Service) GetPickingByVehicle(ctx context.Context, dateStr string) ([]VehiclePickingWorkbench, error) {
	start := time.Now()

	// Step 1: Get trips that need picking work
	// When no date specified → show ALL active trips (pending picking regardless of date)
	// When date specified → filter by that planned_date
	var rows pgx.Rows
	var err error
	if dateStr != "" {
		rows, err = s.repo.db.Query(ctx, `
			SELECT t.id::text, t.trip_number, COALESCE(v.plate_number, ''),
				COALESCE(d.full_name, ''), t.total_stops, t.status::text,
				COALESCE(t.started_at::text, ''), t.planned_date::text
			FROM trips t
			LEFT JOIN vehicles v ON v.id = t.vehicle_id
			LEFT JOIN drivers d ON d.id = t.driver_id
			WHERE t.planned_date = $1::date
				AND t.status::text NOT IN ('cancelled', 'completed', 'draft')
			ORDER BY t.planned_date DESC, t.started_at ASC NULLS LAST, t.created_at ASC
		`, dateStr)
	} else {
		rows, err = s.repo.db.Query(ctx, `
			SELECT t.id::text, t.trip_number, COALESCE(v.plate_number, ''),
				COALESCE(d.full_name, ''), t.total_stops, t.status::text,
				COALESCE(t.started_at::text, ''), t.planned_date::text
			FROM trips t
			LEFT JOIN vehicles v ON v.id = t.vehicle_id
			LEFT JOIN drivers d ON d.id = t.driver_id
			WHERE t.status::text NOT IN ('cancelled', 'completed', 'draft')
			ORDER BY t.planned_date DESC, t.started_at ASC NULLS LAST, t.created_at ASC
		`)
	}
	if err != nil {
		return nil, fmt.Errorf("query trips: %w", err)
	}
	defer rows.Close()

	type tripInfo struct {
		ID, Number, Plate, Driver string
		Stops                     int
		Status, Departure         string
		PlannedDate               string
	}
	var trips []tripInfo
	for rows.Next() {
		var t tripInfo
		if err := rows.Scan(&t.ID, &t.Number, &t.Plate, &t.Driver, &t.Stops, &t.Status, &t.Departure, &t.PlannedDate); err != nil {
			return nil, err
		}
		trips = append(trips, t)
	}

	results := make([]VehiclePickingWorkbench, 0, len(trips))
	for _, trip := range trips {
		wb := VehiclePickingWorkbench{
			TripID:        trip.ID,
			TripNumber:    trip.Number,
			VehiclePlate:  trip.Plate,
			DriverName:    trip.Driver,
			DepartureTime: trip.Departure,
			PlannedDate:   trip.PlannedDate,
			TotalStops:    trip.Stops,
			Status:        trip.Status,
		}

		// Step 2: Get stops for this trip with order info
		tripUUID, _ := uuid.Parse(trip.ID)
		stopRows, err := s.repo.db.Query(ctx, `
			SELECT ts.stop_order, COALESCE(so.order_number, ''), COALESCE(c.name, ''),
				COALESCE(so.total_amount, 0), ts.shipment_id::text
			FROM trip_stops ts
			LEFT JOIN customers c ON c.id = ts.customer_id
			LEFT JOIN shipments sh ON sh.id = ts.shipment_id
			LEFT JOIN sales_orders so ON so.id = sh.order_id
			WHERE ts.trip_id = $1
			ORDER BY ts.stop_order
		`, tripUUID)
		if err != nil {
			s.log.Error(ctx, "picking_by_vehicle_stops_query_failed", err)
			continue
		}

		type stopInfo struct {
			Order       int
			OrderNumber string
			Customer    string
			Amount      float64
			ShipmentID  string
		}
		var stops []stopInfo
		for stopRows.Next() {
			var si stopInfo
			if err := stopRows.Scan(&si.Order, &si.OrderNumber, &si.Customer, &si.Amount, &si.ShipmentID); err != nil {
				stopRows.Close()
				break
			}
			stops = append(stops, si)
		}
		stopRows.Close()

		// Step 3: Get picking orders for this trip's shipments
		productAgg := make(map[string]*VehiclePickingItem)
		totalItems, pickedItems := 0, 0

		for _, stop := range stops {
			shipmentUUID, _ := uuid.Parse(stop.ShipmentID)
			poRows, err := s.repo.db.Query(ctx, `
				SELECT po.id, po.status::text, po.items
				FROM picking_orders po
				WHERE po.shipment_id = $1
			`, shipmentUUID)
			if err != nil {
				continue
			}

			pickStatus := "pending"
			var pickingOrderID string
			var orderItems []VehicleOrderItem
			for poRows.Next() {
				var poID, poStatus string
				var itemsJSON json.RawMessage
				if err := poRows.Scan(&poID, &poStatus, &itemsJSON); err != nil {
					continue
				}
				pickingOrderID = poID
				if poStatus == "completed" {
					pickStatus = "completed"
				} else if poStatus == "in_progress" {
					pickStatus = "in_progress"
				}

				var items []domain.PickingItem
				if err := json.Unmarshal(itemsJSON, &items); err == nil {
					for _, item := range items {
						// Lookup product name
						var pName, pSKU string
						_ = s.repo.db.QueryRow(ctx,
							`SELECT name, sku FROM products WHERE id = $1`, item.ProductID,
						).Scan(&pName, &pSKU)
						// Lookup lot info
						var batchNum, expDate string
						_ = s.repo.db.QueryRow(ctx,
							`SELECT batch_number, expiry_date::text FROM lots WHERE id = $1`, item.LotID,
						).Scan(&batchNum, &expDate)

						key := item.ProductID.String()
						if _, ok := productAgg[key]; !ok {
							productAgg[key] = &VehiclePickingItem{
								ProductID:   key,
								ProductName: pName,
								ProductSKU:  pSKU,
								FEFOLot:     batchNum,
								ExpiryDate:  expDate,
							}
						}
						productAgg[key].TotalQty += item.Quantity
						productAgg[key].PickedQty += item.PickedQty
						totalItems += item.Quantity
						pickedItems += item.PickedQty

						orderItems = append(orderItems, VehicleOrderItem{
							ProductID:   key,
							ProductName: pName,
							ProductSKU:  pSKU,
							LotID:       item.LotID.String(),
							BatchNumber: batchNum,
							ExpiryDate:  expDate,
							LocationID:  item.LocationID.String(),
							Qty:         item.Quantity,
							PickedQty:   item.PickedQty,
						})
					}
				}
			}
			poRows.Close()

			wb.Orders = append(wb.Orders, VehiclePickingOrder{
				OrderNumber:    stop.OrderNumber,
				CustomerName:   stop.Customer,
				StopOrder:      stop.Order,
				Amount:         stop.Amount,
				PickStatus:     pickStatus,
				PickingOrderID: pickingOrderID,
				Items:          orderItems,
			})
		}

		// Convert product map to slice
		for _, item := range productAgg {
			wb.PickingItems = append(wb.PickingItems, *item)
		}

		pct := 0
		if totalItems > 0 {
			pct = (pickedItems * 100) / totalItems
		}
		wb.Progress = VehiclePickingProgress{
			TotalItems:  totalItems,
			PickedItems: pickedItems,
			Percentage:  pct,
		}

		// Check if handover A already exists for this trip
		var handoverStatus string
		err = s.repo.db.QueryRow(ctx, `
			SELECT status::text FROM handover_records
			WHERE trip_id = $1 AND handover_type = 'A'
			ORDER BY created_at DESC LIMIT 1
		`, tripUUID).Scan(&handoverStatus)
		if err == nil {
			wb.HandoverStatus = handoverStatus
		}

		results = append(results, wb)
	}

	s.log.Info(ctx, "picking_by_vehicle", logger.Field{Key: "date", Value: dateStr}, logger.Field{Key: "vehicles", Value: len(results)}, logger.Field{Key: "duration_ms", Value: time.Since(start).Milliseconds()})
	return results, nil
}

// ── Bottle Classification (Tasks 6.4-6.5) ───────────

type BottleClassification struct {
	ID                  uuid.UUID  `json:"id"`
	TripID              uuid.UUID  `json:"trip_id"`
	TripNumber          string     `json:"trip_number"`
	ProductID           uuid.UUID  `json:"product_id"`
	ProductName         string     `json:"product_name"`
	BottlesSent         int        `json:"bottles_sent"`
	BottlesReturnedGood int        `json:"bottles_returned_good"`
	BottlesReturnedDmg  int        `json:"bottles_returned_damaged"`
	BottlesMissing      int        `json:"bottles_missing"`
	Notes               string     `json:"notes,omitempty"`
	ClassifiedBy        *uuid.UUID `json:"classified_by,omitempty"`
	ClassifiedAt        *time.Time `json:"classified_at,omitempty"`
	CreatedAt           time.Time  `json:"created_at"`
}

type BottleSummary struct {
	TotalSent         int `json:"total_sent"`
	TotalReturnedGood int `json:"total_returned_good"`
	TotalReturnedDmg  int `json:"total_returned_damaged"`
	TotalMissing      int `json:"total_missing"`
	TripsProcessed    int `json:"trips_processed"`
}

func (s *Service) GetBottleClassification(ctx context.Context, tripID uuid.UUID) ([]BottleClassification, error) {
	rows, err := s.repo.db.Query(ctx, `
		SELECT id, trip_id, trip_number, product_id, product_name,
			bottles_sent, bottles_returned_good, bottles_returned_damaged, bottles_missing,
			COALESCE(notes, ''), classified_by, classified_at, created_at
		FROM bottle_classifications
		WHERE trip_id = $1
		ORDER BY product_name
	`, tripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []BottleClassification
	for rows.Next() {
		var b BottleClassification
		if err := rows.Scan(&b.ID, &b.TripID, &b.TripNumber, &b.ProductID, &b.ProductName,
			&b.BottlesSent, &b.BottlesReturnedGood, &b.BottlesReturnedDmg, &b.BottlesMissing,
			&b.Notes, &b.ClassifiedBy, &b.ClassifiedAt, &b.CreatedAt); err != nil {
			continue
		}
		results = append(results, b)
	}
	if results == nil {
		results = []BottleClassification{}
	}
	return results, nil
}

func (s *Service) ClassifyBottles(ctx context.Context, tripID uuid.UUID, tripNumber string,
	productID uuid.UUID, productName string, sent, good, damaged int, notes string, userID uuid.UUID,
) (*BottleClassification, error) {
	missing := sent - good - damaged
	if missing < 0 {
		missing = 0
	}

	var b BottleClassification
	now := time.Now()
	err := s.repo.db.QueryRow(ctx, `
		INSERT INTO bottle_classifications (trip_id, trip_number, product_id, product_name,
			bottles_sent, bottles_returned_good, bottles_returned_damaged, bottles_missing,
			notes, classified_by, classified_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, trip_id, trip_number, product_id, product_name,
			bottles_sent, bottles_returned_good, bottles_returned_damaged, bottles_missing,
			notes, classified_by, classified_at, created_at
	`, tripID, tripNumber, productID, productName, sent, good, damaged, missing,
		notes, userID, now,
	).Scan(&b.ID, &b.TripID, &b.TripNumber, &b.ProductID, &b.ProductName,
		&b.BottlesSent, &b.BottlesReturnedGood, &b.BottlesReturnedDmg, &b.BottlesMissing,
		&b.Notes, &b.ClassifiedBy, &b.ClassifiedAt, &b.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("classify bottles: %w", err)
	}
	return &b, nil
}

func (s *Service) GetBottleSummary(ctx context.Context) (*BottleSummary, error) {
	var summary BottleSummary
	err := s.repo.db.QueryRow(ctx, `
		SELECT COALESCE(SUM(bottles_sent), 0), COALESCE(SUM(bottles_returned_good), 0),
			COALESCE(SUM(bottles_returned_damaged), 0), COALESCE(SUM(bottles_missing), 0),
			COUNT(DISTINCT trip_id)
		FROM bottle_classifications
		WHERE created_at >= CURRENT_DATE
	`).Scan(&summary.TotalSent, &summary.TotalReturnedGood,
		&summary.TotalReturnedDmg, &summary.TotalMissing, &summary.TripsProcessed)
	if err != nil {
		return nil, err
	}
	return &summary, nil
}

// ── Handover (Bàn giao A/B/C) ──────────────────────

type CreateHandoverRequest struct {
	HandoverType string          `json:"handover_type" binding:"required,oneof=A B C"`
	TripID       uuid.UUID       `json:"trip_id" binding:"required"`
	StopID       *uuid.UUID      `json:"stop_id,omitempty"`
	Signatories  json.RawMessage `json:"signatories" binding:"required"`
	PhotoURLs    []string        `json:"photo_urls,omitempty"`
	Items        json.RawMessage `json:"items,omitempty"`
	Notes        *string         `json:"notes,omitempty"`
}

type SignHandoverRequest struct {
	Role         string `json:"role" binding:"required"`
	Action       string `json:"action" binding:"required,oneof=confirm reject"` // confirm or reject
	RejectReason string `json:"reject_reason,omitempty"`
}

func (s *Service) CreateHandover(ctx context.Context, req CreateHandoverRequest, userID uuid.UUID) (*domain.HandoverRecord, error) {
	// Type B requires stop_id
	if req.HandoverType == "B" && req.StopID == nil {
		return nil, fmt.Errorf("bàn giao B yêu cầu stop_id")
	}

	hr := domain.HandoverRecord{
		HandoverType: req.HandoverType,
		TripID:       req.TripID,
		StopID:       req.StopID,
		Signatories:  req.Signatories,
		PhotoURLs:    req.PhotoURLs,
		Items:        req.Items,
		Status:       "pending",
		Notes:        req.Notes,
		CreatedBy:    userID,
	}

	id, err := s.repo.CreateHandoverRecord(ctx, hr)
	if err != nil {
		return nil, fmt.Errorf("tạo bàn giao thất bại: %w", err)
	}

	hr.ID = id
	hr.CreatedAt = time.Now()
	hr.UpdatedAt = hr.CreatedAt

	// Notify driver & security when Handover A is created
	if req.HandoverType == "A" && s.notifSvc != nil {
		// Send to the specific driver assigned to this trip (trips.driver_id → drivers.user_id)
		var driverUserID uuid.UUID
		err2 := s.repo.db.QueryRow(ctx,
			"SELECT d.user_id FROM trips t JOIN drivers d ON t.driver_id = d.id WHERE t.id = $1",
			req.TripID).Scan(&driverUserID)
		if err2 == nil {
			link := fmt.Sprintf("/driver/%s", req.TripID.String())
			_ = s.notifSvc.Send(ctx, driverUserID, "Bàn giao A — Cần xác nhận",
				"Thủ kho đã tạo biên bản bàn giao xuất kho. Vui lòng kiểm tra và xác nhận.", "wms", &link)
		}
		// Send to all security guards at the warehouse
		secLink := "/gate-check"
		_ = s.notifSvc.SendToRole(ctx, "security", "Bàn giao A đã tạo",
			"Biên bản bàn giao xuất kho đã được tạo. Chờ các bên xác nhận.", "wms", &secLink)
	}

	return &hr, nil
}

func (s *Service) SignHandover(ctx context.Context, handoverID uuid.UUID, req SignHandoverRequest, userID uuid.UUID, userName string) (*domain.HandoverRecord, error) {
	hr, err := s.repo.GetHandoverRecord(ctx, handoverID)
	if err != nil {
		return nil, fmt.Errorf("không tìm thấy bàn giao: %w", err)
	}

	if hr.Status == "completed" || hr.Status == "rejected" {
		return nil, fmt.Errorf("bàn giao đã %s, không thể thao tác thêm", hr.Status)
	}

	// Reject flow: any party can reject
	if req.Action == "reject" {
		if req.RejectReason == "" {
			return nil, fmt.Errorf("vui lòng nhập lý do từ chối")
		}
		var signatories []map[string]interface{}
		if err := json.Unmarshal(hr.Signatories, &signatories); err != nil {
			return nil, fmt.Errorf("parse signatories: %w", err)
		}
		for i, sig := range signatories {
			if sig["role"] == req.Role {
				signatories[i]["user_id"] = userID.String()
				signatories[i]["name"] = userName
				signatories[i]["signed_at"] = time.Now().Format(time.RFC3339)
				signatories[i]["action"] = "reject"
				break
			}
		}
		updatedJSON, err := json.Marshal(signatories)
		if err != nil {
			return nil, err
		}
		rejectReason := req.RejectReason
		if err := s.repo.UpdateHandoverReject(ctx, handoverID, updatedJSON, &rejectReason); err != nil {
			return nil, fmt.Errorf("từ chối thất bại: %w", err)
		}
		hr.Signatories = updatedJSON
		hr.Status = "rejected"
		hr.RejectReason = &rejectReason
		return hr, nil
	}

	// Confirm flow

	// Parse existing signatories and add/update this signer
	var signatories []map[string]interface{}
	if err := json.Unmarshal(hr.Signatories, &signatories); err != nil {
		return nil, fmt.Errorf("parse signatories: %w", err)
	}

	now := time.Now()
	signed := false
	for i, sig := range signatories {
		if sig["role"] == req.Role {
			signatories[i]["user_id"] = userID.String()
			signatories[i]["name"] = userName
			signatories[i]["signed_at"] = now.Format(time.RFC3339)
			signatories[i]["action"] = "confirm"
			signed = true
			break
		}
	}
	if !signed {
		return nil, fmt.Errorf("role '%s' không có trong danh sách ký", req.Role)
	}

	// Check if all signatories have signed
	allSigned := true
	for _, sig := range signatories {
		if _, ok := sig["signed_at"]; !ok {
			allSigned = false
			break
		}
	}

	newStatus := "partially_signed"
	if allSigned {
		newStatus = "completed"
	}

	updatedJSON, err := json.Marshal(signatories)
	if err != nil {
		return nil, err
	}

	if err := s.repo.UpdateHandoverSignatories(ctx, handoverID, updatedJSON, newStatus); err != nil {
		return nil, fmt.Errorf("cập nhật chữ ký thất bại: %w", err)
	}

	hr.Signatories = updatedJSON
	hr.Status = newStatus

	// When Handover A is completed → notify
	if newStatus == "completed" && hr.HandoverType == "A" && s.notifSvc != nil {
		link := "/gate-check"
		_ = s.notifSvc.SendToRole(ctx, "security", "Bàn giao A hoàn tất",
			"Tất cả bên đã xác nhận bàn giao xuất kho. Sẵn sàng mở barrier.", "wms", &link)
	}

	return hr, nil
}

func (s *Service) GetHandoversByTrip(ctx context.Context, tripID uuid.UUID) ([]domain.HandoverRecord, error) {
	return s.repo.GetHandoversByTrip(ctx, tripID)
}

func (s *Service) GetHandoverRecord(ctx context.Context, id uuid.UUID) (*domain.HandoverRecord, error) {
	return s.repo.GetHandoverRecord(ctx, id)
}
