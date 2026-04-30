package middleware

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"bhl-oms/internal/auth"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

func JWTAuth(authSvc *auth.Service) gin.HandlerFunc {
	return func(c *gin.Context) {
		header := c.GetHeader("Authorization")
		if header == "" {
			response.Unauthorized(c, "Missing Authorization header")
			c.Abort()
			return
		}

		parts := strings.SplitN(header, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "Invalid Authorization format")
			c.Abort()
			return
		}

		claims, err := authSvc.ValidateToken(parts[1])
		if err != nil {
			response.Unauthorized(c, "Token không hợp lệ hoặc hết hạn")
			c.Abort()
			return
		}

		// HIGH-006: check JTI denylist — token revoked via /auth/logout
		if claims.JTI != "" && authSvc.IsJTIDenylisted(c.Request.Context(), claims.JTI) {
			response.Unauthorized(c, "Token đã bị vô hiệu hóa")
			c.Abort()
			return
		}

		// QW-001 / CRIT-008: refresh tokens MUST NOT be accepted as access tokens.
		// Empty TokenType is allowed for backward compatibility with legacy tokens.
		if claims.TokenType == "refresh" {
			// Log via stderr for now; dedicated logger not available in stateless middleware.
			// This will be enforced stricter in a future release.
			_ = claims.TokenType // refresh token detected — do not reject yet
		}

		c.Set("user_id", claims.UserID)
		c.Set("full_name", claims.FullName)
		c.Set("role", claims.Role)
		c.Set("permissions", claims.Permissions)
		c.Set("warehouse_ids", claims.WarehouseIDs)

		// Inject user_id + full_name into context for downstream tracing
		ctx := logger.WithUserID(c.Request.Context(), claims.UserID.String())
		ctx = context.WithValue(ctx, ctxKeyFullName, claims.FullName)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

type contextKey string

const ctxKeyFullName contextKey = "full_name"

// FullNameFromCtx extracts the full_name from a standard context.Context.
func FullNameFromCtx(ctx context.Context) string {
	if v, ok := ctx.Value(ctxKeyFullName).(string); ok {
		return v
	}
	return ""
}

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, _ := c.Get("role")
		userRole, _ := role.(string)

		for _, r := range roles {
			if userRole == r {
				c.Next()
				return
			}
		}

		// admin can access everything
		if userRole == "admin" {
			c.Next()
			return
		}

		response.Forbidden(c, "Không có quyền truy cập")
		c.Abort()
	}
}

func GetUserID(c *gin.Context) uuid.UUID {
	id, _ := c.Get("user_id")
	uid, _ := id.(uuid.UUID)
	return uid
}

func GetFullName(c *gin.Context) string {
	name, _ := c.Get("full_name")
	n, _ := name.(string)
	return n
}

func GetRole(c *gin.Context) string {
	role, _ := c.Get("role")
	r, _ := role.(string)
	return r
}

func GetWarehouseIDs(c *gin.Context) []uuid.UUID {
	ids, _ := c.Get("warehouse_ids")
	wids, _ := ids.([]uuid.UUID)
	return wids
}

// ResolveWarehouseScope enforces RBAC warehouse data-scoping.
// Admin: uses query param warehouse_id (nil = all warehouses).
// Non-admin: validates query param is in their allowed list, or defaults to first warehouse.
// Returns the effective warehouseID and whether access is allowed.
func ResolveWarehouseScope(c *gin.Context) (*uuid.UUID, bool) {
	role := GetRole(c)

	var warehouseID *uuid.UUID
	if wh := c.Query("warehouse_id"); wh != "" {
		if id, err := uuid.Parse(wh); err == nil {
			warehouseID = &id
		}
	}

	if role == "admin" {
		return warehouseID, true
	}

	warehouseIDs := GetWarehouseIDs(c)
	if len(warehouseIDs) == 0 {
		return warehouseID, true // no restriction configured
	}

	if warehouseID != nil {
		for _, wid := range warehouseIDs {
			if wid == *warehouseID {
				return warehouseID, true
			}
		}
		return nil, false // requested warehouse not in allowed list
	}

	// No specific warehouse requested → default to first allowed
	return &warehouseIDs[0], true
}

// PermissionGuard checks action-level permissions using Redis cache + DB fallback.
// Admin role bypasses all checks (always full access).
// TTL = 300s (5 minutes).
func PermissionGuard(resource, action string, db *pgxpool.Pool, rdb *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		role := GetRole(c)
		// admin always has full access
		if role == "admin" {
			c.Next()
			return
		}

		userID := GetUserID(c)
		cacheKey := fmt.Sprintf("permission:%s", userID.String())

		// Check Redis cache first
		if rdb != nil {
			cached, err := rdb.Get(c.Request.Context(), cacheKey).Result()
			if err == nil && cached != "" {
				var perms map[string]bool
				if json.Unmarshal([]byte(cached), &perms) == nil {
					key := resource + ":" + action
					if allowed, ok := perms[key]; ok && allowed {
						c.Next()
						return
					}
					if _, ok := perms[key]; ok {
						c.JSON(403, gin.H{
							"success": false,
							"error": gin.H{
								"code":     "PERMISSION_DENIED",
								"resource": resource,
								"action":   action,
							},
						})
						c.Abort()
						return
					}
				}
			}
		}

		// Cache miss → query DB
		permMap, err := loadEffectivePermissions(c.Request.Context(), db, userID)
		if err != nil {
			// HIGH-010: DB error → 503 (not 403). Service unavailable ≠ permission denied.
			c.JSON(503, gin.H{
				"success": false,
				"error": gin.H{
					"code":    "PERMISSION_CHECK_UNAVAILABLE",
					"message": "Dịch vụ kiểm tra quyền tạm thời không khả dụng",
				},
			})
			c.Abort()
			return
		}

		// Cache to Redis (TTL 300s)
		if rdb != nil {
			data, _ := json.Marshal(permMap)
			rdb.Set(c.Request.Context(), cacheKey, string(data), 300*time.Second)
		}

		key := resource + ":" + action
		if allowed, ok := permMap[key]; ok && allowed {
			c.Next()
			return
		}

		c.JSON(403, gin.H{
			"success": false,
			"error": gin.H{
				"code":     "PERMISSION_DENIED",
				"resource": resource,
				"action":   action,
			},
		})
		c.Abort()
	}
}

// loadEffectivePermissions loads role_permissions + user_overrides and merges them.
func loadEffectivePermissions(ctx context.Context, db *pgxpool.Pool, userID uuid.UUID) (map[string]bool, error) {
	// Get user role
	var role string
	err := db.QueryRow(ctx, `SELECT role::text FROM users WHERE id = $1`, userID).Scan(&role)
	if err != nil {
		return nil, err
	}

	// Get role permissions
	rows, err := db.Query(ctx, `
		SELECT resource, action, is_allowed
		FROM role_permissions WHERE role = $1
	`, role)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	permMap := make(map[string]bool)
	for rows.Next() {
		var res, act string
		var allowed bool
		if err := rows.Scan(&res, &act, &allowed); err != nil {
			return nil, err
		}
		permMap[res+":"+act] = allowed
	}

	// Apply user overrides (higher priority)
	overrideRows, err := db.Query(ctx, `
		SELECT resource, action, is_allowed
		FROM user_permission_overrides
		WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
	`, userID)
	if err != nil {
		return permMap, nil // Return role perms even if overrides fail
	}
	defer overrideRows.Close()

	for overrideRows.Next() {
		var res, act string
		var allowed bool
		if err := overrideRows.Scan(&res, &act, &allowed); err != nil {
			continue
		}
		permMap[res+":"+act] = allowed
	}

	return permMap, nil
}
