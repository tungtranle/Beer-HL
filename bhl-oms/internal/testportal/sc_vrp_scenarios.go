package testportal

// sc_vrp_scenarios.go — DEMO-VRP-01 và DEMO-VRP-02
//
// DEMO-VRP-01: VRP chuẩn sản xuất — 50 xe thực WH-HL, 50 tài xế,
//              105 đơn thực 13/06/2024 (~156+ shipments ≤7.5T, ~736T), owned AQF.
// DEMO-VRP-02: VRP so sánh phương án — cùng fleet 50 xe thực, đơn đa dạng trọng lượng.
//
// Cleanup: driver_checkins → hard DELETE (owned only)
//          vehicles        → UPDATE status='inactive' (soft delete, no FK violation)
//          shipments + order_items + sales_orders → DELETE owned

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// ─────────────────────────────────────────────────────────────
// DEMO-VRP-01: VRP chuẩn sản xuất (thực 13/06/2024)
// ─────────────────────────────────────────────────────────────

func (s *DemoService) seedVRPLargeFleet(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	// ── 1) Master data IDs ──
	var whHL, dvkhUserID uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT id FROM warehouses WHERE code = 'WH-HL'`).Scan(&whHL); err != nil {
		return 0, fmt.Errorf("wh_hl: %w", err)
	}
	if err := tx.QueryRow(ctx, `SELECT id FROM users WHERE role::text = 'dvkh' LIMIT 1`).Scan(&dvkhUserID); err != nil {
		return 0, fmt.Errorf("dvkh_user: %w", err)
	}

	// ── 2) Boost stock (WH-HL only — không chạm stock kho khác) ──
	if _, err := tx.Exec(ctx, `UPDATE stock_quants SET quantity = 500000, reserved_qty = 0 WHERE warehouse_id = $1`, whHL); err != nil {
		return created, fmt.Errorf("boost_stock: %w", err)
	}

	// ── 3) Check-in 50 tài xế active (sử dụng fleet 50 xe thực WH-HL) ──
	//    ON CONFLICT DO NOTHING → chỉ track ownership cho checkin do chúng ta tạo
	driverRows, err := tx.Query(ctx, `SELECT id FROM drivers WHERE status = 'active' ORDER BY full_name LIMIT 50`)
	if err != nil {
		return created, fmt.Errorf("list_drivers: %w", err)
	}
	var driverIDs []uuid.UUID
	for driverRows.Next() {
		var did uuid.UUID
		if err := driverRows.Scan(&did); err != nil {
			driverRows.Close()
			return created, fmt.Errorf("scan_driver: %w", err)
		}
		driverIDs = append(driverIDs, did)
	}
	driverRows.Close()

	for _, did := range driverIDs {
		var checkinID uuid.UUID
		err := tx.QueryRow(ctx, `
			INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
			VALUES ($1, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour')
			ON CONFLICT (driver_id, checkin_date) DO NOTHING
			RETURNING id
		`, did).Scan(&checkinID)
		if err != nil {
			// Conflict → row không được tạo mới → không track ownership (existing record)
			continue
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "driver_checkins", checkinID); err != nil {
			return created, err
		}
		created++
	}

	// ── 5) 105 đơn hàng thực tế 13/06/2024 ──
	type orderSpec struct {
		code         string
		customerCode string
		sku          string
		qty          int
	}
	type prodInfo struct {
		weight float64
		price  float64
	}
	prods := map[string]prodInfo{
		"BHL-LON-330":   {8.5, 180000},
		"BHL-CHAI-450":  {14.0, 250000},
		"BHL-CHAI-355":  {15.0, 250000},
		"BHL-DRAFT-30":  {32.0, 800000},
		"NGK-CHANH-330": {25.2, 180000},
	}

	orders := []orderSpec{
		{"DH-001", "BG-112", "BHL-CHAI-450", 140},
		{"DH-002", "BN-24", "BHL-DRAFT-30", 352},
		{"DH-003", "QY-121", "BHL-CHAI-355", 130},
		{"DH-004", "HD-54", "BHL-LON-330", 600},
		{"DH-005", "QN-HH", "BHL-DRAFT-30", 220},
		{"DH-006", "TY-122", "BHL-DRAFT-30", 130},
		{"DH-007", "VD2-143", "BHL-DRAFT-30", 105},
		{"DH-008", "NT1-3-110", "BHL-DRAFT-30", 50},
		{"DH-009", "HD-70", "BHL-DRAFT-30", 845},
		{"DH-010", "HP-4745", "BHL-DRAFT-30", 320},
		{"DH-011", "MC4-93", "BHL-LON-330", 1900},
		{"DH-012", "QN-HH2", "BHL-LON-330", 800},
		{"DH-013", "QN-HH", "BHL-LON-330", 1900},
		{"DH-014", "TB-133", "BHL-DRAFT-30", 1180},
		{"DH-015", "NG-109", "BHL-DRAFT-30", 360},
		{"DH-016", "NT6BC-115", "BHL-DRAFT-30", 76},
		{"DH-017", "HH2-70", "BHL-CHAI-355", 400},
		{"DH-018", "CP2-29", "BHL-CHAI-355", 150},
		{"DH-019", "NĐ-4766", "BHL-CHAI-355", 25},
		{"DH-020", "NĐ-4767", "BHL-DRAFT-30", 90},
		{"DH-021", "HB-73", "BHL-LON-330", 1800},
		{"DH-022", "TB-125", "BHL-DRAFT-30", 670},
		{"DH-023", "QN-TN", "BHL-DRAFT-30", 140},
		{"DH-024", "HH1-35", "BHL-DRAFT-30", 110},
		{"DH-025", "HNI-48", "BHL-LON-330", 3600},
		{"DH-026", "TN-4793", "BHL-DRAFT-30", 360},
		{"DH-027", "HH2-69", "BHL-LON-330", 1900},
		{"DH-028", "DT1-34", "BHL-LON-330", 3520},
		{"DH-029", "TY-122", "BHL-DRAFT-30", 130},
		{"DH-030", "QN-HH2", "BHL-LON-330", 800},
		{"DH-031", "HD-70", "BHL-CHAI-355", 5},
		{"DH-032", "HD-54", "BHL-LON-330", 600},
		{"DH-033", "QN-HH", "BHL-DRAFT-30", 100},
		{"DH-034", "HH1-35", "BHL-DRAFT-30", 110},
		{"DH-035", "QY-121", "BHL-CHAI-355", 130},
		{"DH-036", "HD-70", "BHL-DRAFT-30", 110},
		{"DH-037", "HD-70", "BHL-DRAFT-30", 165},
		{"DH-038", "BG-112", "BHL-CHAI-450", 140},
		{"DH-039", "CP2-29", "BHL-LON-330", 850},
		{"DH-040", "CP2-29", "BHL-CHAI-355", 150},
		{"DH-041", "HNI-48", "BHL-LON-330", 900},
		{"DH-042", "HNI-48", "BHL-LON-330", 900},
		{"DH-043", "HNI-48", "BHL-LON-330", 900},
		{"DH-044", "HNI-48", "BHL-LON-330", 900},
		{"DH-045", "VD2-143", "BHL-LON-330", 300},
		{"DH-046", "VD2-143", "BHL-DRAFT-30", 105},
		{"DH-047", "NT6BC-115", "BHL-LON-330", 350},
		{"DH-048", "NT6BC-115", "BHL-DRAFT-30", 30},
		{"DH-049", "NT6BC-115", "BHL-LON-330", 250},
		{"DH-050", "NT6BC-115", "NGK-CHANH-330", 46},
		{"DH-051", "NT1-3-110", "BHL-LON-330", 800},
		{"DH-052", "NT1-3-110", "BHL-CHAI-355", 100},
		{"DH-053", "NT1-3-110", "BHL-CHAI-355", 200},
		{"DH-054", "NT1-3-110", "BHL-LON-330", 800},
		{"DH-055", "NT1-3-110", "BHL-DRAFT-30", 50},
		{"DH-056", "QN-HH", "BHL-LON-330", 300},
		{"DH-057", "QN-HH", "BHL-LON-330", 700},
		{"DH-058", "HP-4745", "BHL-DRAFT-30", 130},
		{"DH-059", "HP-4745", "BHL-DRAFT-30", 190},
		{"DH-060", "QN-HH", "BHL-CHAI-355", 50},
		{"DH-061", "QN-HH", "BHL-DRAFT-30", 120},
		{"DH-062", "TB-125", "BHL-DRAFT-30", 170},
		{"DH-063", "TB-125", "BHL-DRAFT-30", 120},
		{"DH-064", "HD-70", "BHL-DRAFT-30", 170},
		{"DH-065", "NĐ-4766", "BHL-CHAI-355", 25},
		{"DH-066", "QN-TN", "BHL-DRAFT-30", 140},
		{"DH-067", "VD2-143", "BHL-LON-330", 700},
		{"DH-068", "NĐ-4767", "BHL-DRAFT-30", 90},
		{"DH-069", "CP2-29", "BHL-LON-330", 800},
		{"DH-070", "CP2-29", "BHL-LON-330", 650},
		{"DH-071", "QN-HH", "BHL-LON-330", 900},
		{"DH-072", "HH2-70", "BHL-CHAI-355", 200},
		{"DH-073", "HB-73", "BHL-LON-330", 900},
		{"DH-074", "DT1-34", "BHL-LON-330", 1760},
		{"DH-075", "TB-133", "BHL-DRAFT-30", 200},
		{"DH-076", "MC4-93", "BHL-LON-330", 950},
		{"DH-077", "QN-HH", "BHL-LON-330", 950},
		{"DH-078", "HD-70", "BHL-DRAFT-30", 200},
		{"DH-079", "BN-24", "BHL-DRAFT-30", 176},
		{"DH-080", "TN-4793", "BHL-DRAFT-30", 180},
		{"DH-081", "NT6BC-115", "BHL-LON-330", 950},
		{"DH-082", "MC4-93", "BHL-LON-330", 950},
		{"DH-083", "QN-HH", "BHL-LON-330", 950},
		{"DH-084", "HH2-69", "BHL-LON-330", 950},
		{"DH-085", "HH2-70", "BHL-CHAI-355", 200},
		{"DH-086", "HB-73", "BHL-LON-330", 900},
		{"DH-087", "DT1-34", "BHL-LON-330", 1760},
		{"DH-088", "TB-133", "BHL-DRAFT-30", 200},
		{"DH-089", "TB-133", "BHL-DRAFT-30", 190},
		{"DH-090", "TB-133", "BHL-DRAFT-30", 200},
		{"DH-091", "NG-109", "BHL-DRAFT-30", 180},
		{"DH-092", "NT6BC-115", "BHL-LON-330", 950},
		{"DH-093", "TB-125", "BHL-CHAI-355", 130},
		{"DH-094", "TB-125", "BHL-DRAFT-30", 190},
		{"DH-095", "QN-HH", "BHL-LON-330", 950},
		{"DH-096", "HH2-69", "BHL-LON-330", 950},
		{"DH-097", "HH2-70", "BHL-CHAI-355", 200},
		{"DH-098", "HB-73", "BHL-LON-330", 900},
		{"DH-099", "DT1-34", "BHL-LON-330", 1760},
		{"DH-100", "TB-133", "BHL-DRAFT-30", 200},
		{"DH-101", "MC4-93", "BHL-LON-330", 950},
		{"DH-102", "QN-HH", "BHL-LON-330", 950},
		{"DH-103", "HD-70", "BHL-DRAFT-30", 200},
		{"DH-104", "BN-24", "BHL-DRAFT-30", 176},
		{"DH-105", "TN-4793", "BHL-DRAFT-30", 180},
	}

	// Pre-fetch real customer IDs and map fake codes to real ones (cycle through real customers)
	realCustRows, err := tx.Query(ctx, `SELECT id FROM customers ORDER BY code LIMIT 60`)
	if err != nil {
		return created, fmt.Errorf("list_customers_vrp01: %w", err)
	}
	var realCustIDs []uuid.UUID
	for realCustRows.Next() {
		var cid uuid.UUID
		if err := realCustRows.Scan(&cid); err != nil {
			realCustRows.Close()
			return created, fmt.Errorf("scan_customer_vrp01: %w", err)
		}
		realCustIDs = append(realCustIDs, cid)
	}
	realCustRows.Close()
	if len(realCustIDs) == 0 {
		return created, fmt.Errorf("no customers found")
	}
	codeToCust := map[string]uuid.UUID{}
	codeIdx := 0
	for _, o := range orders {
		if _, ok := codeToCust[o.customerCode]; !ok {
			codeToCust[o.customerCode] = realCustIDs[codeIdx%len(realCustIDs)]
			codeIdx++
		}
	}

	const maxShipKg = 7500.0
	shipmentIdx := 0

	for i, o := range orders {
		p, ok := prods[o.sku]
		if !ok {
			return created, fmt.Errorf("unknown sku: %s", o.sku)
		}
		totalWeight := p.weight * float64(o.qty)
		totalAmount := p.price * float64(o.qty)

		custID := codeToCust[o.customerCode]

		seq := fmt.Sprintf("%03d", i+1)
		var orderID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
			  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
			VALUES (gen_random_uuid(),
			  'QA-VRP01-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || $1,
			  $2, $3, 'confirmed', CURRENT_DATE,
			  $4, 0, $5, $6, $7, 'passed', 'passed')
			RETURNING id
		`, seq, custID, whHL, totalAmount, totalWeight, totalWeight/500.0, dvkhUserID).Scan(&orderID); err != nil {
			return created, fmt.Errorf("order_%s: %w", o.code, err)
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "sales_orders", orderID); err != nil {
			return created, err
		}
		created++

		// order_item
		var itemID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
			SELECT $1, id, $2, $3, $4 FROM products WHERE sku = $5
			RETURNING id
		`, orderID, o.qty, p.price, totalAmount, o.sku).Scan(&itemID); err != nil {
			return created, fmt.Errorf("item_%s: %w", o.code, err)
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "order_items", itemID); err != nil {
			return created, err
		}
		created++

		// Split into shipments ≤ 7500 kg
		numShips := 1
		if totalWeight > maxShipKg {
			numShips = int(totalWeight/maxShipKg) + 1
		}
		qtyPerShip := o.qty / numShips
		for s2 := 0; s2 < numShips; s2++ {
			shipmentIdx++
			shipSeq := fmt.Sprintf("%03d", shipmentIdx)
			shipQty := qtyPerShip
			if s2 == numShips-1 {
				shipQty = o.qty - qtyPerShip*(numShips-1)
			}
			shipWeight := p.weight * float64(shipQty)
			itemsJSON := fmt.Sprintf(`[{"product_sku":%q,"quantity":%d,"weight_kg":%.1f}]`, o.sku, shipQty, shipWeight)

			var shipID uuid.UUID
			if err := tx.QueryRow(ctx, `
				INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
				  delivery_date, total_weight_kg, total_volume_m3, items)
				VALUES ('QA-VRP01-SHP-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || $1,
				  $2, $3, $4, 'pending',
				  CURRENT_DATE, $5, $6, $7::jsonb)
				RETURNING id
			`, shipSeq, orderID, custID, whHL, shipWeight, shipWeight/500.0, itemsJSON).Scan(&shipID); err != nil {
				return created, fmt.Errorf("ship_%s_%d: %w", o.code, s2, err)
			}
			if err := s.repo.RecordEntity(ctx, tx, runID, "shipments", shipID); err != nil {
				return created, err
			}
			created++
		}
	}

	return created, nil
}

// ─────────────────────────────────────────────────────────────
// DEMO-VRP-02: VRP so sánh phương án — đơn đa dạng trọng lượng
// ─────────────────────────────────────────────────────────────
// 5 nhóm trọng lượng rõ ràng: XS/S/M/L/XL để thấy bin-packing
// và sự khác biệt chi phí vs thời gian tối ưu.

func (s *DemoService) seedVRPDiverseLoad(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	var whHL, dvkhUserID uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT id FROM warehouses WHERE code = 'WH-HL'`).Scan(&whHL); err != nil {
		return 0, fmt.Errorf("wh_hl: %w", err)
	}
	if err := tx.QueryRow(ctx, `SELECT id FROM users WHERE role::text = 'dvkh' LIMIT 1`).Scan(&dvkhUserID); err != nil {
		return 0, fmt.Errorf("dvkh_user: %w", err)
	}

	if _, err := tx.Exec(ctx, `UPDATE stock_quants SET quantity = 500000, reserved_qty = 0 WHERE warehouse_id = $1`, whHL); err != nil {
		return created, fmt.Errorf("boost_stock: %w", err)
	}

	// 50 tài xế check-in (fleet 50 xe thực WH-HL)
	driverRows, err := tx.Query(ctx, `SELECT id FROM drivers WHERE status = 'active' ORDER BY full_name LIMIT 50`)
	if err != nil {
		return created, fmt.Errorf("list_drivers: %w", err)
	}
	var driverIDs []uuid.UUID
	for driverRows.Next() {
		var did uuid.UUID
		if err := driverRows.Scan(&did); err != nil {
			driverRows.Close()
			return created, fmt.Errorf("scan_driver: %w", err)
		}
		driverIDs = append(driverIDs, did)
	}
	driverRows.Close()

	for _, did := range driverIDs {
		var checkinID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
			VALUES ($1, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour')
			ON CONFLICT (driver_id, checkin_date) DO NOTHING
			RETURNING id
		`, did).Scan(&checkinID); err != nil {
			continue // conflict → existing record, skip ownership
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "driver_checkins", checkinID); err != nil {
			return created, err
		}
		created++
	}

	// Get customer IDs (need ≥30 customers for diverse load)
	custRows, err := tx.Query(ctx, `SELECT id FROM customers ORDER BY code LIMIT 60`)
	if err != nil {
		return created, fmt.Errorf("list_customers: %w", err)
	}
	var custIDs []uuid.UUID
	for custRows.Next() {
		var cid uuid.UUID
		if err := custRows.Scan(&cid); err != nil {
			custRows.Close()
			return created, fmt.Errorf("scan_customer: %w", err)
		}
		custIDs = append(custIDs, cid)
	}
	custRows.Close()
	if len(custIDs) == 0 {
		return created, fmt.Errorf("no customers found")
	}

	// Get product IDs
	type prodEntry struct {
		id       uuid.UUID
		sku      string
		weightKg float64
		price    float64
	}
	prodMap := map[string]prodEntry{}
	prodSKUs := []string{"BHL-LON-330", "BHL-CHAI-450", "BHL-CHAI-355", "BHL-DRAFT-30", "NGK-CHANH-330"}
	prodWeights := map[string]float64{"BHL-LON-330": 8.5, "BHL-CHAI-450": 14.0, "BHL-CHAI-355": 15.0, "BHL-DRAFT-30": 32.0, "NGK-CHANH-330": 25.2}
	prodPrices := map[string]float64{"BHL-LON-330": 180000, "BHL-CHAI-450": 250000, "BHL-CHAI-355": 250000, "BHL-DRAFT-30": 800000, "NGK-CHANH-330": 180000}
	for _, sku := range prodSKUs {
		var pid uuid.UUID
		if err := tx.QueryRow(ctx, `SELECT id FROM products WHERE sku = $1`, sku).Scan(&pid); err != nil {
			continue
		}
		prodMap[sku] = prodEntry{id: pid, sku: sku, weightKg: prodWeights[sku], price: prodPrices[sku]}
	}

	// 5 weight groups × 12 orders each = 60 orders total
	// XS: 40-120kg  (BHL-LON-330, qty 5-14)
	// S:  200-400kg (BHL-CHAI-355, qty 13-27)
	// M:  600-1200kg (BHL-LON-330, qty 71-141)
	// L:  2000-4000kg (BHL-DRAFT-30, qty 63-125)
	// XL: 5000-7400kg (BHL-DRAFT-30, qty 156-231, just under 7.5T)
	type orderTemplate struct {
		custIdx int
		sku     string
		qty     int
	}
	templates := []orderTemplate{
		// XS group (12 orders, each 40-120 kg)
		{0, "BHL-LON-330", 5}, {1, "BHL-LON-330", 8}, {2, "BHL-LON-330", 11},
		{3, "BHL-LON-330", 14}, {4, "BHL-LON-330", 6}, {5, "BHL-LON-330", 9},
		{6, "BHL-LON-330", 12}, {7, "BHL-LON-330", 7}, {8, "BHL-LON-330", 10},
		{9, "BHL-LON-330", 13}, {10, "BHL-LON-330", 5}, {11, "BHL-LON-330", 8},
		// S group (12 orders, each 195-405 kg)
		{12, "BHL-CHAI-355", 13}, {13, "BHL-CHAI-355", 18}, {14, "BHL-CHAI-355", 22},
		{15, "BHL-CHAI-355", 27}, {16, "BHL-CHAI-355", 15}, {17, "BHL-CHAI-355", 20},
		{18, "BHL-CHAI-355", 25}, {19, "BHL-CHAI-355", 14}, {20, "BHL-CHAI-355", 19},
		{0, "BHL-CHAI-355", 24}, {1, "BHL-CHAI-355", 17}, {2, "BHL-CHAI-355", 21},
		// M group (12 orders, each 603-1198 kg)
		{3, "BHL-LON-330", 71}, {4, "BHL-LON-330", 90}, {5, "BHL-LON-330", 110},
		{6, "BHL-LON-330", 141}, {7, "BHL-LON-330", 80}, {8, "BHL-LON-330", 100},
		{9, "BHL-LON-330", 130}, {10, "BHL-LON-330", 75}, {11, "BHL-LON-330", 95},
		{12, "BHL-LON-330", 120}, {13, "BHL-LON-330", 85}, {14, "BHL-LON-330", 105},
		// L group (12 orders, each 7,040-12,800 kg → 1-2 shipments/order)
		{15, "BHL-DRAFT-30", 220}, {16, "BHL-DRAFT-30", 280}, {17, "BHL-DRAFT-30", 340},
		{18, "BHL-DRAFT-30", 400}, {19, "BHL-DRAFT-30", 240}, {20, "BHL-DRAFT-30", 300},
		{0, "BHL-DRAFT-30", 360}, {1, "BHL-DRAFT-30", 260}, {2, "BHL-DRAFT-30", 320},
		{3, "BHL-DRAFT-30", 380}, {4, "BHL-DRAFT-30", 250}, {5, "BHL-DRAFT-30", 310},
		// XL group (12 orders, each 22,400-32,000 kg → 3-5 shipments/order, total ~330T)
		{6, "BHL-DRAFT-30", 700}, {7, "BHL-DRAFT-30", 800}, {8, "BHL-DRAFT-30", 900},
		{9, "BHL-DRAFT-30", 1000}, {10, "BHL-DRAFT-30", 750}, {11, "BHL-DRAFT-30", 850},
		{12, "BHL-DRAFT-30", 950}, {13, "BHL-DRAFT-30", 780}, {14, "BHL-DRAFT-30", 880},
		{15, "BHL-DRAFT-30", 980}, {16, "BHL-DRAFT-30", 820}, {17, "BHL-DRAFT-30", 920},
	}

	shipmentIdx2 := 0
	for i, tmpl := range templates {
		pe, ok := prodMap[tmpl.sku]
		if !ok {
			continue
		}
		if tmpl.custIdx >= len(custIDs) {
			continue
		}
		cid := custIDs[tmpl.custIdx]
		totalWeight := pe.weightKg * float64(tmpl.qty)
		totalAmount := pe.price * float64(tmpl.qty)
		seq := fmt.Sprintf("%03d", i+1)

		var orderID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
			  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
			VALUES (gen_random_uuid(),
			  'QA-VRP02-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || $1,
			  $2, $3, 'confirmed', CURRENT_DATE,
			  $4, 0, $5, $6, $7, 'passed', 'passed')
			RETURNING id
		`, seq, cid, whHL, totalAmount, totalWeight, totalWeight/500.0, dvkhUserID).Scan(&orderID); err != nil {
			return created, fmt.Errorf("order_vrp02_%d: %w", i, err)
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "sales_orders", orderID); err != nil {
			return created, err
		}
		created++

		var itemID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
			VALUES ($1, $2, $3, $4, $5)
			RETURNING id
		`, orderID, pe.id, tmpl.qty, pe.price, totalAmount).Scan(&itemID); err != nil {
			return created, fmt.Errorf("item_vrp02_%d: %w", i, err)
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "order_items", itemID); err != nil {
			return created, err
		}
		created++

		// Split shipments ≤ 7500 kg
		const maxShip2 = 7500.0
		numShips := 1
		if totalWeight > maxShip2 {
			numShips = int(totalWeight/maxShip2) + 1
		}
		qtyPerShip := tmpl.qty / numShips
		for s2 := 0; s2 < numShips; s2++ {
			shipmentIdx2++
			shipSeq := fmt.Sprintf("%03d", shipmentIdx2)
			shipQty := qtyPerShip
			if s2 == numShips-1 {
				shipQty = tmpl.qty - qtyPerShip*(numShips-1)
			}
			shipWeight := pe.weightKg * float64(shipQty)
			itemsJSON := fmt.Sprintf(`[{"product_sku":%q,"quantity":%d,"weight_kg":%.1f}]`, pe.sku, shipQty, shipWeight)

			var shipID uuid.UUID
			if err := tx.QueryRow(ctx, `
				INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
				  delivery_date, total_weight_kg, total_volume_m3, items)
				VALUES ('QA-VRP02-SHP-' || TO_CHAR(CURRENT_DATE,'YYYYMMDD') || '-' || $1,
				  $2, $3, $4, 'pending',
				  CURRENT_DATE, $5, $6, $7::jsonb)
				RETURNING id
			`, shipSeq, orderID, cid, whHL, shipWeight, shipWeight/500.0, itemsJSON).Scan(&shipID); err != nil {
				return created, fmt.Errorf("ship_vrp02_%d_%d: %w", i, s2, err)
			}
			if err := s.repo.RecordEntity(ctx, tx, runID, "shipments", shipID); err != nil {
				return created, err
			}
			created++
		}
	}

	return created, nil
}
