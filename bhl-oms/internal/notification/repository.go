package notification

import (
	"context"
	"errors"
	"fmt"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Repository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRepository(db *pgxpool.Pool, log logger.Logger) *Repository {
	return &Repository{db: db, log: log}
}

func (r *Repository) Create(ctx context.Context, n *domain.Notification) error {
	return r.db.QueryRow(ctx, `
		INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, actions, group_key, idempotency_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		RETURNING id, created_at
	`, n.UserID, n.Title, n.Body, n.Category, n.Link, n.Priority, n.EntityType, n.EntityID, n.Actions, n.GroupKey, n.IdempotencyKey,
	).Scan(&n.ID, &n.CreatedAt)
}

// CreateWithIdempotency inserts a notification only if the idempotency_key is new for this user.
// Returns (true, nil) when inserted, (false, nil) when duplicate.
func (r *Repository) CreateWithIdempotency(ctx context.Context, n *domain.Notification) (bool, error) {
	err := r.db.QueryRow(ctx, `
		INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id, actions, group_key, idempotency_key)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (user_id, idempotency_key) WHERE idempotency_key IS NOT NULL
		DO NOTHING
		RETURNING id, created_at
	`, n.UserID, n.Title, n.Body, n.Category, n.Link, n.Priority, n.EntityType, n.EntityID, n.Actions, n.GroupKey, n.IdempotencyKey,
	).Scan(&n.ID, &n.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return false, nil // duplicate idempotency key — silent skip
		}
		return false, err
	}
	return true, nil
}

func (r *Repository) GetByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit int) ([]domain.Notification, error) {
	res, _, err := r.GetByUserPaginated(ctx, userID, unreadOnly, "", limit, 0)
	return res, err
}

// GetByUserPaginated returns a page of notifications + total count for the user.
func (r *Repository) GetByUserPaginated(ctx context.Context, userID uuid.UUID, unreadOnly bool, category string, limit, offset int) ([]domain.Notification, int64, error) {
	if limit <= 0 || limit > 500 {
		limit = 50
	}
	if offset < 0 {
		offset = 0
	}

	baseArgs := []interface{}{userID}
	where := "WHERE user_id = $1"
	argIdx := 2
	if unreadOnly {
		where += " AND is_read = false"
	}
	if category != "" {
		where += fmt.Sprintf(" AND category = $%d", argIdx)
		baseArgs = append(baseArgs, category)
		argIdx++
	}

	var total int64
	if err := r.db.QueryRow(ctx, "SELECT COUNT(*) FROM notifications "+where, baseArgs...).Scan(&total); err != nil {
		return nil, 0, err
	}

	queryArgs := append(baseArgs, limit, offset)
	query := `SELECT id, user_id, title, body, category, COALESCE(priority,'normal'), link, entity_type, entity_id, actions, group_key,
			is_read, is_acknowledged, acknowledged_at, resolved_at, expires_at, escalated_at, created_at
		FROM notifications ` + where + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", argIdx, argIdx+1)
	rows, err := r.db.Query(ctx, query, queryArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var results []domain.Notification
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Title, &n.Body, &n.Category, &n.Priority,
			&n.Link, &n.EntityType, &n.EntityID, &n.Actions, &n.GroupKey,
			&n.IsRead, &n.IsAcknowledged, &n.AcknowledgedAt, &n.ResolvedAt,
			&n.ExpiresAt, &n.EscalatedAt, &n.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		results = append(results, n)
	}
	return results, total, nil
}

func (r *Repository) getByUserUnused(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit int) ([]domain.Notification, error) {
	query := `SELECT id, user_id, title, body, category, COALESCE(priority,'normal'), link, entity_type, entity_id, actions, group_key,
			is_read, is_acknowledged, acknowledged_at, resolved_at, expires_at, escalated_at, created_at
		FROM notifications WHERE user_id = $1`
	args := []interface{}{userID}
	argIdx := 2

	if unreadOnly {
		query += fmt.Sprintf(" AND is_read = false")
	}
	query += " ORDER BY created_at DESC"
	query += fmt.Sprintf(" LIMIT $%d", argIdx)
	args = append(args, limit)

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.Notification
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Title, &n.Body, &n.Category, &n.Priority,
			&n.Link, &n.EntityType, &n.EntityID, &n.Actions, &n.GroupKey,
			&n.IsRead, &n.IsAcknowledged, &n.AcknowledgedAt, &n.ResolvedAt,
			&n.ExpiresAt, &n.EscalatedAt, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, n)
	}
	return results, nil
}

func (r *Repository) MarkRead(ctx context.Context, id, userID uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("notification not found")
	}
	return nil
}

func (r *Repository) MarkAllRead(ctx context.Context, userID uuid.UUID) (int64, error) {
	tag, err := r.db.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (r *Repository) UnreadCount(ctx context.Context, userID uuid.UUID) (int64, error) {
	var count int64
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`, userID,
	).Scan(&count)
	return count, err
}

// GetUserIDsByRole returns all user IDs with a given role.
func (r *Repository) GetUserIDsByRole(ctx context.Context, role string) ([]uuid.UUID, error) {
	rows, err := r.db.Query(ctx, `SELECT id FROM users WHERE role = $1 AND is_active = true`, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []uuid.UUID
	for rows.Next() {
		var id uuid.UUID
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// GetGrouped returns notifications grouped by group_key within the last 30 minutes.
func (r *Repository) GetGrouped(ctx context.Context, userID uuid.UUID, limit int) ([]domain.NotificationGroup, error) {
	query := `
		WITH grouped AS (
			SELECT
				COALESCE(group_key, id::text) as gk,
				COUNT(*) as cnt,
				MAX(created_at) as latest_at,
				(array_agg(title ORDER BY created_at DESC))[1] as latest_title,
				(array_agg(body ORDER BY created_at DESC))[1] as latest_body,
				(array_agg(category ORDER BY created_at DESC))[1] as cat,
				(array_agg(COALESCE(priority,'normal') ORDER BY created_at DESC))[1] as prio,
				(array_agg(entity_type ORDER BY created_at DESC))[1] as etype,
				BOOL_AND(is_read) as all_read
			FROM notifications
			WHERE user_id = $1
			GROUP BY gk
			ORDER BY latest_at DESC
			LIMIT $2
		)
		SELECT gk, cnt, latest_title, latest_body, cat, prio, etype, all_read, latest_at
		FROM grouped
	`
	rows, err := r.db.Query(ctx, query, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []domain.NotificationGroup
	for rows.Next() {
		var g domain.NotificationGroup
		if err := rows.Scan(&g.GroupKey, &g.Count, &g.LatestTitle, &g.LatestBody, &g.Category, &g.Priority, &g.EntityType, &g.IsRead, &g.LatestAt); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, nil
}

// GetByCategory returns notifications filtered by category.
func (r *Repository) GetByCategory(ctx context.Context, userID uuid.UUID, category string, limit int) ([]domain.Notification, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, title, body, category, COALESCE(priority,'normal'), link, entity_type, entity_id, actions, group_key,
			is_read, is_acknowledged, acknowledged_at, resolved_at, expires_at, escalated_at, created_at
		FROM notifications WHERE user_id = $1 AND category = $2
		ORDER BY created_at DESC LIMIT $3
	`, userID, category, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.Notification
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Title, &n.Body, &n.Category, &n.Priority,
			&n.Link, &n.EntityType, &n.EntityID, &n.Actions, &n.GroupKey,
			&n.IsRead, &n.IsAcknowledged, &n.AcknowledgedAt, &n.ResolvedAt,
			&n.ExpiresAt, &n.EscalatedAt, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, n)
	}
	return results, nil
}

// Acknowledge marks a notification as acknowledged (P0 action taken) and read.
func (r *Repository) Acknowledge(ctx context.Context, id, userID uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE notifications
		 SET is_acknowledged = TRUE, acknowledged_at = NOW(), is_read = TRUE
		 WHERE id = $1 AND user_id = $2`,
		id, userID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("notification not found")
	}
	return nil
}

// MarkResolvedByGroupKey marks all notifications in a group as resolved.
// Called when the underlying issue is fixed (e.g., GPS signal restored).
func (r *Repository) MarkResolvedByGroupKey(ctx context.Context, groupKey string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE notifications SET resolved_at = NOW()
		 WHERE group_key = $1 AND resolved_at IS NULL`,
		groupKey)
	return err
}

// GetUnacknowledgedUrgent returns urgent notifications not yet ACK'd, older than olderThan duration.
// Used by the escalation cron to find P0 events needing escalation.
func (r *Repository) GetUnacknowledgedUrgent(ctx context.Context, olderThan time.Duration) ([]domain.Notification, error) {
	cutoff := time.Now().Add(-olderThan)
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, title, body, category, COALESCE(priority,'normal'),
		       link, entity_type, entity_id, actions, group_key,
		       is_read, is_acknowledged, acknowledged_at, resolved_at,
		       expires_at, escalated_at, created_at
		FROM notifications
		WHERE priority = 'urgent'
		  AND is_acknowledged = FALSE
		  AND resolved_at IS NULL
		  AND escalated_at IS NULL
		  AND created_at < $1
		ORDER BY created_at ASC
		LIMIT 100
	`, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []domain.Notification
	for rows.Next() {
		var n domain.Notification
		if err := rows.Scan(
			&n.ID, &n.UserID, &n.Title, &n.Body, &n.Category, &n.Priority,
			&n.Link, &n.EntityType, &n.EntityID, &n.Actions, &n.GroupKey,
			&n.IsRead, &n.IsAcknowledged, &n.AcknowledgedAt, &n.ResolvedAt,
			&n.ExpiresAt, &n.EscalatedAt, &n.CreatedAt,
		); err != nil {
			return nil, err
		}
		results = append(results, n)
	}
	return results, nil
}

// MarkEscalated records that a notification has been escalated to another user.
func (r *Repository) MarkEscalated(ctx context.Context, id, escalatedToUserID uuid.UUID) error {
	_, err := r.db.Exec(ctx,
		`UPDATE notifications
		 SET escalated_at = NOW(), escalated_to_user_id = $2
		 WHERE id = $1`,
		id, escalatedToUserID)
	return err
}

// DeleteExpired removes notifications past their expiry date (retention policy).
func (r *Repository) DeleteExpired(ctx context.Context) (int64, error) {
	tag, err := r.db.Exec(ctx,
		`DELETE FROM notifications WHERE expires_at < NOW()`)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
