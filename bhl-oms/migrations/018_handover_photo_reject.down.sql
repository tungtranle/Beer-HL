ALTER TABLE handover_records
  DROP COLUMN IF EXISTS photo_urls,
  DROP COLUMN IF EXISTS reject_reason,
  DROP COLUMN IF EXISTS items;
