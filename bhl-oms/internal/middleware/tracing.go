package middleware

import (
	"time"

	"bhl-oms/pkg/logger"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// Tracing injects a trace_id into the request context and logs each HTTP request.
func Tracing(log logger.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		traceID := c.GetHeader("X-Trace-ID")
		if traceID == "" {
			traceID = uuid.New().String()
		}

		ctx := logger.WithTraceID(c.Request.Context(), traceID)
		c.Request = c.Request.WithContext(ctx)
		c.Header("X-Trace-ID", traceID)

		start := time.Now()
		c.Next()

		log.Info(ctx, "http_request",
			logger.F("method", c.Request.Method),
			logger.F("path", c.FullPath()),
			logger.F("status", c.Writer.Status()),
			logger.F("client_ip", c.ClientIP()),
			logger.Duration(time.Since(start)),
		)
	}
}
