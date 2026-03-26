package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

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

// ── Role Permissions ─────────────────────────────────

func (r *Repository) GetAllRolePermissions(ctx context.Context) ([]domain.RolePermission, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, role::text, resource, action, scope::text, is_allowed, updated_by, updated_at
		FROM role_permissions
		ORDER BY role, resource, action
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var perms []domain.RolePermission
	for rows.Next() {
		var p domain.RolePermission
		if err := rows.Scan(&p.ID, &p.Role, &p.Resource, &p.Action, &p.Scope, &p.IsAllowed, &p.UpdatedBy, &p.UpdatedAt); err != nil {
			return nil, err
		}
		perms = append(perms, p)
	}
	return perms, nil
}

func (r *Repository) UpsertRolePermission(ctx context.Context, role, resource, action, scope string, allowed bool, updatedBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO role_permissions (role, resource, action, scope, is_allowed, updated_by, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, NOW())
		ON CONFLICT (role, resource, action) DO UPDATE SET
			scope = EXCLUDED.scope,
			is_allowed = EXCLUDED.is_allowed,
			updated_by = EXCLUDED.updated_by,
			updated_at = NOW()
	`, role, resource, action, scope, allowed, updatedBy)
	return err
}

func (r *Repository) GetRolePermission(ctx context.Context, role, resource, action string) (*domain.RolePermission, error) {
	var p domain.RolePermission
	err := r.db.QueryRow(ctx, `
		SELECT id, role::text, resource, action, scope::text, is_allowed, updated_by, updated_at
		FROM role_permissions WHERE role = $1 AND resource = $2 AND action = $3
	`, role, resource, action).Scan(&p.ID, &p.Role, &p.Resource, &p.Action, &p.Scope, &p.IsAllowed, &p.UpdatedBy, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// ── User Permission Overrides ────────────────────────

func (r *Repository) GetUserOverrides(ctx context.Context, userID uuid.UUID) ([]domain.UserPermissionOverride, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, user_id, resource, action, is_allowed, reason, granted_by, expires_at, created_at
		FROM user_permission_overrides
		WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var overrides []domain.UserPermissionOverride
	for rows.Next() {
		var o domain.UserPermissionOverride
		if err := rows.Scan(&o.ID, &o.UserID, &o.Resource, &o.Action, &o.IsAllowed, &o.Reason, &o.GrantedBy, &o.ExpiresAt, &o.CreatedAt); err != nil {
			return nil, err
		}
		overrides = append(overrides, o)
	}
	return overrides, nil
}

func (r *Repository) UpsertUserOverride(ctx context.Context, o domain.UserPermissionOverride) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO user_permission_overrides (user_id, resource, action, is_allowed, reason, granted_by, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`, o.UserID, o.Resource, o.Action, o.IsAllowed, o.Reason, o.GrantedBy, o.ExpiresAt)
	return err
}

func (r *Repository) DeleteUserOverride(ctx context.Context, id uuid.UUID) error {
	tag, err := r.db.Exec(ctx, `DELETE FROM user_permission_overrides WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("override not found")
	}
	return nil
}

// ── Active Sessions ──────────────────────────────────

func (r *Repository) ListActiveSessions(ctx context.Context, userID *uuid.UUID) ([]domain.ActiveSession, error) {
	query := `
		SELECT s.id, s.user_id, COALESCE(u.full_name, ''), s.ip_address::text, s.user_agent, s.last_seen_at, s.created_at, s.revoked_at
		FROM active_sessions s
		LEFT JOIN users u ON u.id = s.user_id
		WHERE s.revoked_at IS NULL
	`
	args := []interface{}{}
	if userID != nil {
		query += " AND s.user_id = $1"
		args = append(args, *userID)
	}
	query += " ORDER BY s.last_seen_at DESC"

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []domain.ActiveSession
	for rows.Next() {
		var s domain.ActiveSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.UserFullName, &s.IPAddress, &s.UserAgent, &s.LastSeenAt, &s.CreatedAt, &s.RevokedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (r *Repository) CountActiveSessionsByUser(ctx context.Context, userID uuid.UUID) (int, error) {
	var count int
	err := r.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM active_sessions WHERE user_id = $1 AND revoked_at IS NULL`, userID,
	).Scan(&count)
	return count, err
}

func (r *Repository) RevokeSession(ctx context.Context, sessionID uuid.UUID) error {
	tag, err := r.db.Exec(ctx,
		`UPDATE active_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL`, sessionID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("session not found or already revoked")
	}
	return nil
}

func (r *Repository) RevokeAllUserSessions(ctx context.Context, userID uuid.UUID) (int64, error) {
	tag, err := r.db.Exec(ctx,
		`UPDATE active_sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

// ── Audit Logs ───────────────────────────────────────

func (r *Repository) GetAuditLogs(ctx context.Context, filter domain.AuditFilter) ([]domain.EntityEvent, int, error) {
	where := []string{"1=1"}
	args := []interface{}{}
	argIdx := 1

	if filter.UserID != nil {
		where = append(where, fmt.Sprintf("actor_id = $%d", argIdx))
		args = append(args, *filter.UserID)
		argIdx++
	}
	if filter.Action != nil && *filter.Action != "" {
		where = append(where, fmt.Sprintf("event_type = $%d", argIdx))
		args = append(args, *filter.Action)
		argIdx++
	}
	if filter.EntityType != nil && *filter.EntityType != "" {
		where = append(where, fmt.Sprintf("entity_type = $%d", argIdx))
		args = append(args, *filter.EntityType)
		argIdx++
	}
	if filter.EntityID != nil && *filter.EntityID != "" {
		where = append(where, fmt.Sprintf("entity_id::text = $%d", argIdx))
		args = append(args, *filter.EntityID)
		argIdx++
	}
	if filter.From != nil {
		where = append(where, fmt.Sprintf("created_at >= $%d", argIdx))
		args = append(args, *filter.From)
		argIdx++
	}
	if filter.To != nil {
		where = append(where, fmt.Sprintf("created_at <= $%d", argIdx))
		args = append(args, *filter.To)
		argIdx++
	}

	whereClause := strings.Join(where, " AND ")

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM entity_events WHERE %s", whereClause)
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	// Get page
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.PageSize < 1 || filter.PageSize > 100 {
		filter.PageSize = 50
	}
	offset := (filter.Page - 1) * filter.PageSize

	dataQuery := fmt.Sprintf(`
		SELECT id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at
		FROM entity_events WHERE %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, whereClause, argIdx, argIdx+1)
	args = append(args, filter.PageSize, offset)

	rows, err := r.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var logs []domain.EntityEvent
	for rows.Next() {
		var e domain.EntityEvent
		if err := rows.Scan(&e.ID, &e.EntityType, &e.EntityID, &e.EventType, &e.ActorType, &e.ActorID, &e.ActorName, &e.Title, &e.Detail, &e.CreatedAt); err != nil {
			return nil, 0, err
		}
		logs = append(logs, e)
	}
	return logs, total, nil
}

func (r *Repository) GetAuditLogByID(ctx context.Context, id uuid.UUID) (*domain.EntityEvent, error) {
	var e domain.EntityEvent
	err := r.db.QueryRow(ctx, `
		SELECT id, entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail, created_at
		FROM entity_events WHERE id = $1
	`, id).Scan(&e.ID, &e.EntityType, &e.EntityID, &e.EventType, &e.ActorType, &e.ActorID, &e.ActorName, &e.Title, &e.Detail, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &e, nil
}

// ── System Configs ───────────────────────────────────

func (r *Repository) GetSystemConfigs(ctx context.Context) ([]SystemConfig, error) {
	rows, err := r.db.Query(ctx, `
		SELECT key, value, description, updated_at::text
		FROM system_settings ORDER BY key
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var configs []SystemConfig
	for rows.Next() {
		var c SystemConfig
		if err := rows.Scan(&c.Key, &c.Value, &c.Description, &c.UpdatedAt); err != nil {
			return nil, err
		}
		configs = append(configs, c)
	}
	return configs, nil
}

func (r *Repository) UpsertSystemConfig(ctx context.Context, key, value string, updatedBy uuid.UUID) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO system_settings (key, value, updated_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
	`, key, value)
	return err
}

// ── Permission Helpers ───────────────────────────────

func (r *Repository) GetEffectivePermissions(ctx context.Context, userID uuid.UUID) ([]domain.RolePermission, []domain.UserPermissionOverride, error) {
	// Get user role
	var role string
	err := r.db.QueryRow(ctx, `SELECT role::text FROM users WHERE id = $1`, userID).Scan(&role)
	if err != nil {
		return nil, nil, fmt.Errorf("user not found: %w", err)
	}

	// Get role permissions
	rows, err := r.db.Query(ctx, `
		SELECT id, role::text, resource, action, scope::text, is_allowed, updated_by, updated_at
		FROM role_permissions WHERE role = $1
	`, role)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var perms []domain.RolePermission
	for rows.Next() {
		var p domain.RolePermission
		if err := rows.Scan(&p.ID, &p.Role, &p.Resource, &p.Action, &p.Scope, &p.IsAllowed, &p.UpdatedBy, &p.UpdatedAt); err != nil {
			return nil, nil, err
		}
		perms = append(perms, p)
	}

	// Get user overrides
	overrides, err := r.GetUserOverrides(ctx, userID)
	if err != nil {
		return nil, nil, err
	}

	return perms, overrides, nil
}

// ── Audit Trail Helper ───────────────────────────────

func (r *Repository) WriteAuditLog(ctx context.Context, entityType string, entityID uuid.UUID, eventType, actorName string, actorID *uuid.UUID, title string, detail interface{}) error {
	detailJSON, _ := json.Marshal(detail)
	_, err := r.db.Exec(ctx, `
		INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail)
		VALUES ($1, $2, $3, 'user', $4, $5, $6, $7)
	`, entityType, entityID, eventType, actorID, actorName, title, detailJSON)
	return err
}

// ── Credit Limits ────────────────────────────────────

type CreditLimitRow struct {
	ID           uuid.UUID  `json:"id"`
	CustomerID   uuid.UUID  `json:"customer_id"`
	CustomerName string     `json:"customer_name"`
	CreditLimit  float64    `json:"credit_limit"`
	ValidFrom    string     `json:"valid_from"`
	ValidTo      *string    `json:"valid_to,omitempty"`
	IsActive     bool       `json:"is_active"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    *time.Time `json:"updated_at,omitempty"`
}

func (r *Repository) ListCreditLimits(ctx context.Context) ([]CreditLimitRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT cl.id, cl.customer_id, c.name, cl.credit_limit, cl.valid_from::text, cl.valid_to::text, cl.is_active, cl.created_at, cl.updated_at
		FROM credit_limits cl
		JOIN customers c ON c.id = cl.customer_id
		ORDER BY c.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var limits []CreditLimitRow
	for rows.Next() {
		var l CreditLimitRow
		if err := rows.Scan(&l.ID, &l.CustomerID, &l.CustomerName, &l.CreditLimit, &l.ValidFrom, &l.ValidTo, &l.IsActive, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, err
		}
		limits = append(limits, l)
	}
	return limits, nil
}

// ── Delivery Windows ─────────────────────────────────

type DeliveryWindowRow struct {
	ID        uuid.UUID  `json:"id"`
	Name      string     `json:"name"`
	StartTime string     `json:"start_time"`
	EndTime   string     `json:"end_time"`
	IsActive  bool       `json:"is_active"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt *time.Time `json:"updated_at,omitempty"`
}

// ── Priority Rules ───────────────────────────────────

type PriorityRuleRow struct {
	ID          uuid.UUID  `json:"id"`
	Name        string     `json:"name"`
	Description *string    `json:"description,omitempty"`
	Priority    int        `json:"priority"`
	IsActive    bool       `json:"is_active"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at,omitempty"`
}
