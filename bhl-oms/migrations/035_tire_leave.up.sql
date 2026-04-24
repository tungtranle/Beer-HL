-- Migration 035: Tire Sets & Leave Requests
-- US-TMS-34: Tire & Component Lifecycle (Simplified — per bộ lốp, không per serial)
-- US-TMS-39: Driver Leave & Wellbeing (Mini)

-- Leave status enum
DO $$ BEGIN
    CREATE TYPE leave_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Leave type enum
DO $$ BEGIN
    CREATE TYPE leave_type AS ENUM ('annual', 'sick', 'unpaid', 'other');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Tire condition enum
DO $$ BEGIN
    CREATE TYPE tire_condition AS ENUM ('ok', 'worn', 'needs_replacement', 'replaced');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS tire_sets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vehicle_id      UUID            NOT NULL REFERENCES vehicles(id),
    brand           VARCHAR(100)    NOT NULL,
    model           VARCHAR(100),
    size            VARCHAR(50)     NOT NULL,       -- e.g., '295/80R22.5'
    tire_count      INT             NOT NULL DEFAULT 6,
    installed_date  DATE            NOT NULL DEFAULT CURRENT_DATE,
    installed_km    INT             NOT NULL DEFAULT 0,
    purchase_cost   NUMERIC(15,2)   DEFAULT 0,
    condition       tire_condition  NOT NULL DEFAULT 'ok',
    last_rotation_km INT,
    notes           TEXT,
    is_active       BOOLEAN         NOT NULL DEFAULT true,
    created_by      UUID            REFERENCES users(id),
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tire_sets_vehicle ON tire_sets(vehicle_id) WHERE is_active = true;

CREATE TABLE IF NOT EXISTS leave_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id       UUID            NOT NULL REFERENCES drivers(id),
    leave_type      leave_type      NOT NULL DEFAULT 'annual',
    start_date      DATE            NOT NULL,
    end_date        DATE            NOT NULL,
    reason          TEXT,
    status          leave_status    NOT NULL DEFAULT 'pending',
    approved_by     UUID            REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leave_requests_driver ON leave_requests(driver_id, start_date DESC);
CREATE INDEX IF NOT EXISTS idx_leave_requests_pending ON leave_requests(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON leave_requests(start_date, end_date) WHERE status = 'approved';

-- Add emergency contact to drivers
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS annual_leave_days INT NOT NULL DEFAULT 12;
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS used_leave_days INT NOT NULL DEFAULT 0;
