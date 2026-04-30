package oms

import (
	"context"
	"fmt"

	"bhl-oms/internal/domain"
)

// GetAllWarehouses returns all active warehouses for list purposes
func (s *Service) GetAllWarehouses(ctx context.Context) ([]domain.Warehouse, error) {
	warehouses, err := s.repo.ListActiveWarehouses(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list warehouses: %w", err)
	}
	return warehouses, nil
}

// GetDashboardStats returns aggregate statistics for dashboard
func (s *Service) GetDashboardStats(ctx context.Context) (map[string]interface{}, error) {
	// Basic implementation returning empty aggregates
	// Will be expanded with actual metrics from orders/trips/warehouses
	stats := map[string]interface{}{
		"total_orders":     0,
		"pending_orders":   0,
		"today_deliveries": 0,
		"revenue_today":    0,
	}
	return stats, nil
}
