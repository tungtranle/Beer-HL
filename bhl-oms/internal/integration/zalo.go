package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"bhl-oms/pkg/logger"
)

// ZaloAdapter sends ZNS messages via Zalo OA (Task 3.5)
type ZaloAdapter struct {
	baseURL     string
	accessToken string
	oaID        string
	httpClient  *http.Client
	mockMode    bool
	log         logger.Logger
}

func NewZaloAdapter(baseURL, accessToken, oaID string, mockMode bool, log logger.Logger) *ZaloAdapter {
	if baseURL == "" {
		baseURL = "https://business.openapi.zalo.me"
	}
	return &ZaloAdapter{
		baseURL:     baseURL,
		accessToken: accessToken,
		oaID:        oaID,
		httpClient:  &http.Client{Timeout: 15 * time.Second},
		mockMode:    mockMode,
		log:         log,
	}
}

// ZNSMessage represents a Zalo Notification Service message
type ZNSMessage struct {
	Phone      string            `json:"phone"`
	TemplateID string            `json:"template_id"`
	Data       map[string]string `json:"template_data"`
}

// ZNSResponse from Zalo API
type ZNSResponse struct {
	Error   int    `json:"error"`
	Message string `json:"message"`
	Data    struct {
		MsgID string `json:"msg_id"`
	} `json:"data"`
}

// SendZNS sends a ZNS notification message
func (a *ZaloAdapter) SendZNS(ctx context.Context, msg ZNSMessage) (*ZNSResponse, error) {
	if a.mockMode {
		return &ZNSResponse{
			Error:   0,
			Message: "Success",
			Data: struct {
				MsgID string `json:"msg_id"`
			}{
				MsgID: fmt.Sprintf("zns_msg_%d", time.Now().UnixNano()%1000000),
			},
		}, nil
	}

	payload := map[string]interface{}{
		"phone":         msg.Phone,
		"template_id":   msg.TemplateID,
		"template_data": msg.Data,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("marshal zns payload: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/message/template", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("access_token", a.accessToken)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("zalo request failed: %w", err)
	}
	defer resp.Body.Close()

	var result ZNSResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("parse zalo response: %w", err)
	}

	if result.Error != 0 {
		return &result, fmt.Errorf("ZALO_ZNS_ERROR_%d: %s", result.Error, result.Message)
	}

	a.log.Info(ctx, "zalo_zns_sent", logger.F("phone", msg.Phone), logger.F("msg_id", result.Data.MsgID))
	return &result, nil
}

// SendDeliveryConfirmation sends a delivery confirmation ZNS (BR-REC-02)
func (a *ZaloAdapter) SendDeliveryConfirmation(ctx context.Context, phone, orderNumber, customerName, totalAmount, confirmURL string) (*ZNSResponse, error) {
	return a.SendZNS(ctx, ZNSMessage{
		Phone:      phone,
		TemplateID: "delivery_confirmation",
		Data: map[string]string{
			"customer_name": customerName,
			"order_number":  orderNumber,
			"total_amount":  totalAmount,
			"confirm_url":   confirmURL,
		},
	})
}

// SendOrderConfirmation sends an order confirmation ZNS to customer after DVKH creates order
func (a *ZaloAdapter) SendOrderConfirmation(ctx context.Context, phone, orderNumber, customerName, totalAmount, deliveryDate, confirmURL string) (*ZNSResponse, error) {
	return a.SendZNS(ctx, ZNSMessage{
		Phone:      phone,
		TemplateID: "order_confirmation",
		Data: map[string]string{
			"customer_name": customerName,
			"order_number":  orderNumber,
			"total_amount":  totalAmount,
			"delivery_date": deliveryDate,
			"confirm_url":   confirmURL,
		},
	})
}
