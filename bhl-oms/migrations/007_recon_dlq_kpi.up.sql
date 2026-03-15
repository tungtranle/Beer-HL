-- Migration 007: Reconciliation, Integration DLQ, Notifications, KPI snapshots
-- Supports Tasks 3.8 (DLQ), 3.9-3.11 (Reconciliation), 3.14 (Notifications), 3.15-3.17 (KPI)

-- =============================================
-- 1. INTEGRATION DLQ (Dead Letter Queue) — Task 3.8
-- =============================================
CREATE TYPE dlq_status AS ENUM ('pending', 'retrying', 'resolved', 'failed');

CREATE TABLE integration_dlq (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    adapter VARCHAR(30) NOT NULL,          -- bravo, dms, zalo
    operation VARCHAR(60) NOT NULL,        -- push_document, sync_order, send_zns, etc.
    payload JSONB NOT NULL DEFAULT '{}',
    error_message TEXT NOT NULL DEFAULT '',
    retry_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    status dlq_status NOT NULL DEFAULT 'pending',
    reference_type VARCHAR(30),            -- order, trip, stop, etc.
    reference_id UUID,
    resolved_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dlq_status ON integration_dlq(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_dlq_adapter ON integration_dlq(adapter, created_at DESC);
CREATE INDEX idx_dlq_reference ON integration_dlq(reference_type, reference_id);

-- =============================================
-- 2. RECONCILIATION — Tasks 3.9, 3.10, 3.11
-- =============================================
CREATE TYPE recon_status AS ENUM ('pending', 'matched', 'discrepancy', 'resolved', 'closed');
CREATE TYPE recon_type AS ENUM ('goods', 'payment', 'asset');
CREATE TYPE discrepancy_status AS ENUM ('open', 'investigating', 'resolved', 'escalated', 'closed');

-- Trip-level reconciliation record
CREATE TABLE reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    recon_type recon_type NOT NULL,
    status recon_status NOT NULL DEFAULT 'pending',
    expected_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    variance NUMERIC(15,2) NOT NULL DEFAULT 0,
    details JSONB NOT NULL DEFAULT '{}',
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(trip_id, recon_type)
);

CREATE INDEX idx_recon_trip ON reconciliations(trip_id);
CREATE INDEX idx_recon_status ON reconciliations(status) WHERE status NOT IN ('closed');

-- Discrepancy tickets
CREATE TABLE discrepancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recon_id UUID NOT NULL REFERENCES reconciliations(id),
    trip_id UUID NOT NULL REFERENCES trips(id),
    stop_id UUID REFERENCES trip_stops(id),
    disc_type recon_type NOT NULL,
    status discrepancy_status NOT NULL DEFAULT 'open',
    description TEXT NOT NULL DEFAULT '',
    expected_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    actual_value NUMERIC(15,2) NOT NULL DEFAULT 0,
    variance NUMERIC(15,2) NOT NULL DEFAULT 0,
    resolution TEXT,
    assigned_to UUID REFERENCES users(id),
    deadline TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_disc_recon ON discrepancies(recon_id);
CREATE INDEX idx_disc_status ON discrepancies(status) WHERE status NOT IN ('closed');
CREATE INDEX idx_disc_trip ON discrepancies(trip_id);

-- Daily close summary
CREATE TABLE daily_close_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    close_date DATE NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    total_trips INT NOT NULL DEFAULT 0,
    completed_trips INT NOT NULL DEFAULT 0,
    total_stops INT NOT NULL DEFAULT 0,
    delivered_stops INT NOT NULL DEFAULT 0,
    failed_stops INT NOT NULL DEFAULT 0,
    total_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_collected NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_outstanding NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_returns_good INT NOT NULL DEFAULT 0,
    total_returns_damaged INT NOT NULL DEFAULT 0,
    total_discrepancies INT NOT NULL DEFAULT 0,
    resolved_discrepancies INT NOT NULL DEFAULT 0,
    summary JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(close_date, warehouse_id)
);

CREATE INDEX idx_daily_close_date ON daily_close_summaries(close_date DESC);

-- =============================================
-- 3. NOTIFICATIONS — Task 3.14
-- =============================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    category VARCHAR(30) NOT NULL DEFAULT 'info',  -- info, warning, error, success
    link VARCHAR(500),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_user_unread ON notifications(user_id, created_at DESC) WHERE is_read = FALSE;
CREATE INDEX idx_notif_user ON notifications(user_id, created_at DESC);

-- =============================================
-- 4. DAILY KPI SNAPSHOTS — Tasks 3.15, 3.16, 3.17
-- =============================================
CREATE TABLE daily_kpi_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date DATE NOT NULL,
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    -- Delivery KPIs
    otd_rate NUMERIC(5,2) NOT NULL DEFAULT 0,            -- On-time delivery %
    delivery_success_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_orders INT NOT NULL DEFAULT 0,
    delivered_orders INT NOT NULL DEFAULT 0,
    failed_orders INT NOT NULL DEFAULT 0,
    -- Vehicle KPIs
    avg_vehicle_utilization NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_trips INT NOT NULL DEFAULT 0,
    total_distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
    -- Financial KPIs
    total_revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_collected NUMERIC(15,2) NOT NULL DEFAULT 0,
    outstanding_receivable NUMERIC(15,2) NOT NULL DEFAULT 0,
    -- Reconciliation KPIs
    recon_match_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
    total_discrepancies INT NOT NULL DEFAULT 0,
    -- Raw data for drill-down
    details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(snapshot_date, warehouse_id)
);

CREATE INDEX idx_kpi_date ON daily_kpi_snapshots(snapshot_date DESC);
CREATE INDEX idx_kpi_warehouse ON daily_kpi_snapshots(warehouse_id, snapshot_date DESC);
