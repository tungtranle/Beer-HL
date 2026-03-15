-- Migration 003: Add cutoff_group to sales_orders + system_settings table
-- Task 1.14: OMS Cutoff 16h + consolidation/split

-- ===== SYSTEM SETTINGS (configurable cutoff time) =====
CREATE TABLE IF NOT EXISTS system_settings (
    key         VARCHAR(100) PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT,
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO system_settings (key, value, description) VALUES
    ('cutoff_hour', '16', 'Mốc chốt đơn (giờ, 0-23). Trước mốc = giao trong ngày, sau mốc = giao ngày mai')
ON CONFLICT (key) DO NOTHING;

-- ===== ADD cutoff_group to sales_orders =====
ALTER TABLE sales_orders ADD COLUMN IF NOT EXISTS cutoff_group VARCHAR(20) DEFAULT 'before_16h';

-- Update existing orders based on created_at
UPDATE sales_orders SET cutoff_group = CASE
    WHEN EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Ho_Chi_Minh') < 16 THEN 'before_16h'
    ELSE 'after_16h'
END
WHERE cutoff_group IS NULL OR cutoff_group = '';

CREATE INDEX IF NOT EXISTS idx_sales_orders_cutoff ON sales_orders (cutoff_group, delivery_date);
