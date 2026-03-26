-- 015: End-of-Day (Kết ca) 3-station checkpoint system
-- Supports: W-TX-11→15, W-WH-06, W-KT-07, W-DT-01

-- EOD Session: one per trip, tracks overall kết ca progress
CREATE TABLE IF NOT EXISTS eod_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    -- status: in_progress, completed, cancelled

    -- Summary data (snapshot at time of kết ca start)
    total_stops_delivered INT NOT NULL DEFAULT 0,
    total_stops_failed INT NOT NULL DEFAULT 0,
    total_cash_collected NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_transfer_collected NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_credit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_eod_sessions_trip UNIQUE (trip_id)
);

-- EOD Checkpoint: one per station per session
CREATE TABLE IF NOT EXISTS eod_checkpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES eod_sessions(id),
    trip_id UUID NOT NULL REFERENCES trips(id),
    checkpoint_type VARCHAR(30) NOT NULL,
    -- checkpoint_type: container_return, cash_handover, vehicle_return
    checkpoint_order INT NOT NULL,
    -- 1 = container_return, 2 = cash_handover, 3 = vehicle_return

    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- status: pending, submitted, confirmed, rejected

    -- Driver submission data
    driver_data JSONB,
    submitted_at TIMESTAMPTZ,

    -- Receiver confirmation data
    receiver_id UUID REFERENCES users(id),
    receiver_name VARCHAR(200),
    receiver_data JSONB,
    discrepancy_reason TEXT,
    signature_url TEXT,
    confirmed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    reject_reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_eod_checkpoint UNIQUE (session_id, checkpoint_type)
);

CREATE INDEX IF NOT EXISTS idx_eod_sessions_trip ON eod_sessions(trip_id);
CREATE INDEX IF NOT EXISTS idx_eod_sessions_driver ON eod_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_eod_sessions_status ON eod_sessions(status);
CREATE INDEX IF NOT EXISTS idx_eod_checkpoints_session ON eod_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_eod_checkpoints_trip ON eod_checkpoints(trip_id);
CREATE INDEX IF NOT EXISTS idx_eod_checkpoints_status ON eod_checkpoints(status);
