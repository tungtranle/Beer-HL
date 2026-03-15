package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// BravoAdapter pushes delivery documents and reconciles credit with Bravo ERP.
type BravoAdapter struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
	mockMode   bool
}

func NewBravoAdapter(baseURL, apiKey string, mockMode bool) *BravoAdapter {
	return &BravoAdapter{
		baseURL:    baseURL,
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 30 * time.Second},
		mockMode:   mockMode,
	}
}

// DeliveryDocument represents a delivery document for Bravo
type DeliveryDocument struct {
	OrderNumber    string  `json:"order_number"`
	CustomerCode   string  `json:"customer_code"`
	DeliveryDate   string  `json:"delivery_date"`
	TotalAmount    float64 `json:"total_amount"`
	DepositAmount  float64 `json:"deposit_amount"`
	PaymentMethod  string  `json:"payment_method"`
	DriverName     string  `json:"driver_name"`
	VehiclePlate   string  `json:"vehicle_plate"`
	Items          []DeliveryDocItem `json:"items"`
}

type DeliveryDocItem struct {
	ProductSKU  string  `json:"product_sku"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	UnitPrice   float64 `json:"unit_price"`
	Amount      float64 `json:"amount"`
}

// BravoDocumentResponse is the response from Bravo when pushing a document
type BravoDocumentResponse struct {
	Status        string `json:"status"`
	DocumentID    string `json:"document_id"`
	PostedAt      string `json:"posted_at"`
	VoucherNumber string `json:"voucher_number"`
	Code          string `json:"code,omitempty"`
}

// PushDeliveryDocument sends a delivery document to Bravo ERP (Task 3.1)
func (a *BravoAdapter) PushDeliveryDocument(ctx context.Context, doc DeliveryDocument) (*BravoDocumentResponse, error) {
	if a.mockMode {
		return &BravoDocumentResponse{
			Status:        "success",
			DocumentID:    fmt.Sprintf("PHGIANG-2026-%06d", time.Now().UnixNano()%1000000),
			PostedAt:      time.Now().Format(time.RFC3339),
			VoucherNumber: fmt.Sprintf("PGH%s01", time.Now().Format("20060102")),
		}, nil
	}

	body, err := json.Marshal(doc)
	if err != nil {
		return nil, fmt.Errorf("marshal delivery doc: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, a.baseURL+"/api/documents/delivery", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+a.apiKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bravo request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read bravo response: %w", err)
	}

	var result BravoDocumentResponse
	if err := json.Unmarshal(respBody, &result); err != nil {
		return nil, fmt.Errorf("parse bravo response: %w", err)
	}

	if resp.StatusCode == http.StatusConflict {
		return &result, fmt.Errorf("BRAVO_DUPLICATE_DOCUMENT: %s", result.DocumentID)
	}
	if resp.StatusCode != http.StatusOK {
		return &result, fmt.Errorf("bravo error %d: %s", resp.StatusCode, result.Code)
	}

	return &result, nil
}

// CreditBalance represents credit balance from Bravo
type CreditBalance struct {
	CustomerCode string  `json:"customer_code"`
	Balance      float64 `json:"balance"`
	LastPayment  string  `json:"last_payment"`
}

// GetCreditBalances fetches credit balances from Bravo for reconciliation (Task 3.2)
func (a *BravoAdapter) GetCreditBalances(ctx context.Context, customerCodes []string) ([]CreditBalance, error) {
	if a.mockMode {
		results := make([]CreditBalance, len(customerCodes))
		for i, code := range customerCodes {
			results[i] = CreditBalance{
				CustomerCode: code,
				Balance:      178750000,
				LastPayment:  time.Now().AddDate(0, 0, -1).Format("2006-01-02"),
			}
		}
		return results, nil
	}

	params := ""
	for i, code := range customerCodes {
		if i > 0 {
			params += ","
		}
		params += code
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, a.baseURL+"/api/credit-balance?customer_codes="+params, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+a.apiKey)

	resp, err := a.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("bravo credit request failed: %w", err)
	}
	defer resp.Body.Close()

	var result struct {
		Status string          `json:"status"`
		Data   []CreditBalance `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("parse credit response: %w", err)
	}

	return result.Data, nil
}

// NightlyReconcile performs credit balance reconciliation (Task 3.2)
func (a *BravoAdapter) NightlyReconcile(ctx context.Context, customerCodes []string) ([]CreditDiscrepancy, error) {
	balances, err := a.GetCreditBalances(ctx, customerCodes)
	if err != nil {
		return nil, fmt.Errorf("fetch bravo balances: %w", err)
	}

	var discrepancies []CreditDiscrepancy
	for _, bal := range balances {
		// In real implementation, compare with local ledger
		discrepancies = append(discrepancies, CreditDiscrepancy{
			CustomerCode:  bal.CustomerCode,
			BravoBalance:  bal.Balance,
			LocalBalance:  0, // Will be filled from local DB
			Difference:    0,
			LastPayment:   bal.LastPayment,
			ReconcileDate: time.Now().Format("2006-01-02"),
		})
	}

	log.Printf("[Bravo] Nightly reconcile: %d customers checked, %d discrepancies", len(customerCodes), len(discrepancies))
	return discrepancies, nil
}

// CreditDiscrepancy represents a mismatch between Bravo and local balances
type CreditDiscrepancy struct {
	CustomerCode  string  `json:"customer_code"`
	BravoBalance  float64 `json:"bravo_balance"`
	LocalBalance  float64 `json:"local_balance"`
	Difference    float64 `json:"difference"`
	LastPayment   string  `json:"last_payment"`
	ReconcileDate string  `json:"reconcile_date"`
}

// BravoWebhookPayload represents an incoming webhook from Bravo (Task 3.3)
type BravoWebhookPayload struct {
	Event      string `json:"event"`
	DocumentID string `json:"document_id"`
	Status     string `json:"status"`
	Amount     float64 `json:"amount"`
	PostedAt   string `json:"posted_at"`
}

// HandleWebhook processes incoming Bravo webhooks
func (a *BravoAdapter) HandleWebhook(payload BravoWebhookPayload) error {
	switch payload.Event {
	case "document_posted":
		log.Printf("[Bravo] Document posted: %s, amount: %.0f", payload.DocumentID, payload.Amount)
		return nil
	case "payment_received":
		log.Printf("[Bravo] Payment received for doc: %s, amount: %.0f", payload.DocumentID, payload.Amount)
		return nil
	default:
		log.Printf("[Bravo] Unknown webhook event: %s", payload.Event)
		return nil
	}
}
