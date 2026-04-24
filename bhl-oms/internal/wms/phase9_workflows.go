package wms

// WMS Phase 9 — Workflow services: Inbound (9.5), Putaway (9.6), Picking-by-pallet (9.8),
// Loading scan-to-truck (9.9), Cycle Count (9.11), Realtime Dashboard (9.12),
// Lot distribution / recall (9.14).
//
// All operations stay strictly within physical-quantity scope (DEC-WMS-04 — no Bravo sync,
// no cost layer). FEFO is the only picking strategy (DEC-WMS-02).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"bhl-oms/internal/domain"
)

var (
	ErrPalletNotInStock    = errors.New("pallet không ở trạng thái in_stock")
	ErrPalletWrongTrip     = errors.New("LPN không thuộc trip hiện tại")
	ErrBinFull             = errors.New("bin đã đầy capacity")
	ErrBinNotPickable      = errors.New("bin không cho phép pick")
	ErrPickingNotMatchFEFO = errors.New("LPN không khớp gợi ý FEFO — yêu cầu ghi lý do override")
)

// ─────────────────────────────────────────────────────
// 9.5 INBOUND — receive pallet (NMSX đã đóng pallet sẵn)
// ─────────────────────────────────────────────────────

// ReceivePalletRequest — 1 pallet = 1 lot (WMS-05).
type ReceivePalletRequest struct {
	WarehouseID    uuid.UUID  `json:"warehouse_id" binding:"required"`
	ProductID      uuid.UUID  `json:"product_id" binding:"required"`
	BatchNumber    string     `json:"batch_number" binding:"required"`
	ProductionDate string     `json:"production_date" binding:"required"` // YYYY-MM-DD
	ExpiryDate     string     `json:"expiry_date" binding:"required"`     // YYYY-MM-DD
	Qty            int        `json:"qty" binding:"required,min=1"`
	BinCode        *string    `json:"bin_code"`    // optional — nếu thủ kho đặt thẳng bin
	ReceivedAt     *time.Time `json:"received_at"` // optional — default now()
}

type ReceivePalletResult struct {
	Pallet *domain.Pallet `json:"pallet"`
	ZPL    string         `json:"zpl"` // ZPL string for label printer
}

func (s *Service) ReceivePallet(ctx context.Context, req ReceivePalletRequest, userID uuid.UUID) (*ReceivePalletResult, error) {
	pDate, err := time.Parse("2006-01-02", req.ProductionDate)
	if err != nil {
		return nil, fmt.Errorf("invalid production_date: %w", err)
	}
	eDate, err := time.Parse("2006-01-02", req.ExpiryDate)
	if err != nil {
		return nil, fmt.Errorf("invalid expiry_date: %w", err)
	}
	if !eDate.After(pDate) {
		return nil, fmt.Errorf("expiry_date must be after production_date")
	}

	// Lot get-or-create (reuse existing logic)
	lotID, err := s.repo.GetOrCreateLot(ctx, req.ProductID, req.BatchNumber, req.ProductionDate, req.ExpiryDate)
	if err != nil {
		return nil, fmt.Errorf("lot: %w", err)
	}

	// Resolve optional bin
	var binID *uuid.UUID
	if req.BinCode != nil && *req.BinCode != "" {
		bin, err := s.repo.GetBinByCode(ctx, *req.BinCode)
		if err != nil {
			return nil, fmt.Errorf("bin: %w", err)
		}
		if !bin.IsPickable {
			// staging/quarantine bins are still allowed for inbound
			_ = bin
		}
		binID = &bin.ID
	}

	// Sequence + LPN code
	seq, err := s.repo.NextPalletSeq(ctx)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if req.ReceivedAt != nil {
		now = *req.ReceivedAt
	}
	lpn := GeneratePalletLPN(seq, now)

	// Look up SKU for GS1 payload
	var sku string
	_ = s.repo.db.QueryRow(ctx, `SELECT sku FROM products WHERE id = $1`, req.ProductID).Scan(&sku)

	qrPayload := BuildGS1PalletPayload(lpn, sku, req.BatchNumber, req.ExpiryDate)

	p := &domain.Pallet{
		LPNCode:      lpn,
		WarehouseID:  req.WarehouseID,
		CurrentBinID: binID,
		LotID:        lotID,
		ProductID:    req.ProductID,
		Qty:          req.Qty,
		InitialQty:   req.Qty,
		Status:       "in_stock",
		QRPayload:    qrPayload,
		ReceivedAt:   now,
		CreatedBy:    &userID,
	}
	if err := s.repo.CreatePallet(ctx, p); err != nil {
		return nil, fmt.Errorf("create pallet: %w", err)
	}

	// Increment stock_quants only when bin assigned at inbound time.
	// Otherwise stock is "floating" until putaway moves it into a bin/location.
	if binID != nil {
		if err := s.repo.UpsertStockQuant(ctx, req.ProductID, lotID, req.WarehouseID, *binID, req.Qty); err != nil {
			s.log.Error(ctx, "upsert stock_quant after inbound failed", err)
		}
	}

	// Scan log: putaway action (auto when bin given) or inbound
	action := "inbound"
	if binID != nil {
		action = "putaway"
	}
	whID := req.WarehouseID
	_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
		ScanType: "pallet", QRCode: lpn, Action: action,
		ContextType: ptr("inbound"),
		UserID:      userID, WarehouseID: &whID, Result: "ok",
	})

	// Enrichment for response
	p.BatchNumber = &req.BatchNumber
	p.ExpiryDate = &req.ExpiryDate
	if sku != "" {
		p.ProductSKU = &sku
	}

	zpl := PalletLabelZPL(p.LPNCode, sku, "", req.BatchNumber, req.ExpiryDate, req.Qty, qrPayload)

	return &ReceivePalletResult{Pallet: p, ZPL: zpl}, nil
}

// ─────────────────────────────────────────────────────
// 9.6 PUTAWAY — suggest-bin + confirm move
// ─────────────────────────────────────────────────────

type SuggestBinRequest struct {
	WarehouseID uuid.UUID `json:"warehouse_id" binding:"required"`
	ProductID   uuid.UUID `json:"product_id" binding:"required"`
	LotID       uuid.UUID `json:"lot_id" binding:"required"`
	Qty         int       `json:"qty" binding:"required,min=1"`
}

type BinSuggestion struct {
	Bin             domain.BinLocation `json:"bin"`
	OccupiedPallets int                `json:"occupied_pallets"`
	FreeSlots       int                `json:"free_slots"`
	Score           int                `json:"score"`
	Reason          string             `json:"reason"`
}

func (s *Service) SuggestBins(ctx context.Context, req SuggestBinRequest) ([]BinSuggestion, error) {
	// Fetch all pickable storage bins of the warehouse with current occupancy.
	rows, err := s.repo.db.Query(ctx, `SELECT b.id, b.warehouse_id, b.bin_code, b.zone, b.row_code, b.level_code,
		b.bin_type::text, b.capacity_pallets, b.allowed_sku_categories, b.is_pickable,
		b.velocity_class, b.qr_payload, b.notes, b.created_at, b.updated_at,
		COALESCE(occ.cnt, 0) AS occupied,
		COALESCE(samelot.cnt, 0) AS same_lot_count
		FROM bin_locations b
		LEFT JOIN (SELECT current_bin_id, COUNT(*) AS cnt FROM pallets
		           WHERE status::text NOT IN ('shipped','empty')
		           GROUP BY current_bin_id) occ ON occ.current_bin_id = b.id
		LEFT JOIN (SELECT current_bin_id, COUNT(*) AS cnt FROM pallets
		           WHERE lot_id = $2 AND status::text NOT IN ('shipped','empty')
		           GROUP BY current_bin_id) samelot ON samelot.current_bin_id = b.id
		WHERE b.warehouse_id = $1 AND b.is_pickable = true AND b.bin_type::text = 'storage'`,
		req.WarehouseID, req.LotID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type row struct {
		bin      domain.BinLocation
		occupied int
		sameLot  int
	}
	var candidates []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.bin.ID, &r.bin.WarehouseID, &r.bin.BinCode, &r.bin.Zone, &r.bin.RowCode, &r.bin.LevelCode,
			&r.bin.BinType, &r.bin.CapacityPallets, &r.bin.AllowedSKUCategories, &r.bin.IsPickable,
			&r.bin.VelocityClass, &r.bin.QRPayload, &r.bin.Notes, &r.bin.CreatedAt, &r.bin.UpdatedAt,
			&r.occupied, &r.sameLot); err != nil {
			return nil, err
		}
		if r.occupied < r.bin.CapacityPallets {
			candidates = append(candidates, r)
		}
	}

	// Score: same-lot consolidation (50) + velocity match A=30 (top SKU should be near dock — placeholder, simplified)
	// + free slots ratio (max 20)
	suggestions := make([]BinSuggestion, 0, len(candidates))
	for _, c := range candidates {
		score := 0
		reason := []string{}
		if c.sameLot > 0 {
			score += 50
			reason = append(reason, fmt.Sprintf("đã chứa %d pallet cùng lô", c.sameLot))
		}
		if c.bin.VelocityClass != nil && *c.bin.VelocityClass == "A" {
			score += 30
			reason = append(reason, "vị trí velocity A (gần xuất)")
		}
		free := c.bin.CapacityPallets - c.occupied
		score += min(free*5, 20)
		if free == c.bin.CapacityPallets {
			reason = append(reason, "trống hoàn toàn")
		}
		suggestions = append(suggestions, BinSuggestion{
			Bin: c.bin, OccupiedPallets: c.occupied, FreeSlots: free,
			Score: score, Reason: strings.Join(reason, "; "),
		})
	}

	// Sort desc by score, top 3
	for i := 0; i < len(suggestions); i++ {
		for j := i + 1; j < len(suggestions); j++ {
			if suggestions[j].Score > suggestions[i].Score {
				suggestions[i], suggestions[j] = suggestions[j], suggestions[i]
			}
		}
	}
	if len(suggestions) > 3 {
		suggestions = suggestions[:3]
	}
	return suggestions, nil
}

type PutawayRequest struct {
	LPN      string  `json:"lpn" binding:"required"`
	BinCode  string  `json:"bin_code" binding:"required"`
	Override bool    `json:"override"` // true if not following suggestion
	Reason   *string `json:"reason"`   // required if Override
}

func (s *Service) ConfirmPutaway(ctx context.Context, req PutawayRequest, userID uuid.UUID) (*domain.Pallet, error) {
	if req.Override && (req.Reason == nil || strings.TrimSpace(*req.Reason) == "") {
		return nil, fmt.Errorf("override yêu cầu reason")
	}
	pal, err := s.repo.GetPalletByLPN(ctx, req.LPN)
	if err != nil {
		return nil, err
	}
	if pal.Status != "in_stock" {
		return nil, ErrPalletNotInStock
	}
	bin, err := s.repo.GetBinByCode(ctx, req.BinCode)
	if err != nil {
		return nil, err
	}

	// capacity check
	var occupied int
	_ = s.repo.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM pallets WHERE current_bin_id = $1 AND status::text NOT IN ('shipped','empty')`,
		bin.ID).Scan(&occupied)
	if occupied >= bin.CapacityPallets {
		return nil, ErrBinFull
	}

	// Move pallet
	prevBin := pal.CurrentBinID
	if _, err := s.repo.db.Exec(ctx,
		`UPDATE pallets SET current_bin_id = $1, updated_at = now() WHERE id = $2`,
		bin.ID, pal.ID); err != nil {
		return nil, err
	}

	// Sync stock_quants (decrement old bin, increment new bin) — best-effort
	if prevBin != nil && *prevBin != bin.ID {
		_ = s.adjustStockQuant(ctx, pal.ProductID, pal.LotID, pal.WarehouseID, *prevBin, -pal.Qty)
	}
	if prevBin == nil || *prevBin != bin.ID {
		_ = s.adjustStockQuant(ctx, pal.ProductID, pal.LotID, pal.WarehouseID, bin.ID, pal.Qty)
	}

	whID := pal.WarehouseID
	result := "ok"
	var errMsg *string
	if req.Override {
		result = "ok"
		em := "override: " + *req.Reason
		errMsg = &em
	}
	_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
		ScanType: "pallet", QRCode: pal.LPNCode, Action: "putaway",
		ContextType: ptr("inbound"), UserID: userID, WarehouseID: &whID,
		Result: result, ErrorMsg: errMsg,
	})

	pal.CurrentBinID = &bin.ID
	pal.CurrentBinCode = &bin.BinCode
	return pal, nil
}

// ─────────────────────────────────────────────────────
// 9.8 PICKING by pallet (FEFO chặt)
// ─────────────────────────────────────────────────────

type SuggestedPalletPick struct {
	LPN          string    `json:"lpn"`
	LotID        uuid.UUID `json:"lot_id"`
	BatchNumber  string    `json:"batch_number"`
	ExpiryDate   string    `json:"expiry_date"`
	BinCode      *string   `json:"bin_code,omitempty"`
	AvailableQty int       `json:"available_qty"`
	SuggestedQty int       `json:"suggested_qty"`
}

type SuggestPickingPalletsResult struct {
	ProductID uuid.UUID             `json:"product_id"`
	NeededQty int                   `json:"needed_qty"`
	Pallets   []SuggestedPalletPick `json:"pallets"`
}

// SuggestPickingPallets — list FEFO-ordered pallets to fulfill a quantity for a product.
func (s *Service) SuggestPickingPallets(ctx context.Context, warehouseID, productID uuid.UUID, neededQty int) (*SuggestPickingPalletsResult, error) {
	rows, err := s.repo.db.Query(ctx, `SELECT p.lpn_code, p.lot_id, l.batch_number, l.expiry_date::text,
		b.bin_code, p.qty
		FROM pallets p
		JOIN lots l ON l.id = p.lot_id
		LEFT JOIN bin_locations b ON b.id = p.current_bin_id
		WHERE p.warehouse_id = $1 AND p.product_id = $2 AND p.status::text = 'in_stock' AND p.qty > 0
		ORDER BY l.expiry_date ASC, p.received_at ASC`, warehouseID, productID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := &SuggestPickingPalletsResult{ProductID: productID, NeededQty: neededQty}
	remaining := neededQty
	for rows.Next() {
		if remaining <= 0 {
			break
		}
		var p SuggestedPalletPick
		if err := rows.Scan(&p.LPN, &p.LotID, &p.BatchNumber, &p.ExpiryDate, &p.BinCode, &p.AvailableQty); err != nil {
			return nil, err
		}
		take := p.AvailableQty
		if take > remaining {
			take = remaining
		}
		p.SuggestedQty = take
		out.Pallets = append(out.Pallets, p)
		remaining -= take
	}
	return out, nil
}

type ScanPickRequest struct {
	PickingOrderID uuid.UUID `json:"picking_order_id" binding:"required"`
	LPN            string    `json:"lpn" binding:"required"`
	Qty            int       `json:"qty" binding:"required,min=1"`
	Override       bool      `json:"override"`
	Reason         *string   `json:"reason"`
}

func (s *Service) ScanPick(ctx context.Context, req ScanPickRequest, userID uuid.UUID) (*domain.Pallet, error) {
	pal, err := s.repo.GetPalletByLPN(ctx, req.LPN)
	if err != nil {
		return nil, err
	}
	if pal.Status != "in_stock" && pal.Status != "reserved" {
		return nil, ErrPalletNotInStock
	}
	if req.Qty > pal.Qty {
		return nil, fmt.Errorf("qty (%d) vượt số tồn pallet (%d)", req.Qty, pal.Qty)
	}

	// FEFO check: is there any other pallet of same product+warehouse with EARLIER expiry still in_stock?
	var hasEarlier bool
	_ = s.repo.db.QueryRow(ctx, `SELECT EXISTS (
		SELECT 1 FROM pallets p2
		JOIN lots l2 ON l2.id = p2.lot_id
		JOIN lots lthis ON lthis.id = $1
		WHERE p2.warehouse_id = $2 AND p2.product_id = $3
		  AND p2.status::text = 'in_stock' AND p2.qty > 0
		  AND l2.expiry_date < lthis.expiry_date
	)`, pal.LotID, pal.WarehouseID, pal.ProductID).Scan(&hasEarlier)
	if hasEarlier && !req.Override {
		// Log the mismatch
		whID := pal.WarehouseID
		em := "FEFO mismatch — earlier-expiring pallet exists"
		_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
			ScanType: "pallet", QRCode: pal.LPNCode, Action: "pick",
			ContextType: ptr("picking_order"), ContextID: &req.PickingOrderID,
			UserID: userID, WarehouseID: &whID,
			Result: "error_mismatch", ErrorMsg: &em,
		})
		return nil, ErrPickingNotMatchFEFO
	}
	if req.Override && (req.Reason == nil || strings.TrimSpace(*req.Reason) == "") {
		return nil, fmt.Errorf("override yêu cầu reason")
	}

	// Decrement pallet qty + adjust stock_quants
	newQty := pal.Qty - req.Qty
	newStatus := pal.Status
	if newQty == 0 {
		newStatus = "picked"
	}
	if _, err := s.repo.db.Exec(ctx,
		`UPDATE pallets SET qty = $1, status = $2::pallet_status, reserved_for_picking_id = $3, updated_at = now() WHERE id = $4`,
		newQty, newStatus, req.PickingOrderID, pal.ID); err != nil {
		return nil, err
	}
	if pal.CurrentBinID != nil {
		_ = s.adjustStockQuant(ctx, pal.ProductID, pal.LotID, pal.WarehouseID, *pal.CurrentBinID, -req.Qty)
	}

	whID := pal.WarehouseID
	result := "ok"
	var errMsg *string
	if req.Override {
		em := "override FEFO: " + *req.Reason
		errMsg = &em
	}
	_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
		ScanType: "pallet", QRCode: pal.LPNCode, Action: "pick",
		ContextType: ptr("picking_order"), ContextID: &req.PickingOrderID,
		UserID: userID, WarehouseID: &whID, Result: result, ErrorMsg: errMsg,
	})

	pal.Qty = newQty
	pal.Status = newStatus
	return pal, nil
}

// ─────────────────────────────────────────────────────
// 9.9 LOADING — scan-to-truck
// ─────────────────────────────────────────────────────

type LoadingStartRequest struct {
	TripID      uuid.UUID `json:"trip_id" binding:"required"`
	PlateNumber string    `json:"plate_number" binding:"required"`
}

type LoadingSession struct {
	TripID       uuid.UUID `json:"trip_id"`
	PlateNumber  string    `json:"plate_number"`
	VehicleID    uuid.UUID `json:"vehicle_id"`
	ExpectedLPNs []string  `json:"expected_lpns"`
	LoadedLPNs   []string  `json:"loaded_lpns"`
}

func (s *Service) StartLoading(ctx context.Context, req LoadingStartRequest, userID uuid.UUID) (*LoadingSession, error) {
	// Validate trip exists + plate matches
	var vehicleID uuid.UUID
	var actualPlate string
	err := s.repo.db.QueryRow(ctx, `SELECT t.vehicle_id, v.plate_number FROM trips t
		JOIN vehicles v ON v.id = t.vehicle_id WHERE t.id = $1`, req.TripID).Scan(&vehicleID, &actualPlate)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}
	if !strings.EqualFold(strings.ReplaceAll(actualPlate, "-", ""), strings.ReplaceAll(req.PlateNumber, "-", "")) {
		return nil, fmt.Errorf("biển số quét (%s) không khớp xe của trip (%s)", req.PlateNumber, actualPlate)
	}

	// Expected LPNs = pallets reserved/picked for picking_orders of any shipment of this trip.
	rows, err := s.repo.db.Query(ctx, `SELECT DISTINCT p.lpn_code, p.status::text FROM pallets p
		JOIN picking_orders po ON po.id = p.reserved_for_picking_id
		JOIN shipments s ON s.id = po.shipment_id
		WHERE s.id IN (SELECT shipment_id FROM trip_stops WHERE trip_id = $1)
		   OR EXISTS (SELECT 1 FROM trips t WHERE t.id = $1 AND t.warehouse_id = po.warehouse_id)
		   `, req.TripID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sess := &LoadingSession{TripID: req.TripID, PlateNumber: actualPlate, VehicleID: vehicleID}
	for rows.Next() {
		var lpn, status string
		if err := rows.Scan(&lpn, &status); err != nil {
			continue
		}
		sess.ExpectedLPNs = append(sess.ExpectedLPNs, lpn)
		if status == "loaded" {
			sess.LoadedLPNs = append(sess.LoadedLPNs, lpn)
		}
	}

	whID := uuid.Nil
	_ = s.repo.db.QueryRow(ctx, `SELECT warehouse_id FROM trips WHERE id = $1`, req.TripID).Scan(&whID)
	tripCtxID := req.TripID
	_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
		ScanType: "asset", QRCode: actualPlate, Action: "load",
		ContextType: ptr("trip"), ContextID: &tripCtxID,
		UserID: userID, WarehouseID: nilUUIDPtr(whID), Result: "ok",
	})
	return sess, nil
}

type ScanLoadRequest struct {
	TripID uuid.UUID `json:"trip_id" binding:"required"`
	LPN    string    `json:"lpn" binding:"required"`
}

func (s *Service) ScanLoad(ctx context.Context, req ScanLoadRequest, userID uuid.UUID) (*domain.Pallet, error) {
	pal, err := s.repo.GetPalletByLPN(ctx, req.LPN)
	if err != nil {
		return nil, err
	}
	if pal.Status != "picked" && pal.Status != "in_stock" && pal.Status != "reserved" {
		whID := pal.WarehouseID
		em := "trạng thái pallet không hợp lệ để load: " + pal.Status
		_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
			ScanType: "pallet", QRCode: pal.LPNCode, Action: "load",
			ContextType: ptr("trip"), ContextID: &req.TripID,
			UserID: userID, WarehouseID: &whID,
			Result: "error_mismatch", ErrorMsg: &em,
		})
		return nil, fmt.Errorf("%s", em)
	}

	// Validate pallet belongs to this trip via picking_order → shipment → trip_stops
	if pal.ReservedForPickingID != nil {
		var belongs bool
		_ = s.repo.db.QueryRow(ctx, `SELECT EXISTS (
			SELECT 1 FROM picking_orders po
			JOIN trip_stops ts ON ts.shipment_id = po.shipment_id
			WHERE po.id = $1 AND ts.trip_id = $2
		)`, *pal.ReservedForPickingID, req.TripID).Scan(&belongs)
		if !belongs {
			whID := pal.WarehouseID
			em := ErrPalletWrongTrip.Error()
			_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
				ScanType: "pallet", QRCode: pal.LPNCode, Action: "load",
				ContextType: ptr("trip"), ContextID: &req.TripID,
				UserID: userID, WarehouseID: &whID,
				Result: "error_mismatch", ErrorMsg: &em,
			})
			return nil, ErrPalletWrongTrip
		}
	}

	if _, err := s.repo.db.Exec(ctx,
		`UPDATE pallets SET status = 'loaded'::pallet_status, updated_at = now() WHERE id = $1`,
		pal.ID); err != nil {
		return nil, err
	}

	whID := pal.WarehouseID
	_, _ = s.repo.InsertScanLog(ctx, ScanLogInput{
		ScanType: "pallet", QRCode: pal.LPNCode, Action: "load",
		ContextType: ptr("trip"), ContextID: &req.TripID,
		UserID: userID, WarehouseID: &whID, Result: "ok",
	})
	pal.Status = "loaded"
	return pal, nil
}

// CompleteLoading marks all loaded pallets of a trip as 'shipped' and is normally triggered when the trip starts.
// Exposed via API to let dispatcher manually finalize after Bàn giao A.
func (s *Service) CompleteLoading(ctx context.Context, tripID uuid.UUID, userID uuid.UUID) (int64, error) {
	tag, err := s.repo.db.Exec(ctx, `UPDATE pallets p SET status = 'shipped'::pallet_status, updated_at = now()
		FROM picking_orders po, trip_stops ts
		WHERE p.reserved_for_picking_id = po.id
		  AND po.shipment_id = ts.shipment_id
		  AND ts.trip_id = $1
		  AND p.status::text = 'loaded'`, tripID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ─────────────────────────────────────────────────────
// 9.11 CYCLE COUNT
// ─────────────────────────────────────────────────────

// GenerateCycleCountTasks creates tasks for the given date based on velocity_class:
//
//	A → every bin with class A (weekly cadence)  — caller schedules
//	B → class B
//	C → class C
//
// For simplicity, this method generates tasks for ALL bins matching the requested classes.
type GenerateCycleCountRequest struct {
	WarehouseID     uuid.UUID `json:"warehouse_id" binding:"required"`
	ScheduledDate   string    `json:"scheduled_date" binding:"required"`
	VelocityClasses []string  `json:"velocity_classes"` // default all
}

func (s *Service) GenerateCycleCountTasks(ctx context.Context, req GenerateCycleCountRequest) (int, error) {
	classes := req.VelocityClasses
	if len(classes) == 0 {
		classes = []string{"A", "B", "C"}
	}
	rows, err := s.repo.db.Query(ctx, `SELECT id FROM bin_locations
		WHERE warehouse_id = $1 AND bin_type::text = 'storage'
		AND (velocity_class = ANY($2::text[]) OR velocity_class IS NULL)`,
		req.WarehouseID, classes)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var binIDs []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err == nil {
			binIDs = append(binIDs, id)
		}
	}

	count := 0
	for _, binID := range binIDs {
		// Build expected snapshot: current pallets in bin
		expected, err := s.snapshotBinContents(ctx, binID)
		if err != nil {
			s.log.Error(ctx, "snapshot bin failed", err)
			continue
		}
		expectedJSON, _ := json.Marshal(expected)
		_, err = s.repo.db.Exec(ctx, `INSERT INTO cycle_count_tasks
			(warehouse_id, bin_id, scheduled_date, expected_snapshot, status)
			VALUES ($1, $2, $3::date, $4, 'pending'::cycle_count_status)`,
			req.WarehouseID, binID, req.ScheduledDate, expectedJSON)
		if err != nil {
			continue
		}
		count++
	}
	return count, nil
}

type CycleCountSubmitRequest struct {
	TaskID          uuid.UUID      `json:"task_id" binding:"required"`
	ScannedLPNs     []string       `json:"scanned_lpns" binding:"required"`
	ScannedQtyByLPN map[string]int `json:"scanned_qty_by_lpn"` // optional override
}

type CycleCountVariance struct {
	Missing  []string         `json:"missing"`
	Extra    []string         `json:"extra"`
	QtyDiffs []CycleCountDiff `json:"qty_diffs"`
}

type CycleCountDiff struct {
	LPN         string `json:"lpn"`
	ExpectedQty int    `json:"expected_qty"`
	CountedQty  int    `json:"counted_qty"`
}

func (s *Service) SubmitCycleCount(ctx context.Context, req CycleCountSubmitRequest, userID uuid.UUID) (*domain.CycleCountTask, error) {
	// Load task + expected snapshot
	var task domain.CycleCountTask
	var expectedRaw []byte
	err := s.repo.db.QueryRow(ctx, `SELECT id, warehouse_id, bin_id, scheduled_date::text, assigned_to,
		status::text, expected_snapshot, counted_snapshot, variance, discrepancy_id, completed_at, created_at, updated_at
		FROM cycle_count_tasks WHERE id = $1`, req.TaskID).
		Scan(&task.ID, &task.WarehouseID, &task.BinID, &task.ScheduledDate, &task.AssignedTo,
			&task.Status, &expectedRaw, &task.CountedSnapshot, &task.Variance, &task.DiscrepancyID,
			&task.CompletedAt, &task.CreatedAt, &task.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	expectedMap := map[string]int{}
	if len(expectedRaw) > 0 {
		var arr []map[string]interface{}
		_ = json.Unmarshal(expectedRaw, &arr)
		for _, item := range arr {
			lpn, _ := item["lpn"].(string)
			qtyF, _ := item["qty"].(float64)
			expectedMap[lpn] = int(qtyF)
		}
	}

	// Build variance
	scannedSet := map[string]bool{}
	for _, lpn := range req.ScannedLPNs {
		scannedSet[lpn] = true
	}
	var variance CycleCountVariance
	for lpn := range expectedMap {
		if !scannedSet[lpn] {
			variance.Missing = append(variance.Missing, lpn)
		}
	}
	for _, lpn := range req.ScannedLPNs {
		if _, ok := expectedMap[lpn]; !ok {
			variance.Extra = append(variance.Extra, lpn)
		} else if cq, has := req.ScannedQtyByLPN[lpn]; has && cq != expectedMap[lpn] {
			variance.QtyDiffs = append(variance.QtyDiffs, CycleCountDiff{LPN: lpn, ExpectedQty: expectedMap[lpn], CountedQty: cq})
		}
	}

	countedSnapshot, _ := json.Marshal(req.ScannedLPNs)
	varianceJSON, _ := json.Marshal(variance)

	hasVariance := len(variance.Missing) > 0 || len(variance.Extra) > 0 || len(variance.QtyDiffs) > 0
	var discID *uuid.UUID
	if hasVariance {
		// Auto-create discrepancy in reconciliation table (NULL trip_id, NULL stop_id, type=cycle_count_<missing|extra>)
		var newID uuid.UUID
		desc := fmt.Sprintf("Cycle count bin %s: %d missing, %d extra, %d qty diff",
			task.BinID, len(variance.Missing), len(variance.Extra), len(variance.QtyDiffs))
		err := s.repo.db.QueryRow(ctx, `INSERT INTO discrepancies
			(disc_type, status, description, deadline)
			VALUES ('cycle_count', 'open', $1, now() + interval '1 day')
			RETURNING id`, desc).Scan(&newID)
		if err == nil {
			discID = &newID
		} else {
			s.log.Error(ctx, "create cycle-count discrepancy failed", err)
		}
	}

	if _, err := s.repo.db.Exec(ctx, `UPDATE cycle_count_tasks
		SET status = 'completed'::cycle_count_status, counted_snapshot = $1, variance = $2,
		    discrepancy_id = $3, completed_at = now(), assigned_to = COALESCE(assigned_to, $4), updated_at = now()
		WHERE id = $5`,
		countedSnapshot, varianceJSON, discID, userID, req.TaskID); err != nil {
		return nil, err
	}

	task.Status = "completed"
	task.CountedSnapshot = countedSnapshot
	task.Variance = varianceJSON
	task.DiscrepancyID = discID
	return &task, nil
}

// ─────────────────────────────────────────────────────
// 9.12 REALTIME DASHBOARD — 4 alerts
// ─────────────────────────────────────────────────────

type DashboardAlerts struct {
	LowSafetyStock    []map[string]interface{} `json:"low_safety_stock"`     // 🟠
	NearExpiryHighQty []map[string]interface{} `json:"near_expiry_high_qty"` // 🔴
	BinsOver90        []map[string]interface{} `json:"bins_over_90"`         // 🟡
	OrphanPallets     []map[string]interface{} `json:"orphan_pallets"`       // 🟣
}

func (s *Service) GetDashboardAlerts(ctx context.Context, warehouseID *uuid.UUID) (*DashboardAlerts, error) {
	out := &DashboardAlerts{}

	// 🟠 Low safety stock — uses products.safety_stock if column exists, else heuristic threshold.
	// Query stock_quants aggregated by product.
	var whFilter string
	args := []interface{}{}
	if warehouseID != nil {
		whFilter = "WHERE sq.warehouse_id = $1"
		args = append(args, *warehouseID)
	}
	rows, err := s.repo.db.Query(ctx, `SELECT p.id, p.sku, p.name, sq.warehouse_id, SUM(sq.quantity) AS total_qty
		FROM stock_quants sq JOIN products p ON p.id = sq.product_id
		`+whFilter+`
		GROUP BY p.id, p.sku, p.name, sq.warehouse_id
		HAVING SUM(sq.quantity) < 100
		ORDER BY total_qty ASC LIMIT 20`, args...)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pid, whID uuid.UUID
			var sku, name string
			var qty int
			if err := rows.Scan(&pid, &sku, &name, &whID, &qty); err == nil {
				out.LowSafetyStock = append(out.LowSafetyStock, map[string]interface{}{
					"product_id": pid, "sku": sku, "name": name, "warehouse_id": whID, "qty": qty,
				})
			}
		}
	}

	// 🔴 Near-expiry high qty (HSD < 30 days, qty >= 50)
	args2 := []interface{}{}
	whFilter = ""
	if warehouseID != nil {
		whFilter = "AND p.warehouse_id = $1"
		args2 = append(args2, *warehouseID)
	}
	rows2, err := s.repo.db.Query(ctx, `SELECT p.lpn_code, l.batch_number, l.expiry_date::text, p.qty, p.warehouse_id
		FROM pallets p JOIN lots l ON l.id = p.lot_id
		WHERE p.status::text = 'in_stock' AND p.qty >= 50
		  AND l.expiry_date <= CURRENT_DATE + interval '30 days'
		  `+whFilter+`
		ORDER BY l.expiry_date ASC LIMIT 30`, args2...)
	if err == nil {
		defer rows2.Close()
		for rows2.Next() {
			var lpn, batch, exp string
			var qty int
			var whID uuid.UUID
			if err := rows2.Scan(&lpn, &batch, &exp, &qty, &whID); err == nil {
				out.NearExpiryHighQty = append(out.NearExpiryHighQty, map[string]interface{}{
					"lpn": lpn, "batch": batch, "expiry": exp, "qty": qty, "warehouse_id": whID,
				})
			}
		}
	}

	// 🟡 Bins over 90% capacity
	args3 := []interface{}{}
	whFilter = ""
	if warehouseID != nil {
		whFilter = "WHERE b.warehouse_id = $1"
		args3 = append(args3, *warehouseID)
	}
	rows3, err := s.repo.db.Query(ctx, `SELECT b.bin_code, b.warehouse_id, b.capacity_pallets, COUNT(p.id) AS occupied
		FROM bin_locations b
		LEFT JOIN pallets p ON p.current_bin_id = b.id AND p.status::text NOT IN ('shipped','empty')
		`+whFilter+`
		GROUP BY b.id
		HAVING COUNT(p.id) >= b.capacity_pallets * 0.9
		ORDER BY occupied DESC LIMIT 20`, args3...)
	if err == nil {
		defer rows3.Close()
		for rows3.Next() {
			var code string
			var whID uuid.UUID
			var cap, occ int
			if err := rows3.Scan(&code, &whID, &cap, &occ); err == nil {
				out.BinsOver90 = append(out.BinsOver90, map[string]interface{}{
					"bin_code": code, "warehouse_id": whID, "capacity": cap, "occupied": occ,
				})
			}
		}
	}

	// 🟣 Orphan pallets — in_stock at staging/dock for >7 days
	args4 := []interface{}{}
	whFilter = ""
	if warehouseID != nil {
		whFilter = "AND p.warehouse_id = $1"
		args4 = append(args4, *warehouseID)
	}
	rows4, err := s.repo.db.Query(ctx, `SELECT p.lpn_code, p.warehouse_id, b.bin_code, p.received_at, p.qty
		FROM pallets p
		LEFT JOIN bin_locations b ON b.id = p.current_bin_id
		WHERE p.status::text = 'in_stock'
		  AND p.received_at < now() - interval '7 days'
		  AND (b.bin_type::text IN ('staging','dock') OR p.current_bin_id IS NULL)
		  `+whFilter+`
		ORDER BY p.received_at ASC LIMIT 30`, args4...)
	if err == nil {
		defer rows4.Close()
		for rows4.Next() {
			var lpn string
			var whID uuid.UUID
			var binCode *string
			var receivedAt time.Time
			var qty int
			if err := rows4.Scan(&lpn, &whID, &binCode, &receivedAt, &qty); err == nil {
				out.OrphanPallets = append(out.OrphanPallets, map[string]interface{}{
					"lpn": lpn, "warehouse_id": whID, "bin_code": binCode,
					"received_at": receivedAt, "qty": qty,
				})
			}
		}
	}
	return out, nil
}

// ─────────────────────────────────────────────────────
// 9.14 TRACEABILITY — lot distribution / recall
// ─────────────────────────────────────────────────────

type LotDistributionItem struct {
	CustomerID   uuid.UUID `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	TripID       uuid.UUID `json:"trip_id"`
	TripNumber   string    `json:"trip_number"`
	LPN          string    `json:"lpn"`
	DeliveredQty int       `json:"delivered_qty"`
	DeliveredAt  time.Time `json:"delivered_at"`
}

func (s *Service) GetLotDistribution(ctx context.Context, lotID uuid.UUID) ([]LotDistributionItem, error) {
	rows, err := s.repo.db.Query(ctx, `SELECT c.id, c.name, t.id, t.trip_number, p.lpn_code, p.initial_qty, COALESCE(t.completed_at, t.started_at, t.created_at)
		FROM pallets p
		LEFT JOIN picking_orders po ON po.id = p.reserved_for_picking_id
		LEFT JOIN shipments sh ON sh.id = po.shipment_id
		LEFT JOIN customers c ON c.id = sh.customer_id
		LEFT JOIN trip_stops ts ON ts.shipment_id = sh.id
		LEFT JOIN trips t ON t.id = ts.trip_id
		WHERE p.lot_id = $1 AND p.status::text IN ('loaded','shipped')
		ORDER BY t.created_at DESC`, lotID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []LotDistributionItem
	for rows.Next() {
		var item LotDistributionItem
		var custID, tripID *uuid.UUID
		var custName, tripNumber *string
		var deliveredAt *time.Time
		if err := rows.Scan(&custID, &custName, &tripID, &tripNumber, &item.LPN, &item.DeliveredQty, &deliveredAt); err != nil {
			continue
		}
		if custID != nil {
			item.CustomerID = *custID
		}
		if custName != nil {
			item.CustomerName = *custName
		}
		if tripID != nil {
			item.TripID = *tripID
		}
		if tripNumber != nil {
			item.TripNumber = *tripNumber
		}
		if deliveredAt != nil {
			item.DeliveredAt = *deliveredAt
		}
		out = append(out, item)
	}
	return out, nil
}

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────

func (s *Service) snapshotBinContents(ctx context.Context, binID uuid.UUID) ([]map[string]interface{}, error) {
	rows, err := s.repo.db.Query(ctx, `SELECT lpn_code, qty FROM pallets
		WHERE current_bin_id = $1 AND status::text NOT IN ('shipped','empty')`, binID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []map[string]interface{}
	for rows.Next() {
		var lpn string
		var qty int
		if err := rows.Scan(&lpn, &qty); err == nil {
			out = append(out, map[string]interface{}{"lpn": lpn, "qty": qty})
		}
	}
	return out, nil
}

// adjustStockQuant: best-effort delta (positive add, negative subtract). Falls back to upsert.
func (s *Service) adjustStockQuant(ctx context.Context, productID, lotID, warehouseID, locationID uuid.UUID, delta int) error {
	if delta == 0 {
		return nil
	}
	// Try update first
	tag, err := s.repo.db.Exec(ctx, `UPDATE stock_quants
		SET quantity = quantity + $1, updated_at = now()
		WHERE product_id = $2 AND lot_id = $3 AND warehouse_id = $4 AND location_id = $5`,
		delta, productID, lotID, warehouseID, locationID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 && delta > 0 {
		return s.repo.UpsertStockQuant(ctx, productID, lotID, warehouseID, locationID, delta)
	}
	// Avoid negatives by clamping at 0 (safe-guard)
	_, _ = s.repo.db.Exec(ctx, `UPDATE stock_quants SET quantity = 0
		WHERE product_id = $1 AND lot_id = $2 AND warehouse_id = $3 AND location_id = $4 AND quantity < 0`,
		productID, lotID, warehouseID, locationID)
	return nil
}

func ptr(s string) *string { return &s }

func nilUUIDPtr(u uuid.UUID) *uuid.UUID {
	if u == uuid.Nil {
		return nil
	}
	return &u
}

// silence unused for pgx import in workflow file
var _ = pgx.ErrNoRows
