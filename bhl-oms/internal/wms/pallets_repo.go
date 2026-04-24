package wms

// WMS Phase 9 — Repository for pallets, bin_locations, qr_scan_log, cycle_count_tasks.
// DEC-WMS-01..04. Layer mới — KHÔNG đụng repository cũ.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"bhl-oms/internal/domain"
)

var ErrBinNotFound = errors.New("bin not found")
var ErrPalletNotFound = errors.New("pallet not found")

// ── Bin Locations ───────────────────────────────────

type BinFilter struct {
	WarehouseID *uuid.UUID
	BinType     *string
	IsPickable  *bool
	Limit       int
	Offset      int
}

func (r *Repository) ListBins(ctx context.Context, f BinFilter) ([]domain.BinLocation, int64, error) {
	args := []interface{}{}
	where := []string{"1=1"}
	idx := 1
	if f.WarehouseID != nil {
		where = append(where, fmt.Sprintf("warehouse_id = $%d", idx))
		args = append(args, *f.WarehouseID)
		idx++
	}
	if f.BinType != nil {
		where = append(where, fmt.Sprintf("bin_type::text = $%d", idx))
		args = append(args, *f.BinType)
		idx++
	}
	if f.IsPickable != nil {
		where = append(where, fmt.Sprintf("is_pickable = $%d", idx))
		args = append(args, *f.IsPickable)
		idx++
	}
	whereSQL := strings.Join(where, " AND ")

	var total int64
	if err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM bin_locations WHERE "+whereSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	limit := f.Limit
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	args = append(args, limit, f.Offset)
	q := fmt.Sprintf(`SELECT id, warehouse_id, bin_code, zone, row_code, level_code,
		bin_type::text, capacity_pallets, allowed_sku_categories, is_pickable,
		velocity_class, qr_payload, notes, created_at, updated_at
		FROM bin_locations WHERE %s ORDER BY bin_code ASC LIMIT $%d OFFSET $%d`,
		whereSQL, idx, idx+1)

	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []domain.BinLocation
	for rows.Next() {
		var b domain.BinLocation
		if err := rows.Scan(&b.ID, &b.WarehouseID, &b.BinCode, &b.Zone, &b.RowCode, &b.LevelCode,
			&b.BinType, &b.CapacityPallets, &b.AllowedSKUCategories, &b.IsPickable,
			&b.VelocityClass, &b.QRPayload, &b.Notes, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, 0, err
		}
		out = append(out, b)
	}
	return out, total, nil
}

func (r *Repository) GetBinByCode(ctx context.Context, code string) (*domain.BinLocation, error) {
	var b domain.BinLocation
	err := r.db.QueryRow(ctx, `SELECT id, warehouse_id, bin_code, zone, row_code, level_code,
		bin_type::text, capacity_pallets, allowed_sku_categories, is_pickable,
		velocity_class, qr_payload, notes, created_at, updated_at
		FROM bin_locations WHERE bin_code = $1`, code).
		Scan(&b.ID, &b.WarehouseID, &b.BinCode, &b.Zone, &b.RowCode, &b.LevelCode,
			&b.BinType, &b.CapacityPallets, &b.AllowedSKUCategories, &b.IsPickable,
			&b.VelocityClass, &b.QRPayload, &b.Notes, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBinNotFound
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

func (r *Repository) CreateBin(ctx context.Context, b *domain.BinLocation) error {
	return r.db.QueryRow(ctx, `INSERT INTO bin_locations
		(warehouse_id, bin_code, zone, row_code, level_code, bin_type, capacity_pallets,
		 allowed_sku_categories, is_pickable, velocity_class, qr_payload, notes)
		VALUES ($1,$2,$3,$4,$5,$6::bin_type,$7,$8,$9,$10,$11,$12)
		RETURNING id, created_at, updated_at`,
		b.WarehouseID, b.BinCode, b.Zone, b.RowCode, b.LevelCode,
		b.BinType, b.CapacityPallets, b.AllowedSKUCategories,
		b.IsPickable, b.VelocityClass, b.QRPayload, b.Notes).
		Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
}

// GetBinContents returns all in_stock pallets currently parked in a bin.
func (r *Repository) GetBinContents(ctx context.Context, binID uuid.UUID) ([]domain.Pallet, error) {
	rows, err := r.db.Query(ctx, `SELECT p.id, p.lpn_code, p.warehouse_id, p.current_bin_id,
		p.lot_id, l.batch_number, l.expiry_date::text,
		p.product_id, pr.name, pr.sku,
		p.qty, p.initial_qty, p.status::text,
		p.reserved_for_picking_id, p.qr_payload, p.received_at,
		p.created_by, p.created_at, p.updated_at
		FROM pallets p
		JOIN lots l ON l.id = p.lot_id
		JOIN products pr ON pr.id = p.product_id
		WHERE p.current_bin_id = $1 AND p.status::text != 'shipped' AND p.status::text != 'empty'
		ORDER BY l.expiry_date ASC, p.received_at ASC`, binID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanPalletRows(rows)
}

// ── Pallets ─────────────────────────────────────────

func (r *Repository) NextPalletSeq(ctx context.Context) (int64, error) {
	// Use a per-day rolling sequence based on count of pallets created today + 1.
	// For high-volume production, replace by a real PostgreSQL sequence.
	var seq int64
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) + 1 FROM pallets WHERE created_at::date = CURRENT_DATE`).Scan(&seq)
	return seq, err
}

func (r *Repository) GetPalletByLPN(ctx context.Context, lpn string) (*domain.Pallet, error) {
	row := r.db.QueryRow(ctx, `SELECT p.id, p.lpn_code, p.warehouse_id, p.current_bin_id,
		p.lot_id, l.batch_number, l.expiry_date::text,
		p.product_id, pr.name, pr.sku,
		p.qty, p.initial_qty, p.status::text,
		p.reserved_for_picking_id, p.qr_payload, p.received_at,
		p.created_by, p.created_at, p.updated_at
		FROM pallets p
		JOIN lots l ON l.id = p.lot_id
		JOIN products pr ON pr.id = p.product_id
		WHERE p.lpn_code = $1`, lpn)

	p := domain.Pallet{}
	if err := row.Scan(&p.ID, &p.LPNCode, &p.WarehouseID, &p.CurrentBinID,
		&p.LotID, &p.BatchNumber, &p.ExpiryDate,
		&p.ProductID, &p.ProductName, &p.ProductSKU,
		&p.Qty, &p.InitialQty, &p.Status,
		&p.ReservedForPickingID, &p.QRPayload, &p.ReceivedAt,
		&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrPalletNotFound
		}
		return nil, err
	}

	// Enrich: bin_code if bin assigned
	if p.CurrentBinID != nil {
		var code string
		if err := r.db.QueryRow(ctx, `SELECT bin_code FROM bin_locations WHERE id = $1`, *p.CurrentBinID).Scan(&code); err == nil {
			p.CurrentBinCode = &code
		}
	}
	return &p, nil
}

// CreatePallet inserts a new pallet record (used by inbound — Sprint 2).
func (r *Repository) CreatePallet(ctx context.Context, p *domain.Pallet) error {
	return r.db.QueryRow(ctx, `INSERT INTO pallets
		(lpn_code, warehouse_id, current_bin_id, lot_id, product_id, qty, initial_qty,
		 status, qr_payload, received_at, created_by)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8::pallet_status,$9,$10,$11)
		RETURNING id, created_at, updated_at`,
		p.LPNCode, p.WarehouseID, p.CurrentBinID, p.LotID, p.ProductID,
		p.Qty, p.InitialQty, p.Status, p.QRPayload, p.ReceivedAt, p.CreatedBy).
		Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
}

func scanPalletRows(rows pgx.Rows) ([]domain.Pallet, error) {
	var out []domain.Pallet
	for rows.Next() {
		var p domain.Pallet
		if err := rows.Scan(&p.ID, &p.LPNCode, &p.WarehouseID, &p.CurrentBinID,
			&p.LotID, &p.BatchNumber, &p.ExpiryDate,
			&p.ProductID, &p.ProductName, &p.ProductSKU,
			&p.Qty, &p.InitialQty, &p.Status,
			&p.ReservedForPickingID, &p.QRPayload, &p.ReceivedAt,
			&p.CreatedBy, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// ── QR Scan Log (immutable, append-only) ────────────

type ScanLogInput struct {
	ScanType    string
	QRCode      string
	Action      string
	ContextType *string
	ContextID   *uuid.UUID
	UserID      uuid.UUID
	WarehouseID *uuid.UUID
	DeviceInfo  json.RawMessage
	Result      string
	ErrorMsg    *string
}

func (r *Repository) InsertScanLog(ctx context.Context, in ScanLogInput) (int64, error) {
	var id int64
	err := r.db.QueryRow(ctx, `INSERT INTO qr_scan_log
		(scan_type, qr_code, action, context_type, context_id, user_id, warehouse_id,
		 device_info, result, error_msg)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
		in.ScanType, in.QRCode, in.Action, in.ContextType, in.ContextID, in.UserID,
		in.WarehouseID, in.DeviceInfo, in.Result, in.ErrorMsg).Scan(&id)
	return id, err
}

// GetPalletHistory — scans related to a given LPN (US-WMS-31).
func (r *Repository) GetPalletHistory(ctx context.Context, lpn string, limit int) ([]domain.QRScanLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := r.db.Query(ctx, `SELECT id, scan_type, qr_code, action, context_type, context_id,
		user_id, warehouse_id, device_info, result, error_msg, scanned_at
		FROM qr_scan_log WHERE qr_code = $1 OR qr_code LIKE $2
		ORDER BY scanned_at DESC LIMIT $3`, lpn, "%"+lpn+"%", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.QRScanLog
	for rows.Next() {
		var l domain.QRScanLog
		if err := rows.Scan(&l.ID, &l.ScanType, &l.QRCode, &l.Action, &l.ContextType, &l.ContextID,
			&l.UserID, &l.WarehouseID, &l.DeviceInfo, &l.Result, &l.ErrorMsg, &l.ScannedAt); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, nil
}
