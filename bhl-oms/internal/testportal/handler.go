package testportal

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// Handler provides test portal endpoints — no auth required, for QA/testing only.
type Handler struct {
	db      *pgxpool.Pool
	rdb     *redis.Client
	log     logger.Logger
	osrmURL string

	// GPS simulation state
	gpsMu     sync.Mutex
	gpsCancel context.CancelFunc
	gpsStatus *GPSSimStatus
}

func NewHandler(db *pgxpool.Pool, rdb *redis.Client, log logger.Logger, osrmURL string) *Handler {
	return &Handler{db: db, rdb: rdb, log: log, osrmURL: osrmURL}
}

// RegisterRoutes registers test portal routes under /v1/test-portal (no auth).
func (h *Handler) RegisterRoutes(r *gin.RouterGroup) {
	tp := r.Group("/test-portal")
	{
		// Overview data
		tp.GET("/orders", h.ListOrders)
		tp.GET("/orders/:id", h.GetOrder)
		tp.GET("/order-confirmations", h.ListOrderConfirmations)
		tp.GET("/delivery-confirmations", h.ListDeliveryConfirmations)
		tp.GET("/stock", h.ListStock)
		tp.GET("/credit-balances", h.ListCreditBalances)
		tp.GET("/customers", h.ListCustomers)
		tp.GET("/products", h.ListProducts)
		tp.GET("/drivers", h.ListDrivers)
		tp.GET("/orders/:id/timeline", h.GetOrderTimeline)
		tp.GET("/orders/:id/notes", h.GetOrderNotes)
		tp.GET("/ops-audit", h.GetOpsAudit)

		// Test actions
		tp.POST("/reset-data", h.ResetTestData)
		tp.POST("/create-test-order", h.CreateTestOrder)
		tp.POST("/simulate-delivery", h.SimulateDelivery)

		// Scenario auto-run
		tp.POST("/run-scenario", h.RunScenario)

		// Scenario data loading (new)
		tp.GET("/scenarios", h.ListScenarios)
		tp.POST("/load-scenario", h.LoadScenario)
		tp.POST("/run-assertions", h.RunAssertions)
		tp.POST("/run-all-smoke", h.RunAllSmoke)
		tp.GET("/risk-monitor", h.GetRiskMonitor)

		// Zalo inbox — NPP customer view
		tp.GET("/zalo-inbox", h.ZaloInbox)

		// GPS Simulation
		tp.GET("/gps/scenarios", h.GPSScenarios)
		tp.GET("/gps/vehicles", h.GPSVehicles)
		tp.POST("/gps/start", h.GPSStart)
		tp.POST("/gps/stop", h.GPSStop)
		tp.GET("/gps/status", h.GPSStatus)

		// AQF Command Center — Quality Gate visibility & control
		aqf := tp.Group("/aqf")
		{
			aqf.GET("/status", h.AQFStatus)
			aqf.POST("/run", h.AQFRun)
			aqf.GET("/golden", h.AQFGolden)
			aqf.GET("/health", h.AQFHealth)
			aqf.GET("/evidence", h.AQFEvidence)
			aqf.GET("/questions", h.AQFQuestions)
			aqf.POST("/answer", h.AQFAnswer)
		}
	}
}

// GET /v1/test-portal/orders — list recent orders with confirmation status
func (h *Handler) ListOrders(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.Query(ctx, `
		SELECT so.id, so.order_number, c.name AS customer_name, so.status::text, 
			so.total_amount, so.delivery_date::text, so.atp_status, so.credit_status,
			so.created_at,
			oc.token AS confirm_token, oc.status AS confirm_status, oc.expires_at
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		LEFT JOIN order_confirmations oc ON oc.order_id = so.id
		ORDER BY so.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type OrderRow struct {
		ID             uuid.UUID  `json:"id"`
		OrderNumber    string     `json:"order_number"`
		CustomerName   string     `json:"customer_name"`
		Status         string     `json:"status"`
		TotalAmount    float64    `json:"total_amount"`
		DeliveryDate   string     `json:"delivery_date"`
		ATPStatus      string     `json:"atp_status"`
		CreditStatus   string     `json:"credit_status"`
		CreatedAt      time.Time  `json:"created_at"`
		ConfirmToken   *string    `json:"confirm_token"`
		ConfirmStatus  *string    `json:"confirm_status"`
		ConfirmExpires *time.Time `json:"confirm_expires"`
	}

	var orders []OrderRow
	for rows.Next() {
		var o OrderRow
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.CustomerName, &o.Status,
			&o.TotalAmount, &o.DeliveryDate, &o.ATPStatus, &o.CreditStatus,
			&o.CreatedAt, &o.ConfirmToken, &o.ConfirmStatus, &o.ConfirmExpires); err != nil {
			continue
		}
		orders = append(orders, o)
	}
	if orders == nil {
		orders = []OrderRow{}
	}
	response.OK(c, orders)
}

// GET /v1/test-portal/orders/:id — order detail with items
func (h *Handler) GetOrder(c *gin.Context) {
	ctx := c.Request.Context()
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid order id")
		return
	}

	type ItemRow struct {
		ProductName string  `json:"product_name"`
		SKU         string  `json:"sku"`
		Quantity    int     `json:"quantity"`
		UnitPrice   float64 `json:"unit_price"`
		Amount      float64 `json:"amount"`
	}
	type ConfRow struct {
		Token     string    `json:"token"`
		Status    string    `json:"status"`
		Phone     string    `json:"phone"`
		PDFURL    *string   `json:"pdf_url"`
		SentAt    time.Time `json:"sent_at"`
		ExpiresAt time.Time `json:"expires_at"`
	}
	type OrderDetail struct {
		ID            uuid.UUID `json:"id"`
		OrderNumber   string    `json:"order_number"`
		CustomerName  string    `json:"customer_name"`
		CustomerPhone *string   `json:"customer_phone"`
		WarehouseName string    `json:"warehouse_name"`
		Status        string    `json:"status"`
		DeliveryDate  string    `json:"delivery_date"`
		TotalAmount   float64   `json:"total_amount"`
		DepositAmount float64   `json:"deposit_amount"`
		ATPStatus     string    `json:"atp_status"`
		CreditStatus  string    `json:"credit_status"`
		Notes         *string   `json:"notes"`
		CreatedAt     time.Time `json:"created_at"`
		Items         []ItemRow `json:"items"`
		Confirmation  *ConfRow  `json:"confirmation"`
	}

	var o OrderDetail
	err = h.db.QueryRow(ctx, `
		SELECT so.id, so.order_number, c.name, c.phone, 
			COALESCE(w.name, ''), so.status::text, so.delivery_date::text,
			so.total_amount, so.deposit_amount, so.atp_status, so.credit_status,
			so.notes, so.created_at
		FROM sales_orders so
		JOIN customers c ON c.id = so.customer_id
		LEFT JOIN warehouses w ON w.id = so.warehouse_id
		WHERE so.id = $1
	`, id).Scan(&o.ID, &o.OrderNumber, &o.CustomerName, &o.CustomerPhone,
		&o.WarehouseName, &o.Status, &o.DeliveryDate,
		&o.TotalAmount, &o.DepositAmount, &o.ATPStatus, &o.CreditStatus,
		&o.Notes, &o.CreatedAt)
	if err != nil {
		response.NotFound(c, "order not found")
		return
	}

	// Items
	itemRows, _ := h.db.Query(ctx, `
		SELECT p.name, p.sku, oi.quantity, oi.unit_price, oi.amount
		FROM order_items oi JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
	`, id)
	if itemRows != nil {
		defer itemRows.Close()
		for itemRows.Next() {
			var it ItemRow
			if err := itemRows.Scan(&it.ProductName, &it.SKU, &it.Quantity, &it.UnitPrice, &it.Amount); err == nil {
				o.Items = append(o.Items, it)
			}
		}
	}

	// Confirmation
	var conf ConfRow
	err = h.db.QueryRow(ctx, `
		SELECT token, status, phone, pdf_url, sent_at, expires_at
		FROM order_confirmations WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1
	`, id).Scan(&conf.Token, &conf.Status, &conf.Phone, &conf.PDFURL, &conf.SentAt, &conf.ExpiresAt)
	if err == nil {
		o.Confirmation = &conf
	}

	response.OK(c, o)
}

// GET /v1/test-portal/order-confirmations — all order confirmations
func (h *Handler) ListOrderConfirmations(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.Query(ctx, `
		SELECT oc.id, oc.order_id, so.order_number, c.name, oc.token, oc.phone,
			oc.status, oc.total_amount, oc.pdf_url, oc.sent_at, oc.confirmed_at,
			oc.rejected_at, oc.reject_reason, oc.auto_confirmed_at, oc.expires_at
		FROM order_confirmations oc
		JOIN sales_orders so ON so.id = oc.order_id
		JOIN customers c ON c.id = oc.customer_id
		ORDER BY oc.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type Row struct {
		ID              uuid.UUID  `json:"id"`
		OrderID         uuid.UUID  `json:"order_id"`
		OrderNumber     string     `json:"order_number"`
		CustomerName    string     `json:"customer_name"`
		Token           string     `json:"token"`
		Phone           string     `json:"phone"`
		Status          string     `json:"status"`
		TotalAmount     float64    `json:"total_amount"`
		PDFURL          *string    `json:"pdf_url"`
		SentAt          time.Time  `json:"sent_at"`
		ConfirmedAt     *time.Time `json:"confirmed_at"`
		RejectedAt      *time.Time `json:"rejected_at"`
		RejectReason    *string    `json:"reject_reason"`
		AutoConfirmedAt *time.Time `json:"auto_confirmed_at"`
		ExpiresAt       time.Time  `json:"expires_at"`
	}

	var results []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.OrderID, &r.OrderNumber, &r.CustomerName,
			&r.Token, &r.Phone, &r.Status, &r.TotalAmount, &r.PDFURL,
			&r.SentAt, &r.ConfirmedAt, &r.RejectedAt, &r.RejectReason,
			&r.AutoConfirmedAt, &r.ExpiresAt); err != nil {
			continue
		}
		results = append(results, r)
	}
	if results == nil {
		results = []Row{}
	}
	response.OK(c, results)
}

// GET /v1/test-portal/delivery-confirmations — all zalo delivery confirmations
func (h *Handler) ListDeliveryConfirmations(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.Query(ctx, `
		SELECT zc.id, zc.order_id, so.order_number, c.name, zc.token, zc.phone,
			zc.status::text, zc.total_amount, zc.sent_at, zc.confirmed_at,
			zc.disputed_at, zc.dispute_reason, zc.auto_confirmed_at
		FROM zalo_confirmations zc
		JOIN sales_orders so ON so.id = zc.order_id
		JOIN customers c ON c.id = zc.customer_id
		ORDER BY zc.created_at DESC
		LIMIT 50
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type Row struct {
		ID              uuid.UUID  `json:"id"`
		OrderID         uuid.UUID  `json:"order_id"`
		OrderNumber     string     `json:"order_number"`
		CustomerName    string     `json:"customer_name"`
		Token           string     `json:"token"`
		Phone           string     `json:"phone"`
		Status          string     `json:"status"`
		TotalAmount     float64    `json:"total_amount"`
		SentAt          time.Time  `json:"sent_at"`
		ConfirmedAt     *time.Time `json:"confirmed_at"`
		DisputedAt      *time.Time `json:"disputed_at"`
		DisputeReason   *string    `json:"dispute_reason"`
		AutoConfirmedAt *time.Time `json:"auto_confirmed_at"`
	}

	var results []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.OrderID, &r.OrderNumber, &r.CustomerName,
			&r.Token, &r.Phone, &r.Status, &r.TotalAmount, &r.SentAt,
			&r.ConfirmedAt, &r.DisputedAt, &r.DisputeReason, &r.AutoConfirmedAt); err != nil {
			continue
		}
		results = append(results, r)
	}
	if results == nil {
		results = []Row{}
	}
	response.OK(c, results)
}

// GET /v1/test-portal/stock — warehouse stock overview
func (h *Handler) ListStock(c *gin.Context) {
	ctx := c.Request.Context()
	warehouseID := c.Query("warehouse_id")

	query := `
		SELECT sq.product_id, p.name, p.sku, sq.warehouse_id, w.name,
			SUM(sq.quantity) AS total_qty, SUM(sq.reserved_qty) AS reserved,
			SUM(sq.quantity - sq.reserved_qty) AS available,
			COALESCE(l.batch_number, '') AS batch_number,
			COALESCE(l.expiry_date::text, '') AS expiry_date
		FROM stock_quants sq
		JOIN products p ON p.id = sq.product_id
		JOIN warehouses w ON w.id = sq.warehouse_id
		LEFT JOIN lots l ON l.id = sq.lot_id
	`
	args := []interface{}{}
	if warehouseID != "" {
		wID, err := uuid.Parse(warehouseID)
		if err == nil {
			query += " WHERE sq.warehouse_id = $1"
			args = append(args, wID)
		}
	}
	query += ` GROUP BY sq.product_id, p.name, p.sku, sq.warehouse_id, w.name, l.batch_number, l.expiry_date
		ORDER BY p.name, l.expiry_date ASC
		LIMIT 200`

	rows, err := h.db.Query(ctx, query, args...)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type StockRow struct {
		ProductID     uuid.UUID `json:"product_id"`
		ProductName   string    `json:"product_name"`
		ProductSKU    string    `json:"product_sku"`
		WarehouseID   uuid.UUID `json:"warehouse_id"`
		WarehouseName string    `json:"warehouse_name"`
		TotalQty      int       `json:"total_qty"`
		Reserved      int       `json:"reserved"`
		Available     int       `json:"available"`
		BatchNumber   string    `json:"batch_number"`
		ExpiryDate    string    `json:"expiry_date"`
	}

	var items []StockRow
	for rows.Next() {
		var s StockRow
		if err := rows.Scan(&s.ProductID, &s.ProductName, &s.ProductSKU,
			&s.WarehouseID, &s.WarehouseName, &s.TotalQty, &s.Reserved, &s.Available,
			&s.BatchNumber, &s.ExpiryDate); err != nil {
			continue
		}
		items = append(items, s)
	}
	if items == nil {
		items = []StockRow{}
	}
	response.OK(c, items)
}

// GET /v1/test-portal/credit-balances — customer credit from receivable_ledger
func (h *Handler) ListCreditBalances(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.Query(ctx, `
		SELECT c.id, c.code, c.name, COALESCE(cl.credit_limit, 0),
			COALESCE((SELECT SUM(CASE WHEN rl.ledger_type = 'debit' THEN rl.amount ELSE -rl.amount END)
			          FROM receivable_ledger rl WHERE rl.customer_id = c.id), 0) AS current_balance,
			COALESCE(cl.credit_limit, 0) - COALESCE((SELECT SUM(CASE WHEN rl.ledger_type = 'debit' THEN rl.amount ELSE -rl.amount END)
			          FROM receivable_ledger rl WHERE rl.customer_id = c.id), 0) AS available_limit
		FROM customers c
		LEFT JOIN credit_limits cl ON cl.customer_id = c.id
		     AND cl.effective_from <= CURRENT_DATE
		     AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
		WHERE c.is_active = true
		ORDER BY c.name
		LIMIT 100
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type CreditRow struct {
		ID             uuid.UUID `json:"id"`
		Code           string    `json:"code"`
		Name           string    `json:"name"`
		CreditLimit    float64   `json:"credit_limit"`
		CurrentBalance float64   `json:"current_balance"`
		AvailableLimit float64   `json:"available_limit"`
	}

	var items []CreditRow
	for rows.Next() {
		var cr CreditRow
		if err := rows.Scan(&cr.ID, &cr.Code, &cr.Name, &cr.CreditLimit,
			&cr.CurrentBalance, &cr.AvailableLimit); err != nil {
			continue
		}
		items = append(items, cr)
	}
	if items == nil {
		items = []CreditRow{}
	}
	response.OK(c, items)
}

// GET /v1/test-portal/customers
func (h *Handler) ListCustomers(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.Query(ctx, `
		SELECT c.id, c.code, c.name, COALESCE(c.phone, ''), COALESCE(c.address, ''),
			COALESCE(cl.credit_limit, 0)
		FROM customers c
		LEFT JOIN credit_limits cl ON cl.customer_id = c.id
		     AND cl.effective_from <= CURRENT_DATE
		     AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
		WHERE c.is_active = true ORDER BY c.name LIMIT 100
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type Row struct {
		ID          uuid.UUID `json:"id"`
		Code        string    `json:"code"`
		Name        string    `json:"name"`
		Phone       string    `json:"phone"`
		Address     string    `json:"address"`
		CreditLimit float64   `json:"credit_limit"`
	}

	var items []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.Code, &r.Name, &r.Phone, &r.Address, &r.CreditLimit); err != nil {
			continue
		}
		items = append(items, r)
	}
	if items == nil {
		items = []Row{}
	}
	response.OK(c, items)
}

// GET /v1/test-portal/products
func (h *Handler) ListProducts(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.Query(ctx, `
		SELECT id, sku, name, price, deposit_price, weight_kg, volume_m3
		FROM products WHERE is_active = true ORDER BY name
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type Row struct {
		ID           uuid.UUID `json:"id"`
		SKU          string    `json:"sku"`
		Name         string    `json:"name"`
		Price        float64   `json:"price"`
		DepositPrice float64   `json:"deposit_price"`
		WeightKg     float64   `json:"weight_kg"`
		VolumeM3     float64   `json:"volume_m3"`
	}

	var items []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.SKU, &r.Name, &r.Price, &r.DepositPrice, &r.WeightKg, &r.VolumeM3); err != nil {
			continue
		}
		items = append(items, r)
	}
	if items == nil {
		items = []Row{}
	}
	response.OK(c, items)
}

// GET /v1/test-portal/drivers
func (h *Handler) ListDrivers(c *gin.Context) {
	ctx := c.Request.Context()
	rows, err := h.db.Query(ctx, `
		SELECT d.id, d.full_name, COALESCE(d.phone, ''), d.license_number,
			d.status::text, d.warehouse_id::text, d.user_id::text
		FROM drivers d
		WHERE d.status::text = 'active'
		ORDER BY d.full_name
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type Row struct {
		ID            string  `json:"id"`
		FullName      string  `json:"full_name"`
		Phone         string  `json:"phone"`
		LicenseNumber *string `json:"license_number"`
		Status        string  `json:"status"`
		WarehouseID   string  `json:"warehouse_id"`
		UserID        string  `json:"user_id"`
	}

	var items []Row
	for rows.Next() {
		var r Row
		if err := rows.Scan(&r.ID, &r.FullName, &r.Phone, &r.LicenseNumber, &r.Status, &r.WarehouseID, &r.UserID); err != nil {
			continue
		}
		items = append(items, r)
	}
	if items == nil {
		items = []Row{}
	}
	response.OK(c, items)
}

// GET /v1/test-portal/orders/:id/timeline
func (h *Handler) GetOrderTimeline(c *gin.Context) {
	ctx := c.Request.Context()
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid order id")
		return
	}

	type TimelineEvent struct {
		ID        uuid.UUID       `json:"id"`
		EventType string          `json:"event_type"`
		ActorType string          `json:"actor_type"`
		ActorName string          `json:"actor_name"`
		Title     string          `json:"title"`
		Detail    json.RawMessage `json:"detail"`
		CreatedAt time.Time       `json:"created_at"`
	}

	rows, err := h.db.Query(ctx, `
		SELECT id, event_type, actor_type, COALESCE(actor_name, ''), title,
		  COALESCE(detail::text, '{}')::jsonb, created_at
		FROM entity_events
		WHERE entity_type = 'order' AND entity_id = $1
		ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	items := make([]TimelineEvent, 0)
	for rows.Next() {
		var item TimelineEvent
		if err := rows.Scan(&item.ID, &item.EventType, &item.ActorType, &item.ActorName, &item.Title, &item.Detail, &item.CreatedAt); err == nil {
			items = append(items, item)
		}
	}
	response.OK(c, items)
}

// GET /v1/test-portal/orders/:id/notes
func (h *Handler) GetOrderNotes(c *gin.Context) {
	ctx := c.Request.Context()
	orderID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		response.BadRequest(c, "invalid order id")
		return
	}

	type OrderNoteRow struct {
		ID        uuid.UUID `json:"id"`
		UserName  string    `json:"user_name"`
		Content   string    `json:"content"`
		NoteType  string    `json:"note_type"`
		IsPinned  bool      `json:"is_pinned"`
		CreatedAt time.Time `json:"created_at"`
	}

	rows, err := h.db.Query(ctx, `
		SELECT id, COALESCE(user_name, ''), content,
		  COALESCE(note_type, 'internal'), COALESCE(is_pinned, false), created_at
		FROM order_notes
		WHERE order_id = $1
		ORDER BY is_pinned DESC, created_at DESC
	`, orderID)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	items := make([]OrderNoteRow, 0)
	for rows.Next() {
		var item OrderNoteRow
		if err := rows.Scan(&item.ID, &item.UserName, &item.Content, &item.NoteType, &item.IsPinned, &item.CreatedAt); err == nil {
			items = append(items, item)
		}
	}
	response.OK(c, items)
}

// GET /v1/test-portal/ops-audit
func (h *Handler) GetOpsAudit(c *gin.Context) {
	ctx := c.Request.Context()

	type SessionRow struct {
		ID         uuid.UUID  `json:"id"`
		UserName   string     `json:"user_name"`
		IPAddress  string     `json:"ip_address"`
		UserAgent  string     `json:"user_agent"`
		LastSeenAt time.Time  `json:"last_seen_at"`
		CreatedAt  time.Time  `json:"created_at"`
		RevokedAt  *time.Time `json:"revoked_at"`
	}

	type DLQRow struct {
		ID           uuid.UUID `json:"id"`
		Adapter      string    `json:"adapter"`
		Operation    string    `json:"operation"`
		Status       string    `json:"status"`
		RetryCount   int       `json:"retry_count"`
		MaxRetries   int       `json:"max_retries"`
		ErrorMessage string    `json:"error_message"`
		CreatedAt    time.Time `json:"created_at"`
	}

	type DiscrepancyRow struct {
		ID          uuid.UUID  `json:"id"`
		TripNumber  string     `json:"trip_number"`
		DiscType    string     `json:"disc_type"`
		Status      string     `json:"status"`
		Description string     `json:"description"`
		Variance    float64    `json:"variance"`
		Deadline    *time.Time `json:"deadline"`
		CreatedAt   time.Time  `json:"created_at"`
	}

	type DailyCloseRow struct {
		ID                  uuid.UUID `json:"id"`
		CloseDate           string    `json:"close_date"`
		WarehouseName       string    `json:"warehouse_name"`
		CompletedTrips      int       `json:"completed_trips"`
		TotalTrips          int       `json:"total_trips"`
		TotalDiscrepancies  int       `json:"total_discrepancies"`
		ResolvedDiscrepancy int       `json:"resolved_discrepancies"`
		TotalRevenue        float64   `json:"total_revenue"`
	}

	type SnapshotRow struct {
		SnapshotDate        string  `json:"snapshot_date"`
		WarehouseName       string  `json:"warehouse_name"`
		OTDRate             float64 `json:"otd_rate"`
		DeliverySuccessRate float64 `json:"delivery_success_rate"`
		TotalOrders         int     `json:"total_orders"`
		TotalRevenue        float64 `json:"total_revenue"`
	}

	result := struct {
		Admin struct {
			PermissionRules int          `json:"permission_rules"`
			Overrides       int          `json:"overrides"`
			ActiveSessions  int          `json:"active_sessions"`
			Routes          int          `json:"routes"`
			Configs         int          `json:"configs"`
			CreditLimits    int          `json:"credit_limits"`
			RecentSessions  []SessionRow `json:"recent_sessions"`
		} `json:"admin"`
		Integration struct {
			Pending  int      `json:"pending"`
			Retrying int      `json:"retrying"`
			Failed   int      `json:"failed"`
			Resolved int      `json:"resolved"`
			Recent   []DLQRow `json:"recent"`
		} `json:"integration"`
		Reconciliation struct {
			TotalRecons           int              `json:"total_recons"`
			OpenDiscrepancies     int              `json:"open_discrepancies"`
			ResolvedDiscrepancies int              `json:"resolved_discrepancies"`
			DailyCloses           int              `json:"daily_closes"`
			RecentDiscrepancies   []DiscrepancyRow `json:"recent_discrepancies"`
			RecentDailyCloses     []DailyCloseRow  `json:"recent_daily_closes"`
		} `json:"reconciliation"`
		KPI struct {
			Snapshots          int           `json:"snapshots"`
			IssueOrders        int           `json:"issue_orders"`
			CancellationOrders int           `json:"cancellation_orders"`
			RedeliveryOrders   int           `json:"redelivery_orders"`
			RecentSnapshots    []SnapshotRow `json:"recent_snapshots"`
		} `json:"kpi"`
	}{}

	_ = h.db.QueryRow(ctx, `
		SELECT
		  (SELECT COUNT(*) FROM role_permissions),
		  (SELECT COUNT(*) FROM user_permission_overrides WHERE expires_at IS NULL OR expires_at > NOW()),
		  (SELECT COUNT(*) FROM active_sessions WHERE revoked_at IS NULL),
		  (SELECT COUNT(*) FROM delivery_routes),
		  (SELECT COUNT(*) FROM system_settings),
		  (SELECT COUNT(*) FROM credit_limits WHERE effective_to IS NULL OR effective_to >= CURRENT_DATE)
	`).Scan(
		&result.Admin.PermissionRules,
		&result.Admin.Overrides,
		&result.Admin.ActiveSessions,
		&result.Admin.Routes,
		&result.Admin.Configs,
		&result.Admin.CreditLimits,
	)

	sessionRows, err := h.db.Query(ctx, `
		SELECT s.id, COALESCE(u.full_name, u.username, ''), COALESCE(s.ip_address::text, ''),
		  COALESCE(s.user_agent, ''), s.last_seen_at, s.created_at, s.revoked_at
		FROM active_sessions s
		JOIN users u ON u.id = s.user_id
		ORDER BY s.created_at DESC
		LIMIT 8
	`)
	if err == nil {
		defer sessionRows.Close()
		for sessionRows.Next() {
			var item SessionRow
			if err := sessionRows.Scan(&item.ID, &item.UserName, &item.IPAddress, &item.UserAgent, &item.LastSeenAt, &item.CreatedAt, &item.RevokedAt); err == nil {
				result.Admin.RecentSessions = append(result.Admin.RecentSessions, item)
			}
		}
	}

	dlqCounts, err := h.db.Query(ctx, `SELECT status::text, COUNT(*) FROM integration_dlq GROUP BY status`)
	if err == nil {
		defer dlqCounts.Close()
		for dlqCounts.Next() {
			var status string
			var count int
			if dlqCounts.Scan(&status, &count) == nil {
				switch status {
				case "pending":
					result.Integration.Pending = count
				case "retrying":
					result.Integration.Retrying = count
				case "failed":
					result.Integration.Failed = count
				case "resolved":
					result.Integration.Resolved = count
				}
			}
		}
	}

	dlqRows, err := h.db.Query(ctx, `
		SELECT id, adapter, operation, status::text, retry_count, max_retries,
		  LEFT(COALESCE(error_message, ''), 160), created_at
		FROM integration_dlq
		ORDER BY created_at DESC
		LIMIT 8
	`)
	if err == nil {
		defer dlqRows.Close()
		for dlqRows.Next() {
			var item DLQRow
			if err := dlqRows.Scan(&item.ID, &item.Adapter, &item.Operation, &item.Status, &item.RetryCount, &item.MaxRetries, &item.ErrorMessage, &item.CreatedAt); err == nil {
				result.Integration.Recent = append(result.Integration.Recent, item)
			}
		}
	}

	_ = h.db.QueryRow(ctx, `
		SELECT
		  (SELECT COUNT(*) FROM reconciliations),
		  (SELECT COUNT(*) FROM discrepancies WHERE status::text IN ('open','investigating','escalated')),
		  (SELECT COUNT(*) FROM discrepancies WHERE status::text = 'resolved'),
		  (SELECT COUNT(*) FROM daily_close_summaries)
	`).Scan(
		&result.Reconciliation.TotalRecons,
		&result.Reconciliation.OpenDiscrepancies,
		&result.Reconciliation.ResolvedDiscrepancies,
		&result.Reconciliation.DailyCloses,
	)

	discRows, err := h.db.Query(ctx, `
		SELECT d.id, COALESCE(t.trip_number, '-'), d.disc_type::text, d.status::text,
		  COALESCE(d.description, ''), d.variance, d.deadline, d.created_at
		FROM discrepancies d
		LEFT JOIN trips t ON t.id = d.trip_id
		ORDER BY d.created_at DESC
		LIMIT 8
	`)
	if err == nil {
		defer discRows.Close()
		for discRows.Next() {
			var item DiscrepancyRow
			if err := discRows.Scan(&item.ID, &item.TripNumber, &item.DiscType, &item.Status, &item.Description, &item.Variance, &item.Deadline, &item.CreatedAt); err == nil {
				result.Reconciliation.RecentDiscrepancies = append(result.Reconciliation.RecentDiscrepancies, item)
			}
		}
	}

	closeRows, err := h.db.Query(ctx, `
		SELECT dcs.id, dcs.close_date::text, COALESCE(w.name, ''), dcs.completed_trips,
		  dcs.total_trips, dcs.total_discrepancies, dcs.resolved_discrepancies, dcs.total_revenue
		FROM daily_close_summaries dcs
		JOIN warehouses w ON w.id = dcs.warehouse_id
		ORDER BY dcs.close_date DESC
		LIMIT 6
	`)
	if err == nil {
		defer closeRows.Close()
		for closeRows.Next() {
			var item DailyCloseRow
			if err := closeRows.Scan(&item.ID, &item.CloseDate, &item.WarehouseName, &item.CompletedTrips, &item.TotalTrips, &item.TotalDiscrepancies, &item.ResolvedDiscrepancy, &item.TotalRevenue); err == nil {
				result.Reconciliation.RecentDailyCloses = append(result.Reconciliation.RecentDailyCloses, item)
			}
		}
	}

	_ = h.db.QueryRow(ctx, `
		SELECT
		  (SELECT COUNT(*) FROM daily_kpi_snapshots),
		  (SELECT COUNT(*) FROM sales_orders WHERE status::text IN ('failed','partially_delivered')),
		  (SELECT COUNT(*) FROM sales_orders WHERE status::text IN ('cancelled','rejected','pending_approval')),
		  (SELECT COUNT(*) FROM sales_orders WHERE re_delivery_count > 0 OR status::text = 're_delivery')
	`).Scan(
		&result.KPI.Snapshots,
		&result.KPI.IssueOrders,
		&result.KPI.CancellationOrders,
		&result.KPI.RedeliveryOrders,
	)

	snapshotRows, err := h.db.Query(ctx, `
		SELECT d.snapshot_date::text, COALESCE(w.name, ''), d.otd_rate,
		  d.delivery_success_rate, d.total_orders, d.total_revenue
		FROM daily_kpi_snapshots d
		JOIN warehouses w ON w.id = d.warehouse_id
		ORDER BY d.snapshot_date DESC
		LIMIT 6
	`)
	if err == nil {
		defer snapshotRows.Close()
		for snapshotRows.Next() {
			var item SnapshotRow
			if err := snapshotRows.Scan(&item.SnapshotDate, &item.WarehouseName, &item.OTDRate, &item.DeliverySuccessRate, &item.TotalOrders, &item.TotalRevenue); err == nil {
				result.KPI.RecentSnapshots = append(result.KPI.RecentSnapshots, item)
			}
		}
	}

	response.OK(c, result)
}

// POST /v1/test-portal/reset-data — clear transactional data, keep NPP + products
func (h *Handler) ResetTestData(c *gin.Context) {
	ctx := c.Request.Context()

	queries := []string{
		// Level 1: Leaf tables (no other table references these)
		"DELETE FROM discrepancies",
		"DELETE FROM payments",
		"DELETE FROM return_collections",
		"DELETE FROM zalo_confirmations",
		"DELETE FROM order_confirmations",
		"DELETE FROM audit_logs",
		"DELETE FROM notifications",
		"DELETE FROM daily_kpi_snapshots",
		"DELETE FROM daily_close_summaries",
		"DELETE FROM integration_dlq",
		"DELETE FROM driver_checkins",
		"DELETE FROM asset_ledger",
		"DELETE FROM delivery_routes",
		// Level 2: Referenced by level 1
		"DELETE FROM epod",
		"DELETE FROM gate_checks",
		"DELETE FROM picking_orders",
		"DELETE FROM reconciliations",
		"DELETE FROM trip_checklists",
		// Level 3+: Parent tables
		"DELETE FROM trip_stops",
		"DELETE FROM trips",
		"DELETE FROM shipments",
		"DELETE FROM order_items",
		"DELETE FROM receivable_ledger",
		"DELETE FROM stock_moves",
		"DELETE FROM sales_orders",
		// Reset stock reserved to 0
		"UPDATE stock_quants SET reserved_qty = 0",
	}

	tx, err := h.db.Begin(ctx)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer tx.Rollback(ctx)

	for _, q := range queries {
		if _, err := tx.Exec(ctx, q); err != nil {
			h.log.Error(ctx, "reset_data_error", err, logger.F("query", q))
			// Continue — some tables might not exist
		}
	}

	if err := tx.Commit(ctx); err != nil {
		response.InternalError(c)
		return
	}

	h.log.Info(ctx, "test_data_reset", logger.F("action", "reset"))
	response.OK(c, gin.H{"status": "ok", "message": "Đã xóa dữ liệu test. Giữ lại NPP, sản phẩm, kho, tồn kho."})
}

// POST /v1/test-portal/create-test-order — quick order creation for testing
func (h *Handler) CreateTestOrder(c *gin.Context) {
	var req struct {
		CustomerID  string `json:"customer_id" binding:"required"`
		WarehouseID string `json:"warehouse_id" binding:"required"`
		Items       []struct {
			ProductID string `json:"product_id" binding:"required"`
			Quantity  int    `json:"quantity" binding:"required"`
		} `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request")
		return
	}

	custID, err := uuid.Parse(req.CustomerID)
	if err != nil {
		response.BadRequest(c, "invalid customer_id")
		return
	}
	whID, err := uuid.Parse(req.WarehouseID)
	if err != nil {
		response.BadRequest(c, "invalid warehouse_id")
		return
	}

	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer tx.Rollback(ctx)

	// Get customer credit (matches OMS GetCustomerWithCredit logic)
	var creditLimit, currentBalance float64
	_ = h.db.QueryRow(ctx, `
		SELECT COALESCE(cl.credit_limit, 0),
			COALESCE((SELECT SUM(CASE WHEN rl.ledger_type = 'debit' THEN rl.amount ELSE -rl.amount END)
			          FROM receivable_ledger rl WHERE rl.customer_id = c.id), 0)
		FROM customers c
		LEFT JOIN credit_limits cl ON cl.customer_id = c.id
		     AND cl.effective_from <= CURRENT_DATE
		     AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
		WHERE c.id = $1
	`, custID).Scan(&creditLimit, &currentBalance)

	var orderSeq int64
	if err := h.db.QueryRow(ctx, "SELECT nextval('order_number_seq')").Scan(&orderSeq); err != nil {
		c.JSON(500, gin.H{"error": "generate order number: " + err.Error()})
		return
	}
	orderNumber := fmt.Sprintf("SO-%s-%04d", time.Now().Format("20060102"), orderSeq)
	var totalAmount, depositAmount float64

	type itemInfo struct {
		productID uuid.UUID
		qty       int
		price     float64
		deposit   float64
		amount    float64
	}
	var itemList []itemInfo

	for _, it := range req.Items {
		pID, pErr := uuid.Parse(it.ProductID)
		if pErr != nil {
			continue
		}
		var price, depositPrice float64
		_ = h.db.QueryRow(ctx, `SELECT price, deposit_price FROM products WHERE id = $1`, pID).Scan(&price, &depositPrice)

		amount := price * float64(it.Quantity)
		deposit := depositPrice * float64(it.Quantity)
		totalAmount += amount
		depositAmount += deposit
		itemList = append(itemList, itemInfo{productID: pID, qty: it.Quantity, price: price, deposit: depositPrice, amount: amount})
	}

	// Determine status
	status := "pending_customer_confirm"
	creditStatus := "within_limit"
	availableLimit := creditLimit - currentBalance
	if availableLimit < totalAmount {
		creditStatus = "exceeded"
		status = "pending_approval"
	}

	deliveryDate := time.Now().AddDate(0, 0, 1).Format("2006-01-02")

	orderID := uuid.New()
	_, err = tx.Exec(ctx, `
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
			total_amount, deposit_amount, atp_status, credit_status, cutoff_group, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sufficient', $9, 'before_16h', NOW(), NOW())
	`, orderID, orderNumber, custID, whID, status, deliveryDate, totalAmount, depositAmount, creditStatus)
	if err != nil {
		response.Err(c, http.StatusInternalServerError, "DB_ERROR", err.Error())
		return
	}

	for _, it := range itemList {
		_, _ = tx.Exec(ctx, `
			INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, amount, deposit_amount)
			VALUES ($1, $2, $3, $4, $5, $6, $7)
		`, uuid.New(), orderID, it.productID, it.qty, it.price, it.amount, it.deposit*float64(it.qty))

		// Reserve stock
		_, _ = tx.Exec(ctx, `
			UPDATE stock_quants SET reserved_qty = reserved_qty + $3
			WHERE product_id = $1 AND warehouse_id = $2 AND (quantity - reserved_qty) >= $3
		`, it.productID, whID, it.qty)
	}

	// Create order_confirmation for Zalo tab (only for pending_customer_confirm)
	var confirmToken string
	if status == "pending_customer_confirm" {
		confirmToken = uuid.New().String()[:32]
		var custPhone string
		_ = h.db.QueryRow(ctx, `SELECT COALESCE(phone, '') FROM customers WHERE id = $1`, custID).Scan(&custPhone)
		_, _ = tx.Exec(ctx, `
			INSERT INTO order_confirmations (order_id, customer_id, token, phone, total_amount, status, expires_at)
			VALUES ($1, $2, $3, $4, $5, 'sent', NOW() + INTERVAL '2 hours')
		`, orderID, custID, confirmToken, custPhone, totalAmount)
	}

	if err := tx.Commit(ctx); err != nil {
		response.InternalError(c)
		return
	}

	response.Created(c, gin.H{
		"order_id":      orderID,
		"order_number":  orderNumber,
		"status":        status,
		"total_amount":  totalAmount,
		"credit_status": creditStatus,
		"delivery_date": deliveryDate,
		"confirm_token": confirmToken,
	})
}

// POST /v1/test-portal/simulate-delivery — mark an order as delivered for testing
func (h *Handler) SimulateDelivery(c *gin.Context) {
	var req struct {
		OrderID string `json:"order_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "invalid request")
		return
	}

	orderID, err := uuid.Parse(req.OrderID)
	if err != nil {
		response.BadRequest(c, "invalid order_id")
		return
	}

	ctx := c.Request.Context()
	tx, err := h.db.Begin(ctx)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer tx.Rollback(ctx)

	// Move order to delivered
	result, err := tx.Exec(ctx, `
		UPDATE sales_orders SET status = 'delivered', updated_at = NOW() WHERE id = $1
	`, orderID)
	if err != nil || result.RowsAffected() == 0 {
		response.NotFound(c, "order not found")
		return
	}

	if err := tx.Commit(ctx); err != nil {
		response.InternalError(c)
		return
	}

	response.OK(c, gin.H{"status": "delivered", "order_id": orderID})
}

func getContextValue(ctx context.Context, key string) string {
	if v := ctx.Value(key); v != nil {
		return fmt.Sprintf("%v", v)
	}
	return ""
}

// POST /v1/test-portal/run-scenario — auto-execute a complete test scenario
func (h *Handler) RunScenario(c *gin.Context) {
	var req struct {
		Scenario string `json:"scenario" binding:"required"` // happy_path, credit_exceed, atp_fail, multi_product
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "scenario field required")
		return
	}

	ctx := c.Request.Context()

	// Pick a random customer and warehouse
	type custInfo struct {
		ID          uuid.UUID
		Name        string
		Phone       string
		CreditLimit float64
		Balance     float64
	}

	// Pick products
	type prodInfo struct {
		ID    uuid.UUID
		SKU   string
		Name  string
		Price float64
	}
	var products []prodInfo
	pRows, _ := h.db.Query(ctx, `SELECT id, sku, name, price FROM products WHERE is_active = true ORDER BY random() LIMIT 5`)
	if pRows != nil {
		defer pRows.Close()
		for pRows.Next() {
			var p prodInfo
			if pRows.Scan(&p.ID, &p.SKU, &p.Name, &p.Price) == nil {
				products = append(products, p)
			}
		}
	}
	if len(products) == 0 {
		response.Err(c, http.StatusBadRequest, "NO_PRODUCTS", "Không có sản phẩm trong hệ thống")
		return
	}

	var whID uuid.UUID
	_ = h.db.QueryRow(ctx, `SELECT id FROM warehouses WHERE is_active = true ORDER BY random() LIMIT 1`).Scan(&whID)
	if whID == uuid.Nil {
		response.Err(c, http.StatusBadRequest, "NO_WAREHOUSE", "Không có kho")
		return
	}

	type stepLog struct {
		Step   int    `json:"step"`
		Action string `json:"action"`
		Result string `json:"result"`
		Status string `json:"status"` // ok, warn, error
	}
	var steps []stepLog
	addStep := func(step int, action, result, status string) {
		steps = append(steps, stepLog{Step: step, Action: action, Result: result, Status: status})
	}

	switch req.Scenario {
	case "happy_path":
		// Pick customer with HIGH credit limit so it goes to pending_customer_confirm
		var cust custInfo
		_ = h.db.QueryRow(ctx, `
			SELECT c.id, c.name, COALESCE(c.phone,''), COALESCE(cl.credit_limit, 0),
				COALESCE((SELECT SUM(CASE WHEN rl.ledger_type='debit' THEN rl.amount ELSE -rl.amount END) FROM receivable_ledger rl WHERE rl.customer_id=c.id), 0)
			FROM customers c
			LEFT JOIN credit_limits cl ON cl.customer_id = c.id AND cl.effective_from <= CURRENT_DATE AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
			WHERE c.is_active=true AND COALESCE(cl.credit_limit,0) > 50000000
			ORDER BY random() LIMIT 1
		`).Scan(&cust.ID, &cust.Name, &cust.Phone, &cust.CreditLimit, &cust.Balance)
		if cust.ID == uuid.Nil {
			response.Err(c, http.StatusBadRequest, "NO_CUSTOMER", "Không có NPP đủ hạn mức")
			return
		}
		addStep(1, "Chọn NPP: "+cust.Name, fmt.Sprintf("Hạn mức: %s, Dư nợ: %s", fmtVND(cust.CreditLimit), fmtVND(cust.Balance)), "ok")

		p := products[0]
		qty := 10
		total := p.Price * float64(qty)
		addStep(2, fmt.Sprintf("Chọn SP: %s × %d", p.Name, qty), fmt.Sprintf("Tổng: %s", fmtVND(total)), "ok")

		// Create order
		orderID, orderNumber, confirmToken, err := h.createOrderTx(ctx, cust.ID, whID, []orderItem{{ProductID: p.ID, Qty: qty, Price: p.Price}}, total)
		if err != nil {
			addStep(3, "Tạo đơn hàng", "LỖI: "+err.Error(), "error")
			response.OK(c, gin.H{"scenario": req.Scenario, "steps": steps})
			return
		}
		addStep(3, "Tạo đơn: "+orderNumber, "Status: pending_customer_confirm → Zalo gửi cho NPP", "ok")
		addStep(4, "📱 Zalo gửi tin nhắn cho "+cust.Name, "Link xác nhận đơn hàng (token: "+confirmToken[:8]+"...)", "ok")
		addStep(5, "⏳ Chờ NPP phản hồi", "Bấm tab '📱 Hộp thư Zalo NPP' để xem và phản hồi", "warn")

		response.OK(c, gin.H{
			"scenario":      req.Scenario,
			"scenario_name": "🎯 Happy Path — Tạo đơn thành công",
			"order_id":      orderID,
			"order_number":  orderNumber,
			"confirm_token": confirmToken,
			"customer_name": cust.Name,
			"steps":         steps,
		})

	case "credit_exceed":
		// Pick customer with LOW credit limit
		var cust custInfo
		_ = h.db.QueryRow(ctx, `
			SELECT c.id, c.name, COALESCE(c.phone,''), COALESCE(cl.credit_limit, 0),
				COALESCE((SELECT SUM(CASE WHEN rl.ledger_type='debit' THEN rl.amount ELSE -rl.amount END) FROM receivable_ledger rl WHERE rl.customer_id=c.id), 0)
			FROM customers c
			LEFT JOIN credit_limits cl ON cl.customer_id = c.id AND cl.effective_from <= CURRENT_DATE AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
			WHERE c.is_active=true AND COALESCE(cl.credit_limit,0) BETWEEN 1 AND 30000000
			ORDER BY cl.credit_limit ASC LIMIT 1
		`).Scan(&cust.ID, &cust.Name, &cust.Phone, &cust.CreditLimit, &cust.Balance)
		if cust.ID == uuid.Nil {
			response.Err(c, http.StatusBadRequest, "NO_LOW_CREDIT_CUSTOMER", "Không có NPP hạn mức thấp")
			return
		}
		addStep(1, "Chọn NPP hạn mức thấp: "+cust.Name, fmt.Sprintf("Hạn mức: %s", fmtVND(cust.CreditLimit)), "ok")

		// Create order that exceeds credit
		p := products[0]
		available := cust.CreditLimit - cust.Balance
		qty := int(available/p.Price) + 100 // force exceed
		if qty < 1 {
			qty = 200
		}
		total := p.Price * float64(qty)
		addStep(2, fmt.Sprintf("Đặt %s × %d (tổng %s > hạn mức %s)", p.Name, qty, fmtVND(total), fmtVND(cust.CreditLimit)), "Vượt hạn mức!", "warn")

		orderID, orderNumber, _, err := h.createOrderTx(ctx, cust.ID, whID, []orderItem{{ProductID: p.ID, Qty: qty, Price: p.Price}}, total)
		if err != nil {
			addStep(3, "Tạo đơn hàng", "LỖI: "+err.Error(), "error")
			response.OK(c, gin.H{"scenario": req.Scenario, "steps": steps})
			return
		}
		addStep(3, "Tạo đơn: "+orderNumber, "Status: pending_approval (chờ Kế toán duyệt)", "warn")
		addStep(4, "📢 Thông báo gửi Kế toán", "Đơn vượt hạn mức → KHÔNG gửi Zalo cho NPP", "ok")
		addStep(5, "🔑 Đăng nhập Kế toán (accountant01/demo123) → Duyệt đơn", "Sau duyệt → gửi Zalo cho NPP xác nhận", "warn")

		response.OK(c, gin.H{
			"scenario":      req.Scenario,
			"scenario_name": "💰 Vượt hạn mức tín dụng",
			"order_id":      orderID,
			"order_number":  orderNumber,
			"customer_name": cust.Name,
			"steps":         steps,
		})

	case "atp_fail":
		// Find customer with high credit
		var cust custInfo
		_ = h.db.QueryRow(ctx, `
			SELECT c.id, c.name, COALESCE(c.phone,''), COALESCE(cl.credit_limit, 0), 0
			FROM customers c
			LEFT JOIN credit_limits cl ON cl.customer_id = c.id AND cl.effective_from <= CURRENT_DATE AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
			WHERE c.is_active=true ORDER BY random() LIMIT 1
		`).Scan(&cust.ID, &cust.Name, &cust.Phone, &cust.CreditLimit, &cust.Balance)

		p := products[0]
		qty := 999999 // huge qty to fail ATP
		addStep(1, "Chọn NPP: "+cust.Name, "Hạn mức đủ", "ok")
		addStep(2, fmt.Sprintf("Đặt %s × %d (số lượng lớn hơn tồn kho)", p.Name, qty), "ATP sẽ KHÔNG đủ", "warn")

		// Check actual stock
		var available int
		_ = h.db.QueryRow(ctx, `
			SELECT COALESCE(SUM(quantity - reserved_qty), 0) FROM stock_quants
			WHERE product_id = $1 AND warehouse_id = $2
		`, p.ID, whID).Scan(&available)

		addStep(3, fmt.Sprintf("Tồn kho khả dụng: %d (cần: %d)", available, qty), "Không đủ → đơn bị từ chối", "error")
		addStep(4, "Kết quả", "❌ ATP_INSUFFICIENT — Đơn không được tạo, stock không bị trừ", "error")

		response.OK(c, gin.H{
			"scenario":      req.Scenario,
			"scenario_name": "📦 ATP không đủ tồn kho",
			"steps":         steps,
			"available_qty": available,
		})

	case "multi_product":
		// Pick customer with high credit
		var cust custInfo
		_ = h.db.QueryRow(ctx, `
			SELECT c.id, c.name, COALESCE(c.phone,''), COALESCE(cl.credit_limit, 0),
				COALESCE((SELECT SUM(CASE WHEN rl.ledger_type='debit' THEN rl.amount ELSE -rl.amount END) FROM receivable_ledger rl WHERE rl.customer_id=c.id), 0)
			FROM customers c
			LEFT JOIN credit_limits cl ON cl.customer_id = c.id AND cl.effective_from <= CURRENT_DATE AND (cl.effective_to IS NULL OR cl.effective_to >= CURRENT_DATE)
			WHERE c.is_active=true AND COALESCE(cl.credit_limit,0) > 50000000
			ORDER BY random() LIMIT 1
		`).Scan(&cust.ID, &cust.Name, &cust.Phone, &cust.CreditLimit, &cust.Balance)
		if cust.ID == uuid.Nil {
			response.Err(c, http.StatusBadRequest, "NO_CUSTOMER", "Không có NPP")
			return
		}
		addStep(1, "Chọn NPP: "+cust.Name, fmt.Sprintf("Hạn mức: %s", fmtVND(cust.CreditLimit)), "ok")

		// Pick 3 products
		items := []orderItem{}
		var total float64
		maxP := 3
		if len(products) < maxP {
			maxP = len(products)
		}
		for i := 0; i < maxP; i++ {
			p := products[i]
			qty := (i + 1) * 10
			items = append(items, orderItem{ProductID: p.ID, Qty: qty, Price: p.Price})
			total += p.Price * float64(qty)
			addStep(i+2, fmt.Sprintf("Thêm SP: %s × %d", p.Name, qty), fmtVND(p.Price*float64(qty)), "ok")
		}

		orderID, orderNumber, confirmToken, err := h.createOrderTx(ctx, cust.ID, whID, items, total)
		if err != nil {
			addStep(maxP+2, "Tạo đơn hàng", "LỖI: "+err.Error(), "error")
			response.OK(c, gin.H{"scenario": req.Scenario, "steps": steps})
			return
		}
		addStep(maxP+2, "Tạo đơn: "+orderNumber, fmt.Sprintf("Tổng: %s → pending_customer_confirm", fmtVND(total)), "ok")
		addStep(maxP+3, "📱 Zalo gửi tin nhắn cho "+cust.Name, "Bấm tab '📱 Hộp thư Zalo NPP' để xem", "ok")

		response.OK(c, gin.H{
			"scenario":      req.Scenario,
			"scenario_name": "📋 Đơn nhiều sản phẩm",
			"order_id":      orderID,
			"order_number":  orderNumber,
			"confirm_token": confirmToken,
			"customer_name": cust.Name,
			"steps":         steps,
		})

	default:
		response.BadRequest(c, "Unknown scenario: "+req.Scenario)
	}
}

type orderItem struct {
	ProductID uuid.UUID
	Qty       int
	Price     float64
}

func (h *Handler) createOrderTx(ctx context.Context, custID, whID uuid.UUID, items []orderItem, total float64) (uuid.UUID, string, string, error) {
	tx, err := h.db.Begin(ctx)
	if err != nil {
		return uuid.Nil, "", "", err
	}
	defer tx.Rollback(ctx)

	// Credit check
	var creditLimit, currentBalance float64
	_ = h.db.QueryRow(ctx, `
		SELECT COALESCE(cl.credit_limit, 0),
			COALESCE((SELECT SUM(CASE WHEN rl.ledger_type='debit' THEN rl.amount ELSE -rl.amount END)
			          FROM receivable_ledger rl WHERE rl.customer_id=c.id), 0)
		FROM customers c
		LEFT JOIN credit_limits cl ON cl.customer_id=c.id AND cl.effective_from<=CURRENT_DATE AND (cl.effective_to IS NULL OR cl.effective_to>=CURRENT_DATE)
		WHERE c.id=$1
	`, custID).Scan(&creditLimit, &currentBalance)

	status := "pending_customer_confirm"
	creditStatus := "within_limit"
	if creditLimit-currentBalance < total {
		status = "pending_approval"
		creditStatus = "exceeded"
	}

	var orderSeq int64
	if err := h.db.QueryRow(ctx, "SELECT nextval('order_number_seq')").Scan(&orderSeq); err != nil {
		return uuid.Nil, "", "", fmt.Errorf("generate order number: %w", err)
	}
	orderNumber := fmt.Sprintf("SO-%s-%04d", time.Now().Format("20060102"), orderSeq)
	orderID := uuid.New()
	deliveryDate := time.Now().AddDate(0, 0, 1).Format("2006-01-02")

	_, err = tx.Exec(ctx, `
		INSERT INTO sales_orders (id, order_number, customer_id, warehouse_id, status, delivery_date,
			total_amount, deposit_amount, atp_status, credit_status, cutoff_group, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'sufficient', $8, 'before_16h', NOW(), NOW())
	`, orderID, orderNumber, custID, whID, status, deliveryDate, total, creditStatus)
	if err != nil {
		return uuid.Nil, "", "", err
	}

	for _, it := range items {
		amount := it.Price * float64(it.Qty)
		_, _ = tx.Exec(ctx, `
			INSERT INTO order_items (id, order_id, product_id, quantity, unit_price, amount, deposit_amount)
			VALUES ($1, $2, $3, $4, $5, $6, 0)
		`, uuid.New(), orderID, it.ProductID, it.Qty, it.Price, amount)

		_, _ = tx.Exec(ctx, `
			UPDATE stock_quants SET reserved_qty = reserved_qty + $3
			WHERE product_id = $1 AND warehouse_id = $2 AND (quantity - reserved_qty) >= $3
		`, it.ProductID, whID, it.Qty)
	}

	var confirmToken string
	if status == "pending_customer_confirm" {
		confirmToken = uuid.New().String()[:32]
		var custPhone string
		_ = h.db.QueryRow(ctx, `SELECT COALESCE(phone, '') FROM customers WHERE id=$1`, custID).Scan(&custPhone)
		_, _ = tx.Exec(ctx, `
			INSERT INTO order_confirmations (order_id, customer_id, token, phone, total_amount, status, expires_at)
			VALUES ($1, $2, $3, $4, $5, 'sent', NOW() + INTERVAL '2 hours')
		`, orderID, custID, confirmToken, custPhone, total)
	}

	if err := tx.Commit(ctx); err != nil {
		return uuid.Nil, "", "", err
	}
	return orderID, orderNumber, confirmToken, nil
}

func fmtVND(n float64) string {
	if n >= 1e9 {
		return fmt.Sprintf("%.1f tỷ", n/1e9)
	}
	if n >= 1e6 {
		return fmt.Sprintf("%.1f tr", n/1e6)
	}
	if n >= 1e3 {
		return fmt.Sprintf("%.0fk", n/1e3)
	}
	return fmt.Sprintf("%.0fđ", n)
}

// GET /v1/test-portal/zalo-inbox — returns Zalo messages as NPP would see them
func (h *Handler) ZaloInbox(c *gin.Context) {
	ctx := c.Request.Context()

	type ZaloMessage struct {
		ID            string     `json:"id"`
		Type          string     `json:"type"` // order_confirm | delivery_confirm
		OrderID       string     `json:"order_id"`
		OrderNumber   string     `json:"order_number"`
		CustomerName  string     `json:"customer_name"`
		CustomerPhone string     `json:"customer_phone"`
		Token         string     `json:"token"`
		Status        string     `json:"status"`
		TotalAmount   float64    `json:"total_amount"`
		DeliveryDate  string     `json:"delivery_date"`
		SentAt        time.Time  `json:"sent_at"`
		ExpiresAt     *time.Time `json:"expires_at"`
		ConfirmedAt   *time.Time `json:"confirmed_at"`
		RejectedAt    *time.Time `json:"rejected_at"`
		RejectReason  *string    `json:"reject_reason"`
		AutoConfAt    *time.Time `json:"auto_confirmed_at"`
		DisputedAt    *time.Time `json:"disputed_at"`
		DisputeReason *string    `json:"dispute_reason"`
		MessageText   string     `json:"message_text"`
		Items         []struct {
			ProductName string  `json:"product_name"`
			SKU         string  `json:"sku"`
			Quantity    int     `json:"quantity"`
			UnitPrice   float64 `json:"unit_price"`
			Amount      float64 `json:"amount"`
		} `json:"items"`
	}

	var messages []ZaloMessage

	// 1. Order confirmations (pending_customer_confirm)
	ocRows, _ := h.db.Query(ctx, `
		SELECT oc.id, oc.order_id, so.order_number, c.name, COALESCE(c.phone,''),
			oc.token, oc.status, oc.total_amount, so.delivery_date::text,
			oc.sent_at, oc.expires_at, oc.confirmed_at, oc.rejected_at, oc.reject_reason, oc.auto_confirmed_at
		FROM order_confirmations oc
		JOIN sales_orders so ON so.id = oc.order_id
		JOIN customers c ON c.id = oc.customer_id
		ORDER BY oc.sent_at DESC LIMIT 50
	`)
	if ocRows != nil {
		defer ocRows.Close()
		for ocRows.Next() {
			var m ZaloMessage
			m.Type = "order_confirm"
			if err := ocRows.Scan(&m.ID, &m.OrderID, &m.OrderNumber, &m.CustomerName, &m.CustomerPhone,
				&m.Token, &m.Status, &m.TotalAmount, &m.DeliveryDate,
				&m.SentAt, &m.ExpiresAt, &m.ConfirmedAt, &m.RejectedAt, &m.RejectReason, &m.AutoConfAt); err != nil {
				continue
			}

			// Get order items
			itemRows, _ := h.db.Query(ctx, `
				SELECT p.name, p.sku, oi.quantity, oi.unit_price, oi.amount
				FROM order_items oi JOIN products p ON p.id = oi.product_id
				WHERE oi.order_id = $1
			`, m.OrderID)
			if itemRows != nil {
				for itemRows.Next() {
					var it struct {
						ProductName string  `json:"product_name"`
						SKU         string  `json:"sku"`
						Quantity    int     `json:"quantity"`
						UnitPrice   float64 `json:"unit_price"`
						Amount      float64 `json:"amount"`
					}
					if itemRows.Scan(&it.ProductName, &it.SKU, &it.Quantity, &it.UnitPrice, &it.Amount) == nil {
						m.Items = append(m.Items, it)
					}
				}
				itemRows.Close()
			}

			// Build message text
			itemsText := ""
			for _, it := range m.Items {
				itemsText += fmt.Sprintf("\n     • %s — %d thùng", it.ProductName, it.Quantity)
			}
			m.MessageText = fmt.Sprintf(`BHL — Xác nhận đơn hàng mới

Kính gửi: %s
Đơn hàng #%s
Ngày đặt: %s

Chi tiết đơn hàng:%s

Tổng giá trị: %s
Ngày giao dự kiến: %s

👉 [XÁC NHẬN ĐƠN HÀNG]

Để xem chi tiết hoặc từ chối đơn, vui lòng
bấm vào link trên trong vòng 2 giờ.
Không phản hồi = đồng ý đặt hàng.`, m.CustomerName, m.OrderNumber, m.SentAt.Format("02/01/2006 15:04"),
				itemsText, fmtVND(m.TotalAmount), m.DeliveryDate)

			messages = append(messages, m)
		}
	}

	// 2. Delivery confirmations
	dcRows, _ := h.db.Query(ctx, `
		SELECT zc.id, zc.order_id, so.order_number, c.name, COALESCE(c.phone,''),
			zc.token, zc.status::text, zc.total_amount, so.delivery_date::text,
			zc.sent_at, zc.confirmed_at, zc.disputed_at, zc.dispute_reason, zc.auto_confirmed_at
		FROM zalo_confirmations zc
		JOIN sales_orders so ON so.id = zc.order_id
		JOIN customers c ON c.id = zc.customer_id
		ORDER BY zc.sent_at DESC LIMIT 50
	`)
	if dcRows != nil {
		defer dcRows.Close()
		for dcRows.Next() {
			var m ZaloMessage
			m.Type = "delivery_confirm"
			if err := dcRows.Scan(&m.ID, &m.OrderID, &m.OrderNumber, &m.CustomerName, &m.CustomerPhone,
				&m.Token, &m.Status, &m.TotalAmount, &m.DeliveryDate,
				&m.SentAt, &m.ConfirmedAt, &m.DisputedAt, &m.DisputeReason, &m.AutoConfAt); err != nil {
				continue
			}

			// Get order items
			itemRows, _ := h.db.Query(ctx, `
				SELECT p.name, p.sku, oi.quantity, oi.unit_price, oi.amount
				FROM order_items oi JOIN products p ON p.id = oi.product_id
				WHERE oi.order_id = $1
			`, m.OrderID)
			if itemRows != nil {
				for itemRows.Next() {
					var it struct {
						ProductName string  `json:"product_name"`
						SKU         string  `json:"sku"`
						Quantity    int     `json:"quantity"`
						UnitPrice   float64 `json:"unit_price"`
						Amount      float64 `json:"amount"`
					}
					if itemRows.Scan(&it.ProductName, &it.SKU, &it.Quantity, &it.UnitPrice, &it.Amount) == nil {
						m.Items = append(m.Items, it)
					}
				}
				itemRows.Close()
			}

			itemsText := ""
			for _, it := range m.Items {
				itemsText += fmt.Sprintf("\n     • %s — %d thùng", it.ProductName, it.Quantity)
			}
			m.MessageText = fmt.Sprintf(`BHL — Xác nhận nhận hàng

Kính gửi: %s
Đơn hàng #%s
Ngày giao: %s

Hàng hóa đã giao:%s

Tổng giá trị: %s

👉 [XÁC NHẬN ĐÃ NHẬN HÀNG]

Nếu có sai lệch về chủng loại hoặc số lượng,
vui lòng phản hồi qua link trên trong vòng 24h.
Không phản hồi = xác nhận nhận đúng & đủ.`, m.CustomerName, m.OrderNumber, m.SentAt.Format("02/01/2006 15:04"),
				itemsText, fmtVND(m.TotalAmount))

			messages = append(messages, m)
		}
	}

	if messages == nil {
		messages = []ZaloMessage{}
	}

	response.OK(c, messages)
}

// ═══════════════════════════════════════════════════════════
// GPS SIMULATION — Test Portal
// ═══════════════════════════════════════════════════════════

// GPSScenario defines a pre-built GPS test scenario.
type GPSScenario struct {
	ID           string     `json:"id"`
	Name         string     `json:"name"`
	Description  string     `json:"description"`
	Category     string     `json:"category"` // delivery, anomaly, performance
	VehicleCount int        `json:"vehicle_count"`
	Duration     string     `json:"duration"`
	Routes       []GPSRoute `json:"routes"`
}

type GPSRoute struct {
	Name      string        `json:"name"`
	Waypoints []GPSWaypoint `json:"waypoints"`
	SpeedKmh  float64       `json:"speed_kmh"`
	StopSec   int           `json:"stop_seconds"`
}

type GPSWaypoint struct {
	Lat  float64 `json:"lat"`
	Lng  float64 `json:"lng"`
	Name string  `json:"name"`
}

type GPSSimStatus struct {
	Running       bool               `json:"running"`
	ScenarioID    string             `json:"scenario_id"`
	ScenarioName  string             `json:"scenario_name"`
	VehicleCount  int                `json:"vehicle_count"`
	StartedAt     time.Time          `json:"started_at"`
	TickCount     int                `json:"tick_count"`
	VehicleStates []GPSVehicleStatus `json:"vehicle_states"`
}

type GPSVehicleStatus struct {
	VehicleID   string  `json:"vehicle_id"`
	Plate       string  `json:"plate"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	Speed       float64 `json:"speed"`
	Heading     float64 `json:"heading"`
	Status      string  `json:"status"` // moving, delivering, idle, lost_signal
	WaypointIdx int     `json:"waypoint_idx"`
}

// GET /v1/test-portal/gps/scenarios
func (h *Handler) GPSScenarios(c *gin.Context) {
	ctx := c.Request.Context()
	deliveryRoutes := h.realDeliveryRoutes(ctx)
	rushRoutes := h.realRushHourRoutes(ctx)
	longRoutes := h.realLongRoute(ctx)
	threeRoutes := deliveryRoutes
	if len(threeRoutes) > 3 {
		threeRoutes = threeRoutes[:3]
	}
	twoRoutes := deliveryRoutes
	if len(twoRoutes) > 2 {
		twoRoutes = twoRoutes[:2]
	}
	scenarios := []GPSScenario{
		{
			ID: "normal_delivery", Name: "Giao hàng bình thường", Category: "delivery",
			Description:  "3-5 xe giao hàng theo tuyến cố định, dừng tại mỗi điểm 15-30s, tốc độ 30-50 km/h",
			VehicleCount: 5, Duration: "~10 phút",
			Routes: deliveryRoutes,
		},
		{
			ID: "rush_hour", Name: "Giờ cao điểm (nhiều xe)", Category: "performance",
			Description:  "10 xe chạy đồng thời trên nhiều tuyến, test tải WebSocket + Redis pub/sub",
			VehicleCount: 10, Duration: "~15 phút",
			Routes: rushRoutes,
		},
		{
			ID: "gps_lost_signal", Name: "Mất tín hiệu GPS", Category: "anomaly",
			Description:  "2 xe bình thường + 1 xe mất tín hiệu sau 30s (dừng gửi GPS) → kiểm tra cảnh báo",
			VehicleCount: 3, Duration: "~5 phút",
			Routes: threeRoutes,
		},
		{
			ID: "idle_vehicle", Name: "Xe đứng yên quá lâu", Category: "anomaly",
			Description:  "1 xe giao hàng bình thường + 1 xe đứng yên 1 chỗ > 5 phút → kiểm tra cảnh báo idle",
			VehicleCount: 2, Duration: "~8 phút",
			Routes: twoRoutes,
		},
		{
			ID: "speed_violation", Name: "Vượt tốc độ", Category: "anomaly",
			Description:  "1 xe chạy quá nhanh (>80 km/h) trên tuyến → kiểm tra cảnh báo speed violation",
			VehicleCount: 2, Duration: "~5 phút",
			Routes: twoRoutes,
		},
		{
			ID: "long_route", Name: "Tuyến dài (Quảng Ninh → Hải Phòng)", Category: "delivery",
			Description:  "1 xe chạy tuyến dài ~60km, quân HD → QN → HP, test tracking dài hạn",
			VehicleCount: 1, Duration: "~20 phút",
			Routes: longRoutes,
		},
		{
			ID: "from_active_trips", Name: "Từ trips đang chạy (DB)", Category: "delivery",
			Description:  "Load trips thực tế từ database (planned/in_progress), giả lập GPS cho xe đang có trip",
			VehicleCount: 0, Duration: "Tùy dữ liệu",
			Routes: nil,
		},
	}
	response.OK(c, scenarios)
}

// GET /v1/test-portal/gps/vehicles — list available vehicles
func (h *Handler) GPSVehicles(c *gin.Context) {
	rows, err := h.db.Query(c.Request.Context(), `
		SELECT v.id::text, v.plate_number, COALESCE(v.vehicle_type::text, 'truck'),
			COALESCE(u.full_name, '-') AS driver_name,
			CASE WHEN t.id IS NOT NULL THEN 'has_trip' ELSE 'available' END AS trip_status
		FROM vehicles v
		LEFT JOIN users u ON u.id = v.driver_id
		LEFT JOIN trips t ON t.vehicle_id = v.id AND t.status::text NOT IN ('completed','cancelled','closed')
		WHERE v.status::text = 'active'
		ORDER BY v.plate_number
	`)
	if err != nil {
		response.InternalError(c)
		return
	}
	defer rows.Close()

	type VehicleInfo struct {
		ID         string `json:"id"`
		Plate      string `json:"plate"`
		Type       string `json:"type"`
		DriverName string `json:"driver_name"`
		TripStatus string `json:"trip_status"`
	}
	var vehicles []VehicleInfo
	for rows.Next() {
		var v VehicleInfo
		if rows.Scan(&v.ID, &v.Plate, &v.Type, &v.DriverName, &v.TripStatus) == nil {
			vehicles = append(vehicles, v)
		}
	}
	if vehicles == nil {
		vehicles = []VehicleInfo{}
	}
	response.OK(c, vehicles)
}

// POST /v1/test-portal/gps/start
func (h *Handler) GPSStart(c *gin.Context) {
	var req struct {
		ScenarioID string   `json:"scenario_id"`
		VehicleIDs []string `json:"vehicle_ids"` // optional: use specific vehicles
		IntervalMs int      `json:"interval_ms"` // GPS update interval (default 3000)
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "scenario_id bắt buộc")
		return
	}

	h.gpsMu.Lock()
	defer h.gpsMu.Unlock()

	// Stop existing simulation
	if h.gpsCancel != nil {
		h.gpsCancel()
		h.gpsCancel = nil
	}

	interval := 3 * time.Second
	if req.IntervalMs > 500 && req.IntervalMs <= 10000 {
		interval = time.Duration(req.IntervalMs) * time.Millisecond
	}

	ctx, cancel := context.WithCancel(context.Background())
	h.gpsCancel = cancel

	// Build routes based on scenario
	vehicles, routes, scenarioName := h.buildScenarioData(c.Request.Context(), req.ScenarioID, req.VehicleIDs)
	if len(vehicles) == 0 || len(routes) == 0 {
		cancel()
		h.gpsCancel = nil
		response.BadRequest(c, "Không tìm thấy xe hoặc tuyến đường hợp lệ để giả lập")
		return
	}

	// Initialize status
	h.gpsStatus = &GPSSimStatus{
		Running:      true,
		ScenarioID:   req.ScenarioID,
		ScenarioName: scenarioName,
		VehicleCount: len(vehicles),
		StartedAt:    time.Now(),
	}

	// Start simulation goroutine
	go h.runGPSSimulation(ctx, req.ScenarioID, vehicles, routes, interval)

	response.OK(c, gin.H{
		"message":       fmt.Sprintf("Bắt đầu giả lập GPS: %s (%d xe)", scenarioName, len(vehicles)),
		"scenario":      req.ScenarioID,
		"vehicle_count": len(vehicles),
		"interval_ms":   interval.Milliseconds(),
	})
}

// POST /v1/test-portal/gps/stop
func (h *Handler) GPSStop(c *gin.Context) {
	h.gpsMu.Lock()
	defer h.gpsMu.Unlock()

	if h.gpsCancel != nil {
		h.gpsCancel()
		h.gpsCancel = nil
	}
	if h.gpsStatus != nil {
		h.gpsStatus.Running = false
	}

	// Clear GPS data from Redis
	if h.rdb != nil {
		h.rdb.Del(context.Background(), "gps:latest")
	}

	response.OK(c, gin.H{"message": "Đã dừng giả lập GPS và xóa dữ liệu GPS"})
}

// GET /v1/test-portal/gps/status
func (h *Handler) GPSStatus(c *gin.Context) {
	h.gpsMu.Lock()
	defer h.gpsMu.Unlock()

	if h.gpsStatus == nil {
		response.OK(c, gin.H{"running": false})
		return
	}
	response.OK(c, h.gpsStatus)
}

// --- Internal: build scenario data ---

type simVehicle struct {
	ID    string
	Plate string
}

func (h *Handler) buildScenarioData(ctx context.Context, scenarioID string, vehicleIDs []string) ([]simVehicle, []GPSRoute, string) {
	// Load vehicles
	var vehicles []simVehicle

	if len(vehicleIDs) > 0 {
		// Use specified vehicles
		for _, vid := range vehicleIDs {
			var plate string
			if err := h.db.QueryRow(ctx, `SELECT plate_number FROM vehicles WHERE id = $1`, vid).Scan(&plate); err == nil {
				vehicles = append(vehicles, simVehicle{ID: vid, Plate: plate})
			}
		}
	}

	switch scenarioID {
	case "normal_delivery":
		routes := h.realDeliveryRoutes(ctx)
		if len(vehicles) == 0 {
			vehicles = h.loadDBVehicles(ctx, len(routes))
		}
		return vehicles, routes, "Giao hàng bình thường"

	case "rush_hour":
		routes := h.realRushHourRoutes(ctx)
		if len(vehicles) == 0 {
			vehicles = h.loadDBVehicles(ctx, len(routes))
		}
		return vehicles, routes, "Giờ cao điểm"

	case "gps_lost_signal":
		routes := h.realDeliveryRoutes(ctx)
		if len(routes) > 3 {
			routes = routes[:3]
		}
		if len(vehicles) == 0 {
			vehicles = h.loadDBVehicles(ctx, 3)
		}
		return vehicles, routes, "Mất tín hiệu GPS"

	case "idle_vehicle":
		routes := h.realDeliveryRoutes(ctx)
		if len(routes) > 2 {
			routes = routes[:2]
		}
		if len(vehicles) == 0 {
			vehicles = h.loadDBVehicles(ctx, 2)
		}
		return vehicles, routes, "Xe đứng yên quá lâu"

	case "speed_violation":
		routes := h.realDeliveryRoutes(ctx)
		if len(routes) > 2 {
			routes = routes[:2]
		}
		if len(vehicles) == 0 {
			vehicles = h.loadDBVehicles(ctx, 2)
		}
		return vehicles, routes, "Vượt tốc độ"

	case "long_route":
		routes := h.realLongRoute(ctx)
		if len(vehicles) == 0 {
			vehicles = h.loadDBVehicles(ctx, 1)
		}
		return vehicles, routes, "Tuyến dài QN → HP"

	case "from_active_trips":
		v, r := h.loadTripsFromDB(ctx)
		return v, r, "Từ trips đang chạy (DB)"

	default:
		routes := h.realDeliveryRoutes(ctx)
		if len(vehicles) == 0 {
			vehicles = h.loadDBVehicles(ctx, len(routes))
		}
		return vehicles, routes, scenarioID
	}
}

func (h *Handler) loadDBVehicles(ctx context.Context, limit int) []simVehicle {
	rows, err := h.db.Query(ctx, `
		SELECT id::text, plate_number FROM vehicles
		WHERE status::text = 'active' ORDER BY plate_number LIMIT $1
	`, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var vs []simVehicle
	for rows.Next() {
		var v simVehicle
		if rows.Scan(&v.ID, &v.Plate) == nil {
			vs = append(vs, v)
		}
	}
	return vs
}

func (h *Handler) loadTripsFromDB(ctx context.Context) ([]simVehicle, []GPSRoute) {
	rows, err := h.db.Query(ctx, `
		SELECT t.id::text, t.vehicle_id::text, v.plate_number
		FROM trips t JOIN vehicles v ON v.id = t.vehicle_id
		WHERE t.status::text IN ('planned','assigned','ready','in_transit','pre_check')
		ORDER BY t.created_at DESC LIMIT 10
	`)
	if err != nil {
		return nil, nil
	}
	defer rows.Close()

	var vehicles []simVehicle
	var routes []GPSRoute

	warehouseWaypoints := map[string]GPSWaypoint{}

	for rows.Next() {
		var tripID, vehicleID, plate string
		if rows.Scan(&tripID, &vehicleID, &plate) != nil {
			continue
		}
		vehicles = append(vehicles, simVehicle{ID: vehicleID, Plate: plate})

		var warehouseCode string
		var warehouseLat, warehouseLng float64
		_ = h.db.QueryRow(ctx, `
			SELECT COALESCE(w.code, ''), COALESCE(w.latitude, 0), COALESCE(w.longitude, 0)
			FROM trips t
			JOIN warehouses w ON w.id = t.warehouse_id
			WHERE t.id = $1
		`, tripID).Scan(&warehouseCode, &warehouseLat, &warehouseLng)
		warehousePoint := GPSWaypoint{Lat: warehouseLat, Lng: warehouseLng, Name: "Kho xuất phát"}
		if warehousePoint.Lat == 0 || warehousePoint.Lng == 0 {
			warehousePoint = GPSWaypoint{Lat: 20.9639, Lng: 107.0895, Name: "Kho xuất phát"}
		}
		if warehouseCode != "" {
			warehousePoint.Name = "Kho " + warehouseCode
		}
		warehouseWaypoints[tripID] = warehousePoint

		// Load stops for this trip
		stopRows, err := h.db.Query(ctx, `
			SELECT COALESCE(c.latitude, 0), COALESCE(c.longitude, 0), COALESCE(c.name, 'Stop')
			FROM trip_stops ts
			JOIN shipments sh ON sh.id = ts.shipment_id
			JOIN sales_orders so ON so.id = sh.order_id
			JOIN customers c ON c.id = so.customer_id
			WHERE ts.trip_id = $1
			ORDER BY ts.stop_order ASC
		`, tripID)
		if err != nil {
			continue
		}

		route := GPSRoute{Name: plate + " (trip)", SpeedKmh: 40, StopSec: 20}
		route.Waypoints = append(route.Waypoints, warehouseWaypoints[tripID])
		for stopRows.Next() {
			var wp GPSWaypoint
			if stopRows.Scan(&wp.Lat, &wp.Lng, &wp.Name) == nil && wp.Lat != 0 && wp.Lng != 0 {
				route.Waypoints = append(route.Waypoints, wp)
			}
		}
		stopRows.Close()
		route.Waypoints = append(route.Waypoints, GPSWaypoint{Lat: warehouseWaypoints[tripID].Lat, Lng: warehouseWaypoints[tripID].Lng, Name: "Quay về kho"})

		if len(route.Waypoints) >= 3 {
			route.Waypoints = h.fetchOSRMWaypoints(route.Waypoints)
			routes = append(routes, route)
		}
	}
	return vehicles, routes
}

// --- Internal: GPS simulation goroutine ---

type vehicleSim struct {
	ID          string
	Plate       string
	Lat         float64
	Lng         float64
	Speed       float64
	Heading     float64
	WaypointIdx int
	Progress    float64
	Stopped     bool
	StopUntil   time.Time
	LostSignal  bool // for anomaly scenario
}

func (h *Handler) runGPSSimulation(ctx context.Context, scenarioID string, vehicles []simVehicle, routes []GPSRoute, interval time.Duration) {
	// Initialize vehicle states
	states := make([]*vehicleSim, len(vehicles))
	for i, v := range vehicles {
		routeIdx := i % len(routes)
		wp := routes[routeIdx].Waypoints[0]
		states[i] = &vehicleSim{
			ID:    v.ID,
			Plate: v.Plate,
			Lat:   wp.Lat,
			Lng:   wp.Lng,
		}
	}

	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	tick := 0
	for {
		select {
		case <-ctx.Done():
			h.gpsMu.Lock()
			if h.gpsStatus != nil {
				h.gpsStatus.Running = false
			}
			h.gpsMu.Unlock()
			return
		case <-ticker.C:
			tick++
			now := time.Now().UTC()

			for i, state := range states {
				routeIdx := i % len(routes)
				route := routes[routeIdx]

				// Scenario-specific behavior
				switch scenarioID {
				case "gps_lost_signal":
					// 3rd vehicle loses signal after 10 ticks (30s)
					if i == 2 && tick > 10 {
						state.LostSignal = true
					}
				case "idle_vehicle":
					// 2nd vehicle stays put after reaching first waypoint
					if i == 1 && state.WaypointIdx >= 1 {
						state.Stopped = true
						state.StopUntil = now.Add(time.Hour) // stays forever
						state.Speed = 0
					}
				case "speed_violation":
					// 2nd vehicle goes very fast
					if i == 1 {
						route.SpeedKmh = 90
					}
				}

				if state.LostSignal {
					continue // don't publish
				}

				h.updateVehicleSim(state, route, interval)
				h.publishGPSUpdate(ctx, state, now)
			}

			// Update status
			h.gpsMu.Lock()
			if h.gpsStatus != nil {
				h.gpsStatus.TickCount = tick
				h.gpsStatus.VehicleStates = make([]GPSVehicleStatus, len(states))
				for i, s := range states {
					status := "moving"
					if s.Stopped {
						status = "delivering"
					}
					if s.LostSignal {
						status = "lost_signal"
					}
					if s.Speed == 0 && !s.Stopped && !s.LostSignal {
						status = "idle"
					}
					h.gpsStatus.VehicleStates[i] = GPSVehicleStatus{
						VehicleID:   s.ID,
						Plate:       s.Plate,
						Lat:         s.Lat,
						Lng:         s.Lng,
						Speed:       s.Speed,
						Heading:     s.Heading,
						Status:      status,
						WaypointIdx: s.WaypointIdx,
					}
				}
			}
			h.gpsMu.Unlock()
		}
	}
}

func (h *Handler) updateVehicleSim(state *vehicleSim, route GPSRoute, dt time.Duration) {
	wps := route.Waypoints
	if len(wps) < 2 {
		return
	}

	if state.Stopped {
		if time.Now().Before(state.StopUntil) {
			state.Speed = 0
			return
		}
		state.Stopped = false
		state.WaypointIdx++
		state.Progress = 0
		if state.WaypointIdx >= len(wps)-1 {
			state.WaypointIdx = 0
			state.Progress = 0
		}
	}

	from := wps[state.WaypointIdx]
	to := wps[state.WaypointIdx+1]

	dist := haversineKm(from.Lat, from.Lng, to.Lat, to.Lng)
	if dist < 0.01 {
		state.WaypointIdx++
		state.Progress = 0
		if state.WaypointIdx >= len(wps)-1 {
			state.WaypointIdx = 0
		}
		return
	}

	targetSpeed := route.SpeedKmh + (rand.Float64()-0.5)*10
	if targetSpeed < 5 {
		targetSpeed = 5
	}
	remainingDist := dist * (1 - state.Progress)
	if remainingDist < 0.5 {
		targetSpeed = 10 + rand.Float64()*10
	}

	state.Speed = state.Speed*0.7 + targetSpeed*0.3
	distCovered := state.Speed * dt.Hours()
	state.Progress += distCovered / dist

	jitterLat := (rand.Float64() - 0.5) * 0.0001
	jitterLng := (rand.Float64() - 0.5) * 0.0001

	if state.Progress >= 1.0 {
		state.Lat = to.Lat + jitterLat
		state.Lng = to.Lng + jitterLng
		state.Progress = 1.0
		state.Speed = 0
		stopDur := time.Duration(route.StopSec+rand.Intn(15)) * time.Second
		state.Stopped = true
		state.StopUntil = time.Now().Add(stopDur)
	} else {
		state.Lat = from.Lat + (to.Lat-from.Lat)*state.Progress + jitterLat
		state.Lng = from.Lng + (to.Lng-from.Lng)*state.Progress + jitterLng
	}

	state.Heading = bearing(from.Lat, from.Lng, to.Lat, to.Lng) + (rand.Float64()-0.5)*5
	if state.Heading < 0 {
		state.Heading += 360
	}
	if state.Heading >= 360 {
		state.Heading -= 360
	}
}

func (h *Handler) publishGPSUpdate(ctx context.Context, state *vehicleSim, now time.Time) {
	if h.rdb == nil {
		return
	}
	ts := now.Format(time.RFC3339)

	// Store in Redis hash
	locJSON, _ := json.Marshal(map[string]interface{}{
		"lat": state.Lat, "lng": state.Lng,
		"speed": state.Speed, "heading": state.Heading, "ts": ts,
	})
	h.rdb.HSet(ctx, "gps:latest", state.ID, string(locJSON))
	h.rdb.Expire(ctx, "gps:latest", 24*time.Hour)

	// Publish to channel (WebSocket hub picks this up)
	update, _ := json.Marshal(map[string]interface{}{
		"type": "position", "vehicle_id": state.ID,
		"vehicle_plate": state.Plate,
		"lat":           state.Lat, "lng": state.Lng,
		"speed": state.Speed, "heading": state.Heading, "ts": ts,
	})
	h.rdb.Publish(ctx, "gps:updates", string(update))
}

// --- Predefined routes ---

func normalDeliveryRoutes() []GPSRoute {
	return []GPSRoute{
		{Name: "Tuyến Bãi Cháy", SpeedKmh: 40, StopSec: 20, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {20.9480, 107.085, "NPP Bãi Cháy"},
			{20.9340, 107.105, "NPP Hùng Thắng"}, {20.9200, 107.090, "NPP Hà Khánh"},
			{20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Uông Bí", SpeedKmh: 45, StopSec: 25, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {21.0350, 106.780, "NPP Uông Bí"},
			{21.0520, 106.548, "NPP Đông Triều"}, {21.0100, 106.650, "NPP Mạo Khê"},
			{20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Cẩm Phả", SpeedKmh: 42, StopSec: 20, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {21.0080, 107.320, "NPP Cẩm Phả"},
			{21.0450, 107.350, "NPP Cửa Ông"}, {21.0200, 107.280, "NPP Quang Hanh"},
			{20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Giếng Đáy", SpeedKmh: 35, StopSec: 15, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {20.9650, 107.060, "NPP Giếng Đáy"},
			{20.9700, 107.045, "NPP Hà Tu"}, {20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Quảng Yên", SpeedKmh: 40, StopSec: 25, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {20.8500, 106.700, "NPP Quảng Yên"},
			{20.8700, 106.750, "NPP Đầm Hà"}, {20.9100, 106.850, "NPP Tiên Yên"},
			{20.9565, 107.072, "Quay về kho"},
		}},
	}
}

func rushHourRoutes() []GPSRoute {
	base := normalDeliveryRoutes()
	extra := []GPSRoute{
		{Name: "Tuyến Hồng Gai", SpeedKmh: 38, StopSec: 20, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {20.960, 107.080, "NPP Hồng Gai 1"},
			{20.965, 107.095, "NPP Hồng Gai 2"}, {20.955, 107.065, "NPP Cao Xanh"},
			{20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Hạ Long 2", SpeedKmh: 40, StopSec: 18, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {20.945, 107.100, "NPP Bãi Cháy 2"},
			{20.940, 107.115, "NPP Tuần Châu"}, {20.950, 107.080, "NPP Giếng Đáy 2"},
			{20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Yên Hưng", SpeedKmh: 45, StopSec: 22, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {20.920, 106.820, "NPP Yên Hưng 1"},
			{20.880, 106.780, "NPP Yên Hưng 2"}, {20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Vân Đồn", SpeedKmh: 50, StopSec: 30, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {21.050, 107.400, "NPP Vân Đồn"},
			{21.080, 107.450, "NPP Quan Lạn"}, {20.9565, 107.072, "Quay về kho"},
		}},
		{Name: "Tuyến Đông Triều 2", SpeedKmh: 42, StopSec: 20, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL"}, {21.080, 106.580, "NPP Đông Triều 2"},
			{21.060, 106.620, "NPP Tràng An"}, {20.9565, 107.072, "Quay về kho"},
		}},
	}
	return append(base, extra...)
}

func longRouteRoutes() []GPSRoute {
	return []GPSRoute{
		{Name: "QN → HP dài", SpeedKmh: 50, StopSec: 30, Waypoints: []GPSWaypoint{
			{20.9565, 107.072, "Kho BHL (Hạ Long)"},
			{20.935, 107.090, "NPP Bãi Cháy"},
			{20.920, 107.050, "NPP Đại Yên"},
			{21.035, 106.780, "NPP Uông Bí"},
			{20.930, 106.660, "NPP Quảng Yên"},
			{20.870, 106.700, "NPP Thủy Nguyên"},
			{20.850, 106.685, "NPP An Dương"},
			{20.828, 106.685, "NPP Hải Phòng Center"},
			{20.810, 106.720, "NPP Lê Chân"},
			{20.9565, 107.072, "Quay về kho"},
		}},
	}
}

// --- Geo math ---

func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func bearing(lat1, lng1, lat2, lng2 float64) float64 {
	dLng := (lng2 - lng1) * math.Pi / 180
	lat1R := lat1 * math.Pi / 180
	lat2R := lat2 * math.Pi / 180
	y := math.Sin(dLng) * math.Cos(lat2R)
	x := math.Cos(lat1R)*math.Sin(lat2R) - math.Sin(lat1R)*math.Cos(lat2R)*math.Cos(dLng)
	brng := math.Atan2(y, x) * 180 / math.Pi
	if brng < 0 {
		brng += 360
	}
	return brng
}
