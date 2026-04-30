-- 050_backfill_hist_notifications.down.sql
-- Remove all backfilled hist notifications (identified by group_key prefix).
BEGIN;
DELETE FROM notifications WHERE group_key LIKE 'hist-bf-%';
COMMIT;
