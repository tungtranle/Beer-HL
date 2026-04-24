-- Migration 029: Vehicle-Driver Default Mapping (1:1)
-- Each vehicle has a default driver, each driver has a default vehicle

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS default_driver_id UUID REFERENCES drivers(id);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS default_vehicle_id UUID REFERENCES vehicles(id);

-- Unique indexes: 1 driver can only be default for 1 vehicle and vice versa
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicles_default_driver ON vehicles (default_driver_id) WHERE default_driver_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_default_vehicle ON drivers (default_vehicle_id) WHERE default_vehicle_id IS NOT NULL;
