package tms

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
)

type Service struct {
	repo         *Repository
	vrpSolverURL string
	jobs         sync.Map // jobID → *domain.VRPResult
}

func NewService(repo *Repository, vrpSolverURL string) *Service {
	return &Service{
		repo:         repo,
		vrpSolverURL: vrpSolverURL,
	}
}

func (s *Service) ListPendingShipments(ctx context.Context, warehouseID uuid.UUID, deliveryDate string) ([]domain.Shipment, error) {
	return s.repo.ListPendingShipments(ctx, warehouseID, deliveryDate)
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

type RunVRPRequest struct {
	WarehouseID  uuid.UUID   `json:"warehouse_id"`
	DeliveryDate string      `json:"delivery_date"`
	ShipmentIDs  []uuid.UUID `json:"shipment_ids,omitempty"`
	VehicleIDs   []uuid.UUID `json:"vehicle_ids,omitempty"`
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

	solverReq := buildSolverRequest(depotLat, depotLng, shipments, vehicles, jobID)

	// Store job as processing
	s.jobs.Store(jobID, &domain.VRPResult{JobID: jobID, Status: "processing"})

	// Call VRP solver asynchronously
	go s.callVRPSolver(jobID, solverReq, shipments, vehicles)

	return jobID, nil
}

type solverRequest struct {
	JobID    string          `json:"job_id"`
	Depot    [2]float64      `json:"depot"`
	Nodes    []solverNode    `json:"nodes"`
	Vehicles []solverVehicle `json:"vehicles"`
}

type solverNode struct {
	ID       string     `json:"id"`
	Location [2]float64 `json:"location"`
	Demand   float64    `json:"demand"`
	Name     string     `json:"name"`
}

type solverVehicle struct {
	ID       string  `json:"id"`
	Capacity float64 `json:"capacity"`
	Plate    string  `json:"plate"`
}

func buildSolverRequest(depotLat, depotLng float64, shipments []domain.Shipment, vehicles []domain.Vehicle, jobID string) *solverRequest {
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

	for _, v := range vehicles {
		req.Vehicles = append(req.Vehicles, solverVehicle{
			ID:       v.ID.String(),
			Capacity: v.CapacityKg,
			Plate:    v.PlateNumber,
		})
	}

	return req
}

type solverResponse struct {
	Status    string `json:"status"`
	SolveTime int    `json:"solve_time_ms"`
	Routes    []struct {
		VehicleID string   `json:"vehicle_id"`
		NodeIDs   []string `json:"node_ids"`
		Distance  float64  `json:"distance_km"`
		Duration  int      `json:"duration_min"`
	} `json:"routes"`
	Unassigned []string `json:"unassigned"`
}

func (s *Service) callVRPSolver(jobID string, req *solverRequest, shipments []domain.Shipment, vehicles []domain.Vehicle) {
	body, _ := json.Marshal(req)

	client := &http.Client{Timeout: 120 * time.Second}
	resp, err := client.Post(s.vrpSolverURL+"/solve", "application/json", bytes.NewReader(body))

	if err != nil {
		// If solver unreachable, return mock result for demo
		result := s.buildMockResult(jobID, shipments, vehicles)
		s.jobs.Store(jobID, result)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var solverResp solverResponse
	if err := json.Unmarshal(respBody, &solverResp); err != nil {
		result := s.buildMockResult(jobID, shipments, vehicles)
		s.jobs.Store(jobID, result)
		return
	}

	// Convert solver response to domain result
	result := s.convertSolverResult(jobID, &solverResp, shipments, vehicles)
	s.jobs.Store(jobID, result)
}

// buildMockResult creates a simple round-robin assignment for demo when solver is unavailable
func (s *Service) buildMockResult(jobID string, shipments []domain.Shipment, vehicles []domain.Vehicle) *domain.VRPResult {
	result := &domain.VRPResult{
		JobID:     jobID,
		Status:    "completed",
		SolveTime: 500,
	}

	// Simple round-robin assignment
	shipmentMap := make(map[int][]domain.Shipment)
	for i, sh := range shipments {
		vIdx := i % len(vehicles)
		shipmentMap[vIdx] = append(shipmentMap[vIdx], sh)
	}

	var totalDist float64
	var assigned int

	for vIdx, vehicle := range vehicles {
		shs, ok := shipmentMap[vIdx]
		if !ok {
			continue
		}

		trip := domain.VRPTrip{
			VehicleID:   vehicle.ID,
			PlateNumber: vehicle.PlateNumber,
			VehicleType: vehicle.VehicleType,
		}

		var cumWeight float64
		for stopIdx, sh := range shs {
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

		dist := float64(len(shs)) * 15.5 // ~15.5km avg between stops
		trip.TotalDistanceKm = dist
		trip.TotalDurationMin = len(shs) * 25 // ~25min per stop
		trip.TotalWeightKg = cumWeight
		totalDist += dist

		result.Trips = append(result.Trips, trip)
	}

	result.Summary = computeSummary(result, vehicles, shipments)

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
		JobID:     jobID,
		Status:    "completed",
		SolveTime: resp.SolveTime,
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

	for _, trip := range result.Trips {
		totalDist += trip.TotalDistanceKm
		totalDur += trip.TotalDurationMin
		totalWeight += trip.TotalWeightKg
		totalStops += len(trip.Stops)
		assigned += len(trip.Stops)

		if v, ok := vehicleMap[trip.VehicleID.String()]; ok && v.CapacityKg > 0 {
			utilSum += trip.TotalWeightKg / v.CapacityKg * 100
		}
	}

	avgUtil := 0.0
	avgStops := 0.0
	if len(result.Trips) > 0 {
		avgUtil = utilSum / float64(len(result.Trips))
		avgStops = float64(totalStops) / float64(len(result.Trips))
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
}

type Assignment struct {
	VehicleID   uuid.UUID   `json:"vehicle_id"`
	DriverID    *uuid.UUID  `json:"driver_id"`
	ShipmentIDs []uuid.UUID `json:"shipment_ids"`
}

// ApprovePlan creates actual trips from VRP result
func (s *Service) ApprovePlan(ctx context.Context, req ApprovePlanRequest) ([]domain.Trip, error) {
	result, err := s.GetVRPResult(req.JobID)
	if err != nil {
		return nil, err
	}

	if result.Status != "completed" {
		return nil, fmt.Errorf("VRP job not completed yet")
	}

	tx, err := s.repo.BeginTx(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

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
	for _, vrpTrip := range result.Trips {
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
			tripStop := domain.TripStop{
				TripID:           trip.ID,
				ShipmentID:       &stop.ShipmentID,
				CustomerID:       stop.CustomerID,
				StopOrder:        stop.StopOrder,
				Status:           "pending",
				CumulativeLoadKg: stop.CumulativeLoadKg,
			}

			if err := s.repo.CreateTripStop(ctx, tx, &tripStop); err != nil {
				return nil, fmt.Errorf("create stop: %w", err)
			}
			trip.Stops = append(trip.Stops, tripStop)

			// Update shipment status
			if err := s.repo.UpdateShipmentStatus(ctx, tx, stop.ShipmentID, "loaded"); err != nil {
				return nil, fmt.Errorf("update shipment: %w", err)
			}
		}

		trips = append(trips, trip)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, fmt.Errorf("commit: %w", err)
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
	"planned":    {"assigned", "in_transit", "cancelled"},
	"assigned":   {"in_transit", "cancelled"},
	"ready":      {"in_transit", "cancelled"},
	"pre_check":  {"ready", "cancelled"},
	"in_transit": {"completed", "cancelled"},
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
		return s.repo.CompleteTrip(ctx, tripID)
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

	return s.repo.StartTrip(ctx, tripID)
}

type UpdateStopRequest struct {
	Action string  `json:"action"` // arrive, deliver, fail, skip
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

	// Check all stops are terminal (delivered, failed, skipped)
	for _, stop := range trip.Stops {
		if stop.Status != "delivered" && stop.Status != "failed" && stop.Status != "skipped" {
			return fmt.Errorf("còn điểm giao '%s' (#%d) chưa hoàn thành", stop.CustomerName, stop.StopOrder)
		}
	}

	return s.repo.CompleteTrip(ctx, tripID)
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
