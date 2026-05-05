#!/bin/bash
# Run migration to seed QA system users

export PGPASSWORD="bhl"

psql -h localhost -U bhl -d bhl_oms << EOF
BEGIN;

-- Insert system QA user
INSERT INTO users (
    id, created_at, updated_at, name, email, phone, username, password_hash, role, is_active
) VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid, NOW(), NOW(),
    'System QA User', 'qa@bhl.local', '0000', 'qa-system', 'NOHASH', 'management', true
) ON CONFLICT (id) DO NOTHING;

-- Verify insert
SELECT id, name, role FROM users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid;

COMMIT;
EOF
