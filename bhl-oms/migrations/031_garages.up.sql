-- Migration 031: Garages & Ratings
-- US-TMS-36: Vendor/Garage Rating & Management

CREATE TABLE IF NOT EXISTS garages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200)    NOT NULL,
    address         TEXT,
    gps_lat         NUMERIC(10,7),
    gps_lng         NUMERIC(10,7),
    phone           VARCHAR(20),
    specialties     TEXT[]          DEFAULT '{}', -- engine, brake, tyre, body, electrical, ac
    payment_terms   VARCHAR(100),
    opening_hours   VARCHAR(100),
    is_preferred    BOOLEAN         NOT NULL DEFAULT false,
    is_blacklisted  BOOLEAN         NOT NULL DEFAULT false,
    avg_rating      NUMERIC(3,1)   DEFAULT 0,
    total_repairs   INT             DEFAULT 0,
    avg_mttr_hours  NUMERIC(6,1)   DEFAULT 0,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garages_preferred ON garages(is_preferred) WHERE is_preferred = true;

CREATE TABLE IF NOT EXISTS garage_ratings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    garage_id       UUID            NOT NULL REFERENCES garages(id),
    work_order_id   UUID            NOT NULL REFERENCES work_orders(id),
    quality_score   INT             NOT NULL CHECK (quality_score BETWEEN 0 AND 10),
    time_score      INT             NOT NULL CHECK (time_score BETWEEN 0 AND 10),
    cost_vs_quote   NUMERIC(5,2),   -- percentage: actual/quoted * 100
    rework_flag     BOOLEAN         NOT NULL DEFAULT false,
    notes           TEXT,
    rated_by        UUID            NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_garage_ratings_garage ON garage_ratings(garage_id);

-- Add garage FK to work_orders
ALTER TABLE work_orders ADD CONSTRAINT fk_work_orders_garage
    FOREIGN KEY (garage_id) REFERENCES garages(id);
