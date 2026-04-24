-- VRP Scenario History: save VRP run results for comparison
CREATE TABLE IF NOT EXISTS vrp_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    delivery_date DATE NOT NULL,
    scenario_name VARCHAR(200) NOT NULL DEFAULT '',
    -- Input snapshot
    vehicle_count INT NOT NULL DEFAULT 0,
    shipment_count INT NOT NULL DEFAULT 0,
    criteria_json JSONB NOT NULL DEFAULT '{}',
    -- Summary results
    total_trips INT NOT NULL DEFAULT 0,
    total_distance_km NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_duration_min INT NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_cost_vnd NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_fuel_cost_vnd NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_toll_cost_vnd NUMERIC(15,2) NOT NULL DEFAULT 0,
    total_driver_cost_vnd NUMERIC(15,2) NOT NULL DEFAULT 0,
    avg_capacity_util_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    avg_cost_per_ton_vnd NUMERIC(15,2) NOT NULL DEFAULT 0,
    avg_cost_per_km_vnd NUMERIC(15,2) NOT NULL DEFAULT 0,
    avg_cost_per_shipment_vnd NUMERIC(15,2) NOT NULL DEFAULT 0,
    toll_cost_ratio_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    unassigned_count INT NOT NULL DEFAULT 0,
    solve_time_ms INT NOT NULL DEFAULT 0,
    -- Service level = assigned / (assigned + unassigned) * 100
    service_level_pct NUMERIC(5,2) NOT NULL DEFAULT 100,
    -- Full result JSON (for re-loading into UI)
    result_json JSONB,
    -- Metadata
    is_approved BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    notes TEXT
);

CREATE INDEX idx_vrp_scenarios_warehouse_date ON vrp_scenarios(warehouse_id, delivery_date);
