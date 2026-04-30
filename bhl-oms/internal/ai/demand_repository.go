package ai

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

func (r *Repository) GetDemandForecastContext(ctx context.Context, customerID, productID, warehouseID uuid.UUID) (*DemandForecastContext, error) {
	fc := &DemandForecastContext{CustomerID: customerID, ProductID: productID, WarehouseID: warehouseID}
	err := r.db.QueryRow(ctx, `
		SELECT
			c.code::text, c.name::text,
			p.sku::text, p.name::text,
			w.code::text, w.name::text
		FROM customers c
		CROSS JOIN products p
		CROSS JOIN warehouses w
		WHERE c.id = $1 AND p.id = $2 AND w.id = $3
	`, customerID, productID, warehouseID).Scan(
		&fc.CustomerCode, &fc.CustomerName,
		&fc.SKU, &fc.ProductName,
		&fc.WarehouseCode, &fc.WarehouseName,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("customer/product/warehouse không tồn tại")
		}
		return nil, fmt.Errorf("ai.repo.GetDemandForecastContext metadata: %w", err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT o.delivery_date::text, SUM(oi.quantity)::float
		FROM sales_orders o
		JOIN order_items oi ON oi.order_id = o.id
		WHERE o.customer_id = $1
		  AND oi.product_id = $2
		  AND o.warehouse_id = $3
		  AND o.status::text NOT IN ('cancelled')
		  AND o.delivery_date >= CURRENT_DATE - INTERVAL '120 days'
		GROUP BY o.delivery_date
		ORDER BY o.delivery_date
	`, customerID, productID, warehouseID)
	if err != nil {
		return nil, fmt.Errorf("ai.repo.GetDemandForecastContext history: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var point DemandHistoryPoint
		if err := rows.Scan(&point.Date, &point.Qty); err != nil {
			return nil, fmt.Errorf("scan demand history: %w", err)
		}
		fc.History = append(fc.History, point)
		fc.BaselineQty += point.Qty
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(fc.History) > 0 {
		fc.BaselineQty = fc.BaselineQty / float64(len(fc.History))
	}
	return fc, nil
}

func (r *Repository) ListOutreachQueue(ctx context.Context, limit int) ([]OutreachQueueItem, error) {
	if limit <= 0 || limit > 20 {
		limit = 3
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			COALESCE(c.id, '00000000-0000-0000-0000-000000000000'::uuid),
			nh.npp_code::text,
			COALESCE(c.name, nh.ten_npp_chuan)::text,
			COALESCE(c.province, nh.tinh, '')::text,
			nh.health_score_0_100::float,
			nh.risk_band::text,
			nh.recency_days,
			nh.frequency_orders
		FROM ml_features.npp_health_scores nh
		LEFT JOIN customers c ON c.code = nh.npp_code
		WHERE nh.risk_band IN ('RED', 'YELLOW')
		ORDER BY
			CASE nh.risk_band WHEN 'RED' THEN 0 ELSE 1 END,
			nh.health_score_0_100 ASC,
			nh.recency_days DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, fmt.Errorf("ai.repo.ListOutreachQueue: %w", err)
	}
	defer rows.Close()

	items := []OutreachQueueItem{}
	for rows.Next() {
		var item OutreachQueueItem
		if err := rows.Scan(&item.CustomerID, &item.CustomerCode, &item.CustomerName, &item.Province, &item.HealthScore, &item.RiskBand, &item.RecencyDays, &item.Frequency); err != nil {
			return nil, fmt.Errorf("scan outreach queue: %w", err)
		}
		item.Priority = 2
		item.SuggestedAction = "Gọi/Zalo hỏi nhu cầu nhập hàng trong hôm nay"
		item.Reason = fmt.Sprintf("%s, health score %.0f/100, chưa đặt hàng %d ngày", item.RiskBand, item.HealthScore, item.RecencyDays)
		if item.RiskBand == "RED" || item.RecencyDays >= 21 {
			item.Priority = 1
			item.SuggestedAction = "Ưu tiên liên hệ ngay và mở bản nháp Zalo"
		}
		items = append(items, item)
	}
	return items, rows.Err()
}
