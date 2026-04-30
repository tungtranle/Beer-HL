package gps

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"bhl-oms/internal/middleware"
	"bhl-oms/pkg/logger"
	"bhl-oms/pkg/response"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SimController manages in-process GPS simulation for testing.
type SimController struct {
	hub *Hub
	db  *pgxpool.Pool
	log logger.Logger

	mu        sync.Mutex
	cancel    context.CancelFunc
	running   bool
	vehicles  int
	startedAt time.Time
}

// NewSimController creates a GPS simulation controller.
func NewSimController(hub *Hub, db *pgxpool.Pool, log logger.Logger) *SimController {
	return &SimController{hub: hub, db: db, log: log}
}

// RegisterRoutes registers GPS simulation endpoints.
func (sc *SimController) RegisterRoutes(r *gin.RouterGroup) {
	sim := r.Group("/gps/simulate")
	sim.Use(middleware.RequireRole("admin", "dispatcher"))
	sim.POST("/start", sc.StartSimulation)
	sim.POST("/stop", sc.StopSimulation)
	sim.GET("/status", sc.GetStatus)
}

type simStartRequest struct {
	TripIDs  []string `json:"trip_ids,omitempty"`  // specific trips to simulate
	UseDemo  bool     `json:"use_demo,omitempty"`  // use demo routes if no active trips
	SpeedMul float64  `json:"speed_mul,omitempty"` // speed multiplier (default 1.0)
}

func (sc *SimController) StartSimulation(c *gin.Context) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if sc.running {
		response.Err(c, http.StatusConflict, "SIM_RUNNING", "GPS simulation đang chạy. Dừng trước khi chạy lại.")
		return
	}

	var req simStartRequest
	c.ShouldBindJSON(&req) // optional body
	if req.SpeedMul <= 0 {
		req.SpeedMul = 1.0
	}

	ctx, cancel := context.WithCancel(context.Background())
	sc.cancel = cancel

	routes, err := sc.loadRoutes(ctx, req)
	if err != nil {
		cancel()
		response.Err(c, http.StatusServiceUnavailable, "ROUTE_GEOMETRY_UNAVAILABLE", err.Error())
		return
	}
	if len(routes) == 0 {
		cancel()
		response.Err(c, http.StatusBadRequest, "NO_ROUTES", "Không tìm thấy tuyến đường để giả lập. Hãy approve plan trước hoặc dùng use_demo=true.")
		return
	}

	sc.running = true
	sc.vehicles = len(routes)
	sc.startedAt = time.Now()

	go sc.runSimulation(ctx, routes, req.SpeedMul)

	sc.log.Info(c.Request.Context(), "gps_simulation_started",
		logger.F("vehicles", len(routes)),
		logger.F("speed_mul", req.SpeedMul),
	)

	response.OK(c, gin.H{
		"message":  "GPS simulation đã bắt đầu",
		"vehicles": len(routes),
		"routes":   routeSummaries(routes),
	})
}

func (sc *SimController) StopSimulation(c *gin.Context) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	if !sc.running {
		response.Err(c, http.StatusBadRequest, "SIM_NOT_RUNNING", "Không có simulation nào đang chạy")
		return
	}

	sc.cancel()
	sc.running = false

	sc.log.Info(c.Request.Context(), "gps_simulation_stopped")

	response.OK(c, gin.H{"message": "GPS simulation đã dừng"})
}

func (sc *SimController) GetStatus(c *gin.Context) {
	sc.mu.Lock()
	defer sc.mu.Unlock()

	response.OK(c, gin.H{
		"running":    sc.running,
		"vehicles":   sc.vehicles,
		"started_at": sc.startedAt,
		"uptime_sec": func() float64 {
			if sc.running {
				return time.Since(sc.startedAt).Seconds()
			}
			return 0
		}(),
	})
}

// ─── Simulation Loop ─────────────────────────────────

type simRoute struct {
	VehicleID      string
	Plate          string
	DriverName     string
	TripStatus     string
	GeometrySource string
	Waypoints      []simWaypoint
}

type simWaypoint struct {
	Lat  float64
	Lng  float64
	Name string
}

type simVehicleState struct {
	VehicleID   string
	Lat         float64
	Lng         float64
	Speed       float64
	Heading     float64
	WaypointIdx int
	Progress    float64
	Stopped     bool
	StopUntil   time.Time
}

func (sc *SimController) runSimulation(ctx context.Context, routes []simRoute, speedMul float64) {
	const updateInterval = 3 * time.Second

	states := make([]*simVehicleState, len(routes))
	for i, r := range routes {
		states[i] = &simVehicleState{
			VehicleID: r.VehicleID,
			Lat:       r.Waypoints[0].Lat,
			Lng:       r.Waypoints[0].Lng,
		}
	}

	ticker := time.NewTicker(updateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			now := time.Now()
			for i, state := range states {
				route := routes[i]
				updateSimVehicle(state, route, updateInterval, speedMul)
				sc.publishSimGPS(ctx, state, route, now)
			}
		}
	}
}

func (sc *SimController) publishSimGPS(ctx context.Context, state *simVehicleState, route simRoute, now time.Time) {
	vid, err := uuid.Parse(state.VehicleID)
	if err != nil {
		return
	}

	point := GPSPoint{
		VehicleID:    vid,
		VehiclePlate: route.Plate,
		DriverName:   route.DriverName,
		TripStatus:   route.TripStatus,
		Lat:          state.Lat,
		Lng:          state.Lng,
		Speed:        state.Speed,
		Heading:      state.Heading,
		Timestamp:    now,
	}
	sc.hub.PublishGPS(ctx, point)
}

func updateSimVehicle(state *simVehicleState, route simRoute, dt time.Duration, speedMul float64) {
	if len(route.Waypoints) < 2 {
		return
	}

	if route.TripStatus == "completed" {
		last := route.Waypoints[len(route.Waypoints)-2]
		state.Lat = last.Lat
		state.Lng = last.Lng
		state.Speed = 0
		state.Heading = 0
		state.Stopped = true
		state.StopUntil = time.Now().Add(24 * time.Hour)
		return
	}

	if state.Stopped {
		if time.Now().Before(state.StopUntil) {
			state.Speed = 0
			return
		}
		state.Stopped = false
		state.WaypointIdx++
		state.Progress = 0
		if state.WaypointIdx >= len(route.Waypoints)-1 {
			state.WaypointIdx = 0
			state.Progress = 0
		}
	}

	from := route.Waypoints[state.WaypointIdx]
	to := route.Waypoints[state.WaypointIdx+1]

	dist := simHaversineKm(from.Lat, from.Lng, to.Lat, to.Lng)
	if dist < 0.01 {
		state.WaypointIdx++
		state.Progress = 0
		if state.WaypointIdx >= len(route.Waypoints)-1 {
			state.WaypointIdx = 0
		}
		return
	}

	targetSpeed := (35.0 + rand.Float64()*20.0) * speedMul
	remainingDist := dist * (1 - state.Progress)
	if remainingDist < 0.5 {
		targetSpeed = (10 + rand.Float64()*10) * speedMul
	}
	state.Speed = state.Speed*0.7 + targetSpeed*0.3

	dtHours := dt.Hours()
	distCovered := state.Speed * dtHours
	progressDelta := distCovered / dist
	state.Progress += progressDelta

	jitterLat := (rand.Float64() - 0.5) * 0.0001
	jitterLng := (rand.Float64() - 0.5) * 0.0001

	if state.Progress >= 1.0 {
		state.Lat = to.Lat + jitterLat
		state.Lng = to.Lng + jitterLng
		state.Progress = 1.0
		state.Speed = 0
		stopDuration := time.Duration(15+rand.Intn(30)) * time.Second
		state.Stopped = true
		state.StopUntil = time.Now().Add(stopDuration)
	} else {
		state.Lat = from.Lat + (to.Lat-from.Lat)*state.Progress + jitterLat
		state.Lng = from.Lng + (to.Lng-from.Lng)*state.Progress + jitterLng
	}

	dlat := to.Lat - from.Lat
	dlng := to.Lng - from.Lng
	state.Heading = math.Mod(math.Atan2(dlng, dlat)*180/math.Pi+360, 360)
	state.Heading += (rand.Float64() - 0.5) * 5
}

// ─── Route Loading ───────────────────────────────────

// fetchOSRMWaypoints calls OSRM to get road-following waypoints between stop coordinates.
// Route-real simulation must fail closed: never fall back to straight-line geometry.
func fetchOSRMWaypoints(stops []simWaypoint) ([]simWaypoint, string, error) {
	if len(stops) < 2 {
		return stops, "db_route_geometry", nil
	}

	// Build OSRM coordinates string: lng,lat;lng,lat;...
	coords := make([]string, len(stops))
	for i, s := range stops {
		coords[i] = fmt.Sprintf("%.6f,%.6f", s.Lng, s.Lat)
	}
	coordStr := strings.Join(coords, ";")

	baseURL := strings.TrimRight(strings.TrimSpace(os.Getenv("OSRM_URL")), "/")
	if baseURL == "" {
		baseURL = "http://localhost:5000"
	}
	url := fmt.Sprintf("%s/route/v1/driving/%s?overview=full&geometries=geojson&steps=false", baseURL, coordStr)

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, "", fmt.Errorf("OSRM unavailable at %s: %w", baseURL, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("OSRM returned status %d", resp.StatusCode)
	}

	var result struct {
		Code   string `json:"code"`
		Routes []struct {
			Geometry struct {
				Coordinates [][]float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"routes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", fmt.Errorf("decode OSRM route: %w", err)
	}
	if result.Code != "Ok" || len(result.Routes) == 0 || len(result.Routes[0].Geometry.Coordinates) < 2 {
		return nil, "", fmt.Errorf("OSRM returned no usable road geometry")
	}

	osrmCoords := result.Routes[0].Geometry.Coordinates
	step := 1
	if len(osrmCoords) > 200 {
		step = len(osrmCoords) / 200
	}
	var waypoints []simWaypoint
	for i := 0; i < len(osrmCoords); i += step {
		c := osrmCoords[i]
		waypoints = append(waypoints, simWaypoint{Lat: c[1], Lng: c[0], Name: ""})
	}
	last := osrmCoords[len(osrmCoords)-1]
	if len(waypoints) == 0 || waypoints[len(waypoints)-1].Lat != last[1] || waypoints[len(waypoints)-1].Lng != last[0] {
		waypoints = append(waypoints, simWaypoint{Lat: last[1], Lng: last[0], Name: ""})
	}
	waypoints[0].Name = stops[0].Name
	waypoints[len(waypoints)-1].Name = stops[len(stops)-1].Name
	return waypoints, "osrm_local", nil
}

// loadWarehouseCoords loads the main warehouse coordinates from DB.
// Returns (lat, lng). Falls back to hardcoded if DB fails.
func (sc *SimController) loadWarehouseCoords(ctx context.Context) (float64, float64) {
	var lat, lng float64
	err := sc.db.QueryRow(ctx, `
		SELECT COALESCE(latitude, 0), COALESCE(longitude, 0)
		FROM warehouses
		WHERE is_active = true AND latitude IS NOT NULL AND longitude IS NOT NULL
		ORDER BY created_at ASC
		LIMIT 1
	`).Scan(&lat, &lng)
	if err != nil || lat == 0 || lng == 0 {
		return 20.9517, 107.0748 // Kho BHL Hạ Long fallback
	}
	return lat, lng
}

func (sc *SimController) loadRoutes(ctx context.Context, req simStartRequest) ([]simRoute, error) {
	routes, err := sc.loadActiveTrips(ctx, req.TripIDs)
	if err != nil {
		return nil, err
	}

	if len(routes) == 0 && req.UseDemo {
		return sc.generateDemoRoutes(ctx)
	}

	return routes, nil
}

func (sc *SimController) loadActiveTrips(ctx context.Context, tripIDs []string) ([]simRoute, error) {
	var query string
	var args []interface{}

	if len(tripIDs) > 0 {
		ids := make([]uuid.UUID, 0, len(tripIDs))
		for _, id := range tripIDs {
			if uid, e := uuid.Parse(id); e == nil {
				ids = append(ids, uid)
			}
		}
		query = `
			SELECT t.id::text, t.vehicle_id::text, COALESCE(d.full_name,'') as driver_name,
				v.plate_number, t.status::text
			FROM trips t
			JOIN vehicles v ON v.id = t.vehicle_id
			LEFT JOIN drivers d ON d.id = t.driver_id
			WHERE t.id = ANY($1)
			ORDER BY t.created_at DESC
		`
		args = []interface{}{ids}
	} else {
		query = `
			SELECT t.id::text, t.vehicle_id::text, COALESCE(d.full_name,'') as driver_name,
				v.plate_number, t.status::text
			FROM trips t
			JOIN vehicles v ON v.id = t.vehicle_id
			LEFT JOIN drivers d ON d.id = t.driver_id
			WHERE t.status::text IN ('planned','assigned','ready','in_transit','pre_check')
			ORDER BY t.created_at DESC
			LIMIT 20
		`
	}

	rows, err := sc.db.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Load warehouse coordinates from DB
	whLat, whLng := sc.loadWarehouseCoords(ctx)

	var result []simRoute
	for rows.Next() {
		var tripID, vehicleID, driverName, plate, tripStatus string
		if err := rows.Scan(&tripID, &vehicleID, &driverName, &plate, &tripStatus); err != nil {
			continue
		}

		// Load stops
		stopRows, err := sc.db.Query(ctx, `
			SELECT COALESCE(c.latitude, 0), COALESCE(c.longitude, 0), COALESCE(c.name, 'Stop')
			FROM trip_stops ts
			JOIN customers c ON c.id = ts.customer_id
			WHERE ts.trip_id = $1
			ORDER BY ts.stop_order ASC
		`, tripID)
		if err != nil {
			continue
		}

		wps := []simWaypoint{{Lat: whLat, Lng: whLng, Name: "Kho BHL"}}
		for stopRows.Next() {
			var wp simWaypoint
			if err := stopRows.Scan(&wp.Lat, &wp.Lng, &wp.Name); err != nil {
				continue
			}
			if wp.Lat != 0 && wp.Lng != 0 {
				wps = append(wps, wp)
			}
		}
		stopRows.Close()
		wps = append(wps, simWaypoint{Lat: whLat, Lng: whLng, Name: "Quay về kho"})

		if len(wps) >= 3 {
			roadWps, source, err := fetchOSRMWaypoints(wps)
			if err != nil {
				return nil, fmt.Errorf("không lấy được tuyến đường thực tế cho chuyến %s: %w", tripID, err)
			}
			result = append(result, simRoute{
				VehicleID:      vehicleID,
				Plate:          plate,
				DriverName:     driverName,
				TripStatus:     tripStatus,
				GeometrySource: source,
				Waypoints:      roadWps,
			})
		}
	}
	return result, nil
}

func (sc *SimController) generateDemoRoutes(ctx context.Context) ([]simRoute, error) {
	type vInfo struct {
		ID         string
		Plate      string
		DriverName string
		TripStatus string
	}
	var vehicles []vInfo

	// Try to load vehicles+trips from active trips (SC-11 or real data)
	rows, err := sc.db.Query(ctx, `
		SELECT DISTINCT ON (v.id)
			v.id::text, v.plate_number, COALESCE(d.full_name,'Tài xế'), t.status::text
		FROM trips t
		JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN drivers d ON d.id = t.driver_id
		WHERE t.status::text IN ('in_transit','assigned','ready')
			AND t.planned_date = CURRENT_DATE
		ORDER BY v.id, t.created_at DESC
		LIMIT 8
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var v vInfo
			if rows.Scan(&v.ID, &v.Plate, &v.DriverName, &v.TripStatus) == nil {
				vehicles = append(vehicles, v)
			}
		}
	}

	// Fallback: just vehicles
	if len(vehicles) == 0 {
		rows2, err2 := sc.db.Query(ctx, `SELECT id::text, plate_number FROM vehicles WHERE status::text = 'active' LIMIT 5`)
		if err2 == nil {
			defer rows2.Close()
			for rows2.Next() {
				var id, plate string
				if rows2.Scan(&id, &plate) == nil {
					vehicles = append(vehicles, vInfo{id, plate, "Tài xế", "in_transit"})
				}
			}
		}
	}

	if len(vehicles) == 0 {
		vehicles = []vInfo{
			{"e0000000-0000-0000-0000-000000000005", "14C-12345", "Tài xế demo 1", "in_transit"},
			{"e0000000-0000-0000-0000-000000000009", "14C-67890", "Tài xế demo 2", "in_transit"},
		}
	}

	whLat, whLng := sc.loadWarehouseCoords(ctx)

	templates := [][]simWaypoint{
		{{whLat, whLng, "Kho BHL"}, {20.9480, 107.085, "NPP Bãi Cháy"}, {20.9340, 107.105, "NPP Hùng Thắng"}, {20.9200, 107.090, "NPP Hà Khánh"}, {whLat, whLng, "Quay về kho"}},
		{{whLat, whLng, "Kho BHL"}, {21.0350, 106.780, "NPP Uông Bí"}, {21.0520, 106.548, "NPP Đông Triều"}, {21.0100, 106.650, "NPP Mạo Khê"}, {whLat, whLng, "Quay về kho"}},
		{{whLat, whLng, "Kho BHL"}, {21.0080, 107.320, "NPP Cẩm Phả"}, {21.0450, 107.350, "NPP Cửa Ông"}, {21.0200, 107.280, "NPP Quang Hanh"}, {whLat, whLng, "Quay về kho"}},
		{{whLat, whLng, "Kho BHL"}, {20.8500, 106.700, "NPP Quảng Yên"}, {20.8280, 106.685, "NPP HP 1"}, {20.8100, 106.720, "NPP HP 2"}, {whLat, whLng, "Quay về kho"}},
	}

	var routes []simRoute
	for i, v := range vehicles {
		roadWps, source, err := fetchOSRMWaypoints(templates[i%len(templates)])
		if err != nil {
			return nil, fmt.Errorf("không lấy được tuyến đường thực tế cho demo GPS %s: %w", v.Plate, err)
		}
		routes = append(routes, simRoute{
			VehicleID:      v.ID,
			Plate:          v.Plate,
			DriverName:     v.DriverName,
			TripStatus:     v.TripStatus,
			GeometrySource: source,
			Waypoints:      roadWps,
		})
	}
	return routes, nil
}

// ─── Helpers ─────────────────────────────────────────

func simHaversineKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLng := (lng2 - lng1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func routeSummaries(routes []simRoute) []gin.H {
	summaries := make([]gin.H, len(routes))
	for i, r := range routes {
		summaries[i] = gin.H{
			"plate":           r.Plate,
			"geometry_source": r.GeometrySource,
			"waypoint_count":  len(r.Waypoints),
		}
	}
	return summaries
}
