-- 016: Notification enhancements (actions, grouping) + Admin RBAC + Sessions
-- Part 1: Notification upgrades
-- Part 2: Role permissions (dynamic RBAC)
-- Part 3: User permission overrides
-- Part 4: Active sessions tracking

-- =============================================
-- 1. NOTIFICATION ENHANCEMENTS
-- =============================================
-- Add actions (inline action buttons), group_key (grouping similar notifs)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actions JSONB;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key TEXT;

CREATE INDEX idx_notifications_group ON notifications (group_key, created_at DESC)
    WHERE group_key IS NOT NULL;

-- =============================================
-- 2. ROLE PERMISSIONS (Dynamic RBAC)
-- =============================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role         TEXT NOT NULL,
    resource     TEXT NOT NULL,
    action       TEXT NOT NULL,
    scope        TEXT NOT NULL DEFAULT 'all',
    is_allowed   BOOLEAN NOT NULL DEFAULT true,
    updated_by   UUID REFERENCES users(id),
    updated_at   TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, resource, action)
);

-- Seed default permissions for all 9 roles
-- admin: full access to everything
INSERT INTO role_permissions (role, resource, action, scope, is_allowed) VALUES
  -- admin: full access
  ('admin', 'orders', 'create', 'all', true),
  ('admin', 'orders', 'read', 'all', true),
  ('admin', 'orders', 'update', 'all', true),
  ('admin', 'orders', 'delete', 'all', true),
  ('admin', 'orders', 'approve', 'all', true),
  ('admin', 'orders', 'export', 'all', true),
  ('admin', 'trips', 'create', 'all', true),
  ('admin', 'trips', 'read', 'all', true),
  ('admin', 'trips', 'update', 'all', true),
  ('admin', 'trips', 'delete', 'all', true),
  ('admin', 'trips', 'approve', 'all', true),
  ('admin', 'trips', 'export', 'all', true),
  ('admin', 'stock', 'create', 'all', true),
  ('admin', 'stock', 'read', 'all', true),
  ('admin', 'stock', 'update', 'all', true),
  ('admin', 'stock', 'delete', 'all', true),
  ('admin', 'stock', 'approve', 'all', true),
  ('admin', 'stock', 'export', 'all', true),
  ('admin', 'users', 'create', 'all', true),
  ('admin', 'users', 'read', 'all', true),
  ('admin', 'users', 'update', 'all', true),
  ('admin', 'users', 'delete', 'all', true),
  ('admin', 'users', 'approve', 'all', true),
  ('admin', 'users', 'export', 'all', true),
  ('admin', 'configs', 'create', 'all', true),
  ('admin', 'configs', 'read', 'all', true),
  ('admin', 'configs', 'update', 'all', true),
  ('admin', 'configs', 'delete', 'all', true),
  ('admin', 'configs', 'approve', 'all', true),
  ('admin', 'configs', 'export', 'all', true),
  ('admin', 'reports', 'create', 'all', true),
  ('admin', 'reports', 'read', 'all', true),
  ('admin', 'reports', 'update', 'all', true),
  ('admin', 'reports', 'delete', 'all', true),
  ('admin', 'reports', 'approve', 'all', true),
  ('admin', 'reports', 'export', 'all', true),
  ('admin', 'reconciliation', 'create', 'all', true),
  ('admin', 'reconciliation', 'read', 'all', true),
  ('admin', 'reconciliation', 'update', 'all', true),
  ('admin', 'reconciliation', 'delete', 'all', true),
  ('admin', 'reconciliation', 'approve', 'all', true),
  ('admin', 'reconciliation', 'export', 'all', true),

  -- dispatcher: manage orders + trips + basic stock read
  ('dispatcher', 'orders', 'create', 'all', true),
  ('dispatcher', 'orders', 'read', 'all', true),
  ('dispatcher', 'orders', 'update', 'all', true),
  ('dispatcher', 'orders', 'approve', 'all', true),
  ('dispatcher', 'orders', 'export', 'all', true),
  ('dispatcher', 'trips', 'create', 'all', true),
  ('dispatcher', 'trips', 'read', 'all', true),
  ('dispatcher', 'trips', 'update', 'all', true),
  ('dispatcher', 'trips', 'approve', 'all', true),
  ('dispatcher', 'trips', 'export', 'all', true),
  ('dispatcher', 'stock', 'read', 'all', true),
  ('dispatcher', 'reports', 'read', 'all', true),
  ('dispatcher', 'reports', 'export', 'all', true),

  -- driver: read own trips, update stop status
  ('driver', 'orders', 'read', 'own_warehouse', true),
  ('driver', 'trips', 'read', 'own_warehouse', true),
  ('driver', 'trips', 'update', 'own_warehouse', true),

  -- warehouse_handler: stock operations
  ('warehouse_handler', 'stock', 'create', 'own_warehouse', true),
  ('warehouse_handler', 'stock', 'read', 'own_warehouse', true),
  ('warehouse_handler', 'stock', 'update', 'own_warehouse', true),
  ('warehouse_handler', 'orders', 'read', 'own_warehouse', true),
  ('warehouse_handler', 'trips', 'read', 'own_warehouse', true),

  -- accountant: reconciliation + financial reports
  ('accountant', 'orders', 'read', 'all', true),
  ('accountant', 'orders', 'export', 'all', true),
  ('accountant', 'trips', 'read', 'all', true),
  ('accountant', 'reconciliation', 'create', 'all', true),
  ('accountant', 'reconciliation', 'read', 'all', true),
  ('accountant', 'reconciliation', 'update', 'all', true),
  ('accountant', 'reconciliation', 'approve', 'all', true),
  ('accountant', 'reconciliation', 'export', 'all', true),
  ('accountant', 'reports', 'read', 'all', true),
  ('accountant', 'reports', 'export', 'all', true),

  -- management: read + export everything, approve
  ('management', 'orders', 'read', 'all', true),
  ('management', 'orders', 'approve', 'all', true),
  ('management', 'orders', 'export', 'all', true),
  ('management', 'trips', 'read', 'all', true),
  ('management', 'trips', 'export', 'all', true),
  ('management', 'stock', 'read', 'all', true),
  ('management', 'stock', 'export', 'all', true),
  ('management', 'reconciliation', 'read', 'all', true),
  ('management', 'reconciliation', 'approve', 'all', true),
  ('management', 'reconciliation', 'export', 'all', true),
  ('management', 'reports', 'read', 'all', true),
  ('management', 'reports', 'export', 'all', true),
  ('management', 'users', 'read', 'all', true),

  -- dvkh: read orders, limited trips
  ('dvkh', 'orders', 'create', 'all', true),
  ('dvkh', 'orders', 'read', 'all', true),
  ('dvkh', 'orders', 'update', 'all', true),
  ('dvkh', 'trips', 'read', 'all', true),
  ('dvkh', 'reports', 'read', 'all', true),

  -- security: gate checks
  ('security', 'trips', 'read', 'own_warehouse', true),
  ('security', 'stock', 'read', 'own_warehouse', true),

  -- workshop: vehicle/asset management
  ('workshop', 'stock', 'read', 'own_warehouse', true),
  ('workshop', 'stock', 'update', 'own_warehouse', true),
  ('workshop', 'trips', 'read', 'own_warehouse', true)
ON CONFLICT (role, resource, action) DO NOTHING;

-- =============================================
-- 3. USER PERMISSION OVERRIDES
-- =============================================
CREATE TABLE IF NOT EXISTS user_permission_overrides (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    resource   TEXT NOT NULL,
    action     TEXT NOT NULL,
    is_allowed BOOLEAN NOT NULL,
    reason     TEXT,
    granted_by UUID REFERENCES users(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_perm_overrides_user ON user_permission_overrides (user_id);
CREATE INDEX idx_user_perm_overrides_expiry ON user_permission_overrides (expires_at)
    WHERE expires_at IS NOT NULL;

-- =============================================
-- 4. ACTIVE SESSIONS
-- =============================================
CREATE TABLE IF NOT EXISTS active_sessions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash TEXT NOT NULL,
    ip_address         INET,
    user_agent         TEXT,
    last_seen_at       TIMESTAMPTZ DEFAULT NOW(),
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    revoked_at         TIMESTAMPTZ
);

CREATE INDEX idx_active_sessions_user ON active_sessions (user_id, created_at DESC);
CREATE INDEX idx_active_sessions_active ON active_sessions (user_id)
    WHERE revoked_at IS NULL;
