package tms

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"sync"
	"time"

	"bhl-oms/internal/domain"
	"bhl-oms/internal/events"
	"bhl-oms/internal/integration"
	"bhl-oms/internal/oms"
	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
)

type Service struct {
	repo                *Repository
	repoOms             *oms.Repository // Injected OMS repository
	vrpSolverURL        string
	jobs                sync.Map // jobID → *domain.VRPResult
	hooks               *integration.Hooks
	notifSvc            NotificationSender
	vrpBroadcaster      VRPProgressBroadcaster
	pickingOrderCreator PickingOrderCreator
	reconSvc            ReconciliationTrigger
	evtRecorder         *events.Recorder
	log                 logger.Logger
}

// NotificationSender allows sending notifications without importing notification package.
type NotificationSender interface {
	Send(ctx context.Context, userID uuid.UUID, title, body, category string, link *string) error
	SendToRole(ctx context.Context, role, title, body, category string, link *string) error
}

// VRPProgressBroadcaster sends real-time VRP progress to a specific user via WebSocket.
type VRPProgressBroadcaster interface {
	SendRawToUser(userID uuid.UUID, msg map[string]interface{})
}

// PickingOrderCreator creates picking orders in WMS when trips are approved.
type PickingOrderCreator interface {
	CreatePickingOrderForShipment(ctx context.Context, shipmentID uuid.UUID) (*domain.PickingOrder, error)
}

// ReconciliationTrigger auto-reconciles a trip when it completes.
type ReconciliationTrigger interface {
	AutoReconcileTrip(ctx context.Context, tripID uuid.UUID) ([]domain.Reconciliation, error)
}

func NewService(repo *Repository, repoOms *oms.Repository, vrpSolverURL string, log logger.Logger) *Service {
	return &Service{
		repo:         repo,
		repoOms:      repoOms,
		vrpSolverURL: vrpSolverURL,
		log:          log,
	}
}

// SetIntegrationHooks injects optional integration hooks (Tasks 3.1-3.6 wiring).
func (s *Service) SetIntegrationHooks(h *integration.Hooks) {
	s.hooks = h
}

// SetNotificationService injects notification service for cron alerts.
func (s *Service) SetNotificationService(ns NotificationSender) {
	s.notifSvc = ns
}

// SetVRPBroadcaster injects the WebSocket hub for real-time VRP progress.
func (s *Service) SetVRPBroadcaster(b VRPProgressBroadcaster) {
	s.vrpBroadcaster = b
}

// SetPickingOrderCreator injects WMS service for auto-creating picking orders on plan approval.
func (s *Service) SetPickingOrderCreator(poc PickingOrderCreator) {
	s.pickingOrderCreator = poc
}

// SetReconciliationService injects reconciliation for auto-reconcile on trip completion.
func (s *Service) SetReconciliationService(rs ReconciliationTrigger) {
	s.reconSvc = rs
}

// SetEventRecorder injects the event recorder for activity timeline.
func (s *Service) SetEventRecorder(r *events.Recorder) {
	s.evtRecorder = r
}

func (s *Service) ListPendingShipments(ctx context.Context, warehouseID uuid.UUID, deliveryDate string) ([]domain.Shipment, error) {
	return s.repo.ListPendingShipments(ctx, warehouseID, deliveryDate)
}

func (s *Service) ToggleUrgent(ctx context.Context, shipmentID uuid.UUID, isUrgent bool) error {
	return s.repo.ToggleUrgent(ctx, shipmentID, isUrgent)
}

func (s *Service) ListAllVehicles(ctx context.Context) ([]domain.Vehicle, error) {
	return s.repo.ListAllVehicles(ctx)
}

func (s *Service) GetVehicle(ctx context.Context, id uuid.UUID) (*domain.Vehicle, error) {
	return s.repo.GetVehicle(ctx, id)
}

func (s *Service) CreateVehicle(ctx context.Context, v *domain.Vehicle) error {
	return s.repo.CreateVehicle(ctx, v)
}

func (s *Service) UpdateVehicle(ctx context.Context, v *domain.Vehicle) error {
	return s.repo.UpdateVehicle(ctx, v)
}

func (s *Service) DeleteVehicle(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteVehicle(ctx, id)
}

func (s *Service) ListAllDrivers(ctx context.Context) ([]domain.Driver, error) {
	return s.repo.ListAllDrivers(ctx)
}

func (s *Service) GetDriver(ctx context.Context, id uuid.UUID) (*domain.Driver, error) {
	return s.repo.GetDriver(ctx, id)
}

func (s *Service) CreateDriver(ctx context.Context, d *domain.Driver) error {
	return s.repo.CreateDriver(ctx, d)
}

func (s *Service) UpdateDriver(ctx context.Context, d *domain.Driver) error {
	return s.repo.UpdateDriver(ctx, d)
}

func (s *Service) DeleteDriver(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteDriver(ctx, id)
}

func (s *Service) ListAvailableVehicles(ctx context.Context, warehouseID uuid.UUID, date string) ([]domain.Vehicle, error) {
	return s.repo.ListAvailableVehicles(ctx, warehouseID, date)
}

func (s *Service) ListAvailableDrivers(ctx context.Context, warehouseID uuid.UUID, date string) ([]domain.Driver, error) {
	return s.repo.ListAvailableDrivers(ctx, warehouseID, date)
}

func (s *Service) ListPendingDates(ctx context.Context, warehouseID uuid.UUID) ([]map[string]interface{}, error) {
	return s.repo.ListPendingDates(ctx, warehouseID)
}

// VRPCriteria configures optimization priorities and constraints.
type VRPCriteria struct {
	MaxCapacity    int    `json:"max_capacity"`     // priority 1-6, 0=off
	MinVehicles    int    `json:"min_vehicles"`     // priority 1-6, 0=off
	ClusterRegion  int    `json:"cluster_region"`   // priority 1-6, 0=off
	MinDistance    int    `json:"min_distance"`     // priority 1-6, 0=off
	RoundTrip      int    `json:"round_trip"`       // priority 1-6, 0=off (always on internally)
	TimeLimit      int    `json:"time_limit"`       // priority 1-6, 0=off
	MaxTripMinutes int    `json:"max_trip_minutes"` // default 480 (8h)
	CostOptimize   bool   `json:"cost_optimize"`    // when true, solver minimizes VND instead of distance
	OptimizeFor    string `json:"optimize_for"`     // "cost" = tối ưu chi phí (fuel+toll), "time" = giao nhanh, "distance" = tối ưu km
}

type RunVRPRequest struct {
	WarehouseID      uuid.UUID    `json:"warehouse_id"`
	DeliveryDate     string       `json:"delivery_date"`
	ShipmentIDs      []uuid.UUID  `json:"shipment_ids,omitempty"`
	VehicleIDs       []uuid.UUID  `json:"vehicle_ids,omitempty"`
	Criteria         *VRPCriteria `json:"criteria,omitempty"`
	RequestingUserID *uuid.UUID   `json:"-"` // Injected by handler for WS progress broadcast
}

// RunVRP sends problem to VRP solver and stores result
func (s *Service) RunVRP(ctx context.Context, req RunVRPRequest) (string, error) {
	// Get warehouse location (depot)
	depotLat, depotLng, err := s.repo.GetWarehouse(ctx, req.WarehouseID)
	if err != nil {
		return "", fmt.Errorf("get warehouse: %w", err)
	}

	// Get shipments
	shipments, err := s.repo.ListPendingShipments(ctx, req.WarehouseID, req.DeliveryDate)
	if err != nil {
		return "", fmt.Errorf("list shipments: %w", err)
	}

	if len(shipments) == 0 {
		return "", fmt.Errorf("không có shipment nào cho ngày %s", req.DeliveryDate)
	}

	// Filter if specific IDs provided
	if len(req.ShipmentIDs) > 0 {
		idSet := make(map[uuid.UUID]bool)
		for _, id := range req.ShipmentIDs {
			idSet[id] = true
		}
		var filtered []domain.Shipment
		for _, sh := range shipments {
			if idSet[sh.ID] {
				filtered = append(filtered, sh)
			}
		}
		shipments = filtered
	}

	// Get vehicles
	vehicles, err := s.repo.ListAvailableVehicles(ctx, req.WarehouseID, req.DeliveryDate)
	if err != nil {
		return "", fmt.Errorf("list vehicles: %w", err)
	}

	if len(req.VehicleIDs) > 0 {
		idSet := make(map[uuid.UUID]bool)
		for _, id := range req.VehicleIDs {
			idSet[id] = true
		}
		var filtered []domain.Vehicle
		for _, v := range vehicles {
			if idSet[v.ID] {
				filtered = append(filtered, v)
			}
		}
		vehicles = filtered
	}

	if len(vehicles) == 0 {
		return "", fmt.Errorf("không có xe khả dụng")
	}

	// Build VRP solver request
	jobID := fmt.Sprintf("vrp-%s-%04d", time.Now().Format("20060102"), time.Now().UnixNano()%10000)

	// Resolve vehicle cost info (per-vehicle profile or type default)
	costInfos, err := s.repo.ResolveVehicleCostInfo(ctx, vehicles)
	if err != nil {
		// Non-blocking: cost data is optional, log and continue
		s.log.Warn(ctx, "resolve_vehicle_cost_info_failed", logger.F("error", err.Error()))
		costInfos = nil
	}

	solverReq := buildSolverRequest(depotLat, depotLng, shipments, vehicles, jobID, costInfos)

	// Store job as processing
	s.jobs.Store(jobID, &domain.VRPResult{JobID: jobID, Status: "processing"})

	// Normalize criteria defaults
	criteria := req.Criteria
	if criteria == nil {
		criteria = &VRPCriteria{
			MaxCapacity: 1, MinVehicles: 2, ClusterRegion: 3,
			MinDistance: 4, RoundTrip: 5, TimeLimit: 6,
			MaxTripMinutes: 480,
		}
	}
	if criteria.MaxTripMinutes <= 0 {
		criteria.MaxTripMinutes = 480
	}

	// Enrich solver request with cost data — always load toll data.
	// OptimizeFor controls solver objective: "cost", "time", or "distance".
	optimizeFor := criteria.OptimizeFor
	if optimizeFor == "" {
		optimizeFor = "cost" // default: tối ưu chi phí (fuel + toll)
	}
	s.enrichSolverWithCostData(ctx, solverReq)
	solverReq.UseCostOptimization = true
	solverReq.OptimizeFor = optimizeFor
	solverReq.MaxTripMinutes = criteria.MaxTripMinutes

	// Call VRP solver asynchronously
	go s.callVRPSolver(jobID, solverReq, shipments, vehicles, criteria, req.RequestingUserID)

	return jobID, nil
}

type solverRequest struct {
	JobID               string              `json:"job_id"`
	Depot               [2]float64          `json:"depot"`
	Nodes               []solverNode        `json:"nodes"`
	Vehicles            []solverVehicle     `json:"vehicles"`
	UseCostOptimization bool                `json:"use_cost_optimization,omitempty"`
	OptimizeFor         string              `json:"optimize_for,omitempty"`
	MaxTripMinutes      int                 `json:"max_trip_minutes,omitempty"`
	TollStations        []solverTollStation `json:"toll_stations,omitempty"`
	TollExpressways     []solverTollExway   `json:"toll_expressways,omitempty"`
}

type solverNode struct {
	ID       string     `json:"id"`
	Location [2]float64 `json:"location"`
	Demand   float64    `json:"demand"`
	Name     string     `json:"name"`
}

type solverVehicle struct {
	ID            string  `json:"id"`
	Capacity      float64 `json:"capacity"`
	Plate         string  `json:"plate"`
	VehicleType   string  `json:"vehicle_type,omitempty"`
	TollClass     string  `json:"toll_class,omitempty"`
	FuelCostPerKm float64 `json:"fuel_cost_per_km,omitempty"`
}

type solverTollStation struct {
	Name    string  `json:"name"`
	Lat     float64 `json:"lat"`
	Lng     float64 `json:"lng"`
	RadiusM int     `json:"radius_m"`
	FeeL1   float64 `json:"fee_l1"`
	FeeL2   float64 `json:"fee_l2"`
	FeeL3   float64 `json:"fee_l3"`
	FeeL4   float64 `json:"fee_l4"`
	FeeL5   float64 `json:"fee_l5"`
}

type solverTollExway struct {
	Name        string           `json:"name"`
	RatePerKmL1 float64          `json:"rate_per_km_l1"`
	RatePerKmL2 float64          `json:"rate_per_km_l2"`
	RatePerKmL3 float64          `json:"rate_per_km_l3"`
	RatePerKmL4 float64          `json:"rate_per_km_l4"`
	RatePerKmL5 float64          `json:"rate_per_km_l5"`
	Gates       []solverTollGate `json:"gates"`
}

type solverTollGate struct {
	Name     string  `json:"name"`
	Lat      float64 `json:"lat"`
	Lng      float64 `json:"lng"`
	RadiusM  int     `json:"radius_m"`
	KmMarker float64 `json:"km_marker"`
}

func buildSolverRequest(depotLat, depotLng float64, shipments []domain.Shipment, vehicles []domain.Vehicle, jobID string, costInfos []domain.VehicleCostInfo) *solverRequest {
	req := &solverRequest{
		JobID: jobID,
		Depot: [2]float64{depotLat, depotLng},
	}

	for _, sh := range shipments {
		lat := 0.0
		lng := 0.0
		if sh.Latitude != nil {
			lat = *sh.Latitude
		}
		if sh.Longitude != nil {
			lng = *sh.Longitude
		}
		req.Nodes = append(req.Nodes, solverNode{
			ID:       sh.ID.String(),
			Location: [2]float64{lat, lng},
			Demand:   sh.TotalWeightKg,
			Name:     sh.CustomerName,
		})
	}

	// Build cost info lookup
	costMap := make(map[string]domain.VehicleCostInfo)
	for _, ci := range costInfos {
		costMap[ci.VehicleID.String()] = ci
	}

	for _, v := range vehicles {
		sv := solverVehicle{
			ID:          v.ID.String(),
			Capacity:    v.CapacityKg,
			Plate:       v.PlateNumber,
			VehicleType: v.VehicleType,
		}
		if ci, ok := costMap[v.ID.String()]; ok {
			sv.TollClass = ci.TollClass
			sv.FuelCostPerKm = ci.FuelCostPerKm
		}
		req.Vehicles = append(req.Vehicles, sv)
	}

	return req
}

type solverResponse struct {
	Status         string `json:"status"`
	SolveTime      int    `json:"solve_time_ms"`
	DistanceSource string `json:"distance_source,omitempty"`
	OptimizeFor    string `json:"optimize_for,omitempty"`
	Routes         []struct {
		VehicleID     string   `json:"vehicle_id"`
		NodeIDs       []string `json:"node_ids"`
		Distance      float64  `json:"distance_km"`
		Duration      int      `json:"duration_min"`
		CostBreakdown *struct {
			FuelCostVND  float64 `json:"fuel_cost_vnd"`
			TollCostVND  float64 `json:"toll_cost_vnd"`
			TotalCostVND float64 `json:"total_route_cost_vnd"`
			TollsPassed  []struct {
				StationName string   `json:"station_name"`
				FeeVND      float64  `json:"fee_vnd"`
				DistanceKm  *float64 `json:"distance_km,omitempty"`
				Latitude    float64  `json:"latitude,omitempty"`
				Longitude   float64  `json:"longitude,omitempty"`
				TollType    string   `json:"toll_type,omitempty"`
			} `json:"tolls_passed"`
		} `json:"cost_breakdown,omitempty"`
	} `json:"routes"`
	Unassigned []string `json:"unassigned"`
}

func (s *Service) callVRPSolver(jobID string, req *solverRequest, shipments []domain.Shipment, vehicles []domain.Vehicle, criteria *VRPCriteria, userID *uuid.UUID) {
	body, _ := json.Marshal(req)

	// Helper to broadcast VRP progress via WebSocket
	broadcastProgress := func(stage string, pct int, detail string) {
		if s.vrpBroadcaster == nil || userID == nil {
			return
		}
		s.vrpBroadcaster.SendRawToUser(*userID, map[string]interface{}{
			"type":   "vrp_progress",
			"job_id": jobID,
			"stage":  stage,
			"pct":    pct,
			"detail": detail,
		})
	}

	client := &http.Client{Timeout: 300 * time.Second}

	// Try streaming endpoint first for real-time progress
	resp, err := client.Post(s.vrpSolverURL+"/solve-stream", "application/json", bytes.NewReader(body))
	if err != nil {
		// Solver unreachable → fall back to mock for demo
		s.log.Warn(context.Background(), "vrp_solver_unreachable", logger.F("error", err.Error()))
		broadcastProgress("error", 0, "Solver không khả dụng, dùng thuật toán dự phòng")
		result := s.buildMockResult(jobID, req.Depot, shipments, vehicles, criteria)
		result.DistanceSource = "mock"
		s.jobs.Store(jobID, result)
		broadcastProgress("done", 100, "Hoàn tất (dự phòng)")
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		// Streaming endpoint not available — fallback to /solve
		s.log.Info(context.Background(), "vrp_solve_stream_unavailable_fallback_to_solve")
		s.callVRPSolverLegacy(jobID, req, shipments, vehicles, criteria, userID)
		return
	}

	// Read NDJSON lines from streaming response
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 10*1024*1024), 10*1024*1024) // 10MB buffer for result line
	var solverResp solverResponse
	gotResult := false

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}

		var msg struct {
			Type   string          `json:"type"`
			Stage  string          `json:"stage"`
			Pct    int             `json:"pct"`
			Detail string          `json:"detail"`
			Data   json.RawMessage `json:"data"`
			Error  string          `json:"error"`
		}
		if err := json.Unmarshal(line, &msg); err != nil {
			continue
		}

		switch msg.Type {
		case "progress":
			broadcastProgress(msg.Stage, msg.Pct, msg.Detail)
			// Also update job with progress info
			s.jobs.Store(jobID, &domain.VRPResult{
				JobID:  jobID,
				Status: "processing",
				Stage:  msg.Stage,
				Pct:    msg.Pct,
				Detail: msg.Detail,
			})
		case "result":
			if err := json.Unmarshal(msg.Data, &solverResp); err != nil {
				s.log.Warn(context.Background(), "vrp_solver_result_unmarshal_error")
				result := &domain.VRPResult{
					JobID:  jobID,
					Status: "failed",
					Error:  "Không thể đọc kết quả từ VRP solver",
				}
				s.jobs.Store(jobID, result)
				return
			}
			gotResult = true
		case "error":
			result := &domain.VRPResult{
				JobID:  jobID,
				Status: "failed",
				Error:  fmt.Sprintf("VRP solver lỗi: %s", msg.Error),
			}
			s.jobs.Store(jobID, result)
			broadcastProgress("error", 0, msg.Error)
			return
		}
	}

	if !gotResult {
		result := &domain.VRPResult{
			JobID:  jobID,
			Status: "failed",
			Error:  "VRP solver không trả về kết quả",
		}
		s.jobs.Store(jobID, result)
		return
	}

	// Handle no_solution from solver
	if solverResp.Status == "no_solution" {
		result := &domain.VRPResult{
			JobID:     jobID,
			Status:    "no_solution",
			SolveTime: solverResp.SolveTime,
			Error:     "VRP solver không tìm được phương án phù hợp. Thử điều chỉnh xe hoặc đơn hàng.",
		}
		for _, nodeID := range solverResp.Unassigned {
			id, _ := uuid.Parse(nodeID)
			result.Unassigned = append(result.Unassigned, id)
		}
		s.jobs.Store(jobID, result)
		return
	}

	// Convert solver response to domain result
	result := s.convertSolverResult(jobID, &solverResp, shipments, vehicles)
	s.jobs.Store(jobID, result)
}

// callVRPSolverLegacy is the original non-streaming /solve call (fallback).
func (s *Service) callVRPSolverLegacy(jobID string, req *solverRequest, shipments []domain.Shipment, vehicles []domain.Vehicle, criteria *VRPCriteria, userID *uuid.UUID) {
	body, _ := json.Marshal(req)

	client := &http.Client{Timeout: 300 * time.Second}
	resp, err := client.Post(s.vrpSolverURL+"/solve", "application/json", bytes.NewReader(body))

	if err != nil {
		// Solver unreachable → fall back to mock for demo
		s.log.Warn(context.Background(), "vrp_solver_unreachable", logger.F("error", err.Error()))
		result := s.buildMockResult(jobID, req.Depot, shipments, vehicles, criteria)
		result.DistanceSource = "mock"
		s.jobs.Store(jobID, result)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	// Check HTTP status — solver returns 500 on crash with {"error": "..."}
	if resp.StatusCode != http.StatusOK {
		s.log.Warn(context.Background(), "vrp_solver_http_error",
			logger.F("status_code", resp.StatusCode))
		result := &domain.VRPResult{
			JobID:  jobID,
			Status: "failed",
			Error:  fmt.Sprintf("VRP solver trả về lỗi (HTTP %d)", resp.StatusCode),
		}
		// Try to extract error message from response
		var errResp struct {
			Error string `json:"error"`
		}
		if json.Unmarshal(respBody, &errResp) == nil && errResp.Error != "" {
			result.Error = fmt.Sprintf("VRP solver lỗi: %s", errResp.Error)
		}
		s.jobs.Store(jobID, result)
		return
	}

	var solverResp solverResponse
	if err := json.Unmarshal(respBody, &solverResp); err != nil {
		s.log.Warn(context.Background(), "vrp_solver_unmarshal_error")
		result := &domain.VRPResult{
			JobID:  jobID,
			Status: "failed",
			Error:  "Không thể đọc kết quả từ VRP solver",
		}
		s.jobs.Store(jobID, result)
		return
	}

	// Handle no_solution from solver
	if solverResp.Status == "no_solution" {
		result := &domain.VRPResult{
			JobID:     jobID,
			Status:    "no_solution",
			SolveTime: solverResp.SolveTime,
			Error:     "VRP solver không tìm được phương án phù hợp. Thử điều chỉnh xe hoặc đơn hàng.",
		}
		for _, nodeID := range solverResp.Unassigned {
			id, _ := uuid.Parse(nodeID)
			result.Unassigned = append(result.Unassigned, id)
		}
		s.jobs.Store(jobID, result)
		return
	}

	// Convert solver response to domain result
	result := s.convertSolverResult(jobID, &solverResp, shipments, vehicles)
	s.jobs.Store(jobID, result)
}

// haversineKm calculates distance in km between two GPS coordinates.
func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	dLat := (lat2 - lat1) * math.Pi / 180
	dLon := (lon2 - lon1) * math.Pi / 180
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*math.Pi/180)*math.Cos(lat2*math.Pi/180)*
			math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

// buildMockResult implements a configurable VRP heuristic with consolidation & split delivery.
// Phase 0: consolidate same-customer shipments into virtual nodes.
// Phase 1: geo-cluster into sectors.
// Phase 2: bin-pack with best-fit + split delivery when partially fitting.
// Phase 3: nearest-neighbor ordering; expand consolidated/split stops.
func (s *Service) buildMockResult(jobID string, depot [2]float64, shipments []domain.Shipment, vehicles []domain.Vehicle, criteria *VRPCriteria) *domain.VRPResult {
	result := &domain.VRPResult{
		JobID:     jobID,
		Status:    "completed",
		SolveTime: 500,
	}

	const avgSpeedKmH = 40.0
	const serviceMin = 20.0
	const windingFactor = 1.3
	const minSplitKg = 100.0 // don't create splits smaller than 100kg

	// Fuel cost per km by vehicle type (consumption L/km × diesel price 24,500 VND/L)
	mockCostPerKm := map[string]float64{
		"truck_3t5": 0.12 * 24500, // 2,940 VND/km
		"truck_5t":  0.16 * 24500, // 3,920 VND/km
		"truck_8t":  0.22 * 24500, // 5,390 VND/km
		"truck_15t": 0.28 * 24500, // 6,860 VND/km
	}

	// ── Phase 0: Consolidate same-customer shipments ────
	type consolidatedNode struct {
		customerID   uuid.UUID
		customerName string
		customerAddr string
		lat          float64
		lng          float64
		totalWeight  float64
		shipments    []domain.Shipment
	}

	custMap := make(map[uuid.UUID]*consolidatedNode)
	var custOrder []uuid.UUID
	for _, sh := range shipments {
		node, exists := custMap[sh.CustomerID]
		if !exists {
			lat, lng := 0.0, 0.0
			if sh.Latitude != nil {
				lat = *sh.Latitude
			}
			if sh.Longitude != nil {
				lng = *sh.Longitude
			}
			node = &consolidatedNode{
				customerID:   sh.CustomerID,
				customerName: sh.CustomerName,
				customerAddr: sh.CustomerAddress,
				lat:          lat,
				lng:          lng,
			}
			custMap[sh.CustomerID] = node
			custOrder = append(custOrder, sh.CustomerID)
		}
		node.shipments = append(node.shipments, sh)
		node.totalWeight += sh.TotalWeightKg
	}

	type shipGeo struct {
		node           *consolidatedNode
		lat            float64
		lng            float64
		bearing        float64
		depotKm        float64
		assignedWeight float64 // may be < node.totalWeight for split parts
		isSplitPart    bool
		splitPart      int
		splitTotal     int
	}

	geos := make([]shipGeo, 0, len(custOrder))
	for _, cid := range custOrder {
		node := custMap[cid]
		bearing := math.Atan2(
			math.Sin((node.lng-depot[1])*math.Pi/180)*math.Cos(node.lat*math.Pi/180),
			math.Cos(depot[0]*math.Pi/180)*math.Sin(node.lat*math.Pi/180)-
				math.Sin(depot[0]*math.Pi/180)*math.Cos(node.lat*math.Pi/180)*math.Cos((node.lng-depot[1])*math.Pi/180),
		)
		dist := haversineKm(depot[0], depot[1], node.lat, node.lng)
		geos = append(geos, shipGeo{
			node: node, lat: node.lat, lng: node.lng,
			bearing: bearing, depotKm: dist,
			assignedWeight: node.totalWeight,
		})
	}

	// ── Phase 1: Global FFD bin-packing ────────────────
	// Pack purely by weight for maximum utilization.
	// Assign actual vehicle when opening each bin (smallest vehicle that fits).
	// No geographic/time constraint during packing — those are handled in trip ordering.

	// Sort ALL geos by weight DESCENDING (First-Fit Decreasing for tight packing)
	sort.Slice(geos, func(i, j int) bool {
		return geos[i].assignedWeight > geos[j].assignedWeight
	})

	// Vehicle pool sorted by capacity ASC — "smallest vehicle that fits" lookup
	vPool := make([]domain.Vehicle, len(vehicles))
	copy(vPool, vehicles)
	sort.Slice(vPool, func(i, j int) bool { return vPool[i].CapacityKg < vPool[j].CapacityKg })
	vPoolUsed := make([]bool, len(vPool))

	type bin struct {
		vehicle    domain.Vehicle
		items      []shipGeo
		usedWeight float64
		cap        float64
	}

	var bins []bin
	splitTracker := make(map[uuid.UUID]int)

	for gi := range geos {
		g := geos[gi]
		remaining := g.assignedWeight

		for remaining > 0 {
			placed := false

			// ── Best-fit: find bin with LEAST remaining space that still holds `remaining`
			bestBin := -1
			bestSpace := math.MaxFloat64
			for i := range bins {
				space := bins[i].cap - bins[i].usedWeight
				if space >= remaining && space < bestSpace {
					bestSpace = space
					bestBin = i
				}
			}

			if bestBin >= 0 {
				splitTracker[g.node.customerID]++
				partG := g
				partG.assignedWeight = remaining
				partG.splitPart = splitTracker[g.node.customerID]
				bins[bestBin].items = append(bins[bestBin].items, partG)
				bins[bestBin].usedWeight += remaining
				remaining = 0
				placed = true
			}

			// ── Open new bin: smallest available vehicle >= remaining weight
			if !placed {
				newVi := -1
				for vi := range vPool {
					if !vPoolUsed[vi] && vPool[vi].CapacityKg >= remaining {
						newVi = vi
						break // ASC order → first fit = smallest
					}
				}
				if newVi >= 0 {
					vPoolUsed[newVi] = true
					splitTracker[g.node.customerID]++
					partG := g
					partG.assignedWeight = remaining
					partG.splitPart = splitTracker[g.node.customerID]
					bins = append(bins, bin{
						vehicle:    vPool[newVi],
						cap:        vPool[newVi].CapacityKg,
						items:      []shipGeo{partG},
						usedWeight: remaining,
					})
					remaining = 0
					placed = true
				}
			}

			// ── Split delivery: partial fit into bin with most remaining space
			if !placed {
				bestPartial := -1
				bestPartialSpace := 0.0
				for i := range bins {
					space := bins[i].cap - bins[i].usedWeight
					if space >= minSplitKg && space > bestPartialSpace {
						bestPartialSpace = space
						bestPartial = i
					}
				}

				if bestPartial >= 0 {
					splitTracker[g.node.customerID]++
					partG := g
					partG.assignedWeight = bestPartialSpace
					partG.isSplitPart = true
					partG.splitPart = splitTracker[g.node.customerID]
					bins[bestPartial].items = append(bins[bestPartial].items, partG)
					bins[bestPartial].usedWeight += bestPartialSpace
					remaining -= bestPartialSpace
					continue // loop for remainder
				}

				// Open largest available vehicle for partial
				opened := false
				for vi := len(vPool) - 1; vi >= 0; vi-- {
					if !vPoolUsed[vi] {
						vPoolUsed[vi] = true
						canFit := math.Min(remaining, vPool[vi].CapacityKg)
						if canFit >= minSplitKg {
							splitTracker[g.node.customerID]++
							partG := g
							partG.assignedWeight = canFit
							partG.isSplitPart = remaining > canFit
							partG.splitPart = splitTracker[g.node.customerID]
							bins = append(bins, bin{
								vehicle:    vPool[vi],
								cap:        vPool[vi].CapacityKg,
								items:      []shipGeo{partG},
								usedWeight: canFit,
							})
							remaining -= canFit
							opened = true
						}
						break
					}
				}
				if !opened {
					for _, sh := range g.node.shipments {
						result.Unassigned = append(result.Unassigned, sh.ID)
					}
					remaining = 0
				}
			}
		}

		// Backfill splitTotal for all parts of this node
		totalParts := splitTracker[g.node.customerID]
		if totalParts > 1 {
			for bi := range bins {
				for ii := range bins[bi].items {
					if bins[bi].items[ii].node.customerID == g.node.customerID {
						bins[bi].items[ii].splitTotal = totalParts
						bins[bi].items[ii].isSplitPart = true
					}
				}
			}
		}
	}

	// ── Phase 3: Build trips ───────────────────────────
	var consolidatedStops int
	var splitDeliveries int

	for _, b := range bins {
		if len(b.items) == 0 {
			continue
		}
		trip := domain.VRPTrip{
			VehicleID:   b.vehicle.ID,
			PlateNumber: b.vehicle.PlateNumber,
			VehicleType: b.vehicle.VehicleType,
		}

		// Nearest-neighbor from depot
		remaining := make([]shipGeo, len(b.items))
		copy(remaining, b.items)
		ordered := make([]shipGeo, 0, len(remaining))
		curLat, curLng := depot[0], depot[1]
		for len(remaining) > 0 {
			bestIdx, bestDist := 0, math.MaxFloat64
			for i, g := range remaining {
				d := haversineKm(curLat, curLng, g.lat, g.lng)
				if d < bestDist {
					bestDist = d
					bestIdx = i
				}
			}
			ordered = append(ordered, remaining[bestIdx])
			curLat, curLng = remaining[bestIdx].lat, remaining[bestIdx].lng
			remaining = append(remaining[:bestIdx], remaining[bestIdx+1:]...)
		}

		var cumWeight float64
		stopIdx := 0
		for _, g := range ordered {
			node := g.node
			cumWeight += g.assignedWeight
			stopIdx++

			var consolidatedIDs []uuid.UUID
			if len(node.shipments) > 1 {
				for _, sh := range node.shipments {
					consolidatedIDs = append(consolidatedIDs, sh.ID)
				}
				consolidatedStops++
			}

			isSplit := g.isSplitPart && g.splitTotal > 1

			if isSplit {
				splitDeliveries++
			}

			trip.Stops = append(trip.Stops, domain.VRPStop{
				ShipmentID:       node.shipments[0].ID,
				CustomerID:       node.customerID,
				CustomerName:     node.customerName,
				CustomerAddress:  node.customerAddr,
				Latitude:         node.lat,
				Longitude:        node.lng,
				StopOrder:        stopIdx,
				CumulativeLoadKg: cumWeight,
				WeightKg:         g.assignedWeight,
				ConsolidatedIDs:  consolidatedIDs,
				IsSplit:          isSplit,
				SplitPart:        g.splitPart,
				SplitTotal:       g.splitTotal,
				OriginalWeightKg: node.totalWeight,
			})
		}

		// Route distance: depot → stops → depot × winding
		var routeDist float64
		pLat, pLng := depot[0], depot[1]
		for _, stop := range trip.Stops {
			if stop.Latitude != 0 || stop.Longitude != 0 {
				routeDist += haversineKm(pLat, pLng, stop.Latitude, stop.Longitude)
				pLat, pLng = stop.Latitude, stop.Longitude
			}
		}
		routeDist += haversineKm(pLat, pLng, depot[0], depot[1])
		routeDist *= windingFactor

		trip.TotalDistanceKm = math.Round(routeDist*10) / 10
		trip.TotalDurationMin = int(routeDist/avgSpeedKmH*60) + len(b.items)*int(serviceMin)
		trip.TotalWeightKg = cumWeight

		// Post-hoc cost calculation for mock result using vehicle type defaults
		if fuelCostPerKm, ok := mockCostPerKm[b.vehicle.VehicleType]; ok {
			fuelCost := fuelCostPerKm * trip.TotalDistanceKm
			trip.FuelCostVND = math.Round(fuelCost)
			trip.TotalCostVND = trip.FuelCostVND // toll = 0 in mock (no route geometry)
			if trip.TotalWeightKg > 0 {
				trip.CostPerTonVND = trip.TotalCostVND / (trip.TotalWeightKg / 1000)
			}
		}

		result.Trips = append(result.Trips, trip)
	}

	result.Summary = computeSummary(result, vehicles, shipments)
	result.Summary.ConsolidatedStops = consolidatedStops
	result.Summary.SplitDeliveries = splitDeliveries

	return result
}

func (s *Service) convertSolverResult(jobID string, resp *solverResponse, shipments []domain.Shipment, vehicles []domain.Vehicle) *domain.VRPResult {
	shipmentMap := make(map[string]domain.Shipment)
	for _, sh := range shipments {
		shipmentMap[sh.ID.String()] = sh
	}

	vehicleMap := make(map[string]domain.Vehicle)
	for _, v := range vehicles {
		vehicleMap[v.ID.String()] = v
	}

	result := &domain.VRPResult{
		JobID:          jobID,
		Status:         "completed",
		SolveTime:      resp.SolveTime,
		DistanceSource: resp.DistanceSource,
		OptimizeFor:    resp.OptimizeFor,
	}

	var totalDist float64
	var assigned int

	for _, route := range resp.Routes {
		vehicleID, _ := uuid.Parse(route.VehicleID)
		veh := vehicleMap[route.VehicleID]
		trip := domain.VRPTrip{
			VehicleID:        vehicleID,
			PlateNumber:      veh.PlateNumber,
			VehicleType:      veh.VehicleType,
			TotalDistanceKm:  route.Distance,
			TotalDurationMin: route.Duration,
		}

		var cumWeight float64
		for stopIdx, nodeID := range route.NodeIDs {
			sh := shipmentMap[nodeID]
			cumWeight += sh.TotalWeightKg
			lat := 0.0
			lng := 0.0
			if sh.Latitude != nil {
				lat = *sh.Latitude
			}
			if sh.Longitude != nil {
				lng = *sh.Longitude
			}
			trip.Stops = append(trip.Stops, domain.VRPStop{
				ShipmentID:       sh.ID,
				CustomerID:       sh.CustomerID,
				CustomerName:     sh.CustomerName,
				CustomerAddress:  sh.CustomerAddress,
				Latitude:         lat,
				Longitude:        lng,
				StopOrder:        stopIdx + 1,
				CumulativeLoadKg: cumWeight,
			})
			assigned++
		}
		trip.TotalWeightKg = cumWeight

		// Map cost breakdown from solver response
		if route.CostBreakdown != nil {
			cb := route.CostBreakdown
			trip.FuelCostVND = cb.FuelCostVND
			trip.TollCostVND = cb.TollCostVND
			trip.TotalCostVND = cb.TotalCostVND
			if trip.TotalWeightKg > 0 {
				trip.CostPerTonVND = cb.TotalCostVND / (trip.TotalWeightKg / 1000)
			}
			for _, tp := range cb.TollsPassed {
				trip.TollsPassed = append(trip.TollsPassed, domain.TollPassDetail{
					StationName: tp.StationName,
					FeeVND:      tp.FeeVND,
					DistanceKm:  tp.DistanceKm,
					Latitude:    tp.Latitude,
					Longitude:   tp.Longitude,
					TollType:    tp.TollType,
				})
			}
		}

		totalDist += route.Distance
		result.Trips = append(result.Trips, trip)
	}

	for _, nodeID := range resp.Unassigned {
		id, _ := uuid.Parse(nodeID)
		result.Unassigned = append(result.Unassigned, id)
	}

	result.Summary = computeSummary(result, vehicles, shipments)

	return result
}

// enrichSolverWithCostData loads toll stations/expressways and adds them to the solver request.
// Toll data is ALWAYS loaded — the optimize_for field controls how solver uses it.
func (s *Service) enrichSolverWithCostData(ctx context.Context, req *solverRequest) {
	// Load active toll stations
	stations, err := s.repo.ListActiveTollStations(ctx)
	if err != nil {
		s.log.Warn(ctx, "load_toll_stations_failed", logger.F("error", err.Error()))
	} else {
		for _, st := range stations {
			req.TollStations = append(req.TollStations, solverTollStation{
				Name:    st.StationName,
				Lat:     st.Latitude,
				Lng:     st.Longitude,
				RadiusM: st.DetectionRadiusM,
				FeeL1:   st.FeeL1, FeeL2: st.FeeL2, FeeL3: st.FeeL3,
				FeeL4: st.FeeL4, FeeL5: st.FeeL5,
			})
		}
	}

	// Load active expressways with gates
	expressways, err := s.repo.ListActiveTollExpressways(ctx)
	if err != nil {
		s.log.Warn(ctx, "load_toll_expressways_failed", logger.F("error", err.Error()))
	} else {
		for _, ew := range expressways {
			exway := solverTollExway{
				Name:        ew.ExpresswayName,
				RatePerKmL1: ew.RatePerKmL1, RatePerKmL2: ew.RatePerKmL2,
				RatePerKmL3: ew.RatePerKmL3, RatePerKmL4: ew.RatePerKmL4,
				RatePerKmL5: ew.RatePerKmL5,
			}
			for _, g := range ew.Gates {
				if g.IsActive {
					exway.Gates = append(exway.Gates, solverTollGate{
						Name:     g.GateName,
						Lat:      g.Latitude,
						Lng:      g.Longitude,
						RadiusM:  g.DetectionRadiusM,
						KmMarker: g.KmMarker,
					})
				}
			}
			req.TollExpressways = append(req.TollExpressways, exway)
		}
	}
}

func computeSummary(result *domain.VRPResult, vehicles []domain.Vehicle, shipments []domain.Shipment) domain.VRPSummary {
	vehicleMap := make(map[string]domain.Vehicle)
	for _, v := range vehicles {
		vehicleMap[v.ID.String()] = v
	}

	var totalDist float64
	var totalDur int
	var totalWeight float64
	var totalStops int
	var utilSum float64
	var assigned int
	var totalCost, totalFuel, totalToll, totalDriver float64

	for _, trip := range result.Trips {
		totalDist += trip.TotalDistanceKm
		totalDur += trip.TotalDurationMin
		totalWeight += trip.TotalWeightKg
		totalStops += len(trip.Stops)
		assigned += len(trip.Stops)
		totalCost += trip.TotalCostVND
		totalFuel += trip.FuelCostVND
		totalToll += trip.TollCostVND
		totalDriver += trip.DriverCostVND

		if v, ok := vehicleMap[trip.VehicleID.String()]; ok && v.CapacityKg > 0 {
			utilSum += trip.TotalWeightKg / v.CapacityKg * 100
		}
	}

	avgUtil := 0.0
	avgStops := 0.0
	avgCostPerTon := 0.0
	if len(result.Trips) > 0 {
		avgUtil = utilSum / float64(len(result.Trips))
		avgStops = float64(totalStops) / float64(len(result.Trips))
	}
	avgCostPerKm := 0.0
	avgCostPerShipment := 0.0
	tollRatio := 0.0
	if totalWeight > 0 && totalCost > 0 {
		avgCostPerTon = totalCost / (totalWeight / 1000)
	}
	if totalDist > 0 && totalCost > 0 {
		avgCostPerKm = totalCost / totalDist
	}
	if assigned > 0 && totalCost > 0 {
		avgCostPerShipment = totalCost / float64(assigned)
	}
	if totalCost > 0 {
		tollRatio = totalToll / totalCost * 100
	}

	return domain.VRPSummary{
		TotalTrips:             len(result.Trips),
		TotalVehicles:          len(result.Trips),
		TotalShipmentsAssigned: assigned,
		TotalUnassigned:        len(result.Unassigned),
		TotalDistanceKm:        totalDist,
		TotalDurationMin:       totalDur,
		TotalWeightKg:          totalWeight,
		AvgCapacityUtil:        avgUtil,
		AvgStopsPerTrip:        avgStops,
		SolveTimeMs:            result.SolveTime,
		TotalCostVND:           totalCost,
		TotalFuelCostVND:       totalFuel,
		TotalTollCostVND:       totalToll,
		TotalDriverCost:        totalDriver,
		AvgCostPerTonVND:       avgCostPerTon,
		AvgCostPerKmVND:        avgCostPerKm,
		AvgCostPerShipment:     avgCostPerShipment,
		TollCostRatioPct:       tollRatio,
	}
}

func (s *Service) GetVRPResult(jobID string) (*domain.VRPResult, error) {
	val, ok := s.jobs.Load(jobID)
	if !ok {
		return nil, fmt.Errorf("job not found")
	}
	return val.(*domain.VRPResult), nil
}

type ApprovePlanRequest struct {
	JobID        string       `json:"job_id"`
	WarehouseID  uuid.UUID    `json:"warehouse_id"`
	DeliveryDate string       `json:"delivery_date"`
	Assignments  []Assignment `json:"assignments"`
	Trips        []ManualTrip `json:"trips,omitempty"` // for manual planning mode
	// Internal — set by handler, not from JSON
	ActorID   *uuid.UUID `json:"-"`
	ActorName string     `json:"-"`
}

type Assignment struct {
	VehicleID   uuid.UUID   `json:"vehicle_id"`
	DriverID    *uuid.UUID  `json:"driver_id"`
	ShipmentIDs []uuid.UUID `json:"shipment_ids"`
}

type ManualTrip struct {
	VehicleID        uuid.UUID    `json:"vehicle_id"`
	Stops            []ManualStop `json:"stops"`
	TotalWeightKg    float64      `json:"total_weight_kg"`
	TotalDistanceKm  float64      `json:"total_distance_km"`
	TotalDurationMin int          `json:"total_duration_min"`
}

type ManualStop struct {
	ShipmentID       uuid.UUID `json:"shipment_id"`
	StopOrder        int       `json:"stop_order"`
	CustomerName     string    `json:"customer_name"`
	CumulativeLoadKg float64   `json:"cumulative_load_kg"`
}

// ApprovePlan creates actual trips from VRP result or manual planning
func (s *Service) ApprovePlan(ctx context.Context, req ApprovePlanRequest) ([]domain.Trip, error) {
	var vrpTrips []domain.VRPTrip

	if len(req.Trips) > 0 {
		// Prefer trips data from request body (works for both VRP and manual mode)
		for _, mt := range req.Trips {
			vt := domain.VRPTrip{
				VehicleID:        mt.VehicleID,
				TotalWeightKg:    mt.TotalWeightKg,
				TotalDistanceKm:  mt.TotalDistanceKm,
				TotalDurationMin: mt.TotalDurationMin,
			}
			for _, ms := range mt.Stops {
				vt.Stops = append(vt.Stops, domain.VRPStop{
					ShipmentID:       ms.ShipmentID,
					StopOrder:        ms.StopOrder,
					CustomerName:     ms.CustomerName,
					CumulativeLoadKg: ms.CumulativeLoadKg,
				})
			}
			vrpTrips = append(vrpTrips, vt)
		}
	} else if req.JobID != "" && req.JobID != "manual" {
		// Fallback: lookup in-memory VRP job
		result, err := s.GetVRPResult(req.JobID)
		if err != nil {
			return nil, fmt.Errorf("kế hoạch đã hết hạn, vui lòng chạy lại VRP")
		}
		if result.Status != "completed" {
			return nil, fmt.Errorf("VRP chưa hoàn thành")
		}
		vrpTrips = result.Trips
	} else if len(req.Assignments) > 0 {
		// Fallback: build minimal trips from assignments
		for _, a := range req.Assignments {
			vt := domain.VRPTrip{VehicleID: a.VehicleID}
			for i, sid := range a.ShipmentIDs {
				vt.Stops = append(vt.Stops, domain.VRPStop{
					ShipmentID: sid,
					StopOrder:  i + 1,
				})
			}
			vrpTrips = append(vrpTrips, vt)
		}
	} else {
		return nil, fmt.Errorf("cần job_id hoặc trips data")
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Collect all shipment IDs from stops and resolve customer_id
	var allShipmentIDs []uuid.UUID
	for _, vt := range vrpTrips {
		for _, st := range vt.Stops {
			if st.ShipmentID != (uuid.UUID{}) {
				allShipmentIDs = append(allShipmentIDs, st.ShipmentID)
			}
		}
	}
	shipmentCustomerMap, err := s.repo.GetShipmentCustomerMap(ctx, allShipmentIDs)
	if err != nil {
		return nil, fmt.Errorf("lookup shipment customers: %w", err)
	}

	// Build assignment map: vehicle_id → Assignment
	assignMap := make(map[uuid.UUID]Assignment)
	for _, a := range req.Assignments {
		assignMap[a.VehicleID] = a
	}

	deliveryDate := req.DeliveryDate
	if deliveryDate == "" {
		deliveryDate = time.Now().Format("2006-01-02")
	}

	var trips []domain.Trip
	for _, vrpTrip := range vrpTrips {
		tripNumber, err := s.repo.NextTripNumber(ctx, tx, time.Now().Format("20060102"))
		if err != nil {
			return nil, fmt.Errorf("generate trip number: %w", err)
		}

		vehicleID := &vrpTrip.VehicleID
		var driverID *uuid.UUID

		if assignment, ok := assignMap[vrpTrip.VehicleID]; ok {
			vehicleID = &assignment.VehicleID
			if assignment.DriverID != nil && *assignment.DriverID != (uuid.UUID{}) {
				driverID = assignment.DriverID
			}
		}

		trip := domain.Trip{
			TripNumber:       tripNumber,
			WarehouseID:      req.WarehouseID,
			VehicleID:        vehicleID,
			DriverID:         driverID,
			Status:           "planned",
			PlannedDate:      deliveryDate,
			TotalStops:       len(vrpTrip.Stops),
			TotalWeightKg:    vrpTrip.TotalWeightKg,
			TotalDistanceKm:  vrpTrip.TotalDistanceKm,
			TotalDurationMin: vrpTrip.TotalDurationMin,
		}

		if err := s.repo.CreateTrip(ctx, tx, &trip); err != nil {
			return nil, fmt.Errorf("create trip: %w", err)
		}

		// Create stops
		for _, stop := range vrpTrip.Stops {
			customerID := stop.CustomerID
			// Resolve customer_id from shipment if not provided
			if customerID == (uuid.UUID{}) {
				if cid, ok := shipmentCustomerMap[stop.ShipmentID]; ok {
					customerID = cid
				}
			}

			tripStop := domain.TripStop{
				TripID:           trip.ID,
				ShipmentID:       &stop.ShipmentID,
				CustomerID:       customerID,
				StopOrder:        stop.StopOrder,
				Status:           "pending",
				CumulativeLoadKg: stop.CumulativeLoadKg,
			}

			if err := s.repo.CreateTripStop(ctx, tx, &tripStop); err != nil {
				return nil, fmt.Errorf("create stop: %w", err)
			}
			trip.Stops = append(trip.Stops, tripStop)
		}

		trips = append(trips, trip)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
	}

	// After commit: update order statuses to "planned" and record timeline events
	if s.evtRecorder != nil || s.repoOms != nil {
		shipmentOrderMap, _ := s.repo.GetShipmentOrderMap(ctx, allShipmentIDs)
		seenOrders := make(map[uuid.UUID]bool)
		for _, trip := range trips {
			for _, stop := range trip.Stops {
				if stop.ShipmentID == nil {
					continue
				}
				info, ok := shipmentOrderMap[*stop.ShipmentID]
				if !ok {
					continue
				}
				if seenOrders[info.OrderID] {
					continue
				}
				seenOrders[info.OrderID] = true
				// Update order status to "planned"
				if s.repoOms != nil {
					_ = s.repoOms.UpdateOrderStatus(ctx, info.OrderID, "planned")
				}
				// Record timeline event
				if s.evtRecorder != nil {
					s.evtRecorder.RecordAsync(events.OrderPlannedEvent(
						info.OrderID, req.ActorID, req.ActorName,
						info.OrderNumber, trip.TripNumber,
					))
				}
			}
		}
	}

	// After commit: create picking orders and update statuses (non-transactional, fire-and-forget)
	if s.pickingOrderCreator != nil {
		for _, trip := range trips {
			for _, stop := range trip.Stops {
				if stop.ShipmentID == nil {
					continue
				}
				if _, err := s.pickingOrderCreator.CreatePickingOrderForShipment(ctx, *stop.ShipmentID); err != nil {
					s.log.Error(ctx, "create_picking_order_failed",
						fmt.Errorf("shipment %s: %w", stop.ShipmentID.String(), err))
				}
			}
		}
	}

	// Notify warehouse: new picking orders created
	if s.notifSvc != nil {
		whLink := "/warehouse/picking"
		_ = s.notifSvc.SendToRole(ctx, "warehouse",
			"Có lệnh đóng hàng mới",
			fmt.Sprintf("Kế hoạch giao hàng đã duyệt — %d chuyến xe, vui lòng soạn hàng", len(trips)),
			"info", &whLink)

		// Notify each assigned driver
		for _, trip := range trips {
			if trip.DriverID != nil {
				userID, err := s.repo.GetDriverUserID(ctx, *trip.DriverID)
				if err == nil {
					drvLink := "/driver"
					_ = s.notifSvc.Send(ctx, userID,
						"Bạn có chuyến xe mới",
						fmt.Sprintf("Chuyến %s — %d điểm giao, ngày %s",
							trip.TripNumber, trip.TotalStops, trip.PlannedDate),
						"info", &drvLink)
				}
			}
		}
	}

	// Remove job from memory
	s.jobs.Delete(req.JobID)

	return trips, nil
}

func (s *Service) ListTrips(ctx context.Context, warehouseID *uuid.UUID, plannedDate, status string, page, limit int) ([]domain.Trip, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * limit
	return s.repo.ListTrips(ctx, warehouseID, plannedDate, status, limit, offset)
}

func (s *Service) GetTrip(ctx context.Context, tripID uuid.UUID) (*domain.Trip, error) {
	return s.repo.GetTrip(ctx, tripID)
}

// ===== DISPATCHER STATUS UPDATES =====

var validTripTransitions = map[string][]string{
	"planned":           {"assigned", "in_transit", "cancelled"},
	"assigned":          {"in_transit", "cancelled"},
	"ready":             {"in_transit", "cancelled"},
	"pre_check":         {"ready", "cancelled"},
	"handover_a_signed": {"in_transit", "cancelled"},
	"in_transit":        {"completed", "cancelled", "vehicle_breakdown"},
	"vehicle_breakdown": {"in_transit", "cancelled"},
	"unloading_returns": {"settling", "cancelled"},
	"settling":          {"completed", "cancelled"},
}

func (s *Service) UpdateTripStatusDispatcher(ctx context.Context, tripID uuid.UUID, newStatus string) error {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return fmt.Errorf("trip not found: %w", err)
	}

	allowed, ok := validTripTransitions[trip.Status]
	if !ok {
		return fmt.Errorf("chuyến xe ở trạng thái '%s', không thể thay đổi", trip.Status)
	}

	valid := false
	for _, s := range allowed {
		if s == newStatus {
			valid = true
			break
		}
	}
	if !valid {
		return fmt.Errorf("không thể chuyển từ '%s' sang '%s'", trip.Status, newStatus)
	}

	switch newStatus {
	case "in_transit":
		return s.repo.StartTrip(ctx, tripID)
	case "completed":
		if err := s.repo.CompleteTrip(ctx, tripID); err != nil {
			return err
		}
		// Fire-and-forget: auto-reconcile trip
		if s.reconSvc != nil {
			go func() {
				if _, err := s.reconSvc.AutoReconcileTrip(context.Background(), tripID); err != nil {
					s.log.Error(context.Background(), "auto_reconcile_failed", err)
				}
			}()
		}
		return nil
	default:
		return s.repo.UpdateTripStatus(ctx, tripID, newStatus)
	}
}

func (s *Service) UpdateStopStatusDispatcher(ctx context.Context, tripID, stopID uuid.UUID, req UpdateStopRequest) error {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return fmt.Errorf("trip not found: %w", err)
	}

	if trip.Status != "in_transit" {
		return fmt.Errorf("chuyến xe chưa bắt đầu")
	}

	stop, err := s.repo.GetTripStopByID(ctx, stopID)
	if err != nil {
		return fmt.Errorf("stop not found: %w", err)
	}
	if stop.TripID != tripID {
		return fmt.Errorf("stop không thuộc chuyến xe này")
	}

	switch req.Action {
	case "arrive":
		if stop.Status != "pending" {
			return fmt.Errorf("điểm giao đang ở trạng thái '%s', không thể đánh dấu đến nơi", stop.Status)
		}
		return s.repo.ArriveAtStop(ctx, stopID)
	case "deliver":
		if stop.Status != "arrived" && stop.Status != "delivering" {
			return fmt.Errorf("phải đến điểm giao trước khi giao hàng")
		}
		return s.repo.DeliverStop(ctx, stopID, req.Notes)
	case "fail":
		if stop.Status != "arrived" && stop.Status != "delivering" && stop.Status != "pending" {
			return fmt.Errorf("không thể đánh dấu thất bại ở trạng thái '%s'", stop.Status)
		}
		return s.repo.FailStop(ctx, stopID, req.Notes)
	case "skip":
		if stop.Status == "delivered" || stop.Status == "failed" {
			return fmt.Errorf("điểm giao đã hoàn thành, không thể bỏ qua")
		}
		return s.repo.UpdateTripStopStatus(ctx, stopID, "skipped")
	default:
		return fmt.Errorf("action không hợp lệ: %s", req.Action)
	}
}

// ===== DRIVER =====

func (s *Service) GetMyTrips(ctx context.Context, userID uuid.UUID) ([]domain.Trip, error) {
	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found for user: %w", err)
	}
	return s.repo.GetTripsByDriverID(ctx, driver.ID)
}

func (s *Service) GetDriverByUserID(ctx context.Context, userID uuid.UUID) (*domain.Driver, error) {
	return s.repo.GetDriverByUserID(ctx, userID)
}

func (s *Service) StartTrip(ctx context.Context, userID, tripID uuid.UUID) error {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return fmt.Errorf("trip not found: %w", err)
	}

	// Verify driver owns this trip
	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	if trip.Status != "planned" && trip.Status != "assigned" && trip.Status != "ready" {
		return fmt.Errorf("chuyến xe ở trạng thái '%s', không thể bắt đầu", trip.Status)
	}

	if err := s.repo.StartTrip(ctx, tripID); err != nil {
		return err
	}

	// Update order statuses to in_transit
	for _, stop := range trip.Stops {
		if stop.ShipmentID == nil {
			continue
		}
		orderID, err := s.repoOms.GetOrderIDByShipmentID(ctx, *stop.ShipmentID)
		if err != nil {
			s.log.Warn(ctx, "start_trip_update_order_failed", logger.F("shipment_id", stop.ShipmentID), logger.F("err", err.Error()))
			continue
		}
		if err := s.repoOms.UpdateOrderStatus(ctx, orderID, "in_transit"); err != nil {
			s.log.Warn(ctx, "start_trip_update_order_failed", logger.F("order_id", orderID), logger.F("err", err.Error()))
		}
		if s.evtRecorder != nil {
			s.evtRecorder.RecordAsync(domain.EntityEvent{
				EntityType: "order",
				EntityID:   orderID,
				EventType:  "order.in_transit",
				ActorType:  "user",
				ActorID:    &userID,
				ActorName:  driver.FullName,
				Title:      fmt.Sprintf("Tài xế %s bắt đầu giao hàng — chuyến %s", driver.FullName, trip.TripNumber),
			})
		}
	}

	// Notify dispatcher: driver has started
	if s.notifSvc != nil {
		link := "/control-tower"
		_ = s.notifSvc.SendToRole(ctx, "dispatcher",
			"Tài xế đã xuất bến",
			fmt.Sprintf("Chuyến %s — xe %s đã bắt đầu giao hàng",
				trip.TripNumber, trip.VehiclePlate),
			"info", &link)
	}

	return nil
}

type UpdateStopRequest struct {
	Action string  `json:"action"` // arrive, delivering, deliver, fail, skip
	Notes  *string `json:"notes,omitempty"`
}

func (s *Service) UpdateStopStatus(ctx context.Context, userID, tripID, stopID uuid.UUID, req UpdateStopRequest) error {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return fmt.Errorf("trip not found: %w", err)
	}

	// Verify driver owns this trip
	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	if trip.Status != "in_transit" {
		return fmt.Errorf("chuyến xe chưa bắt đầu")
	}

	stop, err := s.repo.GetTripStopByID(ctx, stopID)
	if err != nil {
		return fmt.Errorf("stop not found: %w", err)
	}
	if stop.TripID != tripID {
		return fmt.Errorf("stop không thuộc chuyến xe này")
	}

	switch req.Action {
	case "arrive":
		if stop.Status != "pending" {
			return fmt.Errorf("điểm giao đang ở trạng thái '%s', không thể đánh dấu đến nơi", stop.Status)
		}
		return s.repo.ArriveAtStop(ctx, stopID)

	case "delivering":
		if stop.Status != "arrived" {
			return fmt.Errorf("phải đến điểm giao trước khi bắt đầu hạ hàng")
		}
		return s.repo.UpdateTripStopStatus(ctx, stopID, "delivering")

	case "deliver":
		if stop.Status != "arrived" && stop.Status != "delivering" {
			return fmt.Errorf("phải đến điểm giao trước khi giao hàng")
		}
		return s.repo.DeliverStop(ctx, stopID, req.Notes)

	case "fail":
		if stop.Status != "arrived" && stop.Status != "delivering" && stop.Status != "pending" {
			return fmt.Errorf("không thể đánh dấu thất bại ở trạng thái '%s'", stop.Status)
		}
		if err := s.repo.FailStop(ctx, stopID, req.Notes); err != nil {
			return err
		}
		// Notify dispatcher about delivery failure
		if s.notifSvc != nil {
			link := "/control-tower"
			_ = s.notifSvc.SendToRole(ctx, "dispatcher",
				"Giao hàng thất bại",
				fmt.Sprintf("Điểm giao %s (chuyến %s) — thất bại",
					stop.CustomerName, trip.TripNumber),
				"warning", &link)
		}
		return nil

	case "skip":
		if stop.Status == "delivered" || stop.Status == "failed" {
			return fmt.Errorf("điểm giao đã hoàn thành, không thể bỏ qua")
		}
		return s.repo.UpdateTripStopStatus(ctx, stopID, "skipped")

	default:
		return fmt.Errorf("action không hợp lệ: %s", req.Action)
	}
}

func (s *Service) CompleteTrip(ctx context.Context, userID, tripID uuid.UUID) error {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return fmt.Errorf("trip not found: %w", err)
	}

	// Verify driver owns this trip
	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	if trip.Status != "in_transit" {
		return fmt.Errorf("chuyến xe chưa bắt đầu hoặc đã hoàn thành")
	}

	// Check all stops are terminal (delivered, partially_delivered, failed, skipped)
	terminalStatuses := map[string]bool{"delivered": true, "partially_delivered": true, "failed": true, "skipped": true}
	for _, stop := range trip.Stops {
		if !terminalStatuses[stop.Status] {
			return fmt.Errorf("còn điểm giao '%s' (#%d) chưa hoàn thành (trạng thái: %s)", stop.CustomerName, stop.StopOrder, stop.Status)
		}
	}

	if err := s.repo.CompleteTrip(ctx, tripID); err != nil {
		return err
	}

	// --- Update order status for each stop ---
	for _, stop := range trip.Stops {
		if stop.ShipmentID == nil {
			continue
		}
		orderID, err := s.repoOms.GetOrderIDByShipmentID(ctx, *stop.ShipmentID)
		if err != nil {
			s.log.Warn(ctx, "update_order_status_failed", logger.F("shipment_id", stop.ShipmentID), logger.F("err", err.Error()))
			continue
		}
		var newOrderStatus string
		switch stop.Status {
		case "delivered":
			newOrderStatus = "delivered"
		case "partially_delivered":
			newOrderStatus = "partially_delivered"
		case "failed", "skipped":
			newOrderStatus = "cancelled"
		default:
			continue
		}
		if err := s.repoOms.UpdateOrderStatus(ctx, orderID, newOrderStatus); err != nil {
			s.log.Warn(ctx, "update_order_status_failed", logger.F("order_id", orderID), logger.F("err", err.Error()))
		}

		// Record event: order status changed by trip completion
		if s.evtRecorder != nil {
			s.evtRecorder.RecordAsync(domain.EntityEvent{
				EntityType: "order",
				EntityID:   orderID,
				EventType:  "order.status_changed",
				ActorType:  "system",
				ActorName:  "Hệ thống (hoàn thành chuyến)",
				Title:      fmt.Sprintf("Chuyến %s hoàn thành — đơn chuyển sang %s", trip.TripNumber, newOrderStatus),
				Detail:     nil,
			})
		}
	}

	// Fire-and-forget: auto-reconcile trip
	if s.reconSvc != nil {
		go func() {
			if _, err := s.reconSvc.AutoReconcileTrip(context.Background(), tripID); err != nil {
				s.log.Error(context.Background(), "auto_reconcile_failed", err)
			}
		}()
	}

	// Notify accountant and dispatcher about trip completion
	if s.notifSvc != nil {
		reconLink := "/reconciliation"
		_ = s.notifSvc.SendToRole(ctx, "accountant",
			"Chuyến xe hoàn thành",
			fmt.Sprintf("Chuyến %s đã hoàn thành — cần đối soát", trip.TripNumber),
			"info", &reconLink)

		ctLink := "/control-tower"
		_ = s.notifSvc.SendToRole(ctx, "dispatcher",
			"Chuyến xe hoàn thành",
			fmt.Sprintf("Chuyến %s — xe %s đã hoàn thành tất cả điểm giao",
				trip.TripNumber, trip.VehiclePlate),
			"success", &ctLink)
	}

	return nil
}

// ===== CHECKLIST =====

type SubmitChecklistRequest struct {
	TiresOk            bool    `json:"tires_ok"`
	BrakesOk           bool    `json:"brakes_ok"`
	LightsOk           bool    `json:"lights_ok"`
	MirrorsOk          bool    `json:"mirrors_ok"`
	HornOk             bool    `json:"horn_ok"`
	CoolantOk          bool    `json:"coolant_ok"`
	OilOk              bool    `json:"oil_ok"`
	FuelLevel          int     `json:"fuel_level"`
	FireExtinguisherOk bool    `json:"fire_extinguisher_ok"`
	FirstAidOk         bool    `json:"first_aid_ok"`
	DocumentsOk        bool    `json:"documents_ok"`
	CargoSecured       bool    `json:"cargo_secured"`
	Notes              *string `json:"notes,omitempty"`
}

func (s *Service) SubmitChecklist(ctx context.Context, userID, tripID uuid.UUID, req SubmitChecklistRequest) (*domain.TripChecklist, error) {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}

	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return nil, fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	// Check if checklist already exists
	existing, _ := s.repo.GetChecklistByTripID(ctx, tripID)
	if existing != nil {
		return nil, fmt.Errorf("checklist đã được kiểm tra trước đó")
	}

	// Calculate pass/fail: all boolean items must be true and fuel >= 20%
	isPassed := req.TiresOk && req.BrakesOk && req.LightsOk && req.MirrorsOk &&
		req.HornOk && req.CoolantOk && req.OilOk && req.FireExtinguisherOk &&
		req.FirstAidOk && req.DocumentsOk && req.CargoSecured && req.FuelLevel >= 20

	vehicleID := uuid.Nil
	if trip.VehicleID != nil {
		vehicleID = *trip.VehicleID
	}

	cl := &domain.TripChecklist{
		TripID:             tripID,
		DriverID:           driver.ID,
		VehicleID:          vehicleID,
		TiresOk:            req.TiresOk,
		BrakesOk:           req.BrakesOk,
		LightsOk:           req.LightsOk,
		MirrorsOk:          req.MirrorsOk,
		HornOk:             req.HornOk,
		CoolantOk:          req.CoolantOk,
		OilOk:              req.OilOk,
		FuelLevel:          req.FuelLevel,
		FireExtinguisherOk: req.FireExtinguisherOk,
		FirstAidOk:         req.FirstAidOk,
		DocumentsOk:        req.DocumentsOk,
		CargoSecured:       req.CargoSecured,
		IsPassed:           isPassed,
		Notes:              req.Notes,
	}

	if err := s.repo.CreateChecklist(ctx, cl); err != nil {
		return nil, fmt.Errorf("create checklist: %w", err)
	}

	// Update trip status to pre_check → ready if passed
	if isPassed {
		_ = s.repo.UpdateTripStatus(ctx, tripID, "ready")
	} else {
		_ = s.repo.UpdateTripStatus(ctx, tripID, "pre_check")
	}

	return cl, nil
}

func (s *Service) GetChecklist(ctx context.Context, tripID uuid.UUID) (*domain.TripChecklist, error) {
	return s.repo.GetChecklistByTripID(ctx, tripID)
}

// ===== ePOD (Electronic Proof of Delivery) =====

type SubmitEPODRequest struct {
	DeliveryStatus string            `json:"delivery_status"` // delivered, partial, rejected
	DeliveredItems []domain.EPODItem `json:"delivered_items"`
	ReceiverName   *string           `json:"receiver_name"`
	ReceiverPhone  *string           `json:"receiver_phone"`
	SignatureURL   *string           `json:"signature_url"`
	PhotoURLs      []string          `json:"photo_urls"`
	Notes          *string           `json:"notes"`
	RejectReason   *string           `json:"reject_reason,omitempty"`
	RejectDetail   *string           `json:"reject_detail,omitempty"`
	RejectPhotos   []string          `json:"reject_photos,omitempty"`
}

func (s *Service) SubmitEPOD(ctx context.Context, userID, tripID, stopID uuid.UUID, req SubmitEPODRequest) (*domain.EPOD, error) {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}

	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return nil, fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	if trip.Status != "in_transit" {
		return nil, fmt.Errorf("chuyến xe chưa bắt đầu")
	}

	stop, err := s.repo.GetTripStopByID(ctx, stopID)
	if err != nil {
		return nil, fmt.Errorf("stop not found: %w", err)
	}
	if stop.TripID != tripID {
		return nil, fmt.Errorf("stop không thuộc chuyến xe này")
	}

	if stop.Status != "arrived" && stop.Status != "delivering" {
		return nil, fmt.Errorf("phải đến điểm giao trước khi làm ePOD")
	}

	// Check if ePOD already exists
	existing, _ := s.repo.GetEPODByStopID(ctx, stopID)
	if existing != nil {
		return nil, fmt.Errorf("ePOD đã tồn tại cho điểm giao này")
	}

	// Validate delivery status
	if req.DeliveryStatus == "" {
		req.DeliveryStatus = "delivered"
	}
	validStatuses := map[string]bool{"delivered": true, "partial": true, "rejected": true}
	if !validStatuses[req.DeliveryStatus] {
		return nil, fmt.Errorf("delivery_status không hợp lệ: %s", req.DeliveryStatus)
	}

	// BRD US-TMS-13 AC#5: Require at least 1 photo for ePOD
	if len(req.PhotoURLs) == 0 {
		return nil, fmt.Errorf("cần ít nhất 1 ảnh chứng từ giao hàng")
	}

	// Calculate total from delivered items
	var totalAmount, depositAmount float64
	for _, item := range req.DeliveredItems {
		// amounts will be calculated on client, we just store them
		_ = item
	}

	// Get order amounts from stop
	if stop.ShipmentID != nil {
		totalAmount, depositAmount, _ = s.repo.GetOrderAmountsByShipment(ctx, *stop.ShipmentID)
	}

	// If partial or rejected, adjust amounts based on delivered qty ratio
	if req.DeliveryStatus == "partial" {
		var orderedTotal, deliveredTotal int
		for _, item := range req.DeliveredItems {
			orderedTotal += item.OrderedQty
			deliveredTotal += item.DeliveredQty
		}
		if orderedTotal > 0 {
			ratio := float64(deliveredTotal) / float64(orderedTotal)
			totalAmount = totalAmount * ratio
			depositAmount = depositAmount * ratio
		}
	} else if req.DeliveryStatus == "rejected" {
		totalAmount = 0
		depositAmount = 0
	}

	itemsJSON, err := json.Marshal(req.DeliveredItems)
	if err != nil {
		return nil, fmt.Errorf("marshal delivered items: %w", err)
	}

	photoURLs := req.PhotoURLs
	if photoURLs == nil {
		photoURLs = []string{}
	}

	epod := &domain.EPOD{
		TripStopID:     stopID,
		DriverID:       driver.ID,
		CustomerID:     stop.CustomerID,
		DeliveredItems: itemsJSON,
		ReceiverName:   req.ReceiverName,
		ReceiverPhone:  req.ReceiverPhone,
		SignatureURL:   req.SignatureURL,
		PhotoURLs:      photoURLs,
		TotalAmount:    totalAmount,
		DepositAmount:  depositAmount,
		DeliveryStatus: req.DeliveryStatus,
		RejectReason:   req.RejectReason,
		RejectDetail:   req.RejectDetail,
		RejectPhotos:   req.RejectPhotos,
		Notes:          req.Notes,
	}

	// Validate rejection has reason + at least 1 photo
	if req.DeliveryStatus == "rejected" {
		if req.RejectReason == nil || *req.RejectReason == "" {
			return nil, fmt.Errorf("phải chọn lý do từ chối")
		}
		if len(req.RejectPhotos) == 0 {
			return nil, fmt.Errorf("phải chụp ít nhất 1 ảnh bằng chứng từ chối")
		}
	}

	if err := s.repo.CreateEPOD(ctx, epod); err != nil {
		return nil, fmt.Errorf("create epod: %w", err)
	}

	// Update stop status based on delivery
	switch req.DeliveryStatus {
	case "delivered":
		_ = s.repo.DeliverStop(ctx, stopID, req.Notes)
	case "partial":
		_ = s.repo.UpdateTripStopStatus(ctx, stopID, "partially_delivered")
	case "rejected":
		_ = s.repo.FailStop(ctx, stopID, req.Notes)
		// Notify dispatcher + accountant about rejection
		if s.notifSvc != nil {
			reasonLabel := ""
			if req.RejectReason != nil {
				reasonLabel = *req.RejectReason
			}
			ctLink := "/control-tower"
			_ = s.notifSvc.SendToRole(ctx, "dispatcher",
				"NPP từ chối nhận hàng",
				fmt.Sprintf("%s từ chối — Lý do: %s", stop.CustomerName, reasonLabel),
				"warning", &ctLink)
			reconLink := "/reconciliation"
			_ = s.notifSvc.SendToRole(ctx, "accountant",
				"NPP từ chối nhận hàng",
				fmt.Sprintf("%s từ chối — Cần đối soát", stop.CustomerName),
				"warning", &reconLink)
		}
	}

	// Fire integration hooks on successful delivery (Tasks 3.1, 3.5, 3.6)
	if s.hooks != nil && stop.ShipmentID != nil && (req.DeliveryStatus == "delivered" || req.DeliveryStatus == "partial") {
		go func() {
			evt, err := s.hooks.BuildDeliveryEvent(context.Background(), stopID, *stop.ShipmentID, trip.DriverName, trip.VehiclePlate, "")
			if err != nil {
				s.log.Error(context.Background(), "build_delivery_event_failed", err, logger.F("stop_id", stopID.String()))
				return
			}
			s.hooks.OnDeliveryCompleted(context.Background(), *evt)
		}()
	}

	return epod, nil
}

func (s *Service) GetEPOD(ctx context.Context, stopID uuid.UUID) (*domain.EPOD, error) {
	return s.repo.GetEPODByStopID(ctx, stopID)
}

// ===== VEHICLE DOCUMENTS =====

func (s *Service) ListVehicleDocuments(ctx context.Context, vehicleID uuid.UUID) ([]domain.VehicleDocument, error) {
	return s.repo.ListVehicleDocuments(ctx, vehicleID)
}

func (s *Service) CreateVehicleDocument(ctx context.Context, doc *domain.VehicleDocument) error {
	if doc.DocType == "" || doc.ExpiryDate == "" {
		return fmt.Errorf("doc_type và expiry_date là bắt buộc")
	}
	validTypes := map[string]bool{"registration": true, "inspection": true, "insurance": true}
	if !validTypes[doc.DocType] {
		return fmt.Errorf("doc_type phải là: registration, inspection, insurance")
	}
	return s.repo.CreateVehicleDocument(ctx, doc)
}

func (s *Service) UpdateVehicleDocument(ctx context.Context, doc *domain.VehicleDocument) error {
	return s.repo.UpdateVehicleDocument(ctx, doc)
}

func (s *Service) DeleteVehicleDocument(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteVehicleDocument(ctx, id)
}

func (s *Service) ListExpiringVehicleDocs(ctx context.Context, days int) ([]domain.VehicleDocument, error) {
	return s.repo.ListExpiringVehicleDocs(ctx, days)
}

// ===== DRIVER DOCUMENTS =====

func (s *Service) ListDriverDocuments(ctx context.Context, driverID uuid.UUID) ([]domain.DriverDocument, error) {
	return s.repo.ListDriverDocuments(ctx, driverID)
}

func (s *Service) CreateDriverDocument(ctx context.Context, doc *domain.DriverDocument) error {
	if doc.DocType == "" || doc.ExpiryDate == "" {
		return fmt.Errorf("doc_type và expiry_date là bắt buộc")
	}
	validTypes := map[string]bool{"license": true, "health_check": true}
	if !validTypes[doc.DocType] {
		return fmt.Errorf("doc_type phải là: license, health_check")
	}
	return s.repo.CreateDriverDocument(ctx, doc)
}

func (s *Service) UpdateDriverDocument(ctx context.Context, doc *domain.DriverDocument) error {
	return s.repo.UpdateDriverDocument(ctx, doc)
}

func (s *Service) DeleteDriverDocument(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteDriverDocument(ctx, id)
}

func (s *Service) ListExpiringDriverDocs(ctx context.Context, days int) ([]domain.DriverDocument, error) {
	return s.repo.ListExpiringDriverDocs(ctx, days)
}

// ===== PAYMENT =====

type RecordPaymentRequest struct {
	PaymentMethod   string  `json:"payment_method"` // cash, transfer, credit, cod
	Amount          float64 `json:"amount"`
	ReferenceNumber *string `json:"reference_number,omitempty"`
	Notes           *string `json:"notes,omitempty"`
}

func (s *Service) RecordPayment(ctx context.Context, userID, tripID, stopID uuid.UUID, req RecordPaymentRequest) (*domain.Payment, error) {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}

	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return nil, fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	stop, err := s.repo.GetTripStopByID(ctx, stopID)
	if err != nil {
		return nil, fmt.Errorf("stop not found: %w", err)
	}
	if stop.TripID != tripID {
		return nil, fmt.Errorf("stop không thuộc chuyến xe này")
	}

	// Validate payment method
	validMethods := map[string]bool{"cash": true, "transfer": true, "credit": true, "cod": true, "partial": true}
	if !validMethods[req.PaymentMethod] {
		return nil, fmt.Errorf("phương thức thanh toán không hợp lệ: %s", req.PaymentMethod)
	}

	if req.Amount <= 0 {
		return nil, fmt.Errorf("số tiền phải lớn hơn 0")
	}

	// Get order_id from shipment
	var orderID *uuid.UUID
	if stop.ShipmentID != nil {
		oid, err := s.repo.GetOrderIDByShipment(ctx, *stop.ShipmentID)
		if err == nil {
			orderID = &oid
		}
	}

	// Get ePOD ID if exists
	var epodID *uuid.UUID
	epod, _ := s.repo.GetEPODByStopID(ctx, stopID)
	if epod != nil {
		epodID = &epod.ID
	}

	payment := &domain.Payment{
		TripStopID:      stopID,
		EPODID:          epodID,
		CustomerID:      stop.CustomerID,
		DriverID:        driver.ID,
		OrderID:         orderID,
		PaymentMethod:   req.PaymentMethod,
		Amount:          req.Amount,
		Status:          "collected",
		ReferenceNumber: req.ReferenceNumber,
		Notes:           req.Notes,
	}

	if err := s.repo.CreatePayment(ctx, payment); err != nil {
		return nil, fmt.Errorf("create payment: %w", err)
	}

	// If payment method is credit, record in receivable_ledger
	if req.PaymentMethod == "credit" && orderID != nil {
		_ = s.repo.CreateCreditLedgerEntry(ctx, stop.CustomerID, *orderID, req.Amount, driver.ID)
	}

	return payment, nil
}

// ===== RETURN COLLECTION =====

type ReturnItem struct {
	AssetType string `json:"asset_type"` // bottle, crate, keg, pallet
	Quantity  int    `json:"quantity"`
	Condition string `json:"condition"` // good, damaged, lost
	PhotoURL  string `json:"photo_url,omitempty"`
}

type RecordReturnsRequest struct {
	Items []ReturnItem `json:"items"`
	Notes *string      `json:"notes,omitempty"`
}

func (s *Service) RecordReturns(ctx context.Context, userID, tripID, stopID uuid.UUID, req RecordReturnsRequest) ([]domain.ReturnCollection, error) {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}

	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return nil, fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	stop, err := s.repo.GetTripStopByID(ctx, stopID)
	if err != nil {
		return nil, fmt.Errorf("stop not found: %w", err)
	}
	if stop.TripID != tripID {
		return nil, fmt.Errorf("stop không thuộc chuyến xe này")
	}

	if len(req.Items) == 0 {
		return nil, fmt.Errorf("phải có ít nhất 1 loại vỏ thu hồi")
	}

	var results []domain.ReturnCollection
	for _, item := range req.Items {
		// Validate asset type
		validTypes := map[string]bool{"bottle": true, "crate": true, "keg": true, "pallet": true}
		if !validTypes[item.AssetType] {
			return nil, fmt.Errorf("loại vỏ không hợp lệ: %s", item.AssetType)
		}
		validConditions := map[string]bool{"good": true, "damaged": true, "lost": true}
		if !validConditions[item.Condition] {
			return nil, fmt.Errorf("tình trạng không hợp lệ: %s", item.Condition)
		}
		if item.Quantity <= 0 {
			return nil, fmt.Errorf("số lượng phải lớn hơn 0")
		}

		var photoURL *string
		if item.PhotoURL != "" {
			photoURL = &item.PhotoURL
		}

		rc := &domain.ReturnCollection{
			TripStopID: stopID,
			CustomerID: stop.CustomerID,
			AssetType:  item.AssetType,
			Quantity:   item.Quantity,
			Condition:  item.Condition,
			PhotoURL:   photoURL,
			CreatedBy:  &userID,
		}

		if err := s.repo.CreateReturnCollection(ctx, rc); err != nil {
			return nil, fmt.Errorf("create return collection: %w", err)
		}

		// Record in asset_ledger (direction = 'in' for returns)
		_ = s.repo.CreateAssetLedgerEntry(ctx, stop.CustomerID, item.AssetType, "in", item.Quantity, item.Condition, "return_collection", rc.ID, driver.ID)

		results = append(results, *rc)
	}

	return results, nil
}

func (s *Service) GetReturns(ctx context.Context, stopID uuid.UUID) ([]domain.ReturnCollection, error) {
	return s.repo.GetReturnsByStopID(ctx, stopID)
}

func (s *Service) GetPaymentsByStopID(ctx context.Context, stopID uuid.UUID) ([]domain.Payment, error) {
	return s.repo.GetPaymentsByStopID(ctx, stopID)
}

// ===== DRIVER CHECK-IN =====
func (s *Service) DriverCheckin(ctx context.Context, userID uuid.UUID, status string, reason, note *string) (*domain.DriverCheckin, error) {
	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found for user: %w", err)
	}
	today := time.Now().Format("2006-01-02")
	return s.repo.UpsertDriverCheckin(ctx, driver.ID, today, status, reason, note)
}

func (s *Service) GetMyCheckin(ctx context.Context, userID uuid.UUID) (*domain.DriverCheckin, error) {
	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found for user: %w", err)
	}
	today := time.Now().Format("2006-01-02")
	return s.repo.GetDriverCheckin(ctx, driver.ID, today)
}

func (s *Service) ListDriverCheckinsForDate(ctx context.Context, warehouseID uuid.UUID, date string) ([]map[string]interface{}, error) {
	return s.repo.ListDriverCheckinsForDate(ctx, warehouseID, date)
}

// RunDocumentExpiryCron checks vehicle/driver document expiry daily at 07:00
func (s *Service) RunDocumentExpiryCron(ctx context.Context) {
	s.log.Info(ctx, "cron_started", logger.F("cron", "document_expiry"))

	for {
		// Calculate next 07:00 Asia/Ho_Chi_Minh
		loc, _ := time.LoadLocation("Asia/Ho_Chi_Minh")
		now := time.Now().In(loc)
		next := time.Date(now.Year(), now.Month(), now.Day(), 7, 0, 0, 0, loc)
		if now.After(next) {
			next = next.Add(24 * time.Hour)
		}
		waitDuration := next.Sub(now)
		s.log.Info(ctx, "cron_next_run", logger.F("cron", "document_expiry"), logger.F("next_run", next.Format("2006-01-02 15:04")))

		select {
		case <-ctx.Done():
			s.log.Info(ctx, "cron_stopped", logger.F("cron", "document_expiry"))
			return
		case <-time.After(waitDuration):
			s.checkDocumentExpiry(ctx)
		}
	}
}

func (s *Service) checkDocumentExpiry(ctx context.Context) {
	if s.notifSvc == nil {
		return
	}

	// Check vehicle documents expiring within 30 days
	vDocs, err := s.repo.ListExpiringVehicleDocs(ctx, 30)
	if err != nil {
		s.log.Error(ctx, "cron_vehicle_docs_failed", err, logger.F("cron", "document_expiry"))
	} else {
		for _, d := range vDocs {
			var title, body string
			link := fmt.Sprintf("/vehicles/%s/documents", d.VehicleID.String())
			if d.DaysToExpiry <= 0 {
				title = fmt.Sprintf("Giấy tờ xe %s đã hết hạn", d.PlateNumber)
				body = fmt.Sprintf("%s của xe %s đã hết hạn. Vui lòng gia hạn ngay.", d.DocType, d.PlateNumber)
			} else if d.DaysToExpiry <= 7 {
				title = fmt.Sprintf("Giấy tờ xe %s sắp hết hạn", d.PlateNumber)
				body = fmt.Sprintf("%s của xe %s sẽ hết hạn sau %d ngày.", d.DocType, d.PlateNumber, d.DaysToExpiry)
			} else {
				continue // Only alert for <=7 days, show in list for <=30 days
			}
			_ = s.notifSvc.SendToRole(ctx, "dispatcher", title, body, "document_expiry", &link)
		}
		s.log.Info(ctx, "cron_vehicle_docs_checked", logger.F("cron", "document_expiry"), logger.F("expiring_count", len(vDocs)))
	}

	// Check driver documents expiring within 30 days
	dDocs, err := s.repo.ListExpiringDriverDocs(ctx, 30)
	if err != nil {
		s.log.Error(ctx, "cron_driver_docs_failed", err, logger.F("cron", "document_expiry"))
	} else {
		for _, d := range dDocs {
			var title, body string
			link := fmt.Sprintf("/drivers/%s/documents", d.DriverID.String())
			if d.DaysToExpiry <= 0 {
				title = fmt.Sprintf("Giấy tờ tài xế %s đã hết hạn", d.DriverName)
				body = fmt.Sprintf("%s của tài xế %s đã hết hạn. Vui lòng gia hạn ngay.", d.DocType, d.DriverName)
			} else if d.DaysToExpiry <= 7 {
				title = fmt.Sprintf("Giấy tờ tài xế %s sắp hết hạn", d.DriverName)
				body = fmt.Sprintf("%s của tài xế %s sẽ hết hạn sau %d ngày.", d.DocType, d.DriverName, d.DaysToExpiry)
			} else {
				continue
			}
			_ = s.notifSvc.SendToRole(ctx, "dispatcher", title, body, "document_expiry", &link)
		}
		s.log.Info(ctx, "cron_driver_docs_checked", logger.F("cron", "document_expiry"), logger.F("expiring_count", len(dDocs)))
	}
}

// ─── Dispatcher Control Tower ────────────────────────

func (s *Service) GetControlTowerStats(ctx context.Context) (*domain.ControlTowerStats, error) {
	return s.repo.GetControlTowerStats(ctx)
}

func (s *Service) ListExceptions(ctx context.Context) ([]domain.TripException, error) {
	return s.repo.ListExceptions(ctx)
}

func (s *Service) MoveStop(ctx context.Context, fromTripID, stopID, toTripID uuid.UUID) error {
	return s.repo.MoveStop(ctx, fromTripID, stopID, toTripID)
}

func (s *Service) CancelTrip(ctx context.Context, tripID uuid.UUID, reason string) error {
	return s.repo.CancelTrip(ctx, tripID, reason)
}

// ===== END-OF-DAY (KẾT CA) 3-STATION FLOW =====

type StartEODRequest struct {
	// No additional input needed — computed from trip data
}

// StartEOD creates an EOD session and 3 pending checkpoints for the trip.
func (s *Service) StartEOD(ctx context.Context, userID, tripID uuid.UUID) (*domain.EODSession, error) {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}

	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return nil, fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	// Trip must be in_transit or returning (all stops terminal)
	if trip.Status != "in_transit" && trip.Status != "returning" {
		return nil, fmt.Errorf("chuyến xe phải đang giao hàng để kết ca")
	}

	// Check all stops are terminal
	terminalStatuses := map[string]bool{"delivered": true, "partially_delivered": true, "failed": true, "skipped": true}
	for _, stop := range trip.Stops {
		if !terminalStatuses[stop.Status] {
			return nil, fmt.Errorf("còn điểm giao '%s' (#%d) chưa hoàn thành", stop.CustomerName, stop.StopOrder)
		}
	}

	// Check if EOD session already exists
	existing, _ := s.repo.GetEODSessionByTripID(ctx, tripID)
	if existing != nil {
		// Return existing session with checkpoints
		cps, _ := s.repo.GetEODCheckpoints(ctx, existing.ID)
		existing.Checkpoints = cps
		return existing, nil
	}

	// Compute summary data from trip stops
	var delivered, failed int
	var cashTotal, transferTotal, creditTotal float64
	for _, stop := range trip.Stops {
		if stop.Status == "delivered" || stop.Status == "partially_delivered" {
			delivered++
		} else {
			failed++
		}
	}

	// Get payments summary for this trip
	payments, _ := s.repo.GetPaymentsByTripID(ctx, tripID)
	for _, p := range payments {
		switch p.PaymentMethod {
		case "cash", "cod":
			cashTotal += p.Amount
		case "transfer":
			transferTotal += p.Amount
		case "credit":
			creditTotal += p.Amount
		}
	}

	session := &domain.EODSession{
		TripID:                 tripID,
		DriverID:               driver.ID,
		TotalStopsDelivered:    delivered,
		TotalStopsFailed:       failed,
		TotalCashCollected:     cashTotal,
		TotalTransferCollected: transferTotal,
		TotalCreditAmount:      creditTotal,
	}

	if err := s.repo.CreateEODSession(ctx, session); err != nil {
		return nil, fmt.Errorf("create EOD session: %w", err)
	}

	// Create 3 checkpoints
	cpTypes := []struct {
		Type  string
		Order int
	}{
		{"container_return", 1},
		{"cash_handover", 2},
		{"vehicle_return", 3},
	}
	for _, ct := range cpTypes {
		cp := &domain.EODCheckpoint{
			SessionID:       session.ID,
			TripID:          tripID,
			CheckpointType:  ct.Type,
			CheckpointOrder: ct.Order,
		}
		if err := s.repo.CreateEODCheckpoint(ctx, cp); err != nil {
			return nil, fmt.Errorf("create checkpoint %s: %w", ct.Type, err)
		}
		session.Checkpoints = append(session.Checkpoints, *cp)
	}

	// Update trip status to "returning"
	if trip.Status == "in_transit" {
		_ = s.repo.UpdateTripStatusRaw(ctx, tripID, "returning")
	}

	// Record event
	if s.evtRecorder != nil {
		s.evtRecorder.RecordAsync(domain.EntityEvent{
			EntityType: "trip",
			EntityID:   tripID,
			EventType:  "trip.eod_started",
			ActorType:  "driver",
			ActorID:    &userID,
			ActorName:  driver.FullName,
			Title:      fmt.Sprintf("Tài xế %s bắt đầu kết ca chuyến %s", driver.FullName, trip.TripNumber),
		})
	}

	session.TripNumber = trip.TripNumber
	session.VehiclePlate = trip.VehiclePlate
	session.DriverName = driver.FullName
	return session, nil
}

// GetEODSession returns the EOD session with all checkpoints for a trip.
func (s *Service) GetEODSession(ctx context.Context, userID, tripID uuid.UUID) (*domain.EODSession, error) {
	session, err := s.repo.GetEODSessionByTripID(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("chưa bắt đầu kết ca cho chuyến này")
	}

	cps, err := s.repo.GetEODCheckpoints(ctx, session.ID)
	if err != nil {
		return nil, err
	}
	session.Checkpoints = cps

	return session, nil
}

type SubmitCheckpointRequest struct {
	DriverData json.RawMessage `json:"driver_data"`
}

// SubmitCheckpoint — driver submits data to a checkpoint station.
func (s *Service) SubmitCheckpoint(ctx context.Context, userID, tripID uuid.UUID, cpType string, req SubmitCheckpointRequest) (*domain.EODCheckpoint, error) {
	trip, err := s.repo.GetTrip(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("trip not found: %w", err)
	}

	driver, err := s.repo.GetDriverByUserID(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("driver not found: %w", err)
	}
	if trip.DriverID == nil || *trip.DriverID != driver.ID {
		return nil, fmt.Errorf("không có quyền thao tác chuyến xe này")
	}

	// Validate checkpoint type
	validTypes := map[string]bool{"container_return": true, "cash_handover": true, "vehicle_return": true}
	if !validTypes[cpType] {
		return nil, fmt.Errorf("loại trạm không hợp lệ: %s", cpType)
	}

	// Get the checkpoint
	cp, err := s.repo.GetEODCheckpointByTripAndType(ctx, tripID, cpType)
	if err != nil {
		return nil, fmt.Errorf("checkpoint not found: %w", err)
	}

	if cp.Status != "pending" && cp.Status != "rejected" {
		return nil, fmt.Errorf("trạm này đã được gửi hoặc xác nhận rồi")
	}

	// Sequential check: previous checkpoint must be confirmed
	if cp.CheckpointOrder > 1 {
		session, _ := s.repo.GetEODSessionByTripID(ctx, tripID)
		if session != nil {
			cps, _ := s.repo.GetEODCheckpoints(ctx, session.ID)
			for _, prev := range cps {
				if prev.CheckpointOrder == cp.CheckpointOrder-1 && prev.Status != "confirmed" {
					return nil, fmt.Errorf("trạm %d chưa hoàn thành, không thể gửi trạm %d", prev.CheckpointOrder, cp.CheckpointOrder)
				}
			}
		}
	}

	if err := s.repo.SubmitEODCheckpoint(ctx, cp.ID, req.DriverData); err != nil {
		return nil, fmt.Errorf("submit checkpoint: %w", err)
	}

	// Send notification to receiver role
	if s.notifSvc != nil {
		var role, title, body string
		switch cpType {
		case "container_return":
			role = "warehouse_handler"
			title = "Nhận vỏ & hàng trả"
			body = fmt.Sprintf("TX %s (chuyến %s) đang chờ giao vỏ", driver.FullName, trip.TripNumber)
		case "cash_handover":
			role = "accountant"
			title = "Nhận tiền từ tài xế"
			body = fmt.Sprintf("TX %s (chuyến %s) đang chờ nộp tiền", driver.FullName, trip.TripNumber)
		case "vehicle_return":
			role = "dispatcher"
			title = "Nhận xe từ tài xế"
			body = fmt.Sprintf("TX %s (chuyến %s) đang chờ giao xe", driver.FullName, trip.TripNumber)
		}
		link := fmt.Sprintf("/eod/checkpoint/%s", cp.ID.String())
		go func() {
			_ = s.notifSvc.SendToRole(context.Background(), role, title, body, "eod_checkpoint", &link)
		}()
	}

	updated, _ := s.repo.GetEODCheckpoint(ctx, cp.ID)
	return updated, nil
}

type ConfirmCheckpointRequest struct {
	ReceiverData      json.RawMessage `json:"receiver_data"`
	SignatureURL      *string         `json:"signature_url,omitempty"`
	DiscrepancyReason *string         `json:"discrepancy_reason,omitempty"`
}

// ConfirmCheckpoint — receiver (thủ kho/kế toán/đội trưởng) confirms a checkpoint.
func (s *Service) ConfirmCheckpoint(ctx context.Context, receiverID, checkpointID uuid.UUID, receiverName string, req ConfirmCheckpointRequest) (*domain.EODCheckpoint, error) {
	cp, err := s.repo.GetEODCheckpoint(ctx, checkpointID)
	if err != nil {
		return nil, fmt.Errorf("checkpoint not found: %w", err)
	}

	if cp.Status != "submitted" {
		return nil, fmt.Errorf("trạm này chưa được tài xế gửi hoặc đã xử lý rồi")
	}

	if err := s.repo.ConfirmEODCheckpoint(ctx, checkpointID, receiverID, receiverName, req.ReceiverData, req.SignatureURL, req.DiscrepancyReason); err != nil {
		return nil, fmt.Errorf("confirm checkpoint: %w", err)
	}

	// Check if all 3 checkpoints are confirmed → complete EOD session & trip
	session, _ := s.repo.GetEODSessionByTripID(ctx, cp.TripID)
	if session != nil {
		cps, _ := s.repo.GetEODCheckpoints(ctx, session.ID)
		allConfirmed := true
		for _, c := range cps {
			if c.ID == checkpointID {
				continue // this one is now confirmed
			}
			if c.Status != "confirmed" {
				allConfirmed = false
				break
			}
		}
		if allConfirmed {
			_ = s.repo.CompleteEODSession(ctx, session.ID)
			_ = s.repo.UpdateTripStatusRaw(ctx, cp.TripID, "completed")

			// Trigger auto-reconcile
			if s.reconSvc != nil {
				go func() {
					if _, err := s.reconSvc.AutoReconcileTrip(context.Background(), cp.TripID); err != nil {
						s.log.Error(context.Background(), "auto_reconcile_after_eod_failed", err)
					}
				}()
			}

			if s.evtRecorder != nil {
				s.evtRecorder.RecordAsync(domain.EntityEvent{
					EntityType: "trip",
					EntityID:   cp.TripID,
					EventType:  "trip.eod_completed",
					ActorType:  "system",
					ActorName:  "Hệ thống",
					Title:      "Kết ca hoàn thành — cả 3 trạm đã xác nhận",
				})
			}
		}
	}

	// Notify driver that checkpoint was confirmed
	if s.notifSvc != nil {
		trip, _ := s.repo.GetTrip(ctx, cp.TripID)
		if trip != nil && trip.DriverID != nil {
			driverUser, _ := s.repo.GetUserIDByDriverID(ctx, *trip.DriverID)
			if driverUser != uuid.Nil {
				title := fmt.Sprintf("Trạm %d đã xác nhận ✅", cp.CheckpointOrder)
				body := fmt.Sprintf("%s đã xác nhận trạm %s", receiverName, cp.CheckpointType)
				link := fmt.Sprintf("/driver/%s", cp.TripID.String())
				go func() {
					_ = s.notifSvc.Send(context.Background(), driverUser, title, body, "eod_confirmed", &link)
				}()
			}
		}
	}

	updated, _ := s.repo.GetEODCheckpoint(ctx, checkpointID)
	return updated, nil
}

type RejectCheckpointRequest struct {
	Reason string `json:"reason" binding:"required"`
}

// RejectCheckpoint — receiver rejects a checkpoint, driver needs to resubmit.
func (s *Service) RejectCheckpoint(ctx context.Context, receiverID, checkpointID uuid.UUID, req RejectCheckpointRequest) (*domain.EODCheckpoint, error) {
	cp, err := s.repo.GetEODCheckpoint(ctx, checkpointID)
	if err != nil {
		return nil, fmt.Errorf("checkpoint not found: %w", err)
	}

	if cp.Status != "submitted" {
		return nil, fmt.Errorf("trạm này chưa được tài xế gửi hoặc đã xử lý rồi")
	}

	if err := s.repo.RejectEODCheckpoint(ctx, checkpointID, receiverID, req.Reason); err != nil {
		return nil, fmt.Errorf("reject checkpoint: %w", err)
	}

	// Notify driver
	if s.notifSvc != nil {
		trip, _ := s.repo.GetTrip(ctx, cp.TripID)
		if trip != nil && trip.DriverID != nil {
			driverUser, _ := s.repo.GetUserIDByDriverID(ctx, *trip.DriverID)
			if driverUser != uuid.Nil {
				title := fmt.Sprintf("Trạm %d bị từ chối ❌", cp.CheckpointOrder)
				body := fmt.Sprintf("Lý do: %s. Vui lòng kiểm tra lại.", req.Reason)
				link := fmt.Sprintf("/driver/%s", cp.TripID.String())
				go func() {
					_ = s.notifSvc.Send(context.Background(), driverUser, title, body, "eod_rejected", &link)
				}()
			}
		}
	}

	// Reset status to pending so driver can resubmit
	_, _ = s.repo.db.Exec(ctx, `UPDATE eod_checkpoints SET status = 'pending', updated_at = NOW() WHERE id = $1`, checkpointID)

	updated, _ := s.repo.GetEODCheckpoint(ctx, checkpointID)
	return updated, nil
}

// GetPendingCheckpointsByType returns submitted checkpoints waiting for confirmation by role.
func (s *Service) GetPendingCheckpointsByType(ctx context.Context, cpType string) ([]domain.EODCheckpoint, error) {
	return s.repo.GetPendingEODCheckpointsForRole(ctx, cpType)
}
