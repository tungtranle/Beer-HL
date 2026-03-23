package admin

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db  *pgxpool.Pool
	rdb *redis.Client
	log logger.Logger
}

func NewService(db *pgxpool.Pool, rdb *redis.Client, log logger.Logger) *Service {
	return &Service{db: db, rdb: rdb, log: log}
}

type UserResponse struct {
	ID           uuid.UUID   `json:"id"`
	Username     string      `json:"username"`
	FullName     string      `json:"full_name"`
	Email        *string     `json:"email,omitempty"`
	Role         string      `json:"role"`
	IsActive     bool        `json:"is_active"`
	WarehouseIDs []uuid.UUID `json:"warehouse_ids"`
	CreatedAt    string      `json:"created_at"`
	LastLoginAt  *string     `json:"last_login_at,omitempty"`
}

func (s *Service) ListUsers(ctx context.Context) ([]UserResponse, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, username, full_name, email, role, is_active, warehouse_ids, created_at, last_login_at
		FROM users ORDER BY role, full_name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []UserResponse
	for rows.Next() {
		var u UserResponse
		var createdAt interface{}
		var lastLogin interface{}
		if err := rows.Scan(&u.ID, &u.Username, &u.FullName, &u.Email, &u.Role, &u.IsActive, &u.WarehouseIDs, &createdAt, &lastLogin); err != nil {
			return nil, err
		}
		if t, ok := createdAt.(interface{ String() string }); ok {
			s := t.String()
			u.CreatedAt = s
		}
		users = append(users, u)
	}
	if users == nil {
		users = []UserResponse{}
	}
	return users, nil
}

func (s *Service) GetUser(ctx context.Context, id uuid.UUID) (*UserResponse, error) {
	var u UserResponse
	err := s.db.QueryRow(ctx, `
		SELECT id, username, full_name, email, role, is_active, warehouse_ids, created_at
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Username, &u.FullName, &u.Email, &u.Role, &u.IsActive, &u.WarehouseIDs, &u.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

func (s *Service) CreateUser(ctx context.Context, username, fullName, password, role string, email *string, warehouseIDs []uuid.UUID) (*domain.User, error) {
	// Check duplicate username
	var exists bool
	s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE username = $1)`, username).Scan(&exists)
	if exists {
		return nil, fmt.Errorf("tên đăng nhập '%s' đã tồn tại", username)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, fmt.Errorf("lỗi mã hóa mật khẩu: %w", err)
	}

	permissions := getDefaultPermissions(role)
	if warehouseIDs == nil {
		warehouseIDs = []uuid.UUID{}
	}

	var user domain.User
	err = s.db.QueryRow(ctx, `
		INSERT INTO users (id, username, full_name, email, password_hash, role, permissions, warehouse_ids, is_active, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, now())
		RETURNING id, username, full_name, email, role, is_active, warehouse_ids, created_at
	`, uuid.New(), username, fullName, email, string(hash), role, permissions, warehouseIDs).Scan(
		&user.ID, &user.Username, &user.FullName, &user.Email, &user.Role, &user.IsActive, &user.WarehouseIDs, &user.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("tạo người dùng thất bại: %w", err)
	}
	return &user, nil
}

func (s *Service) UpdateUser(ctx context.Context, id uuid.UUID, fullName, role *string, email *string, isActive *bool, warehouseIDs []uuid.UUID) (*domain.User, error) {
	// Verify user exists
	var exists bool
	s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM users WHERE id = $1)`, id).Scan(&exists)
	if !exists {
		return nil, fmt.Errorf("không tìm thấy người dùng")
	}

	if fullName != nil {
		s.db.Exec(ctx, `UPDATE users SET full_name = $2 WHERE id = $1`, id, *fullName)
	}
	if role != nil {
		perms := getDefaultPermissions(*role)
		s.db.Exec(ctx, `UPDATE users SET role = $2, permissions = $3 WHERE id = $1`, id, *role, perms)
	}
	if email != nil {
		s.db.Exec(ctx, `UPDATE users SET email = $2 WHERE id = $1`, id, *email)
	}
	if isActive != nil {
		s.db.Exec(ctx, `UPDATE users SET is_active = $2 WHERE id = $1`, id, *isActive)
	}
	if warehouseIDs != nil {
		s.db.Exec(ctx, `UPDATE users SET warehouse_ids = $2 WHERE id = $1`, id, warehouseIDs)
	}

	return s.getUserDomain(ctx, id)
}

func (s *Service) DeleteUser(ctx context.Context, id uuid.UUID) error {
	tag, err := s.db.Exec(ctx, `UPDATE users SET is_active = false WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("không tìm thấy người dùng")
	}
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, id uuid.UUID, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return fmt.Errorf("lỗi mã hóa mật khẩu: %w", err)
	}
	tag, err := s.db.Exec(ctx, `UPDATE users SET password_hash = $2 WHERE id = $1`, id, string(hash))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("không tìm thấy người dùng")
	}
	return nil
}

func (s *Service) getUserDomain(ctx context.Context, id uuid.UUID) (*domain.User, error) {
	var user domain.User
	err := s.db.QueryRow(ctx, `
		SELECT id, username, full_name, email, role, is_active, warehouse_ids, created_at
		FROM users WHERE id = $1
	`, id).Scan(&user.ID, &user.Username, &user.FullName, &user.Email, &user.Role, &user.IsActive, &user.WarehouseIDs, &user.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func getDefaultPermissions(role string) []string {
	switch role {
	case "admin":
		return []string{"*"}
	case "dvkh":
		return []string{"orders.create", "orders.read", "orders.update", "customers.read", "customers.create", "products.read"}
	case "dispatcher":
		return []string{"orders.read", "planning.run", "planning.approve", "trips.read", "trips.update", "vehicles.manage", "drivers.manage"}
	case "accountant":
		return []string{"orders.approve", "orders.read", "reconciliation.manage", "daily_close.manage"}
	case "driver":
		return []string{"trips.my", "trips.update_stop", "epod.submit", "payment.collect", "returns.submit"}
	case "warehouse":
		return []string{"picking.manage", "gate_check.manage", "stock.read", "returns.manage"}
	case "security":
		return []string{"gate_check.manage"}
	case "workshop":
		return []string{"bottle_classification.manage", "stock.read", "returns.manage"}
	case "management":
		return []string{"kpi.read", "orders.approve", "dashboard.read"}
	default:
		return []string{}
	}
}

// SlowQuery represents a slow query entry from pg_stat_statements
type SlowQuery struct {
	QueryID        string  `json:"query_id"`
	Query          string  `json:"query"`
	Calls          int64   `json:"calls"`
	TotalTimeMs    float64 `json:"total_time_ms"`
	MeanTimeMs     float64 `json:"mean_time_ms"`
	MaxTimeMs      float64 `json:"max_time_ms"`
	MinTimeMs      float64 `json:"min_time_ms"`
	StddevTimeMs   float64 `json:"stddev_time_ms"`
	Rows           int64   `json:"rows"`
	SharedBlksHit  int64   `json:"shared_blks_hit"`
	SharedBlksRead int64   `json:"shared_blks_read"`
	HitRate        float64 `json:"hit_rate_percent"`
}

// GetSlowQueries fetches top slow queries from pg_stat_statements
func (s *Service) GetSlowQueries(ctx context.Context, limit int) ([]SlowQuery, error) {
	// Ensure extension exists
	_, err := s.db.Exec(ctx, `CREATE EXTENSION IF NOT EXISTS pg_stat_statements`)
	if err != nil {
		return nil, fmt.Errorf("enable pg_stat_statements: %w", err)
	}

	rows, err := s.db.Query(ctx, `
		SELECT
			queryid::text,
			LEFT(query, 500) AS query,
			calls,
			total_exec_time AS total_time_ms,
			mean_exec_time AS mean_time_ms,
			max_exec_time AS max_time_ms,
			min_exec_time AS min_time_ms,
			stddev_exec_time AS stddev_time_ms,
			rows,
			shared_blks_hit,
			shared_blks_read,
			CASE WHEN (shared_blks_hit + shared_blks_read) > 0
				THEN ROUND(shared_blks_hit::numeric / (shared_blks_hit + shared_blks_read) * 100, 2)
				ELSE 0
			END AS hit_rate
		FROM pg_stat_statements
		WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database())
			AND query NOT LIKE '%pg_stat_statements%'
		ORDER BY total_exec_time DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("query pg_stat_statements: %w", err)
	}
	defer rows.Close()

	var queries []SlowQuery
	for rows.Next() {
		var q SlowQuery
		if err := rows.Scan(
			&q.QueryID, &q.Query, &q.Calls,
			&q.TotalTimeMs, &q.MeanTimeMs, &q.MaxTimeMs, &q.MinTimeMs, &q.StddevTimeMs,
			&q.Rows, &q.SharedBlksHit, &q.SharedBlksRead, &q.HitRate,
		); err != nil {
			return nil, fmt.Errorf("scan slow query: %w", err)
		}
		queries = append(queries, q)
	}
	if queries == nil {
		queries = []SlowQuery{}
	}
	return queries, nil
}

// ResetSlowQueries resets pg_stat_statements counters
func (s *Service) ResetSlowQueries(ctx context.Context) error {
	_, err := s.db.Exec(ctx, `SELECT pg_stat_statements_reset()`)
	if err != nil {
		return fmt.Errorf("reset pg_stat_statements: %w", err)
	}
	s.log.Info(ctx, "slow_queries_reset")
	return nil
}

// ─── System Configs ──────────────────────────────────────────

type SystemConfig struct {
	Key         string  `json:"key"`
	Value       string  `json:"value"`
	Description *string `json:"description,omitempty"`
	UpdatedAt   string  `json:"updated_at"`
}

type ConfigEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

func (s *Service) ListConfigs(ctx context.Context) ([]SystemConfig, error) {
	rows, err := s.db.Query(ctx, `
		SELECT key, value, description, updated_at::text
		FROM system_settings ORDER BY key
	`)
	if err != nil {
		return nil, fmt.Errorf("query system_settings: %w", err)
	}
	defer rows.Close()

	var configs []SystemConfig
	for rows.Next() {
		var c SystemConfig
		if err := rows.Scan(&c.Key, &c.Value, &c.Description, &c.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan system_setting: %w", err)
		}
		configs = append(configs, c)
	}
	if configs == nil {
		configs = []SystemConfig{}
	}
	return configs, nil
}

func (s *Service) UpdateConfigs(ctx context.Context, entries []ConfigEntry, actorID uuid.UUID, actorName string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback(ctx)

	// Collect before values for diff
	changes := make([]map[string]string, 0, len(entries))
	for _, e := range entries {
		var oldValue string
		_ = tx.QueryRow(ctx, `SELECT value FROM system_settings WHERE key = $1`, e.Key).Scan(&oldValue)

		tag, err := tx.Exec(ctx, `
			UPDATE system_settings SET value = $2, updated_at = now() WHERE key = $1
		`, e.Key, e.Value)
		if err != nil {
			return fmt.Errorf("update config '%s': %w", e.Key, err)
		}
		if tag.RowsAffected() == 0 {
			_, err = tx.Exec(ctx, `
				INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, now())
			`, e.Key, e.Value)
			if err != nil {
				return fmt.Errorf("insert config '%s': %w", e.Key, err)
			}
		}
		if oldValue != e.Value {
			changes = append(changes, map[string]string{
				"key":    e.Key,
				"before": oldValue,
				"after":  e.Value,
			})
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("commit tx: %w", err)
	}

	// Record audit event with diff detail
	if len(changes) > 0 {
		detail, _ := json.Marshal(map[string]interface{}{"changes": changes})
		_, _ = s.db.Exec(ctx, `
			INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_id, actor_name, title, detail)
			VALUES ('config', $1, 'config_updated', 'user', $2, $3, $4, $5)
		`, uuid.New(), actorID, actorName, fmt.Sprintf("Cập nhật %d cấu hình", len(changes)), detail)
	}

	s.log.Info(ctx, "configs_updated")
	return nil
}

// ─── Credit Limits ───────────────────────────────────────────

type CreditLimitResponse struct {
	ID            uuid.UUID `json:"id"`
	CustomerID    uuid.UUID `json:"customer_id"`
	CustomerName  string    `json:"customer_name"`
	CustomerCode  string    `json:"customer_code"`
	CreditLimit   float64   `json:"credit_limit"`
	EffectiveFrom string    `json:"effective_from"`
	EffectiveTo   *string   `json:"effective_to,omitempty"`
	CreatedAt     string    `json:"created_at"`
}

func (s *Service) ListCreditLimits(ctx context.Context, customerID *uuid.UUID) ([]CreditLimitResponse, error) {
	query := `
		SELECT cl.id, cl.customer_id, c.name, c.code,
			cl.credit_limit, cl.effective_from::text, cl.effective_to::text, cl.created_at::text
		FROM credit_limits cl
		JOIN customers c ON c.id = cl.customer_id
	`
	var args []interface{}
	if customerID != nil {
		query += ` WHERE cl.customer_id = $1`
		args = append(args, *customerID)
	}
	query += ` ORDER BY c.name, cl.effective_from DESC`

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query credit_limits: %w", err)
	}
	defer rows.Close()

	var limits []CreditLimitResponse
	for rows.Next() {
		var l CreditLimitResponse
		if err := rows.Scan(&l.ID, &l.CustomerID, &l.CustomerName, &l.CustomerCode,
			&l.CreditLimit, &l.EffectiveFrom, &l.EffectiveTo, &l.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan credit_limit: %w", err)
		}
		limits = append(limits, l)
	}
	if limits == nil {
		limits = []CreditLimitResponse{}
	}
	return limits, nil
}

func (s *Service) CreateCreditLimit(ctx context.Context, customerID uuid.UUID, creditLimit float64, effectiveFrom string, effectiveTo *string) (*CreditLimitResponse, error) {
	// Validate date format
	if _, err := time.Parse("2006-01-02", effectiveFrom); err != nil {
		return nil, fmt.Errorf("effective_from phải có định dạng YYYY-MM-DD")
	}
	if effectiveTo != nil {
		if _, err := time.Parse("2006-01-02", *effectiveTo); err != nil {
			return nil, fmt.Errorf("effective_to phải có định dạng YYYY-MM-DD")
		}
	}

	var l CreditLimitResponse
	err := s.db.QueryRow(ctx, `
		INSERT INTO credit_limits (id, customer_id, credit_limit, effective_from, effective_to, created_at)
		VALUES ($1, $2, $3, $4::date, $5::date, now())
		RETURNING id, customer_id, credit_limit, effective_from::text, effective_to::text, created_at::text
	`, uuid.New(), customerID, creditLimit, effectiveFrom, effectiveTo).Scan(
		&l.ID, &l.CustomerID, &l.CreditLimit, &l.EffectiveFrom, &l.EffectiveTo, &l.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("tạo hạn mức thất bại: %w", err)
	}

	// Fetch customer info
	s.db.QueryRow(ctx, `SELECT name, code FROM customers WHERE id = $1`, customerID).Scan(&l.CustomerName, &l.CustomerCode)

	return &l, nil
}

func (s *Service) UpdateCreditLimit(ctx context.Context, id uuid.UUID, creditLimit *float64, effectiveTo *string) (*CreditLimitResponse, error) {
	if creditLimit != nil {
		_, err := s.db.Exec(ctx, `UPDATE credit_limits SET credit_limit = $2 WHERE id = $1`, id, *creditLimit)
		if err != nil {
			return nil, fmt.Errorf("update credit_limit: %w", err)
		}
	}
	if effectiveTo != nil {
		if *effectiveTo != "" {
			if _, err := time.Parse("2006-01-02", *effectiveTo); err != nil {
				return nil, fmt.Errorf("effective_to phải có định dạng YYYY-MM-DD")
			}
		}
		_, err := s.db.Exec(ctx, `UPDATE credit_limits SET effective_to = $2::date WHERE id = $1`, id, effectiveTo)
		if err != nil {
			return nil, fmt.Errorf("update effective_to: %w", err)
		}
	}

	var l CreditLimitResponse
	err := s.db.QueryRow(ctx, `
		SELECT cl.id, cl.customer_id, c.name, c.code,
			cl.credit_limit, cl.effective_from::text, cl.effective_to::text, cl.created_at::text
		FROM credit_limits cl
		JOIN customers c ON c.id = cl.customer_id
		WHERE cl.id = $1
	`, id).Scan(&l.ID, &l.CustomerID, &l.CustomerName, &l.CustomerCode,
		&l.CreditLimit, &l.EffectiveFrom, &l.EffectiveTo, &l.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("không tìm thấy hạn mức: %w", err)
	}
	return &l, nil
}

func (s *Service) DeleteCreditLimit(ctx context.Context, id uuid.UUID) error {
	tag, err := s.db.Exec(ctx, `DELETE FROM credit_limits WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete credit_limit: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("không tìm thấy hạn mức")
	}
	return nil
}

// ─── Audit Logs ──────────────────────────────────────────────

type AuditLogEntry struct {
	ID         uuid.UUID   `json:"id"`
	EntityType string      `json:"entity_type"`
	EntityID   uuid.UUID   `json:"entity_id"`
	EventType  string      `json:"event_type"`
	ActorType  string      `json:"actor_type"`
	ActorID    *uuid.UUID  `json:"actor_id,omitempty"`
	ActorName  string      `json:"actor_name"`
	Title      string      `json:"title"`
	Detail     interface{} `json:"detail,omitempty"`
	CreatedAt  string      `json:"created_at"`
}

func (s *Service) ListAuditLogs(ctx context.Context, entityType, eventType, actorID, dateFrom, dateTo string, page, limit int) ([]AuditLogEntry, int, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	argIdx := 1

	if entityType != "" {
		where += fmt.Sprintf(" AND entity_type = $%d", argIdx)
		args = append(args, entityType)
		argIdx++
	}
	if eventType != "" {
		where += fmt.Sprintf(" AND event_type = $%d", argIdx)
		args = append(args, eventType)
		argIdx++
	}
	if actorID != "" {
		parsed, err := uuid.Parse(actorID)
		if err != nil {
			return nil, 0, fmt.Errorf("actor_id không hợp lệ")
		}
		where += fmt.Sprintf(" AND actor_id = $%d", argIdx)
		args = append(args, parsed)
		argIdx++
	}
	if dateFrom != "" {
		where += fmt.Sprintf(" AND created_at >= $%d::timestamptz", argIdx)
		args = append(args, dateFrom)
		argIdx++
	}
	if dateTo != "" {
		where += fmt.Sprintf(" AND created_at < ($%d::date + interval '1 day')", argIdx)
		args = append(args, dateTo)
		argIdx++
	}

	// Count total
	var total int
	countQuery := fmt.Sprintf("SELECT COUNT(*) FROM entity_events %s", where)
	if err := s.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count audit_logs: %w", err)
	}

	// Fetch page
	offset := (page - 1) * limit
	dataQuery := fmt.Sprintf(`
		SELECT id, entity_type, entity_id, event_type, actor_type,
			actor_id, actor_name, title, detail, created_at::text
		FROM entity_events %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d
	`, where, argIdx, argIdx+1)
	args = append(args, limit, offset)

	rows, err := s.db.Query(ctx, dataQuery, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("query audit_logs: %w", err)
	}
	defer rows.Close()

	var logs []AuditLogEntry
	for rows.Next() {
		var l AuditLogEntry
		if err := rows.Scan(&l.ID, &l.EntityType, &l.EntityID, &l.EventType, &l.ActorType,
			&l.ActorID, &l.ActorName, &l.Title, &l.Detail, &l.CreatedAt); err != nil {
			return nil, 0, fmt.Errorf("scan audit_log: %w", err)
		}
		logs = append(logs, l)
	}
	if logs == nil {
		logs = []AuditLogEntry{}
	}
	return logs, total, nil
}

// ──── Credit Limit Expiry Cron ────

type ExpiringCreditLimit struct {
	ID           uuid.UUID `json:"id"`
	CustomerID   uuid.UUID `json:"customer_id"`
	CustomerName string    `json:"customer_name"`
	CreditLimit  float64   `json:"credit_limit"`
	EffectiveTo  string    `json:"effective_to"`
	DaysLeft     int       `json:"days_left"`
}

// CheckCreditLimitExpiry runs periodically to find credit limits expiring within 7 days.
func (s *Service) CheckCreditLimitExpiry(ctx context.Context) ([]ExpiringCreditLimit, error) {
	rows, err := s.db.Query(ctx, `
		SELECT cl.id, cl.customer_id, c.name, cl.credit_limit,
			cl.effective_to::text, EXTRACT(DAY FROM cl.effective_to - CURRENT_DATE)::int as days_left
		FROM credit_limits cl
		JOIN customers c ON c.id = cl.customer_id
		WHERE cl.effective_to IS NOT NULL
		  AND cl.effective_to BETWEEN CURRENT_DATE AND CURRENT_DATE + interval '7 days'
		ORDER BY cl.effective_to ASC
	`)
	if err != nil {
		return nil, fmt.Errorf("query expiring credit limits: %w", err)
	}
	defer rows.Close()

	var results []ExpiringCreditLimit
	for rows.Next() {
		var r ExpiringCreditLimit
		if err := rows.Scan(&r.ID, &r.CustomerID, &r.CustomerName, &r.CreditLimit, &r.EffectiveTo, &r.DaysLeft); err != nil {
			return nil, fmt.Errorf("scan expiring credit limit: %w", err)
		}
		results = append(results, r)
	}
	if results == nil {
		results = []ExpiringCreditLimit{}
	}
	return results, nil
}

// RunCreditLimitExpiryCron checks every 6 hours for expiring credit limits and records alerts.
func (s *Service) RunCreditLimitExpiryCron(ctx context.Context) {
	ticker := time.NewTicker(6 * time.Hour)
	defer ticker.Stop()

	// Run once immediately
	s.checkAndAlertExpiry(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.checkAndAlertExpiry(ctx)
		}
	}
}

func (s *Service) checkAndAlertExpiry(ctx context.Context) {
	expiring, err := s.CheckCreditLimitExpiry(ctx)
	if err != nil {
		s.log.Error(ctx, "credit_limit_expiry_check_failed", err)
		return
	}
	for _, e := range expiring {
		detail, _ := json.Marshal(map[string]interface{}{
			"customer_name": e.CustomerName,
			"credit_limit":  e.CreditLimit,
			"effective_to":  e.EffectiveTo,
			"days_left":     e.DaysLeft,
		})
		_, _ = s.db.Exec(ctx, `
			INSERT INTO entity_events (entity_type, entity_id, event_type, actor_type, actor_name, title, detail)
			VALUES ('credit_limit', $1, 'expiry_warning', 'system', 'Hệ thống',
				$2, $3)
			ON CONFLICT DO NOTHING
		`, e.ID, fmt.Sprintf("Hạn mức tín dụng %s sắp hết hạn trong %d ngày", e.CustomerName, e.DaysLeft), detail)
	}
	if len(expiring) > 0 {
		s.log.Info(ctx, "credit_limit_expiry_alerts", logger.F("count", len(expiring)))
	}
}

// ──── Routes CRUD ────

type RouteResponse struct {
	ID            uuid.UUID   `json:"id"`
	Code          string      `json:"code"`
	Name          string      `json:"name"`
	WarehouseID   uuid.UUID   `json:"warehouse_id"`
	WarehouseName string      `json:"warehouse_name"`
	CustomerIDs   []uuid.UUID `json:"customer_ids"`
	CustomerCount int         `json:"customer_count"`
	CreatedAt     string      `json:"created_at"`
}

func (s *Service) ListRoutes(ctx context.Context) ([]RouteResponse, error) {
	rows, err := s.db.Query(ctx, `
		SELECT r.id, r.code, r.name, r.warehouse_id,
		       COALESCE(w.name,'')::text AS warehouse_name,
		       r.customer_ids, array_length(r.customer_ids,1), r.created_at::text
		FROM delivery_routes r
		LEFT JOIN warehouses w ON w.id = r.warehouse_id
		ORDER BY r.code
	`)
	if err != nil {
		return nil, fmt.Errorf("list routes: %w", err)
	}
	defer rows.Close()

	var routes []RouteResponse
	for rows.Next() {
		var r RouteResponse
		var custCount *int
		if err := rows.Scan(&r.ID, &r.Code, &r.Name, &r.WarehouseID, &r.WarehouseName,
			&r.CustomerIDs, &custCount, &r.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan route: %w", err)
		}
		if custCount != nil {
			r.CustomerCount = *custCount
		}
		routes = append(routes, r)
	}
	if routes == nil {
		routes = []RouteResponse{}
	}
	return routes, nil
}

func (s *Service) CreateRoute(ctx context.Context, code, name string, warehouseID uuid.UUID, customerIDs []uuid.UUID) (*RouteResponse, error) {
	if customerIDs == nil {
		customerIDs = []uuid.UUID{}
	}
	var r RouteResponse
	err := s.db.QueryRow(ctx, `
		INSERT INTO delivery_routes (code, name, warehouse_id, customer_ids)
		VALUES ($1, $2, $3, $4)
		RETURNING id, code, name, warehouse_id, created_at::text
	`, code, name, warehouseID, customerIDs).Scan(&r.ID, &r.Code, &r.Name, &r.WarehouseID, &r.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("create route: %w", err)
	}
	r.CustomerIDs = customerIDs
	r.CustomerCount = len(customerIDs)
	return &r, nil
}

func (s *Service) UpdateRoute(ctx context.Context, id uuid.UUID, code, name *string, warehouseID *uuid.UUID, customerIDs []uuid.UUID) (*RouteResponse, error) {
	var r RouteResponse
	err := s.db.QueryRow(ctx, `
		UPDATE delivery_routes
		SET code = COALESCE($2, code),
		    name = COALESCE($3, name),
		    warehouse_id = COALESCE($4, warehouse_id),
		    customer_ids = COALESCE($5, customer_ids)
		WHERE id = $1
		RETURNING id, code, name, warehouse_id, customer_ids, created_at::text
	`, id, code, name, warehouseID, customerIDs).Scan(&r.ID, &r.Code, &r.Name, &r.WarehouseID, &r.CustomerIDs, &r.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("update route: %w", err)
	}
	r.CustomerCount = len(r.CustomerIDs)
	return &r, nil
}

func (s *Service) DeleteRoute(ctx context.Context, id uuid.UUID) error {
	_, err := s.db.Exec(ctx, `DELETE FROM delivery_routes WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("delete route: %w", err)
	}
	return nil
}

// ──── System Health ────

type HealthStatus struct {
	Status      string            `json:"status"`
	Uptime      string            `json:"uptime"`
	Services    []ServiceHealth   `json:"services"`
	DBStats     DBPoolStats       `json:"db_stats"`
	Counts      map[string]int    `json:"counts"`
	GPSTracking *GPSTrackingStats `json:"gps_tracking,omitempty"`
	RecentOps   *RecentOpsStats   `json:"recent_ops,omitempty"`
}

type ServiceHealth struct {
	Name    string `json:"name"`
	Status  string `json:"status"` // ok | degraded | down
	Latency int64  `json:"latency_ms"`
}

type DBPoolStats struct {
	TotalConns int32 `json:"total_conns"`
	IdleConns  int32 `json:"idle_conns"`
	MaxConns   int32 `json:"max_conns"`
}

type GPSTrackingStats struct {
	ActiveVehicles int `json:"active_vehicles"`
	StaleVehicles  int `json:"stale_vehicles"`
}

type RecentOpsStats struct {
	OrdersToday   int `json:"orders_today"`
	TripsActive   int `json:"trips_active"`
	AuditLogs24h  int `json:"audit_logs_24h"`
	Notifications int `json:"notifications_today"`
}

var startTime = time.Now()

func (s *Service) SystemHealth(ctx context.Context) (*HealthStatus, error) {
	h := &HealthStatus{
		Status: "ok",
		Uptime: time.Since(startTime).Round(time.Second).String(),
	}

	// DB check
	dbStart := time.Now()
	var dbOK int
	err := s.db.QueryRow(ctx, `SELECT 1`).Scan(&dbOK)
	dbLatency := time.Since(dbStart).Milliseconds()
	dbStatus := "ok"
	if err != nil {
		dbStatus = "down"
		h.Status = "degraded"
	} else if dbLatency > 500 {
		dbStatus = "degraded"
	}
	h.Services = append(h.Services, ServiceHealth{Name: "PostgreSQL", Status: dbStatus, Latency: dbLatency})

	// Redis check
	if s.rdb != nil {
		redisStart := time.Now()
		err := s.rdb.Ping(ctx).Err()
		redisLatency := time.Since(redisStart).Milliseconds()
		redisStatus := "ok"
		if err != nil {
			redisStatus = "down"
			h.Status = "degraded"
		} else if redisLatency > 100 {
			redisStatus = "degraded"
		}
		h.Services = append(h.Services, ServiceHealth{Name: "Redis", Status: redisStatus, Latency: redisLatency})
	}

	// VRP Solver check
	vrpStart := time.Now()
	vrpStatus := "ok"
	vrpClient := &http.Client{Timeout: 2 * time.Second}
	resp, err := vrpClient.Get("http://localhost:8090/health")
	vrpLatency := time.Since(vrpStart).Milliseconds()
	if err != nil || resp == nil {
		vrpStatus = "down"
	} else {
		resp.Body.Close()
		if resp.StatusCode != 200 {
			vrpStatus = "degraded"
		}
	}
	h.Services = append(h.Services, ServiceHealth{Name: "VRP Solver", Status: vrpStatus, Latency: vrpLatency})

	// DB pool stats
	poolStat := s.db.Stat()
	h.DBStats = DBPoolStats{
		TotalConns: poolStat.TotalConns(),
		IdleConns:  poolStat.IdleConns(),
		MaxConns:   poolStat.MaxConns(),
	}

	// Entity counts
	h.Counts = map[string]int{}
	countQueries := map[string]string{
		"users":      "SELECT COUNT(*) FROM users",
		"customers":  "SELECT COUNT(*) FROM customers",
		"orders":     "SELECT COUNT(*) FROM sales_orders",
		"trips":      "SELECT COUNT(*) FROM trips",
		"vehicles":   "SELECT COUNT(*) FROM vehicles",
		"warehouses": "SELECT COUNT(*) FROM warehouses",
	}
	for key, q := range countQueries {
		var c int
		if err := s.db.QueryRow(ctx, q).Scan(&c); err == nil {
			h.Counts[key] = c
		}
	}

	// GPS tracking stats
	if s.rdb != nil {
		gpsStats := &GPSTrackingStats{}
		positions, err := s.rdb.HGetAll(ctx, "gps:latest").Result()
		if err == nil {
			now := time.Now()
			for _, v := range positions {
				var pos struct {
					TS string `json:"ts"`
				}
				if json.Unmarshal([]byte(v), &pos) == nil {
					if t, err := time.Parse(time.RFC3339, pos.TS); err == nil {
						if now.Sub(t) < 5*time.Minute {
							gpsStats.ActiveVehicles++
						} else {
							gpsStats.StaleVehicles++
						}
					}
				}
			}
		}
		h.GPSTracking = gpsStats
	}

	// Recent operations stats
	ops := &RecentOpsStats{}
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE created_at::date = CURRENT_DATE`).Scan(&ops.OrdersToday)
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM trips WHERE status::text NOT IN ('completed','cancelled','closed')`).Scan(&ops.TripsActive)
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM audit_logs WHERE created_at > NOW() - INTERVAL '24 hours'`).Scan(&ops.AuditLogs24h)
	s.db.QueryRow(ctx, `SELECT COUNT(*) FROM notifications WHERE created_at::date = CURRENT_DATE`).Scan(&ops.Notifications)
	h.RecentOps = ops

	return h, nil
}
