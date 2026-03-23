package notification

import (
	"context"
	"fmt"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
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
		INSERT INTO notifications (user_id, title, body, category, link, priority, entity_type, entity_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`, n.UserID, n.Title, n.Body, n.Category, n.Link, n.Priority, n.EntityType, n.EntityID,
	).Scan(&n.ID, &n.CreatedAt)
}

func (r *Repository) GetByUser(ctx context.Context, userID uuid.UUID, unreadOnly bool, limit int) ([]domain.Notification, error) {
	query := `SELECT id, user_id, title, body, category, COALESCE(priority,'normal'), link, entity_type, entity_id, is_read, created_at
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
		if err := rows.Scan(&n.ID, &n.UserID, &n.Title, &n.Body, &n.Category, &n.Priority, &n.Link, &n.EntityType, &n.EntityID, &n.IsRead, &n.CreatedAt); err != nil {
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
