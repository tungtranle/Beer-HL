-- 017: Handover Records (Bàn giao A/B/C)
-- Bàn giao A: Thủ kho + Bảo vệ + Lái xe ký xác nhận hàng lên xe
-- Bàn giao B: Lái xe + Khách hàng ký xác nhận giao hàng tại điểm
-- Bàn giao C: Lái xe + Thủ kho ký xác nhận trả hàng/vỏ cuối ngày

-- ===== ENUM TYPE =====
DO $$ BEGIN CREATE TYPE handover_type AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ===== ADD TRIP STATUS VALUES =====
-- Add new values to existing trip_status enum
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'handover_a_signed';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'unloading_returns';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'settling';
ALTER TYPE trip_status ADD VALUE IF NOT EXISTS 'vehicle_breakdown';

-- ===== HANDOVER RECORDS =====
CREATE TABLE IF NOT EXISTS handover_records (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    handover_type   handover_type NOT NULL,
    trip_id         UUID NOT NULL REFERENCES trips(id),
    stop_id         UUID REFERENCES trip_stops(id),    -- for type B only
    signatories     JSONB NOT NULL,                     -- [{role, user_id, name, signed_at}]
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    -- status: pending, partially_signed, completed
    document_url    TEXT,
    notes           TEXT,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_handover_records_trip ON handover_records(trip_id);
CREATE INDEX IF NOT EXISTS idx_handover_records_type ON handover_records(handover_type, trip_id);
CREATE INDEX IF NOT EXISTS idx_handover_records_stop ON handover_records(stop_id) WHERE stop_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_handover_records_status ON handover_records(status) WHERE status != 'completed';
