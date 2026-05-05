-- SQL script to seed QA system users
-- Run this manually via Docker or psql

BEGIN;

-- Insert system QA user (hardcoded in demo_handler.go LoadDemoScenario)
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
    is_active,
    warehouse_id
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    NOW(),
    NOW(),
    'System QA User',
    'qa@bhl.local',
    '0000000000',
    'qa-system',
    'SYSTEM_NO_PASSWORD_QA',
    'management',
    true,
    NULL
) ON CONFLICT (id) DO UPDATE SET updated_at = NOW();

COMMIT;
