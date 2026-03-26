-- Migration 019 DOWN: Rollback BRD Gap tables

DROP TABLE IF EXISTS vehicle_maintenance_records;
DROP TABLE IF EXISTS vehicle_maintenance_schedules;
DROP TABLE IF EXISTS delivery_window_configs;
DROP TABLE IF EXISTS forbidden_load_hours;
DROP TABLE IF EXISTS asset_compensation_prices;
