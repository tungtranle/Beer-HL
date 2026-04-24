-- Migration 032: Fuel Logs & Anomaly Detection
-- US-TMS-33: Fuel Management + Anomaly Detection

-- Fuel channel enum
DO $$ BEGIN
    CREATE TYPE fuel_channel AS ENUM ('app', 'web', 'fleet_card');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Fuel anomaly status
DO $$ BEGIN
    CREATE TYPE fuel_anomaly_status AS ENUM ('pending', 'explained', 'escalated', 'dismissed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS fuel_logs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id          UUID            NOT NULL REFERENCES vehicles(id),
    driver_id           UUID            NOT NULL REFERENCES drivers(id),
    log_date            DATE            NOT NULL DEFAULT CURRENT_DATE,
    km_odometer         INT             NOT NULL,
    liters_filled       NUMERIC(8,2)    NOT NULL,
    amount_vnd          NUMERIC(15,2)   NOT NULL DEFAULT 0,
    fuel_type           VARCHAR(20)     DEFAULT 'diesel',
    station_name        VARCHAR(200),
    invoice_photo_url   TEXT,
    channel             fuel_channel    NOT NULL DEFAULT 'app',
    -- Anomaly detection results (filled by backend)
    expected_liters     NUMERIC(8,2),
    anomaly_ratio       NUMERIC(5,3),   -- |actual-expected|/expected
    anomaly_flag        BOOLEAN         NOT NULL DEFAULT false,
    created_by          UUID            NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_logs_vehicle ON fuel_logs(vehicle_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_driver ON fuel_logs(driver_id, log_date DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_logs_anomaly ON fuel_logs(anomaly_flag) WHERE anomaly_flag = true;

CREATE TABLE IF NOT EXISTS fuel_anomalies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fuel_log_id         UUID            NOT NULL REFERENCES fuel_logs(id),
    vehicle_id          UUID            NOT NULL REFERENCES vehicles(id),
    driver_id           UUID            NOT NULL REFERENCES drivers(id),
    expected_liters     NUMERIC(8,2)    NOT NULL,
    actual_liters       NUMERIC(8,2)    NOT NULL,
    anomaly_ratio       NUMERIC(5,3)    NOT NULL,
    status              fuel_anomaly_status NOT NULL DEFAULT 'pending',
    explanation_text    TEXT,
    reviewer_id         UUID            REFERENCES users(id),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_anomalies_status ON fuel_anomalies(status) WHERE status = 'pending';

-- Fuel consumption rates seed data (per vehicle type)
CREATE TABLE IF NOT EXISTS fuel_consumption_rates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_type    VARCHAR(50)     NOT NULL UNIQUE,
    base_rate       NUMERIC(5,2)    NOT NULL, -- L/100km
    urban_factor    NUMERIC(4,2)    NOT NULL DEFAULT 1.15,
    highway_factor  NUMERIC(4,2)    NOT NULL DEFAULT 1.00,
    mountain_factor NUMERIC(4,2)    NOT NULL DEFAULT 1.30,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Seed consumption rates for BHL fleet
INSERT INTO fuel_consumption_rates (vehicle_type, base_rate, urban_factor, highway_factor, mountain_factor) VALUES
    ('2.5T', 11.0, 1.15, 1.00, 1.30),
    ('3.5T', 13.0, 1.15, 1.00, 1.30),
    ('5T',   14.5, 1.15, 1.00, 1.30),
    ('8T',   20.0, 1.15, 1.00, 1.30),
    ('10T',  23.0, 1.15, 1.00, 1.30),
    ('16T',  27.5, 1.15, 1.00, 1.30)
ON CONFLICT (vehicle_type) DO NOTHING;
