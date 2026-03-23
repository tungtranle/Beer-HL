-- 014: Rollback note_type and is_pinned
ALTER TABLE order_notes DROP COLUMN IF EXISTS is_pinned;
ALTER TABLE order_notes DROP COLUMN IF EXISTS note_type;
DROP INDEX IF EXISTS idx_order_notes_type;
DROP INDEX IF EXISTS idx_order_notes_pinned;
