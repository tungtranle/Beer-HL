-- 016 DOWN: Revert notification enhancements + RBAC + sessions

DROP TABLE IF EXISTS active_sessions;
DROP TABLE IF EXISTS user_permission_overrides;
DROP TABLE IF EXISTS role_permissions;

ALTER TABLE notifications DROP COLUMN IF EXISTS actions;
ALTER TABLE notifications DROP COLUMN IF EXISTS group_key;
