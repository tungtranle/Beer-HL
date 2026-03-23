package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "bhl_http_requests_total",
		Help: "Total number of HTTP requests",
	}, []string{"method", "path", "status"})

	httpRequestDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "bhl_http_request_duration_seconds",
		Help:    "HTTP request duration in seconds",
		Buckets: []float64{0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10},
	}, []string{"method", "path"})

	httpRequestsInFlight = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "bhl_http_requests_in_flight",
		Help: "Number of HTTP requests currently being processed",
	})

	// Business metrics
	OrdersCreatedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "bhl_orders_created_total",
		Help: "Total orders created",
	})

	TripsCompletedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "bhl_trips_completed_total",
		Help: "Total trips completed",
	})

	StopsDeliveredTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "bhl_stops_delivered_total",
		Help: "Total stops delivered",
	})

	StopsFailedTotal = promauto.NewCounter(prometheus.CounterOpts{
		Name: "bhl_stops_failed_total",
		Help: "Total stops failed",
	})

	DBQueryDuration = promauto.NewHistogramVec(prometheus.HistogramOpts{
		Name:    "bhl_db_query_duration_seconds",
		Help:    "Database query duration in seconds",
		Buckets: []float64{0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5},
	}, []string{"query_type"})

	GPSWebSocketConnections = promauto.NewGauge(prometheus.GaugeOpts{
		Name: "bhl_gps_websocket_connections",
		Help: "Number of active GPS WebSocket connections",
	})

	IntegrationCallsTotal = promauto.NewCounterVec(prometheus.CounterOpts{
		Name: "bhl_integration_calls_total",
		Help: "Total external integration calls",
	}, []string{"adapter", "status"})
)

// PrometheusMiddleware collects HTTP request metrics.
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Normalize path to avoid high cardinality from UUIDs
		path := normalizePath(c.FullPath())
		if path == "" {
			path = "unknown"
		}

		httpRequestsInFlight.Inc()
		start := time.Now()

		c.Next()

		httpRequestsInFlight.Dec()
		duration := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())

		httpRequestsTotal.WithLabelValues(c.Request.Method, path, status).Inc()
		httpRequestDuration.WithLabelValues(c.Request.Method, path).Observe(duration)
	}
}

// normalizePath keeps route patterns (e.g. /v1/orders/:id) instead of actual IDs.
func normalizePath(p string) string {
	if p == "" {
		return ""
	}
	return p
}
