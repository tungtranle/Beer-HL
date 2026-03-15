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
	Items           []OrderItem `json:"items,omitempty"`
	CreatedAt       time.Time   `json:"created_at"`
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

// ===== SHIPMENT =====
type Shipment struct {
	ID              uuid.UUID `json:"id"`
	ShipmentNumber  string    `json:"shipment_number"`
	OrderID         uuid.UUID `json:"order_id"`
	CustomerID      uuid.UUID `json:"customer_id"`
	CustomerName    string    `json:"customer_name,omitempty"`
	CustomerAddress string    `json:"customer_address,omitempty"`
	WarehouseID     uuid.UUID `json:"warehouse_id"`
	Status          string    `json:"status"`
	DeliveryDate    string    `json:"delivery_date"`
	TotalWeightKg   float64   `json:"total_weight_kg"`
	TotalVolumeM3   float64   `json:"total_volume_m3"`
	Latitude        *float64  `json:"latitude,omitempty"`
	Longitude       *float64  `json:"longitude,omitempty"`
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
	ShipmentID         uuid.UUID `json:"shipment_id"`
	CustomerID         uuid.UUID `json:"customer_id"`
	CustomerName       string    `json:"customer_name"`
	CustomerAddress    string    `json:"customer_address"`
	Latitude           float64   `json:"latitude"`
	Longitude          float64   `json:"longitude"`
	StopOrder          int       `json:"stop_order"`
	EstimatedArrival   string    `json:"estimated_arrival"`
	EstimatedDeparture string    `json:"estimated_departure"`
	CumulativeLoadKg   float64   `json:"cumulative_load_kg"`
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
