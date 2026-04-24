package fleet

import (
	"context"
	"fmt"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
	"github.com/shopspring/decimal"
)

var emergencyAutoApproveLimit = decimal.NewFromInt(5000000)

type Service struct {
	repo *Repository
	log  logger.Logger
}

func NewService(repo *Repository, log logger.Logger) *Service {
	return &Service{repo: repo, log: log}
}

// ─── Work Orders ───

func (s *Service) CreateWorkOrder(ctx context.Context, req CreateWorkOrderRequest, userID uuid.UUID) (*WorkOrder, error) {
	woNumber, err := s.repo.NextWONumber(ctx)
	if err != nil {
		return nil, fmt.Errorf("generate WO number: %w", err)
	}

	wo := &WorkOrder{
		ID:           uuid.New(),
		WONumber:     woNumber,
		VehicleID:    req.VehicleID,
		DriverID:     req.DriverID,
		GarageID:     req.GarageID,
		TriggerType:  req.TriggerType,
		Category:     req.Category,
		Priority:     req.Priority,
		Description:  req.Description,
		Status:       "draft",
		QuotedAmount: req.QuotedAmount,
		IsEmergency:  req.IsEmergency,
		IsRecurring:  req.IsRecurring,
		KmAtRepair:   req.KmAtRepair,
		CreatedBy:    userID,
	}

	// Emergency auto-approve if ≤ 5M VNĐ
	if req.IsEmergency && req.QuotedAmount.LessThanOrEqual(emergencyAutoApproveLimit) {
		wo.Status = "approved"
		wo.ApprovedBy = &userID
		now := time.Now()
		wo.ApprovedAt = &now
		s.log.Info(ctx, "emergency_auto_approved",
			logger.F("wo_number", woNumber),
			logger.F("amount", req.QuotedAmount.String()))
	}

	if err := s.repo.CreateWorkOrder(ctx, wo); err != nil {
		return nil, fmt.Errorf("create work order: %w", err)
	}

	// Create repair items
	if len(req.Items) > 0 {
		var items []RepairItem
		for _, ri := range req.Items {
			items = append(items, RepairItem{
				ID:          uuid.New(),
				WorkOrderID: wo.ID,
				ItemType:    ri.ItemType,
				Description: ri.Description,
				Quantity:    ri.Quantity,
				UnitPrice:   ri.UnitPrice,
				TotalPrice:  ri.UnitPrice.Mul(decimal.NewFromInt(int64(ri.Quantity))),
				PartNumber:  ri.PartNumber,
			})
		}
		if err := s.repo.CreateRepairItems(ctx, items); err != nil {
			s.log.Error(ctx, "create_repair_items_failed", err, logger.F("wo_id", wo.ID.String()))
		}
	}

	return wo, nil
}

func (s *Service) GetWorkOrder(ctx context.Context, id uuid.UUID) (*WorkOrder, error) {
	wo, err := s.repo.GetWorkOrder(ctx, id)
	if err != nil {
		return nil, err
	}
	items, _ := s.repo.ListRepairItems(ctx, id)
	wo.Items = items
	return wo, nil
}

func (s *Service) ListWorkOrders(ctx context.Context, filter WOFilter) ([]WorkOrder, int, error) {
	return s.repo.ListWorkOrders(ctx, filter)
}

func (s *Service) UpdateWorkOrder(ctx context.Context, id uuid.UUID, fields map[string]interface{}) error {
	return s.repo.UpdateWorkOrder(ctx, id, fields)
}

func (s *Service) ApproveWorkOrder(ctx context.Context, woID, approverID uuid.UUID, req ApproveWORequest) error {
	wo, err := s.repo.GetWorkOrder(ctx, woID)
	if err != nil {
		return fmt.Errorf("get work order: %w", err)
	}
	if wo.Status != "draft" && wo.Status != "quoted" {
		return fmt.Errorf("work order status must be draft or quoted, got %s", wo.Status)
	}

	fields := map[string]interface{}{}
	if req.Approved {
		fields["status"] = "approved"
		fields["approved_by"] = approverID
		fields["approved_at"] = time.Now()
	} else {
		fields["status"] = "cancelled"
		fields["rejection_reason"] = req.RejectionReason
	}
	return s.repo.UpdateWorkOrder(ctx, woID, fields)
}

func (s *Service) CompleteWorkOrder(ctx context.Context, woID uuid.UUID, req CompleteWORequest) error {
	wo, err := s.repo.GetWorkOrder(ctx, woID)
	if err != nil {
		return fmt.Errorf("get work order: %w", err)
	}
	if wo.Status != "in_progress" && wo.Status != "approved" {
		return fmt.Errorf("work order status must be in_progress or approved, got %s", wo.Status)
	}

	now := time.Now()
	fields := map[string]interface{}{
		"status":            "completed",
		"actual_amount":     req.ActualAmount,
		"actual_completion": now,
	}
	if req.InvoiceURL != nil {
		fields["invoice_url"] = *req.InvoiceURL
	}

	if err := s.repo.UpdateWorkOrder(ctx, woID, fields); err != nil {
		return err
	}

	// Re-calculate health score after repair
	go s.RecalculateHealthScore(context.Background(), wo.VehicleID)
	return nil
}

// ─── Health Score ───

func (s *Service) RecalculateHealthScore(ctx context.Context, vehicleID uuid.UUID) {
	vhd, err := s.repo.GetVehicleHealthData(ctx, vehicleID)
	if err != nil {
		s.log.Error(ctx, "health_calc_failed", err, logger.F("vehicle_id", vehicleID.String()))
		return
	}

	score := 100
	// Open ROs: -10 each
	score -= vhd.OpenROs * 10
	// Overdue maintenance: -15 each
	score -= vhd.OverdueMaintenance * 15
	// Age factor
	if vhd.YearOfManufacture != nil {
		age := time.Now().Year() - *vhd.YearOfManufacture
		if age > 8 {
			score -= 10
		} else if age > 5 {
			score -= 5
		}
	}

	if score < 0 {
		score = 0
	}
	if score > 100 {
		score = 100
	}

	if err := s.repo.UpdateVehicleHealthScore(ctx, vehicleID, score); err != nil {
		s.log.Error(ctx, "health_update_failed", err, logger.F("vehicle_id", vehicleID.String()))
	}
}

func (s *Service) GetVehicleHealth(ctx context.Context, vehicleID uuid.UUID) (*VehicleHealthData, error) {
	vhd, err := s.repo.GetVehicleHealthData(ctx, vehicleID)
	if err != nil {
		return nil, err
	}
	// Calculate live score
	score := 100
	score -= vhd.OpenROs * 10
	score -= vhd.OverdueMaintenance * 15
	if vhd.YearOfManufacture != nil {
		age := time.Now().Year() - *vhd.YearOfManufacture
		if age > 8 {
			score -= 10
		} else if age > 5 {
			score -= 5
		}
	}
	if score < 0 {
		score = 0
	}
	vhd.CalculatedScore = score
	return vhd, nil
}

func (s *Service) ListAllVehiclesHealth(ctx context.Context) ([]VehicleHealthData, error) {
	return s.repo.ListAllVehiclesForHealth(ctx)
}

// ─── Garages ───

func (s *Service) CreateGarage(ctx context.Context, req CreateGarageRequest, userID uuid.UUID) (*Garage, error) {
	g := &Garage{
		ID:           uuid.New(),
		Name:         req.Name,
		Address:      req.Address,
		GPSLat:       req.GPSLat,
		GPSLng:       req.GPSLng,
		Phone:        req.Phone,
		Specialties:  req.Specialties,
		PaymentTerms: req.PaymentTerms,
		OpeningHours: req.OpeningHours,
		IsPreferred:  req.IsPreferred,
		CreatedBy:    &userID,
	}
	if err := s.repo.CreateGarage(ctx, g); err != nil {
		return nil, err
	}
	return g, nil
}

func (s *Service) ListGarages(ctx context.Context, includeBlacklisted bool) ([]Garage, error) {
	return s.repo.ListGarages(ctx, includeBlacklisted)
}

func (s *Service) UpdateGarage(ctx context.Context, id uuid.UUID, req UpdateGarageRequest) error {
	fields := map[string]interface{}{}
	if req.Name != nil {
		fields["name"] = *req.Name
	}
	if req.Address != nil {
		fields["address"] = *req.Address
	}
	if req.Phone != nil {
		fields["phone"] = *req.Phone
	}
	if req.Specialties != nil {
		fields["specialties"] = req.Specialties
	}
	if req.IsPreferred != nil {
		fields["is_preferred"] = *req.IsPreferred
	}
	if req.IsBlacklisted != nil {
		fields["is_blacklisted"] = *req.IsBlacklisted
	}
	if len(fields) == 0 {
		return nil
	}
	return s.repo.UpdateGarage(ctx, id, fields)
}

func (s *Service) RateGarage(ctx context.Context, garageID uuid.UUID, req RateGarageRequest, userID uuid.UUID) error {
	rating := &GarageRating{
		ID:           uuid.New(),
		GarageID:     garageID,
		WorkOrderID:  req.WorkOrderID,
		QualityScore: req.QualityScore,
		TimeScore:    req.TimeScore,
		CostVsQuote:  req.CostVsQuote,
		ReworkFlag:   req.ReworkFlag,
		Notes:        req.Notes,
		RatedBy:      userID,
	}
	return s.repo.CreateGarageRating(ctx, rating)
}

func (s *Service) GetGarageBenchmark(ctx context.Context) ([]GarageBenchmark, error) {
	return s.repo.GetGarageBenchmark(ctx)
}

// ─── Fuel Logs ───

func (s *Service) CreateFuelLog(ctx context.Context, req CreateFuelLogRequest, userID uuid.UUID) (*FuelLog, error) {
	// Get consumption rate for anomaly detection
	// First we need vehicle type - we'll get it from the vehicle health data
	vhd, err := s.repo.GetVehicleHealthData(ctx, req.VehicleID)
	if err != nil {
		return nil, fmt.Errorf("get vehicle: %w", err)
	}

	rate, err := s.repo.GetFuelConsumptionRate(ctx, vhd.VehicleType)
	if err != nil {
		s.log.Error(ctx, "fuel_rate_lookup_failed", err)
	}

	// Calculate expected liters
	prevKm, _ := s.repo.GetPreviousOdometer(ctx, req.VehicleID)
	distanceKm := 0
	if prevKm > 0 && req.KmOdometer > prevKm {
		distanceKm = req.KmOdometer - prevKm
	}

	expectedLiters := decimal.Zero
	anomalyRatio := decimal.Zero
	anomalyFlag := false

	if distanceKm > 0 && rate != nil {
		expected := float64(distanceKm) * rate.BaseRate / 100.0 * rate.UrbanFactor
		expectedLiters = decimal.NewFromFloat(expected)
		if !expectedLiters.IsZero() {
			ratio := req.LitersFilled.Sub(expectedLiters).Abs().Div(expectedLiters)
			anomalyRatio = ratio
			anomalyFlag = ratio.GreaterThan(decimal.NewFromFloat(0.25))
		}
	}

	fl := &FuelLog{
		ID:              uuid.New(),
		VehicleID:       req.VehicleID,
		DriverID:        req.DriverID,
		LogDate:         req.LogDate,
		KmOdometer:      req.KmOdometer,
		LitersFilled:    req.LitersFilled,
		AmountVND:       req.AmountVND,
		FuelType:        req.FuelType,
		StationName:     req.StationName,
		InvoicePhotoURL: req.InvoicePhotoURL,
		Channel:         req.Channel,
		ExpectedLiters:  expectedLiters,
		AnomalyRatio:    anomalyRatio,
		AnomalyFlag:     anomalyFlag,
		CreatedBy:       &userID,
	}

	if err := s.repo.CreateFuelLog(ctx, fl); err != nil {
		return nil, fmt.Errorf("create fuel log: %w", err)
	}

	// Update vehicle current_km
	s.repo.UpdateWorkOrder(ctx, uuid.Nil, map[string]interface{}{}) // skip, we'll update directly
	s.repo.db.Exec(ctx, "UPDATE vehicles SET current_km = $1, updated_at = NOW() WHERE id = $2", req.KmOdometer, req.VehicleID)

	// Create anomaly record if flagged
	if anomalyFlag {
		fa := &FuelAnomaly{
			ID:             uuid.New(),
			FuelLogID:      fl.ID,
			VehicleID:      req.VehicleID,
			DriverID:       req.DriverID,
			ExpectedLiters: expectedLiters,
			ActualLiters:   req.LitersFilled,
			AnomalyRatio:   anomalyRatio,
			Status:         "pending",
		}
		if err := s.repo.CreateFuelAnomaly(ctx, fa); err != nil {
			s.log.Error(ctx, "create_anomaly_failed", err)
		}
	}

	return fl, nil
}

func (s *Service) ListFuelLogs(ctx context.Context, filter FuelLogFilter) ([]FuelLog, int, error) {
	return s.repo.ListFuelLogs(ctx, filter)
}

func (s *Service) ListFuelAnomalies(ctx context.Context, status string) ([]FuelAnomaly, error) {
	return s.repo.ListFuelAnomalies(ctx, status)
}

func (s *Service) ResolveFuelAnomaly(ctx context.Context, anomalyID uuid.UUID, req ResolveFuelAnomalyRequest, reviewerID uuid.UUID) error {
	return s.repo.UpdateFuelAnomaly(ctx, anomalyID, req.Status, req.Explanation, reviewerID)
}

// ─── Tire Sets ───

func (s *Service) CreateTireSet(ctx context.Context, req CreateTireSetRequest, userID uuid.UUID) (*TireSet, error) {
	ts := &TireSet{
		ID:            uuid.New(),
		VehicleID:     req.VehicleID,
		Brand:         req.Brand,
		Model:         req.Model,
		Size:          req.Size,
		TireCount:     req.TireCount,
		InstalledDate: req.InstalledDate,
		InstalledKm:   req.InstalledKm,
		PurchaseCost:  req.PurchaseCost,
		Condition:     "ok",
		IsActive:      true,
		CreatedBy:     &userID,
	}
	if ts.TireCount == 0 {
		ts.TireCount = 6
	}
	if ts.InstalledDate == "" {
		ts.InstalledDate = time.Now().Format("2006-01-02")
	}
	if err := s.repo.CreateTireSet(ctx, ts); err != nil {
		return nil, err
	}
	return ts, nil
}

func (s *Service) ListTireSets(ctx context.Context, vehicleID uuid.UUID) ([]TireSet, error) {
	return s.repo.ListTireSets(ctx, vehicleID)
}

func (s *Service) UpdateTireSet(ctx context.Context, id uuid.UUID, req UpdateTireSetRequest) error {
	fields := map[string]interface{}{}
	if req.Condition != nil {
		fields["condition"] = *req.Condition
	}
	if req.LastRotationKm != nil {
		fields["last_rotation_km"] = *req.LastRotationKm
	}
	if req.Notes != nil {
		fields["notes"] = *req.Notes
	}
	if req.IsActive != nil {
		fields["is_active"] = *req.IsActive
	}
	if len(fields) == 0 {
		return nil
	}
	return s.repo.UpdateTireSet(ctx, id, fields)
}

// ─── Leave Requests ───

func (s *Service) CreateLeaveRequest(ctx context.Context, driverID uuid.UUID, req CreateLeaveRequestReq) (*LeaveRequest, error) {
	lr := &LeaveRequest{
		ID:        uuid.New(),
		DriverID:  driverID,
		LeaveType: req.LeaveType,
		StartDate: req.StartDate,
		EndDate:   req.EndDate,
		Reason:    req.Reason,
		Status:    "pending",
	}
	if err := s.repo.CreateLeaveRequest(ctx, lr); err != nil {
		return nil, err
	}
	return lr, nil
}

func (s *Service) ListLeaveRequests(ctx context.Context, driverID *uuid.UUID, status string) ([]LeaveRequest, error) {
	return s.repo.ListLeaveRequests(ctx, driverID, status)
}

func (s *Service) ApproveLeaveRequest(ctx context.Context, leaveID, approverID uuid.UUID, req ApproveLeaveRequest) error {
	status := "approved"
	if !req.Approved {
		status = "rejected"
	}
	return s.repo.UpdateLeaveRequest(ctx, leaveID, status, approverID, req.RejectionReason)
}

func (s *Service) GetDriverLeaveBalance(ctx context.Context, driverID uuid.UUID) (int, int, error) {
	return s.repo.GetDriverLeaveBalance(ctx, driverID)
}

// ─── Driver Score ───

func (s *Service) CalculateDriverScore(ctx context.Context, driverID uuid.UUID, date time.Time) (*DriverScore, error) {
	stats, err := s.repo.GetDriverTripStats(ctx, driverID, date)
	if err != nil {
		return nil, err
	}

	checklists, epods, err := s.repo.GetDriverChecklistStats(ctx, driverID, date)
	if err != nil {
		return nil, err
	}

	ds := &DriverScore{
		ID:                   uuid.New(),
		DriverID:             driverID,
		ScoreDate:            date.Format("2006-01-02"),
		TripsCount:           stats.Trips,
		StopsCount:           stats.TotalStops,
		OnTimeCount:          stats.OnTime,
		DeliveredCount:       stats.Delivered,
		FailedCount:          stats.Failed,
		ChecklistCompletions: checklists,
		EPODCompletions:      epods,
		ModelVersion:         "rule_v1",
	}

	// OTD Score (30%): on_time / total_stops * 100
	if stats.TotalStops > 0 {
		ds.OTDScore = float64(stats.OnTime) / float64(stats.TotalStops) * 100
	}

	// Delivery Score (25%): delivered / total_stops * 100
	if stats.TotalStops > 0 {
		ds.DeliveryScore = float64(stats.Delivered) / float64(stats.TotalStops) * 100
	}

	// Safety Score (25%): 100 - speed_violations * 20 (clamped 0-100)
	ds.SafetyScore = 100 // No speed data yet, default full
	if ds.SpeedViolations > 0 {
		ds.SafetyScore = max(0, 100-float64(ds.SpeedViolations)*20)
	}

	// Compliance Score (10%): checklist completion rate
	if stats.Trips > 0 {
		ds.ComplianceScore = min(100, float64(checklists)/float64(stats.Trips)*100)
	}

	// Customer Score (10%): ePOD rate
	if stats.Delivered > 0 {
		ds.CustomerScore = min(100, float64(epods)/float64(stats.Delivered)*100)
	}

	// Weighted total
	ds.TotalScore = ds.OTDScore*0.3 + ds.DeliveryScore*0.25 + ds.SafetyScore*0.25 + ds.ComplianceScore*0.1 + ds.CustomerScore*0.1

	if err := s.repo.UpsertDriverScore(ctx, ds); err != nil {
		return nil, err
	}

	// Update current_score
	s.repo.UpdateDriverCurrentScore(ctx, driverID, ds.TotalScore)

	return ds, nil
}

func (s *Service) GetDriverScorecard(ctx context.Context, driverID uuid.UUID) (*ScorecardResponse, error) {
	// Get driver name
	var name string
	var currentScore float64
	s.repo.db.QueryRow(ctx, "SELECT full_name, current_score FROM drivers WHERE id = $1", driverID).Scan(&name, &currentScore)

	history, err := s.repo.GetDriverScoreHistory(ctx, driverID, 30)
	if err != nil {
		return nil, err
	}

	badges, err := s.repo.GetDriverBadges(ctx, driverID)
	if err != nil {
		return nil, err
	}

	rank, total, _ := s.repo.GetDriverRank(ctx, driverID, "month")

	return &ScorecardResponse{
		DriverID:     driverID,
		DriverName:   name,
		CurrentScore: currentScore,
		Rank:         rank,
		RankTotal:    total,
		History:      history,
		Badges:       badges,
	}, nil
}

func (s *Service) GetLeaderboard(ctx context.Context, period string, limit int) ([]LeaderboardEntry, error) {
	if limit <= 0 {
		limit = 20
	}
	return s.repo.GetLeaderboard(ctx, period, limit)
}

func (s *Service) GetDriverBadges(ctx context.Context, driverID uuid.UUID) ([]BadgeAward, error) {
	return s.repo.GetDriverBadges(ctx, driverID)
}

func (s *Service) GetBonusReport(ctx context.Context, month string) ([]BonusReportEntry, error) {
	return s.repo.GetBonusReport(ctx, month)
}

// ─── Cost Analytics ───

func (s *Service) GetVehicleTCO(ctx context.Context, vehicleID uuid.UUID, months int) (*VehicleTCO, error) {
	if months <= 0 {
		months = 12
	}
	return s.repo.GetVehicleTCO(ctx, vehicleID, months)
}

func (s *Service) GetFleetTCOSummary(ctx context.Context, months int) ([]VehicleTCO, error) {
	if months <= 0 {
		months = 12
	}
	return s.repo.GetFleetTCOSummary(ctx, months)
}

func (s *Service) GetCostAnalytics(ctx context.Context, months int) (map[string]interface{}, error) {
	if months <= 0 {
		months = 12
	}

	summary, err := s.repo.GetRepairCostSummary(ctx, months)
	if err != nil {
		return nil, err
	}

	topVehicles, err := s.repo.GetTopCostVehicles(ctx, months, 10)
	if err != nil {
		return nil, err
	}

	breakdown, err := s.repo.GetCostBreakdownByCategory(ctx, months)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"summary":       summary,
		"top_vehicles":  topVehicles,
		"by_category":   breakdown,
		"period_months": months,
	}, nil
}

func max(a, b float64) float64 {
	if a > b {
		return a
	}
	return b
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
