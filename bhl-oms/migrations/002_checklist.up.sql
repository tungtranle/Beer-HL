-- 002: Vehicle Pre-trip Checklist table
-- Driver must complete checklist before starting a trip

CREATE TABLE IF NOT EXISTS trip_checklists (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id         UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    driver_id       UUID NOT NULL REFERENCES drivers(id),
    vehicle_id      UUID NOT NULL REFERENCES vehicles(id),

    -- Checklist items (boolean)
    tires_ok        BOOLEAN NOT NULL DEFAULT false,
    brakes_ok       BOOLEAN NOT NULL DEFAULT false,
    lights_ok       BOOLEAN NOT NULL DEFAULT false,
    mirrors_ok      BOOLEAN NOT NULL DEFAULT false,
    horn_ok         BOOLEAN NOT NULL DEFAULT false,
    coolant_ok      BOOLEAN NOT NULL DEFAULT false,
    oil_ok          BOOLEAN NOT NULL DEFAULT false,
    fuel_level      INTEGER NOT NULL DEFAULT 0,  -- percentage 0-100
    fire_extinguisher_ok BOOLEAN NOT NULL DEFAULT false,
    first_aid_ok    BOOLEAN NOT NULL DEFAULT false,
    documents_ok    BOOLEAN NOT NULL DEFAULT false,
    cargo_secured   BOOLEAN NOT NULL DEFAULT false,

    -- Overall
    is_passed       BOOLEAN NOT NULL DEFAULT false,
    notes           TEXT,
    checked_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT unq_trip_checklist UNIQUE (trip_id),
    CONSTRAINT chk_fuel_level CHECK (fuel_level >= 0 AND fuel_level <= 100)
);

CREATE INDEX IF NOT EXISTS idx_trip_checklists_trip ON trip_checklists (trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_checklists_driver ON trip_checklists (driver_id, checked_at DESC);
