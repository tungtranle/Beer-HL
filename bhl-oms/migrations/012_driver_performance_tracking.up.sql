-- Migration 012: Driver Performance Tracking (Scorecard, Leaderboard, Vehicle Health, TCO)
-- Tạo hệ thống đo lường hiệu suất lái xe, xếp hạng, sức khỏe xe, chi phí vận hành

-- ===== DRIVER SCORECARD (Bảng điểm lái) =====
-- Tính toán hàng ngày/tuần/tháng dựa trên trips, deliveries, rejections, damages
CREATE TABLE IF NOT EXISTS driver_scorecards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,           -- 'daily', 'weekly', 'monthly'
    period_date DATE NOT NULL,                  -- date của period (tuần lấy từ thứ 2, tháng lấy từ ngày 1)
    
    -- KPI chính
    trips_completed INTEGER NOT NULL DEFAULT 0,        -- số chuyến hoàn tất
    deliveries_total INTEGER NOT NULL DEFAULT 0,       -- tổng điểm giao
    deliveries_success INTEGER NOT NULL DEFAULT 0,     -- giao thành công (100%)
    partial_deliveries INTEGER NOT NULL DEFAULT 0,     -- giao một phần
    rejections INTEGER NOT NULL DEFAULT 0,             -- điểm từ chối
    re_deliveries INTEGER NOT NULL DEFAULT 0,          -- giao lại
    
    -- Chất lượng & hành vi
    on_time_ratio NUMERIC(5,2) NOT NULL DEFAULT 0,     -- % giao đúng giờ (0-100)
    asset_damages INTEGER NOT NULL DEFAULT 0,          -- số ốc bị hỏng/mất
    wrong_deliveries INTEGER NOT NULL DEFAULT 0,       -- giao sai địa chỉ/khách
    customer_complaints INTEGER NOT NULL DEFAULT 0,    -- khiếu nại từ khách
    safety_violations INTEGER NOT NULL DEFAULT 0,      -- vi phạm ATGT
    
    -- Điểm thô tính từ công thức
    raw_score NUMERIC(8,2) NOT NULL DEFAULT 0,         -- điểm thô (0-100+)
    normalized_score NUMERIC(5,2) NOT NULL DEFAULT 0,  -- điểm chuẩn hóa (0-100)
    
    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_driver_scorecards_date CHECK (period_date >= '2025-01-01'),
    CONSTRAINT chk_driver_scorecards_score CHECK (normalized_score >= 0 AND normalized_score <= 100),
    CONSTRAINT unq_driver_scorecard_period UNIQUE (driver_id, period_type, period_date)
);

CREATE INDEX idx_driver_scorecards_driver ON driver_scorecards (driver_id, period_date DESC);
CREATE INDEX idx_driver_scorecards_period ON driver_scorecards (period_type, period_date DESC);
CREATE INDEX idx_driver_scorecards_score ON driver_scorecards (driver_id, period_type, normalized_score DESC);

-- ===== DRIVER LEADERBOARD (Bảng xếp hạng) =====
-- Snapshot xếp hạng lái xe theo tuần/tháng/quý
CREATE TABLE IF NOT EXISTS driver_leaderboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,           -- 'weekly', 'monthly', 'quarterly'
    period_start_date DATE NOT NULL,            -- ngày bắt đầu period
    period_end_date DATE NOT NULL,              -- ngày kết thúc period
    
    -- Ranking tại period này
    rank INTEGER NOT NULL,                      -- vị trí xếp hạng (1, 2, 3, ...)
    total_drivers_ranked INTEGER NOT NULL,      -- tổng số lái được xếp hạng
    
    -- Score & Metrics
    avg_score NUMERIC(5,2) NOT NULL,            -- điểm trung bình (từ daily scorecards)
    trips_completed INTEGER NOT NULL DEFAULT 0,
    deliveries_total INTEGER NOT NULL DEFAULT 0,
    success_rate NUMERIC(5,2) NOT NULL DEFAULT 0, -- % thành công
    
    -- Tier/Badge
    tier VARCHAR(20) NOT NULL DEFAULT 'standard', -- 'bronze', 'silver', 'gold', 'platinum'
    
    -- Metadata
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_driver_leaderboards_rank CHECK (rank >= 1),
    CONSTRAINT chk_driver_leaderboards_dates CHECK (period_end_date >= period_start_date),
    CONSTRAINT chk_driver_leaderboards_score CHECK (avg_score >= 0 AND avg_score <= 100),
    CONSTRAINT unq_driver_leaderboard_period UNIQUE (driver_id, period_type, period_start_date)
);

CREATE INDEX idx_driver_leaderboards_rank ON driver_leaderboards (period_type, period_start_date, rank);
CREATE INDEX idx_driver_leaderboards_driver ON driver_leaderboards (driver_id, period_start_date DESC);
CREATE INDEX idx_driver_leaderboards_tier ON driver_leaderboards (tier, period_start_date DESC);

-- ===== VEHICLE HEALTH (Sức khỏe xe) =====
-- Theo dõi tình trạng sức khỏe kỹ thuật xe từ trip reports, maintenance history
CREATE TABLE IF NOT EXISTS vehicle_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    period_date DATE NOT NULL,                  -- ngày đánh giá
    
    -- Health Metrics (0-100)
    engine_health NUMERIC(5,2) NOT NULL DEFAULT 100,           -- từ fuel consumption, oil temp
    transmission_health NUMERIC(5,2) NOT NULL DEFAULT 100,     -- từ shift smoothness, rpm
    tires_health NUMERIC(5,2) NOT NULL DEFAULT 100,            -- từ trip reports, maintenance
    brakes_health NUMERIC(5,2) NOT NULL DEFAULT 100,           -- từ brake reports
    electrical_health NUMERIC(5,2) NOT NULL DEFAULT 100,       -- từ battery, lights
    body_health NUMERIC(5,2) NOT NULL DEFAULT 100,             -- từ accident reports, rust
    interior_cleanliness NUMERIC(5,2) NOT NULL DEFAULT 100,    -- từ visual inspection
    
    -- Maintenance tracking
    days_since_maintenance INTEGER NOT NULL DEFAULT 0,
    maintenance_cost_ytd NUMERIC(15,2) NOT NULL DEFAULT 0,     -- chi phí maintenance năm
    repairs_needed TEXT,                                        -- danh sách sửa cần
    
    -- Overall health score
    overall_health NUMERIC(5,2) NOT NULL DEFAULT 100,          -- avg of all metrics
    status VARCHAR(20) NOT NULL DEFAULT 'good',                -- 'good', 'fair', 'poor', 'critical'
    recommended_action VARCHAR(255),                            -- 'routine_check', 'service_needed', 'retire'
    
    -- Metadata
    last_trip_date DATE,
    odometer_reading INTEGER,                   -- km
    fuel_consumption_ltper100km NUMERIC(6,2),   -- lít/100km từ trip average
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_vehicle_health_scores CHECK (
        engine_health >= 0 AND engine_health <= 100 AND
        transmission_health >= 0 AND transmission_health <= 100 AND
        tires_health >= 0 AND tires_health <= 100 AND
        brakes_health >= 0 AND brakes_health <= 100 AND
        electrical_health >= 0 AND electrical_health <= 100 AND
        body_health >= 0 AND body_health <= 100 AND
        interior_cleanliness >= 0 AND interior_cleanliness <= 100 AND
        overall_health >= 0 AND overall_health <= 100
    ),
    CONSTRAINT chk_vehicle_health_date CHECK (period_date >= '2025-01-01'),
    CONSTRAINT unq_vehicle_health_period UNIQUE (vehicle_id, period_date)
);

CREATE INDEX idx_vehicle_health_vehicle ON vehicle_health (vehicle_id, period_date DESC);
CREATE INDEX idx_vehicle_health_status ON vehicle_health (status, period_date DESC);
CREATE INDEX idx_vehicle_health_health ON vehicle_health (vehicle_id, overall_health, period_date DESC);

-- ===== VEHICLE TCO (Total Cost of Ownership - Chi phí tổng hợp sở hữu) =====
-- Theo dõi chi phí vận hành xe: fuel, maintenance, insurance, depreciation, etc.
CREATE TABLE IF NOT EXISTS vehicle_tco (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    period_type VARCHAR(20) NOT NULL,           -- 'daily', 'weekly', 'monthly'
    period_date DATE NOT NULL,                  -- ngày cuối của period
    
    -- Operating costs (chi phí vận hành)
    fuel_cost NUMERIC(15,2) NOT NULL DEFAULT 0,         -- chi phí xăng dầu
    maintenance_cost NUMERIC(15,2) NOT NULL DEFAULT 0,  -- sửa chữa, bảo dưỡng
    tire_replacement_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    lubricant_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    parts_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    labor_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Fixed costs (chi phí cố định)
    insurance_cost NUMERIC(15,2) NOT NULL DEFAULT 0,    -- bảo hiểm
    registration_fee NUMERIC(15,2) NOT NULL DEFAULT 0,  -- đăng ký
    parking_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
    toll_fee NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Depreciation & Finance
    depreciation_cost NUMERIC(15,2) NOT NULL DEFAULT 0, -- khấu hao (monthly)
    financing_cost NUMERIC(15,2) NOT NULL DEFAULT 0,    -- lãi suất (nếu có)
    
    -- Usage metrics
    distance_km INTEGER NOT NULL DEFAULT 0,              -- quãng đường tháng
    trips_count INTEGER NOT NULL DEFAULT 0,              -- số chuyến
    fuel_liters NUMERIC(10,2) NOT NULL DEFAULT 0,        -- số lít xăng tiêu thụ
    fuel_cost_per_km NUMERIC(8,4) NOT NULL DEFAULT 0,    -- VND/km
    total_cost_per_km NUMERIC(8,4) NOT NULL DEFAULT 0,   -- VND/km (toàn bộ chi phí)
    
    -- Summary
    total_cost NUMERIC(15,2) NOT NULL DEFAULT 0,         -- tổng chi phí
    cost_vs_revenue_ratio NUMERIC(5,2) NOT NULL DEFAULT 0, -- % (cost/revenue)
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_vehicle_tco_date CHECK (period_date >= '2025-01-01'),
    CONSTRAINT chk_vehicle_tco_cost CHECK (total_cost >= 0),
    CONSTRAINT unq_vehicle_tco_period UNIQUE (vehicle_id, period_type, period_date)
);

CREATE INDEX idx_vehicle_tco_vehicle ON vehicle_tco (vehicle_id, period_date DESC);
CREATE INDEX idx_vehicle_tco_cost_per_km ON vehicle_tco (vehicle_id, period_type, total_cost_per_km DESC);
CREATE INDEX idx_vehicle_tco_period ON vehicle_tco (period_type, period_date DESC);

-- ===== DRIVER-VEHICLE ASSIGNMENT LOG (Lịch gán lái-xe) =====
-- Theo dõi lịch gán lái xe cho từng xe, dựa trên tần suất sử dụng
CREATE TABLE IF NOT EXISTS driver_vehicle_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    vehicle_id UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    
    assignment_date DATE NOT NULL,              -- ngày gán
    unassignment_date DATE,                     -- ngày hủy (NULL = còn hiệu lực)
    reason VARCHAR(100),                        -- 'high_usage', 'promotion', 'maintenance', 'underperformance'
    
    -- Usage stats for this assignment period
    trips_completed INTEGER NOT NULL DEFAULT 0,
    revenue_generated NUMERIC(15,2) NOT NULL DEFAULT 0,
    cost_incurred NUMERIC(15,2) NOT NULL DEFAULT 0,
    avg_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    
    is_active BOOLEAN NOT NULL DEFAULT true,    -- soft delete
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_driver_vehicle_assignments_dates CHECK (unassignment_date IS NULL OR unassignment_date >= assignment_date),
    CONSTRAINT unq_driver_vehicle_assignment UNIQUE (driver_id, vehicle_id, assignment_date)
);

CREATE INDEX idx_driver_vehicle_assignments_driver ON driver_vehicle_assignments (driver_id, assignment_date DESC);
CREATE INDEX idx_driver_vehicle_assignments_vehicle ON driver_vehicle_assignments (vehicle_id, assignment_date DESC);
CREATE INDEX idx_driver_vehicle_assignments_active ON driver_vehicle_assignments (is_active, assignment_date DESC);

-- ===== COMMENTS =====
COMMENT ON TABLE driver_scorecards IS 'Bảng điểm lái xe tính hàng ngày/tuần/tháng. Raw score từ công thức KPI, normalized score từ so sánh với đội.';
COMMENT ON TABLE driver_leaderboards IS 'Bảng xếp hạng lái xe theo kỳ (tuần/tháng/quý). Dùng để hiển thị leaderboard trên dashboard.';
COMMENT ON TABLE vehicle_health IS 'Sức khỏe kỹ thuật xe, cập nhật sau mỗi trip hoặc hàng ngày. Dùng để dự báo maintenance.';
COMMENT ON TABLE vehicle_tco IS 'Chi phí tổng hợp sở hữu xe (Total Cost of Ownership). Theo dõi chi phí vận hành, bảo hiểm, khấu hao.';
COMMENT ON TABLE driver_vehicle_assignments IS 'Lịch sử gán lái xe cho từng xe. Dùng để phân tích sử dụng xe và hiệu suất lái.';
