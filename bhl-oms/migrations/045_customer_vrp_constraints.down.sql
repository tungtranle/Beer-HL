ALTER TABLE customers
    DROP COLUMN IF EXISTS max_vehicle_weight_kg,
    DROP COLUMN IF EXISTS delivery_windows,
    DROP COLUMN IF EXISTS forbidden_windows,
    DROP COLUMN IF EXISTS access_notes;
