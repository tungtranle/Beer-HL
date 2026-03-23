-- 013: Add 'partial' to payment_method enum + reject fields on ePOD
-- Fixes: "invalid input value for enum payment_method: partial" (SQLSTATE 22P02)

-- Add 'partial' to payment_method enum
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'partial';

-- Add rejection fields to ePOD for NPP rejection tracking
ALTER TABLE epod ADD COLUMN IF NOT EXISTS reject_reason VARCHAR(50);
ALTER TABLE epod ADD COLUMN IF NOT EXISTS reject_detail TEXT;
ALTER TABLE epod ADD COLUMN IF NOT EXISTS reject_photos TEXT[] DEFAULT '{}';
