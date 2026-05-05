-- file: migrations/1000_seed_qa_system_users.sql
-- Seed system users for QA Portal testing

BEGIN;

-- Insert system QA user (will be used for CreateRun when no auth)
INSERT INTO users (
    id,
    created_at,
    updated_at,
    name,
    email,
    phone,
    username,
    password_hash,
    role,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    NOW(),
    NOW(),
    'System QA User',
    'qa-system@bhl.local',
    '0000000000',
    'qa-system',
    'SYSTEM_NO_LOGIN',
    'management',
    true
)
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

-- Insert QA demo user
INSERT INTO users (
    id,
    created_at,
    updated_at,
    name,
    email,
    phone,
    username,
    password_hash,
    role,
    is_active
) VALUES (
    '00000000-0000-0000-0000-000000000002'::uuid,
    NOW(),
    NOW(),
    'QA Demo User',
    'qa.demo@bhl.local',
    '0000000001',
    'qa.demo',
    'demo123_hashed',
    'management',
    true
)
ON CONFLICT (id) DO UPDATE SET
    updated_at = NOW();

COMMIT;
