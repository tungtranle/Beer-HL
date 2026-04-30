-- Rollback 044
DROP INDEX IF EXISTS unq_bin_locations_wh_code;
DELETE FROM bin_locations
 WHERE warehouse_id IN (SELECT id FROM warehouses WHERE code IN ('WH-HL','WH-HP'));
