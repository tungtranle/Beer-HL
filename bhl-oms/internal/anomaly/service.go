package anomaly

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"bhl-oms/pkg/logger"

	"github.com/google/uuid"
)

// ============================================================
// Service — detection rules + orchestration.
// ============================================================

type Service struct {
	repo       *Repository
	log        logger.Logger
	thresholds map[string]Threshold
	thrMu      sync.RWMutex
	thrLoaded  time.Time

	// Per-vehicle state for stop_overdue tracking.
	stopMu      sync.Mutex
	stopStarted map[uuid.UUID]stationaryState
}

type stationaryState struct {
	since time.Time
	lat   float64
	lng   float64
}

const (
	// Reload thresholds every N minutes to pick up cron-updated rows.
	thresholdRefreshInterval = 5 * time.Minute
	// Speed below this is "stopped".
	stoppedSpeedKmh = 3.0
	// If position drifts by > this many km, treat as a fresh stop.
	stopDriftKm = 0.15
	// Window for de-dup of similar alerts.
	dedupWindow = 10 * time.Minute
)

func NewService(repo *Repository, log logger.Logger) *Service {
	return &Service{
		repo:        repo,
		log:         log,
		thresholds:  make(map[string]Threshold),
		stopStarted: make(map[uuid.UUID]stationaryState),
	}
}

func (s *Service) thr(ctx context.Context, name string, fallback float64, fallbackSev string) (float64, string) {
	s.thrMu.RLock()
	stale := time.Since(s.thrLoaded) > thresholdRefreshInterval
	t, ok := s.thresholds[name]
	s.thrMu.RUnlock()
	if !ok || stale {
		if fresh, err := s.repo.LoadThresholds(ctx); err == nil {
			s.thrMu.Lock()
			s.thresholds = fresh
			s.thrLoaded = time.Now()
			s.thrMu.Unlock()
			if t2, ok2 := fresh[name]; ok2 {
				return t2.ThresholdValue, t2.Severity
			}
		}
		if !ok {
			return fallback, fallbackSev
		}
	}
	return t.ThresholdValue, t.Severity
}

// ============================================================
// Public API for handler
// ============================================================

func (s *Service) List(ctx context.Context, status string, limit int) ([]Anomaly, error) {
	return s.repo.List(ctx, status, limit)
}

func (s *Service) Acknowledge(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.Acknowledge(ctx, id, userID)
}

func (s *Service) Resolve(ctx context.Context, id, userID uuid.UUID, note string, falsePositive bool) error {
	return s.repo.Resolve(ctx, id, userID, note, falsePositive)
}

// ============================================================
// Detection — invoked from gps.Hub for every received GPS point.
// Best-effort: never blocks GPS ingestion. Logs internal errors.
// ============================================================

// DetectionInput is what gps.Hub provides per point.
type DetectionInput struct {
	VehicleID uuid.UUID
	DriverID  *uuid.UUID
	Lat       float64
	Lng       float64
	SpeedKmh  float64
	At        time.Time
}

// Detect runs all rules. Safe to call concurrently.
func (s *Service) Detect(ctx context.Context, in DetectionInput) {
	// Rule 1: speed_high (no trip context needed)
	s.checkSpeedHigh(ctx, in)

	// Rule 2 + 3 need active trip context.
	tripID, stops, err := s.repo.LoadActiveTripPlannedStops(ctx, in.VehicleID)
	if err != nil {
		s.log.Warn(ctx, "anomaly_load_trip_failed",
			logger.F("vehicle_id", in.VehicleID.String()),
			logger.F("err", err.Error()))
		return
	}
	if tripID == nil {
		// No active trip → no deviation/stop-overdue context.
		s.clearStationary(in.VehicleID)
		return
	}

	s.checkDeviation(ctx, in, tripID, stops)
	s.checkStopOverdue(ctx, in, tripID, stops)
}

// DetectPoint implements gps.PointDetector. Adapter to keep gps package
// free of anomaly types (avoids import cycle).
func (s *Service) DetectPoint(ctx context.Context, vehicleID uuid.UUID, driverID *uuid.UUID, lat, lng, speedKmh float64, at time.Time) {
	defer func() {
		if r := recover(); r != nil {
			s.log.Error(ctx, "anomaly_detect_panic",
				fmt.Errorf("%v", r),
				logger.F("vehicle_id", vehicleID.String()))
		}
	}()
	s.Detect(ctx, DetectionInput{
		VehicleID: vehicleID,
		DriverID:  driverID,
		Lat:       lat,
		Lng:       lng,
		SpeedKmh:  speedKmh,
		At:        at,
	})
}

// ============================================================
// Rule 1: Excessive speed.
// ============================================================
func (s *Service) checkSpeedHigh(ctx context.Context, in DetectionInput) {
	threshold, severity := s.thr(ctx, "speed_high_kmh", 90.0, "P2")
	if in.SpeedKmh < threshold {
		return
	}
	exists, _ := s.repo.HasOpenSimilar(ctx, in.VehicleID, "speed_high", dedupWindow)
	if exists {
		return
	}
	speed := in.SpeedKmh
	a := &Anomaly{
		VehicleID:   in.VehicleID,
		DriverID:    in.DriverID,
		AnomalyType: "speed_high",
		Severity:    severity,
		Lat:         in.Lat,
		Lng:         in.Lng,
		SpeedKmh:    &speed,
		Description: fmt.Sprintf("Vận tốc %.0f km/h vượt ngưỡng %.0f km/h", in.SpeedKmh, threshold),
		DetectedAt:  in.At,
	}
	if err := s.repo.Insert(ctx, a); err != nil {
		s.log.Warn(ctx, "anomaly_insert_speed_failed", logger.F("err", err.Error()))
		return
	}
	s.notify(ctx, a)
}

// ============================================================
// Rule 2: Off-route deviation (>2 km from any planned stop).
// ============================================================
func (s *Service) checkDeviation(ctx context.Context, in DetectionInput, tripID *uuid.UUID, stops []PlannedStop) {
	if len(stops) == 0 {
		return
	}
	threshold, severity := s.thr(ctx, "deviation_km", 2.0, "P1")
	minKm := math.MaxFloat64
	var nearest PlannedStop
	for _, s := range stops {
		d := haversineKm(in.Lat, in.Lng, s.Lat, s.Lng)
		if d < minKm {
			minKm = d
			nearest = s
		}
	}
	if minKm <= threshold {
		return
	}
	exists, _ := s.repo.HasOpenSimilar(ctx, in.VehicleID, "deviation", dedupWindow)
	if exists {
		return
	}
	dist := minKm
	a := &Anomaly{
		VehicleID:   in.VehicleID,
		TripID:      tripID,
		DriverID:    in.DriverID,
		AnomalyType: "deviation",
		Severity:    severity,
		Lat:         in.Lat,
		Lng:         in.Lng,
		DistanceKm:  &dist,
		Description: fmt.Sprintf("Lệch %.1f km khỏi điểm dừng gần nhất (%s)", minKm, truncate(nearest.Name, 40)),
		DetectedAt:  in.At,
	}
	if err := s.repo.Insert(ctx, a); err != nil {
		s.log.Warn(ctx, "anomaly_insert_deviation_failed", logger.F("err", err.Error()))
		return
	}
	s.notify(ctx, a)
}

// ============================================================
// Rule 3: Stop overdue (>20 min stationary outside any planned stop).
// ============================================================
func (s *Service) checkStopOverdue(ctx context.Context, in DetectionInput, tripID *uuid.UUID, stops []PlannedStop) {
	thresholdMin, severity := s.thr(ctx, "stop_overdue_min", 20.0, "P0")
	radiusM, _ := s.thr(ctx, "arrival_radius_m", 200.0, "P2")
	radiusKm := radiusM / 1000.0

	if in.SpeedKmh > stoppedSpeedKmh {
		s.clearStationary(in.VehicleID)
		return
	}

	// Vehicle is stopped. Check if at a planned stop (within radiusKm).
	for _, st := range stops {
		if haversineKm(in.Lat, in.Lng, st.Lat, st.Lng) <= radiusKm {
			s.clearStationary(in.VehicleID)
			return
		}
	}

	// Stopped outside any planned stop. Track / accumulate time.
	s.stopMu.Lock()
	state, exists := s.stopStarted[in.VehicleID]
	if !exists || haversineKm(state.lat, state.lng, in.Lat, in.Lng) > stopDriftKm {
		// New stop event
		s.stopStarted[in.VehicleID] = stationaryState{since: in.At, lat: in.Lat, lng: in.Lng}
		s.stopMu.Unlock()
		return
	}
	elapsed := in.At.Sub(state.since).Minutes()
	s.stopMu.Unlock()

	if elapsed < thresholdMin {
		return
	}

	// Threshold exceeded → emit (with dedup)
	already, _ := s.repo.HasOpenSimilar(ctx, in.VehicleID, "stop_overdue", dedupWindow)
	if already {
		return
	}
	dur := elapsed
	a := &Anomaly{
		VehicleID:   in.VehicleID,
		TripID:      tripID,
		DriverID:    in.DriverID,
		AnomalyType: "stop_overdue",
		Severity:    severity,
		Lat:         in.Lat,
		Lng:         in.Lng,
		DurationMin: &dur,
		Description: fmt.Sprintf("Đứng yên %.0f phút ngoài kế hoạch (ngưỡng %.0f phút)", dur, thresholdMin),
		DetectedAt:  in.At,
	}
	if err := s.repo.Insert(ctx, a); err != nil {
		s.log.Warn(ctx, "anomaly_insert_stop_failed", logger.F("err", err.Error()))
		return
	}
	s.notify(ctx, a)
}

func (s *Service) clearStationary(vehicleID uuid.UUID) {
	s.stopMu.Lock()
	delete(s.stopStarted, vehicleID)
	s.stopMu.Unlock()
}

// ============================================================
// Notification stub. Sprint 2 will wire actual Zalo OA template.
// ============================================================
func (s *Service) notify(ctx context.Context, a *Anomaly) {
	s.log.Info(ctx, "anomaly_detected_zalo_pending",
		logger.F("anomaly_id", a.ID.String()),
		logger.F("type", a.AnomalyType),
		logger.F("severity", a.Severity),
		logger.F("vehicle_id", a.VehicleID.String()),
		logger.F("description", a.Description),
	)
	// TODO: integrate with internal/integration/zalo dispatcher template.
	// For now mark as 'sent' = false; UI will display "chưa gửi Zalo".
}

// ============================================================
// Helpers
// ============================================================

// haversineKm returns great-circle distance between two coords in km.
func haversineKm(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371.0
	rad := math.Pi / 180.0
	dLat := (lat2 - lat1) * rad
	dLon := (lon2 - lon1) * rad
	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*rad)*math.Cos(lat2*rad)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return R * c
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}
