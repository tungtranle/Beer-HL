-- Rollback Migration 036: ML Features Schema
-- WARNING: drops all enriched data; ensure backup if needed before rollback.

DROP TABLE IF EXISTS ml_features.seed_scenarios       CASCADE;
DROP TABLE IF EXISTS ml_features.npp_code_map         CASCADE;
DROP TABLE IF EXISTS ml_features.forecast_actuals     CASCADE;
DROP TABLE IF EXISTS ml_features.demand_forecast      CASCADE;
DROP TABLE IF EXISTS ml_features.travel_time_matrix   CASCADE;
DROP TABLE IF EXISTS ml_features.driver_baseline_2022 CASCADE;
DROP TABLE IF EXISTS ml_features.basket_rules         CASCADE;
DROP TABLE IF EXISTS ml_features.sku_forecastability  CASCADE;
DROP TABLE IF EXISTS ml_features.npp_health_scores    CASCADE;

DROP SCHEMA IF EXISTS ml_features CASCADE;
