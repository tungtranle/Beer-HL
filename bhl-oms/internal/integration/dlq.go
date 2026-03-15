package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DLQService manages the Integration Dead Letter Queue.
type DLQService struct {
	db *pgxpool.Pool
}

func NewDLQService(db *pgxpool.Pool) *DLQService {
	return &DLQService{db: db}
}

// Record stores a failed integration call in the DLQ.
func (d *DLQService) Record(ctx context.Context, adapter, operation string, payload interface{}, errMsg string, refType *string, refID *uuid.UUID) {
	payloadJSON, _ := json.Marshal(payload)
	_, err := d.db.Exec(ctx, `
		INSERT INTO integration_dlq (adapter, operation, payload, error_message, reference_type, reference_id, next_retry_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, adapter, operation, payloadJSON, errMsg, refType, refID, time.Now().Add(5*time.Minute))
	if err != nil {
		log.Printf("[DLQ] Failed to record DLQ entry: %v", err)
	}
}

// List returns DLQ entries filtered by status and adapter.
func (d *DLQService) List(ctx context.Context, status, adapter string, page, limit int) ([]domain.DLQEntry, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit

	// Count
	countSQL := `SELECT COUNT(*) FROM integration_dlq WHERE 1=1`
	args := []interface{}{}
	argN := 1

	if status != "" {
		countSQL += ` AND status::text = $` + itoa(argN)
		args = append(args, status)
		argN++
	}
	if adapter != "" {
		countSQL += ` AND adapter = $` + itoa(argN)
		args = append(args, adapter)
		argN++
	}

	var total int64
	if err := d.db.QueryRow(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Query
	querySQL := `
		SELECT id, adapter, operation, payload, error_message, retry_count, max_retries,
			status::text, reference_type, reference_id, resolved_at, next_retry_at,
			created_at, updated_at
		FROM integration_dlq WHERE 1=1`

	qArgs := []interface{}{}
	qN := 1
	if status != "" {
		querySQL += ` AND status::text = $` + itoa(qN)
		qArgs = append(qArgs, status)
		qN++
	}
	if adapter != "" {
		querySQL += ` AND adapter = $` + itoa(qN)
		qArgs = append(qArgs, adapter)
		qN++
	}

	querySQL += ` ORDER BY created_at DESC LIMIT $` + itoa(qN) + ` OFFSET $` + itoa(qN+1)
	qArgs = append(qArgs, limit, offset)

	rows, err := d.db.Query(ctx, querySQL, qArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var entries []domain.DLQEntry
	for rows.Next() {
		var e domain.DLQEntry
		if err := rows.Scan(&e.ID, &e.Adapter, &e.Operation, &e.Payload, &e.ErrorMessage,
			&e.RetryCount, &e.MaxRetries, &e.Status, &e.RefType, &e.RefID,
			&e.ResolvedAt, &e.NextRetryAt, &e.CreatedAt, &e.UpdatedAt); err != nil {
			continue
		}
		entries = append(entries, e)
	}
	return entries, total, nil
}

// Retry marks a DLQ entry for retry.
func (d *DLQService) Retry(ctx context.Context, id uuid.UUID) error {
	_, err := d.db.Exec(ctx, `
		UPDATE integration_dlq
		SET status = 'retrying', retry_count = retry_count + 1,
			next_retry_at = $2, updated_at = NOW()
		WHERE id = $1 AND status IN ('pending', 'failed')
	`, id, time.Now().Add(1*time.Minute))
	return err
}

// Resolve marks a DLQ entry as resolved.
func (d *DLQService) Resolve(ctx context.Context, id uuid.UUID) error {
	_, err := d.db.Exec(ctx, `
		UPDATE integration_dlq
		SET status = 'resolved', resolved_at = NOW(), updated_at = NOW()
		WHERE id = $1
	`, id)
	return err
}

// Stats returns summary counts by adapter and status.
func (d *DLQService) Stats(ctx context.Context) (map[string]interface{}, error) {
	rows, err := d.db.Query(ctx, `
		SELECT adapter, status::text, COUNT(*)
		FROM integration_dlq
		GROUP BY adapter, status
		ORDER BY adapter, status
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byAdapter := map[string]map[string]int64{}
	var totalPending, totalFailed int64
	for rows.Next() {
		var adapter, status string
		var count int64
		if err := rows.Scan(&adapter, &status, &count); err != nil {
			continue
		}
		if byAdapter[adapter] == nil {
			byAdapter[adapter] = map[string]int64{}
		}
		byAdapter[adapter][status] = count
		if status == "pending" || status == "retrying" {
			totalPending += count
		}
		if status == "failed" {
			totalFailed += count
		}
	}

	return map[string]interface{}{
		"by_adapter":    byAdapter,
		"total_pending": totalPending,
		"total_failed":  totalFailed,
	}, nil
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}
