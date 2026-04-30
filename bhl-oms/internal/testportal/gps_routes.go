package testportal

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"bhl-oms/pkg/logger"
)

type gpsRouteSpec struct {
	Name          string
	WarehouseCode string
	Provinces     []string
	Limit         int
	OrderExpr     string
	SpeedKmh      float64
	StopSec       int
}

func (h *Handler) realDeliveryRoutes(ctx context.Context) []GPSRoute {
	routes := buildRealRoutes(ctx, h, []gpsRouteSpec{
		{Name: "Hạ Long - Quảng Ninh tuyến ven biển", WarehouseCode: "WH-HL", Provinces: []string{"Quảng Ninh"}, Limit: 4, OrderExpr: "c.longitude DESC, c.latitude DESC", SpeedKmh: 42, StopSec: 20},
		{Name: "Uông Bí - Đông Triều - Hải Dương", WarehouseCode: "WH-HL", Provinces: []string{"Quảng Ninh", "Hải Dương"}, Limit: 4, OrderExpr: "c.longitude DESC, c.latitude DESC", SpeedKmh: 40, StopSec: 25},
		{Name: "Hải Phòng nội thành", WarehouseCode: "WH-HP", Provinces: []string{"Hải Phòng"}, Limit: 5, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 38, StopSec: 18},
		{Name: "Bắc Ninh - Bắc Giang", WarehouseCode: "WH-HL", Provinces: []string{"Bắc Ninh", "Bắc Giang"}, Limit: 5, OrderExpr: "c.longitude DESC, c.latitude DESC", SpeedKmh: 45, StopSec: 20},
		{Name: "Hưng Yên - Thái Bình - Nam Định", WarehouseCode: "WH-HP", Provinces: []string{"Hưng Yên", "Thái Bình", "Nam Định"}, Limit: 5, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 44, StopSec: 22},
	})
	if len(routes) > 0 {
		return routes
	}
	return []GPSRoute{}
}

func (h *Handler) realRushHourRoutes(ctx context.Context) []GPSRoute {
	routes := buildRealRoutes(ctx, h, []gpsRouteSpec{
		{Name: "Quảng Ninh mở rộng", WarehouseCode: "WH-HL", Provinces: []string{"Quảng Ninh"}, Limit: 6, OrderExpr: "c.longitude DESC, c.latitude DESC", SpeedKmh: 46, StopSec: 20},
		{Name: "Hải Dương - Hải Phòng trục chính", WarehouseCode: "WH-HP", Provinces: []string{"Hải Dương", "Hải Phòng"}, Limit: 6, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 44, StopSec: 18},
		{Name: "Bắc Giang - Lạng Sơn", WarehouseCode: "WH-HL", Provinces: []string{"Bắc Giang", "Lạng Sơn"}, Limit: 5, OrderExpr: "c.longitude DESC, c.latitude DESC", SpeedKmh: 48, StopSec: 22},
		{Name: "Hưng Yên - Nam Định", WarehouseCode: "WH-HP", Provinces: []string{"Hưng Yên", "Nam Định"}, Limit: 5, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 46, StopSec: 20},
		{Name: "Thái Bình - Ninh Bình", WarehouseCode: "WH-HP", Provinces: []string{"Thái Bình", "Ninh Bình"}, Limit: 5, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 45, StopSec: 22},
		{Name: "Hải Phòng ven biển", WarehouseCode: "WH-HP", Provinces: []string{"Hải Phòng"}, Limit: 6, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 40, StopSec: 18},
		{Name: "Đông Triều - Cẩm Phả", WarehouseCode: "WH-HL", Provinces: []string{"Quảng Ninh", "Hải Dương"}, Limit: 5, OrderExpr: "c.longitude DESC, c.latitude DESC", SpeedKmh: 42, StopSec: 20},
		{Name: "Bắc Ninh trục QL", WarehouseCode: "WH-HL", Provinces: []string{"Bắc Ninh"}, Limit: 5, OrderExpr: "c.longitude DESC, c.latitude DESC", SpeedKmh: 43, StopSec: 20},
		{Name: "Hải Dương trục giữa", WarehouseCode: "WH-HP", Provinces: []string{"Hải Dương"}, Limit: 5, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 41, StopSec: 20},
		{Name: "Nam Định - Thanh Hóa", WarehouseCode: "WH-HP", Provinces: []string{"Nam Định", "Thanh Hóa"}, Limit: 5, OrderExpr: "c.longitude ASC, c.latitude ASC", SpeedKmh: 48, StopSec: 24},
	})
	if len(routes) > 0 {
		return routes
	}
	return []GPSRoute{}
}

func (h *Handler) realLongRoute(ctx context.Context) []GPSRoute {
	route := buildRealRoute(ctx, h, gpsRouteSpec{
		Name:          "Hạ Long → Hải Dương → Hải Phòng",
		WarehouseCode: "WH-HL",
		Provinces:     []string{"Quảng Ninh", "Hải Dương", "Hải Phòng"},
		Limit:         7,
		OrderExpr:     "c.longitude DESC, c.latitude DESC",
		SpeedKmh:      50,
		StopSec:       30,
	})
	if len(route.Waypoints) > 0 {
		return []GPSRoute{route}
	}
	return []GPSRoute{}
}

func (h *Handler) realTripsRoute(ctx context.Context) ([]simVehicle, []GPSRoute) {
	vehicles, routes := h.loadTripsFromDB(ctx)
	if len(routes) > 0 {
		return vehicles, routes
	}
	return nil, nil
}

func buildRealRoutes(ctx context.Context, h *Handler, specs []gpsRouteSpec) []GPSRoute {
	routes := make([]GPSRoute, 0, len(specs))
	for _, spec := range specs {
		route := buildRealRoute(ctx, h, spec)
		if len(route.Waypoints) >= 3 {
			routes = append(routes, route)
		}
	}
	return routes
}

func buildRealRoute(ctx context.Context, h *Handler, spec gpsRouteSpec) GPSRoute {
	warehouse, ok := h.loadWarehouseWaypoint(ctx, spec.WarehouseCode)
	if !ok {
		return GPSRoute{}
	}

	customers := h.loadCustomerWaypoints(ctx, spec.Provinces, spec.Limit, spec.OrderExpr)
	if len(customers) == 0 {
		return GPSRoute{}
	}

	stops := make([]GPSWaypoint, 0, len(customers)+2)
	stops = append(stops, warehouse)
	stops = append(stops, customers...)
	stops = append(stops, GPSWaypoint{Lat: warehouse.Lat, Lng: warehouse.Lng, Name: "Quay về " + warehouse.Name})

	waypoints, source, distanceKm, durationMin, err := h.fetchOSRMWaypoints(stops)
	if err != nil || len(waypoints) < 3 {
		if err != nil {
			h.log.Warn(ctx, "gps_route_geometry_unavailable", logger.F("route", spec.Name), logger.F("err", err.Error()))
		}
		return GPSRoute{}
	}

	return GPSRoute{
		Name:           spec.Name,
		SpeedKmh:       spec.SpeedKmh,
		StopSec:        spec.StopSec,
		Waypoints:      waypoints,
		GeometrySource: source,
		DistanceKm:     distanceKm,
		DurationMin:    durationMin,
	}
}

func (h *Handler) loadWarehouseWaypoint(ctx context.Context, warehouseCode string) (GPSWaypoint, bool) {
	var name string
	var lat, lng float64
	err := h.db.QueryRow(ctx, `
		SELECT name, COALESCE(latitude, 0), COALESCE(longitude, 0)
		FROM warehouses
		WHERE code = $1 AND is_active = true
	`, warehouseCode).Scan(&name, &lat, &lng)
	if err != nil || lat == 0 || lng == 0 {
		return GPSWaypoint{}, false
	}
	return GPSWaypoint{Lat: lat, Lng: lng, Name: name}, true
}

func (h *Handler) loadCustomerWaypoints(ctx context.Context, provinces []string, limit int, orderExpr string) []GPSWaypoint {
	if len(provinces) == 0 || limit <= 0 {
		return nil
	}

	query := fmt.Sprintf(`
		SELECT COALESCE(name, ''), COALESCE(latitude, 0), COALESCE(longitude, 0)
		FROM customers
		WHERE is_active = true
		  AND latitude IS NOT NULL
		  AND longitude IS NOT NULL
		  AND province = ANY($1)
		ORDER BY %s
		LIMIT $2
	`, orderExpr)

	rows, err := h.db.Query(ctx, query, provinces, limit)
	if err != nil {
		return nil
	}
	defer rows.Close()

	points := make([]GPSWaypoint, 0, limit)
	for rows.Next() {
		var name string
		var lat, lng float64
		if err := rows.Scan(&name, &lat, &lng); err == nil && lat != 0 && lng != 0 {
			points = append(points, GPSWaypoint{Lat: lat, Lng: lng, Name: name})
		}
	}
	return points
}

func (h *Handler) fetchOSRMWaypoints(stops []GPSWaypoint) ([]GPSWaypoint, string, float64, int, error) {
	if len(stops) < 2 {
		return stops, "db_route_geometry", 0, 0, nil
	}

	coordParts := make([]string, len(stops))
	for i, stop := range stops {
		coordParts[i] = fmt.Sprintf("%.6f,%.6f", stop.Lng, stop.Lat)
	}
	coordStr := strings.Join(coordParts, ";")

	baseURL := strings.TrimRight(strings.TrimSpace(h.osrmURL), "/")
	if baseURL == "" {
		baseURL = "http://localhost:5000"
	}

	url := fmt.Sprintf("%s/route/v1/driving/%s?overview=full&geometries=geojson&steps=false", baseURL, coordStr)
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, "", 0, 0, fmt.Errorf("OSRM unavailable at %s: %w", baseURL, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", 0, 0, fmt.Errorf("OSRM returned status %d", resp.StatusCode)
	}
	var result struct {
		Code   string `json:"code"`
		Routes []struct {
			Distance float64 `json:"distance"`
			Duration float64 `json:"duration"`
			Geometry struct {
				Coordinates [][]float64 `json:"coordinates"`
			} `json:"geometry"`
		} `json:"routes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, "", 0, 0, fmt.Errorf("decode OSRM route: %w", err)
	}
	if result.Code != "Ok" || len(result.Routes) == 0 || len(result.Routes[0].Geometry.Coordinates) < 2 {
		return nil, "", 0, 0, fmt.Errorf("OSRM returned no usable road geometry")
	}

	coords := result.Routes[0].Geometry.Coordinates
	step := 1
	if len(coords) > 200 {
		step = len(coords) / 200
	}
	waypoints := make([]GPSWaypoint, 0, len(coords)/step+1)
	for i := 0; i < len(coords); i += step {
		c := coords[i]
		waypoints = append(waypoints, GPSWaypoint{Lat: c[1], Lng: c[0]})
	}
	last := coords[len(coords)-1]
	if len(waypoints) == 0 || waypoints[len(waypoints)-1].Lat != last[1] || waypoints[len(waypoints)-1].Lng != last[0] {
		waypoints = append(waypoints, GPSWaypoint{Lat: last[1], Lng: last[0]})
	}
	waypoints[0].Name = stops[0].Name
	waypoints[len(waypoints)-1].Name = stops[len(stops)-1].Name

	return waypoints, "osrm_local", result.Routes[0].Distance / 1000, int(result.Routes[0].Duration / 60), nil
}
