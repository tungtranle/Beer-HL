package integration

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
	"time"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ConfirmService manages Zalo delivery confirmations (Tasks 3.6, 3.7)
type ConfirmService struct {
	db   *pgxpool.Pool
	zalo *ZaloAdapter
}

func NewConfirmService(db *pgxpool.Pool, zalo *ZaloAdapter) *ConfirmService {
	return &ConfirmService{db: db, zalo: zalo}
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
		log.Printf("[Confirm] Zalo send failed: %v", err)
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
		log.Printf("[AutoConfirm] Auto-confirmed %d expired confirmations", count)
	}
	return count, nil
}

// RunAutoConfirmCron runs the auto-confirm job periodically (Task 3.7)
func (s *ConfirmService) RunAutoConfirmCron(ctx context.Context) {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	log.Println("[AutoConfirm] Cron started (every 1 hour)")
	for {
		select {
		case <-ctx.Done():
			log.Println("[AutoConfirm] Cron stopped")
			return
		case <-ticker.C:
			count, err := s.AutoConfirmExpired(ctx)
			if err != nil {
				log.Printf("[AutoConfirm] Error: %v", err)
			} else if count > 0 {
				log.Printf("[AutoConfirm] Processed %d auto-confirmations", count)
			}
		}
	}
}
