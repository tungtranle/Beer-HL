-- 010_order_confirmation.up.sql
-- Adds Zalo order confirmation flow: DVKH creates order → Zalo sends to customer → 2h auto-confirm

-- Add pending_customer_confirm status to order_status enum
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'pending_customer_confirm' AFTER 'draft';

-- Table for tracking order confirmations via Zalo (separate from delivery confirmations)
CREATE TABLE IF NOT EXISTS order_confirmations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES sales_orders(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    token VARCHAR(64) UNIQUE NOT NULL,
    phone VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'sent'
        CHECK (status IN ('sent', 'confirmed', 'rejected', 'auto_confirmed', 'expired')),
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    zalo_msg_id VARCHAR(100),
    pdf_url TEXT,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ,
    rejected_at TIMESTAMPTZ,
    reject_reason TEXT,
    auto_confirmed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_confirmations_order_id ON order_confirmations(order_id);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_token ON order_confirmations(token);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_status ON order_confirmations(status);
CREATE INDEX IF NOT EXISTS idx_order_confirmations_expires_at ON order_confirmations(expires_at) WHERE status = 'sent';
