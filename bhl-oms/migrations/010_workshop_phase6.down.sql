-- Rollback migration 010
DROP TABLE IF EXISTS bottle_classifications;
ALTER TABLE users DROP COLUMN IF EXISTS is_chief_accountant;
