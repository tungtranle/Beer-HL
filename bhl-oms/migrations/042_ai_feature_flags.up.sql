-- Migration 042: AI Feature Flags
-- AI-Native Blueprint v3: progressive enhancement toggle backbone.

CREATE TABLE IF NOT EXISTS ai_feature_flags (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flag_key    TEXT NOT NULL,
    scope_type  TEXT NOT NULL CHECK (scope_type IN ('org', 'role', 'user')),
    scope_id    TEXT NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT false,
    config      JSONB NOT NULL DEFAULT '{}',
    updated_by  UUID REFERENCES users(id),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(flag_key, scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_feature_flags_lookup
    ON ai_feature_flags(flag_key, scope_type, scope_id);

COMMENT ON TABLE ai_feature_flags IS 'AI feature flags with org/role/user scope. Missing flag means disabled.';
COMMENT ON COLUMN ai_feature_flags.flag_key IS 'ai.master, ai.copilot, ai.briefing, ...';
COMMENT ON COLUMN ai_feature_flags.scope_type IS 'org | role | user';
COMMENT ON COLUMN ai_feature_flags.scope_id IS 'default org id, role name, or user uuid string';
