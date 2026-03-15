package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"bhl-oms/internal/auth"
	"bhl-oms/internal/config"
	"bhl-oms/internal/gps"
	"bhl-oms/internal/middleware"
	"bhl-oms/internal/oms"
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

	// API v1
	v1 := r.Group("/v1")

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

	// GPS routes (REST)
	gpsHandler := gps.NewHandler(gpsHub)
	gpsHandler.RegisterRoutes(protected)

	// GPS WebSocket (authenticated via query token)
	r.GET("/ws/gps", gpsHub.HandleWebSocket)

	// Dashboard stats
	protected.GET("/dashboard/stats", func(c *gin.Context) {
		var orderCount, shipmentCount, tripCount int64
		pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM sales_orders`).Scan(&orderCount)
		pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM shipments WHERE status = 'pending'`).Scan(&shipmentCount)
		pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM trips WHERE status NOT IN ('completed','cancelled','closed')`).Scan(&tripCount)

		var productCount int64
		pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM products WHERE is_active = true`).Scan(&productCount)

		var customerCount int64
		pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM customers WHERE is_active = true`).Scan(&customerCount)

		response.OK(c, gin.H{
			"total_orders":      orderCount,
			"pending_shipments": shipmentCount,
			"active_trips":      tripCount,
			"total_products":    productCount,
			"total_customers":   customerCount,
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
