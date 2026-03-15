package reconciliation

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"bhl-oms/internal/domain"

	"github.com/google/uuid"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

// ── Auto Reconcile Trip (Task 3.9) ─────────────────

// AutoReconcileTrip calculates goods, payment, and asset reconciliation for a completed trip.
// Per BR-REC-01: 3 types (goods, payment, asset). ALL variance=0 → matched, ANY>0 → discrepancy.
func (s *Service) AutoReconcileTrip(ctx context.Context, tripID uuid.UUID) ([]domain.Reconciliation, error) {
	var results []domain.Reconciliation

	// 1. GOODS reconciliation: expected qty vs delivered qty (from ePOD)
	goodsExpected, err := s.repo.GetTripGoodsExpected(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("get goods expected: %w", err)
	}
	goodsActual, err := s.repo.GetTripGoodsActual(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("get goods actual: %w", err)
	}
	goodsVariance := float64(goodsExpected - goodsActual)
	goodsStatus := "matched"
	if goodsVariance != 0 {
		goodsStatus = "discrepancy"
	}
	goodsDetails, _ := json.Marshal(map[string]interface{}{
		"expected_qty": goodsExpected,
		"actual_qty":   goodsActual,
	})

	goodsRec := domain.Reconciliation{
		TripID:        tripID,
		ReconType:     "goods",
		Status:        goodsStatus,
		ExpectedValue: float64(goodsExpected),
		ActualValue:   float64(goodsActual),
		Variance:      goodsVariance,
		Details:       goodsDetails,
	}
	if err := s.repo.CreateReconciliation(ctx, &goodsRec); err != nil {
		return nil, fmt.Errorf("create goods recon: %w", err)
	}
	results = append(results, goodsRec)

	// 2. PAYMENT reconciliation: expected revenue vs collected
	payExpected, err := s.repo.GetTripDeliveryExpected(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("get payment expected: %w", err)
	}
	payActual, err := s.repo.GetTripPaymentActual(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("get payment actual: %w", err)
	}
	payVariance := payExpected - payActual
	payStatus := "matched"
	if payVariance != 0 {
		payStatus = "discrepancy"
	}
	payDetails, _ := json.Marshal(map[string]interface{}{
		"expected_amount": payExpected,
		"actual_amount":   payActual,
	})

	payRec := domain.Reconciliation{
		TripID:        tripID,
		ReconType:     "payment",
		Status:        payStatus,
		ExpectedValue: payExpected,
		ActualValue:   payActual,
		Variance:      payVariance,
		Details:       payDetails,
	}
	if err := s.repo.CreateReconciliation(ctx, &payRec); err != nil {
		return nil, fmt.Errorf("create payment recon: %w", err)
	}
	results = append(results, payRec)

	// 3. ASSET reconciliation: expected returns vs actual returns
	assetExpected, err := s.repo.GetTripAssetExpected(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("get asset expected: %w", err)
	}
	assetActual, err := s.repo.GetTripAssetActual(ctx, tripID)
	if err != nil {
		return nil, fmt.Errorf("get asset actual: %w", err)
	}
	assetVariance := float64(assetExpected - assetActual)
	assetStatus := "matched"
	if assetVariance != 0 {
		assetStatus = "discrepancy"
	}
	assetDetails, _ := json.Marshal(map[string]interface{}{
		"expected_qty": assetExpected,
		"actual_qty":   assetActual,
	})

	assetRec := domain.Reconciliation{
		TripID:        tripID,
		ReconType:     "asset",
		Status:        assetStatus,
		ExpectedValue: float64(assetExpected),
		ActualValue:   float64(assetActual),
		Variance:      assetVariance,
		Details:       assetDetails,
	}
	if err := s.repo.CreateReconciliation(ctx, &assetRec); err != nil {
		return nil, fmt.Errorf("create asset recon: %w", err)
	}
	results = append(results, assetRec)

	// Auto-create discrepancy tickets for non-zero variances (Task 3.10)
	for _, rec := range results {
		if rec.Variance != 0 {
			deadline := time.Now().Add(24 * time.Hour) // T+1 deadline per BR-REC-01
			disc := domain.Discrepancy{
				ReconID:       rec.ID,
				TripID:        tripID,
				DiscType:      rec.ReconType,
				Status:        "open",
				Description:   fmt.Sprintf("Sai lệch %s: expected=%.2f, actual=%.2f, variance=%.2f", rec.ReconType, rec.ExpectedValue, rec.ActualValue, rec.Variance),
				ExpectedValue: rec.ExpectedValue,
				ActualValue:   rec.ActualValue,
				Variance:      rec.Variance,
				Deadline:      &deadline,
			}
			if err := s.repo.CreateDiscrepancy(ctx, &disc); err != nil {
				log.Printf("[Reconciliation] Failed to create discrepancy for trip %s type %s: %v", tripID, rec.ReconType, err)
			}
		}
	}

	return results, nil
}

// ── List / Get Reconciliations ──────────────────────

func (s *Service) GetReconciliationsByTrip(ctx context.Context, tripID uuid.UUID) ([]domain.Reconciliation, error) {
	return s.repo.GetReconciliationsByTrip(ctx, tripID)
}

func (s *Service) ListReconciliations(ctx context.Context, status string, page, limit int) ([]domain.Reconciliation, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	return s.repo.ListReconciliations(ctx, status, page, limit)
}

func (s *Service) ResolveReconciliation(ctx context.Context, id, userID uuid.UUID) error {
	return s.repo.ResolveReconciliation(ctx, id, userID)
}

// ── Discrepancy Management (Task 3.10) ──────────────

func (s *Service) ListDiscrepancies(ctx context.Context, tripID *uuid.UUID, status string, page, limit int) ([]domain.Discrepancy, int64, error) {
	if limit <= 0 {
		limit = 20
	}
	if page <= 0 {
		page = 1
	}
	return s.repo.ListDiscrepancies(ctx, tripID, status, page, limit)
}

func (s *Service) ResolveDiscrepancy(ctx context.Context, id, userID uuid.UUID, resolution string) error {
	return s.repo.ResolveDiscrepancy(ctx, id, userID, resolution)
}

// ── Daily Close Summary (Task 3.11) ─────────────────

// GenerateDailyClose auto-reconciles all completed trips for a warehouse+date,
// then builds a daily close summary.
func (s *Service) GenerateDailyClose(ctx context.Context, warehouseID uuid.UUID, date string) (*domain.DailyCloseSummary, error) {
	// Auto-reconcile completed trips that haven't been reconciled yet
	tripIDs, err := s.repo.GetCompletedTripIDs(ctx, warehouseID, date)
	if err != nil {
		return nil, fmt.Errorf("get completed trips: %w", err)
	}

	for _, tripID := range tripIDs {
		if _, err := s.AutoReconcileTrip(ctx, tripID); err != nil {
			log.Printf("[Reconciliation] auto-reconcile trip %s failed: %v", tripID, err)
		}
	}

	// Build summary from DB aggregates
	summary, err := s.repo.GetWarehouseStatsForClose(ctx, warehouseID, date)
	if err != nil {
		return nil, fmt.Errorf("get warehouse stats: %w", err)
	}

	// Persist
	if err := s.repo.CreateDailyCloseSummary(ctx, summary); err != nil {
		return nil, fmt.Errorf("create daily close: %w", err)
	}

	return summary, nil
}

func (s *Service) GetDailyCloseSummary(ctx context.Context, date string, warehouseID uuid.UUID) (*domain.DailyCloseSummary, error) {
	return s.repo.GetDailyCloseSummary(ctx, date, warehouseID)
}

func (s *Service) ListDailyCloseSummaries(ctx context.Context, warehouseID *uuid.UUID, limit int) ([]domain.DailyCloseSummary, error) {
	if limit <= 0 {
		limit = 30
	}
	return s.repo.ListDailyCloseSummaries(ctx, warehouseID, limit)
}
