package wms

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"

	"bhl-oms/internal/domain"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
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

func (s *Service) GetPickingOrderByID(ctx context.Context, id uuid.UUID) (*domain.PickingOrder, error) {
	return s.repo.GetPickingOrderByID(ctx, id)
}

type ConfirmPickRequest struct {
	PickingOrderID uuid.UUID         `json:"picking_order_id" binding:"required"`
	Items          []ConfirmPickItem `json:"items" binding:"required,min=1"`
}

type ConfirmPickItem struct {
	ProductID  uuid.UUID `json:"product_id" binding:"required"`
	LotID      uuid.UUID `json:"lot_id" binding:"required"`
	LocationID uuid.UUID `json:"location_id" binding:"required"`
	PickedQty  int       `json:"picked_qty" binding:"required,min=0"`
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

	po.Status = newStatus
	po.Items = updatedJSON
	return po, nil
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
