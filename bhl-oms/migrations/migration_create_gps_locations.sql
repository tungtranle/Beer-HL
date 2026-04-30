-- Migration: Create gps_locations partitioned table
-- Date: 2026-04-28
-- Reason: Support GPS tracking and AI anomaly detection

-- Create base partitioned table
CREATE TABLE gps_locations (
    id              UUID NOT NULL DEFAULT gen_random_uuid(),
    vehicle_id      UUID NOT NULL,
    driver_id       UUID,
    lat             NUMERIC(10,7) NOT NULL,
    lng             NUMERIC(10,7) NOT NULL,
    speed_kmh       NUMERIC(6,1),
    heading         NUMERIC(5,1),                   -- 0-360 degrees
    accuracy_m      NUMERIC(6,1),
    recorded_at     TIMESTAMPTZ NOT NULL,

    PRIMARY KEY (recorded_at, id)
) PARTITION BY RANGE (recorded_at);

-- Create monthly partitions (2024-01 to 2026-06)
CREATE TABLE gps_locations_202401 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
CREATE TABLE gps_locations_202402 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
CREATE TABLE gps_locations_202403 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-03-01') TO ('2024-04-01');
CREATE TABLE gps_locations_202404 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-04-01') TO ('2024-05-01');
CREATE TABLE gps_locations_202405 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-05-01') TO ('2024-06-01');
CREATE TABLE gps_locations_202406 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-06-01') TO ('2024-07-01');
CREATE TABLE gps_locations_202407 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-07-01') TO ('2024-08-01');
CREATE TABLE gps_locations_202408 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-08-01') TO ('2024-09-01');
CREATE TABLE gps_locations_202409 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-09-01') TO ('2024-10-01');
CREATE TABLE gps_locations_202410 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-10-01') TO ('2024-11-01');
CREATE TABLE gps_locations_202411 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-11-01') TO ('2024-12-01');
CREATE TABLE gps_locations_202412 PARTITION OF gps_locations
    FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

CREATE TABLE gps_locations_202501 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE gps_locations_202502 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
CREATE TABLE gps_locations_202503 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');
CREATE TABLE gps_locations_202504 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');
CREATE TABLE gps_locations_202505 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');
CREATE TABLE gps_locations_202506 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');
CREATE TABLE gps_locations_202507 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');
CREATE TABLE gps_locations_202508 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');
CREATE TABLE gps_locations_202509 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');
CREATE TABLE gps_locations_202510 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
CREATE TABLE gps_locations_202511 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');
CREATE TABLE gps_locations_202512 PARTITION OF gps_locations
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE gps_locations_202601 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE gps_locations_202602 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE gps_locations_202603 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');
CREATE TABLE gps_locations_202604 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
CREATE TABLE gps_locations_202605 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');
CREATE TABLE gps_locations_202606 PARTITION OF gps_locations
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Indexes for common queries
CREATE INDEX idx_gps_locations_vehicle_time ON gps_locations (vehicle_id, recorded_at DESC);
CREATE INDEX idx_gps_locations_recorded_at ON gps_locations (recorded_at DESC);
CREATE INDEX idx_gps_locations_speed_anomaly ON gps_locations (speed_kmh) WHERE speed_kmh > 100;

-- Foreign key constraints (soft references, no cascade)
ALTER TABLE gps_locations ADD CONSTRAINT fk_gps_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id);
ALTER TABLE gps_locations ADD CONSTRAINT fk_gps_driver FOREIGN KEY (driver_id) REFERENCES drivers(id);

COMMENT ON TABLE gps_locations IS 'Partitioned GPS location history for vehicles, supports anomaly detection and trip analytics';
