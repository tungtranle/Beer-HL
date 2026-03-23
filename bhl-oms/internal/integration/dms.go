package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"bhl-oms/pkg/logger"
)

// DMSAdapter syncs order status to the DMS system (Task 3.4)
type DMSAdapter struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	mockMode   bool
	log        logger.Logger
}

func NewDMSAdapter(baseURL, apiKey string, mockMode bool, log logger.Logger) *DMSAdapter {
	return &DMSAdapter{
		baseURL:    baseURL,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		mockMode:   mockMode,
		log:        log,
	}
}

// DMSOrderSync payload sent to DMS
type DMSOrderSync struct {
	OrderNumber  string  `json:"order_number"`
	Status       string  `json:"status"`
	DeliveryDate string  `json:"delivery_date,omitempty"`
	DriverName   string  `json:"driver_name,omitempty"`
	VehiclePlate string  `json:"vehicle_plate,omitempty"`
	TotalAmount  float64 `json:"total_amount"`
	Notes        string  `json:"notes,omitempty"`
}

// DMSSyncResponse from DMS
type DMSSyncResponse struct {
	Success    bool   `json:"success"`
	DMSOrderID string `json:"dms_order_id"`
	SyncedAt   string `json:"synced_at"`
	ErrorCode  string `json:"error_code,omitempty"`
}

// PushOrderStatus pushes order status to DMS
func (a *DMSAdapter) PushOrderStatus(ctx context.Context, order DMSOrderSync) (*DMSSyncResponse, error) {
	if a.mockMode {
		return &DMSSyncResponse{
			Success:    true,
			DMSOrderID: fmt.Sprintf("DMS-2026-%06d", time.Now().UnixNano()%1000000),
			SyncedAt:   time.Now().Format(time.RFC3339),
		}, nil
	}

	body, err := json.Marshal(order)
	if err != nil {
		return nil, fmt.Errorf("marshal dms payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/orders/sync", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("dms request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read dms response: %w", err)
	}

	var result DMSSyncResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse dms response: %w", err)
	}

	if !result.Success {
		return &result, fmt.Errorf("DMS_SYNC_ERROR: %s", result.ErrorCode)
	}

	a.log.Info(ctx, "dms_order_synced", logger.F("order_number", order.OrderNumber), logger.F("dms_order_id", result.DMSOrderID))
	return &result, nil
}
