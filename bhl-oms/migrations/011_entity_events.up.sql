-- Migration 011: Entity Events (Activity Timeline) + Order Notes
-- Immutable event log for all entity status changes, actions, and notes

-- ===== ENTITY EVENTS — Universal activity timeline =====
CREATE TABLE IF NOT EXISTS entity_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL,       -- 'order', 'trip', 'shipment', 'payment'
    entity_id UUID NOT NULL,                -- FK to the entity
    event_type VARCHAR(80) NOT NULL,        -- 'order.created', 'order.confirmed', etc.
    actor_type VARCHAR(20) NOT NULL DEFAULT 'system', -- 'user', 'system', 'customer', 'cron'
    actor_id UUID,                          -- user ID (NULL for system/cron)
    actor_name VARCHAR(200),                -- display name (denormalized for fast read)
    title VARCHAR(500) NOT NULL,            -- human-readable title (Vietnamese)
    detail JSONB DEFAULT '{}',              -- structured extra data
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Immutable: no UPDATE or DELETE should happen on this table
COMMENT ON TABLE entity_events IS 'Immutable event log for entity activity timeline. Never UPDATE or DELETE rows.';

-- Indexes for fast timeline queries
CREATE INDEX idx_entity_events_entity ON entity_events (entity_type, entity_id, created_at DESC);
CREATE INDEX idx_entity_events_type ON entity_events (event_type);
CREATE INDEX idx_entity_events_actor ON entity_events (actor_id) WHERE actor_id IS NOT NULL;
CREATE INDEX idx_entity_events_created ON entity_events (created_at DESC);

-- ===== ORDER NOTES — Internal notes by staff =====
CREATE TABLE IF NOT EXISTS order_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sales_orders(id),
    user_id UUID NOT NULL REFERENCES users(id),
    user_name VARCHAR(200),                 -- denormalized for fast read
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_order_notes_order ON order_notes (order_id, created_at DESC);

-- ===== NOTIFICATION ENHANCEMENTS =====
-- Add priority and entity reference to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(10) DEFAULT 'normal';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_type VARCHAR(50);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS entity_id UUID;

CREATE INDEX idx_notifications_entity ON notifications (entity_type, entity_id)
    WHERE entity_type IS NOT NULL;
CREATE INDEX idx_notifications_priority ON notifications (priority, created_at DESC)
    WHERE is_read = false;
