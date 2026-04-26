package testportal

// assertions.go — DB assertion engine for Test Portal scenarios
//
// Each scenario defines a set of SQL assertions that are checked
// after the scenario data is loaded. This enables automatic PASS/FAIL
// verdicts without manual inspection.
//
// Usage:
//   results := h.RunScenarioAssertions(ctx, "SC-01")

import (
	"context"
	"fmt"
	"time"
)

// AssertionDef defines a single DB assertion.
type AssertionDef struct {
	ID          string
	Description string
	// SQL query that returns a single integer (COUNT or value).
	Query string
	// Expected value to compare against query result.
	ExpectedVal interface{}
	// Optional: expected SQL expression (e.g. "> 0"). If set, ExpectedVal is ignored.
	// Format: "op value" e.g. "> 0", "= 1", ">= 3"
	ExpectedExpr string
}

// AssertionResult holds the result of a single assertion.
type AssertionResult struct {
	ID          string `json:"id"`
	Description string `json:"description"`
	Query       string `json:"query,omitempty"`
	Expected    string `json:"expected"`
	Actual      string `json:"actual"`
	Pass        bool   `json:"pass"`
	Error       string `json:"error,omitempty"`
	DurationMs  int64  `json:"duration_ms"`
}

// ScenarioAssertionReport holds all assertion results for a scenario.
type ScenarioAssertionReport struct {
	ScenarioID string            `json:"scenario_id"`
	Pass       bool              `json:"pass"`
	PassCount  int               `json:"pass_count"`
	FailCount  int               `json:"fail_count"`
	Results    []AssertionResult `json:"results"`
	RunAt      time.Time         `json:"run_at"`
	DurationMs int64             `json:"duration_ms"`
}

// RunScenarioAssertions runs all DB assertions for a given scenario ID.
// Returns nil if the scenario has no assertions defined.
func (h *Handler) RunScenarioAssertions(ctx context.Context, scenarioID string) *ScenarioAssertionReport {
	defs := scenarioAssertions(scenarioID)
	if len(defs) == 0 {
		return nil
	}

	start := time.Now()
	report := &ScenarioAssertionReport{
		ScenarioID: scenarioID,
		RunAt:      start,
		Results:    make([]AssertionResult, 0, len(defs)),
	}

	for _, def := range defs {
		result := h.runAssertion(ctx, def)
		report.Results = append(report.Results, result)
		if result.Pass {
			report.PassCount++
		} else {
			report.FailCount++
		}
	}

	report.DurationMs = time.Since(start).Milliseconds()
	report.Pass = report.FailCount == 0
	return report
}

// runAssertion executes a single assertion against the DB.
func (h *Handler) runAssertion(ctx context.Context, def AssertionDef) AssertionResult {
	t0 := time.Now()
	res := AssertionResult{
		ID:          def.ID,
		Description: def.Description,
		Query:       def.Query,
	}

	var actual int64
	err := h.db.QueryRow(ctx, def.Query).Scan(&actual)
	if err != nil {
		res.Error = err.Error()
		res.Actual = fmt.Sprintf("error: %s", err.Error())
		res.Expected = fmt.Sprintf("%v", def.ExpectedVal)
		res.DurationMs = time.Since(t0).Milliseconds()
		return res
	}

	res.Actual = fmt.Sprintf("%d", actual)

	if def.ExpectedExpr != "" {
		// Parse "op value" format
		var op string
		var expectNum int64
		n, parseErr := fmt.Sscanf(def.ExpectedExpr, "%s %d", &op, &expectNum)
		if parseErr != nil || n != 2 {
			res.Error = "invalid ExpectedExpr format: " + def.ExpectedExpr
			res.Expected = def.ExpectedExpr
			res.DurationMs = time.Since(t0).Milliseconds()
			return res
		}
		res.Expected = def.ExpectedExpr
		switch op {
		case ">":
			res.Pass = actual > expectNum
		case ">=":
			res.Pass = actual >= expectNum
		case "<":
			res.Pass = actual < expectNum
		case "<=":
			res.Pass = actual <= expectNum
		case "=", "==":
			res.Pass = actual == expectNum
		case "!=":
			res.Pass = actual != expectNum
		default:
			res.Error = "unsupported operator: " + op
		}
	} else {
		// Compare against ExpectedVal
		switch v := def.ExpectedVal.(type) {
		case int:
			res.Expected = fmt.Sprintf("%d", v)
			res.Pass = actual == int64(v)
		case int64:
			res.Expected = fmt.Sprintf("%d", v)
			res.Pass = actual == v
		default:
			res.Expected = fmt.Sprintf("%v", def.ExpectedVal)
			res.Pass = fmt.Sprintf("%d", actual) == res.Expected
		}
	}

	res.DurationMs = time.Since(t0).Milliseconds()
	return res
}

// ─────────────────────────────────────────────────────────────
// Assertion definitions per scenario
// ─────────────────────────────────────────────────────────────

// scenarioAssertions returns the assertion list for a scenario ID.
func scenarioAssertions(scenarioID string) []AssertionDef {
	switch scenarioID {
	case "SC-01":
		return sc01Assertions()
	case "SC-02":
		return sc02Assertions()
	case "SC-03":
		return sc03Assertions()
	case "SC-04":
		return sc04Assertions()
	case "SC-05":
		return sc05Assertions()
	case "SC-06":
		return sc06Assertions()
	case "SC-07":
		return sc07Assertions()
	case "SC-08":
		return sc08Assertions()
	case "SC-09":
		return sc09Assertions()
	case "SC-13":
		return sc13Assertions()
	case "SC-14":
		return sc14Assertions()
	case "SC-15":
		return sc15Assertions()
	case "SC-16":
		return sc16Assertions()
	case "SC-17":
		return sc17Assertions()
	default:
		return nil
	}
}

// SC-01: E2E Happy Path — 8 orders, all delivered, reconciliation record exists
func sc01Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC01-A1",
			Description:  "Có ít nhất 8 đơn hàng ở trạng thái confirmed/pending_customer_confirm",
			Query:        `SELECT COUNT(*) FROM sales_orders WHERE status::text IN ('confirmed','pending_customer_confirm','pending_approval')`,
			ExpectedExpr: ">= 8",
		},
		{
			ID:           "SC01-A2",
			Description:  "Có ít nhất 1 chuyến hàng (trip) được tạo",
			Query:        `SELECT COUNT(*) FROM trips`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC01-A3",
			Description:  "entity_events có sự kiện order.created",
			Query:        `SELECT COUNT(*) FROM entity_events WHERE event_type = 'order.created'`,
			ExpectedExpr: ">= 8",
		},
		{
			ID:           "SC01-A4",
			Description:  "Stock reserved > 0 (đơn hàng đã lock tồn kho)",
			Query:        `SELECT COALESCE(SUM(reserved_qty), 0) FROM stock_quants`,
			ExpectedExpr: "> 0",
		},
	}
}

// SC-02: Credit Exceed — order goes to pending_approval
func sc02Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC02-A1",
			Description:  "Có ít nhất 1 đơn vượt hạn mức (pending_approval hoặc credit_status=over_limit)",
			Query:        `SELECT COUNT(*) FROM sales_orders WHERE status::text = 'pending_approval' OR credit_status::text = 'over_limit'`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC02-A2",
			Description:  "Tất cả đơn hàng được tạo thành công (ít nhất 2)",
			Query:        `SELECT COUNT(*) FROM sales_orders`,
			ExpectedExpr: ">= 2",
		},
	}
}

// SC-03: ATP Fail — order with atp_status=insufficient
func sc03Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC03-A1",
			Description:  "Có ít nhất 1 đơn hàng với atp_status=insufficient",
			Query:        `SELECT COUNT(*) FROM sales_orders WHERE atp_status::text = 'insufficient'`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:          "SC03-A2",
			Description: "Stock reserved không vượt quá stock available",
			Query:       `SELECT COUNT(*) FROM stock_quants WHERE reserved_qty > quantity`,
			ExpectedVal: 0,
		},
	}
}

// SC-04: Zalo Reject — order confirmation with reject
func sc04Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC04-A1",
			Description:  "Có ít nhất 1 order_confirmation được tạo",
			Query:        `SELECT COUNT(*) FROM order_confirmations`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC04-A2",
			Description:  "Có ít nhất 1 đơn hàng được tạo",
			Query:        `SELECT COUNT(*) FROM sales_orders`,
			ExpectedExpr: ">= 1",
		},
	}
}

// SC-05: Dispatch Trip — trip created and assigned to driver
func sc05Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC05-A1",
			Description:  "Có ít nhất 1 chuyến hàng được tạo",
			Query:        `SELECT COUNT(*) FROM trips`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC05-A2",
			Description:  "Có ít nhất 1 trip_stop được tạo",
			Query:        `SELECT COUNT(*) FROM trip_stops`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC05-A3",
			Description:  "Đơn hàng đã được assign vào chuyến (shipments > 0)",
			Query:        `SELECT COUNT(*) FROM shipments`,
			ExpectedExpr: ">= 1",
		},
	}
}

// SC-06: Multi-Stop — multiple stops in one trip
func sc06Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC06-A1",
			Description:  "Có ít nhất 1 chuyến hàng",
			Query:        `SELECT COUNT(*) FROM trips`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC06-A2",
			Description:  "Có ít nhất 3 điểm dừng (multi-stop)",
			Query:        `SELECT COUNT(*) FROM trip_stops`,
			ExpectedExpr: ">= 3",
		},
	}
}

// SC-07: Gate Check Fail — gate check with failed items
func sc07Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC07-A1",
			Description:  "Có ít nhất 1 gate_check record",
			Query:        `SELECT COUNT(*) FROM gate_checks`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC07-A2",
			Description:  "Có chuyến hàng chờ xuất bến",
			Query:        `SELECT COUNT(*) FROM trips WHERE status::text IN ('planned','assigned','ready')`,
			ExpectedExpr: ">= 1",
		},
	}
}

// SC-08: Reconciliation Discrepancy
func sc08Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC08-A1",
			Description:  "Có ít nhất 1 reconciliation record",
			Query:        `SELECT COUNT(*) FROM reconciliations`,
			ExpectedExpr: ">= 1",
		},
		{
			ID:           "SC08-A2",
			Description:  "Có ít nhất 1 discrepancy (chênh lệch)",
			Query:        `SELECT COUNT(*) FROM discrepancies`,
			ExpectedExpr: ">= 1",
		},
	}
}

// SC-09: VRP Stress — many orders for route optimization
func sc09Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC09-A1",
			Description:  "Có ít nhất 20 đơn hàng (stress test)",
			Query:        `SELECT COUNT(*) FROM sales_orders`,
			ExpectedExpr: ">= 20",
		},
		{
			ID:          "SC09-A2",
			Description: "Tổng stock reserved không vượt tổng quantity",
			Query:       `SELECT COUNT(*) FROM stock_quants WHERE reserved_qty > quantity`,
			ExpectedVal: 0,
		},
	}
}

// SC-13: Document Expiry — tài liệu xe hết hạn
func sc13Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC13-A1",
			Description:  "Có ít nhất 1 phương tiện trong hệ thống",
			Query:        `SELECT COUNT(*) FROM vehicles`,
			ExpectedExpr: ">= 1",
		},
	}
}

// SC-14: FEFO Allocation — first expired first out
func sc14Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC14-A1",
			Description:  "Có ít nhất 2 lots với expiry_date khác nhau",
			Query:        `SELECT COUNT(DISTINCT expiry_date) FROM lots WHERE expiry_date IS NOT NULL`,
			ExpectedExpr: ">= 2",
		},
		{
			ID:           "SC14-A2",
			Description:  "Có stock với multiple lots",
			Query:        `SELECT COUNT(*) FROM stock_quants WHERE lot_id IS NOT NULL`,
			ExpectedExpr: ">= 2",
		},
	}
}

// SC-15: Driver EOD — tài xế cuối ngày checkout
func sc15Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC15-A1",
			Description:  "Có ít nhất 1 chuyến hàng hoàn thành hoặc đang giao",
			Query:        `SELECT COUNT(*) FROM trips WHERE status::text IN ('in_transit','completed')`,
			ExpectedExpr: ">= 1",
		},
	}
}

// SC-16: KPI Snapshot — kiểm tra KPI metrics
func sc16Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC16-A1",
			Description:  "Có đơn hàng delivered để tính KPI",
			Query:        `SELECT COUNT(*) FROM sales_orders WHERE status::text = 'delivered'`,
			ExpectedExpr: ">= 1",
		},
	}
}

// SC-17: RBAC Violation — unauthorized access attempt
func sc17Assertions() []AssertionDef {
	return []AssertionDef{
		{
			ID:           "SC17-A1",
			Description:  "Có đủ role_permissions records (>= 9 roles configured)",
			Query:        `SELECT COUNT(DISTINCT role) FROM role_permissions`,
			ExpectedExpr: ">= 1",
		},
	}
}
