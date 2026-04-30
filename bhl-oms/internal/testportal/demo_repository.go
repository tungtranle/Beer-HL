package testportal

import (
	"context"
	"fmt"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type DemoRepository struct {
	db  *pgxpool.Pool
	log logger.Logger
}

type DemoOwnedEntity struct {
	RunID      uuid.UUID `json:"run_id"`
	EntityType string    `json:"entity_type"`
	EntityID   uuid.UUID `json:"entity_id"`
}

type DemoRunRecord struct {
	ID                    uuid.UUID  `json:"id"`
	ScenarioID            string     `json:"scenario_id"`
	ScenarioTitle         string     `json:"scenario_title"`
	Status                string     `json:"status"`
	CleanupDeletedCount   int        `json:"cleanup_deleted_count"`
	CreatedCount          int        `json:"created_count"`
	HistoricalRowsTouched int        `json:"historical_rows_touched"`
	ErrorMessage          *string    `json:"error_message,omitempty"`
	StartedAt             time.Time  `json:"started_at"`
	CompletedAt           *time.Time `json:"completed_at,omitempty"`
	CleanedAt             *time.Time `json:"cleaned_at,omitempty"`
	CreatedByName         *string    `json:"created_by_name,omitempty"`
}

func NewDemoRepository(db *pgxpool.Pool, log logger.Logger) *DemoRepository {
	return &DemoRepository{db: db, log: log}
}

func (r *DemoRepository) Begin(ctx context.Context) (pgx.Tx, error) {
	return r.db.Begin(ctx)
}

func (r *DemoRepository) CreateRun(ctx context.Context, tx pgx.Tx, scenario DemoScenario, actor DemoActor) (uuid.UUID, error) {
	var runID uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO qa_scenario_runs (scenario_id, scenario_title, status, created_by, created_by_name)
		VALUES ($1, $2, 'running', $3, $4)
		RETURNING id
	`, scenario.ID, scenario.Title, actor.UserID, actor.FullName).Scan(&runID)
	if err != nil {
		return uuid.Nil, fmt.Errorf("create qa run: %w", err)
	}
	return runID, nil
}

func (r *DemoRepository) RecordEntity(ctx context.Context, tx pgx.Tx, runID uuid.UUID, entityType string, entityID uuid.UUID) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO qa_owned_entities (run_id, entity_type, entity_id)
		VALUES ($1, $2, $3)
		ON CONFLICT DO NOTHING
	`, runID, entityType, entityID)
	if err != nil {
		return fmt.Errorf("record qa entity %s/%s: %w", entityType, entityID, err)
	}
	return nil
}

func (r *DemoRepository) ListOwnedForScenario(ctx context.Context, tx pgx.Tx, scenarioID string) ([]DemoOwnedEntity, []uuid.UUID, error) {
	rows, err := tx.Query(ctx, `
		SELECT oe.run_id, oe.entity_type, oe.entity_id
		FROM qa_owned_entities oe
		JOIN qa_scenario_runs sr ON sr.id = oe.run_id
		WHERE sr.scenario_id = $1 AND sr.status IN ('completed', 'failed', 'cleaned')
		ORDER BY oe.created_at DESC
	`, scenarioID)
	if err != nil {
		return nil, nil, fmt.Errorf("list owned entities: %w", err)
	}
	defer rows.Close()

	entities := []DemoOwnedEntity{}
	runSeen := map[uuid.UUID]bool{}
	runIDs := []uuid.UUID{}
	for rows.Next() {
		var entity DemoOwnedEntity
		if err := rows.Scan(&entity.RunID, &entity.EntityType, &entity.EntityID); err != nil {
			return nil, nil, fmt.Errorf("scan owned entity: %w", err)
		}
		entities = append(entities, entity)
		if !runSeen[entity.RunID] {
			runSeen[entity.RunID] = true
			runIDs = append(runIDs, entity.RunID)
		}
	}
	return entities, runIDs, rows.Err()
}

// ListOwnedForAllScenarios returns all owned entities across all completed/failed/cleaned scenario runs.
// Used for full cleanup operations (CleanAllDemoData).
func (r *DemoRepository) ListOwnedForAllScenarios(ctx context.Context, tx pgx.Tx) ([]DemoOwnedEntity, []uuid.UUID, error) {
	rows, err := tx.Query(ctx, `
		SELECT oe.run_id, oe.entity_type, oe.entity_id
		FROM qa_owned_entities oe
		JOIN qa_scenario_runs sr ON sr.id = oe.run_id
		WHERE sr.status IN ('completed', 'failed', 'cleaned')
		ORDER BY oe.created_at DESC
	`)
	if err != nil {
		return nil, nil, fmt.Errorf("list all owned entities: %w", err)
	}
	defer rows.Close()

	entities := []DemoOwnedEntity{}
	runSeen := map[uuid.UUID]bool{}
	runIDs := []uuid.UUID{}
	for rows.Next() {
		var entity DemoOwnedEntity
		if err := rows.Scan(&entity.RunID, &entity.EntityType, &entity.EntityID); err != nil {
			return nil, nil, fmt.Errorf("scan owned entity: %w", err)
		}
		entities = append(entities, entity)
		if !runSeen[entity.RunID] {
			runSeen[entity.RunID] = true
			runIDs = append(runIDs, entity.RunID)
		}
	}
	return entities, runIDs, rows.Err()
}

func (r *DemoRepository) DeleteOwnedEntities(ctx context.Context, tx pgx.Tx, entities []DemoOwnedEntity) (int, error) {
	deleteSQL := map[string]string{
		"driver_checkins":       `DELETE FROM driver_checkins WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"vehicles":              `UPDATE vehicles SET status = 'inactive' WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"ai_feedback":           `DELETE FROM ai_feedback WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"ai_audit_log":          `DELETE FROM ai_audit_log WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"ai_inbox_items":        `DELETE FROM ai_inbox_items WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"ai_simulations":        `DELETE FROM ai_simulations WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"gate_checks":           `DELETE FROM gate_checks WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"trip_stops":            `DELETE FROM trip_stops WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"trips":                 `DELETE FROM trips WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"shipments":             `DELETE FROM shipments WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"order_confirmations":   `DELETE FROM order_confirmations WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"entity_events":         `DELETE FROM entity_events WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"order_notes":           `DELETE FROM order_notes WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"receivable_ledger":     `DELETE FROM receivable_ledger WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"order_items":           `DELETE FROM order_items WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"sales_orders":          `DELETE FROM sales_orders WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"stock_moves":           `DELETE FROM stock_moves WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"stock_quants":          `DELETE FROM stock_quants WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"lots":                  `DELETE FROM lots WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"daily_kpi_snapshots":   `DELETE FROM daily_kpi_snapshots WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"integration_dlq":       `DELETE FROM integration_dlq WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"notifications":         `DELETE FROM notifications WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"discrepancies":         `DELETE FROM discrepancies WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"reconciliations":       `DELETE FROM reconciliations WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
		"daily_close_summaries": `DELETE FROM daily_close_summaries WHERE id = $1 AND EXISTS (SELECT 1 FROM qa_owned_entities WHERE run_id = $2 AND entity_type = $3 AND entity_id = $1)`,
	}

	deleteOrder := []string{
		"driver_checkins",
		"ai_feedback", "ai_audit_log", "ai_inbox_items", "ai_simulations",
		"gate_checks", "trip_stops", "trips", "vehicles", "shipments", "order_confirmations",
		"entity_events", "order_notes", "receivable_ledger", "order_items", "sales_orders",
		"stock_moves", "stock_quants", "lots", "daily_kpi_snapshots", "integration_dlq",
		"notifications", "discrepancies", "reconciliations", "daily_close_summaries",
	}

	byType := map[string][]DemoOwnedEntity{}
	for _, entity := range entities {
		if _, ok := deleteSQL[entity.EntityType]; ok {
			byType[entity.EntityType] = append(byType[entity.EntityType], entity)
		}
	}

	deleted := 0
	for _, entityType := range deleteOrder {
		stmt, ok := deleteSQL[entityType]
		if !ok {
			continue
		}
		for _, entity := range byType[entityType] {
			cmd, err := tx.Exec(ctx, stmt, entity.EntityID, entity.RunID, entity.EntityType)
			if err != nil {
				return deleted, fmt.Errorf("delete owned %s/%s: %w", entityType, entity.EntityID, err)
			}
			deleted += int(cmd.RowsAffected())
		}
	}
	return deleted, nil
}

func (r *DemoRepository) MarkRunsCleaned(ctx context.Context, tx pgx.Tx, runIDs []uuid.UUID) error {
	for _, runID := range runIDs {
		if _, err := tx.Exec(ctx, `UPDATE qa_scenario_runs SET status = 'cleaned', cleaned_at = now() WHERE id = $1`, runID); err != nil {
			return fmt.Errorf("mark qa run cleaned: %w", err)
		}
	}
	return nil
}

func (r *DemoRepository) RemoveOwnedRegistry(ctx context.Context, tx pgx.Tx, runIDs []uuid.UUID) error {
	for _, runID := range runIDs {
		if _, err := tx.Exec(ctx, `DELETE FROM qa_owned_entities WHERE run_id = $1`, runID); err != nil {
			return fmt.Errorf("remove qa ownership registry: %w", err)
		}
	}
	return nil
}

func (r *DemoRepository) CompleteRun(ctx context.Context, tx pgx.Tx, runID uuid.UUID, createdCount int, deletedCount int) error {
	_, err := tx.Exec(ctx, `
		UPDATE qa_scenario_runs
		SET status = 'completed', completed_at = now(), created_count = $2,
		    cleanup_deleted_count = $3, historical_rows_touched = 0
		WHERE id = $1
	`, runID, createdCount, deletedCount)
	if err != nil {
		return fmt.Errorf("complete qa run: %w", err)
	}
	return nil
}

func (r *DemoRepository) FailRun(ctx context.Context, runID uuid.UUID, errMsg string) {
	_, _ = r.db.Exec(ctx, `UPDATE qa_scenario_runs SET status = 'failed', completed_at = now(), error_message = $2 WHERE id = $1`, runID, errMsg)
}

func (r *DemoRepository) ListRuns(ctx context.Context, limit int) ([]DemoRunRecord, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := r.db.Query(ctx, `
		SELECT id, scenario_id, scenario_title, status, cleanup_deleted_count, created_count,
		       historical_rows_touched, error_message, started_at, completed_at, cleaned_at, created_by_name
		FROM qa_scenario_runs
		ORDER BY started_at DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("list qa runs: %w", err)
	}
	defer rows.Close()

	runs := []DemoRunRecord{}
	for rows.Next() {
		var run DemoRunRecord
		if err := rows.Scan(&run.ID, &run.ScenarioID, &run.ScenarioTitle, &run.Status,
			&run.CleanupDeletedCount, &run.CreatedCount, &run.HistoricalRowsTouched,
			&run.ErrorMessage, &run.StartedAt, &run.CompletedAt, &run.CleanedAt, &run.CreatedByName); err != nil {
			return nil, fmt.Errorf("scan qa run: %w", err)
		}
		runs = append(runs, run)
	}
	return runs, rows.Err()
}
