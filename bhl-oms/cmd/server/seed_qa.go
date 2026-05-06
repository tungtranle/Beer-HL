package main

import (
	"context"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// seedQAUser seeds system QA user if not exists (for test portal)
func seedQAUser(ctx context.Context, pool *pgxpool.Pool, log logger.Logger) error {
	qaUserID := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	log.Info(ctx, "qa_seeding_start", logger.F("user_id", qaUserID.String()))

	res, err := pool.Exec(ctx, `
		INSERT INTO users (id, created_at, updated_at, full_name, email, username, password_hash, role, is_active)
		VALUES ($1, NOW(), NOW(), 'System QA', 'qa@bhl.local', 'qa-system', 'SYSTEM_QA_NO_LOGIN', 'management', true)
		ON CONFLICT (id) DO NOTHING
	`, qaUserID)
	if err != nil {
		log.Warn(ctx, "qa_seeding_failed", logger.F("error", err.Error()))
		return err
	}
	rows := res.RowsAffected()
	log.Info(ctx, "qa_seeding_done", logger.F("rows_affected", rows))
	return nil
}
