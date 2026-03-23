package main

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

// --- Config ---

const (
	redisAddr      = "localhost:6379"
	dbURL          = "postgres://bhl:bhl@localhost:5434/bhl_dev?sslmode=disable"
	gpsChannel     = "gps:updates"
	gpsHashKey     = "gps:latest"
	updateInterval = 3 * time.Second // GPS update every 3s
)

// --- Data Structures ---

type VehicleRoute struct {
	VehicleID string
	DriverID  string
	TripID    string
	Plate     string
	Waypoints []Waypoint // ordered stops
}

type Waypoint struct {
	Lat  float64
	Lng  float64
	Name string
}

type VehicleState struct {
	mu          sync.Mutex
	VehicleID   string
	Lat         float64
	Lng         float64
	Speed       float64 // km/h
	Heading     float64 // degrees
	WaypointIdx int
	Progress    float64 // 0.0 - 1.0 between waypoints
	Stopped     bool
	StopUntil   time.Time
}

type GPSUpdate struct {
	Type      string  `json:"type"`
	VehicleID string  `json:"vehicle_id"`
	Lat       float64 `json:"lat"`
	Lng       float64 `json:"lng"`
	Speed     float64 `json:"speed"`
	Heading   float64 `json:"heading"`
	Timestamp string  `json:"ts"`
}

// --- Main ---

func main() {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigCh
		fmt.Println("\n🛑 Stopping GPS simulator...")
		cancel()
	}()

	// Connect Redis
	rdb := redis.NewClient(&redis.Options{Addr: redisAddr, DB: 0})
	if err := rdb.Ping(ctx).Err(); err != nil {
		fmt.Printf("❌ Redis connection failed: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("✅ Redis connected")

	// Connect DB
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		fmt.Printf("❌ DB connection failed: %v\n", err)
		os.Exit(1)
	}
	defer pool.Close()
	fmt.Println("✅ Database connected")

	// Load vehicle routes from active trips
	routes, err := loadActiveTrips(ctx, pool)
	if err != nil {
		fmt.Printf("❌ Failed to load trips: %v\n", err)
		os.Exit(1)
	}

	if len(routes) == 0 {
		fmt.Println("⚠️  No active trips found. Using demo vehicles with random routes.")
		routes = generateDemoRoutes(ctx, pool)
	}

	fmt.Printf("🚛 Simulating %d vehicles\n", len(routes))
	for _, r := range routes {
		fmt.Printf("   • %s (%d waypoints)\n", r.Plate, len(r.Waypoints))
	}

	// Initialize vehicle states
	states := make([]*VehicleState, len(routes))
	for i, r := range routes {
		states[i] = &VehicleState{
			VehicleID:   r.VehicleID,
			Lat:         r.Waypoints[0].Lat,
			Lng:         r.Waypoints[0].Lng,
			Speed:       0,
			WaypointIdx: 0,
			Progress:    0,
		}
	}

	// Simulation loop
	ticker := time.NewTicker(updateInterval)
	defer ticker.Stop()

	fmt.Printf("\n🔄 GPS simulation started (every %v). Press Ctrl+C to stop.\n\n", updateInterval)
	iteration := 0

	for {
		select {
		case <-ctx.Done():
			fmt.Println("✅ GPS simulator stopped.")
			return
		case <-ticker.C:
			iteration++
			now := time.Now().UTC()

			for i, state := range states {
				route := routes[i]
				updateVehicle(state, route, updateInterval)
				publishGPS(ctx, rdb, state, now)
			}

			if iteration%10 == 0 {
				fmt.Printf("📡 [%s] Tick #%d — %d vehicles active\n",
					now.Format("15:04:05"), iteration, len(states))
				for _, s := range states {
					s.mu.Lock()
					status := "🚗 moving"
					if s.Stopped {
						status = "📦 delivering"
					}
					fmt.Printf("   %s %.5f,%.5f %.0fkm/h hdg=%.0f° wp=%d %s\n",
						s.VehicleID[:8], s.Lat, s.Lng, s.Speed, s.Heading, s.WaypointIdx, status)
					s.mu.Unlock()
				}
			}
		}
	}
}

// --- Trip Loading ---

func loadActiveTrips(ctx context.Context, pool *pgxpool.Pool) ([]VehicleRoute, error) {
	rows, err := pool.Query(ctx, `
		SELECT t.id::text, t.vehicle_id::text, COALESCE(t.driver_id::text,''),
			v.plate_number
		FROM trips t
		JOIN vehicles v ON v.id = t.vehicle_id
		WHERE t.status::text IN ('planned','in_progress','loading','departed')
		ORDER BY t.created_at DESC
		LIMIT 20
	`)
	if err != nil {
		return nil, fmt.Errorf("query trips: %w", err)
	}
	defer rows.Close()

	var routes []VehicleRoute
	for rows.Next() {
		var r VehicleRoute
		if err := rows.Scan(&r.TripID, &r.VehicleID, &r.DriverID, &r.Plate); err != nil {
			continue
		}

		// Load stops for this trip
		stopRows, err := pool.Query(ctx, `
			SELECT COALESCE(c.lat, 0), COALESCE(c.lng, 0), COALESCE(c.name, 'Stop')
			FROM trip_stops ts
			JOIN shipments sh ON sh.id = ts.shipment_id
			JOIN sales_orders so ON so.id = sh.order_id
			JOIN customers c ON c.id = so.customer_id
			WHERE ts.trip_id = $1
			ORDER BY ts.sequence_order ASC
		`, r.TripID)
		if err != nil {
			continue
		}
		defer stopRows.Close()

		// Start at warehouse (Quang Ninh area default)
		r.Waypoints = append(r.Waypoints, Waypoint{Lat: 20.9565, Lng: 107.072, Name: "Kho xuất phát"})

		for stopRows.Next() {
			var wp Waypoint
			if err := stopRows.Scan(&wp.Lat, &wp.Lng, &wp.Name); err != nil {
				continue
			}
			if wp.Lat != 0 && wp.Lng != 0 {
				r.Waypoints = append(r.Waypoints, wp)
			}
		}

		// Return to warehouse
		r.Waypoints = append(r.Waypoints, Waypoint{Lat: 20.9565, Lng: 107.072, Name: "Quay về kho"})

		if len(r.Waypoints) >= 3 {
			routes = append(routes, r)
		}
	}
	return routes, nil
}

func generateDemoRoutes(ctx context.Context, pool *pgxpool.Pool) []VehicleRoute {
	// Load actual vehicles from DB
	var vehicles []struct {
		ID    string
		Plate string
	}
	rows, err := pool.Query(ctx, `
		SELECT id::text, plate_number FROM vehicles
		WHERE status::text = 'active' LIMIT 5
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var v struct {
				ID    string
				Plate string
			}
			if err := rows.Scan(&v.ID, &v.Plate); err == nil {
				vehicles = append(vehicles, v)
			}
		}
	}

	if len(vehicles) == 0 {
		vehicles = []struct {
			ID    string
			Plate string
		}{
			{"e0000000-0000-0000-0000-000000000005", "14C-12345"},
			{"e0000000-0000-0000-0000-000000000009", "14C-67890"},
			{"00770000-0000-0000-0000-000000000001", "29A-11111"},
			{"00770000-0000-0000-0000-000000000017", "15B-22222"},
		}
	}

	// Predefined delivery routes in Quang Ninh / Hai Phong area
	routeTemplates := [][]Waypoint{
		{ // Route 1: Ha Long bay area
			{20.9565, 107.072, "Kho BHL"},
			{20.9480, 107.085, "NPP Bãi Cháy"},
			{20.9340, 107.105, "NPP Hùng Thắng"},
			{20.9200, 107.090, "NPP Hà Khánh"},
			{20.9565, 107.072, "Quay về kho"},
		},
		{ // Route 2: Uong Bi direction
			{20.9565, 107.072, "Kho BHL"},
			{21.0350, 106.780, "NPP Uông Bí"},
			{21.0520, 106.548, "NPP Đông Triều"},
			{21.0100, 106.650, "NPP Mạo Khê"},
			{20.9565, 107.072, "Quay về kho"},
		},
		{ // Route 3: Cam Pha direction
			{20.9565, 107.072, "Kho BHL"},
			{21.0080, 107.320, "NPP Cẩm Phả"},
			{21.0450, 107.350, "NPP Cửa Ông"},
			{21.0200, 107.280, "NPP Quang Hanh"},
			{20.9565, 107.072, "Quay về kho"},
		},
		{ // Route 4: Short local route
			{20.9565, 107.072, "Kho BHL"},
			{20.9650, 107.060, "NPP Giếng Đáy"},
			{20.9700, 107.045, "NPP Hà Tu"},
			{20.9565, 107.072, "Quay về kho"},
		},
		{ // Route 5: Hai Phong direction
			{20.9565, 107.072, "Kho BHL"},
			{20.8500, 106.700, "NPP Quảng Yên"},
			{20.8280, 106.685, "NPP Hải Phòng 1"},
			{20.8100, 106.720, "NPP Hải Phòng 2"},
			{20.9565, 107.072, "Quay về kho"},
		},
	}

	var routes []VehicleRoute
	for i, v := range vehicles {
		tmpl := routeTemplates[i%len(routeTemplates)]
		routes = append(routes, VehicleRoute{
			VehicleID: v.ID,
			Plate:     v.Plate,
			Waypoints: tmpl,
		})
	}
	return routes
}

// --- Vehicle Movement Simulation ---

func updateVehicle(state *VehicleState, route VehicleRoute, dt time.Duration) {
	state.mu.Lock()
	defer state.mu.Unlock()

	if len(route.Waypoints) < 2 {
		return
	}

	// If stopped (delivering), wait
	if state.Stopped {
		if time.Now().Before(state.StopUntil) {
			state.Speed = 0
			return
		}
		state.Stopped = false
		state.WaypointIdx++
		state.Progress = 0

		// Loop back to start if completed
		if state.WaypointIdx >= len(route.Waypoints)-1 {
			state.WaypointIdx = 0
			state.Progress = 0
		}
	}

	from := route.Waypoints[state.WaypointIdx]
	to := route.Waypoints[state.WaypointIdx+1]

	// Calculate distance between waypoints
	dist := haversineKm(from.Lat, from.Lng, to.Lat, to.Lng)
	if dist < 0.01 {
		state.WaypointIdx++
		state.Progress = 0
		if state.WaypointIdx >= len(route.Waypoints)-1 {
			state.WaypointIdx = 0
		}
		return
	}

	// Target speed: 30-55 km/h with some randomness
	targetSpeed := 35.0 + rand.Float64()*20.0

	// Slow down near waypoints
	remainingDist := dist * (1 - state.Progress)
	if remainingDist < 0.5 {
		targetSpeed = 10 + rand.Float64()*10
	}

	// Smooth speed transition
	state.Speed = state.Speed*0.7 + targetSpeed*0.3

	// Calculate movement
	dtHours := dt.Hours()
	distCovered := state.Speed * dtHours // km
	progressDelta := distCovered / dist
	state.Progress += progressDelta

	// Add small random jitter to simulate GPS noise (±0.00005° ≈ 5m)
	jitterLat := (rand.Float64() - 0.5) * 0.0001
	jitterLng := (rand.Float64() - 0.5) * 0.0001

	if state.Progress >= 1.0 {
		// Arrived at waypoint
		state.Lat = to.Lat + jitterLat
		state.Lng = to.Lng + jitterLng
		state.Progress = 1.0
		state.Speed = 0

		// Stop for "delivery" (15-45 seconds per stop)
		stopDuration := time.Duration(15+rand.Intn(30)) * time.Second
		state.Stopped = true
		state.StopUntil = time.Now().Add(stopDuration)
	} else {
		// Interpolate position
		state.Lat = from.Lat + (to.Lat-from.Lat)*state.Progress + jitterLat
		state.Lng = from.Lng + (to.Lng-from.Lng)*state.Progress + jitterLng
	}

	// Calculate heading
	state.Heading = bearing(from.Lat, from.Lng, to.Lat, to.Lng)
	// Add slight heading jitter
	state.Heading += (rand.Float64() - 0.5) * 5
	if state.Heading < 0 {
		state.Heading += 360
	}
	if state.Heading >= 360 {
		state.Heading -= 360
	}
}

// --- GPS Publishing ---

func publishGPS(ctx context.Context, rdb *redis.Client, state *VehicleState, now time.Time) {
	state.mu.Lock()
	lat := state.Lat
	lng := state.Lng
	speed := state.Speed
	heading := state.Heading
	vid := state.VehicleID
	state.mu.Unlock()

	ts := now.Format(time.RFC3339)

	// Store in Redis hash (same format as hub.go)
	locJSON, _ := json.Marshal(map[string]interface{}{
		"lat":     lat,
		"lng":     lng,
		"speed":   speed,
		"heading": heading,
		"ts":      ts,
	})
	rdb.HSet(ctx, gpsHashKey, vid, string(locJSON))
	rdb.Expire(ctx, gpsHashKey, 24*time.Hour)

	// Publish update to channel (same format as GPSUpdate in hub.go)
	update := GPSUpdate{
		Type:      "gps_update",
		VehicleID: vid,
		Lat:       lat,
		Lng:       lng,
		Speed:     speed,
		Heading:   heading,
		Timestamp: ts,
	}
	data, _ := json.Marshal(update)
	rdb.Publish(ctx, gpsChannel, string(data))
}

// --- Geo Math ---

func haversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0 // Earth radius km
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	return R * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

func bearing(lat1, lng1, lat2, lng2 float64) float64 {
	dLng := (lng2 - lng1) * math.Pi / 180
	lat1R := lat1 * math.Pi / 180
	lat2R := lat2 * math.Pi / 180
	y := math.Sin(dLng) * math.Cos(lat2R)
	x := math.Cos(lat1R)*math.Sin(lat2R) - math.Sin(lat1R)*math.Cos(lat2R)*math.Cos(dLng)
	brng := math.Atan2(y, x) * 180 / math.Pi
	if brng < 0 {
		brng += 360
	}
	return brng
}
