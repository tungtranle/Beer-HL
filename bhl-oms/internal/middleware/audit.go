package middleware

import (
	"io"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// AuditLog logs all mutating API requests (POST/PUT/PATCH/DELETE) to the audit_logs table.
func AuditLog(pool *pgxpool.Pool) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Only audit mutating requests + important GETs on sensitive paths
		method := c.Request.Method
		if method == "GET" || method == "OPTIONS" || method == "HEAD" {
			c.Next()
			return
		}

		start := time.Now()

		// Read full request body, restore for downstream handlers, but only audit first 2KB
		var bodyStr string
		if c.Request.Body != nil {
			bodyBytes, _ := io.ReadAll(c.Request.Body)
			// Restore full body for downstream handlers
			c.Request.Body = io.NopCloser(strings.NewReader(string(bodyBytes)))
			// Truncate for audit storage
			if len(bodyBytes) > 2048 {
				bodyStr = string(bodyBytes[:2048]) + "...(truncated)"
			} else {
				bodyStr = string(bodyBytes)
			}
		}

		// Process request
		c.Next()

		// Extract user info from context (set by JWTAuth middleware)
		duration := time.Since(start).Milliseconds()
		userID, _ := c.Get("user_id")
		uid, _ := userID.(uuid.UUID)

		var uidPtr *uuid.UUID
		if uid != uuid.Nil {
			uidPtr = &uid
		}

		username := ""
		if u, ok := c.Get("username"); ok {
			username, _ = u.(string)
		}

		// Async insert to avoid slowing down response
		go func() {
			_, _ = pool.Exec(c.Request.Context(), `
				INSERT INTO audit_logs (user_id, username, method, path, status_code, duration_ms, ip_address, user_agent, request_body)
				VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
			`, uidPtr, username, method, c.Request.URL.Path, c.Writer.Status(),
				duration, c.ClientIP(), c.Request.UserAgent(), bodyStr)
		}()
	}
}
