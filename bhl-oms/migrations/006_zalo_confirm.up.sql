-- Migration 006: Zalo confirmation tracking (Tasks 3.6, 3.7)
-- SM-06: sent → confirmed / disputed / auto_confirmed / expired

CREATE TYPE zalo_confirm_status AS ENUM ('sent', 'confirmed', 'disputed', 'auto_confirmed', 'expired');

CREATE TABLE zalo_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sales_orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    trip_stop_id UUID REFERENCES trip_stops(id),
    token VARCHAR(64) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    status zalo_confirm_status NOT NULL DEFAULT 'sent',
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    zalo_msg_id VARCHAR(100),
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    disputed_at TIMESTAMPTZ,
    dispute_reason TEXT,
    auto_confirmed_at TIMESTAMPTZ,
    expired_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_zalo_confirmations_order ON zalo_confirmations(order_id);
CREATE INDEX idx_zalo_confirmations_token ON zalo_confirmations(token);
CREATE INDEX idx_zalo_confirmations_status ON zalo_confirmations(status);
CREATE INDEX idx_zalo_confirmations_sent_at ON zalo_confirmations(sent_at);
