package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bhl-oms/internal/admin"
	"bhl-oms/internal/auth"
	"bhl-oms/internal/config"
	"bhl-oms/internal/gps"
	"bhl-oms/internal/integration"
	"bhl-oms/internal/kpi"
	"bhl-oms/internal/middleware"
	"bhl-oms/internal/notification"
	"bhl-oms/internal/oms"
	"bhl-oms/internal/reconciliation"
	"bhl-oms/internal/tms"
	"bhl-oms/internal/wms"
	"bhl-oms/pkg/db"
	bhlredis "bhl-oms/pkg/redis"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Database
	pool, err := db.NewPool(ctx, cfg.DBURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()
	log.Println("✅ Connected to PostgreSQL")

	// Auth Service
	authSvc, err := auth.NewService(pool, cfg.JWTPrivKeyPath, cfg.JWTPubKeyPath, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	if err != nil {
		log.Fatalf("Failed to init auth service: %v", err)
	}
	log.Println("✅ Auth service initialized (RS256)")

	// Redis
	rdb := bhlredis.NewClient(cfg.RedisURL)
	if err := bhlredis.Ping(ctx, rdb); err != nil {
		log.Printf("⚠️ Redis not available: %v (GPS WebSocket disabled)", err)
	} else {
		log.Println("✅ Connected to Redis")
	}
	defer rdb.Close()

	// GPS Hub (WebSocket + Redis pub/sub)
	gpsHub := gps.NewHub(rdb, authSvc)
	appCtx, appCancel := context.WithCancel(context.Background())
	defer appCancel()
	go gpsHub.Run(appCtx)

	// OMS
	omsRepo := oms.NewRepository(pool)
	omsSvc := oms.NewService(omsRepo)

	// TMS
	tmsRepo := tms.NewRepository(pool)
	tmsSvc := tms.NewService(tmsRepo, cfg.VRPSolverURL)

	// WMS
	wmsRepo := wms.NewRepository(pool)
	wmsSvc := wms.NewService(wmsRepo)

	// Gin Router
	if cfg.Env == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	// CORS
	r.Use(corsMiddleware())

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
	omsHandler := oms.NewHandler(omsSvc)
	omsHandler.RegisterRoutes(protected)

	// TMS routes
	tmsHandler := tms.NewHandler(tmsSvc)
	tmsHandler.RegisterRoutes(protected)

	// WMS routes
	wmsHandler := wms.NewHandler(wmsSvc)
	wmsHandler.RegisterRoutes(protected)

	// Reconciliation routes (Tasks 3.9-3.11)
	reconRepo := reconciliation.NewRepository(pool)
	reconSvc := reconciliation.NewService(reconRepo)
	reconHandler := reconciliation.NewHandler(reconSvc)
	reconHandler.RegisterRoutes(protected)

	// Notification module (Task 3.14)
	notifHub := notification.NewHub()
	notifRepo := notification.NewRepository(pool)
	notifSvc := notification.NewService(notifRepo, notifHub)
	notifHandler := notification.NewHandler(notifSvc, notifHub, authSvc)
	notifHandler.RegisterRoutes(protected)
	notifHandler.RegisterWebSocket(r)
	log.Println("✅ Notification service initialized (WebSocket)")
	_ = notifSvc // available for integration hooks

	// KPI module (Tasks 3.16-3.17)
	kpiRepo := kpi.NewRepository(pool)
	kpiSvc := kpi.NewService(kpiRepo)
	kpiHandler := kpi.NewHandler(kpiSvc)
	kpiHandler.RegisterRoutes(protected)
	go kpiSvc.RunDailySnapshotCron(appCtx)
	log.Println("✅ KPI service initialized (cron 23:50)")

	// Integration adapters (Task 3.1-3.5)
	bravoAdapter := integration.NewBravoAdapter(cfg.BravoURL, cfg.BravoAPIKey, cfg.IntegrationMock)
	dmsAdapter := integration.NewDMSAdapter(cfg.DMSURL, cfg.DMSAPIKey, cfg.IntegrationMock)
	zaloAdapter := integration.NewZaloAdapter(cfg.ZaloOAToken, cfg.ZaloOAID, cfg.IntegrationMock)
	confirmSvc := integration.NewConfirmService(pool, zaloAdapter)
	dlqSvc := integration.NewDLQService(pool)
	integrationHandler := integration.NewHandler(bravoAdapter, dmsAdapter, zaloAdapter, confirmSvc, dlqSvc)
	integrationHandler.RegisterRoutes(protected)
	integrationHandler.RegisterPublicRoutes(v1) // NPP portal (no auth)

	// Integration hooks — wire adapters into business flows (Tasks 3.1-3.6)
	baseURL := "http://localhost:" + cfg.ServerPort
	if cfg.Env == "production" {
		baseURL = "https://oms.bhl.vn"
	}
	integrationHooks := integration.NewHooks(bravoAdapter, dmsAdapter, confirmSvc, pool, baseURL)
	tmsSvc.SetIntegrationHooks(integrationHooks)
	omsSvc.SetIntegrationHooks(integrationHooks)
	log.Println("✅ Integration hooks wired (Bravo, DMS, Zalo)")

	// Start auto-confirm cron (Task 3.7)
	go confirmSvc.RunAutoConfirmCron(appCtx)

	// Start nightly Bravo reconcile cron (Task 3.2)
	go integrationHooks.RunNightlyReconcileCron(appCtx)

	// GPS routes (REST)
	gpsHandler := gps.NewHandler(gpsHub, pool)
	gpsHandler.RegisterRoutes(protected)

	// Admin module — user management
	adminSvc := admin.NewService(pool)
	adminHandler := admin.NewHandler(adminSvc)
	adminHandler.RegisterRoutes(protected)
	log.Println("\u2705 Admin module initialized (user management)")

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
		pool.QueryRow(ctx, `SELECT COUNT(*) FROM shipments WHERE status = 'pending'`).Scan(&pendingShipments)

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
		log.Printf("🚀 BHL OMS-TMS-WMS API starting on :%s", cfg.ServerPort)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced shutdown: %v", err)
	}
	log.Println("Server exited")
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Writer.Header().Set("Access-Control-Max-Age", "86400")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
