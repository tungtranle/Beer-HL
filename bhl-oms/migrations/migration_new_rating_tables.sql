-- Migration: Add driver_ratings and supplier_ratings tables for AI features
-- Timestamp: 2026-04-28
-- Reason: Support AI performance scoring and trust metrics

-- 1. Driver Ratings Table
CREATE TABLE driver_ratings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id           UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    trip_id             UUID REFERENCES trips(id),
    rating_date         DATE NOT NULL,
    
    -- Performance metrics (1-5 scale)
    safety_rating       INTEGER CHECK (safety_rating BETWEEN 1 AND 5),      -- Safe driving, no incidents
    punctuality_rating  INTEGER CHECK (punctuality_rating BETWEEN 1 AND 5), -- On-time delivery
    professionalism_rating INTEGER CHECK (professionalism_rating BETWEEN 1 AND 5), -- Customer interaction
    vehicle_condition_rating INTEGER CHECK (vehicle_condition_rating BETWEEN 1 AND 5), -- Vehicle maintenance
    
    -- Numeric metrics
    on_time_count       INTEGER NOT NULL DEFAULT 0,
    late_count          INTEGER NOT NULL DEFAULT 0,
    customer_complaint_count INTEGER NOT NULL DEFAULT 0,
    incident_count      INTEGER NOT NULL DEFAULT 0,
    
    -- Overall
    overall_score       NUMERIC(5,2),  -- Weighted average (calculated)
    notes               TEXT,
    rated_by            UUID REFERENCES users(id),    -- Manager/dispatcher
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_driver_ratings_date CHECK (rating_date <= CURRENT_DATE)
);

CREATE INDEX idx_driver_ratings_driver ON driver_ratings (driver_id, rating_date DESC);
CREATE INDEX idx_driver_ratings_trip ON driver_ratings (trip_id);
CREATE INDEX idx_driver_ratings_overall ON driver_ratings (overall_score DESC);

-- 2. Supplier (Customer) Ratings Table
CREATE TABLE supplier_ratings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id         UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    order_id            UUID REFERENCES sales_orders(id),
    rating_date         DATE NOT NULL,
    
    -- Performance metrics (1-5 scale)
    payment_reliability_rating INTEGER CHECK (payment_reliability_rating BETWEEN 1 AND 5), -- Pays on time
    order_accuracy_rating INTEGER CHECK (order_accuracy_rating BETWEEN 1 AND 5),  -- Correct orders
    delivery_cooperation_rating INTEGER CHECK (delivery_cooperation_rating BETWEEN 1 AND 5), -- Easy to deliver
    return_rate_rating  INTEGER CHECK (return_rate_rating BETWEEN 1 AND 5),  -- Low returns
    
    -- Numeric metrics
    on_time_payment_count INTEGER NOT NULL DEFAULT 0,
    late_payment_count  INTEGER NOT NULL DEFAULT 0,
    return_count        INTEGER NOT NULL DEFAULT 0,
    total_orders_count  INTEGER NOT NULL DEFAULT 0,
    
    -- Overall
    overall_score       NUMERIC(5,2),  -- Weighted average
    credit_tier         VARCHAR(20),    -- 'gold', 'silver', 'bronze', 'watch'
    notes               TEXT,
    reviewed_by         UUID REFERENCES users(id),    -- Accountant/manager
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT chk_supplier_ratings_date CHECK (rating_date <= CURRENT_DATE)
);

CREATE INDEX idx_supplier_ratings_customer ON supplier_ratings (customer_id, rating_date DESC);
CREATE INDEX idx_supplier_ratings_order ON supplier_ratings (order_id);
CREATE INDEX idx_supplier_ratings_tier ON supplier_ratings (credit_tier);
CREATE INDEX idx_supplier_ratings_overall ON supplier_ratings (overall_score DESC);

-- 3. Vehicle Condition Check (history of pre/post-trip checklist items for audit)
-- This table stores individual checklist items for easy query
CREATE TABLE vehicle_condition_checks (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id             UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    vehicle_id          UUID NOT NULL REFERENCES vehicles(id),
    check_type          VARCHAR(20) NOT NULL CHECK (check_type IN ('pre_trip', 'post_trip')),
    
    -- Check items
    check_item_name     VARCHAR(100) NOT NULL,  -- e.g., 'tire_pressure', 'brake_fluid', 'fuel_level'
    status              VARCHAR(20) NOT NULL CHECK (status IN ('pass', 'fail', 'warning')),
    notes               TEXT,
    photo_url           TEXT,                    -- Optional photo evidence
    
    checked_by          UUID REFERENCES users(id),  -- Driver or mechanic
    checked_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_vehicle_check UNIQUE (trip_id, vehicle_id, check_type, check_item_name)
);

CREATE INDEX idx_vehicle_condition_checks_trip ON vehicle_condition_checks (trip_id, check_type);
CREATE INDEX idx_vehicle_condition_checks_vehicle ON vehicle_condition_checks (vehicle_id, checked_at DESC);
CREATE INDEX idx_vehicle_condition_checks_status ON vehicle_condition_checks (status) WHERE status IN ('fail', 'warning');

COMMENT ON TABLE driver_ratings IS 'AI feature: Track driver performance for anomaly detection and risk scoring';
COMMENT ON TABLE supplier_ratings IS 'AI feature: Track customer payment/order patterns for credit decisions';
COMMENT ON TABLE vehicle_condition_checks IS 'Track vehicle health per trip for maintenance prediction';
