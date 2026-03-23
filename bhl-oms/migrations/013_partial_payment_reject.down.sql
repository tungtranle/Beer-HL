-- 013 down: Remove reject fields from ePOD
-- Note: Cannot remove enum values in PostgreSQL, partial stays in payment_method
ALTER TABLE epod DROP COLUMN IF EXISTS reject_reason;
ALTER TABLE epod DROP COLUMN IF EXISTS reject_detail;
ALTER TABLE epod DROP COLUMN IF EXISTS reject_photos;
