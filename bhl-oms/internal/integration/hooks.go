package integration

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Hooks provides fire-and-forget integration calls triggered by business events.
// All methods log errors but never block the caller — integration failures are
// NOT propagated back to the user (error-codes instruction: return 202).
type Hooks struct {
	bravo      *BravoAdapter
	dms        *DMSAdapter
	confirmSvc *ConfirmService
	dlq        *DLQService
	db         *pgxpool.Pool
	baseURL    string
}

func NewHooks(bravo *BravoAdapter, dms *DMSAdapter, confirmSvc *ConfirmService, db *pgxpool.Pool, baseURL string) *Hooks {
	return &Hooks{
		bravo:      bravo,
		dms:        dms,
		confirmSvc: confirmSvc,
		dlq:        NewDLQService(db),
		db:         db,
		baseURL:    baseURL,
	}
}

// DeliveryEvent carries the data needed by integrations when a stop is delivered.
type DeliveryEvent struct {
	OrderID       uuid.UUID
	CustomerID    uuid.UUID
	StopID        uuid.UUID
	ShipmentID    uuid.UUID
	OrderNumber   string
	CustomerCode  string
	CustomerName  string
	CustomerPhone string
	DeliveryDate  string
	TotalAmount   float64
	DepositAmount float64
	PaymentMethod string
	DriverName    string
	VehiclePlate  string
	Items         []DeliveryDocItem
}

// OnDeliveryCompleted fires after ePOD with status "delivered".
// It pushes the delivery document to Bravo (Task 3.1) and sends a Zalo
// confirmation to the customer (Tasks 3.5/3.6) — both asynchronously.
func (h *Hooks) OnDeliveryCompleted(ctx context.Context, evt DeliveryEvent) {
	// Push delivery document to Bravo (Task 3.1)
	go func() {
		doc := DeliveryDocument{
			OrderNumber:   evt.OrderNumber,
			CustomerCode:  evt.CustomerCode,
			DeliveryDate:  evt.DeliveryDate,
			TotalAmount:   evt.TotalAmount,
			DepositAmount: evt.DepositAmount,
			PaymentMethod: evt.PaymentMethod,
			DriverName:    evt.DriverName,
			VehiclePlate:  evt.VehiclePlate,
			Items:         evt.Items,
		}
		result, err := h.bravo.PushDeliveryDocument(context.Background(), doc)
		if err != nil {
			log.Printf("[Integration] Bravo push-document failed for %s: %v", evt.OrderNumber, err)
			refType := "order"
			h.dlq.Record(context.Background(), "bravo", "push_document", doc, err.Error(), &refType, &evt.OrderID)
		} else {
			log.Printf("[Integration] Bravo push-document OK for %s → %s", evt.OrderNumber, result.DocumentID)
		}
	}()

	// Send Zalo confirmation (Tasks 3.5/3.6)
	go func() {
		if evt.CustomerPhone == "" {
			log.Printf("[Integration] Zalo confirm skipped for %s — no customer phone", evt.OrderNumber)
			return
		}
		stopID := evt.StopID
		confirm, err := h.confirmSvc.SendConfirmation(
			context.Background(),
			evt.OrderID, evt.CustomerID, &stopID,
			evt.CustomerPhone, evt.TotalAmount,
			evt.OrderNumber, evt.CustomerName, h.baseURL,
		)
		if err != nil {
			log.Printf("[Integration] Zalo confirm send failed for %s: %v", evt.OrderNumber, err)
			refType := "order"
			h.dlq.Record(context.Background(), "zalo", "send_confirmation", evt, err.Error(), &refType, &evt.OrderID)
		} else {
			log.Printf("[Integration] Zalo confirm sent for %s → token=%s", evt.OrderNumber, confirm.Token)
		}
	}()
}

// OrderStatusEvent carries data for DMS sync when order status changes.
type OrderStatusEvent struct {
	OrderNumber  string
	Status       string
	DeliveryDate string
	DriverName   string
	VehiclePlate string
	TotalAmount  float64
	Notes        string
}

// OnOrderStatusChanged pushes order status to DMS (Task 3.4) asynchronously.
func (h *Hooks) OnOrderStatusChanged(ctx context.Context, evt OrderStatusEvent) {
	go func() {
		sync := DMSOrderSync{
			OrderNumber:  evt.OrderNumber,
			Status:       evt.Status,
			DeliveryDate: evt.DeliveryDate,
			DriverName:   evt.DriverName,
			VehiclePlate: evt.VehiclePlate,
			TotalAmount:  evt.TotalAmount,
			Notes:        evt.Notes,
		}
		result, err := h.dms.PushOrderStatus(context.Background(), sync)
		if err != nil {
			log.Printf("[Integration] DMS sync failed for %s: %v", evt.OrderNumber, err)
			refType := "order"
			h.dlq.Record(context.Background(), "dms", "sync_order", sync, err.Error(), &refType, nil)
		} else {
			log.Printf("[Integration] DMS sync OK for %s → %s", evt.OrderNumber, result.DMSOrderID)
		}
	}()
}

// BuildDeliveryEvent queries the DB to build a DeliveryEvent from a stop.
// This is a convenience helper so callers don't need to assemble all fields.
func (h *Hooks) BuildDeliveryEvent(ctx context.Context, stopID, shipmentID uuid.UUID, driverName, vehiclePlate, paymentMethod string) (*DeliveryEvent, error) {
	var evt DeliveryEvent
	evt.StopID = stopID
	evt.ShipmentID = shipmentID
	evt.DriverName = driverName
	evt.VehiclePlate = vehiclePlate
	evt.PaymentMethod = paymentMethod

	err := h.db.QueryRow(ctx, `
		SELECT so.id, so.order_number, so.total_amount, so.deposit_amount, so.delivery_date,
			c.id, c.code, c.name, COALESCE(c.phone, '')
		FROM shipments sh
		JOIN sales_orders so ON so.id = sh.order_id
		JOIN customers c ON c.id = so.customer_id
		WHERE sh.id = $1
	`, shipmentID).Scan(
		&evt.OrderID, &evt.OrderNumber, &evt.TotalAmount, &evt.DepositAmount, &evt.DeliveryDate,
		&evt.CustomerID, &evt.CustomerCode, &evt.CustomerName, &evt.CustomerPhone,
	)
	if err != nil {
		return nil, fmt.Errorf("build delivery event: %w", err)
	}

	// Fetch order items for Bravo document
	rows, err := h.db.Query(ctx, `
		SELECT p.sku, p.name, oi.quantity, oi.unit_price, oi.amount
		FROM order_items oi
		JOIN products p ON p.id = oi.product_id
		WHERE oi.order_id = $1
	`, evt.OrderID)
	if err != nil {
		return nil, fmt.Errorf("fetch order items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var item DeliveryDocItem
		if err := rows.Scan(&item.ProductSKU, &item.ProductName, &item.Quantity, &item.UnitPrice, &item.Amount); err != nil {
			continue
		}
		evt.Items = append(evt.Items, item)
	}

	return &evt, nil
}

// RunNightlyReconcileCron starts the Bravo credit reconciliation cron (Task 3.2).
// Runs once daily at approximately midnight (checks every hour, executes at 0h).
func (h *Hooks) RunNightlyReconcileCron(ctx context.Context) {
	log.Println("[Bravo] Nightly reconcile cron started (every hour, executes at midnight)")

	ticker := make(chan struct{})
	go func() {
		// Use a 1-hour ticker, but only execute reconcile around midnight (0:00–0:59)
		t := newHourlyTicker()
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-t.C:
				ticker <- struct{}{}
			}
		}
	}()

	for {
		select {
		case <-ctx.Done():
			log.Println("[Bravo] Nightly reconcile cron stopped")
			return
		case <-ticker:
			h.runReconcileIfMidnight(ctx)
		}
	}
}

func (h *Hooks) runReconcileIfMidnight(ctx context.Context) {
	// Only run between 00:00-00:59 Vietnam time
	loc, _ := loadVNTimezone()
	hour := nowIn(loc).Hour()
	if hour != 0 {
		return
	}

	// Fetch all active customer codes
	rows, err := h.db.Query(ctx, `SELECT code FROM customers WHERE is_active = true`)
	if err != nil {
		log.Printf("[Bravo] reconcile: fetch customers failed: %v", err)
		return
	}
	defer rows.Close()

	var codes []string
	for rows.Next() {
		var code string
		if err := rows.Scan(&code); err == nil {
			codes = append(codes, code)
		}
	}

	if len(codes) == 0 {
		return
	}

	discrepancies, err := h.bravo.NightlyReconcile(ctx, codes)
	if err != nil {
		log.Printf("[Bravo] Nightly reconcile error: %v", err)
		return
	}
	log.Printf("[Bravo] Nightly reconcile completed: %d customers, %d discrepancies", len(codes), len(discrepancies))
}

// --- time helpers ---

func loadVNTimezone() (*time.Location, error) {
	return time.LoadLocation("Asia/Ho_Chi_Minh")
}

func nowIn(loc *time.Location) time.Time {
	if loc == nil {
		return time.Now()
	}
	return time.Now().In(loc)
}

type hourlyTicker struct {
	C    chan time.Time
	done chan struct{}
}

func newHourlyTicker() *hourlyTicker {
	t := &hourlyTicker{
		C:    make(chan time.Time, 1),
		done: make(chan struct{}),
	}
	go func() {
		ticker := time.NewTicker(1 * time.Hour)
		defer ticker.Stop()
		for {
			select {
			case ts := <-ticker.C:
				t.C <- ts
			case <-t.done:
				return
			}
		}
	}()
	return t
}

func (t *hourlyTicker) Stop() {
	close(t.done)
}
