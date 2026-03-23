-- Rollback migration 011
DROP TABLE IF EXISTS order_notes;
DROP TABLE IF EXISTS entity_events;
ALTER TABLE notifications DROP COLUMN IF EXISTS priority;
ALTER TABLE notifications DROP COLUMN IF EXISTS entity_type;
ALTER TABLE notifications DROP COLUMN IF EXISTS entity_id;
