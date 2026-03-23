-- 014: Add note_type and is_pinned to order_notes
-- Supports: §22 note_type fix + §17 PinnedNotes (UX Spec v5)

ALTER TABLE order_notes ADD COLUMN IF NOT EXISTS note_type VARCHAR(20) DEFAULT 'internal';
ALTER TABLE order_notes ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_order_notes_type ON order_notes(note_type);
CREATE INDEX IF NOT EXISTS idx_order_notes_pinned ON order_notes(order_id) WHERE is_pinned = true;
