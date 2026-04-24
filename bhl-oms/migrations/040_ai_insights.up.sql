-- Migration 040: AI Insights Layer
-- Sprint 2 AI Intelligence: cache LLM responses and NPP risk signals.
-- Tác giả: BHL Engineering, 2025

-- ─── ai_insights: LLM response cache ────────────────────────────────────────
-- Tránh gọi lại Gemini API với cùng 1 entity trong 6 giờ.
-- entity_id = UUID hoặc string (plate, date)
-- insight_type: 'credit_risk' | 'dispatch_brief' | 'exception_explain' | 'npp_zalo_draft'

CREATE TABLE IF NOT EXISTS ai_insights (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    insight_type    TEXT        NOT NULL,
    entity_id       TEXT        NOT NULL DEFAULT '',
    content         TEXT        NOT NULL,
    provider        TEXT        NOT NULL DEFAULT 'rules',
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '6 hours'),
    UNIQUE (insight_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_type_entity ON ai_insights(insight_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_ai_insights_expires ON ai_insights(expires_at);

COMMENT ON TABLE ai_insights IS 'Cache LLM responses to reduce Gemini API calls. TTL 6h default.';
COMMENT ON COLUMN ai_insights.insight_type IS 'credit_risk | dispatch_brief | exception_explain | npp_zalo_draft';
COMMENT ON COLUMN ai_insights.entity_id IS 'UUID hoặc date string của entity (customer_id, anomaly_id, date)';
COMMENT ON COLUMN ai_insights.provider IS 'gemini-2.0-flash | groq-llama-3.1 | rules | mock-rules';

-- ─── ml_features.npp_risk_signals: daily batch risk scores ──────────────────
-- Bảng này được compute_cron() cập nhật mỗi ngày.
-- Giữ lại lịch sử để trending (primary key là (customer_id, computed_at)).

CREATE TABLE IF NOT EXISTS ml_features.npp_risk_signals (
    customer_id     UUID        NOT NULL,
    score           INT         NOT NULL CHECK (score BETWEEN 0 AND 100),
    level           TEXT        NOT NULL CHECK (level IN ('low','medium','high','critical')),
    narrative       TEXT,
    computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_id, computed_at)
);

CREATE INDEX IF NOT EXISTS idx_npp_risk_signals_customer ON ml_features.npp_risk_signals(customer_id, computed_at DESC);

COMMENT ON TABLE ml_features.npp_risk_signals IS 'Daily credit risk scores for all NPPs (batch). Source for Accountant dashboard.';
