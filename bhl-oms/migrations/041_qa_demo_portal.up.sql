-- Migration 041: QA demo portal scoped scenario ownership
-- Safe demo data lifecycle: only delete records created by QA demo runs.

CREATE TABLE IF NOT EXISTS qa_scenario_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scenario_id VARCHAR(40) NOT NULL,
    scenario_title VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'completed', 'failed', 'cleaned')),
    cleanup_deleted_count INTEGER NOT NULL DEFAULT 0,
    created_count INTEGER NOT NULL DEFAULT 0,
    historical_rows_touched INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    cleaned_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_by_name VARCHAR(200)
);

CREATE INDEX IF NOT EXISTS idx_qa_scenario_runs_scenario ON qa_scenario_runs (scenario_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_qa_scenario_runs_status ON qa_scenario_runs (status, started_at DESC);

CREATE TABLE IF NOT EXISTS qa_owned_entities (
    run_id UUID NOT NULL REFERENCES qa_scenario_runs(id) ON DELETE CASCADE,
    entity_type VARCHAR(80) NOT NULL,
    entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (run_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_qa_owned_entities_entity ON qa_owned_entities (entity_type, entity_id);

COMMENT ON TABLE qa_scenario_runs IS 'QA Portal scoped scenario runs. Demo/test cleanup must only touch entities registered here.';
COMMENT ON TABLE qa_owned_entities IS 'Ownership registry for QA-created records. Never cleanup business data without matching registry rows.';