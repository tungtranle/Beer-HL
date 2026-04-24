-- Rollback migration 029
DROP INDEX IF EXISTS idx_drivers_default_vehicle;
DROP INDEX IF EXISTS idx_vehicles_default_driver;
ALTER TABLE drivers DROP COLUMN IF EXISTS default_vehicle_id;
ALTER TABLE vehicles DROP COLUMN IF EXISTS default_driver_id;
