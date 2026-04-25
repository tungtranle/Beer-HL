package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bhl-oms/internal/admin"
	"bhl-oms/internal/auth"

	"bhl-oms/internal/ai"
	"bhl-oms/internal/anomaly"
	"bhl-oms/internal/config"
	"bhl-oms/internal/events"
	"bhl-oms/internal/fleet"
	"bhl-oms/internal/gps"
	"bhl-oms/internal/integration"
	"bhl-oms/internal/kpi"
	"bhl-oms/internal/middleware"
	"bhl-oms/internal/mlfeatures"
	"bhl-oms/internal/notification"
	"bhl-oms/internal/oms"
	"bhl-oms/internal/reconciliation"
	"bhl-oms/internal/testportal"
	"bhl-oms/internal/tms"
	"bhl-oms/internal/wms"
	"bhl-oms/pkg/db"
	"bhl-oms/pkg/logger"
	bhlredis "bhl-oms/pkg/redis"
	"bhl-oms/pkg/response"

	"github.com/getsentry/sentry-go"
	sentrygin "github.com/getsentry/sentry-go/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"

	"github.com/gin-gonic/gin"
)

var (
	appVersion  = "1.0.0"
	buildCommit = "unknown"
	buildTime   = "unknown"
	buildBranch = "unknown"
)

func main() {
	cfg := config.Load()

	// Application logger
	appLog := logger.New(os.Stdout, logger.ParseLevel(getEnv("LOG_LEVEL", "INFO")))

	// Sentry error tracking
	if cfg.SentryDSN != "" {
		if err := sentry.Init(sentry.ClientOptions{
			Dsn:              cfg.SentryDSN,
			Environment:      cfg.Env,
			TracesSampleRate: 0.3,
			EnableTracing:    true,
		}); err != nil {
			appLog.Warn(context.Background(), "sentry_init_failed", logger.F("error", err.Error()))
		} else {
			appLog.Info(context.Background(), "sentry_initialized")
			defer sentry.Flush(2 * time.Second)
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Database
	pool, err := db.NewPool(ctx, cfg.DBURL)
	if err != nil {
		appLog.Fatal(ctx, "db_connect_failed", err)
	}
	defer pool.Close()
	appLog.Info(ctx, "db_connected", logger.F("driver", "pgx"))

	// Auth Service
	authSvc, err := auth.NewService(pool, cfg.JWTPrivKeyPath, cfg.JWTPubKeyPath, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	if err != nil {
		appLog.Fatal(ctx, "auth_init_failed", err)
	}
	appLog.Info(ctx, "auth_initialized", logger.F("algorithm", "RS256"))

	// Redis
	rdb := bhlredis.NewClient(cfg.RedisURL)
	if err := bhlredis.Ping(ctx, rdb); err != nil {
		appLog.Warn(ctx, "redis_unavailable", logger.F("error", err.Error()))
	} else {
		appLog.Info(ctx, "redis_connected")
	}
	defer rdb.Close()

	// GPS Hub (WebSocket + Redis pub/sub)
	gpsHub := gps.NewHub(rdb, authSvc, appLog)
	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()
	go gpsHub.Run(appCtx)

	// OMS
	omsRepo := oms.NewRepository(pool, appLog)
	omsSvc := oms.NewService(omsRepo, appLog)

	// Event Recorder (Activity Timeline)
	eventRecorder := events.NewRecorder(pool, appLog)
	omsSvc.SetEventRecorder(eventRecorder)
	appLog.Info(ctx, "event_recorder_initialized")

	// TMS
	tmsRepo := tms.NewRepository(pool, appLog)
	tmsSvc := tms.NewService(tmsRepo, omsRepo, cfg.VRPSolverURL, appLog)

	// WMS
	wmsRepo := wms.NewRepository(pool, appLog)
	wmsSvc := wms.NewService(wmsRepo, appLog)

	// Wire WMS into TMS for auto-creating picking orders on plan approval
	tmsSvc.SetPickingOrderCreator(wmsSvc)
	tmsSvc.SetEventRecorder(eventRecorder)

	// Gin Router
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS
	r.Use(corsMiddleware())

	// Sentry middleware — captures panics and reports to Sentry
	if cfg.SentryDSN != "" {
		r.Use(sentrygin.New(sentrygin.Options{Repanic: true}))
	}

	// Prometheus metrics
	r.Use(middleware.PrometheusMiddleware())
	r.GET("/metrics", gin.WrapH(promhttp.Handler()))

	// Tracing middleware — injects X-Trace-ID into context and logs requests
	r.Use(middleware.Tracing(appLog))

	// Health check
	r.GET("/health", func(c *gin.Context) {
		response.OK(c, gin.H{"status": "ok", "service": "bhl-oms-tms-wms"})
	})

	// App version check (Task 3.19) — public, no auth
	r.GET("/v1/app/version", func(c *gin.Context) {
		response.OK(c, gin.H{
			"current_version":  "1.0.0",
			"minimum_version":  "1.0.0",
			"force_update":     false,
			"update_url":       "https://oms.bhl.vn/update",
			"release_notes_vi": "Phiên bản đầu tiên – OMS/TMS/WMS",
			"commit_sha":       buildCommit,
			"build_time":       buildTime,
			"branch":           buildBranch,
			"service_version":  appVersion,
		})
	})

	// API v1
	v1 := r.Group("/v1")

	// Audit log middleware (Task 3.20) — logs POST/PUT/PATCH/DELETE
	v1.Use(middleware.AuditLog(pool))

	// Public routes (no auth)
	authHandler := auth.NewHandler(authSvc)
	authHandler.RegisterRoutes(v1)

	// Protected routes
	protected := v1.Group("")
	protected.Use(middleware.JWTAuth(authSvc))

	// OMS routes
	omsHandler := oms.NewHandler(omsSvc, appLog)
	omsHandler.RegisterRoutes(protected)

	// TMS routes
	tmsHandler := tms.NewHandler(tmsSvc, appLog)
	tmsHandler.RegisterRoutes(protected)

	// WMS routes
	wmsHandler := wms.NewHandler(wmsSvc, appLog)
	wmsHandler.RegisterRoutes(protected)

	// Reconciliation routes (Tasks 3.9-3.11)
	reconRepo := reconciliation.NewRepository(pool, appLog)
	reconSvc := reconciliation.NewService(reconRepo, appLog)
	reconSvc.SetDB(pool)
	reconHandler := reconciliation.NewHandler(reconSvc, appLog)
	reconHandler.RegisterRoutes(protected)

	// Notification module (Task 3.14)
	notifHub := notification.NewHub()
	notifRepo := notification.NewRepository(pool, appLog)
	notifSvc := notification.NewService(notifRepo, notifHub, appLog)
	notifHandler := notification.NewHandler(notifSvc, notifHub, authSvc, appLog)
	notifHandler.RegisterRoutes(protected)
	notifHandler.RegisterWebSocket(r)
	appLog.Info(ctx, "notification_initialized")
	_ = notifSvc // available for integration hooks

	// Wire real-time order updates: Recorder → NotifHub → WebSocket → Frontend
	eventRecorder.SetBroadcaster(notifHub)

	// Wire notification service into OMS
	omsSvc.SetNotificationService(notifSvc)

	// Event Timeline + Order Notes
	eventsHandler := events.NewHandler(eventRecorder, appLog)
	eventsHandler.RegisterRoutes(protected)
	appLog.Info(ctx, "events_timeline_initialized")

	// KPI module (Tasks 3.16-3.17)
	kpiRepo := kpi.NewRepository(pool, appLog)
	kpiSvc := kpi.NewService(kpiRepo, appLog)
	kpiHandler := kpi.NewHandler(kpiSvc, appLog)
	kpiHandler.RegisterRoutes(protected)
	go kpiSvc.RunDailySnapshotCron(appCtx)
	appLog.Info(ctx, "kpi_initialized", logger.F("cron", "23:50"))

	// ML Features module (World-Class Strategy F2 NPP Health, F3 Smart Suggestions, F15 Feedback)
	mlRepo := mlfeatures.NewRepository(pool, appLog)
	mlSvc := mlfeatures.NewService(mlRepo, appLog)
	mlHandler := mlfeatures.NewHandler(mlSvc, appLog)
	mlHandler.RegisterRoutes(protected)
	appLog.Info(ctx, "ml_features_initialized", logger.F("endpoints", "/v1/ml/*"))

	// F7 GPS Anomaly Detection (Sprint 1 W3)
	anomalyRepo := anomaly.NewRepository(pool, appLog)
	anomalySvc := anomaly.NewService(anomalyRepo, appLog)
	anomalyHandler := anomaly.NewHandler(anomalySvc, appLog)
	anomalyHandler.RegisterRoutes(protected)
	gpsHub.SetDetector(anomalySvc)
	appLog.Info(ctx, "anomaly_initialized", logger.F("endpoints", "/v1/anomalies/*"))

	// AI Intelligence Layer (Sprint 2) — Gemini free → Groq → Mock rules
	aiProvider := ai.NewDefaultProvider()
	aiRepo := ai.NewRepository(pool, appLog)
	aiSvc := ai.NewService(aiRepo, aiProvider, appLog)
	aiHandler := ai.NewHandler(aiSvc, appLog)
	aiHandler.RegisterRoutes(protected)
	go aiSvc.RunDailyBriefingCron(appCtx)
	appLog.Info(ctx, "ai_initialized", logger.F("provider", aiProvider.Name()))

	// Fleet & Driver Management (Phase 8)
	fleetRepo := fleet.NewRepository(pool, appLog)
	fleetSvc := fleet.NewService(fleetRepo, appLog)
	fleetHandler := fleet.NewHandler(fleetSvc, appLog)
	fleetHandler.RegisterRoutes(protected)
	appLog.Info(ctx, "fleet_module_initialized")

	// Integration adapters (Task 3.1-3.5)
	bravoAdapter := integration.NewBravoAdapter(cfg.BravoURL, cfg.BravoAPIKey, cfg.IntegrationMock, appLog)
	dmsAdapter := integration.NewDMSAdapter(cfg.DMSURL, cfg.DMSAPIKey, cfg.IntegrationMock, appLog)
	zaloAdapter := integration.NewZaloAdapter(cfg.ZaloBaseURL, cfg.ZaloOAToken, cfg.ZaloOAID, cfg.IntegrationMock, appLog)
	confirmSvc := integration.NewConfirmService(pool, zaloAdapter, appLog)
	dlqSvc := integration.NewDLQService(pool, appLog)
	integrationHandler := integration.NewHandler(bravoAdapter, dmsAdapter, zaloAdapter, confirmSvc, dlqSvc)
	integrationHandler.SetOrderConfirmCallback(omsSvc) // Wire OMS for order confirm/reject
	integrationHandler.SetNotificationSender(notifSvc) // Wire notification for DVKH alerts
	integrationHandler.RegisterRoutes(protected)
	integrationHandler.RegisterPublicRoutes(v1) // NPP portal (no auth)

	// Integration hooks — wire adapters into business flows (Tasks 3.1-3.6)
	baseURL := "http://localhost:" + cfg.ServerPort
	if cfg.Env == "production" {
		baseURL = "https://oms.bhl.vn"
	}
	integrationHooks := integration.NewHooks(bravoAdapter, dmsAdapter, confirmSvc, pool, baseURL, appLog)
	tmsSvc.SetIntegrationHooks(integrationHooks)
	omsSvc.SetIntegrationHooks(integrationHooks)
	appLog.Info(ctx, "integration_hooks_wired", logger.F("adapters", "bravo,dms,zalo"))

	// Start auto-confirm cron (Task 3.7)
	go confirmSvc.RunAutoConfirmCron(appCtx)

	// Start order auto-confirm cron (2h timeout)
	go confirmSvc.RunOrderAutoConfirmCron(appCtx)

	// Start nightly Bravo reconcile cron (Task 3.2)
	go integrationHooks.RunNightlyReconcileCron(appCtx)

	// Wire notification into TMS + WMS + start document expiry cron
	tmsSvc.SetNotificationService(notifSvc)
	tmsSvc.SetReconciliationService(reconSvc)
	tmsSvc.SetVRPBroadcaster(notifHub) // VRP real-time progress via WebSocket
	wmsSvc.SetNotificationService(notifSvc)
	go tmsSvc.RunDocumentExpiryCron(appCtx)
	appLog.Info(ctx, "document_expiry_cron_started", logger.F("cron", "07:00_daily"))

	// GPS routes (REST)
	gpsHandler := gps.NewHandler(gpsHub, pool)
	gpsHandler.RegisterRoutes(protected)

	// GPS Simulation (admin/dispatcher only)
	gpsSim := gps.NewSimController(gpsHub, pool, appLog)
	gpsSim.RegisterRoutes(protected)

	// Admin module — user management
	adminRepo := admin.NewRepository(pool, appLog)
	adminSvc := admin.NewService(pool, rdb, adminRepo, appLog)
	adminHandler := admin.NewHandler(adminSvc, appLog)
	adminHandler.RegisterRoutes(protected)
	go adminSvc.RunCreditLimitExpiryCron(ctx)

	// BRD gap admin features (compensation, forbidden hours, delivery windows, maintenance)
	brdGapRepo := admin.NewBRDGapRepo(pool)
	adminGroup := protected.Group("/admin")
	adminGroup.Use(middleware.RequireRole("admin"))
	admin.RegisterBRDGapRoutes(adminGroup, brdGapRepo)

	appLog.Info(ctx, "admin_initialized")

	// Test Portal — QA/testing module (no auth, guarded by ENABLE_TEST_PORTAL env)
	if cfg.EnableTestPortal {
		testPortalHandler := testportal.NewHandler(pool, rdb, appLog, cfg.OSRMURL)
		testPortalHandler.RegisterRoutes(v1)
		appLog.Info(ctx, "test_portal_initialized")
	} else {
		appLog.Info(ctx, "test_portal_disabled")
	}

	// GPS WebSocket (authenticated via query token)
	r.GET("/ws/gps", gpsHub.HandleWebSocket)

	// Dashboard stats (Task 3.15 — 5 widgets)
	protected.GET("/dashboard/stats", func(c *gin.Context) {
		ctx := context.Background()

		// Widget 1: Orders today
		var ordersToday, ordersConfirmed int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE created_at::date = CURRENT_DATE`).Scan(&ordersToday)
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE created_at::date = CURRENT_DATE AND status = 'confirmed'`).Scan(&ordersConfirmed)

		// Widget 2: Active trips
		var activeTrips, completedTripsToday int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM trips WHERE status NOT IN ('completed','cancelled','closed')`).Scan(&activeTrips)
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM trips WHERE status = 'completed' AND completed_at::date = CURRENT_DATE`).Scan(&completedTripsToday)

		// Widget 3: Delivery success rate (today)
		var deliveredStops, totalStopsToday int64
		pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM trip_stops ts JOIN trips t ON t.id = ts.trip_id
			WHERE t.planned_date = CURRENT_DATE::text AND ts.status = 'delivered'
		`).Scan(&deliveredStops)
		pool.QueryRow(ctx, `
			SELECT COUNT(*) FROM trip_stops ts JOIN trips t ON t.id = ts.trip_id
			WHERE t.planned_date = CURRENT_DATE::text AND ts.status IN ('delivered','failed')
		`).Scan(&totalStopsToday)
		var deliveryRate float64
		if totalStopsToday > 0 {
			deliveryRate = float64(deliveredStops) / float64(totalStopsToday) * 100
		}

		// Widget 4: Revenue today (from payments)
		var revenueToday float64
		pool.QueryRow(ctx, `SELECT COALESCE(SUM(amount), 0) FROM payments WHERE collected_at::date = CURRENT_DATE AND status = 'confirmed'`).Scan(&revenueToday)

		// Widget 5: Pending discrepancies
		var pendingDiscrepancies int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM discrepancies WHERE status IN ('open','investigating')`).Scan(&pendingDiscrepancies)

		// Extra stats
		var productCount, customerCount int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM products WHERE is_active = true`).Scan(&productCount)
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM customers WHERE is_active = true`).Scan(&customerCount)

		var pendingShipments int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE status = 'confirmed'`).Scan(&pendingShipments)

		var pendingApprovals int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval'`).Scan(&pendingApprovals)

		var totalOrders int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders`).Scan(&totalOrders)

		response.OK(c, gin.H{
			"total_orders":          totalOrders,
			"orders_today":          ordersToday,
			"orders_confirmed":      ordersConfirmed,
			"active_trips":          activeTrips,
			"completed_trips_today": completedTripsToday,
			"delivery_rate":         deliveryRate,
			"delivered_stops":       deliveredStops,
			"total_stops_today":     totalStopsToday,
			"revenue_today":         revenueToday,
			"pending_discrepancies": pendingDiscrepancies,
			"pending_approvals":     pendingApprovals,
			"pending_shipments":     pendingShipments,
			"total_products":        productCount,
			"total_customers":       customerCount,
		})
	})

	// Warehouses endpoint
	protected.GET("/warehouses", func(c *gin.Context) {
		rows, err := pool.Query(context.Background(), `
			SELECT id, name, code, latitude, longitude, address 
			FROM warehouses WHERE path IS NULL AND is_active = true ORDER BY name
		`)
		if err != nil {
			response.InternalError(c)
			return
		}
		defer rows.Close()

		type wh struct {
			ID        string   `json:"id"`
			Name      string   `json:"name"`
			Code      string   `json:"code"`
			Latitude  *float64 `json:"latitude"`
			Longitude *float64 `json:"longitude"`
			Address   *string  `json:"address"`
		}
		var warehouses []wh
		for rows.Next() {
			var w wh
			rows.Scan(&w.ID, &w.Name, &w.Code, &w.Latitude, &w.Longitude, &w.Address)
			warehouses = append(warehouses, w)
		}
		response.OK(c, warehouses)
	})

	// Start server
	srv := &http.Server{
		Addr:    ":" + cfg.ServerPort,
		Handler: r,
	}

	go func() {
		appLog.Info(context.Background(), "server_starting", logger.F("port", cfg.ServerPort))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			appLog.Fatal(context.Background(), "server_error", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	appLog.Info(context.Background(), "server_shutting_down")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		appLog.Error(context.Background(), "server_forced_shutdown", err)
	}
	appLog.Info(context.Background(), "server_exited")
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-ID")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "X-Trace-ID")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
