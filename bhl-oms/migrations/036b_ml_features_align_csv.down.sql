-- Rollback for 036b: restore original column structure (best-effort).
ALTER TABLE ml_features.sku_forecastability
  DROP CONSTRAINT IF EXISTS sku_forecastability_forecast_method_check;
ALTER TABLE ml_features.sku_forecastability
  ADD CONSTRAINT sku_forecastability_forecast_method_check
  CHECK (forecast_method IN ('Prophet (good)','Croston (intermittent)','Naive (rare)'));

DROP TABLE IF EXISTS ml_features.travel_time_matrix CASCADE;
CREATE TABLE ml_features.travel_time_matrix (
    id BIGSERIAL PRIMARY KEY,
    origin_node TEXT NOT NULL,
    dest_node   TEXT NOT NULL,
    time_bucket TEXT NOT NULL CHECK (time_bucket IN ('morning_peak','midday','evening_peak','night')),
    travel_seconds INTEGER NOT NULL,
    distance_m INTEGER,
    n_observations INTEGER NOT NULL DEFAULT 0,
    refreshed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (origin_node, dest_node, time_bucket)
);
