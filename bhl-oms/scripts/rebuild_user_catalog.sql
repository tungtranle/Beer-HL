-- Rebuild canonical user catalog
-- WARNING: Review and run on staging first. Backup `users` table before swapping.

-- 0) Allowed roles in system
-- admin, dispatcher, driver, warehouse, accountant, management, dvkh, security, workshop

-- 1) Anomaly reports (run and review)
-- Duplicate usernames (case-insensitive)
SELECT lower(username) AS uname_lc, count(*) AS cnt
FROM users
GROUP BY lower(username)
HAVING count(*) > 1
ORDER BY cnt DESC;

-- Users without password hash (can't login)
SELECT id, username, email, role, is_active, created_at
FROM users
WHERE coalesce(password_hash, '') = '' OR password_hash IS NULL
ORDER BY created_at DESC;

-- Null or empty roles
SELECT id, username, email, role
FROM users
WHERE role IS NULL OR trim(role) = '';

-- Unknown roles (not in allowed list)
SELECT id, username, role
FROM users
WHERE role IS NOT NULL AND role NOT IN ('admin','dispatcher','driver','warehouse','accountant','management','dvkh','security','workshop')
ORDER BY role;

-- Multiple distinct emails for same username
SELECT lower(username) AS uname_lc, array_agg(DISTINCT email) AS emails, count(*)
FROM users
GROUP BY lower(username)
HAVING count(DISTINCT email) > 1;

-- 2) Create canonical table (if not exists)
CREATE TABLE IF NOT EXISTS users_canonical (
    id uuid PRIMARY KEY,
    username text UNIQUE NOT NULL,
    full_name text NOT NULL,
    email text,
    password_hash text,
    role text NOT NULL,
    permissions text[],
    warehouse_ids uuid[],
    is_active boolean DEFAULT true,
    last_login_at timestamptz,
    created_at timestamptz DEFAULT now()
);

-- 3) Build deduplicated selection (adjust priorities as needed)
-- Priority: prefer active accounts, prefer rows with password_hash, newest created_at
WITH ranked AS (
    SELECT *,
        row_number() OVER (
            PARTITION BY lower(username)
            ORDER BY (CASE WHEN is_active THEN 0 ELSE 1 END),
                     (CASE WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 0 ELSE 1 END),
                     created_at DESC NULLS LAST
        ) AS rn
    FROM users
)
SELECT * FROM ranked WHERE rn = 1 LIMIT 5; -- preview the chosen rows

-- 4) Populate `users_canonical` (dry-run: use INSERT ... SELECT without executing)
-- To execute: comment out BEGIN/ROLLBACK and run inside a backup workflow.

-- BEGIN;
-- TRUNCATE users_canonical;
-- INSERT INTO users_canonical (id, username, full_name, email, password_hash, role, permissions, warehouse_ids, is_active, last_login_at, created_at)
-- SELECT id, lower(username) AS username, full_name, email, password_hash, role, permissions, warehouse_ids, is_active, last_login_at, created_at
-- FROM (
--     SELECT *,
--         row_number() OVER (
--             PARTITION BY lower(username)
--             ORDER BY (CASE WHEN is_active THEN 0 ELSE 1 END),
--                      (CASE WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 0 ELSE 1 END),
--                      created_at DESC NULLS LAST
--         ) AS rn
--     FROM users
-- ) t
-- WHERE t.rn = 1;
-- COMMIT;

-- 5) Swap tables (manual steps recommended)
-- After verifying `users_canonical` contents and backing up `users`, you can swap:
-- BEGIN;
-- ALTER TABLE users RENAME TO users_backup_$(date +%s);
-- ALTER TABLE users_canonical RENAME TO users;
-- COMMIT;

-- 5a) Role mapping helpers
-- Create a mapping table to normalize historical or misspelled roles.
CREATE TABLE IF NOT EXISTS role_mapping (
    role_raw text PRIMARY KEY,
    role_mapped text NOT NULL
);

-- Example inserts (review and edit before applying):
-- INSERT INTO role_mapping(role_raw, role_mapped) VALUES
--   ('adminstrator', 'admin'),
--   ('dispatch', 'dispatcher'),
--   ('ware', 'warehouse');

-- Use mapping when populating canonical table. Example dry-run SELECT:
WITH ranked AS (
    SELECT *,
        row_number() OVER (
            PARTITION BY lower(username)
            ORDER BY (CASE WHEN is_active THEN 0 ELSE 1 END),
                     (CASE WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 0 ELSE 1 END),
                     created_at DESC NULLS LAST
        ) AS rn
    FROM users
), chosen AS (
    SELECT * FROM ranked WHERE rn = 1
), mapped AS (
    SELECT c.*,
           coalesce(r.role_mapped, c.role) AS role_normalized
    FROM chosen c
    LEFT JOIN role_mapping r ON c.role = r.role_raw
)
SELECT id, lower(username) AS username, full_name, email, password_hash, role_normalized AS role, permissions, warehouse_ids, is_active, last_login_at, created_at
FROM mapped
LIMIT 20;

-- 5b) Populate using mapping (ready-to-run but keep in transaction & test on staging):
-- BEGIN;
-- TRUNCATE users_canonical;
-- INSERT INTO users_canonical (id, username, full_name, email, password_hash, role, permissions, warehouse_ids, is_active, last_login_at, created_at)
-- SELECT id, lower(username) AS username, full_name, email, password_hash, coalesce(r.role_mapped, t.role) AS role, permissions, warehouse_ids, is_active, last_login_at, created_at
-- FROM (
--     SELECT *,
--         row_number() OVER (
--             PARTITION BY lower(username)
--             ORDER BY (CASE WHEN is_active THEN 0 ELSE 1 END),
--                      (CASE WHEN password_hash IS NOT NULL AND password_hash <> '' THEN 0 ELSE 1 END),
--                      created_at DESC NULLS LAST
--         ) AS rn
--     FROM users
-- ) t
-- LEFT JOIN role_mapping r ON t.role = r.role_raw
-- WHERE t.rn = 1;
-- COMMIT;

-- 6) Post-migration checks
-- Count differences
SELECT (SELECT count(*) FROM users) AS new_count, (SELECT count(*) FROM users_backup_*) AS old_count;

-- 7) Mapping unknown roles (example)
-- Create a report of unknown roles to decide manual mapping
SELECT role, count(*) FROM users_backup_* GROUP BY role ORDER BY count DESC;

-- NOTE:
-- - This script assumes a single `users` table exists. If historical data was loaded into other tables (e.g., users_legacy, imported_users_csv), adapt INSERT source accordingly.
-- - Do not run swap on production without full backup and staging validation.
-- - If you need automated mapping of unknown roles, provide mapping rules and I can extend this script.
