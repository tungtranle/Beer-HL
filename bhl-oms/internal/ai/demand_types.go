package ai

import (
	"time"

	"github.com/google/uuid"
)

type DemandHistoryPoint struct {
	Date string  `json:"date"`
	Qty  float64 `json:"qty"`
}

type DemandForecastPoint struct {
	WeekStart string  `json:"week_start"`
	QtyPred   float64 `json:"qty_pred"`
	QtyLower  float64 `json:"qty_lower"`
	QtyUpper  float64 `json:"qty_upper"`
}

type DemandForecastContext struct {
	CustomerID    uuid.UUID            `json:"customer_id"`
	CustomerCode  string               `json:"customer_code"`
	CustomerName  string               `json:"customer_name"`
	ProductID     uuid.UUID            `json:"product_id"`
	SKU           string               `json:"sku"`
	ProductName   string               `json:"product_name"`
	WarehouseID   uuid.UUID            `json:"warehouse_id"`
	WarehouseCode string               `json:"warehouse_code"`
	WarehouseName string               `json:"warehouse_name"`
	History       []DemandHistoryPoint `json:"history"`
	BaselineQty   float64              `json:"baseline_qty"`
}

type DemandForecast struct {
	DemandForecastContext
	HorizonWeeks  int                   `json:"horizon_weeks"`
	HistoryPoints int                   `json:"history_points"`
	ModelMethod   string                `json:"model_method"`
	Confidence    float64               `json:"confidence"`
	Forecast      []DemandForecastPoint `json:"forecast"`
	Explanation   string                `json:"explanation"`
	Provider      string                `json:"provider"`
	GeneratedAt   time.Time             `json:"generated_at"`
}

type OutreachQueueItem struct {
	CustomerID      uuid.UUID `json:"customer_id,omitempty"`
	CustomerCode    string    `json:"customer_code"`
	CustomerName    string    `json:"customer_name"`
	Province        string    `json:"province,omitempty"`
	HealthScore     float64   `json:"health_score"`
	RiskBand        string    `json:"risk_band"`
	RecencyDays     int       `json:"recency_days"`
	Frequency       int       `json:"frequency_orders"`
	SuggestedAction string    `json:"suggested_action"`
	Reason          string    `json:"reason"`
	Priority        int       `json:"priority"`
}
