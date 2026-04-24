package fleet

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

// ─── Work Order ───

type WorkOrder struct {
	ID               uuid.UUID       `json:"id"`
	WONumber         string          `json:"wo_number"`
	VehicleID        uuid.UUID       `json:"vehicle_id"`
	VehiclePlate     string          `json:"vehicle_plate,omitempty"`
	DriverID         *uuid.UUID      `json:"driver_id,omitempty"`
	DriverName       string          `json:"driver_name,omitempty"`
	GarageID         *uuid.UUID      `json:"garage_id,omitempty"`
	GarageName       string          `json:"garage_name,omitempty"`
	TriggerType      string          `json:"trigger_type"`
	Category         string          `json:"category"`
	Priority         string          `json:"priority"`
	Description      string          `json:"description"`
	Status           string          `json:"status"`
	QuotedAmount     decimal.Decimal `json:"quoted_amount"`
	ActualAmount     decimal.Decimal `json:"actual_amount"`
	ApprovedBy       *uuid.UUID      `json:"approved_by,omitempty"`
	ApprovedAt       *time.Time      `json:"approved_at,omitempty"`
	ETACompletion    *time.Time      `json:"eta_completion,omitempty"`
	ActualCompletion *time.Time      `json:"actual_completion,omitempty"`
	KmAtRepair       *int            `json:"km_at_repair,omitempty"`
	InvoiceURL       *string         `json:"invoice_url,omitempty"`
	IsEmergency      bool            `json:"is_emergency"`
	IsRecurring      bool            `json:"is_recurring"`
	RejectionReason  *string         `json:"rejection_reason,omitempty"`
	CreatedBy        uuid.UUID       `json:"created_by"`
	CreatedAt        time.Time       `json:"created_at"`
	UpdatedAt        time.Time       `json:"updated_at"`
	Items            []RepairItem    `json:"items,omitempty"`
}

type RepairItem struct {
	ID           uuid.UUID       `json:"id"`
	WorkOrderID  uuid.UUID       `json:"work_order_id"`
	ItemType     string          `json:"item_type"`
	Description  string          `json:"description"`
	Quantity     int             `json:"quantity"`
	UnitPrice    decimal.Decimal `json:"unit_price"`
	TotalPrice   decimal.Decimal `json:"total_price"`
	PartNumber   *string         `json:"part_number,omitempty"`
	WarrantyKm   *int            `json:"warranty_km,omitempty"`
	WarrantyDays *int            `json:"warranty_days,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

type RepairAttachment struct {
	ID             uuid.UUID  `json:"id"`
	WorkOrderID    uuid.UUID  `json:"work_order_id"`
	AttachmentType string     `json:"attachment_type"`
	URL            string     `json:"url"`
	FileName       *string    `json:"file_name,omitempty"`
	FileSize       *int64     `json:"file_size,omitempty"`
	UploadedBy     *uuid.UUID `json:"uploaded_by,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

type WOFilter struct {
	VehicleID *uuid.UUID
	Status    string
	Category  string
	Limit     int
	Offset    int
}

// ─── Garage ───

type Garage struct {
	ID            uuid.UUID       `json:"id"`
	Name          string          `json:"name"`
	Address       string          `json:"address"`
	GPSLat        *float64        `json:"gps_lat,omitempty"`
	GPSLng        *float64        `json:"gps_lng,omitempty"`
	Phone         *string         `json:"phone,omitempty"`
	Specialties   []string        `json:"specialties,omitempty"`
	PaymentTerms  *string         `json:"payment_terms,omitempty"`
	OpeningHours  *string         `json:"opening_hours,omitempty"`
	IsPreferred   bool            `json:"is_preferred"`
	IsBlacklisted bool            `json:"is_blacklisted"`
	AvgRating     decimal.Decimal `json:"avg_rating"`
	TotalRepairs  int             `json:"total_repairs"`
	AvgMTTRHours  float64         `json:"avg_mttr_hours"`
	CreatedBy     *uuid.UUID      `json:"created_by,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}

type GarageRating struct {
	ID           uuid.UUID       `json:"id"`
	GarageID     uuid.UUID       `json:"garage_id"`
	WorkOrderID  uuid.UUID       `json:"work_order_id"`
	QualityScore int             `json:"quality_score"`
	TimeScore    int             `json:"time_score"`
	CostVsQuote  decimal.Decimal `json:"cost_vs_quote"`
	ReworkFlag   bool            `json:"rework_flag"`
	Notes        *string         `json:"notes,omitempty"`
	RatedBy      uuid.UUID       `json:"rated_by"`
}

// ─── Fuel Log ───

type FuelLog struct {
	ID              uuid.UUID       `json:"id"`
	VehicleID       uuid.UUID       `json:"vehicle_id"`
	VehiclePlate    string          `json:"vehicle_plate,omitempty"`
	DriverID        uuid.UUID       `json:"driver_id"`
	DriverName      string          `json:"driver_name,omitempty"`
	LogDate         string          `json:"log_date"`
	KmOdometer      int             `json:"km_odometer"`
	LitersFilled    decimal.Decimal `json:"liters_filled"`
	AmountVND       decimal.Decimal `json:"amount_vnd"`
	FuelType        *string         `json:"fuel_type,omitempty"`
	StationName     *string         `json:"station_name,omitempty"`
	InvoicePhotoURL *string         `json:"invoice_photo_url,omitempty"`
	Channel         string          `json:"channel"`
	ExpectedLiters  decimal.Decimal `json:"expected_liters"`
	AnomalyRatio    decimal.Decimal `json:"anomaly_ratio"`
	AnomalyFlag     bool            `json:"anomaly_flag"`
	CreatedBy       *uuid.UUID      `json:"created_by,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

type FuelAnomaly struct {
	ID              uuid.UUID       `json:"id"`
	FuelLogID       uuid.UUID       `json:"fuel_log_id"`
	VehicleID       uuid.UUID       `json:"vehicle_id"`
	VehiclePlate    string          `json:"vehicle_plate,omitempty"`
	DriverID        uuid.UUID       `json:"driver_id"`
	DriverName      string          `json:"driver_name,omitempty"`
	ExpectedLiters  decimal.Decimal `json:"expected_liters"`
	ActualLiters    decimal.Decimal `json:"actual_liters"`
	AnomalyRatio    decimal.Decimal `json:"anomaly_ratio"`
	Status          string          `json:"status"`
	ExplanationText *string         `json:"explanation_text,omitempty"`
	ReviewerID      *uuid.UUID      `json:"reviewer_id,omitempty"`
	CreatedAt       time.Time       `json:"created_at"`
}

type FuelLogFilter struct {
	VehicleID   *uuid.UUID
	DriverID    *uuid.UUID
	AnomalyOnly bool
	Limit       int
	Offset      int
}

type FuelConsumptionRate struct {
	VehicleType    string  `json:"vehicle_type"`
	BaseRate       float64 `json:"base_rate"`
	UrbanFactor    float64 `json:"urban_factor"`
	HighwayFactor  float64 `json:"highway_factor"`
	MountainFactor float64 `json:"mountain_factor"`
}

// ─── Tire Set ───

type TireSet struct {
	ID             uuid.UUID       `json:"id"`
	VehicleID      uuid.UUID       `json:"vehicle_id"`
	Brand          string          `json:"brand"`
	Model          *string         `json:"model,omitempty"`
	Size           string          `json:"size"`
	TireCount      int             `json:"tire_count"`
	InstalledDate  string          `json:"installed_date"`
	InstalledKm    int             `json:"installed_km"`
	PurchaseCost   decimal.Decimal `json:"purchase_cost"`
	Condition      string          `json:"condition"`
	LastRotationKm *int            `json:"last_rotation_km,omitempty"`
	Notes          *string         `json:"notes,omitempty"`
	IsActive       bool            `json:"is_active"`
	CreatedBy      *uuid.UUID      `json:"created_by,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

// ─── Leave Request ───

type LeaveRequest struct {
	ID              uuid.UUID  `json:"id"`
	DriverID        uuid.UUID  `json:"driver_id"`
	DriverName      string     `json:"driver_name,omitempty"`
	LeaveType       string     `json:"leave_type"`
	StartDate       string     `json:"start_date"`
	EndDate         string     `json:"end_date"`
	Reason          *string    `json:"reason,omitempty"`
	Status          string     `json:"status"`
	ApprovedBy      *uuid.UUID `json:"approved_by,omitempty"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	RejectionReason *string    `json:"rejection_reason,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// ─── Driver Score ───

type DriverScore struct {
	ID                   uuid.UUID `json:"id"`
	DriverID             uuid.UUID `json:"driver_id"`
	ScoreDate            string    `json:"score_date"`
	TotalScore           float64   `json:"total_score"`
	OTDScore             float64   `json:"otd_score"`
	DeliveryScore        float64   `json:"delivery_score"`
	SafetyScore          float64   `json:"safety_score"`
	ComplianceScore      float64   `json:"compliance_score"`
	CustomerScore        float64   `json:"customer_score"`
	TripsCount           int       `json:"trips_count"`
	StopsCount           int       `json:"stops_count"`
	OnTimeCount          int       `json:"on_time_count"`
	DeliveredCount       int       `json:"delivered_count"`
	FailedCount          int       `json:"failed_count"`
	SpeedViolations      int       `json:"speed_violations"`
	ChecklistCompletions int       `json:"checklist_completions"`
	EPODCompletions      int       `json:"epod_completions"`
	ModelVersion         string    `json:"model_version"`
}

type DriverTripStats struct {
	Trips      int
	TotalStops int
	Delivered  int
	Failed     int
	OnTime     int
}

// ─── Leaderboard ───

type LeaderboardEntry struct {
	Rank       int       `json:"rank"`
	DriverID   uuid.UUID `json:"driver_id"`
	DriverName string    `json:"driver_name"`
	AvgScore   float64   `json:"avg_score"`
	TotalTrips int       `json:"total_trips"`
	BadgeCount int       `json:"badge_count"`
}

// ─── Badge ───

type Badge struct {
	ID              uuid.UUID       `json:"id"`
	BadgeCode       string          `json:"badge_code"`
	Name            string          `json:"name"`
	Description     *string         `json:"description,omitempty"`
	IconEmoji       string          `json:"icon_emoji"`
	ConditionConfig json.RawMessage `json:"condition_config"`
	ValueVND        decimal.Decimal `json:"value_vnd"`
	IsActive        bool            `json:"is_active"`
	SortOrder       int             `json:"sort_order"`
}

type BadgeAward struct {
	ID                uuid.UUID       `json:"id"`
	BadgeID           uuid.UUID       `json:"badge_id"`
	BadgeCode         string          `json:"badge_code,omitempty"`
	BadgeName         string          `json:"badge_name,omitempty"`
	BadgeEmoji        string          `json:"badge_emoji,omitempty"`
	DriverID          uuid.UUID       `json:"driver_id"`
	AwardedAt         time.Time       `json:"awarded_at"`
	PeriodMonth       string          `json:"period_month"`
	ConditionSnapshot json.RawMessage `json:"condition_snapshot,omitempty"`
	BonusVND          decimal.Decimal `json:"bonus_vnd"`
	CreatedBy         *uuid.UUID      `json:"created_by,omitempty"`
}

// ─── Analytics ───

type VehicleHealthData struct {
	VehicleID          uuid.UUID  `json:"vehicle_id"`
	PlateNumber        string     `json:"plate_number"`
	VehicleType        string     `json:"vehicle_type"`
	HealthScore        *int       `json:"health_score"`
	CurrentKm          *int       `json:"current_km"`
	YearOfManufacture  *int       `json:"year_of_manufacture"`
	LastHealthCheck    *time.Time `json:"last_health_check"`
	OpenROs            int        `json:"open_ros"`
	OverdueMaintenance int        `json:"overdue_maintenance"`
	CalculatedScore    int        `json:"calculated_score,omitempty"`
}

type VehicleTCO struct {
	VehicleID         uuid.UUID       `json:"vehicle_id"`
	PlateNumber       string          `json:"plate_number"`
	VehicleType       string          `json:"vehicle_type"`
	YearOfManufacture *int            `json:"year_of_manufacture"`
	RepairCost        decimal.Decimal `json:"repair_cost"`
	FuelCost          decimal.Decimal `json:"fuel_cost"`
	TireCost          decimal.Decimal `json:"tire_cost"`
	TotalCost         decimal.Decimal `json:"total_cost"`
	KmDriven          int             `json:"km_driven"`
	CostPerKm         decimal.Decimal `json:"cost_per_km"`
}

type VehicleCostRank struct {
	VehicleID   uuid.UUID       `json:"vehicle_id"`
	PlateNumber string          `json:"plate_number"`
	VehicleType string          `json:"vehicle_type"`
	TotalCost   decimal.Decimal `json:"total_cost"`
	RepairCount int             `json:"repair_count"`
}

type CategoryCost struct {
	Category  string          `json:"category"`
	TotalCost decimal.Decimal `json:"total_cost"`
	Count     int             `json:"count"`
}

type RepairCostSummary struct {
	TotalCost    decimal.Decimal `json:"total_cost"`
	TotalOrders  int             `json:"total_orders"`
	AvgMTTRHours float64         `json:"avg_mttr_hours"`
}

type BonusReportEntry struct {
	DriverID   uuid.UUID       `json:"driver_id"`
	DriverName string          `json:"driver_name"`
	AvgScore   float64         `json:"avg_score"`
	BadgeBonus decimal.Decimal `json:"badge_bonus"`
	BadgeCount int             `json:"badge_count"`
}

type VehicleDocAlert struct {
	VehicleID    uuid.UUID `json:"vehicle_id"`
	PlateNumber  string    `json:"plate_number"`
	DocumentType string    `json:"document_type"`
	ExpiryDate   string    `json:"expiry_date"`
	AlertLevel   string    `json:"alert_level"`
}

type GarageBenchmark struct {
	GarageID     uuid.UUID       `json:"garage_id"`
	GarageName   string          `json:"garage_name"`
	AvgRating    decimal.Decimal `json:"avg_rating"`
	TotalRepairs int             `json:"total_repairs"`
	AvgMTTRHours float64         `json:"avg_mttr_hours"`
	AvgCost      decimal.Decimal `json:"avg_cost"`
}

// ─── Request / Response DTOs ───

type CreateWorkOrderRequest struct {
	VehicleID    uuid.UUID                 `json:"vehicle_id" binding:"required"`
	DriverID     *uuid.UUID                `json:"driver_id"`
	GarageID     *uuid.UUID                `json:"garage_id"`
	TriggerType  string                    `json:"trigger_type" binding:"required"`
	Category     string                    `json:"category" binding:"required"`
	Priority     string                    `json:"priority" binding:"required"`
	Description  string                    `json:"description" binding:"required"`
	QuotedAmount decimal.Decimal           `json:"quoted_amount"`
	IsEmergency  bool                      `json:"is_emergency"`
	IsRecurring  bool                      `json:"is_recurring"`
	KmAtRepair   *int                      `json:"km_at_repair"`
	Items        []CreateRepairItemRequest `json:"items"`
}

type CreateRepairItemRequest struct {
	ItemType    string          `json:"item_type"`
	Description string          `json:"description" binding:"required"`
	Quantity    int             `json:"quantity" binding:"required"`
	UnitPrice   decimal.Decimal `json:"unit_price" binding:"required"`
	PartNumber  *string         `json:"part_number"`
}

type ApproveWORequest struct {
	Approved        bool   `json:"approved"`
	RejectionReason string `json:"rejection_reason"`
}

type CompleteWORequest struct {
	ActualAmount decimal.Decimal `json:"actual_amount" binding:"required"`
	InvoiceURL   *string         `json:"invoice_url"`
}

type CreateGarageRequest struct {
	Name         string   `json:"name" binding:"required"`
	Address      string   `json:"address" binding:"required"`
	GPSLat       *float64 `json:"gps_lat"`
	GPSLng       *float64 `json:"gps_lng"`
	Phone        *string  `json:"phone"`
	Specialties  []string `json:"specialties"`
	PaymentTerms *string  `json:"payment_terms"`
	OpeningHours *string  `json:"opening_hours"`
	IsPreferred  bool     `json:"is_preferred"`
}

type UpdateGarageRequest struct {
	Name          *string  `json:"name"`
	Address       *string  `json:"address"`
	Phone         *string  `json:"phone"`
	Specialties   []string `json:"specialties"`
	IsPreferred   *bool    `json:"is_preferred"`
	IsBlacklisted *bool    `json:"is_blacklisted"`
}

type RateGarageRequest struct {
	WorkOrderID  uuid.UUID       `json:"work_order_id" binding:"required"`
	QualityScore int             `json:"quality_score" binding:"required"`
	TimeScore    int             `json:"time_score" binding:"required"`
	CostVsQuote  decimal.Decimal `json:"cost_vs_quote"`
	ReworkFlag   bool            `json:"rework_flag"`
	Notes        *string         `json:"notes"`
}

type CreateFuelLogRequest struct {
	VehicleID       uuid.UUID       `json:"vehicle_id" binding:"required"`
	DriverID        uuid.UUID       `json:"driver_id" binding:"required"`
	LogDate         string          `json:"log_date" binding:"required"`
	KmOdometer      int             `json:"km_odometer" binding:"required"`
	LitersFilled    decimal.Decimal `json:"liters_filled" binding:"required"`
	AmountVND       decimal.Decimal `json:"amount_vnd" binding:"required"`
	FuelType        *string         `json:"fuel_type"`
	StationName     *string         `json:"station_name"`
	InvoicePhotoURL *string         `json:"invoice_photo_url"`
	Channel         string          `json:"channel"`
}

type CreateTireSetRequest struct {
	VehicleID     uuid.UUID       `json:"vehicle_id" binding:"required"`
	Brand         string          `json:"brand" binding:"required"`
	Model         *string         `json:"model"`
	Size          string          `json:"size" binding:"required"`
	TireCount     int             `json:"tire_count"`
	InstalledDate string          `json:"installed_date"`
	InstalledKm   int             `json:"installed_km"`
	PurchaseCost  decimal.Decimal `json:"purchase_cost"`
}

type UpdateTireSetRequest struct {
	Condition      *string `json:"condition"`
	LastRotationKm *int    `json:"last_rotation_km"`
	Notes          *string `json:"notes"`
	IsActive       *bool   `json:"is_active"`
}

type CreateLeaveRequestReq struct {
	LeaveType string  `json:"leave_type" binding:"required"`
	StartDate string  `json:"start_date" binding:"required"`
	EndDate   string  `json:"end_date" binding:"required"`
	Reason    *string `json:"reason"`
}

type ApproveLeaveRequest struct {
	Approved        bool   `json:"approved"`
	RejectionReason string `json:"rejection_reason"`
}

type ResolveFuelAnomalyRequest struct {
	Status      string `json:"status" binding:"required"`
	Explanation string `json:"explanation"`
}

type ScorecardResponse struct {
	DriverID     uuid.UUID     `json:"driver_id"`
	DriverName   string        `json:"driver_name"`
	CurrentScore float64       `json:"current_score"`
	Rank         int           `json:"rank"`
	RankTotal    int           `json:"rank_total"`
	History      []DriverScore `json:"history"`
	Badges       []BadgeAward  `json:"badges"`
}
