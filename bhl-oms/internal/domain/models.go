package domain

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// ===== USER =====
type User struct {
	ID           uuid.UUID   `json:"id"`
	Username     string      `json:"username"`
	Email        *string     `json:"email,omitempty"`
	PasswordHash string      `json:"-"`
	FullName     string      `json:"full_name"`
	Role         string      `json:"role"`
	Permissions  []string    `json:"permissions"`
	WarehouseIDs []uuid.UUID `json:"warehouse_ids"`
	IsActive     bool        `json:"is_active"`
	LastLoginAt  *time.Time  `json:"last_login_at,omitempty"`
	CreatedAt    time.Time   `json:"created_at"`
}

// ===== PRODUCT =====
type Product struct {
	ID                 uuid.UUID `json:"id"`
	SKU                string    `json:"sku"`
	Name               string    `json:"name"`
	Unit               string    `json:"unit"`
	WeightKg           float64   `json:"weight_kg"`
	VolumeM3           float64   `json:"volume_m3"`
	Price              float64   `json:"price"`
	DepositPrice       float64   `json:"deposit_price"`
	Category           *string   `json:"category,omitempty"`
	ShelfLifeDays      *int      `json:"shelf_life_days,omitempty"`
	ExpiryThresholdPct float64   `json:"expiry_threshold_pct"`
	BarcodePrefix      *string   `json:"barcode_prefix,omitempty"`
	IsActive           bool      `json:"is_active"`
}

// ===== CUSTOMER =====
type Customer struct {
	ID        uuid.UUID `json:"id"`
	Code      string    `json:"code"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Phone     *string   `json:"phone,omitempty"`
	Latitude  *float64  `json:"latitude,omitempty"`
	Longitude *float64  `json:"longitude,omitempty"`
	Province  *string   `json:"province,omitempty"`
	District  *string   `json:"district,omitempty"`
	RouteCode *string   `json:"route_code,omitempty"`
	IsActive  bool      `json:"is_active"`
}

type CustomerWithCredit struct {
	Customer
	CreditLimit    float64 `json:"credit_limit"`
	CurrentBalance float64 `json:"current_balance"`
	AvailableLimit float64 `json:"available_limit"`
}

// ===== ATP =====
type ATPResult struct {
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name"`
	WarehouseID uuid.UUID `json:"warehouse_id"`
	Available   int       `json:"available"`
	Committed   int       `json:"committed"`
	Reserved    int       `json:"reserved"`
	ATP         int       `json:"atp"`
}

// ===== ORDER =====
type SalesOrder struct {
	ID              uuid.UUID   `json:"id"`
	OrderNumber     string      `json:"order_number"`
	CustomerID      uuid.UUID   `json:"customer_id"`
	CustomerName    string      `json:"customer_name,omitempty"`
	CustomerCode    string      `json:"customer_code,omitempty"`
	WarehouseID     uuid.UUID   `json:"warehouse_id"`
	WarehouseName   string      `json:"warehouse_name,omitempty"`
	Status          string      `json:"status"`
	CutoffGroup     string      `json:"cutoff_group"`
	DeliveryDate    string      `json:"delivery_date"`
	DeliveryAddress interface{} `json:"delivery_address,omitempty"`
	TimeWindow      *string     `json:"time_window,omitempty"`
	TotalAmount     float64     `json:"total_amount"`
	DepositAmount   float64     `json:"deposit_amount"`
	GrandTotal      float64     `json:"grand_total"`
	TotalWeightKg   float64     `json:"total_weight_kg"`
	TotalVolumeM3   float64     `json:"total_volume_m3"`
	ATPStatus       string      `json:"atp_status"`
	CreditStatus    string      `json:"credit_status"`
	Notes           *string     `json:"notes,omitempty"`
	CreatedBy       *uuid.UUID  `json:"created_by,omitempty"`
	RejectReason    *string     `json:"reject_reason,omitempty"`
	Items           []OrderItem `json:"items,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
	// Enrichment fields (populated by ListOrders when available)
	ZaloStatus    *string    `json:"zalo_status,omitempty"`
	TripID        *uuid.UUID `json:"trip_id,omitempty"`
	VehiclePlate  string     `json:"vehicle_plate,omitempty"`
	DriverName    string     `json:"driver_name,omitempty"`
	CustomerPhone string     `json:"customer_phone,omitempty"`
}

type OrderItem struct {
	ID            uuid.UUID `json:"id"`
	OrderID       uuid.UUID `json:"order_id"`
	ProductID     uuid.UUID `json:"product_id"`
	ProductName   string    `json:"product_name,omitempty"`
	ProductSKU    string    `json:"product_sku,omitempty"`
	Quantity      int       `json:"quantity"`
	UnitPrice     float64   `json:"unit_price"`
	Amount        float64   `json:"amount"`
	DepositAmount float64   `json:"deposit_amount"`
}

// ===== CONTROL DESK =====
type ControlDeskStats struct {
	Draft                  int `json:"draft"`
	PendingCustomerConfirm int `json:"pending_customer_confirm"`
	PendingApproval        int `json:"pending_approval"`
	Confirmed              int `json:"confirmed"`
	ShipmentCreated        int `json:"shipment_created"`
	InTransit              int `json:"in_transit"`
	Delivering             int `json:"delivering"`
	Delivered              int `json:"delivered"`
	PartiallyDelivered     int `json:"partially_delivered"`
	Failed                 int `json:"failed"`
	Cancelled              int `json:"cancelled"`
	Rejected               int `json:"rejected"`
	OnCredit               int `json:"on_credit"`
	Total                  int `json:"total"`
}

// ===== DISPATCHER CONTROL TOWER =====

type TripException struct {
	ID           uuid.UUID  `json:"id"`
	TripID       uuid.UUID  `json:"trip_id"`
	TripNumber   string     `json:"trip_number"`
	Type         string     `json:"type"`     // late_eta, idle_vehicle, failed_stop, no_checkin, overloaded
	Priority     string     `json:"priority"` // P0, P1
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	VehiclePlate string     `json:"vehicle_plate,omitempty"`
	DriverName   string     `json:"driver_name,omitempty"`
	StopID       *uuid.UUID `json:"stop_id,omitempty"`
	CustomerName string     `json:"customer_name,omitempty"`
	CreatedAt    string     `json:"created_at"`
}

type ControlTowerStats struct {
	TotalTripsToday int     `json:"total_trips_today"`
	InTransit       int     `json:"in_transit"`
	Completed       int     `json:"completed"`
	Planned         int     `json:"planned"`
	TotalStopsToday int     `json:"total_stops_today"`
	StopsDelivered  int     `json:"stops_delivered"`
	StopsFailed     int     `json:"stops_failed"`
	StopsPending    int     `json:"stops_pending"`
	ActiveVehicles  int     `json:"active_vehicles"`
	IdleVehicles    int     `json:"idle_vehicles"`
	ExceptionCount  int     `json:"exception_count"`
	OnTimeRate      float64 `json:"on_time_rate"`
	TotalWeightKg   float64 `json:"total_weight_kg"`
	TotalDistanceKm float64 `json:"total_distance_km"`
}

// ===== SHIPMENT =====
type Shipment struct {
	ID               uuid.UUID  `json:"id"`
	ShipmentNumber   string     `json:"shipment_number"`
	OrderID          uuid.UUID  `json:"order_id"`
	CustomerID       uuid.UUID  `json:"customer_id"`
	CustomerName     string     `json:"customer_name,omitempty"`
	CustomerAddress  string     `json:"customer_address,omitempty"`
	WarehouseID      uuid.UUID  `json:"warehouse_id"`
	Status           string     `json:"status"`
	DeliveryDate     string     `json:"delivery_date"`
	TotalWeightKg    float64    `json:"total_weight_kg"`
	TotalVolumeM3    float64    `json:"total_volume_m3"`
	Latitude         *float64   `json:"latitude,omitempty"`
	Longitude        *float64   `json:"longitude,omitempty"`
	IsUrgent         bool       `json:"is_urgent"`
	CreatedAt        *time.Time `json:"created_at,omitempty"`
	OrderCreatedAt   *time.Time `json:"order_created_at,omitempty"`
	OrderConfirmedAt *time.Time `json:"order_confirmed_at,omitempty"`
}

// ===== VEHICLE / DRIVER =====
type Vehicle struct {
	ID          uuid.UUID `json:"id"`
	PlateNumber string    `json:"plate_number"`
	VehicleType string    `json:"vehicle_type"`
	CapacityKg  float64   `json:"capacity_kg"`
	CapacityM3  *float64  `json:"capacity_m3,omitempty"`
	Status      string    `json:"status"`
	WarehouseID uuid.UUID `json:"warehouse_id"`
}

type Driver struct {
	ID            uuid.UUID `json:"id"`
	FullName      string    `json:"full_name"`
	Phone         string    `json:"phone"`
	LicenseNumber *string   `json:"license_number,omitempty"`
	Status        string    `json:"status"`
	WarehouseID   uuid.UUID `json:"warehouse_id"`
}

// ===== TRIP =====
type Trip struct {
	ID               uuid.UUID      `json:"id"`
	TripNumber       string         `json:"trip_number"`
	WarehouseID      uuid.UUID      `json:"warehouse_id"`
	VehicleID        *uuid.UUID     `json:"vehicle_id,omitempty"`
	DriverID         *uuid.UUID     `json:"driver_id,omitempty"`
	VehiclePlate     string         `json:"vehicle_plate,omitempty"`
	DriverName       string         `json:"driver_name,omitempty"`
	DriverPhone      string         `json:"driver_phone,omitempty"`
	WarehouseName    string         `json:"warehouse_name,omitempty"`
	WarehouseLat     *float64       `json:"warehouse_lat,omitempty"`
	WarehouseLng     *float64       `json:"warehouse_lng,omitempty"`
	Status           string         `json:"status"`
	PlannedDate      string         `json:"planned_date"`
	TotalStops       int            `json:"total_stops"`
	TotalWeightKg    float64        `json:"total_weight_kg"`
	TotalDistanceKm  float64        `json:"total_distance_km"`
	TotalDurationMin int            `json:"total_duration_min"`
	StartedAt        *time.Time     `json:"started_at,omitempty"`
	CompletedAt      *time.Time     `json:"completed_at,omitempty"`
	Checklist        *TripChecklist `json:"checklist,omitempty"`
	Stops            []TripStop     `json:"stops,omitempty"`
	CreatedAt        time.Time      `json:"created_at"`
}

type TripStop struct {
	ID                 uuid.UUID   `json:"id"`
	TripID             uuid.UUID   `json:"trip_id"`
	ShipmentID         *uuid.UUID  `json:"shipment_id,omitempty"`
	CustomerID         uuid.UUID   `json:"customer_id"`
	CustomerName       string      `json:"customer_name,omitempty"`
	CustomerAddress    string      `json:"customer_address,omitempty"`
	CustomerPhone      string      `json:"customer_phone,omitempty"`
	Latitude           *float64    `json:"latitude,omitempty"`
	Longitude          *float64    `json:"longitude,omitempty"`
	StopOrder          int         `json:"stop_order"`
	Status             string      `json:"status"`
	EstimatedArrival   *time.Time  `json:"estimated_arrival,omitempty"`
	EstimatedDeparture *time.Time  `json:"estimated_departure,omitempty"`
	ActualArrival      *time.Time  `json:"actual_arrival,omitempty"`
	ActualDeparture    *time.Time  `json:"actual_departure,omitempty"`
	DistanceFromPrevKm float64     `json:"distance_from_prev_km"`
	CumulativeLoadKg   float64     `json:"cumulative_load_kg"`
	Notes              *string     `json:"notes,omitempty"`
	OrderNumber        string      `json:"order_number,omitempty"`
	OrderAmount        float64     `json:"order_amount,omitempty"`
	OrderItems         []OrderItem `json:"order_items,omitempty"`
}

// ===== TRIP CHECKLIST =====
type TripChecklist struct {
	ID                 uuid.UUID `json:"id"`
	TripID             uuid.UUID `json:"trip_id"`
	DriverID           uuid.UUID `json:"driver_id"`
	VehicleID          uuid.UUID `json:"vehicle_id"`
	TiresOk            bool      `json:"tires_ok"`
	BrakesOk           bool      `json:"brakes_ok"`
	LightsOk           bool      `json:"lights_ok"`
	MirrorsOk          bool      `json:"mirrors_ok"`
	HornOk             bool      `json:"horn_ok"`
	CoolantOk          bool      `json:"coolant_ok"`
	OilOk              bool      `json:"oil_ok"`
	FuelLevel          int       `json:"fuel_level"`
	FireExtinguisherOk bool      `json:"fire_extinguisher_ok"`
	FirstAidOk         bool      `json:"first_aid_ok"`
	DocumentsOk        bool      `json:"documents_ok"`
	CargoSecured       bool      `json:"cargo_secured"`
	IsPassed           bool      `json:"is_passed"`
	Notes              *string   `json:"notes,omitempty"`
	CheckedAt          time.Time `json:"checked_at"`
}

// ===== VRP =====
type VRPJob struct {
	JobID  string `json:"job_id"`
	Status string `json:"status"`
}

type VRPResult struct {
	JobID      string      `json:"job_id"`
	Status     string      `json:"status"`
	SolveTime  int         `json:"solve_time_ms"`
	Trips      []VRPTrip   `json:"trips"`
	Unassigned []uuid.UUID `json:"unassigned_shipments"`
	Summary    VRPSummary  `json:"summary"`
}

type VRPTrip struct {
	VehicleID        uuid.UUID  `json:"vehicle_id"`
	PlateNumber      string     `json:"plate_number,omitempty"`
	VehicleType      string     `json:"vehicle_type,omitempty"`
	DriverID         *uuid.UUID `json:"driver_id"`
	Stops            []VRPStop  `json:"stops"`
	TotalDistanceKm  float64    `json:"total_distance_km"`
	TotalDurationMin int        `json:"total_duration_min"`
	TotalWeightKg    float64    `json:"total_weight_kg"`
}

type VRPStop struct {
	ShipmentID         uuid.UUID   `json:"shipment_id"`
	CustomerID         uuid.UUID   `json:"customer_id"`
	CustomerName       string      `json:"customer_name"`
	CustomerAddress    string      `json:"customer_address"`
	Latitude           float64     `json:"latitude"`
	Longitude          float64     `json:"longitude"`
	StopOrder          int         `json:"stop_order"`
	EstimatedArrival   string      `json:"estimated_arrival"`
	EstimatedDeparture string      `json:"estimated_departure"`
	CumulativeLoadKg   float64     `json:"cumulative_load_kg"`
	WeightKg           float64     `json:"weight_kg"`
	// Consolidation: multiple shipments merged into one stop (same customer+address)
	ConsolidatedIDs    []uuid.UUID `json:"consolidated_ids,omitempty"`
	// Split delivery: partial weight of a shipment assigned to this stop
	IsSplit            bool        `json:"is_split,omitempty"`
	SplitPart          int         `json:"split_part,omitempty"`     // 1, 2, 3...
	SplitTotal         int         `json:"split_total,omitempty"`    // total parts
	OriginalWeightKg   float64     `json:"original_weight_kg,omitempty"` // full shipment weight
}

type VRPSummary struct {
	TotalTrips             int     `json:"total_trips"`
	TotalVehicles          int     `json:"total_vehicles"`
	TotalShipmentsAssigned int     `json:"total_shipments_assigned"`
	TotalUnassigned        int     `json:"total_unassigned"`
	TotalDistanceKm        float64 `json:"total_distance_km"`
	TotalDurationMin       int     `json:"total_duration_min"`
	TotalWeightKg          float64 `json:"total_weight_kg"`
	AvgCapacityUtil        float64 `json:"avg_capacity_util_pct"`
	AvgStopsPerTrip        float64 `json:"avg_stops_per_trip"`
	SolveTimeMs            int     `json:"solve_time_ms"`
	ConsolidatedStops      int     `json:"consolidated_stops"`
	SplitDeliveries        int     `json:"split_deliveries"`
}

// ===== WMS: STOCK MOVE =====
type StockMove struct {
	ID            uuid.UUID       `json:"id"`
	MoveNumber    string          `json:"move_number"`
	MoveType      string          `json:"move_type"`
	WarehouseID   uuid.UUID       `json:"warehouse_id"`
	ReferenceType *string         `json:"reference_type,omitempty"`
	ReferenceID   *uuid.UUID      `json:"reference_id,omitempty"`
	Items         json.RawMessage `json:"items"`
	TotalItems    int             `json:"total_items"`
	Notes         *string         `json:"notes,omitempty"`
	CreatedBy     uuid.UUID       `json:"created_by"`
	CreatedAt     time.Time       `json:"created_at"`
}

type StockMoveItem struct {
	ProductID  uuid.UUID `json:"product_id"`
	LotID      uuid.UUID `json:"lot_id"`
	LocationID uuid.UUID `json:"location_id"`
	Quantity   int       `json:"qty"`
}

// ===== WMS: PICKING ORDER =====
type PickingOrder struct {
	ID          uuid.UUID       `json:"id"`
	PickNumber  string          `json:"pick_number"`
	ShipmentID  uuid.UUID       `json:"shipment_id"`
	WarehouseID uuid.UUID       `json:"warehouse_id"`
	Status      string          `json:"status"`
	Items       json.RawMessage `json:"items"`
	AssignedTo  *uuid.UUID      `json:"assigned_to,omitempty"`
	StartedAt   *time.Time      `json:"started_at,omitempty"`
	CompletedAt *time.Time      `json:"completed_at,omitempty"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type PickingItem struct {
	ProductID  uuid.UUID `json:"product_id"`
	LotID      uuid.UUID `json:"lot_id"`
	LocationID uuid.UUID `json:"location_id"`
	Quantity   int       `json:"qty"`
	PickedQty  int       `json:"picked_qty"`
}

// ===== WMS: GATE CHECK =====
type GateCheck struct {
	ID                 uuid.UUID       `json:"id"`
	TripID             uuid.UUID       `json:"trip_id"`
	ShipmentID         uuid.UUID       `json:"shipment_id"`
	ExpectedItems      json.RawMessage `json:"expected_items"`
	ScannedItems       json.RawMessage `json:"scanned_items"`
	Result             string          `json:"result"`
	DiscrepancyDetails json.RawMessage `json:"discrepancy_details,omitempty"`
	CheckedBy          uuid.UUID       `json:"checked_by"`
	ExitTime           *time.Time      `json:"exit_time,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
}

// ===== WMS: HANDOVER RECORD (Bàn giao A/B/C) =====
type HandoverRecord struct {
	ID           uuid.UUID       `json:"id"`
	HandoverType string          `json:"handover_type"` // A, B, C
	TripID       uuid.UUID       `json:"trip_id"`
	StopID       *uuid.UUID      `json:"stop_id,omitempty"` // only for type B
	Signatories  json.RawMessage `json:"signatories"`       // [{role, user_id, name, signed_at, action}]
	Status       string          `json:"status"`            // pending, partially_signed, completed, rejected
	DocumentURL  *string         `json:"document_url,omitempty"`
	PhotoURLs    []string        `json:"photo_urls"`
	Items        json.RawMessage `json:"items,omitempty"` // [{product_name, product_sku, expected_qty, actual_qty}]
	RejectReason *string         `json:"reject_reason,omitempty"`
	Notes        *string         `json:"notes,omitempty"`
	CreatedBy    uuid.UUID       `json:"created_by"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// ===== WMS: LOT =====
type Lot struct {
	ID             uuid.UUID `json:"id"`
	ProductID      uuid.UUID `json:"product_id"`
	BatchNumber    string    `json:"batch_number"`
	ProductionDate string    `json:"production_date"`
	ExpiryDate     string    `json:"expiry_date"`
	CreatedAt      time.Time `json:"created_at"`
}

// ===== WMS: STOCK QUANT =====
type StockQuant struct {
	ID          uuid.UUID `json:"id"`
	ProductID   uuid.UUID `json:"product_id"`
	ProductName string    `json:"product_name,omitempty"`
	ProductSKU  string    `json:"product_sku,omitempty"`
	LotID       uuid.UUID `json:"lot_id"`
	BatchNumber string    `json:"batch_number,omitempty"`
	ExpiryDate  string    `json:"expiry_date,omitempty"`
	WarehouseID uuid.UUID `json:"warehouse_id"`
	LocationID  uuid.UUID `json:"location_id"`
	Quantity    int       `json:"quantity"`
	ReservedQty int       `json:"reserved_qty"`
	Available   int       `json:"available"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// ===== ASSET LEDGER =====
type AssetLedgerEntry struct {
	ID              uuid.UUID  `json:"id"`
	CustomerID      uuid.UUID  `json:"customer_id"`
	AssetType       string     `json:"asset_type"`
	Direction       string     `json:"direction"`
	Quantity        int        `json:"quantity"`
	Condition       string     `json:"condition"`
	ReferenceType   string     `json:"reference_type"`
	ReferenceID     uuid.UUID  `json:"reference_id"`
	Notes           *string    `json:"notes,omitempty"`
	BravoSyncStatus string     `json:"bravo_sync_status"`
	CreatedBy       *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// ===== RETURN COLLECTION =====
type ReturnCollection struct {
	ID                   uuid.UUID  `json:"id"`
	TripStopID           uuid.UUID  `json:"trip_stop_id"`
	CustomerID           uuid.UUID  `json:"customer_id"`
	AssetType            string     `json:"asset_type"`
	Quantity             int        `json:"quantity"`
	Condition            string     `json:"condition"`
	PhotoURL             *string    `json:"photo_url,omitempty"`
	WorkshopConfirmedQty *int       `json:"workshop_confirmed_qty,omitempty"`
	WorkshopConfirmedBy  *uuid.UUID `json:"workshop_confirmed_by,omitempty"`
	WorkshopConfirmedAt  *time.Time `json:"workshop_confirmed_at,omitempty"`
	DiscrepancyQty       *int       `json:"discrepancy_qty,omitempty"`
	CreatedBy            *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// ===== ePOD (Electronic Proof of Delivery) =====
type EPOD struct {
	ID             uuid.UUID       `json:"id"`
	TripStopID     uuid.UUID       `json:"trip_stop_id"`
	DriverID       uuid.UUID       `json:"driver_id"`
	CustomerID     uuid.UUID       `json:"customer_id"`
	DeliveredItems json.RawMessage `json:"delivered_items"`
	ReceiverName   *string         `json:"receiver_name,omitempty"`
	ReceiverPhone  *string         `json:"receiver_phone,omitempty"`
	SignatureURL   *string         `json:"signature_url,omitempty"`
	PhotoURLs      []string        `json:"photo_urls"`
	TotalAmount    float64         `json:"total_amount"`
	DepositAmount  float64         `json:"deposit_amount"`
	DeliveryStatus string          `json:"delivery_status"`
	RejectReason   *string         `json:"reject_reason,omitempty"`
	RejectDetail   *string         `json:"reject_detail,omitempty"`
	RejectPhotos   []string        `json:"reject_photos,omitempty"`
	Notes          *string         `json:"notes,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type EPODItem struct {
	ProductID    uuid.UUID `json:"product_id"`
	ProductName  string    `json:"product_name,omitempty"`
	OrderedQty   int       `json:"ordered_qty"`
	DeliveredQty int       `json:"delivered_qty"`
	Reason       string    `json:"reason,omitempty"`
}

// ===== PAYMENT =====
type Payment struct {
	ID              uuid.UUID  `json:"id"`
	TripStopID      uuid.UUID  `json:"trip_stop_id"`
	EPODID          *uuid.UUID `json:"epod_id,omitempty"`
	CustomerID      uuid.UUID  `json:"customer_id"`
	DriverID        uuid.UUID  `json:"driver_id"`
	OrderID         *uuid.UUID `json:"order_id,omitempty"`
	PaymentMethod   string     `json:"payment_method"`
	Amount          float64    `json:"amount"`
	Status          string     `json:"status"`
	ReferenceNumber *string    `json:"reference_number,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	CollectedAt     time.Time  `json:"collected_at"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
	ConfirmedBy     *uuid.UUID `json:"confirmed_by,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ZaloConfirmation tracks Zalo delivery confirmations (SM-06)
type ZaloConfirmation struct {
	ID              uuid.UUID  `json:"id"`
	OrderID         uuid.UUID  `json:"order_id"`
	CustomerID      uuid.UUID  `json:"customer_id"`
	TripStopID      *uuid.UUID `json:"trip_stop_id,omitempty"`
	Token           string     `json:"token"`
	Phone           string     `json:"phone"`
	Status          string     `json:"status"`
	TotalAmount     float64    `json:"total_amount"`
	ZaloMsgID       *string    `json:"zalo_msg_id,omitempty"`
	SentAt          time.Time  `json:"sent_at"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
	DisputedAt      *time.Time `json:"disputed_at,omitempty"`
	DisputeReason   *string    `json:"dispute_reason,omitempty"`
	AutoConfirmedAt *time.Time `json:"auto_confirmed_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// OrderConfirmation tracks Zalo order confirmations from customer (2h timeout)
type OrderConfirmation struct {
	ID              uuid.UUID  `json:"id"`
	OrderID         uuid.UUID  `json:"order_id"`
	OrderNumber     string     `json:"order_number,omitempty"`
	CustomerID      uuid.UUID  `json:"customer_id"`
	CustomerName    string     `json:"customer_name,omitempty"`
	Token           string     `json:"token"`
	Phone           string     `json:"phone"`
	Status          string     `json:"status"`
	TotalAmount     float64    `json:"total_amount"`
	ZaloMsgID       *string    `json:"zalo_msg_id,omitempty"`
	PDFURL          *string    `json:"pdf_url,omitempty"`
	SentAt          time.Time  `json:"sent_at"`
	ConfirmedAt     *time.Time `json:"confirmed_at,omitempty"`
	RejectedAt      *time.Time `json:"rejected_at,omitempty"`
	RejectReason    *string    `json:"reject_reason,omitempty"`
	AutoConfirmedAt *time.Time `json:"auto_confirmed_at,omitempty"`
	ExpiresAt       time.Time  `json:"expires_at"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// ===== INTEGRATION DLQ (Dead Letter Queue) =====
type DLQEntry struct {
	ID           uuid.UUID       `json:"id"`
	Adapter      string          `json:"adapter"`
	Operation    string          `json:"operation"`
	Payload      json.RawMessage `json:"payload"`
	ErrorMessage string          `json:"error_message"`
	RetryCount   int             `json:"retry_count"`
	MaxRetries   int             `json:"max_retries"`
	Status       string          `json:"status"`
	RefType      *string         `json:"reference_type,omitempty"`
	RefID        *uuid.UUID      `json:"reference_id,omitempty"`
	ResolvedAt   *time.Time      `json:"resolved_at,omitempty"`
	NextRetryAt  *time.Time      `json:"next_retry_at,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// ===== RECONCILIATION =====
type Reconciliation struct {
	ID            uuid.UUID       `json:"id"`
	TripID        uuid.UUID       `json:"trip_id"`
	TripNumber    string          `json:"trip_number,omitempty"`
	ReconType     string          `json:"recon_type"`
	Status        string          `json:"status"`
	ExpectedValue float64         `json:"expected_value"`
	ActualValue   float64         `json:"actual_value"`
	Variance      float64         `json:"variance"`
	Details       json.RawMessage `json:"details"`
	ReconciledBy  *uuid.UUID      `json:"reconciled_by,omitempty"`
	ReconciledAt  *time.Time      `json:"reconciled_at,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
	UpdatedAt     time.Time       `json:"updated_at"`
}

type Discrepancy struct {
	ID            uuid.UUID  `json:"id"`
	ReconID       uuid.UUID  `json:"recon_id"`
	TripID        uuid.UUID  `json:"trip_id"`
	TripNumber    string     `json:"trip_number,omitempty"`
	StopID        *uuid.UUID `json:"stop_id,omitempty"`
	DiscType      string     `json:"disc_type"`
	Status        string     `json:"status"`
	Description   string     `json:"description"`
	ExpectedValue float64    `json:"expected_value"`
	ActualValue   float64    `json:"actual_value"`
	Variance      float64    `json:"variance"`
	Resolution    *string    `json:"resolution,omitempty"`
	AssignedTo    *uuid.UUID `json:"assigned_to,omitempty"`
	Deadline      *time.Time `json:"deadline,omitempty"`
	ResolvedAt    *time.Time `json:"resolved_at,omitempty"`
	ResolvedBy    *uuid.UUID `json:"resolved_by,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

type DailyCloseSummary struct {
	ID                    uuid.UUID       `json:"id"`
	CloseDate             string          `json:"close_date"`
	WarehouseID           uuid.UUID       `json:"warehouse_id"`
	TotalTrips            int             `json:"total_trips"`
	CompletedTrips        int             `json:"completed_trips"`
	TotalStops            int             `json:"total_stops"`
	DeliveredStops        int             `json:"delivered_stops"`
	FailedStops           int             `json:"failed_stops"`
	TotalRevenue          float64         `json:"total_revenue"`
	TotalCollected        float64         `json:"total_collected"`
	TotalOutstanding      float64         `json:"total_outstanding"`
	TotalReturnsGood      int             `json:"total_returns_good"`
	TotalReturnsDamaged   int             `json:"total_returns_damaged"`
	TotalDiscrepancies    int             `json:"total_discrepancies"`
	ResolvedDiscrepancies int             `json:"resolved_discrepancies"`
	Summary               json.RawMessage `json:"summary"`
	CreatedAt             time.Time       `json:"created_at"`
}

// ===== NOTIFICATION =====
type Notification struct {
	ID         uuid.UUID       `json:"id"`
	UserID     uuid.UUID       `json:"user_id"`
	Title      string          `json:"title"`
	Body       string          `json:"body"`
	Category   string          `json:"category"`
	Priority   string          `json:"priority"`
	Link       *string         `json:"link,omitempty"`
	EntityType *string         `json:"entity_type,omitempty"`
	EntityID   *uuid.UUID      `json:"entity_id,omitempty"`
	Actions    json.RawMessage `json:"actions,omitempty"`
	GroupKey   *string         `json:"group_key,omitempty"`
	IsRead     bool            `json:"is_read"`
	CreatedAt  time.Time       `json:"created_at"`
}

// NotificationAction represents an inline action button on a notification
type NotificationAction struct {
	Label        string          `json:"label"`
	Method       string          `json:"method"`
	Endpoint     string          `json:"endpoint"`
	BodyTemplate json.RawMessage `json:"body_template,omitempty"`
}

// NotificationGroup represents a grouped set of notifications
type NotificationGroup struct {
	GroupKey      string         `json:"group_key"`
	Count         int            `json:"count"`
	LatestTitle   string         `json:"latest_title"`
	LatestBody    string         `json:"latest_body"`
	Category      string         `json:"category"`
	Priority      string         `json:"priority"`
	EntityType    *string        `json:"entity_type,omitempty"`
	IsRead        bool           `json:"is_read"`
	LatestAt      time.Time      `json:"latest_at"`
	Notifications []Notification `json:"notifications,omitempty"`
}

// ===== ADMIN RBAC =====
type RolePermission struct {
	ID        uuid.UUID  `json:"id"`
	Role      string     `json:"role"`
	Resource  string     `json:"resource"`
	Action    string     `json:"action"`
	Scope     string     `json:"scope"`
	IsAllowed bool       `json:"is_allowed"`
	UpdatedBy *uuid.UUID `json:"updated_by,omitempty"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type UserPermissionOverride struct {
	ID        uuid.UUID  `json:"id"`
	UserID    uuid.UUID  `json:"user_id"`
	Resource  string     `json:"resource"`
	Action    string     `json:"action"`
	IsAllowed bool       `json:"is_allowed"`
	Reason    *string    `json:"reason,omitempty"`
	GrantedBy *uuid.UUID `json:"granted_by,omitempty"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	CreatedAt time.Time  `json:"created_at"`
}

type ActiveSession struct {
	ID               uuid.UUID  `json:"id"`
	UserID           uuid.UUID  `json:"user_id"`
	UserFullName     string     `json:"user_full_name,omitempty"`
	RefreshTokenHash string     `json:"-"`
	IPAddress        *string    `json:"ip_address,omitempty"`
	UserAgent        *string    `json:"user_agent,omitempty"`
	LastSeenAt       time.Time  `json:"last_seen_at"`
	CreatedAt        time.Time  `json:"created_at"`
	RevokedAt        *time.Time `json:"revoked_at,omitempty"`
}

type PermissionEntry struct {
	IsAllowed   bool   `json:"is_allowed"`
	Scope       string `json:"scope"`
	HasOverride bool   `json:"has_override,omitempty"`
}

type AuditFilter struct {
	UserID     *uuid.UUID `json:"user_id,omitempty"`
	Action     *string    `json:"action,omitempty"`
	EntityType *string    `json:"entity_type,omitempty"`
	EntityID   *string    `json:"entity_id,omitempty"`
	From       *time.Time `json:"from,omitempty"`
	To         *time.Time `json:"to,omitempty"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
}

// ===== ENTITY EVENT (Activity Timeline) =====
type EntityEvent struct {
	ID         uuid.UUID       `json:"id"`
	EntityType string          `json:"entity_type"`
	EntityID   uuid.UUID       `json:"entity_id"`
	EventType  string          `json:"event_type"`
	ActorType  string          `json:"actor_type"`
	ActorID    *uuid.UUID      `json:"actor_id,omitempty"`
	ActorName  string          `json:"actor_name"`
	Title      string          `json:"title"`
	Detail     json.RawMessage `json:"detail,omitempty"`
	CreatedAt  time.Time       `json:"created_at"`
}

// ===== ORDER NOTE =====
type OrderNote struct {
	ID        uuid.UUID `json:"id"`
	OrderID   uuid.UUID `json:"order_id"`
	UserID    uuid.UUID `json:"user_id"`
	UserName  string    `json:"user_name"`
	Content   string    `json:"content"`
	NoteType  string    `json:"note_type"`
	IsPinned  bool      `json:"is_pinned"`
	CreatedAt time.Time `json:"created_at"`
}

// ===== DRIVER CHECK-IN =====
type DriverCheckin struct {
	ID          uuid.UUID `json:"id"`
	DriverID    uuid.UUID `json:"driver_id"`
	CheckinDate string    `json:"checkin_date"`
	Status      string    `json:"status"`
	Reason      *string   `json:"reason,omitempty"`
	Note        *string   `json:"note,omitempty"`
	CheckedInAt time.Time `json:"checked_in_at"`
}

// ===== DAILY KPI SNAPSHOT =====
type DailyKPISnapshot struct {
	ID                    uuid.UUID       `json:"id"`
	SnapshotDate          string          `json:"snapshot_date"`
	WarehouseID           uuid.UUID       `json:"warehouse_id"`
	OTDRate               float64         `json:"otd_rate"`
	DeliverySuccessRate   float64         `json:"delivery_success_rate"`
	TotalOrders           int             `json:"total_orders"`
	DeliveredOrders       int             `json:"delivered_orders"`
	FailedOrders          int             `json:"failed_orders"`
	AvgVehicleUtilization float64         `json:"avg_vehicle_utilization"`
	TotalTrips            int             `json:"total_trips"`
	TotalDistanceKm       float64         `json:"total_distance_km"`
	TotalRevenue          float64         `json:"total_revenue"`
	TotalCollected        float64         `json:"total_collected"`
	OutstandingReceivable float64         `json:"outstanding_receivable"`
	ReconMatchRate        float64         `json:"recon_match_rate"`
	TotalDiscrepancies    int             `json:"total_discrepancies"`
	Details               json.RawMessage `json:"details"`
	CreatedAt             time.Time       `json:"created_at"`
}

// ===== DELIVERY ATTEMPT (Re-delivery tracking) =====
type DeliveryAttempt struct {
	ID             uuid.UUID  `json:"id"`
	OrderID        uuid.UUID  `json:"order_id"`
	AttemptNumber  int        `json:"attempt_number"`
	ShipmentID     *uuid.UUID `json:"shipment_id,omitempty"`
	PreviousStopID *uuid.UUID `json:"previous_stop_id,omitempty"`
	PreviousStatus string     `json:"previous_status"`
	PreviousReason string     `json:"previous_reason"`
	Status         string     `json:"status"`
	CreatedBy      *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	CompletedAt    *time.Time `json:"completed_at,omitempty"`
	// Joined fields
	OrderNumber  string `json:"order_number,omitempty"`
	CustomerName string `json:"customer_name,omitempty"`
}

// ===== VEHICLE DOCUMENT =====
type VehicleDocument struct {
	ID         uuid.UUID  `json:"id"`
	VehicleID  uuid.UUID  `json:"vehicle_id"`
	DocType    string     `json:"doc_type"`
	DocNumber  string     `json:"doc_number,omitempty"`
	IssuedDate *string    `json:"issued_date,omitempty"`
	ExpiryDate string     `json:"expiry_date"`
	Notes      *string    `json:"notes,omitempty"`
	CreatedBy  *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
	// Joined fields
	PlateNumber  string `json:"plate_number,omitempty"`
	DaysToExpiry int    `json:"days_to_expiry,omitempty"`
}

// ===== DRIVER DOCUMENT =====
type DriverDocument struct {
	ID           uuid.UUID  `json:"id"`
	DriverID     uuid.UUID  `json:"driver_id"`
	DocType      string     `json:"doc_type"`
	DocNumber    string     `json:"doc_number,omitempty"`
	IssuedDate   *string    `json:"issued_date,omitempty"`
	ExpiryDate   string     `json:"expiry_date"`
	LicenseClass *string    `json:"license_class,omitempty"`
	Notes        *string    `json:"notes,omitempty"`
	CreatedBy    *uuid.UUID `json:"created_by,omitempty"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	// Joined fields
	DriverName   string `json:"driver_name,omitempty"`
	DaysToExpiry int    `json:"days_to_expiry,omitempty"`
}

// ===== END-OF-DAY (KẾT CA) =====

// EODSession represents one end-of-day session for a trip (3-station flow).
type EODSession struct {
	ID                     uuid.UUID  `json:"id"`
	TripID                 uuid.UUID  `json:"trip_id"`
	DriverID               uuid.UUID  `json:"driver_id"`
	Status                 string     `json:"status"` // in_progress, completed, cancelled
	TotalStopsDelivered    int        `json:"total_stops_delivered"`
	TotalStopsFailed       int        `json:"total_stops_failed"`
	TotalCashCollected     float64    `json:"total_cash_collected"`
	TotalTransferCollected float64    `json:"total_transfer_collected"`
	TotalCreditAmount      float64    `json:"total_credit_amount"`
	StartedAt              time.Time  `json:"started_at"`
	CompletedAt            *time.Time `json:"completed_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
	UpdatedAt              time.Time  `json:"updated_at"`
	// Joined
	TripNumber   string          `json:"trip_number,omitempty"`
	VehiclePlate string          `json:"vehicle_plate,omitempty"`
	DriverName   string          `json:"driver_name_eod,omitempty"`
	Checkpoints  []EODCheckpoint `json:"checkpoints,omitempty"`
}

// EODCheckpoint represents one of the 3 confirmation stations.
type EODCheckpoint struct {
	ID                uuid.UUID       `json:"id"`
	SessionID         uuid.UUID       `json:"session_id"`
	TripID            uuid.UUID       `json:"trip_id"`
	CheckpointType    string          `json:"checkpoint_type"` // container_return, cash_handover, vehicle_return
	CheckpointOrder   int             `json:"checkpoint_order"`
	Status            string          `json:"status"` // pending, submitted, confirmed, rejected
	DriverData        json.RawMessage `json:"driver_data,omitempty"`
	SubmittedAt       *time.Time      `json:"submitted_at,omitempty"`
	ReceiverID        *uuid.UUID      `json:"receiver_id,omitempty"`
	ReceiverName      string          `json:"receiver_name,omitempty"`
	ReceiverData      json.RawMessage `json:"receiver_data,omitempty"`
	DiscrepancyReason *string         `json:"discrepancy_reason,omitempty"`
	SignatureURL      *string         `json:"signature_url,omitempty"`
	ConfirmedAt       *time.Time      `json:"confirmed_at,omitempty"`
	RejectedAt        *time.Time      `json:"rejected_at,omitempty"`
	RejectReason      *string         `json:"reject_reason,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}
