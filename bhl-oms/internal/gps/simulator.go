package gps

import (
	"context"
	"math"
	"math/rand"
	"net/http"
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
	if err != nil || len(routes) == 0 {
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
		"routes":   routeNames(routes),
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
	VehicleID  string
	Plate      string
	DriverName string
	TripStatus string
	Waypoints  []simWaypoint
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

func (sc *SimController) loadRoutes(ctx context.Context, req simStartRequest) ([]simRoute, error) {
	routes, err := sc.loadActiveTrips(ctx, req.TripIDs)
	if err != nil {
		return nil, err
	}

	if len(routes) == 0 && req.UseDemo {
		return sc.generateDemoRoutes(ctx), nil
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

		wps := []simWaypoint{{Lat: 20.9639, Lng: 107.0895, Name: "WH-HL"}}
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
		wps = append(wps, simWaypoint{Lat: 20.9639, Lng: 107.0895, Name: "Quay về WH-HL"})

		if len(wps) >= 3 {
			result = append(result, simRoute{
				VehicleID:  vehicleID,
				Plate:      plate,
				DriverName: driverName,
				TripStatus: tripStatus,
				Waypoints:  wps,
			})
		}
	}
	return result, nil
}

func (sc *SimController) generateDemoRoutes(ctx context.Context) []simRoute {
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

	templates := [][]simWaypoint{
		{{20.9565, 107.072, "Kho BHL"}, {20.9480, 107.085, "NPP Bãi Cháy"}, {20.9340, 107.105, "NPP Hùng Thắng"}, {20.9200, 107.090, "NPP Hà Khánh"}, {20.9565, 107.072, "Quay về kho"}},
		{{20.9565, 107.072, "Kho BHL"}, {21.0350, 106.780, "NPP Uông Bí"}, {21.0520, 106.548, "NPP Đông Triều"}, {21.0100, 106.650, "NPP Mạo Khê"}, {20.9565, 107.072, "Quay về kho"}},
		{{20.9565, 107.072, "Kho BHL"}, {21.0080, 107.320, "NPP Cẩm Phả"}, {21.0450, 107.350, "NPP Cửa Ông"}, {21.0200, 107.280, "NPP Quang Hanh"}, {20.9565, 107.072, "Quay về kho"}},
		{{20.9565, 107.072, "Kho BHL"}, {20.8500, 106.700, "NPP Quảng Yên"}, {20.8280, 106.685, "NPP HP 1"}, {20.8100, 106.720, "NPP HP 2"}, {20.9565, 107.072, "Quay về kho"}},
	}

	var routes []simRoute
	for i, v := range vehicles {
		routes = append(routes, simRoute{
			VehicleID:  v.ID,
			Plate:      v.Plate,
			DriverName: v.DriverName,
			TripStatus: v.TripStatus,
			Waypoints:  templates[i%len(templates)],
		})
	}
	return routes
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

func routeNames(routes []simRoute) []string {
	names := make([]string, len(routes))
	for i, r := range routes {
		names[i] = r.Plate
	}
	return names
}
