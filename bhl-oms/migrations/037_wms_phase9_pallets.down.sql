-- Rollback Migration 037
DROP TABLE IF EXISTS cycle_count_tasks;
DROP TABLE IF EXISTS qr_scan_log;
DROP TABLE IF EXISTS pallets;
DROP TABLE IF EXISTS bin_locations;

DROP TYPE IF EXISTS cycle_count_status;
DROP TYPE IF EXISTS bin_type;
DROP TYPE IF EXISTS pallet_status;
