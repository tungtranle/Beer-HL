package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/google/uuid"

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

	// Redis (init early so auth.Service can use it for rate-limiting and denylist)
	rdb := bhlredis.NewClient(cfg.RedisURL)
	if err := bhlredis.Ping(ctx, rdb); err != nil {
		appLog.Warn(ctx, "redis_unavailable", logger.F("error", err.Error()))
	} else {
		appLog.Info(ctx, "redis_connected")
	}
	defer rdb.Close()

	// Auth Service
	authSvc, err := auth.NewService(pool, rdb, cfg.JWTPrivKeyPath, cfg.JWTPubKeyPath, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	if err != nil {
		appLog.Fatal(ctx, "auth_init_failed", err)
	}
	appLog.Info(ctx, "auth_initialized", logger.F("algorithm", "RS256"))

	// GPS Hub (WebSocket + Redis pub/sub)
	// HIGH-007: split AllowedOrigins env var into slice
	var allowedOrigins []string
	if cfg.AllowedOrigins != "" {
		for _, o := range strings.Split(cfg.AllowedOrigins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				allowedOrigins = append(allowedOrigins, trimmed)
			}
		}
	}
	gpsHub := gps.NewHub(rdb, authSvc, appLog, pool, allowedOrigins)
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
	notifSvc.StartEscalationCron()
	notifSvc.StartCleanupCron()
	appLog.Info(ctx, "notification_initialized")
	_ = notifSvc // available for integration hooks

	// Wire real-time order updates: Recorder → NotifHub → WebSocket → Frontend
	eventRecorder.SetBroadcaster(notifHub)

	// Wire notification service into OMS
	omsSvc.SetNotificationService(notifSvc)

	// Wire notification service into reconciliation (discrepancy_open notifications)
	reconSvc.SetNotificationService(notifSvc)

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

	// Test Portal — QA/testing module (auth required, guarded by ENABLE_TEST_PORTAL env)
	if cfg.EnableTestPortal {
		testPortalHandler := testportal.NewHandler(pool, rdb, appLog, cfg.OSRMURL)
		testPortalProtected := protected.Group("")
		testPortalProtected.Use(middleware.RequireRole("admin", "management"))
		testPortalHandler.RegisterRoutes(testPortalProtected)
		appLog.Info(ctx, "test_portal_initialized", logger.F("auth", "admin,management"))
	} else {
		appLog.Info(ctx, "test_portal_disabled")
	}

	// GPS WebSocket (authenticated via query token)
	r.GET("/ws/gps", gpsHub.HandleWebSocket)

	// Dashboard stats (Task 3.15 — 5 widgets)
	protected.GET("/dashboard/stats", func(c *gin.Context) {
		ctx := context.Background()
		now := time.Now()
		monthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		scopeFrom := monthStart.Format("2006-01-02")
		scopeTo := now.Format("2006-01-02")
		scopeLabel := "Tháng " + now.Format("01/2006")

		// Widget 1: Orders intake (CREATED) in current month + today's intake.
		// Note: "Đơn trong tháng" = orders created this month — matches the
		// "X mới hôm nay" sub-text which counts orders created today.
		// Cast ::date to be explicit about pgx parameter typing (see AI_LESSONS).
		var totalOrders, ordersToday, ordersConfirmed int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE created_at >= $1::date AND created_at < ($2::date + INTERVAL '1 day')`, scopeFrom, scopeTo).Scan(&totalOrders)
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
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE status IN ('confirmed','shipment_created','planned','picking','loaded')`).Scan(&pendingShipments)

		var pendingApprovals int64
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM sales_orders WHERE status = 'pending_approval'`).Scan(&pendingApprovals)

		response.OK(c, gin.H{
			"total_orders":          totalOrders,
			"scope_from":            scopeFrom,
			"scope_to":              scopeTo,
			"scope_label":           scopeLabel,
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

	// VRP delivery constraints per customer (Phase B — Task 3)
	// GET  /v1/customers/:id/vrp-constraints — read constraints
	// PUT  /v1/customers/:id/vrp-constraints — update (admin/dispatcher only)
	protected.GET("/customers/:id/vrp-constraints", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "invalid id")
			return
		}
		var maxKg int
		var dw, fw []byte
		var notes *string
		err = pool.QueryRow(context.Background(),
			`SELECT max_vehicle_weight_kg, delivery_windows, forbidden_windows, access_notes
			 FROM customers WHERE id = $1`, id,
		).Scan(&maxKg, &dw, &fw, &notes)
		if err != nil {
			response.NotFound(c, "customer not found")
			return
		}
		response.OK(c, gin.H{
			"max_vehicle_weight_kg": maxKg,
			"delivery_windows":      json.RawMessage(dw),
			"forbidden_windows":     json.RawMessage(fw),
			"access_notes":          notes,
		})
	})

	protected.PUT("/customers/:id/vrp-constraints",
		middleware.RequireRole("admin", "dispatcher"),
		func(c *gin.Context) {
			id, err := uuid.Parse(c.Param("id"))
			if err != nil {
				response.BadRequest(c, "invalid id")
				return
			}
			var req struct {
				MaxVehicleWeightKg int             `json:"max_vehicle_weight_kg"`
				DeliveryWindows    json.RawMessage `json:"delivery_windows"`
				ForbiddenWindows   json.RawMessage `json:"forbidden_windows"`
				AccessNotes        *string         `json:"access_notes"`
			}
			if err := c.ShouldBindJSON(&req); err != nil {
				response.BadRequest(c, err.Error())
				return
			}
			if len(req.DeliveryWindows) == 0 {
				req.DeliveryWindows = json.RawMessage("[]")
			}
			if len(req.ForbiddenWindows) == 0 {
				req.ForbiddenWindows = json.RawMessage("[]")
			}
			tag, err := pool.Exec(context.Background(),
				`UPDATE customers SET
				   max_vehicle_weight_kg = $2,
				   delivery_windows      = $3::jsonb,
				   forbidden_windows     = $4::jsonb,
				   access_notes          = $5,
				   updated_at            = now()
				 WHERE id = $1`,
				id, req.MaxVehicleWeightKg, string(req.DeliveryWindows), string(req.ForbiddenWindows), req.AccessNotes,
			)
			if err != nil {
				appLog.Error(c, "update vrp constraints failed", err)
				response.InternalError(c)
				return
			}
			if tag.RowsAffected() == 0 {
				response.NotFound(c, "customer not found")
				return
			}
			response.OK(c, gin.H{"updated": true})
		})

	// Phase C — Asset Passport (vehicle + driver timeline & stats)
	// GET /v1/vehicles/:id/timeline       — chronological events (workorders, fuel, accidents, doc renewals)
	// GET /v1/vehicles/:id/utilization    — total km, active days, avg km/day, last service
	// GET /v1/drivers/:id/timeline        — trips, scores, leaves, badges (chronological)
	// GET /v1/drivers/:id/career-stats    — career aggregates: years_active, total_trips, total_km, badges, score
	protected.GET("/vehicles/:id/timeline", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "invalid id")
			return
		}
		type Event struct {
			At       time.Time              `json:"at"`
			Kind     string                 `json:"kind"`
			Title    string                 `json:"title"`
			Subtitle string                 `json:"subtitle,omitempty"`
			Amount   *float64               `json:"amount_vnd,omitempty"`
			Meta     map[string]interface{} `json:"meta,omitempty"`
		}
		events := make([]Event, 0, 64)

		// Work orders
		if rows, err := pool.Query(c, `
			SELECT created_at, COALESCE(category::text,'maintenance'), COALESCE(description,''),
			       COALESCE(actual_amount, quoted_amount, 0)::float8, COALESCE(status::text,'')
			FROM work_orders WHERE vehicle_id = $1 ORDER BY created_at DESC LIMIT 200`, id); err == nil {
			for rows.Next() {
				var at time.Time
				var kind, desc, status string
				var cost float64
				if err := rows.Scan(&at, &kind, &desc, &cost, &status); err == nil {
					amt := cost
					events = append(events, Event{
						At: at, Kind: "workorder",
						Title:    "Work order: " + kind,
						Subtitle: desc,
						Amount:   &amt,
						Meta:     map[string]interface{}{"status": status},
					})
				}
			}
			rows.Close()
		}

		// Fuel logs
		if rows, err := pool.Query(c, `
			SELECT log_date, COALESCE(liters_filled,0)::float8, COALESCE(amount_vnd,0)::float8, COALESCE(km_odometer,0)::int
			FROM fuel_logs WHERE vehicle_id = $1 ORDER BY log_date DESC LIMIT 200`, id); err == nil {
			for rows.Next() {
				var at time.Time
				var liters, cost float64
				var km int
				if err := rows.Scan(&at, &liters, &cost, &km); err == nil {
					amt := cost
					events = append(events, Event{
						At: at, Kind: "fuel",
						Title:    "Đổ dầu",
						Subtitle: "lít / km tổng",
						Amount:   &amt,
						Meta:     map[string]interface{}{"liters": liters, "odometer_km": km},
					})
				}
			}
			rows.Close()
		}

		// Trips (start/completion events)
		if rows, err := pool.Query(c, `
			SELECT t.started_at, t.completed_at, COALESCE(t.trip_number,''), COALESCE(d.full_name,''), COALESCE(t.total_distance_km,0)::float8
			FROM trips t LEFT JOIN drivers d ON d.id = t.driver_id
			WHERE t.vehicle_id = $1 ORDER BY GREATEST(COALESCE(t.completed_at, 'epoch'::timestamptz), COALESCE(t.started_at, 'epoch'::timestamptz)) DESC LIMIT 200`, id); err == nil {
			for rows.Next() {
				var started, completed *time.Time
				var tripNum, driverName string
				var km float64
				if err := rows.Scan(&started, &completed, &tripNum, &driverName, &km); err == nil {
					if completed != nil {
						events = append(events, Event{
							At: *completed, Kind: "trip_complete",
							Title:    "Chuyến hoàn tất: " + tripNum,
							Subtitle: driverName,
							Meta:     map[string]interface{}{"distance_km": km},
						})
					}
					if started != nil {
						events = append(events, Event{
							At: *started, Kind: "trip_start",
							Title:    "Bắt đầu chuyến: " + tripNum,
							Subtitle: driverName,
							Meta:     map[string]interface{}{"distance_km": km},
						})
					}
				}
			}
			rows.Close()
		}

		// Vehicle maintenance records (completed events)
		if rows, err := pool.Query(c, `
			SELECT COALESCE(completed_at, last_maintenance_date), maintenance_type, COALESCE(notes,''), COALESCE(last_maintenance_km,0)
			FROM vehicle_maintenance_records WHERE vehicle_id = $1 ORDER BY COALESCE(completed_at, last_maintenance_date) DESC LIMIT 100`, id); err == nil {
			for rows.Next() {
				var at *time.Time
				var mtype, notes string
				var km int
				if err := rows.Scan(&at, &mtype, &notes, &km); err == nil && at != nil {
					events = append(events, Event{
						At: *at, Kind: "maintenance",
						Title:    "Bảo dưỡng: " + mtype,
						Subtitle: notes,
						Meta:     map[string]interface{}{"odometer_km": km},
					})
				}
			}
			rows.Close()
		}

		// Vehicle documents (issued / expiry events)
		if rows, err := pool.Query(c, `
			SELECT issued_date, expiry_date, doc_type, COALESCE(doc_number,'')
			FROM vehicle_documents WHERE vehicle_id = $1 ORDER BY GREATEST(COALESCE(expiry_date, 'epoch'::date), COALESCE(issued_date, 'epoch'::date)) DESC LIMIT 100`, id); err == nil {
			for rows.Next() {
				var issued, expiry *time.Time
				var dtype, number string
				if err := rows.Scan(&issued, &expiry, &dtype, &number); err == nil {
					if expiry != nil {
						// expiry event
						events = append(events, Event{
							At: *expiry, Kind: "doc_expiry",
							Title:    "Hết hạn giấy tờ: " + dtype,
							Subtitle: number,
						})
					}
					if issued != nil {
						events = append(events, Event{
							At: *issued, Kind: "doc_issued",
							Title:    "Cấp giấy tờ: " + dtype,
							Subtitle: number,
						})
					}
				}
			}
			rows.Close()
		}

		// Sort newest-first
		// (already roughly sorted but combined)
		// simple insertion-ish sort by At desc
		for i := 1; i < len(events); i++ {
			for j := i; j > 0 && events[j].At.After(events[j-1].At); j-- {
				events[j], events[j-1] = events[j-1], events[j]
			}
		}
		response.OK(c, events)
	})

	protected.GET("/vehicles/:id/utilization", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "invalid id")
			return
		}
		var totalKm float64
		var activeDays int
		var totalTrips int
		var firstSeen, lastSeen *time.Time
		_ = pool.QueryRow(c, `
			SELECT
			  COALESCE(SUM(total_distance_km),0)::float8,
			  COUNT(DISTINCT planned_date),
			  COUNT(*),
			  MIN(started_at),
			  MAX(started_at)
			FROM trips
			WHERE vehicle_id = $1 AND status = 'completed'`,
			id,
		).Scan(&totalKm, &activeDays, &totalTrips, &firstSeen, &lastSeen)

		avgKmPerDay := 0.0
		if activeDays > 0 {
			avgKmPerDay = totalKm / float64(activeDays)
		}

		// Last service (most recent completed work order)
		var lastService *time.Time
		_ = pool.QueryRow(c, `
			SELECT MAX(actual_completion) FROM work_orders WHERE vehicle_id = $1 AND status = 'completed'`, id,
		).Scan(&lastService)

		response.OK(c, gin.H{
			"total_km":        totalKm,
			"active_days":     activeDays,
			"total_trips":     totalTrips,
			"avg_km_per_day":  avgKmPerDay,
			"first_trip_at":   firstSeen,
			"last_trip_at":    lastSeen,
			"last_service_at": lastService,
		})
	})

	protected.GET("/drivers/:id/timeline", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "invalid id")
			return
		}
		type Event struct {
			At       time.Time              `json:"at"`
			Kind     string                 `json:"kind"`
			Title    string                 `json:"title"`
			Subtitle string                 `json:"subtitle,omitempty"`
			Score    *float64               `json:"score,omitempty"`
			Meta     map[string]interface{} `json:"meta,omitempty"`
		}
		events := make([]Event, 0, 64)

		// Recent trips
		if rows, err := pool.Query(c, `
			SELECT t.started_at, COALESCE(t.status::text,''), COALESCE(t.total_distance_km,0)::float8,
			       COALESCE(v.plate_number,'')
			FROM trips t LEFT JOIN vehicles v ON v.id = t.vehicle_id
			WHERE t.driver_id = $1 AND t.started_at IS NOT NULL ORDER BY t.started_at DESC LIMIT 100`, id); err == nil {
			for rows.Next() {
				var at time.Time
				var status, plate string
				var km float64
				if err := rows.Scan(&at, &status, &km, &plate); err == nil {
					events = append(events, Event{
						At: at, Kind: "trip",
						Title:    "Chuyến: " + plate,
						Subtitle: status,
						Meta:     map[string]interface{}{"distance_km": km},
					})
				}
			}
			rows.Close()
		}

		// Score history
		if rows, err := pool.Query(c, `
			SELECT score_date, COALESCE(total_score,0)::float8
			FROM driver_scores WHERE driver_id = $1 ORDER BY score_date DESC LIMIT 60`, id); err == nil {
			for rows.Next() {
				var at time.Time
				var score float64
				if err := rows.Scan(&at, &score); err == nil {
					s := score
					events = append(events, Event{
						At: at, Kind: "score",
						Title: "Điểm thi đua",
						Score: &s,
					})
				}
			}
			rows.Close()
		}

		// Leave requests
		if rows, err := pool.Query(c, `
			SELECT created_at, COALESCE(leave_type::text,''), COALESCE(status::text,''), COALESCE(reason,''),
			       COALESCE((end_date - start_date) + 1, 0) AS days
			FROM leave_requests WHERE driver_id = $1 ORDER BY created_at DESC LIMIT 30`, id); err == nil {
			for rows.Next() {
				var at time.Time
				var lt, status, reason string
				var days int
				if err := rows.Scan(&at, &lt, &status, &reason, &days); err == nil {
					events = append(events, Event{
						At: at, Kind: "leave",
						Title:    "Nghỉ phép: " + lt,
						Subtitle: reason,
						Meta:     map[string]interface{}{"status": status, "days": days},
					})
				}
			}
			rows.Close()
		}

		// Badge awards
		if rows, err := pool.Query(c, `
			SELECT ba.awarded_at, COALESCE(b.name, ba.badge_id::text), COALESCE(b.description,''), COALESCE(ba.bonus_vnd,0)::float8
			FROM badge_awards ba LEFT JOIN gamification_badges b ON b.id = ba.badge_id
			WHERE ba.driver_id = $1 ORDER BY ba.awarded_at DESC LIMIT 30`, id); err == nil {
			for rows.Next() {
				var at time.Time
				var name, desc string
				var bonus float64
				if err := rows.Scan(&at, &name, &desc, &bonus); err == nil {
					b := bonus
					events = append(events, Event{
						At: at, Kind: "badge",
						Title:    "🏅 " + name,
						Subtitle: desc,
						Meta:     map[string]interface{}{"bonus_vnd": b},
					})
				}
			}
			rows.Close()
		}

		// Sort newest-first
		for i := 1; i < len(events); i++ {
			for j := i; j > 0 && events[j].At.After(events[j-1].At); j-- {
				events[j], events[j-1] = events[j-1], events[j]
			}
		}
		response.OK(c, events)
	})

	protected.GET("/drivers/:id/career-stats", func(c *gin.Context) {
		id, err := uuid.Parse(c.Param("id"))
		if err != nil {
			response.BadRequest(c, "invalid id")
			return
		}
		var totalTrips int
		var totalKm float64
		var firstTrip, lastTrip *time.Time
		_ = pool.QueryRow(c, `
			SELECT COUNT(*), COALESCE(SUM(total_distance_km),0)::float8, MIN(started_at), MAX(started_at)
			FROM trips WHERE driver_id = $1 AND status = 'completed'`, id,
		).Scan(&totalTrips, &totalKm, &firstTrip, &lastTrip)

		var currentScore float64
		var fullName string
		var hireDate *time.Time
		_ = pool.QueryRow(c, `
			SELECT COALESCE(current_score,0)::float8, COALESCE(full_name,''), created_at
			FROM drivers WHERE id = $1`, id,
		).Scan(&currentScore, &fullName, &hireDate)

		yearsActive := 0.0
		if firstTrip != nil {
			yearsActive = time.Since(*firstTrip).Hours() / (24.0 * 365.25)
		}

		// Badges count
		var badgeCount int
		_ = pool.QueryRow(c,
			`SELECT COUNT(*) FROM badge_awards WHERE driver_id = $1`, id,
		).Scan(&badgeCount)

		// Avg score last 90 days
		var avgScore90 float64
		_ = pool.QueryRow(c, `
			SELECT COALESCE(AVG(total_score),0)::float8 FROM driver_scores
			WHERE driver_id = $1 AND score_date >= now() - interval '90 days'`, id,
		).Scan(&avgScore90)

		response.OK(c, gin.H{
			"full_name":     fullName,
			"hire_date":     hireDate,
			"years_active":  yearsActive,
			"total_trips":   totalTrips,
			"total_km":      totalKm,
			"current_score": currentScore,
			"avg_score_90d": avgScore90,
			"badge_count":   badgeCount,
			"first_trip_at": firstTrip,
			"last_trip_at":  lastTrip,
		})
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
