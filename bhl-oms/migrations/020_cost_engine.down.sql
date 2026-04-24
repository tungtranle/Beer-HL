-- Migration 020 DOWN: Remove Cost Engine tables

DROP TABLE IF EXISTS driver_cost_rates;
DROP TABLE IF EXISTS vehicle_cost_profiles;
DROP TABLE IF EXISTS vehicle_type_cost_defaults;
DROP TABLE IF EXISTS toll_expressway_gates;
DROP TABLE IF EXISTS toll_expressways;
DROP TABLE IF EXISTS toll_stations;
