-- 005: ePOD (Electronic Proof of Delivery) + Payment recording
-- Supports Tasks 2.11 (ePOD), 2.12 (Payment), 2.13 (Return collection)

-- Payment method enum
DO $$ BEGIN
    CREATE TYPE payment_method AS ENUM ('cash', 'transfer', 'credit', 'cod');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Payment status enum
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('pending', 'collected', 'confirmed', 'failed');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ePOD records for each trip stop delivery
CREATE TABLE IF NOT EXISTS epod (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES drivers(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    
    -- Delivery confirmation
    delivered_items JSONB NOT NULL DEFAULT '[]',  -- [{product_id, ordered_qty, delivered_qty, reason}]
    receiver_name VARCHAR(200),
    receiver_phone VARCHAR(20),
    signature_url TEXT,          -- Base64 or S3 URL of signature image
    photo_urls TEXT[] DEFAULT '{}',  -- Array of photo URLs
    
    -- Amounts
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    deposit_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    
    -- Status
    delivery_status VARCHAR(30) NOT NULL DEFAULT 'delivered',  -- delivered, partial, rejected
    notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_epod_trip_stop ON epod(trip_stop_id);
CREATE INDEX IF NOT EXISTS idx_epod_driver ON epod(driver_id, created_at DESC);

-- Payment records
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_stop_id UUID NOT NULL REFERENCES trip_stops(id) ON DELETE CASCADE,
    epod_id UUID REFERENCES epod(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    driver_id UUID NOT NULL REFERENCES drivers(id),
    order_id UUID REFERENCES sales_orders(id),
    
    payment_method payment_method NOT NULL DEFAULT 'cash',
    amount NUMERIC(15,2) NOT NULL,
    status payment_status NOT NULL DEFAULT 'collected',
    reference_number VARCHAR(100),  -- transfer reference or receipt number
    
    notes TEXT,
    collected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    confirmed_at TIMESTAMPTZ,
    confirmed_by UUID REFERENCES users(id),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_stop ON payments(trip_stop_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status) WHERE status = 'collected';
