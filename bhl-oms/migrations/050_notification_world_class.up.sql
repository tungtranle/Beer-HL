-- Migration 050: Notification World-Class — ACK, idempotency, expiry, preferences
-- Phase 1 of BHL_NOTIFICATION_WORLDCLASS.md

-- 1. Extend notifications table
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS is_acknowledged      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS acknowledged_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idempotency_key      TEXT,
  ADD COLUMN IF NOT EXISTS expires_at           TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '90 days'),
  ADD COLUMN IF NOT EXISTS escalated_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS escalated_to_user_id UUID REFERENCES users(id);

-- 2. Idempotency unique index (partial — only when key is set)
CREATE UNIQUE INDEX IF NOT EXISTS unq_notif_idempotency
  ON notifications(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- 3. Escalation cron index: find urgent unACK'd older than threshold
CREATE INDEX IF NOT EXISTS idx_notif_urgent_unack
  ON notifications(created_at)
  WHERE priority = 'urgent'
    AND is_acknowledged = FALSE
    AND resolved_at IS NULL;

-- 4. Expiry cleanup index
CREATE INDEX IF NOT EXISTS idx_notif_expires
  ON notifications(expires_at)
  WHERE resolved_at IS NULL;

-- 5. notification_preferences table (Phase 4 — schema created now, UI later)
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  channel    TEXT NOT NULL CHECK (channel IN ('in_app','push','zalo','sms','digest')),
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, event_type, channel)
);

CREATE INDEX IF NOT EXISTS idx_notif_prefs_user ON notification_preferences(user_id);
