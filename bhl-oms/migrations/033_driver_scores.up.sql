-- Migration 033: Driver Scores & Snapshots
-- US-TMS-27: Driver AI Safety Scorecard

CREATE TABLE IF NOT EXISTS driver_scores (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID            NOT NULL REFERENCES drivers(id),
    score_date      DATE            NOT NULL,
    total_score     NUMERIC(5,1)    NOT NULL DEFAULT 0,
    otd_score       NUMERIC(5,1)    NOT NULL DEFAULT 0,      -- 30% weight
    delivery_score  NUMERIC(5,1)    NOT NULL DEFAULT 0,      -- 25% weight
    safety_score    NUMERIC(5,1)    NOT NULL DEFAULT 0,      -- 25% (compliance)
    compliance_score NUMERIC(5,1)   NOT NULL DEFAULT 0,      -- 10% (customer)
    customer_score  NUMERIC(5,1)    NOT NULL DEFAULT 0,      -- 10% (speed)
    trips_count     INT             NOT NULL DEFAULT 0,
    stops_count     INT             NOT NULL DEFAULT 0,
    on_time_count   INT             NOT NULL DEFAULT 0,
    delivered_count INT             NOT NULL DEFAULT 0,
    failed_count    INT             NOT NULL DEFAULT 0,
    speed_violations INT            NOT NULL DEFAULT 0,
    checklist_completions INT       NOT NULL DEFAULT 0,
    epod_completions INT            NOT NULL DEFAULT 0,
    model_version   VARCHAR(20)     DEFAULT 'rule_v1',
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE(driver_id, score_date)
);

CREATE INDEX IF NOT EXISTS idx_driver_scores_driver ON driver_scores(driver_id, score_date DESC);

-- Monthly snapshot for trend analysis
CREATE TABLE IF NOT EXISTS driver_score_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID            NOT NULL REFERENCES drivers(id),
    snapshot_month  DATE            NOT NULL, -- first day of month
    avg_total_score NUMERIC(5,1)    NOT NULL DEFAULT 0,
    avg_otd         NUMERIC(5,1)    NOT NULL DEFAULT 0,
    avg_delivery    NUMERIC(5,1)    NOT NULL DEFAULT 0,
    avg_safety      NUMERIC(5,1)    NOT NULL DEFAULT 0,
    avg_compliance  NUMERIC(5,1)    NOT NULL DEFAULT 0,
    avg_customer    NUMERIC(5,1)    NOT NULL DEFAULT 0,
    total_trips     INT             NOT NULL DEFAULT 0,
    total_stops     INT             NOT NULL DEFAULT 0,
    rank_position   INT,
    rank_total      INT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE(driver_id, snapshot_month)
);

-- Add current_score to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS current_score NUMERIC(5,1) DEFAULT 0;
