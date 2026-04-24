-- Migration 036b: Align ml_features schema with actual enriched CSV columns.
-- Discovered after first import attempt: column names + check constraints
-- don't match CSV reality. Source-of-truth = CSV from D:\Xu ly Data cho BHL\output\enriched.

-- 1) sku_forecastability: drop check entirely (CSV has multiple variants:
--    'Prophet (good)','Croston intermittent','Prophet (borderline)','Naive (rare)' ...)
--    Treat forecast_method as free text — routing logic in service layer.
ALTER TABLE ml_features.sku_forecastability
  DROP CONSTRAINT IF EXISTS sku_forecastability_forecast_method_check;

-- 2) travel_time_matrix: rename columns to match CSV + add missing fields.
-- Drop old structure (empty) and recreate.
DROP TABLE IF EXISTS ml_features.travel_time_matrix CASCADE;
CREATE TABLE ml_features.travel_time_matrix (
    id              BIGSERIAL PRIMARY KEY,
    start_name      TEXT NOT NULL,
    end_name        TEXT NOT NULL,
    hour_bucket     TEXT NOT NULL,           -- '00-06','06-09','09-12','12-15','15-18','18-24'
    n_obs           INTEGER NOT NULL DEFAULT 0,
    km_avg          NUMERIC(8,2),
    dur_min_avg     NUMERIC(8,2),
    dur_min_p50     NUMERIC(8,2),
    dur_min_p90     NUMERIC(8,2),
    speed_kmh       NUMERIC(6,2),
    refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (start_name, end_name, hour_bucket)
);
CREATE INDEX idx_ml_ttm_lookup ON ml_features.travel_time_matrix (start_name, end_name, hour_bucket);
COMMENT ON TABLE ml_features.travel_time_matrix IS 'GPS-calibrated travel times for F4 VRP (aligned with CSV schema). Fallback to OSRM if pair not found.';

-- 3) npp_health_scores has FK from npp_code_map. Allow CASCADE truncate by re-declaring FK ON DELETE CASCADE
ALTER TABLE ml_features.npp_code_map
  DROP CONSTRAINT IF EXISTS npp_code_map_npp_code_fkey;
-- Recreate FK as deferrable (allow truncate via CASCADE in script)
-- Actually simplest: don't enforce FK during bulk import phase; npp_code_map is itself import data.
-- We keep the column and add lookup index instead.
CREATE INDEX IF NOT EXISTS idx_npp_code_map_lookup ON ml_features.npp_code_map (npp_code);
