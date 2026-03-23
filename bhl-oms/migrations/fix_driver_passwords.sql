-- Fix driver password hashes (demo123)
-- The correct bcrypt hash for "demo123" is the same as dispatcher01
UPDATE users
SET password_hash = (SELECT password_hash FROM users WHERE username = 'dispatcher01')
WHERE role = 'driver';
