-- Rollback migration 050
DROP TABLE IF EXISTS notification_preferences;

DROP INDEX IF EXISTS idx_notif_expires;
DROP INDEX IF EXISTS idx_notif_urgent_unack;
DROP INDEX IF EXISTS unq_notif_idempotency;

ALTER TABLE notifications
  DROP COLUMN IF EXISTS escalated_to_user_id,
  DROP COLUMN IF EXISTS escalated_at,
  DROP COLUMN IF EXISTS expires_at,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS resolved_at,
  DROP COLUMN IF EXISTS acknowledged_at,
  DROP COLUMN IF EXISTS is_acknowledged;
