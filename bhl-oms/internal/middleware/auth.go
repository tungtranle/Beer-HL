package middleware

import (
	"strings"

	"bhl-oms/internal/auth"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Set("permissions", claims.Permissions)
		c.Set("warehouse_ids", claims.WarehouseIDs)
		c.Next()
	}
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
