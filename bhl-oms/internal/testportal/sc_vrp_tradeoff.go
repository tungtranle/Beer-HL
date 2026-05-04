package testportal

// sc_vrp_tradeoff.go — DEMO-VRP-03
//
// VRP Trade-off Routes — REAL HISTORICAL DATA
//
// Replays 140 historical shipments grouped into 5 toll-corridor regions so
// the COST mode (minimize fuel + toll) and TIME mode (minimize duration)
// converge on visibly different solutions.
//
// Source: shipments delivered in last 90 days, customer + product mix +
// weights cloned 1:1, only delivery_date and identifiers regenerated for
// today.
//
// Region split (totals = 140):
//   S = Ninh Bình + Thanh Hóa  (30) — Cầu Thái Hà 50k VND
//   W = Hà Nội / QL5            (25) — Trạm 1+2 QL5 (55k × 2)
//   N = Thái Nguyên             (18) — Phù Đổng 50k VND (capped — historical pool small)
//   D = Nam Định / Thái Bình    (30) — Cầu Thái Hà
//   E = Hải Dương / Hải Phòng   (37) — Cầu Bạch Đằng 50k VND
//
// Fleet: 50 trucks (mixed 3.5T / 5T / 8T) at WH-HL → enough slack for the
// solver to choose toll-vs-detour per route.

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (s *DemoService) seedVRPTradeoffRoutes(ctx context.Context, tx pgx.Tx, runID uuid.UUID, actor DemoActor) (int, error) {
	created := 0

	// ── 1) Master IDs ──
	var whHL, dvkhUserID uuid.UUID
	if err := tx.QueryRow(ctx, `SELECT id FROM warehouses WHERE code = 'WH-HL'`).Scan(&whHL); err != nil {
		return 0, fmt.Errorf("wh_hl: %w", err)
	}
	if err := tx.QueryRow(ctx, `SELECT id FROM users WHERE role::text = 'dvkh' LIMIT 1`).Scan(&dvkhUserID); err != nil {
		return 0, fmt.Errorf("dvkh_user: %w", err)
	}

	// ── 2) Boost stock at WH-HL only ──
	if _, err := tx.Exec(ctx, `UPDATE stock_quants SET quantity = 500000, reserved_qty = 0 WHERE warehouse_id = $1`, whHL); err != nil {
		return created, fmt.Errorf("boost_stock: %w", err)
	}

	// ── 3) Check-in many active drivers (50+) ──
	driverRows, err := tx.Query(ctx, `SELECT id FROM drivers WHERE status = 'active' ORDER BY full_name LIMIT 60`)
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
			continue
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "driver_checkins", checkinID); err != nil {
			return created, err
		}
		created++
	}

	// ── 4) Sample historical shipments per toll corridor ──
	type bucket struct {
		region string
		filter string // SQL filter on customers c
		want   int
	}
	buckets := []bucket{
		{"S", "c.latitude BETWEEN 20.0 AND 20.55 AND c.longitude BETWEEN 105.7 AND 106.3", 30},
		{"W", "c.latitude BETWEEN 20.95 AND 21.20 AND c.longitude BETWEEN 105.5 AND 106.20", 25},
		{"N", "c.latitude > 21.30 AND c.longitude BETWEEN 105.5 AND 106.2", 18},
		{"D", "c.latitude BETWEEN 20.30 AND 20.55 AND c.longitude BETWEEN 106.10 AND 106.40", 30},
		{"E", "c.latitude BETWEEN 20.55 AND 20.95 AND c.longitude BETWEEN 106.20 AND 106.55", 37},
	}

	type srcShipment struct {
		shipmentID uuid.UUID
		customerID uuid.UUID
		orderID    uuid.UUID
		region     string
	}
	var sources []srcShipment

	for _, b := range buckets {
		q := fmt.Sprintf(`
			SELECT s.id, s.customer_id, s.order_id
			FROM shipments s
			JOIN customers c ON c.id = s.customer_id
			WHERE s.delivery_date >= CURRENT_DATE - INTERVAL '90 days'
			  AND s.delivery_date < CURRENT_DATE
			  AND s.shipment_number NOT LIKE 'QA-%%'
			  AND s.order_id IS NOT NULL
			  AND c.is_active AND c.latitude IS NOT NULL AND c.longitude IS NOT NULL
			  AND %s
			ORDER BY random()
			LIMIT %d
		`, b.filter, b.want)
		rows, err := tx.Query(ctx, q)
		if err != nil {
			return created, fmt.Errorf("sample_%s: %w", b.region, err)
		}
		for rows.Next() {
			var src srcShipment
			src.region = b.region
			if err := rows.Scan(&src.shipmentID, &src.customerID, &src.orderID); err != nil {
				rows.Close()
				return created, fmt.Errorf("scan_%s: %w", b.region, err)
			}
			sources = append(sources, src)
		}
		rows.Close()
	}

	if len(sources) == 0 {
		return created, fmt.Errorf("no historical shipments matched any region — geography filters too tight")
	}

	// ── 5) Clone each historical shipment as a fresh order/shipment for today ──
	type srcItem struct {
		productID  uuid.UUID
		sku        string
		quantity   int
		unitPrice  float64
		amount     float64
		weightUnit float64
	}

	for i, src := range sources {
		// Load items + totals from source
		itemRows, err := tx.Query(ctx, `
			SELECT oi.product_id, p.sku, oi.quantity, oi.unit_price, oi.amount, p.weight_kg
			FROM order_items oi
			JOIN products p ON p.id = oi.product_id
			WHERE oi.order_id = $1
		`, src.orderID)
		if err != nil {
			return created, fmt.Errorf("load_items_%d: %w", i, err)
		}
		var items []srcItem
		var totalAmount, totalWeight float64
		for itemRows.Next() {
			var it srcItem
			if err := itemRows.Scan(&it.productID, &it.sku, &it.quantity, &it.unitPrice, &it.amount, &it.weightUnit); err != nil {
				itemRows.Close()
				return created, fmt.Errorf("scan_item_%d: %w", i, err)
			}
			items = append(items, it)
			totalAmount += it.amount
			totalWeight += float64(it.quantity) * it.weightUnit
		}
		itemRows.Close()
		if len(items) == 0 || totalWeight <= 0 {
			continue
		}
		// Clamp single shipment to 5T (largest truck = 8T) — VRP must still choose corridor
		if totalWeight > 5000 {
			scale := 5000.0 / totalWeight
			for k := range items {
				items[k].quantity = int(float64(items[k].quantity) * scale)
				if items[k].quantity < 1 {
					items[k].quantity = 1
				}
				items[k].amount = float64(items[k].quantity) * items[k].unitPrice
			}
			totalAmount = 0
			totalWeight = 0
			for _, it := range items {
				totalAmount += it.amount
				totalWeight += float64(it.quantity) * it.weightUnit
			}
		}

		seq := fmt.Sprintf("%03d", i+1)
		var orderID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
			  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
			VALUES (gen_random_uuid(),
			  'QA-V03-' || TO_CHAR(CURRENT_DATE,'YYMMDD') || '-' || $1 || $2,
			  $3, $4, 'confirmed', CURRENT_DATE,
			  $5, 0, $6, $7, $8, 'passed', 'passed')
			RETURNING id
		`, src.region, seq, src.customerID, whHL, totalAmount, totalWeight, totalWeight/500.0, dvkhUserID).Scan(&orderID); err != nil {
			return created, fmt.Errorf("order_%d: %w", i, err)
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "sales_orders", orderID); err != nil {
			return created, err
		}
		created++

		// Build items JSON for shipment + insert order_items
		itemsJSON := "["
		for j, it := range items {
			var itemID uuid.UUID
			if err := tx.QueryRow(ctx, `
				INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
				VALUES ($1, $2, $3, $4, $5)
				RETURNING id
			`, orderID, it.productID, it.quantity, it.unitPrice, it.amount).Scan(&itemID); err != nil {
				return created, fmt.Errorf("item_%d_%d: %w", i, j, err)
			}
			if err := s.repo.RecordEntity(ctx, tx, runID, "order_items", itemID); err != nil {
				return created, err
			}
			created++
			if j > 0 {
				itemsJSON += ","
			}
			itemsJSON += fmt.Sprintf(`{"product_sku":%q,"quantity":%d,"weight_kg":%.2f}`,
				it.sku, it.quantity, float64(it.quantity)*it.weightUnit)
		}
		itemsJSON += "]"

		var shipID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
			  delivery_date, total_weight_kg, total_volume_m3, items)
			VALUES ('QA-V03-S-' || TO_CHAR(CURRENT_DATE,'YYMMDD') || '-' || $1 || $2,
			  $3, $4, $5, 'pending',
			  CURRENT_DATE, $6, $7, $8::jsonb)
			RETURNING id
		`, src.region, seq, orderID, src.customerID, whHL, totalWeight, totalWeight/500.0, itemsJSON).Scan(&shipID); err != nil {
			return created, fmt.Errorf("ship_%d: %w", i, err)
		}
		if err := s.repo.RecordEntity(ctx, tx, runID, "shipments", shipID); err != nil {
			return created, err
		}
		created++
	}

	return created, nil
}
