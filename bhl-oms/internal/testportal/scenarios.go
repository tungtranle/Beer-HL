package testportal

import (
	"context"
	"fmt"

	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgconn"
)

// backfillOrderCreatedEvents inserts order.created events for all orders that don't have one yet.
// Call this after scenario data load to ensure all test orders have timeline events.
func backfillOrderCreatedEvents(ctx context.Context, db interface {
	Exec(ctx context.Context, sql string, arguments ...any) (pgconn.CommandTag, error)
}) error {
	_, err := db.Exec(ctx, `
		INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_name, title, detail, created_at)
		SELECT 'order', so.id, 'order.created', 'user',
		  COALESCE((SELECT full_name FROM users WHERE id = so.created_by), 'DVKH'),
		  'Tạo đơn hàng ' || so.order_number || ' cho ' || c.name,
		  jsonb_build_object('order_number', so.order_number, 'customer_name', c.name, 'total_amount', so.total_amount),
		  so.created_at
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		WHERE NOT EXISTS (
		  SELECT 1 FROM entity_events ee
		  WHERE ee.entity_type = 'order' AND ee.entity_id = so.id AND ee.event_type = 'order.created'
		)`)
	return err
}

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
		scenarioVRPStress(),
		scenarioRealJune13(),
		scenarioControlTower(),
		scenarioOpsAuditRegression(),
		scenarioDocExpiry(),
		scenarioFEFOAllocation(),
		scenarioDriverEOD(),
		scenarioKPISnapshot(),
		scenarioRBACViolation(),
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
	case "SC-09":
		loadErr, summary = h.loadScenarioVRPStress(ctx)
	case "SC-10":
		loadErr, summary = h.loadScenarioRealJune13(ctx)
	case "SC-11":
		loadErr, summary = h.loadScenarioControlTower(ctx)
	case "SC-12":
		loadErr, summary = h.loadScenarioOpsAuditRegression(ctx)
	case "SC-13":
		loadErr, summary = h.loadScenarioDocExpiry(ctx)
	case "SC-14":
		loadErr, summary = h.loadScenarioFEFOAllocation(ctx)
	case "SC-15":
		loadErr, summary = h.loadScenarioDriverEOD(ctx)
	case "SC-16":
		loadErr, summary = h.loadScenarioKPISnapshot(ctx)
	case "SC-17":
		loadErr, summary = h.loadScenarioRBACViolation(ctx)
	default:
		response.BadRequest(c, "Scenario không tồn tại: "+req.ScenarioID)
		return
	}

	if loadErr != nil {
		h.log.Error(ctx, "scenario_load_fail", loadErr, logger.F("scenario", req.ScenarioID))
		response.InternalError(c)
		return
	}

	// Backfill order.created events for all orders that don't have one (test data)
	if err := backfillOrderCreatedEvents(ctx, h.db); err != nil {
		h.log.Warn(ctx, "backfill_order_events_failed", logger.F("err", err.Error()))
	}

	// Run assertions and include in response
	assertions := h.RunScenarioAssertions(ctx, req.ScenarioID)

	h.log.Info(ctx, "scenario_loaded", logger.F("scenario", req.ScenarioID))
	response.OK(c, gin.H{
		"scenario_id": req.ScenarioID,
		"status":      "loaded",
		"message":     summary,
		"assertions":  assertions,
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
	type msItem struct {
		sku string
		qty int
	}
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

// ── SC-09: VRP Optimization Demo (300 orders, diverse weights) ──

func scenarioVRPStress() ScenarioMeta {
	return ScenarioMeta{
		ID:       "SC-09",
		Title:    "VRP Tối ưu — 300 đơn, trọng lượng đa dạng, 50 xe WH-HL",
		Category: "TMS",
		Description: "300 đơn hàng confirmed với trọng lượng rất khác nhau (40kg → 6.5 tấn) để thấy rõ VRP tối ưu xếp xe: " +
			"đơn nhỏ ghép chung, đơn lớn dùng xe 5T/8T, tổng ~245T vs fleet 284T. " +
			"Fleet WH-HL: 20 xe 3.5T + 18 xe 5T + 8 xe 8T + 4 xe 15T = 50 xe. Toàn bộ 70 tài xế khả dụng.",
		Roles:       []string{"dispatcher"},
		DataSummary: "300 đơn confirmed, 5 nhóm trọng lượng, 50 xe WH-HL (4 loại), 70 tài xế. Tổng ~245 tấn.",
		GPSScenario: "normal_delivery",
		Steps: []ScenarioStep{
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Vào Lập kế hoạch → Chọn kho WH-HL → thấy 300 shipment pending", Expected: "300 shipments, trọng lượng từ 40kg đến 6.5 tấn"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Chọn tất cả 50 xe WH-HL → VRP Tự động", Expected: "OR-Tools solver tối ưu bin-packing + routing"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Xem kết quả VRP — so sánh utilization theo loại xe", Expected: "Xe 8T/15T: chở đơn >3.5 tấn. Xe 5T: 2-4 đơn vừa. Xe 3.5T: nhiều đơn nhỏ"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Kiểm tra capacity utilization — kỳ vọng 75-95%", Expected: "Solver tối ưu: ít xe nhất, đầy nhất, quãng đường ngắn nhất"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Duyệt kế hoạch → Tạo trips + stops", Expected: "Trips created, orders → planned"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Tổng đơn hàng", Value: "300 đơn confirmed, kho WH-HL"},
			{Label: "5 nhóm trọng lượng", Value: "XS: 40-120kg (100 đơn) | S: 200-400kg (80 đơn) | M: 500-900kg (60 đơn) | L: 1200-2400kg (40 đơn) | XL: 3500-6500kg (20 đơn)"},
			{Label: "Fleet WH-HL", Value: "20 xe 3.5T + 18 xe 5T + 8 xe 8T + 4 xe 15T = 50 xe (284T capacity)"},
			{Label: "Tài xế", Value: "70 tài xế đã check-in sẵn sàng"},
			{Label: "Mục đích", Value: "Thấy VRP tối ưu: tổng ~245T vs 284T fleet, đơn nhỏ ghép chung, đơn lớn xếp xe to"},
		},
	}
}

func (h *Handler) loadScenarioVRPStress(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// 1) Boost stock to 200,000 per product (enough for 300 large orders)
	if _, err := tx.Exec(ctx, `UPDATE stock_quants SET quantity = 200000, reserved_qty = 0`); err != nil {
		return fmt.Errorf("boost_stock: %w", err), ""
	}

	// 2) Check-in ALL 70 drivers
	if _, err := tx.Exec(ctx, `
		INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
		SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'
		FROM drivers d WHERE d.status = 'active'
		ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available'
	`); err != nil {
		return fmt.Errorf("checkin_all: %w", err), ""
	}

	// 3) Collect master data
	custRows, err := tx.Query(ctx, `SELECT id FROM customers ORDER BY code`)
	if err != nil {
		return fmt.Errorf("list_customers: %w", err), ""
	}
	var customerIDs []string
	for custRows.Next() {
		var id string
		if err := custRows.Scan(&id); err != nil {
			custRows.Close()
			return fmt.Errorf("scan_customer: %w", err), ""
		}
		customerIDs = append(customerIDs, id)
	}
	custRows.Close()

	var whHL string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM warehouses WHERE code = 'WH-HL'`).Scan(&whHL); err != nil {
		return fmt.Errorf("wh_hl: %w", err), ""
	}
	var dvkhUserID string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM users WHERE role = 'dvkh' LIMIT 1`).Scan(&dvkhUserID); err != nil {
		return fmt.Errorf("dvkh_user: %w", err), ""
	}

	type productInfo struct {
		sku      string
		weightKg float64
		price    float64
	}
	prodRows, err := tx.Query(ctx, `
		SELECT sku, weight_kg, price FROM products
		WHERE is_active = true AND (sku LIKE 'BHL-%' OR sku LIKE 'NGK-%')
		ORDER BY sku
	`)
	if err != nil {
		return fmt.Errorf("list_products: %w", err), ""
	}
	var products []productInfo
	for prodRows.Next() {
		var p productInfo
		if err := prodRows.Scan(&p.sku, &p.weightKg, &p.price); err != nil {
			prodRows.Close()
			return fmt.Errorf("scan_product: %w", err), ""
		}
		products = append(products, p)
	}
	prodRows.Close()

	if len(products) == 0 || len(customerIDs) == 0 {
		return fmt.Errorf("no products or customers found"), ""
	}

	// 4) Define 300 orders in 5 weight tiers for clear VRP optimization visibility
	//
	// WH-HL fleet: 20×truck_3t5 (3500kg) + 18×truck_5t (5000kg) + 8×truck_8t (8000kg) + 4×truck_15t (15000kg)
	// Total capacity = 284,000 kg. Target total ~245T (86% utilization).
	//
	// Weight tiers designed to showcase bin-packing:
	//   XS  (40-120 kg)   → 100 orders (8T total): Group 30-80 per truck_3t5
	//   S   (200-400 kg)  → 80 orders (24T total): Group 9-17 per truck_3t5
	//   M   (500-900 kg)  → 60 orders (42T total): 4-7 per truck_3t5, 5-10 per truck_5t
	//   L   (1200-2400 kg)→ 40 orders (72T total): 1-2 per truck_3t5, 2-4 per truck_5t
	//   XL  (3500-6500 kg)→ 20 orders (100T total): Needs truck_5t (≤5T) or truck_8t (>5T)

	type orderTier struct {
		numOrders int     // how many orders in this tier
		minKg     float64 // min total weight
		maxKg     float64 // max total weight
		minItems  int     // min products per order
		maxItems  int     // max products per order
		label     string  // for logging
	}
	tiers := []orderTier{
		{100, 40, 120, 1, 1, "XS"},   // tiny orders — group many per truck
		{80, 200, 400, 1, 2, "S"},    // small orders — 9-17 per truck_3t5
		{60, 500, 900, 1, 2, "M"},    // medium — 4-7 per truck_3t5
		{40, 1200, 2400, 2, 3, "L"},  // large — 1-2 per truck_3t5 or 2-4 per truck_5t
		{20, 3500, 6500, 3, 5, "XL"}, // very large — needs truck_5t or truck_8t
	}

	numCustomers := len(customerIDs)
	numProducts := len(products)
	orderIdx := 0

	for _, tier := range tiers {
		for t := 0; t < tier.numOrders; t++ {
			orderIdx++
			seq := fmt.Sprintf("%04d", orderIdx)
			custID := customerIDs[orderIdx%numCustomers]

			// Determine number of items for this order
			numItems := tier.minItems
			if tier.maxItems > tier.minItems {
				numItems = tier.minItems + (orderIdx % (tier.maxItems - tier.minItems + 1))
			}

			// Calculate target weight — spread evenly across the range
			targetWeight := tier.minKg + (tier.maxKg-tier.minKg)*float64(t)/float64(tier.numOrders)

			// Build items to approximate target weight
			type itemSpec struct {
				sku      string
				qty      int
				price    float64
				weightKg float64
			}
			var items []itemSpec
			remainingWeight := targetWeight
			for j := 0; j < numItems && remainingWeight > 0; j++ {
				p := products[(orderIdx+j)%numProducts]
				if p.weightKg <= 0 {
					p.weightKg = 8.5 // default
				}
				// Calculate qty to fill remaining weight (split across remaining items)
				perItemWeight := remainingWeight / float64(numItems-j)
				qty := int(perItemWeight / p.weightKg)
				if qty < 5 {
					qty = 5 // minimum 5 units
				}
				actualWeight := float64(qty) * p.weightKg
				items = append(items, itemSpec{
					sku:      p.sku,
					qty:      qty,
					price:    p.price,
					weightKg: p.weightKg,
				})
				remainingWeight -= actualWeight
			}

			// Compute totals
			var totalWeight, totalAmount float64
			for _, item := range items {
				totalWeight += float64(item.qty) * item.weightKg
				totalAmount += float64(item.qty) * item.price
			}

			// Insert order
			orderSQL := fmt.Sprintf(`
			INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
			  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
			VALUES (gen_random_uuid(),
			  'SO-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
			  '%s', '%s',
			  'confirmed', CURRENT_DATE,
			  %f, 0, %f, %.1f,
			  '%s', 'pass', 'pass')
			ON CONFLICT (order_number) DO NOTHING
			RETURNING id
			`, seq, custID, whHL, totalAmount, totalWeight, totalWeight/500.0, dvkhUserID)

			var orderID string
			if err := tx.QueryRow(ctx, orderSQL).Scan(&orderID); err != nil {
				return fmt.Errorf("order_%s_%d: %w", tier.label, t, err), ""
			}

			// Insert order items
			for _, item := range items {
				itemSQL := fmt.Sprintf(`
				INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
				SELECT '%s', id, %d, %f, %f FROM products WHERE sku = '%s'`,
					orderID, item.qty, item.price, float64(item.qty)*item.price, item.sku)
				if _, err := tx.Exec(ctx, itemSQL); err != nil {
					return fmt.Errorf("item_%s_%d_%s: %w", tier.label, t, item.sku, err), ""
				}
			}

			// Build shipment items JSON
			itemsJSON := "["
			for j, item := range items {
				if j > 0 {
					itemsJSON += ","
				}
				itemsJSON += fmt.Sprintf(`{"product_sku":"%s","quantity":%d}`, item.sku, item.qty)
			}
			itemsJSON += "]"

			// Insert shipment (pending — ready for VRP)
			shipSQL := fmt.Sprintf(`
			INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
			  delivery_date, total_weight_kg, total_volume_m3, items)
			VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
			  '%s', '%s', '%s', 'pending',
			  CURRENT_DATE, %f, %.1f, '%s'::jsonb)
			ON CONFLICT (shipment_number) DO NOTHING
			`, seq, orderID, custID, whHL, totalWeight, totalWeight/500.0, itemsJSON)
			if _, err := tx.Exec(ctx, shipSQL); err != nil {
				return fmt.Errorf("shipment_%s_%d: %w", tier.label, t, err), ""
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}

	return nil, "✅ Đã nạp 300 đơn confirmed (kho WH-HL) với trọng lượng đa dạng (~245T total):\n" +
		"• XS (40-120kg): 100 đơn — ghép 30-80 đơn/xe 3.5T\n" +
		"• S (200-400kg): 80 đơn — 9-17 đơn/xe 3.5T\n" +
		"• M (500-900kg): 60 đơn — 4-7 đơn/xe 3.5T hoặc 5-10/xe 5T\n" +
		"• L (1200-2400kg): 40 đơn — 1-2/xe 3.5T hoặc 2-4/xe 5T\n" +
		"• XL (3500-6500kg): 20 đơn — cần xe 5T (≤5T) hoặc xe 8T (>5T)\n\n" +
		"50 xe WH-HL (20×3.5T + 18×5T + 8×8T + 4×15T = 284T capacity), 70 tài xế sẵn sàng.\n" +
		"Dispatcher (dispatcher01/demo123) → Lập kế hoạch → VRP Tự động → Xem tối ưu xếp xe."
}

// ── SC-10: Real June 13 Data — 105 orders, ~156 shipments ──

func scenarioRealJune13() ScenarioMeta {
	return ScenarioMeta{
		ID:       "SC-10",
		Title:    "Dữ liệu thực 13/06 — 105 đơn, ~156 chuyến, 736 tấn",
		Category: "TMS",
		Description: "105 đơn hàng thực tế ngày 13/06 (đã tách sẵn), tổng 736 tấn hàng. " +
			"Mỗi đơn 1 sản phẩm, mỗi shipment ≤ 7.5T (fit xe 8T). " +
			"Dữ liệu gốc từ thực tế vận hành Beer Hạ Long. " +
			"5 sản phẩm: Lon 330ml, Chai 450ml, Chai 330ml, Keg 30L, PET 2L. " +
			"27 NPP giao đi 10+ tỉnh: QN, HP, HD, BG, TB, NĐ, BN, TN, HN...",
		Roles:       []string{"dispatcher"},
		DataSummary: "105 đơn confirmed (~156 shipments ≤7.5T), 27 NPP, kho WH-HL. Tổng ~736 tấn.",
		GPSScenario: "from_active_trips",
		Steps: []ScenarioStep{
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Vào Lập kế hoạch → Chọn kho WH-HL, ngày hôm nay", Expected: "~156 shipments pending, tổng ~736 tấn"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Chọn tất cả xe (67 xe: 47×8T, 10×3.5T, 10×15T) → Chạy VRP", Expected: "VRP xếp hết hoặc gần hết, tối ưu quãng đường"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Kiểm tra gộp điểm giao — cùng NPP nhiều đơn → gộp trên 1 xe", Expected: "VRP gộp đơn cùng NPP vào 1 trip khi đủ tải"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "So sánh 3 phương án: chi phí / thời gian / km", Expected: "Chênh lệch nhỏ do ít đường toll"},
			{Role: "dispatcher", Page: "/dashboard/planning", Action: "Duyệt kế hoạch → Tạo trips + stops", Expected: "Trips created, shipments → planned"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Tổng đơn hàng", Value: "105 đơn confirmed → ~156 shipments (≤7.5T/ship), kho WH-HL"},
			{Label: "Sản phẩm", Value: "BHL-LON-330, BHL-CHAI-450, BHL-CHAI-355, BHL-DRAFT-30, NGK-CHANH-330"},
			{Label: "Trọng lượng", Value: "Tổng ~736 tấn, mỗi shipment ≤ 7.5T, fit xe 8T (chiếm 70% fleet)"},
			{Label: "Đội xe", Value: "67 xe: 47 xe 8T (70%), 10 xe 3.5T, 10 xe 15T"},
			{Label: "NPP", Value: "27 NPP: QN (12), HD (2), HP (1), BG (1), TB (2), NĐ (2), BN (1), TN (2), HN (1)..."},
		},
	}
}

func (h *Handler) loadScenarioRealJune13(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// 1) Boost stock
	if _, err := tx.Exec(ctx, `UPDATE stock_quants SET quantity = 500000, reserved_qty = 0`); err != nil {
		return fmt.Errorf("boost_stock: %w", err), ""
	}

	// 2) Check-in ALL drivers
	if _, err := tx.Exec(ctx, `
		INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
		SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'
		FROM drivers d WHERE d.status = 'active'
		ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available'
	`); err != nil {
		return fmt.Errorf("checkin_all: %w", err), ""
	}

	// 3) Get master data IDs
	var whHL, dvkhUserID string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM warehouses WHERE code = 'WH-HL'`).Scan(&whHL); err != nil {
		return fmt.Errorf("wh_hl: %w", err), ""
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM users WHERE role = 'dvkh' LIMIT 1`).Scan(&dvkhUserID); err != nil {
		return fmt.Errorf("dvkh_user: %w", err), ""
	}

	// 4) 105 orders from real June 13 data (each order = 1 product, 1 SKU)
	type orderSpec struct {
		code         string
		customerCode string
		sku          string
		qty          int
	}

	// Product lookup
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

	maxShipKg := 7500.0
	shipmentIdx := 0

	for i, o := range orders {
		p := prods[o.sku]
		totalWeight := p.weight * float64(o.qty)
		totalAmount := p.price * float64(o.qty)

		// Get customer ID
		var custID string
		if err := tx.QueryRow(ctx, `SELECT id::text FROM customers WHERE code = $1`, o.customerCode).Scan(&custID); err != nil {
			return fmt.Errorf("customer_%s(%s): %w", o.code, o.customerCode, err), ""
		}

		seq := fmt.Sprintf("%03d", i+1)

		// Insert order
		var orderID string
		if err := tx.QueryRow(ctx, fmt.Sprintf(`
			INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
			  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
			VALUES (gen_random_uuid(),
			  'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
			  '%s', '%s', 'confirmed', CURRENT_DATE,
			  %f, 0, %f, %.1f, '%s', 'passed', 'passed')
			RETURNING id::text
		`, seq, custID, whHL, totalAmount, totalWeight, totalWeight/500.0, dvkhUserID)).Scan(&orderID); err != nil {
			return fmt.Errorf("order_%s: %w", o.code, err), ""
		}

		// Insert order item
		if _, err := tx.Exec(ctx, fmt.Sprintf(`
			INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
			SELECT '%s', id, %d, %f, %f FROM products WHERE sku = '%s'
		`, orderID, o.qty, p.price, totalAmount, o.sku)); err != nil {
			return fmt.Errorf("item_%s: %w", o.code, err), ""
		}

		// Split into shipments ≤ 7500kg
		numShips := 1
		if totalWeight > maxShipKg {
			numShips = int(totalWeight/maxShipKg) + 1
		}
		qtyPerShip := o.qty / numShips

		for s := 0; s < numShips; s++ {
			shipmentIdx++
			shipSeq := fmt.Sprintf("%03d", shipmentIdx)
			shipQty := qtyPerShip
			if s == numShips-1 {
				shipQty = o.qty - qtyPerShip*(numShips-1)
			}
			shipWeight := p.weight * float64(shipQty)

			itemsJSON := fmt.Sprintf(`[{"product_sku":"%s","quantity":%d,"weight_kg":%.1f}]`,
				o.sku, shipQty, shipWeight)

			if _, err := tx.Exec(ctx, fmt.Sprintf(`
				INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
				  delivery_date, total_weight_kg, total_volume_m3, items)
				VALUES ('SHP-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
				  '%s', '%s', '%s', 'pending',
				  CURRENT_DATE, %f, %.1f, '%s'::jsonb)
			`, shipSeq, orderID, custID, whHL, shipWeight, shipWeight/500.0, itemsJSON)); err != nil {
				return fmt.Errorf("ship_%s_%d: %w", o.code, s, err), ""
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}

	return nil, fmt.Sprintf("✅ Đã nạp dữ liệu thực 13/06:\n"+
		"• 105 đơn hàng confirmed → %d shipments pending (≤7.5T/ship)\n"+
		"• Tổng ~736 tấn hàng, kho WH-HL\n"+
		"• 5 sản phẩm: Lon 330ml, Chai 450ml, Chai 330ml, Keg 30L, PET 2L\n"+
		"• 27 NPP, đội xe 67 chiếc (47×8T, 10×3.5T, 10×15T)\n\n"+
		"Dispatcher (dispatcher01/demo123) → Lập kế hoạch → VRP.\n"+
		"%d shipments sẵn sàng.", shipmentIdx, shipmentIdx)
}

// ── SC-11: Control Tower Comprehensive Test ──

func scenarioControlTower() ScenarioMeta {
	return ScenarioMeta{
		ID:       "SC-11",
		Title:    "Trung tâm Điều phối — Test toàn diện (8 chuyến, GPS)",
		Category: "TMS",
		Description: "8 chuyến xe đa trạng thái (3 in_transit, 2 assigned, 2 ready, 1 completed) " +
			"với 3-5 điểm giao mỗi chuyến (mix pending/delivered/failed). " +
			"GPS giả lập auto-start cho 7 xe active theo 7 cụm tuyến giao hàng từ WH-HL. " +
			"Test bản đồ, route visualization, stop markers, exception alerts, move stops, cancel trip.",
		Roles:       []string{"dispatcher", "admin"},
		DataSummary: "8 chuyến xe, 30 điểm giao, 7 xe GPS online, 7 tuyến thực tế từ WH-HL, 3 exceptions (1 P0 + 2 P1).",
		GPSScenario: "from_active_trips",
		Steps: []ScenarioStep{
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Vào Trung tâm điều phối", Expected: "8 chuyến hiện trong trip list, metric cards cập nhật"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Click 1 chuyến in_transit → xem route trên bản đồ", Expected: "Polyline route + stop markers hiện trên map, xe flyTo"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Kiểm tra GPS — 7 xe active hiển thị tuyến trên map real-time", Expected: "Truck markers với biển số, heading xoay, speed color; 7 tuyến active hiện theo cụm địa lý"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Xem panel Cảnh báo — 3 exceptions", Expected: "1 P0 (failed_stop) + 2 P1 (late_eta, idle_vehicle)"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Click 'Giao lại' trên exception P0", Expected: "Stop chuyển re_delivery, exception refresh"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Chuyển 1 stop từ chuyến A sang chuyến B", Expected: "Move stop thành công, trip list cập nhật"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Hủy 1 chuyến status 'ready'", Expected: "Chuyến bị hủy, mất khỏi active list"},
			{Role: "dispatcher", Page: "/dashboard/control-tower", Action: "Tab Đội xe — xem 7 xe online", Expected: "Fleet view hiện 7 xe với speed + status"},
		},
		PreviewData: []ScenarioDataPoint{
			{Label: "Chuyến xe", Value: "8 chuyến: 3 in_transit, 2 assigned, 2 ready, 1 completed"},
			{Label: "Điểm giao", Value: "~30 stops theo 7 cụm NPP thực tế quanh Hạ Long, Quảng Yên, Uông Bí, Đông Triều, Cẩm Phả"},
			{Label: "GPS", Value: "7 xe online, GPS giả lập auto-start từ WH-HL đến các cụm NPP Quảng Ninh"},
			{Label: "Exceptions", Value: "3 cảnh báo: 1 P0 (giao thất bại), 1 P1 (trễ ETA), 1 P1 (xe chưa xuất bến)"},
			{Label: "Login", Value: "dispatcher01/demo123 hoặc admin01/demo123"},
		},
	}
}

func (h *Handler) loadScenarioControlTower(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	// 1) Boost stock
	if _, err := tx.Exec(ctx, `UPDATE stock_quants SET quantity = 500000, reserved_qty = 0`); err != nil {
		return fmt.Errorf("boost_stock: %w", err), ""
	}

	// 2) Check-in all drivers
	if _, err := tx.Exec(ctx, `
		INSERT INTO driver_checkins (driver_id, checkin_date, status, checked_in_at)
		SELECT d.id, CURRENT_DATE, 'available', NOW() - INTERVAL '1 hour'
		FROM drivers d WHERE d.status = 'active'
		ON CONFLICT (driver_id, checkin_date) DO UPDATE SET status = 'available'
	`); err != nil {
		return fmt.Errorf("checkin: %w", err), ""
	}

	// 3) Get master IDs
	var whHL, dvkhUser string
	if err := tx.QueryRow(ctx, `SELECT id FROM warehouses WHERE code = 'WH-HL'`).Scan(&whHL); err != nil {
		return fmt.Errorf("wh: %w", err), ""
	}
	if err := tx.QueryRow(ctx, `SELECT id FROM users WHERE role::text = 'dvkh' LIMIT 1`).Scan(&dvkhUser); err != nil {
		return fmt.Errorf("dvkh: %w", err), ""
	}
	if _, err := tx.Exec(ctx, `
		UPDATE warehouses
		SET latitude = 20.9639, longitude = 107.0895, address = 'Nhà máy Bia Hạ Long, KCN Cái Lân, Hạ Long, Quảng Ninh'
		WHERE code = 'WH-HL'
	`); err != nil {
		return fmt.Errorf("wh_hl_coords: %w", err), ""
	}

	// 4) Re-anchor first 26 customers onto 7 realistic delivery corridors from WH-HL.
	type ctCustomerCoord struct {
		offset  int
		lat     float64
		lng     float64
		address string
	}
	coordDefs := []ctCustomerCoord{
		// Route 1: Hồng Gai → Cao Xanh
		{0, 20.9698, 107.0940, "Hồng Gai, Hạ Long, Quảng Ninh"},
		{1, 20.9754, 107.1058, "Trần Hưng Đạo, Hạ Long, Quảng Ninh"},
		{2, 20.9825, 107.1201, "Cao Xanh, Hạ Long, Quảng Ninh"},
		{3, 20.9886, 107.1319, "Hà Khẩu, Hạ Long, Quảng Ninh"},
		// Route 2: Bãi Cháy → Hùng Thắng → Tuần Châu
		{4, 20.9562, 107.0108, "Bãi Cháy, Hạ Long, Quảng Ninh"},
		{5, 20.9471, 106.9962, "Hùng Thắng, Hạ Long, Quảng Ninh"},
		{6, 20.9318, 106.9797, "Tuần Châu, Hạ Long, Quảng Ninh"},
		// Route 3: Quảng Yên corridor
		{7, 20.9347, 106.8652, "Liên Hòa, Quảng Yên, Quảng Ninh"},
		{8, 20.9169, 106.8266, "Hà An, Quảng Yên, Quảng Ninh"},
		{9, 20.8988, 106.7903, "Phong Cốc, Quảng Yên, Quảng Ninh"},
		{10, 20.8836, 106.7564, "Tiền Phong, Quảng Yên, Quảng Ninh"},
		// Route 4: Uông Bí urban
		{11, 21.0282, 106.7812, "Quang Trung, Uông Bí, Quảng Ninh"},
		{12, 21.0345, 106.7691, "Yên Thanh, Uông Bí, Quảng Ninh"},
		{13, 21.0418, 106.7550, "Nam Khê, Uông Bí, Quảng Ninh"},
		// Route 5: Mạo Khê → Đông Triều south
		{14, 21.0211, 106.6692, "Mạo Khê, Đông Triều, Quảng Ninh"},
		{15, 21.0377, 106.6425, "Kim Sơn, Đông Triều, Quảng Ninh"},
		{16, 21.0529, 106.6208, "Hồng Phong, Đông Triều, Quảng Ninh"},
		// Route 6: Đông Triều north
		{17, 21.0826, 106.6039, "Đông Triều, Quảng Ninh"},
		{18, 21.0988, 106.5894, "Bình Khê, Đông Triều, Quảng Ninh"},
		{19, 21.1129, 106.5762, "Tràng Lương, Đông Triều, Quảng Ninh"},
		// Route 7: Cẩm Phả → Cửa Ông east
		{20, 21.0114, 107.2936, "Cẩm Trung, Cẩm Phả, Quảng Ninh"},
		{21, 21.0228, 107.3174, "Cẩm Thịnh, Cẩm Phả, Quảng Ninh"},
		{22, 21.0358, 107.3431, "Cửa Ông, Cẩm Phả, Quảng Ninh"},
		// Completed route: nội thành Hạ Long gần nhà máy
		{23, 20.9661, 107.0708, "Giếng Đáy, Hạ Long, Quảng Ninh"},
		{24, 20.9727, 107.0585, "Hà Khẩu, Hạ Long, Quảng Ninh"},
		{25, 20.9783, 107.0459, "Việt Hưng, Hạ Long, Quảng Ninh"},
	}
	for _, coord := range coordDefs {
		if _, err := tx.Exec(ctx, `
			UPDATE customers c
			SET latitude = $1, longitude = $2, address = $3
			WHERE c.id = (
				SELECT id FROM customers ORDER BY code LIMIT 1 OFFSET $4
			)
		`, coord.lat, coord.lng, coord.address, coord.offset); err != nil {
			return fmt.Errorf("control_tower_coords_%d: %w", coord.offset, err), ""
		}
	}

	// 5) Create 24 confirmed orders for 8 trips × 3 orders each
	type ctOrder struct {
		custOffset int
		sku        string
		qty        int
		weightKg   int
	}
	orders := []ctOrder{
		// Trip 1 (in_transit) — 4 stops
		{0, "BHL-LON-330", 120, 1020}, {1, "BHL-CHAI-450", 60, 840},
		{2, "BHL-LON-330", 80, 680}, {3, "BHL-GOLD-330", 50, 425},
		// Trip 2 (in_transit) — 3 stops
		{4, "BHL-LON-330", 100, 850}, {5, "BHL-CHAI-450", 40, 560},
		{6, "NGK-CHANH-330", 80, 656},
		// Trip 3 (in_transit) — 4 stops
		{7, "BHL-LON-330", 90, 765}, {8, "BHL-GOLD-330", 70, 595},
		{9, "BHL-CHAI-450", 50, 700}, {10, "BHL-LON-330", 60, 510},
		// Trip 4 (assigned) — 3 stops
		{11, "BHL-LON-330", 100, 850}, {12, "BHL-CHAI-450", 30, 420},
		{13, "NGK-CHANH-330", 60, 492},
		// Trip 5 (assigned) — 3 stops
		{14, "BHL-LON-330", 80, 680}, {15, "BHL-GOLD-330", 40, 340},
		{16, "BHL-LON-330", 70, 595},
		// Trip 6 (ready) — 3 stops
		{17, "BHL-LON-330", 90, 765}, {18, "BHL-CHAI-450", 50, 700},
		{19, "BHL-LON-330", 60, 510},
		// Trip 7 (ready) — 3 stops
		{20, "BHL-LON-330", 100, 850}, {21, "NGK-CHANH-330", 70, 574},
		{22, "BHL-LON-330", 50, 425},
		// Trip 8 (completed) — 3 stops
		{23, "BHL-LON-330", 80, 680}, {24, "BHL-CHAI-450", 40, 560},
		{25, "BHL-LON-330", 60, 510},
	}

	orderIDs := make([]string, 0, len(orders))
	for i, o := range orders {
		seq := fmt.Sprintf("%04d", i+1)
		var orderID string
		oSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status)
		SELECT gen_random_uuid(),
		  'CT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, '%s', 'confirmed', CURRENT_DATE,
		  %d, %d, 2.0, '%s', 'pass', 'pass'
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		RETURNING id`, seq, whHL, o.qty*185000, o.weightKg, dvkhUser, o.custOffset)
		if err := tx.QueryRow(ctx, oSQL).Scan(&orderID); err != nil {
			return fmt.Errorf("order_%d: %w", i, err), ""
		}
		orderIDs = append(orderIDs, orderID)

		itemSQL := fmt.Sprintf(`
		INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
		SELECT '%s', id, %d, price, price * %d FROM products WHERE sku = '%s'`,
			orderID, o.qty, o.qty, o.sku)
		if _, err := tx.Exec(ctx, itemSQL); err != nil {
			return fmt.Errorf("item_%d: %w", i, err), ""
		}
	}

	// 6) Create shipments for each order
	for i, orderID := range orderIDs {
		shipSQL := fmt.Sprintf(`
		INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
		  delivery_date, total_weight_kg, total_volume_m3)
		SELECT 'SHP-CT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%04d',
		  '%s', so.customer_id, so.warehouse_id, 'pending',
		  CURRENT_DATE, so.total_weight_kg, so.total_volume_m3
		FROM sales_orders so WHERE so.id = '%s'`, i+1, orderID, orderID)
		if _, err := tx.Exec(ctx, shipSQL); err != nil {
			return fmt.Errorf("ship_%d: %w", i, err), ""
		}
	}

	// 7) Create 8 trips with different statuses
	type tripDef struct {
		status     string
		vehOffset  int
		drvOffset  int
		orderStart int
		orderEnd   int // exclusive
	}
	tripDefs := []tripDef{
		{"in_transit", 0, 0, 0, 4},
		{"in_transit", 1, 1, 4, 7},
		{"in_transit", 2, 2, 7, 11},
		{"assigned", 3, 3, 11, 14},
		{"assigned", 4, 4, 14, 17},
		{"ready", 5, 5, 17, 20},
		{"ready", 6, 6, 20, 23},
		{"completed", 7, 7, 23, 26},
	}

	tripIDs := make([]string, 0, 8)
	for i, td := range tripDefs {
		seq := fmt.Sprintf("%03d", i+1)
		var tripID string
		startedAt := "NULL"
		completedAt := "NULL"
		if td.status == "in_transit" {
			startedAt = "NOW() - INTERVAL '1 hour'"
		}
		if td.status == "completed" {
			startedAt = "NOW() - INTERVAL '3 hours'"
			completedAt = "NOW() - INTERVAL '30 minutes'"
		}

		tripSQL := fmt.Sprintf(`
		INSERT INTO trips (id, trip_number, vehicle_id, driver_id, warehouse_id,
		  status, planned_date, total_stops, total_distance_km, total_weight_kg, started_at, completed_at)
		SELECT gen_random_uuid(),
		  'TR-CT-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  v.id, d.id, '%s',
		  '%s'::trip_status, CURRENT_DATE, %d, %d, %d, %s, %s
		FROM (SELECT id FROM vehicles WHERE status::text = 'active' ORDER BY plate_number LIMIT 1 OFFSET %d) v,
		     (SELECT id FROM drivers WHERE status::text = 'active' ORDER BY id LIMIT 1 OFFSET %d) d
		RETURNING id`, seq, whHL, td.status, td.orderEnd-td.orderStart, 50+i*15, 2000+i*300, startedAt, completedAt, td.vehOffset, td.drvOffset)
		if err := tx.QueryRow(ctx, tripSQL).Scan(&tripID); err != nil {
			return fmt.Errorf("trip_%d: %w", i, err), ""
		}
		tripIDs = append(tripIDs, tripID)

		// Create trip stops from orders
		for j := td.orderStart; j < td.orderEnd && j < len(orderIDs); j++ {
			stopOrder := j - td.orderStart + 1
			// Determine stop status based on trip status
			stopStatus := "pending"
			if td.status == "completed" {
				stopStatus = "delivered"
			} else if td.status == "in_transit" && stopOrder == 1 {
				stopStatus = "delivered" // first stop already delivered
			}
			// Make one stop failed for P0 exception
			if i == 0 && stopOrder == 2 {
				stopStatus = "failed"
			}

			// ETA times: past for exceptions, future for normal
			etaOffset := fmt.Sprintf("%d minutes", stopOrder*30)
			// Trip 2 (in_transit), stop 3 (pending) — ETA in the past for late_eta exception
			if i == 1 && stopOrder == 3 {
				etaOffset = "-25 minutes"
			}
			// Trip 4 (assigned), stop 1 — ETA far in the past for idle_vehicle exception
			if i == 3 && stopOrder == 1 {
				etaOffset = "-180 minutes"
			}

			stopSQL := fmt.Sprintf(`
			INSERT INTO trip_stops (trip_id, shipment_id, customer_id, stop_order, status,
			  estimated_arrival, estimated_departure)
			SELECT '%s', s.id, s.customer_id, %d, '%s'::stop_status,
			  NOW() + INTERVAL '%s', NOW() + INTERVAL '%s' + INTERVAL '15 minutes'
			FROM shipments s WHERE s.order_id = '%s' LIMIT 1`,
				tripID, stopOrder, stopStatus, etaOffset, etaOffset, orderIDs[j])
			if _, err := tx.Exec(ctx, stopSQL); err != nil {
				return fmt.Errorf("stop_%d_%d: %w", i, j, err), ""
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}

	return nil, "✅ SC-11 Control Tower loaded:\n" +
		"• 8 chuyến xe (3 in_transit, 2 assigned, 2 ready, 1 completed)\n" +
		"• ~30 điểm giao theo 7 cụm tuyến thực tế từ WH-HL đi Hạ Long–Quảng Yên–Uông Bí–Đông Triều–Cẩm Phả\n" +
		"• 7 xe GPS online cho 7 chuyến active; 1 chuyến completed giữ lại để test lịch sử\n" +
		"• 3 exceptions (1 P0 failed_stop, 1 P1 late_eta, 1 P1 idle_vehicle)\n" +
		"• Bật GPS giả lập từ Control Tower hoặc Test Portal → GPS tab → chọn from_active_trips\n\n" +
		"Đăng nhập dispatcher01/demo123 → Trung tâm điều phối."
}

// ── SC-12: Ops & Audit Regression ──

func scenarioOpsAuditRegression() ScenarioMeta {
	return ScenarioMeta{
		ID:          "SC-12",
		Title:       "Ops & Audit Regression — Timeline, DLQ, Recon, KPI",
		Category:    "E2E",
		Description: "Bộ dữ liệu regression cho các vùng ít được bao phủ bởi Test Portal cũ: order timeline/notes, giao bổ sung, integration DLQ, sai lệch đối soát và KPI snapshot.",
		Roles:       []string{"admin", "dispatcher", "accountant", "management"},
		DataSummary: "3 đơn hàng nhiều trạng thái, 1 chuyến completed, 3 DLQ entries, 2 discrepancies, 1 daily close, 1 KPI snapshot.",
		PreviewData: []ScenarioDataPoint{
			{Label: "OMS", Value: "1 đơn confirmed, 1 đơn partially_delivered có re-delivery, 1 đơn cancelled + timeline + notes"},
			{Label: "Integration", Value: "3 bản ghi DLQ: pending, retrying, failed"},
			{Label: "Reconciliation", Value: "1 trip completed, 2 discrepancy (open + resolved)"},
			{Label: "KPI", Value: "1 daily KPI snapshot + 1 daily close summary cho WH-HL"},
			{Label: "Tab nên mở", Value: "Ops & Audit + Orders + GPS (nếu cần soi trips thực)"},
		},
		Steps: []ScenarioStep{
			{Role: "dispatcher", Page: "/test-portal → Ops & Audit", Action: "Chọn đơn PART-OPS-* để xem timeline và note ghim", Expected: "Thấy order.created, order.status_changed, order.redelivery_created và 2 notes"},
			{Role: "admin", Page: "/test-portal → Ops & Audit", Action: "Kiểm tra khối Integration DLQ", Expected: "Có đủ bản ghi pending/retrying/failed với retry_count đúng"},
			{Role: "accountant", Page: "/test-portal → Ops & Audit", Action: "Kiểm tra discrepancies và daily close", Expected: "1 open discrepancy, 1 resolved discrepancy, summary close ngày hiện tại"},
			{Role: "management", Page: "/test-portal → Ops & Audit", Action: "Kiểm tra KPI snapshot và số đơn issue/cancel/redelivery", Expected: "KPI cards và snapshot khớp với data scenario"},
		},
	}
}

func (h *Handler) loadScenarioOpsAuditRegression(ctx context.Context) (error, string) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return err, ""
	}
	defer tx.Rollback(ctx)

	if _, err := tx.Exec(ctx, `UPDATE stock_quants SET quantity = 500000, reserved_qty = 0`); err != nil {
		return fmt.Errorf("boost_stock: %w", err), ""
	}

	var whHL, dvkhUser, accountantUser string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM warehouses WHERE code = 'WH-HL'`).Scan(&whHL); err != nil {
		return fmt.Errorf("wh_hl: %w", err), ""
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM users WHERE role::text = 'dvkh' LIMIT 1`).Scan(&dvkhUser); err != nil {
		return fmt.Errorf("dvkh_user: %w", err), ""
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM users WHERE role::text = 'accountant' LIMIT 1`).Scan(&accountantUser); err != nil {
		return fmt.Errorf("accountant_user: %w", err), ""
	}

	type opsOrder struct {
		customerOffset  int
		numberPrefix    string
		status          string
		sku             string
		qty             int
		totalAmount     int
		weightKg        int
		reDeliveryCount int
	}

	orders := []opsOrder{
		{0, "OPS-CFM", "confirmed", "BHL-LON-330", 60, 11100000, 510, 0},
		{1, "OPS-PART", "partially_delivered", "BHL-CHAI-450", 40, 10000000, 560, 1},
		{2, "OPS-CAN", "cancelled", "NGK-CHANH-330", 30, 5400000, 756, 0},
	}

	orderIDs := make([]string, 0, len(orders))
	for i, o := range orders {
		seq := fmt.Sprintf("%03d", i+1)
		var orderID string
		orderSQL := fmt.Sprintf(`
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
		  total_amount, deposit_amount, total_weight_kg, total_volume_m3, created_by, atp_status, credit_status, re_delivery_count)
		SELECT gen_random_uuid(),
		  '%s-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%s',
		  c.id, '%s', '%s', CURRENT_DATE,
		  %d, 0, %d, 1.5, '%s', 'passed', 'passed', %d
		FROM customers c ORDER BY c.code LIMIT 1 OFFSET %d
		RETURNING id::text`, o.numberPrefix, seq, whHL, o.status, o.totalAmount, o.weightKg, dvkhUser, o.reDeliveryCount, o.customerOffset)
		if err := tx.QueryRow(ctx, orderSQL).Scan(&orderID); err != nil {
			return fmt.Errorf("ops_order_%d: %w", i, err), ""
		}
		orderIDs = append(orderIDs, orderID)

		itemSQL := fmt.Sprintf(`
		INSERT INTO order_items (order_id, product_id, quantity, unit_price, amount)
		SELECT '%s', id, %d, price, price * %d FROM products WHERE sku = '%s'`, orderID, o.qty, o.qty, o.sku)
		if _, err := tx.Exec(ctx, itemSQL); err != nil {
			return fmt.Errorf("ops_item_%d: %w", i, err), ""
		}

		shipSQL := fmt.Sprintf(`
		INSERT INTO shipments (shipment_number, order_id, customer_id, warehouse_id, status,
		  delivery_date, total_weight_kg, total_volume_m3)
		SELECT 'SHP-OPS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-%03d',
		  '%s', customer_id, warehouse_id,
		  CASE WHEN status::text = 'cancelled' THEN 'cancelled'::shipment_status ELSE 'pending'::shipment_status END,
		  CURRENT_DATE, total_weight_kg, total_volume_m3
		FROM sales_orders WHERE id = '%s'`, i+1, orderID, orderID)
		if _, err := tx.Exec(ctx, shipSQL); err != nil {
			return fmt.Errorf("ops_ship_%d: %w", i, err), ""
		}
	}

	var tripID string
	tripSQL := fmt.Sprintf(`
	INSERT INTO trips (id, trip_number, vehicle_id, driver_id, warehouse_id,
	  status, planned_date, total_stops, total_distance_km, total_weight_kg, started_at, completed_at)
	SELECT gen_random_uuid(),
	  'TR-OPS-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-001',
	  v.id, d.id, '%s', 'completed'::trip_status, CURRENT_DATE, 2, 84, 1070,
	  NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour'
	FROM (SELECT id FROM vehicles WHERE status::text = 'active' ORDER BY plate_number LIMIT 1) v,
	     (SELECT id FROM drivers WHERE status::text = 'active' ORDER BY id LIMIT 1) d
	RETURNING id::text`, whHL)
	if err := tx.QueryRow(ctx, tripSQL).Scan(&tripID); err != nil {
		return fmt.Errorf("ops_trip: %w", err), ""
	}

	for idx, orderID := range orderIDs[:2] {
		stopStatus := "delivered"
		if idx == 1 {
			stopStatus = "partially_delivered"
		}
		stopSQL := fmt.Sprintf(`
		INSERT INTO trip_stops (trip_id, shipment_id, customer_id, stop_order, status,
		  estimated_arrival, estimated_departure, actual_arrival, actual_departure)
		SELECT '%s', s.id, s.customer_id, %d, '%s'::stop_status,
		  NOW() - INTERVAL '%d hours', NOW() - INTERVAL '%d hours' + INTERVAL '20 minutes',
		  NOW() - INTERVAL '%d hours', NOW() - INTERVAL '%d hours' + INTERVAL '18 minutes'
		FROM shipments s WHERE s.order_id = '%s' LIMIT 1`, tripID, idx+1, stopStatus, 4-idx, 4-idx, 4-idx, 4-idx, orderID)
		if _, err := tx.Exec(ctx, stopSQL); err != nil {
			return fmt.Errorf("ops_stop_%d: %w", idx, err), ""
		}
	}

	for _, stmt := range []string{
		fmt.Sprintf(`INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_name, title, detail, created_at)
		VALUES ('order', '%s', 'order.created', 'user', 'DVKH Test', 'Tạo đơn test regression', '{"source":"SC-12"}', NOW() - INTERVAL '6 hours')`, orderIDs[1]),
		fmt.Sprintf(`INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_name, title, detail, created_at)
		VALUES ('order', '%s', 'order.confirmed_by_customer', 'customer', 'NPP Test', 'Khách hàng xác nhận đơn', '{"channel":"zalo"}', NOW() - INTERVAL '5 hours')`, orderIDs[1]),
		fmt.Sprintf(`INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_name, title, detail, created_at)
		VALUES ('order', '%s', 'order.status_changed', 'system', 'TMS', 'Đơn chuyển giao một phần', '{"from":"in_transit","to":"partially_delivered"}', NOW() - INTERVAL '2 hours')`, orderIDs[1]),
		fmt.Sprintf(`INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_name, title, detail, created_at)
		VALUES ('order', '%s', 'order.redelivery_created', 'user', 'Điều phối', 'Tạo chuyến giao bổ sung', '{"attempt":2}', NOW() - INTERVAL '90 minutes')`, orderIDs[1]),
	} {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("ops_events: %w", err), ""
		}
	}

	for _, stmt := range []string{
		fmt.Sprintf(`INSERT INTO order_notes (order_id, user_id, user_name, content, note_type, is_pinned, created_at)
		VALUES ('%s', '%s', 'Kế toán test', 'Đã kiểm tra công nợ, cho phép theo dõi giao bổ sung.', 'internal', true, NOW() - INTERVAL '80 minutes')`, orderIDs[1], accountantUser),
		fmt.Sprintf(`INSERT INTO order_notes (order_id, user_id, user_name, content, note_type, is_pinned, created_at)
		VALUES ('%s', '%s', 'Điều phối test', 'Khách còn thiếu 5 két, chờ chuyến bổ sung cuối ngày.', 'driver_note', false, NOW() - INTERVAL '70 minutes')`, orderIDs[1], dvkhUser),
	} {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("ops_notes: %w", err), ""
		}
	}

	for i, stmt := range []string{
		fmt.Sprintf(`INSERT INTO integration_dlq (adapter, operation, payload, error_message, retry_count, max_retries, status, reference_type, reference_id, next_retry_at)
		VALUES ('bravo', 'push_document', '{"order":"%s"}', 'HTTP 502 từ mock Bravo', 0, 3, 'pending', 'order', '%s', NOW() + INTERVAL '5 minutes')`, orderIDs[0], orderIDs[0]),
		fmt.Sprintf(`INSERT INTO integration_dlq (adapter, operation, payload, error_message, retry_count, max_retries, status, reference_type, reference_id, next_retry_at)
		VALUES ('dms', 'sync_order', '{"order":"%s"}', 'Timeout khi đồng bộ trạng thái', 2, 3, 'retrying', 'order', '%s', NOW() + INTERVAL '2 minutes')`, orderIDs[1], orderIDs[1]),
		fmt.Sprintf(`INSERT INTO integration_dlq (adapter, operation, payload, error_message, retry_count, max_retries, status, reference_type, reference_id)
		VALUES ('zalo', 'send_zns', '{"order":"%s"}', 'Template ID không hợp lệ', 3, 3, 'failed', 'order', '%s')`, orderIDs[2], orderIDs[2]),
	} {
		if _, err := tx.Exec(ctx, stmt); err != nil {
			return fmt.Errorf("ops_dlq_%d: %w", i, err), ""
		}
	}

	var reconID string
	if err := tx.QueryRow(ctx, fmt.Sprintf(`
		INSERT INTO reconciliations (id, trip_id, recon_type, status, expected_value, actual_value, variance, reconciled_by, reconciled_at)
		VALUES (gen_random_uuid(), '%s', 'goods', 'discrepancy', 100, 92, -8, '%s', NOW() - INTERVAL '50 minutes')
		RETURNING id::text`, tripID, accountantUser)).Scan(&reconID); err != nil {
		return fmt.Errorf("ops_recon: %w", err), ""
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO discrepancies (recon_id, trip_id, disc_type, status, description, expected_value, actual_value, variance, deadline)
		VALUES ('%s', '%s', 'goods', 'open', 'Thiếu hàng sau giao bổ sung, cần xác minh lại', 100, 92, -8, NOW() + INTERVAL '1 day')`, reconID, tripID)); err != nil {
		return fmt.Errorf("ops_disc_open: %w", err), ""
	}
	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO discrepancies (recon_id, trip_id, disc_type, status, description, expected_value, actual_value, variance, resolution, resolved_at, resolved_by)
		VALUES ('%s', '%s', 'payment', 'resolved', 'Khách chuyển khoản thiếu mã tham chiếu', 10000000, 10000000, 0, 'Đã đối chiếu sao kê và chốt', NOW() - INTERVAL '30 minutes', '%s')`, reconID, tripID, accountantUser)); err != nil {
		return fmt.Errorf("ops_disc_resolved: %w", err), ""
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO daily_close_summaries (close_date, warehouse_id, total_trips, completed_trips, total_stops, delivered_stops, failed_stops,
		  total_revenue, total_collected, total_outstanding, total_returns_good, total_returns_damaged,
		  total_discrepancies, resolved_discrepancies, summary)
		VALUES (CURRENT_DATE, '%s', 1, 1, 2, 1, 1, 26500000, 16500000, 10000000, 8, 1, 2, 1,
		  '{"scenario":"SC-12","note":"Regression ops close"}')
		ON CONFLICT (close_date, warehouse_id) DO UPDATE SET
		  total_trips = EXCLUDED.total_trips,
		  completed_trips = EXCLUDED.completed_trips,
		  total_stops = EXCLUDED.total_stops,
		  delivered_stops = EXCLUDED.delivered_stops,
		  failed_stops = EXCLUDED.failed_stops,
		  total_revenue = EXCLUDED.total_revenue,
		  total_collected = EXCLUDED.total_collected,
		  total_outstanding = EXCLUDED.total_outstanding,
		  total_returns_good = EXCLUDED.total_returns_good,
		  total_returns_damaged = EXCLUDED.total_returns_damaged,
		  total_discrepancies = EXCLUDED.total_discrepancies,
		  resolved_discrepancies = EXCLUDED.resolved_discrepancies,
		  summary = EXCLUDED.summary`, whHL)); err != nil {
		return fmt.Errorf("ops_daily_close: %w", err), ""
	}

	if _, err := tx.Exec(ctx, fmt.Sprintf(`
		INSERT INTO daily_kpi_snapshots (snapshot_date, warehouse_id, otd_rate, delivery_success_rate, total_orders,
		  delivered_orders, failed_orders, avg_vehicle_utilization, total_trips, total_distance_km,
		  total_revenue, total_collected, outstanding_receivable, recon_match_rate, total_discrepancies, details)
		VALUES (CURRENT_DATE, '%s', 88.50, 66.67, 3, 1, 1, 72.0, 1, 84,
		  26500000, 16500000, 10000000, 50.0, 2, '{"scenario":"SC-12","focus":"ops-audit"}')
		ON CONFLICT (snapshot_date, warehouse_id) DO UPDATE SET
		  otd_rate = EXCLUDED.otd_rate,
		  delivery_success_rate = EXCLUDED.delivery_success_rate,
		  total_orders = EXCLUDED.total_orders,
		  delivered_orders = EXCLUDED.delivered_orders,
		  failed_orders = EXCLUDED.failed_orders,
		  avg_vehicle_utilization = EXCLUDED.avg_vehicle_utilization,
		  total_trips = EXCLUDED.total_trips,
		  total_distance_km = EXCLUDED.total_distance_km,
		  total_revenue = EXCLUDED.total_revenue,
		  total_collected = EXCLUDED.total_collected,
		  outstanding_receivable = EXCLUDED.outstanding_receivable,
		  recon_match_rate = EXCLUDED.recon_match_rate,
		  total_discrepancies = EXCLUDED.total_discrepancies,
		  details = EXCLUDED.details`, whHL)); err != nil {
		return fmt.Errorf("ops_kpi_snapshot: %w", err), ""
	}

	if err := tx.Commit(ctx); err != nil {
		return err, ""
	}

	return nil, "✅ SC-12 Ops & Audit loaded:\n" +
		"• 3 đơn hàng nhiều trạng thái, gồm 1 đơn partially_delivered có re-delivery count\n" +
		"• Timeline + 2 notes cho order OPS-PART-*\n" +
		"• 3 DLQ entries (pending, retrying, failed)\n" +
		"• 2 discrepancy + 1 daily close + 1 KPI snapshot cho WH-HL\n\n" +
		"Mở Test Portal → Ops & Audit để kiểm tra regression coverage."
}
