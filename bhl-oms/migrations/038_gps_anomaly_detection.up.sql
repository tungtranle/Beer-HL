-- Migration 038: GPS Anomaly Detection (F7)
-- Stores detected anomalies + dispatcher acknowledgments.

CREATE TABLE IF NOT EXISTS gps_anomalies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
    trip_id         UUID REFERENCES trips(id) ON DELETE SET NULL,
    driver_id       UUID REFERENCES drivers(id) ON DELETE SET NULL,
    anomaly_type    TEXT NOT NULL CHECK (anomaly_type IN ('deviation', 'stop_overdue', 'speed_high', 'off_route')),
    severity        TEXT NOT NULL CHECK (severity IN ('P0', 'P1', 'P2')),
    -- Geolocation context
    lat             DOUBLE PRECISION NOT NULL,
    lng             DOUBLE PRECISION NOT NULL,
    distance_km     DOUBLE PRECISION,            -- for deviation: km from nearest planned stop
    duration_min    DOUBLE PRECISION,            -- for stop_overdue: minutes stopped
    speed_kmh       DOUBLE PRECISION,
    -- Description
    description     TEXT NOT NULL,
    detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Dispatcher actions
    status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved', 'false_positive')),
    acknowledged_by UUID REFERENCES users(id) ON DELETE SET NULL,
    acknowledged_at TIMESTAMPTZ,
    resolved_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at     TIMESTAMPTZ,
    resolution_note TEXT,
    -- Notification tracking
    zalo_sent       BOOLEAN NOT NULL DEFAULT FALSE,
    zalo_sent_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gps_anomalies_vehicle_status   ON gps_anomalies(vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_gps_anomalies_trip             ON gps_anomalies(trip_id);
CREATE INDEX IF NOT EXISTS idx_gps_anomalies_status_detected  ON gps_anomalies(status, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_anomalies_severity_open    ON gps_anomalies(severity, detected_at DESC) WHERE status = 'open';

-- Baseline thresholds (data-driven from gps_anomalies_baseline.csv).
-- Initially seeded with hardcoded thresholds; cron job can refresh from CSV.
CREATE TABLE IF NOT EXISTS ml_features.gps_anomaly_thresholds (
    rule_name         TEXT PRIMARY KEY,
    threshold_value   DOUBLE PRECISION NOT NULL,
    severity          TEXT NOT NULL,
    description       TEXT,
    refreshed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default thresholds (per UX_AUDIT §F7 + WORLDCLASS_EXECUTION_PLAN W3)
INSERT INTO ml_features.gps_anomaly_thresholds (rule_name, threshold_value, severity, description) VALUES
    ('deviation_km',      2.0,  'P1', 'Khoảng cách (km) tối đa từ điểm dừng gần nhất theo kế hoạch'),
    ('stop_overdue_min',  20.0, 'P0', 'Thời gian (phút) đứng yên ngoài kế hoạch'),
    ('speed_high_kmh',    90.0, 'P2', 'Vận tốc tối đa (km/h) cho xe tải BHL'),
    ('arrival_radius_m',  200.0,'P2', 'Bán kính (m) coi là đã đến điểm dừng kế hoạch')
ON CONFLICT (rule_name) DO NOTHING;
