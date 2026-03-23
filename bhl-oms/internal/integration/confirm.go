package integration

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ConfirmService manages Zalo delivery confirmations (Tasks 3.6, 3.7)
type ConfirmService struct {
	db   *pgxpool.Pool
	zalo *ZaloAdapter
	log  logger.Logger
}

func NewConfirmService(db *pgxpool.Pool, zalo *ZaloAdapter, log logger.Logger) *ConfirmService {
	return &ConfirmService{db: db, zalo: zalo, log: log}
}

// generateToken creates a secure random token for confirmation URL
func generateToken() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return hex.EncodeToString([]byte(time.Now().String()))
	}
	return hex.EncodeToString(b)
}

// SendConfirmation creates a confirmation record and sends ZNS (Task 3.6)
func (s *ConfirmService) SendConfirmation(ctx context.Context, orderID, customerID uuid.UUID, stopID *uuid.UUID, phone string, totalAmount float64, orderNumber, customerName, baseURL string) (*domain.ZaloConfirmation, error) {
	token := generateToken()
	confirmURL := fmt.Sprintf("%s/confirm/%s", baseURL, token)

	var zaloMsgID *string
	result, err := s.zalo.SendDeliveryConfirmation(ctx, phone, orderNumber, customerName,
		fmt.Sprintf("%.0f", totalAmount), confirmURL)
	if err != nil {
		s.log.Error(ctx, "integration_call_failed", err,
			logger.F("target", "zalo"), logger.F("op", "SendDeliveryConfirmation"),
			logger.F("order_number", orderNumber),
		)
	} else if result != nil {
		zaloMsgID = &result.Data.MsgID
	}

	var confirm domain.ZaloConfirmation
	err = s.db.QueryRow(ctx, `
		INSERT INTO zalo_confirmations (order_id, customer_id, trip_stop_id, token, phone, total_amount, zalo_msg_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, order_id, customer_id, trip_stop_id, token, phone, status::text, total_amount, zalo_msg_id, sent_at, created_at, updated_at
	`, orderID, customerID, stopID, token, phone, totalAmount, zaloMsgID).Scan(
		&confirm.ID, &confirm.OrderID, &confirm.CustomerID, &confirm.TripStopID,
		&confirm.Token, &confirm.Phone, &confirm.Status, &confirm.TotalAmount, &confirm.ZaloMsgID,
		&confirm.SentAt, &confirm.CreatedAt, &confirm.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create zalo confirmation: %w", err)
	}

	return &confirm, nil
}

// GetByToken looks up a confirmation by its public token (NPP portal)
func (s *ConfirmService) GetByToken(ctx context.Context, token string) (*domain.ZaloConfirmation, error) {
	var c domain.ZaloConfirmation
	err := s.db.QueryRow(ctx, `
		SELECT id, order_id, customer_id, trip_stop_id, token, phone, status::text, total_amount,
			zalo_msg_id, sent_at, confirmed_at, disputed_at, dispute_reason, auto_confirmed_at,
			created_at, updated_at
		FROM zalo_confirmations WHERE token = $1
	`, token).Scan(
		&c.ID, &c.OrderID, &c.CustomerID, &c.TripStopID, &c.Token, &c.Phone, &c.Status,
		&c.TotalAmount, &c.ZaloMsgID, &c.SentAt, &c.ConfirmedAt, &c.DisputedAt,
		&c.DisputeReason, &c.AutoConfirmedAt, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("confirmation not found: %w", err)
	}
	return &c, nil
}

// ConfirmDelivery marks confirmation as confirmed by NPP (SM-06: sent → confirmed)
func (s *ConfirmService) ConfirmDelivery(ctx context.Context, token string) error {
	result, err := s.db.Exec(ctx, `
		UPDATE zalo_confirmations
		SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
		WHERE token = $1 AND status = 'sent'
	`, token)
	if err != nil {
		return fmt.Errorf("confirm delivery: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("confirmation already processed or not found")
	}
	return nil
}

// DisputeDelivery marks confirmation as disputed by NPP (SM-06: sent → disputed)
func (s *ConfirmService) DisputeDelivery(ctx context.Context, token, reason string) error {
	result, err := s.db.Exec(ctx, `
		UPDATE zalo_confirmations
		SET status = 'disputed', disputed_at = NOW(), dispute_reason = $2, updated_at = NOW()
		WHERE token = $1 AND status = 'sent'
	`, token, reason)
	if err != nil {
		return fmt.Errorf("dispute delivery: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("confirmation already processed or not found")
	}
	return nil
}

// GetDeliveryOrderInfo returns order_number and customer_name for a delivery confirmation token.
func (s *ConfirmService) GetDeliveryOrderInfo(ctx context.Context, token string) (orderNumber, customerName string, err error) {
	err = s.db.QueryRow(ctx, `
		SELECT so.order_number, c.name
		FROM zalo_confirmations zc
		JOIN sales_orders so ON so.id = zc.order_id
		JOIN customers c ON c.id = zc.customer_id
		WHERE zc.token = $1
	`, token).Scan(&orderNumber, &customerName)
	return
}

// AutoConfirmExpired auto-confirms all sent confirmations older than 24h (Task 3.7, BR-REC-02)
func (s *ConfirmService) AutoConfirmExpired(ctx context.Context) (int64, error) {
	result, err := s.db.Exec(ctx, `
		UPDATE zalo_confirmations
		SET status = 'auto_confirmed', auto_confirmed_at = NOW(), updated_at = NOW()
		WHERE status = 'sent' AND sent_at < NOW() - INTERVAL '24 hours'
	`)
	if err != nil {
		return 0, fmt.Errorf("auto-confirm expired: %w", err)
	}
	count := result.RowsAffected()
	if count > 0 {
		s.log.Info(ctx, "auto_confirm_expired", logger.F("count", count))
	}
	return count, nil
}

// RunAutoConfirmCron runs the auto-confirm job periodically (Task 3.7)
func (s *ConfirmService) RunAutoConfirmCron(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	s.log.Info(ctx, "cron_started", logger.F("cron", "auto_confirm"))
	for {
		select {
		case <-ctx.Done():
			s.log.Info(ctx, "cron_stopped", logger.F("cron", "auto_confirm"))
			return
		case <-ticker.C:
			count, err := s.AutoConfirmExpired(ctx)
			if err != nil {
				s.log.Error(ctx, "cron_error", err, logger.F("cron", "auto_confirm"))
			} else if count > 0 {
				s.log.Info(ctx, "cron_processed", logger.F("cron", "auto_confirm"), logger.F("count", count))
			}
		}
	}
}

// ===== ORDER CONFIRMATION (post-order creation, 2h timeout) =====

// SendOrderConfirmation creates an order confirmation record and sends ZNS to customer
func (s *ConfirmService) SendOrderConfirmation(ctx context.Context, orderID, customerID uuid.UUID, phone string, totalAmount float64, orderNumber, customerName, deliveryDate, baseURL string) (*domain.OrderConfirmation, error) {
	token := generateToken()
	confirmURL := fmt.Sprintf("%s/v1/order-confirm/%s", baseURL, token)
	pdfURL := fmt.Sprintf("%s/v1/order-confirm/%s/pdf", baseURL, token)

	var zaloMsgID *string
	result, err := s.zalo.SendOrderConfirmation(ctx, phone, orderNumber, customerName,
		fmt.Sprintf("%.0f", totalAmount), deliveryDate, confirmURL)
	if err != nil {
		s.log.Error(ctx, "integration_call_failed", err,
			logger.F("target", "zalo"), logger.F("op", "SendOrderConfirmation"),
			logger.F("order_number", orderNumber),
		)
	} else if result != nil {
		zaloMsgID = &result.Data.MsgID
	}

	var confirm domain.OrderConfirmation
	err = s.db.QueryRow(ctx, `
		INSERT INTO order_confirmations (order_id, customer_id, token, phone, total_amount, zalo_msg_id, pdf_url)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, order_id, customer_id, token, phone, status, total_amount, zalo_msg_id, pdf_url,
			sent_at, confirmed_at, rejected_at, reject_reason, auto_confirmed_at, expires_at, created_at, updated_at
	`, orderID, customerID, token, phone, totalAmount, zaloMsgID, pdfURL).Scan(
		&confirm.ID, &confirm.OrderID, &confirm.CustomerID, &confirm.Token, &confirm.Phone,
		&confirm.Status, &confirm.TotalAmount, &confirm.ZaloMsgID, &confirm.PDFURL,
		&confirm.SentAt, &confirm.ConfirmedAt, &confirm.RejectedAt, &confirm.RejectReason,
		&confirm.AutoConfirmedAt, &confirm.ExpiresAt, &confirm.CreatedAt, &confirm.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("create order confirmation: %w", err)
	}

	s.log.Info(ctx, "order_confirmation_sent",
		logger.F("order_number", orderNumber), logger.F("phone", phone),
		logger.F("token", confirm.Token), logger.F("expires_at", confirm.ExpiresAt.Format(time.RFC3339)),
	)

	return &confirm, nil
}

// GetOrderConfirmByToken looks up an order confirmation by its public token
func (s *ConfirmService) GetOrderConfirmByToken(ctx context.Context, token string) (*domain.OrderConfirmation, error) {
	var c domain.OrderConfirmation
	err := s.db.QueryRow(ctx, `
		SELECT oc.id, oc.order_id, so.order_number, oc.customer_id, cust.name,
			oc.token, oc.phone, oc.status, oc.total_amount,
			oc.zalo_msg_id, oc.pdf_url, oc.sent_at, oc.confirmed_at, oc.rejected_at, oc.reject_reason,
			oc.auto_confirmed_at, oc.expires_at, oc.created_at, oc.updated_at
		FROM order_confirmations oc
		JOIN sales_orders so ON so.id = oc.order_id
		JOIN customers cust ON cust.id = oc.customer_id
		WHERE oc.token = $1
	`, token).Scan(
		&c.ID, &c.OrderID, &c.OrderNumber, &c.CustomerID, &c.CustomerName,
		&c.Token, &c.Phone, &c.Status, &c.TotalAmount,
		&c.ZaloMsgID, &c.PDFURL, &c.SentAt, &c.ConfirmedAt, &c.RejectedAt,
		&c.RejectReason, &c.AutoConfirmedAt, &c.ExpiresAt, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("order confirmation not found: %w", err)
	}
	return &c, nil
}

// ConfirmOrder marks order confirmation as confirmed by customer (sent -> confirmed)
func (s *ConfirmService) ConfirmOrder(ctx context.Context, token string) error {
	result, err := s.db.Exec(ctx, `
		UPDATE order_confirmations
		SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
		WHERE token = $1 AND status = 'sent'
	`, token)
	if err != nil {
		return fmt.Errorf("confirm order: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("xác nhận đã được xử lý hoặc không tìm thấy")
	}
	return nil
}

// RejectOrder marks order confirmation as rejected by customer (sent -> rejected)
func (s *ConfirmService) RejectOrder(ctx context.Context, token, reason string) error {
	result, err := s.db.Exec(ctx, `
		UPDATE order_confirmations
		SET status = 'rejected', rejected_at = NOW(), reject_reason = $2, updated_at = NOW()
		WHERE token = $1 AND status = 'sent'
	`, token, reason)
	if err != nil {
		return fmt.Errorf("reject order: %w", err)
	}
	if result.RowsAffected() == 0 {
		return fmt.Errorf("xác nhận đã được xử lý hoặc không tìm thấy")
	}
	return nil
}

// AutoConfirmExpiredOrders auto-confirms all order confirmations past 2h deadline
func (s *ConfirmService) AutoConfirmExpiredOrders(ctx context.Context) (int64, error) {
	result, err := s.db.Exec(ctx, `
		UPDATE order_confirmations
		SET status = 'auto_confirmed', auto_confirmed_at = NOW(), updated_at = NOW()
		WHERE status = 'sent' AND expires_at < NOW()
	`)
	if err != nil {
		return 0, fmt.Errorf("auto-confirm expired orders: %w", err)
	}
	count := result.RowsAffected()
	return count, nil
}

// GetPendingOrderConfirmationIDs returns order_ids for confirmed records that need order status update
func (s *ConfirmService) GetPendingOrderConfirmationIDs(ctx context.Context) ([]uuid.UUID, error) {
	rows, err := s.db.Query(ctx, `
		SELECT oc.order_id FROM order_confirmations oc
		JOIN sales_orders so ON so.id = oc.order_id
		WHERE oc.status IN ('confirmed', 'auto_confirmed')
			AND so.status = 'pending_customer_confirm'
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			continue
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// RunOrderAutoConfirmCron runs the 2h auto-confirm job every 5 minutes
func (s *ConfirmService) RunOrderAutoConfirmCron(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	s.log.Info(ctx, "cron_started", logger.F("cron", "order_auto_confirm"))
	for {
		select {
		case <-ctx.Done():
			s.log.Info(ctx, "cron_stopped", logger.F("cron", "order_auto_confirm"))
			return
		case <-ticker.C:
			count, err := s.AutoConfirmExpiredOrders(ctx)
			if err != nil {
				s.log.Error(ctx, "cron_error", err, logger.F("cron", "order_auto_confirm"))
			} else if count > 0 {
				s.log.Info(ctx, "cron_processed", logger.F("cron", "order_auto_confirm"), logger.F("count", count))
			}
		}
	}
}
