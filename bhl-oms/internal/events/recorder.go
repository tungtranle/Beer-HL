package events

import (
	"context"
	"encoding/json"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Recorder records entity events (immutable activity log).
type Recorder struct {
	db  *pgxpool.Pool
	log logger.Logger
}

func NewRecorder(db *pgxpool.Pool, log logger.Logger) *Recorder {
	return &Recorder{db: db, log: log}
}

// Record inserts an immutable event into entity_events.
func (r *Recorder) Record(ctx context.Context, evt domain.EntityEvent) {
	detailBytes := evt.Detail
	if detailBytes == nil {
		detailBytes = json.RawMessage(`{}`)
	}

	_, err := r.db.Exec(ctx, `
		INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
	`, evt.EntityType, evt.EntityID, evt.EventType, evt.ActorType, evt.ActorID, evt.ActorName, evt.Title, detailBytes)
	if err != nil {
		r.log.Error(ctx, "event_record_failed", err,
			logger.F("entity_type", evt.EntityType),
			logger.F("entity_id", evt.EntityID.String()),
			logger.F("event_type", evt.EventType),
		)
	}
}

// RecordAsync fires event recording in a goroutine (fire-and-forget).
func (r *Recorder) RecordAsync(evt domain.EntityEvent) {
	go r.Record(context.Background(), evt)
}

// GetTimeline returns events for an entity, ordered by created_at DESC.
func (r *Recorder) GetTimeline(ctx context.Context, entityType string, entityID uuid.UUID, limit int) ([]domain.EntityEvent, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}

	rows, err := r.db.Query(ctx, `
		SELECT id, entity_type, entity_id, event_type, actor_type, actor_id,
		       COALESCE(actor_name, ''), title, COALESCE(detail, '{}'), created_at
		FROM entity_events
		WHERE entity_type = $1 AND entity_id = $2
		ORDER BY created_at DESC
		LIMIT $3
	`, entityType, entityID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []domain.EntityEvent
	for rows.Next() {
		var e domain.EntityEvent
		if err := rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.EventType,
			&e.ActorType, &e.ActorID, &e.ActorName, &e.Title, &e.Detail, &e.CreatedAt); err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

// GetNotes returns order notes for an order.
func (r *Recorder) GetNotes(ctx context.Context, orderID uuid.UUID) ([]domain.OrderNote, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, order_id, user_id, COALESCE(user_name, ''), content,
		       COALESCE(note_type, 'internal'), COALESCE(is_pinned, false), created_at
		FROM order_notes
		WHERE order_id = $1
		ORDER BY created_at DESC
	`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var notes []domain.OrderNote
	for rows.Next() {
		var n domain.OrderNote
		if err := rows.Scan(&n.ID, &n.OrderID, &n.UserID, &n.UserName, &n.Content, &n.NoteType, &n.IsPinned, &n.CreatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, nil
}

// AddNote creates a note for an order with type classification.
func (r *Recorder) AddNote(ctx context.Context, orderID, userID uuid.UUID, userName, content, noteType string) (*domain.OrderNote, error) {
	if noteType == "" {
		noteType = "internal"
	}
	var note domain.OrderNote
	err := r.db.QueryRow(ctx, `
		INSERT INTO order_notes (order_id, user_id, user_name, content, note_type)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, order_id, user_id, user_name, content, COALESCE(note_type, 'internal'), COALESCE(is_pinned, false), created_at
	`, orderID, userID, userName, content, noteType).Scan(
		&note.ID, &note.OrderID, &note.UserID, &note.UserName, &note.Content, &note.NoteType, &note.IsPinned, &note.CreatedAt,
	)
	return &note, err
}

// SetNotePin pins or unpins a note.
func (r *Recorder) SetNotePin(ctx context.Context, noteID uuid.UUID, pinned bool) error {
	_, err := r.db.Exec(ctx, `UPDATE order_notes SET is_pinned = $1 WHERE id = $2`, pinned, noteID)
	return err
}

// Helper to build detail JSON easily
func Detail(kv ...interface{}) json.RawMessage {
	m := make(map[string]interface{})
	for i := 0; i+1 < len(kv); i += 2 {
		if key, ok := kv[i].(string); ok {
			m[key] = kv[i+1]
		}
	}
	data, _ := json.Marshal(m)
	return data
}
