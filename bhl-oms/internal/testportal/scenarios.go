package testportal

import (
	"context"
	"fmt"

	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

// ── Scenario metadata ─────────────────────────────

type ScenarioMeta struct {
	ID          string              `json:"id"`
	Title       string              `json:"title"`
	Description string              `json:"description"`
	Category    string              `json:"category"`
	Roles       []string            `json:"roles"`
	Steps       []ScenarioStep      `json:"steps"`
	DataSummary string              `json:"data_summary"`
	GPSScenario string              `json:"gps_scenario,omitempty"`
	PreviewData []ScenarioDataPoint `json:"preview_data"`
}

type ScenarioStep struct {
	Role     string `json:"role"`
	Page     string `json:"page"`
	Action   string `json:"action"`
	Expected string `json:"expected"`
}

type ScenarioDataPoint struct {
	Label string `json:"label"`
	Value string `json:"value"`
}

// GET /v1/test-portal/scenarios — list all available test scenarios
func (h *Handler) ListScenarios(c *gin.Context) {
	scenarios := []ScenarioMeta{
		scenarioE2EHappyPath(),
		scenarioCreditExceed(),
		scenarioATFail(),
		scenarioZaloReject(),
		scenarioDispatchTrip(),
		scenarioMultiStop(),
		scenarioGateCheckFail(),
		scenarioReconDiscrepancy(),
	}
	response.OK(c, scenarios)
}

// POST /v1/test-portal/load-scenario — reset data + load scenario-specific data
func (h *Handler) LoadScenario(c *gin.Context) {
	var req struct {
		ScenarioID string `json:"scenario_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "scenario_id bắt buộc")
		return
	}

	ctx := c.Request.Context()

	// Step 1: Reset all transactional data
	if err := h.resetTransactionalData(ctx); err != nil {
		h.log.Error(ctx, "scenario_reset_fail", err)
		response.InternalError(c)
		return
	}

	// Step 2: Load shared base data (lots + stock for all scenarios)
	if err := h.loadBaseData(ctx); err != nil {
		h.log.Error(ctx, "scenario_base_data_fail", err)
		response.InternalError(c)
		return
	}

	// Step 3: Load scenario-specific data
	var loadErr error
	var summary string
	switch req.ScenarioID {
	case "SC-01":
		loadErr, summary = h.loadScenarioE2EHappy(ctx)
	case "SC-02":
		loadErr, summary = h.loadScenarioCreditExceed(ctx)
	case "SC-03":
		loadErr, summary = h.loadScenarioATPFail(ctx)
	case "SC-04":
		loadErr, summary = h.loadScenarioZaloReject(ctx)
	case "SC-05":
		loadErr, summary = h.loadScenarioDispatchTrip(ctx)
	case "SC-06":
		loadErr, summary = h.loadScenarioMultiStop(ctx)
	case "SC-07":
		loadErr, summary = h.loadScenarioGateCheckFail(ctx)
	case "SC-08":
		loadErr, summary = h.loadScenarioReconDiscrepancy(ctx)
	default:
		response.BadRequest(c, "Scenario không tồn tại: "+req.ScenarioID)
		return
	}

	if loadErr != nil {
		h.log.Error(ctx, "scenario_load_fail", loadErr, logger.F("scenario", req.ScenarioID))
		response.InternalError(c)
		return
	}

	h.log.Info(ctx, "scenario_loaded", logger.F("scenario", req.ScenarioID))
	response.OK(c, gin.H{
		"scenario_id": req.ScenarioID,
		"status":      "loaded",
		"message":     summary,
	})
}

// ── Reset transactional data (keep master: users, customers, products, vehicles, drivers, warehouses) ──

func (h *Handler) resetTransactionalData(ctx context.Context) error {
	// Use single SQL with TRUNCATE CASCADE for reliability
	// PostgreSQL aborts entire tx on any error, so we can't skip missing tables in a tx
	resetSQL := `
	TRUNCATE TABLE
	  entity_events, order_notes, discrepancies, reconciliations,
	  daily_close_summaries, daily_kpi_snapshots, integration_dlq,
	  notifications, audit_logs, zalo_confirmations, order_confirmations,
	  driver_checkins, return_collections, asset_ledger, epod,
	  gate_checks, picking_orders, trip_checklists, trip_stops,
	  trips, shipments, receivable_ledger, order_items, sales_orders,
	  stock_moves, stock_quants, lots
	CASCADE
	`
	if _, err := h.db.Exec(ctx, resetSQL); err != nil {
		return fmt.Errorf("truncate: %w", err)
	}
	h.log.Info(ctx, "transactional_data_reset")
	return nil
}

// ── Load base data: lots + stock (shared across all scenarios) ──

func (h *Handler) loadBaseData(ctx context.Context) error {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// Create lots for top 15 products (expiry dates in the future)
	lotsSQL := `
	INSERT INTO lots (id, product_id, batch_number, production_date, expiry_date)
	SELECT
	  gen_random_uuid(),
	  p.id,
	  'LOT-' || TO_CHAR(CURRENT_DATE - INTERVAL '30 days', 'YYYYMMDD') || '-' || ROW_NUMBER() OVER (),
	  CURRENT_DATE - INTERVAL '30 days',
	  CURRENT_DATE + INTERVAL '150 days'
	FROM products p
	WHERE p.is_active = true AND p.category NOT IN ('Vỏ chai', 'Két nhựa', 'Vỏ keg')
	ORDER BY p.sku
	LIMIT 15
	ON CONFLICT DO NOTHING
	`
	if _, err := tx.Exec(ctx, lotsSQL); err != nil {
		return fmt.Errorf("lots: %w", err)
	}

	// Create stock quants at main warehouses (WH-HL, WH-HP)
	stockSQL := `
	INSERT INTO stock_quants (product_id, lot_id, warehouse_id, location_id, quantity, reserved_qty)
	SELECT
	  l.product_id,
	  l.id,
	  w.id,
	  (SELECT loc.id FROM warehouses loc WHERE loc.code = w.code || '-A' LIMIT 1),
	  CASE
	    WHEN w.code = 'WH-HL' THEN 2000 + (random() * 3000)::int
	    ELSE 500 + (random() * 1500)::int
	  END,
	  0
	FROM lots l
	CROSS JOIN warehouses w
	WHERE w.code IN ('WH-HL', 'WH-HP')
	ON CONFLICT (product_id, lot_id, location_id) DO UPDATE SET
	  quantity = EXCLUDED.quantity, reserved_qty = 0
	`
	if _, err := tx.Exec(ctx, stockSQL); err != nil {
		return fmt.Errorf("stock: %w", err)
	}

	// Set receivable_ledger baseline for first 20 customers (realistic opening balances)
	debtSQL := `
	INSERT INTO receivable_ledger (customer_id, ledger_type, amount, description)
	SELECT c.id, 'debit',
	  (20 + (random() * 200)::int) * 1000000,
	  'Công nợ đầu kỳ'
	FROM customers c
	ORDER BY c.code
	LIMIT 20
	`
	if _, err := tx.Exec(ctx, debtSQL); err != nil {
		return fmt.Errorf("receivable: %w", err)
	}

	// Auto check-in first 10 drivers as "available" for today
	checkinSQL := `
	INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
	SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'
	FROM drivers d
	WHERE d.status = 'active'
	ORDER BY d.full_name
	LIMIT 10
	ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available'
	`
	if _, err := tx.Exec(ctx, checkinSQL); err != nil {
		return fmt.Errorf("driver_checkins: %w", err)
	}

	return tx.Commit(ctx)
}

// ── SC-01: E2E Happy Path ──

func scenarioE2EHappyPath() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-01",
		Title:       "Luồng giao hàng đầy đủ (Happy Path)",
		Category:    "E2E",
		Description: "1 đơn hàng đi từ tạo đơn → KH xác nhận Zalo → Kế toán duyệt → Lập chuyến xe → Soạn hàng → Kiểm cổng → Giao hàng → Thu tiền → Đối soát. Trải qua tất cả 8 vai trò.",
		Roles:       []string{"dvkh", "accountant", "dispatcher", "warehouse", "security", "driver", "accountant", "management"},
		DataSummary: "8 đơn hàng cho 8 NPP (3 đơn lớn + 5 đơn vừa), 3 chuyến xe, multi-product, GPS giả lập",
		GPSScenario: "normal_delivery",
		Steps: []ScenarioStep{
			{Role: "dvkh", Page: "/dashboard/orders/new", Action: "Tạo đơn hàng cho NPP-001 (BHL-LON-330 × 200 + BHL-CHAI-450 × 80)", Expected: "Đơn chuyển Chờ KH xác nhận, Zalo notification gửi"},
			{Role: "dvkh", Page: "/test-portal → Xác nhận đơn Zalo", Action: "Bấm ✅ Xác nhận tất cả 8 đơn (giả lập KH)", Expected: "Các đơn chuyển Đã xác nhận, receivable_ledger ghi debit"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Nhấn Lập kế hoạch → Chọn 3 xe → VRP → Duyệt", Expected: "Tạo 3 chuyến xe, mỗi chuyến 2-3 điểm giao"},
			{Role: "warehouse", Page: "/dashboard/warehouse", Action: "Bấm Soạn → confirm pick cho từng đơn", Expected: "8 picking orders chuyển completed → trips ready"},
			{Role: "security", Page: "/dashboard/gate-check", Action: "Chọn từng chuyến → Kiểm tra → PASS", Expected: "Gate check pass, trip chuyển In Transit"},
			{Role: "driver", Page: "/dashboard/driver", Action: "Nhận chuyến → Checklist → Bắt đầu giao", Expected: "GPS bắt đầu tracking, stops = pending"},
			{Role: "driver", Page: "/dashboard/driver", Action: "Đến từng điểm → Giao hàng → ePOD → Thu tiền", Expected: "Stop → delivered, payment recorded"},
			{Role: "accountant", Page: "/dashboard/reconciliation", Action: "Kiểm tra đối soát 3 chuyến xe", Expected: "Goods matched, payment matched, 0 discrepancy"},
			{Role: "management", Page: "/dashboard/kpi", Action: "Xem báo cáo KPI", Expected: "OTD = 100%, delivery success = 100%"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "NPP", Value: "8 NPP (NPP-001 → NPP-008), đa dạng Quảng Ninh + Hải Phòng"},
			{Label: "Sản phẩm", Value: "Multi-product: BHL-LON-330, BHL-CHAI-450, BHL-GOLD-330, NGK-CHANH-330. Tổng ~6.5 tấn"},
			{Label: "Chuyến xe", Value: "3 chuyến, tổng 8 điểm giao (truck_5t, truck_3t5, truck_5t)"},
			{Label: "Tài xế", Value: "driver01, driver02, driver03"},
			{Label: "GPS Route", Value: "Route 1: Hạ Long area, Route 2: Uông Bí-Đông Triều, Route 3: Hải Phòng"},
		},
	}
}

func (h *Handler) loadScenarioE2EHappy(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// 8 orders for 8 customers — realistic multi-product, large quantities (~6.5 tấn tổng)
	type orderSpec struct {
		custOffset int
		items      []struct {
			sku string
			qty int
		}
		totalAmt int
		weightKg int
	}
	specs := []orderSpec{
		{0, []struct {
			sku string
			qty int
		}{{"BHL-LON-330", 200}, {"BHL-CHAI-450", 80}}, 48100000, 2820}, // NPP-001: đơn lớn
		{1, []struct {
			sku string
			qty int
		}{{"BHL-GOLD-330", 150}, {"NGK-CHANH-330", 100}}, 46250000, 2095}, // NPP-002: mix bia+NGK
		{2, []struct {
			sku string
			qty int
		}{{"BHL-LON-330", 120}, {"BHL-DARK-330", 60}}, 34500000, 1530}, // NPP-003: bia thường+đen
		{3, []struct {
			sku string
			qty int
		}{{"BHL-CHAI-450", 100}}, 19500000, 1400}, // NPP-004: chỉ chai
		{4, []struct {
			sku string
			qty int
		}{{"BHL-LON-330", 80}, {"NGK-CHANH-330", 60}}, 22300000, 1172}, // NPP-005: nhỏ hơn
		{5, []struct {
			sku string
			qty int
		}{{"BHL-GOLD-330", 60}, {"BHL-LON-330", 100}}, 32000000, 1360}, // NPP-006
		{6, []struct {
			sku string
			qty int
		}{{"BHL-CHAI-450", 50}, {"BHL-STRONG-330", 40}}, 19150000, 1040}, // NPP-007: chai+strong
		{7, []struct {
			sku string
			qty int
		}{{"BHL-LON-330", 60}, {"NGK-CAM-330", 80}}, 21100000, 1166}, // NPP-008: mix
	}

	for i, spec := range specs {
		seq := fmt.Sprintf("%04d", i+1)
		oSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
		SELECT gen_random_uuid(),
		  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
		  'pending_customer_confirm', CURRENT_DATE,
		  %d, 0, %d, 2.0,
		  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1), 'pass', 'pass'
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		ON CONFLICT (order_number) DO NOTHING
		RETURNING id, customer_id
		`, seq, spec.totalAmt, spec.weightKg, spec.custOffset)

		var orderID, custID string
		if err := tx.QueryRow(ctx, oSQL).Scan(&orderID, &custID); err != nil {
			return fmt.Errorf("order_%d: %w", i, err), ""
		}

		for _, item := range spec.items {
			itemSQL := fmt.Sprintf(`
			INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
			SELECT '%s', id, %d, price, price * %d FROM products WHERE sku = '%s'`,
				orderID, item.qty, item.qty, item.sku)
			if _, err := tx.Exec(ctx, itemSQL); err != nil {
				return fmt.Errorf("items_%d_%s: %w", i, item.sku, err), ""
			}
		}

		reserveSQL := fmt.Sprintf(`
		UPDATE stock_quants sq SET reserved_qty = reserved_qty + oi.quantity
		FROM order_items oi
		WHERE oi.order_id = '%s' AND sq.product_id = oi.product_id
		  AND sq.warehouse_id = (SELECT warehouse_id FROM sales_orders WHERE id = '%s')`, orderID, orderID)
		if _, err := tx.Exec(ctx, reserveSQL); err != nil {
			return fmt.Errorf("reserve_%d: %w", i, err), ""
		}

		confirmSQL := fmt.Sprintf(`
		INSERT INTO order_confirmations (order_id, customer_id, token, phone, total_amount, status, expires_at)
		VALUES ('%s', '%s', encode(gen_random_bytes(16), 'hex'), '0912345678', %d, 'sent', NOW() + INTERVAL '2 hours')`,
			orderID, custID, spec.totalAmt)
		if _, err := tx.Exec(ctx, confirmSQL); err != nil {
			return fmt.Errorf("confirm_%d: %w", i, err), ""
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}
	return nil, "✅ Đã nạp 8 đơn hàng (multi-product, ~6.5 tấn) cho 8 NPP. 10 tài xế đã check-in sẵn sàng. Test E2E: DVKH → Zalo → Dispatcher (3 chuyến) → Kho → Cổng → Tài xế (driver01/demo123) → Đối soát"
}

// ── SC-02: Credit Exceed ──

func scenarioCreditExceed() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-02",
		Title:       "Vượt hạn mức tín dụng → Kế toán duyệt",
		Category:    "CREDIT",
		Description: "NPP có hạn mức thấp (20-30 triệu), tạo đơn lớn vượt hạn mức → đơn tự động chuyển pending_approval → Kế toán phải duyệt → sau đó mới gửi Zalo cho KH.",
		Roles:       []string{"dvkh", "accountant"},
		DataSummary: "2 NPP hạn mức 25 triệu, 1 NPP hạn mức 500 triệu (contrast). Đơn 40 triệu cho NPP nhỏ.",
		Steps: []ScenarioStep{
			{Role: "dvkh", Page: "/dashboard/orders/new", Action: "Tạo đơn 40 triệu cho NPP hạn mức 25M", Expected: "Đơn tạo thành công nhưng status = Chờ duyệt credit"},
			{Role: "dvkh", Page: "/dashboard/orders", Action: "Kiểm tra danh sách đơn hàng", Expected: "Đơn hiện badge 🟠 Chờ duyệt, KHÔNG có Zalo confirmation"},
			{Role: "accountant", Page: "/dashboard/approvals", Action: "Xem danh sách chờ duyệt → Duyệt đơn", Expected: "Đơn chuyển pending_customer_confirm, Zalo gửi cho KH"},
			{Role: "dvkh", Page: "/test-portal → Xác nhận đơn Zalo", Action: "KH xác nhận", Expected: "Đơn chuyển confirmed, sẵn sàng lập chuyến"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "NPP vượt hạn mức", Value: "NPP-016 (hạn mức 25 triệu, dư nợ ~20 triệu)"},
			{Label: "NPP OK", Value: "NPP-001 (hạn mức 500 triệu — để so sánh)"},
			{Label: "Đơn hàng", Value: "BHL-LON-330 × 200 (~37 triệu) → vượt available"},
		},
	}
}

func (h *Handler) loadScenarioCreditExceed(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// Use first customer (offset 0) for the exceed order, second (offset 1) for normal
	// Set specific debt for first customer to make available_credit very low
	debtSQL := `
	INSERT INTO receivable_ledger (customer_id, ledger_type, amount, description)
	SELECT c.id, 'debit', 22000000, 'Công nợ kỳ trước — scenario credit_exceed'
	FROM customers c ORDER BY c.code LIMIT 1
	`
	if _, err := tx.Exec(ctx, debtSQL); err != nil {
		return fmt.Errorf("debt: %w", err), ""
	}

	// Create 1 order that exceeds credit
	orderSQL := `
	INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
	  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status, notes)
	SELECT
	  gen_random_uuid(),
	  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0001',
	  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
	  'pending_approval', CURRENT_DATE,
	  37000000, 0, 1400, 2.5,
	  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1),
	  'pass', 'exceed', 'Đơn vượt hạn mức tín dụng — chờ kế toán duyệt'
	FROM customers c ORDER BY c.code LIMIT 1
	ON CONFLICT (order_number) DO NOTHING
	RETURNING id
	`
	var orderID string
	if err := tx.QueryRow(ctx, orderSQL).Scan(&orderID); err != nil {
		return fmt.Errorf("order: %w", err), ""
	}

	itemsSQL := fmt.Sprintf(`
	INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
	SELECT '%s', id, 200, price, price * 200 FROM products WHERE sku = 'BHL-LON-330'`, orderID)
	if _, err := tx.Exec(ctx, itemsSQL); err != nil {
		return fmt.Errorf("items: %w", err), ""
	}

	// Normal order for second customer (comparison)
	normalSQL := `
	INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
	  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
	SELECT
	  gen_random_uuid(),
	  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-0002',
	  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
	  'pending_customer_confirm', CURRENT_DATE,
	  9250000, 0, 500, 0.8,
	  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1),
	  'pass', 'pass'
	FROM customers c ORDER BY c.code LIMIT 1 OFFSET 1
	ON CONFLICT (order_number) DO NOTHING
	RETURNING id, customer_id
	`
	var normalID, normalCustID string
	if err := tx.QueryRow(ctx, normalSQL).Scan(&normalID, &normalCustID); err != nil {
		return fmt.Errorf("normal_order: %w", err), ""
	}
	normalItemsSQL := fmt.Sprintf(`
	INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
	SELECT '%s', id, 50, price, price * 50 FROM products WHERE sku = 'BHL-LON-330'`, normalID)
	if _, err := tx.Exec(ctx, normalItemsSQL); err != nil {
		return fmt.Errorf("normal_items: %w", err), ""
	}
	confirmSQL := fmt.Sprintf(`
	INSERT INTO order_confirmations (order_id, customer_id, token, phone, total_amount, status, expires_at)
	VALUES ('%s', '%s', encode(gen_random_bytes(16), 'hex'), '0912345678',
	  (SELECT total_amount FROM sales_orders WHERE id = '%s'),
	  'sent', NOW() + INTERVAL '2 hours')`, normalID, normalCustID, normalID)
	if _, err := tx.Exec(ctx, confirmSQL); err != nil {
		return fmt.Errorf("confirm: %w", err), ""
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}
	return nil, "✅ Đã nạp: 1 đơn VƯỢT hạn mức (37M) + 1 đơn bình thường. Đăng nhập Kế toán để duyệt đơn."
}

// ── SC-03: ATP Fail ──

func scenarioATFail() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-03",
		Title:       "Tồn kho không đủ (ATP Fail)",
		Category:    "ATP",
		Description: "Kiểm tra cơ chế ATP: tạo đơn với số lượng vượt tồn kho → đơn bị từ chối. Reserved KHÔNG thay đổi.",
		Roles:       []string{"dvkh"},
		DataSummary: "Tồn kho BHL-LON-330: 100 thùng (giảm xuống thấp). Available = 100. Đặt 500 → fail.",
		Steps: []ScenarioStep{
			{Role: "dvkh", Page: "/test-portal → Tồn kho", Action: "Kiểm tra available BHL-LON-330 → ghi nhận = 100", Expected: "Stock quantity hiện 100, reserved = 0"},
			{Role: "dvkh", Page: "/dashboard/orders/new", Action: "Tạo đơn BHL-LON-330 × 500 cho NPP-001", Expected: "❌ Lỗi: ATP không đủ tồn kho"},
			{Role: "dvkh", Page: "/test-portal → Tồn kho", Action: "Kiểm tra lại reserved BHL-LON-330", Expected: "Reserved vẫn = 0 (không thay đổi, rollback)"},
			{Role: "dvkh", Page: "/dashboard/orders/new", Action: "Tạo đơn BHL-LON-330 × 50 (within available)", Expected: "✅ Tạo thành công, reserved = 50"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Sản phẩm thử", Value: "BHL-LON-330 — tồn kho chỉ 100 thùng"},
			{Label: "Thử đặt quá", Value: "500 thùng → ATP fail"},
			{Label: "Thử đặt vừa", Value: "50 thùng → ATP pass"},
		},
	}
}

func (h *Handler) loadScenarioATPFail(ctx context.Context) (error, string) {
	// Override stock to be very low for BHL-LON-330
	_, err := h.db.Exec(ctx, `
	UPDATE stock_quants sq SET quantity = 100, reserved_qty = 0
	FROM products p
	WHERE sq.product_id = p.id AND p.sku = 'BHL-LON-330'
	  AND sq.warehouse_id = (SELECT id FROM warehouses WHERE code = 'WH-HL')
	`)
	if err != nil {
		return fmt.Errorf("override_stock: %w", err), ""
	}
	return nil, "✅ Tồn kho BHL-LON-330 tại WH-HL = 100 thùng. Thử tạo đơn 500 thùng → sẽ fail ATP. Thử 50 thùng → pass."
}

// ── SC-04: Zalo Reject ──

func scenarioZaloReject() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-04",
		Title:       "KH từ chối đơn qua Zalo",
		Category:    "ZALO",
		Description: "Đơn được gửi Zalo → KH nhấn 'Từ chối' → đơn hủy, stock reserved giải phóng, credit không ghi nợ.",
		Roles:       []string{"dvkh"},
		DataSummary: "2 đơn hàng sẵn sàng xác nhận Zalo: 1 đơn sẽ xác nhận, 1 đơn sẽ từ chối → so sánh kết quả.",
		Steps: []ScenarioStep{
			{Role: "dvkh", Page: "/test-portal → Tồn kho", Action: "Ghi nhận reserved hiện tại cho BHL-LON-330", Expected: "Reserved = 70 (50 + 20 cho 2 đơn)"},
			{Role: "dvkh", Page: "/test-portal → Xác nhận đơn Zalo", Action: "✅ Xác nhận đơn 1 (NPP-001)", Expected: "Đơn 1 → confirmed, receivable_ledger ghi debit"},
			{Role: "dvkh", Page: "/test-portal → Xác nhận đơn Zalo", Action: "❌ Từ chối đơn 2 (NPP-002), lý do: 'Đã đặt nhầm'", Expected: "Đơn 2 → cancelled, reserved giảm 20"},
			{Role: "dvkh", Page: "/test-portal → Tồn kho", Action: "Kiểm tra reserved BHL-LON-330", Expected: "Reserved = 50 (chỉ giữ đơn 1)"},
			{Role: "dvkh", Page: "/test-portal → Dư nợ", Action: "Kiểm tra dư nợ NPP-002", Expected: "Dư nợ KHÔNG tăng (đơn bị từ chối)"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Đơn 1 (sẽ xác nhận)", Value: "NPP-001, BHL-LON-330 × 50"},
			{Label: "Đơn 2 (sẽ từ chối)", Value: "NPP-002, BHL-LON-330 × 20"},
			{Label: "Kết quả mong đợi", Value: "Reserved giảm 20, dư nợ NPP-002 không đổi"},
		},
	}
}

func (h *Handler) loadScenarioZaloReject(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// Create 2 orders with Zalo confirmations using first 2 customers
	for i, qty := range []int{50, 20} {
		seq := fmt.Sprintf("%04d", i+1)
		oSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
		SELECT gen_random_uuid(),
		  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
		  'pending_customer_confirm', CURRENT_DATE,
		  (SELECT price * %d FROM products WHERE sku = 'BHL-LON-330'),
		  500, 0.8,
		  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1), 'pass', 'pass'
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		ON CONFLICT (order_number) DO NOTHING
		RETURNING id, customer_id
		`, seq, qty, i)

		var orderID, custID string
		if err := tx.QueryRow(ctx, oSQL).Scan(&orderID, &custID); err != nil {
			return fmt.Errorf("order_%d: %w", i, err), ""
		}

		itemSQL := fmt.Sprintf(`
		INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
		SELECT '%s', id, %d, price, price * %d FROM products WHERE sku = 'BHL-LON-330'`,
			orderID, qty, qty)
		if _, err := tx.Exec(ctx, itemSQL); err != nil {
			return fmt.Errorf("items_%d: %w", i, err), ""
		}

		resSQL := fmt.Sprintf(`
		UPDATE stock_quants SET reserved_qty = reserved_qty + %d
		WHERE product_id = (SELECT id FROM products WHERE sku = 'BHL-LON-330')
		  AND warehouse_id = (SELECT id FROM warehouses WHERE code = 'WH-HL')
		`, qty)
		if _, err := tx.Exec(ctx, resSQL); err != nil {
			return fmt.Errorf("reserve_%d: %w", i, err), ""
		}

		confSQL := fmt.Sprintf(`
		INSERT INTO order_confirmations (order_id, customer_id, token, phone, total_amount, status, expires_at)
		VALUES ('%s', '%s', encode(gen_random_bytes(16), 'hex'), '0912345678',
		  (SELECT total_amount FROM sales_orders WHERE id = '%s'),
		  'sent', NOW() + INTERVAL '2 hours')`,
			orderID, custID, orderID)
		if _, err := tx.Exec(ctx, confSQL); err != nil {
			return fmt.Errorf("confirm_%d: %w", i, err), ""
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}
	return nil, "✅ 2 đơn sẵn sàng: KH1 (50 thùng) + KH2 (20 thùng). Vào Zalo tab để xác nhận 1, từ chối 1 → so sánh stock + credit."
}

// ── SC-05: Dispatch Trip ──

func scenarioDispatchTrip() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-05",
		Title:       "Lập chuyến xe & Điều phối (12 đơn)",
		Category:    "TMS",
		Description: "12 đơn hàng confirmed → Dispatcher lập kế hoạch VRP hoặc THỦ CÔNG → Duyệt → Tạo 4 chuyến xe → Gán tài xế → Tracking GPS. Có thể dùng 'Lập thủ công' để kéo thả đơn vào xe.",
		Roles:       []string{"dispatcher"},
		DataSummary: "12 đơn confirmed, multi-product, 8 tấn tổng, kho WH-HL, 5 xe available, GPS giả lập.",
		GPSScenario: "normal_delivery",
		Steps: []ScenarioStep{
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Vào Lập kế hoạch → thấy 12 đơn chờ lập chuyến (~8 tấn)", Expected: "12 shipments pending"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Chọn 4-5 xe → Step 3: chọn 'VRP Tự động' hoặc 'Lập thủ công'", Expected: "VRP: 4 chuyến tối ưu. Thủ công: kéo thả đơn vào xe"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Điều chỉnh nếu cần → Duyệt kế hoạch", Expected: "4 trips created, orders → planned, notify warehouse"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Xem Trung tâm điều phối", Expected: "4 chuyến xe hiện trên bản đồ"},
			{Role: "dispatcher", Page: "/test-portal → GPS", Action: "Bật GPS giả lập (normal_delivery)", Expected: "Xe di chuyển trên bản đồ real-time"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Đơn hàng", Value: "12 đơn confirmed, NPP-001 → NPP-012, multi-product, tổng ~8 tấn"},
			{Label: "Xe", Value: "5 xe: 14C-50001 → 14C-50005 (truck_3t5 + truck_5t)"},
			{Label: "Tài xế", Value: "driver01 → driver05"},
			{Label: "2 chế độ", Value: "VRP Tự động (AI tối ưu) hoặc Lập thủ công (kéo thả)"},
		},
	}
}

func (h *Handler) loadScenarioDispatchTrip(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// 12 confirmed orders — multi-product, realistic quantities (~8 tấn tổng)
	type dispatchItem struct {
		sku string
		qty int
	}
	type dispatchOrder struct {
		custOffset int
		items      []dispatchItem
		weightKg   int
	}
	orders := []dispatchOrder{
		{0, []dispatchItem{{"BHL-LON-330", 150}, {"BHL-CHAI-450", 60}}, 2115},
		{1, []dispatchItem{{"BHL-GOLD-330", 100}, {"NGK-CHANH-330", 80}}, 1506},
		{2, []dispatchItem{{"BHL-LON-330", 80}}, 680},
		{3, []dispatchItem{{"BHL-CHAI-450", 50}, {"BHL-DARK-330", 40}}, 1040},
		{4, []dispatchItem{{"BHL-LON-330", 60}, {"BHL-STRONG-330", 30}}, 765},
		{5, []dispatchItem{{"NGK-CHANH-330", 100}}, 820},
		{6, []dispatchItem{{"BHL-LON-330", 100}, {"BHL-GOLD-330", 50}}, 1275},
		{7, []dispatchItem{{"BHL-CHAI-450", 80}}, 1120},
		{8, []dispatchItem{{"BHL-LON-330", 40}, {"NGK-CAM-330", 60}}, 832},
		{9, []dispatchItem{{"BHL-GOLD-330", 80}}, 680},
		{10, []dispatchItem{{"BHL-LON-330", 120}, {"BHL-CHAI-450", 30}}, 1440},
		{11, []dispatchItem{{"BHL-DARK-330", 60}, {"NGK-CHANH-330", 40}}, 838},
	}

	for i, spec := range orders {
		seq := fmt.Sprintf("%04d", i+1)
		amt := 0
		for _, item := range spec.items {
			amt += item.qty * 185000 // approximate
		}
		oSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
		SELECT gen_random_uuid(),
		  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
		  'confirmed', CURRENT_DATE,
		  %d, %d, 2.0,
		  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1), 'pass', 'pass'
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		ON CONFLICT (order_number) DO NOTHING
		RETURNING id
		`, seq, amt, spec.weightKg, spec.custOffset)

		var orderID string
		if err := tx.QueryRow(ctx, oSQL).Scan(&orderID); err != nil {
			return fmt.Errorf("order_%d: %w", i, err), ""
		}

		for _, item := range spec.items {
			itemSQL := fmt.Sprintf(`
			INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
			SELECT '%s', id, %d, price, price * %d FROM products WHERE sku = '%s'`,
				orderID, item.qty, item.qty, item.sku)
			if _, err := tx.Exec(ctx, itemSQL); err != nil {
				return fmt.Errorf("items_%d_%s: %w", i, item.sku, err), ""
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}
	return nil, "✅ 12 đơn confirmed (~8 tấn, multi-product). 10 tài xế đã check-in. Dispatcher (dispatcher01/demo123) → Lập kế hoạch → VRP hoặc Thủ công → Duyệt → GPS."
}

// ── SC-06: Multi-Stop Delivery ──

func scenarioMultiStop() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-06",
		Title:       "Giao hàng nhiều điểm — 5 stops (Driver flow)",
		Category:    "DRIVER",
		Description: "1 chuyến xe 5 tấn với 5 điểm giao, multi-product → Tài xế: checklist → giao từng điểm (arrive → delivering → delivered) → thu tiền → hoàn thành. Mỗi stop ~800-1200kg.",
		Roles:       []string{"driver", "dispatcher"},
		DataSummary: "1 chuyến xe 5 tấn, 5 stops, multi-product, tổng ~4.5 tấn, GPS route Hạ Long area",
		GPSScenario: "normal_delivery",
		Steps: []ScenarioStep{
			{Role: "driver", Page: "/dashboard/driver", Action: "Đăng nhập driver01 → Xem chuyến hôm nay → Nhận chuyến", Expected: "1 chuyến, 5 điểm giao, tổng ~4.5 tấn"},
			{Role: "driver", Page: "/dashboard/driver", Action: "Checklist xe → Check tất cả mục → Xác nhận", Expected: "Trip chuyển Ready"},
			{Role: "driver", Page: "/dashboard/driver", Action: "Bắt đầu chuyến → Đến điểm 1 (NPP-001, 120 thùng bia lon + 40 két chai)", Expected: "Stop 1 = arrived, GPS tracking"},
			{Role: "driver", Page: "/dashboard/driver", Action: "Bắt đầu giao → ePOD → Giao + thu tiền 26.8 triệu", Expected: "Stop 1 = delivered, payment recorded"},
			{Role: "driver", Page: "/dashboard/driver", Action: "Tiếp tục 4 điểm còn lại — mỗi điểm: arrive → deliver → ePOD → payment", Expected: "All 5 stops delivered"},
			{Role: "driver", Page: "/dashboard/driver", Action: "Hoàn thành chuyến → Post-checklist", Expected: "Trip = completed, thông báo đến kế toán + dispatcher"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Xem tiến trình chuyến trên bản đồ", Expected: "5 điểm đã giao ✅, 0 lỗi"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Chuyến", Value: "xe 14C-50002 (truck_5t), tài xế driver01"},
			{Label: "5 điểm giao", Value: "NPP-001 → NPP-005, multi-product, mỗi điểm 800-1200kg"},
			{Label: "Sản phẩm", Value: "BHL-LON-330, BHL-CHAI-450, BHL-GOLD-330, NGK-CHANH-330"},
			{Label: "Tổng giá trị", Value: "~110 triệu VNĐ, thu tiền mặt/chuyển khoản tại mỗi điểm"},
		},
	}
}

func (h *Handler) loadScenarioMultiStop(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// 5 orders, multi-product, realistic quantities (~4.5 tấn tổng, vừa xe 5t)
	type msItem struct{ sku string; qty int }
	type msOrder struct {
		custOffset int
		items      []msItem
		totalAmt   int
		weightKg   int
	}
	orderSpecs := []msOrder{
		{0, []msItem{{"BHL-LON-330", 120}, {"BHL-CHAI-450", 40}}, 26800000, 1580},
		{1, []msItem{{"BHL-GOLD-330", 80}, {"NGK-CHANH-330", 60}}, 25500000, 1172},
		{2, []msItem{{"BHL-LON-330", 60}, {"BHL-DARK-330", 40}}, 19300000, 850},
		{3, []msItem{{"BHL-CHAI-450", 50}}, 9750000, 700},
		{4, []msItem{{"BHL-LON-330", 40}, {"NGK-CHANH-330", 30}}, 11150000, 586},
	}

	var orderIDs []string
	for i, spec := range orderSpecs {
		seq := fmt.Sprintf("%04d", i+1)
		oSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
		SELECT gen_random_uuid(),
		  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
		  'confirmed', CURRENT_DATE,
		  %d, %d, 2.0,
		  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1), 'pass', 'pass'
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		ON CONFLICT (order_number) DO NOTHING
		RETURNING id
		`, seq, spec.totalAmt, spec.weightKg, spec.custOffset)

		var orderID string
		if err := tx.QueryRow(ctx, oSQL).Scan(&orderID); err != nil {
			return fmt.Errorf("order_%d: %w", i, err), ""
		}
		orderIDs = append(orderIDs, orderID)

		for _, item := range spec.items {
			itemSQL := fmt.Sprintf(`
			INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
			SELECT '%s', id, %d, price, price * %d FROM products WHERE sku = '%s'`,
				orderID, item.qty, item.qty, item.sku)
			if _, err := tx.Exec(ctx, itemSQL); err != nil {
				return fmt.Errorf("items_%d_%s: %w", i, item.sku, err), ""
			}
		}
	}

	// Create trip + stops (pre-dispatched, assigned to driver01)
	tripSQL := `
	INSERT INTO trips (id, trip_number, status, vehicle_id, driver_id, warehouse_id,
	  planned_date, total_stops, total_weight_kg, total_distance_km)
	SELECT gen_random_uuid(),
	  'TR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
	  'assigned',
	  v.id,
	  d.id,
	  (SELECT id FROM warehouses WHERE code = 'WH-HL'),
	  CURRENT_DATE, 5, 4888, 35.0
	FROM vehicles v
	JOIN drivers d ON d.warehouse_id = (SELECT id FROM warehouses WHERE code = 'WH-HL')
	WHERE v.status = 'active' AND v.capacity_kg >= 5000
	  AND v.warehouse_id = (SELECT id FROM warehouses WHERE code = 'WH-HL')
	ORDER BY v.plate_number
	LIMIT 1
	ON CONFLICT DO NOTHING
	RETURNING id
	`
	var tripID string
	if err := tx.QueryRow(ctx, tripSQL).Scan(&tripID); err != nil {
		return fmt.Errorf("trip: %w", err), ""
	}

	// Create trip stops linked to orders
	stopsSQL := fmt.Sprintf(`
	INSERT INTO trip_stops (trip_id, stop_order, status, customer_id, estimated_arrival)
	SELECT '%s', ROW_NUMBER() OVER (ORDER BY so.order_number), 'pending',
	  so.customer_id,
	  CURRENT_TIMESTAMP + (ROW_NUMBER() OVER (ORDER BY so.order_number)) * INTERVAL '30 minutes'
	FROM sales_orders so
	WHERE so.delivery_date = CURRENT_DATE AND so.status = 'confirmed'
	ORDER BY so.order_number
	LIMIT 5
	`, tripID)
	if _, err := tx.Exec(ctx, stopsSQL); err != nil {
		return fmt.Errorf("stops: %w", err), ""
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}
	return nil, "✅ 1 chuyến xe 5 tấn + 5 điểm giao (multi-product, ~4.5 tấn). Đăng nhập driver01/demo123 để giao hàng."
}

// ── SC-07: Gate Check Fail ──

func scenarioGateCheckFail() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-07",
		Title:       "Kiểm tra cổng lỗi (Gate Check Fail)",
		Category:    "WMS",
		Description: "Chuyến xe được soạn hàng nhưng khi kiểm tra cổng phát hiện thiếu → Fail → Dispatcher phải xem xét, sửa lỗi.",
		Roles:       []string{"warehouse", "security", "dispatcher"},
		DataSummary: "1 chuyến xe đã soạn hàng (loaded), kiểm cổng sẽ phát hiện thiếu 5 thùng.",
		Steps: []ScenarioStep{
			{Role: "warehouse", Page: "/dashboard/warehouse", Action: "Xem kho → Thấy 1 picking order completed", Expected: "Hàng đã soạn, chờ kiểm cổng"},
			{Role: "security", Page: "/dashboard/gate-check", Action: "Chọn chuyến từ hàng đợi → Kiểm tra", Expected: "Thấy expected vs scanned items"},
			{Role: "security", Page: "/dashboard/gate-check", Action: "Nhập thiếu 5 thùng → Chọn lý do 'Thiếu hàng' → Submit FAIL", Expected: "Gate check = FAIL, alert gửi dispatcher"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Xem alert cổng → Quyết định xử lý", Expected: "Exception alert hiện với mô tả chi tiết"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Chuyến", Value: "1 chuyến loaded, chờ kiểm cổng"},
			{Label: "Items", Value: "BHL-LON-330 × 150 (expected) vs 145 (actual)"},
			{Label: "Kết quả", Value: "Gate check FAIL — thiếu 5 thùng"},
		},
	}
}

func (h *Handler) loadScenarioGateCheckFail(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// Create 2 confirmed orders using first 2 customers
	for i := 0; i < 2; i++ {
		seq := fmt.Sprintf("%04d", i+1)
		oSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
		SELECT gen_random_uuid(),
		  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
		  'confirmed', CURRENT_DATE,
		  (SELECT price * 75 FROM products WHERE sku = 'BHL-LON-330'),
		  750, 1.2,
		  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1), 'pass', 'pass'
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		ON CONFLICT (order_number) DO NOTHING
		RETURNING id`, seq, i)
		var orderID string
		if err := tx.QueryRow(ctx, oSQL).Scan(&orderID); err != nil {
			return fmt.Errorf("order_%d: %w", i, err), ""
		}
		itemSQL := fmt.Sprintf(`
		INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
		SELECT '%s', id, 75, price, price * 75 FROM products WHERE sku = 'BHL-LON-330'`, orderID)
		if _, err := tx.Exec(ctx, itemSQL); err != nil {
			return fmt.Errorf("items_%d: %w", i, err), ""
		}
	}

	// Create trip in "ready" status
	tripSQL := `
	INSERT INTO trips (id, trip_number, status, vehicle_id, driver_id, warehouse_id,
	  planned_date, total_stops, total_weight_kg, total_distance_km)
	SELECT gen_random_uuid(),
	  'TR-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
	  'ready',
	  v.id, d.id,
	  (SELECT id FROM warehouses WHERE code = 'WH-HL'),
	  CURRENT_DATE, 2, 1500, 20.0
	FROM vehicles v
	JOIN drivers d ON d.id = (SELECT id FROM drivers LIMIT 1)
	WHERE v.plate_number = '14C-00102'
	ON CONFLICT DO NOTHING
	RETURNING id
	`
	var tripID string
	if err := tx.QueryRow(ctx, tripSQL).Scan(&tripID); err != nil {
		return fmt.Errorf("trip: %w", err), ""
	}

	// Add stops
	stopsSQL := fmt.Sprintf(`
	INSERT INTO trip_stops (trip_id, stop_order, status, customer_id)
	SELECT '%s', ROW_NUMBER() OVER (ORDER BY so.order_number), 'pending',
	  so.customer_id
	FROM sales_orders so
	WHERE so.delivery_date = CURRENT_DATE AND so.status = 'confirmed'
	ORDER BY so.order_number LIMIT 2`, tripID)
	if _, err := tx.Exec(ctx, stopsSQL); err != nil {
		return fmt.Errorf("stops: %w", err), ""
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}
	return nil, "✅ 1 chuyến xe ready + 2 đơn loaded. Đăng nhập Security → Gate Check → Kiểm tra → Thử FAIL với lý do thiếu hàng."
}

// ── SC-08: Reconciliation with Discrepancy ──

func scenarioReconDiscrepancy() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-08",
		Title:       "Đối soát có chênh lệch (Discrepancy)",
		Category:    "RECON",
		Description: "Chuyến xe đã giao xong nhưng đối soát phát hiện chênh lệch tiền thu → Kế toán xử lý sai lệch, T+1 countdown.",
		Roles:       []string{"accountant", "management"},
		DataSummary: "2 chuyến đã delivered. 1 chuyến matched hoàn toàn. 1 chuyến có chênh lệch tiền 2 triệu.",
		Steps: []ScenarioStep{
			{Role: "accountant", Page: "/dashboard/reconciliation", Action: "Xem tab Đối soát", Expected: "2 reconciliation records: 1 matched, 1 discrepancy"},
			{Role: "accountant", Page: "/dashboard/reconciliation", Action: "Tab Sai lệch → Xem chi tiết chênh lệch", Expected: "1 discrepancy: payment, -2.000.000₫"},
			{Role: "accountant", Page: "/dashboard/reconciliation", Action: "Nhấn Xử lý → Nhập resolution → Lưu", Expected: "Discrepancy resolved, T+1 countdown dừng"},
			{Role: "management", Page: "/dashboard/kpi", Action: "Xem KPI dashboard", Expected: "1 discrepancy reported in Issues tab"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Chuyến 1", Value: "Matched hoàn toàn (0 chênh lệch)"},
			{Label: "Chuyến 2", Value: "Thu thiếu 2 triệu (expected 18.5M, actual 16.5M)"},
			{Label: "Deadline", Value: "T+1 (24h từ lúc phát hiện)"},
		},
	}
}

func (h *Handler) loadScenarioReconDiscrepancy(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// Create 2 delivered orders using first 2 customers
	for i := 0; i < 2; i++ {
		seq := fmt.Sprintf("%04d", i+1)
		oSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
		SELECT gen_random_uuid(),
		  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, (SELECT id FROM warehouses WHERE code = 'WH-HL'),
		  'delivered', CURRENT_DATE - 1,
		  (SELECT price * 100 FROM products WHERE sku = 'BHL-LON-330'),
		  1000, 1.5,
		  (SELECT u.id FROM users u WHERE u.role = 'dvkh' LIMIT 1), 'pass', 'pass'
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		ON CONFLICT (order_number) DO NOTHING
		RETURNING id`, seq, i)
		var orderID string
		if err := tx.QueryRow(ctx, oSQL).Scan(&orderID); err != nil {
			return fmt.Errorf("order_%d: %w", i, err), ""
		}
		itemSQL := fmt.Sprintf(`
		INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
		SELECT '%s', id, 100, price, price * 100 FROM products WHERE sku = 'BHL-LON-330'`, orderID)
		if _, err := tx.Exec(ctx, itemSQL); err != nil {
			return fmt.Errorf("items_%d: %w", i, err), ""
		}
	}

	// Create 2 completed trips
	for i := 1; i <= 2; i++ {
		seq := fmt.Sprintf("%03d", i)
		tripSQL := fmt.Sprintf(`
		INSERT INTO trips (id, trip_number, status, vehicle_id, driver_id, warehouse_id,
		  planned_date, total_stops, total_weight_kg, total_distance_km)
		SELECT gen_random_uuid(),
		  'TR-' || TO_CHAR(CURRENT_DATE - 1, 'YYYYMMDD') || '-%s',
		  'completed',
		  v.id, d.id,
		  (SELECT id FROM warehouses WHERE code = 'WH-HL'),
		  CURRENT_DATE - 1, 1, 1000, 15.0
		FROM vehicles v
		JOIN drivers d ON d.id = (SELECT id FROM drivers ORDER BY id OFFSET %d LIMIT 1)
		WHERE v.plate_number = '14C-0010%d'
		ON CONFLICT DO NOTHING
		RETURNING id`, seq, i-1, i+1)
		var tripID string
		if err := tx.QueryRow(ctx, tripSQL).Scan(&tripID); err != nil {
			return fmt.Errorf("trip_%d: %w", i, err), ""
		}

		// Reconciliation records
		var variance float64
		reconStatus := "matched"
		if i == 2 {
			variance = -2000000
			reconStatus = "discrepancy"
		}
		expectedVal := 18500000.0
		reconSQL := fmt.Sprintf(`
		INSERT INTO reconciliations (trip_id, recon_type, status, expected_value, actual_value, variance)
		VALUES ('%s', 'payment', '%s', %f, %f, %f)
		RETURNING id`, tripID, reconStatus, expectedVal, expectedVal+variance, variance)
		var reconID string
		if err := tx.QueryRow(ctx, reconSQL).Scan(&reconID); err != nil {
			return fmt.Errorf("recon_%d: %w", i, err), ""
		}

		// Create discrepancy for trip 2
		if i == 2 {
			discSQL := fmt.Sprintf(`
			INSERT INTO discrepancies (recon_id, trip_id, disc_type, status,
			  description, expected_value, actual_value, variance, deadline)
			VALUES ('%s', '%s', 'payment', 'open',
			  'Thu thiếu 2.000.000₫ so với expected — cần kiểm tra tài xế',
			  18500000, 16500000, -2000000,
			  NOW() + INTERVAL '24 hours')`, reconID, tripID)
			if _, err := tx.Exec(ctx, discSQL); err != nil {
				return fmt.Errorf("disc: %w", err), ""
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}
	return nil, "✅ 2 chuyến hoàn thành: 1 matched + 1 discrepancy (thiếu 2M). Đăng nhập Kế toán → Đối soát → Xử lý sai lệch."
}
