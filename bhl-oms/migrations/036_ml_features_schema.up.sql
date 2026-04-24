-- Migration 036: ML Features Schema (World-Class Strategy Sprint 0)
-- Mục đích: tạo schema riêng `ml_features.*` lưu enriched data từ D:\Xu ly Data cho BHL\output\enriched
-- Nguyên tắc: KHÔNG ghi đè bảng Core (customers, vehicles, drivers). KHÔNG dùng làm OLTP.
-- Đọc kèm: docs/specs/DATA_DICTIONARY.md

-- ============================================================
-- 1. SCHEMA NAMESPACE
-- ============================================================
CREATE SCHEMA IF NOT EXISTS ml_features;
COMMENT ON SCHEMA ml_features IS 'Read-only ML/analytics features derived from historical LENH (2022-2023) + GPS (2024). See docs/specs/DATA_DICTIONARY.md';

-- ============================================================
-- 2. NPP HEALTH SCORES (RFM segmentation)
-- Source: D:\Xu ly Data cho BHL\output\enriched\npp_health_scores.csv
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.npp_health_scores (
    npp_code              TEXT PRIMARY KEY,
    ten_npp_chuan         TEXT NOT NULL,
    ten_npp_raw           TEXT,
    tinh                  TEXT,
    lat                   NUMERIC(9,6),
    lon                   NUMERIC(9,6),

    -- RFM raw
    recency_days          INTEGER NOT NULL,
    frequency_orders      INTEGER NOT NULL,
    monetary_units        NUMERIC(15,2) NOT NULL,
    last_order            DATE,
    first_order           DATE,
    n_skus                INTEGER,

    -- RFM scores (1-5 scale)
    r_score               NUMERIC(3,1),
    f_score               NUMERIC(3,1),
    m_score               NUMERIC(3,1),
    rfm_total             NUMERIC(4,1),

    -- Derived
    health_score_0_100    NUMERIC(5,2) NOT NULL,
    segment               TEXT NOT NULL,         -- Champion, Loyal, At Risk, Lost, ...
    risk_band             TEXT NOT NULL CHECK (risk_band IN ('GREEN','YELLOW','RED')),

    -- Revenue (optional fields from raw)
    doanh_thu_2022        NUMERIC(15,2),
    doanh_thu_2023        TEXT,                  -- raw có cell text "Hải Dương" lẫn — giữ TEXT để tolerant import

    -- Metadata
    cutoff_date           DATE NOT NULL DEFAULT '2023-12-31',
    refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_npp_health_segment    ON ml_features.npp_health_scores (segment);
CREATE INDEX IF NOT EXISTS idx_ml_npp_health_risk_band  ON ml_features.npp_health_scores (risk_band);
CREATE INDEX IF NOT EXISTS idx_ml_npp_health_tinh       ON ml_features.npp_health_scores (tinh);

COMMENT ON TABLE ml_features.npp_health_scores IS 'NPP RFM health scores. Cutoff 2023-12-31. Refresh nightly via pg_cron in Sprint 1.';

-- ============================================================
-- 3. SKU FORECASTABILITY (Prophet/Croston routing)
-- Source: sku_forecastability.csv
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.sku_forecastability (
    sku_chuan             TEXT PRIMARY KEY,
    n_active_days         INTEGER NOT NULL,
    total_qty             NUMERIC(15,2) NOT NULL,
    first_seen            DATE,
    last_seen             DATE,
    forecast_method       TEXT NOT NULL CHECK (forecast_method IN ('Prophet (good)','Croston (intermittent)','Naive (rare)')),
    tet_share             NUMERIC(5,4),
    is_tet_only           BOOLEAN NOT NULL DEFAULT FALSE,
    refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_sku_method ON ml_features.sku_forecastability (forecast_method);

COMMENT ON TABLE ml_features.sku_forecastability IS 'Routing table: which SKU uses which forecast method in F1 Demand Intelligence.';

-- ============================================================
-- 4. BASKET RULES (Apriori output for F3 Smart Suggestions)
-- Source: basket_rules.csv
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.basket_rules (
    id                    BIGSERIAL PRIMARY KEY,
    antecedent            TEXT NOT NULL,
    consequent            TEXT NOT NULL,
    pair_count            INTEGER NOT NULL,
    antecedent_count      INTEGER NOT NULL,
    support               NUMERIC(6,4) NOT NULL,
    confidence            NUMERIC(6,4) NOT NULL,
    lift                  NUMERIC(8,4) NOT NULL,
    refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (antecedent, consequent)
);

CREATE INDEX IF NOT EXISTS idx_ml_basket_antecedent  ON ml_features.basket_rules (antecedent);
CREATE INDEX IF NOT EXISTS idx_ml_basket_confidence  ON ml_features.basket_rules (confidence DESC);

COMMENT ON TABLE ml_features.basket_rules IS 'Apriori rules. F3 SKU Suggestions filters confidence >= 0.60 + lift >= 1.20.';

-- ============================================================
-- 5. DRIVER KPI BASELINE (LENH 2022 + payroll)
-- Source: driver_kpi_baseline.csv
-- WARNING: NĐ13 personal data. NOT linked to users table until consent flow done.
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.driver_baseline_2022 (
    id                          BIGSERIAL PRIMARY KEY,
    ho_ten                      TEXT NOT NULL,
    ten_goi                     TEXT,
    so_ngay_lam_viec_2022       INTEGER,
    tong_luong_2022_vnd         NUMERIC(15,2),
    loai_xe                     TEXT,
    tong_so_chuyen_5y           INTEGER,
    so_xe_khac_nhau             INTEGER,
    xe_lai_thuong_xuyen_nhat    TEXT,
    so_ngay_xe_top1             INTEGER,
    top3_xe                     TEXT,
    n_trips                     INTEGER,
    n_dates                     INTEGER,
    n_plates                    INTEGER,
    avg_stops                   NUMERIC(6,2),
    sum_lines                   NUMERIC(15,2),
    sum_qty                     NUMERIC(15,2),
    trips_per_day               NUMERIC(6,2),
    kpi_efficiency_0_100        NUMERIC(5,2) NOT NULL,
    refreshed_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (ho_ten)
);

CREATE INDEX IF NOT EXISTS idx_ml_driver_kpi ON ml_features.driver_baseline_2022 (kpi_efficiency_0_100 DESC);

COMMENT ON TABLE ml_features.driver_baseline_2022 IS 'Driver KPI baseline 2022. NĐ13: NOT exposed to UI until EC-06 consent flow done.';

-- ============================================================
-- 6. TRAVEL TIME MATRIX (GPS 2024 derived)
-- Source: travel_time_matrix.csv
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.travel_time_matrix (
    id                    BIGSERIAL PRIMARY KEY,
    origin_node           TEXT NOT NULL,
    dest_node             TEXT NOT NULL,
    time_bucket           TEXT NOT NULL CHECK (time_bucket IN ('morning_peak','midday','evening_peak','night')),
    travel_seconds        INTEGER NOT NULL,
    distance_m            INTEGER,
    n_observations        INTEGER NOT NULL DEFAULT 0,
    refreshed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (origin_node, dest_node, time_bucket)
);

CREATE INDEX IF NOT EXISTS idx_ml_ttm_lookup ON ml_features.travel_time_matrix (origin_node, dest_node, time_bucket);

COMMENT ON TABLE ml_features.travel_time_matrix IS 'GPS-calibrated travel times for F4 VRP. Fallback to OSRM if pair not found.';

-- ============================================================
-- 7. DEMAND FORECAST OUTPUT (F1 + H9 Feedback Loop)
-- Populated by ML service (FastAPI :8091) in Sprint 2
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.demand_forecast (
    id                    BIGSERIAL PRIMARY KEY,
    sku_chuan             TEXT NOT NULL,
    npp_code              TEXT,                       -- NULL = warehouse-level forecast
    warehouse_code        TEXT,                       -- 'HD' or 'CB'
    forecast_date         DATE NOT NULL,
    qty_pred              NUMERIC(15,2) NOT NULL,
    qty_lower             NUMERIC(15,2),
    qty_upper             NUMERIC(15,2),
    model_method          TEXT NOT NULL,              -- 'prophet' | 'croston' | 'naive'
    confidence            NUMERIC(5,4),
    explanation           TEXT,                       -- F15 Explainability text (Vietnamese)
    generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (sku_chuan, npp_code, warehouse_code, forecast_date, model_method)
);

CREATE INDEX IF NOT EXISTS idx_ml_forecast_lookup ON ml_features.demand_forecast (sku_chuan, forecast_date);
CREATE INDEX IF NOT EXISTS idx_ml_forecast_npp    ON ml_features.demand_forecast (npp_code, forecast_date);

CREATE TABLE IF NOT EXISTS ml_features.forecast_actuals (
    id                    BIGSERIAL PRIMARY KEY,
    forecast_id           BIGINT REFERENCES ml_features.demand_forecast(id) ON DELETE SET NULL,
    sku_chuan             TEXT NOT NULL,
    npp_code              TEXT,
    warehouse_code        TEXT,
    forecast_date         DATE NOT NULL,
    qty_pred              NUMERIC(15,2) NOT NULL,
    qty_actual            NUMERIC(15,2) NOT NULL,
    abs_error             NUMERIC(15,2) GENERATED ALWAYS AS (ABS(qty_pred - qty_actual)) STORED,
    ape                   NUMERIC(8,4),               -- absolute percentage error
    model_method          TEXT NOT NULL,
    recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ml_actuals_sku_date ON ml_features.forecast_actuals (sku_chuan, forecast_date);

COMMENT ON TABLE ml_features.demand_forecast IS 'F1 Demand Intelligence output. Populated by FastAPI ML service.';
COMMENT ON TABLE ml_features.forecast_actuals IS 'H9 Feedback Loop. Weekly cron computes MAPE per (sku, method).';

-- ============================================================
-- 8. NPP CODE MAP (bridge LENH NPP ↔ OMS customers)
-- Empty initially. Populated when BHL confirms which historical NPPs are still active.
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.npp_code_map (
    npp_code              TEXT PRIMARY KEY REFERENCES ml_features.npp_health_scores(npp_code) ON DELETE CASCADE,
    customer_id           UUID,                       -- references customers(id) when mapped
    confidence            TEXT CHECK (confidence IN ('exact','fuzzy','manual')),
    mapped_at             TIMESTAMPTZ DEFAULT NOW(),
    mapped_by             TEXT
);

COMMENT ON TABLE ml_features.npp_code_map IS 'Bridge LENH NPP code to live customers.id. Populated in Sprint 1 when BHL confirms active NPPs.';

-- ============================================================
-- 9. SEED SCENARIOS (test data lock)
-- Source: seed_scenarios.json
-- ============================================================
CREATE TABLE IF NOT EXISTS ml_features.seed_scenarios (
    scenario_code         TEXT PRIMARY KEY,
    label                 TEXT NOT NULL,
    scenario_date         DATE NOT NULL,
    n_npp                 INTEGER,
    n_xe                  INTEGER,
    n_lines               INTEGER,
    n_kho                 INTEGER,
    locked_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ml_features.seed_scenarios (scenario_code, label, scenario_date, n_npp, n_xe, n_lines, n_kho)
VALUES
    ('SC-PEAK', 'Ngày peak — full fleet stress',     '2022-07-27', 79, 21, 308, 2),
    ('SC-LOW',  'Ngày thấp — partial fleet',         '2022-01-31',  1,  0,   3, 1),
    ('SC-DUAL', 'Dual-warehouse high load',          '2022-07-27', 79, 21, 308, 2)
ON CONFLICT (scenario_code) DO UPDATE SET
    label = EXCLUDED.label,
    scenario_date = EXCLUDED.scenario_date,
    n_npp = EXCLUDED.n_npp,
    n_xe = EXCLUDED.n_xe,
    n_lines = EXCLUDED.n_lines,
    n_kho = EXCLUDED.n_kho;

COMMENT ON TABLE ml_features.seed_scenarios IS 'Locked test scenarios for VRP/forecast regression. Numbers from enriched ETL post critique.';
