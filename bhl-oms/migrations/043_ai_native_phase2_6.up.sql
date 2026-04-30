-- Migration 043: AI-native Phase 2-6 foundation
-- Privacy audit, inbox, simulation snapshots, feedback/trust loop.

CREATE TABLE IF NOT EXISTS ai_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    feature_key TEXT NOT NULL,
    action_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    route TEXT NOT NULL CHECK (route IN ('cloud', 'local', 'rules', 'blocked')),
    model TEXT,
    sensitivity TEXT NOT NULL DEFAULT 'low',
    confidence NUMERIC(5,2) NOT NULL DEFAULT 1.00,
    request_hash TEXT NOT NULL,
    redacted BOOLEAN NOT NULL DEFAULT false,
    latency_ms INTEGER NOT NULL DEFAULT 0,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    user_id UUID REFERENCES users(id),
    role TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_audit_log_created ON ai_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_audit_log_feature ON ai_audit_log(feature_key, action_type, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_inbox_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    role TEXT,
    item_type TEXT NOT NULL,
    priority TEXT NOT NULL CHECK (priority IN ('P0', 'P1', 'P2', 'P3')),
    title TEXT NOT NULL,
    detail TEXT,
    ai_suggestion JSONB NOT NULL DEFAULT '{}',
    group_key TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'snoozed', 'done', 'dismissed')),
    snoozed_until TIMESTAMPTZ,
    snooze_reason TEXT,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_inbox_user_status ON ai_inbox_items(user_id, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_role_status ON ai_inbox_items(role, status, priority, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_inbox_group ON ai_inbox_items(group_key) WHERE group_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS ai_simulations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    simulation_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready' CHECK (status IN ('queued', 'running', 'ready', 'expired', 'failed', 'applied')),
    context JSONB NOT NULL DEFAULT '{}',
    options JSONB NOT NULL DEFAULT '[]',
    recommended_option_id TEXT,
    explanation TEXT,
    snapshot_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_at TIMESTAMPTZ,
    applied_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ai_simulations_created ON ai_simulations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_simulations_status ON ai_simulations(status, expires_at);

CREATE TABLE IF NOT EXISTS ai_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID REFERENCES ai_audit_log(id),
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    feedback TEXT NOT NULL CHECK (feedback IN ('correct', 'wrong', 'not_useful', 'other')),
    comment TEXT,
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_source ON ai_feedback(source_type, source_id, created_at DESC);

COMMENT ON TABLE ai_audit_log IS 'Audit trail for AI routing/provider calls. Raw prompt/content is never stored.';
COMMENT ON TABLE ai_inbox_items IS 'AI Inbox action items. Suggestions are enhancements; status changes are auditable.';
COMMENT ON TABLE ai_simulations IS 'Dry-run simulation snapshots. Applying requires revalidation and does not directly mutate core workflow tables.';
COMMENT ON TABLE ai_feedback IS 'User feedback for AI suggestions and trust loop calibration.';