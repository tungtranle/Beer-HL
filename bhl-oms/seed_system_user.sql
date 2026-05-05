-- Seed system user for QA Portal
INSERT INTO users (id, name, email, phone, role, username, password_hash, is_active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'System QA User',
    'qa-system@bhl.local',
    '0000000000',
    'management',
    'qa-system',
    'SYSTEM_USER_NO_PASSWORD',
    true,
    NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Also seed test user qa.demo if they can login
INSERT INTO users (id, name, email, phone, role, username, password_hash, is_active, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'QA Demo User',
    'qa.demo@bhl.local',
    '0000000001',
    'management',
    'qa.demo',
    'DEMO_USER_PLACEHOLDER',
    true,
    NOW()
)
ON CONFLICT (id) DO NOTHING;
