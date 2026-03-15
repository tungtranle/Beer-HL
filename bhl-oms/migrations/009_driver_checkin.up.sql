-- Migration 009: Driver daily check-in / availability

CREATE TABLE IF NOT EXISTS driver_checkins (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id   UUID NOT NULL REFERENCES drivers(id),
    checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status      VARCHAR(20) NOT NULL DEFAULT 'available',  -- available, off_duty
    reason      VARCHAR(100),  -- sick, personal, vehicle_maintenance, other
    note        TEXT,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(driver_id, checkin_date)
);

CREATE INDEX idx_driver_checkins_date ON driver_checkins(checkin_date, driver_id);
CREATE INDEX idx_driver_checkins_driver ON driver_checkins(driver_id, checkin_date DESC);
