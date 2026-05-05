-- Migration 012 DOWN: Rollback Driver Performance Tracking

DROP TABLE IF EXISTS driver_vehicle_assignments;
DROP TABLE IF EXISTS vehicle_tco;
DROP TABLE IF EXISTS vehicle_health;
DROP TABLE IF EXISTS driver_leaderboards;
DROP TABLE IF EXISTS driver_scorecards;
