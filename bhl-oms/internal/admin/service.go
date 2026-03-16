package admin

import (
	"context"
	"fmt"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
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
	case "management":
		return []string{"kpi.read", "orders.approve", "dashboard.read"}
	default:
		return []string{}
	}
}
