-- Migration 008: Audit log table (Task 3.20)

CREATE TABLE IF NOT EXISTS audit_logs (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID REFERENCES users(id),
    username    VARCHAR(50),
    method      VARCHAR(10) NOT NULL,
    path        VARCHAR(500) NOT NULL,
    status_code INTEGER NOT NULL,
    duration_ms INTEGER NOT NULL,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    request_body TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_date ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_path ON audit_logs(path, created_at DESC);
